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
  exitCount: number
  lastExitTime: string | null
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

      // 회원가입된 학생 목록 로드
      const registeredStudents: any[] = []
      const studentsData = localStorage.getItem('students')
      if (studentsData) {
        registeredStudents.push(...JSON.parse(studentsData))
      }

      // 출석 기록에서 학생 ID 추출
      const userIds = new Set<string>()
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
        let totalExit = 0
        let lastExitTime: string | null = null

        allKeys.forEach((key) => {
          if (key.startsWith(`attendance_${userId}_`)) {
            const data = JSON.parse(localStorage.getItem(key) || '[]')
            totalAttendance += data.filter((r: any) => r.status === 'present').length
            totalLate += data.filter((r: any) => r.status === 'late').length
            totalAbsent += data.filter((r: any) => r.status === 'absent').length
            totalExcused += data.filter((r: any) => r.status === 'excused').length

            // 퇴장 기록 확인
            const exitsInCourse = data.filter((r: any) => r.exitTime)
            totalExit += exitsInCourse.length

            // 가장 최근 퇴장 시간 찾기
            if (exitsInCourse.length > 0) {
              const mostRecentExit = exitsInCourse[exitsInCourse.length - 1]
              if (!lastExitTime || mostRecentExit.exitTime > lastExitTime) {
                lastExitTime = mostRecentExit.exitTime
              }
            }
          }
        })

        // 회원가입 정보에서 이름과 이메일 찾기
        const registeredStudent = registeredStudents.find((s: any) => s.id === userId)
        const studentName = registeredStudent?.name || userId
        const studentEmail = registeredStudent?.email || ''
        const createdAt = registeredStudent?.createdAt || new Date().toISOString()

        allStudents.push({
          id: userId,
          name: studentName,
          email: studentEmail,
          enrolledCourses: 0,
          createdAt: createdAt,
          attendanceCount: totalAttendance,
          lateCount: totalLate,
          absentCount: totalAbsent,
          excusedCount: totalExcused,
          exitCount: totalExit,
          lastExitTime: lastExitTime,
        })
      })

      // 회원가입되었지만 아직 출석 기록이 없는 학생도 추가
      registeredStudents.forEach((student: any) => {
        if (!allStudents.find((s) => s.id === student.id)) {
          allStudents.push({
            id: student.id,
            name: student.name,
            email: student.email,
            enrolledCourses: 0,
            createdAt: student.createdAt,
            attendanceCount: 0,
            lateCount: 0,
            absentCount: 0,
            excusedCount: 0,
            exitCount: 0,
            lastExitTime: null,
          })
        }
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
        <div className="bg-white rounded-lg shadow p-8 mb-8">
          <p className="text-gray-600 text-base font-semibold mb-2">총 등록 학생 수</p>
          <p className="text-5xl font-bold text-purple-600">{students.length}</p>
        </div>

        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">📋 등록된 학생 목록</h2>

          {loading ? (
            <div className="text-center py-8">로딩 중...</div>
          ) : students.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-lg font-semibold">등록된 학생이 없습니다.</div>
          ) : (
            <div className="space-y-4">
              {students.map((student, idx) => (
                <div
                  key={student.id}
                  className={`flex items-center justify-between p-5 rounded-lg border-2 ${
                    idx % 3 === 0
                      ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-300'
                      : idx % 3 === 1
                      ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-300'
                      : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300'
                  } hover:shadow-lg transition`}
                >
                  <div className="flex-1">
                    <p className="font-bold text-lg text-gray-900">👤 {student.name}</p>
                    <p className="text-base text-gray-700 font-semibold">📧 {student.email}</p>
                    <p className="text-xs text-gray-500 mt-1">가입일: {new Date(student.createdAt).toLocaleDateString('ko-KR')}</p>
                  </div>
                  <div className="text-right">
                    <div className="grid grid-cols-3 gap-2 text-sm font-semibold mb-2">
                      <div className="bg-green-100 text-green-700 p-2 rounded">✅ {student.attendanceCount}회</div>
                      <div className="bg-yellow-100 text-yellow-700 p-2 rounded">⏰ {student.lateCount}회</div>
                      <div className="bg-red-100 text-red-700 p-2 rounded">❌ {student.absentCount}회</div>
                      <div className="bg-blue-100 text-blue-700 p-2 rounded">🏥 {student.excusedCount}회</div>
                      <div className="bg-purple-100 text-purple-700 p-2 rounded">🚪 {student.exitCount}회</div>
                      <div className="bg-indigo-100 text-indigo-700 p-2 rounded text-xs">
                        {student.lastExitTime ? (
                          <>
                            <p className="font-bold">마지막 퇴장</p>
                            <p>{student.lastExitTime}</p>
                          </>
                        ) : (
                          <p>-</p>
                        )}
                      </div>
                    </div>
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
