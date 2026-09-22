/* global React, Icon, CiHead, findCourse, COURSES, useApp */
// ──────────────────────────────────────────────────────────────────
//  관리자 시험 — 출제(ExamEditor) · 현황/채점(ExamManager)
// ──────────────────────────────────────────────────────────────────
const { useState: useStAx, useEffect: useEfAx } = React;

const AX_QTYPES = [["mc", "객관식"], ["ox", "OX"], ["short", "단답형"], ["essay", "서술형"]];

function ExamManager() {
  const { showToast, user } = useApp();
  const [tick, setTick] = useStAx(0);
  const refresh = () => setTick((t) => t + 1);
  const [editing, setEditing] = useStAx(null);   // examId | "new" | null
  const [grading, setGrading] = useStAx(null);    // examId | null

  useEfAx(() => {
    if (user && window.pullExamData) window.pullExamData(user).then(refresh).catch(() => {});
  }, [user]);

  const exams = window.getExams();

  if (editing) {
    const exFound = (editing !== "new" && editing !== "new-omr") ? window.findExam(editing) : null;
    const useOmr = editing === "new-omr" || (exFound && exFound.format === "pdf_omr");
    if (useOmr && window.OmrEditor) return <window.OmrEditor examId={exFound ? exFound.id : null} onClose={() => { setEditing(null); refresh(); }} />;
    return <ExamEditor examId={exFound ? exFound.id : null} onClose={() => { setEditing(null); refresh(); }} />;
  }
  if (grading) return <ExamGrader examId={grading} onClose={() => { setGrading(null); refresh(); }} />;

  const totalSubs = exams.reduce((s, e) => { const a = window.getAttempt(e.id); return s + (a && a.submittedAt ? 1 : 0); }, 0);
  const pendGrade = exams.filter((e) => { const a = window.getAttempt(e.id); return a && a.submittedAt && !a.graded; }).length;

  return (
    <div>
      <CiHead title="시험 관리" api="Renewjen Exam"
        sub="홈페이지에서 응시하는 시험을 출제하고 채점합니다 · 객관식·단답은 자동채점, 서술형만 강사 채점"
        action={<div style={{ display: "flex", gap: 8 }}>
          <button className="ci-act" onClick={() => setEditing("new")}><Icon name="plus" size={13} /> 문항 입력형</button>
          <button className="ci-act navy" onClick={() => setEditing("new-omr")}><Icon name="folder" size={13} /> PDF+OMR 출제</button>
        </div>} />

      {window.AdminExamOverview && <window.AdminExamOverview onGrade={(id) => setGrading(id)} />}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <span className="ci-badge neutral"><Icon name="book" size={11} /> 전체 시험 {exams.length}</span>
        <span className="ci-badge ok"><Icon name="check" size={11} /> 제출 {totalSubs}</span>
        <span className="ci-badge warn"><Icon name="clock" size={11} /> 서술형 채점 대기 {pendGrade}</span>
        <button className="ci-act sm" onClick={() => showToast && showToast("CSV 양식: 유형,문항,보기1~5,정답,배점,단원,해설 — 업로드 시 일괄 등록(데모)")}><Icon name="upload" size={11} /> CSV 문제은행 업로드</button>
        {window.examSbStatus && (window.examSbStatus() === "connected"
          ? <span className="ci-badge ok"><Icon name="check" size={11} /> 서버 저장됨</span>
          : <span className="ci-badge neutral"><Icon name="server" size={11} /> 로컬 저장(데모)</span>)}
      </div>

      <div className="ci-card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="ci-table">
            <thead>
              <tr><th>시험명</th><th>과목</th><th>유형</th><th>문항·배점</th><th>응시 현황</th><th style={{ textAlign: "center" }}>작업</th></tr>
            </thead>
            <tbody>
              {exams.map((e) => {
                const course = findCourse(e.courseId);
                const a = window.getAttempt(e.id);
                const sub = a && a.submittedAt;
                const enrolled = course ? Math.max(1, Math.round((course.enrolled || 100) / 20)) : 30; // 데모 대상 인원
                const subN = sub ? Math.round(enrolled * 0.78) : 0;
                return (
                  <tr key={e.id}>
                    <td><strong style={{ fontWeight: 800 }}>{e.title}</strong></td>
                    <td style={{ color: "var(--ci-muted)" }}>{course?.title || "—"}</td>
                    <td><span className={"ci-badge " + (e.type === "practice" ? "neutral" : "navy")} style={{ fontSize: 10.5 }}>{e.type === "practice" ? "연습" : "정식"}</span></td>
                    <td className="ci-mono" style={{ fontSize: 12, color: "var(--ci-muted)" }}>{window.examQCount(e)}문항 · {window.examTotal(e)}점{e.format === "pdf_omr" ? " · PDF" : ""}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ flex: 1, minWidth: 70, height: 8, background: "var(--ci-bg-2)", borderRadius: 4, overflow: "hidden" }}>
                          <i style={{ display: "block", height: "100%", width: Math.round((subN / enrolled) * 100) + "%", background: "var(--ci-navy)" }} />
                        </span>
                        <span className="ci-mono" style={{ fontSize: 12, color: "var(--ci-muted)" }}>{subN}/{enrolled}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                      <button className="ci-act sm" onClick={() => setEditing(e.id)}><Icon name="edit" size={11} /> 편집</button>{" "}
                      {sub && !a.graded
                        ? <button className="ci-act navy sm" onClick={() => setGrading(e.id)}><Icon name="check" size={11} /> 채점</button>
                        : sub
                          ? <button className="ci-act sm" onClick={() => setGrading(e.id)}>제출본</button>
                          : <span className="ci-badge neutral" style={{ fontSize: 10 }}>제출 없음</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ marginTop: 16, fontSize: 12.5, color: "var(--ci-muted)", lineHeight: 1.7 }}>
        · 학생은 <strong>리뉴젠 홈페이지</strong>에서 응시합니다 (ClassIn 앱 불필요) · 제출 즉시 자동채점, 결과·해설·오답노트가 학생 화면에 표시됩니다.<br />
        · 서술형이 포함된 시험은 <strong>채점</strong>에서 점수·피드백을 입력하면 학생의 최종 점수가 확정됩니다 · 결과는 성적표 추이에 누적됩니다.
      </p>
    </div>
  );
}

// ── 서술형 채점 ─────────────────────────────────────────────────────
function ExamGrader({ examId, onClose }) {
  const exam = window.findExam(examId);
  const at = window.getAttempt(examId);
  const { showToast } = useApp();
  const [scores, setScores] = useStAx(() => ({ ...(at && at.manualScores || {}) }));
  const [fb, setFb] = useStAx(() => ({ ...(at && at.manualFeedback || {}) }));

  if (!at || !at.submittedAt) return <Empty onClose={onClose} msg="아직 제출된 답안이 없습니다." />;

  const essays = exam.questions.filter((q) => q.type === "essay");
  const g = window.autoGrade(exam, at.answers);

  const save = (close) => {
    window.saveAttempt(examId, { manualScores: scores, manualFeedback: fb, graded: true });
    showToast && showToast("채점이 저장되어 학생에게 반영되었습니다");
    if (close) onClose();
  };

  return (
    <div>
      <CiHead title={exam.title + " · 채점"} api="Grading"
        sub={"제출 " + at.submittedAt + " · 자동채점 " + g.autoScore + "/" + g.autoMax + "점"}
        action={<button className="ci-act" onClick={onClose}><Icon name="arrowLeft" size={13} /> 목록</button>} />

      {essays.length === 0 && (
        <div className="ci-card ci-card-pad" style={{ textAlign: "center", color: "var(--ci-muted)" }}>서술형 문항이 없어 전체 자동 채점되었습니다.</div>
      )}

      <div style={{ display: "grid", gap: 14 }}>
        {essays.map((q, i) => (
          <div key={q.id} className="ci-card ci-card-pad">
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <span className="ci-badge navy" style={{ fontSize: 10.5 }}>서술형 {i + 1}</span>
              <span style={{ fontSize: 12, color: "var(--ci-muted)" }}>{q.unit} · 배점 {q.points}점</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.6, marginBottom: 10, whiteSpace: "pre-wrap" }}>{q.stem}</div>
            <div style={{ fontSize: 12.5, color: "var(--ci-muted)", marginBottom: 4 }}>학생 답안</div>
            <div style={{ background: "var(--ci-bg-2)", borderRadius: 8, padding: "12px 14px", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 12 }}>{at.answers[q.id] || <em style={{ color: "var(--ci-muted)" }}>미작성</em>}</div>
            {q.answer && <div style={{ fontSize: 13, color: "var(--ci-ink)", marginBottom: 12 }}><strong style={{ color: "var(--ci-ok)" }}>모범답안 · </strong>{q.answer}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, alignItems: "start" }}>
              <div>
                <label className="ci-glab">점수 (／{q.points})</label>
                <input type="number" min={0} max={q.points} value={scores[q.id] ?? ""} onChange={(e) => setScores((s) => ({ ...s, [q.id]: e.target.value }))}
                  style={{ width: 110, height: 40, borderRadius: 8, border: "1px solid var(--ci-line)", padding: "0 12px", fontSize: 15, fontFamily: "var(--font-en)" }} />
              </div>
              <div>
                <label className="ci-glab">피드백</label>
                <textarea rows={2} value={fb[q.id] || ""} onChange={(e) => setFb((s) => ({ ...s, [q.id]: e.target.value }))} placeholder="학생에게 보여질 피드백"
                  style={{ width: "100%", borderRadius: 8, border: "1px solid var(--ci-line)", padding: 10, fontSize: 14, fontFamily: "var(--font-kr)", resize: "vertical" }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`.ci-glab{display:block;font-size:11.5px;font-weight:800;color:var(--ci-muted);margin-bottom:6px;}`}</style>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <button className="ci-act" onClick={onClose}>취소</button>
        <button className="ci-act navy" onClick={() => save(true)}><Icon name="check" size={13} /> 채점 저장 · 학생 반영</button>
      </div>
    </div>
  );
}

// ── 시험 출제/편집 ──────────────────────────────────────────────────
function ExamEditor({ examId, onClose }) {
  const editingExam = examId ? window.findExam(examId) : null;
  const { showToast, user } = useApp();
  const [meta, setMeta] = useStAx(() => editingExam ? {
    title: editingExam.title, courseId: editingExam.courseId, type: editingExam.type,
    durationMin: editingExam.durationMin, instructions: editingExam.instructions || "",
  } : { title: "", courseId: (COURSES[0] || {}).id || "", type: "exam", durationMin: 40, instructions: "" });
  const [qs, setQs] = useStAx(() => editingExam ? editingExam.questions.map((q) => ({ ...q, choices: q.choices ? q.choices.slice() : ["", "", "", "", ""] })) : []);
  const um = (k, v) => setMeta((m) => ({ ...m, [k]: v }));

  const addQ = (type) => {
    const id = "q" + Date.now().toString(36);
    const base = { id, type, stem: "", points: type === "essay" ? 25 : 20, unit: "", explanation: "" };
    if (type === "mc") Object.assign(base, { choices: ["", "", "", "", ""], answer: 0 });
    if (type === "ox") base.answer = true;
    if (type === "short") base.answer = "";
    if (type === "essay") base.answer = "";
    setQs((x) => [...x, base]);
  };
  const upQ = (i, patch) => setQs((x) => x.map((q, j) => j === i ? { ...q, ...patch } : q));
  const delQ = (i) => setQs((x) => x.filter((_, j) => j !== i));
  const addQs = (items) => setQs((x) => [...x, ...items]);

  const total = qs.reduce((s, q) => s + (Number(q.points) || 0), 0);

  const save = () => {
    if (!meta.title.trim()) { showToast && showToast("시험명을 입력하세요"); return; }
    if (qs.length === 0) { showToast && showToast("문항을 1개 이상 추가하세요"); return; }
    const store = window.loadExamStore();
    const clean = qs.map((q) => {
      const o = { id: q.id, type: q.type, stem: q.stem, points: Number(q.points) || 0, unit: q.unit || "", explanation: q.explanation || "" };
      if (q.type === "mc") { o.choices = q.choices.filter((c) => c !== undefined); o.answer = Number(q.answer) || 0; }
      if (q.type === "ox") o.answer = q.answer === true || q.answer === "true";
      if (q.type === "short" || q.type === "essay") o.answer = q.answer || "";
      return o;
    });
    const exam = {
      id: editingExam ? editingExam.id : "exam-" + Date.now().toString(36),
      title: meta.title.trim(), courseId: meta.courseId, type: meta.type,
      durationMin: meta.type === "practice" ? 0 : (Number(meta.durationMin) || 0),
      attempts: meta.type === "practice" ? 0 : 1, shuffle: true,
      openAt: editingExam ? editingExam.openAt : new Date().toISOString(),
      dueAt: editingExam ? editingExam.dueAt : null,
      instructions: meta.instructions, questions: clean,
    };
    store.custom = (store.custom || []).filter((e) => e.id !== exam.id);
    // seed 시험을 편집한 경우엔 custom 으로 덮어쓰기(같은 id) → getExams 에서 custom 우선되도록
    store.custom.push(exam);
    window.saveExamStore(store);
    if (window.pushExam) window.pushExam(exam, user);
    showToast && showToast(editingExam ? "시험이 수정되었습니다" : "시험이 출제되었습니다");
    onClose();
  };

  return (
    <div>
      <CiHead title={editingExam ? "시험 편집" : "새 시험 출제"} api="Author"
        sub="문항을 추가하고 정답·배점·해설을 입력하면 학생 응시 화면이 자동 생성됩니다"
        action={<button className="ci-act" onClick={onClose}><Icon name="arrowLeft" size={13} /> 목록</button>} />

      <style>{`.ax-lab{display:block;font-size:11.5px;font-weight:800;color:var(--ci-muted);margin-bottom:6px;}.ax-in{width:100%;height:40px;border-radius:8px;border:1px solid var(--ci-line);padding:0 12px;font-size:14px;font-family:var(--font-kr);}`}</style>

      {/* 메타 */}
      <div className="ci-card ci-card-pad" style={{ marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12 }}>
          <div><label className="ax-lab">시험명</label><input className="ax-in" value={meta.title} onChange={(e) => um("title", e.target.value)} placeholder="예: 미적분 5주차 단원평가" /></div>
          <div><label className="ax-lab">과목(강좌)</label>
            <select className="ax-in" value={meta.courseId} onChange={(e) => um("courseId", e.target.value)}>
              {COURSES.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div><label className="ax-lab">유형</label>
            <select className="ax-in" value={meta.type} onChange={(e) => um("type", e.target.value)}>
              <option value="exam">정식 시험 (시간제한·1회)</option>
              <option value="practice">연습 (무제한)</option>
            </select>
          </div>
          <div><label className="ax-lab">제한 시간(분)</label><input className="ax-in" type="number" value={meta.durationMin} onChange={(e) => um("durationMin", e.target.value)} disabled={meta.type === "practice"} style={{ opacity: meta.type === "practice" ? 0.5 : 1 }} /></div>
        </div>
        <div style={{ marginTop: 12 }}><label className="ax-lab">응시 안내</label><input className="ax-in" value={meta.instructions} onChange={(e) => um("instructions", e.target.value)} placeholder="예: 계산기 사용 불가 · 부정행위 적발 시 0점" /></div>
      </div>

      {/* AI 문제 생성 */}
      {window.AIQuestionGen && <window.AIQuestionGen onAdd={addQs} defaultSubject={(window.findCourse && meta.courseId && (window.findCourse(meta.courseId) || {}).subject) || ""} />}

      {/* 문항 목록 */}
      <div style={{ display: "grid", gap: 12 }}>
        {qs.map((q, i) => (
          <div key={q.id} className="ci-card ci-card-pad">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--ci-navy)", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13 }}>{i + 1}</span>
              <select className="ax-in" style={{ width: 120, height: 34 }} value={q.type} onChange={(e) => upQ(i, { type: e.target.value, ...(e.target.value === "mc" ? { choices: q.choices || ["", "", "", "", ""], answer: 0 } : {}), ...(e.target.value === "ox" ? { answer: true } : {}), ...((e.target.value === "short" || e.target.value === "essay") ? { answer: "" } : {}) })}>
                {AX_QTYPES.map(([v, k]) => <option key={v} value={v}>{k}</option>)}
              </select>
              <input className="ax-in" style={{ width: 90, height: 34 }} placeholder="단원" value={q.unit} onChange={(e) => upQ(i, { unit: e.target.value })} />
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                <input className="ax-in" style={{ width: 72, height: 34 }} type="number" value={q.points} onChange={(e) => upQ(i, { points: e.target.value })} /><span style={{ fontSize: 12, color: "var(--ci-muted)" }}>점</span>
                <button className="ci-act sm" onClick={() => delQ(i)} style={{ color: "var(--ci-bad)" }}><Icon name="trash" size={11} /></button>
              </div>
            </div>
            <textarea className="ax-in" rows={2} style={{ height: "auto", padding: 10, marginBottom: 10 }} placeholder="문제(지문)를 입력하세요" value={q.stem} onChange={(e) => upQ(i, { stem: e.target.value })} />

            {q.type === "mc" && (
              <div style={{ display: "grid", gap: 6, marginBottom: 10 }}>
                {q.choices.map((c, ci) => (
                  <div key={ci} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ci-muted)", width: 64 }}>
                      <input type="radio" name={"ans-" + q.id} checked={Number(q.answer) === ci} onChange={() => upQ(i, { answer: ci })} /> 정답
                    </label>
                    <span style={{ fontWeight: 800, color: "var(--ci-muted)" }}>{String.fromCharCode(9312 + ci)}</span>
                    <input className="ax-in" style={{ flex: 1 }} value={c} onChange={(e) => { const nc = q.choices.slice(); nc[ci] = e.target.value; upQ(i, { choices: nc }); }} placeholder={"보기 " + (ci + 1)} />
                  </div>
                ))}
              </div>
            )}
            {q.type === "ox" && (
              <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                {[["O (참)", true], ["X (거짓)", false]].map(([lab, val]) => (
                  <label key={lab} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 700 }}>
                    <input type="radio" name={"ans-" + q.id} checked={q.answer === val} onChange={() => upQ(i, { answer: val })} /> {lab}
                  </label>
                ))}
              </div>
            )}
            {q.type === "short" && (
              <div style={{ marginBottom: 10 }}><label className="ax-lab">정답 (공백·대소문자 무시 비교)</label><input className="ax-in" value={q.answer} onChange={(e) => upQ(i, { answer: e.target.value })} placeholder="정답 문자열" /></div>
            )}
            {q.type === "essay" && (
              <div style={{ marginBottom: 10 }}><label className="ax-lab">모범답안 (채점 참고용)</label><textarea className="ax-in" rows={2} style={{ height: "auto", padding: 10 }} value={q.answer} onChange={(e) => upQ(i, { answer: e.target.value })} /></div>
            )}
            <div><label className="ax-lab">해설 (결과 화면에 표시)</label><input className="ax-in" value={q.explanation} onChange={(e) => upQ(i, { explanation: e.target.value })} placeholder="정답 해설" /></div>
          </div>
        ))}
      </div>

      {/* 문항 추가 */}
      <div className="ci-card ci-card-pad" style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--ci-muted)" }}>문항 추가:</span>
        {AX_QTYPES.map(([v, k]) => <button key={v} className="ci-act sm" onClick={() => addQ(v)}><Icon name="plus" size={11} /> {k}</button>)}
        <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 800 }}>총 {qs.length}문항 · {total}점</span>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <button className="ci-act" onClick={onClose}>취소</button>
        <button className="ci-act navy" onClick={save}><Icon name="check" size={13} /> {editingExam ? "수정 저장" : "출제하기"}</button>
      </div>
    </div>
  );
}

function Empty({ onClose, msg }) {
  return <div className="ci-card ci-card-pad" style={{ textAlign: "center", padding: 40, color: "var(--ci-muted)" }}>{msg} <button className="ci-act" style={{ marginLeft: 8 }} onClick={onClose}>목록으로</button></div>;
}

Object.assign(window, { ExamManager });
