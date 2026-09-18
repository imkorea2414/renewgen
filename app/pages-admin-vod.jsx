/* global React, COURSES, INSTRUCTORS, SUBJECTS, Icon, useApp, formatKRW, findInstructor, findSubject */
// ──────────────────────────────────────────────────────────────────
//  관리자 · 강의(VOD) 관리
//   · 강좌별 대표사진 업로드 + Vimeo 쇼케이스 링크 연결 + 판매/무료 설정
//   · 새 강좌 개설 · 삭제(개설한 강좌만)
// ──────────────────────────────────────────────────────────────────
const { useState: useStV } = React;

// 업로드 이미지 → 가로 720px 로 축소한 JPEG dataURL (localStorage 절약)
function vodFileToThumb(file, cb) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const maxW = 720;
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      cv.getContext("2d").drawImage(img, 0, 0, w, h);
      try { cb(cv.toDataURL("image/jpeg", 0.82)); } catch (e) { cb(reader.result); }
    };
    img.onerror = () => cb(reader.result);
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

const VOD_COLORS = ["ink", "cream", "accent", "deep"];

// Vimeo 목록 조회 — Edge Function(vimeo-list) 호출 (classin-roster/bbb-room 과 동일한 인증 방식)
async function vimeoListCall(qs) {
  const base = (window.SUPABASE_URL || "") + "/functions/v1/vimeo-list";
  let bearer = window.SUPABASE_ANON_KEY || "";
  try {
    const sb = window.getSupabase && window.getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (session && session.access_token) bearer = session.access_token;
  } catch (e) {}
  try {
    const res = await fetch(base + qs, {
      headers: { Authorization: "Bearer " + bearer, apikey: window.SUPABASE_ANON_KEY || "" },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) return { ok: false, msg: json.msg || ("HTTP " + res.status) };
    return json;
  } catch (e) { return { ok: false, msg: "네트워크 오류: " + String(e) }; }
}

function vodDurationLabel(sec) {
  sec = Number(sec) || 0;
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + "분 " + String(s).padStart(2, "0") + "초";
}

// 비메오 계정에서 쇼케이스/영상 목록을 불러와 골라 담는 패널
const VIMEO_PICKER_PER_PAGE = 30;
function VimeoPicker({ onPick, onClose }) {
  const [tab, setTab] = useStV("showcases"); // showcases | videos
  const [q, setQ] = useStV("");
  const [items, setItems] = useStV([]);
  const [page, setPage] = useStV(1);
  const [total, setTotal] = useStV(0);
  const [loading, setLoading] = useStV(true);
  const [loadingMore, setLoadingMore] = useStV(false);
  const [err, setErr] = useStV("");

  const load = React.useCallback((t, query, p, append) => {
    if (append) setLoadingMore(true); else { setLoading(true); setItems([]); }
    setErr("");
    const qs = "?type=" + t + "&per_page=" + VIMEO_PICKER_PER_PAGE + "&page=" + p
      + (query ? "&q=" + encodeURIComponent(query) : "");
    vimeoListCall(qs).then((r) => {
      setLoading(false); setLoadingMore(false);
      if (!r.ok) { setErr(r.msg || "불러오기 실패"); if (!append) setItems([]); return; }
      setTotal(Number(r.total) || 0);
      setItems((prev) => append ? [...prev, ...(r.items || [])] : (r.items || []));
    });
  }, []);

  // 탭 전환은 즉시, 검색어 입력은 살짝 지연(debounce) 후 1페이지부터 다시 조회 —
  // Vimeo API 서버 검색(query 파라미터)을 그대로 사용한다.
  React.useEffect(() => {
    setPage(1);
    const t = setTimeout(() => load(tab, q, 1, false), q ? 400 : 0);
    return () => clearTimeout(t);
  }, [tab, q, load]);

  const hasMore = !loading && !err && items.length < total;
  const loadMore = () => { const next = page + 1; setPage(next); load(tab, q, next, true); };

  return (
    <div className="ci-card ci-card-pad" style={{ marginBottom: 14, background: "#fafafa" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={() => setTab("showcases")}
            className={"ci-act" + (tab === "showcases" ? " navy" : "")}>쇼케이스</button>
          <button type="button" onClick={() => setTab("videos")}
            className={"ci-act" + (tab === "videos" ? " navy" : "")}>단일 영상</button>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목으로 검색…"
          style={{ ...inStyle, height: 32, width: 180 }} />
        <button type="button" className="ci-act" onClick={onClose}><Icon name="close" size={12} /> 닫기</button>
      </div>
      {loading && <div style={{ fontSize: 13, color: "var(--ci-muted)", padding: "12px 0" }}>Vimeo에서 불러오는 중…</div>}
      {!loading && err && <div style={{ fontSize: 13, color: "var(--ci-bad)", padding: "12px 0" }}>{err}</div>}
      {!loading && !err && items.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--ci-muted)", padding: "12px 0" }}>목록이 비어 있습니다.</div>
      )}
      {!loading && !err && items.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, maxHeight: 360, overflowY: "auto" }}>
            {items.map((it) => (
              <button key={it.id} type="button" onClick={() => onPick(it)}
                style={{ textAlign: "left", border: "1px solid var(--ci-line)", borderRadius: 8, overflow: "hidden", background: "#fff", cursor: "pointer", padding: 0 }}>
                <div style={{ width: "100%", aspectRatio: "16/9", background: "#eee", backgroundImage: it.thumbnail ? `url(${it.thumbnail})` : "none", backgroundSize: "cover", backgroundPosition: "center" }} />
                <div style={{ padding: 8 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, lineHeight: 1.3, marginBottom: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{it.name}</div>
                  <div style={{ fontSize: 11, color: "var(--ci-muted)" }}>
                    {tab === "showcases" ? (it.videoCount != null ? it.videoCount + "개 영상" : "쇼케이스") : vodDurationLabel(it.duration)}
                    {it.privacy ? " · " + it.privacy : ""}
                  </div>
                </div>
              </button>
            ))}
          </div>
          {hasMore && (
            <div style={{ textAlign: "center", marginTop: 10 }}>
              <button type="button" className="ci-act" disabled={loadingMore} onClick={loadMore}>
                {loadingMore ? "불러오는 중…" : "더 불러오기 (" + items.length + " / " + total + ")"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const CUSTOM_INS = "__custom__::";
// 강사 선택 — 등록된 강사가 없으면(또는 맞는 강사가 없으면) '직접 입력'으로 이름만 받는다
function InstructorPicker({ value, onChange }) {
  const list = window.INSTRUCTORS || [];
  const isCustom = typeof value === "string" && value.indexOf(CUSTOM_INS) === 0;
  const known = list.some((i) => i.id === value);
  const [mode, setMode] = useStV(isCustom || (value && !known) ? "custom" : "select");
  const customName = isCustom ? value.slice(CUSTOM_INS.length) : "";
  if (mode === "custom") {
    return (
      <div style={{ display: "flex", gap: 8 }}>
        <input autoFocus value={customName} onChange={(e) => onChange(CUSTOM_INS + e.target.value)} placeholder="강사 이름 직접 입력 (예: 한지훈)" style={{ ...inStyle, flex: 1 }} />
        <button type="button" className="ci-act" onClick={() => { setMode("select"); onChange(""); }}>목록</button>
      </div>
    );
  }
  return (
    <select style={inStyle} value={known ? value : ""} onChange={(e) => { if (e.target.value === "__add__") { setMode("custom"); onChange(CUSTOM_INS); } else onChange(e.target.value); }}>
      <option value="">강사 선택…</option>
      {list.map((i) => <option key={i.id} value={i.id}>{i.name}{i.subject ? " · " + i.subject : ""}</option>)}
      <option value="__add__">+ 직접 입력…</option>
    </select>
  );
}
// 입력받은 강사 값(id 또는 직접입력)을 실제 강사 id 로 확정
function resolveInstructor(v) {
  if (typeof v === "string" && v.indexOf(CUSTOM_INS) === 0) return window.upsertInstructorByName(v.slice(CUSTOM_INS.length));
  return v || "";
}

// 무료 대상 반 선택 — 학생 명부(또는 클래스인)에서 받은 반 목록을 드롭다운으로
function ClassPicker({ value, onChange }) {
  const [manual, setManual] = useStV("");
  const [showManual, setShowManual] = useStV(false);
  const chosen = String(value || "").split(/[,/·]/).map((s) => s.trim()).filter(Boolean);
  const all = (window.rjClassNames && window.rjClassNames()) || [];
  const avail = all.filter((c) => !chosen.includes(c));
  const set = (arr) => onChange(arr.join(", "));
  const add = (c) => { const n = (c || "").trim(); if (!n || chosen.includes(n)) return; set([...chosen, n]); };
  const rm = (c) => set(chosen.filter((x) => x !== c));
  return (
    <div>
      {chosen.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {chosen.map((c) => <span key={c} className="ci-chip">{c}<button onClick={() => rm(c)}><Icon name="close" size={11} /></button></span>)}
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <select style={{ ...inStyle, flex: 1 }} value="" onChange={(e) => add(e.target.value)}>
          <option value="">{avail.length ? "반 선택해서 추가…" : "선택할 반이 없습니다"}</option>
          {avail.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="button" className="ci-act" onClick={() => setShowManual((s) => !s)}><Icon name="edit" size={12} /> 직접</button>
      </div>
      {showManual && (
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="반 이름 직접 입력" style={{ ...inStyle, flex: 1 }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(manual); setManual(""); } }} />
          <button type="button" className="ci-act navy" onClick={() => { add(manual); setManual(""); }}><Icon name="plus" size={12} /> 추가</button>
        </div>
      )}
      {all.length === 0 && (
        <p style={{ fontSize: 11, color: "var(--ci-muted)", margin: "7px 0 0", lineHeight: 1.5 }}>아직 등록된 반이 없습니다 · 학생 관리에서 학생의 ‘학년·반’을 입력하거나 클래스인 명부를 연동하면 여기 목록에 자동으로 나타납니다.</p>
      )}
    </div>
  );
}

function VodManager() {
  const { showToast } = useApp();
  const [, setTick] = useStV(0);
  const refresh = () => setTick((t) => t + 1);
  const [editId, setEditId] = useStV(null);
  const [adding, setAdding] = useStV(false);

  const courses = window.COURSES || [];
  const connected = courses.filter((c) => c.showcaseId).length;
  const membersN = courses.filter((c) => window.courseVisibility && window.courseVisibility(c) === "members").length;

  return (
    <div>
      <style>{`.vod-lab{display:block;font-size:11.5px;font-weight:800;color:var(--ci-muted);margin-bottom:6px;letter-spacing:.01em;}`}</style>
      <window.CiHead title="강의 관리 · VOD" api="Vimeo Showcase"
        sub="강좌마다 대표사진과 Vimeo 쇼케이스 링크를 연결하면, 그 강좌 페이지에 강의 영상이 자동으로 나열됩니다 · 등록생은 무료, 그 외에는 구매 후 시청"
        action={<button className="ci-act navy" onClick={() => { setAdding(true); setEditId(null); }}><Icon name="plus" size={13} /> 강좌 개설</button>} />

      {/* 요약 */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <span className="ci-badge neutral"><Icon name="book" size={11} /> 전체 강좌 {courses.length}</span>
        <span className="ci-badge ok"><Icon name="check" size={11} /> 쇼케이스 연결 {connected}</span>
        <span className="ci-badge warn"><Icon name="clock" size={11} /> 미연결 {courses.length - connected}</span>
        <span className="ci-badge navy"><Icon name="lock" size={11} /> 회원전용 {membersN}</span>
        <span className="ci-badge ok"><Icon name="signal" size={11} /> 공개·샘플 {courses.length - membersN}</span>
      </div>

      {adding && <VodAddForm onClose={() => setAdding(false)} onAdded={(id) => { setAdding(false); refresh(); setEditId(id); showToast("강좌가 개설되었습니다"); }} />}

      <div style={{ display: "grid", gap: 12 }}>
        {courses.map((c) => (
          <VodCourseRow key={c.id} course={c} open={editId === c.id}
            onToggle={() => setEditId(editId === c.id ? null : c.id)}
            onChange={() => { refresh(); }} showToast={showToast} />
        ))}
      </div>

      <p style={{ marginTop: 18, fontSize: 12.5, color: "var(--ci-muted)", lineHeight: 1.7 }}>
        · <strong>등록생 무료</strong>는 <strong>학생 관리</strong> 탭에서 해당 학생에게 강좌를 배정하면 적용됩니다.<br />
        · <strong>공개 범위</strong>: ‘전체공개·샘플’은 누구나 보는 공개 강의 메뉴에, ‘회원전용·진짜 강의’는 로그인한 학생 대시보드에만 노출됩니다.<br />
        · 쇼케이스 안 강의 <strong>순서 변경</strong>은 Vimeo 쇼케이스에서 하면 사이트에 그대로 반영됩니다.<br />
        · Vimeo 영상 설정에서 <strong>도메인 제한</strong>을 걸면 우리 사이트에서만 재생됩니다.
      </p>
    </div>
  );
}

function VodCourseRow({ course, open, onToggle, onChange, showToast }) {
  const ins = findInstructor(course.instructor);
  const subj = findSubject(course.subject);
  const custom = window.isCustomCourse(course.id);
  const initLink = course.showcaseId ? window.showcaseUrl(course.showcaseId)
    : course.vimeoId ? window.videoUrl(course.vimeoId, course.vimeoHash) : "";

  const [form, setForm] = useStV({
    showcaseInput: initLink,
    thumb: course.thumb || "",
    title: course.title || "",
    level: course.level || "",
    instructor: course.instructor || "",
    className: course.classNames || course.className || "",
    salePrice: course.salePrice || course.recordingPrice || 0,
    isFree: !!course.isFree,
    visibility: window.courseVisibility ? window.courseVisibility(course) : "public",
  });
  const up = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const media = window.parseVimeoMedia(form.showcaseInput);

  const save = () => {
    const patch = {
      showcaseId: media.type === "showcase" ? media.id : "",
      vimeoId: media.type === "video" ? media.id : "",
      vimeoHash: media.type === "video" ? (media.hash || "") : "",
      thumb: form.thumb || undefined,
      title: form.title.trim() || course.title,
      level: form.level.trim(),
      instructor: resolveInstructor(form.instructor),
      classNames: form.className.trim(),
      salePrice: Number(form.salePrice) || 0,
      price: Number(form.salePrice) || 0,
      recordingPrice: Number(form.salePrice) || 0,
      isFree: !!form.isFree,
      visibility: form.visibility === "members" ? "members" : "public",
    };
    window.setCourseOverride(course.id, patch);
    onChange();
    showToast("저장되었습니다");
    onToggle();
  };
  const del = () => {
    if (!confirm("이 강좌를 삭제할까요? (개설한 강좌만 삭제됩니다)")) return;
    window.removeCustomCourse(course.id);
    onChange();
    showToast("강좌가 삭제되었습니다");
  };

  return (
    <div className="ci-card" style={{ overflow: "hidden" }}>
      {/* 요약 행 */}
      <div style={{ display: "grid", gridTemplateColumns: "92px 1fr auto", gap: 16, alignItems: "center", padding: 14 }}>
        <div style={{ width: 92, height: 62, borderRadius: 8, overflow: "hidden", background: "var(--ci-bg-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {course.thumb
            ? <img src={course.thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <Icon name="image" size={18} />}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <strong style={{ fontWeight: 800, fontSize: 15.5, letterSpacing: "-0.02em" }}>{course.title}</strong>
            {subj && <span className="ci-badge navy" style={{ fontSize: 10.5 }}>{subj.ko}</span>}
            {custom && <span className="ci-badge neutral" style={{ fontSize: 10.5 }}>개설</span>}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
            {course.showcaseId
              ? <span className="ci-badge ok" style={{ fontSize: 10.5 }}><Icon name="check" size={10} /> 쇼케이스 연결됨</span>
              : course.vimeoId
                ? <span className="ci-badge ok" style={{ fontSize: 10.5 }}><Icon name="check" size={10} /> 영상 연결됨</span>
                : <span className="ci-badge warn" style={{ fontSize: 10.5 }}>영상 미연결</span>}
            {course.isFree
              ? <span className="ci-badge ok" style={{ fontSize: 10.5 }}>전체 무료</span>
              : <span className="ci-badge neutral" style={{ fontSize: 10.5 }}>{formatKRW(course.salePrice || course.recordingPrice || 0)}</span>}
            {window.courseVisibility && window.courseVisibility(course) === "members"
              ? <span className="ci-badge navy" style={{ fontSize: 10.5 }}><Icon name="lock" size={10} /> 회원전용</span>
              : <span className="ci-badge ok" style={{ fontSize: 10.5 }}><Icon name="signal" size={10} /> 전체공개(샘플)</span>}
            <span style={{ fontSize: 12, color: "var(--ci-muted)" }}>{ins?.name || "강사 미지정"}</span>
          </div>
        </div>
        <button className="ci-act" onClick={onToggle}>{open ? "닫기" : <><Icon name="edit" size={12} /> 편집</>}</button>
      </div>

      {/* 편집 패널 */}
      {open && (
        <div style={{ borderTop: "1px solid var(--ci-line)", padding: 18, display: "grid", gridTemplateColumns: "260px 1fr", gap: 22, background: "var(--ci-bg)" }}>
          {/* 대표사진 */}
          <div>
            <label className="vod-lab">대표사진</label>
            <div style={{ aspectRatio: "16 / 10", borderRadius: 10, overflow: "hidden", background: "var(--ci-bg-2)", border: "1px solid var(--ci-line)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              {form.thumb
                ? <img src={form.thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ color: "var(--ci-muted)", fontSize: 12.5, textAlign: "center", padding: 12 }}><Icon name="image" size={22} /><br />이미지를 올려주세요</span>}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <label className="ci-act" style={{ cursor: "pointer", flex: 1, justifyContent: "center" }}>
                <Icon name="upload" size={12} /> 사진 업로드
                <input type="file" accept="image/*" style={{ display: "none" }}
                  onChange={(e) => { const f = e.target.files[0]; if (f) vodFileToThumb(f, (url) => up("thumb", url)); }} />
              </label>
              {form.thumb && <button className="ci-act" onClick={() => up("thumb", "")}><Icon name="trash" size={12} /></button>}
            </div>
            <p style={{ fontSize: 11, color: "var(--ci-muted)", margin: "8px 0 0", lineHeight: 1.5 }}>강좌 카드·플레이어에 쓰입니다 · 가로형 권장</p>
          </div>

          {/* 필드 */}
          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <label className="vod-lab">Vimeo 링크 — 쇼케이스 또는 단일 영상</label>
              <input value={form.showcaseInput} onChange={(e) => up("showcaseInput", e.target.value)}
                placeholder="https://vimeo.com/showcase/123  또는  https://vimeo.com/987654321"
                style={inStyle} />
              <div style={{ marginTop: 6, fontSize: 12 }}>
                {form.showcaseInput
                  ? (media.type === "showcase"
                    ? <span style={{ color: "var(--ci-ok)" }}><Icon name="check" size={11} /> 쇼케이스 인식됨 · ID {media.id} — <a href={window.showcaseUrl(media.id)} target="_blank" rel="noreferrer" style={{ color: "var(--ci-navy)", fontWeight: 700 }}>미리보기</a></span>
                    : media.type === "video"
                      ? <span style={{ color: "var(--ci-ok)" }}><Icon name="check" size={11} /> 단일 영상 인식됨 · ID {media.id}{media.hash ? " · 비공개해시 " + media.hash : ""} — <a href={window.videoUrl(media.id, media.hash)} target="_blank" rel="noreferrer" style={{ color: "var(--ci-navy)", fontWeight: 700 }}>미리보기</a></span>
                      : <span style={{ color: "var(--ci-bad)" }}>링크에서 Vimeo ID를 찾지 못했어요 · vimeo.com/숫자 또는 showcase/숫자 형태인지 확인</span>)
                  : <span style={{ color: "var(--ci-muted)" }}>쇼케이스(여러 강의) 또는 단일 영상 링크를 붙여넣으면 그 강좌 페이지에 자동으로 연결됩니다</span>}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="vod-lab">강좌명</label>
                <input value={form.title} onChange={(e) => up("title", e.target.value)} style={inStyle} />
              </div>
              <div>
                <label className="vod-lab">레벨 · 대상</label>
                <input value={form.level} onChange={(e) => up("level", e.target.value)} placeholder="예: 고졸 검정고시" style={inStyle} />
              </div>
            </div>

            <div>
              <label className="vod-lab">담당 강사</label>
              <InstructorPicker value={form.instructor} onChange={(v) => up("instructor", v)} />
            </div>

            <div>
              <label className="vod-lab">무료 대상 반 <span style={{ color: "var(--ci-ok)", fontWeight: 700 }}>(이 반 학생은 자동 무료)</span></label>
              <ClassPicker value={form.className} onChange={(v) => up("className", v)} />
              <p style={{ fontSize: 11, color: "var(--ci-muted)", margin: "6px 0 0", lineHeight: 1.5 }}>
                학생 관리에서 학생의 <strong>‘학년·반’</strong>이 여기 지정한 반과 같으면, 배정하지 않아도 이 강의를 무료로 시청합니다 · 비워두면 개별 배정·구매로만 열립니다.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end" }}>
              <div>
                <label className="vod-lab">판매가 (원)</label>
                <input type="number" value={form.salePrice} onChange={(e) => up("salePrice", e.target.value)} disabled={form.isFree}
                  style={{ ...inStyle, opacity: form.isFree ? 0.5 : 1 }} />
              </div>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: "var(--ci-navy)", height: 40 }}>
                <input type="checkbox" checked={form.isFree} onChange={(e) => up("isFree", e.target.checked)} /> 전체 무료 공개
              </label>
            </div>

            <div>
              <label className="vod-lab">공개 범위</label>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={() => up("visibility", "public")}
                  className={"ci-act" + (form.visibility !== "members" ? " navy" : "")} style={{ flex: 1, justifyContent: "center" }}>
                  <Icon name="signal" size={12} /> 전체공개 · 샘플
                </button>
                <button type="button" onClick={() => up("visibility", "members")}
                  className={"ci-act" + (form.visibility === "members" ? " navy" : "")} style={{ flex: 1, justifyContent: "center" }}>
                  <Icon name="lock" size={12} /> 회원전용 · 진짜 강의
                </button>
              </div>
              <p style={{ fontSize: 11, color: "var(--ci-muted)", margin: "7px 0 0", lineHeight: 1.5 }}>
                {form.visibility === "members"
                  ? "· 공개 ‘강의’ 메뉴에서 숨김 — 로그인한 학생 대시보드에서만 보입니다."
                  : "· 누구나 볼 수 있는 공개 ‘강의’ 메뉴에 노출됩니다 (샘플·환영 강의용)."}
              </p>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              {custom
                ? <button className="ci-act" onClick={del} style={{ color: "var(--ci-bad)" }}><Icon name="trash" size={12} /> 강좌 삭제</button>
                : <span style={{ fontSize: 11.5, color: "var(--ci-muted)" }}>기본 제공 강좌 (삭제 불가)</span>}
              <div style={{ display: "flex", gap: 8 }}>
                <button className="ci-act" onClick={onToggle}>취소</button>
                <button className="ci-act navy" onClick={save}><Icon name="check" size={13} /> 저장</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VodAddForm({ onClose, onAdded }) {
  const [f, setF] = useStV({ title: "", subject: (SUBJECTS[0] || {}).id || "", instructor: (INSTRUCTORS[0] || {}).id || "", level: "", className: "", salePrice: 0, showcaseInput: "", visibility: "members" });
  const [pickerOpen, setPickerOpen] = useStV(false);
  const up = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const media = window.parseVimeoMedia(f.showcaseInput);
  const pickFromVimeo = (item) => {
    up("showcaseInput", item.link || String(item.id));
    if (!f.title.trim() && item.name) up("title", item.name);
    setPickerOpen(false);
  };

  const create = () => {
    if (!f.title.trim()) { alert("강좌명을 입력하세요"); return; }
    const id = "vod-" + Date.now().toString(36);
    const n = String((window.COURSES || []).length + 1).padStart(2, "0");
    const course = {
      id, no: n, title: f.title.trim(),
      subtitle: "", instructor: resolveInstructor(f.instructor), subject: f.subject,
      level: f.level.trim() || "전체", format: "VOD",
      classNames: f.className.trim(),
      lessons: 0, hours: 0, weeks: 0,
      price: Number(f.salePrice) || 0, salePrice: Number(f.salePrice) || 0, recordingPrice: Number(f.salePrice) || 0,
      rating: 0, reviews: 0, enrolled: 0,
      color: VOD_COLORS[(window.COURSES || []).length % VOD_COLORS.length],
      isFree: false,
      showcaseId: media.type === "showcase" ? media.id : "",
      vimeoId: media.type === "video" ? media.id : "",
      vimeoHash: media.type === "video" ? (media.hash || "") : "",
      visibility: f.visibility === "public" ? "public" : "members",
      description: "", syllabus: [], includes: [],
    };
    window.addCustomCourse(course);
    onAdded(id);
  };

  return (
    <div className="ci-card ci-card-pad" style={{ marginBottom: 16, border: "1.5px solid var(--ci-navy)" }}>
      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><Icon name="plus" size={14} /> 새 강좌 개설</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="vod-lab">강좌명</label>
          <input value={f.title} onChange={(e) => up("title", e.target.value)} placeholder="예: 고졸 검정고시 국어" style={inStyle} autoFocus />
        </div>
        <div>
          <label className="vod-lab">과목</label>
          <select value={f.subject} onChange={(e) => up("subject", e.target.value)} style={inStyle}>
            {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.ko}</option>)}
          </select>
        </div>
        <div>
          <label className="vod-lab">담당 강사</label>
          <InstructorPicker value={f.instructor} onChange={(v) => up("instructor", v)} />
        </div>
        <div>
          <label className="vod-lab">레벨 · 대상</label>
          <input value={f.level} onChange={(e) => up("level", e.target.value)} placeholder="예: 고졸 검정고시" style={inStyle} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="vod-lab">무료 대상 반 <span style={{ color: "var(--ci-ok)", fontWeight: 700 }}>(이 반 학생은 자동 무료)</span></label>
          <ClassPicker value={f.className} onChange={(v) => up("className", v)} />
          <p style={{ fontSize: 11, color: "var(--ci-muted)", margin: "6px 0 0", lineHeight: 1.5 }}>학생 관리의 ‘학년·반’이 같은 학생은 배정 없이 자동 무료 시청 · 비워두면 개별 배정/구매로만 열립니다.</p>
        </div>
        <div>
          <label className="vod-lab">판매가 (원)</label>
          <input type="number" value={f.salePrice} onChange={(e) => up("salePrice", e.target.value)} style={inStyle} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="vod-lab">공개 범위</label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => up("visibility", "public")}
              className={"ci-act" + (f.visibility !== "members" ? " navy" : "")} style={{ flex: 1, justifyContent: "center" }}>
              <Icon name="signal" size={12} /> 전체공개 · 샘플
            </button>
            <button type="button" onClick={() => up("visibility", "members")}
              className={"ci-act" + (f.visibility === "members" ? " navy" : "")} style={{ flex: 1, justifyContent: "center" }}>
              <Icon name="lock" size={12} /> 회원전용 · 진짜 강의
            </button>
          </div>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="vod-lab">Vimeo 링크 — 쇼케이스 또는 단일 영상 (선택 — 나중에 넣어도 됨)</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={f.showcaseInput} onChange={(e) => up("showcaseInput", e.target.value)} placeholder="https://vimeo.com/showcase/123  또는  https://vimeo.com/987654321" style={{ ...inStyle, flex: 1 }} />
            <button type="button" className={"ci-act" + (pickerOpen ? " navy" : "")} onClick={() => setPickerOpen((v) => !v)} style={{ whiteSpace: "nowrap" }}>
              <Icon name="signal" size={12} /> 비메오에서 불러오기
            </button>
          </div>
          {f.showcaseInput && <div style={{ marginTop: 6, fontSize: 12, color: media.type ? "var(--ci-ok)" : "var(--ci-bad)" }}>{media.type === "showcase" ? "✓ 쇼케이스 인식됨 · ID " + media.id : media.type === "video" ? ("✓ 단일 영상 인식됨 · ID " + media.id + (media.hash ? " · 해시 " + media.hash : "")) : "Vimeo ID를 찾지 못했어요"}</div>}
          {pickerOpen && <div style={{ marginTop: 10 }}><VimeoPicker onPick={pickFromVimeo} onClose={() => setPickerOpen(false)} /></div>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <button className="ci-act" onClick={onClose}>취소</button>
        <button className="ci-act navy" onClick={create}><Icon name="check" size={13} /> 개설하기</button>
      </div>
    </div>
  );
}

const inStyle = { width: "100%", height: 40, borderRadius: 8, border: "1px solid var(--ci-line)", padding: "0 12px", fontSize: 14, fontFamily: "var(--font-kr)" };

Object.assign(window, { VodManager });
