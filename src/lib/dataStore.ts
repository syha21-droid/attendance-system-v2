// 기기 간 공유 데이터 접근 헬퍼.
// 서버(Supabase)가 진실의 원천, localStorage는 캐시/오프라인 폴백.
// 서버가 없거나(no-db) 오류면 localStorage로 자연스럽게 폴백 → 앱이 항상 동작.

import { Course } from '@/types'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export const DEFAULT_COURSES: Course[] = [
  { id: '1', name: 'Python 기초', instructor: '김교수', createdAt: new Date().toISOString() },
  { id: '2', name: '웹개발', instructor: '이교수', createdAt: new Date().toISOString() },
  { id: '3', name: '데이터분석', instructor: '박교수', createdAt: new Date().toISOString() },
]

function localCourses(): Course[] {
  const raw = localStorage.getItem('courses')
  if (raw) {
    try {
      return JSON.parse(raw)
    } catch {
      /* ignore */
    }
  }
  localStorage.setItem('courses', JSON.stringify(DEFAULT_COURSES))
  return DEFAULT_COURSES
}

/** 강의 목록 (서버 우선, 실패 시 localStorage). 서버 성공 시 localStorage에 캐시. */
export async function loadCourses(): Promise<Course[]> {
  try {
    const res = await fetch('/api/courses', { cache: 'no-store' })
    const data = await res.json()
    if (Array.isArray(data.courses)) {
      localStorage.setItem('courses', JSON.stringify(data.courses)) // write-through 캐시
      return data.courses
    }
  } catch {
    /* 네트워크 오류 → 폴백 */
  }
  return localCourses()
}

/** 강의 추가 (서버 + 캐시). 서버 실패해도 로컬엔 반영. */
export async function createCourse(course: Course): Promise<void> {
  try {
    await fetch('/api/courses', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(course) })
  } catch {
    /* 폴백: 로컬만 */
  }
  const list = localCourses()
  if (!list.some((c) => c.id === course.id)) {
    localStorage.setItem('courses', JSON.stringify([...list, course]))
  }
}

/** 강의 삭제 (서버 + 캐시). */
export async function deleteCourse(id: string): Promise<void> {
  try {
    await fetch(`/api/courses?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  } catch {
    /* 폴백: 로컬만 */
  }
  localStorage.setItem('courses', JSON.stringify(localCourses().filter((c) => c.id !== id)))
}

/** 로컬에만 있던 강의를 서버로 1회 동기화 (구버전 데이터 이전). 동기화한 게 있으면 true. */
export async function syncLocalCoursesToServer(localList: Course[], serverCourses: Course[]): Promise<boolean> {
  const serverIds = new Set(serverCourses.map((c) => c.id))
  const missing = localList.filter((c) => !serverIds.has(c.id))
  for (const c of missing) {
    try {
      await fetch('/api/courses', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(c) })
    } catch {
      /* 무시 */
    }
  }
  return missing.length > 0
}

/** 한 학생의 수강 강의 목록 (서버 우선). allCourses에서 매칭해 반환 + 캐시. */
export async function loadEnrolledCourses(userId: string, allCourses: Course[]): Promise<Course[]> {
  try {
    const res = await fetch(`/api/enrollments?userId=${encodeURIComponent(userId)}`, { cache: 'no-store' })
    const data = await res.json()
    if (Array.isArray(data.courseIds)) {
      const enrolled = allCourses.filter((c) => data.courseIds.includes(c.id))
      localStorage.setItem(`enrolled_${userId}`, JSON.stringify(enrolled))
      return enrolled
    }
  } catch {
    /* 폴백 */
  }
  const raw = localStorage.getItem(`enrolled_${userId}`)
  return raw ? JSON.parse(raw) : []
}

/** 수강 신청 (서버 + 캐시). */
export async function enrollCourse(userId: string, course: Course): Promise<void> {
  try {
    await fetch('/api/enrollments', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ userId, courseId: course.id }) })
  } catch {
    /* 폴백 */
  }
  const raw = localStorage.getItem(`enrolled_${userId}`)
  const list: Course[] = raw ? JSON.parse(raw) : []
  if (!list.some((c) => c.id === course.id)) {
    localStorage.setItem(`enrolled_${userId}`, JSON.stringify([...list, course]))
  }
}

/** 회원가입 (서버). nodb면 null 반환 → 호출측이 localStorage 폴백. */
export async function apiSignup(payload: {
  id: string
  email: string
  password: string
  name: string
  isAdmin: boolean
}): Promise<{ user?: any; error?: string; nodb?: boolean }> {
  try {
    const res = await fetch('/api/auth/signup', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(payload) })
    return await res.json()
  } catch {
    return { nodb: true }
  }
}

/** 외부(일반인) 자유가입 — member_type='external'. 내부 가입과 분리된 문. */
export async function apiSignupExternal(payload: {
  id: string
  email: string
  password: string
  name: string
  phone?: string
}): Promise<{ user?: any; error?: string; nodb?: boolean }> {
  try {
    const res = await fetch('/api/auth/signup-external', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(payload) })
    return await res.json()
  } catch {
    return { nodb: true }
  }
}

/** 로그인 (서버). user 없으면 호출측이 localStorage 폴백. */
export async function apiLogin(email: string, password: string): Promise<{ user?: any; nodb?: boolean; blocked?: boolean; error?: string; token?: string }> {
  try {
    const res = await fetch('/api/auth/login', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ email, password }) })
    return await res.json()
  } catch {
    return { nodb: true }
  }
}

/** 한 강의의 수강 학생 id 목록 (관리자용). null이면 폴백 필요. */
export async function loadCourseEnrollments(courseId: string): Promise<string[] | null> {
  try {
    const res = await fetch(`/api/enrollments?courseId=${encodeURIComponent(courseId)}`, { cache: 'no-store' })
    const data = await res.json()
    if (Array.isArray(data.userIds)) return data.userIds
  } catch {
    /* 폴백 */
  }
  return null
}

/** 학생 목록 (관리자용, 서버 우선). null이면 폴백 필요. */
export async function loadStudents(): Promise<any[] | null> {
  try {
    const res = await fetch('/api/users', { cache: 'no-store' })
    const data = await res.json()
    if (Array.isArray(data.students)) return data.students
  } catch {
    /* 폴백 */
  }
  return null
}
