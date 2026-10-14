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
      .select("id, category, title, is_pinned, published_at, attachments", { count: "exact" })
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

// post: { id?, category, title, content, status, isPinned, examInfo }
//   id가 있으면 수정, 없으면 새 글 작성(author_id는 현재 로그인 사용자로 서버에서 채움).
async function saveBoardPost(post) {
  const sb = window.getSupabase && window.getSupabase();
  if (!sb) return { ok: false, error: "no-db" };
  try {
    const row = {
      category: post.category,
      title: post.title,
      content: post.content || "",
      exam_info: post.category === "examnotice" ? (post.examInfo || null) : null,
      status: post.status || "draft",
      is_pinned: !!post.isPinned,
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
async function deleteBoardPost(id) {
  const sb = window.getSupabase && window.getSupabase();
  if (!sb || !id) return { ok: false };
  try {
    const { error } = await sb.from("board_posts").update({ status: "deleted" }).eq("id", id);
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

Object.assign(window, {
  RJ_BOARD_CATEGORIES, boardCategoryLabel, boardStatusLabel,
  fmtBoardDate, fmtBoardDateLong,
  fetchBoardPosts, fetchBoardPostById, fetchBoardAdjacent,
  fetchBoardPostsAdmin, saveBoardPost, deleteBoardPost,
});
