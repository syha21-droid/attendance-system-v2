import { create } from 'zustand'
import { User, Course, Enrollment, Attendance } from '@/types'

interface Store {
  user: User | null
  courses: Course[]
  enrollments: Enrollment[]
  attendances: Attendance[]

  setUser: (user: User | null) => void
  setCourses: (courses: Course[]) => void
  setEnrollments: (enrollments: Enrollment[]) => void
  setAttendances: (attendances: Attendance[]) => void

  addCourse: (course: Course) => void
  addEnrollment: (enrollment: Enrollment) => void
  addAttendance: (attendance: Attendance) => void

  logout: () => void
}

// 클라이언트에서는 localStorage의 로그인 정보를 즉시 읽어 깜빡임 방지
const getInitialUser = (): User | null => {
  if (typeof window === 'undefined') return null
  try {
    const s = localStorage.getItem('user')
    return s ? JSON.parse(s) : null
  } catch {
    return null
  }
}

export const useStore = create<Store>((set) => ({
  user: getInitialUser(),
  courses: [],
  enrollments: [],
  attendances: [],

  setUser: (user) => set({ user }),
  setCourses: (courses) => set({ courses }),
  setEnrollments: (enrollments) => set({ enrollments }),
  setAttendances: (attendances) => set({ attendances }),

  addCourse: (course) => set((state) => ({
    courses: [...state.courses, course]
  })),

  addEnrollment: (enrollment) => set((state) => ({
    enrollments: [...state.enrollments, enrollment]
  })),

  addAttendance: (attendance) => set((state) => ({
    attendances: [...state.attendances, attendance]
  })),

  logout: () => set({
    user: null,
    enrollments: [],
    attendances: []
  })
}))
