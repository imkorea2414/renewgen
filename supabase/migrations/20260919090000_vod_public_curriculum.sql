-- 강좌 상세페이지 커리큘럼 공개 — "누구나 볼 수 있는 커리큘럼 정보"와 "구매자만 받는 재생정보"를
-- 명확히 분리하기 위한 신규 RPC 1개만 추가한다.
--
-- 배경: vod_get_student_lessons(STEP4)는 전부-아니면-전무 구조로, 권한이 없으면 title 등
--   어떤 정보도 반환하지 않는다(의도된 동작, 그대로 유지). 그래서 강좌 소개 페이지의
--   "커리큘럼" 탭(미구매 방문자도 둘러볼 수 있어야 함)에는 재사용할 수 없다.
--
-- 이 마이그레이션이 하는 일: public.vod_get_course_curriculum(course_id) 신규 함수 1개 생성.
--   · order_index, title, duration_sec 3개 컬럼만 반환 — vimeo_id/vimeo_hash 는 절대 포함하지 않는다.
--   · 구매/구독/무료 여부를 검증하지 않는다(애초에 재생에 필요한 정보를 안 주므로 검증할 이유가 없다).
--   · public.lessons 의 RLS(lessons_staff_read 1개)는 전혀 건드리지 않는다. anon/authenticated 에게
--     lessons 테이블 직접 SELECT 권한을 주는 정책은 추가하지 않는다 — 이 함수만 SECURITY DEFINER 로
--     RLS 를 우회해 딱 3개 안전한 컬럼만 조회한다.
--
-- 건드리지 않는 것: vod_get_student_lessons(STEP4, 실제 재생 권한 판정), vod_sync_course_fields,
--   vod_create_course_with_lessons / vod_replace_course_lessons(STEP3), lessons 의 기존 RLS 정책,
--   exam/classin/bbb/toss, watch_progress, 기존 courses/lessons 데이터.

CREATE OR REPLACE FUNCTION public.vod_get_course_curriculum(p_course_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lessons jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.courses WHERE id = p_course_id) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-found');
  END IF;

  -- 공개 가능한 3개 컬럼만 — vimeo_id/vimeo_hash 는 SELECT 목록에 없으므로 반환될 수 없다.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'order_index', order_index,
    'title', title,
    'duration_sec', duration_sec
  ) ORDER BY order_index), '[]'::jsonb)
  INTO v_lessons
  FROM public.lessons
  WHERE course_id = p_course_id;

  RETURN jsonb_build_object('ok', true, 'lessons', v_lessons);
END;
$$;

REVOKE ALL ON FUNCTION public.vod_get_course_curriculum(text) FROM PUBLIC;
-- 강좌 상세페이지는 로그인 전(anon)에도 열람 가능해야 하므로(구매 유도 목적) anon/authenticated 모두 허용.
-- 재생에 필요한 민감 정보를 전혀 반환하지 않으므로 anon 허용이 STEP4 의 권한 모델을 약화시키지 않는다.
GRANT EXECUTE ON FUNCTION public.vod_get_course_curriculum(text) TO anon, authenticated;
