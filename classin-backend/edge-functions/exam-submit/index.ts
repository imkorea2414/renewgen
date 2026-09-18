// ═════════════════════════════════════════════════════════════════
//  Supabase Edge Function — exam-submit
//  학생 답안 제출 → 서버 채점 → exam_attempts 저장.
//  채점 로직은 app/exam-data.jsx 의 autoGrade()/autoGradeOmr() 을
//  동일한 결과가 나오도록 그대로 이식한 것이다(비교 규칙 1:1 대응).
//
//  절대 클라이언트를 신뢰하지 않는 값: score, graded, answer, correct,
//  points, user_id, exam_attempts 의 다른 사용자 행. user_id 는 JWT 로만 결정.
//  ──────────────────────────────────────────────────────────────
//  배포:
//    1) Supabase → Edge Functions → "Create function" → 이름: exam-submit
//    2) 이 파일 내용 복붙 → Deploy (Verify JWT 꺼두기 — 함수 내부에서 직접 검증)
//    3) 환경변수(Secrets): 별도 시크릿 불필요(자동 주입 3종만 사용)
//    4) 클라이언트 호출: POST /functions/v1/exam-submit { exam_id, answers }
// ═════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...CORS } });
}

const ADMIN_EMAILS = (Deno.env.get("ADMIN_EMAILS") || "koreayjk@gmail.com,twinkle347@naver.com")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const STAFF_ROLES = ["admin", "staff", "teacher"];

// app/exam-data.jsx 의 norm() 과 동일
function norm(s: unknown): string {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, "").replace(/[.,]/g, "");
}

// app/exam-data.jsx 의 autoGrade() 와 동일한 비교 규칙(mc/ox/short 자동, essay 는 수동 대기)
function autoGrade(exam: any, answers: Record<string, any>) {
  answers = answers || {};
  let autoScore = 0, autoMax = 0, needsManual = false;
  const per: Record<string, any> = {};
  for (const q of exam.questions || []) {
    if (q.type === "essay") {
      per[q.id] = { earned: 0, correct: null, manual: true, max: q.points };
      needsManual = true;
      continue;
    }
    autoMax += q.points;
    const a = answers[q.id];
    let ok = false;
    if (q.type === "mc") ok = a != null && Number(a) === q.answer;
    else if (q.type === "ox") ok = a != null && (a === true || a === "true") === (q.answer === true);
    else if (q.type === "short") ok = a != null && norm(a) === norm(q.answer);
    if (ok) autoScore += q.points;
    per[q.id] = { earned: ok ? q.points : 0, correct: ok, manual: false, max: q.points };
  }
  return { autoScore, autoMax, per, needsManual };
}

// app/exam-data.jsx 의 autoGradeOmr() 과 동일 (essay 없음 → 항상 전체 자동채점)
function autoGradeOmr(exam: any, answers: Record<string, any>) {
  answers = answers || {};
  let autoScore = 0, autoMax = 0;
  const per: Record<string, any> = {};
  for (const it of exam.omr || []) {
    autoMax += Number(it.points) || 0;
    const a = answers[it.no];
    let ok = false;
    if (it.type === "short") ok = a != null && norm(a) === norm(it.answer);
    else ok = a != null && Number(a) === Number(it.answer);
    if (ok) autoScore += Number(it.points) || 0;
    per[it.no] = { earned: ok ? (Number(it.points) || 0) : 0, correct: ok, max: Number(it.points) || 0 };
  }
  return { autoScore, autoMax, per, needsManual: false };
}

// 안전한 결과만 남긴다(정답/해설 절대 미포함)
function safePer(per: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const k in per) out[k] = { correct: per[k].correct, earned: per[k].earned, max: per[k].max, manual: !!per[k].manual };
  return out;
}

async function isStaffUser(svc: any, user: any): Promise<boolean> {
  if (ADMIN_EMAILS.includes((user.email || "").toLowerCase())) return true;
  try {
    const { data: prof } = await svc.from("profiles").select("role").eq("id", user.id).maybeSingle();
    return !!prof && STAFF_ROLES.includes(String(prof.role || "").toLowerCase());
  } catch (_e) { return false; }
}

