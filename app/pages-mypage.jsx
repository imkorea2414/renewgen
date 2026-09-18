/* global React, COURSES, ACCOUNT, CLASSIN, CLASSIN_ME, useApp, Icon, findInstructor, findCourse, findSubject, formatKRW, ConnBanner, CiHead, EnterCards, AppDownload, RealtimePanel, RecordingsPanel, CloudPanel, ReportsPanel */

const { useState: useStateM, useEffect: useEffectM } = React;

// ──────────────────────────────────────────────────────────────────
// /mypage — ClassIn-powered learning dashboard
// ──────────────────────────────────────────────────────────────────
const DASH_TABS = [
  ["overview",   "학습 홈",        "Overview"],
  ["report",     "성적표",        "Report Card"],
  ["homework",   "과제",          "Homework"],
  ["exam",       "시험",          "Exam"],
  ["courses",    "강의",          "Courses"],
  ["cloud",      "강의자료",       "Cloud Disk"],
];

// 학생이 시청 가능한 모든 VOD 강좌 (관리자 명부 부여 · 구매 · 구독 · staff · 무료)
function myAccessibleCourses(user) {
  if (!user) return [];
  const isStaff = window.isStaff && window.isStaff(user);
  const demo = (window.demoAccessState && window.demoAccessState()) || { sub: false, courses: [] };
  const all = (window.COURSES || []).filter((c) => c.showcaseId || c.vimeoId || Number(c.lessons || 0) > 0);
  if (isStaff || demo.sub) return all;
  return all.filter((c) => {
    if (c.isFree) return true;
    if ((demo.courses || []).includes(c.id)) return true;
    if (window.rosterGrant && window.rosterGrant(user, c)) return true;
    return false;
  });
}

