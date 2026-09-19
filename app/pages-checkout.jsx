/* global React, COURSES, useApp, Icon, findCourse, findInstructor, findSubject, formatKRW */

const { useState: useStateK, useMemo: useMemoK, useEffect: useEffectK } = React;

// 결제 성공 시 접근권 부여
//   · 개별 강좌(course) 구매: toss-confirm(Edge Function)이 서버에서 이미 실제 enrollments 를
//     생성했으므로 여기서 프론트가 추가로 할 일이 없다(과거의 demoBuyCourse 데모 우회는 제거됨).
//   · 구독(subscribe): 이번 개별 VOD 구매 작업 범위가 아니므로 기존 demoSubscribe 그대로 유지.
function grantOrderAccess(pending) {
  if (!pending) return;
  if (pending.type === "subscribe") { window.demoSubscribe && window.demoSubscribe(); return; }
}

// ──────────────────────────────────────────────────────────────────
// /cart
// ──────────────────────────────────────────────────────────────────
function CartPage() {
  const { navigate, cart, removeFromCart } = useApp();
  const items = cart.map((c) => findCourse(c.courseId)).filter(Boolean);
  const subtotal = items.reduce((sum, c) => sum + c.salePrice, 0);
  const originalTotal = items.reduce((sum, c) => sum + c.price, 0);
  const bundleDiscount = items.length >= 2 ? Math.round(subtotal * 0.05) : 0;
  const total = subtotal - bundleDiscount;

  return (
    <div className="page-enter container-wide" style={{ paddingTop: 56, paddingBottom: 96 }}>
      <button className="btn-link" onClick={() => navigate("/courses")} style={{ color: "var(--rj-muted)", fontSize: 13, textDecoration: "none" }}><Icon name="arrowLeft" size={14} /> 강의 목록</button>
      <div className="eyebrow" style={{ color: "var(--rj-muted)", marginTop: 28 }}>Cart · 장바구니</div>
      <h1 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 56, letterSpacing: "-0.03em", margin: "12px 0 0" }}>장바구니 <span className="num-en" style={{ color: "var(--rj-muted)", fontWeight: 400 }}>({items.length})</span></h1>

      {items.length === 0 ? (
        <div style={{ marginTop: 56, padding: 96, textAlign: "center", border: "1px dashed var(--rj-faint)", borderRadius: "var(--rj-r)" }}>
          <Icon name="cart" size={48} className="" />
          <h3 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 28, marginTop: 16, letterSpacing: "-0.025em" }}>장바구니가 비어 있습니다</h3>
          <p style={{ color: "var(--rj-muted)", marginTop: 8 }}>관심 있는 강의를 담아보세요.</p>
          <button className="btn btn-primary btn-lg" style={{ marginTop: 24 }} onClick={() => navigate("/courses")}>강의 둘러보기 <Icon name="arrow" size={14} /></button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 40, marginTop: 36 }}>
          <div style={{ display: "grid", gap: 16 }}>
            {items.map((c) => (
              <CartItem key={c.id} course={c} onRemove={() => removeFromCart(c.id)} onOpen={() => navigate("/courses/" + c.id)} />
            ))}
          </div>

          <aside>
            <div className="card" style={{ padding: 28, position: "sticky", top: 100 }}>
              <h3 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 22, letterSpacing: "-0.025em", margin: 0 }}>주문 요약</h3>
              <div style={{ height: 1, background: "var(--rj-faint)", margin: "20px 0" }} />
              <SummaryRow label="원가 합계" value={formatKRW(originalTotal)} muted strike />
              <SummaryRow label="강의 할인" value={"− " + formatKRW(originalTotal - subtotal)} />
              {bundleDiscount > 0 && (
                <SummaryRow label="2강의 이상 추가 5%" value={"− " + formatKRW(bundleDiscount)} accent />
              )}
              <div style={{ height: 1, background: "var(--rj-faint)", margin: "16px 0" }} />
              <SummaryRow label="결제 예정 금액" value={formatKRW(total)} big />
              <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 20 }} onClick={() => navigate("/checkout")}>
                결제하기 <Icon name="arrow" size={14} />
              </button>
              <div style={{ marginTop: 16, fontSize: 12, color: "var(--rj-muted)", textAlign: "center" }}>
                결제 즉시 강의 시청이 가능합니다. 7일 이내 100% 환불 보장.
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function CartItem({ course, onRemove, onOpen }) {
  const ins = findInstructor(course.instructor);
  return (
    <div className="card" style={{ padding: 20, display: "grid", gridTemplateColumns: "120px 1fr auto auto", gap: 24, alignItems: "center" }}>
      <button onClick={onOpen} style={{ background: "transparent", cursor: "pointer", aspectRatio: "4/5" }}>
        <window.CoursePoster course={course} onClick={onOpen} />
      </button>
      <div>
        <div className="eyebrow" style={{ color: "var(--rj-muted)" }}>No. {course.no} · {findSubject(course.subject)?.en}</div>
        <div style={{ fontFamily: "var(--font-kr-serif)", fontSize: 22, letterSpacing: "-0.025em", marginTop: 6 }}>{course.title}</div>
        <div style={{ fontSize: 13, color: "var(--rj-muted)", marginTop: 4 }}>{ins?.name} · {course.lessons}강 · {course.weeks}주</div>
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <span className="tag">{course.format}</span>
          <span className="tag">{course.level}</span>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="num-en" style={{ fontSize: 13, color: "var(--rj-muted)", textDecoration: "line-through" }}>{formatKRW(course.price)}</div>
        <div className="num-en" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>{formatKRW(course.salePrice)}</div>
      </div>
      <button onClick={onRemove} className="icon-btn" aria-label="삭제"><Icon name="close" size={16} /></button>
    </div>
  );
}

