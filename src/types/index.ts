export interface User {
  id: string
  email: string
  name: string
  isAdmin: boolean
}

export interface Course {
  id: string
  name: string
  instructor: string
  createdAt: string
  courseType?: 'session' | 'episode' // session: 특강식, episode: 회차식
  episodeCount?: number // 회차 수 (회차식일 때만)
}

export interface Attendance {
  id: string
  userId: string
  courseId: string
  date: string
  time: string
  status: 'present' | 'late' | 'absent' | 'excused'
}

export interface Enrollment {
  id: string
  userId: string
  courseId: string
  enrolledAt: string
}
