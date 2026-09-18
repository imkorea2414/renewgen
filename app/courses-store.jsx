/* global window */
// ──────────────────────────────────────────────────────────────────
//  강좌 미디어 · 개설 저장소
//   · 관리자 페이지에서 강좌별 [쇼케이스 링크 + 대표사진 + 판매설정] 편집
//   · 새 강좌 개설(custom)
//   · localStorage 저장 → COURSES 배열에 제자리 병합(다른 모듈이 같은 참조 사용)
//  실서버에서는 Supabase 로 이관 예정.
// ──────────────────────────────────────────────────────────────────
const RJ_COURSES_KEY = "rj_courses_store_v1";

function loadCoursesStore() {
  try {
    const s = JSON.parse(localStorage.getItem(RJ_COURSES_KEY) || "null");
    if (s && s.overrides && Array.isArray(s.custom)) return s;
  } catch (e) {}
  return { overrides: {}, custom: [] };
}
function saveCoursesStore(s) {
  try { localStorage.setItem(RJ_COURSES_KEY, JSON.stringify(s)); } catch (e) {}
  if (window.rjPushCoursesStore) window.rjPushCoursesStore(s).catch(() => {});
}

// 쇼케이스 ID 추출 — URL / 임베드코드 / 숫자 무엇이든 허용
//   https://vimeo.com/showcase/12345678  ·  .../showcase/12345678/embed
//   <iframe src="https://vimeo.com/showcase/12345678/embed" …>  ·  12345678
function parseShowcaseId(input) {
  if (!input) return "";
  const s = String(input).trim();
  const m = s.match(/showcase\/(\d+)/);
  if (m) return m[1];
  if (/^\d{5,}$/.test(s)) return s;
  return "";
}
function showcaseEmbedSrc(id) { return "https://vimeo.com/showcase/" + id + "/embed"; }
function showcaseUrl(id) { return "https://vimeo.com/showcase/" + id; }

// 통합 파서 — 쇼케이스 / 단일 영상(+비공개 해시) 무엇이든 인식
//   showcase/123          → { type:'showcase', id:'123' }
//   vimeo.com/987         → { type:'video', id:'987' }
//   vimeo.com/987/abcd123 → { type:'video', id:'987', hash:'abcd123' }   (비공개 링크)
//   player.vimeo.com/video/987?h=abcd  → { type:'video', id:'987', hash:'abcd' }
//   <iframe src="…">      → 위 규칙으로 추출
function parseVimeoMedia(input) {
  if (!input) return { type: "", id: "", hash: "" };
  const s = String(input).trim();
  let m = s.match(/showcase\/(\d+)/i);
  if (m) return { type: "showcase", id: m[1], hash: "" };
  let id = "", hash = "";
  m = s.match(/player\.vimeo\.com\/video\/(\d+)/i); if (m) id = m[1];
  if (!id) { m = s.match(/vimeo\.com\/(?:manage\/videos\/)?(\d{6,})(?:\/(\w+))?/i); if (m) { id = m[1]; if (m[2]) hash = m[2]; } }
  const hm = s.match(/[?&]h=(\w+)/i); if (hm) hash = hm[1];
  if (!id && /^\d{6,}$/.test(s)) id = s;
  if (id) return { type: "video", id, hash };
  return { type: "", id: "", hash: "" };
}

// 단일 영상 임베드 URL (비공개 해시 지원)
function videoEmbedSrc(id, hash) {
  const h = hash ? ("h=" + hash + "&") : "";
  return "https://player.vimeo.com/video/" + id + "?" + h + "title=0&byline=0&portrait=0";
}
function videoUrl(id, hash) { return "https://vimeo.com/" + id + (hash ? "/" + hash : ""); }