function SummaryRow({ label, value, muted, strike, accent, big }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", alignItems: "baseline" }}>
      <span style={{ fontSize: big ? 15 : 13, color: muted ? "var(--rj-muted)" : "var(--rj-ink)", fontWeight: big ? 600 : 400 }}>{label}</span>
      <span className="num-en" style={{
        fontSize: big ? 26 : 14,
        fontWeight: big ? 700 : 500,
        color: accent ? "#1F8A5B" : (muted ? "var(--rj-muted)" : "var(--rj-ink)"),
        textDecoration: strike ? "line-through" : "none",
        letterSpacing: "-0.02em",
      }}>{value}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// /checkout — 3 steps
// ──────────────────────────────────────────────────────────────────
function CheckoutPage() {
  const { navigate, cart, clearCart, user, showToast } = useApp();
  const [step, setStep] = useStateK(1); // 1: 정보, 2: 결제
  const [redir, setRedir] = useStateK(null); // 토스 복귀 처리: {phase:'confirming'|'done'|'fail', ...}
  const items = cart.map((c) => findCourse(c.courseId)).filter(Boolean);

  // 토스 결제 복귀(rd) 중이 아니면 — 미로그인이면 회원가입으로
  useEffectK(() => {
    if (user) return;
    const rd = window.readTossRedirect && window.readTossRedirect();
    if (rd) return; // 결제 승인 도중에는 그대로 (복귀 재로그인 이슈 방지)
    try { sessionStorage.setItem("rj-after-login", "#/checkout"); } catch (e) {}
    if (showToast) showToast("결제하려면 먼저 회원가입/로그인이 필요합니다");
    navigate("/signup");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtotal = items.reduce((s, c) => s + c.salePrice, 0);
  const bundle = items.length >= 2 ? Math.round(subtotal * 0.05) : 0;
  const total = subtotal - bundle;

  const [info, setInfo] = useStateK({
    name:  user?.name  || "",
    email: user?.email || "",
    phone: "",
    parent: "",
    parentPhone: "",
  });

  // 토스 결제창에서 복귀 → 서버 승인 처리
  useEffectK(() => {
    const rd = window.readTossRedirect && window.readTossRedirect();
    if (!rd) return;
    window.clearTossRedirect && window.clearTossRedirect();
    const pending = window.readPendingOrder && window.readPendingOrder();
    if (rd.kind === "fail") { setRedir({ phase: "fail", message: rd.message, code: rd.code, pending }); return; }
    setRedir({ phase: "confirming", pending });
    (async () => {
      const r = await window.confirmTossPayment({ paymentKey: rd.paymentKey, orderId: rd.orderId, amount: rd.amount });
      if (r.ok) {
        grantOrderAccess(pending);
        window.clearPendingOrder && window.clearPendingOrder();
        try { clearCart(); } catch (e) {}
        setRedir({ phase: "done", pending, orderId: rd.orderId, amount: Number(rd.amount) });
      } else {
        setRedir({ phase: "fail", message: r.error || "결제 승인에 실패했습니다", code: r.code, pending });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 대기 주문 저장 (결제창 열기 직전)
  const saveOrder = ({ orderId }) => {
    window.savePendingOrder && window.savePendingOrder({
      type: "courses",
      itemIds: items.map((c) => c.id),
      total, orderId,
      orderName: items.length ? (items[0].title + (items.length > 1 ? " 외 " + (items.length - 1) + "건" : "")) : "강의 결제",
      info: { name: info.name, email: info.email },
    });
  };

  // ── 토스 복귀 화면 (승인 중 / 완료 / 실패) ─────────────────────────────
  if (redir) {
    const pend = redir.pending || {};
    const rItems = (pend.itemIds || []).map((id) => findCourse(id)).filter(Boolean);
    const rInfo = pend.info || info;
    const rTotal = redir.amount || pend.total || total;
    return (
      <div className="page-enter">
        <section style={{ borderBottom: "1px solid var(--rj-faint)" }}>
          <div className="container-wide" style={{ paddingTop: 48, paddingBottom: 32 }}>
            <div className="eyebrow" style={{ color: "var(--rj-muted)" }}>Checkout · 결제</div>
            <h1 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 48, letterSpacing: "-0.03em", margin: "12px 0 0" }}>
              {redir.phase === "confirming" && "결제를 승인하는 중…"}
              {redir.phase === "done" && "주문이 완료되었습니다."}
              {redir.phase === "fail" && "결제가 완료되지 않았습니다."}
            </h1>
          </div>
        </section>
        <section className="container-wide" style={{ paddingTop: 48, paddingBottom: 96 }}>
          {redir.phase === "confirming" && <ConfirmingView />}
          {redir.phase === "done" && (
            pend.type === "subscribe"
              ? <SubscribeSuccess orderId={redir.orderId} total={rTotal} info={rInfo} tier={pend.tier} onGoMyPage={() => navigate("/mypage?tab=recordings")} onGoHome={() => navigate("/")} />
              : <CheckoutSuccess orderId={redir.orderId} items={rItems} total={rTotal} info={rInfo} onGoMyPage={() => navigate("/mypage")} onGoCourses={() => navigate("/courses")} onPlay={(id) => navigate("/player/" + id)} />
          )}
          {redir.phase === "fail" && <CheckoutFail message={redir.message} code={redir.code} onRetry={() => { setRedir(null); navigate("/cart"); }} onHome={() => { setRedir(null); navigate("/"); }} />}
        </section>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container page-enter" style={{ padding: "120px 0", textAlign: "center" }}>
        <h2 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 32 }}>장바구니가 비어 있습니다</h2>
        <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate("/courses")}>강의 둘러보기 <Icon name="arrow" size={14} /></button>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <section style={{ borderBottom: "1px solid var(--rj-faint)" }}>
        <div className="container-wide" style={{ paddingTop: 48, paddingBottom: 32 }}>
          <button className="btn-link" onClick={() => navigate(step === 1 ? "/cart" : "/checkout")} style={{ color: "var(--rj-muted)", fontSize: 13, textDecoration: "none" }}>
            <Icon name="arrowLeft" size={14} /> {step === 1 ? "장바구니" : "이전 단계"}
          </button>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 24 }}>
            <div>
              <div className="eyebrow" style={{ color: "var(--rj-muted)" }}>Checkout · 결제</div>
              <h1 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 48, letterSpacing: "-0.03em", margin: "12px 0 0" }}>
                {step === 1 && "주문 정보 확인"}
                {step === 2 && "결제 수단 선택"}
              </h1>
            </div>
            <StepIndicator step={step} />
          </div>
        </div>
      </section>

      <section className="container-wide" style={{ paddingTop: 48, paddingBottom: 96 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 48 }}>
          <div>
            {step === 1 && <CheckoutStep1 info={info} setInfo={setInfo} items={items} onNext={() => setStep(2)} />}
            {step === 2 && <CheckoutStep2 items={items} total={total} info={info} user={user} onSaveOrder={saveOrder} onBack={() => setStep(1)} />}
          </div>
          <aside>
            <OrderSummary items={items} subtotal={subtotal} bundle={bundle} total={total} step={step} />
          </aside>
        </div>
      </section>
    </div>
  );
}

