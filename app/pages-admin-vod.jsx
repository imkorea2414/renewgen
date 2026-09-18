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
// mode="video" — 쇼케이스 탭을 숨기고 단일 영상만 고르게 한다(차시별 영상 선택용)
// mode="showcase" — 단일 영상 탭을 숨기고 쇼케이스만 고르게 한다("Showcase 전체 가져오기"의 쇼케이스 선택용)
function VimeoPicker({ onPick, onClose, mode }) {
  const videoOnly = mode === "video";
  const showcaseOnly = mode === "showcase";
  const [tab, setTab] = useStV(videoOnly ? "videos" : "showcases"); // showcases | videos
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
        {videoOnly ? (
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ci-muted)" }}>단일 영상에서 선택</div>
        ) : showcaseOnly ? (
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ci-muted)" }}>쇼케이스에서 선택</div>
        ) : (
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" onClick={() => setTab("showcases")}
              className={"ci-act" + (tab === "showcases" ? " navy" : "")}>쇼케이스</button>
            <button type="button" onClick={() => setTab("videos")}
              className={"ci-act" + (tab === "videos" ? " navy" : "")}>단일 영상</button>
          </div>
        )}
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

// 차시(lesson) 하나 — order_index 는 저장 시 화면 순서(위→아래)대로 10,20,30…으로 다시 매겨진다
function emptyLesson() { return { title: "", vimeo_id: "", vimeo_hash: "", duration_sec: 0, _vimeoName: "" }; }

// Showcase 안의 영상을 전체 페이지 끝까지 조회 — 기존 vimeo-list(type=showcase-videos)를 그대로 재사용.
// "더 불러오기"를 반복 클릭하지 않아도 되도록 자동으로 다음 page 를 계속 호출한다.
//   · Vimeo 가 돌려주는 total 값을 종료 조건으로 쓰지 않는다 — total 이 실제 개수보다 작게(부정확하게)
//     오면 "이미 total만큼 모았다"고 오판해 조기 종료되어 나머지 차시가 통째로 누락되는 문제가 있었다
//     (실제 재현된 버그: total 이 6으로 왔을 때 40개 중 6개만 가져오고 멈춤). 대신 표준 REST 페이지네이션
//     관례대로 "이번 페이지가 요청한 per_page 보다 적게 왔는지"만으로 마지막 페이지를 판정한다.
//     total 은 화면에 참고 표시하는 용도로만 반환한다(진행 종료 판단에는 전혀 사용하지 않음).
//   · 페이지를 합칠 때 video ID 기준으로 중복 제거한다(경계에서 같은 영상이 중복 반환되는 경우 대비).
//   · 무한루프 방지용 안전 상한만 둔다(쇼케이스 하나당 최대 2000개 영상까지 커버).
async function fetchAllShowcaseVideos(showcaseId) {
  const perPage = 100;
  const maxPages = 20;
  let page = 1, total = 0;
  const seen = new Set();
  const all = [];
  while (page <= maxPages) {
    const qs = "?type=showcase-videos&showcase_id=" + encodeURIComponent(showcaseId) + "&per_page=" + perPage + "&page=" + page;
    const r = await vimeoListCall(qs);
    if (!r.ok) return { ok: false, msg: r.msg || "불러오기 실패" };
    total = Number(r.total) || total; // 이전에 받은 정상값을 0으로 덮어쓰지 않음 — 표시용으로만 사용
    const pageItems = r.items || [];
    if (pageItems.length === 0) break; // 빈 페이지 → 더 이상 결과 없음

    let addedThisPage = 0;
    for (const it of pageItems) {
      const vid = String(it.id || "");
      if (vid && !seen.has(vid)) { seen.add(vid); all.push(it); addedThisPage++; }
    }

    const isLastPage = pageItems.length < perPage; // 요청한 만큼 안 왔으면 마지막 페이지로 판단(total 은 보지 않음)
    if (isLastPage || addedThisPage === 0) break; // addedThisPage===0: 같은 페이지 반복 응답 등 무한루프 방지
    page += 1;
  }
  return { ok: true, items: all, total: total || all.length };
}

