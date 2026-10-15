/* global window */
// ─────────────────────────────────────────────────────────────────
//  공지사항 · 이벤트 게시판 — Supabase 연동 (board_posts)
//   · 공개 목록/상세: 비회원 포함 누구나 조회 가능 — RLS가 status='published'만 돌려준다
//   · 작성/수정/삭제(소프트): 관리자만 — RLS(board_posts_admin_all, is_admin())가 실제 경계다.
//     여기 함수들은 화면 편의일 뿐, 권한은 DB에서 막는다(버튼을 숨기는 것으로 보안을 대신하지 않음).
//   · category/status는 영문 코드로 저장 — 한글 리터럴 비교로 생기는 Unicode NFC/NFD 문제
//     (성적표 과목 정렬에서 실제로 겪었던 버그)를 이 테이블에서는 애초에 만들지 않는다.
//     한글 라벨은 boardCategoryLabel()처럼 화면에서만 매핑한다.
// ─────────────────────────────────────────────────────────────────

const RJ_BOARD_CATEGORIES = [
  { id: "notice", ko: "공지사항" },
  { id: "academic", ko: "학사일정" },
  { id: "examnotice", ko: "월간평가" },
  { id: "event", ko: "이벤트" },
  { id: "resource", ko: "자료실" },
];
function boardCategoryLabel(id) {
  const c = RJ_BOARD_CATEGORIES.find((x) => x.id === id);
  return c ? c.ko : "기타";
}
const RJ_BOARD_STATUS_KO = { draft: "임시저장", published: "공개", hidden: "비공개", deleted: "삭제됨" };
function boardStatusLabel(s) { return RJ_BOARD_STATUS_KO[s] || s; }

const RJ_BOARD_PAGE_SIZE = 10;

