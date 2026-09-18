/* global React, INSTRUCTORS, COURSES, SUBJECTS, NOTICES */
// Shared UI components for Renewjen Academy

const { useState, useEffect, useRef, useMemo, useContext, createContext } = React;

// ── Utility ─────────────────────────────────────────────────────────
const formatKRW = (n) => "₩" + n.toLocaleString("ko-KR");
const cx = (...xs) => xs.filter(Boolean).join(" ");

const findInstructor = (id) => INSTRUCTORS.find((i) => i.id === id);
const findCourse = (id) => COURSES.find((c) => c.id === id);
const findSubject = (id) => SUBJECTS.find((s) => s.id === id);

// ── Icons (simple stroke, 1.5px, currentColor) ─────────────────────
const Icon = ({ name, size = 18, className = "", strokeWidth = 1.5 }) => {
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    cart: <><path d="M3 4h2.5l2.5 12h11l2-9H7" /><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-7 8-7s8 3 8 7" /></>,
    menu: <><path d="M3 6h18M3 12h18M3 18h18" /></>,
    arrow: <><path d="M5 12h14M13 5l7 7-7 7" /></>,
    arrowLeft: <><path d="M19 12H5M11 5l-7 7 7 7" /></>,
    play: <><path d="M7 5v14l12-7-12-7Z" fill="currentColor" stroke="none" /></>,
    pause: <><path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" stroke="none" /></>,
    check: <><path d="m5 12 5 5 9-11" /></>,
    star: <><path d="m12 3 2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6L4 9l5.5-.5L12 3Z" fill="currentColor" stroke="none" /></>,
    close: <><path d="M6 6l12 12M18 6 6 18" /></>,
    eye: <><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" /><circle cx="12" cy="12" r="3" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    minus: <><path d="M5 12h14" /></>,
    download: <><path d="M12 4v12M6 10l6 6 6-6M4 20h16" /></>,
    bookmark: <><path d="M6 4h12v17l-6-4-6 4V4Z" /></>,
    book: <><path d="M4 5a2 2 0 0 1 2-2h14v18H6a2 2 0 0 0-2 2V5Z" /><path d="M4 5v14a2 2 0 0 1 2-2h14" /></>,
    live: <><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" /><path d="M8 8a5.6 5.6 0 0 0 0 8M16 8a5.6 5.6 0 0 1 0 8M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>,
    chat: <><path d="M4 5h16v11H10l-4 4v-4H4V5Z" /></>,
    mic: <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
    chevron: <><path d="m9 6 6 6-6 6" /></>,
    chevronDown: <><path d="m6 9 6 6 6-6" /></>,
    lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 1 1 8 0v3" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 7 9-7" /></>,
    card: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18" /></>,
    sparkle: <><path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l4 4M14 14l4 4M6 18l4-4M14 10l4-4" /></>,
    pdf: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 13h2a1.5 1.5 0 0 0 0-3H9v6" /></>,
    pin: <><path d="M12 22v-7M8 4h8l-1 6c2 1 3 3 3 5H6c0-2 1-4 3-5L8 4Z" /></>,
    hand: <><path d="M7 11V6.5a1.5 1.5 0 0 1 3 0V11m0-1V5a1.5 1.5 0 0 1 3 0v5m0-.5V6a1.5 1.5 0 0 1 3 0v6c0 3.5-2 7-6 7s-6-3-6-6v-1a1.5 1.5 0 0 1 3 0" /></>,
    trophy: <><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" /><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 21h6M12 14v7" /></>,
    folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></>,
    upload: <><path d="M12 16V5M7 9l5-5 5 5M4 20h16" /></>,
    signal: <><path d="M4 20v-4M9 20v-8M14 20v-12M19 20V4" /></>,
    users: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5a3 3 0 0 1 0 6M21 20c0-2.5-1.5-4.6-3.6-5.5" /></>,
    monitor: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>,
    heart: <><path d="M12 20s-7-4.5-9.5-9C1 8 2.5 4.5 6 4.5c2 0 3.2 1.2 4 2.5.8-1.3 2-2.5 4-2.5 3.5 0 5 3.5 3.5 6.5C19 15.5 12 20 12 20Z" fill="currentColor" stroke="none" /></>,
    share: <><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.2 10.8 15.8 7M8.2 13.2l7.6 3.8" /></>,
    refresh: <><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 4v4h-4M21 12a9 9 0 0 1-15 6.7L3 16M3 20v-4h4" /></>,
    video: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
    edit: <><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></>,
    key: <><circle cx="8" cy="8" r="4" /><path d="m11 11 9 9M17 17l2-2M14 14l2-2" /></>,
    server: <><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></>,
    rocket: <><path d="M12 3c3 1.5 5 5 5 9l-3 2h-4l-3-2c0-4 2-7.5 5-9Z" /><circle cx="12" cy="9" r="1.6" /><path d="M9 16c-1.5 1-2 3-2 5 2 0 4-.5 5-2M15 16c1.5 1 2 3 2 5-2 0-4-.5-5-2" /></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {paths[name]}
    </svg>
  );
};

