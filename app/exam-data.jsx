/* global window, findCourse */
// ──────────────────────────────────────────────────────────────────
//  시험(Exam) 데이터 모델 + 응시 저장소  — 리뉴젠 자체 시험 시스템
//   · 출제/채점은 우리 사이트에서. ClassIn 라이브 수업과 독립.
//   · 프로토타입: 문제·응시기록을 localStorage 에 저장 (실서버는 Supabase 이관)
//
//  문항 유형(type):
//   mc    객관식(5지선다)  answer: 정답 보기 index
//   ox    OX/참거짓         answer: true | false
//   short 단답형(자동채점)  answer: 정답 문자열 (대소문자/공백 무시 비교)
//   essay 서술형(수동채점)  answer: 모범답안(참고), 채점은 강사가
// ──────────────────────────────────────────────────────────────────
const RJ_EXAM_KEY = "rj_exam_store_v1";

function loadExamStore() {
  try {
    const s = JSON.parse(localStorage.getItem(RJ_EXAM_KEY) || "null");
    if (s && s.attempts) return s;
  } catch (e) {}
  return { attempts: {}, custom: [] };  // attempts[examId] = {answers, submittedAt, autoScore, manualScore, graded, leaveCount}
}
function saveExamStore(s) { try { localStorage.setItem(RJ_EXAM_KEY, JSON.stringify(s)); } catch (e) {} }

function getAttempt(examId) { return loadExamStore().attempts[examId] || null; }
function saveAttempt(examId, patch) {
  const s = loadExamStore();
  s.attempts[examId] = { ...(s.attempts[examId] || {}), ...patch };
  saveExamStore(s);
  if (window.__rjPushAttempt) { try { window.__rjPushAttempt(examId, s.attempts[examId]); } catch (e) {} }
  return s.attempts[examId];
}
// 로컬 캐시만 비운다(연습문제 "다시 풀기"). 원격 exam_attempts 행은 지우지 않는다 —
//  1) attempts=0(무제한) 시험은 exam-submit 이 재제출 때 service_role로 그냥 덮어쓰므로 삭제가 필요 없고,
//  2) 학생 계정에 exam_attempts 직접 DELETE 권한을 주지 않는 방향으로 RLS를 강화할 예정이라
//     여기서 클라이언트가 직접 delete 를 시도하면 앞으로 실패하게 된다.
function resetAttempt(examId) {
  const s = loadExamStore();
  delete s.attempts[examId];
  saveExamStore(s);
}
// 서버(exam-submit)가 이미 채점·저장을 끝낸 결과를 로컬 캐시에 반영만 한다.
// saveAttempt()와 달리 원격 push 를 다시 트리거하지 않는다(중복 저장 방지 · 학생은
// 더 이상 exam_attempts 에 직접 쓰기 권한이 없어질 예정이므로 애초에 쓸 필요 없음).
function applyAttemptFromServer(examId, patch) {
  const s = loadExamStore();
  s.attempts[examId] = { ...(s.attempts[examId] || {}), ...patch };
  saveExamStore(s);
  return s.attempts[examId];
}

