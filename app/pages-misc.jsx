/* global React, INSTRUCTORS, COURSES, useApp, Icon, findInstructor */

const { useState: useStateX } = React;

// ──────────────────────────────────────────────────────────────────
// /instructors
// ──────────────────────────────────────────────────────────────────
// 리뉴젠 아카데미 선생님 — 실제 강사진을 다시 세팅하기 위해 비웠습니다.
const ACAD_TEACHERS = {};
const TEACHER_SUBJECTS = Object.keys(ACAD_TEACHERS);

function InstructorsPage() {
  const NV = "var(--acad-navy)";
  const YL = "var(--acad-yellow)";
  const PP = "var(--acad-paper)";
  const LN = "var(--acad-line)";
  const MT = "var(--acad-muted)";
  const { navigate } = useApp();

  return (
    <div className="page-enter">
      <section style={{ background: NV, color: "#fff", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "url(assets/photos/p16.jpg)", backgroundSize: "cover", backgroundPosition: "center 30%", opacity: 0.26 }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(92deg, rgba(0,18,38,0.93) 0%, rgba(0,18,38,0.74) 55%, rgba(0,18,38,0.5) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(55% 90% at 88% 0%, rgba(255,214,10,0.15), transparent 60%)", pointerEvents: "none" }} />
        <div className="container-wide" style={{ position: "relative", paddingTop: 68, paddingBottom: 52 }}>
          <span style={{ display: "inline-block", background: YL, color: NV, fontWeight: 800, fontSize: 13, padding: "7px 13px", borderRadius: 5 }}>강사 · THE FACULTY</span>
          <h1 style={{ fontWeight: 900, fontSize: "clamp(42px, 5.2vw, 70px)", letterSpacing: "-0.045em", lineHeight: 1.06, margin: "20px 0 0" }}>
            리뉴젠 아카데미 <em style={{ fontStyle: "normal", color: YL }}>선생님</em>.
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: "rgba(255,255,255,0.78)", maxWidth: 600, marginTop: 18, fontWeight: 500 }}>
            {eduText("과목당 책임 강사가 라이브·다시보기·첨삭까지 한 사람이 담당합니다.", "과목당 책임 강사가 녹화 강의·다시보기·첨삭까지 한 사람이 담당합니다.")}
          </p>
        </div>
      </section>

      <section className="container-wide" style={{ paddingTop: 96, paddingBottom: 120 }}>
        <div style={{ textAlign: "center", padding: "80px 24px", background: PP, border: "1.5px dashed " + LN, borderRadius: 18 }}>
          <span style={{ display: "inline-block", background: YL, color: NV, fontWeight: 900, fontSize: 12, padding: "6px 12px", borderRadius: 4 }}>강사진 준비중</span>
          <div style={{ marginTop: 22, fontWeight: 900, fontSize: 32, letterSpacing: "-0.04em", color: NV }}>강사진을 곧 공개합니다.</div>
          <p style={{ fontSize: 15, color: MT, marginTop: 14, maxWidth: 520, marginLeft: "auto", marginRight: "auto", lineHeight: 1.7, fontWeight: 500 }}>
            강사 프로필을 정리해 새로 세팅하고 있습니다. 강의 라인업은 ‘강의’ 메뉴에서 먼저 확인할 수 있습니다.
          </p>
          <div style={{ marginTop: 26 }}>
            <button onClick={() => navigate("/courses")} style={{ background: NV, color: "#fff", fontWeight: 800, fontSize: 14, padding: "12px 22px", borderRadius: 6, border: 0, cursor: "pointer" }}>강의 둘러보기</button>
          </div>
        </div>
      </section>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// /instructors/:id
// ──────────────────────────────────────────────────────────────────
function InstructorDetailPage({ instructorId }) {
  const { navigate } = useApp();
  const ins = findInstructor(instructorId);
  const courses = COURSES.filter((c) => c.instructor === instructorId);

  if (!ins) {
    return <div className="container" style={{ padding: "120px 0", textAlign: "center" }}>강사를 찾을 수 없습니다.</div>;
  }

  return (
    <div className="page-enter">
      <section style={{ background: "var(--rj-ink)", color: "var(--rj-paper)", padding: "56px 0" }}>
        <div className="container-wide">
          <button className="btn-link" onClick={() => navigate("/instructors")} style={{ color: "rgba(245,241,233,0.7)", fontSize: 13, textDecoration: "none" }}>
            <Icon name="arrowLeft" size={14} /> 강사진
          </button>
          <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 56, marginTop: 32, alignItems: "start" }}>
            <span className="avatar" style={{ width: 220, height: 220, fontSize: 80, background: "rgba(245,241,233,0.08)", color: "var(--rj-paper)", border: "1px solid rgba(245,241,233,0.18)" }}>{ins.initials}</span>
            <div>
              <div className="eyebrow" style={{ color: "rgba(245,241,233,0.6)" }}>{ins.nameEn} · {ins.subject}</div>
              <h1 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: "clamp(56px, 7vw, 100px)", letterSpacing: "-0.035em", lineHeight: 0.98, margin: "20px 0 12px" }}>{ins.name}</h1>
              <div style={{ fontFamily: "var(--font-en)", fontStyle: "italic", fontWeight: 300, fontSize: 22, color: "rgba(245,241,233,0.7)" }}>{ins.title}</div>
              <p className="body-lg" style={{ marginTop: 24, maxWidth: 680, color: "rgba(245,241,233,0.85)" }}>{ins.bio}</p>

              <div style={{ display: "flex", gap: 56, marginTop: 36, paddingTop: 28, borderTop: "1px solid rgba(245,241,233,0.18)" }}>
                <div><div className="num-en" style={{ fontSize: 36, fontWeight: 600 }}>{ins.students.toLocaleString()}</div><div className="label-cap" style={{ color: "rgba(245,241,233,0.5)", marginTop: 4 }}>Active Students</div></div>
                <div><div className="num-en" style={{ fontSize: 36, fontWeight: 600 }}>{ins.rating}</div><div className="label-cap" style={{ color: "rgba(245,241,233,0.5)", marginTop: 4 }}>Avg Rating</div></div>
                <div><div className="num-en" style={{ fontSize: 36, fontWeight: 600 }}>{ins.courses}</div><div className="label-cap" style={{ color: "rgba(245,241,233,0.5)", marginTop: 4 }}>Courses</div></div>
                <div><div className="num-en" style={{ fontSize: 36, fontWeight: 600 }}>13</div><div className="label-cap" style={{ color: "rgba(245,241,233,0.5)", marginTop: 4 }}>Years</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-wide" style={{ paddingTop: 80, paddingBottom: 96 }}>
        <window.SectionHead ko="이 강사의 강의" en="Courses by " />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {courses.map((c) => (
            <div key={c.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <window.CoursePoster course={c} onClick={() => navigate("/courses/" + c.id)} />
              <div>
                <div style={{ fontFamily: "var(--font-kr-serif)", fontSize: 20, letterSpacing: "-0.025em" }}>{c.title}</div>
                <div style={{ fontSize: 13, color: "var(--rj-muted)", marginTop: 4 }}>{c.lessons}강 · {c.weeks}주 · <Icon name="star" size={10} /> <span className="num-en">{c.rating}</span></div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 80, padding: 48, background: "var(--rj-paper-2)", borderRadius: "var(--rj-r)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48 }}>
            <div>
              <div className="eyebrow" style={{ color: "var(--rj-muted)" }}>Teaching Philosophy · 교습 철학</div>
              <h3 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 32, letterSpacing: "-0.025em", lineHeight: 1.15, margin: "14px 0 0" }}>
                풀이를 외우게 하지 않습니다. 풀이의 ‘이유’를 가르칩니다.
              </h3>
            </div>
            <div>
              <ul style={{ padding: 0, listStyle: "none", display: "grid", gap: 18 }}>
                {[
                  ["01", "라이브에서 끝낸다.", "수업이 라이브 안에서 닫히게 설계합니다. 끊김 없이."],
                  ["02", "다시보기를 위한 강의가 아니다.", "라이브가 본방, 다시보기는 복습. 본방이 가장 압축적입니다."],
                  ["03", "한 명도 놓치지 않는다.", "주간 첨삭에서 첨삭 노트로 부족한 부분을 정확히 짚어드립니다."],
                ].map(([n, t, b]) => (
                  <li key={n} style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: 14, paddingBottom: 18, borderBottom: "1px solid var(--rj-faint)" }}>
                    <span className="num-en" style={{ color: "var(--rj-muted)", fontWeight: 700, fontSize: 12, letterSpacing: "0.18em" }}>{n}</span>
                    <div>
                      <div style={{ fontFamily: "var(--font-kr-serif)", fontSize: 20, letterSpacing: "-0.025em" }}>{t}</div>
                      <div style={{ fontSize: 14, color: "var(--rj-muted)", marginTop: 6 }}>{b}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// /community — notices + Q&A
// ──────────────────────────────────────────────────────────────────
function CommunityPage() {
  const { navigate } = useApp();
  const [tab, setTab] = useStateX("notice");

  return (
    <div className="page-enter">
      <section style={{ borderBottom: "1px solid var(--rj-faint)" }}>
        <div className="container-wide" style={{ paddingTop: 56, paddingBottom: 32 }}>
          <div className="eyebrow" style={{ color: "var(--rj-muted)" }}>Community · 공지와 커뮤니티</div>
          <h1 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 64, letterSpacing: "-0.03em", margin: "16px 0 0", lineHeight: 1 }}>
            매주의 소식, <span style={{ fontFamily: "var(--font-en)", fontStyle: "italic", fontWeight: 300 }}>in print.</span>
          </h1>
        </div>
      </section>

      <section className="container-wide" style={{ paddingTop: 32 }}>
        <div style={{ display: "flex", gap: 28, borderBottom: "1px solid var(--rj-line)" }}>
          {[
            ["notice", "공지사항", "Notices"],
            ["qna",    "Q&A", "Questions"],
            ["events", "이벤트", "Events"],
          ].map(([k, ko, en]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              padding: "18px 0",
              borderBottom: tab === k ? "2px solid var(--rj-ink)" : "2px solid transparent",
              marginBottom: -1,
              fontSize: 15, fontWeight: tab === k ? 600 : 400,
              color: tab === k ? "var(--rj-ink)" : "var(--rj-muted)",
            }}>{ko} <span style={{ fontFamily: "var(--font-en)", fontStyle: "italic", fontWeight: 300, fontSize: 12 }}>{en}</span></button>
          ))}
        </div>
      </section>

      <section className="container-wide" style={{ paddingTop: 32, paddingBottom: 96 }}>
        {tab === "notice" && <NoticesList />}
        {tab === "qna" && <QnAList />}
        {tab === "events" && <EventsList />}
      </section>
    </div>
  );
}

