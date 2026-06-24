'use client'

import { useRouter } from 'next/navigation'
import { LogOut, ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface StudentWithAttendance {
  id: string
  name: string
  email: string
  enrolledCourses: number
  createdAt: string
  attendanceCount: number
  lateCount: number
  absentCount: number
  excusedCount: number
}

export default function StudentsPage() {
  const router = useRouter()
  const [students, setStudents] = useState<StudentWithAttendance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStudents()
  }, [])

  const loadStudents = async () => {
    try {
      const allStudents: StudentWithAttendance[] = []
      const allKeys = Object.keys(localStorage)
      const userIds = new Set<string>()

      // localStorage에서 모든 학생 ID 추출
      allKeys.forEach((key) => {
        if (key.startsWith('attendance_')) {
          const parts = key.split('_')
          if (parts.length >= 3) {
            const userId = parts.slice(1, -1).join('_')
            userIds.add(userId)
          }
        }
      })

      // 각 학생의 모든 강의에서 출석 정보 수집
      userIds.forEach((userId) => {
        let totalAttendance = 0
        let totalLate = 0
        let totalAbsent = 0
        let totalExcused = 0

        allKeys.forEach((key) => {
          if (key.startsWith(`attendance_${userId}_`)) {
            const data = JSON.parse(localStorage.getItem(key) || '[]')
            totalAttendance += data.filter((r: any) => r.status === 'present').length
            totalLate += data.filter((r: any) => r.status === 'late').length
            totalAbsent += data.filter((r: any) => r.status === 'absent').length
            totalExcused += data.filter((r: any) => r.status === 'excused').length
          }
        })

        allStudents.push({
          id: userId,
          name: userId,
          email: '',
          enrolledCourses: 0,
          createdAt: new Date().toISOString(),
          attendanceCount: totalAttendance,
          lateCount: totalLate,
          absentCount: totalAbsent,
          excusedCount: totalExcused,
        })
      })

      setStudents(allStudents)
    } catch (error) {
      console.error('Error loading students:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/admin')} className="flex items-center gap-2 text-blue-600 font-medium hover:underline">
            <ArrowLeft className="w-4 h-4" />
            돌아가기
          </button>
          <h1 className="text-2xl font-bold text-gray-900">👥 학생 관리</h1>
          <button onClick={handleLogout} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
            <LogOut className="w-4 h-4 inline mr-2" />
            로그아웃
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">등록된 학생 목록</h2>

          {loading ? (
            <div className="text-center py-8">로딩 중...</div>
          ) : students.length === 0 ? (
            <div className="text-center py-8 text-gray-500">등록된 학생이 없습니다.</div>
          ) : (
            <div className="space-y-3">
              {students.map((student, idx) => (
                <div
                  key={student.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    idx % 3 === 0
                      ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200'
                      : idx % 3 === 1
                      ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200'
                      : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-gray-900">{student.name}</p>
                    <p className="text-sm text-gray-600">📧 {student.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-600">
                      ✅ 출석: {student.attendanceCount}회 | ⏰ 지각: {student.lateCount}회 | ❌ 결석: {student.absentCount}회 | 🏥 공가: {student.excusedCount}회
                    </p>
                    <p className="text-xs text-gray-500">가입: {new Date(student.createdAt).toLocaleDateString('ko-KR')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