// 승인 대기 화면
function ConfirmingView() {
  return (
    <div style={{ padding: "80px 0", textAlign: "center" }}>
      <div className="toss-spinner" style={{ width: 44, height: 44, borderRadius: "50%", border: "3px solid var(--rj-faint)", borderTopColor: "var(--rj-ink)", margin: "0 auto", animation: "toss-spin 0.8s linear infinite" }} />
      <p style={{ marginTop: 24, fontSize: 16, color: "var(--rj-ink)", fontWeight: 600 }}>결제를 승인하고 있습니다</p>
      <p style={{ marginTop: 6, fontSize: 13, color: "var(--rj-muted)" }}>잠시만 기다려주세요. 창을 닫지 마세요.</p>
      <style>{"@keyframes toss-spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}

// 결제 실패 화면
function CheckoutFail({ message, code, onRetry, onHome }) {
  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(192,57,43,0.1)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name="close" size={28} />
      </div>
      <h2 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 32, letterSpacing: "-0.025em", marginTop: 20 }}>결제를 완료하지 못했습니다</h2>
      <p className="body-lg" style={{ color: "var(--rj-muted)", marginTop: 12 }}>{message || "결제가 취소되거나 승인되지 않았습니다."}</p>
      {code && <div className="num-en" style={{ marginTop: 8, fontSize: 12, color: "var(--rj-muted)" }}>code: {code}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
        <button className="btn btn-primary btn-lg" onClick={onRetry}>다시 시도 <Icon name="arrow" size={14} /></button>
        <button className="btn btn-ghost btn-lg" onClick={onHome}>홈으로</button>
      </div>
    </div>
  );
}

// 구독 결제 완료 화면
function SubscribeSuccess({ orderId, total, info, tier, onGoMyPage, onGoHome }) {
  return (
    <div style={{ maxWidth: 620 }}>
      <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--rj-accent)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name="check" size={32} strokeWidth={2} />
      </div>
      <h2 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 44, letterSpacing: "-0.03em", marginTop: 24, lineHeight: 1.1 }}>
        {info.name}님, 구독이 시작되었습니다.
      </h2>
      <p className="body-lg" style={{ color: "var(--rj-muted)", marginTop: 16 }}>
        {tier ? tier + " · " : ""}이제 해당 분기 전 강좌와 모든 녹화본을 무제한 시청하실 수 있습니다.
      </p>
      <div className="card" style={{ padding: 24, marginTop: 28 }}>
        <div className="label-cap" style={{ color: "var(--rj-muted)" }}>Order Number · 주문번호</div>
        <div className="num-en" style={{ fontSize: 20, fontWeight: 600, marginTop: 6 }}>{orderId}</div>
        <div style={{ height: 1, background: "var(--rj-faint)", margin: "16px 0" }} />
        <SummaryRow label="결제 금액" value={formatKRW(total)} big />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        <button className="btn btn-primary btn-lg" onClick={onGoMyPage}>녹화본 시청하기 <Icon name="arrow" size={14} /></button>
        <button className="btn btn-ghost btn-lg" onClick={onGoHome}>홈으로</button>
      </div>
    </div>
  );
}

