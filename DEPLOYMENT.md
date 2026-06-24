# 🚀 Vercel 배포 가이드

## 빠른 배포 방법

### 방법 1: Vercel 웹 대시보드에서 배포 (권장)

1. **Vercel 가입 및 로그인**
   - https://vercel.com/sign-up
   - GitHub 계정으로 가입 가능

2. **새 프로젝트 생성**
   - Vercel 대시보드에서 "Add New..." → "Project" 클릭
   - GitHub 저장소 선택 (또는 GitHub에 이 저장소를 먼저 푸시)

3. **자동 배포 설정**
   - Framework: **Next.js** 선택
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm ci`

4. **배포**
   - "Deploy" 버튼 클릭
   - 자동으로 빌드 및 배포 진행
   - 완료되면 고유 URL 발급 (예: https://attendance-system-v2.vercel.app)

### 방법 2: Vercel CLI 사용

```bash
# Vercel CLI 설치
npm install -g vercel

# 로그인
vercel login

# 배포
vercel --prod

# 또는 간단하게
vercel
```

## 배포 후 확인

1. 발급된 URL 접속
2. 모든 기능 테스트:
   - 회원가입
   - 로그인
   - 강의 등록
   - 출석 확인
   - 관리자 기능

## 환경 변수 설정

현재 프로젝트는 추가 환경변수가 필요하지 않습니다.
향후 Supabase 연동 시:

```
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
SUPABASE_SERVICE_ROLE_KEY=your_key
```

## 배포 완료!

이제 누구나 공개 URL로 접속하여 시스템을 사용할 수 있습니다.

---

**배포 예상 시간**: 약 5분
**비용**: 무료 (Vercel Hobby 플랜)
