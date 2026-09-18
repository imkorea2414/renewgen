/* global window */
// ──────────────────────────────────────────────────────────────────
//  시험 시스템 ↔ Supabase 동기화
//   · localStorage 를 즉각 캐시로 쓰고, Supabase 를 영구 저장소로 사용
//   · 로그인 시 원격 → 로컬 하이드레이트 · 제출/채점/출제 시 원격 업서트
//   · Supabase 미연결/테이블 미생성 시에는 조용히 로컬만 사용(폴백)
//
//  필요 테이블(아래 SQL 을 Supabase SQL Editor 에서 1회 실행):
//    classin-backend/supabase-exam-schema.sql
//
//   exams(id text pk, data jsonb, created_by uuid, updated_at)
//   exam_attempts(exam_id text, user_id uuid, data jsonb, score int,
//                 graded bool, submitted_at, pk(exam_id,user_id))
// ──────────────────────────────────────────────────────────────────

function _examSb() { return (window.getSupabase && window.getSupabase()) || null; }
function _uid() { const u = window.RJ_CURRENT_USER; return u && u.id ? u.id : null; }

// 연결 상태(배지용): "connected" | "local"
let _examSbState = "local";
function examSbStatus() { return _examSbState; }

// ── 원격 → 로컬 하이드레이트 ────────────────────────────────────────
async function pullExams() {
  const sb = _examSb(); if (!sb) return false;
  try {
    const { data, error } = await sb.from("exams").select("data");
    if (error) { _examSbState = "local"; return false; }
    _examSbState = "connected";
    const store = window.loadExamStore();
    const remote = (data || []).map((r) => r.data).filter(Boolean);
    // 원격 custom 으로 교체(같은 id 는 원격 우선), seed 는 EXAMS_SEED 가 따로 보유
    const byId = {};
    for (const c of (store.custom || [])) byId[c.id] = c;
    for (const e of remote) byId[e.id] = e;
    store.custom = Object.values(byId);
    window.saveExamStore(store);
    return true;
  } catch (e) { _examSbState = "local"; return false; }
}

async function pullAttempts(user) {
  const sb = _examSb(); const uid = (user && user.id) || _uid(); if (!sb || !uid) return false;
  try {
    const { data, error } = await sb.from("exam_attempts").select("exam_id, data").eq("user_id", uid);
    if (error) return false;
    const store = window.loadExamStore();
    for (const row of (data || [])) if (row.data) store.attempts[row.exam_id] = row.data;  // 원격 우선 병합(로컬 전용은 유지)
    window.saveExamStore(store);
    return true;
  } catch (e) { return false; }
}

async function pullExamData(user) {
  const a = await pullExams();
  const b = await pullAttempts(user);
  if ((a || b) && window.__rjExamSynced) window.__rjExamSynced();
  return a || b;
}