function StepIndicator({ step }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {[
        { n: 1, label: "주문정보" },
        { n: 2, label: "결제" },
        { n: 3, label: "완료" },
      ].map((s, i) => (
        <React.Fragment key={s.n}>
          {i > 0 && <div style={{ width: 32, height: 1, background: step > i ? "var(--rj-ink)" : "var(--rj-faint)" }} />}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 28, height: 28, borderRadius: "50%",
              background: step >= s.n ? "var(--rj-ink)" : "transparent",
              color: step >= s.n ? "var(--rj-paper)" : "var(--rj-muted)",
              border: "1px solid",
              borderColor: step >= s.n ? "var(--rj-ink)" : "var(--rj-faint)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-en)", fontSize: 12, fontWeight: 700,
            }}>{step > s.n ? <Icon name="check" size={12} /> : s.n}</span>
            <span style={{ fontSize: 13, fontWeight: step === s.n ? 600 : 400, color: step >= s.n ? "var(--rj-ink)" : "var(--rj-muted)" }}>{s.label}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

function CheckoutStep1({ info, setInfo, onNext }) {
  return (
    <div>
      <h2 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 26, letterSpacing: "-0.025em", margin: 0 }}>수강자 정보</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
        <div className="field"><label>이름</label><input className="input input-lg" value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} /></div>
        <div className="field"><label>휴대전화</label><input className="input input-lg" value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} /></div>
        <div className="field" style={{ gridColumn: "1 / 3" }}><label>이메일 (영수증 발송)</label><input className="input input-lg" value={info.email} onChange={(e) => setInfo({ ...info, email: e.target.value })} /></div>
      </div>

      <h2 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 26, letterSpacing: "-0.025em", marginTop: 40 }}>보호자 정보 <span style={{ fontSize: 13, color: "var(--rj-muted)" }}>(미성년자 결제 시 필수)</span></h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
        <div className="field"><label>보호자 성함</label><input className="input input-lg" value={info.parent} onChange={(e) => setInfo({ ...info, parent: e.target.value })} /></div>
        <div className="field"><label>보호자 연락처</label><input className="input input-lg" value={info.parentPhone} onChange={(e) => setInfo({ ...info, parentPhone: e.target.value })} /></div>
      </div>

      <div className="card-soft" style={{ padding: 20, marginTop: 40 }}>
        <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 14 }}>
          <input type="checkbox" defaultChecked style={{ marginTop: 4 }} />
          <span>
            <strong>[필수] 환불 정책 및 수강 약관에 동의합니다.</strong><br />
            <span style={{ color: "var(--rj-muted)", fontSize: 13 }}>결제 후 7일 이내, 진도 10% 미만 수강 시 100% 환불됩니다. 자세히 보기 ↗</span>
          </span>
        </label>
      </div>

      <button className="btn btn-primary btn-lg" style={{ marginTop: 32 }} onClick={onNext}>결제 수단 선택 <Icon name="arrow" size={14} /></button>
    </div>
  );
}

