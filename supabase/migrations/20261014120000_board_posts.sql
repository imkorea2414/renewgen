-- ═════════════════════════════════════════════════════════════════
--  공지사항 · 이벤트 게시판 — 1차 구현
--  관리자가 작성하는 공지/학사일정/월간평가/이벤트/자료실 게시글.
--  읽기는 공개(published) 게시글만 누구나(비회원 포함), 쓰기는 관리자(is_admin())만.
--  기존 profiles.role / is_admin() / is_staff() 정의는 그대로 재사용하며 변경하지 않는다.
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
  -- 최초로 공개(published) 전환된 시점. 이후 비공개→재공개를 반복해도 바뀌지 않는다
  -- (아래 board_posts_set_published_at 트리거가 "published_at이 비어있을 때만" 채운다).
  published_at  timestamptz
);

create index if not exists board_posts_listing_idx
  on public.board_posts (status, category, is_pinned desc, published_at desc);

-- ── 2. updated_at 자동 갱신 ──────────────────────────────────────
--   기존 touch_updated_at() 함수(report_rounds 등에서 이미 사용 중)를 그대로 재사용 —
--   새 트리거 함수를 만들지 않는다.
drop trigger if exists board_posts_touch on public.board_posts;
create trigger board_posts_touch before update on public.board_posts
  for each row execute function public.touch_updated_at();

-- ── 3. published_at: "최초 공개 시점" 고정 ──────────────────────
--   INSERT든 UPDATE든, status가 published이고 published_at이 아직 비어 있을 때만 채운다.
--   공개→비공개→재공개를 반복해도 published_at은 최초 1회 값 그대로 유지된다.
create or replace function public.board_posts_set_published_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists board_posts_published_at on public.board_posts;
create trigger board_posts_published_at
  before insert or update on public.board_posts
  for each row execute function public.board_posts_set_published_at();

-- ── 4. RLS ───────────────────────────────────────────────────────
alter table public.board_posts enable row level security;

-- (a) 공개(published) 게시글은 비회원 포함 누구나 조회 가능.
--     draft/hidden/deleted는 이 정책으로 노출되지 않는다(= 비관리자는 절대 조회 불가).
drop policy if exists "board_posts_public_read" on public.board_posts;
create policy "board_posts_public_read" on public.board_posts
  for select using ( status = 'published' );

-- (b) 관리자(is_admin())만 전체 조회·작성·수정·삭제(소프트) 가능.
--     기존 패턴(report_rounds 등)은 is_staff()를 쓰지만, 이번 게시판은 사용자가 명시한
--     "작성/수정/삭제는 관리자만" 요건에 맞춰 is_admin()으로 더 좁게 제한한다.
--     (교사에게도 작성 권한을 주고 싶다면 이 정책의 is_admin()을 is_staff()로 바꾸면 됨)
drop policy if exists "board_posts_admin_all" on public.board_posts;
create policy "board_posts_admin_all" on public.board_posts
  for all using ( public.is_admin() ) with check ( public.is_admin() );
