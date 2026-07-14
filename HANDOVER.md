# 출석체크 & 학습관리 시스템 — 인수인계 문서

리치디바인 파트너즈 출석/학습관리 웹앱. 이 문서 하나로 넘겨받아 수정·배포까지 할 수 있게 정리했습니다.

---

## 1. 소스 코드 위치 (GitHub)

- 저장소: **https://github.com/syha21-droid/attendance-system-v2**
- 기본 브랜치: `main`
- **`main`에 push 하면 Vercel이 자동으로 배포**합니다. (별도 배포 명령 불필요)

넘겨받을 때:
```bash
git clone https://github.com/syha21-droid/attendance-system-v2.git
cd attendance-system-v2
npm install
```
> GitHub 저장소 권한(협업자 초대)은 현재 소유자 계정(syha21-droid)에서 추가해야 합니다.

---

## 2. 기술 스택

- **Next.js 16** (App Router) + React 19 + TypeScript
- Tailwind CSS, Zustand(상태), react-hot-toast(알림), lucide-react(아이콘)
- **Supabase** (PostgreSQL) — 서버 저장소
- QR: `qrcode.react`(생성), `html5-qrcode`(스캔)
- 배포: **Vercel** (GitHub `main` 자동 배포)

> ⚠️ 이 프로젝트의 Next.js 16은 기존 버전과 API가 다릅니다. 코드 수정 전 `node_modules/next/dist/docs/` 문서를 참고하세요. (`AGENTS.md` 참고)

---

## 3. 로컬 실행

```bash
npm run dev      # 개발 서버 (localhost:3000)
npm run build    # 프로덕션 빌드 (배포 전 검증용)
npm start        # 빌드 결과 실행
```

---

## 4. 환경변수 (.env.local) — 꼭 필요

프로젝트 루트에 `.env.local` 파일을 만들고 아래 값을 채웁니다. (Vercel에는 프로젝트 Settings → Environment Variables에 동일하게 등록)

```
NEXT_PUBLIC_SUPABASE_URL=https://npocfseejwbkiqefwvga.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase anon 키>
SUPABASE_SERVICE_ROLE_KEY=<Supabase service_role 키>   # 서버 전용, 절대 노출 금지
```

- Supabase 대시보드 → Project Settings → **API** 메뉴에서 URL / anon / service_role 키 확인
- `SUPABASE_SERVICE_ROLE_KEY`가 없으면 서버 저장 기능(출석기록, 세션, 통계)이 동작하지 않습니다.

---

## 5. 데이터베이스 (Supabase)

- 스키마 파일: **`supabase/schema.sql`**
- 처음 세팅하거나 컬럼이 없을 때: Supabase → **SQL Editor**에 `schema.sql` 내용을 붙여넣고 Run
- SQL 편집기: https://supabase.com/dashboard/project/npocfseejwbkiqefwvga/sql/new

주요 테이블:
| 테이블 | 용도 |
|--------|------|
| `attendance_sessions` | 출석 세션(교시/현장위치/반경) |
| `attendance_records` | 출석 기록 (입장/퇴장/거리/`meta`=사업단·유입경로 등) |
| `device_bindings` | 계정 1개 = 기기 1대 잠금 |
| `login_history` | 접속 이력 |
| `app_users` | 로그인 계정 |

---

## 6. 화면(경로) 지도

### 학생
- `/qr` — 출석 QR (사업단/성함/지점/유입경로 입력 → QR에 담김)
- `/student` — 학생 대시보드(A안 풀시스템: 강의/성적)
- `/login`, `/signup` — 로그인/가입

### 관리자 (스캔 출석 = 현재 주력)
- `/admin/scan` — **스캔**: 교시 선택 + 위치 설정 + 입장/퇴장 인식 + 외부참가자 추가
- `/admin/scan/all` — **전체 보기**: 모든 교시 목록·인원, 각 교시 통계로 이동
- `/admin/scan/stats` — **통계**: 유입경로/소개자/사업단별 집계 + 입퇴장 + 엑셀(CSV) 다운로드
- `/admin` — A안 관리자 대시보드
- `/admin/qr`, `/admin/qr/list` — 구버전 위치 QR 스캐너/명단

### 안내/선택
- `/select` — 팀장님용 A안/B안 비교·선택 페이지

### 핵심 API (`src/app/api/`)
- `qr/scan` — QR 스캔 → 위치검증 + 기기1대1명 + 입퇴장 기록
- `qr/scans` — 세션별 인식 명단
- `live/session` — 세션 생성/목록 (`?all=1`이면 지난 세션 포함)
- `device-bind`, `login-history`, `geocode` 등

---

## 7. 배포 흐름

1. 코드 수정 → `npm run build`로 에러 없는지 확인
2. `git add -A && git commit -m "..." && git push origin main`
3. Vercel이 자동 감지 → 1~2분 후 라이브 반영

- 라이브 URL: https://attendance-system-v2-blush.vercel.app (동일 코드가 attendance-app-complete.vercel.app 등에도 연결됨)

---

## 8. 자주 하는 수정 위치 빠른 참고

- 유입경로 항목 추가/변경: `src/app/qr/page.tsx`, `src/app/admin/scan/page.tsx`의 `['지인소개','직접알아봄',...]` 배열
- 교시 버튼: `src/app/admin/scan/page.tsx`의 `['1교시','2교시','3교시']`
- 통계 항목/엑셀 컬럼: `src/app/admin/scan/stats/page.tsx`
- QR 유효시간(만료): `src/app/api/qr/scan/route.ts`의 `FRESH_MS`
- QR 갱신 주기: `src/app/qr/page.tsx`의 `REFRESH_MS`
