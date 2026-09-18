// ═════════════════════════════════════════════════════════════════
//  Supabase Edge Function — exam-serve
//  학생에게 "정답이 제거된" 시험 데이터만 내려준다. exams 테이블 원본
//  (answer/explanation 포함)은 이 함수 안에서 service_role로만 읽고,
//  응답 직전에 항상 별도의 "학생용 객체"를 새로 만들어 반환한다
//  (원본 객체에서 필드를 delete 하는 방식이 아니라, 화이트리스트 방식으로
//   필요한 필드만 옮겨 담는다 — 실수로 정답이 섞여 나가는 것을 구조적으로 방지).
//  ──────────────────────────────────────────────────────────────
//  배포:
//    1) Supabase → Edge Functions → "Create function" → 이름: exam-serve
//    2) 이 파일 내용 복붙 → Deploy (Verify JWT 꺼두기 — 함수 내부에서 직접 검증)
//    3) 환경변수(Secrets): 별도 시크릿 불필요
//        - SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (자동 주입)
//        - ADMIN_EMAILS (선택, 콤마 구분 — 다른 함수들과 동일한 관례)
//    4) 클라이언트 호출:
//        GET /functions/v1/exam-serve?action=list
//        GET /functions/v1/exam-serve?action=take&exam_id=xxx
//        GET /functions/v1/exam-serve?action=result&exam_id=xxx   (제출 직후 — 점수/맞고틀림만, 정답 없음)
//        GET /functions/v1/exam-serve?action=review&exam_id=xxx   (마감 후 — 정답/해설 포함)
// ═════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS } });
}

const ADMIN_EMAILS = (Deno.env.get("ADMIN_EMAILS") || "koreayjk@gmail.com,twinkle347@naver.com")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const STAFF_ROLES = ["admin", "staff", "teacher"];

// ── 문항 유형별 "학생에게 보여줘도 되는 필드"만 옮겨 담는 화이트리스트 ──
function publicQuestion(q: any) {
  const out: any = { id: q.id, type: q.type, unit: q.unit || "", points: q.points };
  if (q.type === "mc") out.choices = Array.isArray(q.choices) ? q.choices : [];
  out.stem = q.stem || "";
  // answer, explanation 은 절대 포함하지 않는다.
  return out;
}
function publicOmrItem(it: any): Record<string, any> {
  return { no: it.no, type: it.type, choices: it.choices, points: it.points, unit: it.unit || "" };
  // answer, explanation 은 절대 포함하지 않는다.
}
// 리뷰(정답 공개) 시에만 쓰는, answer/explanation 포함 버전
function reviewQuestion(q: any): Record<string, any> {
  const out = publicQuestion(q);
  out.answer = q.answer;
  out.explanation = q.explanation || "";
  return out;
}
function reviewOmrItem(it: any): Record<string, any> {
  const out = publicOmrItem(it);
  out.answer = it.answer;
  out.explanation = it.explanation || "";
  return out;
}

function examMeta(exam: any) {
  const isOmr = exam.format === "pdf_omr" || Array.isArray(exam.omr);
  const qCount = isOmr ? (exam.omr || []).length : (exam.questions || []).length;
  const totalPoints = isOmr
    ? (exam.omr || []).reduce((s: number, it: any) => s + (Number(it.points) || 0), 0)
    : (exam.questions || []).reduce((s: number, q: any) => s + (Number(q.points) || 0), 0);
  return {
    id: exam.id, title: exam.title, courseId: exam.courseId || "", type: exam.type || "exam",
    durationMin: exam.durationMin || 0, attempts: exam.attempts == null ? 1 : exam.attempts,
    shuffle: !!exam.shuffle, openAt: exam.openAt || null, dueAt: exam.dueAt || null,
    instructions: exam.instructions || "", format: isOmr ? "pdf_omr" : "structured",
    qCount, totalPoints,
  };
}

// app/exam-data.jsx 의 norm()/autoGrade()/autoGradeOmr() 과 동일(exam-submit 과 같은 이식본).
// "제출 직후" 재조회(result) 시 정답을 노출하지 않으면서 맞음/틀림만 다시 계산하기 위해 필요.
function norm(s: unknown): string {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, "").replace(/[.,]/g, "");
}
function autoGrade(exam: any, answers: Record<string, any>) {
  answers = answers || {};
  let autoScore = 0, autoMax = 0, needsManual = false;
  const per: Record<string, any> = {};
  for (const q of exam.questions || []) {
    if (q.type === "essay") { per[q.id] = { earned: 0, correct: null, manual: true, max: q.points }; needsManual = true; continue; }
    autoMax += q.points;
    const a = answers[q.id]; let ok = false;
    if (q.type === "mc") ok = a != null && Number(a) === q.answer;
    else if (q.type === "ox") ok = a != null && (a === true || a === "true") === (q.answer === true);
    else if (q.type === "short") ok = a != null && norm(a) === norm(q.answer);
    if (ok) autoScore += q.points;
    per[q.id] = { earned: ok ? q.points : 0, correct: ok, manual: false, max: q.points };
  }
  return { autoScore, autoMax, per, needsManual };
}
function autoGradeOmr(exam: any, answers: Record<string, any>) {
  answers = answers || {};
  let autoScore = 0, autoMax = 0;
  const per: Record<string, any> = {};
  for (const it of exam.omr || []) {
    autoMax += Number(it.points) || 0;
    const a = answers[it.no]; let ok = false;
    if (it.type === "short") ok = a != null && norm(a) === norm(it.answer);
    else ok = a != null && Number(a) === Number(it.answer);
    if (ok) autoScore += Number(it.points) || 0;
    per[it.no] = { earned: ok ? (Number(it.points) || 0) : 0, correct: ok, max: Number(it.points) || 0 };
  }
  return { autoScore, autoMax, per, needsManual: false };
}
function safePer(per: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k in per) out[k] = { correct: per[k].correct, earned: per[k].earned, max: per[k].max, manual: !!per[k].manual };
  return out;
}