// "YYYY-MM-DD" → "YYYY.MM.DD." / "YYYY-MM-DDTHH:mm:ss..." 도 안전하게 처리
function fmtBoardDate(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}.`;
}
// "2026-11-27" → "2026년 11월 27일" (월간평가 표 전용 긴 표기)
function fmtBoardDateLong(ymd) {
  const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return ymd || "";
  return `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일`;
}

// ── 공개 목록 ──────────────────────────────────────────────────────
//   정렬: 중요 공지(is_pinned) 먼저, 그 안에서 최신(published_at) 순 — 하나의 ORDER BY로
//   처리되므로 페이지를 넘겨도 같은 글이 중복되거나 빠지지 않는다.
async function fetchBoardPosts({ category, q, page = 1, pageSize = RJ_BOARD_PAGE_SIZE } = {}) {
  const sb = window.getSupabase && window.getSupabase();
  if (!sb) return { ok: false, rows: [], total: 0, error: "no-db" };
  try {
    let query = sb.from("board_posts")
      .select("id, category, title, is_pinned, is_urgent, published_at", { count: "exact" })
      .eq("status", "published");
    if (category && category !== "all") query = query.eq("category", category);
    if (q && q.trim()) query = query.ilike("title", "%" + q.trim() + "%");
    query = query.order("is_pinned", { ascending: false }).order("published_at", { ascending: false });
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await query.range(from, to);
    if (error) return { ok: false, rows: [], total: 0, error: error.message };
    return { ok: true, rows: data || [], total: count || 0 };
  } catch (e) { return { ok: false, rows: [], total: 0, error: String(e) }; }
}

// ── 공개 상세 ──────────────────────────────────────────────────────
//   RLS가 published 이외(draft/hidden/deleted/존재하지 않음)를 모두 null로 돌려주므로,
//   "비공개라서 못 봄"과 "애초에 없음"을 화면에서 구분하지 않는다(존재 자체를 노출하지 않기 위함).
async function fetchBoardPostById(id) {
  const sb = window.getSupabase && window.getSupabase();
  if (!sb || !id) return { ok: false, post: null };
  try {
    const { data, error } = await sb.from("board_posts").select("*").eq("id", id).maybeSingle();
    if (error) return { ok: false, post: null, error: error.message };
    return { ok: true, post: data || null };
  } catch (e) { return { ok: false, post: null, error: String(e) }; }
}

// ── 이전 글 / 다음 글 ──────────────────────────────────────────────
//   전체 공개글 기준 발행일 순서로 인접한 글(중요공지 고정/현재 카테고리·검색 조건과 무관) —
//   "이전 글"=더 최신(목록 상 위), "다음 글"=더 오래됨(목록 상 아래).
async function fetchBoardAdjacent(post) {
  const sb = window.getSupabase && window.getSupabase();
  if (!sb || !post || !post.published_at) return { prevPost: null, nextPost: null };
  try {
    const [{ data: newerRows }, { data: olderRows }] = await Promise.all([
      sb.from("board_posts").select("id, title")
        .eq("status", "published").gt("published_at", post.published_at)
        .order("published_at", { ascending: true }).limit(1),
      sb.from("board_posts").select("id, title")
        .eq("status", "published").lt("published_at", post.published_at)
        .order("published_at", { ascending: false }).limit(1),
    ]);
    return {
      prevPost: (newerRows && newerRows[0]) || null,
      nextPost: (olderRows && olderRows[0]) || null,
    };
  } catch (e) { return { prevPost: null, nextPost: null }; }
}

// ── 관리자 전용 ────────────────────────────────────────────────────
//   draft/published/hidden 모두 조회(삭제된 글은 기본 목록에서 제외) — RLS(is_admin())가
//   실제 권한을 검증하므로, 관리자가 아닌 세션에서 호출되면 빈 배열이 돌아온다.
async function fetchBoardPostsAdmin({ category, status, page = 1, pageSize = 20 } = {}) {
  const sb = window.getSupabase && window.getSupabase();
  if (!sb) return { ok: false, rows: [], total: 0 };
  try {
    let query = sb.from("board_posts").select("*", { count: "exact" }).neq("status", "deleted");
    if (category && category !== "all") query = query.eq("category", category);
    if (status && status !== "all") query = query.eq("status", status);
    query = query.order("created_at", { ascending: false });
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await query.range(from, to);
    if (error) return { ok: false, rows: [], total: 0, error: error.message };
    return { ok: true, rows: data || [], total: count || 0 };
  } catch (e) { return { ok: false, rows: [], total: 0, error: String(e) }; }
}

// post: { id?, category, title, content, contentFormat, status, isPinned, isUrgent, examInfo }
//   id가 있으면 수정, 없으면 새 글 작성(author_id는 현재 로그인 사용자로 서버에서 채움).
//   contentFormat 생략 시 'text'(기존 평문 글과 동일하게 동작) — 새 에디터로
//   저장하는 화면만 명시적으로 'html'을 넘긴다.
async function saveBoardPost(post) {
  const sb = window.getSupabase && window.getSupabase();
  if (!sb) return { ok: false, error: "no-db" };
  try {
    const row = {
      category: post.category,
      title: post.title,
      content: post.content || "",
      content_format: post.contentFormat === "html" ? "html" : "text",
      exam_info: post.category === "examnotice" ? (post.examInfo || null) : null,
      status: post.status || "draft",
      is_pinned: !!post.isPinned,
      is_urgent: !!post.isUrgent,
    };
    if (post.id) {
      const { data, error } = await sb.from("board_posts").update(row).eq("id", post.id).select("*").maybeSingle();
      if (error) return { ok: false, error: error.message };
      return { ok: true, post: data };
    }
    let authorId = null;
    try { const { data: { user } } = await sb.auth.getUser(); authorId = user ? user.id : null; } catch (e) {}
    const { data, error } = await sb.from("board_posts").insert({ ...row, author_id: authorId }).select("*").maybeSingle();
    if (error) return { ok: false, error: error.message };
    return { ok: true, post: data };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// 소프트 삭제 — 물리적으로 지우지 않고 status='deleted'로만 전환한다.
//   이후 공개 조회(board_posts_public_read)와 관리자 기본 목록 둘 다에서 자동으로 제외된다.
//   관리자 목록에서도 다시는 이 글을 찾을 수 없게 되므로(fetchBoardPostsAdmin이
//   status='deleted'를 제외함) — 이 시점을 놓치면 첨부파일을 영영 정리할 길이
//   없어진다. board_posts를 물리적으로 지우지 않아 FK의 ON DELETE CASCADE가
//   발동하지 않으므로, 여기서 직접 첨부파일(Storage+DB)을 함께 정리한다.
async function deleteBoardPost(id) {
  const sb = window.getSupabase && window.getSupabase();
  if (!sb || !id) return { ok: false };
  try {
    const { error } = await sb.from("board_posts").update({ status: "deleted" }).eq("id", id);
    if (error) return { ok: false, error: error.message };
  } catch (e) { return { ok: false, error: String(e) }; }

  let attachmentWarning = null;
  try {
    const list = await listBoardAttachments(id);
    if (list.ok && list.rows.length > 0) {
      const results = await Promise.all(list.rows.map((a) => deleteBoardAttachment(a)));
      const failed = results.filter((r) => !r.ok).length;
      if (failed > 0) attachmentWarning = `첨부파일 ${failed}개는 정리하지 못했습니다(파일은 삭제됐으나 목록에 남아있을 수 있음)`;
    }
  } catch (e) { attachmentWarning = "첨부파일 정리 중 오류: " + String(e); }

  return attachmentWarning ? { ok: true, warning: attachmentWarning } : { ok: true };
}

// ── 첨부파일(board_attachments) ────────────────────────────────────
//   JSONB 배열 통짜 교체 대신 행 단위 테이블을 쓰는 이유: 동시 수정 충돌과
//   고아 행 추적 불가 문제를 피하기 위함(설계 문서 B 참고). url은 저장하지
//   않고 storage_path만 저장 — 실제 열람은 항상 그 순간 새로 서명 URL을
//   발급해서 이뤄진다(getBoardAttachmentUrl).
const BOARD_ATTACH_BUCKET = "board-attachments";
const BOARD_ATTACH_MAX_BYTES = 15 * 1024 * 1024; // storage.buckets.file_size_limit과 동일(15MB)
const BOARD_ATTACH_ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

// 파일의 실제 바이트(매직 넘버)로 형식을 확인한다 — file.type과 확장자는
// 클라이언트가 그대로 조작할 수 있으므로 신뢰하지 않는다.
function sniffFileSignature(bytes) {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
      && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return "application/pdf";
  return null;
}

function readFileHeader(file, byteCount) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = () => reject(reader.error || new Error("파일을 읽을 수 없습니다"));
    reader.readAsArrayBuffer(file.slice(0, byteCount));
  });
}

// 확장자 제한은 두지 않고(파일명은 무엇이든 가능) file.type + 실제 바이트
// 시그니처 두 가지가 서로 맞물려야만 통과시킨다.
async function validateBoardAttachmentFile(file) {
  if (!file) return { ok: false, error: "파일이 없습니다" };
  if (file.size <= 0) return { ok: false, error: "빈 파일은 업로드할 수 없습니다" };
  if (file.size > BOARD_ATTACH_MAX_BYTES) return { ok: false, error: "파일 크기는 15MB를 넘을 수 없습니다" };
  if (!BOARD_ATTACH_ALLOWED_MIME.includes(file.type)) {
    return { ok: false, error: "JPG, PNG, WebP, PDF 파일만 업로드할 수 있습니다" };
  }
  let header;
  try { header = await readFileHeader(file, 16); }
  catch (e) { return { ok: false, error: "파일을 읽는 중 오류가 발생했습니다" }; }
  const sniffed = sniffFileSignature(header);
  if (!sniffed || sniffed !== file.type) {
    return { ok: false, error: "파일 내용이 확장자/형식과 일치하지 않습니다" };
  }
  return { ok: true, mime: sniffed };
}

function sanitizeAttachmentFileName(name) {
  return String(name || "file").normalize("NFC").replace(/[^\w.\-가-힣 ]/g, "_").slice(0, 180);
}

function randomAttachmentId() {
  try { return window.crypto.randomUUID(); } catch (e) { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
}

// post가 이미 저장되어 id가 있어야 한다(경로에 postId를 포함해 소유 게시글을
// 명확히 한다). Storage 업로드 성공 후에만 DB 행을 insert하고, insert가
// 실패하면 방금 올린 파일을 즉시 되돌려 고아 파일을 남기지 않는다.
async function uploadBoardAttachment({ postId, file, kind = "attachment", ordinal = 0 }) {
  const sb = window.getSupabase && window.getSupabase();
  if (!sb) return { ok: false, error: "no-db" };
  if (!postId) return { ok: false, error: "게시글을 먼저 저장한 뒤 첨부파일을 추가해 주세요" };
  const v = await validateBoardAttachmentFile(file);
  if (!v.ok) return { ok: false, error: v.error };

  const path = postId + "/" + randomAttachmentId() + "_" + sanitizeAttachmentFileName(file.name);
  try {
    const { error: upErr } = await sb.storage.from(BOARD_ATTACH_BUCKET)
      .upload(path, file, { contentType: v.mime, upsert: false });
    if (upErr) return { ok: false, error: "업로드에 실패했습니다: " + upErr.message };

    let authorId = null;
    try { const { data: { user } } = await sb.auth.getUser(); authorId = user ? user.id : null; } catch (e) {}

    const { data, error } = await sb.from("board_attachments").insert({
      post_id: postId, kind, storage_path: path,
      file_name: file.name || "file", mime_type: v.mime, size_bytes: file.size,
      ordinal, uploaded_by: authorId,
    }).select("*").maybeSingle();

    if (error) {
      try { await sb.storage.from(BOARD_ATTACH_BUCKET).remove([path]); } catch (e) {}
      return { ok: false, error: "첨부파일 정보를 저장하지 못했습니다: " + error.message };
    }
    return { ok: true, attachment: data };
  } catch (e) {
    try { await sb.storage.from(BOARD_ATTACH_BUCKET).remove([path]); } catch (e2) {}
    return { ok: false, error: String(e) };
  }
}

// 관리자 화면 — 한 게시글의 첨부파일 전체(첨부/본문이미지/대표이미지) 조회.
async function listBoardAttachments(postId) {
  const sb = window.getSupabase && window.getSupabase();
  if (!sb || !postId) return { ok: false, rows: [] };
  try {
    const { data, error } = await sb.from("board_attachments").select("*")
      .eq("post_id", postId).order("kind").order("ordinal").order("created_at");
    if (error) return { ok: false, rows: [], error: error.message };
    return { ok: true, rows: data || [] };
  } catch (e) { return { ok: false, rows: [], error: String(e) }; }
}

// 공개 상세 페이지 — "첨부파일" 목록에 노출할 kind='attachment'만.
// RLS가 이미 published 게시글의 행만 돌려주므로 추가 권한 체크는 불필요.
async function fetchPublicAttachments(postId) {
  const r = await listBoardAttachments(postId);
  if (!r.ok) return r;
  return { ok: true, rows: r.rows.filter((a) => a.kind === "attachment") };
}

function extractReferencedBoardPaths(html) {
  const set = new Set();
  const re = /data-board-path="([^"]+)"/g;
  let m;
  while ((m = re.exec(String(html || "")))) set.add(m[1]);
  return set;
}

// 저장 시점에 호출 — 본문(content)에 더 이상 data-board-path로 참조되지 않는
// inline_image 첨부를 정리한다(에디터에서 이미지를 지웠거나, 올렸다가 저장
// 전에 글 작성을 취소한 경우 등 — 방치하면 Storage에 영원히 고아로 남는다).
// 베스트 에포트 정리이므로 실패해도 저장 자체를 막지 않는다.
async function pruneUnreferencedInlineImages(postId, html) {
  if (!postId) return { ok: true, removed: 0 };
  try {
    const list = await listBoardAttachments(postId);
    if (!list.ok) return { ok: false, removed: 0 };
    const referenced = extractReferencedBoardPaths(html);
    const orphans = list.rows.filter((a) => a.kind === "inline_image" && !referenced.has(a.storage_path));
    if (orphans.length === 0) return { ok: true, removed: 0 };
    const results = await Promise.all(orphans.map((a) => deleteBoardAttachment(a)));
    return { ok: true, removed: results.filter((r) => r.ok).length };
  } catch (e) { return { ok: false, removed: 0, error: String(e) }; }
}

async function fetchHeroImage(postId) {
  const r = await listBoardAttachments(postId);
  if (!r.ok) return { ok: false, attachment: null };
  return { ok: true, attachment: r.rows.find((a) => a.kind === "hero_image") || null };
}

// 보기/다운로드 버튼을 누른 그 순간에만, 짧은 유효기간으로 발급한다 — 미리
// 발급해 두지 않음으로써 게시글이 비공개로 바뀐 뒤의 "새" 발급은 즉시
// 막힌다(이미 발급받아 쓰던 URL까지 소급 차단하지는 못하는 한계는 설계
// 문서에 분석되어 있음 — 90초로 그 구간을 최소화).
//   downloadName을 넘기면 Content-Disposition: attachment로(강제 다운로드),
//   생략하면 브라우저가 기본대로(이미지/PDF는 보통 인라인) 연다.
async function getBoardAttachmentUrl(storagePath, expiresInSeconds = 90, downloadName) {
  const sb = window.getSupabase && window.getSupabase();
  if (!sb || !storagePath) return { ok: false, url: null };
  try {
    const opts = downloadName ? { download: downloadName } : undefined;
    const { data, error } = await sb.storage.from(BOARD_ATTACH_BUCKET).createSignedUrl(storagePath, expiresInSeconds, opts);
    if (error) return { ok: false, url: null, error: error.message };
    return { ok: true, url: data.signedUrl };
  } catch (e) { return { ok: false, url: null, error: String(e) }; }
}

// Storage 파일을 먼저 지우고(실패 시 중단), 성공한 뒤에만 DB 행을 지운다 —
// 반대 순서라면 "DB 행은 사라졌는데 파일은 Storage에 남는"(고아 파일) 상황이
// 생길 수 있어, 이 순서를 고정해 그 가능성을 없앤다.
async function deleteBoardAttachment(attachment) {
  const sb = window.getSupabase && window.getSupabase();
  if (!sb || !attachment) return { ok: false };
  try {
    const { error: rmErr } = await sb.storage.from(BOARD_ATTACH_BUCKET).remove([attachment.storage_path]);
    if (rmErr) return { ok: false, error: "파일 삭제에 실패했습니다: " + rmErr.message };
    const { error } = await sb.from("board_attachments").delete().eq("id", attachment.id);
    if (error) return { ok: false, error: "첨부파일 정보 삭제에 실패했습니다: " + error.message };
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

Object.assign(window, {
  RJ_BOARD_CATEGORIES, boardCategoryLabel, boardStatusLabel,
  fmtBoardDate, fmtBoardDateLong,
  fetchBoardPosts, fetchBoardPostById, fetchBoardAdjacent,
  fetchBoardPostsAdmin, saveBoardPost, deleteBoardPost,
  BOARD_ATTACH_MAX_BYTES, BOARD_ATTACH_ALLOWED_MIME,
  validateBoardAttachmentFile, uploadBoardAttachment, listBoardAttachments,
  fetchPublicAttachments, fetchHeroImage, getBoardAttachmentUrl, deleteBoardAttachment,
  pruneUnreferencedInlineImages,
});