// ── App context (router + cart + auth) ─────────────────────────────
const AppContext = createContext(null);
const useApp = () => useContext(AppContext);

function parseHash() {
  const h = (window.location.hash || "#/").replace(/^#/, "");
  const [path, query] = h.split("?");
  const params = new URLSearchParams(query || "");
  return { path: path || "/", params };
}

function AppProvider({ children, initialTweaks }) {
  const [route, setRoute] = useState(parseHash());
  const [cart, setCart] = useState([]); // [{courseId}]
  const [user, setUser] = useState(null);
  const [toast, setToast] = useState(null);
  const [tweaks, setTweaksState] = useState(initialTweaks);

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash());
      window.scrollTo({ top: 0, behavior: "instant" });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (to) => {
    if (typeof to === "string") {
      window.location.hash = "#" + to;
    }
  };

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => setToast(null), 2200);
  };

  const addToCart = (courseId) => {
    setCart((prev) => (prev.find((c) => c.courseId === courseId) ? prev : [...prev, { courseId }]));
    showToast("장바구니에 담았습니다");
  };
  const removeFromCart = (courseId) => setCart((p) => p.filter((c) => c.courseId !== courseId));
  const clearCart = () => setCart([]);

  const login = (email, name = "한도윤", initials = "도윤") => {
    setUser({ email, name, initials, role: (window.getUserRole ? window.getUserRole(email) : "student") });
    showToast(`${name}님, 환영합니다`);
  };
  const logout = async () => {
    const sb = window.getSupabase && window.getSupabase();
    if (sb) { try { await sb.auth.signOut(); } catch (e) {} }
    try { sessionStorage.removeItem("rj-auto-routed"); } catch (e) {}
    setUser(null);
    showToast("로그아웃 되었습니다");
  };

  // ── Supabase 세션 복원 + 상태 동기화 ──
  useEffect(() => {
    const sb = window.getSupabase && window.getSupabase();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      if (data && data.session) setUser(window.mapSbUser(data.session.user));
    }).catch((e) => {
      // 만료된 refresh token 등 → 잘못된 세션을 비워 콘솔 에러 방지
      try { sb.auth.signOut(); } catch (_) {}
    });
    const { data: sub } = sb.auth.onAuthStateChange((_evt, session) => {
      setUser(session ? window.mapSbUser(session.user) : null);
    });
    return () => { try { sub.subscription.unsubscribe(); } catch (e) {} };
  }, []);

  // 현재 로그인 사용자를 전역에 노출 + 시험 데이터 동기화
  //  · staff(teacher/admin)만 exams 원본(정답 포함)을 직접 pullExamData() 한다.
  //  · 학생은 exam-serve Edge Function이 정답을 제거한 메타데이터만 주는
  //    pullExamsForStudent() 를 쓴다 — 로그인 즉시 정답이 통째로 내려오던
  //    예전 경로(pullExamData)를 학생에게는 더 이상 타지 않게 한다.
  useEffect(() => {
    window.RJ_CURRENT_USER = user || null;
    if (!user) return;
    if (window.isStaff && window.isStaff(user)) {
      if (window.pullExamData) window.pullExamData(user).catch(() => {});
    } else if (window.pullExamsForStudent) {
      window.pullExamsForStudent(user).catch(() => {});
    }
  }, [user]);

  // 로그인 사용자의 profiles.role 을 한 번 불러와 user 에 병합 (역할 기반 권한의 실서버 소스)
  useEffect(() => {
    if (!user || !user.id || user.profileRole !== undefined) return;
    if (!window.fetchProfileRole) return;
    window.fetchProfileRole(user.id).then((role) => {
      setUser((prev) => {
        if (!prev || prev.id !== user.id) return prev;
        const pr = role || "student";
        return { ...prev, profileRole: pr, role: window.getUserRole({ email: prev.email, profileRole: pr }) };
      });
    });
  }, [user]);

  // 세션 복원/로그인 후, 관리자·강사면 자동으로 콘솔로 (탭 세션당 1회 — '학생 화면 보기'는 방해 안 함)
  useEffect(() => {
    if (!user) return;
    const emailLow = (user.email || "").toLowerCase();
    const fixedAdmin = window.RJ_ADMIN_EMAILS && window.RJ_ADMIN_EMAILS.includes(emailLow);
    const roleKnown = fixedAdmin || user.profileRole !== undefined;  // 역할 확정될 때까지 대기
    if (!roleKnown) return;
    try { if (sessionStorage.getItem("rj-auto-routed")) return; } catch (e) {}
    try { sessionStorage.setItem("rj-auto-routed", "1"); } catch (e) {}
    if (window.isStaff && window.isStaff(user)) {
      const h = window.location.hash || "";
      const neutral = h === "" || h === "#/" || h === "#/mypage" || h.indexOf("#/mypage?") === 0 || h.indexOf("#/login") === 0 || h.indexOf("#/signup") === 0;
      if (neutral) navigate(window.isAdmin && window.isAdmin(user) ? "/admin" : "/teacher");
    }
  }, [user]);

  // 실제 로그인 (Supabase). 미설정 시 데모 로그인으로 폴백.
  const signIn = async (email, password) => {
    const sb = window.getSupabase && window.getSupabase();
    if (!sb) { login(email, email.split("@")[0] || "게스트", "GU"); return { ok: true, demo: true }; }
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };
    const u = window.mapSbUser(data.user);
    setUser(u);
    showToast(`${u.name}님, 환영합니다`);
    return { ok: true };
  };

  // 실제 회원가입 (Supabase). 프로필 테이블에도 저장.
  const signUp = async ({ email, password, name, grade, school, subject, age, phone, role }) => {
    const sb = window.getSupabase && window.getSupabase();
    if (!sb) { login(email, name, (name || "GU").slice(-2)); return { ok: true, demo: true }; }
    const meta = { name, grade, school, subject, age: age || null, phone: phone || null, role: role || "student" };
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { data: meta },
    });
    if (error) return { ok: false, error: error.message };
    if (data.user) {
      // role 은 보안상 가입 시 서버 트리거가 'student' 로 강제 — 선생님 승급은 관리자가 처리
      try { await sb.from("profiles").upsert({ id: data.user.id, email, name, grade, school, subject, age: age ? Number(age) : null, phone: phone || null }); } catch (e) {}
    }
    if (data.session) {
      setUser(window.mapSbUser(data.user));
      // 클래스인에 자동 학생 계정 등록(이메일 매핑) — 실패해도 가입은 성공으로 처리
      try { if (window.classinSyncSelf) window.classinSyncSelf({ name, telephone: phone, role: role || "student" }); } catch (e) {}
      return { ok: true };
    }
    return { ok: true, needsConfirm: true }; // 이메일 확인이 켜져 있을 때
  };

  const setTweak = (keyOrObj, value) => {
    const next = typeof keyOrObj === "string" ? { ...tweaks, [keyOrObj]: value } : { ...tweaks, ...keyOrObj };
    setTweaksState(next);
    try {
      window.parent.postMessage({ type: "__edit_mode_set_keys", edits: typeof keyOrObj === "string" ? { [keyOrObj]: value } : keyOrObj }, "*");
    } catch (e) {}
  };

  const value = { route, navigate, cart, addToCart, removeFromCart, clearCart, user, login, logout, signIn, signUp, showToast, tweaks, setTweak };

  return (
    <AppContext.Provider value={value}>
      {children}
      {toast && <div className="toast">{toast}</div>}
    </AppContext.Provider>
  );
}

