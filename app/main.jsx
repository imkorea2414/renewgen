/* global React, ReactDOM, AppProvider, useApp, SiteHeader, SiteFooter,
   HomePage, CoursesPage, CourseDetailPage, LoginPage, SignupPage,
   MyPage, CartPage, CheckoutPage, PlayerPage, LivePage,
   InstructorsPage, InstructorDetailPage, CommunityPage,
   NoticeListPage, NoticeDetailPage,
   TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakColor, TweakToggle */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "homeStyle": "academy",
  "heroLayout": "split",
  "liveLayout": "split",
  "accent": "primary",
  "darkChrome": false
}/*EDITMODE-END*/;

const ACCENT_PALETTES = {
  primary:    { accent: "#FFD60A", accentInk: "#001D3D", label: "Primary Yellow" },
  butter:     { accent: "#FBF4BD", accentInk: "#001D3D", label: "Butter" },
  matcha:     { accent: "#CFE5BB", accentInk: "#001D3D", label: "Matcha" },
  cobalt:     { accent: "#003566", accentInk: "#FFFBF0", label: "Mid Navy" },
  terracotta: { accent: "#D85A3C", accentInk: "#FFFBF0", label: "Terracotta" },
};

function applyTweaks(t) {
  const root = document.documentElement;
  const pal = ACCENT_PALETTES[t.accent] || ACCENT_PALETTES.butter;
  root.style.setProperty("--rj-accent", pal.accent);
  root.style.setProperty("--rj-accent-ink", pal.accentInk);
  // Switches the global look to academy (megastudy/etoos style) when set.
  if (t.homeStyle === "academy") root.setAttribute("data-home-style", "academy");
  else root.removeAttribute("data-home-style");
}

function Router() {
  const { route, user } = useApp();
  const path = route.path;
  const seg = path.split("/").filter(Boolean);

  // Routing
  if (path === "/" || seg[0] === "home") return <HomePage />;
  if (seg[0] === "courses") {
    if (seg[1]) return <CourseDetailPage courseId={seg[1]} />;
    return <CoursesPage />;
  }
  if (seg[0] === "instructors") {
    if (seg[1]) return <InstructorDetailPage instructorId={seg[1]} />;
    return <InstructorsPage />;
  }
  // v2 (BBB) 실시간 수업 — 플래그가 켜진 v2 에서만 /live·/bbb 를 BBB 페이지로
  if (window.RJ_LIVE_ENGINE === "bbb" && (seg[0] === "live" || seg[0] === "bbb")) {
    return <BBBLivePage />;
  }
  if (seg[0] === "live") {
    return <LivePage courseId={seg[1]} />;
  }
  if (seg[0] === "subscribe") return <SubscribePage />;
  if (seg[0] === "weblive") return <WebLivePage />;
  if (seg[0] === "admin") return (window.isStaff && window.isStaff(user)) ? <AdminPage /> : <AdminDenied user={user} />;
  if (seg[0] === "teacher") return (window.isStaff && window.isStaff(user)) ? <TeacherPage /> : <AdminDenied user={user} />;
  if (seg[0] === "about") return window.RJ_EDU_MODE ? <HomePage /> : <AboutPage />;
  if (seg[0] === "curriculum") return <CurriculumPage />;
  if (seg[0] === "notice") {
    if (seg[1]) return <NoticeDetailPage noticeId={seg[1]} />;
    return <NoticeListPage />;
  }
  if (seg[0] === "admissions") return window.RJ_EDU_MODE ? <HomePage /> : <AdmissionsPage />;
  if (seg[0] === "faq") return <FaqPage />;
  if (seg[0] === "terms") return <TermsPage />;
  if (seg[0] === "privacy") return <PrivacyPage />;
  if (seg[0] === "refund") return <RefundPage />;
  if (seg[0] === "player") return <PlayerPage courseId={seg[1]} />;
  if (seg[0] === "community") return <CommunityPage />;
  if (seg[0] === "login") return <LoginPage />;
  if (seg[0] === "signup") return <SignupPage />;
  if (seg[0] === "mypage") return <MyPage />;
  if (seg[0] === "cart") return <CartPage />;
  if (seg[0] === "checkout") return <CheckoutPage />;
  return <HomePage />;
}

