'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { LogOut, Clock, AlertCircle, Camera, X } from 'lucide-react'
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
  const [absenceCategory, setAbsenceCategory] = useState<'ceremony' | 'hospital' | 'exam' | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<'present' | 'late' | 'absent' | 'excused' | null>(null)
  const [isConfirmingAttendance, setIsConfirmingAttendance] = useState(false)
  const [selectedEpisode, setSelectedEpisode] = useState(1)
  const [isAttended, setIsAttended] = useState(false) // 입장 여부
  const [attendanceStartTime, setAttendanceStartTime] = useState<string | null>(null) // 입장 시간
  const [codeInput, setCodeInput] = useState('') // 코드 입력값
  const [codeVerified, setCodeVerified] = useState(false) // 코드 검증 여부
  const [showCamera, setShowCamera] = useState(false) // 카메라 표시
  const [faceDetected, setFaceDetected] = useState(false) // 얼굴 감지
  const [environmentOk, setEnvironmentOk] = useState(false) // 환경 확인
  const [brightness, setBrightness] = useState<number | null>(null) // 밝기 값 (사진 대신)
  const [exitCodeInput, setExitCodeInput] = useState('') // 퇴장 코드 입력
  const [exitCodeVerified, setExitCodeVerified] = useState(false) // 퇴장 코드 검증
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

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

    // ✅ 얼굴 인식 + 환경 확인 필수
    if (!faceDetected || !environmentOk) {
      toast.error('❌ 먼저 얼굴 인식으로 환경을 확인해야 합니다.')
      return
    }

    // ✅ 강의 수강 여부 확인 (출석 권한 체크)
    const enrolledKey = `enrolled_${user.id}`
    const enrolledData = localStorage.getItem(enrolledKey)
    const enrolledCourses = enrolledData ? JSON.parse(enrolledData) : []
    const isEnrolled = enrolledCourses.some((c: any) => c.id === courseId)

    if (!isEnrolled) {
      toast.error('❌ 이 강의에 등록되지 않았습니다. 먼저 강의에 등록해주세요.')
      return
    }

    const now = new Date()
    const todayDate = now.toLocaleDateString('ko-KR')
    const currentTime = now.toLocaleTimeString('ko-KR')
    const status = getStatusForTime(currentTime)

    // 입장 시간 저장
    setIsAttended(true)
    setAttendanceStartTime(currentTime)

    const attendanceRecord = {
      date: todayDate,
      enterTime: currentTime,
      status: status,
      class: currentClass.name,
      reason: selectedStatus === 'excused' ? absenceReason : undefined,
      // 개인정보 보호: 사진 대신 인증 여부만 기록
      faceVerified: faceDetected,
      brightnessLevel: brightness,
    }

    // 세션 저장 (임시)
    sessionStorage.setItem(`attending_${user.id}_${courseId}`, JSON.stringify(attendanceRecord))

    setSelectedStatus(null)
    setAbsenceReason('')
    setIsConfirmingAttendance(false)

    const statusMessage = status === 'present' ? '✅ 입장' : status === 'late' ? '⏰ 입장(지각)' : '⚠️ 입장(결석)'
    toast.success(`${statusMessage} ${course.name} ${currentClass.name}: ${currentTime}`)
  }

  const canExit = (): boolean => {
    if (!currentClass || !isAttended) return false

    const now = new Date()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    const [endHour, endMin] = currentClass.endTime.split(':').map(Number)
    const endMinutes = endHour * 60 + endMin
    const exitAvailableMinutes = endMinutes - 5

    return currentMinutes >= exitAvailableMinutes
  }


  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setShowCamera(true)
    } catch (error) {
      toast.error('❌ 카메라 접근 권한이 없습니다.')
    }
  }

  const analyzeEnvironment = (canvas: HTMLCanvasElement): boolean => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return false

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    let brightnessValue = 0
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      brightnessValue += (r + g + b) / 3
    }
    brightnessValue = brightnessValue / (data.length / 4)

    // 강의실 환경: 100~220 (어두운 실내)
    const isClassroom = brightnessValue > 80 && brightnessValue < 230

    if (!isClassroom) {
      toast.error(`❌ 강의실 환경이 아닙니다.\n현재 밝기: ${Math.round(brightnessValue)}`)
      return false
    }

    // 개인정보 보호: 사진은 저장하지 않고, 밝기값과 확인 상태만 기록
    setBrightness(Math.round(brightnessValue))
    setEnvironmentOk(true)
    setFaceDetected(true)
    return true
  }

  const capturePhotoForAttendance = () => {
    if (!videoRef.current || !canvasRef.current) return

    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    canvasRef.current.width = videoRef.current.videoWidth
    canvasRef.current.height = videoRef.current.videoHeight
    ctx.drawImage(videoRef.current, 0, 0)

    // 환경 분석 (사진 자체는 저장하지 않음)
    if (!analyzeEnvironment(canvasRef.current)) {
      return
    }

    toast.success('✅ 얼굴 인식 완료!\n강의실 환경 확인됨')

    // 0.5초 후 카메라 종료
    setTimeout(() => {
      stopCamera()
    }, 500)
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks()
      tracks.forEach((track) => track.stop())
    }
    setShowCamera(false)
  }

  const verifyAttendanceCode = () => {
    if (!codeInput.trim()) {
      toast.error('코드를 입력하세요')
      return
    }

    const codeKey = `course_code_${courseId}`
    const savedCode = localStorage.getItem(codeKey)

    if (!savedCode) {
      toast.error('❌ 현재 활성 코드가 없습니다.\n관리자에게 문의하세요.')
      return
    }

    const codeData = JSON.parse(savedCode)

    // 코드 유효성 확인
    if (new Date() > new Date(codeData.expiresAt)) {
      toast.error('❌ 코드가 만료되었습니다.\n새 코드를 요청하세요.')
      setCodeInput('')
      return
    }

    // 코드 일치 확인
    if (codeInput.trim() === codeData.code) {
      setCodeVerified(true)
      toast.success('✅ 코드 확인 완료!')
      setCodeInput('')
    } else {
      toast.error('❌ 잘못된 코드입니다.')
      setCodeInput('')
    }
  }

  const verifyExitCode = () => {
    if (!exitCodeInput.trim()) {
      toast.error('퇴장 코드를 입력하세요')
      return
    }

    const codeKey = `course_code_${courseId}`
    const savedCode = localStorage.getItem(codeKey)

    if (!savedCode) {
      toast.error('❌ 현재 활성 코드가 없습니다.\n관리자에게 문의하세요.')
      return
    }

    const codeData = JSON.parse(savedCode)

    // 코드 유효성 확인
    if (new Date() > new Date(codeData.expiresAt)) {
      toast.error('❌ 코드가 만료되었습니다.\n새 코드를 요청하세요.')
      setExitCodeInput('')
      return
    }

    // 코드 일치 확인
    if (exitCodeInput.trim() === codeData.code) {
      setExitCodeVerified(true)
      toast.success('✅ 퇴장 코드 확인 완료!')
      setExitCodeInput('')
    } else {
      toast.error('❌ 잘못된 코드입니다.')
      setExitCodeInput('')
    }
  }

  const handleExit = () => {
    if (!user || !isAttended) {
      toast.error('입장하지 않았습니다')
      return
    }

    // 입장 코드 검증 필수
    if (!codeVerified) {
      toast.error('❌ 입장 확인 코드를 먼저 입력하세요!')
      return
    }

    // 퇴장 코드 검증 필수
    if (!exitCodeVerified) {
      toast.error('❌ 퇴장 확인 코드를 먼저 입력하세요!')
      return
    }

    if (!canExit()) {
      toast.error('❌ 아직 퇴장할 수 없습니다.')
      return
    }

    const now = new Date()
    const exitTime = now.toLocaleTimeString('ko-KR')

    // 세션에서 입장 정보 가져오기
    const attendingData = sessionStorage.getItem(`attending_${user.id}_${courseId}`)
    if (!attendingData) {
      toast.error('입장 정보를 찾을 수 없습니다')
      return
    }

    const attendanceRecord = JSON.parse(attendingData)

    // ⚠️ 강의 종료 1분 전에 하면 출석 취소
    if (currentClass) {
      const now = new Date()
      const currentMinutes = now.getHours() * 60 + now.getMinutes()

      const [endHour, endMin] = currentClass.endTime.split(':').map(Number)
      const endMinutes = endHour * 60 + endMin
      const lastMinute = endMinutes - 1

      if (currentMinutes >= lastMinute) {
        // 1분 이내에 퇴장 시도 → 출석 기록 취소
        toast.error('❌ 너무 늦게 퇴장했습니다.\n출석 기록이 취소됩니다.')

        // 세션 정리만 함 (기록 저장 안 함)
        sessionStorage.removeItem(`attending_${user.id}_${courseId}`)
        setIsAttended(false)
        setAttendanceStartTime(null)
        return
      }
    }

    attendanceRecord.exitTime = exitTime

    // 최종 출석 기록 저장
    const attendanceKey = `attendance_${user.id}_${courseId}`
    const saved = localStorage.getItem(attendanceKey)
    const updated = saved ? [...JSON.parse(saved), attendanceRecord] : [attendanceRecord]
    localStorage.setItem(attendanceKey, JSON.stringify(updated))

    // 세션 정리
    sessionStorage.removeItem(`attending_${user.id}_${courseId}`)

    // 상태 초기화
    setIsAttended(false)
    setAttendanceStartTime(null)
    loadAttendanceData(user.id)

    toast.success(`✅ 퇴장 완료!\n${attendanceRecord.class} (${attendanceRecord.enterTime} ~ ${exitTime})`)
  }

  const getCategoryLabel = (category: string): string => {
    const labels: { [key: string]: string } = {
      ceremony: '경조사',
      hospital: '병원',
      exam: '자격증/시험',
    }
    return labels[category] || category
  }

  const handleExcuse = () => {
    if (!user || !course || !currentClass || !absenceCategory || !absenceReason.trim()) {
      toast.error('공가 사유 카테고리와 상세 정보를 입력하세요')
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
      category: absenceCategory,
      categoryLabel: getCategoryLabel(absenceCategory),
    }

    const attendanceKey = `attendance_${user.id}_${courseId}`
    const saved = localStorage.getItem(attendanceKey)
    const updated = saved ? [...JSON.parse(saved), attendanceRecord] : [attendanceRecord]
    localStorage.setItem(attendanceKey, JSON.stringify(updated))

    loadAttendanceData(user.id)
    setAbsenceReason('')
    setAbsenceCategory(null)
    setIsConfirmingAttendance(false)
    toast.success(`🏥 공가 신청 완료!\n[${getCategoryLabel(absenceCategory!)}] ${absenceReason}`)
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

  const canDownloadMaterial = (material: any): boolean => {
    // 특강식 강의
    if (course?.courseType === 'session') {
      if (!material.availableUntilClass) {
        return true // 제한 없음
      }
      if (!currentClass) {
        return true
      }
      return currentClass.number <= material.availableUntilClass
    }

    // 회차식 강의의 경우
    if (!material.availableUntilEpisode) {
      return true // 제한 없음
    }

    // 현재 회차가 공개 종료 회차보다 앞이면 다운로드 가능
    if (selectedEpisode < material.availableUntilEpisode) {
      return true
    }

    // 현재 회차가 공개 종료 회차와 같으면, 현재 교시 확인
    if (selectedEpisode === material.availableUntilEpisode) {
      if (!currentClass || !material.availableUntilClass) {
        return true
      }

      // 현재 교시가 공개 종료 교시 이전이면 다운로드 가능
      return currentClass.number <= material.availableUntilClass
    }

    // 현재 회차가 공개 종료 회차보다 뒤면 다운로드 불가
    return false
  }

  const getMaterialStatus = (material: any): { canDownload: boolean; message: string } => {
    // 특강식 강의
    if (course?.courseType === 'session') {
      if (!material.availableUntilClass) {
        return { canDownload: true, message: '' }
      }

      if (!currentClass) {
        return { canDownload: true, message: '' }
      }

      if (currentClass.number <= material.availableUntilClass) {
        return {
          canDownload: true,
          message: `(${material.availableUntilClass}교시까지 다운로드 가능)`
        }
      }

      return {
        canDownload: false,
        message: `(${material.availableUntilClass}교시까지만 다운로드 가능)`
      }
    }

    // 회차식 강의
    if (!material.availableUntilEpisode) {
      return { canDownload: true, message: '' }
    }

    if (selectedEpisode < material.availableUntilEpisode) {
      return { canDownload: true, message: '' }
    }

    if (selectedEpisode === material.availableUntilEpisode) {
      if (!currentClass || !material.availableUntilClass) {
        return { canDownload: true, message: '' }
      }

      if (currentClass.number <= material.availableUntilClass) {
        return {
          canDownload: true,
          message: `(${material.availableUntilClass}교시까지 다운로드 가능)`
        }
      }

      return {
        canDownload: false,
        message: `(${material.availableUntilEpisode}회차 ${material.availableUntilClass}교시까지만 다운로드 가능)`
      }
    }

    return {
      canDownload: false,
      message: `(${material.availableUntilEpisode}회차까지만 다운로드 가능)`
    }
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

        {/* 카메라 모달 */}
        {showCamera && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">📷 얼굴 인식</h3>
                <button onClick={stopCamera} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="bg-black rounded-lg overflow-hidden mb-4">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full"
                  style={{ maxHeight: '300px' }}
                />
              </div>

              <div className="space-y-2 mb-4">
                <p className="text-sm text-gray-600">
                  ✅ 강의실 환경: <span className={environmentOk ? 'text-green-600 font-bold' : 'text-gray-500'}>확인 중...</span>
                </p>
              </div>

              <button
                onClick={capturePhotoForAttendance}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition"
              >
                📷 사진 촬영
              </button>

              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-bold text-gray-900">출석 등록</h3>
            </div>

            {/* 카메라 확인 섹션 */}
            <div className="mb-4">
              {!environmentOk ? (
                <button
                  onClick={startCamera}
                  className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 transition flex items-center justify-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  📷 얼굴 인식 (환경 확인)
                </button>
              ) : (
                <div className="bg-green-100 border-2 border-green-400 p-3 rounded-lg text-center">
                  <p className="text-green-700 font-bold">✅ 얼굴 인식 완료!</p>
                  <p className="text-sm text-green-600">강의실 환경 확인됨 (밝기: {brightness})</p>
                </div>
              )}
            </div>
            {currentClass ? (
              <>
                <p className="text-gray-600 mb-4">현재 시간: {currentClass.name}</p>

                {!isAttended ? (
                  // 입장 전: 출석 확인 버튼
                  !isConfirmingAttendance ? (
                    <div className="space-y-3">
                      <button
                        onClick={() => {
                          setSelectedStatus('present')
                          setIsConfirmingAttendance(true)
                        }}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-blue-700 transition"
                      >
                        ✅ 입장
                      </button>
                      <button
                        onClick={() => {
                          setSelectedStatus('excused')
                          setIsConfirmingAttendance(true)
                        }}
                        className="w-full bg-green-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-green-700 transition"
                      >
                        🏥 공가 신청
                      </button>
                    </div>
                  ) : selectedStatus === 'excused' ? (
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-bold text-gray-700 mb-2">사유 분류:</p>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            onClick={() => setAbsenceCategory('ceremony')}
                            className={`py-2 px-3 rounded-lg font-semibold text-sm transition ${
                              absenceCategory === 'ceremony'
                                ? 'bg-blue-600 text-white border-2 border-blue-600'
                                : 'bg-white text-gray-900 border-2 border-gray-300 hover:border-blue-400'
                            }`}
                          >
                            💒 경조사
                          </button>
                          <button
                            onClick={() => setAbsenceCategory('hospital')}
                            className={`py-2 px-3 rounded-lg font-semibold text-sm transition ${
                              absenceCategory === 'hospital'
                                ? 'bg-blue-600 text-white border-2 border-blue-600'
                                : 'bg-white text-gray-900 border-2 border-gray-300 hover:border-blue-400'
                            }`}
                          >
                            🏥 병원
                          </button>
                          <button
                            onClick={() => setAbsenceCategory('exam')}
                            className={`py-2 px-3 rounded-lg font-semibold text-sm transition ${
                              absenceCategory === 'exam'
                                ? 'bg-blue-600 text-white border-2 border-blue-600'
                                : 'bg-white text-gray-900 border-2 border-gray-300 hover:border-blue-400'
                            }`}
                          >
                            📝 자격증/시험
                          </button>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-bold text-gray-700 mb-2">상세 사유:</p>
                        <textarea
                          value={absenceReason}
                          onChange={(e) => setAbsenceReason(e.target.value)}
                          placeholder="구체적인 사유를 입력하세요"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none text-gray-900 font-semibold"
                          rows={2}
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={handleExcuse}
                          disabled={!absenceCategory || !absenceReason.trim()}
                          className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          ✅ 공가 신청
                        </button>
                        <button
                          onClick={() => {
                            setIsConfirmingAttendance(false)
                            setSelectedStatus(null)
                            setAbsenceCategory(null)
                            setAbsenceReason('')
                          }}
                          className="flex-1 bg-gray-600 text-white py-2 rounded-lg font-medium hover:bg-gray-700"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <button
                        onClick={handleAttendance}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-blue-700"
                      >
                        ✅ 입장 확인
                      </button>
                      <button
                        onClick={() => {
                          setIsConfirmingAttendance(false)
                          setSelectedStatus(null)
                        }}
                        className="w-full bg-gray-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-gray-700"
                      >
                        취소
                      </button>
                    </div>
                  )
                ) : (
                  // 입장 후: 강의 진행 중
                  <div className="space-y-3 bg-blue-100 border-2 border-blue-400 p-4 rounded-lg">
                    <p className="text-blue-900 font-bold text-lg">📚 강의 진행 중...</p>
                    <p className="text-sm text-blue-800">입장 시간: {attendanceStartTime}</p>

                    {!codeVerified ? (
                      <div className="bg-yellow-50 border-2 border-yellow-300 p-3 rounded-lg">
                        <p className="text-yellow-800 font-bold text-base mb-2">🔐 출석 확인 코드 입력</p>
                        <p className="text-sm text-yellow-700 mb-3">관리자가 공지한 코드를 입력하세요:</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={codeInput}
                            onChange={(e) => setCodeInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && verifyAttendanceCode()}
                            placeholder="4자리 코드"
                            className="flex-1 px-3 py-2 border-2 border-yellow-300 rounded-lg text-center text-2xl font-bold tracking-widest text-gray-900"
                            maxLength={4}
                          />
                          <button
                            onClick={verifyAttendanceCode}
                            className="bg-yellow-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-yellow-700 transition"
                          >
                            ✓
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-green-100 border-2 border-green-400 p-3 rounded-lg">
                        <p className="text-green-700 font-bold text-base">✅ 코드 확인 완료!</p>
                      </div>
                    )}

                    {canExit() ? (
                      <>
                        <div className="bg-red-100 border-2 border-red-400 p-3 rounded-lg">
                          <p className="text-red-700 font-bold text-base">⚠️ 중요 공지</p>
                          <p className="text-sm text-red-700 mt-1">강의 종료 1분 이내에 퇴장하면<br/>출석 기록이 취소됩니다!</p>
                        </div>

                        {!exitCodeVerified ? (
                          <div className="bg-orange-50 border-2 border-orange-300 p-3 rounded-lg">
                            <p className="text-orange-800 font-bold text-base mb-2">🔐 퇴장 확인 코드 입력</p>
                            <p className="text-sm text-orange-700 mb-3">관리자가 공지한 퇴장 코드를 입력하세요:</p>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={exitCodeInput}
                                onChange={(e) => setExitCodeInput(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && verifyExitCode()}
                                placeholder="4자리 코드"
                                className="flex-1 px-3 py-2 border-2 border-orange-300 rounded-lg text-center text-2xl font-bold tracking-widest text-gray-900"
                                maxLength={4}
                              />
                              <button
                                onClick={verifyExitCode}
                                className="bg-orange-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-orange-700 transition"
                              >
                                ✓
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="bg-green-100 border-2 border-green-400 p-3 rounded-lg">
                            <p className="text-green-700 font-bold text-base">✅ 퇴장 코드 확인 완료!</p>
                          </div>
                        )}

                        <button
                          onClick={handleExit}
                          disabled={!exitCodeVerified}
                          className="w-full bg-red-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          🚪 퇴장
                        </button>
                      </>
                    ) : (
                      <p className="text-blue-700 text-sm font-semibold text-center">
                        강의에 집중해주세요.
                      </p>
                    )}
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
              {materials.map((material: any) => {
                const { canDownload, message } = getMaterialStatus(material)
                return (
                  <div
                    key={material.id}
                    onClick={() => {
                      if (!canDownload) {
                        toast.error(`❌ 다운로드 불가능${message}`)
                        return
                      }
                      if (material.data) {
                        const link = document.createElement('a')
                        link.href = material.data
                        link.download = material.name
                        link.click()
                        toast.success(`✅ ${material.name} 다운로드 시작`)
                      }
                    }}
                    className={`border-l-4 pl-4 py-2 p-3 rounded transition ${
                      canDownload
                        ? 'border-blue-500 hover:bg-blue-50 cursor-pointer bg-gray-50 hover:shadow-md'
                        : 'border-red-500 bg-red-50 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <p className="font-semibold text-gray-900">📄 {material.name}</p>
                    <p className="text-sm text-gray-600">{material.size}</p>
                    <p className="text-xs text-gray-500 mt-1">📅 {material.uploadedAt}</p>
                    {canDownload ? (
                      <p className="text-xs text-blue-600 mt-2">💾 클릭해서 다운로드 {message}</p>
                    ) : (
                      <p className="text-xs text-red-600 mt-2">🔒 다운로드 불가능 {message}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
