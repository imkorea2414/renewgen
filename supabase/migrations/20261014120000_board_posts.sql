-- ═════════════════════════════════════════════════════════════════
--  공지사항 · 이벤트 게시판 — 1차 구현
--  관리자가 작성하는 공지/학사일정/월간평가/이벤트/자료실 게시글.
--  읽기는 공개(published) 게시글만 누구나(비회원 포함), 쓰기는 관리자(is_admin())만.
--  기존 profiles.role / is_admin() / is_staff() 정의는 그대로 재사용하며 변경하지 않는다.
--
--  이 파일은 여러 번 실행해도 안전하다(멱등적):
--    · 테이블/인덱스: IF NOT EXISTS
--    · 트리거: CREATE OR REPLACE TRIGGER (PostgreSQL 14+) — DROP 후 재생성하는 창(window) 없이
--      원자적으로 교체된다. 이 프로젝트는 PostgreSQL 17.6으로 확인됨.
--    · RLS 정책: 이미 존재하면 건드리지 않는다(아래 3번 참고) — 운영 중 수동으로 정책을
--      조정했다면 재실행 시 그 변경을 덮어쓰지 않는다.
-- ═════════════════════════════════════════════════════════════════

-- ── 1. 게시글 테이블 ─────────────────────────────────────────────
--   category/status는 한글이 아닌 영문 코드로 저장 — 최근 성적표 과목 정렬에서 겪은
--   Unicode NFC/NFD 정규화 문제(한글 리터럴 비교 실패)를 이 테이블에서는 애초에
--   재현할 수 없도록, DB에 저장되는 비교 키 자체를 ASCII로 못박는다.
--   한글 라벨은 화면(JS)에서만 매핑한다.
create table if not exists public.board_posts (
  id            uuid primary key default gen_random_uuid(),
  category      text not null
                  check (category in ('notice','academic','examnotice','event','resource')),
  title         text not null
                  check (char_length(btrim(title)) > 0 and char_length(title) <= 200),
  content       text not null default ''
                  check (char_length(content) <= 20000),
  -- 월간평가 전용 구조화 데이터. category='examnotice'일 때만 사용.
  --   예: {"examDate":"2026-11-27","items":[{"grade":"중1","subject":"수학","scope":"..."}]}
  exam_info     jsonb
                  check (
                    exam_info is null or (
                      jsonb_typeof(exam_info) = 'object'
                      and exam_info ? 'examDate'
                      and jsonb_typeof(exam_info -> 'items') = 'array'
                    )
                  ),
  -- 1차 범위에는 첨부파일 업로드 UI가 없지만, 2차에서 바로 꽂을 수 있도록 구조만 둔다.
  attachments   jsonb not null default '[]'::jsonb
                  check (jsonb_typeof(attachments) = 'array'),
  status        text not null default 'draft'
                  check (status in ('draft','published','hidden','deleted')),
  is_pinned     boolean not null default false,
  author_id     uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- 최초로 공개(published) 전환된 시점. 이후 비공개→재공개를 반복하거나 다른 컬럼을
  -- 수정해도 바뀌지 않는다 — 아래 2번 트리거가 OLD.published_at이 이미 채워져 있으면
  -- 어떤 UPDATE가 들어오든 그 값을 그대로 고정해서 돌려준다(보호).
  published_at  timestamptz
);

create index if not exists board_posts_listing_idx
  on public.board_posts (status, category, is_pinned desc, published_at desc);

-- ── 2. 권한(GRANT) ───────────────────────────────────────────────
--   이 프로젝트의 다른 테이블들은 스키마 기본 권한(ALTER DEFAULT PRIVILEGES)에 기대어
--   별도 GRANT 없이도 동작하지만, 이 테이블은 그 기본값에 의존하지 않고 명시한다.
--   실제 쓰기 가능 여부는 GRANT가 아니라 아래 4번 RLS(is_admin())가 결정한다 —
--   즉 authenticated에게 INSERT/UPDATE/DELETE 권한을 주더라도, 관리자가 아니면
--   RLS가 모든 행을 걸러내 실질적으로는 아무 것도 쓸 수 없다.
grant select on public.board_posts to anon;
grant select, insert, update, delete on public.board_posts to authenticated;

-- ── 3. updated_at 자동 갱신 ──────────────────────────────────────
--   기존 touch_updated_at() 함수(report_rounds 등에서 이미 사용 중)를 그대로 재사용 —
--   새 트리거 함수를 만들지 않는다.
create or replace trigger board_posts_touch
  before update on public.board_posts
  for each row execute function public.touch_updated_at();

-- ── 4. published_at: "최초 공개 시점" 고정 + 이후 변경 차단 ──────
--   · INSERT: status가 published으로 바로 생성되면 그 시점을 최초 공개일로 채운다.
--   · UPDATE: OLD.published_at이 이미 채워져 있으면(= 한 번이라도 공개된 적 있음)
--     이번 UPDATE가 무엇을 하든(비공개 전환, 재공개, 다른 컬럼 수정, 심지어 누군가
--     published_at을 직접 다른 값으로 바꾸려는 시도까지) 전부 무시하고 기존 값으로
--     고정한다 — "최초 공개일 보호".
--   · UPDATE: OLD.published_at이 아직 비어 있던 글이 이번에 처음 공개로 바뀌면
--     그때 한 번만 채운다(기존 동작 그대로 유지).
create or replace function public.board_posts_set_published_at()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    if new.status = 'published' and new.published_at is null then
      new.published_at := now();
    end if;
    return new;
  end if;

  -- UPDATE — 이미 한 번 채워진 최초 공개일은 이후 어떤 요청으로도 바뀌지 않는다.
  if old.published_at is not null then
    new.published_at := old.published_at;
    return new;
  end if;

  -- 아직 한 번도 공개된 적 없는 글이 이번 UPDATE로 처음 공개 전환되는 경우만 채운다.
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

create or replace trigger board_posts_published_at
  before insert or update on public.board_posts
  for each row execute function public.board_posts_set_published_at();

-- ── 5. RLS ───────────────────────────────────────────────────────
alter table public.board_posts enable row level security;

-- 정책은 "이미 있으면 건드리지 않는다" — DROP 후 재생성하지 않는다. 운영 중 누군가
-- 대시보드에서 정책 내용을 수동으로 조정했다면, 이 파일을 다시 실행해도 그 변경이
-- 조용히 덮어써지지 않고 그대로 유지된다. 최초 생성 시에만 아래 정의로 만들어진다.

-- (a) 공개(published) 게시글은 비회원 포함 누구나 조회 가능.
--     draft/hidden/deleted는 이 정책으로 노출되지 않는다(= 비관리자는 절대 조회 불가).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'board_posts' and policyname = 'board_posts_public_read'
  ) then
    create policy "board_posts_public_read" on public.board_posts
      for select using ( status = 'published' );
  end if;
end $$;

-- (b) 관리자(is_admin())만 전체 조회·작성·수정·삭제(소프트) 가능.
--     기존 패턴(report_rounds 등)은 is_staff()를 쓰지만, 이번 게시판은 사용자가 명시한
--     "작성/수정/삭제는 관리자만" 요건에 맞춰 is_admin()으로 더 좁게 제한한다.
--     (교사에게도 작성 권한을 주고 싶다면 이 정책의 is_admin()을 is_staff()로 바꾸면 됨)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'board_posts' and policyname = 'board_posts_admin_all'
  ) then
    create policy "board_posts_admin_all" on public.board_posts
      for all using ( public.is_admin() ) with check ( public.is_admin() );
  end if;
end $$;
