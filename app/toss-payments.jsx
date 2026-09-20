/* global React */
// ══════════════════════════════════════════════════════════════════
//  토스페이먼츠(TossPayments) 결제 연동 — 결제위젯 v2 · 테스트 모드
//  ──────────────────────────────────────────────────────────────────
//  흐름:
//   1) <TossPayPanel> 이 결제수단·약관 위젯을 렌더 → '결제하기' 클릭
//   2) widgets.requestPayment() → 토스 결제창 → successUrl/failUrl 로 복귀
//   3) 복귀 시 쿼리(paymentKey·orderId·amount)를 sessionStorage 로 옮기고
//      해시를 #/checkout 으로 정규화 (normalizeTossRedirect)
//   4) CheckoutPage 가 이를 읽어 confirmTossPayment() 로 서버 승인
//      · 백엔드(TOSS_CONFIRM_API) 가 있으면 서버가 시크릿키로 승인
//      · 없으면(데모) 승인된 것으로 간주하고 접근권을 부여
//
//  키 교체(실결제 전환):
//   · 아래 TOSS_CLIENT_KEY 를 내 상점 '결제위젯 연동 키'(test_gck_…/live_gck_…)로
//   · 서버(classin-backend/api/toss-confirm.php)의 시크릿키(gsk)도 같은 세트로
//   · window.TOSS_CONFIRM_API 를 배포된 승인 엔드포인트 URL 로 설정
// ══════════════════════════════════════════════════════════════════

// 토스 결제위젯 클라이언트 키 — 리뉴젠 아카데미 상점
// ⚠️  '결제위젯 연동 키'(gck/gsk 형식)를 써야 합니다. 'API 개별 연동 키'(ck/sk)는 위젯 SDK와 호환되지 않습니다.
//     토스 대시보드 → 개발자센터 → '결제위젯 연동 키' 섹션에서 발급.
//   · 미발급 시: 토스 공식 '문서용 테스트 키'(test_gck_docs_…)를 사용 — 가입 없이 결제 흐름 확인 가능
window.TOSS_CLIENT_KEY = window.TOSS_CLIENT_KEY || "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";
// 서버 승인 엔드포인트 — Supabase Edge Function (toss-confirm)
window.TOSS_CONFIRM_API = window.TOSS_CONFIRM_API ||
  ((window.SUPABASE_URL || "https://vpylrktkscyogwzqtswv.supabase.co") + "/functions/v1/toss-confirm");

// ── SDK 동적 로드 ───────────────────────────────────────────────────
let _tossSdkPromise = null;
function loadTossSdk() {
  if (window.TossPayments) return Promise.resolve(window.TossPayments);
  if (_tossSdkPromise) return _tossSdkPromise;
  _tossSdkPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://js.tosspayments.com/v2/standard";
    s.onload = () => (window.TossPayments ? resolve(window.TossPayments) : reject(new Error("TossPayments 없음")));
    s.onerror = () => reject(new Error("토스 SDK 로드 실패"));
    document.head.appendChild(s);
  });
  return _tossSdkPromise;
}
window.loadTossSdk = loadTossSdk;

// ── customerKey (유저별 고유값) ──────────────────────────────────────
function tossCustomerKey(user) {
  const clean = (s) => String(s).replace(/[^A-Za-z0-9\-_=.@]/g, "").slice(0, 50);
  if (user && user.id) return clean("rj_" + user.id);
  try {
    let k = localStorage.getItem("rj-toss-ck");
    if (!k) {
      k = "rj_anon_" + (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now() + "_" + Math.random().toString(36).slice(2));
      localStorage.setItem("rj-toss-ck", k);
    }
    return clean(k);
  } catch (e) { return "rj_anon_" + Date.now(); }
}
window.tossCustomerKey = tossCustomerKey;

// ── 주문번호 생성 (UUID 기반, 유추 불가) ─────────────────────────────
function makeOrderId(prefix) {
  const rnd = (window.crypto && crypto.randomUUID) ? crypto.randomUUID().replace(/-/g, "") : (Date.now().toString(36) + Math.random().toString(36).slice(2)).padEnd(24, "0");
  return (prefix || "RJ") + "_" + rnd.slice(0, 24);
}
window.makeTossOrderId = makeOrderId;

// ── 대기 주문 저장 (리다이렉트 후에도 주문내용 유지) ──────────────────
function savePendingOrder(order) {
  try { localStorage.setItem("rj-toss-pending", JSON.stringify({ ...order, ts: Date.now() })); } catch (e) {}
  // Supabase orders 에도 INSERT (서버 승인 단계에서 금액 위변조 방지)
  (async () => {
    try {
      const sb = window.getSupabase && window.getSupabase();
      if (!sb) return;
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      await sb.from("orders").insert({
        order_id:   order.orderId,
        user_id:    user.id,
        user_email: (order.info && order.info.email) || user.email || null,
        user_name:  (order.info && order.info.name)  || null,
        course_ids: order.itemIds || [],
        amount:     Math.round(Number(order.total) || 0),
        status:     "pending",
      });
    } catch (e) { /* RLS 거절·중복 등은 무시 (Edge Function 폴백) */ }
  })();
}
function readPendingOrder() {
  try { return JSON.parse(localStorage.getItem("rj-toss-pending") || "null"); } catch (e) { return null; }
}
function clearPendingOrder() {
  try { localStorage.removeItem("rj-toss-pending"); } catch (e) {}
}
Object.assign(window, { savePendingOrder, readPendingOrder, clearPendingOrder });