// 객관식·OX·단답 자동채점 → { autoScore, autoMax, per:{qid:{earned,correct,manual}}, needsManual }
function autoGrade(exam, answers) {
  answers = answers || {};
  let autoScore = 0, autoMax = 0, needsManual = false;
  const per = {};
  for (const q of exam.questions) {
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
function norm(s) { return String(s || "").trim().toLowerCase().replace(/\s+/g, "").replace(/[.,]/g, ""); }

function examTotal(exam) {
  // exam-serve 가 내려준 학생용 목록 객체는 문항 배열 대신 이미 계산된 totalPoints 를 가짐
  if (exam.totalPoints != null) return exam.totalPoints;
  if (exam.format === "pdf_omr" || exam.omr) return (exam.omr || []).reduce((s, q) => s + (Number(q.points) || 0), 0);
  return exam.questions.reduce((s, q) => s + q.points, 0);
}
// 문항 수(구조형/OMR 공통)
function examQCount(exam) {
  if (exam.qCount != null) return exam.qCount;
  return ((exam.omr || exam.questions) || []).length;
}

// PDF+OMR 자동채점 (답안은 번호(no)로 키) → 서술형 없음 = 전체 자동
function autoGradeOmr(exam, answers) {
  answers = answers || {};
  let autoScore = 0, autoMax = 0; const per = {};
  for (const it of (exam.omr || [])) {
    autoMax += Number(it.points) || 0;
    const a = answers[it.no];
    let ok = false;
    if (it.type === "short") ok = a != null && norm(a) === norm(it.answer);
    else ok = a != null && Number(a) === Number(it.answer);   // mc
    if (ok) autoScore += Number(it.points) || 0;
    per[it.no] = { earned: ok ? (Number(it.points) || 0) : 0, correct: ok, max: Number(it.points) || 0 };
  }
  return { autoScore, autoMax, per, needsManual: false };
}

// 상태: upcoming(예정) · open(응시가능) · submitted(채점대기) · graded(완료) · closed(마감)
function examStatus(exam) {
  const at = getAttempt(exam.id);
  if (at && at.submittedAt) return at.graded ? "graded" : "submitted";
  const now = Date.now();
  if (exam.openAt && now < new Date(exam.openAt).getTime()) return "upcoming";
  if (exam.dueAt && now > new Date(exam.dueAt).getTime()) return "closed";
  return "open";
}

// 데모 석차/백분위 (실제로는 전체 응시자 분포로 계산)
function mockPercentile(pct) {
  if (pct >= 95) return 2; if (pct >= 90) return 6; if (pct >= 80) return 14;
  if (pct >= 70) return 28; if (pct >= 60) return 42; return 60;
}
function gradeOf(pct) {
  if (pct >= 90) return 1; if (pct >= 80) return 2; if (pct >= 70) return 3;
  if (pct >= 60) return 4; if (pct >= 50) return 5; return 6;
}

// ── 데모 시험 데이터 ────────────────────────────────────────────────
const EXAMS_SEED = [
  {
    id: "exam-2603",
    period: "2026-03",
    title: "3월 정기고사 · 수학",
    courseId: "math-calc-2026",
    type: "exam",
    durationMin: 40,
    attempts: 1,
    shuffle: true,
    openAt: "2026-03-09T00:00:00+09:00",
    dueAt: "2026-03-13T23:59:00+09:00",
    instructions: "도함수의 활용 단원. 계산기 사용 불가 · 시작 후 40분 · 1회 응시.",
    questions: [
      { id: "q1", type: "mc", unit: "도함수의 활용", points: 20,
        stem: "함수 f(x)=x³−3x 의 극댓값은?",
        choices: ["−2", "0", "2", "−1", "1"], answer: 2,
        explanation: "f'(x)=3x²−3=0 → x=±1. x=−1에서 극대, f(−1)=−1+3=2." },
      { id: "q2", type: "mc", unit: "접선의 방정식", points: 20,
        stem: "곡선 y=x² 위의 점 (1,1)에서의 접선의 기울기는?",
        choices: ["1", "2", "3", "1/2", "0"], answer: 1,
        explanation: "y'=2x, x=1 → 기울기 2." },
      { id: "q3", type: "ox", unit: "증가·감소", points: 15,
        stem: "f'(x)>0 인 구간에서 f(x)는 항상 증가한다.",
        answer: true,
        explanation: "도함수가 양이면 그 구간에서 증가함수." },
      { id: "q4", type: "short", unit: "극값", points: 20,
        stem: "f(x)=x²−4x+5 가 최솟값을 갖는 x의 값을 구하시오.",
        answer: "2",
        explanation: "f'(x)=2x−4=0 → x=2 에서 최소." },
      { id: "q5", type: "essay", unit: "도함수의 활용", points: 25,
        stem: "평균값 정리를 서술하고, f(x)=x² 가 구간 [0,2]에서 평균값 정리를 만족하는 c를 구하는 과정을 쓰시오.",
        answer: "평균값 정리: f가 [a,b]에서 연속·(a,b)에서 미분가능하면 f'(c)=(f(b)−f(a))/(b−a)인 c가 존재. (f(2)−f(0))/2 = 4/2 = 2 = f'(c)=2c → c=1.",
        explanation: "정의 서술 + c=1 도출이면 만점." },
    ],
  },
  {
    id: "exam-2604",
    period: "2026-04",
    title: "4월 정기고사 · 국어",
    courseId: "korean-lit-2026",
    type: "exam",
    durationMin: 50,
    attempts: 1,
    shuffle: true,
    openAt: "2026-04-13T00:00:00+09:00",
    dueAt: "2026-04-17T23:59:00+09:00",
    instructions: "비문학 2지문 + 문학. 50분 · 1회 응시.",
    questions: [
      { id: "k1", type: "mc", unit: "비문학·과학", points: 25,
        stem: "다음 글의 중심 내용으로 가장 적절한 것은? (지문: 열역학 제2법칙…)",
        choices: ["엔트로피는 감소한다", "고립계의 엔트로피는 증가한다", "열은 항상 일이 된다", "에너지는 사라진다", "온도는 일정하다"], answer: 1,
        explanation: "고립계에서 엔트로피는 증가하거나 일정 — 제2법칙의 핵심." },
      { id: "k2", type: "ox", unit: "독서·태도", points: 15,
        stem: "글쓴이의 관점과 다른 견해는 무조건 틀린 것이다.", answer: false,
        explanation: "관점이 다른 것과 옳고 그름은 별개. 비판적 독해의 기본." },
      { id: "k3", type: "short", unit: "문학·시", points: 25,
        stem: "‘청산리 벽계수야’에서 시조의 종장 첫 음보 글자 수는? (숫자만)",
        answer: "3",
        explanation: "시조 종장의 첫 음보는 3음절로 고정." },
      { id: "k4", type: "essay", unit: "문학·소설", points: 35,
        stem: "제시된 소설에서 서술자의 시점을 밝히고, 그 시점이 인물 제시에 미치는 효과를 서술하시오.",
        answer: "1인칭 주인공 시점 — 인물의 내면을 직접 드러내 독자의 공감을 유도하나 객관성은 제한됨.",
        explanation: "시점 식별 + 효과 2가지 이상이면 만점." },
    ],
  },
  {
    id: "exam-eng-quiz",
    title: "구문독해 연습 퀴즈 — 관계사",
    courseId: "english-struct-2026",
    type: "practice",
    durationMin: 0,
    attempts: 0,         // 0 = 무제한
    shuffle: true,
    openAt: null,
    dueAt: null,
    instructions: "연습용 · 시간 제한 없음 · 여러 번 응시 가능.",
    questions: [
      { id: "e1", type: "mc", unit: "관계대명사", points: 25,
        stem: "The book ___ I bought yesterday is interesting. 빈칸에 알맞은 것은?",
        choices: ["who", "which", "whose", "where", "when"], answer: 1,
        explanation: "선행사 the book(사물) + 목적격 → which (생략 가능)." },
      { id: "e2", type: "ox", unit: "관계부사", points: 25,
        stem: "‘the place where’의 where는 in which 로 바꿔 쓸 수 있다.", answer: true,
        explanation: "관계부사 where = 전치사+관계대명사(in which)." },
      { id: "e3", type: "short", unit: "관계대명사", points: 25,
        stem: "He is the man ___ helped me. 빈칸에 들어갈 한 단어(주격 관계대명사)는?",
        answer: "who",
        explanation: "선행사 the man(사람) + 주격 → who." },
      { id: "e4", type: "mc", unit: "복합관계사", points: 25,
        stem: "___ comes first will get the prize. 빈칸은?",
        choices: ["Who", "Whoever", "Which", "Whomever", "Whose"], answer: 1,
        explanation: "‘누구든지’ 명사절 주어 → Whoever (= Anyone who)." },
    ],
  },
  {
    id: "exam-2605",
    period: "2026-05",
    title: "5월 정기고사 · 영어",
    courseId: "english-struct-2026",
    type: "exam",
    durationMin: 45,
    attempts: 1,
    shuffle: true,
    openAt: "2026-05-11T00:00:00+09:00",
    dueAt: "2026-05-15T23:59:00+09:00",
    instructions: "구문독해 — 관계사·분사구문. 45분 · 1회 응시.",
    questions: [
      { id: "m1", type: "mc", unit: "관계대명사", points: 24,
        stem: "The book ___ I bought yesterday is interesting. 빈칸에 알맞은 것은?",
        choices: ["who", "which", "whose", "where", "when"], answer: 1,
        explanation: "선행사 the book(사물) + 목적격 → which." },
      { id: "m2", type: "ox", unit: "관계부사", points: 24,
        stem: "‘the place where’의 where는 in which 로 바꿔 쓸 수 있다.", answer: true,
        explanation: "관계부사 where = 전치사+관계대명사(in which)." },
      { id: "m3", type: "short", unit: "관계대명사", points: 24,
        stem: "He is the man ___ helped me. 빈칸에 들어갈 한 단어(주격)는?", answer: "who",
        explanation: "선행사 the man(사람) + 주격 → who." },
      { id: "m4", type: "mc", unit: "복합관계사", points: 16,
        stem: "___ comes first will get the prize. 빈칸은?",
        choices: ["Who", "Whoever", "Which", "Whomever", "Whose"], answer: 1,
        explanation: "‘누구든지’ 명사절 주어 → Whoever." },
      { id: "m5", type: "ox", unit: "분사구문", points: 12,
        stem: "‘Being tired, he went to bed.’ 는 ‘As he was tired, …’ 로 바꿀 수 있다.", answer: true,
        explanation: "분사구문 Being tired = As he was tired (이유)." },
    ],
  },
  {
    id: "exam-2606",
    period: "2026-06",
    title: "6월 정기고사 · 수학",
    courseId: "math-calc-2026",
    type: "exam",
    durationMin: 100,
    attempts: 1,
    shuffle: false,
    format: "pdf_omr",
    pdfUrl: "uploads/리뉴젠 아카데미 - Renewjen Academy.pdf",   // 데모용 샘플 PDF (실제로는 시험지 업로드)
    pdfName: "2026_06_정기고사_수학.pdf",
    defaultChoices: 5,
    openAt: "2026-06-12T00:00:00+09:00",
    dueAt: "2026-06-26T23:59:00+09:00",
    instructions: "시험지(PDF)를 보며 오른쪽 OMR 카드에 마킹하세요 · 100분 · 1회 응시 · 단답형(주관식)은 숫자만 입력.",
    omr: [
      { no: 1,  type: "mc", choices: 5, answer: 2, points: 2, unit: "지수·로그", explanation: "①~⑤ 중 ③번." },
      { no: 2,  type: "mc", choices: 5, answer: 4, points: 2, unit: "삼각함수", explanation: "정답 ⑤번." },
      { no: 3,  type: "mc", choices: 5, answer: 0, points: 3, unit: "수열", explanation: "정답 ①번." },
      { no: 4,  type: "mc", choices: 4, answer: 2, points: 3, unit: "극한", explanation: "보기 4개 중 ③번 (4지선다 문항)." },
      { no: 5,  type: "mc", choices: 5, answer: 1, points: 3, unit: "미분", explanation: "정답 ②번." },
      { no: 6,  type: "mc", choices: 5, answer: 3, points: 4, unit: "적분", explanation: "정답 ④번." },
      { no: 7,  type: "mc", choices: 5, answer: 0, points: 4, unit: "도함수의 활용", explanation: "정답 ①번." },
      { no: 8,  type: "mc", choices: 4, answer: 1, points: 4, unit: "정적분의 활용", explanation: "보기 4개 중 ②번." },
      { no: 21, type: "short", answer: "12", points: 3, unit: "수열", explanation: "단답형: 12." },
      { no: 22, type: "short", answer: "8",  points: 4, unit: "적분", explanation: "단답형: 8." },
    ],
  },
];

EXAMS_SEED.length = 0;   // 예시 시험 비움 — 실제 출제로 채웁니다

// 데모: 3·4·5월 정기고사는 이미 응시·채점 완료 상태로 시드 (성적 추이·이력 시연용)
(function seedDemoAttempts() {
  const s = loadExamStore();
  const ensure = (id, attempt) => { if (!s.attempts[id]) s.attempts[id] = attempt; };

  // 3월 수학 — 72점 (q4 오답, 서술형 17/25)
  const m3 = EXAMS_SEED.find((e) => e.id === "exam-2603");
  if (m3 && !s.attempts["exam-2603"]) {
    const answers = { q1: 2, q2: 1, q3: true, q4: "3", q5: "평균값 정리는 구간에서 기울기가 같아지는 점이 존재한다는 정리이다. c=1." };
    const g = autoGrade(m3, answers);
    s.attempts["exam-2603"] = { answers, submittedAt: "2026.03.11 20:10", autoScore: g.autoScore, autoMax: g.autoMax,
      manualScores: { q5: 17 }, manualFeedback: { q5: "정리 서술은 좋으나 c 유도 과정이 일부 생략됨." }, graded: true, leaveCount: 0 };
  }
  // 4월 국어 — 84점 (서술형 19/35)
  const m4 = EXAMS_SEED.find((e) => e.id === "exam-2604");
  if (m4 && !s.attempts["exam-2604"]) {
    const answers = { k1: 1, k2: "false", k3: "3", k4: "1인칭 주인공 시점이라 인물 내면이 잘 드러난다." };
    const g = autoGrade(m4, answers);
    s.attempts["exam-2604"] = { answers, submittedAt: "2026.04.15 21:40", autoScore: g.autoScore, autoMax: g.autoMax,
      manualScores: { k4: 19 }, manualFeedback: { k4: "시점 식별 정확. 효과는 한 가지만 서술돼 일부 감점." }, graded: true, leaveCount: 0 };
  }
  // 5월 영어 — 88점 (m5 오답, 전체 자동채점)
  const m5 = EXAMS_SEED.find((e) => e.id === "exam-2605");
  if (m5 && !s.attempts["exam-2605"]) {
    const answers = { m1: 1, m2: true, m3: "who", m4: 1, m5: false };
    const g = autoGrade(m5, answers);
    s.attempts["exam-2605"] = { answers, submittedAt: "2026.05.13 19:25", autoScore: g.autoScore, autoMax: g.autoMax,
      manualScores: {}, manualFeedback: {}, graded: true, leaveCount: 0 };
  }
  saveExamStore(s);
})();

function getExams() {
  const store = loadExamStore();
  // custom(원격 포함)이 같은 id 의 seed 를 덮어씀
  const byId = {};
  for (const e of EXAMS_SEED) byId[e.id] = e;
  for (const c of (store.custom || [])) byId[c.id] = c;
  return Object.values(byId);
}
function findExam(id) { return getExams().find((e) => e.id === id) || null; }

// 최종 점수(자동+수동) 계산
//  · 서버(exam-serve list / exam-submit)가 이미 계산한 attempt.score 가 있으면 그대로 신뢰
//    (학생용 목록 객체엔 answers/manualScores 원본이 없으므로 이 값이 유일한 근거).
//  · 강사/관리자가 보는 전체 attempt 객체(answers, manualScores 포함)는 기존 방식대로 재계산.
function finalScore(exam, attempt) {
  if (!attempt) return null;
  if (attempt.score != null) return attempt.score;
  let earned = attempt.autoScore || 0;
  const ms = attempt.manualScores || {};
  for (const qid in ms) earned += Number(ms[qid]) || 0;
  return earned;
}

// ── 월별 정기고사 헬퍼 ─────────────────────────────
function examPeriod(e) { return e && e.period ? e.period : null; }
function monthKo(period) { if (!period) return ""; return Number(period.split("-")[1]) + "월"; }
function periodYear(period) { return period ? Number(period.split("-")[0]) : null; }

// 이번 달(응시 가능한) 정기고사 — 없으면 null
function currentExam() {
  const list = getExams().filter((e) => e.type !== "practice" && examPeriod(e) && examStatus(e) === "open");
  list.sort((a, b) => (a.period < b.period ? 1 : -1));
  return list[0] || null;
}

// 정기고사 전체 — 최신월 먼저(desc). 각각 status·점수 포함
function examTimeline() {
  return getExams()
    .filter((e) => e.type !== "practice" && examPeriod(e))
    .map((e) => {
      const at = getAttempt(e.id);
      const total = examTotal(e);
      const score = at && at.submittedAt ? finalScore(e, at) : null;
      return { exam: e, at, total, score, pct: score == null ? null : Math.round((score / total) * 100), status: examStatus(e) };
    })
    .sort((a, b) => (a.exam.period < b.exam.period ? 1 : -1));
}

// 성적 추이(채점완료만) — 오래된 달 먼저(asc)
function scoreTrend() {
  return examTimeline().filter((r) => r.status === "graded" && r.pct != null)
    .sort((a, b) => (a.exam.period < b.exam.period ? -1 : 1));
}

Object.assign(window, {
  loadExamStore, saveExamStore, getAttempt, saveAttempt, resetAttempt,
  autoGrade, autoGradeOmr, examTotal, examQCount, examStatus, mockPercentile, gradeOf,
  getExams, findExam, finalScore, EXAMS_SEED,
  examPeriod, monthKo, periodYear, currentExam, examTimeline, scoreTrend,
});
