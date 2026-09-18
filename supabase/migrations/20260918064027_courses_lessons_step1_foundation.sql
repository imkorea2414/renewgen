-- STEP 1: courses 테이블 확장 + lessons(차시) 테이블 신설
-- 목적: site_store(key='courses') 기반 5개 운영 강좌를 관계형 courses 테이블로 편입하고,
--       강좌-차시(lessons) 데이터 모델의 기반을 마련한다.
-- 범위: courses 컬럼 추가 + 5개 강좌 INSERT(기존 3행 무변경) + lessons 신설(RLS 활성/정책 0개).
--       frontend, Edge Function, exam 관련, toss-confirm, site_store 데이터는 이 마이그레이션에서 전혀 건드리지 않는다.

-- 1) courses 테이블에 3개 컬럼 추가 (기존 3행에는 영향 없음)
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS showcase_id text,
  ADD COLUMN IF NOT EXISTS vimeo_hash  text,
  ADD COLUMN IF NOT EXISTS visibility  text NOT NULL DEFAULT 'public';

-- 2) site_store 의 5개 운영 강좌를 courses 로 복제 (기존 ID 그대로 사용, 충돌 시 무시하여 멱등 보장)
INSERT INTO public.courses
  (id, title, instructor, subject, price, is_free, vimeo_id, showcase_id, vimeo_hash, visibility)
VALUES
  ('vod-mr41b2rq', '검고 중졸',      'ins-mr41b2rq', 'math',    0, false, NULL, '12312263', NULL, 'members'),
  ('vod-mr42mr7z', '검고 고졸',      'ins-mqpty8hi', 'science', 0, false, NULL, NULL,       NULL, 'members'),
  ('vod-mr42oikj', '검고 중졸 사회', 'ins-mr41b2rq', 'math',    0, false, NULL, NULL,       NULL, 'members'),
  ('vod-mr42st7m', '검고 중졸 과학', 'ins-mr42st7m', 'science', 0, false, NULL, '12312272', NULL, 'members'),
  ('vod-mr434bty', '검고 고졸 과학', 'ins-mr42st7m', 'science', 0, false, NULL, '12312298', NULL, 'members')
ON CONFLICT (id) DO NOTHING;

-- 3) lessons(차시) 테이블 신설 — courses 에 종속되는 구성 데이터(compositional child)
CREATE TABLE public.lessons (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    text NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  order_index  integer NOT NULL,
  title        text NOT NULL,
  vimeo_id     text,
  vimeo_hash   text,
  duration_sec integer,
  is_free      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, order_index)
);

CREATE TRIGGER lessons_touch
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) RLS 활성화 — 정책 0개로 시작하여 anon/authenticated 접근을 전면 차단(안전하게 잠긴 상태로 시작)
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