// 공지사항은 app/pages-notice.jsx의 전용 게시판(/notice)으로 이전됐다 — 실제 데이터(board_posts)와
// 연결된 그 화면으로 안내만 하고, 이 탭에서 별도의 목록을 다시 그리지 않는다(중복 구현 방지).
function NoticesList() {
  const { navigate } = useApp();
  return (
    <div style={{ textAlign: "center", padding: "80px 24px" }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--rj-ink)" }}>공지사항은 새 게시판에서 확인하실 수 있습니다.</div>
      <p style={{ fontSize: 13, color: "var(--rj-muted)", marginTop: 6 }}>공지사항·학사일정·월간평가·이벤트를 한 곳에서 모아 볼 수 있어요.</p>
      <button className="btn btn-primary btn-sm" style={{ marginTop: 20 }} onClick={() => navigate("/notice")}>공지사항 바로가기</button>
    </div>
  );
}

function QnAList() {
  const items = [];  // 실제 질문이 등록되면 표시됩니다 — 데모 콘텐츠 제거됨
  if (!items.length) {
    return (
      <div style={{ textAlign: "center", padding: "80px 24px", color: "var(--rj-muted)" }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--rj-ink)" }}>아직 등록된 질문이 없습니다.</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>회원가입 후 가장 먼저 질문해 보세요.</div>
      </div>
    );
  }
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 14, color: "var(--rj-muted)" }}>전체 <span className="num-en" style={{ color: "var(--rj-ink)", fontWeight: 600 }}>{items.length}</span>개의 질문 · 평균 답변 시간 <span className="num-en" style={{ color: "var(--rj-ink)", fontWeight: 600 }}>3.2</span>시간</div>
        <button className="btn btn-primary btn-sm">새 질문 작성</button>
      </div>
      <div style={{ display: "grid", gap: 16 }}>
        {items.map((it, i) => (
          <div key={i} className="card" style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <span className="tag">{it.category}</span>
                {it.course && <span className="tag" style={{ borderColor: "var(--rj-faint)" }}>{it.course}</span>}
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                {it.answered ? <span className="chip" style={{ background: "#1F8A5B", color: "#fff", borderColor: "#1F8A5B" }}>답변 완료</span> : <span className="chip" style={{ background: "var(--rj-accent)", color: "var(--rj-ink)", borderColor: "var(--rj-accent)" }}>답변 대기</span>}
                <span style={{ fontSize: 12, color: "var(--rj-muted)" }}>{it.time}</span>
              </span>
            </div>
            <div style={{ fontFamily: "var(--font-kr-serif)", fontSize: 22, letterSpacing: "-0.025em", margin: "6px 0" }}>{it.q}</div>
            {it.answered && (
              <div style={{ marginTop: 16, padding: 16, background: "var(--rj-paper-2)", borderRadius: "var(--rj-r-sm)", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span className="avatar avatar-sm" style={{ background: "var(--rj-ink)", color: "var(--rj-paper)" }}>{it.a.slice(0, 1)}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{it.a}</div>
                  <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--rj-muted)" }}>안녕하세요. 라이브 강의실 입장 시 화면 우상단의 ‘ROOM 코드’가 결제 시 발급된 코드와 일치하는지 먼저 확인해주세요. 자세한 안내는 1:1 채팅으로 도움드리겠습니다.</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// 과거엔 하드코딩된 샘플 이벤트 3개를 항상 보여줬다 — 실제로 진행 중이지 않은 이벤트가
// 실제 이벤트로 오인될 수 있어 제거하고, 실데이터가 있는 게시판(/notice?cat=event)으로 연결한다.
function EventsList() {
  const { navigate } = useApp();
  return (
    <div style={{ textAlign: "center", padding: "80px 24px" }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--rj-ink)" }}>이벤트 소식은 공지사항 게시판에서 확인하실 수 있습니다.</div>
      <p style={{ fontSize: 13, color: "var(--rj-muted)", marginTop: 6 }}>진행 중인 이벤트를 모아 볼 수 있어요.</p>
      <button className="btn btn-primary btn-sm" style={{ marginTop: 20 }} onClick={() => navigate("/notice?cat=event")}>이벤트 보기</button>
    </div>
  );
}

window.InstructorsPage = InstructorsPage;
window.InstructorDetailPage = InstructorDetailPage;
window.CommunityPage = CommunityPage;
