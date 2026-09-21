-- 목적: 일반회원이 본인 public.profiles row의 role/id 컬럼을 직접 변경(자가 권한 승격)하지
-- 못하도록 차단한다. profiles_update_own RLS(auth.uid() = id)는 role/id 값과 무관하게
-- 통과되므로, 이 두 컬럼만은 BEFORE UPDATE trigger로 별도 방어한다.
--
-- admin(is_admin() = true)이 다른 회원의 role을 변경하는 기존 관리자 기능(setProfileRoleByEmail/
-- setProfileRoleById, pages-admin.jsx)은 영향받지 않는다.
--
-- 일반회원이 role/id를 실제로 변경하려는 시도가 있으면 UPDATE 전체를 명확히 실패(예외)시키며,
-- 조용히 기존 값으로 되돌려 성공한 것처럼 보이게 하지 않는다.
--
-- 이 migration은 여러 번 실행해도 안전하다 (CREATE OR REPLACE FUNCTION, DROP TRIGGER IF EXISTS).

create or replace function public.protect_profiles_privileged_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.role is distinct from old.role then
      raise exception 'role 컬럼은 관리자만 변경할 수 있습니다';
    end if;
    if new.id is distinct from old.id then
      raise exception 'id 컬럼은 변경할 수 없습니다';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_privileged_columns on public.profiles;

create trigger profiles_protect_privileged_columns
before update on public.profiles
for each row
execute function public.protect_profiles_privileged_columns();