// 영상 제목의 "N강" 패턴에서 차시 번호를 추출 — 업로드 순서/날짜는 절대 사용하지 않는다.
// 서로 다른 번호가 2개 이상 매칭되면(제목이 모호하면) null 을 돌려줘 자동분류하지 않고 미분류로 남긴다.
function extractLessonNumber(title) {
  // NFKC 정규화: Vimeo 제목에 전각(fullwidth) 숫자(예: "１강")나 기타 호환 문자로 입력된 경우
  // \d(반각 숫자만 인식)가 전혀 매칭되지 않아 전체가 미분류로 빠지는 문제를 방지한다.
  // 일반적인 반각 숫자 제목("1강")에는 영향이 없다(무변화).
  const normalized = String(title || "").normalize("NFKC");
  const re = /(\d{1,3})\s*강(?=[_\s]|$)/g;
  const nums = [...normalized.matchAll(re)].map((m) => Number(m[1]));
  if (nums.length === 0) return null;
  const uniq = [...new Set(nums)];
  return uniq.length === 1 ? uniq[0] : null;
}

// Showcase 하나를 골라 그 안의 영상 전체를 "N강" 기준으로 자동 분류·정렬해 검증 결과를 보여주는 패널.
// 이 패널의 모든 동작(조회/채우기)은 화면 상태만 바꾼다 — DB 저장은 LessonsEditor 바깥의 "차시 저장"
// 버튼(vod_replace_course_lessons RPC)을 눌러야만 일어난다.
function ShowcaseImportPanel({ defaultShowcaseId, lessons, onFill, onClose }) {
  const [showcaseId, setShowcaseId] = useStV(defaultShowcaseId || "");
  const [pickerOpen, setPickerOpen] = useStV(!defaultShowcaseId);
  const [phase, setPhase] = useStV(defaultShowcaseId ? "ready" : "pick"); // pick | ready | loading | reviewing | error
  const [items, setItems] = useStV([]);
  const [expectedTotal, setExpectedTotal] = useStV(0);
  const [err, setErr] = useStV("");
  const [confirmMode, setConfirmMode] = useStV(false);

  const runFetch = (id) => {
    setPhase("loading"); setErr("");
    fetchAllShowcaseVideos(id).then((r) => {
      if (!r.ok) { setPhase("error"); setErr(r.msg || "불러오기 실패"); return; }
      const classified = r.items.map((it) => ({ ...it, _num: extractLessonNumber(it.name) }));
      const nums = classified.filter((c) => c._num != null).map((c) => c._num);
      setExpectedTotal(nums.length ? Math.max(...nums) : 0);
      setItems(classified);
      setPhase("reviewing");
    });
  };

  const pickShowcase = (item) => {
    const id = String(item.id || "");
    setShowcaseId(id);
    setPickerOpen(false);
    runFetch(id);
  };

  const byNum = {};
  items.forEach((c) => { if (c._num != null) (byNum[c._num] = byNum[c._num] || []).push(c); });
  const unclassified = items.filter((c) => c._num == null);
  const duplicateNums = Object.keys(byNum).map(Number).filter((n) => byNum[n].length > 1).sort((a, b) => a - b);
  const uniqueNums = Object.keys(byNum).map(Number);
  const recognizedCount = items.length - unclassified.length;
  const missing = [];
  for (let n = 1; n <= expectedTotal; n++) if (!byNum[n]) missing.push(n);
  const allMatched = phase === "reviewing" && expectedTotal > 0
    && missing.length === 0 && duplicateNums.length === 0 && unclassified.length === 0 && uniqueNums.length === expectedTotal;

  // 번호가 "고유하게" 인식된 영상만 채우기 대상 — 중복 번호는 자동으로 하나를 고르지 않는다.
  const fillable = items.filter((c) => c._num != null && byNum[c._num].length === 1).slice().sort((a, b) => a._num - b._num);
  const hasExistingContent = lessons.some((l) => l.title.trim() || l.vimeo_id);

  const doFill = (mode) => {
    const newLessons = fillable.map((it) => {
      const media = window.parseVimeoMedia(it.link || String(it.id));
      return {
        title: it.name || "",
        vimeo_id: media.type === "video" ? media.id : String(it.id || ""),
        vimeo_hash: media.type === "video" ? (media.hash || "") : "",
        duration_sec: Number(it.duration) || 0,
        _vimeoName: it.name || "",
      };
    });
    onFill(newLessons, mode);
    onClose();
  };

  return (
    <div className="ci-card ci-card-pad" style={{ marginBottom: 14, background: "#fafafa" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ci-muted)" }}>Showcase 전체 가져오기</div>
        <button type="button" className="ci-act" onClick={onClose}><Icon name="close" size={12} /> 닫기</button>
      </div>

      {phase === "pick" && !pickerOpen && (
        <div>
          <p style={{ fontSize: 12.5, color: "var(--ci-muted)", marginBottom: 10 }}>가져올 Vimeo 쇼케이스를 선택하세요.</p>
          <button type="button" className="ci-act navy" onClick={() => setPickerOpen(true)}><Icon name="signal" size={12} /> 쇼케이스 선택</button>
        </div>
      )}
      {pickerOpen && (
        <VimeoPicker mode="showcase" onPick={pickShowcase} onClose={() => setPickerOpen(false)} />
      )}

      {phase === "ready" && !pickerOpen && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12.5 }}>현재 연결된 Showcase <strong>{showcaseId}</strong>에서 가져올까요?</span>
          <button type="button" className="ci-act navy" onClick={() => runFetch(showcaseId)}>이 Showcase에서 가져오기</button>
          <button type="button" className="ci-act" onClick={() => { setPhase("pick"); setPickerOpen(true); }}>다른 Showcase 선택</button>
        </div>
      )}

      {phase === "loading" && <div style={{ fontSize: 13, color: "var(--ci-muted)", padding: "12px 0" }}>Showcase 영상 전체를 불러오는 중…</div>}
      {phase === "error" && <div style={{ fontSize: 13, color: "var(--ci-bad)", padding: "12px 0" }}>{err}</div>}

      {phase === "reviewing" && (
        <div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", marginBottom: 10, fontSize: 12.5 }}>
            <span>Showcase 영상 <strong>{items.length}</strong>개</span>
            <span>강의번호 인식 <strong>{recognizedCount}</strong>개</span>
            <span>예상 차시:
              <input type="number" min="0" value={expectedTotal}
                onChange={(e) => setExpectedTotal(Math.max(0, Number(e.target.value) || 0))}
                style={{ ...inStyle, width: 64, height: 26, marginLeft: 6, display: "inline-block" }} /> 강
            </span>
          </div>
          <div style={{ display: "grid", gap: 4, fontSize: 12.5, marginBottom: 10 }}>
            <div>누락: {missing.length ? missing.map((n) => n + "강").join(", ") : "없음"}</div>
            <div>중복: {duplicateNums.length ? duplicateNums.map((n) => n + "강").join(", ") : "없음"}</div>
            <div>미분류: {unclassified.length}개</div>
            <div style={{ fontWeight: 700, color: allMatched ? "var(--ci-ok)" : "var(--ci-bad)" }}>
              {allMatched ? ("✓ 1~" + expectedTotal + "강 전체 확인 완료") : "⚠ 전체 매칭 확인 필요"}
            </div>
          </div>

          {duplicateNums.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>중복 후보 (자동으로 선택하지 않음 — 직접 확인 필요)</div>
              {duplicateNums.map((n) => (
                <div key={n} style={{ fontSize: 12, marginBottom: 4 }}>
                  <strong>{n}강</strong>
                  <ul style={{ margin: "2px 0 0 18px", padding: 0 }}>
                    {byNum[n].map((it) => <li key={it.id}>{it.name} · ID {it.id}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {unclassified.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>미분류 영상(번호를 찾지 못함)</div>
              <ul style={{ margin: "2px 0 0 18px", padding: 0, fontSize: 12 }}>
                {unclassified.map((it) => <li key={it.id}>{it.name} · ID {it.id}</li>)}
              </ul>
            </div>
          )}

          <p style={{ fontSize: 11, color: "var(--ci-muted)", margin: "0 0 10px", lineHeight: 1.5 }}>
            번호가 고유하게 인식된 {fillable.length}개만 아래 "채우기"에 포함됩니다 · 중복/미분류 영상은 필요하면 개별 "Vimeo에서 선택"으로 직접 추가해주세요.
          </p>
          {!allMatched && (
            <p style={{ fontSize: 12, color: "var(--ci-bad)", margin: "0 0 10px", fontWeight: 700, lineHeight: 1.5 }}>
              ⚠ 예상 차시 1~{expectedTotal || "N"}강이 전부 정확히 하나씩 확인되어야 채우기를 진행할 수 있습니다.
              누락·중복·미분류를 먼저 해결하거나(또는 Showcase를 다시 조회) "예상 차시"를 실제 영상 수에 맞게 수정해주세요.
              불완전한 목록을 그대로 채우면 차시 번호가 실제 강의 번호와 어긋날 수 있어 막아두었습니다.
            </p>
          )}

          {!confirmMode ? (
            <button type="button" className="ci-act navy" disabled={!allMatched}
              onClick={() => (hasExistingContent ? setConfirmMode(true) : doFill("replace"))}>
              <Icon name="check" size={12} /> 이 목록을 차시에 채우기 ({fillable.length}개)
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5 }}>현재 차시 목록이 이미 있습니다 —</span>
              <button type="button" className="ci-act navy" onClick={() => doFill("replace")}>기존 목록 교체</button>
              <button type="button" className="ci-act" onClick={() => doFill("append")}>기존 목록 뒤에 추가</button>
              <button type="button" className="ci-act" onClick={() => setConfirmMode(false)}>취소</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 강좌 하나의 차시 목록을 구성/편집하는 패널 — 새 강좌 개설과 기존 강좌 "차시 관리"에서 공용으로 쓴다.
// VimeoPicker(mode="video") 를 그대로 재사용하고, 새 Vimeo API 는 추가하지 않는다.
function LessonsEditor({ lessons, onChange, defaultShowcaseId }) {
  const [pickerFor, setPickerFor] = useStV(null); // 현재 Vimeo 선택 중인 차시의 index
  const [importOpen, setImportOpen] = useStV(false);
  const up = (i, patch) => onChange(lessons.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const add = () => onChange([...lessons, emptyLesson()]);
  const remove = (i) => onChange(lessons.filter((_, idx) => idx !== i));
  const fillFromImport = (newLessons, mode) => onChange(mode === "append" ? [...lessons, ...newLessons] : newLessons);
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= lessons.length) return;
    const next = lessons.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const pickFromVimeo = (i, item) => {
    const media = window.parseVimeoMedia(item.link || String(item.id));
    up(i, {
      vimeo_id: media.type === "video" ? media.id : String(item.id || ""),
      vimeo_hash: media.type === "video" ? (media.hash || "") : "",
      duration_sec: Number(item.duration) || 0,
      _vimeoName: item.name || "",
      title: lessons[i].title.trim() ? lessons[i].title : (item.name || ""),
    });
    setPickerFor(null);
  };

  return (
    <div>
      <label className="vod-lab">차시 구성</label>
      <div style={{ display: "grid", gap: 10 }}>
        {lessons.map((l, i) => (
          <div key={i} className="ci-card" style={{ padding: 12, background: "#fafafa" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span className="ci-badge navy" style={{ fontSize: 10.5, flexShrink: 0 }}>{i + 1}강</span>
              <input value={l.title} onChange={(e) => up(i, { title: e.target.value })}
                placeholder="차시명 (예: 문학의 개념)" style={{ ...inStyle, flex: 1 }} />
              <button type="button" className="ci-act" disabled={i === 0} onClick={() => move(i, -1)} title="위로">
                <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}><Icon name="chevronDown" size={12} /></span>
              </button>
              <button type="button" className="ci-act" disabled={i === lessons.length - 1} onClick={() => move(i, 1)} title="아래로"><Icon name="chevronDown" size={12} /></button>
              <button type="button" className="ci-act" onClick={() => remove(i)} style={{ color: "var(--ci-bad)" }}><Icon name="trash" size={12} /> 삭제</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: l.vimeo_id ? "var(--ci-ok)" : "var(--ci-muted)" }}>
                {l.vimeo_id
                  ? <><Icon name="check" size={11} /> {l._vimeoName || ("Vimeo 영상 · ID " + l.vimeo_id)}{l.duration_sec ? " · " + vodDurationLabel(l.duration_sec) : ""}</>
                  : "아직 영상을 선택하지 않았습니다"}
              </span>
              <button type="button" className={"ci-act" + (pickerFor === i ? " navy" : "")} onClick={() => setPickerFor(pickerFor === i ? null : i)}>
                <Icon name="signal" size={12} /> Vimeo에서 선택
              </button>
            </div>
            {pickerFor === i && (
              <div style={{ marginTop: 10 }}>
                <VimeoPicker mode="video" onPick={(item) => pickFromVimeo(i, item)} onClose={() => setPickerFor(null)} />
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button type="button" className="ci-act navy" onClick={add}>
          <Icon name="plus" size={12} /> 차시 추가
        </button>
        <button type="button" className={"ci-act" + (importOpen ? " navy" : "")} onClick={() => setImportOpen((v) => !v)}>
          <Icon name="signal" size={12} /> Showcase 전체 가져오기
        </button>
      </div>
      {importOpen && (
        <div style={{ marginTop: 10 }}>
          <ShowcaseImportPanel defaultShowcaseId={defaultShowcaseId} lessons={lessons}
            onFill={fillFromImport} onClose={() => setImportOpen(false)} />
        </div>
      )}
      <p style={{ fontSize: 11, color: "var(--ci-muted)", margin: "8px 0 0", lineHeight: 1.5 }}>
        차시가 없어도 강좌는 저장됩니다 · 기존 "Vimeo 링크(쇼케이스/단일 영상)"과는 별개로, 강좌 안에 여러 차시를 개별 영상으로 구성할 때 사용합니다.
      </p>
    </div>
  );
}

// LessonsEditor 의 화면 배열 → RPC 에 보낼 lessons jsonb 배열(order_index 10,20,30… 부여, 빈 차시는 제외)
function lessonsToPayload(lessons) {
  return lessons
    .filter((l) => l.title.trim() || l.vimeo_id)
    .map((l, i) => ({
      order_index: (i + 1) * 10,
      title: l.title.trim() || (l._vimeoName || (i + 1) + "강"),
      vimeo_id: l.vimeo_id || "",
      vimeo_hash: l.vimeo_hash || "",
      duration_sec: Number(l.duration_sec) || 0,
      is_free: false,
    }));
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
    // site_store 저장과 별개로 public.courses 도 계속 최신 상태로 동기화(STEP4 학생 lessons 권한 판정용).
    window.vodSyncCourseFields(course.id, {
      is_free: patch.isFree,
      price: patch.salePrice,
      visibility: patch.visibility,
      class_names: patch.classNames || null,
    });
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

  const [lessonsOpen, setLessonsOpen] = useStV(false);

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
        <div style={{ display: "flex", gap: 8 }}>
          <button className="ci-act" onClick={() => setLessonsOpen((v) => !v)}>
            {lessonsOpen ? "닫기" : <><Icon name="book" size={12} /> 차시 관리</>}
          </button>
          <button className="ci-act" onClick={onToggle}>{open ? "닫기" : <><Icon name="edit" size={12} /> 편집</>}</button>
        </div>
      </div>

      {/* 차시 관리 패널 */}
      {lessonsOpen && <LessonsManagePanel course={course} onClose={() => setLessonsOpen(false)} showToast={showToast} />}

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

// 기존 강좌의 차시 목록을 불러와 편집 — 기본적으로 lessons만 바꾸고 courses 는 건드리지 않는다
// (course_patch 없이 vod_replace_course_lessons 호출 — 강좌 정보 자체를 바꾸려면 위의 "편집" 패널을 쓴다)
function LessonsManagePanel({ course, onClose, showToast }) {
  const [loading, setLoading] = useStV(true);
  const [err, setErr] = useStV("");
  const [lessons, setLessons] = useStV([]);
  const [saving, setSaving] = useStV(false);

  React.useEffect(() => {
    let alive = true;
    window.vodFetchLessons(course.id).then((r) => {
      if (!alive) return;
      setLoading(false);
      if (!r.ok) { setErr(r.error || "차시를 불러오지 못했습니다"); return; }
      setLessons((r.lessons || []).map((row) => ({
        title: row.title || "",
        vimeo_id: row.vimeo_id || "",
        vimeo_hash: row.vimeo_hash || "",
        duration_sec: row.duration_sec || 0,
        _vimeoName: "",
      })));
    });
    return () => { alive = false; };
  }, [course.id]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const r = await window.vodReplaceCourseLessons(course.id, lessonsToPayload(lessons), null);
    setSaving(false);
    if (!r.ok) { alert("차시 저장 실패: " + (r.error || "알 수 없는 오류")); return; }
    // site_store/window.COURSES 의 lessons 개수도 함께 동기화 — 학생 목록 노출 필터(publicCourses 등)가 이 값을 기준으로 하기 때문.
    window.setCourseOverride(course.id, { lessons: lessons.length });
    showToast("차시가 저장되었습니다");
  };

  return (
    <div style={{ borderTop: "1px solid var(--ci-line)", padding: 18, background: "var(--ci-bg)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <strong style={{ fontSize: 14 }}>차시 관리 · {course.title}</strong>
        <button type="button" className="ci-act" onClick={onClose}><Icon name="close" size={12} /> 닫기</button>
      </div>
      {loading && <div style={{ fontSize: 13, color: "var(--ci-muted)" }}>차시 목록을 불러오는 중…</div>}
      {!loading && err && <div style={{ fontSize: 13, color: "var(--ci-bad)" }}>{err}</div>}
      {!loading && !err && (
        <>
          <LessonsEditor lessons={lessons} onChange={setLessons} defaultShowcaseId={course.showcaseId} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
            <button className="ci-act navy" onClick={save} disabled={saving}>
              <Icon name="check" size={13} /> {saving ? "저장 중…" : "차시 저장"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function VodAddForm({ onClose, onAdded }) {
  const [f, setF] = useStV({ title: "", subject: (SUBJECTS[0] || {}).id || "", instructor: (INSTRUCTORS[0] || {}).id || "", level: "", className: "", salePrice: 0, showcaseInput: "", visibility: "members" });
  const [pickerOpen, setPickerOpen] = useStV(false);
  const [lessons, setLessons] = useStV([]);
  const [saving, setSaving] = useStV(false);
  const up = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const media = window.parseVimeoMedia(f.showcaseInput);
  const pickFromVimeo = (item) => {
    up("showcaseInput", item.link || String(item.id));
    if (!f.title.trim() && item.name) up("title", item.name);
    setPickerOpen(false);
  };

  const create = async () => {
    if (!f.title.trim()) { alert("강좌명을 입력하세요"); return; }
    if (saving) return;
    setSaving(true);

    const id = "vod-" + Date.now().toString(36);
    const n = String((window.COURSES || []).length + 1).padStart(2, "0");
    const instructorId = resolveInstructor(f.instructor);
    const siteCourse = {
      id, no: n, title: f.title.trim(),
      subtitle: "", instructor: instructorId, subject: f.subject,
      level: f.level.trim() || "전체", format: "VOD",
      classNames: f.className.trim(),
      lessons: lessons.length, hours: 0, weeks: 0,
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
    // 실제 courses 테이블용 값 — site_store 표시용(siteCourse)과 별개로, DB 컬럼에 대응하는 값만 담는다.
    const courseRow = {
      id,
      title: siteCourse.title,
      instructor: instructorId,
      subject: f.subject,
      level: siteCourse.level,
      price: siteCourse.price,
      is_free: false,
      showcase_id: siteCourse.showcaseId,
      vimeo_id: siteCourse.vimeoId,
      vimeo_hash: siteCourse.vimeoHash,
      visibility: siteCourse.visibility,
    };

    const r = await window.vodCreateCourseWithLessons(courseRow, lessonsToPayload(lessons), siteCourse);
    setSaving(false);
    if (!r.ok) { alert("강좌 저장 실패: " + (r.error || "알 수 없는 오류")); return; }

    // vod_create_course_with_lessons(STEP3, 수정하지 않음)는 courses.class_names 컬럼을 알지 못하므로
    // (STEP4에서 새로 추가된 컬럼) 개설 시 지정한 "무료 대상 반"을 별도로 한 번 더 동기화한다.
    if (siteCourse.classNames) window.vodSyncCourseFields(id, { class_names: siteCourse.classNames });

    // RPC가 courses+lessons+site_store 를 이미 원자적으로 저장했으므로, 여기서는
    // 현재 브라우저의 로컬 캐시/화면(window.COURSES)만 즉시 반영한다(중복 클라우드 push는 무해함).
    window.addCustomCourse(siteCourse);
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
        <div style={{ gridColumn: "1 / -1", borderTop: "1px solid var(--ci-line)", paddingTop: 14, marginTop: 4 }}>
          <LessonsEditor lessons={lessons} onChange={setLessons} defaultShowcaseId={media.type === "showcase" ? media.id : ""} />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
        <button className="ci-act" onClick={onClose} disabled={saving}>취소</button>
        <button className="ci-act navy" onClick={create} disabled={saving}>
          <Icon name="check" size={13} /> {saving ? "저장 중…" : "개설하기"}
        </button>
      </div>
    </div>
  );
}

const inStyle = { width: "100%", height: 40, borderRadius: 8, border: "1px solid var(--ci-line)", padding: "0 12px", fontSize: 14, fontFamily: "var(--font-kr)" };

Object.assign(window, { VodManager });
