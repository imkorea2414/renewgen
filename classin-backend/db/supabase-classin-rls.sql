-- ════════════════════════════════════════════════════════════════════
--  클래스인 수신 데이터 — 강사·관리자 조회 정책 (RLS)
--  ──────────────────────────────────────────────────────────────────
--  적용법: Supabase → SQL Editor → 이 파일 전체 붙여넣기 → Run
--
--  ⚠️ 새 프로젝트로 옮길 때 반드시 함께 실행할 것.
--
--  왜 필요한가:
--    classin_* 표는 RLS 가 켜져 있는데 정책이 하나도 없어서, service_role
--    (Edge Function)만 읽고 쓸 수 있었다. 관리자 콘솔은 브라우저에서 로그인
--    키로 조회하므로 차단 대상이라, 데이터가 정상 수신되고 있어도 「데이터
--    구독」 탭이 항상 "수신 대기 / 아직 수신된 데이터가 없습니다"로 보였다.
--    (실제로 성적 591건이 쌓여 있는데도 0건으로 표시돼 연동 장애로 오진함)
--
--  범위: 강사·관리자에게 읽기(select)만 허용. 학생·비로그인은 계속 차단.
--        쓰기는 여전히 Edge Function(service_role)만 가능.
-- ════════════════════════════════════════════════════════════════════

-- is_staff() 헬퍼가 없는 프로젝트라면 먼저 만들어 둔다.
create or replace function public.is_staff()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('teacher','admin')
  );
$$;

drop policy if exists "classin_events_staff_read" on public.classin_events;
create policy "classin_events_staff_read" on public.classin_events
  for select using ( public.is_staff() );

drop policy if exists "classin_scores_staff_read" on public.classin_scores;
create policy "classin_scores_staff_read" on public.classin_scores
  for select using ( public.is_staff() );

drop policy if exists "classin_attendance_staff_read" on public.classin_attendance;
create policy "classin_attendance_staff_read" on public.classin_attendance
  for select using ( public.is_staff() );

drop policy if exists "classin_rewards_staff_read" on public.classin_rewards;
create policy "classin_rewards_staff_read" on public.classin_rewards
  for select using ( public.is_staff() );

drop policy if exists "classin_recordings_staff_read" on public.classin_recordings;
create policy "classin_recordings_staff_read" on public.classin_recordings
  for select using ( public.is_staff() );

drop policy if exists "classin_interactions_staff_read" on public.classin_interactions;
create policy "classin_interactions_staff_read" on public.classin_interactions
  for select using ( public.is_staff() );

drop policy if exists "classin_class_summary_staff_read" on public.classin_class_summary;
create policy "classin_class_summary_staff_read" on public.classin_class_summary
  for select using ( public.is_staff() );
