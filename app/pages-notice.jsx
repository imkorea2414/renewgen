/* global React, useApp, Icon */
// ════════════════════════════════════════════════════════════════════
//   /notice        — 공지사항 목록 (비회원 포함 누구나 열람)
//   /notice/:id    — 게시글 상세
//   관리자 작성/수정/삭제는 app/pages-admin-board.jsx(BoardManager).
// ════════════════════════════════════════════════════════════════════

const { useState: useStN, useEffect: useEffectN } = React;

const NOTICE_FILTERS = [{ id: "all", ko: "전체" }].concat(
  typeof window !== "undefined" && window.RJ_BOARD_CATEGORIES ? window.RJ_BOARD_CATEGORIES : []
);

function noticeQuery(params) {
  const cat = (params && params.get("cat")) || "all";
  const q = (params && params.get("q")) || "";
  const page = Math.max(1, parseInt((params && params.get("page")) || "1", 10) || 1);
  return { cat, q, page };
}

// ── 게시판 목록 ─────────────────────────────────────────────────────
function NoticeListPage() {
  const { route, navigate } = useApp();
  // cat/q/page는 URL 쿼리 파라미터가 유일한 진실 소스 — 별도 state로 미러링하지 않는다.
  // (한 번 route가 바뀔 때 "state 동기화 effect"와 "조회 effect"가 같은 렌더에서 함께 돌면
  //  조회 effect가 아직 갱신되지 않은 이전 cat/page를 읽어 한 번 헛돌고 다음 렌더에서야
  //  바로잡히는 경쟁이 생긴다 — route에서 직접 파생시켜 그 문제 자체를 없앤다.)
  const { cat, q: activeQ, page } = noticeQuery(route.params);
  const [qInput, setQInput] = useStN(activeQ);
  const [state, setState] = useStN({ loading: true, error: false, rows: [], total: 0 });

  // 검색창 입력값은 Enter/검색 버튼 전까지는 URL과 별개로 로컬에서만 편집 — 그 전까지는
  // URL의 q 값과 동기화해 둔다(다른 카테고리를 클릭하거나 뒤로가기했을 때 입력칸도 따라가도록).
  useEffectN(() => { setQInput(activeQ); }, [activeQ]);

  useEffectN(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: false }));
    window.fetchBoardPosts({ category: cat, q: activeQ, page }).then((r) => {
      if (!alive) return;
      if (!r.ok) { setState({ loading: false, error: true, rows: [], total: 0 }); return; }
      setState({ loading: false, error: false, rows: r.rows, total: r.total });
    });
    return () => { alive = false; };
  }, [cat, activeQ, page]);

  const PAGE_SIZE = 10;
  const pageCount = Math.max(1, Math.ceil(state.total / PAGE_SIZE));

  const goto = (nextCat, nextQ, nextPage) => {
    const parts = [];
    if (nextCat && nextCat !== "all") parts.push("cat=" + encodeURIComponent(nextCat));
    if (nextQ && nextQ.trim()) parts.push("q=" + encodeURIComponent(nextQ.trim()));
    if (nextPage && nextPage > 1) parts.push("page=" + nextPage);
    navigate("/notice" + (parts.length ? "?" + parts.join("&") : ""));
  };

  return (
    <div className="page-enter">
      <section style={{ background: "var(--acad-navy)", color: "#fff" }}>
        <div className="container-wide" style={{ paddingTop: 64, paddingBottom: 44 }}>
          <span style={{ display: "inline-block", background: "var(--acad-yellow)", color: "var(--acad-navy)", fontWeight: 800, fontSize: 13, padding: "7px 13px", borderRadius: 5 }}>
            공지사항 · NOTICE
          </span>
          <h1 style={{ fontWeight: 900, fontSize: "clamp(32px, 4vw, 48px)", letterSpacing: "-0.03em", margin: "20px 0 0" }}>공지사항</h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: "rgba(255,255,255,0.78)", marginTop: 12, fontWeight: 500 }}>
            리뉴젠 아카데미의 새로운 소식과 학사 안내를 확인하세요.
          </p>
        </div>
      </section>

      <section className="container-wide" style={{ paddingTop: 40, paddingBottom: 100 }}>
        <div className="rj-notice-toolbar">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {NOTICE_FILTERS.map((f) => (
              <button key={f.id} onClick={() => goto(f.id, activeQ, 1)} style={{
                height: 38, padding: "0 16px", borderRadius: 8, fontWeight: 800, fontSize: 13.5, cursor: "pointer",
                border: "1.5px solid " + (cat === f.id ? "var(--acad-navy)" : "var(--acad-line)"),
                background: cat === f.id ? "var(--acad-navy)" : "#fff",
                color: cat === f.id ? "#fff" : "var(--acad-ink)", whiteSpace: "nowrap",
              }}>{f.ko}</button>
            ))}
          </div>
          <label className="rj-notice-search">
            <Icon name="search" size={15} />
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") goto(cat, qInput, 1); }}
              placeholder="제목 검색"
            />
          </label>
          <button className="btn btn-ghost btn-sm" onClick={() => goto(cat, qInput, 1)}>검색</button>
        </div>

        {state.loading ? (
          <div className="rj-notice-empty"><Icon name="refresh" size={22} /><div style={{ marginTop: 10 }}>불러오는 중입니다…</div></div>
        ) : state.error ? (
          <div className="rj-notice-empty">일시적인 오류로 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>
        ) : state.rows.length === 0 ? (
          <div className="rj-notice-empty">{activeQ ? "검색 결과가 없습니다." : "등록된 공지가 아직 없습니다."}</div>
        ) : (
          <div className="rj-notice-list">
            {state.rows.map((n) => (
              <button key={n.id} className={"rj-notice-row" + (n.is_pinned ? " pinned" : "")} onClick={() => navigate("/notice/" + n.id)}>
                <span className="tag">{window.boardCategoryLabel(n.category)}</span>
                <span className="rj-notice-title">
                  {n.is_pinned && <Icon name="pin" size={13} />}
                  {n.title}
                  {Array.isArray(n.attachments) && n.attachments.length > 0 && <Icon name="pdf" size={13} />}
                </span>
                <span className="rj-notice-date">{window.fmtBoardDate(n.published_at)}</span>
                <Icon name="chevron" size={16} />
              </button>
            ))}
          </div>
        )}

        {pageCount > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 28 }}>
            <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => goto(cat, activeQ, page - 1)}>‹ 이전</button>
            <span style={{ display: "flex", alignItems: "center", padding: "0 14px", fontSize: 13.5, fontWeight: 700, color: "var(--acad-ink)" }}>{page} / {pageCount}</span>
            <button className="btn btn-ghost btn-sm" disabled={page >= pageCount} onClick={() => goto(cat, activeQ, page + 1)}>다음 ›</button>
          </div>
        )}
      </section>
    </div>
  );
}

