/* global React, useApp, Icon */
// v2 실시간 수업 (BigBlueButton) — window.RJ_LIVE_ENGINE === "bbb" 일 때만 사용
// 강의실 목록·개설(강사)·입장(학생)·종료. BBB 화상은 사이트 내 iframe 으로 임베드.

async function bbbCall(qs) {
  const base = (window.SUPABASE_URL || "") + "/functions/v1/bbb-room";
  let bearer = window.SUPABASE_ANON_KEY || "";
  try {
    const sb = window.getSupabase && window.getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (session && session.access_token) bearer = session.access_token;
  } catch (e) {}
  try {
    const res = await fetch(base + qs, { headers: { Authorization: "Bearer " + bearer, apikey: window.SUPABASE_ANON_KEY || "" } });
    return await res.json();
  } catch (e) {
    console.warn("[BBB] 요청 실패:", e); // 디버깅용, 화면에는 노출 안 함
    return { ok: false, msg: "일시적으로 연결이 원활하지 않습니다. 잠시 후 다시 시도해 주세요." };
  }
}

function BBBLivePage() {
  const { user, navigate } = useApp();
  const [rooms, setRooms] = React.useState(null);
  const [joinUrl, setJoinUrl] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState("");
  const isStaff = !!(window.isStaff && window.isStaff(user));

  const load = React.useCallback(() => {
    bbbCall("?action=list").then((r) => {
      setRooms(r.ok ? r.rooms : []);
      if (!r.ok) { console.warn("[BBB] 강의실 목록 조회 실패:", r.msg); setErr("강의실 목록을 불러오지 못했습니다."); }
    });
  }, []);
  React.useEffect(() => { if (user) load(); }, [user, load]);

  if (!user) {
    return (
      <div className="ci-scope container" style={{ padding: "100px 0", textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: "var(--ci-navy)", color: "var(--ci-yellow)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon name="signal" size={24} /></div>
        <h2 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 28, margin: "20px 0 8px" }}>실시간 수업 (v2 · BBB)</h2>
        <p style={{ color: "var(--rj-muted)", marginBottom: 22 }}>로그인 후 실시간 강의실에 입장할 수 있습니다.</p>
        <button className="btn btn-primary btn-lg" onClick={() => navigate("/login")}>로그인</button>
      </div>
    );
  }

  // 강의실에 들어가면 BBB 를 iframe 으로 임베드
  if (joinUrl) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 50, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 14px", background: "#0A1626", color: "#fff" }}>
          <strong style={{ fontSize: 14 }}>리뉴젠 실시간 수업</strong>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>BigBlueButton · v2</span>
          <button className="ci-act sm" style={{ marginLeft: "auto" }} onClick={() => { setJoinUrl(null); load(); }}><Icon name="close" size={12} /> 나가기</button>
        </div>
        <iframe title="BBB 실시간 수업" src={joinUrl} allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
          style={{ flex: 1, width: "100%", border: 0 }} />
      </div>
    );
  }

  // BBB 는 새 탭으로 연다(임베드 iframe 은 서드파티 쿠키 차단으로 세션 401 발생).
  //   자체 BBB 서버를 SameSite=None·X-Frame 허용으로 세팅하면 iframe 임베드도 가능.
  const openRoom = (url) => {
    const w = window.open(url, "_blank", "noopener");
    if (!w) { setErr("팝업이 차단되었습니다. 브라우저에서 팝업을 허용한 뒤 다시 시도하세요."); }
  };
  const create = async () => {
    const name = window.prompt("강의실 이름을 입력하세요", (user.name || "") + " 실시간 수업");
    if (!name) return;
    setBusy(true); setErr("");
    const r = await bbbCall("?action=create&name=" + encodeURIComponent(name));
    setBusy(false);
    if (r.ok) { openRoom(r.joinUrl); load(); } else { console.warn("[BBB] 강의실 개설 실패:", r.msg); setErr("강의실을 개설하지 못했습니다. 잠시 후 다시 시도해 주세요."); }
  };
  const join = async (id) => {
    setBusy(true); setErr("");
    const r = await bbbCall("?action=join&id=" + encodeURIComponent(id));
    setBusy(false);
    if (r.ok) openRoom(r.joinUrl); else { console.warn("[BBB] 강의실 입장 실패:", r.msg); setErr("실시간 수업에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요."); }
  };
  const end = async (id) => {
    if (!window.confirm("이 강의실을 종료할까요?")) return;
    setBusy(true);
    await bbbCall("?action=end&id=" + encodeURIComponent(id));
    setBusy(false); load();
  };

  return (
    <div className="ci-scope" style={{ background: "var(--ci-bg)", minHeight: "100vh" }}>
      <div style={{ background: "var(--ci-navy)", color: "#fff" }}>
        <div className="container-wide" style={{ paddingTop: 26, paddingBottom: 26, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--ci-yellow)", letterSpacing: "0.04em" }}>실시간 수업 · BigBlueButton (v2)</div>
            <h1 style={{ margin: "4px 0 0", fontWeight: 900, fontSize: 26, letterSpacing: "-0.03em" }}>실시간 강의실</h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="ci-act" style={{ height: 40 }} onClick={load}><Icon name="refresh" size={14} /> 새로고침</button>
            {isStaff && <button className="ci-act" style={{ height: 40, background: "var(--ci-yellow)", color: "var(--ci-navy)", border: 0, fontWeight: 800 }} disabled={busy} onClick={create}><Icon name="plus" size={14} /> 강의실 개설</button>}
          </div>
        </div>
      </div>

      <div className="container-wide" style={{ paddingTop: 24, paddingBottom: 80 }}>
        {err && <div style={{ background: "rgba(192,57,43,0.08)", color: "#C0392B", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13.5 }}>{err}</div>}
        {rooms == null ? (
          <div className="ci-card ci-card-pad" style={{ textAlign: "center", color: "var(--ci-muted)" }}><Icon name="refresh" size={18} /> 불러오는 중…</div>
        ) : rooms.length === 0 ? (
          <div className="ci-card ci-card-pad" style={{ textAlign: "center", padding: "56px 24px", color: "var(--ci-muted)" }}>
            <Icon name="signal" size={28} />
            <div style={{ fontWeight: 800, color: "var(--ci-ink)", marginTop: 12, fontSize: 15 }}>지금 열려있는 실시간 강의실이 없습니다</div>
            <p style={{ fontSize: 13.5, marginTop: 8 }}>{isStaff ? "우측 상단 ‘강의실 개설’로 실시간 수업을 시작하세요." : "선생님이 강의실을 열면 여기에 표시됩니다."}</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
            {rooms.map((r) => (
              <div key={r.id} className="ci-card ci-card-pad">
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span className="ci-badge bad" style={{ fontSize: 10 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block", marginRight: 4 }} />LIVE</span>
                  <strong style={{ fontWeight: 800, fontSize: 15.5 }}>{r.name}</strong>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ci-muted)", marginBottom: 14 }}>진행 {r.created_name || "강사"}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="ci-act navy" style={{ flex: 1, justifyContent: "center" }} disabled={busy} onClick={() => join(r.id)}><Icon name="signal" size={13} /> 입장</button>
                  {isStaff && <button className="ci-act" disabled={busy} onClick={() => end(r.id)}><Icon name="close" size={12} /> 종료</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
window.BBBLivePage = BBBLivePage;
