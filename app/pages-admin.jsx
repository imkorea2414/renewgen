/* global React, CLASSIN, ADMIN_ACCOUNTS, ADMIN_CLASSES, SUB_MESSAGES, useApp, Icon, CiHead */
// /admin — administrator console
// User API (accounts), Classroom API (courses/classes), Data Subscription monitor

const { useState: useStA } = React;

const ADMIN_TABS = [
  ["status",  "연동 상태",      "Connection"],
  ["reports", "성적표",         "Report Cards"],
  ["vod",     "강의 관리",      "VOD"],
  ["homework","과제 관리",      "Homework"],
  ["exam",    "시험 관리",      "Exam"],
  ["users",   "계정 관리",      "User"],
  ["classes", "코스 · 수업",    "Classroom"],
  ["subs",    "데이터 구독",    "Data Subscription"],
];

function AdminPage() {
  const { navigate, user } = useApp();
  const isAdmin = !!(window.isAdmin && window.isAdmin(user));
  const [tab, setTab] = useStA("status");
  const [roleFilter, setRoleFilter] = useStA("all");
  const [stats, setStats] = useStA(null);   // 실데이터 현황(대시보드)

  // 실제 데이터로 현황 지표 로드 (가짜 숫자 대체)
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const s = { students: 0, teachers: 0, courses: 0, rounds: 0, events: null, linked: 0 };
      try {
        const r = window.rjPullStudentsFromCloud && await window.rjPullStudentsFromCloud();
        if (r && r.ok && r.students) {
          const arr = Object.values(r.students);
          s.students = arr.filter((x) => (x.role || "student") !== "teacher").length;
          s.teachers = arr.filter((x) => x.role === "teacher").length;
          s.linked = arr.filter((x) => x.classin_uid || x.classinUid).length;
        }
      } catch (e) {}
      try { s.courses = (window.COURSES || []).length; } catch (e) {}
      try { s.rounds = ((window.RJReport && window.RJReport.loadStore().rounds) || []).length; } catch (e) {}
      try {
        const sb = window.getSupabase && window.getSupabase();
        if (sb) {
          const { count } = await sb.from("classin_events").select("*", { count: "exact", head: true });
          s.events = count == null ? 0 : count;
        }
      } catch (e) {}
      if (alive) setStats(s);
    })();
    return () => { alive = false; };
  }, []);

  // 역할 가드 — 실제 로그인(Supabase) 환경에서 학생이 콘솔에 직접 접근하면 학습 대시보드로 돌려보냄
  React.useEffect(() => {
    if (!window.SUPABASE_ENABLED) return;          // 데모 모드에서는 자유 탐색 허용
    if (!user) { navigate("/login"); return; }
    if (window.isStaff && !window.isStaff(user)) navigate("/mypage");
  }, [user]);
  if (window.SUPABASE_ENABLED && user && window.isStaff && !window.isStaff(user)) {
    return (
      <div className="page-enter container" style={{ paddingTop: 96, paddingBottom: 120, maxWidth: 520, textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--ci-navy)", color: "var(--ci-yellow)", display: "inline-flex", alignItems: "center", justifyContent: "center", margin: "0 auto" }}><Icon name="lock" size={28} /></div>
        <h1 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 30, letterSpacing: "-0.03em", margin: "24px 0 8px" }}>관리자 전용 페이지입니다</h1>
        <p style={{ color: "var(--rj-muted)", fontSize: 15, marginBottom: 28 }}>이 영역은 강사·관리자만 접근할 수 있습니다.</p>
        <button className="btn btn-primary btn-lg" onClick={() => navigate("/mypage")}>학습 대시보드로</button>
      </div>
    );
  }

  const accounts = ADMIN_ACCOUNTS.filter((a) => roleFilter === "all" || a.role === roleFilter);
  const teachers = ADMIN_ACCOUNTS.filter((a) => a.role === "teacher");
  const students = ADMIN_ACCOUNTS.filter((a) => a.role === "student");

  const statusBadge = (s) => {
    if (s === "active") return <span className="ci-badge ok"><Icon name="check" size={11} /> 활성</span>;
    if (s === "stopped") return <span className="ci-badge bad"><Icon name="lock" size={11} /> 정지</span>;
    return <span className="ci-badge warn"><Icon name="clock" size={11} /> 승인대기</span>;
  };
  const classState = (s) => {
    if (s === "live") return <span className="ci-badge bad"><span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} /> LIVE</span>;
    if (s === "ended") return <span className="ci-badge neutral">종료</span>;
    return <span className="ci-badge navy">예정</span>;
  };

  return (
    <div className="page-enter">
      {/* header */}
      <section style={{ background: "var(--ci-navy)", color: "#fff" }}>
        <div className="container-wide" style={{ paddingTop: 36, paddingBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.04em", color: "var(--ci-yellow)" }}>리뉴젠 관리자 콘솔 · ClassIn Admin</div>
              <h1 style={{ fontWeight: 900, fontSize: 32, letterSpacing: "-0.04em", margin: "8px 0 0" }}>계정 · 코스 · 데이터 연동 관리</h1>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="ci-act" style={{ height: 40 }} onClick={() => navigate("/teacher")}><Icon name="users" size={14} /> 선생님 대시보드</button>
              <button className="ci-act" style={{ height: 40 }} onClick={() => navigate("/mypage")}><Icon name="user" size={14} /> 학생 화면 보기</button>
              <button className="ci-act" style={{ height: 40 }} onClick={() => navigate("/weblive")}><Icon name="signal" size={14} /> 공개방송</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 22, flexWrap: "wrap" }}>
            {ADMIN_TABS.map(([k, ko, en]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                padding: "12px 18px", border: 0, cursor: "pointer",
                background: tab === k ? "var(--ci-bg)" : "transparent",
                color: tab === k ? "var(--ci-navy)" : "rgba(255,255,255,0.7)",
                borderRadius: "8px 8px 0 0", fontWeight: 800, fontSize: 14,
                display: "inline-flex", alignItems: "baseline", gap: 6, whiteSpace: "nowrap",
              }}>{ko}<span style={{ fontFamily: "var(--font-en)", fontWeight: 600, fontSize: 10.5, opacity: 0.6 }}>{en}</span></button>
            ))}
          </div>
        </div>
      </section>

      <section className="container-wide" style={{ paddingTop: 28, paddingBottom: 96 }}>
        {/* ── Connection status ── */}
        {tab === "status" && (
          <div style={{ display: "grid", gap: 24 }}>
            <div className="ci-stat-strip">
              <div className="ci-kpi accent"><div className="lab"><span className="ico"><Icon name="users" size={16} /></span> 전체 학생</div><div className="num">{stats ? stats.students.toLocaleString() : "–"}</div><div className="sub">강사 {stats ? stats.teachers : "–"} · 클래스인 연동 {stats ? stats.linked : "–"}</div></div>
              <div className="ci-kpi"><div className="lab"><span className="ico"><Icon name="book" size={16} /></span> 개설 강의</div><div className="num">{stats ? stats.courses : "–"}</div><div className="sub">녹화강의 · VOD</div></div>
              <div className="ci-kpi"><div className="lab"><span className="ico"><Icon name="server" size={16} /></span> 성적 회차</div><div className="num">{stats ? stats.rounds : "–"}</div><div className="sub">월말평가 누적</div></div>
              <div className="ci-kpi"><div className="lab"><span className="ico"><Icon name="signal" size={16} /></span> 클래스인 수신</div><div className="num" style={{ fontSize: stats && stats.events > 0 ? undefined : 24 }}>{stats == null ? "–" : (stats.events > 0 ? stats.events.toLocaleString() : "대기")}</div><div className="sub">{stats && stats.events > 0 ? "이벤트 누적 수신" : "훅 등록 후 수신 시작"}</div></div>
            </div>

            <div className="ci-admin-grid">
              <div className="ci-card ci-card-pad">
                <CiHead title="API 연동 정보" api="Auth" />
                <div style={{ display: "grid", gap: 0 }}>
                  {[
                    ["School", CLASSIN.school],
                    ["SID", CLASSIN.sid],
                    ...(isAdmin ? [["Secret Key", CLASSIN.secretMasked]] : []),
                    ["요금제", CLASSIN.plan],
                    ["API Base", CLASSIN.apiBase],
                    ["테스트 API 승인", "완료 (본사)"],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: "1px solid var(--ci-line)", fontSize: 14 }}>
                      <span style={{ color: "var(--ci-muted)" }}>{k}</span>
                      <span style={{ fontWeight: 700, fontFamily: k === "SID" || k === "API Base" || k === "Secret Key" ? "var(--font-en)" : "inherit" }}>{v}</span>
                    </div>
                  ))}
                </div>
                {!isAdmin && (
                  <p style={{ marginTop: 12, fontSize: 12.5, color: "var(--ci-muted)" }}>⚠️ Secret Key 등 민감 정보는 관리자(admin)에게만 표시됩니다.</p>
                )}
                <a href={CLASSIN.docs} target="_blank" rel="noreferrer" className="ci-act" style={{ marginTop: 16, display: "inline-flex", textDecoration: "none" }}><Icon name="book" size={13} /> API 문서 (docs.eeo.cn)</a>
              </div>

              <div className="ci-card ci-card-pad">
                <CiHead title="데이터 수신 엔드포인트" api="Data Subscription" />
                <div style={{ background: "var(--ci-navy)", color: "#fff", borderRadius: 10, padding: 16, fontFamily: "var(--font-en)", fontSize: 12.5, lineHeight: 1.7 }}>
                  <div style={{ color: "rgba(255,255,255,0.55)" }}>POST · 실시간 데이터 수신</div>
                  <div style={{ color: "var(--ci-yellow)", wordBreak: "break-all" }}>{CLASSIN.dataEndpoint}</div>
                  <div style={{ marginTop: 8, color: "rgba(255,255,255,0.8)" }}>↳ 하나의 엔드포인트로만 수신 가능 · 실시간 + 요약 데이터 푸시</div>
                </div>
                <ul style={{ margin: "16px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 9, fontSize: 13, color: "var(--ci-ink)" }}>
                  {["수업 진행 중 실시간 데이터를 push 받습니다", "수업 종료 시 요약 데이터(출석·평가·녹화)가 도착합니다", "한 번에 한 시스템으로만 전송됩니다", "과거 데이터 소급 수신은 미지원"].map((t, i) => (
                    <li key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}><Icon name="check" size={14} className="" style={{ color: "var(--ci-ok)", flexShrink: 0, marginTop: 2 }} /> {t}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ── Report cards (월말평가 성적표) ── */}
        {tab === "reports" && (
          <div>
            <CiHead title="월말평가 성적표" api="Report Cards · AnswerSheetScore"
              sub="클래스인 OMR 답안카드 성적을 자동으로 불러오거나, 성적 CSV를 업로드해 학생별로 분류합니다 · 회차가 누적되면 추이 그래프가 생성됩니다" />
            <ReportManager />
          </div>
        )}

        {/* ── 학생 · 계정 관리 ── */}
        {tab === "users" && (
          <div>
            {isAdmin && <RoleManager me={user} />}
            <StudentManager isAdmin={isAdmin} onOpenReports={() => setTab("reports")} />
          </div>
        )}

        {/* ── 강의(VOD) 관리 ── */}
        {tab === "vod" && window.VodManager && <window.VodManager />}

        {/* ── 과제 관리 (Classroom · Homework) ── */}
        {tab === "homework" && window.HomeworkManager && <window.HomeworkManager />}

        {/* ── 시험 관리 (Renewjen Exam) ── */}
        {tab === "exam" && window.ExamManager && <window.ExamManager />}

        {/* ── Classroom management ── */}
        {tab === "classes" && (
          <div>
            <CiHead title="코스 · 수업 관리" api="Classroom"
              sub="코스/수업 생성, 수강생 배정, 담당 강사 변경, 라벨 관리"
              action={<div style={{ display: "flex", gap: 8 }}>
                <button className="ci-act"><Icon name="folder" size={13} /> 라벨 관리</button>
                <button className="ci-act navy"><Icon name="plus" size={13} /> 수업 생성</button>
              </div>} />
            <div className="ci-card" style={{ overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table className="ci-table">
                  <thead><tr><th>Class UID</th><th>코스</th><th>담당 강사</th><th>일시</th><th>수강생</th><th>상태</th><th style={{ textAlign: "right" }}>작업</th></tr></thead>
                  <tbody>
                    {ADMIN_CLASSES.map((c) => (
                      <tr key={c.id}>
                        <td className="ci-uid">{c.id}</td>
                        <td style={{ fontWeight: 700 }}>{c.course}</td>
                        <td>{c.teacher}</td>
                        <td className="ci-mono" style={{ color: "var(--ci-muted)" }}>{c.date} {c.time}</td>
                        <td className="ci-mono">{c.students}명</td>
                        <td>{classState(c.state)}</td>
                        <td>
                          <span style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                            <button className="ci-act sm"><Icon name="users" size={11} /> 수강생</button>
                            <button className="ci-act sm"><Icon name="edit" size={11} /> 강사변경</button>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Data subscription monitor (실데이터) ── */}
        {tab === "subs" && <DataSubMonitor />}
      </section>
    </div>
  );
}

window.AdminPage = AdminPage;

// ── 데이터 구독 모니터 (실제 classin_events 수신) ──────────────────
function DataSubMonitor() {
  const [st, setSt] = useStA(null);
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const sb = window.getSupabase && window.getSupabase();
      if (!sb) { if (alive) setSt({ types: [], log: [], total: 0, noDb: true }); return; }
      try {
        const { data } = await sb.from("classin_events")
          .select("cmd, student_uid, student_name, occurred_at, received_at")
          .order("received_at", { ascending: false }).limit(500);
        const rows = data || [];
        const byType = {};
        for (const r of rows) {
          const k = r.cmd || "unknown";
          if (!byType[k]) byType[k] = { name: k, n: 0, last: null };
          byType[k].n++;
          const t = r.received_at || r.occurred_at;
          if (t && (!byType[k].last || t > byType[k].last)) byType[k].last = t;
        }
        const types = Object.values(byType).sort((a, b) => b.n - a.n);
        const log = rows.slice(0, 40).map((r) => ({
          t: String(r.received_at || r.occurred_at || "").slice(11, 19),
          cmd: r.cmd || "unknown",
          who: r.student_name || r.student_uid || "",
        }));
        if (alive) setSt({ types, log, total: rows.length });
      } catch (e) { console.warn("[Admin] 데이터 구독 모니터 조회 실패:", e); if (alive) setSt({ types: [], log: [], total: 0, error: "데이터를 불러오지 못했습니다." }); }
    })();
    return () => { alive = false; };
  }, []);

  const okBadge = st && st.total > 0
    ? <span className="ci-badge ok"><Icon name="signal" size={12} /> 수신 정상</span>
    : <span className="ci-badge neutral"><Icon name="clock" size={12} /> 수신 대기</span>;

  return (
    <div>
      <CiHead title="데이터 구독 모니터" api="Data Subscription"
        sub="클래스인에서 수신한 실제 데이터(classin_events) · 최근 500건 기준" action={okBadge} />
      {st == null ? (
        <div className="ci-card ci-card-pad" style={{ textAlign: "center", color: "var(--ci-muted)" }}><Icon name="refresh" size={18} /> 불러오는 중…</div>
      ) : st.total === 0 ? (
        <div className="ci-card ci-card-pad" style={{ textAlign: "center", padding: "48px 24px", color: "var(--ci-muted)" }}>
          <Icon name="server" size={26} />
          <div style={{ fontWeight: 800, color: "var(--ci-ink)", marginTop: 12 }}>아직 수신된 데이터가 없습니다</div>
          <p style={{ fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>클래스인에 훅 주소가 등록되고 수업·채점이 일어나면<br />여기에 실시간으로 수신 내역이 쌓입니다.</p>
          {st.error && <div style={{ fontSize: 11.5, color: "#C0392B", marginTop: 10, fontFamily: "var(--font-en)" }}>{st.error}</div>}
        </div>
      ) : (
        <div className="ci-admin-grid">
          <div className="ci-card">
            <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--ci-line)", fontWeight: 800, fontSize: 14 }}>메시지 유형별 수신</div>
            {st.types.map((m) => (
              <div key={m.name} className="ci-sub-row">
                <span className="ci-sub-name">{m.name}</span>
                <span className="ci-sub-n">{m.n.toLocaleString()}</span>
                <span style={{ fontSize: 12, color: "var(--ci-muted)", minWidth: 84, textAlign: "right" }}>{String(m.last || "").slice(5, 16).replace("T", " ")}</span>
              </div>
            ))}
          </div>
          <div className="ci-card ci-card-pad">
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12 }}>수신 로그 <span style={{ fontWeight: 500, color: "var(--ci-muted)", fontSize: 12 }}>· 최근 {st.log.length}건</span></div>
            <div style={{ background: "#0B1117", borderRadius: 10, padding: 14, fontFamily: "var(--font-en)", fontSize: 11.5, lineHeight: 1.9, color: "#A6E3B8", maxHeight: 360, overflowY: "auto" }}>
              {st.log.map((l, i) => (
                <div key={i}><span style={{ color: "#5C6678" }}>{l.t}</span> <span style={{ color: "#FFD60A" }}>{l.cmd}</span> {l.who && <span style={{ color: "#9FD0FF" }}>{l.who}</span>}</div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 권한 없는 사용자가 /admin 에 접근했을 때 ───────────────────────
function AdminDenied({ user }) {
  const { navigate } = useApp();
  return (
    <div className="page-enter" style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 24px" }}>
      <div style={{ maxWidth: 460, textAlign: "center" }}>
        <span style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--ci-bg, #F4F1EA)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <Icon name="lock" size={26} />
        </span>
        <h1 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 600, fontSize: 30, letterSpacing: "-0.03em", margin: 0 }}>관리자 전용 페이지입니다</h1>
        <p style={{ color: "var(--rj-muted, #6b6b6b)", marginTop: 12, lineHeight: 1.6 }}>
          {user
            ? "이 계정은 관리자 권한이 없습니다. 접근이 필요하면 관리자에게 권한 부여를 요청하세요."
            : "계속하려면 관리자 계정으로 로그인해주세요."}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 24 }}>
          <button className="btn btn-ghost btn-lg" onClick={() => navigate("/")}>홈으로</button>
          {!user && <button className="btn btn-primary btn-lg" onClick={() => navigate("/login")}>로그인</button>}
        </div>
      </div>
    </div>
  );
}
window.AdminDenied = AdminDenied;

// ── 권한 관리 (이메일 기준 등업/강등) — admin 전용 ────────────────
function RoleManager({ me }) {
  const { showToast } = useApp();
  const [email, setEmail] = useStA("");
  const [role, setRole] = useStA("teacher");
  const [grants, setGrants] = useStA(() => (window.listRoleGrants ? window.listRoleGrants() : []));
  const [members, setMembers] = useStA(null);   // null=로딩전, []=없음/미연동
  const [loadingM, setLoadingM] = useStA(false);
  const refresh = () => setGrants(window.listRoleGrants ? window.listRoleGrants() : []);

  const loadMembers = React.useCallback(() => {
    if (!window.SUPABASE_ENABLED || !window.fetchAllProfiles) { setMembers([]); return; }
    setLoadingM(true);
    window.fetchAllProfiles().then((r) => { setMembers(r.ok ? r.rows : []); setLoadingM(false); });
  }, []);
  React.useEffect(() => { loadMembers(); }, [loadMembers]);

  const roleKo = (r) => (r === "admin" ? "관리자" : r === "teacher" ? "강사" : "학생");
  const grant = async () => {
    const e = email.trim().toLowerCase();
    if (!e || !/.+@.+\..+/.test(e)) { showToast("올바른 이메일을 입력하세요"); return; }
    window.setUserRole(e, role); refresh(); setEmail("");
    if (window.SUPABASE_ENABLED && window.setProfileRoleByEmail) {
      const r = await window.setProfileRoleByEmail(e, role);
      if (!r.ok) { showToast(r.notFound ? `${e} 회원을 찾을 수 없습니다 (로컬만 적용 — 가입 후 다시 시도)` : "변경사항을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요."); return; }
      loadMembers();
    }
    showToast(`${e} → ${roleKo(role)} 권한 부여`);
  };
  const revoke = async (e) => {
    window.setUserRole(e, "student"); refresh();
    if (window.SUPABASE_ENABLED && window.setProfileRoleByEmail) { await window.setProfileRoleByEmail(e, "student"); loadMembers(); }
    showToast(`${e} 권한 해제 (학생으로)`);
  };
  // 회원 목록에서 직접 역할 변경
  const setMemberRole = async (m, newRole) => {
    if (window.RJ_ADMIN_EMAILS && window.RJ_ADMIN_EMAILS.includes((m.email || "").toLowerCase())) { showToast("고정 관리자는 변경할 수 없습니다"); return; }
    const res = window.setProfileRoleById ? await window.setProfileRoleById(m.id, newRole) : { ok: false };
    if (m.email) window.setUserRole(m.email.toLowerCase(), newRole);
    refresh();
    if (res.ok) { showToast(`${m.name || m.email} → ${roleKo(newRole)}`); loadMembers(); }
    else showToast("변경 실패 — 권한(관리자)·DB 연결을 확인하세요");
  };

  return (
    <div className="ci-card ci-card-pad" style={{ marginBottom: 18 }}>
      <CiHead title="권한 관리" api="Roles"
        sub="이메일 기준으로 강사·관리자 권한을 부여합니다 · 가입 이메일과 같아야 적용됩니다" />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일 (예: teacher@renewjen.kr)" inputMode="email"
          style={{ flex: "1 1 240px", height: 40, borderRadius: 8, border: "1px solid var(--ci-line)", padding: "0 12px", fontSize: 14, fontFamily: "var(--font-en)" }} />
        <select value={role} onChange={(e) => setRole(e.target.value)}
          style={{ height: 40, borderRadius: 8, border: "1px solid var(--ci-line)", padding: "0 12px", fontSize: 14, fontWeight: 700 }}>
          <option value="teacher">강사</option>
          <option value="admin">관리자</option>
        </select>
        <button className="ci-act navy" style={{ height: 40 }} onClick={grant}><Icon name="check" size={13} /> 권한 부여</button>
      </div>
      <div className="ci-card" style={{ overflow: "hidden" }}>
        <table className="ci-table">
          <thead><tr><th>이메일</th><th>권한</th><th style={{ textAlign: "right" }}>작업</th></tr></thead>
          <tbody>
            {grants.length === 0 && <tr><td colSpan={3} style={{ color: "var(--ci-muted)", padding: "18px" }}>부여된 권한이 없습니다</td></tr>}
            {grants.map((g) => (
              <tr key={g.email}>
                <td className="ci-mono">{g.email}{me && me.email && me.email.toLowerCase() === g.email && <span className="ci-badge neutral" style={{ marginLeft: 8 }}>나</span>}</td>
                <td><span className={"ci-badge " + (g.role === "admin" ? "bad" : "navy")}>{roleKo(g.role)}</span></td>
                <td style={{ textAlign: "right" }}>
                  {g.fixed
                    ? <span style={{ fontSize: 12, color: "var(--ci-muted)" }}>고정 관리자</span>
                    : <button className="ci-act sm" onClick={() => revoke(g.email)}><Icon name="close" size={11} /> 해제</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 최신 가입 회원 — 최근 가입한 회원을 한눈에 */}
      <div style={{ marginTop: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h4 style={{ margin: 0, fontWeight: 900, fontSize: 15 }}>최신 가입 회원 <span style={{ color: "var(--ci-muted)", fontWeight: 600, fontSize: 13 }}>· 총 {members ? members.length + "명" : "…"}</span></h4>
          <button className="ci-act sm" onClick={loadMembers}><Icon name="refresh" size={11} /> 새로고침</button>
        </div>
        {!window.SUPABASE_ENABLED
          ? <div style={{ color: "var(--ci-muted)", fontSize: 13, padding: "8px 0" }}>미리보기(데모) 모드에서는 실제 가입자가 표시되지 않습니다. 실제 사이트에서 로그인하면 가입 회원이 나타납니다.</div>
          : loadingM
            ? <div style={{ color: "var(--ci-muted)", fontSize: 13, padding: "8px 0" }}>불러오는 중…</div>
            : (!members || members.length === 0)
              ? <div style={{ color: "var(--ci-muted)", fontSize: 13, padding: "8px 0" }}>아직 가입한 회원이 없습니다. 홈페이지에서 회원가입하면 여기에 표시됩니다.</div>
              : (
                <div className="ci-card" style={{ overflow: "hidden" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table className="ci-table">
                      <thead><tr><th>이름</th><th>이메일</th><th>구분</th><th style={{ textAlign: "right" }}>가입일</th></tr></thead>
                      <tbody>
                        {[...members]
                          .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
                          .slice(0, 8)
                          .map((m) => {
                            const fixed = window.RJ_ADMIN_EMAILS && window.RJ_ADMIN_EMAILS.includes((m.email || "").toLowerCase());
                            const curRole = fixed ? "admin" : (m.role || "student");
                            const joined = m.created_at ? String(m.created_at).slice(0, 10).replace(/-/g, ".") : "—";
                            return (
                              <tr key={m.id}>
                                <td><span className="ci-nameav"><span className="av">{(m.name || "?").slice(-2)}</span><strong style={{ fontWeight: 700 }}>{m.name || "—"}</strong>{m.grade ? <span style={{ color: "var(--ci-muted)", marginLeft: 6, fontSize: 12 }}>{m.grade}</span> : null}</span></td>
                                <td className="ci-mono" style={{ fontSize: 12.5, color: "var(--ci-muted)" }}>{m.email}{me && me.email && me.email.toLowerCase() === (m.email || "").toLowerCase() && <span className="ci-badge neutral" style={{ marginLeft: 6 }}>나</span>}</td>
                                <td><span className={"ci-badge " + (curRole === "admin" ? "bad" : curRole === "teacher" ? "navy" : "neutral")}>{roleKo(curRole)}</span></td>
                                <td style={{ textAlign: "right", fontFamily: "var(--font-en)", fontSize: 12.5, color: "var(--ci-muted)" }}>{joined}</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                  {members.length > 8 && (
                    <div style={{ padding: "10px 16px", borderTop: "1px solid var(--ci-line)", fontSize: 12.5, color: "var(--ci-muted)", textAlign: "center" }}>
                      최근 8명 표시 · 전체 {members.length}명은 아래 <b style={{ color: "var(--ci-ink)" }}>학생 관리</b>에서 확인 (권한 변경은 위 “권한 부여” 사용)
                    </div>
                  )}
                </div>
              )}
      </div>
    </div>
  );
}
window.RoleManager = RoleManager;

// ════════════════════════════════════════════════════════════════════
//  학생 관리 (Student Management) — 어드민 핵심
//  · 명부 검색/필터 · 상태(활성·정지·승인) 관리 · 학생 상세 · 수강 강의 배정
//  · 성적 연동(월말평가) · 수강권 · 관리 메모 · 학생 추가(ClassIn 계정 발급)
//  변경값은 localStorage(rj-admin-students)에 저장 — 실서버는 Supabase로 이관.
// ════════════════════════════════════════════════════════════════════
const RJ_STU_KEY = "rj-admin-students";
function stuLoadOv() { try { return JSON.parse(localStorage.getItem(RJ_STU_KEY) || "{}") || {}; } catch (e) { return {}; } }
function stuSaveOv(o) { try { localStorage.setItem(RJ_STU_KEY, JSON.stringify(o)); } catch (e) {} }
function stuList() {
  const ov = stuLoadOv();
  const base = (typeof ADMIN_ACCOUNTS !== "undefined" ? ADMIN_ACCOUNTS : []).map((a) => ({ ...a }));
  const ids = new Set(base.map((a) => a.uid));
  const merged = base.map((a) => ({ ...a, ...(ov[a.uid] || {}) }));
  for (const uid in ov) if (!ids.has(uid)) merged.push({ uid, role: "student", status: "active", classes: 0, ...ov[uid] });
  return merged;
}
function stuPatch(uid, patch) {
  const ov = stuLoadOv(); ov[uid] = { ...(ov[uid] || {}), ...patch }; stuSaveOv(ov);
  // 클라우드 동기화 — 병합 명부에서 이메일을 찾아 함께 저장(본인 읽기 RLS용)
  if (window.rjPushStudentToCloud) {
    const email = (stuList().find((s) => s.uid === uid) || {}).email || ov[uid].email;
    window.rjPushStudentToCloud(uid, ov[uid], email).catch(() => {});
  }
}
// 로그인 이메일로 명부의 학생 레코드를 찾는다 (접근권 판정용 — access.jsx 에서 사용)
function rjFindStudentByEmail(email) {
  const e = (email || "").trim().toLowerCase();
  if (!e) return null;
  return stuList().find((s) => (s.email || "").trim().toLowerCase() === e) || null;
}
window.rjFindStudentByEmail = rjFindStudentByEmail;
// 학생 명부에 존재하는 '학년·반' 목록 (강의 무료대상 반 선택 드롭다운용)
//  실서버에서는 클래스인 API 로 받은 반 목록을 여기에 병합하면 됩니다.
function rjClassNames() {
  const set = new Set();
  stuList().forEach((s) => { const l = (s.label || "").trim(); if (l) set.add(l); });
  try { (JSON.parse(localStorage.getItem("rj-classin-classes") || "[]") || []).forEach((c) => { const n = (typeof c === "string" ? c : (c && c.name)) || ""; if (n.trim()) set.add(n.trim()); }); } catch (e) {}
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
}
window.rjClassNames = rjClassNames;
function stuAdd(s) {
  const ov = stuLoadOv();
  const uid = s.uid || ("RJ" + String(Date.now()).slice(-8));
  ov[uid] = { added: true, role: "student", status: "active", classes: 0, ...s };
  stuSaveOv(ov);
  if (window.rjPushStudentToCloud) window.rjPushStudentToCloud(uid, ov[uid], ov[uid].email).catch(() => {});
  return uid;
}
// 월말평가 성적 연동 — 이름으로 회차별 평균 추이
function stuScoreTrend(name) {
  const R = window.RJReport; if (!R || !name) return null;
  try {
    const rounds = R.sortedRounds(R.loadStore());
    const pts = [];
    for (const r of rounds) {
      for (const key in r.students) {
        if (r.students[key].name === name) { pts.push({ label: R.shortLabel(r.label), avg: r.students[key].avg, rank: r.students[key].rankOverall, n: r.students[key].cohortN }); break; }
      }
    }
    return pts.length ? pts : null;
  } catch (e) { return null; }
}

function StuStatusBadge({ s }) {
  if (s === "active") return <span className="ci-badge ok"><Icon name="check" size={11} /> 활성</span>;
  if (s === "stopped") return <span className="ci-badge bad"><Icon name="lock" size={11} /> 정지</span>;
  return <span className="ci-badge warn"><Icon name="clock" size={11} /> 승인대기</span>;
}

function StudentManager({ isAdmin, onOpenReports }) {
  const { showToast } = useApp();
  const [tick, setTick] = useStA(0);
  const [profiles, setProfiles] = useStA([]);   // 홈페이지 가입 계정(Supabase profiles)
  const refresh = () => setTick((t) => t + 1);

  // 가입 회원(profiles) 로드 → 명부(admin_students)와 합치기 위함
  React.useEffect(() => {
    let alive = true;
    if (!window.fetchAllProfiles) return;
    window.fetchAllProfiles().then((r) => { if (alive && r && r.ok) setProfiles(r.rows || []); }).catch(() => {});
    return () => { alive = false; };
  }, [tick]);

  // 엑셀 명부(admin_students) + 홈페이지 가입 계정(profiles) 을 이메일 기준으로 병합
  const all = React.useMemo(() => {
    const base = stuList();
    const byEmail = {};
    base.forEach((s) => { if (s.email) byEmail[String(s.email).toLowerCase()] = s; });
    const out = base.slice();
    (profiles || []).forEach((p) => {
      const em = String(p.email || "").toLowerCase();
      const role = p.role === "teacher" || p.role === "admin" ? "teacher" : "student";
      if (em && byEmail[em]) {                     // 이미 명부에 있는 이메일 → 가입 계정 표시만 병합
        const s = byEmail[em];
        s.signup = true;
        if (!s.name || /[\d@*]/.test(s.name)) s.name = p.name || s.name;
        if (p.role) s.role = role;
        if (p.classin_uid && !s.classinUid) s.classinUid = p.classin_uid;
      } else {                                     // 명부에 없는 가입자 → 새 항목 추가
        out.push({
          uid: p.id, name: p.name || (em ? em.split("@")[0] : "학생"), email: p.email || null,
          mobile: p.phone || null, role, status: "active", source: "signup", signup: true,
          label: p.grade || "", classinUid: p.classin_uid || null,
        });
      }
    });
    return out;
  }, [tick, profiles]);

  // 클라우드(Supabase)에서 학생 명부 동기화 → 로컬 캐시 교체 후 재렌더.
  //   클라우드가 비어 있고 로컬에 기존 편집분이 있으면 → 최초 1회 자동 업로드(이관).
  //   (미연결 시 no-op → 기존 로컬 동작 유지)
  React.useEffect(() => {
    let alive = true;
    if (!window.rjSyncStudentsFromCloud) return;
    window.rjSyncStudentsFromCloud().then((r) => {
      if (!alive || !r || !r.ok) return;
      if (r.loaded > 0) { refresh(); return; }
      // 클라우드 비어있음 → 로컬 오버라이드를 이메일과 함께 이관
      if (window.rjPushStudentToCloud) {
        const ov = stuLoadOv();
        const byUid = {}; stuList().forEach((s) => { byUid[s.uid] = s.email; });
        Object.keys(ov).forEach((uid) => { window.rjPushStudentToCloud(uid, ov[uid], byUid[uid] || ov[uid].email).catch(() => {}); });
      }
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const [q, setQ] = useStA("");
  const [roleF, setRoleF] = useStA("student");
  const [statusF, setStatusF] = useStA("all");
  const [selId, setSelId] = useStA(null);
  const [adding, setAdding] = useStA(false);
  const [sortBy, setSortBy] = useStA("name");
  const [linkF, setLinkF] = useStA("all");     // 클래스인 연동 필터
  const [page, setPage] = useStA(1);
  const PAGE_SIZE = 50;
  // 필터/검색/정렬 변경 시 첫 페이지로
  React.useEffect(() => { setPage(1); }, [q, roleF, statusF, linkF, sortBy, tick]);

  const isLinked = (a) => !!(a.classinUid || a.classin_uid);
  const c = {
    student: all.filter((a) => a.role === "student").length,
    teacher: all.filter((a) => a.role === "teacher").length,
    active: all.filter((a) => a.status === "active").length,
    pending: all.filter((a) => a.status === "pending").length,
    stopped: all.filter((a) => a.status === "stopped").length,
    linked: all.filter(isLinked).length,
  };
  const filtered = all
    .filter((a) => roleF === "all" || a.role === roleF)
    .filter((a) => statusF === "all" || a.status === statusF)
    .filter((a) => linkF === "all" || (linkF === "linked" ? isLinked(a) : !isLinked(a)))
    .filter((a) => {
      if (!q) return true; const s = q.toLowerCase();
      return a.name.includes(q) || (a.label || "").includes(q) || (a.email || "").toLowerCase().includes(s) || (a.mobile || "").includes(q) || String(a.uid).includes(q);
    });
  const STATUS_ORDER = { pending: 0, active: 1, stopped: 2 };
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "status") return (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || a.name.localeCompare(b.name, "ko");
    if (sortBy === "name-desc") return b.name.localeCompare(a.name, "ko");
    return a.name.localeCompare(b.name, "ko");   // 기본: 가나다순
  });
  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const curPage = Math.min(page, pageCount);
  const rows = sorted.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);
  const sel = all.find((a) => a.uid === selId) || null;

  // 현재 필터 결과를 CSV 로 내보내기
  const exportCsv = () => {
    const head = ["이름", "역할", "학년·반", "이메일", "휴대폰", "ClassIn UID", "상태", "출처"];
    const esc = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const lines = [head.join(",")].concat(sorted.map((a) => [
      a.name, a.role === "teacher" ? "강사" : "학생", a.label || "", a.email || "", a.mobile || "",
      a.classinUid || a.classin_uid || a.uid, a.status || "", a.source || "",
    ].map(esc).join(",")));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url; el.download = "리뉴젠_학생명부_" + total + "명.csv";
    document.body.appendChild(el); el.click(); el.remove(); URL.revokeObjectURL(url);
  };

  const setStatus = (uid, status, label) => { stuPatch(uid, { status }); refresh(); showToast(label); };

  return (
    <div>
      <CiHead title="학생 관리" api="Student Management"
        sub="명부·검색 · 상태(활성·정지·승인) · 수강 강의 배정 · 성적 연동 · 관리 메모 · 신규 등록"
        action={<button className="ci-act navy" onClick={() => setAdding(true)}><Icon name="plus" size={13} /> 학생 추가</button>} />

      {/* KPI */}
      <div className="ci-stat-strip" style={{ marginBottom: 18 }}>
        <div className="ci-kpi accent"><div className="lab"><span className="ico"><Icon name="users" size={16} /></span> 학생</div><div className="num">{c.student}</div><div className="sub">강사 {c.teacher}명</div></div>
        <div className="ci-kpi"><div className="lab"><span className="ico"><Icon name="check" size={16} /></span> 활성</div><div className="num">{c.active}</div><div className="sub">수강 중</div></div>
        <div className="ci-kpi"><div className="lab"><span className="ico"><Icon name="clock" size={16} /></span> 승인대기</div><div className="num">{c.pending}</div><div className="sub">신규 가입</div></div>
        <div className="ci-kpi"><div className="lab"><span className="ico"><Icon name="signal" size={16} /></span> 클래스인 연동</div><div className="num">{c.linked}</div><div className="sub">정지 {c.stopped}명</div></div>
      </div>

      {/* 툴바 */}
      <div className="ci-toolbar">
        <label className="ci-search"><Icon name="search" size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·반·이메일·휴대폰·UID 검색" />
        </label>
        <select className="ci-select" value={roleF} onChange={(e) => setRoleF(e.target.value)}>
          <option value="student">학생</option>
          <option value="teacher">강사</option>
          <option value="all">전체</option>
        </select>
        <select className="ci-select" value={statusF} onChange={(e) => setStatusF(e.target.value)}>
          <option value="all">모든 상태</option>
          <option value="active">활성</option>
          <option value="pending">승인대기</option>
          <option value="stopped">정지</option>
        </select>
        <select className="ci-select" value={linkF} onChange={(e) => setLinkF(e.target.value)}>
          <option value="all">연동 전체</option>
          <option value="linked">클래스인 연동됨</option>
          <option value="unlinked">미연동</option>
        </select>
        <select className="ci-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="name">이름 가나다순</option>
          <option value="name-desc">이름 역순</option>
          <option value="status">상태순(승인대기 먼저)</option>
        </select>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 13, color: "var(--ci-muted)" }}>결과 <b style={{ color: "var(--ci-ink)" }}>{total.toLocaleString()}</b>명</span>
          <button className="ci-act sm" onClick={exportCsv} title="현재 결과를 CSV로 내려받기"><Icon name="download" size={12} /> CSV</button>
        </span>
      </div>

      <div className="ci-card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="ci-table">
            <thead><tr><th>이름</th><th>역할</th><th>학년·반</th><th>연락처</th><th>ClassIn UID</th><th>수강</th><th>최근 평균</th><th>상태</th><th style={{ textAlign: "right" }}>작업</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={9} style={{ padding: 28, textAlign: "center", color: "var(--ci-muted)" }}>조건에 맞는 학생이 없습니다</td></tr>}
              {rows.map((a) => {
                const trend = a.role === "student" ? stuScoreTrend(a.name) : null;
                const avg = trend && trend.length ? trend[trend.length - 1].avg : null;
                return (
                  <tr key={a.uid} className={"ci-row-clickable" + (selId === a.uid ? " active" : "")} onClick={() => setSelId(a.uid)}>
                    <td><span className="ci-nameav"><span className="av" style={a.role === "teacher" ? { background: "var(--ci-navy-2)" } : {}}>{a.name.slice(-2)}</span>{a.name}{a.signup && <span className="ci-badge navy" style={{ fontSize: 9, marginLeft: 6 }}>가입</span>}{a.source === "classin" && !a.signup && <span className="ci-badge neutral" style={{ fontSize: 9, marginLeft: 6 }}>명부</span>}</span></td>
                    <td><span className={"ci-badge " + (a.role === "teacher" ? "navy" : "neutral")}>{a.role === "teacher" ? "강사" : "학생"}</span></td>
                    <td>{a.label || "—"}</td>
                    <td className="ci-mono" style={{ color: "var(--ci-muted)" }}>{a.email || a.mobile || "—"}</td>
                    <td className="ci-uid">{a.classinUid || a.uid}</td>
                    <td className="ci-mono">{(a.courses && a.courses.length) || a.classes || 0}</td>
                    <td className="ci-mono" style={{ fontWeight: 800, color: avg != null ? "var(--ci-navy)" : "var(--ci-muted)" }}>{avg != null ? avg : "—"}</td>
                    <td><StuStatusBadge s={a.status} /></td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <span style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
                        {a.status === "pending" && <button className="ci-act sm navy" onClick={() => setStatus(a.uid, "active", `${a.name} 승인 완료`)}><Icon name="check" size={11} /> 승인</button>}
                        {a.status === "stopped"
                          ? <button className="ci-act sm navy" onClick={() => setStatus(a.uid, "active", `${a.name} 재시작`)}><Icon name="refresh" size={11} /> 재시작</button>
                          : <button className="ci-act sm danger" onClick={() => setStatus(a.uid, "stopped", `${a.name} 정지`)}><Icon name="lock" size={11} /> 정지</button>}
                        <button className="ci-act sm" onClick={() => setSelId(a.uid)}><Icon name="arrow" size={11} /> 상세</button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {pageCount > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", borderTop: "1px solid var(--ci-line)", fontSize: 13 }}>
            <span style={{ color: "var(--ci-muted)" }}>
              {((curPage - 1) * PAGE_SIZE + 1).toLocaleString()}–{Math.min(curPage * PAGE_SIZE, total).toLocaleString()} / 총 {total.toLocaleString()}명
            </span>
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <button className="ci-act sm" disabled={curPage <= 1} onClick={() => setPage(1)}>« 처음</button>
              <button className="ci-act sm" disabled={curPage <= 1} onClick={() => setPage(curPage - 1)}>‹ 이전</button>
              <span style={{ padding: "0 8px", fontWeight: 700 }}>{curPage} / {pageCount}</span>
              <button className="ci-act sm" disabled={curPage >= pageCount} onClick={() => setPage(curPage + 1)}>다음 ›</button>
              <button className="ci-act sm" disabled={curPage >= pageCount} onClick={() => setPage(pageCount)}>끝 »</button>
            </span>
          </div>
        )}
      </div>

      {sel && <StudentDrawer student={sel} onClose={() => setSelId(null)} onChange={refresh} onOpenReports={onOpenReports} showToast={showToast} />}
      {adding && <AddStudentModal onClose={() => setAdding(false)} onAdded={(uid) => { setAdding(false); refresh(); setSelId(uid); }} showToast={showToast} />}
    </div>
  );
}
window.StudentManager = StudentManager;

// ── 학생 상세 드로어 ────────────────────────────────────────────────
function StudentDrawer({ student, onClose, onChange, onOpenReports, showToast }) {
  const a = student;
  const [form, setForm] = useStA({ name: a.name || "", email: a.email || "", mobile: a.mobile || "", label: a.label || "", memo: a.memo || "" });
  const [addCourse, setAddCourse] = useStA("");
  const courses = a.courses || [];
  const allCourses = typeof COURSES !== "undefined" ? COURSES : [];
  const trend = a.role === "student" ? stuScoreTrend(a.name) : null;
  const maxAvg = trend ? Math.max(100, ...trend.map((p) => p.avg || 0)) : 100;

  const save = (patch) => { stuPatch(a.uid, patch); onChange(); };
  const blurSave = (k) => { if (form[k] !== (a[k] || "")) save({ [k]: form[k] }); };
  const addC = (cid) => { if (!cid || courses.includes(cid)) return; save({ courses: [...courses, cid] }); setAddCourse(""); };
  const rmC = (cid) => save({ courses: courses.filter((x) => x !== cid) });
  const setPlan = (plan) => { save({ plan }); showToast(plan === "subscription" ? "프리패스(구독) 적용" : plan === "none" ? "수강권 해제" : "수강권 변경"); };

  return (
    <div className="ci-drawer-overlay" onClick={onClose}>
      <div className="ci-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="ci-drawer-head">
          <span className="av">{(form.name || "?").slice(-2)}</span>
          <div>
            <div style={{ fontWeight: 900, fontSize: 19 }}>{form.name || "이름 미상"}</div>
            <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.7)" }}>{a.role === "teacher" ? "강사" : "학생"} · {form.label || "반 미배정"} · UID {a.classinUid || a.uid}</div>
          </div>
          <button className="ci-x" onClick={onClose}><Icon name="close" size={16} /></button>
        </div>
        <div className="ci-drawer-body">
          {/* 상태 관리 */}
          <div className="ci-sec">
            <h5>상태 관리 <StuStatusBadge s={a.status} /></h5>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {a.status !== "active" && <button className="ci-act navy" onClick={() => save({ status: "active" })}><Icon name="check" size={13} /> {a.status === "pending" ? "가입 승인" : "활성화"}</button>}
              {a.status !== "stopped" && <button className="ci-act danger" onClick={() => save({ status: "stopped" })}><Icon name="lock" size={13} /> 이용 정지</button>}
              {a.status === "stopped" && <span style={{ fontSize: 12.5, color: "var(--ci-muted)", alignSelf: "center" }}>정지된 계정은 로그인·강의실 입장이 막힙니다</span>}
            </div>
          </div>

          {/* 기본 정보 (편집) */}
          <div className="ci-sec">
            <h5>기본 정보</h5>
            <div className="ci-field"><label>이름</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} onBlur={() => blurSave("name")} /></div>
            <div className="ci-field"><label>이메일 (ClassIn 계정 · 메인 식별)</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} onBlur={() => blurSave("email")} placeholder="student@example.com" /></div>
            <div className="ci-field"><label>휴대폰 (선택)</label><input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} onBlur={() => blurSave("mobile")} placeholder="010-0000-0000" /></div>
            <div className="ci-field"><label>학년 · 반</label><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} onBlur={() => blurSave("label")} placeholder="예: 고2 / 중A" /></div>
            <div className="ci-kv"><span className="k">ClassIn UID</span><span className="v" style={{ fontFamily: "var(--font-en)" }}>{a.classinUid || a.uid}{a.added && <span className="ci-badge neutral" style={{ marginLeft: 6 }}>가입 시 발급</span>}</span></div>
          </div>

          {/* 수강 강의 */}
          <div className="ci-sec">
            <h5>수강 강의 <span style={{ color: "var(--ci-muted)", fontWeight: 700 }}>{courses.length}개</span></h5>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: courses.length ? 12 : 0 }}>
              {courses.map((cid) => {
                const co = allCourses.find((x) => x.id === cid);
                return <span key={cid} className="ci-chip">{co ? co.title : cid}<button onClick={() => rmC(cid)}><Icon name="close" size={11} /></button></span>;
              })}
              {courses.length === 0 && <span style={{ fontSize: 12.5, color: "var(--ci-muted)" }}>배정된 강의가 없습니다</span>}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <select className="ci-select" style={{ flex: 1 }} value={addCourse} onChange={(e) => setAddCourse(e.target.value)}>
                <option value="">강의 선택…</option>
                {allCourses.filter((co) => !courses.includes(co.id)).map((co) => <option key={co.id} value={co.id}>{co.title}</option>)}
              </select>
              <button className="ci-act navy" onClick={() => addC(addCourse)}><Icon name="plus" size={13} /> 배정</button>
            </div>
          </div>

          {/* 수강권 */}
          <div className="ci-sec">
            <h5>수강권 · 결제</h5>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[["subscription", "프리패스(구독)"], ["single", "낱개 수강권"], ["none", "없음"]].map(([k, l]) => (
                <button key={k} className={"ci-act" + ((a.plan || "none") === k ? " navy" : "")} onClick={() => setPlan(k)}>{l}</button>
              ))}
            </div>
          </div>

          {/* 성적 (월말평가 연동) */}
          {a.role === "student" && (
            <div className="ci-sec">
              <h5>월말평가 성적 추이 {trend && <button className="ci-act sm" onClick={() => { onClose(); onOpenReports && onOpenReports(); }}><Icon name="arrow" size={11} /> 성적표</button>}</h5>
              {trend ? (
                <div className="ci-trend">
                  {trend.map((p, i) => (
                    <div key={i} className="bar" style={{ height: Math.max(6, ((p.avg || 0) / maxAvg) * 58) + "px" }}>
                      <span>{p.avg != null ? p.avg : "–"}</span><em>{p.label}</em>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: 12.5, color: "var(--ci-muted)" }}>연동된 성적이 없습니다. 성적표 탭에서 클래스인 OMR 성적을 불러오면 이름이 일치하는 학생에게 자동 연결됩니다.</p>
              )}
            </div>
          )}

          {/* 관리 메모 */}
          <div className="ci-sec">
            <h5>관리 메모</h5>
            <div className="ci-field"><textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} onBlur={() => blurSave("memo")} placeholder="상담 내역, 특이사항 등 (관리자만 보임)" /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
window.StudentDrawer = StudentDrawer;

// ── 학생 추가 모달 ──────────────────────────────────────────────────
function AddStudentModal({ onClose, onAdded, showToast }) {
  const [f, setF] = useStA({ name: "", email: "", mobile: "", label: "고2" });
  const up = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const submit = () => {
    if (!f.name.trim()) { showToast("이름을 입력하세요"); return; }
    if (!f.email.trim() || !/.+@.+\..+/.test(f.email)) { showToast("올바른 이메일을 입력하세요 (ClassIn 계정 발급용)"); return; }
    const uid = stuAdd({ name: f.name.trim(), email: f.email.trim().toLowerCase(), mobile: f.mobile.trim(), label: f.label, status: "active", courses: [] });
    showToast(`${f.name} 등록 · 가입 이메일로 ClassIn 계정(UID)이 발급됩니다`);
    onAdded(uid);
  };
  return (
    <div className="ci-modal-overlay" onClick={onClose}>
      <div className="ci-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ci-modal-head">학생 추가 <button className="ci-x" onClick={onClose}><Icon name="close" size={16} /></button></div>
        <div className="ci-modal-body">
          <div className="ci-field"><label>이름 *</label><input value={f.name} onChange={(e) => up("name", e.target.value)} placeholder="홍길동" /></div>
          <div className="ci-field"><label>이메일 * (ClassIn 계정 · 메인 식별 키)</label><input value={f.email} onChange={(e) => up("email", e.target.value)} placeholder="student@example.com" inputMode="email" /></div>
          <div className="ci-field"><label>휴대폰 (선택)</label><input value={f.mobile} onChange={(e) => up("mobile", e.target.value)} placeholder="010-0000-0000" inputMode="tel" /></div>
          <div className="ci-field"><label>학년 · 반</label>
            <select value={f.label} onChange={(e) => up("label", e.target.value)}>
              {["중1", "중2", "중3", "고1", "고2", "고3", "N수생", "중A", "중B", "고A"].map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <p style={{ fontSize: 12, color: "var(--ci-muted)", lineHeight: 1.6, margin: "4px 0 0" }}>
            저장 시 가입 이메일로 ClassIn 계정이 대신 등록되고(sync-user.php → register), 반환된 UID가 이 학생에 연결됩니다.
          </p>
        </div>
        <div className="ci-modal-foot">
          <button className="ci-act" onClick={onClose}>취소</button>
          <button className="ci-act navy" onClick={submit}><Icon name="check" size={13} /> 추가</button>
        </div>
      </div>
    </div>
  );
}
window.AddStudentModal = AddStudentModal;