function reviewAllowed(exam: any): boolean {
  // dueAt 이 없는 시험(연습용)은 처음부터 즉시 피드백이 목적이므로 바로 공개.
  // dueAt 이 있는 정식 시험은 서버 시간 기준으로 마감이 지나야만 공개.
  if (!exam.dueAt) return true;
  return Date.now() > new Date(exam.dueAt).getTime();
}

async function isStaffUser(svc: any, user: any): Promise<boolean> {
  if (ADMIN_EMAILS.includes((user.email || "").toLowerCase())) return true;
  try {
    const { data: prof } = await svc.from("profiles").select("role").eq("id", user.id).maybeSingle();
    return !!prof && STAFF_ROLES.includes(String(prof.role || "").toLowerCase());
  } catch (_e) { return false; }
}

// 이 사용자가 이 시험(exam)에 접근할 수 있는가? — enrollments/subscriptions 재사용(신규 테이블 없음)
async function checkAccess(svc: any, userId: string, staff: boolean, exam: any): Promise<{ ok: boolean; reason: string }> {
  if (staff) return { ok: true, reason: "staff" };
  const now = new Date().toISOString();
  try {
    const { data: sub } = await svc.from("subscriptions").select("status, expires_at")
      .eq("user_id", userId).eq("status", "active").maybeSingle();
    if (sub && (!sub.expires_at || sub.expires_at > now)) return { ok: true, reason: "subscriber" };
  } catch (_e) { /* ignore */ }
  if (exam.courseId) {
    try {
      const { data: enr } = await svc.from("enrollments").select("status, expires_at")
        .eq("user_id", userId).eq("course_id", exam.courseId).eq("status", "active").maybeSingle();
      if (enr && (!enr.expires_at || enr.expires_at > now)) return { ok: true, reason: "enrolled" };
    } catch (_e) { /* ignore */ }
  }
  return { ok: false, reason: "locked" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "GET") return json({ ok: false, msg: "GET 만 지원합니다" }, 405);

  const supaPublic = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY") || "",
    { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } },
  );
  const { data: { user } } = await supaPublic.auth.getUser();
  if (!user) return json({ ok: false, msg: "로그인이 필요합니다" }, 401);

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const staff = await isStaffUser(svc, user);

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "list";
  const examId = url.searchParams.get("exam_id") || "";

  try {
    if (action === "list") {
      const { data: exams, error } = await svc.from("exams").select("id, data");
      if (error) return json({ ok: false, msg: "조회 실패: " + error.message }, 500);
      const { data: attempts } = await svc.from("exam_attempts").select("exam_id, score, graded, submitted_at").eq("user_id", user.id);
      const attemptByExam: Record<string, any> = {};
      for (const a of attempts || []) attemptByExam[a.exam_id] = { score: a.score, graded: a.graded, submittedAt: a.submitted_at };

      const items = [];
      for (const row of exams || []) {
        const exam = row.data; if (!exam) continue;
        const acc = await checkAccess(svc, user.id, staff, exam);
        if (!acc.ok) continue;
        items.push({ ...examMeta(exam), myAttempt: attemptByExam[exam.id] || null });
      }
      return json({ ok: true, items });
    }

    if (action === "result") {
      if (!examId) return json({ ok: false, msg: "exam_id 가 필요합니다" }, 400);
      const { data: row, error } = await svc.from("exams").select("data").eq("id", examId).maybeSingle();
      if (error) return json({ ok: false, msg: "조회 실패: " + error.message }, 500);
      if (!row || !row.data) return json({ ok: false, msg: "시험을 찾을 수 없습니다" }, 404);
      const exam = row.data;
      const acc = await checkAccess(svc, user.id, staff, exam);
      if (!acc.ok) return json({ ok: false, msg: "이 시험에 접근할 권한이 없습니다" }, 403);

      const { data: attempt } = await svc.from("exam_attempts").select("data, score, graded, submitted_at").eq("exam_id", examId).eq("user_id", user.id).maybeSingle();
      if (!attempt) return json({ ok: false, msg: "응시 기록이 없습니다" }, 404);
      const ansForGrade = (attempt.data && attempt.data.answers) || {};
      const isOmr = exam.format === "pdf_omr" || Array.isArray(exam.omr);
      const g = isOmr ? autoGradeOmr(exam, ansForGrade) : autoGrade(exam, ansForGrade);

      // 문제 본문/보기는 결과 화면에도 필요(정답만 계속 숨김) — take 와 동일한 화이트리스트 재사용
      const examPayload: any = { ...examMeta(exam) };
      if (isOmr) {
        examPayload.pdfUrl = exam.pdfUrl || ""; examPayload.pdfName = exam.pdfName || ""; examPayload.defaultChoices = exam.defaultChoices || 5;
        examPayload.omr = (exam.omr || []).map(publicOmrItem);
      } else {
        examPayload.questions = (exam.questions || []).map(publicQuestion);
      }

      return json({
        ok: true, exam: examPayload,
        attempt: {
          answers: ansForGrade, // 학생 본인이 제출한 답 — 정답(answer)이 아니므로 공개 가능
          submittedAt: attempt.submitted_at, graded: attempt.graded,
          score: attempt.graded ? attempt.score : null, // 서술형 미채점 시 확정 점수처럼 보이지 않게
          autoScore: g.autoScore, autoMax: g.autoMax, needsManual: g.needsManual,
          manualFeedback: (attempt.data && attempt.data.manualFeedback) || {},
          manualScores: (attempt.data && attempt.data.manualScores) || {}, // 서술형 강사 채점 점수(정답 아님 — 공개 가능)
          per: safePer(g.per), // correct/earned/max 만 — answer/explanation 없음
        },
        reviewAvailable: reviewAllowed(exam),
      });
    }

    if (action === "take" || action === "review") {
      if (!examId) return json({ ok: false, msg: "exam_id 가 필요합니다" }, 400);
      const { data: row, error } = await svc.from("exams").select("data").eq("id", examId).maybeSingle();
      if (error) return json({ ok: false, msg: "조회 실패: " + error.message }, 500);
      if (!row || !row.data) return json({ ok: false, msg: "시험을 찾을 수 없습니다" }, 404);
      const exam = row.data;

      const acc = await checkAccess(svc, user.id, staff, exam);
      if (!acc.ok) return json({ ok: false, msg: "이 시험에 접근할 권한이 없습니다" }, 403);

      if (action === "take") {
        const now = Date.now();
        if (exam.openAt && now < new Date(exam.openAt).getTime()) return json({ ok: false, msg: "아직 응시 시작 전입니다" }, 403);
        if (exam.dueAt && now > new Date(exam.dueAt).getTime()) return json({ ok: false, msg: "응시 마감되었습니다" }, 403);
        // 재응시 제한: attempts(0=무제한) 이면 항상 허용, 그 외에는 이미 제출한 기록이 있으면 거부
        // (주의: exam_attempts 는 (exam_id,user_id) 1행 구조라 "몇 번째 시도"까지는 서버가 셀 수 없음 — 1회 vs 무제한만 구분 가능)
        if (Number(exam.attempts) !== 0) {
          const { data: prior } = await svc.from("exam_attempts").select("submitted_at").eq("exam_id", examId).eq("user_id", user.id).maybeSingle();
          if (prior && prior.submitted_at) return json({ ok: false, msg: "이미 응시한 시험입니다" }, 403);
        }
        const isOmr = exam.format === "pdf_omr" || Array.isArray(exam.omr);
        const payload: any = { ...examMeta(exam) };
        if (isOmr) {
          payload.pdfUrl = exam.pdfUrl || ""; payload.pdfName = exam.pdfName || ""; payload.defaultChoices = exam.defaultChoices || 5;
          payload.omr = (exam.omr || []).map(publicOmrItem);
        } else {
          payload.questions = (exam.questions || []).map(publicQuestion);
        }
        return json({ ok: true, exam: payload });
      }

      // action === "review" — 정답/해설 공개(마감 후에만)
      if (!reviewAllowed(exam) && !staff) return json({ ok: false, msg: "아직 정답이 공개되지 않았습니다(시험 마감 후 공개)" }, 403);
      const { data: attempt } = await svc.from("exam_attempts").select("data, score, graded, submitted_at").eq("exam_id", examId).eq("user_id", user.id).maybeSingle();
      if (!attempt && !staff) return json({ ok: false, msg: "응시 기록이 없습니다" }, 404);

      const isOmr = exam.format === "pdf_omr" || Array.isArray(exam.omr);
      const payload: any = { ...examMeta(exam) };
      if (isOmr) {
        payload.pdfUrl = exam.pdfUrl || ""; payload.pdfName = exam.pdfName || ""; payload.defaultChoices = exam.defaultChoices || 5;
        payload.omr = (exam.omr || []).map(reviewOmrItem);
      } else {
        payload.questions = (exam.questions || []).map(reviewQuestion);
      }
      return json({ ok: true, exam: payload, attempt: attempt || null });
    }

    return json({ ok: false, msg: "action 은 list | take | result | review 중 하나여야 합니다" }, 400);
  } catch (e) {
    return json({ ok: false, msg: "처리 실패: " + String((e as any)?.message ?? e) }, 500);
  }
});
