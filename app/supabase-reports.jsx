/* global window */
// ─────────────────────────────────────────────────────────────────
//  성적표 — Supabase 동기화
//   · 회차/학생/점수/총평을 클라우드에 저장 → 어떤 컴퓨터·브라우저에서든 공유
//   · 로컬스토리지는 캐시로 유지 (오프라인·즉시 응답)
//   · 흐름:
//       페이지 로드 → pullAllFromCloud() → 로컬 캐시 교체 → React 상태 갱신
//       편집/추가/삭제 → 로컬 저장 즉시 + 클라우드 push (fire-and-forget)
//
//   미배포(Supabase 미연결) 시: 모든 함수가 조용히 no-op → 기존 로컬 동작 유지
//   필요한 SQL: classin-backend/db/supabase-reports.sql 를 1회 실행
// ─────────────────────────────────────────────────────────────────

function _rjSb() { return window.getSupabase && window.getSupabase(); }

// ── 회차 ─────────────────────────────────────────────────────────
async function rjPullRoundsFromCloud() {
  const sb = _rjSb(); if (!sb) return { ok: false, rounds: null };
  try {
    const { data, error } = await sb.from("report_rounds").select("id,label,seq,source,demo,created_at,data").order("seq", { ascending: true });
    if (error) return { ok: false, error: error.message };
    const rounds = (data || []).map((r) => ({
      id: r.id, label: r.label, seq: r.seq, source: r.source || undefined, demo: !!r.demo,
      createdAt: r.created_at ? new Date(r.created_at).getTime() : (r.seq || 0),
      students: (r.data && r.data.students) || {},
      subjectsByLevel: (r.data && r.data.subjectsByLevel) || {},
      issueDate: (r.data && r.data.issueDate) || null,
    }));
    return { ok: true, rounds };
  } catch (e) { return { ok: false, error: String(e) }; }
}

async function rjPushRoundToCloud(round) {
  const sb = _rjSb(); if (!sb || !round) return { ok: false };
  try {
    const row = {
      id: round.id,
      label: round.label || "",
      seq: round.seq || Math.floor(round.createdAt || Date.now()),
      source: round.source || null,
      demo: !!round.demo,
      created_at: round.createdAt ? new Date(round.createdAt).toISOString() : new Date().toISOString(),
      // issueDate는 새 컬럼을 만들지 않고 기존 data(jsonb)에 함께 싣는다 — 스키마 변경 없이
      // round별로 귀속된 값을 그대로 클라우드에 왕복시킬 수 있다.
      data: { students: round.students || {}, subjectsByLevel: round.subjectsByLevel || {}, issueDate: round.issueDate || null },
    };
    const { error } = await sb.from("report_rounds").upsert(row, { onConflict: "id" });
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

async function rjDeleteRoundFromCloud(roundId) {
  const sb = _rjSb(); if (!sb || !roundId) return { ok: false };
  try {
    const { error } = await sb.from("report_rounds").delete().eq("id", roundId);
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

async function rjWipeAllRoundsFromCloud() {
  const sb = _rjSb(); if (!sb) return { ok: false };
  try {
    // Supabase 는 빈 where 의 delete 를 거부 → 임의 조건으로 전체 삭제
    const { error } = await sb.from("report_rounds").delete().neq("id", "__never__");
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// ── 담임 총평 ────────────────────────────────────────────────────
async function rjPullCommentsFromCloud() {
  const sb = _rjSb(); if (!sb) return { ok: false, comments: null };
  try {
    const { data, error } = await sb.from("report_comments").select("round_id,student_key,comment");
    if (error) return { ok: false, error: error.message };
    const comments = {};
    for (const r of data || []) comments[r.round_id + "|" + r.student_key] = r.comment;
    return { ok: true, comments };
  } catch (e) { return { ok: false, error: String(e) }; }
}

async function rjPushCommentToCloud(roundId, studentKey, comment) {
  const sb = _rjSb(); if (!sb || !roundId || !studentKey) return { ok: false };
  try {
    if (comment == null || String(comment).trim() === "") {
      const { error } = await sb.from("report_comments").delete().eq("round_id", roundId).eq("student_key", studentKey);
      return error ? { ok: false, error: error.message } : { ok: true, deleted: true };
    }
    const { error } = await sb.from("report_comments").upsert({ round_id: roundId, student_key: studentKey, comment }, { onConflict: "round_id,student_key" });
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

async function rjPushAllCommentsToCloud(comments) {
  const sb = _rjSb(); if (!sb) return { ok: false };
  const rows = [];
  for (const k in (comments || {})) {
    const idx = k.indexOf("|"); if (idx < 0) continue;
    const txt = comments[k]; if (txt == null || String(txt).trim() === "") continue;
    rows.push({ round_id: k.slice(0, idx), student_key: k.slice(idx + 1), comment: String(txt) });
  }
  if (!rows.length) return { ok: true, n: 0 };
  try {
    const { error } = await sb.from("report_comments").upsert(rows, { onConflict: "round_id,student_key" });
    return error ? { ok: false, error: error.message } : { ok: true, n: rows.length };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// ── 전체 동기화 (페이지 로드 시) ─────────────────────────────────
//   클라우드 → 로컬 캐시 교체. 클라우드가 비어 있으면 로컬은 그대로 유지(업로드 대기).
async function rjSyncReportsFromCloud() {
  const sb = _rjSb(); if (!sb) return { ok: false, available: false };
  const [r, c] = await Promise.all([rjPullRoundsFromCloud(), rjPullCommentsFromCloud()]);
  if (r.ok && Array.isArray(r.rounds)) {
    try { localStorage.setItem("rj_report_store_v2", JSON.stringify({ rounds: r.rounds })); } catch (e) {}
  }
  if (c.ok && c.comments) {
    try { localStorage.setItem("rj_report_comments_v2", JSON.stringify(c.comments)); } catch (e) {}
  }
  return { ok: true, available: true, roundsLoaded: r.ok ? r.rounds.length : 0, commentsLoaded: c.ok ? Object.keys(c.comments || {}).length : 0 };
}

// ── 로컬 → 클라우드 일괄 백업 (최초 1회 이관용) ──────────────────
async function rjBackupLocalToCloud() {
  const sb = _rjSb(); if (!sb) return { ok: false, available: false };
  let store = { rounds: [] }, comments = {};
  try { store = JSON.parse(localStorage.getItem("rj_report_store_v2") || '{"rounds":[]}'); } catch (e) {}
  try { comments = JSON.parse(localStorage.getItem("rj_report_comments_v2") || "{}"); } catch (e) {}
  let pushed = 0, failed = 0;
  for (const r of store.rounds || []) {
    const res = await rjPushRoundToCloud(r);
    if (res.ok) pushed++; else failed++;
  }
  const cRes = await rjPushAllCommentsToCloud(comments);
  return { ok: true, available: true, roundsPushed: pushed, roundsFailed: failed, commentsPushed: cRes.n || 0 };
}

Object.assign(window, {
  rjPullRoundsFromCloud, rjPushRoundToCloud, rjDeleteRoundFromCloud, rjWipeAllRoundsFromCloud,
  rjPullCommentsFromCloud, rjPushCommentToCloud, rjPushAllCommentsToCloud,
  rjSyncReportsFromCloud, rjBackupLocalToCloud,
});
