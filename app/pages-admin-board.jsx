/* global React, useApp, Icon, CiHead */
// ════════════════════════════════════════════════════════════════════
//   관리자 > 게시판 관리 — app/pages-admin.jsx의 ADMIN_TABS에서 로드.
//   실제 쓰기 권한은 Supabase RLS(board_posts_admin_all, is_admin())가 막는다 —
//   여기서는 화면 편의(폼/목록/확인창)만 담당한다.
// ════════════════════════════════════════════════════════════════════

const { useState: useStB } = React;

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
    if (r.ok) { showToast("게시글을 삭제했습니다"); refresh(); }
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
            <thead><tr><th>카테고리</th><th>제목</th><th>상태</th><th>중요</th><th>작성일</th><th style={{ textAlign: "right" }}>작업</th></tr></thead>
            <tbody>
              {loading && <tr><td colSpan={6} style={{ padding: 28, textAlign: "center", color: "var(--ci-muted)" }}>불러오는 중…</td></tr>}
              {!loading && rows.length === 0 && <tr><td colSpan={6} style={{ padding: 28, textAlign: "center", color: "var(--ci-muted)" }}>등록된 게시글이 없습니다</td></tr>}
              {!loading && rows.map((r) => (
                <tr key={r.id}>
                  <td><span className="ci-badge navy">{window.boardCategoryLabel(r.category)}</span></td>
                  <td style={{ fontWeight: 700 }}>{r.title}</td>
                  <td><span className={"ci-badge " + (r.status === "published" ? "ok" : r.status === "hidden" ? "warn" : "neutral")}>{window.boardStatusLabel(r.status)}</span></td>
                  <td>{r.is_pinned ? <Icon name="pin" size={13} /> : "—"}</td>
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

// ── 작성/수정 폼 ────────────────────────────────────────────────────
function BoardPostForm({ post, onCancel, onSaved }) {
  const { showToast } = useApp();
  const isEdit = !!(post && post.id);
  const [category, setCategory] = useStB((post && post.category) || "notice");
  const [title, setTitle] = useStB((post && post.title) || "");
  const [content, setContent] = useStB((post && post.content) || "");
  const [isPinned, setIsPinned] = useStB(!!(post && post.is_pinned));
  const [status, setStatus] = useStB((post && post.status) || "draft");
  const [examInfo, setExamInfo] = useStB((post && post.exam_info) || emptyExamInfo());
  const [saving, setSaving] = useStB(false);
  const [err, setErr] = useStB("");

  const setExamField = (k, v) => setExamInfo((p) => ({ ...p, [k]: v }));
  const setExamItem = (i, k, v) => setExamInfo((p) => ({ ...p, items: p.items.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)) }));
  const addExamItem = () => setExamInfo((p) => ({ ...p, items: [...p.items, emptyExamItem()] }));
  const removeExamItem = (i) => setExamInfo((p) => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));

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

  const save = async (nextStatus) => {
    if (saving) return; // 저장 중 중복 클릭 방지
    if (nextStatus === "published") {
      const msg = validateForPublish();
      if (msg) { setErr(msg); return; }
    }
    if (!title.trim()) { setErr("제목을 입력해 주세요."); return; }
    setErr(""); setSaving(true);
    const r = await window.saveBoardPost({
      id: post && post.id, category, title: title.trim(), content, isPinned, status: nextStatus, examInfo,
    });
    setSaving(false);
    if (!r.ok) { setErr("저장하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요."); return; }
    showToast(nextStatus === "published" ? "게시글을 공개했습니다" : nextStatus === "hidden" ? "게시글을 비공개로 전환했습니다" : "임시저장했습니다");
    onSaved();
  };

  return (
    <div className="ci-card ci-card-pad">
      <CiHead title={isEdit ? "게시글 수정" : "게시글 작성"} api="Board" />

      <div className="ci-field">
        <label>카테고리</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {(window.RJ_BOARD_CATEGORIES || []).map((c) => <option key={c.id} value={c.id}>{c.ko}</option>)}
        </select>
      </div>

      <div className="ci-field">
        <label>제목</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="게시글 제목" />
      </div>

      <div className="ci-field">
        <label><input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} style={{ width: "auto", marginRight: 8 }} />중요 공지로 상단 고정</label>
      </div>

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

      <div className="ci-field">
        <label>본문</label>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="게시글 본문 (줄바꿈은 그대로 표시됩니다)" style={{ minHeight: 160 }} />
      </div>

      {err && <div style={{ color: "var(--ci-bad)", fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>{err}</div>}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
        <button className="ci-act" disabled={saving} onClick={() => save("draft")}>임시저장</button>
        {status === "published" && (
          <button className="ci-act" disabled={saving} onClick={() => save("hidden")}>비공개로 전환</button>
        )}
        <button className="ci-act navy" disabled={saving} onClick={() => save("published")}>{saving ? "저장 중…" : "게시하기"}</button>
        <button className="ci-act" disabled={saving} onClick={onCancel}>취소</button>
      </div>
    </div>
  );
}
window.BoardPostForm = BoardPostForm;
