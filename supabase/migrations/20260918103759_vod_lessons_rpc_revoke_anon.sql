-- STEP 3 후속: vod_* RPC 2개에서 anon 의 EXECUTE 권한을 명시적으로 회수
-- 배경: 이 프로젝트의 public 스키마에는 ALTER DEFAULT PRIVILEGES로 신규 함수 생성 시
--       anon/authenticated/service_role 모두에게 자동으로 EXECUTE 가 부여되도록 설정되어
--       있다(프로젝트 전역 설정, 이번에 변경하지 않음). 그래서 20260918101009 마이그레이션의
--       "REVOKE ALL ... FROM PUBLIC" 만으로는 anon 에게 이미 개별적으로 부여된 EXECUTE 를
--       제거하지 못했다. 함수 내부 is_staff() 가드로 실제 쓰기는 막혀 있었지만(2차 방어선),
--       요구사항대로 anon 자체의 호출 권한(1차 방어선)도 명시적으로 없앤다.
-- 범위: 이번 STEP3에서 만든 vod_create_course_with_lessons / vod_replace_course_lessons
--       두 함수의 anon 권한만 회수한다. 프로젝트 전역 ALTER DEFAULT PRIVILEGES 는
--       다른 기존 함수 전반에 영향을 줄 수 있어 이번 작업에서 변경하지 않는다.

REVOKE EXECUTE ON FUNCTION public.vod_create_course_with_lessons(jsonb, jsonb, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.vod_replace_course_lessons(text, jsonb, jsonb) FROM anon;
