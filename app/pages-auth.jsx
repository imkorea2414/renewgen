/* global React, ACCOUNT, useApp, Icon */

const { useState: useStateA } = React;

// Supabase Auth가 돌려주는 원문(영문/기술 용어)을 사용자 친화적 한국어로 바꾼다.
// 원문은 콘솔에만 남기고(디버깅용), 화면에는 아래 매핑된 문구만 노출한다.
// 알 수 없는 원문은 뭉개지 않고 "로그인/가입에 실패했습니다" 같은 상황+행동 안내로 대체한다.
function authFriendlyErrorMessage(raw, kind) {
  const s = String(raw || "");
  if (!s) return kind === "signup" ? "가입에 실패했습니다. 잠시 후 다시 시도해 주세요." : "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.";
  if (/invalid login credentials/i.test(s)) return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (/email not confirmed/i.test(s)) return "이메일 인증이 필요합니다. 받으신 확인 메일을 먼저 확인해 주세요.";
  if (/already registered|already exists|user already/i.test(s)) return "이미 가입된 이메일입니다.";
  if (/password should be at least|password.*character/i.test(s)) return "비밀번호는 8자 이상으로 입력해 주세요.";
  if (/unable to validate email|invalid email/i.test(s)) return "이메일 형식을 확인해 주세요.";
  if (/rate limit|too many requests/i.test(s)) return "잠시 후 다시 시도해 주세요.";
  if (/failed to fetch|network|timeout/i.test(s)) return "일시적으로 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요.";
  return kind === "signup" ? "가입에 실패했습니다. 잠시 후 다시 시도해 주세요." : "로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.";
}
window.authFriendlyErrorMessage = authFriendlyErrorMessage;

