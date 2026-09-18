-- 보안 조치: public.backup_profiles_uid_20260910 테이블은 어떤 프론트엔드/Edge Function/
-- 함수/트리거에서도 참조되지 않는 임시 백업 테이블이었으나 RLS가 비활성화되어 있어
-- anon key만으로 전체 행을 읽고/쓰고/지울 수 있는 상태였다.
--
-- 이 마이그레이션은 RLS만 켠다(정책은 추가하지 않음) — 정책이 없는 상태에서 RLS를
-- 켜면 anon/authenticated 역할은 기본적으로 모든 접근이 거부되고, RLS를 우회하는
-- service_role(서버 측)만 계속 접근할 수 있다. 테이블 삭제, 데이터 변경, 스키마
-- 변경은 없다.
--
-- Supabase 프로젝트에는 apply_migration으로 이미 동일 SQL이 적용되어 있으며(버전
-- 20260918021632), 이 파일은 그 변경 이력을 GitHub 저장소에도 기록하기 위한 것이다.
-- 이 저장소에는 기존 마이그레이션 이력 관리가 없었으므로, 과거 SQL 파일들을 임의로
-- 재구성하지 않고 이번 변경부터 supabase/migrations/ 로 추적을 시작한다.

ALTER TABLE "public"."backup_profiles_uid_20260910" ENABLE ROW LEVEL SECURITY;
