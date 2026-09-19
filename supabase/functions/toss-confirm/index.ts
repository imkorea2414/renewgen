import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// ─────────────────────────────────────────────────────────────────────────
// Toss 결제 서버 승인 — 클라이언트가 "결제 성공했다"고 주장하는 것을 신뢰하지 않고,
// 이 함수가 직접 Toss 서버에 시크릿키로 승인 요청을 보내 실제 승인 여부를 확인한다.
//
// 개별 강좌(VOD) 구매 보강(이번 변경). 두 검증은 목적이 달라 적용 범위를 서로 다르게 둔다:
//   1) 중복 구매 서버 검증 — course_ids 가 있는 주문(1개든 장바구니 여러 개든)이면 전부 적용.
//      금액 계산과 무관하게 "이미 전부 유효 보유 중인가"만 보므로 장바구니 번들 할인 여부와
//      상관없이 항상 안전하다. Toss confirm(=실제 승인·캡처)을 호출하기 전에, 요청된 course_ids를
//      전부 이미 유효하게 보유(enrollments.status='active' AND (expires_at IS NULL OR >now()))
//      하고 있는지 확인한다. 전부 보유 중이면 Toss confirm 자체를 호출하지 않는다 — 그러면 Toss
//      쪽의 결제 인증은 캡처(확정)되지 않고 그대로 만료되므로 실제로 돈이 청구되지 않는다.
//   2) 서버 가격 검증 — course_ids.length === 1(단일 강좌 주문)일 때만 적용한다. 기존 장바구니는
//      2개 이상 담으면 5%(Math.round(subtotal*0.05)) 번들 할인이 orders.amount 에 반영되는데
//      (app/pages-checkout.jsx CartPage/CheckoutPage), courses.price 단순 합산은 이 할인을
//      반영하지 못해 다중 강좌 주문을 오탐 거부하게 된다. 그래서 할인 여지가 없는 단일 강좌
//      주문에만 "브라우저가 보낸 order.amount/이번 요청의 amount 는 신뢰하지 않고, public.courses.price
//      (VodAddForm/LessonsManagePanel 저장 시 vod_sync_course_fields 로 항상 동기화되는 실제 판매가)를
//      서버가 직접 조회해 정확히 일치할 때만 다음 단계로 진행" 검증을 적용한다. 존재하지 않는
//      course_id 나 금액 불일치는 즉시 거부한다. 장바구니 2개 이상 주문은 이 검증을 건너뛰어
//      기존 동작(번들 할인 포함)을 그대로 유지한다.
//   구독(주문의 course_ids 가 비어 있는 경우)은 이번 보강 대상이 아니며 기존 로직 그대로 통과한다.
//
// orders.status 는 기존 DDL(classin-backend/db/supabase-orders.sql)에 이미 문서화된
// pending | paid | failed | canceled 네 값만 사용한다(새 상태값 추가 안 함).
//   · "이미 구매한 강좌"로 confirm 을 생략하는 경우는 실제 결제 실패(failed)가 아니라 정상적인
//     중복구매 방지이므로 canceled 로 남기고(raw 에 사유만 별도 기록), 응답은 ok:true 로 돌려줘
//     CheckoutPage 가 기존 성공 화면 그대로("바로 시청" 버튼 → /player/:id)를 보여주도록 한다.
//     단 payment.status 는 Toss 의 실제 승인 상태값("DONE")을 절대 재사용하지 않고 "ALREADY_ENROLLED"로
//     명확히 구분해, 실제 승인이 없었다는 사실이 payment 객체만 보고 진짜 결제 성공과 혼동되지 않게 한다.
//   · 가격 불일치/존재하지 않는 course_id 는 실제 거부이므로 기존처럼 failed 로 남기고 ok:false 로
//     응답한다(기존 AMOUNT_MISMATCH 처리와 동일한 패턴).
//
// 건드리지 않는 것: vod_get_student_lessons, LessonsPlayer, lessons RLS, Vimeo 재생 로직,
//   구독(subscribe) 처리 경로, 기존 idempotency(주문이 이미 paid 면 재확인 없이 바로 ok 반환),
//   장바구니 2개 이상 다중 강좌 결제(번들 할인 포함 기존 동작 그대로).
// ─────────────────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS } });
}
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST")    return json({ ok: false, message: "POST 만 지원합니다" }, 405);
  let body: { paymentKey?: string; orderId?: string; amount?: number };
  try { body = await req.json(); } catch { return json({ ok: false, message: "JSON 본문이 필요합니다" }, 400); }
  const paymentKey = String(body.paymentKey || "").trim();
  const orderId    = String(body.orderId    || "").trim();
  const amount     = Number(body.amount || 0);
  if (!paymentKey || !orderId || amount <= 0) return json({ ok: false, message: "paymentKey · orderId · amount 가 필요합니다" }, 400);
  const TOSS_SECRET = Deno.env.get("TOSS_SECRET_KEY");
  if (!TOSS_SECRET) return json({ ok: false, message: "서버에 TOSS_SECRET_KEY 가 설정되지 않았습니다" }, 500);
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: order } = await supa.from("orders").select("order_id, user_id, course_ids, amount, status").eq("order_id", orderId).maybeSingle();
  if (order) {
    if (order.status === "paid") return json({ ok: true, payment: { orderId, amount: order.amount, status: "DONE", method: "이미 승인된 주문" } });
    if (order.amount !== amount) return json({ ok: false, code: "AMOUNT_MISMATCH", message: "금액이 일치하지 않습니다" }, 400);
  }

  // ── 1) 중복 구매 서버 검증 — course_ids 가 있는 주문이면 개수와 무관하게 항상 적용 ──
  //    (금액 계산이 전혀 개입하지 않으므로 장바구니 번들 할인 여부와 관계없이 항상 안전하다)
  if (order && Array.isArray(order.course_ids) && order.course_ids.length > 0) {
    const { data: existing } = await supa
      .from("enrollments")
      .select("course_id, status, expires_at")
      .eq("user_id", order.user_id)
      .eq("status", "active")
      .in("course_id", order.course_ids);
    const now = Date.now();
    const ownedCourseIds = new Set(
      (existing || [])
        .filter((e) => !e.expires_at || new Date(e.expires_at).getTime() > now)
        .map((e) => e.course_id)
    );
    const alreadyOwnedAll = order.course_ids.every((cid: string) => ownedCourseIds.has(cid));
    if (alreadyOwnedAll) {
      // 정상적인 중복구매 방지 — 실제 결제 실패(failed)가 아니므로 기존 DDL에 이미 있는
      // canceled 를 사용한다. payment.status 는 Toss 의 실제 승인값("DONE")을 쓰지 않고
      // ALREADY_ENROLLED 로 명시해, 실제 승인이 없었음을 이 응답만 보고도 알 수 있게 한다.
      await supa.from("orders").update({ status: "canceled", raw: { skipped: "already-enrolled" } }).eq("order_id", orderId);
      return json({ ok: true, payment: { orderId, amount: order.amount, status: "ALREADY_ENROLLED", method: "이미 구매한 강의" } });
    }
  }

  // ── 2) 서버 가격 검증 — 단일 강좌 주문(course_ids.length===1)에만 적용 ──
  //    장바구니 2개 이상은 5% 번들 할인이 orders.amount 에 반영되어 courses.price 단순 합산과
  //    다를 수 있으므로(app/pages-checkout.jsx 의 CartPage/CheckoutPage 참고) 이 검증을 건너뛰고
  //    기존 동작(할인 포함)을 그대로 유지한다. 개별 VOD "다시보기 구매"는 항상 강좌 1개만 보낸다.
  if (order && Array.isArray(order.course_ids) && order.course_ids.length === 1) {
    const { data: priceRows, error: priceErr } = await supa.from("courses").select("id, price").in("id", order.course_ids);
    if (priceErr) return json({ ok: false, code: "PRICE_LOOKUP_FAILED", message: "강좌 가격을 확인할 수 없습니다" }, 500);
    const priceMap = new Map((priceRows || []).map((r: { id: string; price: number }) => [r.id, Number(r.price) || 0]));
    const missing = order.course_ids.filter((cid: string) => !priceMap.has(cid));
    if (missing.length > 0) {
      await supa.from("orders").update({ status: "failed", raw: { reason: "course-not-found", missing } }).eq("order_id", orderId);
      return json({ ok: false, code: "COURSE_NOT_FOUND", message: "존재하지 않는 강좌가 포함되어 있습니다" }, 400);
    }
    const serverTotal = order.course_ids.reduce((sum: number, cid: string) => sum + (priceMap.get(cid) || 0), 0);
    if (serverTotal !== order.amount || serverTotal !== amount) {
      await supa.from("orders").update({
        status: "failed",
        raw: { reason: "price-mismatch", serverTotal, orderAmount: order.amount, requestAmount: amount },
      }).eq("order_id", orderId);
      return json({ ok: false, code: "PRICE_MISMATCH", message: "결제 금액이 실제 판매가와 일치하지 않습니다" }, 400);
    }
  }

  const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: { "Authorization": "Basic " + btoa(TOSS_SECRET + ":"), "Content-Type": "application/json" },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });
  const tossJson = await tossRes.json().catch(() => ({}));
  if (!tossRes.ok) {
    if (order) await supa.from("orders").update({ status: "failed", payment_key: paymentKey, raw: tossJson }).eq("order_id", orderId);
    return json({ ok: false, code: tossJson.code || "CONFIRM_FAILED", message: tossJson.message || "결제 승인에 실패했습니다" }, tossRes.status || 500);
  }
  if (order) {
    await supa.from("orders").update({ status: "paid", payment_key: tossJson.paymentKey || paymentKey, method: tossJson.method || null, approved_at: tossJson.approvedAt || new Date().toISOString(), raw: tossJson }).eq("order_id", orderId);
    if (order.user_id && Array.isArray(order.course_ids) && order.course_ids.length) {
      const rows = order.course_ids.map((cid: string) => ({ user_id: order.user_id, course_id: cid, order_id: orderId, status: "active", granted_at: new Date().toISOString() }));
      await supa.from("enrollments").upsert(rows, { onConflict: "user_id,course_id", ignoreDuplicates: true });
    }
  }
  return json({ ok: true, payment: { orderId: tossJson.orderId || orderId, amount: tossJson.totalAmount || amount, method: tossJson.method || "", status: tossJson.status || "DONE", approvedAt: tossJson.approvedAt || null, receipt: tossJson.receipt?.url || null, paymentKey: tossJson.paymentKey || paymentKey } });
});
