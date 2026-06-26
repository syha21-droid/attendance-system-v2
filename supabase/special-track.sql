-- ============================================================
-- 특강 트랙 Step ① : 기존 구조 확장 (마이그레이션)
-- 기존 테이블(app_users, courses, attendance_sessions...)을 깨지 않고 확장.
-- Supabase SQL Editor 에서 실행. 모두 if not exists 라 여러 번 실행해도 안전.
-- 보안: 이 앱은 Supabase Auth 미사용(자체 app_users + 서버 API) → RLS는 켜되
--       정책 미추가(서버 service_role 만 접근). 규칙 검증은 API 라우트에서 함.
-- ============================================================

-- 1) 회원 유형: 정식(official) / 게스트(guest) / 외부일반(external)
alter table app_users add column if not exists member_type text not null default 'official'
  check (member_type in ('official','guest','external'));
-- 사원번호(내부 인증용). 외부 회원은 null.
alter table app_users add column if not exists employee_no text;

-- 2) 사원번호 화이트리스트 (내부 가입 검증용 — 위촉번호 대신 사원번호)
create table if not exists staff_roster (
  id uuid primary key default gen_random_uuid(),
  employee_no text not null unique,    -- 이 명단에 있어야 내부 가입 가능
  name text not null,                  -- 대조용 이름
  used boolean not null default false, -- 1사원번호 1계정 (가입에 쓰였는지)
  created_at timestamptz default now()
);

-- 3) 강의 유형: 정식수업(regular) / 특강(special)
alter table courses add column if not exists type text not null default 'regular'
  check (type in ('regular','special'));

-- 4) 수강권 (특강 입장권) — 슈퍼루키 3회/베스트루키 1회 등, 운영자 수기 부여
create table if not exists entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  kind text not null,               -- 예: 'saturday_special'
  total int not null default 0,     -- 부여 횟수
  used int not null default 0,      -- 사용 횟수 (remaining = total - used)
  created_at timestamptz default now(),
  constraint entitlements_used_le_total check (used <= total),
  unique (user_id, kind)
);

-- 5) 특강 신청 (내부: 수강권 차감 / 외부: 결제·승인)
create table if not exists special_registrations (
  id uuid primary key default gen_random_uuid(),
  course_id text not null,                  -- 특강(courses.id, type='special')
  user_id text not null,
  member_type text not null,                -- 'official' | 'external'
  paid boolean not null default false,      -- 외부 결제완료 (PG는 외부, 우린 플래그만)
  status text not null default 'pending',   -- 'pending' | 'approved'
  attended boolean not null default false,
  entitlement_id uuid references entitlements(id),  -- 내부: 차감한 수강권
  created_at timestamptz default now(),
  unique (course_id, user_id)               -- 한 특강에 1인 1신청
);

-- 6) 수강권 원자적 차감 함수 (동시 출석에도 음수 방지)
create or replace function use_entitlement(p_user_id text, p_kind text)
returns boolean language plpgsql as $$
declare n int;
begin
  update entitlements set used = used + 1
   where user_id = p_user_id and kind = p_kind and used < total;
  get diagnostics n = row_count;
  return n > 0;   -- true면 차감 성공
end; $$;

-- 7) RLS 켜기 (서버 service_role 로만 접근, 클라 직접 차단)
alter table staff_roster enable row level security;
alter table entitlements enable row level security;
alter table special_registrations enable row level security;
