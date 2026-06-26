'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { LogOut, ArrowLeft, Upload, Trash2, Download, QrCode, X, FileText, RefreshCw } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useStore } from '@/store/useStore'
import * as XLSX from 'xlsx'
import { Course } from '@/types'
import { useIsomorphicLayoutEffect } from '@/lib/useIsomorphicLayoutEffect'
import { loadCourses, createCourse, loadStudents as loadServerStudents, loadCourseEnrollments } from '@/lib/dataStore'

interface CourseMaterial {
  id: string
  name: string
  size: string
  uploadedAt: string
}

interface LocationInfo {
  distance: number | null
  myLat: number | null
  myLng: number | null
  exitLat: number | null
  exitLng: number | null
  venueLat: number | null
  venueLng: number | null
  entryAt: string
  exitAt: string | null
  final: string
}

interface StudentAttendance {
  id: string
  name: string
  email: string
  attendanceCount: number
  lateCount: number
  absentCount: number
  excusedCount: number
  location?: LocationInfo
}

// 위치 출석 최종 상태 라벨
function locStatusLabel(final: string): { text: string; cls: string } {
  if (final === 'accepted') return { text: '🟢 인정', cls: 'text-green-700' }
  if (final === 'present') return { text: '🔵 현장', cls: 'text-blue-700' }
  if (final === 'left') return { text: '🟠 이탈', cls: 'text-orange-700' }
  return { text: '🔴 미인정', cls: 'text-red-700' }
}

