/* global window */
// ──────────────────────────────────────────────────────────────────
// 월말평가 성적표 엔진 — ClassIn CSV 파서 + 학생별 분류 + 누적 저장 + 추이
//   · ClassIn 수업별 성적 CSV(Export)를 브라우저에서 직접 파싱
//   · 이름(+소속)으로 학생을 묶어 과목별 점수표를 생성
//   · 업로드 회차를 localStorage에 누적 → 회차별 추이 그래프
// 외부 라이브러리 없음. 전부 순수 JS.
// ──────────────────────────────────────────────────────────────────

const RJ_REPORT_STORE_KEY = "rj_report_store_v2";

// 표준 과목 순서 + 색상
const RJ_SUBJECTS = [
  { id: "국어", color: "#001D3D" },
  { id: "영어", color: "#2A6FDB" },
  { id: "수학", color: "#C0392B" },
  { id: "사회", color: "#C9831A" },
  { id: "과학", color: "#1E8A5B" },
];
const RJ_SUBJECT_KEYS = ["국어", "영어", "수학", "사회", "과학", "한국사", "역사", "도덕", "통합사회", "통합과학"];

// 과목 ID(레벨 접두사·괄호 설명이 붙어 있을 수 있음, 예: "중A 사회 (중2-1)") 안에서
// 표준 과목명을 부분 문자열로 탐지 — 정확히 일치하지 않아도 정렬/색상이 깨지지 않도록 함.
//   NFC로 정규화 후 비교: ClassIn/일부 CSV 내보내기(주로 macOS 경유)는 한글을 NFD(자모 분해)로
//   저장해 "국어"처럼 보여도 코드상 리터럴(NFC)과 바이트가 달라 includes()가 실패한다 —
//   정규화는 비교에만 쓰고, 반환/저장되는 원본 문자열은 그대로 둔다(데이터 비변경).
function rjCanonicalSubject(subjectName) {
  const s = String(subjectName || "").normalize("NFC");
  for (const sub of RJ_SUBJECTS) { if (s.includes(sub.id)) return sub.id; }
  return null;
}
// 과목 정렬 순위: 국어(1) → 영어(2) → 수학(3) → 사회(4) → 과학(5) → 그 외(99, 원래 순서 유지).
function subjectOrder(subjectName) {
  const canon = rjCanonicalSubject(subjectName);
  const i = canon ? RJ_SUBJECTS.findIndex((s) => s.id === canon) : -1;
  return i < 0 ? 99 : i + 1;
}
// 표시용 과목명: 끝에 붙은 괄호 설명("(중2-1)" 등)만 제거. 레벨 접두사("중A ")는 그대로 유지.
// 원본 데이터(저장된 subjects 키)는 절대 변경하지 않는다 — 화면/PDF 표시 시점에만 적용.
function displaySubjectName(id) {
  return String(id || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}

// ── CSV 파서 (따옴표·콤마·개행 처리) ───────────────────────────────
function parseCSV(text) {
  text = String(text).replace(/^\uFEFF/, "");
  const rows = [];
  let row = [], field = "", i = 0, inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ",") { row.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// ── 파일명에서 학년반 + 과목 추출 ─────────────────────────────────
//   "[2026-2] 중A 수학 (중1-2)_20260616093502.csv" → { level:"중A", subject:"수학" }
function parseFileName(name) {
  let base = String(name).replace(/\.csv$/i, "");
  base = base.replace(/_\d{6,}$/, "");               // 끝의 타임스탬프 제거
  const m = base.match(/\]\s*(.+)$/);                 // [2026-2] 접두 제거
  let rest = (m ? m[1] : base).trim();
  return extractLevelSubject(rest);
}

// 임의 문자열(시험제목/단원명/코스명)에서 레벨(중A/고B…)+과목 추출
//   ClassIn 답안카드 푸시는 파일명이 없으므로 활동명에서 뽑는다.
//   예) "중A 수학 월말평가" · "고B 통합과학 6월" → {level, subject}
function extractLevelSubject(rest) {
  rest = String(rest).trim();
  const lm = rest.match(/(중|고|초)\s*[A-Za-z0-9]+/); // 레벨 (중A/중B/고A…)
  const level = lm ? lm[0].replace(/\s+/g, "") : "기타";
  let subject = RJ_SUBJECT_KEYS.find((s) => rest.includes(s)) || rest.replace(level, "").trim() || "기타";
  if (subject === "통합사회") subject = "사회";
  if (subject === "통합과학") subject = "과학";
  return { level, subject, raw: rest };
}

const META_FIRST = /^(student|total score|grades category|average|maximum|minimum|median|std|standard|class|평균|최고|최저|응시|미응시)/i;

// 숫자 파싱 ("87.2%", "36", "-", "")
function num(v) {
  if (v == null) return null;
  const s = String(v).replace(/[%\s]/g, "").trim();
  if (s === "" || s === "-" || s === "–" || s === "—") return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ── 한 수업(CSV) → 학생 점수 목록 ─────────────────────────────────
function parseSubjectRows(rows) {
  if (!rows.length) return { max: 100, students: [] };
  const header = rows[0] || [];
  const assessCols = Math.max(1, header.length - 2); // 2열부터 평가 컬럼
  // 만점: "Total Score" 라벨 행에서
  let max = 100;
  const maxRow = rows.find((r) => (r[0] || "").trim().toLowerCase() === "total score" && (r[1] || "").trim() === "");
  if (maxRow) {
    const mx = maxRow.slice(2).map(num).filter((x) => x != null);
    if (mx.length) max = Math.max(...mx);
  }
  const students = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const first = (row[0] || "").trim();
    if (!first) continue;             // 메타(시간) 행
    if (META_FIRST.test(first)) continue;
    // 평가 컬럼들 → 재시험 등 여러 점수 중 '더 높은 점수' 채택
    const cells = row.slice(2, 2 + assessCols).map(num).filter((x) => x != null);
    const score = cells.length ? Math.max(...cells) : null;
    const pct = num(row[1]);
    const us = first.indexOf("_");
    const studentName = us >= 0 ? first.slice(0, us).trim() : first;
    const org = us >= 0 ? first.slice(us + 1).trim() : null;
    students.push({ name: studentName, org, raw: first, score, pct, attempted: score != null });
  }
  return { max, students };
}

// ── 여러 파일 → 한 회차(round) 객체 ───────────────────────────────
//   files: [{ name, text }]
function buildRound(files, label, opts = {}) {
  const round = {
    id: opts.id || "r-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    label: label || "새 회차",
    createdAt: opts.createdAt || Date.now(),
    seq: opts.seq != null ? opts.seq : Date.now(),
    demo: !!opts.demo,
    students: {},          // key → { name, org, level, subjects:{} }
    subjectsByLevel: {},   // level → Set(subjectId)  (배열로 저장)
    fileCount: files.length,
  };
  const perSubject = []; // {level, subject, max, students:[{key,...}]}
  for (const f of files) {
    const fn = parseFileName(f.name);
    const parsed = parseSubjectRows(parseCSV(f.text));
    const entry = { level: fn.level, subject: fn.subject, max: parsed.max, list: [] };
    for (const s of parsed.students) {
      const key = s.name + "|" + (s.org || "");
      entry.list.push({ key, ...s });
      if (!round.students[key]) round.students[key] = { name: s.name, org: s.org, level: fn.level, subjects: {} };
      // 점수 있는 과목만 등록 (없으면 미응시로 후처리)
      round.students[key].subjects[fn.subject] = {
        score: s.score, max: parsed.max, pct: s.pct, level: fn.level, attempted: s.attempted,
      };
      if (!round.subjectsByLevel[fn.level]) round.subjectsByLevel[fn.level] = [];
      if (!round.subjectsByLevel[fn.level].includes(fn.subject)) round.subjectsByLevel[fn.level].push(fn.subject);
    }
    perSubject.push(entry);
  }
  applySubjectStats(round, perSubject);
  computeOverall(round);
  return round;
}

// 반평균 + 과목별 석차 (CSV·ClassIn 공용)
function applySubjectStats(round, perSubject) {
  for (const e of perSubject) {
    const taken = e.list.filter((x) => x.score != null);
    const avg = taken.length ? taken.reduce((a, b) => a + b.score, 0) / taken.length : 0;
    const sorted = [...taken].sort((a, b) => b.score - a.score);
    for (const x of e.list) {
      const sd = round.students[x.key].subjects[e.subject];
      if (!sd) continue;
      sd.classAvg = Math.round(avg * 10) / 10;
      sd.classN = taken.length;
      sd.rank = x.score != null ? sorted.findIndex((t) => t.key === x.key) + 1 : null;
    }
  }
}

// ── ClassIn 성적 푸시(scores.php rows) → 한 회차(round) ───────────
//   rows: scores.php 의 rows[] (AnswerSheetScore/ExamScore 행)
//   · 학생 식별은 student_uid(가장 안전) → 동명이인도 안전하게 분리
//   · 레벨/과목은 activity_name·unit_name·course_name 에서 추출
function buildRoundFromClassIn(rows, label, opts = {}) {
  const round = {
    id: opts.id || "ci-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    label: label || "새 회차",
    createdAt: opts.createdAt || Date.now(),
    seq: opts.seq != null ? opts.seq : Date.now(),
    demo: false,
    source: "classin",
    students: {},
    subjectsByLevel: {},
    fileCount: 0,
  };
  // 시험(활동)별로 묶기 — 한 활동 = 한 레벨의 한 과목 시험
  const byActivity = {};
  for (const r of rows) (byActivity[r.activity_id] = byActivity[r.activity_id] || []).push(r);
  round.fileCount = Object.keys(byActivity).length;

  const perSubject = [];
  for (const aid in byActivity) {
    const list = byActivity[aid];
    const first = list[0];
    const meta = extractLevelSubject(
      [first.activity_name, first.unit_name, first.course_name].filter(Boolean).join(" ")
    );
    const maxes = list.map((x) => Number(x.max_score)).filter((n) => n > 0);
    const max = maxes.length ? Math.max(...maxes) : 100;
    const entry = { level: meta.level, subject: meta.subject, max, list: [] };

    for (const s of list) {
      const key = "uid:" + (s.student_uid || s.student_name);
      const score = s.score != null && s.score !== "" ? Number(s.score) : null;
      const pct = s.scoring_rate != null && s.scoring_rate !== ""
        ? Math.round(Number(s.scoring_rate) * 1000) / 10
        : (score != null && max ? Math.round((score / max) * 1000) / 10 : null);

      entry.list.push({ key, name: s.student_name || "(이름없음)", org: s.course_name || null, score, pct, attempted: score != null });
      if (!round.students[key]) {
        round.students[key] = {
          name: s.student_name || "(이름없음)", org: s.course_name || null, level: meta.level,
          uid: s.student_uid || null, memberId: s.member_id || null, subjects: {},
        };
      }
      round.students[key].subjects[meta.subject] = { score, max, pct, level: meta.level, attempted: score != null };
      if (!round.subjectsByLevel[meta.level]) round.subjectsByLevel[meta.level] = [];
      if (!round.subjectsByLevel[meta.level].includes(meta.subject)) round.subjectsByLevel[meta.level].push(meta.subject);
    }
    perSubject.push(entry);
  }
  applySubjectStats(round, perSubject);
  computeOverall(round);
  return round;
}

// 학생별 총점/평균 + 레벨 내 석차
function computeOverall(round) {
  const byLevel = {};
  for (const key in round.students) {
    const st = round.students[key];
    const scores = Object.values(st.subjects).map((s) => s.score).filter((x) => x != null);
    st.avg = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null;
    st.total = scores.length ? scores.reduce((a, b) => a + b, 0) : null;
    st.taken = scores.length;
    (byLevel[st.level] = byLevel[st.level] || []).push(st);
  }
  for (const lv in byLevel) {
    const cohort = byLevel[lv].filter((s) => s.avg != null).sort((a, b) => b.avg - a.avg);
    byLevel[lv].forEach((s) => {
      s.cohortN = cohort.length;
      s.cohortAvg = cohort.length ? Math.round((cohort.reduce((a, b) => a + b.avg, 0) / cohort.length) * 10) / 10 : null;
      s.rankOverall = s.avg != null ? cohort.findIndex((c) => c === s) + 1 : null;
    });
  }
  return round;
}

// ── 저장소 (localStorage) ─────────────────────────────────────────
function loadStore() {
  try {
    const raw = localStorage.getItem(RJ_REPORT_STORE_KEY);
    if (!raw) return { rounds: [] };
    const s = JSON.parse(raw);
    return s && Array.isArray(s.rounds) ? s : { rounds: [] };
  } catch (e) { return { rounds: [] }; }
}
function saveStore(store) {
  try { localStorage.setItem(RJ_REPORT_STORE_KEY, JSON.stringify(store)); } catch (e) {}
  return store;
}
function sortedRounds(store) {
  return [...(store.rounds || [])].sort((a, b) => a.seq - b.seq);
}
function clearStore() { return saveStore({ rounds: [] }); }

function addRound(round) {
  const store = loadStore();
  store.rounds.push(round);
  return saveStore(store);
}
function removeRound(id) {
  const store = loadStore();
  store.rounds = store.rounds.filter((r) => r.id !== id);
  return saveStore(store);
}

// ── 같은 라벨 회차에 병합 (같은 이름으로 업로드 시 새 회차 대신 기존에 추가) ──
const _normLabel = (s) => String(s || "").trim();
function findRoundByLabel(store, label) {
  const n = _normLabel(label);
  return (store.rounds || []).find((r) => _normLabel(r.label) === n) || null;
}

// 과목별(레벨+과목) 반평균·인원·석차를 round.students 로부터 다시 계산
//   (병합 후 두 배치가 합쳐진 상태에서도 올바른 통계가 나오도록)
function recomputeStats(round) {
  const groups = {};   // `${level}::${subject}` → [{ key, score, sd }]
  for (const key in round.students) {
    const st = round.students[key];
    for (const subj in st.subjects) {
      const sd = st.subjects[subj];
      const gk = (sd.level || st.level) + "::" + subj;
      (groups[gk] = groups[gk] || []).push({ key, score: sd.score, sd });
    }
  }
  for (const gk in groups) {
    const list = groups[gk];
    const taken = list.filter((x) => x.score != null);
    const avg = taken.length ? taken.reduce((a, b) => a + b.score, 0) / taken.length : 0;
    const sorted = [...taken].sort((a, b) => b.score - a.score);
    for (const x of list) {
      x.sd.classAvg = Math.round(avg * 10) / 10;
      x.sd.classN = taken.length;
      x.sd.rank = x.score != null ? sorted.findIndex((t) => t.key === x.key) + 1 : null;
    }
  }
  computeOverall(round);
  return round;
}

// source 회차의 학생·과목을 target 회차로 병합 (같은 과목은 새 값으로 교체, 새 과목은 추가)
function mergeRoundInto(target, source) {
  for (const k in source.students) {
    const ss = source.students[k];
    if (!target.students[k]) target.students[k] = { name: ss.name, org: ss.org, level: ss.level, subjects: {} };
    for (const subj in ss.subjects) target.students[k].subjects[subj] = ss.subjects[subj];
  }
  for (const lv in source.subjectsByLevel) {
    target.subjectsByLevel[lv] = target.subjectsByLevel[lv] || [];
    for (const subj of source.subjectsByLevel[lv]) {
      if (!target.subjectsByLevel[lv].includes(subj)) target.subjectsByLevel[lv].push(subj);
    }
  }
  target.fileCount = (target.fileCount || 0) + (source.fileCount || 0);
  return recomputeStats(target);
}

// 같은 라벨 회차가 있으면 병합, 없으면 새로 추가. { round, merged } 반환.
function addOrMergeRound(newRound) {
  const store = loadStore();
  const existing = findRoundByLabel(store, newRound.label);
  if (existing) {
    mergeRoundInto(existing, newRound);
    saveStore(store);
    return { round: existing, merged: true };
  }
  store.rounds.push(newRound);
  saveStore(store);
  return { round: newRound, merged: false };
}

// ── 분기(quarter) ───────────────────────────────────────────────
//   정규 월말평가 분기: 1·2·3월=1분기, 5·6·7월=2분기, 9·10·11월=3분기.
//   4·8·12월은 정규 월말평가 대상 외(분기 없음·null).
const RJ_QUARTER_MONTHS = { 1: [1, 2, 3], 2: [5, 6, 7], 3: [9, 10, 11] };
function monthToQuarter(month) {
  const m = Number(month);
  for (const q in RJ_QUARTER_MONTHS) if (RJ_QUARTER_MONTHS[q].includes(m)) return Number(q);
  return null;
}
// 오늘 날짜 기준 "자연스러운 기본 분기" — 1~4월→1분기, 5~8월→2분기, 9~12월→3분기.
function defaultQuarterForMonth(month) {
  const m = Number(month);
  if (m <= 4) return 1;
  if (m <= 8) return 2;
  return 3;
}
// round.label(예: "2026 · 5월 월말평가")에서 연도·월을 뽑는다. label에 없으면
// createdAt/seq(타임스탬프)로 보완 — 기존 데이터(quarter 필드 없음)도 월만 보고
// 자동으로 분기가 판별되도록 한다. DB/저장 구조는 그대로 두고 조회 시점에만 계산.
function roundDateInfo(round) {
  const label = String((round && round.label) || "");
  const my = label.match(/(\d{1,2})\s*월/);
  const yy = label.match(/(\d{4})/);
  const d = new Date((round && (round.createdAt || round.seq)) || Date.now());
  const month = my ? Number(my[1]) : d.getMonth() + 1;
  const year = yy ? Number(yy[1]) : d.getFullYear();
  return { year, month, quarter: monthToQuarter(month) };
}
function sameQuarter(round, quarterKey) {
  if (!quarterKey) return true;
  const d = roundDateInfo(round);
  return d.year === quarterKey.year && d.quarter === quarterKey.quarter;
}

// ── 발급일(issueDate) ───────────────────────────────────────────
//   round마다 독립적으로 저장되는 성적표 발급일. 관리자가 지정하지 않았으면
//   (기존 데이터 호환) 회차 생성 시각(createdAt)을 그대로 발급일로 쓴다.
function toYMD(ts) {
  const d = new Date(ts || Date.now());
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
// round.issueDate("YYYY-MM-DD")가 있으면 그 값을, 없으면 createdAt 기준 날짜를 돌려준다.
//   성적표 화면·PDF·학생 본인 화면이 전부 이 값 하나만 소스로 쓰도록 한다.
function roundIssueYMD(round) {
  if (round && typeof round.issueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(round.issueDate)) return round.issueDate;
  return toYMD(round && (round.createdAt || round.seq));
}
// "YYYY-MM-DD" → "YYYY.MM.DD." (성적표 표시용)
function fmtIssueDateDisplay(ymd) {
  const m = String(ymd || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}.${m[2]}.${m[3]}.` : "";
}

// ── 학생 추이 (회차별 평균 + 과목별 점수) ──────────────────────────
//   uptoSeq 를 주면 그 회차까지만(이전 회차 누적) 반환 — 5월을 보면 6월이 안 나오게.
//   quarterKey({year,quarter})를 주면 같은 분기(동일 연도+분기)의 회차만 남긴다 —
//   분기가 바뀌면 누적표·그래프·전월대비가 그 분기 기준으로 새로 시작하게 하기 위함.
function studentTrend(store, key, uptoSeq, quarterKey) {
  return sortedRounds(store)
    .filter((r) => r.students[key])
    .filter((r) => uptoSeq == null || r.seq <= uptoSeq)
    .filter((r) => sameQuarter(r, quarterKey))
    .map((r) => {
      const st = r.students[key];
      const subjects = {};
      for (const sid in st.subjects) subjects[sid] = st.subjects[sid].score;
      // 평균은 저장값(st.avg) 대신 실제 과목 점수로 재계산 — 옛 데이터의 stale 집계 방지
      const vals = Object.values(subjects).filter((x) => x != null).map(Number);
      const avg = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
      return { roundId: r.id, label: r.label, shortLabel: shortLabel(r.label), avg, subjects };
    });
}
function shortLabel(label) {
  const m = String(label).match(/(\d+)\s*월/);
  return m ? m[1] + "월" : label;
}

// 학생 전체 목록 (특정 회차) — 정렬/검색용
function rosterOf(round) {
  return Object.entries(round.students).map(([key, st]) => ({ key, ...st }));
}

// ── 데모 데이터 (3회차, 우상향 추이) ───────────────────────────────
function seededRand(seed) {
  let s = 0; for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const DEMO_ROSTER = {
  "중A": [["박종하", "본부"], ["염하은", "아미"], ["장민", "그레이스"], ["서승민", "본부"], ["김도윤", null], ["이서연", "새벽이슬"], ["정하준", null], ["오세아", "홈스쿨"]],
  "중B": [["박은혜", null], ["김하윤", "아미"], ["최우진", "본부"], ["한지우", "홈스쿨"], ["윤서아", null], ["신예준", "그레이스"], ["조하준", null]],
  "고A": [["전하은", "본부"], ["오지훈", null], ["강예린", "그레이스"], ["임수호", "본부"], ["송가은", "새벽이슬"], ["배진우", null], ["노아름", "아미"]],
};

function genDemoStore() {
  const labels = ["2026 · 3월 월말평가", "2026 · 4월 월말평가", "2026 · 5월 월말평가"];
  const rounds = [];
  const base = Date.now() - 1000 * 60 * 60 * 24 * 70;
  labels.forEach((label, ri) => {
    const files = [];
    for (const level in DEMO_ROSTER) {
      const roster = DEMO_ROSTER[level];
      for (const subj of ["국어", "영어", "수학", "사회", "과학"]) {
        const rnd = seededRand(level + subj + "x");
        const header = `Student,Total Score,"${subj} 월말평가"\n , ,"5월 월말평가"\n ,Start Time,"5月20日 08:10"\n ,End Time,"5月20日 22:59"\nTotal Score, ,100\nGrades Category, ,-\n`;
        let body = "";
        roster.forEach(([nm, org], si) => {
          const r2 = seededRand(nm + (org || "") + subj);
          const ability = 52 + Math.floor(r2() * 44);          // 학생·과목 기본기 52~96
          const growth = ri * (3 + Math.floor(r2() * 6));        // 회차마다 상승
          const noise = Math.floor((rnd() - 0.5) * 12);
          let sc = Math.max(18, Math.min(100, ability - 14 + growth + noise));
          const full = name => `"${name}"`;
          const disp = org ? `${nm}_${org}` : nm;
          body += `${full(disp)},${sc}%,${sc}\n`;
        });
        files.push({ name: `[2026-2] ${level} ${subj}_2026000000${ri}.csv`, text: header + body });
      }
    }
    const round = buildRound(files, label, { demo: true, seq: base + ri * 1000000, createdAt: base + ri * 1000000, id: "demo-" + ri });
    rounds.push(round);
  });
  return saveStore({ rounds });
}

// ── ClassIn 백엔드 연동 ────────────────────────────────────────────
//   기본: Supabase Edge Function(classin-scores) 을 호출합니다.
//   구(舊) Cafe24 PHP(scores.php) 로 강제하려면 window.RJ_CLASSIN_API 지정:
//     <script>window.RJ_CLASSIN_API='https://renewgenacademy.com/classin/api'</script>
const RJ_CLASSIN_API = (typeof window !== "undefined" && window.RJ_CLASSIN_API) || "";
const RJ_CLASSIN_MODE = RJ_CLASSIN_API ? "php" : "supabase";

// path 예: "/scores.php?action=activities&cmd=..." — Supabase 모드에선 쿼리만 사용
async function ciFetch(path) {
  if (RJ_CLASSIN_MODE === "supabase") {
    const base = (typeof window !== "undefined" && window.SUPABASE_URL) || "";
    if (!base) throw new Error("SUPABASE_URL 미설정");
    const qi = path.indexOf("?");
    const qs = qi >= 0 ? path.slice(qi) : "";
    // 로그인한 관리자 JWT 를 실어 보냄(함수가 관리자 권한을 검증)
    let bearer = (typeof window !== "undefined" && window.SUPABASE_ANON_KEY) || "";
    try {
      const sb = window.getSupabase && window.getSupabase();
      const { data: { session } } = await sb.auth.getSession();
      if (session && session.access_token) bearer = session.access_token;
    } catch (e) { /* 세션 없으면 anon 키로 시도 → 401 */ }
    const res = await fetch(base + "/functions/v1/classin-scores" + qs, {
      headers: {
        Accept: "application/json",
        Authorization: "Bearer " + bearer,
        apikey: (typeof window !== "undefined" && window.SUPABASE_ANON_KEY) || "",
      },
    });
    if (!res.ok) {
      let msg = "HTTP " + res.status;
      try { const ej = await res.json(); if (ej && ej.msg) msg = ej.msg; } catch (e) {}
      throw new Error(msg);
    }
    const j = await res.json();
    if (j && j.ok === false) throw new Error(j.msg || "server error");
    return j;
  }
  // 구 PHP 모드
  const res = await fetch(RJ_CLASSIN_API + path, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const j = await res.json();
  if (j && j.ok === false) throw new Error(j.msg || "server error");
  return j;
}
// 회차 선택용 — 성적이 들어온 시험(활동) 목록
async function fetchClassInActivities(cmd = "AnswerSheetScore") {
  const j = await ciFetch("/scores.php?action=activities&cmd=" + encodeURIComponent(cmd));
  return j.activities || [];
}
// 선택한 시험들의 학생별 성적 행
async function fetchClassInScores({ ids, since, cmd = "AnswerSheetScore" } = {}) {
  const q = new URLSearchParams({ action: "rows", cmd });
  if (ids && ids.length) q.set("ids", ids.join(","));
  if (since) q.set("since", since);
  const j = await ciFetch("/scores.php?" + q.toString());
  return j.rows || [];
}

// 백엔드가 아직 안 붙은 환경(프로토타입)에서 자동 동기화 "결과 미리보기"용
// scores.php 가 돌려줄 AnswerSheetScore rows 와 동일한 모양으로 시뮬레이션한다.
function simulateClassInRows(roundIndex = 0) {
  const rows = [];
  const baseTs = Math.floor((Date.now() - (2 - roundIndex) * 1000 * 60 * 60 * 24 * 30) / 1000);
  let levelBase = 27890000;
  for (const level in DEMO_ROSTER) {
    const roster = DEMO_ROSTER[level];
    // 학생 1명 = UID 1개 (과목이 달라도 동일인) — 실제 클래스인도 StudentUid 는 고정
    const uids = roster.map((_, si) => String(levelBase + si * 7));
    ["국어", "영어", "수학", "사회", "과학"].forEach((subj) => {
      const activityId = "act-" + level + "-" + subj + "-" + roundIndex;
      const rnd = seededRand(level + subj + "sim");
      roster.forEach(([nm, org], si) => {
        const r2 = seededRand(nm + (org || "") + subj);
        const ability = 52 + Math.floor(r2() * 44);
        const growth = roundIndex * (3 + Math.floor(r2() * 6));
        const noise = Math.floor((rnd() - 0.5) * 12);
        const sc = Math.max(18, Math.min(100, ability - 14 + growth + noise));
        rows.push({
          cmd: "AnswerSheetScore",
          course_id: "course-" + level,
          course_name: level,
          unit_id: "unit-" + roundIndex,
          unit_name: "월말평가",
          activity_id: activityId,
          activity_name: `${level} ${subj} 월말평가`,
          class_id: "0",
          student_uid: uids[si],
          student_name: nm,
          student_account: "010" + String(10000000 + (Number(uids[si]) % 8999999)),
          member_id: null,
          max_score: 100,
          score: sc,
          scoring_rate: sc / 100,
          topics: null,
          submitted_at: new Date(baseTs * 1000).toISOString().slice(0, 19).replace("T", " "),
          corrected_at: new Date(baseTs * 1000).toISOString().slice(0, 19).replace("T", " "),
        });
      });
    });
    levelBase += 1000;
  }
  return rows;
}

window.RJReport = {
  STORE_KEY: RJ_REPORT_STORE_KEY,
  CLASSIN_API: RJ_CLASSIN_API,
  SUBJECTS: RJ_SUBJECTS, SUBJECT_KEYS: RJ_SUBJECT_KEYS,
  QUARTER_MONTHS: RJ_QUARTER_MONTHS,
  parseCSV, parseFileName, extractLevelSubject, parseSubjectRows, buildRound, buildRoundFromClassIn,
  loadStore, saveStore, clearStore, addRound, removeRound,
  findRoundByLabel, addOrMergeRound, mergeRoundInto, recomputeStats,
  sortedRounds, studentTrend, rosterOf, shortLabel, genDemoStore,
  fetchClassInActivities, fetchClassInScores, simulateClassInRows,
  monthToQuarter, defaultQuarterForMonth, roundDateInfo, sameQuarter,
  toYMD, roundIssueYMD, fmtIssueDateDisplay,
  subjectOrder, displaySubjectName, canonicalSubject: rjCanonicalSubject,
};
