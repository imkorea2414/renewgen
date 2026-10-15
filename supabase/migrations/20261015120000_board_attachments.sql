-- ═════════════════════════════════════════════════════════════════
--  공지사항 게시판 2차 — 첨부파일(이미지/PDF) + 본문 서식(HTML) 지원
--
--  이 파일이 하는 일:
--    1) board_posts.content_format 컬럼 추가 — 과거 글은 전부 'text'(평문)로
--       자동 채워지고 content 값 자체는 전혀 건드리지 않는다. 새 에디터로
--       저장되는 글만 'html'로 표시되어, 렌더러가 이 값을 보고 안전하게
--       분기한다(평문은 지금처럼 텍스트 그대로, HTML은 sanitize 후 렌더).
--    2) board_posts.content 길이 제한을 20,000 → 50,000자로 상향
--       (서식 태그가 섞이면 같은 분량도 글자 수가 늘어나므로).
--    3) board_attachments 테이블 신설 — 게시글당 여러 첨부파일/본문 삽입
--       이미지를 행 단위로 관리(JSONB 배열 통짜 교체 방식의 동시수정 충돌,
--       고아 행 추적 불가 문제를 피하기 위함). 기존 board_posts.attachments
--       컬럼은 그대로 두되(지금도 항상 빈 배열이라 영향 없음) 더는 쓰지 않는다.
--    4) Storage 버킷 board-attachments(PRIVATE) + storage.objects RLS 2개.
--
--  이 파일은 여러 번 실행해도 안전하다(멱등적) — board_posts 마이그레이션과
--  동일한 관례(ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS,
--  CREATE OR REPLACE TRIGGER, 존재 여부를 먼저 확인하는 DO 블록의 RLS 정책,
--  ON CONFLICT DO NOTHING의 버킷 생성)를 그대로 따른다.
--
--  주의: 이 파일은 사용자가 Supabase SQL Editor에서 직접 실행하기 전까지는
--  운영 DB에 적용되지 않는다. Claude는 이 세션에서 이 파일을 실행하지 않았다.
-- ═════════════════════════════════════════════════════════════════

-- ── 1. board_posts: content_format + content 길이 상향 ──────────────
alter table public.board_posts
  add column if not exists content_format text not null default 'text'
    check (content_format in ('text', 'html'));
comment on column public.board_posts.content_format is
  '''text''=평문(과거 글 전부, white-space:pre-wrap으로만 렌더) / ''html''=에디터로 작성된 서식 있는 본문(반드시 sanitize 후 렌더)';

-- 긴급 공지(is_urgent)는 상단 고정(is_pinned)과 별개 플래그다 — 고정은 "목록 상단에 계속
-- 둔다"는 정렬 목적, 긴급은 "지금 당장 주의가 필요하다"는 시각적 강조 목적으로 의미가 다르다.
alter table public.board_posts
  add column if not exists is_urgent boolean not null default false;

alter table public.board_posts drop constraint if exists board_posts_content_check;
alter table public.board_posts add constraint board_posts_content_check
  check (char_length(content) <= 50000);

-- ── 2. board_attachments: 게시글 첨부파일 · 본문 삽입 이미지 ──────────
--   kind='attachment'   → 상세 페이지 하단 "첨부파일" 목록에 노출
--   kind='inline_image' → 에디터 본문 안에 삽입된 이미지(목록에는 노출 안 함)
--   kind='hero_image'   → 이벤트 카테고리 등의 상단 대표 이미지(게시글당 app
--                          레벨에서 1개만 유지 — DB 제약으로 강제하지 않고
--                          교체 시 기존 hero_image 행을 먼저 지우고 새로 올린다).
--   url을 저장하지 않고 storage_path만 저장한다 — 실제 다운로드/열람 시점에
--   그때그때 짧은 유효기간의 서명 URL을 새로 발급한다(게시글이 비공개로
--   바뀐 뒤에는 새 서명 URL 발급 자체가 RLS로 막힌다).
create table if not exists public.board_attachments (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references public.board_posts(id) on delete cascade,
  kind          text not null default 'attachment'
                  check (kind in ('attachment', 'inline_image', 'hero_image')),
  storage_path  text not null unique,
  file_name     text not null
                  check (char_length(file_name) > 0 and char_length(file_name) <= 255),
  mime_type     text not null
                  check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes    bigint not null check (size_bytes > 0 and size_bytes <= 15728640), -- 15MB/파일
  ordinal       int not null default 0,
  uploaded_by   uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists board_attachments_post_idx
  on public.board_attachments (post_id, kind, ordinal);

create or replace trigger board_attachments_touch
  before update on public.board_attachments
  for each row execute function public.touch_updated_at();

-- ── 3. board_attachments 권한(GRANT) ─────────────────────────────────
--   실제 쓰기 가능 여부는 아래 4번 RLS(is_admin())가 결정 — board_posts와
--   동일한 관례(REVOKE 후 GRANT로 명시, 스키마 기본 권한에 의존하지 않음).
revoke all privileges on table public.board_attachments from anon;
grant select on public.board_attachments to anon;

revoke all privileges on table public.board_attachments from authenticated;
grant select, insert, update, delete on public.board_attachments to authenticated;

-- ── 4. board_attachments RLS ─────────────────────────────────────────
alter table public.board_attachments enable row level security;

-- (a) 공개(published) 게시글에 달린 첨부파일은 비회원 포함 누구나 조회 가능.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'board_attachments' and policyname = 'board_attachments_public_read'
  ) then
    create policy "board_attachments_public_read" on public.board_attachments
      for select using (
        exists (
          select 1 from public.board_posts p
          where p.id = board_attachments.post_id and p.status = 'published'
        )
      );
  end if;
end $$;

-- (b) 관리자(is_admin())만 전체 조회·업로드(행 생성)·수정·삭제 가능.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'board_attachments' and policyname = 'board_attachments_admin_all'
  ) then
    create policy "board_attachments_admin_all" on public.board_attachments
      for all using ( public.is_admin() ) with check ( public.is_admin() );
  end if;
end $$;

-- ── 5. Storage 버킷 + storage.objects RLS ────────────────────────────
--   PRIVATE 버킷 — public=false. file_size_limit/allowed_mime_types로
--   Storage API 레벨에서도 한 번 더 걸러낸다(클라이언트 검증을 신뢰하지 않음).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'board-attachments', 'board-attachments', false, 15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- (a) 공개 게시글에 연결된 파일만 비회원 포함 누구나 조회(다운로드) 가능.
--     경로를 안다고 해도 board_attachments에 연결된 게시글이 published가
--     아니면 이 정책이 걸러낸다 — "경로 추측으로 접근 불가" 요건의 실제 구현.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'board_attachments_public_read'
  ) then
    create policy "board_attachments_public_read" on storage.objects
      for select using (
        bucket_id = 'board-attachments'
        and exists (
          select 1 from public.board_attachments a
          join public.board_posts p on p.id = a.post_id
          where a.storage_path = storage.objects.name and p.status = 'published'
        )
      );
  end if;
end $$;

-- (b) 관리자만 업로드·수정·삭제·전체 조회 가능.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'board_attachments_admin_all'
  ) then
    create policy "board_attachments_admin_all" on storage.objects
      for all using ( bucket_id = 'board-attachments' and public.is_admin() )
      with check ( bucket_id = 'board-attachments' and public.is_admin() );
  end if;
end $$;
