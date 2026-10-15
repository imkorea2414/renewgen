/* global React, useApp, Icon, CiHead */
// ════════════════════════════════════════════════════════════════════
//   관리자 > 게시판 관리 — app/pages-admin.jsx의 ADMIN_TABS에서 로드.
//   실제 쓰기 권한은 Supabase RLS(board_posts_admin_all, is_admin())가 막는다 —
//   여기서는 화면 편의(폼/목록/확인창)만 담당한다.
// ════════════════════════════════════════════════════════════════════

const { useState: useStB, useEffect: useEfB, useRef: useRefB } = React;

const BOARD_STATUS_OPTIONS = [
  ["draft", "임시저장"],
  ["published", "공개"],
  ["hidden", "비공개"],
];

function emptyExamItem() { return { grade: "", subject: "", scope: "", date: "" }; }
function emptyExamInfo() { return { examDate: "", items: [emptyExamItem()], notice: "" }; }

function BoardManager() {
  const { showToast, user } = useApp();
  const isAdmin = !!(window.isAdmin && window.isAdmin(user));
  const [rows, setRows] = useStB([]);
  const [total, setTotal] = useStB(0);
  const [loading, setLoading] = useStB(true);
  const [catF, setCatF] = useStB("all");
  const [statusF, setStatusF] = useStB("all");
  const [page, setPage] = useStB(1);
  const [editing, setEditing] = useStB(undefined); // undefined=목록, null=새 글, {...}=수정
  const PAGE_SIZE = 20;

  const refresh = React.useCallback(() => {
    setLoading(true);
    window.fetchBoardPostsAdmin({ category: catF, status: statusF, page, pageSize: PAGE_SIZE }).then((r) => {
      setRows(r.ok ? r.rows : []);
      setTotal(r.ok ? r.total : 0);
      setLoading(false);
    });
  }, [catF, statusF, page]);

  React.useEffect(() => { refresh(); }, [refresh]);
  React.useEffect(() => { setPage(1); }, [catF, statusF]);

  // 게시판 쓰기는 is_admin()만 허용하는 RLS라, 관리자가 아니면 draft/hidden 글이 전혀
  // 보이지 않아 "텅 빈 목록"처럼 보인다 — 혼란을 막기 위해 여기서 명확히 안내한다.
  if (!isAdmin) {
    return (
      <div className="ci-card ci-card-pad" style={{ textAlign: "center", padding: "48px 24px" }}>
        <Icon name="lock" size={26} />
        <div style={{ fontWeight: 800, color: "var(--ci-ink)", marginTop: 12 }}>관리자 전용 기능입니다</div>
        <p style={{ fontSize: 13, color: "var(--ci-muted)", marginTop: 8 }}>게시판 작성·수정·삭제는 관리자 계정만 사용할 수 있습니다.</p>
      </div>
    );
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const askDelete = async (row) => {
    if (!window.confirm(`"${row.title}" 게시글을 삭제하시겠습니까?\n삭제한 게시글은 목록과 공개 화면에서 즉시 사라집니다.`)) return;
    const r = await window.deleteBoardPost(row.id);
    if (r.ok) { showToast(r.warning || "게시글을 삭제했습니다(첨부파일 포함)"); refresh(); }
    else showToast("삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  };

  if (editing !== undefined) {
    return (
      <BoardPostForm
        post={editing}
        onCancel={() => setEditing(undefined)}
        onSaved={() => { setEditing(undefined); refresh(); }}
      />
    );
  }

  return (
    <div>
      <CiHead title="게시판 관리" api="Board"
        sub="공지사항·학사일정·월간평가·이벤트·자료실 게시글을 작성·수정·삭제합니다"
        action={<button className="ci-act navy" onClick={() => setEditing(null)}><Icon name="plus" size={13} /> 새 게시글 작성</button>} />

      <div className="ci-toolbar">
        <select className="ci-select" value={catF} onChange={(e) => setCatF(e.target.value)}>
          <option value="all">전체 카테고리</option>
          {(window.RJ_BOARD_CATEGORIES || []).map((c) => <option key={c.id} value={c.id}>{c.ko}</option>)}
        </select>
        <select className="ci-select" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
          <option value="all">전체 상태</option>
          {BOARD_STATUS_OPTIONS.map(([k, ko]) => <option key={k} value={k}>{ko}</option>)}
        </select>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--ci-muted)" }}>총 <b style={{ color: "var(--ci-ink)" }}>{total.toLocaleString()}</b>건</span>
      </div>

      <div className="ci-card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="ci-table">
            <thead><tr><th>카테고리</th><th>제목</th><th>상태</th><th>중요/긴급</th><th>작성일</th><th style={{ textAlign: "right" }}>작업</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={6} style={{ padding: 28, textAlign: "center", color: "var(--ci-muted)" }}>불러오는 중…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={6} style={{ padding: 28, textAlign: "center", color: "var(--ci-muted)" }}>등록된 게시글이 없습니다</td></tr>}
              {!loading && rows.map((r) => (
                <tr key={r.id}>
                  <td><span className="ci-badge navy">{window.boardCategoryLabel(r.category)}</span></td>
                  <td style={{ fontWeight: 700 }}>{r.title}</td>
                  <td><span className={"ci-badge " + (r.status === "published" ? "ok" : r.status === "hidden" ? "warn" : "neutral")}>{window.boardStatusLabel(r.status)}</span></td>
                  <td style={{ display: "flex", gap: 4 }}>
                    {r.is_pinned ? <Icon name="pin" size={13} /> : null}
                    {r.is_urgent ? <span className="ci-badge warn" style={{ fontSize: 10.5 }}>긴급</span> : null}
                    {!r.is_pinned && !r.is_urgent ? "—" : null}
                  </td>
                  <td className="ci-mono" style={{ color: "var(--ci-muted)" }}>{window.fmtBoardDate(r.created_at)}</td>
                  <td>
                    <span style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                      <button className="ci-act sm" onClick={() => setEditing(r)}><Icon name="edit" size={11} /> 수정</button>
                      <button className="ci-act sm danger" onClick={() => askDelete(r)}><Icon name="trash" size={11} /> 삭제</button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pageCount > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderTop: "1px solid var(--ci-line)", fontSize: 13 }}>
            <span style={{ color: "var(--ci-muted)" }}>{page} / {pageCount} 페이지</span>
            <span style={{ display: "flex", gap: 6 }}>
              <button className="ci-act sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ 이전</button>
              <button className="ci-act sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>다음 ›</button>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
window.BoardManager = BoardManager;

// ── 첨부파일 업로드 공용 컴포넌트 ────────────────────────────────────
//   kind='attachment'(다중) 또는 kind='hero_image'(단일, 기존 걸 먼저 지우고
//   교체) 양쪽에서 재사용한다. 진행률(%)은 Supabase Storage 업로드 API가
//   바이트 단위 진행 콜백을 제공하지 않아 표시하지 않고, 대신 "업로드
//   중/완료/실패" 상태만 안내한다 — 미구현이 아니라 현재 클라이언트
//   라이브러리의 한계로, 변경 파일 목록 보고에 명시한다.
function BoardAttachmentManager({ postId, kind, accept, single, label }) {
  const { showToast } = useApp();
  const [rows, setRows] = useStB([]);
  const [loading, setLoading] = useStB(true);
  const [uploading, setUploading] = useStB(false);
  const [dragOver, setDragOver] = useStB(false);
  const inputRef = useRefB(null);

  const refresh = React.useCallback(() => {
    if (!postId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    window.listBoardAttachments(postId).then((r) => {
      setRows(r.ok ? r.rows.filter((a) => a.kind === kind) : []);
      setLoading(false);
    });
  }, [postId, kind]);
  useEfB(() => { refresh(); }, [refresh]);

  const doUpload = async (file) => {
    if (!postId) { showToast("먼저 임시저장을 눌러 게시글을 저장해 주세요"); return; }
    setUploading(true);
    // hero_image(단일 슬롯)는 새 이미지를 올리기 전에 기존 걸 먼저 지운다.
    if (single && rows[0]) {
      const del = await window.deleteBoardAttachment(rows[0]);
      if (!del.ok) { setUploading(false); showToast(del.error || "기존 이미지를 교체하지 못했습니다"); return; }
    }
    const r = await window.uploadBoardAttachment({ postId, file, kind, ordinal: rows.length });
    setUploading(false);
    if (!r.ok) { showToast(r.error || "업로드에 실패했습니다"); return; }
    showToast("업로드 완료");
    refresh();
  };

  const onFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (single) { if (files[0]) doUpload(files[0]); return; }
    // 다중 첨부 — 순서대로 하나씩 업로드(동시에 여러 개를 올리면 ordinal 계산이
    // 꼬일 수 있어 순차 처리한다).
    (async () => { for (const f of files) await doUpload(f); })();
  };

  const askDelete = async (a) => {
    if (!window.confirm(`"${a.file_name}" 파일을 삭제하시겠습니까?`)) return;
    const r = await window.deleteBoardAttachment(a);
    if (!r.ok) { showToast(r.error || "삭제하지 못했습니다"); return; }
    showToast("삭제했습니다");
    refresh();
  };

  return (
    <div className="ci-field">
      <label>{label}</label>
      {!postId && <p style={{ fontSize: 12, color: "var(--ci-muted)", margin: "2px 0 8px" }}>게시글을 먼저 임시저장하면 파일을 추가할 수 있습니다.</p>}
      <div
        className={"ci-upload-drop" + (dragOver ? " drag" : "")}
        onDragOver={(e) => { e.preventDefault(); if (postId) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (postId) onFiles(e.dataTransfer.files); }}
        onClick={() => postId && inputRef.current && inputRef.current.click()}
        style={{ opacity: postId ? 1 : 0.5, cursor: postId ? "pointer" : "not-allowed" }}
      >
        <Icon name="upload" size={20} />
        <span>{uploading ? "업로드 중…" : "클릭하거나 파일을 끌어다 놓으세요"}</span>
        <input ref={inputRef} type="file" accept={accept} multiple={!single} style={{ display: "none" }}
          onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} disabled={!postId || uploading} />
      </div>
      {!loading && rows.length > 0 && (
        <div className="ci-upload-list">
          {rows.map((a) => (
            <div key={a.id} className="ci-upload-item">
              <Icon name={a.mime_type.startsWith("image/") ? "image" : "pdf"} size={15} />
              <span className="ci-upload-item-name" title={a.file_name}>{a.file_name}</span>
              <span style={{ fontSize: 11, color: "var(--ci-muted)" }}>{Math.round(a.size_bytes / 1024)}KB</span>
              <button className="ci-act sm danger" onClick={() => askDelete(a)}><Icon name="trash" size={11} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 작성/수정 폼 ────────────────────────────────────────────────────
function BoardPostForm({ post, onCancel, onSaved }) {
  const { showToast } = useApp();
  const [savedPost, setSavedPost] = useStB(post || null); // 임시저장 후 id가 생기면 갱신
  const isEdit = !!(savedPost && savedPost.id);
  const [category, setCategory] = useStB((post && post.category) || "notice");
  const [title, setTitle] = useStB((post && post.title) || "");
  // 과거 평문 글(content_format!=='html')은 에디터에 처음 넣을 때만 HTML로
  // 1회 변환한다 — 그 뒤로는 사용자가 수정한 HTML이 그대로 content가 된다.
  const initialHtml = React.useMemo(() => {
    if (!post || !post.content) return "";
    return post.content_format === "html" ? post.content : (window.textToSafeHtml ? window.textToSafeHtml(post.content) : post.content);
  }, []); // eslint-disable-line
  const [contentHtml, setContentHtml] = useStB(initialHtml);
  const [isPinned, setIsPinned] = useStB(!!(post && post.is_pinned));
  const [isUrgent, setIsUrgent] = useStB(!!(post && post.is_urgent));
  const [status, setStatus] = useStB((post && post.status) || "draft");
  const [examInfo, setExamInfo] = useStB((post && post.exam_info) || emptyExamInfo());
  const [saving, setSaving] = useStB(false);
  const [err, setErr] = useStB("");
  const [preview, setPreview] = useStB(false);
  const dirtyRef = useRefB(false);

  // 저장하지 않은 변경사항 이탈 경고 — 제목/본문/카테고리 등 아무 필드나
  // 한 번이라도 바뀌면 dirty로 표시하고, 탭을 닫거나 새로고침할 때 경고한다.
  const markDirty = () => { dirtyRef.current = true; };
  useEfB(() => {
    const onBeforeUnload = (e) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);
  const guardedCancel = () => {
    if (dirtyRef.current && !window.confirm("저장하지 않은 변경사항이 있습니다. 나가시겠습니까?")) return;
    onCancel();
  };

  const setExamField = (k, v) => { markDirty(); setExamInfo((p) => ({ ...p, [k]: v })); };
  const setExamItem = (i, k, v) => { markDirty(); setExamInfo((p) => ({ ...p, items: p.items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)) })); };
  const addExamItem = () => { markDirty(); setExamInfo((p) => ({ ...p, items: [...p.items, emptyExamItem()] })); };
  const removeExamItem = (i) => { markDirty(); setExamInfo((p) => ({ ...p, items: p.items.filter((_, idx) => idx !== i) })); };

  const validateForPublish = () => {
    if (!title.trim()) return "제목을 입력해 주세요.";
    if (category === "examnotice") {
      if (!examInfo.examDate) return "월간평가 공통 평가일을 입력해 주세요.";
      const items = examInfo.items || [];
      if (items.length === 0) return "평가 범위를 1개 이상 입력해 주세요.";
      for (const it of items) {
        if (!it.grade.trim() || !it.subject.trim() || !it.scope.trim()) return "평가 범위의 학년·과목·범위를 모두 입력해 주세요.";
      }
    }
    return "";
  };

  const save = async (nextStatus, keepOpen) => {
    if (saving) return; // 저장 중 중복 클릭 방지
    if (nextStatus === "published") {
      const msg = validateForPublish();
      if (msg) { setErr(msg); return; }
    }
    if (!title.trim()) { setErr("제목을 입력해 주세요."); return; }
    setErr(""); setSaving(true);
    const cleanedHtml = window.stripInlineImageUrls ? window.stripInlineImageUrls(contentHtml) : contentHtml;
    const r = await window.saveBoardPost({
      id: savedPost && savedPost.id, category, title: title.trim(),
      content: cleanedHtml, contentFormat: "html",
      isPinned, isUrgent, status: nextStatus, examInfo,
    });
    setSaving(false);
    if (!r.ok) { setErr("저장하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요."); return; }
    dirtyRef.current = false;
    // 에디터에서 지웠거나 끝내 쓰이지 않은 본문 이미지(Storage+DB)를 베스트
    // 에포트로 정리한다 — 실패해도 게시글 저장 자체는 이미 끝난 뒤라 무해하다.
    if (window.pruneUnreferencedInlineImages && r.post && r.post.id) {
      window.pruneUnreferencedInlineImages(r.post.id, cleanedHtml);
    }
    if (keepOpen) {
      setSavedPost(r.post); setStatus(r.post.status);
      showToast("임시저장했습니다 — 이제 첨부파일/본문 이미지를 추가할 수 있습니다");
      return;
    }
    showToast(nextStatus === "published" ? "게시글을 공개했습니다" : nextStatus === "hidden" ? "게시글을 비공개로 전환했습니다" : "임시저장했습니다");
    onSaved();
  };

  const previewPost = {
    id: (savedPost && savedPost.id) || "preview",
    category, title: title || "(제목 없음)", content: contentHtml, content_format: "html",
    exam_info: examInfo, is_urgent: isUrgent,
  };

  if (preview) {
    return (
      <div className="ci-card ci-card-pad">
        <CiHead title="미리보기" api="Board" action={<button className="ci-act" onClick={() => setPreview(false)}>편집으로 돌아가기</button>} />
        <div style={{ border: "1px solid var(--ci-line)", borderRadius: 10, padding: 24, background: "#fff" }}>
          <span className="tag">{window.boardCategoryLabel(category)}</span>
          {isUrgent && <span className="rj-notice-urgent-badge" style={{ marginLeft: 8 }}>긴급</span>}
          <h1 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 600, fontSize: 28, margin: "14px 0 10px" }}>{title || "(제목 없음)"}</h1>
          {window.BoardPostBody && <window.BoardPostBody post={previewPost} showAttachments={!!(savedPost && savedPost.id)} />}
        </div>
      </div>
    );
  }

  return (
    <div className="ci-card ci-card-pad">
      <CiHead title={isEdit ? "게시글 수정" : "게시글 작성"} api="Board"
        action={<button className="ci-act" onClick={() => setPreview(true)}><Icon name="eye" size={12} /> 미리보기</button>} />

      <div className="ci-field">
        <label>카테고리</label>
        <select value={category} onChange={(e) => { markDirty(); setCategory(e.target.value); }}>
          {(window.RJ_BOARD_CATEGORIES || []).map((c) => <option key={c.id} value={c.id}>{c.ko}</option>)}
        </select>
      </div>

      <div className="ci-field">
        <label>제목</label>
        <input value={title} onChange={(e) => { markDirty(); setTitle(e.target.value); }} placeholder="게시글 제목" />
      </div>

      <div className="ci-field" style={{ display: "flex", gap: 20, flexDirection: "row" }}>
        <label style={{ display: "flex", alignItems: "center" }}><input type="checkbox" checked={isPinned} onChange={(e) => { markDirty(); setIsPinned(e.target.checked); }} style={{ width: "auto", marginRight: 8 }} />중요 공지로 상단 고정</label>
        <label style={{ display: "flex", alignItems: "center" }}><input type="checkbox" checked={isUrgent} onChange={(e) => { markDirty(); setIsUrgent(e.target.checked); }} style={{ width: "auto", marginRight: 8 }} />긴급 공지로 강조 표시</label>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--ci-muted)", margin: "-6px 0 12px" }}>상단 고정은 목록 정렬 목적, 긴급 표시는 중요도 강조 목적으로 서로 다릅니다 — 둘 다 선택할 수 있습니다.</p>

      {category === "examnotice" && (
        <div style={{ margin: "14px 0", padding: 16, border: "1px dashed var(--ci-line)", borderRadius: 10, background: "var(--ci-bg)" }}>
          <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 12 }}>월간평가 전용 입력</div>
          <div className="ci-field">
            <label>공통 평가일</label>
            <input type="date" value={examInfo.examDate} onChange={(e) => setExamField("examDate", e.target.value)} />
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {examInfo.items.map((it, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr 1fr auto", gap: 8, alignItems: "center" }}>
                <input value={it.grade} onChange={(e) => setExamItem(i, "grade", e.target.value)} placeholder="학년 (예: 중1)"
                  style={{ height: 36, borderRadius: 8, border: "1px solid var(--ci-line)", padding: "0 10px", fontSize: 13 }} />
                <input value={it.subject} onChange={(e) => setExamItem(i, "subject", e.target.value)} placeholder="과목"
                  style={{ height: 36, borderRadius: 8, border: "1px solid var(--ci-line)", padding: "0 10px", fontSize: 13 }} />
                <input value={it.scope} onChange={(e) => setExamItem(i, "scope", e.target.value)} placeholder="평가 범위"
                  style={{ height: 36, borderRadius: 8, border: "1px solid var(--ci-line)", padding: "0 10px", fontSize: 13 }} />
                <input type="date" value={it.date} onChange={(e) => setExamItem(i, "date", e.target.value)} title="과목별 개별 평가일(선택)"
                  style={{ height: 36, borderRadius: 8, border: "1px solid var(--ci-line)", padding: "0 6px", fontSize: 12 }} />
                <button className="ci-act sm danger" onClick={() => removeExamItem(i)} disabled={examInfo.items.length <= 1}><Icon name="trash" size={11} /></button>
              </div>
            ))}
          </div>
          <button className="ci-act sm" style={{ marginTop: 10 }} onClick={addExamItem}><Icon name="plus" size={11} /> 평가 범위 추가</button>
          <div className="ci-field" style={{ marginTop: 14 }}>
            <label>추가 안내사항 (선택)</label>
            <textarea value={examInfo.notice} onChange={(e) => setExamField("notice", e.target.value)} placeholder="예: 교재 및 필기도구 준비" />
          </div>
        </div>
      )}

      {category === "event" && (
        <BoardAttachmentManager postId={savedPost && savedPost.id} kind="hero_image" single
          accept="image/jpeg,image/png,image/webp" label="대표 이미지(이벤트 상단에 크게 표시)" />
      )}

      <div className="ci-field">
        <label>본문</label>
        {window.BoardEditor
          ? <window.BoardEditor value={contentHtml} postId={savedPost && savedPost.id} onChange={(html) => { markDirty(); setContentHtml(html); }} />
          : <textarea value={contentHtml} onChange={(e) => { markDirty(); setContentHtml(e.target.value); }} style={{ minHeight: 160 }} />}
      </div>

      <BoardAttachmentManager postId={savedPost && savedPost.id} kind="attachment"
        accept="image/jpeg,image/png,image/webp,application/pdf" label="첨부파일(이미지·PDF, 게시글당 여러 개)" />

      {err && <div style={{ color: "var(--ci-bad)", fontSize: 12.5, fontWeight: 700, margin: "10px 0" }}>{err}</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
        {!isEdit && <button className="ci-act" disabled={saving} onClick={() => save("draft", true)}>임시저장(파일 추가 가능)</button>}
        <button className="ci-act" disabled={saving} onClick={() => save("draft", false)}>임시저장</button>
        {status === "published" && (
          <button className="ci-act" disabled={saving} onClick={() => save("hidden", false)}>비공개로 전환</button>
        )}
        <button className="ci-act navy" disabled={saving} onClick={() => save("published", false)}>{saving ? "저장 중…" : "게시하기"}</button>
        <button className="ci-act" disabled={saving} onClick={guardedCancel}>취소</button>
      </div>
    </div>
  );
}
window.BoardPostForm = BoardPostForm;
