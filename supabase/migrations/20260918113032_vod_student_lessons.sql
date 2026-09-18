-- STEP 4: 학생용 lessons 열람 — courses 보강(class_names) + 비교 기반 동기화 + RPC 2개
-- 목적: 관리자가 등록한 lessons 를 "수강 권한이 있는 학생"에게만 안전하게 전달한다.
-- 범위:
--   1) courses.class_names 컬럼 추가(신규) — site_store 의 classNames/className 을 안전하게 동기화
--   2) courses.is_free/price/visibility/class_names 를 site_store(custom+overrides) 와 비교해
--      "실제로 다른 값"만 갱신(무조건 전체 UPDATE 아님, 실행 전 재확인한 실데이터 기준 오늘은 0행 변경 예상)
--   3) vod_sync_course_fields(course_id, fields) — 관리자 "편집 → 저장" 시 courses 를 계속 최신으로
--      유지하기 위한 신규 RPC(기존 STEP3 RPC 는 전혀 수정하지 않음)
--   4) vod_get_student_lessons(course_id) — 학생용 lessons 조회 RPC. RJ_PUBLIC_PREVIEW 는
--      하드코딩하지 않고, staff/무료강좌/구독/구매(enrollment)/반 자동배정/freepass 만으로 판정
-- 건드리지 않는 것: lessons 의 RLS(정책 여전히 lessons_staff_read 1개만), 기존
--   vod_create_course_with_lessons / vod_replace_course_lessons, exam/classin/bbb/toss,
--   watch_progress, 기존 courses/lessons 데이터.

-- ── 1) courses.class_names 컬럼 추가 ─────────────────────────────────────────
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS class_names text;

-- ── 2) site_store(custom+overrides) 와 비교해 실제로 다른 값만 courses 에 반영 ──
--    override 가 있으면 override 값이 custom 값보다 우선(프론트의 실제 병합 규칙과 동일:
--    applyCoursesStore() 가 overrides 를 custom 위에 Object.assign 하는 것과 동일한 우선순위)
WITH custom_rows AS (
  SELECT elem->>'id' AS course_id, elem AS obj
  FROM public.site_store, jsonb_array_elements(COALESCE(data->'custom', '[]'::jsonb)) elem
  WHERE site_store.key = 'courses'
),
override_rows AS (
  SELECT kv.key AS course_id, kv.value AS obj
  FROM public.site_store, jsonb_each(COALESCE(data->'overrides', '{}'::jsonb)) kv
  WHERE site_store.key = 'courses'
),
merged AS (
  SELECT
    COALESCE(o.course_id, c.course_id) AS course_id,
    COALESCE(o.obj->>'isFree', c.obj->>'isFree') AS is_free_txt,
    COALESCE(o.obj->>'price', o.obj->>'salePrice', c.obj->>'price', c.obj->>'salePrice') AS price_txt,
    COALESCE(NULLIF(o.obj->>'visibility', ''), NULLIF(c.obj->>'visibility', '')) AS visibility_txt,
    COALESCE(
      NULLIF(o.obj->>'classNames', ''), NULLIF(o.obj->>'className', ''),
      NULLIF(c.obj->>'classNames', ''), NULLIF(c.obj->>'className', '')
    ) AS class_names_txt
  FROM custom_rows c
  FULL OUTER JOIN override_rows o ON o.course_id = c.course_id
)
UPDATE public.courses crs SET
  is_free     = COALESCE(NULLIF(m.is_free_txt, '')::boolean, crs.is_free),
  price       = COALESCE(NULLIF(m.price_txt, '')::int, crs.price),
  visibility  = COALESCE(m.visibility_txt, crs.visibility),
  class_names = m.class_names_txt
FROM merged m
WHERE crs.id = m.course_id
  AND (
    (NULLIF(m.is_free_txt, '') IS NOT NULL AND NULLIF(m.is_free_txt, '')::boolean IS DISTINCT FROM crs.is_free)
    OR (NULLIF(m.price_txt, '') IS NOT NULL AND NULLIF(m.price_txt, '')::int IS DISTINCT FROM crs.price)
    OR (m.visibility_txt IS NOT NULL AND m.visibility_txt IS DISTINCT FROM crs.visibility)
    OR (m.class_names_txt IS DISTINCT FROM crs.class_names)
  );

