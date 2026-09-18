-- STEP 3: 강좌 차시(lessons) 관리 — 관리자 전용 RPC 2개 + lessons 조회 정책 1개
-- 목적: "courses(+site_store 반영) + lessons"를 하나의 Postgres 트랜잭션으로 안전하게 저장하고,
--       lessons 는 계속 직접 INSERT/UPDATE/DELETE 정책 없이(0개 유지) SECURITY DEFINER RPC로만 쓰도록 한다.
-- 범위: 신규 함수 2개, 신규 정책 1개(lessons SELECT, staff 전용). 기존 courses/lessons/site_store
--       데이터는 전혀 변경하지 않는다. exam/classin/bbb/toss/enrollments/watch_progress 전부 무관.

-- ── 1) lessons 조회 정책 — 관리자(is_staff())만 SELECT 허용, INSERT/UPDATE/DELETE 정책은 여전히 0개 ──
CREATE POLICY lessons_staff_read ON public.lessons
  FOR SELECT USING (is_staff());

-- ── 2) 신규 강좌 생성: courses + lessons + site_store(custom 배열) 를 하나의 트랜잭션으로 ──
--    - 이미 존재하는 course_id면 실패(신규 전용, 기존 강좌를 덮어쓰지 않음)
--    - site_store 의 다른 강좌/overrides 는 절대 건드리지 않고, 해당 id 항목만 안전하게 추가
CREATE OR REPLACE FUNCTION public.vod_create_course_with_lessons(
  p_course      jsonb,   -- courses 테이블에 넣을 값(반드시 id 포함)
  p_lessons     jsonb,   -- [{order_index, title, vimeo_id, vimeo_hash, duration_sec, is_free}, ...]
  p_site_course jsonb    -- site_store.custom 배열에 그대로 반영할 강좌 객체(프론트가 구성, 그대로 신뢰)
)
RETURNS TABLE (out_course_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_course_id text := p_course->>'id';
BEGIN
  IF NOT is_staff() THEN
    RAISE EXCEPTION '권한이 없습니다(관리자 전용)';
  END IF;

  IF v_course_id IS NULL OR v_course_id = '' THEN
    RAISE EXCEPTION '강좌 id가 필요합니다';
  END IF;

  IF EXISTS (SELECT 1 FROM public.courses WHERE id = v_course_id) THEN
    RAISE EXCEPTION '이미 존재하는 강좌 id 입니다: %', v_course_id;
  END IF;

  INSERT INTO public.courses
    (id, title, instructor, subject, level, price, is_free, thumbnail,
     youtube_id, vimeo_id, classin_course_id, classin_room_id,
     showcase_id, vimeo_hash, visibility)
  VALUES (
    v_course_id,
    p_course->>'title',
    NULLIF(p_course->>'instructor', ''),
    NULLIF(p_course->>'subject', ''),
    NULLIF(p_course->>'level', ''),
    COALESCE((p_course->>'price')::int, 0),
    COALESCE((p_course->>'is_free')::boolean, false),
    NULLIF(p_course->>'thumbnail', ''),
    NULLIF(p_course->>'youtube_id', ''),
    NULLIF(p_course->>'vimeo_id', ''),
    NULLIF(p_course->>'classin_course_id', ''),
    NULLIF(p_course->>'classin_room_id', ''),
    NULLIF(p_course->>'showcase_id', ''),
    NULLIF(p_course->>'vimeo_hash', ''),
    COALESCE(NULLIF(p_course->>'visibility', ''), 'public')
  );

  INSERT INTO public.lessons (course_id, order_index, title, vimeo_id, vimeo_hash, duration_sec, is_free)
  SELECT
    v_course_id,
    (elem->>'order_index')::int,
    elem->>'title',
    NULLIF(elem->>'vimeo_id', ''),
    NULLIF(elem->>'vimeo_hash', ''),
    NULLIF(elem->>'duration_sec', '')::int,
    COALESCE((elem->>'is_free')::boolean, false)
  FROM jsonb_array_elements(COALESCE(p_lessons, '[]'::jsonb)) elem;

  IF p_site_course IS NOT NULL THEN
    INSERT INTO public.site_store (key, data)
    VALUES ('courses', jsonb_build_object('custom', jsonb_build_array(p_site_course), 'overrides', '{}'::jsonb))
    ON CONFLICT (key) DO UPDATE SET
      data = jsonb_set(
        site_store.data,
        '{custom}',
        (
          SELECT COALESCE(jsonb_agg(e), '[]'::jsonb)
          FROM jsonb_array_elements(COALESCE(site_store.data->'custom', '[]'::jsonb)) e
          WHERE e->>'id' <> v_course_id
        ) || jsonb_build_array(p_site_course)
      ),
      updated_at = now();
  END IF;

  RETURN QUERY SELECT v_course_id;
END;
$$;

REVOKE ALL ON FUNCTION public.vod_create_course_with_lessons(jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vod_create_course_with_lessons(jsonb, jsonb, jsonb) TO authenticated;

-- ── 3) 기존 강좌 차시 교체: lessons만 갈아끼우는 것이 기본, courses 는 patch가 명시된 경우에만 부분 갱신 ──
--    - course_id가 courses에 없으면 실패
--    - site_store 는 건드리지 않음(차시 목록은 site_store 스키마에 없음)
CREATE OR REPLACE FUNCTION public.vod_replace_course_lessons(
  p_course_id    text,
  p_lessons      jsonb,
  p_course_patch jsonb DEFAULT NULL   -- 명시적으로 바꿀 courses 필드만 담은 부분 patch(선택)
)
RETURNS TABLE (out_course_id text, out_lessons_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count int;
BEGIN
  IF NOT is_staff() THEN
    RAISE EXCEPTION '권한이 없습니다(관리자 전용)';
  END IF;

  IF p_course_id IS NULL OR p_course_id = '' THEN
    RAISE EXCEPTION '강좌 id가 필요합니다';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.courses WHERE id = p_course_id) THEN
    RAISE EXCEPTION '강좌를 찾을 수 없습니다: %', p_course_id;
  END IF;

  IF p_course_patch IS NOT NULL AND p_course_patch <> '{}'::jsonb THEN
    UPDATE public.courses SET
      title       = COALESCE(p_course_patch->>'title', title),
      instructor  = COALESCE(p_course_patch->>'instructor', instructor),
      subject     = COALESCE(p_course_patch->>'subject', subject),
      level       = COALESCE(p_course_patch->>'level', level),
      price       = COALESCE((p_course_patch->>'price')::int, price),
      is_free     = COALESCE((p_course_patch->>'is_free')::boolean, is_free),
      thumbnail   = COALESCE(p_course_patch->>'thumbnail', thumbnail),
      showcase_id = COALESCE(p_course_patch->>'showcase_id', showcase_id),
      vimeo_id    = COALESCE(p_course_patch->>'vimeo_id', vimeo_id),
      vimeo_hash  = COALESCE(p_course_patch->>'vimeo_hash', vimeo_hash),
      visibility  = COALESCE(p_course_patch->>'visibility', visibility)
    WHERE id = p_course_id;
  END IF;

  DELETE FROM public.lessons WHERE course_id = p_course_id;

  INSERT INTO public.lessons (course_id, order_index, title, vimeo_id, vimeo_hash, duration_sec, is_free)
  SELECT
    p_course_id,
    (elem->>'order_index')::int,
    elem->>'title',
    NULLIF(elem->>'vimeo_id', ''),
    NULLIF(elem->>'vimeo_hash', ''),
    NULLIF(elem->>'duration_sec', '')::int,
    COALESCE((elem->>'is_free')::boolean, false)
  FROM jsonb_array_elements(COALESCE(p_lessons, '[]'::jsonb)) elem;

  SELECT count(*) INTO v_count FROM public.lessons WHERE course_id = p_course_id;
  RETURN QUERY SELECT p_course_id, v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.vod_replace_course_lessons(text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vod_replace_course_lessons(text, jsonb, jsonb) TO authenticated;