function LoginPage() {
  const { navigate, login, signIn, showToast } = useApp();
  const [email, setEmail] = useStateA("");
  const [password, setPassword] = useStateA("");
  const [busy, setBusy] = useStateA(false);

  const google = async () => {
    if (!window.SUPABASE_ENABLED) { showToast("잠시 후 다시 시도해 주세요."); return; }
    const r = await window.signInWithGoogle();
    if (!r.ok) { console.warn("[Auth] Google 로그인 실패:", r.error); showToast(authFriendlyErrorMessage(r.error, "login")); }
  };

  const submit = async (e) => {
    e?.preventDefault();
    if (!email || !password) { showToast("이메일과 비밀번호를 입력해주세요"); return; }
    setBusy(true);
    const res = await signIn(email, password);
    setBusy(false);
    if (!res.ok) { console.warn("[Auth] 로그인 실패:", res.error); showToast(authFriendlyErrorMessage(res.error, "login")); return; }
    // 클래스인 미연결 사용자라면 이참에 연결 (한 번만 시도 후 캐시)
    try { if (window.classinSyncSelf) window.classinSyncSelf({}); } catch (e) {}
    let dest = "/mypage";
    if (window.isAdmin && window.isAdmin({ email })) dest = "/admin";
    else if (window.isStaff && window.isStaff({ email })) dest = "/teacher";
    else if (window.fetchProfileRoleByEmail) {
      const role = await window.fetchProfileRoleByEmail(email);
      if (role === "admin") dest = "/admin"; else if (role === "teacher") dest = "/teacher";
    }
    // 결제하다가 로그인하러 온 경우 → 결제 페이지로 복귀
    try {
      const back = sessionStorage.getItem("rj-after-login");
      if (back) {
        sessionStorage.removeItem("rj-after-login");
        window.location.hash = back;
        return;
      }
    } catch (e) {}
    navigate(dest);
  };

  return (
    <div className="page-enter">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", minHeight: "calc(100vh - 72px)" }}>
        {/* Left — editorial pane */}
        <div style={{ background: "var(--rj-ink)", color: "var(--rj-paper)", padding: "64px 56px", position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <button onClick={() => navigate("/")} className="brand-wordmark brand-wordmark--logo" style={{ background: "transparent", border: 0, padding: 0, cursor: "pointer" }}>
              <img src="assets/logo-full.png" alt="리뉴젠 아카데미 · Re:newgen Academy" className="brand-logo-full brand-logo-full--lg" />
            </button>
            <div style={{ marginTop: 80, maxWidth: 460 }}>
              <div className="eyebrow" style={{ color: "rgba(245,241,233,0.5)" }}>Welcome Back</div>
              <h1 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 64, letterSpacing: "-0.03em", lineHeight: 1.05, margin: "20px 0 0" }}>
                다시 오신 걸<br /><span style={{ fontFamily: "var(--font-en)", fontStyle: "italic", fontWeight: 300 }}>welcome.</span>
              </h1>
              <p className="body-lg" style={{ color: "rgba(245,241,233,0.7)", marginTop: 24, maxWidth: 380 }}>
                지난 주에 멈췄던 강의가 마이페이지에서 기다리고 있습니다.
              </p>
            </div>
          </div>
          <div className="card" style={{ background: "transparent", border: "1px solid rgba(245,241,233,0.18)", color: "var(--rj-paper)", padding: 24 }}>
            <div className="label-cap" style={{ color: "rgba(245,241,233,0.5)" }}>회원 로그인</div>
            <p style={{ marginTop: 10, color: "rgba(245,241,233,0.7)", fontSize: 13, marginBottom: 0, lineHeight: 1.6 }}>
              실제 계정으로 로그인됩니다. 계정이 없으시면 먼저 <a href="#/signup" style={{ color: "var(--rj-accent)" }}>회원가입</a> 해주세요.
            </p>
          </div>
        </div>

        {/* Right — form */}
        <div style={{ padding: "64px 56px", display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: 560, margin: "0 auto", width: "100%" }}>
          <h2 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 36, letterSpacing: "-0.025em", margin: 0 }}>로그인</h2>
          <p style={{ color: "var(--rj-muted)", marginTop: 8 }}>이메일로 로그인하거나 소셜 계정을 사용하세요.</p>

          <form onSubmit={submit} style={{ marginTop: 36, display: "grid", gap: 18 }}>
            <div className="field">
              <label>Email · 이메일</label>
              <input className="input input-lg" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="field">
              <label>Password · 비밀번호</label>
              <input className="input input-lg" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--rj-muted)" }}>
                <input type="checkbox" /> 자동 로그인
              </label>
              <a href="#/" onClick={(e) => e.preventDefault()} style={{ textDecoration: "underline", color: "var(--rj-muted)" }}>비밀번호를 잊으셨나요?</a>
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
              {busy ? "로그인 중…" : "로그인"}
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "28px 0" }}>
            <div className="hairline-soft" style={{ flex: 1 }} />
            <span className="label-cap" style={{ color: "var(--rj-muted)" }}>OR · 또는</span>
            <div className="hairline-soft" style={{ flex: 1 }} />
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <button className="btn btn-lg" style={{ background: "#fff", color: "#1f1f1f", border: "1px solid #dadce0" }} onClick={google}>
              <GoogleMark /> Google로 시작하기
            </button>
          </div>

          <p style={{ marginTop: 32, fontSize: 14, color: "var(--rj-muted)", textAlign: "center" }}>
            계정이 없으신가요? <a href="#/signup" onClick={(e) => { e.preventDefault(); navigate("/signup"); }} style={{ textDecoration: "underline", color: "var(--rj-ink)" }}>회원가입</a>
          </p>
        </div>
      </div>
    </div>
  );
}

const KakaoMark = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.48 3 2 6.58 2 11c0 2.79 1.78 5.22 4.45 6.66L5.5 21l3.71-2.42c.9.15 1.83.23 2.79.23 5.52 0 10-3.58 10-8s-4.48-7.81-10-7.81Z" /></svg>
);
const NaverMark = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M5 4h4l6 8V4h4v16h-4l-6-8v8H5V4Z" /></svg>
);
const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/></svg>
);

