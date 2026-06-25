'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { LogOut, Clock, MapPin, Navigation, Crosshair, Wifi } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Course } from '@/types'
import { useIsomorphicLayoutEffect } from '@/lib/useIsomorphicLayoutEffect'
import { loadCourses } from '@/lib/dataStore'

function getDeviceId(): string {
  let id = localStorage.getItem('deviceId')
  if (!id) {
    id = (crypto as any).randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now()
    localStorage.setItem('deviceId', id)
  }
  return id
}

function getLoc(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('no geo'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      reject,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  })
}

// 하버사인 거리(m) — 실시간 표시용 (서버도 동일하게 재검증)
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)))
}

function fmtDist(m: number | null | undefined): string {
  if (m == null) return '-'
  if (m < 1000) return `${m}m`
  return `${(m / 1000).toFixed(2)}km`
}

function fmtDur(ms: number): string {
  if (ms <= 0) return '00:00'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const mm = String(m).padStart(2, '0')
  const sss = String(ss).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${sss}` : `${mm}:${sss}`
}

// GPS 정확도 → 신호 세기 라벨 (정적 Tailwind 클래스)
function signal(acc: number | null | undefined): { bars: number; text: string; cls: string; bar: string } {
  if (acc == null) return { bars: 0, text: '측정 중', cls: 'text-gray-400', bar: 'bg-gray-400' }
  if (acc <= 10) return { bars: 3, text: '강함', cls: 'text-green-600', bar: 'bg-green-600' }
  if (acc <= 30) return { bars: 2, text: '보통', cls: 'text-yellow-600', bar: 'bg-yellow-600' }
  if (acc <= 80) return { bars: 1, text: '약함', cls: 'text-orange-600', bar: 'bg-orange-600' }
  return { bars: 0, text: '매우 약함', cls: 'text-red-600', bar: 'bg-red-600' }
}

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern)
  } catch {
    /* 지원 안 하면 무시 */
  }
}

interface Verified {
  enterTime: string
  distance: number | null
  accuracy: number | null
  lat: number | null
  lng: number | null
}

export default function CoursePage() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.id as string
  const user = useStore((state) => state.user)
  const setUser = useStore((state) => state.setUser)

  const [course, setCourse] = useState<Course | null>(null)
  const [pageLoaded, setPageLoaded] = useState(false)
  const [attendances, setAttendances] = useState(0)
  const [lateCount, setLateCount] = useState(0)
  const [absentCount, setAbsentCount] = useState(0)
  const [excusedCount, setExcusedCount] = useState(0)
  const [materials, setMaterials] = useState<any[]>([])
  const [notice, setNotice] = useState('')
  const [schedule, setSchedule] = useState<any[]>([])
  const [currentClass, setCurrentClass] = useState<any>(null)
  const [selectedEpisode, setSelectedEpisode] = useState(1)
  const [absenceReason, setAbsenceReason] = useState('')
  const [absenceCategory, setAbsenceCategory] = useState<'ceremony' | 'hospital' | 'exam' | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<'present' | 'excused' | null>(null)
  const [isConfirmingAttendance, setIsConfirmingAttendance] = useState(false)
  const [isAttended, setIsAttended] = useState(false)
  const [attendanceStartTime, setAttendanceStartTime] = useState<string | null>(null)
  const [verified, setVerified] = useState<Verified | null>(null)

  // 위치 기반 출석
  const [liveSession, setLiveSession] = useState<any>(null)
  const [locBusy, setLocBusy] = useState(false)
  const [geo, setGeo] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
  const [liveDistance, setLiveDistance] = useState<number | null>(null)
  const [trend, setTrend] = useState<'closer' | 'farther' | null>(null)
  const [geoError, setGeoError] = useState<'denied' | 'unavailable' | null>(null)
  const [lastGeoAt, setLastGeoAt] = useState<number | null>(null)
  const [nowTick, setNowTick] = useState<number>(Date.now())
  const prevDistRef = useRef<number | null>(null)
  const wasInRangeRef = useRef<boolean | null>(null)

  const todayStr = () => new Date().toLocaleDateString('ko-KR')

  useIsomorphicLayoutEffect(() => {
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
      setCourse(courses.find((c: Course) => c.id === courseId) || null)
    }
    // 서버에서도 강의 조회 (다른 기기에서 만든 강의 대응)
    loadCourses().then((list) => {
      const found = list.find((c) => c.id === courseId)
      if (found) setCourse(found)
    })

    const savedMaterials = localStorage.getItem(`course_materials_${courseId}`)
    if (savedMaterials) setMaterials(JSON.parse(savedMaterials))

    const savedNotice = localStorage.getItem(`course_notice_${courseId}`)
    if (savedNotice) setNotice(savedNotice)

    const scheduleKey =
      course?.courseType === 'episode'
        ? `course_schedule_${courseId}_episode_${selectedEpisode}`
        : `course_schedule_${courseId}`
    const savedSchedule = localStorage.getItem(scheduleKey)
    if (savedSchedule) {
      setSchedule(JSON.parse(savedSchedule).classes || [])
    } else {
      const h = new Date().getHours()
      setSchedule([
        { number: 1, name: '1교시', startTime: `${String(h).padStart(2, '0')}:00`, endTime: `${String(h + 1).padStart(2, '0')}:00` },
        { number: 2, name: '2교시', startTime: `${String(h + 1).padStart(2, '0')}:00`, endTime: `${String(h + 2).padStart(2, '0')}:00` },
        { number: 3, name: '3교시', startTime: `${String(h + 2).padStart(2, '0')}:00`, endTime: `${String(h + 3).padStart(2, '0')}:00` },
      ])
    }

    loadAttendanceData(userData.id)

    // 오늘 이미 출석했으면 새로고침해도 '출석 완료' 상태 복원 (중복 출석 방지)
    const saved = localStorage.getItem(`attendance_${userData.id}_${courseId}`)
    if (saved) {
      const recs = JSON.parse(saved)
      const today = recs.filter((r: any) => r.date === todayStr() && r.status === 'present').pop()
      if (today) {
        setIsAttended(true)
        setAttendanceStartTime(today.enterTime)
        setVerified({
          enterTime: today.enterTime,
          distance: today.distance ?? null,
          accuracy: today.accuracy ?? null,
          lat: today.lat ?? null,
          lng: today.lng ?? null,
        })
      }
    }

    setPageLoaded(true)
  }, [courseId, router, setUser])

  // 진행 중인 출석 세션 선택 — 기기마다 강의 ID가 달라도 찾아낸다
  //  1) 같은 강의 ID  2) 세션 이름에 강의명 포함  3) 진행 중인 세션(보통 1개)
  const [sessionRefreshing, setSessionRefreshing] = useState(false)
  const pickSession = useCallback(
    (sessions: any[]) => {
      if (!sessions || sessions.length === 0) return null
      return (
        sessions.find((x) => x.course_id === courseId) ||
        (course?.name ? sessions.find((x) => (x.name || '').includes(course.name)) : null) ||
        sessions[0]
      )
    },
    [courseId, course]
  )

  const refreshSession = useCallback(
    async (manual = false) => {
      if (manual) setSessionRefreshing(true)
      try {
        // courseId 없이 = 진행 중인 모든 세션 (ends_at 미래)
        const res = await fetch(`/api/live/session`, { cache: 'no-store' })
        const data = await res.json()
        if (res.ok) setLiveSession(pickSession(data.sessions || []))
      } catch {
        /* 위치 출석 미설정/오류여도 페이지는 동작 */
      } finally {
        if (manual) setSessionRefreshing(false)
      }
    },
    [pickSession]
  )

  // 최초 + 20초마다 자동 갱신
  useEffect(() => {
    refreshSession()
    const t = setInterval(() => refreshSession(), 20000)
    return () => clearInterval(t)
  }, [refreshSession])

  // 1초 타이머 (마감 카운트다운 / 위치 갱신 경과 표시)
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // 실시간 위치 추적: 현장까지 거리·정확도·접근방향을 계속 갱신 (출석 전에만)
  useEffect(() => {
    if (!liveSession || isAttended) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('unavailable')
      return
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const lat = p.coords.latitude
        const lng = p.coords.longitude
        const accuracy = Math.round(p.coords.accuracy)
        setGeo({ lat, lng, accuracy })
        setGeoError(null)
        setLastGeoAt(Date.now())
        if (typeof liveSession.venue_lat === 'number' && typeof liveSession.venue_lng === 'number') {
          const d = haversine(liveSession.venue_lat, liveSession.venue_lng, lat, lng)
          const prev = prevDistRef.current
          if (prev != null && Math.abs(prev - d) >= 3) setTrend(d < prev ? 'closer' : 'farther')
          prevDistRef.current = d
          setLiveDistance(d)
          const nowIn = d <= liveSession.radius_m
          if (nowIn && wasInRangeRef.current === false) {
            vibrate([40, 30, 40])
            toast.success('🎉 현장에 도착했어요! 이제 출석할 수 있어요', { id: 'arrive' })
          }
          wasInRangeRef.current = nowIn
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setGeoError('denied')
        else setGeoError('unavailable')
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [liveSession, isAttended])

  const updateCurrentClass = () => {
    if (!schedule || schedule.length === 0) {
      setCurrentClass(null)
      return
    }
    const now = new Date()
    const cur = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0')
    setCurrentClass(schedule.find((cls: any) => cur >= cls.startTime && cur < cls.endTime) || null)
  }

  useEffect(() => {
    if (schedule.length === 0) return
    updateCurrentClass()
    const interval = setInterval(updateCurrentClass, 60000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule])

  useEffect(() => {
    if (!course) return
    const scheduleKey =
      course.courseType === 'episode'
        ? `course_schedule_${courseId}_episode_${selectedEpisode}`
        : `course_schedule_${courseId}`
    const savedSchedule = localStorage.getItem(scheduleKey)
    if (savedSchedule) setSchedule(JSON.parse(savedSchedule).classes || [])
  }, [selectedEpisode, course, courseId])

  const loadAttendanceData = (userId: string) => {
    const saved = localStorage.getItem(`attendance_${userId}_${courseId}`)
    if (saved) {
      const records = JSON.parse(saved)
      setAttendances(records.filter((r: any) => r.status === 'present').length)
      setLateCount(records.filter((r: any) => r.status === 'late').length)
      setAbsentCount(records.filter((r: any) => r.status === 'absent').length)
      setExcusedCount(records.filter((r: any) => r.status === 'excused').length)
    } else {
      setAttendances(0)
      setLateCount(0)
      setAbsentCount(0)
      setExcusedCount(0)
    }
  }

  // ===== 위치 기반 출석 =====
  const radius: number | null = liveSession?.radius_m ?? null
  const accuracy = geo?.accuracy ?? null
  const inRange = liveDistance != null && radius != null && liveDistance <= radius
  const borderline =
    !inRange && liveDistance != null && radius != null && accuracy != null && liveDistance <= radius + accuracy
  const endMs = liveSession ? new Date(liveSession.ends_at).getTime() : null
  const msLeft = endMs != null ? endMs - nowTick : null
  const sessionEnded = msLeft != null && msLeft <= 0
  const geoAgo = lastGeoAt != null ? Math.max(0, Math.round((nowTick - lastGeoAt) / 1000)) : null

  const handleLocationCheckin = async () => {
    if (!user || !course) return

    const enrolled = JSON.parse(localStorage.getItem(`enrolled_${user.id}`) || '[]')
    if (!enrolled.some((c: any) => c.id === courseId)) {
      toast.error('❌ 이 강의에 등록되지 않았습니다. 먼저 강의에 등록해주세요.')
      return
    }
    if (!liveSession) {
      toast.error('관리자가 아직 출석(위치)을 시작하지 않았습니다.')
      return
    }
    // 오늘 이미 출석했으면 중복 방지
    const existing = JSON.parse(localStorage.getItem(`attendance_${user.id}_${courseId}`) || '[]')
    if (existing.some((r: any) => r.date === todayStr() && r.status === 'present')) {
      toast('오늘은 이미 출석했어요 ✅', { icon: '👍' })
      setIsAttended(true)
      return
    }

    setLocBusy(true)
    let loc = geo ? { lat: geo.lat, lng: geo.lng, accuracy: geo.accuracy } : null
    if (!loc) {
      try {
        loc = await getLoc()
      } catch {
        setLocBusy(false)
        setGeoError('denied')
        toast.error('📍 위치 권한을 허용해야 출석할 수 있습니다')
        return
      }
    }

    try {
      const res = await fetch('/api/live/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'checkin',
          sessionId: liveSession.id,
          lat: loc.lat,
          lng: loc.lng,
          userId: user.id,
          userName: user.name,
          deviceId: getDeviceId(),
        }),
      })
      const data = await res.json()

      if (data.ok) {
        const now = new Date()
        const record = {
          date: todayStr(),
          enterTime: now.toLocaleTimeString('ko-KR'),
          status: 'present',
          class: liveSession.name || '현장 출석',
          locationVerified: true,
          distance: data.distance ?? null,
          accuracy: loc.accuracy ?? null,
          lat: loc.lat,
          lng: loc.lng,
        }
        const key = `attendance_${user.id}_${courseId}`
        const saved = localStorage.getItem(key)
        localStorage.setItem(key, JSON.stringify(saved ? [...JSON.parse(saved), record] : [record]))

        vibrate([60, 40, 120])
        setIsAttended(true)
        setAttendanceStartTime(record.enterTime)
        setVerified({ enterTime: record.enterTime, distance: record.distance, accuracy: record.accuracy, lat: record.lat, lng: record.lng })
        setIsConfirmingAttendance(false)
        setSelectedStatus(null)
        loadAttendanceData(user.id)
        toast.success(`✅ 출석 인정! 현장 확인됨${typeof data.distance === 'number' ? ` (약 ${data.distance}m)` : ''}`)
      } else {
        const m =
          !data.inRange && typeof data.distance === 'number'
            ? `📍 현장에서 약 ${data.distance}m 떨어져 있습니다. 현장으로 이동 후 다시 시도하세요.`
            : data.error || '출석할 수 없습니다'
        vibrate(200)
        toast.error(m)
      }
    } catch {
      toast.error('네트워크 오류')
    } finally {
      setLocBusy(false)
    }
  }

  const handleEndClass = () => {
    if (!user) return
    const key = `attendance_${user.id}_${courseId}`
    const saved = localStorage.getItem(key)
    if (saved) {
      const arr = JSON.parse(saved)
      for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i].status === 'present' && !arr[i].exitTime) {
          arr[i].exitTime = new Date().toLocaleTimeString('ko-KR')
          break
        }
      }
      localStorage.setItem(key, JSON.stringify(arr))
    }
    setIsAttended(false)
    setAttendanceStartTime(null)
    setVerified(null)
    wasInRangeRef.current = null
    loadAttendanceData(user.id)
    toast.success('수고하셨습니다! 👏')
  }

  const getCategoryLabel = (category: string): string => {
    const labels: { [key: string]: string } = { ceremony: '경조사', hospital: '병원', exam: '자격증/시험' }
    return labels[category] || category
  }

  const handleExcuse = () => {
    if (!user || !course || !absenceCategory || !absenceReason.trim()) {
      toast.error('공가 사유 분류와 상세 정보를 입력하세요')
      return
    }
    const now = new Date()
    const record = {
      date: todayStr(),
      time: now.toLocaleTimeString('ko-KR'),
      status: 'excused',
      class: currentClass?.name || '공가',
      reason: absenceReason,
      category: absenceCategory,
      categoryLabel: getCategoryLabel(absenceCategory),
    }
    const key = `attendance_${user.id}_${courseId}`
    const saved = localStorage.getItem(key)
    localStorage.setItem(key, JSON.stringify(saved ? [...JSON.parse(saved), record] : [record]))

    loadAttendanceData(user.id)
    setAbsenceReason('')
    setAbsenceCategory(null)
    setIsConfirmingAttendance(false)
    setSelectedStatus(null)
    toast.success(`🏥 공가 신청 완료!\n[${getCategoryLabel(absenceCategory)}] ${absenceReason}`)
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    setUser(null)
    router.push('/login')
  }

  const canDownloadMaterial = (material: any): boolean => {
    if (course?.courseType === 'session') {
      if (!material.availableUntilClass) return true
      if (!currentClass) return true
      return currentClass.number <= material.availableUntilClass
    }
    if (!material.availableUntilEpisode) return true
    if (selectedEpisode < material.availableUntilEpisode) return true
    if (selectedEpisode === material.availableUntilEpisode) {
      if (!currentClass || !material.availableUntilClass) return true
      return currentClass.number <= material.availableUntilClass
    }
    return false
  }

  const getMaterialStatus = (material: any): { canDownload: boolean; message: string } => {
    if (course?.courseType === 'session') {
      if (!material.availableUntilClass) return { canDownload: true, message: '' }
      if (!currentClass) return { canDownload: true, message: '' }
      if (currentClass.number <= material.availableUntilClass)
        return { canDownload: true, message: `(${material.availableUntilClass}교시까지 다운로드 가능)` }
      return { canDownload: false, message: `(${material.availableUntilClass}교시까지만 다운로드 가능)` }
    }
    if (!material.availableUntilEpisode) return { canDownload: true, message: '' }
    if (selectedEpisode < material.availableUntilEpisode) return { canDownload: true, message: '' }
    if (selectedEpisode === material.availableUntilEpisode) {
      if (!currentClass || !material.availableUntilClass) return { canDownload: true, message: '' }
      if (currentClass.number <= material.availableUntilClass)
        return { canDownload: true, message: `(${material.availableUntilClass}교시까지 다운로드 가능)` }
      return { canDownload: false, message: `(${material.availableUntilEpisode}회차 ${material.availableUntilClass}교시까지만 다운로드 가능)` }
    }
    return { canDownload: false, message: `(${material.availableUntilEpisode}회차까지만 다운로드 가능)` }
  }

  if (!pageLoaded || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="app-spinner" />
        <p className="text-gray-600 font-semibold">로딩 중...</p>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-blue-50 to-indigo-100 px-4 text-center">
        <p className="text-5xl">🔍</p>
        <p className="text-xl font-bold text-gray-900">강의를 찾을 수 없습니다</p>
        <p className="text-gray-600 text-sm">이 강의 정보가 없거나 삭제되었습니다.</p>
        <button onClick={() => router.push('/student')} className="mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg">
          ← 내 강의로 돌아가기
        </button>
      </div>
    )
  }

  const hour = new Date(nowTick).getHours()
  const greeting = hour < 6 ? '🌙 늦은 시간이네요' : hour < 12 ? '🌅 좋은 아침이에요' : hour < 18 ? '☀️ 좋은 오후예요' : '🌆 좋은 저녁이에요'
  const sig = signal(accuracy)
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)
  const gaugePct = radius && liveDistance != null ? Math.min(100, Math.round((liveDistance / radius) * 100)) : 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/student')} className="text-blue-600 font-medium hover:underline">
            ← 돌아가기
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{course.name}</h1>
          <button onClick={handleLogout} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2">
            <LogOut className="w-4 h-4" /> 로그아웃
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
            <label className="block text-sm font-semibold text-indigo-900 mb-3">📚 회차 선택</label>
            <select
              value={selectedEpisode}
              onChange={(e) => setSelectedEpisode(Number(e.target.value))}
              className="w-full px-4 py-2 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              {Array.from({ length: course.episodeCount || 1 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}회차</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* ===== 위치 기반 출석 카드 ===== */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-blue-100">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Clock className="w-6 h-6 text-blue-600" />
                <h3 className="text-xl font-bold text-gray-900">출석 등록</h3>
              </div>
              <span className="text-xs text-gray-400">{greeting}, {user.name}님</span>
            </div>
            <p className="text-xs text-purple-700 bg-purple-50 inline-flex items-center gap-1 px-2 py-1 rounded-full mb-4">
              <MapPin className="w-3 h-3" /> 현장 위치 확인 방식
            </p>

            {!liveSession ? (
              <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-6 text-center">
                <p className="text-4xl mb-2">📡</p>
                <p className="text-gray-700 font-bold text-sm">아직 출석이 시작되지 않았어요</p>
                <p className="text-gray-500 text-xs mt-1">관리자가 현장 위치 출석을 시작하면<br />이 화면에서 바로 출석할 수 있어요.</p>
                <button
                  onClick={() => refreshSession(true)}
                  disabled={sessionRefreshing}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-2 px-5 rounded-lg disabled:opacity-50"
                >
                  {sessionRefreshing ? '확인 중...' : '🔄 지금 다시 확인'}
                </button>
                <p className="text-[11px] text-gray-400 mt-3">⟳ 20초마다 자동으로 확인하고 있어요</p>
              </div>
            ) : isAttended ? (
              /* 출석 인정 완료 — 검증 상세 */
              <div className="space-y-3">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-5 text-center text-white">
                  <p className="text-4xl mb-1">🎉</p>
                  <p className="text-2xl font-extrabold">출석 인정 완료!</p>
                  <p className="text-sm text-white/90 mt-1">현장 위치가 확인되었습니다</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">출석 시각</span><span className="font-bold text-gray-900">{verified?.enterTime || attendanceStartTime}</span></div>
                  {verified?.distance != null && (
                    <div className="flex justify-between"><span className="text-gray-500">확인된 거리</span><span className="font-bold text-gray-900">현장에서 약 {verified.distance}m</span></div>
                  )}
                  {verified?.accuracy != null && (
                    <div className="flex justify-between"><span className="text-gray-500">GPS 정확도</span><span className="font-bold text-gray-900">±{verified.accuracy}m</span></div>
                  )}
                  <div className="flex justify-between"><span className="text-gray-500">이 강의 출석</span><span className="font-bold text-green-700">{attendances}번째 🎯</span></div>
                </div>
                {verified?.lat != null && verified?.lng != null && (
                  <a
                    href={`https://www.google.com/maps?q=${verified.lat},${verified.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-sm font-bold text-indigo-600 hover:text-indigo-700 border border-indigo-200 rounded-lg py-2"
                  >
                    🗺️ 내가 출석한 위치 지도로 보기
                  </a>
                )}
                <p className="text-[11px] text-gray-400 text-center">🔋 출석 후엔 위치 추적을 멈춰 배터리를 아껴요</p>
                <button onClick={handleEndClass} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-bold transition text-sm">
                  🚪 수강 종료 (퇴장 시간 기록)
                </button>
              </div>
            ) : isConfirmingAttendance && selectedStatus === 'excused' ? (
              /* 공가 신청 */
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-bold text-gray-700 mb-2">사유 분류:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {([['ceremony', '💒 경조사'], ['hospital', '🏥 병원'], ['exam', '📝 자격증/시험']] as const).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setAbsenceCategory(key)}
                        className={`py-2 px-3 rounded-lg font-semibold text-sm transition ${
                          absenceCategory === key ? 'bg-blue-600 text-white border-2 border-blue-600' : 'bg-white text-gray-900 border-2 border-gray-300 hover:border-blue-400'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
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
                    onClick={() => { setIsConfirmingAttendance(false); setSelectedStatus(null); setAbsenceCategory(null); setAbsenceReason('') }}
                    className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-bold hover:bg-gray-300 transition"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleExcuse}
                    disabled={!absenceCategory || !absenceReason.trim()}
                    className="flex-[2] bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    ✅ 공가 신청
                  </button>
                </div>
              </div>
            ) : (
              /* 출석 전 — 실시간 위치 디테일 */
              <div className="space-y-4">
                {/* 위치 맞음/밖 배지 */}
                {geoError === 'denied' ? (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-center">
                    <p className="text-3xl mb-1">🔒</p>
                    <p className="font-bold text-red-700 text-sm">위치 권한이 꺼져 있어요</p>
                    <p className="text-xs text-red-500 mt-1">
                      {isIOS ? '설정 > Safari > 위치 > "허용"' : '주소창의 🔒(자물쇠) > 권한 > 위치 > 허용'} 으로 켠 뒤 새로고침하세요.
                    </p>
                  </div>
                ) : geoError === 'unavailable' || liveDistance == null ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                    <div className="app-spinner mx-auto mb-2" />
                    <p className="text-sm font-bold text-blue-800">GPS로 현장까지 거리를 재고 있어요…</p>
                    <p className="text-[11px] text-blue-500 mt-1">실외나 창가에서 더 정확해요</p>
                  </div>
                ) : (
                  <>
                    <div
                      className={`rounded-xl p-4 text-center border-2 transition-colors ${
                        inRange ? 'bg-green-50 border-green-300' : borderline ? 'bg-yellow-50 border-yellow-300' : 'bg-orange-50 border-orange-200'
                      }`}
                    >
                      <p className={`text-2xl font-extrabold ${inRange ? 'text-green-700' : borderline ? 'text-yellow-700' : 'text-orange-700'}`}>
                        {inRange ? '✅ 위치 맞음' : borderline ? '🟡 거의 다 왔어요' : '📍 현장 밖'}
                      </p>
                      <p className="text-sm text-gray-700 mt-1 flex items-center justify-center gap-1">
                        현장까지 <b>{fmtDist(liveDistance)}</b>
                        {trend === 'closer' && <span className="text-green-600 font-bold">🔥 가까워지는 중</span>}
                        {trend === 'farther' && <span className="text-red-500 font-bold">❄️ 멀어지는 중</span>}
                      </p>
                      {!inRange && radius != null && (
                        <p className="text-xs text-gray-500 mt-1">
                          {borderline ? 'GPS 오차 범위 안이에요. 한 걸음만 더!' : `허용 반경 ${radius}m 안으로 들어오세요 (약 ${fmtDist(liveDistance - radius)} 더)`}
                        </p>
                      )}
                    </div>

                    {/* 거리 게이지 (현장 중심 → 반경 경계) */}
                    {radius != null && (
                      <div>
                        <div className="relative h-2 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${inRange ? 'bg-green-500' : borderline ? 'bg-yellow-500' : 'bg-orange-500'}`}
                            style={{ width: `${Math.max(4, gaugePct)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                          <span>현장 중심</span>
                          <span>반경 {radius}m {!inRange && liveDistance! > radius ? `(+${liveDistance! - radius}m 초과)` : ''}</span>
                        </div>
                      </div>
                    )}

                    {/* GPS 신호 / 정확도 / 갱신 경과 */}
                    <div className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                      <span className="flex items-center gap-1.5">
                        <Wifi className={`w-3.5 h-3.5 ${sig.cls}`} />
                        <span className={`font-bold ${sig.cls}`}>GPS {sig.text}</span>
                        <span className="text-gray-400 inline-flex items-end gap-0.5 ml-0.5">
                          {[1, 2, 3].map((b) => (
                            <span key={b} className={`w-1 rounded-sm ${b <= sig.bars ? sig.bar : 'bg-gray-300'}`} style={{ height: `${b * 3 + 2}px` }} />
                          ))}
                        </span>
                      </span>
                      <span className="flex items-center gap-1 text-gray-500">
                        <Crosshair className="w-3.5 h-3.5" /> ±{accuracy ?? '-'}m
                      </span>
                      {geoAgo != null && <span className="text-gray-400">{geoAgo < 2 ? '방금 갱신' : `${geoAgo}초 전`}</span>}
                    </div>

                    {accuracy != null && accuracy > 80 && (
                      <p className="text-[11px] text-orange-600 text-center">⚠️ GPS 신호가 약해요. 실외/창가에서 잠시 기다리면 더 정확해져요.</p>
                    )}

                    {/* 마감 카운트다운 */}
                    {msLeft != null && !sessionEnded && (
                      <p className="text-xs text-center text-gray-500">⏳ 출석 마감까지 <b className="text-gray-800 font-mono">{fmtDur(msLeft)}</b></p>
                    )}
                  </>
                )}

                {/* 출석 버튼 — 위치 상태에 따라 동적 */}
                <button
                  onClick={handleLocationCheckin}
                  disabled={locBusy || sessionEnded || (liveDistance != null && !inRange && !borderline)}
                  className={`w-full py-4 rounded-xl font-bold text-lg transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                    inRange || borderline ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 animate-pulse' : 'bg-gray-300 text-gray-600'
                  }`}
                >
                  <Navigation className="w-5 h-5" />
                  {locBusy
                    ? '위치 확인 중...'
                    : sessionEnded
                    ? '출석 시간이 종료되었습니다'
                    : liveDistance == null
                    ? '위치 확인 후 출석'
                    : inRange
                    ? '지금 출석하기 (위치 맞음)'
                    : borderline
                    ? '출석 시도하기 (경계)'
                    : `현장까지 ${fmtDist(liveDistance != null && radius != null ? liveDistance - radius : null)} 더`}
                </button>

                {liveSession?.venue_lat != null && (
                  <a
                    href={`https://www.google.com/maps?q=${liveSession.venue_lat},${liveSession.venue_lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-xs text-gray-500 hover:text-gray-700"
                  >
                    🏫 출석 현장 위치 지도로 보기
                  </a>
                )}

                <button
                  onClick={() => { setSelectedStatus('excused'); setIsConfirmingAttendance(true) }}
                  className="w-full bg-green-50 hover:bg-green-100 text-green-700 py-2.5 rounded-lg font-bold transition text-sm"
                >
                  🏥 못 오는 경우 — 공가 신청
                </button>
              </div>
            )}
          </div>

          {/* 출석 현황 */}
          <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col justify-center border border-blue-100">
            <h3 className="text-xl font-bold text-gray-900 mb-4">📊 출석 현황</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-green-50 p-3 rounded-lg border border-green-200">
                <span className="font-medium">✅ 출석</span>
                <span className="bg-green-200 text-green-800 px-3 py-1 rounded-full text-sm font-medium">{attendances}회</span>
              </div>
              {lateCount > 0 && (
                <div className="flex items-center justify-between bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  <span className="font-medium">⏰ 지각</span>
                  <span className="bg-yellow-200 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">{lateCount}회</span>
                </div>
              )}
              {absentCount > 0 && (
                <div className="flex items-center justify-between bg-red-50 p-3 rounded-lg border border-red-200">
                  <span className="font-medium">❌ 결석</span>
                  <span className="bg-red-200 text-red-800 px-3 py-1 rounded-full text-sm font-medium">{absentCount}회</span>
                </div>
              )}
              <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-200">
                <span className="font-medium">🏥 공가</span>
                <span className="bg-blue-200 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">{excusedCount}회</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-8">
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
                      canDownload ? 'border-blue-500 hover:bg-blue-50 cursor-pointer bg-gray-50 hover:shadow-md' : 'border-red-500 bg-red-50 cursor-not-allowed opacity-60'
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
