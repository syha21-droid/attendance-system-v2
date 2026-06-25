-- ============================================================
-- 서버 검증 출석 시스템 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 RUN 하세요.
-- ============================================================

-- 출석 회차(라이브 세션)
create table if not exists attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  course_id text not null,
  name text not null,
  secret text not null,                 -- 회전코드 비밀키 (서버만 사용, 절대 노출 금지)
  venue_lat double precision,           -- 현장 위도
  venue_lng double precision,           -- 현장 경도
  radius_m integer not null default 150,-- 허용 반경(m)
  require_gps boolean not null default true,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz default now()
);

-- 출석 기록
create table if not exists attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references attendance_sessions(id) on delete cascade,
  user_id text not null,
  user_name text,
  device_id text,
  lat double precision,
  lng double precision,
  distance_m integer,
  created_at timestamptz default now(),
  unique (session_id, user_id)          -- 이번 회차 1계정 1회
);

-- 같은 기기(디바이스)로 같은 회차 중복 출석 차단
create unique index if not exists uniq_session_device
  on attendance_records (session_id, device_id)
  where device_id is not null;

-- RLS 켜기 (서버 service_role 로만 접근; 클라이언트 직접 접근 차단)
alter table attendance_sessions enable row level security;
alter table attendance_records enable row level security;
-- 정책을 추가하지 않으면 anon/authenticated 는 접근 불가 → 서버(API)만 통함.