// 학생 "강의" 탭 — 관리자가 올린 모든 VOD 강좌 목록
function StudentCoursesPanel({ user, navigate }) {
  const all = (window.COURSES || []).filter((c) => c.showcaseId || c.vimeoId || Number(c.lessons || 0) > 0);
  if (all.length === 0) {
    return (
      <div>
        <CiHead title="강의 · Courses" api="Catalog" sub="관리자가 강좌를 등록하면 여기에서 시청·구매할 수 있습니다" />
        <div className="ci-card ci-card-pad" style={{ textAlign: "center", padding: "56px 24px", color: "var(--ci-muted)" }}>
          <Icon name="folder" size={28} />
          <p style={{ marginTop: 12, fontWeight: 700 }}>아직 등록된 강의가 없습니다.</p>
        </div>
      </div>
    );
  }
  const demo = (window.demoAccessState && window.demoAccessState()) || { sub: false, courses: [] };
  const isStaff = window.isStaff && window.isStaff(user);
  const canWatch = (c) => isStaff || c.isFree || demo.sub || window.RJ_PUBLIC_PREVIEW
    || (window.isFreepass && window.isFreepass(user))
    || (demo.courses || []).includes(c.id)
    || (window.rosterGrant && !!window.rosterGrant(user, c));

  return (
    <div>
      <CiHead title="강의 · Courses" api="Catalog"
        sub="내가 시청 가능한 강의는 ‘강의 보기’, 그 외 강의는 구매 후 시청할 수 있습니다" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
        {all.map((c) => {
          const ins = findInstructor(c.instructor);
          const subj = findSubject(c.subject);
          const watchable = canWatch(c);
          return (
            <div key={c.id} className="ci-card" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {c.thumb && <div style={{ aspectRatio: "16/9", background: "var(--ci-bg-2)", overflow: "hidden" }}>
                <img src={c.thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>}
              <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {subj && <span className="ci-badge navy" style={{ fontSize: 10.5 }}>{subj.ko}</span>}
                  {watchable
                    ? <span className="ci-badge ok" style={{ fontSize: 10.5 }}><Icon name="check" size={10} /> 시청 가능</span>
                    : <span className="ci-badge neutral" style={{ fontSize: 10.5 }}><Icon name="lock" size={10} /> 결제 필요</span>}
                </div>
                <div>
                  <strong style={{ fontWeight: 900, fontSize: 16.5, letterSpacing: "-0.03em", display: "block", lineHeight: 1.3 }}>{c.title}</strong>
                  <span style={{ fontSize: 12.5, color: "var(--ci-muted)" }}>{ins?.name || ""}{c.level ? (ins?.name ? " · " : "") + c.level : ""}</span>
                </div>
                <div style={{ marginTop: "auto", display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 800, fontSize: 14, color: watchable ? "var(--ci-muted)" : "var(--ci-ink)" }}>
                    {c.isFree ? "무료" : formatKRW(c.salePrice || c.price || c.recordingPrice || 0)}
                  </span>
                  {watchable
                    ? <button className="ci-act navy" onClick={() => navigate("/player/" + c.id)}><Icon name="play" size={13} /> 강의 보기</button>
                    : <button className="ci-act navy" onClick={() => navigate("/courses/" + c.id)}><Icon name="lock" size={13} /> 결제하고 보기</button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MyPage() {
  const { navigate, user, login, logout, route } = useApp();
  const initialTab = route?.params?.get?.("tab");
  const [tab, setTab] = useStateM((DASH_TABS.some(([k]) => k === initialTab) || initialTab === "account") ? initialTab : "overview");

  // Supabase 연동 시: 로그인한 사용자만 접근. 미설정 시: 데모 자동로그인.
  useEffectM(() => { if (!user && !window.SUPABASE_ENABLED) login(ACCOUNT.email, ACCOUNT.name, ACCOUNT.initials); }, []);
  if (!user) {
    if (!window.SUPABASE_ENABLED) return null;
    return (
      <div className="page-enter container" style={{ paddingTop: 96, paddingBottom: 120, maxWidth: 520, textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--ci-navy)", color: "var(--ci-yellow)", display: "inline-flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}><Icon name="key" size={28} /></div>
        <h1 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 34, letterSpacing: "-0.03em", margin: "24px 0 8px" }}>로그인이 필요합니다</h1>
        <p style={{ color: "var(--rj-muted)", fontSize: 15, marginBottom: 28 }}>마이페이지·강의실은 수강생 전용입니다. 로그인 후 이용해주세요.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button className="btn btn-primary btn-lg" onClick={() => navigate("/login")}>로그인</button>
          <button className="btn btn-ghost btn-lg" onClick={() => navigate("/signup")}>회원가입</button>
        </div>
      </div>
    );
  }

  const isKnown = user.email === ACCOUNT.email;
  const enrolledIds = isKnown ? (ACCOUNT.enrolled || []) : COURSES.slice(0, 3).map((c) => c.id);
  const enrolled = enrolledIds.map((id) => findCourse(id)).filter(Boolean);
  const history = isKnown ? ACCOUNT.watchHistory : {};

  const todayLive = COURSES.slice(0, 3);

  return (
    <div className="page-enter">
      {/* Hero band */}
      <section style={{ background: "var(--ci-navy)", color: "#fff", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "url(assets/photos/p18.jpg)", backgroundSize: "cover", backgroundPosition: "center 30%", opacity: 0.22 }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(92deg, rgba(0,18,38,0.92) 0%, rgba(0,18,38,0.74) 60%, rgba(0,18,38,0.55) 100%)" }} />
        <div className="container-wide" style={{ position: "relative", paddingTop: 40, paddingBottom: 28 }}>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 26, alignItems: "center" }}>
            <span style={{ width: 76, height: 76, borderRadius: "50%", background: "var(--ci-yellow)", color: "var(--ci-navy)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-kr-serif)", fontWeight: 600, fontSize: 30 }}>{user.initials}</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.04em", color: "var(--ci-yellow)" }}>리뉴젠 학습 대시보드 · ClassIn 연동</div>
              <h1 style={{ fontWeight: 900, fontSize: 38, letterSpacing: "-0.04em", margin: "8px 0 4px" }}>{user.name}님, 오늘도 환영합니다</h1>
              <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.7)" }}>UID {CLASSIN_ME.uid} · {CLASSIN_ME.mobile} · {isKnown ? ACCOUNT.grade : "고2"} · {CLASSIN_ME.device}</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ci-act" style={{ height: 40 }} onClick={() => navigate("/weblive")}><Icon name="signal" size={14} /> 공개방송</button>
              <button className="ci-act" style={{ height: 40 }} onClick={() => setTab("account")}><Icon name="user" size={14} /> 계정</button>
              {window.isStaff && window.isStaff(user) && (
                <button className="ci-act" style={{ height: 40 }} onClick={() => navigate("/admin")}><Icon name="settings" size={14} /> 관리자</button>
              )}
              <button className="ci-act" style={{ height: 40 }} onClick={() => { logout(); navigate("/"); }}>로그아웃</button>
            </div>
          </div>
        </div>
        {/* Tab strip */}
        <div style={{ position: "relative", background: "rgba(0,9,22,0.82)", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          <div className="container-wide">
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", paddingBottom: 0 }}>
              {DASH_TABS.map(([k, ko, en]) => {
                const on = tab === k;
                return (
                  <button key={k} onClick={() => setTab(k)} style={{
                    padding: "13px 18px", border: 0, cursor: "pointer",
                    background: on ? "var(--ci-bg)" : "rgba(255,255,255,0.06)",
                    color: on ? "var(--ci-navy)" : "#fff",
                    marginTop: 6, borderRadius: "8px 8px 0 0", fontWeight: 800, fontSize: 14,
                    display: "inline-flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap",
                    transition: "background .15s, color .15s",
                  }}>
                    {ko}<span style={{ fontFamily: "var(--font-en)", fontWeight: 600, fontSize: 10.5, opacity: on ? 0.55 : 0.7 }}>{en}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="container-wide" style={{ paddingTop: 28, paddingBottom: 96 }}>
        {tab === "overview" && (
          <div style={{ display: "grid", gap: 28 }}>
            <ConnBanner student />

            {/* 이번 달 정기고사 알림 — 로그인 즉시 노출 */}
            {window.currentExam && window.currentExam() && (() => {
              const ex = window.currentExam();
              const due = ex.dueAt ? new Date(ex.dueAt) : null;
              const days = due ? Math.ceil((due.getTime() - Date.now()) / 86400000) : null;
              const dtxt = days == null ? "" : days <= 0 ? "오늘 마감" : "D-" + days;
              const reminded = window.getExamReminder && window.getExamReminder(ex.id);
              return (
                <div onClick={() => setTab("exam")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderRadius: 14, background: "var(--ci-navy)", color: "#fff", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 92% 30%, rgba(247,200,72,0.20), transparent 45%)" }} />
                  <span style={{ position: "relative", width: 46, height: 46, flexShrink: 0, borderRadius: "50%", background: "var(--ci-yellow)", color: "var(--ci-navy)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="edit" size={20} /></span>
                  <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "var(--ci-yellow)", letterSpacing: "0.03em" }}>{reminded ? "강사 리마인드 · 아직 응시하지 않았습니다" : "이번 달 정기고사 응시 기간입니다"} {dtxt && "· " + dtxt}</div>
                    <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: "-0.03em", marginTop: 2 }}>{ex.title}</div>
                  </div>
                  <button className="ci-act" style={{ position: "relative", height: 44, padding: "0 20px", background: "var(--ci-yellow)", color: "var(--ci-navy)", border: 0, fontWeight: 900 }} onClick={(e) => { e.stopPropagation(); setTab("exam"); }}>시험 보러가기 <Icon name="arrow" size={14} /></button>
                </div>
              );
            })()}


            {/* learning KPIs */}
            <div className="ci-kpis">
              <div className="ci-kpi accent"><div className="lab"><span className="ico"><Icon name="book" size={16} /></span> 수강 중</div><div className="num">{enrolled.length}<small>강의</small></div><div className="sub">{enrolled.length ? "학습 진행 중" : "아직 등록된 강의가 없습니다"}</div></div>
              <div className="ci-kpi"><div className="lab"><span className="ico"><Icon name="check" size={16} /></span> 평균 출석률</div><div className="num">—</div><div className="sub">데이터 집계 대기</div></div>
              <div className="ci-kpi"><div className="lab"><span className="ico"><Icon name="trophy" size={16} /></span> 누적 트로피</div><div className="num">—</div><div className="sub">참여 점수</div></div>
              <div className="ci-kpi"><div className="lab"><span className="ico"><Icon name="hand" size={16} /></span> 손들기·질문</div><div className="num">—</div><div className="sub">이번 시즌</div></div>
              <div className="ci-kpi"><div className="lab"><span className="ico"><Icon name="signal" size={16} /></span> 연속 학습</div><div className="num">—</div><div className="sub">스트릭</div></div>
            </div>

            {/* auto-login entry — only show when live courses exist today (EDU 모드에서 숨김) */}
            {!window.RJ_EDU_MODE && todayLive.length > 0 && (
              <div>
                <CiHead title="원클릭 강의실 입장" api="Login URL"
                  sub="자동 로그인으로 계정·비밀번호 입력 없이 바로 입장합니다 · 시작 10분 전부터 활성화"
                  action={<button className="ci-act navy" onClick={() => navigate("/live")}><Icon name="calendar" size={13} /> 전체 시간표</button>} />
                <EnterCards courses={todayLive} onEnter={(id) => navigate("/live/" + id + "?join=1")} />
              </div>
            )}

            {/* enrolled progress */}
            <div>
              <CiHead title="수강 중인 강의" api="Classroom" sub={eduText("라이브 + 다시보기 진도", "녹화 강의 진도")} />
              <div style={{ display: "grid", gap: 14 }}>
                {enrolled.map((c) => {
                  const h = history[c.id] || { progressPct: 24, lessonIdx: 6 };
                  const ins = findInstructor(c.instructor);
                  return (
                    <div key={c.id} className="ci-card" style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "center" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span className="ci-badge navy">{findSubject(c.subject)?.ko}</span>
                          <strong style={{ fontWeight: 900, fontSize: 18, letterSpacing: "-0.03em" }}>{c.title}</strong>
                          <span style={{ fontSize: 12.5, color: "var(--ci-muted)" }}>{ins?.name}</span>
                        </div>
                        <div style={{ marginTop: 12, maxWidth: 560 }}>
                          <div style={{ height: 8, background: "var(--ci-bg-2)", borderRadius: 4, overflow: "hidden" }}>
                            <div style={{ width: h.progressPct + "%", height: "100%", background: "var(--ci-navy)" }} />
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: "var(--ci-muted)" }}>
                            <span style={{ fontWeight: 700 }}>{h.progressPct}% 완료</span><span>{h.lessonIdx} / {c.lessons}강</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {(c.showcaseId || c.vimeoId)
                          ? <button className="ci-act navy" onClick={() => navigate("/player/" + c.id)}><Icon name="play" size={13} /> 강의 보기</button>
                          : window.RJ_EDU_MODE
                            ? <button className="ci-act navy" onClick={() => navigate("/player/" + c.id)}><Icon name="play" size={13} /> 강의 보기</button>
                            : <>
                                <button className="ci-act navy" onClick={() => navigate("/live/" + c.id)}><Icon name="live" size={13} /> 라이브 입장</button>
                                <button className="ci-act" onClick={() => navigate("/player/" + c.id)}><Icon name="play" size={13} /> 이어보기</button>
                              </>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* my accessible courses — 학생이 시청 가능한 모든 VOD 강의 */}
            {myAccessibleCourses(user).length > 0 && (
              <div>
                <CiHead title="내 강의" api="My Courses"
                  sub="결제 또는 수강 등록으로 시청 가능한 강의입니다" />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                  {myAccessibleCourses(user).map((c) => {
                    const ins = findInstructor(c.instructor);
                    return (
                      <div key={c.id} className="ci-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
                        <div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                            {findSubject(c.subject) && <span className="ci-badge navy">{findSubject(c.subject).ko}</span>}
                            <span className="ci-badge ok" style={{ fontSize: 10.5 }}><Icon name="check" size={10} /> 시청 가능</span>
                          </div>
                          <strong style={{ fontWeight: 900, fontSize: 17, letterSpacing: "-0.03em", display: "block" }}>{c.title}</strong>
                          <span style={{ fontSize: 12.5, color: "var(--ci-muted)" }}>{ins?.name || ""}{c.level ? (ins?.name ? " · " : "") + c.level : ""}</span>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
                          <button className="ci-act navy" onClick={() => navigate("/player/" + c.id)}><Icon name="play" size={13} /> 강의 보기</button>
                          <button className="ci-act" onClick={() => navigate("/courses/" + c.id)}>강의 정보</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* app download */}
            <div>
              <CiHead title="클래스인 앱 다운로드" api="Download URL"
                sub="라이브 강의실은 데스크탑 앱에서 가장 안정적입니다" />
              <AppDownload />
            </div>
          </div>
        )}

        {tab === "report" && (
          <>
            {window.ExamRecap && <window.ExamRecap onOpen={() => setTab("exam")} />}
            <ReportSelfView userName={user.name} />
          </>
        )}
        {tab === "homework" && <window.HomeworkPanel student />}
        {tab === "exam" && <window.ExamPanel />}
        {tab === "courses" && <StudentCoursesPanel user={user} navigate={navigate} />}
        {tab === "cloud" && <CloudPanel student />}

        {tab === "account" && (
          <div>
            <CiHead title="계정 · 개인정보" api="Profile" sub="개인정보를 직접 수정할 수 있습니다 · 이메일은 변경할 수 없습니다" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 1040 }}>
              <ProfileEditor user={user} />
              <ProfileBlock title="ClassIn 연동" en="User Record">
                <Row label="UID" value={<span className="ci-mono">{CLASSIN_ME.uid}</span>} />
                <Row label="이름" value={user.name} />
                <Row label="식별 (identity)" value="student" />
                <Row label="연결 상태" value={<span className="ci-badge ok"><Icon name="check" size={11} /> 연동됨</span>} />
              </ProfileBlock>
              <ProfileBlock title="알림" en="Notifications">
                <Row label="라이브 시작 알림" value={<input type="checkbox" defaultChecked />} />
                <Row label="다시보기 업로드" value={<input type="checkbox" defaultChecked />} />
                <Row label="수업 리포트 발행" value={<input type="checkbox" defaultChecked />} />
                <Row label="트로피 · 평가" value={<input type="checkbox" defaultChecked />} />
              </ProfileBlock>
              <ProfileBlock title="보안" en="Security">
                <Row label="이메일" value={<span className="ci-mono">{user.email}</span>} />
                <Row label="연결된 계정" value="카카오, 네이버" />
                <Row label="로그인 알림" value={<input type="checkbox" defaultChecked />} />
                <Row label="비밀번호" value={<button className="btn-link" style={{ fontSize: 13 }}>변경</button>} />
              </ProfileBlock>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ProfileEditor({ user }) {
  const { showToast } = useApp();
  const [form, setForm] = useStateM({ name: user.name || "", phone: "", gender: "", age: "", grade: ACCOUNT.grade || "고2", school: "" });
  const [loaded, setLoaded] = useStateM(false);
  const [busy, setBusy] = useStateM(false);
  const up = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // 서버 프로필 불러오기 (있으면 채움)
  useEffectM(() => {
    let on = true;
    if (window.SUPABASE_ENABLED && user.id && window.fetchMyProfile) {
      window.fetchMyProfile(user.id).then((p) => {
        if (!on || !p) { setLoaded(true); return; }
        setForm((f) => ({
          name: p.name || f.name, phone: p.phone || "", gender: p.gender || "",
          age: p.age != null ? String(p.age) : "", grade: p.grade || f.grade, school: p.school || "",
        }));
        setLoaded(true);
      });
    } else { setLoaded(true); }
    return () => { on = false; };
  }, []);

  const save = async () => {
    if (!form.name.trim()) { showToast("이름을 입력해주세요"); return; }
    setBusy(true);
    const patch = {
      name: form.name.trim(), phone: form.phone.trim(), gender: form.gender,
      age: form.age ? Number(form.age) : null, grade: form.grade, school: form.school.trim(),
    };
    const res = window.updateMyProfile ? await window.updateMyProfile(user.id, patch) : { ok: true };
    setBusy(false);
    if (res.ok && res.partial) { showToast("저장됐습니다 (나이·성별은 DB 설정 후 반영됩니다)"); return; }
    showToast(res.ok ? "개인정보가 저장되었습니다" : "저장에 실패했습니다");
  };

  const inSt = { width: "100%", height: 42, borderRadius: 8, border: "1px solid var(--ci-line)", padding: "0 12px", fontSize: 14, fontFamily: "var(--font-kr)", background: "var(--ci-paper)" };
  const labSt = { display: "block", fontSize: 12, fontWeight: 800, color: "var(--ci-muted)", marginBottom: 6 };

  return (
    <div className="ci-card ci-card-pad">
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontWeight: 900, fontSize: 18, letterSpacing: "-0.03em" }}>개인정보 수정</h3>
        <span style={{ fontFamily: "var(--font-en)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ci-muted)" }}>Edit Profile</span>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <label style={labSt}>이메일 <span style={{ fontWeight: 500 }}>· 변경 불가</span></label>
          <input value={user.email} readOnly disabled style={{ ...inSt, background: "var(--ci-bg-2)", color: "var(--ci-muted)" }} />
        </div>
        <div><label style={labSt}>이름</label><input value={form.name} onChange={(e) => up("name", e.target.value)} style={inSt} placeholder="한도윤" /></div>
        <div><label style={labSt}>휴대폰</label><input value={form.phone} onChange={(e) => up("phone", e.target.value)} style={inSt} placeholder="010-0000-0000" inputMode="tel" /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labSt}>성별</label>
            <div style={{ display: "flex", gap: 6 }}>
              {[["male", "남"], ["female", "여"], ["", "비공개"]].map(([v, ko]) => (
                <button key={ko} type="button" onClick={() => up("gender", v)} style={{
                  flex: 1, height: 42, borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 13.5,
                  border: "1.5px solid " + (form.gender === v ? "var(--ci-navy)" : "var(--ci-line)"),
                  background: form.gender === v ? "var(--ci-navy)" : "var(--ci-paper)",
                  color: form.gender === v ? "#fff" : "var(--ci-ink)",
                }}>{ko}</button>
              ))}
            </div>
          </div>
          <div><label style={labSt}>나이 <span style={{ fontWeight: 500 }}>· 만</span></label><input value={form.age} onChange={(e) => up("age", e.target.value.replace(/[^0-9]/g, ""))} style={inSt} placeholder="17" inputMode="numeric" maxLength={2} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labSt}>학년</label>
            <select value={form.grade} onChange={(e) => up("grade", e.target.value)} style={inSt}>
              {["중2", "중3", "고1", "고2", "고3", "N수생"].map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div><label style={labSt}>학교</label><input value={form.school} onChange={(e) => up("school", e.target.value)} style={inSt} placeholder="리뉴젠고등학교" /></div>
        </div>
        <button className="ci-act navy" style={{ height: 44, justifyContent: "center", marginTop: 4 }} onClick={save} disabled={busy || !loaded}>
          <Icon name="check" size={14} /> {busy ? "저장 중…" : "변경사항 저장"}
        </button>
      </div>
    </div>
  );
}

function ProfileBlock({ title, en, children }) {
  return (
    <div className="ci-card ci-card-pad">
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontWeight: 900, fontSize: 18, letterSpacing: "-0.03em" }}>{title}</h3>
        <span style={{ fontFamily: "var(--font-en)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--ci-muted)" }}>{en}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderTop: "1px solid var(--ci-line)", fontSize: 14 }}>
      <span style={{ color: "var(--ci-muted)" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}

window.MyPage = MyPage;
