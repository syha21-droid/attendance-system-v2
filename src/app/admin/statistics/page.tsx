'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { LogOut, ArrowLeft, BarChart3, TrendingUp } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Course } from '@/types'
import { doLogout } from '@/lib/logout'

export default function StatisticsPage() {
  const router = useRouter()
  const user = useStore((state) => state.user)
  const setUser = useStore((state) => state.setUser)

  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null)
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (!savedUser) {
      router.push('/login')
      return
    }

    const userData = JSON.parse(savedUser)
    if (!userData.isAdmin) {
      router.push('/student')
      return
    }

    setUser(userData)

    const savedCourses = localStorage.getItem('courses')
    if (savedCourses) {
      const courseList = JSON.parse(savedCourses)
      setCourses(courseList)
      if (courseList.length > 0) {
        setSelectedCourse(courseList[0].id)
      }
    }

    setLoading(false)
  }, [router, setUser])

  useEffect(() => {
    if (!selectedCourse) return

    // 선택된 강의의 통계 계산
    const allKeys = Object.keys(localStorage)
    const studentStats = new Map<string, any>()

    // 모든 학생의 출석 정보 수집
    allKeys.forEach((key) => {
      if (key.startsWith(`attendance_`) && key.endsWith(`_${selectedCourse}`)) {
        const parts = key.split('_')
        const userId = parts.slice(1, -1).join('_')
        const data = JSON.parse(localStorage.getItem(key) || '[]')

        const present = data.filter((r: any) => r.status === 'present').length
        const late = data.filter((r: any) => r.status === 'late').length
        const absent = data.filter((r: any) => r.status === 'absent').length
        const excused = data.filter((r: any) => r.status === 'excused').length
        const total = data.length

        // 모니터 감지 정보
        const monitorDetectedCount = data.filter((r: any) => r.monitorDetected).length
        const attendanceWithMonitor = data.filter((r: any) => r.status === 'present' && r.monitorDetected).length

        studentStats.set(userId, {
          id: userId,
          name: `학생_${userId.substring(0, 8)}`,
          present,
          late,
          absent,
          excused,
          total,
          monitorDetectedCount,
          attendanceWithMonitor,
          attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
          lateRate: total > 0 ? Math.round((late / total) * 100) : 0,
          absentRate: total > 0 ? Math.round((absent / total) * 100) : 0,
          excusedRate: total > 0 ? Math.round((excused / total) * 100) : 0,
          monitorDetectionRate: present > 0 ? Math.round((attendanceWithMonitor / present) * 100) : 0,
        })
      }
    })

    const students = Array.from(studentStats.values())

    // 전체 통계
    const totalPresent = students.reduce((acc, s) => acc + s.present, 0)
    const totalLate = students.reduce((acc, s) => acc + s.late, 0)
    const totalAbsent = students.reduce((acc, s) => acc + s.absent, 0)
    const totalExcused = students.reduce((acc, s) => acc + s.excused, 0)
    const totalRecords = students.reduce((acc, s) => acc + s.total, 0)

    const avgAttendanceRate = students.length > 0
      ? Math.round(students.reduce((acc, s) => acc + s.attendanceRate, 0) / students.length)
      : 0

    setStats({
      students,
      summary: {
        totalStudents: students.length,
        totalRecords,
        totalPresent,
        totalLate,
        totalAbsent,
        totalExcused,
        avgAttendanceRate,
        topStudent: students.length > 0
          ? students.reduce((max, s) => s.attendanceRate > max.attendanceRate ? s : max)
          : null,
        worstStudent: students.length > 0
          ? students.reduce((min, s) => s.attendanceRate < min.attendanceRate ? s : min)
          : null,
      }
    })
  }, [selectedCourse])

  const handleLogout = () => {
    
    localStorage.removeItem('user')
    setUser(null)
    router.push('/login')
  }

  if (loading) {
    return <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-blue-50 to-indigo-100"><div className="app-spinner" /><p className="text-gray-600 font-semibold">로딩 중...</p></div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/admin')}
            className="text-blue-600 font-medium hover:underline flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            돌아가기
          </button>
          <h1 className="text-2xl font-bold text-gray-900">📊 통계 대시보드</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 강의 선택 */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            강의 선택
          </label>
          <select
            value={selectedCourse || ''}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="w-full md:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
          >
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </div>

        {stats && (
          <>
            {/* 통계 요약 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
                <p className="text-gray-600 text-sm mb-2">✅ 전체 출석</p>
                <p className="text-3xl font-bold text-blue-600">{stats.summary.totalPresent}</p>
                <p className="text-xs text-gray-500 mt-2">평균: {Math.round((stats.summary.totalPresent / Math.max(stats.summary.totalRecords, 1)) * 100)}%</p>
              </div>

              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-6 border border-yellow-200">
                <p className="text-gray-600 text-sm mb-2">⏰ 전체 지각</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.summary.totalLate}</p>
                <p className="text-xs text-gray-500 mt-2">평균: {Math.round((stats.summary.totalLate / Math.max(stats.summary.totalRecords, 1)) * 100)}%</p>
              </div>

              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-6 border border-red-200">
                <p className="text-gray-600 text-sm mb-2">❌ 전체 결석</p>
                <p className="text-3xl font-bold text-red-600">{stats.summary.totalAbsent}</p>
                <p className="text-xs text-gray-500 mt-2">평균: {Math.round((stats.summary.totalAbsent / Math.max(stats.summary.totalRecords, 1)) * 100)}%</p>
              </div>
            </div>

            {/* 상세 통계 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* 평균 출석률 */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                  <h3 className="text-xl font-bold text-gray-900">평균 출석률</h3>
                </div>
                <div className="text-center">
                  <p className="text-5xl font-bold text-green-600 mb-2">{stats.summary.avgAttendanceRate}%</p>
                  <p className="text-gray-600">전체 학생 평균</p>
                </div>
              </div>

              {/* 학생 수 및 기타 */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                  <h3 className="text-xl font-bold text-gray-900">기본 정보</h3>
                </div>
                <div className="space-y-2">
                  <p className="text-gray-700">👥 수강 학생: <span className="font-bold">{stats.summary.totalStudents}</span>명</p>
                  <p className="text-gray-700">📊 총 출석 기록: <span className="font-bold">{stats.summary.totalRecords}</span>건</p>
                  <p className="text-gray-700">🏥 총 공가: <span className="font-bold">{stats.summary.totalExcused}</span>건</p>
                </div>
              </div>
            </div>

            {/* 최고/최저 학생 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {stats.summary.topStudent && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-lg p-6 border-2 border-green-300">
                  <p className="text-sm font-semibold text-green-900 mb-3">🏆 최고 출석률</p>
                  <p className="text-3xl font-bold text-green-600 mb-2">{stats.summary.topStudent.attendanceRate}%</p>
                  <p className="text-gray-700">{stats.summary.topStudent.name}</p>
                  <p className="text-sm text-gray-600 mt-2">출석: {stats.summary.topStudent.present}회 / 지각: {stats.summary.topStudent.late}회</p>
                </div>
              )}

              {stats.summary.worstStudent && (
                <div className="bg-gradient-to-br from-red-50 to-orange-100 rounded-lg p-6 border-2 border-red-300">
                  <p className="text-sm font-semibold text-red-900 mb-3">⚠️ 최저 출석률</p>
                  <p className="text-3xl font-bold text-red-600 mb-2">{stats.summary.worstStudent.attendanceRate}%</p>
                  <p className="text-gray-700">{stats.summary.worstStudent.name}</p>
                  <p className="text-sm text-gray-600 mt-2">출석: {stats.summary.worstStudent.present}회 / 결석: {stats.summary.worstStudent.absent}회</p>
                </div>
              )}
            </div>

            {/* 학생별 상세 통계 */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6">📋 학생별 상세 통계</h3>

              {stats.students.length === 0 ? (
                <p className="text-gray-500 text-center py-8">출석 기록이 없습니다</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">학생</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-900">출석</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-900">지각</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-900">결석</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-900">공가</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-900">출석률</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-900">📺 모니터</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.students.map((student: any, idx: number) => (
                        <tr
                          key={student.id}
                          className={`border-b border-gray-100 ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                          }`}
                        >
                          <td className="py-3 px-4 font-medium text-gray-900">{student.name}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                              {student.present}회
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                              {student.late}회
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                              {student.absent}회
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                              {student.excused}회
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center">
                              <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                                <div
                                  className="bg-green-600 h-2 rounded-full"
                                  style={{ width: `${student.attendanceRate}%` }}
                                ></div>
                              </div>
                              <span className="font-bold text-gray-900">{student.attendanceRate}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-sm font-bold text-gray-900">{student.attendanceWithMonitor}/{student.present}</span>
                              <span className="text-xs text-gray-600">({student.monitorDetectionRate}%)</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