// ── 월간평가 표 ─────────────────────────────────────────────────────
function ExamInfoTable({ examInfo }) {
  if (!examInfo || !Array.isArray(examInfo.items) || examInfo.items.length === 0) return null;
  const hasPerItemDate = examInfo.items.some((it) => it.date);
  return (
    <div className="rj-notice-examtable-wrap">
      {examInfo.examDate && (
        <div className="rj-notice-examdate">평가일: <strong>{window.fmtBoardDateLong(examInfo.examDate)}</strong></div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table className="rj-notice-examtable">
          <thead>
            <tr>
              <th>학년</th><th>과목</th><th>평가 범위</th>
              {hasPerItemDate && <th>평가일</th>}
            </tr>
          </thead>
          <tbody>
            {examInfo.items.map((it, i) => (
              <tr key={i}>
                <td>{it.grade}</td>
                <td>{it.subject}</td>
                <td>{it.scope}</td>
                {hasPerItemDate && <td>{it.date ? window.fmtBoardDateLong(it.date) : "—"}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {examInfo.notice && <p className="rj-notice-examnote">{examInfo.notice}</p>}
    </div>
  );
}

// ── 게시글 상세 ─────────────────────────────────────────────────────
function NoticeDetailPage({ noticeId }) {
  const { navigate } = useApp();
  const [state, setState] = useStN({ loading: true, post: null });
  const [adj, setAdj] = useStN({ prevPost: null, nextPost: null });

  useEffectN(() => {
    let alive = true;
    setState({ loading: true, post: null });
    window.fetchBoardPostById(noticeId).then((r) => {
      if (!alive) return;
      const post = r.ok ? r.post : null;
      setState({ loading: false, post });
      if (post) window.fetchBoardAdjacent(post).then((a) => { if (alive) setAdj(a); });
    });
    return () => { alive = false; };
  }, [noticeId]);

  if (state.loading) {
    return (
      <div className="page-enter container-wide" style={{ paddingTop: 96, paddingBottom: 120, textAlign: "center" }}>
        <Icon name="refresh" size={22} /><div style={{ marginTop: 10, color: "var(--acad-muted)" }}>불러오는 중입니다…</div>
      </div>
    );
  }
  if (!state.post) {
    return (
      <div className="page-enter container-wide" style={{ paddingTop: 96, paddingBottom: 120, maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
        <h1 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 600, fontSize: 26, margin: 0 }}>존재하지 않거나 열람할 수 없는 게시글입니다.</h1>
        <button className="btn btn-primary btn-lg" style={{ marginTop: 24 }} onClick={() => navigate("/notice")}>목록으로</button>
      </div>
    );
  }

  const post = state.post;
  return (
    <div className="page-enter container-wide" style={{ paddingTop: 56, paddingBottom: 120, maxWidth: 840, margin: "0 auto" }}>
      <div className="rj-notice-detail-head">
        <span className="tag">{window.boardCategoryLabel(post.category)}</span>
        <h1 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 600, fontSize: 32, letterSpacing: "-0.02em", margin: "14px 0 10px" }}>{post.title}</h1>
        <div style={{ fontSize: 13.5, color: "var(--acad-muted)" }}>
          리뉴젠 아카데미 · {window.fmtBoardDate(post.published_at)}
        </div>
      </div>

      {post.category === "examnotice" && <ExamInfoTable examInfo={post.exam_info} />}

      <div className="rj-notice-body">{post.content}</div>

      {Array.isArray(post.attachments) && post.attachments.length > 0 && (
        <div style={{ marginTop: 28, display: "grid", gap: 8 }}>
          {post.attachments.map((a, i) => (
            <a key={i} href={a.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ justifySelf: "start" }}>
              <Icon name="download" size={13} /> {a.name || "첨부파일"}
            </a>
          ))}
        </div>
      )}

      <div className="rj-notice-nav">
        {adj.prevPost ? (
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/notice/" + adj.prevPost.id)} style={{ textAlign: "left" }}>‹ 이전 글 — {adj.prevPost.title}</button>
        ) : <span />}
        {adj.nextPost ? (
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/notice/" + adj.nextPost.id)} style={{ textAlign: "right" }}>다음 글 — {adj.nextPost.title} ›</button>
        ) : <span />}
      </div>

      <div style={{ textAlign: "center", marginTop: 36 }}>
        <button className="btn btn-primary btn-lg" onClick={() => navigate("/notice")}>목록으로</button>
      </div>
    </div>
  );
}

window.NoticeListPage = NoticeListPage;
window.NoticeDetailPage = NoticeDetailPage;