export default function CourseDetailPage() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.id as string
  const user = useStore((state) => state.user)
  const setUser = useStore((state) => state.setUser)

  const [course, setCourse] = useState<Course | null>(null)
  const [materials, setMaterials] = useState<any[]>([])
  const [students, setStudents] = useState<StudentAttendance[]>([])
  const [newMaterialName, setNewMaterialName] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [instructorName, setInstructorName] = useState('')
  const [isEditingInstructor, setIsEditingInstructor] = useState(false)
  const [notice, setNotice] = useState('')
  const [isEditingNotice, setIsEditingNotice] = useState(false)
  const [schedule, setSchedule] = useState<any[]>([])
  const [lateThreshold, setLateThreshold] = useState(10)
  const [absentThreshold, setAbsentThreshold] = useState(30)
  const [isEditingSchedule, setIsEditingSchedule] = useState(false)
  const [selectedEpisode, setSelectedEpisode] = useState(1)
  const [materialAvailableEpisode, setMaterialAvailableEpisode] = useState<number | null>(null)
  const [materialAvailableClass, setMaterialAvailableClass] = useState<number | null>(null)
  const [showQRModal, setShowQRModal] = useState(false)
  const [selectedQRClass, setSelectedQRClass] = useState<number | null>(null)
  const [activeCode, setActiveCode] = useState<string | null>(null)
  const [codeGeneratedTime, setCodeGeneratedTime] = useState<string | null>(null)
  const [activeExitCode, setActiveExitCode] = useState<string | null>(null)
  const [exitCodeGeneratedTime, setExitCodeGeneratedTime] = useState<string | null>(null)
  const [adminSubmissions, setAdminSubmissions] = useState<any[]>([])
  const [gradingId, setGradingId] = useState<string | null>(null)
  const [gradeInput, setGradeInput] = useState('')
  const [commentInput, setCommentInput] = useState('')

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

    const applyCourse = (found: Course) => {
      setCourse(found)
      setInstructorName(found.instructor)
      loadMaterials(found.id)
      loadStudents(found.id)
      loadAdminSubmissions(found.id)

      const savedNotice = localStorage.getItem(`course_notice_${found.id}`)
      if (savedNotice) setNotice(savedNotice)

      const scheduleKey = found.courseType === 'episode'
        ? `course_schedule_${found.id}_episode_1`
        : `course_schedule_${found.id}`
      const savedSchedule = localStorage.getItem(scheduleKey)
      if (savedSchedule) {
        const data = JSON.parse(savedSchedule)
        setSchedule(data.classes || [])
        setLateThreshold(data.lateThreshold || 10)
        setAbsentThreshold(data.absentThreshold || 30)
      } else {
        setSchedule([
          { number: 1, name: '1교시', startTime: '09:00', endTime: '10:00' },
          { number: 2, name: '2교시', startTime: '10:00', endTime: '11:00' },
          { number: 3, name: '3교시', startTime: '11:00', endTime: '12:00' },
        ])
      }
    }

    // 즉시: localStorage 캐시
    const savedCourses = localStorage.getItem('courses')
    if (savedCourses) {
      const found = JSON.parse(savedCourses).find((c: Course) => c.id === courseId)
      if (found) applyCourse(found)
    }
    // 권위: 서버 (다른 기기에서 만든 강의도 조회)
    ;(async () => {
      const list = await loadCourses()
      const found = list.find((c) => c.id === courseId)
      if (found) applyCourse(found)
      setLoading(false)
    })()
  }, [courseId, router, setUser])

  // 회차 변경 시 시간표 다시 로드
  useEffect(() => {
    if (!course) return

    const scheduleKey = course.courseType === 'episode'
      ? `course_schedule_${course.id}_episode_${selectedEpisode}`
      : `course_schedule_${course.id}`

    const savedSchedule = localStorage.getItem(scheduleKey)
    if (savedSchedule) {
      const data = JSON.parse(savedSchedule)
      setSchedule(data.classes || [])
      setLateThreshold(data.lateThreshold || 10)
      setAbsentThreshold(data.absentThreshold || 30)
    } else {
      setSchedule([
        { number: 1, name: '1교시', startTime: '09:00', endTime: '10:00' },
        { number: 2, name: '2교시', startTime: '10:00', endTime: '11:00' },
        { number: 3, name: '3교시', startTime: '11:00', endTime: '12:00' },
      ])
    }
  }, [selectedEpisode, course])

  const loadMaterials = (cId: string) => {
    const key = `course_materials_${cId}`
    const saved = localStorage.getItem(key)
    if (saved) {
      setMaterials(JSON.parse(saved))
    }
  }

  const loadAdminSubmissions = async (cId: string) => {
    try {
      const res = await fetch(`/api/submissions?courseId=${cId}`, { cache: 'no-store' })
      const d = await res.json()
      setAdminSubmissions(d.submissions || [])
    } catch { /* 무시 */ }
  }

  const handleGrade = async (id: string) => {
    try {
      await fetch('/api/submissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, grade: gradeInput, comment: commentInput }),
      })
      toast.success('채점 완료')
      setGradingId(null)
      setGradeInput('')
      setCommentInput('')
      if (course) loadAdminSubmissions(course.id)
    } catch {
      toast.error('채점 저장 실패')
    }
  }

  const handleDeleteSubmission = async (id: string) => {
    if (!confirm('제출 파일을 삭제하시겠습니까?')) return
    await fetch(`/api/submissions?id=${id}`, { method: 'DELETE' })
    toast.success('삭제되었습니다')
    if (course) loadAdminSubmissions(course.id)
  }

  const loadStudents = async (cId: string) => {
    try {
      const studentsMap = new Map<string, any>()
      const allKeys = Object.keys(localStorage)

      // 학생 실제 이름/이메일 (users + students 배열)
      const infoMap = new Map<string, { name: string; email: string }>()
      const usersData = localStorage.getItem('users')
      if (usersData) {
        JSON.parse(usersData).forEach((u: any) => {
          if (!u.isAdmin) infoMap.set(u.id, { name: u.name || u.id, email: u.email || '' })
        })
      }
      const studentsArr = localStorage.getItem('students')
      if (studentsArr) {
        JSON.parse(studentsArr).forEach((s: any) => {
          infoMap.set(s.id, { name: s.name || s.id, email: s.email || '' })
        })
      }

      // 서버 학생(모든 기기 가입자) 이름/이메일 합치기
      const serverStudents = await loadServerStudents()
      if (serverStudents) {
        serverStudents.forEach((s: any) => infoMap.set(s.id, { name: s.name || s.id, email: s.email || '' }))
      }

      const ensure = (userId: string) => {
        if (!studentsMap.has(userId)) {
          const info = infoMap.get(userId)
          studentsMap.set(userId, {
            id: userId,
            name: info?.name || `학생 ${userId.substring(0, 6)}`,
            email: info?.email || '',
            attendanceCount: 0,
            lateCount: 0,
            absentCount: 0,
            excusedCount: 0,
          })
        }
        return studentsMap.get(userId)
      }

      // 1. 이 강의에 "등록(수강 신청)"한 학생 → 출석 전이라도 명단에 표시
      //    (로컬 enrolled_ + 서버 수강신청 모두)
      for (const key of allKeys) {
        if (key.startsWith('enrolled_')) {
          const userId = key.slice('enrolled_'.length)
          const enrolled = JSON.parse(localStorage.getItem(key) || '[]')
          if (Array.isArray(enrolled) && enrolled.some((c: any) => c.id === cId)) {
            ensure(userId)
          }
        }
      }
      const serverEnrolled = await loadCourseEnrollments(cId)
      if (serverEnrolled) serverEnrolled.forEach((uid) => ensure(uid))

      // 2. 출석 기록이 있는 학생 → 출석/지각/결석/공가 카운트 반영
      for (const key of allKeys) {
        if (key.startsWith('attendance_') && key.endsWith(`_${cId}`)) {
          const parts = key.split('_')
          const userId = parts.slice(1, -1).join('_')
          const data = JSON.parse(localStorage.getItem(key) || '[]')
          const s = ensure(userId)
          s.attendanceCount = data.filter((r: any) => r.status === 'present').length
          s.lateCount = data.filter((r: any) => r.status === 'late').length
          s.absentCount = data.filter((r: any) => r.status === 'absent').length
          s.excusedCount = data.filter((r: any) => r.status === 'excused').length
        }
      }

      // 3. 위치 기반 출석(Supabase) → 위치 정보 + 위치 출석만 한 학생 추가
      try {
        const res = await fetch(`/api/live/course-records?courseId=${cId}`, { cache: 'no-store' })
        if (res.ok) {
          const { records } = await res.json()
          for (const r of records || []) {
            const s = ensure(r.userId)
            if (r.userName && (!s.name || s.name.startsWith('학생 '))) s.name = r.userName
            // 가장 최근 위치 출석만 표시 (records는 최신순)
            if (!s.location) {
              s.location = {
                distance: r.distance,
                myLat: r.myLat,
                myLng: r.myLng,
                exitLat: r.exitLat,
                exitLng: r.exitLng,
                venueLat: r.venueLat,
                venueLng: r.venueLng,
                entryAt: r.entryAt,
                exitAt: r.exitAt,
                final: r.final,
              }
              // 위치 출석 인정 시 출석 카운트에도 반영
              if (r.final === 'accepted' || r.final === 'present') s.attendanceCount += 1
            }
          }
        }
      } catch {
        // 위치 출석 미설정/오류여도 명단은 그대로
      }

      setStudents(Array.from(studentsMap.values()))
    } catch (error) {
      console.error('Error loading students:', error)
      setStudents([])
    }
  }

  const handleAddMaterial = async () => {
    if (!selectedFile) {
      toast.error('파일을 선택하세요')
      return
    }

    if (!course) return

    const fileSizeInMB = (selectedFile.size / (1024 * 1024)).toFixed(2)

    const reader = new FileReader()
    reader.onload = (e) => {
      const fileData = e.target?.result as string

      const newMaterial: any = {
        id: Math.random().toString(36).substr(2, 9),
        name: selectedFile.name,
        size: `${fileSizeInMB}MB`,
        uploadedAt: new Date().toLocaleDateString('ko-KR'),
        data: fileData,
        availableUntilEpisode: course.courseType === 'episode' ? materialAvailableEpisode : null,
        availableUntilClass: materialAvailableClass,
      }

      const updated = [...materials, newMaterial]
      const key = `course_materials_${course.id}`
      localStorage.setItem(key, JSON.stringify(updated))
      setMaterials(updated)

      const episodeInfo = newMaterial.availableUntilEpisode
        ? ` (${newMaterial.availableUntilEpisode}회차 ${newMaterial.availableUntilClass}교시까지 공개)`
        : ''
      toast.success(`✅ 강의 자료가 추가되었습니다${episodeInfo}`)
      setNewMaterialName('')
      setSelectedFile(null)
      setMaterialAvailableEpisode(null)
      setMaterialAvailableClass(null)
    }

    reader.readAsDataURL(selectedFile)
  }

  const handleDeleteMaterial = (id: string) => {
    if (!course) return

    const updated = materials.filter((m) => m.id !== id)
    const key = `course_materials_${course.id}`
    localStorage.setItem(key, JSON.stringify(updated))
    setMaterials(updated)
    toast.success('✅ 강의 자료가 삭제되었습니다')
  }

  const handleSaveInstructor = async () => {
    if (!course || !instructorName.trim()) {
      toast.error('강사명을 입력하세요')
      return
    }

    const updatedCourse = { ...course, instructor: instructorName }

    const savedCourses = localStorage.getItem('courses')
    if (savedCourses) {
      const courses = JSON.parse(savedCourses)
      const updated = courses.map((c: Course) => (c.id === course.id ? updatedCourse : c))
      localStorage.setItem('courses', JSON.stringify(updated))
    }
    setCourse(updatedCourse)
    await createCourse(updatedCourse) // 서버에도 반영(upsert) → 다른 기기/재조회에도 유지
    toast.success('✅ 강사명이 저장되었습니다')
    setIsEditingInstructor(false)
  }

  const handleSaveNotice = () => {
    if (!course) return

    const noticeKey = `course_notice_${course.id}`
    localStorage.setItem(noticeKey, notice)
    toast.success('✅ 공지사항이 저장되었습니다')
    setIsEditingNotice(false)
  }

  const generateAttendanceCode = () => {
    if (!course) return

    // 4자리 랜덤 코드 생성
    const newCode = Math.floor(1000 + Math.random() * 9000).toString()
    const now = new Date()
    const generatedTime = now.toLocaleTimeString('ko-KR')

    setActiveCode(newCode)
    setCodeGeneratedTime(generatedTime)

    // localStorage에 현재 활성 코드 저장
    const codeKey = `course_code_${course.id}`
    localStorage.setItem(codeKey, JSON.stringify({
      code: newCode,
      generatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 5 * 60000).toISOString(), // 5분 후 만료
    }))

    toast.success(`✅ 출석 코드 생성됨: ${newCode}\n(5분 유효)`)
  }

  const generateExitCode = () => {
    if (!course) return

    // 4자리 랜덤 코드 생성
    const newCode = Math.floor(1000 + Math.random() * 9000).toString()
    const now = new Date()
    const generatedTime = now.toLocaleTimeString('ko-KR')

    setActiveExitCode(newCode)
    setExitCodeGeneratedTime(generatedTime)

    // localStorage에 현재 활성 퇴장 코드 저장
    const exitCodeKey = `course_exit_code_${course.id}`
    localStorage.setItem(exitCodeKey, JSON.stringify({
      code: newCode,
      generatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 5 * 60000).toISOString(), // 5분 후 만료
    }))

    toast.success(`✅ 퇴장 코드 생성됨: ${newCode}\n(5분 유효)`)
  }

  const handleSaveSchedule = () => {
    if (!course || schedule.length === 0) {
      toast.error('시간표를 입력하세요')
      return
    }

    const scheduleKey = course.courseType === 'episode'
      ? `course_schedule_${course.id}_episode_${selectedEpisode}`
      : `course_schedule_${course.id}`

    localStorage.setItem(
      scheduleKey,
      JSON.stringify({
        classes: schedule,
        lateThreshold,
        absentThreshold,
      })
    )
    const episodeText = course.courseType === 'episode' ? ` - ${selectedEpisode}회차` : ''
    toast.success(`✅ 시간표가 저장되었습니다${episodeText}`)
    setIsEditingSchedule(false)
  }

  const handleAddTimeSlot = () => {
    const newSlot = {
      number: schedule.length + 1,
      name: `${schedule.length + 1}교시`,
      startTime: '09:00',
      endTime: '10:00',
      instructor: '강사 미지정',
    }
    setSchedule([...schedule, newSlot])
  }

  const handleUpdateTimeSlot = (index: number, field: string, value: string) => {
    const updated = [...schedule]
    updated[index] = { ...updated[index], [field]: value }
    setSchedule(updated)
  }

  const handleDownloadStudentExcel = () => {
    if (students.length === 0) {
      toast.error('내보낼 학생 데이터가 없습니다')
      return
    }

    const excelData = students.map((student) => ({
      학생명: student.name,
      이메일: student.email,
      출석: `${student.attendanceCount}회`,
      지각: `${student.lateCount}회`,
      총출석: `${student.attendanceCount + student.lateCount}회`,
    }))

    const ws = XLSX.utils.json_to_sheet(excelData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '수강생명단')
    XLSX.writeFile(
      wb,
      `${course?.name}_수강생명단_${new Date().toLocaleDateString('ko-KR')}.xlsx`
    )
    toast.success('✅ 엑셀 파일이 다운로드되었습니다')
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    setUser(null)
    router.push('/login')
  }

  if (loading) {
    return <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-blue-50 to-indigo-100"><div className="app-spinner" /><p className="text-gray-600 font-semibold">로딩 중...</p></div>
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-blue-50 to-indigo-100 px-4 text-center">
        <p className="text-5xl">🔍</p>
        <p className="text-xl font-bold text-gray-900">강의를 찾을 수 없습니다</p>
        <p className="text-gray-600 text-sm">이 브라우저에 해당 강의 정보가 없습니다.</p>
        <button onClick={() => router.push('/admin')} className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg">
          ← 대시보드로 돌아가기
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/admin')}
            className="text-blue-600 font-medium hover:underline flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            돌아가기
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
        {/* 강의 정보 */}
        <div className="bg-white rounded-lg shadow p-8 mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">{course.name}</h2>

          {/* 공지사항 */}
          <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-blue-900">📢 공지사항</p>
              <button
                onClick={() => setIsEditingNotice(!isEditingNotice)}
                className="text-sm text-blue-600 hover:underline"
              >
                {isEditingNotice ? '취소' : '편집'}
              </button>
            </div>
            {isEditingNotice ? (
              <div className="space-y-2">
                <textarea
                  value={notice}
                  onChange={(e) => setNotice(e.target.value)}
                  placeholder="공지사항을 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
                <button
                  onClick={handleSaveNotice}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg"
                >
                  저장
                </button>
              </div>
            ) : (
              <p className="text-gray-700">{notice || '공지사항이 없습니다'}</p>
            )}
          </div>

          {/* 출석 코드 시스템 */}
          <div className="bg-red-50 border-2 border-red-200 p-4 rounded-lg mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-red-900">🔐 출석 확인 코드</p>
            </div>
            {activeCode ? (
              <div className="bg-white p-4 rounded-lg border-2 border-red-400 mb-3">
                <p className="text-sm text-gray-600 mb-2">현재 활성 코드:</p>
                <p className="text-4xl font-bold text-red-600 text-center mb-2">{activeCode}</p>
                <p className="text-xs text-gray-500 text-center">생성: {codeGeneratedTime}</p>
                <p className="text-xs text-gray-500 text-center">(5분 유효)</p>
              </div>
            ) : (
              <p className="text-red-700 text-sm mb-3">아직 생성된 코드가 없습니다</p>
            )}
            <button
              onClick={generateAttendanceCode}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition"
            >
              🔐 새 출석 코드 생성
            </button>
          </div>

          {/* 퇴장 코드 시스템 */}
          <div className="bg-orange-50 border-2 border-orange-200 p-4 rounded-lg mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-orange-900">🚪 퇴장 확인 코드</p>
            </div>
            {activeExitCode ? (
              <div className="bg-white p-4 rounded-lg border-2 border-orange-400 mb-3">
                <p className="text-sm text-gray-600 mb-2">현재 활성 코드:</p>
                <p className="text-4xl font-bold text-orange-600 text-center mb-2">{activeExitCode}</p>
                <p className="text-xs text-gray-500 text-center">생성: {exitCodeGeneratedTime}</p>
                <p className="text-xs text-gray-500 text-center">(5분 유효)</p>
              </div>
            ) : (
              <p className="text-orange-700 text-sm mb-3">아직 생성된 코드가 없습니다</p>
            )}
            <button
              onClick={generateExitCode}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-lg transition"
            >
              🚪 새 퇴장 코드 생성
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">강사</p>
              {isEditingInstructor ? (
                <div className="space-y-2 mt-2">
                  <input
                    type="text"
                    value={instructorName}
                    onChange={(e) => setInstructorName(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={handleSaveInstructor}
                      className="flex-1 bg-green-500 text-white py-1 rounded text-xs font-medium"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => setIsEditingInstructor(false)}
                      className="flex-1 bg-gray-400 text-white py-1 rounded text-xs font-medium"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <p
                  onClick={() => setIsEditingInstructor(true)}
                  className="text-lg font-semibold text-gray-900 cursor-pointer hover:underline"
                >
                  {instructorName}
                </p>
              )}
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">수강생</p>
              <p className="text-lg font-semibold text-gray-900">{students.length}명</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">강의 자료</p>
              <p className="text-lg font-semibold text-gray-900">{materials.length}개</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">평균 출석률</p>
              <p className="text-lg font-semibold text-gray-900">
                {students.length > 0
                  ? Math.round(
                      (students.reduce((acc, s) => acc + s.attendanceCount, 0) /
                        (students.length * 4)) *
                        100
                    )
                  : 0}
                %
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 강의 자료 관리 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">📚 강의 자료 관리</h3>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📁 파일 선택
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {selectedFile && (
                    <p className="text-sm text-gray-600 mt-2">선택됨: {selectedFile.name}</p>
                  )}
                </div>

                <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg">
                  <p className="text-sm font-semibold text-indigo-900 mb-3">
                    🔒 공개 범위 설정
                  </p>
                  <div className="space-y-2">
                    {course?.courseType === 'episode' && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          공개 종료 회차
                        </label>
                        <select
                          value={materialAvailableEpisode || ''}
                          onChange={(e) => setMaterialAvailableEpisode(e.target.value ? Number(e.target.value) : null)}
                          className="w-full px-3 py-1 text-sm border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">제한 없음</option>
                          {Array.from({ length: course.episodeCount || 1 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                              {i + 1}회차
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {(!course?.courseType || course?.courseType === 'session' || materialAvailableEpisode) && (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          공개 종료 교시 {course?.courseType === 'session' ? '(특강)' : ''}
                        </label>
                        <select
                          value={materialAvailableClass || ''}
                          onChange={(e) => setMaterialAvailableClass(e.target.value ? Number(e.target.value) : null)}
                          className="w-full px-3 py-1 text-sm border border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">제한 없음</option>
                          {schedule.map((cls: any) => (
                            <option key={cls.number} value={cls.number}>
                              {cls.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <p className="text-xs text-indigo-700 mt-2">
                      {course?.courseType === 'episode'
                        ? materialAvailableEpisode
                          ? `${materialAvailableEpisode}회차 ${materialAvailableClass ? `${materialAvailableClass}교시` : ''} 까지 다운로드 가능`
                          : '모든 회차에서 다운로드 가능'
                        : materialAvailableClass
                        ? `${materialAvailableClass}교시 까지 다운로드 가능`
                        : '제한 없음'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleAddMaterial}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
                  disabled={!selectedFile}
                >
                  <Upload className="w-4 h-4" />
                  파일 업로드
                </button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {materials.length === 0 ? (
                  <p className="text-gray-500 text-center py-8 text-sm">강의 자료가 없습니다</p>
                ) : (
                  materials.map((material) => (
                    <div
                      key={material.id}
                      className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate text-sm">
                          📄 {material.name}
                        </p>
                        <p className="text-xs text-gray-500">{material.uploadedAt}</p>
                        {material.availableUntilEpisode && (
                          <p className="text-xs text-indigo-600 mt-1">
                            🔒 {material.availableUntilEpisode}회차 {material.availableUntilClass}교시까지
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteMaterial(material.id)}
                        className="ml-2 p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 수강생 명단 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">👥 수강생 명단</h3>
                {students.length > 0 && (
                  <button
                    onClick={handleDownloadStudentExcel}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition text-sm"
                  >
                    <Download className="w-4 h-4" />
                    엑셀 다운로드
                  </button>
                )}
              </div>

              {students.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>아직 이 강의에 등록한 학생이 없습니다</p>
                  <p className="text-xs text-gray-400 mt-2">
                    [학생 관리 → 수강 변경]에서 학생을 이 강의에 등록하면 명단에 표시됩니다
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">학생명</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">이메일</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-900">✅ 출석</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-900">⏰ 지각</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-900">❌ 결석</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-900">🏥 공가</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-900">📍 출석 위치</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, idx) => (
                        <tr
                          key={student.id}
                          className={`border-b border-gray-100 ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                          }`}
                        >
                          <td className="py-3 px-4 font-medium text-gray-900">{student.name}</td>
                          <td className="py-3 px-4 text-gray-600 text-sm">{student.email}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                              {student.attendanceCount}회
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                              {student.lateCount}회
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                              {student.absentCount}회
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                              {student.excusedCount}회
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {student.location ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className={`text-xs font-bold ${locStatusLabel(student.location.final).cls}`}>
                                  {locStatusLabel(student.location.final).text}
                                  {student.location.distance != null ? ` · 약 ${student.location.distance}m` : ''}
                                </span>
                                <div className="flex items-center gap-2">
                                  {student.location.myLat != null && student.location.myLng != null ? (
                                    <a
                                      href={`https://www.google.com/maps?q=${student.location.myLat},${student.location.myLng}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:underline font-medium"
                                    >
                                      🗺️ 출석
                                    </a>
                                  ) : student.location.venueLat != null && student.location.venueLng != null ? (
                                    <a
                                      href={`https://www.google.com/maps?q=${student.location.venueLat},${student.location.venueLng}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-gray-500 hover:underline"
                                    >
                                      🏫 현장
                                    </a>
                                  ) : null}
                                  {student.location.exitLat != null && student.location.exitLng != null && (
                                    <a
                                      href={`https://www.google.com/maps?q=${student.location.exitLat},${student.location.exitLng}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-green-600 hover:underline font-medium"
                                    >
                                      🚪 퇴장
                                    </a>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 시간표 관리 */}
        <div className="bg-white rounded-lg shadow p-8 mt-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900">⏰ 시간표 관리</h3>
            {!isEditingSchedule && (
              <button
                onClick={() => setIsEditingSchedule(true)}
                className="text-sm text-blue-600 hover:underline"
              >
                편집
              </button>
            )}
          </div>

          {course?.courseType === 'episode' && (
            <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-4 mb-6">
              <label className="block text-sm font-semibold text-indigo-900 mb-2">
                📚 회차 선택
              </label>
              <select
                value={selectedEpisode}
                onChange={(e) => setSelectedEpisode(Number(e.target.value))}
                disabled={isEditingSchedule}
                className="w-full px-4 py-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium disabled:opacity-50"
              >
                {Array.from({ length: course.episodeCount || 1 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}회차
                  </option>
                ))}
              </select>
              <p className="text-xs text-indigo-700 mt-2">
                {selectedEpisode}회차의 시간표를 관리합니다
              </p>
            </div>
          )}

          {isEditingSchedule ? (
            <div className="space-y-4">
              {/* 시간표 설정 */}
              <div className="space-y-4 mb-6">
                {schedule.map((timeSlot: any, index: number) => (
                  <div key={index} className="space-y-3 bg-gray-50 p-4 rounded-lg">
                    <div className="flex gap-4 items-end">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          시간대 이름
                        </label>
                        <input
                          type="text"
                          value={timeSlot.name}
                          onChange={(e) => handleUpdateTimeSlot(index, 'name', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="예: 1교시"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          시작 시간
                        </label>
                        <input
                          type="time"
                          value={timeSlot.startTime}
                          onChange={(e) => handleUpdateTimeSlot(index, 'startTime', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          종료 시간
                        </label>
                        <input
                          type="time"
                          value={timeSlot.endTime}
                          onChange={(e) => handleUpdateTimeSlot(index, 'endTime', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        강사
                      </label>
                      <input
                        type="text"
                        value={timeSlot.instructor || '강사 미지정'}
                        onChange={(e) => handleUpdateTimeSlot(index, 'instructor', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="강사명 입력"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* 임계값 설정 */}
              <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    지각 임계값 (분)
                  </label>
                  <input
                    type="number"
                    value={lateThreshold}
                    onChange={(e) => setLateThreshold(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    수업 시작 후 {lateThreshold}분 이내: 출석, 초과: 지각
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    결석 임계값 (분)
                  </label>
                  <input
                    type="number"
                    value={absentThreshold}
                    onChange={(e) => setAbsentThreshold(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    min="1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    지각 {absentThreshold}분 이상: 결석
                  </p>
                </div>
              </div>

              {/* 버튼들 */}
              <div className="flex gap-2">
                <button
                  onClick={handleAddTimeSlot}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg"
                >
                  + 시간대 추가
                </button>
                <button
                  onClick={handleSaveSchedule}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg"
                >
                  저장
                </button>
                <button
                  onClick={() => setIsEditingSchedule(false)}
                  className="flex-1 bg-gray-400 hover:bg-gray-500 text-white font-bold py-2 rounded-lg"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {schedule.length === 0 ? (
                <p className="text-gray-500 text-center py-8">설정된 시간표가 없습니다</p>
              ) : (
                <>
                  <div className="space-y-2">
                    {schedule.map((timeSlot: any) => (
                      <div key={timeSlot.number} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{timeSlot.name}</p>
                          <p className="text-sm text-gray-600">
                            {timeSlot.startTime} ~ {timeSlot.endTime}
                          </p>
                          <p className="text-xs text-blue-600 mt-1">
                            👨‍🏫 {timeSlot.instructor || '강사 미지정'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mt-4">
                    <p className="text-sm font-medium text-blue-900">
                      ⏱️ 지각 임계값: {lateThreshold}분 | 결석 임계값: {absentThreshold}분
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ===== 제출된 과제 ===== */}
        <div className="bg-white rounded-lg shadow p-8 mt-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-6 h-6 text-indigo-600" /> 제출된 과제 ({adminSubmissions.length}건)
            </h3>
            <button onClick={() => course && loadAdminSubmissions(course.id)} className="p-2 hover:bg-gray-100 rounded-lg">
              <RefreshCw className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {adminSubmissions.length === 0 ? (
            <p className="text-center text-gray-400 py-10">아직 제출된 과제가 없습니다</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="text-left py-3 pr-4">학생</th>
                    <th className="text-left py-3 pr-4">파일명</th>
                    <th className="text-left py-3 pr-4">크기</th>
                    <th className="text-left py-3 pr-4">제출일시</th>
                    <th className="text-left py-3 pr-4">채점</th>
                    <th className="py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {adminSubmissions.map((s) => (
                    <>
                      <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 pr-4 font-semibold text-gray-900">{s.user_name || s.user_id}</td>
                        <td className="py-3 pr-4 text-gray-700 max-w-[200px] truncate">{s.file_name}</td>
                        <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">
                          {s.file_size ? `${(s.file_size / 1024).toFixed(1)} KB` : '-'}
                        </td>
                        <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">
                          {new Date(s.submitted_at).toLocaleString('ko-KR')}
                        </td>
                        <td className="py-3 pr-4">
                          {s.grade ? (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">{s.grade}</span>
                          ) : (
                            <span className="text-gray-300 text-xs">미채점</span>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-1">
                            <a
                              href={`/api/submissions/download?id=${s.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 hover:bg-indigo-100 text-indigo-600 rounded-lg"
                              title="다운로드"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => { setGradingId(s.id); setGradeInput(s.grade || ''); setCommentInput(s.comment || '') }}
                              className="p-1.5 hover:bg-yellow-100 text-yellow-600 rounded-lg text-xs font-bold"
                              title="채점"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteSubmission(s.id)}
                              className="p-1.5 hover:bg-red-100 text-red-500 rounded-lg"
                              title="삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {gradingId === s.id && (
                        <tr key={`grade-${s.id}`} className="border-b border-indigo-100 bg-indigo-50">
                          <td colSpan={6} className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <input
                                value={gradeInput}
                                onChange={(e) => setGradeInput(e.target.value)}
                                placeholder="점수/등급 (예: A, 95점)"
                                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-40 text-gray-900 font-semibold"
                              />
                              <input
                                value={commentInput}
                                onChange={(e) => setCommentInput(e.target.value)}
                                placeholder="피드백 (선택)"
                                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900"
                              />
                              <button
                                onClick={() => handleGrade(s.id)}
                                className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700"
                              >
                                저장
                              </button>
                              <button
                                onClick={() => setGradingId(null)}
                                className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
                              >
                                취소
                              </button>
                            </div>
                            {s.comment && <p className="text-xs text-gray-500 mt-1">현재 피드백: {s.comment}</p>}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* QR코드 출석 */}
        <div className="bg-white rounded-lg shadow p-8 mt-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">📱 QR코드 출석</h3>

          <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-6">
            <p className="text-gray-700 mb-4">
              강의 시작 시 학생들이 스캔할 수 있는 QR코드를 생성합니다.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {course?.courseType === 'episode' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    회차 선택
                  </label>
                  <select
                    value={selectedEpisode}
                    onChange={(e) => setSelectedEpisode(Number(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  >
                    {Array.from({ length: course.episodeCount || 1 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}회차
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  교시 선택
                </label>
                <select
                  value={selectedQRClass || ''}
                  onChange={(e) => setSelectedQRClass(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">선택하세요</option>
                  {schedule.map((cls: any) => (
                    <option key={cls.number} value={cls.number}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => selectedQRClass && setShowQRModal(true)}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
              disabled={!selectedQRClass}
            >
              <QrCode className="w-5 h-5" />
              QR코드 생성
            </button>
          </div>

          {/* QR코드 모달 */}
          {showQRModal && selectedQRClass && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-900">📱 QR코드 출석</h3>
                  <button
                    onClick={() => setShowQRModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="bg-gray-50 rounded-lg p-6 mb-4">
                  <p className="text-sm text-gray-600 mb-4">
                    {course?.courseType === 'episode'
                      ? `${selectedEpisode}회차 ${schedule.find((c: any) => c.number === selectedQRClass)?.name}`
                      : schedule.find((c: any) => c.number === selectedQRClass)?.name}
                  </p>

                  <div className="flex justify-center">
                    <QRCodeSVG
                      value={`${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/attend?courseId=${course?.id}&episode=${selectedEpisode}&class=${selectedQRClass}&token=${Date.now()}`}
                      size={256}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                </div>

                <p className="text-xs text-gray-500 text-center mb-4">
                  학생들이 이 QR코드를 스캔하면 자동 출석됩니다
                </p>

                <button
                  onClick={() => setShowQRModal(false)}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 rounded-lg"
                >
                  닫기
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
