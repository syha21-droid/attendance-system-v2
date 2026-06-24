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
