-- ============================================================
-- 특강 트랙 Step ①-b : courses 테이블에 description 컬럼 추가
-- (special-track.sql 실행 후에 추가로 실행)
-- 여러 번 실행해도 안전 (if not exists)
-- ============================================================

-- courses 테이블에 설명 컬럼 추가 (특강 소개글용)
alter table courses add column if not exists description text;

-- type 컬럼이 아직 없을 경우를 대비한 안전 추가 (special-track.sql과 중복이지만 안전)
alter table courses add column if not exists type text not null default 'regular';

-- ============================================================
-- 이 파일까지 실행하면 특강 트랙 전체 기능이 동작합니다.
-- 실행 순서:
--   1. supabase/schema.sql
--   2. supabase/special-track.sql
--   3. supabase/special-track-v2.sql  ← 이 파일
-- ============================================================