function CheckoutStep2({ items, total, info, user, onSaveOrder, onBack }) {
  const orderName = items.length ? (items[0].title + (items.length > 1 ? " 외 " + (items.length - 1) + "건" : "")) : "강의 결제";
  return (
    <div>
      <h2 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 26, letterSpacing: "-0.025em", margin: 0 }}>결제 수단</h2>
      <p style={{ fontSize: 14, color: "var(--rj-muted)", marginTop: 10, lineHeight: 1.6 }}>
        토스페이먼츠 결제창에서 신용·체크카드, 간편결제(토스페이·카카오페이 등), 계좌이체 중 원하는 수단으로 결제하세요.
      </p>
      <div style={{ marginTop: 24 }}>
        <window.TossPayPanel
          amount={total}
          orderName={orderName}
          customer={{ name: info.name, email: info.email }}
          user={user}
          onBeforePay={onSaveOrder}
          buttonLabel={(window.formatKRW ? window.formatKRW(total) : total.toLocaleString() + "원") + " 결제하기"}
        />
      </div>
      <button className="btn btn-ghost btn-lg" style={{ marginTop: 20 }} onClick={onBack}><Icon name="arrowLeft" size={14} /> 이전 단계</button>
    </div>
  );
}

function CardVisual({ cardNo, holder, expiry }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #0A0A0A 0%, #2A2A2A 100%)",
      color: "var(--rj-paper)",
      borderRadius: 16,
      padding: 28,
      aspectRatio: "1.6 / 1",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "var(--rj-accent)", opacity: 0.18 }} />
      <div style={{ position: "absolute", bottom: -60, right: -20, width: 220, height: 220, borderRadius: "50%", background: "var(--rj-accent)", opacity: 0.1 }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="brand-wordmark" style={{ color: "var(--rj-paper)", fontSize: 18, alignItems: "center" }}>
          <img src="assets/logo-mark.png" alt="" className="brand-logo-mark brand-logo-mark--sm" style={{ height: 22 }} />
          리뉴젠
        </div>
        <div style={{ width: 36, height: 24, background: "linear-gradient(135deg, #d4af37, #f5e6a8 60%, #d4af37)", borderRadius: 4 }} />
      </div>
      <div className="num-en" style={{ fontSize: 20, letterSpacing: "0.2em", marginTop: 8 }}>{cardNo}</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "var(--font-en)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
        <div>
          <div style={{ opacity: 0.6 }}>Cardholder</div>
          <div style={{ marginTop: 2 }}>{holder}</div>
        </div>
        <div>
          <div style={{ opacity: 0.6 }}>Valid Thru</div>
          <div style={{ marginTop: 2 }}>{expiry}</div>
        </div>
      </div>
    </div>
  );
}