function Shell() {
  const { route } = useApp();
  const path = route.path;
  // Player has its own dark chrome — keep header but hide footer
  const isPlayer = path.startsWith("/player");
  const isLiveEntry = path.startsWith("/live/") && route.path.split("/").length > 2;
  const isWebLive = path.startsWith("/weblive");
  const isTeacher = path.startsWith("/teacher");
  const isAdminPg = path.startsWith("/admin");
  const noFooter = isPlayer || isLiveEntry || isWebLive || isTeacher || isAdminPg || path.startsWith("/login") || path.startsWith("/signup");
  return (
    <>
      <SiteHeader />
      <main>
        <Router />
      </main>
      {!noFooter && <SiteFooter />}
    </>
  );
}

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [, forceBoot] = React.useState(0);

  React.useEffect(() => { applyTweaks(tweaks); }, [tweaks]);

  // 부팅 시 클라우드(Supabase) 동기화 — 강좌/강사 카탈로그 + 본인 학생 명부 행
  //   (미연결 시 no-op → 기존 로컬 동작 유지)
  React.useEffect(() => {
    let alive = true;
    if (window.rjSyncCoursesFromCloud) {
      window.rjSyncCoursesFromCloud().then((r) => { if (alive && r && r.changed) forceBoot((n) => n + 1); }).catch(() => {});
    }
    if (window.rjSyncStudentsFromCloud) window.rjSyncStudentsFromCloud().catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <AppProvider initialTweaks={tweaks}>
      <Shell />
      <TweaksPanel title="Tweaks · 디자인 옵션">
        <TweakSection label="홈 디자인 스타일" />
        <TweakRadio
          label="홈페이지 톤"
          value={tweaks.homeStyle || "editorial"}
          options={["academy", "editorial"]}
          onChange={(v) => setTweak("homeStyle", v)}
        />
        <div style={{ fontSize: 10.5, color: "rgba(41,38,27,0.55)", marginTop: -4, lineHeight: 1.4 }}>
          academy — 메가스터디·이투스 톤 (빨강·네이비, 강사 빌보드, 합격 실적) / editorial — 잡지 톤 (크림·잉크, 명조)
        </div>

        <TweakSection label="Hero 레이아웃 (editorial 전용)" />
        <TweakRadio
          label="홈 히어로"
          value={tweaks.heroLayout}
          options={["split", "stack", "marquee"]}
          onChange={(v) => setTweak("heroLayout", v)}
        />
        <div style={{ fontSize: 10.5, color: "rgba(41,38,27,0.55)", marginTop: -4, lineHeight: 1.4 }}>
          split — 좌측 헤드라인 + 우측 카드 / stack — 중앙 정렬 에디토리얼 / marquee — 다크 배경 + 강의 마퀴
        </div>

        <TweakSection label="라이브 강의실 레이아웃" />
        <TweakRadio
          label="라이브 화면"
          value={tweaks.liveLayout || "split"}
          options={["split", "stacked"]}
          onChange={(v) => setTweak("liveLayout", v)}
        />
        <div style={{ fontSize: 10.5, color: "rgba(41,38,27,0.55)", marginTop: -4, lineHeight: 1.4 }}>
          split — 좌측 수업 화면 + 우측 채팅/Q&A / stacked — 위에 수업 화면 + 아래 채팅·Q&A 나란히
        </div>

        <TweakSection label="포인트 컬러" />
        <TweakColor
          label="액센트"
          value={tweaks.accent}
          options={Object.keys(ACCENT_PALETTES)}
          onChange={(v) => setTweak("accent", v)}
        />
        <div style={{ display: "grid", gap: 4, marginTop: -2 }}>
          {Object.entries(ACCENT_PALETTES).map(([k, v]) => (
            <button key={k} onClick={() => setTweak("accent", k)} style={{
              display: "flex", alignItems: "center", gap: 8, padding: "6px 8px",
              borderRadius: 6, border: "1px solid",
              borderColor: tweaks.accent === k ? "rgba(0,0,0,0.4)" : "transparent",
              background: tweaks.accent === k ? "rgba(0,0,0,0.05)" : "transparent",
              cursor: "pointer", fontSize: 11.5, textAlign: "left",
            }}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", background: v.accent, border: "1px solid rgba(0,0,0,0.12)" }} />
              <span style={{ flex: 1 }}>{v.label}</span>
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: "rgba(41,38,27,0.5)" }}>{v.accent}</span>
            </button>
          ))}
        </div>

        <TweakSection label="페이지 빠른 이동" />
        <div style={{ display: "grid", gap: 4 }}>
          {[
            ["/",                  "홈 (메인)"],
            ["/about",             "소개 · 비전·설립목적·운영"],
            ["/subscribe",         "구독 · 프리패스"],
            ["/courses",           "강의 목록"],
            ["/courses/math-calc-2026", "강의 상세 — 미적분"],
            ["/instructors",       "강사진"],
            ["/curriculum",        "커리큘럼 · 연 3학기"],
            ["/notice",            "공지사항 · 게시판"],
            ["/admissions",        "입시정보 · 점수로 증명"],
            ["/faq",               "FAQ"],
            ["/login",             "로그인"],
            ["/signup",            "회원가입"],
            ["/cart",              "장바구니"],
            ["/checkout",          "결제 (3단계)"],
            ["/mypage",            "마이페이지"],
            ["/live",              "라이브 시간표"],
            ["/live/math-calc-2026?join=1", "라이브 강의실 바로 →"],
            ["/mypage",            "학습 대시보드 (클래스인 연동)"],
            ["/weblive",           "웹라이브 공개방송"],
            ["/admin",             "관리자 콘솔"],
          ].map(([p, label]) => (
            <button key={p} onClick={() => { window.location.hash = "#" + p; }} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "6px 10px", borderRadius: 6, border: "1px solid rgba(0,0,0,0.08)",
              background: "transparent", cursor: "pointer", fontSize: 11.5, textAlign: "left",
            }}>
              <span>{label}</span>
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: "rgba(41,38,27,0.45)" }}>#{p}</span>
            </button>
          ))}
        </div>
      </TweaksPanel>
    </AppProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
