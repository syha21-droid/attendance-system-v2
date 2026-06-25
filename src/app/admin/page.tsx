'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { LogOut, Users, BookOpen, BarChart3, Download } from 'lucide-react'
import { useStore } from '@/store/useStore'
import * as XLSX from 'xlsx'
import { Course } from '@/types'
import { useIsomorphicLayoutEffect } from '@/lib/useIsomorphicLayoutEffect'

export default function AdminPage() {
  const router = useRouter()
  const user = useStore((state) => state.user)
  const setUser = useStore((state) => state.setUser)

  const [courses, setCourses] = useState<Course[]>([])
  const [newCourseName, setNewCourseName] = useState('')
  const [newCourseInstructor, setNewCourseInstructor] = useState('')
  const [newCourseType, setNewCourseType] = useState<'session' | 'episode'>('session')
  const [newEpisodeCount, setNewEpisodeCount] = useState(9)
  const [studentCount, setStudentCount] = useState(0)
  const [avgAttendanceRate, setAvgAttendanceRate] = useState(0)

  useIsomorphicLayoutEffect(() => {
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
      setCourses(JSON.parse(savedCourses))
    } else {
      const defaultCourses = [
        { id: '1', name: 'Python 기초', instructor: '김교수', createdAt: new Date().toISOString() },
        { id: '2', name: '웹개발', instructor: '이교수', createdAt: new Date().toISOString() },
        { id: '3', name: '데이터분석', instructor: '박교수', createdAt: new Date().toISOString() },
      ]
      setCourses(defaultCourses)
      localStorage.setItem('courses', JSON.stringify(defaultCourses))
    }

    loadStats()
  }, [router, setUser])

  const loadStats = () => {
    // 회원가입한 학생 수 집계 (users 비관리자 + students + 출석기록)
    const studentIds = new Set<string>()

    const usersData = localStorage.getItem('users')
    if (usersData) {
      JSON.parse(usersData).forEach((u: any) => {
        if (!u.isAdmin) studentIds.add(u.id)
      })
    }

    const studentsData = localStorage.getItem('students')
    if (studentsData) {
      JSON.parse(studentsData).forEach((s: any) => studentIds.add(s.id))
    }

    const allKeys = Object.keys(localStorage)
    allKeys.forEach((key) => {
      if (key.startsWith('attendance_')) {
        const parts = key.split('_')
        if (parts.length >= 3) {
          studentIds.add(parts.slice(1, -1).join('_'))
        }
      }
    })

    setStudentCount(studentIds.size)

    // 평균 출석률 집계
    let totalPresent = 0
    let totalRecords = 0
    allKeys.forEach((key) => {
      if (key.startsWith('attendance_')) {
        const data = JSON.parse(localStorage.getItem(key) || '[]')
        data.forEach((r: any) => {
          totalRecords += 1
          if (r.status === 'present' || r.status === 'late') totalPresent += 1
        })
      }
    })
    setAvgAttendanceRate(totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0)
  }

  const handleAddCourse = () => {
    if (!newCourseName || !newCourseInstructor) {
      toast.error('강의명과 강사명을 입력하세요')
      return
    }

    const newCourse: Course = {
      id: Math.random().toString(36).substr(2, 9),
      name: newCourseName,
      instructor: newCourseInstructor,
      createdAt: new Date().toISOString(),
      courseType: newCourseType,
      episodeCount: newCourseType === 'episode' ? newEpisodeCount : undefined,
    }

    const updated = [...courses, newCourse]
    setCourses(updated)
    localStorage.setItem('courses', JSON.stringify(updated))
    toast.success('✅ 강의가 추가되었습니다')
    setNewCourseName('')
    setNewCourseInstructor('')
    setNewCourseType('session')
    setNewEpisodeCount(9)
  }

  const handleDeleteCourse = (id: string) => {
    const updated = courses.filter((c) => c.id !== id)
    setCourses(updated)
    localStorage.setItem('courses', JSON.stringify(updated))
    toast.success('✅ 강의가 삭제되었습니다')
  }

  const handleDownloadExcel = () => {
    const attendanceData: any[] = []

    courses.forEach((course) => {
      const allKeys = Object.keys(localStorage)
      allKeys.forEach((key) => {
        if (key.startsWith(`attendance_`) && key.endsWith(`_${course.id}`)) {
          const data = JSON.parse(localStorage.getItem(key) || '[]')
          const parts = key.split('_')
          const userId = parts.slice(1, -1).join('_')

          data.forEach((record: any) => {
            let statusText = '출석'
            if (record.status === 'late') statusText = '지각'
            else if (record.status === 'absent') statusText = '결석'
            else if (record.status === 'excused') statusText = '공가'

            attendanceData.push({
              강의명: course.name,
              강사: course.instructor,
              학생ID: userId,
              날짜: record.date,
              시간: record.time,
              상태: statusText,
              사유: record.reason || '',
            })
          })
        }
      })
    })

    if (attendanceData.length === 0) {
      toast.error('내보낼 출석 데이터가 없습니다')
      return
    }

    const ws = XLSX.utils.json_to_sheet(attendanceData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '출석현황')
    XLSX.writeFile(wb, `출석현황_${new Date().toLocaleDateString('ko-KR')}.xlsx`)
    toast.success('✅ 엑셀 파일이 다운로드되었습니다')
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    setUser(null)
    router.push('/login')
  }

  if (!user) {
    return <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-blue-50 to-indigo-100"><div className="app-spinner" /><p className="text-gray-600 font-semibold">로딩 중...</p></div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">👨‍💼 관리자 대시보드</h1>
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
        <div className="bg-white rounded-lg shadow p-8 mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            안녕하세요, {user.name}님!
          </h2>
          <p className="text-gray-600">관리자 권한으로 로그인했습니다</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
            <BookOpen className="w-8 h-8 text-blue-600 mb-2" />
            <p className="text-gray-600 text-sm">등록된 강의</p>
            <p className="text-3xl font-bold text-blue-600">{courses.length}</p>
          </div>
          <button
            onClick={() => router.push('/admin/students')}
            className="bg-green-50 rounded-lg p-6 border border-green-200 text-left hover:shadow-lg transition cursor-pointer"
          >
            <Users className="w-8 h-8 text-green-600 mb-2" />
            <p className="text-gray-600 text-sm">회원가입 학생 수</p>
            <p className="text-3xl font-bold text-green-600">{studentCount}</p>
          </button>
          <div className="bg-purple-50 rounded-lg p-6 border border-purple-200">
            <BarChart3 className="w-8 h-8 text-purple-600 mb-2" />
            <p className="text-gray-600 text-sm">평균 출석률</p>
            <p className="text-3xl font-bold text-purple-600">{avgAttendanceRate}%</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-8 mb-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">📥 데이터 관리</h3>
          <button
            onClick={handleDownloadExcel}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg flex items-center gap-2 transition"
          >
            <Download className="w-5 h-5" />
            출석 현황 엑셀 다운로드
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">📚 강의 추가</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  강의명
                </label>
                <input
                  type="text"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 font-semibold placeholder-gray-600"
                  placeholder="예: JavaScript 기초"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  강사명
                </label>
                <input
                  type="text"
                  value={newCourseInstructor}
                  onChange={(e) => setNewCourseInstructor(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 font-semibold placeholder-gray-600"
                  placeholder="예: 홍길동"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  강의 유형
                </label>
                <select
                  value={newCourseType}
                  onChange={(e) => setNewCourseType(e.target.value as 'session' | 'episode')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 font-semibold bg-white"
                >
                  <option value="session">특강식 (회차 없음)</option>
                  <option value="episode">회차식 (MBA, 연속강의 등)</option>
                </select>
              </div>
              {newCourseType === 'episode' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    회차 수
                  </label>
                  <input
                    type="number"
                    value={newEpisodeCount}
                    onChange={(e) => setNewEpisodeCount(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 font-semibold"
                    min="1"
                    max="50"
                  />
                </div>
              )}
              <button
                onClick={handleAddCourse}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition"
              >
                + 강의 추가
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">📋 등록된 강의</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {courses.length === 0 ? (
                <p className="text-gray-500 text-center py-8">등록된 강의가 없습니다</p>
              ) : (
                courses.map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-200 hover:shadow-lg transition cursor-pointer"
                    onClick={() => router.push(`/admin/course/${course.id}`)}
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{course.name}</p>
                      <p className="text-sm text-gray-600">👨‍🏫 {course.instructor}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteCourse(course.id)
                      }}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition font-medium text-sm"
                    >
                      삭제
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => router.push('/admin/live')}
          className="w-full mt-8 bg-gradient-to-r from-indigo-600 to-blue-700 hover:from-indigo-700 hover:to-blue-800 text-white rounded-xl shadow-lg p-6 text-left transition flex items-center justify-between"
        >
          <div>
            <p className="text-xl font-bold">🛰️ 라이브 출석 시작 (서버 검증)</p>
            <p className="text-sm opacity-90 mt-1">15초 회전코드 + GPS 위치 + 중복 차단 — 조작 불가능한 현장 출석</p>
          </div>
          <span className="text-3xl">→</span>
        </button>

        <div className="bg-white rounded-lg shadow p-8 mt-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">🎯 관리 메뉴</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button onClick={() => router.push('/admin/statistics')} className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition text-left cursor-pointer">
              <p className="font-semibold text-purple-900">📊 통계 대시보드</p>
              <p className="text-sm text-purple-700">강의별 출석 통계를 확인합니다</p>
            </button>
            <button onClick={() => router.push('/admin/attendance')} className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition text-left cursor-pointer">
              <p className="font-semibold text-blue-900">📋 출석 현황 조회 (입·퇴장 시간)</p>
              <p className="text-sm text-blue-700">누가 몇 시에 입·퇴장했는지, 찍고 도망간 미인정 기록 확인</p>
            </button>
            <button onClick={() => router.push('/admin/students')} className="p-4 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition text-left cursor-pointer">
              <p className="font-semibold text-green-900">👥 학생 관리 / 수강 변경</p>
              <p className="text-sm text-green-700">학생 조회 및 잘못 신청한 수강 변경</p>
            </button>
            <button onClick={() => router.push('/admin/late')} className="p-4 bg-yellow-50 hover:bg-yellow-100 rounded-lg border border-yellow-200 transition text-left cursor-pointer">
              <p className="font-semibold text-yellow-900">⏰ 지각 관리</p>
              <p className="text-sm text-yellow-700">지각 학생을 관리합니다</p>
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