function OrderSummary({ items, subtotal, bundle, total }) {
  return (
    <div className="card" style={{ padding: 24, position: "sticky", top: 100 }}>
      <h3 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 20, letterSpacing: "-0.025em", margin: 0 }}>주문 요약</h3>
      <div style={{ display: "grid", gap: 12, marginTop: 18, marginBottom: 18 }}>
        {items.map((c) => (
          <div key={c.id} style={{ display: "grid", gridTemplateColumns: "44px 1fr auto", gap: 12, alignItems: "center" }}>
            <div style={{ width: 44, height: 44, borderRadius: 8, background: c.color === "ink" ? "var(--rj-ink)" : c.color === "accent" ? "var(--rj-accent)" : "var(--rj-paper-2)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-en)", fontSize: 14, fontWeight: 700, color: c.color === "ink" ? "var(--rj-paper)" : "var(--rj-ink)" }}>{c.no}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{c.title}</div>
              <div style={{ fontSize: 11, color: "var(--rj-muted)" }}>{findInstructor(c.instructor)?.name}</div>
            </div>
            <div className="num-en" style={{ fontSize: 13, fontWeight: 600 }}>{formatKRW(c.salePrice)}</div>
          </div>
        ))}
      </div>
      <div style={{ height: 1, background: "var(--rj-faint)" }} />
      <div style={{ display: "grid", gap: 6, marginTop: 14 }}>
        <SummaryRow label="강의 합계" value={formatKRW(subtotal)} />
        {bundle > 0 && <SummaryRow label="번들 5%" value={"− " + formatKRW(bundle)} accent />}
      </div>
      <div style={{ height: 1, background: "var(--rj-faint)", margin: "16px 0" }} />
      <SummaryRow label="총 결제 금액" value={formatKRW(total)} big />
    </div>
  );
}

