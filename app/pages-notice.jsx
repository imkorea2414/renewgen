/* global React, useApp, Icon */
// ════════════════════════════════════════════════════════════════════
//   /notice        — 공지사항 목록 (비회원 포함 누구나 열람)
//   /notice/:id    — 게시글 상세
//   관리자 작성/수정/삭제는 app/pages-admin-board.jsx(BoardManager).
// ════════════════════════════════════════════════════════════════════

const { useState: useStN, useEffect: useEffectN, useRef: useRefN } = React;

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
  const { cat, q: activeQ, page } = noticeQuery(route.params);
  const [qInput, setQInput] = useStN(activeQ);
  const [state, setState] = useStN({ loading: true, error: false, rows: [], total: 0 });

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
                  {n.is_urgent && <span className="rj-notice-urgent-badge">긴급</span>}
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

// ── 월간평가 표 — "3초 안에" 날짜·과목·범위를 파악하는 것이 목표 ───────
//   맨 위에 가장 큰 글자로 디데이/평가일을 먼저 보여주고, 표는 그 아래
//   보조 정보로 배치한다. 학년이 여러 개면 학년별로 묶어 스캔하기 쉽게 한다.
function daysUntil(ymd) {
  const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function ExamInfoTable({ examInfo }) {
  if (!examInfo || !Array.isArray(examInfo.items) || examInfo.items.length === 0) return null;
  const hasPerItemDate = examInfo.items.some((it) => it.date);
  const d = daysUntil(examInfo.examDate);
  const dLabel = d == null ? "" : d > 0 ? `D-${d}` : d === 0 ? "D-DAY" : `${-d}일 지남`;

  // 학년별로 묶어 스캔하기 쉽게(순서는 등장 순 유지).
  const grades = [];
  examInfo.items.forEach((it) => { if (it.grade && !grades.includes(it.grade)) grades.push(it.grade); });

  return (
    <div className="rj-notice-examtable-wrap">
      {examInfo.examDate && (
        <div className="rj-notice-examdate-hero">
          <span className="rj-notice-examdate-dday">{dLabel}</span>
          <span className="rj-notice-examdate-full">{window.fmtBoardDateLong(examInfo.examDate)}</span>
        </div>
      )}
      {grades.length > 1 ? (
        grades.map((g) => (
          <div key={g} className="rj-notice-examgroup">
            <div className="rj-notice-examgroup-title">{g}</div>
            <ExamSubTable items={examInfo.items.filter((it) => it.grade === g)} hasPerItemDate={hasPerItemDate} showGrade={false} />
          </div>
        ))
      ) : (
        <ExamSubTable items={examInfo.items} hasPerItemDate={hasPerItemDate} showGrade={grades.length <= 1 && false} />
      )}
      {examInfo.notice && <p className="rj-notice-examnote">{examInfo.notice}</p>}
    </div>
  );
}
function ExamSubTable({ items, hasPerItemDate }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="rj-notice-examtable">
        <thead>
          <tr><th>과목</th><th>평가 범위</th>{hasPerItemDate && <th>평가일</th>}</tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td className="rj-notice-examsubject">{it.subject}</td>
              <td>{it.scope}</td>
              {hasPerItemDate && <td>{it.date ? window.fmtBoardDateLong(it.date) : "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 본문(HTML/평문 분기) ─────────────────────────────────────────────
//   content_format='html' → DOMPurify로 거른 뒤 innerHTML(+본문이미지 서명URL
//   지연 로딩). 'text'(과거 글 전부) → 지금까지와 동일하게 텍스트 그대로.
function BoardBody({ content, contentFormat }) {
  const ref = useRefN(null);
  const isHtml = contentFormat === "html";
  const safeHtml = isHtml ? (window.sanitizeBoardHtml ? window.sanitizeBoardHtml(content) : "") : "";

  useEffectN(() => {
    if (isHtml && ref.current && window.hydrateInlineImages) window.hydrateInlineImages(ref.current);
  }, [isHtml, safeHtml]);

  if (isHtml) {
    return <div ref={ref} className="rj-notice-body rj-notice-body-html" dangerouslySetInnerHTML={{ __html: safeHtml }} />;
  }
  return <div className="rj-notice-body">{content}</div>;
}

// ── 첨부파일 목록(+이미지 확대보기) ──────────────────────────────────
function AttachmentList({ postId }) {
  const [rows, setRows] = useStN([]);
  const [lightbox, setLightbox] = useStN(null); // { url, name } | null
  const [busyId, setBusyId] = useStN(null);

  useEffectN(() => {
    let alive = true;
    window.fetchPublicAttachments(postId).then((r) => { if (alive && r.ok) setRows(r.rows); });
    return () => { alive = false; };
  }, [postId]);

  if (rows.length === 0) return null;

  const open = async (a, download) => {
    setBusyId(a.id);
    const r = await window.getBoardAttachmentUrl(a.storage_path, 90, download ? a.file_name : undefined);
    setBusyId(null);
    if (!r.ok) { window.alert && window.alert("파일을 여는 데 실패했습니다. 잠시 후 다시 시도해 주세요."); return; }
    if (!download && a.mime_type.startsWith("image/")) { setLightbox({ url: r.url, name: a.file_name }); return; }
    window.open(r.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="rj-notice-attachments">
      <div className="rj-notice-attachments-title">첨부파일 {rows.length}개</div>
      <div className="rj-notice-attachments-grid">
        {rows.map((a) => {
          const isImage = a.mime_type.startsWith("image/");
          return (
            <div key={a.id} className="rj-notice-attach-card">
              <Icon name={isImage ? "image" : "pdf"} size={18} />
              <span className="rj-notice-attach-name" title={a.file_name}>{a.file_name}</span>
              <span className="rj-notice-attach-actions">
                <button className="btn btn-ghost btn-sm" disabled={busyId === a.id} onClick={() => open(a, false)}>
                  {isImage ? "확대보기" : "미리보기"}
                </button>
                <button className="btn btn-ghost btn-sm" disabled={busyId === a.id} onClick={() => open(a, true)}>
                  <Icon name="download" size={12} /> 다운로드
                </button>
              </span>
            </div>
          );
        })}
      </div>
      {lightbox && (
        <div className="rj-notice-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox.url} alt={lightbox.name} onClick={(e) => e.stopPropagation()} />
          <button className="rj-notice-lightbox-close" onClick={() => setLightbox(null)}><Icon name="close" size={18} /></button>
        </div>
      )}
    </div>
  );
}

// ── 이벤트 대표 이미지 ──────────────────────────────────────────────
function HeroImage({ postId }) {
  const [url, setUrl] = useStN("");
  useEffectN(() => {
    let alive = true;
    window.fetchHeroImage(postId).then((r) => {
      if (!alive || !r.ok || !r.attachment) return;
      window.getBoardAttachmentUrl(r.attachment.storage_path, 90).then((su) => { if (alive && su.ok) setUrl(su.url); });
    });
    return () => { alive = false; };
  }, [postId]);
  if (!url) return null;
  return <div className="rj-notice-hero"><img src={url} alt="" /></div>;
}

// 공개 상세 페이지와 관리자 미리보기가 똑같은 모습을 보장하도록 본문
// 렌더링을 하나의 컴포넌트로 공유한다.
function BoardPostBody({ post, showAttachments = true }) {
  const hasRealId = post.id && post.id !== "preview";
  return (
    <div>
      {post.category === "event" && hasRealId && <HeroImage postId={post.id} />}
      {post.category === "examnotice" && <ExamInfoTable examInfo={post.exam_info} />}
      <BoardBody content={post.content} contentFormat={post.content_format} />
      {showAttachments && <AttachmentList postId={post.id} />}
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
        {post.is_urgent && <span className="rj-notice-urgent-badge" style={{ marginLeft: 8 }}>긴급</span>}
        <h1 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 600, fontSize: 32, letterSpacing: "-0.02em", margin: "14px 0 10px" }}>{post.title}</h1>
        <div style={{ fontSize: 13.5, color: "var(--acad-muted)" }}>
          리뉴젠 아카데미 · {window.fmtBoardDate(post.published_at)}
        </div>
      </div>

      <BoardPostBody post={post} />

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
window.BoardPostBody = BoardPostBody;
window.ExamInfoTable = ExamInfoTable;