// ──────────────────────────────────────────────────────────────────
// Signup
// ──────────────────────────────────────────────────────────────────
function SignupPage() {
  const { navigate, login, signUp, showToast } = useApp();
  const [step, setStep] = useStateA(1);
  const [busy, setBusy] = useStateA(false);
  const [data, setData] = useStateA({ email: "", password: "", name: "", phone: "", age: "", role: "student", grade: "고2", subject: "math", teachGrade: "고등", school: "", agree: { service: false, privacy: false, marketing: false } });
  const update = (k, v) => setData((d) => ({ ...d, [k]: v }));
  const allAgree = data.agree.service && data.agree.privacy;
  const isTeacher = data.role === "teacher";

  const google = async () => {
    if (!window.SUPABASE_ENABLED) { showToast("잠시 후 다시 시도해 주세요."); return; }
    const r = await window.signInWithGoogle();
    if (!r.ok) { console.warn("[Auth] Google 가입 실패:", r.error); showToast(authFriendlyErrorMessage(r.error, "signup")); }
  };

  const next = () => {
    if (step === 1) {
      if (!data.email || !data.password || !allAgree) { showToast("필수 항목을 입력해주세요"); return; }
    }
    if (step === 2) {
      if (!data.name) { showToast("이름을 입력해주세요"); return; }
      if (!data.age) { showToast("나이(만)를 입력해주세요"); return; }
      if (!isTeacher && !data.school) { showToast("학교를 입력해주세요"); return; }
    }
    setStep((s) => s + 1);
  };

  const finish = async () => {
    if (!data.name) { showToast("이름을 입력해주세요"); return; }
    if (!data.age) { showToast("나이(만)를 입력해주세요"); return; }
    if (!isTeacher && !data.school) { showToast("학교를 입력해주세요"); return; }
    setBusy(true);
    const res = await signUp({
      email: data.email, password: data.password, name: data.name,
      age: data.age, phone: data.phone, role: data.role,
      grade: isTeacher ? data.teachGrade : data.grade,
      school: isTeacher ? "" : data.school,
      subject: data.subject,
    });
    setBusy(false);
    if (!res.ok) {
      console.warn("[Auth] 회원가입 실패:", res.error);
      showToast(authFriendlyErrorMessage(res.error, "signup"));
      return;
    }
    if (res.needsConfirm) {
      showToast("확인 이메일을 보냈습니다. 메일 인증 후 로그인해주세요");
      navigate("/login");
      return;
    }
    // 결제하다가 가입하러 온 경우 → 결제 페이지로 복귀
    try {
      const back = sessionStorage.getItem("rj-after-login");
      if (back) {
        sessionStorage.removeItem("rj-after-login");
        window.location.hash = back;
        return;
      }
    } catch (e) {}
    navigate(window.isStaff && window.isStaff({ email: data.email }) ? "/admin" : "/mypage");
  };

  return (
    <div className="page-enter container" style={{ paddingTop: 56, paddingBottom: 96, maxWidth: 560 }}>
      <button className="btn-link" onClick={() => navigate("/")} style={{ color: "var(--rj-muted)", fontSize: 13, textDecoration: "none" }}><Icon name="arrowLeft" size={14} /> 처음으로</button>

      <div className="eyebrow" style={{ color: "var(--rj-muted)", marginTop: 28 }}>Create Account · 회원가입</div>
      <h1 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 48, letterSpacing: "-0.03em", margin: "16px 0 0" }}>리뉴젠과 함께 시작하기</h1>

      {/* Steps */}
      <div style={{ display: "flex", gap: 4, marginTop: 36 }}>
        {[1, 2].map((n) => (
          <div key={n} style={{ flex: 1, height: 3, background: step >= n ? "var(--rj-ink)" : "var(--rj-faint)", borderRadius: 2 }} />
        ))}
      </div>
      <div className="label-cap" style={{ color: "var(--rj-muted)", marginTop: 12 }}>
        STEP {step} / 2 — {["계정 만들기", isTeacher ? "선생님 정보" : "프로필 입력"][step - 1]}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div style={{ marginTop: 32, display: "grid", gap: 18 }}>
          <button className="btn btn-lg" style={{ background: "#fff", color: "#1f1f1f", border: "1px solid #dadce0" }} onClick={google}>
            <GoogleMark /> Google로 간편 가입
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 14, color: "var(--rj-muted)", fontSize: 13 }}>
            <div className="hairline-soft" style={{ flex: 1 }} /> 또는 이메일로 가입 <div className="hairline-soft" style={{ flex: 1 }} />
          </div>
          <div className="field"><label>Email · 이메일</label><input className="input input-lg" type="email" value={data.email} onChange={(e) => update("email", e.target.value)} placeholder="you@example.com" /></div>
          <div className="field"><label>Password · 비밀번호 (8자 이상)</label><input className="input input-lg" type="password" value={data.password} onChange={(e) => update("password", e.target.value)} /></div>

          <div style={{ marginTop: 12, padding: 20, background: "var(--rj-paper-2)", borderRadius: "var(--rj-r-sm)" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600, fontSize: 14 }}>
              <input type="checkbox" checked={allAgree && data.agree.marketing} onChange={(e) => setData((d) => ({ ...d, agree: { service: e.target.checked, privacy: e.target.checked, marketing: e.target.checked } }))} />
              전체 동의
            </label>
            <div style={{ height: 1, background: "var(--rj-faint)", margin: "14px 0" }} />
            {[
              ["service", "이용약관 동의", true],
              ["privacy", "개인정보 수집·이용 동의", true],
              ["marketing", "마케팅 정보 수신 동의", false],
            ].map(([k, label, req]) => (
              <label key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", fontSize: 13 }}>
                <input type="checkbox" checked={data.agree[k]} onChange={(e) => setData((d) => ({ ...d, agree: { ...d.agree, [k]: e.target.checked } }))} />
                <span>[{req ? "필수" : "선택"}] {label}</span>
                <a href="#/" onClick={(e) => e.preventDefault()} style={{ marginLeft: "auto", color: "var(--rj-muted)", fontSize: 12, textDecoration: "underline" }}>보기</a>
              </label>
            ))}
          </div>
          <button className="btn btn-primary btn-lg btn-block" onClick={next}>다음 <Icon name="arrow" size={14} /></button>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div style={{ marginTop: 32, display: "grid", gap: 18 }}>
          {/* 역할 선택 */}
          <div className="field">
            <label>가입 유형</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[["student", "학생", "수업을 듣는 회원"], ["teacher", "선생님", "강의·학생 관리"]].map(([k, ko, desc]) => (
                <button key={k} type="button" onClick={() => update("role", k)} style={{
                  padding: "14px 16px", borderRadius: "var(--rj-r-sm)", border: "1.5px solid",
                  borderColor: data.role === k ? "var(--rj-ink)" : "var(--rj-faint)",
                  background: data.role === k ? "var(--rj-ink)" : "transparent",
                  color: data.role === k ? "var(--rj-paper)" : "var(--rj-ink)",
                  textAlign: "left", cursor: "pointer",
                }}>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>{ko}</div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="field"><label>이름</label><input className="input input-lg" value={data.name} onChange={(e) => update("name", e.target.value)} placeholder={isTeacher ? "김지원" : "한도윤"} /></div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="field"><label>나이 <span style={{ color: "var(--rj-muted)", fontWeight: 400 }}>· 만</span></label><input className="input input-lg" value={data.age} onChange={(e) => update("age", e.target.value.replace(/[^0-9]/g, ""))} placeholder="17" inputMode="numeric" maxLength={2} /></div>
            <div className="field">
              <label>휴대폰</label>
              <input className="input input-lg" value={data.phone} onChange={(e) => update("phone", e.target.value)} placeholder="010-0000-0000" inputMode="tel" />
            </div>
          </div>

          {isTeacher ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="field">
                <label>담당 과목</label>
                <select className="input input-lg" value={data.subject} onChange={(e) => update("subject", e.target.value)}>
                  {window.SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.ko || s.id}</option>)}
                </select>
              </div>
              <div className="field">
                <label>담당 학년</label>
                <select className="input input-lg" value={data.teachGrade} onChange={(e) => update("teachGrade", e.target.value)}>
                  {["중등", "고등", "중·고등 전체", "N수·재수"].map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div className="field">
                <label>학년</label>
                <select className="input input-lg" value={data.grade} onChange={(e) => update("grade", e.target.value)}>
                  {["중2", "중3", "고1", "고2", "고3", "N수생"].map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="field"><label>학교</label><input className="input input-lg" value={data.school} onChange={(e) => update("school", e.target.value)} placeholder="리뉴젠고등학교" /></div>
            </div>
          )}

          {isTeacher && (
            <p style={{ fontSize: 12.5, color: "var(--rj-muted)", margin: 0, lineHeight: 1.6, padding: "12px 14px", background: "var(--rj-paper-2)", borderRadius: "var(--rj-r-sm)" }}>
              선생님 계정은 가입 후 <strong>관리자 승인</strong>을 거쳐 강의·학생 관리 권한이 활성화됩니다.
            </p>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button className="btn btn-ghost btn-lg" onClick={() => setStep(1)}><Icon name="arrowLeft" size={14} /> 이전</button>
            <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={finish} disabled={busy}>{busy ? "가입 중…" : <>가입 완료 <Icon name="arrow" size={14} /></>}</button>
          </div>
        </div>
      )}
    </div>
  );
}

window.LoginPage = LoginPage;
window.SignupPage = SignupPage;