// COURSES 에 저장값 병합 (제자리 mutate)
function applyCoursesStore() {
  const C = window.COURSES;
  if (!Array.isArray(C)) return;
  for (let i = C.length - 1; i >= 0; i--) if (C[i].__custom) C.splice(i, 1); // 이전 custom 제거
  const store = loadCoursesStore();
  for (const c of C) { const ov = store.overrides[c.id]; if (ov) Object.assign(c, ov); }
  for (const cc of store.custom) C.push({ __custom: true, ...cc, ...(store.overrides[cc.id] || {}) });
}

function setCourseOverride(id, patch) {
  const s = loadCoursesStore();
  s.overrides[id] = { ...(s.overrides[id] || {}), ...patch };
  saveCoursesStore(s); applyCoursesStore();
}
function addCustomCourse(course) {
  const s = loadCoursesStore();
  s.custom.push(course); saveCoursesStore(s); applyCoursesStore();
}
function removeCustomCourse(id) {
  const s = loadCoursesStore();
  s.custom = s.custom.filter((c) => c.id !== id);
  delete s.overrides[id];
  saveCoursesStore(s); applyCoursesStore();
}
function isCustomCourse(id) {
  return loadCoursesStore().custom.some((c) => c.id === id);
}

// 공개 범위 — 'public'(샘플·누구나)와 'members'(회원전용)로 표시되지만
// /courses 메뉴에서는 둘 다 노출됩니다 (비수강생이 둘러보고 결제할 수 있게).
function courseVisibility(c) { return c && c.visibility === "members" ? "members" : "public"; }
function publicCourses() {
  // VOD 강좌(쇼케이스, 단일 영상, 또는 STEP3 개별 lessons 로 구성된 강좌)만 노출 — 데모/빈 강좌는 숨김
  return (window.COURSES || []).filter((c) => c.showcaseId || c.vimeoId || Number(c.lessons || 0) > 0);
}
function memberCourses() { return (window.COURSES || []).filter((c) => courseVisibility(c) === "members"); }

applyCoursesStore();

// ──────────────────────────────────────────────────────────────────
//  강사 저장소 — 관리자가 직접 추가한 강사(검정고시 등 맞는 강사가 없을 때)
//   · INSTRUCTORS 가 비어 있어 선택지가 없을 때 이름만으로 강사를 만든다
// ──────────────────────────────────────────────────────────────────
const RJ_INSTR_KEY = "rj_instructors_store_v1";
function loadInstrStore() { try { const a = JSON.parse(localStorage.getItem(RJ_INSTR_KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function saveInstrStore(a) {
  try { localStorage.setItem(RJ_INSTR_KEY, JSON.stringify(a)); } catch (e) {}
  if (window.rjPushInstrStore) window.rjPushInstrStore(a).catch(() => {});
}
function applyInstrStore() {
  const I = window.INSTRUCTORS;
  if (!Array.isArray(I)) return;
  for (let i = I.length - 1; i >= 0; i--) if (I[i] && I[i].__custom) I.splice(i, 1);
  for (const c of loadInstrStore()) I.push({ __custom: true, ...c });
}
// 이름으로 강사를 찾거나 새로 만들어 id 를 돌려준다
function upsertInstructorByName(name) {
  const nm = (name || "").trim();
  if (!nm) return "";
  const I = window.INSTRUCTORS || [];
  const found = I.find((x) => (x.name || "").trim() === nm);
  if (found) return found.id;
  const id = "ins-" + Date.now().toString(36);
  const rec = { id, name: nm, nameEn: "", initials: /[가-힣]/.test(nm) ? nm.slice(-2) : nm.slice(0, 2).toUpperCase(), subject: "", title: "" };
  const store = loadInstrStore(); store.push(rec); saveInstrStore(store); applyInstrStore();
  return id;
}
applyInstrStore();

Object.assign(window, {
  loadCoursesStore, saveCoursesStore, parseShowcaseId, showcaseEmbedSrc, showcaseUrl,
  parseVimeoMedia, videoEmbedSrc, videoUrl,
  applyCoursesStore, setCourseOverride, addCustomCourse, removeCustomCourse, isCustomCourse,
  courseVisibility, publicCourses, memberCourses,
  upsertInstructorByName, applyInstrStore,
});