// ── 결제 승인 (서버) ────────────────────────────────────────────────
async function confirmTossPayment({ paymentKey, orderId, amount }) {
  const api = window.TOSS_CONFIRM_API;
  if (!api) {
    // 데모: 서버 없이 테스트 — 토스 인증까지 끝난 결제를 '승인된 것'으로 간주
    return { ok: true, demo: true, payment: { orderId, amount: Number(amount), paymentKey, status: "DONE", method: "테스트결제" } };
  }
  try {
    // Supabase Edge Function 은 anon 키를 Authorization 헤더로 요구합니다
    const headers = { "Content-Type": "application/json" };
    const sb = window.getSupabase && window.getSupabase();
    if (sb && window.SUPABASE_ANON_KEY) headers["Authorization"] = "Bearer " + window.SUPABASE_ANON_KEY;
    const res = await fetch(api, {
      method: "POST",
      headers,
      body: JSON.stringify({ paymentKey, orderId, amount: Number(amount) }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) return { ok: false, error: json.message || json.msg || ("HTTP " + res.status), code: json.code };
    return { ok: true, payment: json.payment || json };
  } catch (e) { return { ok: false, error: String(e) }; }
}
window.confirmTossPayment = confirmTossPayment;

// ── 리다이렉트 정규화 (모듈 로드 즉시 실행) ──────────────────────────
//  토스가 successUrl/failUrl 뒤에 ?paymentKey=…&orderId=…&amount=… 를 붙여
//  되돌려 줍니다. 이를 sessionStorage 로 옮기고 URL 을 #/checkout 으로 정리.
(function normalizeTossRedirect() {
  try {
    const sp = new URLSearchParams(window.location.search || "");
    const paymentKey = sp.get("paymentKey");
    const rjpay = sp.get("rjpay");
    const failCode = sp.get("code");
    if (!paymentKey && rjpay !== "fail" && !failCode) return;
    const payload = paymentKey
      ? { kind: "success", paymentKey, orderId: sp.get("orderId"), amount: sp.get("amount") }
      : { kind: "fail", code: failCode || "PAY_PROCESS_CANCELED", message: sp.get("message") || "결제가 취소되었습니다", orderId: sp.get("orderId") };
    sessionStorage.setItem("rj-toss-redirect", JSON.stringify(payload));
    const clean = window.location.origin + window.location.pathname + "#/checkout";
    window.history.replaceState(null, "", clean);
  } catch (e) {}
})();

function readTossRedirect() {
  try {
    const v = sessionStorage.getItem("rj-toss-redirect");
    return v ? JSON.parse(v) : null;
  } catch (e) { return null; }
}
function clearTossRedirect() {
  try { sessionStorage.removeItem("rj-toss-redirect"); } catch (e) {}
}
Object.assign(window, { readTossRedirect, clearTossRedirect });

// ════════════════════════════════════════════════════════════════════
//  <TossPayPanel> — 결제수단 + 약관 위젯 + 결제하기 버튼
//  props:
//   amount       결제금액(원, 정수)
//   orderId      주문번호 (없으면 자동 생성)
//   orderName    주문명 (예: "미적분 외 1건")
//   customer     { name, email }
//   user         로그인 사용자 (customerKey 용)
//   onBeforePay  () => void  — requestPayment 직전(대기주문 저장 등)
//   buttonLabel  버튼 텍스트
// ════════════════════════════════════════════════════════════════════
function TossPayPanel({ amount, orderId, orderName, customer, user, onBeforePay, buttonLabel, accentInk, accentBg }) {
  const { useState, useEffect, useRef, useMemo } = React;
  const uid = useMemo(() => "toss-" + Math.random().toString(36).slice(2, 9), []);
  const [status, setStatus] = useState("loading"); // loading | ready | requesting | error
  const [err, setErr] = useState("");
  const widgetsRef = useRef(null);
  const oid = useMemo(() => orderId || makeOrderId("RJ"), [orderId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const TossPayments = await loadTossSdk();
        if (!alive) return;
        const tp = TossPayments(window.TOSS_CLIENT_KEY);
        const widgets = tp.widgets({ customerKey: tossCustomerKey(user) });
        widgetsRef.current = widgets;
        await widgets.setAmount({ currency: "KRW", value: Math.round(amount) });
        await Promise.all([
          widgets.renderPaymentMethods({ selector: "#" + uid + "-methods", variantKey: "DEFAULT" }),
          widgets.renderAgreement({ selector: "#" + uid + "-agreement", variantKey: "AGREEMENT" }),
        ]);
        if (!alive) return;
        setStatus("ready");
      } catch (e) {
        if (!alive) return;
        setErr(String((e && e.message) || e));
        setStatus("error");
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 금액 변경 시 위젯에 반영
  useEffect(() => {
    if (widgetsRef.current && status === "ready") {
      widgetsRef.current.setAmount({ currency: "KRW", value: Math.round(amount) }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount]);

  const pay = async () => {
    if (!widgetsRef.current || status === "requesting") return;
    if (onBeforePay) {
      try { onBeforePay({ orderId: oid }); } catch (e) {}
    }
    setStatus("requesting");
    const base = window.location.origin + window.location.pathname;
    try {
      await widgetsRef.current.requestPayment({
        orderId: oid,
        orderName: orderName || "리뉴젠 아카데미 결제",
        successUrl: base + "?rjpay=success",
        failUrl: base + "?rjpay=fail",
        customerEmail: (customer && customer.email) || undefined,
        customerName: (customer && customer.name) || undefined,
      });
      // 성공 시 페이지가 토스로 리다이렉트됩니다(아래는 실행되지 않음).
    } catch (e) {
      // 사용자가 취소(USER_CANCEL)하거나 검증 실패한 경우
      setStatus("ready");
      if (e && e.code && e.code !== "USER_CANCEL" && e.code !== "PAY_PROCESS_CANCELED") {
        setErr((e.message || e.code) + "");
      }
    }
  };

  const inkBg = accentBg || "var(--rj-ink, #001D3D)";
  const inkFg = accentInk || "var(--rj-paper, #fff)";

  // TOSS_CLIENT_KEY 가 "test_"로 시작할 때만 테스트 모드 안내를 보여준다 — 나중에 실제 상점의
  // live_ 키로 전환하면 이 배너는 코드 수정 없이 자동으로 사라진다(결제 핵심 로직과는 무관한 표시 조건).
  const isTestKey = String(window.TOSS_CLIENT_KEY || "").startsWith("test_");

  return (
    <div>
      {/* 테스트 모드 배너 — test 키일 때만 표시 */}
      {isTestKey && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10,
          background: "rgba(43,111,219,0.08)", border: "1px solid rgba(43,111,219,0.25)",
          fontSize: 12.5, color: "#1B4F9C", fontWeight: 600, marginBottom: 16,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2A6FDB", flexShrink: 0 }} />
          토스페이먼츠 테스트 모드 — 실제로 결제·청구되지 않습니다. 테스트 카드로 결제 흐름을 확인하세요.
        </div>
      )}

      {status === "error" ? (
        <div style={{ padding: 24, borderRadius: 12, border: "1px solid var(--rj-faint, #e5e0d6)", textAlign: "center" }}>
          <div style={{ fontWeight: 700, color: "#C0392B", fontSize: 15 }}>결제 모듈을 불러오지 못했습니다</div>
          <div style={{ fontSize: 13, color: "var(--rj-muted, #777)", marginTop: 6 }}>{err}</div>
          <div style={{ fontSize: 12, color: "var(--rj-muted, #999)", marginTop: 10 }}>네트워크 연결을 확인한 뒤 새로고침 해주세요.</div>
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          {status === "loading" && (
            <div style={{ padding: "48px 0", textAlign: "center", color: "var(--rj-muted, #888)", fontSize: 14 }}>
              결제 수단을 불러오는 중…
            </div>
          )}
          {/* 토스 위젯 마운트 지점 */}
          <div id={uid + "-methods"} style={{ display: status === "loading" ? "none" : "block" }} />
          <div id={uid + "-agreement"} style={{ display: status === "loading" ? "none" : "block", marginTop: 8 }} />
        </div>
      )}

      <button
        onClick={pay}
        disabled={status !== "ready"}
        style={{
          width: "100%", marginTop: 18, height: 56, borderRadius: 12, border: 0,
          background: status === "ready" ? inkBg : "var(--rj-faint, #ccc)",
          color: inkFg, fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em",
          cursor: status === "ready" ? "pointer" : "not-allowed",
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8,
          transition: "background 0.15s ease",
        }}
      >
        {status === "requesting" ? "결제창 여는 중…" : (buttonLabel || (window.formatKRW ? window.formatKRW(Math.round(amount)) + " 결제하기" : Math.round(amount).toLocaleString() + "원 결제하기"))}
      </button>
      <div style={{ marginTop: 12, fontSize: 11.5, color: "var(--rj-muted, #999)", textAlign: "center", lineHeight: 1.6 }}>
        토스페이먼츠 안전결제 · 결제 정보는 암호화되어 전송됩니다.
        {isTestKey && (<><br />테스트 카드번호 예: <strong>4330-0000-0000-0005</strong> (유효기간·CVC·비밀번호는 아무 값)</>)}
      </div>
    </div>
  );
}

window.TossPayPanel = TossPayPanel;