// ── 로컬 → 원격 업서트 ──────────────────────────────────────────────
async function pushExam(exam, user) {
  const sb = _examSb(); const uid = (user && user.id) || _uid(); if (!sb || !exam) return false;
  try {
    const { error } = await sb.from("exams").upsert({ id: exam.id, data: exam, created_by: uid, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) return false;
    _examSbState = "connected"; return true;
  } catch (e) { return false; }
}

async function deleteRemoteExam(id) {
  const sb = _examSb(); if (!sb) return;
  try { await sb.from("exams").delete().eq("id", id); } catch (e) {}
}

// 응시 제출/채점 시 자동 호출(exam-data.saveAttempt 훅)
function pushAttempt(examId, attempt) {
  const sb = _examSb(); const uid = _uid(); if (!sb || !uid || !attempt) return;
  let score = attempt.autoScore || 0;
  const ex = window.findExam && window.findExam(examId);
  if (ex && window.finalScore) { const f = window.finalScore(ex, attempt); if (f != null) score = f; }
  try {
    sb.from("exam_attempts").upsert({
      exam_id: examId, user_id: uid, data: attempt, score,
      graded: !!attempt.graded, submitted_at: new Date().toISOString(),
    }, { onConflict: "exam_id,user_id" }).then(({ error }) => { if (!error) _examSbState = "connected"; });
  } catch (e) {}
}
function deleteAttempt(examId) {
  const sb = _examSb(); const uid = _uid(); if (!sb || !uid) return;
  try { sb.from("exam_attempts").delete().eq("exam_id", examId).eq("user_id", uid); } catch (e) {}
}

// 관리자: 한 시험의 전체 제출본 조회(채점·현황용)
async function listAttempts(examId) {
  const sb = _examSb(); if (!sb) return [];
  try {
    const { data, error } = await sb.from("exam_attempts").select("user_id, data, score, graded, submitted_at").eq("exam_id", examId);
    if (error) return [];
    return data || [];
  } catch (e) { return []; }
}

// exam-data 훅 연결 — 강사/관리자(ExamGrader 등)의 직접 저장에만 쓰임.
// 학생 제출은 더 이상 이 경로를 타지 않는다(아래 examSubmitCall 참고).
window.__rjPushAttempt = pushAttempt;
window.__rjDeleteAttempt = deleteAttempt;

Object.assign(window, {
  pullExams, pullAttempts, pullExamData, pushExam, deleteRemoteExam,
  pushExamAttempt: pushAttempt, listAttempts, examSbStatus,
});

// ══════════════════════════════════════════════════════════════════
//  학생용 — exam-serve / exam-submit Edge Function 경유
//   · 정답(answer)/해설(explanation)이 포함된 exams 원본을 학생 브라우저가
//     직접 select 하지 않는다 — 목록/응시/채점 모두 서버(Edge Function)를 거친다.
//   · classin-roster / bbb-room 과 동일한 인증 방식(JWT Bearer + apikey).
// ══════════════════════════════════════════════════════════════════
async function examServeCall(qs) {
  const base = (window.SUPABASE_URL || "") + "/functions/v1/exam-serve";
  let bearer = window.SUPABASE_ANON_KEY || "";
  try {
    const sb = window.getSupabase && window.getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (session && session.access_token) bearer = session.access_token;
  } catch (e) {}
  try {
    const res = await fetch(base + qs, { headers: { Authorization: "Bearer " + bearer, apikey: window.SUPABASE_ANON_KEY || "" } });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.ok === false) return { ok: false, msg: j.msg || ("HTTP " + res.status) };
    return j;
  } catch (e) { return { ok: false, msg: "네트워크 오류: " + String(e) }; }
}

async function examSubmitCall(body) {
  const base = (window.SUPABASE_URL || "") + "/functions/v1/exam-submit";
  let bearer = window.SUPABASE_ANON_KEY || "";
  try {
    const sb = window.getSupabase && window.getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (session && session.access_token) bearer = session.access_token;
  } catch (e) {}
  try {
    const res = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + bearer, apikey: window.SUPABASE_ANON_KEY || "" },
      body: JSON.stringify(body || {}),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || j.ok === false) return { ok: false, msg: j.msg || ("HTTP " + res.status) };
    return j;
  } catch (e) { return { ok: false, msg: "네트워크 오류: " + String(e) }; }
}

// 학생 시험 목록(메타데이터만, 정답 없음) — 로그인 시 pullExamData 대신 이걸 호출
async function pullExamsForStudent() {
  const r = await examServeCall("?action=list");
  if (!r.ok) { _examSbState = "local"; return false; }
  _examSbState = "connected";
  const store = window.loadExamStore();
  store.custom = r.items || [];
  // 서버가 알려준 내 응시 요약(score/graded/submittedAt)을 로컬 attempts 캐시에 반영
  for (const it of r.items || []) {
    if (it.myAttempt) store.attempts[it.id] = { ...(store.attempts[it.id] || {}), ...it.myAttempt };
  }
  window.saveExamStore(store);
  return true;
}

// 응시 화면용 — 정답 없는 단일 시험(문항 포함) 조회
async function fetchExamForTaking(examId) {
  return examServeCall("?action=take&exam_id=" + encodeURIComponent(examId));
}

// 결과 화면용(제출 직후~마감 전) — 점수/맞고틀림만, 정답·해설 없음
async function fetchExamResult(examId) {
  return examServeCall("?action=result&exam_id=" + encodeURIComponent(examId));
}
// 결과 화면용(마감 후) — 정답/해설 포함 재조회(그 시점에만 서버가 내려줌)
async function fetchExamReview(examId) {
  return examServeCall("?action=review&exam_id=" + encodeURIComponent(examId));
}

// 제출 — 서버가 채점·저장까지 전부 수행. score/graded 는 서버 응답만 신뢰.
async function submitExamAnswers(examId, answers, leaveCount) {
  return examSubmitCall({ exam_id: examId, answers, leaveCount });
}

Object.assign(window, {
  pullExamsForStudent, fetchExamForTaking, fetchExamResult, fetchExamReview, submitExamAnswers,
});