async function checkAccess(svc: any, userId: string, staff: boolean, exam: any): Promise<boolean> {
  if (staff) return true;
  const now = new Date().toISOString();
  try {
    const { data: sub } = await svc.from("subscriptions").select("status, expires_at")
      .eq("user_id", userId).eq("status", "active").maybeSingle();
    if (sub && (!sub.expires_at || sub.expires_at > now)) return true;
  } catch (_e) { /* ignore */ }
  if (exam.courseId) {
    try {
      const { data: enr } = await svc.from("enrollments").select("status, expires_at")
        .eq("user_id", userId).eq("course_id", exam.courseId).eq("status", "active").maybeSingle();
      if (enr && (!enr.expires_at || enr.expires_at > now)) return true;
    } catch (_e) { /* ignore */ }
  }
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, msg: "POST 만 지원합니다" }, 405);

  const supaPublic = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY") || "",
    { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } },
  );
  const { data: { user } } = await supaPublic.auth.getUser();
  if (!user) return json({ ok: false, msg: "로그인이 필요합니다" }, 401);

  let body: { exam_id?: string; answers?: Record<string, any> };
  try { body = await req.json(); } catch { body = {}; }
  const examId = (body.exam_id || "").trim();
  // 학생이 보낸 answers 의 "값"만 신뢰(문항 id → 학생이 고른 답). score/graded/answer/correct/points/user_id 등은
  // body 에 뭐가 오든 전부 무시하고 아래에서 서버가 새로 계산한다.
  const answers = (body.answers && typeof body.answers === "object") ? body.answers : {};
  if (!examId) return json({ ok: false, msg: "exam_id 가 필요합니다" }, 400);

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const { data: row, error } = await svc.from("exams").select("data").eq("id", examId).maybeSingle();
    if (error) return json({ ok: false, msg: "조회 실패: " + error.message }, 500);
    if (!row || !row.data) return json({ ok: false, msg: "시험을 찾을 수 없습니다" }, 404);
    const exam = row.data;

    const staff = await isStaffUser(svc, user);
    const allowed = await checkAccess(svc, user.id, staff, exam);
    if (!allowed) return json({ ok: false, msg: "이 시험에 접근할 권한이 없습니다" }, 403);

    // 서버 시간 기준 응시 기간 재검증 (클라이언트 시계 신뢰하지 않음)
    const now = Date.now();
    if (exam.openAt && now < new Date(exam.openAt).getTime()) return json({ ok: false, msg: "아직 응시 시작 전입니다" }, 403);
    if (exam.dueAt && now > new Date(exam.dueAt).getTime()) return json({ ok: false, msg: "응시 마감되었습니다" }, 403);

    // 재제출 제한: attempts(0=무제한) 외에는 이미 제출 기록이 있으면 거부
    const { data: prior } = await svc.from("exam_attempts").select("submitted_at").eq("exam_id", examId).eq("user_id", user.id).maybeSingle();
    if (Number(exam.attempts) !== 0 && prior && prior.submitted_at) {
      return json({ ok: false, msg: "이미 제출한 시험입니다(재제출 불가)" }, 409);
    }

    const isOmr = exam.format === "pdf_omr" || Array.isArray(exam.omr);
    const g = isOmr ? autoGradeOmr(exam, answers) : autoGrade(exam, answers);
    const score = g.autoScore; // essay 가 있으면 아직 서술형 미채점 상태의 자동채점 부분점수만
    const graded = !g.needsManual;

    const attemptData = {
      answers, submittedAt: new Date().toISOString(), autoScore: g.autoScore, autoMax: g.autoMax,
      manualScores: {}, manualFeedback: {}, graded, leaveCount: Number((body as any).leaveCount) || 0,
      omr: isOmr || undefined,
    };

    const { error: upErr } = await svc.from("exam_attempts").upsert({
      exam_id: examId, user_id: user.id, data: attemptData, score, graded,
      submitted_at: attemptData.submittedAt,
    }, { onConflict: "exam_id,user_id" });
    if (upErr) return json({ ok: false, msg: "저장 실패: " + upErr.message }, 500);

    return json({
      ok: true, examId, submittedAt: attemptData.submittedAt,
      autoScore: g.autoScore, autoMax: g.autoMax, needsManual: g.needsManual, graded,
      score: graded ? score : null, // 서술형 채점 대기 중이면 "확정 점수"로 표시하지 않음
      per: safePer(g.per),
    });
  } catch (e) {
    return json({ ok: false, msg: "처리 실패: " + String((e as any)?.message ?? e) }, 500);
  }
});
