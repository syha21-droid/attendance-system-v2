-- ============================================================
-- 위치 기반 자동 출석 시스템 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 RUN 하세요.
-- (이미 이전 버전을 만들었다면 아래 DROP 두 줄의 주석을 풀고 함께 실행)
-- ============================================================

-- drop table if exists attendance_records;
-- drop table if exists attendance_sessions;

-- 출석 회차(라이브 세션) — 위치만으로 동작
create table if not exists attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id text not null,
  name text not null,
  venue_lat double precision not null,   -- 현장 위도 (관리자가 설정)
  venue_lng double precision not null,   -- 현장 경도
  radius_m integer not null default 150, -- 허용 반경(m)
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,          -- 수업 종료 시각
  created_at timestamptz default now()
);

-- 출석 기록 — 입장/마지막확인/퇴장 자동 추적
create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references attendance_sessions(id) on delete cascade,
  user_id text not null,
  user_name text,
  device_id text,
  entry_at timestamptz not null default now(),    -- 현장 도착(첫 인식) 시각
  last_seen_at timestamptz not null default now(),-- 마지막으로 현장에서 확인된 시각
  exit_at timestamptz,                            -- 현장 벗어난(퇴장) 시각
  entry_distance_m integer,
  entry_lat double precision,                     -- 학생이 출석을 찍은 실제 위도
  entry_lng double precision,                     -- 학생이 출석을 찍은 실제 경도
  exit_lat double precision,                      -- 학생이 퇴장을 찍은 실제 위도
  exit_lng double precision,                      -- 학생이 퇴장을 찍은 실제 경도
  status text not null default 'present',         -- present(현장) | completed(출석인정) | left_early(미인정)
  unique (session_id, user_id)                    -- 1계정 1기록 (재입장 시 갱신)
);

-- 이미 테이블을 만든 운영 DB라면(좌표 컬럼이 없을 때) 아래 네 줄을 실행해 마이그레이션
alter table attendance_records add column if not exists entry_lat double precision;
alter table attendance_records add column if not exists entry_lng double precision;
alter table attendance_records add column if not exists exit_lat double precision;
alter table attendance_records add column if not exists exit_lng double precision;

alter table attendance_sessions enable row level security;
alter table attendance_records enable row level security;
-- 정책 미추가 → 서버(service_role)만 접근. 클라이언트 직접 접근 차단.

-- ============================================================
-- 기기 간 공유: 계정 / 강의 / 수강신청 (localStorage → 서버 이전)
-- ============================================================

-- 계정 (회원). 비밀번호는 데모용 평문 — 운영 시 해시 권장
create table if not exists app_users (
  id text primary key,
  email text unique not null,
  password text not null,
  name text not null,
  is_admin boolean not null default false,
  created_at timestamptz default now()
);

-- 강의 (관리자 생성 → 모든 학생이 같은 id로 봄)
create table if not exists courses (
  id text primary key,
  name text not null,
  instructor text not null,
  course_type text default 'session',  -- session | episode
  episode_count integer,
  created_at timestamptz default now()
);

-- 수강 신청 (학생 ↔ 강의)
create table if not exists enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  course_id text not null,
  created_at timestamptz default now(),
  unique (user_id, course_id)
);

alter table app_users enable row level security;
alter table courses enable row level security;
alter table enrollments enable row level security;

-- 기본 강의 3개 (클라이언트 기본값과 동일한 id) — 처음 1회만
insert into courses (id, name, instructor, course_type) values
  ('1', 'Python 기초', '김교수', 'session'),
  ('2', '웹개발', '이교수', 'session'),
  ('3', '데이터분석', '박교수', 'session')
on conflict (id) do nothing;
