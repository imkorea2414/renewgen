/* global React, Icon, CiHead, COURSES, useApp */
// ──────────────────────────────────────────────────────────────────
//  관리자 — PDF 시험지 업로드 + OMR 정답표 출제
// ──────────────────────────────────────────────────────────────────
const { useState: useStOe } = React;
const OE_BUBBLES = ["①", "②", "③", "④", "⑤", "⑥", "⑦"];

function OmrEditor({ examId, onClose }) {
  const editing = examId ? window.findExam(examId) : null;
  const { showToast, user } = useApp();
  const [meta, setMeta] = useStOe(() => editing ? {
    title: editing.title, courseId: editing.courseId, type: editing.type,
    durationMin: editing.durationMin, instructions: editing.instructions || "",
    defaultChoices: editing.defaultChoices || 5, pdfUrl: editing.pdfUrl || "", pdfName: editing.pdfName || "",
  } : { title: "", courseId: (COURSES[0] || {}).id || "", type: "exam", durationMin: 100, instructions: "", defaultChoices: 5, pdfUrl: "", pdfName: "" });
  const [rows, setRows] = useStOe(() => editing && editing.omr ? editing.omr.map((o) => ({ ...o })) : []);
  // 일괄 생성 컨트롤
  const [bulk, setBulk] = useStOe({ from: 1, to: 20, choices: 5, points: 2 });

  const um = (k, v) => setMeta((m) => ({ ...m, [k]: v }));
  const ur = (i, patch) => setRows((x) => x.map((r, j) => j === i ? { ...r, ...patch } : r));
  const delRow = (i) => setRows((x) => x.filter((_, j) => j !== i));

  const [uploading, setUploading] = useStOe(false);
  const onPdf = async (file) => {
    if (!file) return;
    const sb = window.getSupabase && window.getSupabase();
    // Supabase Storage(exam-pdfs)로 업로드 → 영구 URL 저장
    if (sb) {
      setUploading(true);
      try {
        const safe = file.name.replace(/[^\w.\-가-힣]/g, "_");
        const path = Date.now() + "_" + safe;
        const { error } = await sb.storage.from("exam-pdfs").upload(path, file, { upsert: true, contentType: "application/pdf" });
        if (!error) {
          const { data } = sb.storage.from("exam-pdfs").getPublicUrl(path);
          setMeta((m) => ({ ...m, pdfUrl: data.publicUrl, pdfName: file.name, pdfPath: path }));
          setUploading(false);
          showToast && showToast("시험지 PDF 업로드 완료 (Supabase Storage)");
          return;
        }
        console.warn("[Exam] PDF 업로드 실패:", error.message); // 디버깅용, 화면에는 노출 안 함
        showToast && showToast("파일을 업로드하지 못했습니다 — 로컬로 저장합니다");
      } catch (e) { console.warn("[Exam] PDF 업로드 오류:", e); showToast && showToast("파일을 업로드하지 못했습니다 — 로컬로 저장합니다"); }
      setUploading(false);
    }
    // 폴백(데모/미연결): data URL 로 로컬 저장
    if (file.size > 4 * 1024 * 1024) { showToast && showToast("PDF가 4MB를 넘어 로컬 저장이 제한될 수 있습니다"); }
    const r = new FileReader();
    r.onload = () => setMeta((m) => ({ ...m, pdfUrl: r.result, pdfName: file.name }));
    r.readAsDataURL(file);
  };

  const genBulk = () => {
    const a = Number(bulk.from), b = Number(bulk.to);
    if (!(a >= 1 && b >= a)) { showToast && showToast("번호 범위를 확인하세요"); return; }
    const exist = new Set(rows.map((r) => r.no));
    const add = [];
    for (let n = a; n <= b; n++) if (!exist.has(n)) add.push({ no: n, type: "mc", choices: Number(bulk.choices) || 5, answer: 0, points: Number(bulk.points) || 2, unit: "", explanation: "" });
    setRows((x) => [...x, ...add].sort((p, q) => p.no - q.no));
  };
  const addShort = () => {
    const nextNo = (rows.reduce((m, r) => Math.max(m, r.no), 0) || 0) + 1;
    setRows((x) => [...x, { no: nextNo, type: "short", answer: "", points: 3, unit: "", explanation: "" }].sort((p, q) => p.no - q.no));
  };

  const total = rows.reduce((s, r) => s + (Number(r.points) || 0), 0);

  const save = () => {
    if (!meta.title.trim()) { showToast && showToast("시험명을 입력하세요"); return; }
    if (!meta.pdfUrl) { showToast && showToast("시험지 PDF를 업로드하세요"); return; }
    if (rows.length === 0) { showToast && showToast("정답표를 1문항 이상 입력하세요"); return; }
    const omr = rows.map((r) => {
      const o = { no: Number(r.no), type: r.type, points: Number(r.points) || 0, unit: r.unit || "", explanation: r.explanation || "" };
      if (r.type === "mc") { o.choices = Number(r.choices) || meta.defaultChoices; o.answer = Number(r.answer) || 0; }
      else o.answer = r.answer || "";
      return o;
    }).sort((p, q) => p.no - q.no);
    const exam = {
      id: editing ? editing.id : "exam-omr-" + Date.now().toString(36),
      title: meta.title.trim(), courseId: meta.courseId, type: meta.type,
      durationMin: meta.type === "practice" ? 0 : (Number(meta.durationMin) || 0),
      attempts: meta.type === "practice" ? 0 : 1, shuffle: false, format: "pdf_omr",
      pdfUrl: meta.pdfUrl, pdfName: meta.pdfName, defaultChoices: Number(meta.defaultChoices) || 5,
      openAt: editing ? editing.openAt : null, dueAt: editing ? editing.dueAt : "2026-12-31T23:59:00+09:00",
      instructions: meta.instructions, omr,
    };
    const store = window.loadExamStore();
    store.custom = (store.custom || []).filter((e) => e.id !== exam.id);
    store.custom.push(exam);
    try { window.saveExamStore(store); } catch (e) {}
    if (window.pushExam) window.pushExam(exam, user);
    showToast && showToast(editing ? "시험이 수정되었습니다" : "PDF+OMR 시험이 출제되었습니다");
    onClose();
  };

  return (
    <div>
      <CiHead title={editing ? "PDF+OMR 시험 편집" : "PDF+OMR 시험 출제"} api="Author · OMR"
        sub="시험지 PDF를 올리고 정답표만 입력하면, 학생 화면에 PDF + OMR 카드가 자동 생성됩니다"
        action={<button className="ci-act" onClick={onClose}><Icon name="arrowLeft" size={13} /> 목록</button>} />

      <style>{`.oe-lab{display:block;font-size:11.5px;font-weight:800;color:var(--ci-muted);margin-bottom:6px;}.oe-in{width:100%;height:38px;border-radius:8px;border:1px solid var(--ci-line);padding:0 10px;font-size:14px;font-family:var(--font-kr);}`}</style>

      {/* 메타 + PDF */}
      <div className="ci-card ci-card-pad" style={{ marginBottom: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12 }}>
          <div><label className="oe-lab">시험명</label><input className="oe-in" value={meta.title} onChange={(e) => um("title", e.target.value)} placeholder="예: 9월 모의고사 — 국어" /></div>
          <div><label className="oe-lab">과목(강좌)</label>
            <select className="oe-in" value={meta.courseId} onChange={(e) => um("courseId", e.target.value)}>{COURSES.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
          </div>
          <div><label className="oe-lab">유형</label>
            <select className="oe-in" value={meta.type} onChange={(e) => um("type", e.target.value)}><option value="exam">정식 (시간제한·1회)</option><option value="practice">연습 (무제한)</option></select>
          </div>
          <div><label className="oe-lab">제한 시간(분)</label><input className="oe-in" type="number" value={meta.durationMin} onChange={(e) => um("durationMin", e.target.value)} disabled={meta.type === "practice"} style={{ opacity: meta.type === "practice" ? 0.5 : 1 }} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 12, marginTop: 12, alignItems: "end" }}>
          <div><label className="oe-lab">응시 안내</label><input className="oe-in" value={meta.instructions} onChange={(e) => um("instructions", e.target.value)} placeholder="예: OMR에 정확히 마킹 · 부정행위 0점" /></div>
          <div><label className="oe-lab">기본 보기 수</label>
            <select className="oe-in" value={meta.defaultChoices} onChange={(e) => um("defaultChoices", Number(e.target.value))}><option value={5}>5지선다</option><option value={4}>4지선다</option><option value={3}>3지선다</option></select>
          </div>
        </div>
        {/* PDF 업로드 */}
        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 12, padding: 14, borderRadius: 10, border: "1.5px dashed var(--ci-line)", background: "var(--ci-bg)" }}>
          <Icon name="folder" size={20} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 13.5 }}>{meta.pdfName || "시험지 PDF 업로드"}</div>
            <div style={{ fontSize: 12, color: "var(--ci-muted)" }}>{meta.pdfUrl ? "업로드됨 · 학생에게 이 PDF가 표시됩니다" : "PDF 파일을 선택하세요 (학생이 보며 OMR에 마킹)"}</div>
          </div>
          <label className="ci-act navy" style={{ cursor: uploading ? "wait" : "pointer", opacity: uploading ? 0.6 : 1 }}>
            <Icon name="upload" size={13} /> {uploading ? "업로드 중…" : (meta.pdfUrl ? "PDF 변경" : "PDF 선택")}
            <input type="file" accept="application/pdf" disabled={uploading} style={{ display: "none" }} onChange={(e) => onPdf(e.target.files[0])} />
          </label>
          {meta.pdfUrl && <button className="ci-act" onClick={() => um("pdfUrl", "") || um("pdfName", "")}><Icon name="trash" size={12} /></button>}
        </div>
      </div>

      {/* 정답표 빌더 */}
      <div className="ci-card ci-card-pad" style={{ marginBottom: 12, display: "flex", alignItems: "end", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 800, fontSize: 13.5 }}>객관식 일괄 생성:</span>
        <div><label className="oe-lab">시작</label><input className="oe-in" style={{ width: 64 }} type="number" value={bulk.from} onChange={(e) => setBulk((b) => ({ ...b, from: e.target.value }))} /></div>
        <div><label className="oe-lab">끝</label><input className="oe-in" style={{ width: 64 }} type="number" value={bulk.to} onChange={(e) => setBulk((b) => ({ ...b, to: e.target.value }))} /></div>
        <div><label className="oe-lab">보기수</label>
          <select className="oe-in" style={{ width: 80 }} value={bulk.choices} onChange={(e) => setBulk((b) => ({ ...b, choices: e.target.value }))}><option value={5}>5</option><option value={4}>4</option><option value={3}>3</option></select>
        </div>
        <div><label className="oe-lab">배점</label><input className="oe-in" style={{ width: 64 }} type="number" value={bulk.points} onChange={(e) => setBulk((b) => ({ ...b, points: e.target.value }))} /></div>
        <button className="ci-act navy" onClick={genBulk}><Icon name="plus" size={12} /> 생성</button>
        <button className="ci-act" onClick={addShort}><Icon name="plus" size={12} /> 단답형 1개</button>
        <span style={{ marginLeft: "auto", fontWeight: 800, fontSize: 13 }}>총 {rows.length}문항 · {total}점</span>
      </div>

      {/* 정답표 */}
      <div className="ci-card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="ci-table">
            <thead><tr><th>번호</th><th>유형</th><th>보기수</th><th>정답</th><th>배점</th><th>단원</th><th>해설</th><th></th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: 28, color: "var(--ci-muted)" }}>위에서 문항을 생성하세요</td></tr>}
              {rows.map((r, i) => (
                <tr key={r.no + "-" + i}>
                  <td style={{ fontWeight: 800 }}>{r.no}</td>
                  <td>
                    <select className="oe-in" style={{ width: 80, height: 32 }} value={r.type} onChange={(e) => ur(i, { type: e.target.value, ...(e.target.value === "mc" ? { choices: r.choices || meta.defaultChoices, answer: 0 } : { answer: "" }) })}>
                      <option value="mc">객관식</option><option value="short">단답</option>
                    </select>
                  </td>
                  <td>{r.type === "mc"
                    ? <select className="oe-in" style={{ width: 64, height: 32 }} value={r.choices || meta.defaultChoices} onChange={(e) => ur(i, { choices: Number(e.target.value) })}><option value={5}>5</option><option value={4}>4</option><option value={3}>3</option></select>
                    : <span style={{ color: "var(--ci-muted)" }}>—</span>}</td>
                  <td>{r.type === "mc"
                    ? <select className="oe-in" style={{ width: 70, height: 32 }} value={r.answer} onChange={(e) => ur(i, { answer: Number(e.target.value) })}>{Array.from({ length: r.choices || meta.defaultChoices }, (_, k) => <option key={k} value={k}>{OE_BUBBLES[k]}</option>)}</select>
                    : <input className="oe-in" style={{ width: 90, height: 32 }} value={r.answer} onChange={(e) => ur(i, { answer: e.target.value })} placeholder="정답" />}</td>
                  <td><input className="oe-in" style={{ width: 60, height: 32 }} type="number" value={r.points} onChange={(e) => ur(i, { points: e.target.value })} /></td>
                  <td><input className="oe-in" style={{ width: 100, height: 32 }} value={r.unit} onChange={(e) => ur(i, { unit: e.target.value })} placeholder="단원" /></td>
                  <td><input className="oe-in" style={{ width: 180, height: 32 }} value={r.explanation} onChange={(e) => ur(i, { explanation: e.target.value })} placeholder="해설(선택)" /></td>
                  <td><button className="ci-act sm" onClick={() => delRow(i)} style={{ color: "var(--ci-bad)" }}><Icon name="trash" size={11} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <button className="ci-act" onClick={onClose}>취소</button>
        <button className="ci-act navy" onClick={save}><Icon name="check" size={13} /> {editing ? "수정 저장" : "출제하기"}</button>
      </div>
    </div>
  );
}

Object.assign(window, { OmrEditor });
