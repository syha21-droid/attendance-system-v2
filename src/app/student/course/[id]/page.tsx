'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { LogOut, Clock, AlertCircle, Camera, X } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { supabase } from '@/lib/supabase'
import { Course } from '@/types'
import { syncTrustedTime, getTrustedNow, getClockSkewSeconds } from '@/lib/trustedTime'

// 수강 완료 기준 (와서 끝까지 들어야 출석 인정)
const COMPLETION_THRESHOLD = 0.8        // 입장~종료 시간의 80% 이상 실제 수강해야 출석 인정
const CHECK_RESPONSE_WINDOW_MS = 90_000 // 집중 확인(랜덤) 응답 제한 시간: 90초
const MAX_MISSED_CHECKS = 1             // 허용 미응답 횟수 (초과 시 출석 불인정)
const AVG_CHECK_INTERVAL_MS = 12 * 60_000 // 평균 12분마다 랜덤 집중 확인

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
  const [monitorDetected, setMonitorDetected] = useState<boolean>(false) // 모니터 감지
  const [exitCodeInput, setExitCodeInput] = useState('') // 퇴장 코드 입력
  const [exitCodeVerified, setExitCodeVerified] = useState(false) // 퇴장 코드 검증
  const [isOnline] = useState<boolean>(false) // 항상 오프라인(강의실)
  const [timeTrusted, setTimeTrusted] = useState(false) // 서버 시간 동기화 여부
  const [clockTampered, setClockTampered] = useState(false) // 기기 시계 조작 감지
  // 수강 완료 추적
  const [presentSeconds, setPresentSeconds] = useState(0) // 실제 수강(집중) 시간
  const [awaySeconds, setAwaySeconds] = useState(0) // 자리 비움 시간
  const [pendingCheck, setPendingCheck] = useState(false) // 랜덤 집중 확인 진행 중
  const [missedChecks, setMissedChecks] = useState(0) // 집중 확인 미응답 횟수
  const [checkCycle, setCheckCycle] = useState(0) // 다음 확인 스케줄 트리거
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const confirmIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const streamRef = useRef<MediaStream | null>(null) // 카메라 스트림 보관
  // 수강 시간 정밀 측정용 ref (리렌더 영향 없이 누적)
  const presentMsRef = useRef(0)
  const awayMsRef = useRef(0)
  const segmentStartRef = useRef(0)
  const isHereRef = useRef(true)
  const entryTsRef = useRef(0)
  const missedChecksRef = useRef(0)

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

  // 서버 시간 동기화 (기기 시계 조작 방지)
  useEffect(() => {
    let active = true

    const doSync = async () => {
      const ok = await syncTrustedTime()
      if (!active) return
      setTimeTrusted(ok)
      if (ok) {
        // 로컬 시계와 서버 시계가 2분 이상 벌어지면 조작으로 간주
        setClockTampered(Math.abs(getClockSkewSeconds()) > 120)
      }
    }

    doSync()
    const interval = setInterval(doSync, 60_000) // 1분마다 재동기화
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

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
      monitorDetected: monitorDetected,
    }

    // 세션 저장 (임시)
    sessionStorage.setItem(`attending_${user.id}_${courseId}`, JSON.stringify(attendanceRecord))

    setSelectedStatus(null)
    setAbsenceReason('')
    setIsConfirmingAttendance(false)

    const statusMessage = status === 'present' ? '✅ 입장' : status === 'late' ? '⏰ 입장(지각)' : '⚠️ 입장(결석)'
    toast.success(`${statusMessage} ${course.name} ${currentClass.name}: ${currentTime}\n끝까지 수강해야 출석으로 인정됩니다.`)

    // 수강 완료 추적 시작 (와서 끝까지 들어야 출석 인정)
    startWatchTracking()
  }

  const canExit = (): boolean => {
    if (!currentClass || !isAttended) return false

    // 기기 시계 조작이 감지되면 퇴장 불가
    if (clockTampered) return false

    // 신뢰 시간(서버 보정) 기준으로 판정 → 기기 시계를 돌려도 소용없음
    const now = getTrustedNow()
    const currentMinutes = now.getHours() * 60 + now.getMinutes()

    const [endHour, endMin] = currentClass.endTime.split(':').map(Number)
    const endMinutes = endHour * 60 + endMin

    // 강의 정확히 끝났을 때만 퇴장 가능
    return currentMinutes >= endMinutes
  }


  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })
      // 스트림을 ref에 보관하고 모달을 연다. (모달이 열린 뒤 video 요소에 연결됨)
      streamRef.current = stream
      setShowCamera(true)
    } catch (error) {
      console.error('camera error', error)
      toast.error('❌ 카메라를 켤 수 없습니다.\n브라우저 카메라 권한을 허용해주세요.')
    }
  }

  const detectMonitorInImage = (imageData: ImageData): boolean => {
    const data = imageData.data
    const pixelCount = data.length / 4

    // 1. 밝은 픽셀 비율 계산 (모니터는 밝음)
    let brightPixelCount = 0
    let brightPixelRedSum = 0
    let brightPixelGreenSum = 0
    let brightPixelBlueSum = 0

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const brightness = (r + g + b) / 3

      // 밝기가 170 이상인 픽셀 (모니터 특징)
      if (brightness >= 170) {
        brightPixelCount++
        brightPixelRedSum += r
        brightPixelGreenSum += g
        brightPixelBlueSum += b
      }
    }

    const brightPixelRatio = brightPixelCount / pixelCount

    // 2. 모니터 영역이 충분히 있는지 (전체의 15% 이상)
    const hasEnoughBrightArea = brightPixelRatio > 0.15

    // 3. 밝은 영역에 색상 다양성이 있는지 (강의 화면)
    if (brightPixelCount > 0) {
      const avgBrightRed = brightPixelRedSum / brightPixelCount
      const avgBrightGreen = brightPixelGreenSum / brightPixelCount
      const avgBrightBlue = brightPixelBlueSum / brightPixelCount

      const colorVariance = Math.abs(avgBrightRed - avgBrightGreen) +
                           Math.abs(avgBrightGreen - avgBrightBlue) +
                           Math.abs(avgBrightRed - avgBrightBlue)

      // 색상이 어느정도 다양해야 함 (단순 흰색 배경 아님)
      const hasColorVariance = colorVariance > 10

      return hasEnoughBrightArea && hasColorVariance
    }

    return false
  }

  const analyzeEnvironment = (canvas: HTMLCanvasElement): boolean => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return false

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    // 1. 밝기 분석
    let brightnessValue = 0
    let redSum = 0, greenSum = 0, blueSum = 0
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      brightnessValue += (r + g + b) / 3
      redSum += r
      greenSum += g
      blueSum += b
    }
    const pixelCount = data.length / 4
    brightnessValue = brightnessValue / pixelCount
    const avgRed = redSum / pixelCount
    const avgGreen = greenSum / pixelCount
    const avgBlue = blueSum / pixelCount

    // 2. 모니터 감지 (참고용)
    const hasMonitor = detectMonitorInImage(imageData)
    setMonitorDetected(hasMonitor)

    // 색상 다양성 (단색 화면/가려진 렌즈 = 변화 없음)
    const colorVariance = Math.abs(avgRed - avgGreen) + Math.abs(avgGreen - avgBlue) + Math.abs(avgRed - avgBlue)

    // 명암 변화량 (실제 카메라 영상은 픽셀마다 변화가 있음)
    let variation = 0
    for (let i = 0; i < data.length - 4; i += 4) {
      variation += Math.abs(data[i] - data[i + 4])
    }
    const avgVariation = variation / (pixelCount || 1)

    // ✅ 실제로 카메라가 켜져 있고 화면이 보이는지만 확인 (정상 환경은 거의 다 통과)
    const isTooDark = brightnessValue < 20       // 렌즈 가림 / 카메라 꺼짐 (완전 검정)
    const isFrozen = avgVariation < 2 && colorVariance < 3 // 변화 없는 단색 = 가짜/정지화면

    if (isTooDark) {
      toast.error('❌ 화면이 너무 어둡습니다.\n카메라 렌즈를 가리지 말고 밝은 곳에서 다시 시도하세요.')
      return false
    }
    if (isFrozen) {
      toast.error('❌ 카메라 영상이 감지되지 않습니다.\n카메라가 정상 작동하는지 확인하세요.')
      return false
    }

    setBrightness(Math.round(brightnessValue))
    setEnvironmentOk(true)
    setFaceDetected(true)

    if (hasMonitor) {
      toast.success('✅ 환경 확인 완료!\n📺 화면 감지됨')
    } else {
      toast.success('✅ 환경 확인 완료!')
    }

    return true
  }

  const capturePhotoForAttendance = () => {
    if (!videoRef.current || !canvasRef.current) return

    // 카메라 영상이 아직 준비되지 않았으면 안내
    if (!videoRef.current.videoWidth || !videoRef.current.videoHeight) {
      toast.error('⏳ 카메라가 아직 준비되지 않았습니다.\n잠시 후 다시 눌러주세요.')
      return
    }

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
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setShowCamera(false)
  }

  // 카메라 모달이 열리면 video 요소에 스트림을 연결하고 재생
  useEffect(() => {
    if (!showCamera) return
    const video = videoRef.current
    const stream = streamRef.current
    if (!video || !stream) return

    video.srcObject = stream
    video.muted = true
    video.play().catch((e) => {
      console.error('video play failed', e)
    })
  }, [showCamera])

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

    const exitCodeKey = `course_exit_code_${courseId}`
    const savedCode = localStorage.getItem(exitCodeKey)

    if (!savedCode) {
      toast.error('❌ 현재 활성 퇴장 코드가 없습니다.\n관리자에게 문의하세요.')
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

  const handleExit = async () => {
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

    // 퇴장 직전 서버 시간 재동기화 후 최종 검증 (기기 시계 조작 방지)
    await syncTrustedTime(true)
    if (Math.abs(getClockSkewSeconds()) > 120) {
      setClockTampered(true)
      toast.error('🚨 기기 시계가 실제 시간과 다릅니다.\n시계를 정확히 맞춘 후 다시 시도하세요.')
      return
    }

    if (!canExit()) {
      toast.error('❌ 아직 퇴장할 수 없습니다.\n수업 종료 시간이 지나야 퇴장할 수 있습니다.')
      return
    }

    const now = getTrustedNow()
    const exitTime = now.toLocaleTimeString('ko-KR')

    // 세션에서 입장 정보 가져오기
    const attendingData = sessionStorage.getItem(`attending_${user.id}_${courseId}`)
    if (!attendingData) {
      toast.error('입장 정보를 찾을 수 없습니다')
      return
    }

    const attendanceRecord = JSON.parse(attendingData)
    attendanceRecord.exitTime = exitTime

    // ===== 수강 완료 검증: 와서 끝까지 들었는지 판정 =====
    flushSegment() // 퇴장 시점까지 수강 시간 반영
    const presentMs = presentMsRef.current

    // 입장~수업종료 동안 실제로 들었어야 하는 시간 산정
    const [eH, eM] = currentClass.endTime.split(':').map(Number)
    const endDate = new Date(now)
    endDate.setHours(eH, eM, 0, 0)
    const availableMs = Math.max(60_000, endDate.getTime() - entryTsRef.current)
    const requiredMs = availableMs * COMPLETION_THRESHOLD
    const attendedRatio = Math.min(1, presentMs / availableMs)

    attendanceRecord.attendedMinutes = Math.round(presentMs / 60000)
    attendanceRecord.attendedRatio = Math.round(attendedRatio * 100)
    attendanceRecord.awayMinutes = Math.round(awayMsRef.current / 60000)
    attendanceRecord.missedChecks = missedChecksRef.current

    const completed =
      presentMs >= requiredMs && missedChecksRef.current <= MAX_MISSED_CHECKS

    if (!completed) {
      // 끝까지 듣지 않음 → 출석 불인정 (결석 처리)
      attendanceRecord.status = 'absent'
      attendanceRecord.notCompleted = true
      attendanceRecord.reason = `수강 미완료 (참여율 ${Math.round(attendedRatio * 100)}%, 미응답 ${missedChecksRef.current}회)`
    }

    // 최종 출석 기록 저장
    const attendanceKey = `attendance_${user.id}_${courseId}`
    const saved = localStorage.getItem(attendanceKey)
    const updated = saved ? [...JSON.parse(saved), attendanceRecord] : [attendanceRecord]
    localStorage.setItem(attendanceKey, JSON.stringify(updated))

    // 세션 정리
    stopPeriodicConfirm()
    sessionStorage.removeItem(`attending_${user.id}_${courseId}`)

    // 상태 초기화
    setIsAttended(false)
    setAttendanceStartTime(null)
    setCodeVerified(false)
    setExitCodeVerified(false)
    setEnvironmentOk(false)
    setFaceDetected(false)
    setCodeInput('')
    setExitCodeInput('')
    setPresentSeconds(0)
    setAwaySeconds(0)
    setMissedChecks(0)
    setPendingCheck(false)
    loadAttendanceData(user.id)

    if (completed) {
      toast.success(`✅ 출석 인정! 끝까지 수강 완료\n${attendanceRecord.class} (참여율 ${Math.round(attendedRatio * 100)}%)`)
    } else {
      toast.error(`❌ 출석 미인정: 끝까지 수강하지 않았습니다.\n참여율 ${Math.round(attendedRatio * 100)}% (80% 이상 필요)`)
    }
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

  const stopPeriodicConfirm = () => {
    if (confirmIntervalRef.current) {
      clearInterval(confirmIntervalRef.current)
      confirmIntervalRef.current = null
    }
  }

  // ===== 수강 완료 추적 (와서 끝까지 들어야 출석 인정) =====

  // 지금 실제로 강의 화면에 집중하고 있는지 (탭 활성 + 창 포커스)
  const isHere = (): boolean =>
    typeof document !== 'undefined' &&
    document.visibilityState === 'visible' &&
    document.hasFocus()

  // 현재 구간의 경과 시간을 present/away 누적에 반영
  const flushSegment = () => {
    const now = Date.now()
    const elapsed = now - segmentStartRef.current
    if (elapsed > 0) {
      if (isHereRef.current) {
        presentMsRef.current += elapsed
      } else {
        awayMsRef.current += elapsed
      }
    }
    segmentStartRef.current = now
  }

  // 입장 시 수강 추적 초기화
  const startWatchTracking = () => {
    presentMsRef.current = 0
    awayMsRef.current = 0
    missedChecksRef.current = 0
    entryTsRef.current = getTrustedNow().getTime()
    segmentStartRef.current = Date.now()
    isHereRef.current = isHere()
    setPresentSeconds(0)
    setAwaySeconds(0)
    setMissedChecks(0)
    setCheckCycle((c) => c + 1) // 첫 랜덤 확인 스케줄
  }

  // 화면 이탈/복귀 추적: 자리를 비우면 away 로 누적되어 출석률이 깎인다
  useEffect(() => {
    if (!isAttended) return

    segmentStartRef.current = Date.now()
    isHereRef.current = isHere()

    const onPresenceChange = () => {
      flushSegment()
      isHereRef.current = isHere()
    }

    document.addEventListener('visibilitychange', onPresenceChange)
    window.addEventListener('blur', onPresenceChange)
    window.addEventListener('focus', onPresenceChange)

    const tick = setInterval(() => {
      flushSegment()
      setPresentSeconds(Math.floor(presentMsRef.current / 1000))
      setAwaySeconds(Math.floor(awayMsRef.current / 1000))
    }, 2000)

    return () => {
      document.removeEventListener('visibilitychange', onPresenceChange)
      window.removeEventListener('blur', onPresenceChange)
      window.removeEventListener('focus', onPresenceChange)
      clearInterval(tick)
    }
  }, [isAttended])

  // 랜덤 집중 확인 스케줄: 자리에 페이지만 열어두고 떠나는 것을 방지
  useEffect(() => {
    if (!isAttended || pendingCheck) return

    // 평균 12분 ± 변동으로 다음 확인 예약 (약 7~17분)
    const delay = AVG_CHECK_INTERVAL_MS * (0.6 + Math.random() * 0.8)
    const timer = setTimeout(() => {
      // 이미 퇴장 가능(수업 종료)하면 더 이상 확인하지 않음
      if (canExit()) return
      setPendingCheck(true)
    }, delay)

    return () => clearTimeout(timer)
  }, [isAttended, checkCycle, pendingCheck])

  // 집중 확인 응답 제한 시간: 미응답 시 미스 처리 + 페널티
  useEffect(() => {
    if (!pendingCheck) return

    const timer = setTimeout(() => {
      missedChecksRef.current += 1
      setMissedChecks(missedChecksRef.current)
      awayMsRef.current += CHECK_RESPONSE_WINDOW_MS // 미응답 구간은 이탈로 간주
      setPendingCheck(false)
      setCheckCycle((c) => c + 1)
      toast.error('⚠️ 수강 확인에 응답하지 않았습니다.\n자리를 비우면 출석이 인정되지 않습니다.')
    }, CHECK_RESPONSE_WINDOW_MS)

    return () => clearTimeout(timer)
  }, [pendingCheck])

  // 학생이 집중 확인에 응답
  const answerWatchCheck = () => {
    flushSegment() // 응답 시점까지 present 반영
    setPendingCheck(false)
    setCheckCycle((c) => c + 1)
    toast.success('✅ 수강 확인 완료')
  }

  // 강의 종료 시 추적 정리
  useEffect(() => {
    return () => {
      stopPeriodicConfirm()
    }
  }, [])

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
    return <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-blue-50 to-indigo-100"><div className="app-spinner" /><p className="text-gray-600 font-semibold">로딩 중...</p></div>
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
                <h3 className="text-lg font-bold text-gray-900">📷 {isOnline ? '강의 화면' : '얼굴 인식'}</h3>
                <button
                  onClick={stopCamera}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="bg-black rounded-lg overflow-hidden mb-4">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full"
                  style={{ maxHeight: '300px' }}
                />
              </div>

              <div className="space-y-2 mb-4">
                <p className="text-sm text-gray-600">
                  {environmentOk ? (
                    <span className="text-green-600 font-bold">✅ 환경 확인 완료!</span>
                  ) : (
                    <span className="text-gray-600">📷 얼굴이 화면에 보이면 아래 <b>‘사진 촬영’</b> 버튼을 눌러주세요.</span>
                  )}
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

            {/* 학습 방식 (관리자가 설정) */}
            <div className="mb-4 p-3 bg-purple-100 border-2 border-purple-300 rounded-lg">
              <p className="text-sm font-bold text-purple-900">📍 학습 방식: <span className="text-lg">🏢 강의실</span></p>
              <p className="text-xs text-purple-700 mt-1">강의실 환경에서만 출석 가능합니다.</p>
            </div>

            {/* 카메라 확인 섹션 */}
            <div className="mb-4">
                {!environmentOk ? (
                  <button
                    onClick={startCamera}
                    className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 transition flex items-center justify-center gap-2"
                  >
                    <Camera className="w-5 h-5" />
                    📷 {isOnline ? '강의 화면' : '얼굴 인식'} 확인
                  </button>
                ) : (
                  <div className="bg-green-100 border-2 border-green-400 p-3 rounded-lg text-center">
                    <p className="text-green-700 font-bold">✅ 확인 완료!</p>
                    <p className="text-sm text-green-600">
                      {isOnline ? '강의 화면이 감지됨' : '강의실 환경 확인됨'} (밝기: {brightness})
                    </p>
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

                      <button
                        onClick={handleExcuse}
                        disabled={!absenceCategory || !absenceReason.trim()}
                        className="w-full bg-green-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        ✅ 공가 신청
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <button
                        onClick={handleAttendance}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-blue-700"
                      >
                        ✅ 입장 확인
                      </button>
                    </div>
                  )
                ) : (
                  // 입장 후: 강의 진행 중
                  <div className="space-y-3 bg-blue-100 border-2 border-blue-400 p-4 rounded-lg">
                    <p className="text-blue-900 font-bold text-lg">📚 강의 진행 중...</p>
                    <p className="text-sm text-blue-800">입장 시간: {attendanceStartTime}</p>

                    {/* 시계 조작 경고 */}
                    {clockTampered && (
                      <div className="bg-red-100 border-2 border-red-500 p-3 rounded-lg">
                        <p className="text-red-800 font-bold text-sm">
                          🚨 기기 시계가 실제 시간과 다릅니다!
                        </p>
                        <p className="text-red-700 text-xs mt-1">
                          시계를 정확한 시간으로 맞춰야 퇴장할 수 있습니다. (서버 시간 기준 검증)
                        </p>
                      </div>
                    )}
                    {!timeTrusted && !clockTampered && (
                      <p className="text-xs text-blue-700">⏱️ 서버 시간 동기화 중...</p>
                    )}

                    {/* 수강 진행률 (와서 끝까지 들어야 출석 인정) */}
                    <div className="bg-white border-2 border-indigo-300 p-3 rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-bold text-indigo-900">📖 실제 수강 시간</p>
                        <p className="text-sm font-bold text-indigo-700">
                          {Math.floor(presentSeconds / 60)}분 {presentSeconds % 60}초
                        </p>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-indigo-500 h-3 rounded-full transition-all"
                          style={{
                            width: `${Math.min(
                              100,
                              (presentSeconds / Math.max(1, presentSeconds + awaySeconds)) * 100
                            )}%`,
                          }}
                        />
                      </div>
                      {awaySeconds > 0 && (
                        <p className="text-xs text-red-600 font-semibold mt-2">
                          ⚠️ 자리 비움 {Math.floor(awaySeconds / 60)}분 {awaySeconds % 60}초 — 자리를 비우면 출석이 인정되지 않습니다
                        </p>
                      )}
                      {missedChecks > 0 && (
                        <p className="text-xs text-red-600 font-semibold mt-1">
                          🚨 수강 확인 미응답 {missedChecks}회
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        화면을 벗어나거나 다른 창으로 이동하면 수강 시간이 멈춥니다.
                      </p>
                    </div>

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
                        <div className="bg-green-100 border-2 border-green-400 p-4 rounded-lg text-center">
                          <p className="text-3xl font-bold text-green-700 mb-2">🎉 강의 끝!</p>
                          <p className="text-lg font-bold text-green-700">퇴장하세요!</p>
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
                      <div className="text-center bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-blue-800 text-sm font-bold">
                          📚 강의에 집중해주세요.
                        </p>
                        <p className="text-blue-600 text-xs mt-1">
                          수업 종료 시간이 되면 퇴장 버튼이 나타납니다.<br />
                          끝까지 수강해야 출석으로 인정됩니다.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-gray-600">현재 수강 시간이 아닙니다</p>
            )}
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

      {/* 랜덤 집중 확인 모달 (자리 비움 방지) */}
      {pendingCheck && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center animate-pulse">
            <p className="text-5xl mb-4">📢</p>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">수강 확인</h3>
            <p className="text-gray-700 font-semibold mb-1">
              지금 강의를 듣고 계신가요?
            </p>
            <p className="text-sm text-red-600 font-bold mb-6">
              {Math.round(CHECK_RESPONSE_WINDOW_MS / 1000)}초 안에 누르지 않으면<br />
              자리 비움으로 기록됩니다.
            </p>
            <button
              onClick={answerWatchCheck}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl text-lg transition"
            >
              ✋ 네, 듣고 있어요!
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