// ── Header ──────────────────────────────────────────────────────────
const NAV = [
  { path: "/about", label: "About" },
  { path: "/subscribe", label: "구독" },
  { path: "/courses", label: "강의" },
  { path: "/instructors", label: "강사" },
  { path: "/curriculum", label: "커리큘럼" },
  { path: "/admissions", label: "입시정보" },
  { path: "/faq", label: "FAQ" },
];

function SiteHeader() {
  const { route, navigate, cart, user } = useApp();
  // 회원 영역(학습 대시보드·관리자 콘솔·플레이어 등)에서는 마케팅 네비를 감추고
  // 로고만 있는 슬림 헤더로 — 페이지 자체 헤더(대시보드 히어로)가 따로 있기 때문.
  const p = route.path || "";
  const memberArea = p.startsWith("/mypage") || p.startsWith("/admin") || p.startsWith("/teacher") || p.startsWith("/player") || p.startsWith("/weblive") || (p.startsWith("/live/") && p.split("/").length > 2);

  if (memberArea) {
    return (
      <header className="site-header">
        <div className="container-wide site-header-inner" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <a href="#/" className="brand-wordmark brand-wordmark--logo" onClick={(e) => { e.preventDefault(); navigate("/"); }}>
            <img src="assets/logo-full.png" alt="리뉴젠 아카데미 · Re:newgen Academy" className="brand-logo-full" />
          </a>
          <div className="header-actions">
            {user && <button className="icon-btn" onClick={() => navigate(window.isAdmin && window.isAdmin(user) ? "/admin" : (window.isStaff && window.isStaff(user) ? "/teacher" : "/mypage"))} aria-label="내 화면">
              <span className="avatar avatar-sm" style={{ background: "var(--rj-ink)", color: "var(--rj-paper)" }}>{user.initials}</span>
            </button>}
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="site-header">
      <div className="container-wide site-header-inner">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a href="#/" className="brand-wordmark brand-wordmark--logo" onClick={(e) => { e.preventDefault(); navigate("/"); }} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <img src="assets/logo-full.png" alt="리뉴젠 아카데미 · Re:newgen Academy" className="brand-logo-full" />
            <span style={{ paddingLeft: 10, borderLeft: "1px solid rgba(0,29,61,0.18)", fontSize: 15, fontWeight: 800, color: "var(--acad-navy, #001D3D)", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>원격학원</span>
          </a>
        </div>
        <nav className="main-nav">
          {NAV.filter((n) => !(window.RJ_EDU_MODE && (n.path === "/about" || n.path === "/admissions"))).map((n) => (
            <a key={n.path} href={"#" + n.path}
               className={route.path.startsWith(n.path) ? "active" : ""}
               onClick={(e) => { e.preventDefault(); navigate(n.path); }}>{n.label}</a>
          ))}
        </nav>
        <div className="header-actions">
          <button className="icon-btn" onClick={() => navigate("/curriculum?tab=schedule")} aria-label="학사일정"><Icon name="calendar" /></button>
          <button className="icon-btn" onClick={() => navigate("/courses")} aria-label="검색"><Icon name="search" /></button>
          <button className="icon-btn" onClick={() => navigate("/cart")} aria-label="장바구니">
            <Icon name="cart" />
            {cart.length > 0 && <span className="badge">{cart.length}</span>}
          </button>
          {user ? (
            <button className="icon-btn" onClick={() => navigate(window.isAdmin && window.isAdmin(user) ? "/admin" : (window.isStaff && window.isStaff(user) ? "/teacher" : "/mypage"))} aria-label="내 화면">
              <span className="avatar avatar-sm" style={{ background: "var(--rj-ink)", color: "var(--rj-paper)" }}>
                {user.initials}
              </span>
            </button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => navigate("/login")}>로그인</button>
          )}
        </div>
      </div>
    </header>
  );
}

// ── Footer ──────────────────────────────────────────────────────────
function SiteFooter() {
  const { navigate } = useApp();
  return (
    <footer className="site-footer">
      <div className="container-wide">
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr", gap: 40, marginBottom: 64 }}>
          <div>
            <img src="assets/logo-full.png" alt="리뉴젠 아카데미 Re:newgen Academy" className="brand-logo-full brand-logo-full--lg" style={{ display: "block" }} />
            <p style={{ marginTop: 22, color: "rgba(245,241,233,0.6)", fontSize: 13, lineHeight: 1.65, maxWidth: 320 }}>
              정통의 입시. 새로운 학습.<br />
              {eduText("실시간 라이브 강의와 무제한 다시보기로 매주의 학습을 완성합니다.", "체계적인 녹화 강의와 무제한 다시보기로 매주의 학습을 완성합니다.")}
            </p>
          </div>
          {[
            { h: "강의", items: ["전체 강의", eduText("수능 라이브", "수능 강좌"), "내신 패키지", "단과 VOD"] },
            { h: "지원", items: ["수강 신청 가이드", "FAQ", "1:1 문의"] },
            { h: "회사", items: ["브랜드 소개", "강사진", "공지사항", "채용"] },
            { h: "법적 고지", items: ["이용약관", "개인정보처리방침", "환불규정", "사업자 정보"] },
          ].map((col) => {
            const LEGAL_ROUTES = { "이용약관": "/terms", "개인정보처리방침": "/privacy", "환불규정": "/refund" };
            return (
            <div key={col.h}>
              <div className="label-cap" style={{ color: "rgba(245,241,233,0.5)", marginBottom: 14 }}>{col.h}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
                {col.items.map((i) => {
                  const to = LEGAL_ROUTES[i];
                  return (
                    <li key={i}><a href={to ? "#" + to : "#/"} onClick={(e) => { e.preventDefault(); if (to) navigate(to); }} style={{ fontSize: 13, color: "rgba(245,241,233,0.85)", cursor: "pointer" }}>{i}</a></li>
                  );
                })}
              </ul>
            </div>
            );
          })}
        </div>
        <div style={{ borderTop: "1px solid rgba(245,241,233,0.18)", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 12, color: "rgba(245,241,233,0.5)" }}>
            리뉴젠아카데미 · 대표 지예은 · 대전광역시 유성구 은구비남로33번길 13-8, 3166호(지족동, 양지빌딩)
          </div>
          <div style={{ fontFamily: "var(--font-en)", fontSize: 11, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(245,241,233,0.4)" }}>
            © Renewjen Academy · MMXXVI
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Course poster + card ───────────────────────────────────────────
const POSTER_VARIANTS = {
  ink: "poster poster-ink",
  cream: "poster poster-cream",
  accent: "poster poster-accent",
  deep: "poster poster-deep",
};
function CoursePoster({ course, size = "md", onClick }) {
  const ins = findInstructor(course.instructor);
  const subj = findSubject(course.subject);
  if (course.thumb) {
    return (
      <button onClick={onClick} className={POSTER_VARIANTS[course.color] || "poster"} style={{ width: "100%", height: "100%", minHeight: 240, textAlign: "left", cursor: "pointer", position: "relative", overflow: "hidden" }}>
        <img src={course.thumb} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.86), rgba(0,0,0,0.08) 62%)", zIndex: 1 }} />
        <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", color: "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div className="label-cap" style={{ opacity: 0.85 }}>No. {course.no} / {subj?.en || ""}</div>
            {course.badge && <span className="tag" style={{ borderColor: "currentColor" }}>{course.badge}</span>}
          </div>
          <div>
            <div className="poster-title">{course.title}</div>
            {course.subtitle && <div style={{ fontFamily: "var(--font-en)", fontStyle: "italic", fontWeight: 300, fontSize: 14, opacity: 0.8, marginTop: 4 }}>{course.subtitle}</div>}
            <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, opacity: 0.9 }}>
              <span>{ins?.name || ""}{course.level ? " · " + course.level : ""}</span>
              {course.rating ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="star" size={11} /> {course.rating}</span> : <span />}
            </div>
          </div>
        </div>
      </button>
    );
  }
  return (
    <button onClick={onClick} className={POSTER_VARIANTS[course.color]} style={{ width: "100%", textAlign: "left", cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="label-cap" style={{ opacity: 0.7 }}>No. {course.no} / {subj?.en}</div>
        {course.badge && <span className="tag" style={{ borderColor: "currentColor" }}>{course.badge}</span>}
      </div>
      <div className="poster-num">{course.no}</div>
      <div>
        <div className="poster-title">{course.title}</div>
        <div style={{ fontFamily: "var(--font-en)", fontStyle: "italic", fontWeight: 300, fontSize: 14, opacity: 0.7, marginTop: 4 }}>{course.subtitle}</div>
        <div style={{ marginTop: 18, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
          <span style={{ opacity: 0.8 }}>{ins?.name} · {course.level}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, opacity: 0.8 }}>
            <Icon name="star" size={11} /> {course.rating}
          </span>
        </div>
      </div>
    </button>
  );
}

function CourseRowCard({ course, onOpen }) {
  const ins = findInstructor(course.instructor);
  const subj = findSubject(course.subject);
  return (
    <div className="card" style={{ padding: 22, display: "grid", gridTemplateColumns: "180px 1fr auto", gap: 28, alignItems: "center" }}>
      <div style={{ aspectRatio: "4 / 5" }}>
        <CoursePoster course={course} onClick={onOpen} />
      </div>
      <div>
        <div className="eyebrow" style={{ opacity: 0.7 }}>No. {course.no} — {subj?.en}</div>
        <h3 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 26, margin: "10px 0 6px", letterSpacing: "-0.025em" }}>{course.title}</h3>
        <p style={{ color: "var(--rj-muted)", fontSize: 14, margin: 0, maxWidth: 520 }}>{course.description}</p>
        <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 13, color: "var(--rj-muted)", alignItems: "center" }}>
          <span><span className="avatar avatar-sm" style={{ marginRight: 6, verticalAlign: "middle" }}>{ins?.initials}</span> {ins?.name}</span>
          <span>·</span>
          <span>{course.lessons}강 · {course.hours}시간</span>
          <span>·</span>
          <span>{course.format}</span>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="num-en" style={{ textDecoration: "line-through", color: "var(--rj-muted)", fontSize: 13 }}>{formatKRW(course.price)}</div>
        <div className="num-en" style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>{formatKRW(course.salePrice)}</div>
        <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={onOpen}>자세히 보기 <Icon name="arrow" size={14} /></button>
      </div>
    </div>
  );
}

// ── Section helpers ────────────────────────────────────────────────
function SectionHead({ ko, en, action }) {
  return (
    <div className="section-head">
      <div>
        <div className="eyebrow" style={{ color: "var(--rj-muted)" }}>{en}</div>
        <h2 style={{ marginTop: 10 }}>{ko}</h2>
      </div>
      {action}
    </div>
  );
}

// expose
Object.assign(window, {
  Icon, AppContext, AppProvider, useApp,
  SiteHeader, SiteFooter,
  CoursePoster, CourseRowCard,
  SectionHead,
  formatKRW, cx, findInstructor, findCourse, findSubject,
});