function CheckoutSuccess({ orderId, items, total, info, onGoMyPage, onGoCourses, onPlay }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 56 }}>
      <div>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "var(--rj-accent)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="check" size={32} strokeWidth={2} />
        </div>
        <h2 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 48, letterSpacing: "-0.03em", marginTop: 24, lineHeight: 1.1 }}>
          {info.name}님,<br />
          결제가 완료되었습니다.
        </h2>
        <p className="body-lg" style={{ color: "var(--rj-muted)", marginTop: 16, maxWidth: 520 }}>
          영수증을 <strong style={{ color: "var(--rj-ink)" }}>{info.email}</strong>으로 발송했습니다.
          마이페이지 ‘수강 중인 강의’에서 바로 시청하실 수 있습니다.
        </p>

        <div className="card" style={{ padding: 24, marginTop: 32 }}>
          <div className="label-cap" style={{ color: "var(--rj-muted)" }}>Order Number · 주문번호</div>
          <div className="num-en" style={{ fontSize: 24, fontWeight: 600, marginTop: 6, letterSpacing: "0.02em" }}>{orderId}</div>
          <div style={{ height: 1, background: "var(--rj-faint)", margin: "16px 0" }} />
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((c) => (
              <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 16, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{c.title}</div>
                  <div style={{ fontSize: 12, color: "var(--rj-muted)" }}>{findInstructor(c.instructor)?.name} · 강의실 {c.classInRoomId}</div>
                </div>
                <span className="num-en" style={{ fontSize: 13 }}>{formatKRW(c.salePrice)}</span>
                <button className="btn btn-sm btn-primary" onClick={() => onPlay(c.id)}><Icon name="play" size={12} /> 바로 시청</button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button className="btn btn-primary btn-lg" onClick={onGoMyPage}>마이페이지로 <Icon name="arrow" size={14} /></button>
          <button className="btn btn-ghost btn-lg" onClick={onGoCourses}>강의 더 보기</button>
        </div>
      </div>

      <aside className="card-ink" style={{ padding: 28 }}>
        <div className="eyebrow" style={{ color: "rgba(245,241,233,0.6)" }}>What's Next · 다음 단계</div>
        <h3 style={{ fontFamily: "var(--font-kr-serif)", fontWeight: 500, fontSize: 24, letterSpacing: "-0.025em", margin: "14px 0 0" }}>한 주의 학습이 시작됩니다.</h3>
        <ol style={{ marginTop: 24, paddingLeft: 0, listStyle: "none", display: "grid", gap: 18 }}>
          {[
            ["01", "라이브 강의실 입장 코드", `결제하신 강의의 룸 코드를 ${info.email}로 발송했습니다.`],
            ["02", "다음 라이브", "마이페이지 ‘회원 전용 강의’에서 일정과 입장 코드를 확인할 수 있습니다."],
            ["03", "다시보기", "라이브 종료 후 5분 안에 ‘마이페이지’에 업로드됩니다."],
          ].map(([n, t, b]) => (
            <li key={n} style={{ display: "grid", gridTemplateColumns: "32px 1fr", gap: 14 }}>
              <span className="num-en" style={{ color: "var(--rj-accent)", fontSize: 12, letterSpacing: "0.18em", fontWeight: 700 }}>{n}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{t}</div>
                <div style={{ fontSize: 13, color: "rgba(245,241,233,0.7)", marginTop: 4 }}>{b}</div>
              </div>
            </li>
          ))}
        </ol>
        <div className="num-en" style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(245,241,233,0.18)", fontSize: 13, color: "rgba(245,241,233,0.6)" }}>TOTAL PAID — {formatKRW(total)}</div>
      </aside>
    </div>
  );
}

window.CartPage = CartPage;
window.CheckoutPage = CheckoutPage;
