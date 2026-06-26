-- ============================================================
-- 과제 제출 기능 마이그레이션
-- Supabase SQL Editor 에서 실행하세요.
-- ============================================================

-- 1) 과제 제출 테이블
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  course_id text not null,
  user_id text not null,
  user_name text,
  file_name text not null,
  file_path text not null,   -- Supabase Storage 경로
  file_size bigint,
  submitted_at timestamptz default now(),
  grade text,                -- 관리자 채점 (예: 'A', '95점', '통과')
  comment text               -- 관리자 피드백
);

alter table submissions enable row level security;
-- 클라이언트 직접 접근 차단 (서버 service_role 만 허용)

-- 2) Storage 버킷 생성 (없으면)
insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do nothing;

-- Storage 정책: service_role만 접근 (클라이언트 직접 업로드/다운로드 차단)
-- service_role은 RLS를 bypass하므로 별도 정책 불필요.
