/* global window */
// ─────────────────────────────────────────────────────────────────
//  강좌 차시(lessons) — Supabase RPC 래퍼
//   · lessons 테이블은 직접 INSERT/UPDATE/DELETE 정책이 없다(관리자 포함).
//     쓰기는 반드시 SECURITY DEFINER RPC(vod_create_course_with_lessons /
//     vod_replace_course_lessons)를 통해서만 이루어진다 — RPC 내부에서
//     is_staff() 를 재검증하므로 학생/비로그인은 호출해도 거부된다.
//   · 조회(SELECT)만 is_staff() RLS 정책으로 관리자에게 직접 허용된다.
// ─────────────────────────────────────────────────────────────────

function _rjSbLessons() { return window.getSupabase && window.getSupabase(); }

// 신규 강좌 생성 — courses + lessons + site_store(custom) 를 한 번에(원자적으로) 저장
//   course:      courses 테이블 컬럼에 대응하는 값(id 필수)
//   lessons:     [{ order_index, title, vimeo_id, vimeo_hash, duration_sec, is_free }, ...]
//   siteCourse:  site_store.custom 배열에 그대로 반영할 강좌 객체(기존 addCustomCourse 가 쓰던 것과 동일 모양)
async function vodCreateCourseWithLessons(course, lessons, siteCourse) {
  const sb = _rjSbLessons(); if (!sb) return { ok: false, error: "Supabase 연결 없음" };
  try {
    const { data, error } = await sb.rpc("vod_create_course_with_lessons", {
      p_course: course || {}, p_lessons: lessons || [], p_site_course: siteCourse || null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// 기존 강좌의 차시 전체 교체 — 기본적으로 lessons만 바뀐다.
// coursePatch 를 명시적으로 넘길 때만 courses 의 해당 필드가 부분 갱신된다(전체 덮어쓰기 아님).
async function vodReplaceCourseLessons(courseId, lessons, coursePatch) {
  const sb = _rjSbLessons(); if (!sb) return { ok: false, error: "Supabase 연결 없음" };
  try {
    const { data, error } = await sb.rpc("vod_replace_course_lessons", {
      p_course_id: courseId, p_lessons: lessons || [], p_course_patch: coursePatch || null,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (e) { return { ok: false, error: String(e) }; }
}

// 관리자용 차시 목록 조회 — lessons_staff_read 정책(is_staff())으로 허용됨
async function vodFetchLessons(courseId) {
  const sb = _rjSbLessons(); if (!sb) return { ok: false, error: "Supabase 연결 없음", lessons: [] };
  try {
    const { data, error } = await sb.from("lessons").select("*").eq("course_id", courseId).order("order_index");
    if (error) return { ok: false, error: error.message, lessons: [] };
    return { ok: true, lessons: data || [] };
  } catch (e) { return { ok: false, error: String(e), lessons: [] }; }
}

// 관리자 "편집 → 저장"(및 개설) 후 site_store 뿐 아니라 public.courses 도 계속 최신으로 유지하기 위한 보조 동기화.
//   fields: { is_free?, price?, visibility?, class_names? } — 넘긴 키만 courses 에 반영된다(STEP4 학생 lessons
//   권한 판정이 courses 값을 기준으로 하므로 필요). site_store 저장(기존 흐름)과 별개의 부가 호출이며,
//   실패해도 site_store 저장 자체는 이미 끝난 뒤이므로 화면 흐름을 막지 않고 콘솔에만 남긴다.
async function vodSyncCourseFields(courseId, fields) {
  const sb = _rjSbLessons(); if (!sb) return { ok: false, error: "Supabase 연결 없음" };
  try {
    const { error } = await sb.rpc("vod_sync_course_fields", { p_course_id: courseId, p_fields: fields || {} });
    if (error) { console.warn("vodSyncCourseFields 실패:", error.message); return { ok: false, error: error.message }; }
    return { ok: true };
  } catch (e) { console.warn("vodSyncCourseFields 실패:", e); return { ok: false, error: String(e) }; }
}

Object.assign(window, { vodCreateCourseWithLessons, vodReplaceCourseLessons, vodFetchLessons, vodSyncCourseFields });
