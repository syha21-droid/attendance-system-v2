'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { LogOut, Clock, AlertCircle } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Course } from '@/types'

export default function CoursePage() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.id as string
  const user = useStore((state) => state.user)
  const setUser = useStore((state) => state.setUser)

  const [course, setCourse] = useState<Course | null>(null)
  const [attendances, setAttendances] = useState(0)
  const [lateCount, setLateCount] = useState(0)

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (!savedUser) {
      router.push('/login')
      return
    }

    const userData = JSON.parse(savedUser)
    setUser(userData)

    const savedCourses = localStorage.getItem('courses')
    if (savedCourses) {
      const courses = JSON.parse(savedCourses)
      const found = courses.find((c: Course) => c.id === courseId)
      setCourse(found)
    }

    const attendanceKey = `attendance_${userData.id}_${courseId}`
    const saved = localStorage.getItem(attendanceKey)
    if (saved) {
      const records = JSON.parse(saved)
      setAttendances(records.length)
      const late = records.filter((r: any) => r.status === 'late').length
      setLateCount(late)
    }
  }, [courseId, router, setUser])

  const handleAttendance = () => {
    if (!user || !course) return

    const now = new Date()
    const todayDate = now.toLocaleDateString('ko-KR')
    const currentTime = now.toLocaleTimeString('ko-KR')

    const attendanceKey = `attendance_${user.id}_${courseId}`
    const firstAttendanceKey = `first_attendance_${user.id}_${courseId}`

    const saved = localStorage.getItem(attendanceKey)
    const firstAttendanceStr = localStorage.getItem(firstAttendanceKey)

    let status = 'present'
    let statusMessage = '✅ 출석'

    // 같은 날짜에 이미 첫 출석이 있으면 지각으로 처리
    if (firstAttendanceStr) {
      const firstAttendance = JSON.parse(firstAttendanceStr)
      if (firstAttendance.date === todayDate) {
        status = 'late'
        statusMessage = '⏰ 지각'
      } else {
        // 다른 날짜면 첫 출석 업데이트
        localStorage.setItem(firstAttendanceKey, JSON.stringify({ date: todayDate, time: currentTime }))
      }
    } else {
      // 첫 출석 저장
      localStorage.setItem(firstAttendanceKey, JSON.stringify({ date: todayDate, time: currentTime }))
    }

    const attendanceRecord = {
      date: todayDate,
      time: currentTime,
      status: status,
    }

    const updated = saved ? [...JSON.parse(saved), attendanceRecord] : [attendanceRecord]
    localStorage.setItem(attendanceKey, JSON.stringify(updated))

    setAttendances(updated.length)
    toast.success(`${statusMessage} ${course.name} 확인: ${currentTime}`)
  }

  const handleDropout = () => {
    if (!window.confirm('이 강의를 중단하시겠습니까?')) return

    if (user) {
      const enrolled = localStorage.getItem(`enrolled_${user.id}`)
      if (enrolled) {
        const courses = JSON.parse(enrolled).filter((c: Course) => c.id !== courseId)
        localStorage.setItem(`enrolled_${user.id}`, JSON.stringify(courses))
      }
    }

    toast.success('✅ 강의 중단이 접수되었습니다')
    setTimeout(() => router.push('/student'), 1000)
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    setUser(null)
    router.push('/login')
  }

  if (!course || !user) {
    return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/student')}
            className="text-blue-600 font-medium hover:underline"
          >
            ← 돌아가기
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{course.name}</h1>
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
          <h2 className="text-3xl font-bold text-gray-900 mb-2">{course.name}</h2>
          <p className="text-gray-600">👨‍🏫 강사: {course.instructor}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-bold text-gray-900">출석 등록</h3>
            </div>
            <p className="text-gray-600 mb-4">현재 시간에 출석을 확인합니다</p>
            <button
              onClick={handleAttendance}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
            >
              ✅ 출석 확인하기
            </button>
          </div>

          <div className="bg-red-50 rounded-lg p-6 border border-red-200">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <h3 className="text-xl font-bold text-gray-900">강의 중단</h3>
            </div>
            <p className="text-gray-600 mb-4">강의를 중단합니다</p>
            <button
              onClick={handleDropout}
              className="w-full bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700"
            >
              🚫 강의 중단
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">📋 강의 정보</h3>
            <div className="space-y-4">
              <div className="border-b pb-4">
                <p className="text-sm text-gray-600">강의명</p>
                <p className="text-lg font-semibold text-gray-900">{course.name}</p>
              </div>
              <div className="border-b pb-4">
                <p className="text-sm text-gray-600">강사</p>
                <p className="text-lg font-semibold text-gray-900">{course.instructor}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">상태</p>
                <p className="text-lg font-semibold text-green-600">✅ 수강 중</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">📊 출석 현황</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-green-50 p-3 rounded-lg border border-green-200">
                <span className="font-medium">✅ 총 출석</span>
                <span className="bg-green-200 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                  {attendances - lateCount}회
                </span>
              </div>
              <div className="flex items-center justify-between bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <span className="font-medium">⏰ 지각 횟수</span>
                <span className="bg-yellow-200 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                  {lateCount}회
                </span>
              </div>
              <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-200">
                <span className="font-medium">📊 총 횟수</span>
                <span className="bg-blue-200 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  {attendances}회
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-8 mt-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">📚 강의 자료</h3>
          <div className="space-y-4">
            <div className="border-l-4 border-blue-500 pl-4 py-2 hover:bg-blue-50 p-3 rounded transition cursor-pointer">
              <p className="font-semibold text-gray-900">📄 강의 슬라이드</p>
              <p className="text-sm text-gray-600">강의_슬라이드_1주차.pdf (2.5MB)</p>
              <p className="text-xs text-gray-500 mt-1">📅 2026-06-24 업로드</p>
            </div>

            <div className="border-l-4 border-green-500 pl-4 py-2 hover:bg-green-50 p-3 rounded transition cursor-pointer">
              <p className="font-semibold text-gray-900">📹 강의 영상</p>
              <p className="text-sm text-gray-600">강의_영상_1주차.mp4 (45MB)</p>
              <p className="text-xs text-gray-500 mt-1">⏱️ 1시간 30분</p>
            </div>

            <div className="border-l-4 border-purple-500 pl-4 py-2 hover:bg-purple-50 p-3 rounded transition cursor-pointer">
              <p className="font-semibold text-gray-900">📋 강의 노트</p>
              <p className="text-sm text-gray-600">강의_노트_정리.pdf (1.8MB)</p>
              <p className="text-xs text-gray-500 mt-1">✍️ 학생 작성</p>
            </div>

            <div className="border-l-4 border-yellow-500 pl-4 py-2 hover:bg-yellow-50 p-3 rounded transition cursor-pointer">
              <p className="font-semibold text-gray-900">🔗 참고 자료</p>
              <p className="text-sm text-gray-600">외부 링크 및 추천 자료</p>
              <p className="text-xs text-gray-500 mt-1">🌐 웹사이트</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-8 mt-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">📝 과제 및 시험</h3>
          <div className="space-y-3">
            <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">✏️ 과제 1: {course.name} 기초 이해</p>
                  <p className="text-sm text-gray-600">제출 기한: 2026-07-01</p>
                </div>
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">✅ 제출됨</span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">📚 중간고사</p>
                  <p className="text-sm text-gray-600">예정 날짜: 2026-07-15</p>
                </div>
                <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">⏰ 예정 중</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
