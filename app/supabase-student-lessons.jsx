/* global window */
// ─────────────────────────────────────────────────────────────────
//  STEP4: 학생용 lessons 조회 — Supabase RPC 래퍼
//   · lessons 테이블 자체는 학생에게 SELECT 권한이 없다(lessons_staff_read 는 관리자 전용,
//     그대로 유지). 학생은 반드시 vod_get_student_lessons RPC(SECURITY DEFINER)를 통해서만
//     자신이 실제로 권한이 있는 강좌의 차시(및 vimeo_id/vimeo_hash)를 받는다.
//   · RPC 내부가 매 호출마다 staff/무료강좌/구독/구매/반 자동배정 여부를 서버에서 재검증하므로,
//     프론트의 RJ_PUBLIC_PREVIEW 값이나 course_id 변조는 이 응답 결과에 영향을 줄 수 없다.
// ─────────────────────────────────────────────────────────────────

// 반환: { ok:true, reason, lessons:[...] } | { ok:false, reason: 'need-login'|'locked'|'not-found' }
async function vodFetchStudentLessons(courseId) {
  const sb = window.getSupabase && window.getSupabase();
  if (!sb) return { ok: false, reason: "error", lessons: [] };
  try {
    const { data, error } = await sb.rpc("vod_get_student_lessons", { p_course_id: courseId });
    if (error) return { ok: false, reason: "error", error: error.message, lessons: [] };
    return data && typeof data === "object" ? data : { ok: false, reason: "error", lessons: [] };
  } catch (e) {
    return { ok: false, reason: "error", error: String(e), lessons: [] };
  }
}

Object.assign(window, { vodFetchStudentLessons });
