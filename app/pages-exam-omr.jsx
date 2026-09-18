/* global React, Icon, CiHead, findCourse, findInstructor, useApp */
// ──────────────────────────────────────────────────────────────────
//  학생 — PDF 시험지 + 디지털 OMR 카드 응시 / 결과
//  시험지는 PDF로 보고, 답만 OMR 카드에 마킹 → 정답표와 자동 대조 채점
// ──────────────────────────────────────────────────────────────────
const { useState: useStOmr, useEffect: useEfOmr, useRef: useRfOmr } = React;

const OMR_BUBBLES = ["①", "②", "③", "④", "⑤", "⑥", "⑦"];

function omrPdfSrc(url) {
  if (!url) return "";
  // 업로드된 data: URL 은 그대로, 경로는 인코딩 + 뷰어 옵션
  if (/^data:|^blob:/.test(url)) return url;
  return encodeURI(url) + "#toolbar=1&view=FitH";
}

// ── 응시 화면 ───────────────────────────────────────────────────────
//  구조형과 마찬가지로 exam-serve?action=take 로 정답 없는 OMR 문항만 받아온다.
function OmrRunner({ examId, onDone, onExit }) {
  const { showToast } = useApp();
  const [exam, setExam] = useStOmr(null);
  const [loadErr, setLoadErr] = useStOmr("");
  const [answers, setAnswers] = useStOmr({});
  const [left, setLeft] = useStOmr(null);
  const [leaveCount, setLeaveCount] = useStOmr(0);
  const [confirming, setConfirming] = useStOmr(false);
  const [submitting, setSubmitting] = useStOmr(false);
  const submittedRef = useRfOmr(false);

  useEfOmr(() => {
    let alive = true;
    setExam(null); setLoadErr(""); setAnswers({}); submittedRef.current = false;
    window.fetchExamForTaking(examId).then((r) => {
      if (!alive) return;
      if (!r.ok) { setLoadErr(r.msg || "시험을 불러오지 못했습니다"); return; }
      setExam(r.exam);
      setLeft(r.exam.durationMin ? r.exam.durationMin * 60 : null);
    });
    return () => { alive = false; };
  }, [examId]);

  useEfOmr(() => {
    if (left == null) return;
    if (left <= 0) { doSubmit(); return; }
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  useEfOmr(() => {
    const onHide = () => { if (document.hidden && !submittedRef.current) { setLeaveCount((c) => c + 1); showToast && showToast("⚠️ 시험 중 화면을 벗어났습니다 — 기록됩니다"); } };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  if (loadErr) {
    return (
      <div className="ci-card ci-card-pad" style={{ textAlign: "center", padding: 48, color: "var(--ci-muted)" }}>
        {loadErr}<button className="ci-act" style={{ marginLeft: 8 }} onClick={onExit}>목록으로</button>
      </div>
    );
  }
  if (!exam) return <div className="ci-card ci-card-pad" style={{ textAlign: "center", padding: 48, color: "var(--ci-muted)" }}>불러오는 중…</div>;

  const items = exam.omr || [];
  const setA = (no, v) => setAnswers((a) => ({ ...a, [no]: v }));
  const answeredN = items.filter((it) => answers[it.no] != null && answers[it.no] !== "").length;

  async function doSubmit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    const r = await window.submitExamAnswers(examId, answers, leaveCount);
    setSubmitting(false);
    if (!r.ok) { showToast && showToast(r.msg || "제출에 실패했습니다"); submittedRef.current = false; return; }
    window.applyAttemptFromServer(examId, {
      answers, submittedAt: r.submittedAt, autoScore: r.autoScore, autoMax: r.autoMax,
      needsManual: r.needsManual, graded: r.graded, score: r.score, per: r.per, leaveCount, omr: true,
    });
    onDone();
  }

  const mm = left == null ? null : String(Math.floor(left / 60)).padStart(2, "0");
  const ss = left == null ? null : String(left % 60).padStart(2, "0");
  const lowTime = left != null && left <= 60;
  const course = findCourse(exam.courseId);

  return (
    <div>
      {/* 상단 바 */}
      <div className="ci-card" style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap", position: "sticky", top: 8, zIndex: 6 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: "-0.02em" }}>{exam.title}</div>
          <div style={{ fontSize: 12, color: "var(--ci-muted)" }}>{course?.title} · {answeredN} / {items.length} 마킹 · {window.examTotal(exam)}점</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {leaveCount > 0 && <span className="ci-badge bad" style={{ fontSize: 10.5 }}>화면 이탈 {leaveCount}회</span>}
          {left != null && (
            <span style={{ fontFamily: "var(--font-en)", fontWeight: 800, fontSize: 22, color: lowTime ? "var(--ci-bad)" : "var(--ci-navy)", background: lowTime ? "rgba(200,40,40,0.08)" : "var(--ci-bg-2)", padding: "4px 12px", borderRadius: 8 }}>
              <Icon name="clock" size={14} /> {mm}:{ss}
            </span>
          )}
          <button className="ci-act navy" onClick={() => setConfirming(true)}><Icon name="check" size={13} /> 제출</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 360px", gap: 16, alignItems: "start" }}>
        {/* PDF 시험지 */}
        <div className="ci-card" style={{ overflow: "hidden", padding: 0 }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--ci-line)", display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="folder" size={14} /><strong style={{ fontSize: 13 }}>{exam.pdfName || "시험지.pdf"}</strong>
            <span className="ci-badge neutral" style={{ marginLeft: "auto", fontSize: 10.5 }}>시험지 (PDF)</span>
          </div>
          {exam.pdfUrl
            ? <iframe title="시험지" src={omrPdfSrc(exam.pdfUrl)} style={{ width: "100%", height: "calc(100vh - 220px)", minHeight: 560, border: 0, display: "block", background: "#525659" }} />
            : <div style={{ height: 560, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ci-muted)", fontSize: 14 }}>업로드된 시험지 PDF가 여기에 표시됩니다</div>}
        </div>

        {/* OMR 카드 */}
        <div className="ci-card" style={{ padding: 0, position: "sticky", top: 84, overflow: "hidden" }}>
          <div style={{ background: "var(--ci-navy)", color: "#fff", padding: "12px 16px", textAlign: "center", letterSpacing: "0.08em" }}>
            <div style={{ fontWeight: 900, fontSize: 14, fontFamily: "var(--font-en)" }}>OMR ANSWER SHEET</div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>답안카드 · 정확히 마킹하세요</div>
          </div>
          <div style={{ maxHeight: "calc(100vh - 290px)", overflowY: "auto", padding: "10px 14px 16px" }}>
            {items.map((it) => {
              const n = it.choices || exam.defaultChoices || 5;
              const a = answers[it.no];
              return (
                <div key={it.no} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 4px", borderBottom: "1px solid var(--ci-line)" }}>
                  <span style={{ width: 26, textAlign: "right", fontFamily: "var(--font-en)", fontWeight: 800, fontSize: 14, color: "var(--ci-navy)" }}>{it.no}</span>
                  {it.type === "short" ? (
                    <input value={a || ""} onChange={(e) => setA(it.no, e.target.value)} placeholder="주관식 답"
                      style={{ flex: 1, height: 34, borderRadius: 6, border: "1px solid var(--ci-line)", padding: "0 10px", fontSize: 14, fontFamily: "var(--font-en)" }} />
                  ) : (
                    <div style={{ display: "flex", gap: 6, flex: 1 }}>
                      {Array.from({ length: n }, (_, i) => {
                        const on = a === i;
                        return (
                          <button key={i} onClick={() => setA(it.no, i)} title={"보기 " + (i + 1)}
                            style={{ width: 30, height: 30, borderRadius: "50%", cursor: "pointer", fontSize: 14, fontWeight: 700,
                              border: "1.5px solid " + (on ? "var(--ci-navy)" : "var(--ci-line)"),
                              background: on ? "var(--ci-navy)" : "var(--ci-paper)", color: on ? "#fff" : "var(--ci-muted)", transition: "all .1s" }}>
                            {OMR_BUBBLES[i]}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ padding: "12px 14px", borderTop: "1px solid var(--ci-line)", display: "flex", gap: 8 }}>
            <button className="ci-act" style={{ flex: 1, justifyContent: "center" }} onClick={onExit}>나가기</button>
            <button className="ci-act navy" style={{ flex: 2, justifyContent: "center" }} onClick={() => setConfirming(true)}><Icon name="check" size={13} /> 제출하기</button>
          </div>
        </div>
      </div>

      {confirming && (
        <div onClick={() => setConfirming(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,12,28,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div className="ci-card ci-card-pad" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380, width: "90%" }}>
            <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>제출하시겠어요?</div>
            <p style={{ fontSize: 13.5, color: "var(--ci-muted)", lineHeight: 1.6, margin: "0 0 18px" }}>
              {items.length - answeredN > 0 ? <>아직 <strong style={{ color: "var(--ci-bad)" }}>{items.length - answeredN}문항</strong>이 비어 있습니다. </> : "모든 문항을 마킹했습니다. "}
              제출 후에는 수정할 수 없습니다.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="ci-act" onClick={() => setConfirming(false)} disabled={submitting}>계속 풀기</button>
              <button className="ci-act navy" onClick={doSubmit} disabled={submitting} style={{ opacity: submitting ? 0.6 : 1 }}>
                <Icon name="check" size={13} /> {submitting ? "제출 중…" : "제출"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 결과 화면 ───────────────────────────────────────────────────────
//  제출 직후: exam-serve?action=result 로 점수/맞고틀림만(정답 없이) 받는다.
//  dueAt 경과 후 "정답 보기"를 누르면 그 순간 action=review 를 다시 호출한다.
function OmrResult({ examId, onBack }) {
  const { showToast } = useApp();
  const [data, setData] = useStOmr(null);   // { exam, attempt, reviewAvailable }
  const [err, setErr] = useStOmr("");
  const [reveal, setReveal] = useStOmr(null);
  const [revealing, setRevealing] = useStOmr(false);

  useEfOmr(() => {
    let alive = true;
    window.fetchExamResult(examId).then((r) => {
      if (!alive) return;
      if (!r.ok) { setErr(r.msg || "결과를 불러오지 못했습니다"); return; }
      setData(r);
    });
    return () => { alive = false; };
  }, [examId]);

  if (err) return <div className="ci-card ci-card-pad" style={{ textAlign: "center", padding: 48, color: "var(--ci-muted)" }}>{err} <button className="ci-act" style={{ marginLeft: 8 }} onClick={onBack}>목록으로</button></div>;
  if (!data) return <div className="ci-card ci-card-pad" style={{ textAlign: "center", padding: 48, color: "var(--ci-muted)" }}>불러오는 중…</div>;

  const { exam, attempt, reviewAvailable } = data;
  const items = exam.omr || [];
  const revealById = {};
  if (reveal) for (const it of (reveal.exam.omr || [])) revealById[it.no] = it;

  const total = exam.totalPoints;
  const per = attempt.per || {};
  const score = attempt.score != null ? attempt.score : attempt.autoScore; // OMR 은 essay 가 없어 항상 즉시 확정
  const pct = total ? Math.round((score / total) * 100) : 0;
  const grade = window.gradeOf(pct);
  const pctile = window.mockPercentile(pct);

  const byUnit = {};
  for (const it of items) {
    const u = it.unit || "기타";
    const p = per[it.no] || {};
    if (!byUnit[u]) byUnit[u] = { earned: 0, max: 0 };
    byUnit[u].max += it.points; byUnit[u].earned += p.earned || 0;
  }
  const wrong = items.filter((it) => per[it.no] && per[it.no].correct === false);
  const correctN = items.filter((it) => per[it.no] && per[it.no].correct).length;

  const doReveal = async () => {
    setRevealing(true);
    const r = await window.fetchExamReview(examId);
    setRevealing(false);
    if (!r.ok) { showToast && showToast(r.msg || "아직 정답을 볼 수 없습니다"); return; }
    setReveal(r);
  };

  return (
    <div>
      <CiHead title={exam.title + " · 결과"} api="OMR Scored"
        sub={"제출 " + new Date(attempt.submittedAt).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }) + (attempt.leaveCount ? " · 화면 이탈 " + attempt.leaveCount + "회" : "")}
        action={<button className="ci-act" onClick={onBack}><Icon name="arrowLeft" size={13} /> 시험 목록</button>} />

      {!reveal && (
        <div className="ci-card ci-card-pad" style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div style={{ fontSize: 13.5, color: "var(--ci-muted)" }}>
            {reviewAvailable ? "정답과 해설을 확인할 수 있습니다." : "시험 마감 전에는 정답·해설이 공개되지 않습니다(다른 학생 보호를 위함)."}
          </div>
          {reviewAvailable && (
            <button className="ci-act navy" onClick={doReveal} disabled={revealing}>
              <Icon name="check" size={13} /> {revealing ? "불러오는 중…" : "정답·해설 보기"}
            </button>
          )}
        </div>
      )}

      {/* 점수 요약 */}
      <div className="ci-card ci-card-pad" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 28, alignItems: "center", marginBottom: 16 }}>
        <div style={{ textAlign: "center" }}>
          <div className="ci-ring" style={{ "--p": pct, width: 120, height: 120 }}><span className="val" style={{ fontSize: 30 }}>{score}</span></div>
          <div style={{ fontSize: 12, color: "var(--ci-muted)", marginTop: 8, fontWeight: 700 }}>/ {total}점 ({pct}%)</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          <OmrCell k="예상 등급" v={grade + "등급"} />
          <OmrCell k="상위" v={pctile + "%"} />
          <OmrCell k="정답 / 문항" v={correctN + " / " + items.length} />
        </div>
      </div>

      {/* 단원별 */}
      <div className="ci-card ci-card-pad" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 900, fontSize: 15, marginBottom: 14 }}>단원별 성취도</div>
        <div style={{ display: "grid", gap: 12 }}>
          {Object.entries(byUnit).map(([u, d]) => {
            const p = d.max ? Math.round((d.earned / d.max) * 100) : 0;
            return (
              <div key={u}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5 }}>
                  <span style={{ fontWeight: 700 }}>{u}</span>
                  <span className="ci-mono" style={{ color: "var(--ci-muted)" }}>{d.earned}/{d.max} · {p}%</span>
                </div>
                <div style={{ height: 8, background: "var(--ci-bg-2)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: p + "%", background: p >= 80 ? "var(--ci-ok)" : p >= 50 ? "var(--ci-navy)" : "var(--ci-bad)" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {wrong.length > 0 && (
        <div className="ci-card ci-card-pad" style={{ marginBottom: 16, borderLeft: "4px solid var(--ci-bad)" }}>
          <div style={{ fontWeight: 900, fontSize: 15 }}>오답노트 <span style={{ color: "var(--ci-bad)" }}>{wrong.length}</span></div>
          <div style={{ fontSize: 12.5, color: "var(--ci-muted)", marginTop: 2 }}>틀린 번호: {wrong.map((w) => w.no).join(", ")}</div>
        </div>
      )}

      {/* 번호별 채점표 */}
      <div className="ci-card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--ci-line)", fontWeight: 900, fontSize: 15 }}>번호별 채점표</div>
        <div style={{ overflowX: "auto" }}>
          <table className="ci-table">
            <thead><tr><th>번호</th><th>유형</th><th style={{ textAlign: "center" }}>내 답</th><th style={{ textAlign: "center" }}>정답</th><th style={{ textAlign: "center" }}>채점</th><th>해설</th></tr></thead>
            <tbody>
              {items.map((it) => {
                const my = attempt.answers[it.no];
                const p = per[it.no] || {};
                const correct = p.correct;
                const rv = revealById[it.no];
                const fmt = (v) => it.type === "short" ? (v == null || v === "" ? "—" : v) : (v == null ? "—" : OMR_BUBBLES[Number(v)]);
                return (
                  <tr key={it.no} style={{ background: correct ? "transparent" : "rgba(200,40,40,0.05)" }}>
                    <td style={{ fontWeight: 800 }}>{it.no}</td>
                    <td><span className="ci-badge neutral" style={{ fontSize: 10 }}>{it.type === "short" ? "단답" : (it.choices || 5) + "지선다"}</span></td>
                    <td style={{ textAlign: "center", fontWeight: 700, color: correct ? "var(--ci-ok)" : "var(--ci-bad)" }}>{fmt(my)}</td>
                    <td style={{ textAlign: "center", fontWeight: 700, color: "var(--ci-ok)" }}>{rv ? fmt(rv.answer) : "—"}</td>
                    <td style={{ textAlign: "center" }}>{correct ? <span className="ci-badge ok" style={{ fontSize: 10 }}>정답 {it.points}</span> : <span className="ci-badge bad" style={{ fontSize: 10 }}>오답 0</span>}</td>
                    <td style={{ fontSize: 12.5, color: "var(--ci-muted)" }}>{rv ? (rv.explanation || "—") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function OmrCell({ k, v }) {
  return (
    <div style={{ background: "var(--ci-bg-2)", borderRadius: 10, padding: 14, textAlign: "center" }}>
      <div style={{ fontSize: 11.5, color: "var(--ci-muted)", fontWeight: 700 }}>{k}</div>
      <div style={{ fontWeight: 900, fontSize: 22, marginTop: 4 }}>{v}</div>
    </div>
  );
}

Object.assign(window, { OmrRunner, OmrResult });