-- ── 3) 관리자 "편집 → 저장" 시 courses 의 접근권한 관련 필드를 계속 동기화하는 RPC ──
--    기존 STEP3 RPC(vod_create_course_with_lessons / vod_replace_course_lessons)는 전혀 수정하지 않고
--    완전히 새로운 함수만 추가한다. site_store 저장은 프론트에서 그대로 유지, 이 RPC는 courses 쪽
--    보조 동기화만 담당(part 4의 학생 접근권 판정이 courses 값을 기준으로 하므로 필요).
CREATE OR REPLACE FUNCTION public.vod_sync_course_fields(
  p_course_id text,
  p_fields     jsonb   -- {is_free?, price?, visibility?, class_names?} — 넘긴 키만 반영
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  UPDATE public.courses SET
    is_free     = CASE WHEN p_fields ? 'is_free'    THEN (p_fields->>'is_free')::boolean ELSE is_free END,
    price       = CASE WHEN p_fields ? 'price'      THEN COALESCE((p_fields->>'price')::int, 0) ELSE price END,
    visibility  = CASE WHEN p_fields ? 'visibility' THEN COALESCE(NULLIF(p_fields->>'visibility', ''), 'public') ELSE visibility END,
    class_names = CASE WHEN p_fields ? 'class_names' THEN NULLIF(p_fields->>'class_names', '') ELSE class_names END
  WHERE id = p_course_id;
END;
$$;

REVOKE ALL ON FUNCTION public.vod_sync_course_fields(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vod_sync_course_fields(text, jsonb) TO authenticated;
-- STEP3에서 확인된 이 프로젝트의 ALTER DEFAULT PRIVILEGES(신규 함수 생성 시 anon/authenticated/
-- service_role 에게 자동으로 EXECUTE 부여) 때문에 "REVOKE ALL ... FROM PUBLIC" 만으로는 anon 의
-- 개별 EXECUTE 가 제거되지 않는다. 관리자 전용 함수이므로 anon 을 명시적으로 회수한다.
REVOKE EXECUTE ON FUNCTION public.vod_sync_course_fields(text, jsonb) FROM anon;

-- ── 4) 학생용 lessons 조회 — RJ_PUBLIC_PREVIEW 하드코딩 없음. 서버가 독립적으로 재검증 ──
--    허용 순서: staff → 실제 무료강좌(courses.is_free) → freepass 이메일 → 활성 구독
--              → 활성 enrollment(구매) → 관리자 명부(admin_students) 기반 구독/배정/반자동매칭
--    anon 은 courses.is_free=true 인 강좌에 한해서만 통과(그 외에는 uid 가 없어 이후 검사가 전부 실패)
CREATE OR REPLACE FUNCTION public.vod_get_student_lessons(p_course_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_email   text;
  v_course  public.courses%ROWTYPE;
  v_allowed boolean := false;
  v_reason  text;
  v_student jsonb;
  v_lessons jsonb;
BEGIN
  SELECT * INTO v_course FROM public.courses WHERE id = p_course_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not-found');
  END IF;

  IF is_staff() THEN
    v_allowed := true; v_reason := 'staff';
  ELSIF v_course.is_free THEN
    v_allowed := true; v_reason := 'free';
  END IF;

  IF NOT v_allowed AND v_uid IS NOT NULL THEN
    SELECT email INTO v_email FROM public.profiles WHERE id = v_uid;

    -- 기존 access.jsx 의 RJ_FREEPASS_EMAILS 를 그대로 재현(고정 허용 이메일)
    IF NOT v_allowed AND v_email IS NOT NULL AND lower(v_email) = ANY (ARRAY['student@gmail.com']) THEN
      v_allowed := true; v_reason := 'subscriber';
    END IF;

    IF NOT v_allowed AND EXISTS (
      SELECT 1 FROM public.subscriptions
      WHERE user_id = v_uid AND status = 'active' AND (expires_at IS NULL OR expires_at > now())
    ) THEN
      v_allowed := true; v_reason := 'subscriber';
    END IF;

    IF NOT v_allowed AND EXISTS (
      SELECT 1 FROM public.enrollments
      WHERE user_id = v_uid AND course_id = p_course_id AND status = 'active'
        AND (expires_at IS NULL OR expires_at > now())
    ) THEN
      v_allowed := true; v_reason := 'purchased';
    END IF;

    IF NOT v_allowed AND v_email IS NOT NULL THEN
      SELECT data INTO v_student FROM public.admin_students WHERE lower(email) = lower(v_email) LIMIT 1;
      IF v_student IS NOT NULL AND COALESCE(v_student->>'status', '') <> 'stopped' THEN
        IF v_student->>'plan' = 'subscription' THEN
          v_allowed := true; v_reason := 'subscriber';
        ELSIF (v_student->'courses') @> to_jsonb(p_course_id) THEN
          v_allowed := true; v_reason := 'enrolled';
        ELSIF v_course.class_names IS NOT NULL AND v_student->>'label' IS NOT NULL AND EXISTS (
          SELECT 1 FROM unnest(regexp_split_to_array(v_course.class_names, '[,/·]')) AS cn
          WHERE regexp_replace(lower(trim(cn)), '\s+', '', 'g')
              = regexp_replace(lower(trim(v_student->>'label')), '\s+', '', 'g')
            AND regexp_replace(lower(trim(cn)), '\s+', '', 'g') <> ''
        ) THEN
          v_allowed := true; v_reason := 'enrolled';
        END IF;
      END IF;
    END IF;
  END IF;

  IF NOT v_allowed THEN
    RETURN jsonb_build_object('ok', false, 'reason', CASE WHEN v_uid IS NULL THEN 'need-login' ELSE 'locked' END);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'order_index', order_index, 'title', title,
    'vimeo_id', vimeo_id, 'vimeo_hash', vimeo_hash,
    'duration_sec', duration_sec, 'is_free', is_free
  ) ORDER BY order_index), '[]'::jsonb)
  INTO v_lessons
  FROM public.lessons WHERE course_id = p_course_id;

  RETURN jsonb_build_object('ok', true, 'reason', v_reason, 'lessons', v_lessons);
END;
$$;

REVOKE ALL ON FUNCTION public.vod_get_student_lessons(text) FROM PUBLIC;
-- 무료 강좌(courses.is_free=true)는 비로그인 방문자도 지금과 동일하게 시청 가능해야 하므로 anon 도 허용.
-- 함수 내부 판정이 실제 방어선이며, anon 은 is_free=true 인 강좌 외에는 전부 거부된다(아래 로컬 테스트로 검증).
GRANT EXECUTE ON FUNCTION public.vod_get_student_lessons(text) TO anon, authenticated;
