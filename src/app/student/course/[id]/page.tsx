'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { LogOut, Clock, AlertCircle } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { supabase } from '@/lib/supabase'
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
  const [absentCount, setAbsentCount] = useState(0)
  const [excusedCount, setExcusedCount] = useState(0)
  const [materials, setMaterials] = useState<any[]>([])
  const [notice, setNotice] = useState('')
  const [schedule, setSchedule] = useState<any[]>([])
  const [currentClass, setCurrentClass] = useState<any>(null)
  const [absenceReason, setAbsenceReason] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<'present' | 'late' | 'absent' | 'excused' | null>(null)
  const [isConfirmingAttendance, setIsConfirmingAttendance] = useState(false)
  const [selectedEpisode, setSelectedEpisode] = useState(1)

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

    const materialsKey = `course_materials_${courseId}`
    const savedMaterials = localStorage.getItem(materialsKey)
    if (savedMaterials) {
      setMaterials(JSON.parse(savedMaterials))
    }

    const noticeKey = `course_notice_${courseId}`
    const savedNotice = localStorage.getItem(noticeKey)
    if (savedNotice) {
      setNotice(savedNotice)
    }

    // 회차식 강의이면 선택된 회차의 시간표 로드
    const scheduleKey = course?.courseType === 'episode'
      ? `course_schedule_${courseId}_episode_${selectedEpisode}`
      : `course_schedule_${courseId}`

    const savedSchedule = localStorage.getItem(scheduleKey)
    if (savedSchedule) {
      const data = JSON.parse(savedSchedule)
      setSchedule(data.classes || [])
    } else {
      // 현재 시간을 기준으로 기본 시간표 생성
      const now = new Date()
      const currentHour = now.getHours()

      const defaultSchedule = [
        {
          number: 1,
          name: '1교시',
          startTime: `${currentHour.toString().padStart(2, '0')}:00`,
          endTime: `${(currentHour + 1).toString().padStart(2, '0')}:00`
        },
        {
          number: 2,
          name: '2교시',
          startTime: `${(currentHour + 1).toString().padStart(2, '0')}:00`,
          endTime: `${(currentHour + 2).toString().padStart(2, '0')}:00`
        },
        {
          number: 3,
          name: '3교시',
          startTime: `${(currentHour + 2).toString().padStart(2, '0')}:00`,
          endTime: `${(currentHour + 3).toString().padStart(2, '0')}:00`
        },
      ]
      setSchedule(defaultSchedule)
    }

    loadAttendanceData(userData.id)
  }, [courseId, router, setUser])

  const updateCurrentClass = () => {
    if (!schedule || schedule.length === 0) {
      setCurrentClass(null)
      return
    }

    const now = new Date()
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0')

    const current = schedule.find((cls: any) => {
      return currentTime >= cls.startTime && currentTime < cls.endTime
    })
    setCurrentClass(current || null)
  }

  useEffect(() => {
    if (schedule.length === 0) return

    updateCurrentClass()
    const interval = setInterval(updateCurrentClass, 60000)
    return () => clearInterval(interval)
  }, [schedule])

  // 회차 변경 시 시간표 다시 로드
  useEffect(() => {
    if (!course) return

    const scheduleKey = course.courseType === 'episode'
      ? `course_schedule_${courseId}_episode_${selectedEpisode}`
      : `course_schedule_${courseId}`

    const savedSchedule = localStorage.getItem(scheduleKey)
    if (savedSchedule) {
      const data = JSON.parse(savedSchedule)
      setSchedule(data.classes || [])
    }
  }, [selectedEpisode, course, courseId])

  const loadAttendanceData = async (userId: string) => {
    const attendanceKey = `attendance_${userId}_${courseId}`
    const saved = localStorage.getItem(attendanceKey)
    if (saved) {
      const records = JSON.parse(saved)
      setAttendances(records.filter((r: any) => r.status === 'present').length)
      setLateCount(records.filter((r: any) => r.status === 'late').length)
      setAbsentCount(records.filter((r: any) => r.status === 'absent').length)
      setExcusedCount(records.filter((r: any) => r.status === 'excused').length)
    }
  }

  const getStatusForTime = (timeStr: string): 'present' | 'late' | 'absent' => {
    if (!currentClass) return 'present'

    const [hours, minutes] = timeStr.split(':').map(Number)
    const recordTime = new Date()
    recordTime.setHours(hours, minutes)

    const [classStartHour, classStartMin] = currentClass.startTime.split(':').map(Number)
    const classStartTime = new Date()
    classStartTime.setHours(classStartHour, classStartMin)

    const lateThreshold = 10 * 60000
    const absentThreshold = 30 * 60000
    const diff = recordTime.getTime() - classStartTime.getTime()

    if (diff < lateThreshold) return 'present'
    if (diff < absentThreshold) return 'late'
    return 'absent'
  }

  const handleAttendance = () => {
    if (!user || !course || !currentClass) {
      toast.error('현재 시간에 출석할 수 없습니다')
      return
    }

    const now = new Date()
    const todayDate = now.toLocaleDateString('ko-KR')
    const currentTime = now.toLocaleTimeString('ko-KR')
    const status = getStatusForTime(currentTime)

    const attendanceRecord = {
      date: todayDate,
      time: currentTime,
      status: status,
      class: currentClass.name,
      reason: selectedStatus === 'excused' ? absenceReason : undefined,
    }

    const attendanceKey = `attendance_${user.id}_${courseId}`
    const saved = localStorage.getItem(attendanceKey)
    const updated = saved ? [...JSON.parse(saved), attendanceRecord] : [attendanceRecord]
    localStorage.setItem(attendanceKey, JSON.stringify(updated))

    loadAttendanceData(user.id)
    setSelectedStatus(null)
    setAbsenceReason('')
    setIsConfirmingAttendance(false)

    const statusMessage = status === 'present' ? '✅ 출석' : status === 'late' ? '⏰ 지각' : '❌ 결석'
    toast.success(`${statusMessage} ${course.name} ${currentClass.name}: ${currentTime}`)
  }

  const handleExcuse = () => {
    if (!user || !course || !currentClass || !absenceReason.trim()) {
      toast.error('공가 사유를 입력하세요')
      return
    }

    const now = new Date()
    const todayDate = now.toLocaleDateString('ko-KR')
    const currentTime = now.toLocaleTimeString('ko-KR')

    const attendanceRecord = {
      date: todayDate,
      time: currentTime,
      status: 'excused',
      class: currentClass.name,
      reason: absenceReason,
    }

    const attendanceKey = `attendance_${user.id}_${courseId}`
    const saved = localStorage.getItem(attendanceKey)
    const updated = saved ? [...JSON.parse(saved), attendanceRecord] : [attendanceRecord]
    localStorage.setItem(attendanceKey, JSON.stringify(updated))

    loadAttendanceData(user.id)
    setAbsenceReason('')
    setIsConfirmingAttendance(false)
    toast.success(`🏥 공가 신청 완료: ${absenceReason}`)
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
            로그아웃
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {notice && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-8">
            <p className="font-semibold text-blue-900 mb-2">📢 공지사항</p>
            <p className="text-gray-700 whitespace-pre-wrap">{notice}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-8 mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">{course.name}</h2>
          <p className="text-gray-600">👨‍🏫 강사: {course.instructor}</p>
        </div>

        {course?.courseType === 'episode' && (
          <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-6 mb-8">
            <label className="block text-sm font-semibold text-indigo-900 mb-3">
              📚 회차 선택
            </label>
            <select
              value={selectedEpisode}
              onChange={(e) => setSelectedEpisode(Number(e.target.value))}
              className="w-full px-4 py-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              {Array.from({ length: course.episodeCount || 1 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}회차
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-bold text-gray-900">출석 등록</h3>
            </div>
            {currentClass ? (
              <>
                <p className="text-gray-600 mb-4">현재 시간: {currentClass.name}</p>
                {!isConfirmingAttendance ? (
                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        setSelectedStatus('present')
                        setIsConfirmingAttendance(true)
                      }}
                      className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700"
                    >
                      ✅ 출석 확인
                    </button>
                    <button
                      onClick={() => {
                        setSelectedStatus('excused')
                        setIsConfirmingAttendance(true)
                      }}
                      className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700"
                    >
                      🏥 공가 신청
                    </button>
                  </div>
                ) : selectedStatus === 'excused' ? (
                  <div className="space-y-3">
                    <textarea
                      value={absenceReason}
                      onChange={(e) => setAbsenceReason(e.target.value)}
                      placeholder="공가 사유를 입력하세요 (예: 병원 방문, 개인사정 등)"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleExcuse}
                        className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700"
                      >
                        확인
                      </button>
                      <button
                        onClick={() => {
                          setSelectedStatus(null)
                          setAbsenceReason('')
                          setIsConfirmingAttendance(false)
                        }}
                        className="flex-1 bg-gray-400 text-white py-2 rounded-lg font-medium hover:bg-gray-500"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={handleAttendance}
                      className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700"
                    >
                      확인
                    </button>
                    <button
                      onClick={() => {
                        setSelectedStatus(null)
                        setIsConfirmingAttendance(false)
                      }}
                      className="w-full bg-gray-400 text-white py-2 rounded-lg font-medium hover:bg-gray-500"
                    >
                      취소
                    </button>
                  </div>
                )}
              </>
            ) : (
              <p className="text-gray-600">현재 수강 시간이 아닙니다</p>
            )}
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
                <span className="font-medium">✅ 출석</span>
                <span className="bg-green-200 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                  {attendances}회
                </span>
              </div>
              <div className="flex items-center justify-between bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <span className="font-medium">⏰ 지각</span>
                <span className="bg-yellow-200 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                  {lateCount}회
                </span>
              </div>
              <div className="flex items-center justify-between bg-red-50 p-3 rounded-lg border border-red-200">
                <span className="font-medium">❌ 결석</span>
                <span className="bg-red-200 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                  {absentCount}회
                </span>
              </div>
              <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-200">
                <span className="font-medium">🏥 공가</span>
                <span className="bg-blue-200 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  {excusedCount}회
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-8 mt-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">📚 강의 자료</h3>
          {materials.length === 0 ? (
            <p className="text-gray-500 text-center py-8">등록된 강의 자료가 없습니다</p>
          ) : (
            <div className="space-y-3">
              {materials.map((material: any) => (
                <div
                  key={material.id}
                  onClick={() => {
                    if (material.data) {
                      const link = document.createElement('a')
                      link.href = material.data
                      link.download = material.name
                      link.click()
                      toast.success(`✅ ${material.name} 다운로드 시작`)
                    }
                  }}
                  className="border-l-4 border-blue-500 pl-4 py-2 hover:bg-blue-50 p-3 rounded transition cursor-pointer bg-gray-50 hover:shadow-md"
                >
                  <p className="font-semibold text-gray-900">📄 {material.name}</p>
                  <p className="text-sm text-gray-600">{material.size}</p>
                  <p className="text-xs text-gray-500 mt-1">📅 {material.uploadedAt}</p>
                  <p className="text-xs text-blue-600 mt-2">💾 클릭해서 다운로드</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
