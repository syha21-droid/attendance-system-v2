'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { LogOut, Clock, MapPin, Navigation, Crosshair, Wifi, Upload, FileText, Download } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Course } from '@/types'
import { useIsomorphicLayoutEffect } from '@/lib/useIsomorphicLayoutEffect'
import { loadCourses } from '@/lib/dataStore'
import { doLogout } from '@/lib/logout'

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
  return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
}

function signal(acc: number | null | undefined) {
  if (acc == null) return { bars: 0, text: '측정 중', color: 'rgba(255,255,255,0.30)' }
  if (acc <= 10) return { bars: 3, text: '강함', color: '#4ade80' }
  if (acc <= 30) return { bars: 2, text: '보통', color: '#facc15' }
  if (acc <= 80) return { bars: 1, text: '약함', color: '#fb923c' }
  return { bars: 0, text: '매우 약함', color: '#f87171' }
}

function vibrate(pattern: number | number[]) {
  try { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern) } catch { /**/ }
}

interface Verified { enterTime: string; distance: number | null; accuracy: number | null; lat: number | null; lng: number | null }

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
  const [submissions, setSubmissions] = useState<any[]>([])
  const [submitFile, setSubmitFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const submitInputRef = useRef<HTMLInputElement>(null)
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
  const [markedExit, setMarkedExit] = useState<{ lat: number; lng: number } | null>(null)
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
    if (!savedUser) { router.push('/login'); return }
    const userData = JSON.parse(savedUser)
    setUser(userData)

    const savedCourses = localStorage.getItem('courses')
    if (savedCourses) {
      const courses = JSON.parse(savedCourses)
      setCourse(courses.find((c: Course) => c.id === courseId) || null)
    }
    loadCourses().then((list) => { const found = list.find((c) => c.id === courseId); if (found) setCourse(found) })

    const savedMaterials = localStorage.getItem(`course_materials_${courseId}`)
    if (savedMaterials) setMaterials(JSON.parse(savedMaterials))
    const savedNotice = localStorage.getItem(`course_notice_${courseId}`)
    if (savedNotice) setNotice(savedNotice)

    const scheduleKey = course?.courseType === 'episode' ? `course_schedule_${courseId}_episode_${selectedEpisode}` : `course_schedule_${courseId}`
    const savedSchedule = localStorage.getItem(scheduleKey)
    if (savedSchedule) {
      setSchedule(JSON.parse(savedSchedule).classes || [])
    } else {
      const h = new Date().getHours()
      setSchedule([
        { number: 1, name: '1교시', startTime: `${String(h).padStart(2,'0')}:00`, endTime: `${String(h+1).padStart(2,'0')}:00` },
        { number: 2, name: '2교시', startTime: `${String(h+1).padStart(2,'0')}:00`, endTime: `${String(h+2).padStart(2,'0')}:00` },
        { number: 3, name: '3교시', startTime: `${String(h+2).padStart(2,'0')}:00`, endTime: `${String(h+3).padStart(2,'0')}:00` },
      ])
    }

    loadAttendanceData(userData.id)

    const saved = localStorage.getItem(`attendance_${userData.id}_${courseId}`)
    if (saved) {
      const recs = JSON.parse(saved)
      const today = recs.filter((r: any) => r.date === todayStr() && r.status === 'present').pop()
      if (today) {
        setIsAttended(true)
        setAttendanceStartTime(today.enterTime)
        setVerified({ enterTime: today.enterTime, distance: today.distance ?? null, accuracy: today.accuracy ?? null, lat: today.lat ?? null, lng: today.lng ?? null })
      }
    }
    setPageLoaded(true)
  }, [courseId, router, setUser])

  const loadSubmissions = useCallback(async (uid: string) => {
    try {
      const res = await fetch(`/api/submissions?courseId=${courseId}&userId=${uid}`, { cache: 'no-store' })
      const d = await res.json()
      setSubmissions(d.submissions || [])
    } catch { /**/ }
  }, [courseId])

  useEffect(() => {
    const saved = localStorage.getItem('user')
    if (saved) loadSubmissions(JSON.parse(saved).id)
  }, [loadSubmissions])

  const handleFileSubmit = async () => {
    if (!submitFile || !user) return
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('file', submitFile); fd.append('courseId', courseId); fd.append('userId', user.id); fd.append('userName', user.name || '')
      const res = await fetch('/api/submissions', { method: 'POST', body: fd })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error || '업로드 실패'); return }
      toast.success('과제 제출 완료!')
      setSubmitFile(null)
      if (submitInputRef.current) submitInputRef.current.value = ''
      loadSubmissions(user.id)
    } catch { toast.error('네트워크 오류') } finally { setSubmitting(false) }
  }

  const [sessionRefreshing, setSessionRefreshing] = useState(false)
  const pickSession = useCallback((sessions: any[]) => {
    if (!sessions || sessions.length === 0) return null
    return sessions.find((x) => x.course_id === courseId) ||
      (course?.name ? sessions.find((x) => (x.name || '').includes(course.name)) : null) ||
      sessions[0]
  }, [courseId, course])

  const refreshSession = useCallback(async (manual = false) => {
    if (manual) setSessionRefreshing(true)
    try {
      const res = await fetch(`/api/live/session`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setLiveSession(pickSession(data.sessions || []))
    } catch { /**/ } finally { if (manual) setSessionRefreshing(false) }
  }, [pickSession])

  useEffect(() => { refreshSession(); const t = setInterval(() => refreshSession(), 20000); return () => clearInterval(t) }, [refreshSession])
  useEffect(() => { const t = setInterval(() => setNowTick(Date.now()), 1000); return () => clearInterval(t) }, [])

  useEffect(() => {
    if (!liveSession || isAttended) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setGeoError('unavailable'); return }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const { latitude: lat, longitude: lng, accuracy } = p.coords
        setGeo({ lat, lng, accuracy: Math.round(accuracy) }); setGeoError(null); setLastGeoAt(Date.now())
        if (typeof liveSession.venue_lat === 'number' && typeof liveSession.venue_lng === 'number') {
          const d = haversine(liveSession.venue_lat, liveSession.venue_lng, lat, lng)
          const prev = prevDistRef.current
          if (prev != null && Math.abs(prev - d) >= 3) setTrend(d < prev ? 'closer' : 'farther')
          prevDistRef.current = d; setLiveDistance(d)
          const nowIn = d <= liveSession.radius_m
          if (nowIn && wasInRangeRef.current === false) { vibrate([40,30,40]); toast.success('현장에 도착했어요! 이제 출석할 수 있어요', { id: 'arrive' }) }
          wasInRangeRef.current = nowIn
        }
      },
      (err) => { if (err.code === err.PERMISSION_DENIED) setGeoError('denied'); else setGeoError('unavailable') },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [liveSession, isAttended])

  const updateCurrentClass = () => {
    if (!schedule || schedule.length === 0) { setCurrentClass(null); return }
    const now = new Date()
    const cur = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0')
    setCurrentClass(schedule.find((cls: any) => cur >= cls.startTime && cur < cls.endTime) || null)
  }

  useEffect(() => {
    if (schedule.length === 0) return
    updateCurrentClass(); const interval = setInterval(updateCurrentClass, 60000); return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule])

  useEffect(() => {
    if (!course) return
    const key = course.courseType === 'episode' ? `course_schedule_${courseId}_episode_${selectedEpisode}` : `course_schedule_${courseId}`
    const saved = localStorage.getItem(key)
    if (saved) setSchedule(JSON.parse(saved).classes || [])
  }, [selectedEpisode, course, courseId])

  const loadAttendanceData = (userId: string) => {
    const saved = localStorage.getItem(`attendance_${userId}_${courseId}`)
    if (saved) {
      const records = JSON.parse(saved)
      setAttendances(records.filter((r: any) => r.status === 'present').length)
      setLateCount(records.filter((r: any) => r.status === 'late').length)
      setAbsentCount(records.filter((r: any) => r.status === 'absent').length)
      setExcusedCount(records.filter((r: any) => r.status === 'excused').length)
    } else { setAttendances(0); setLateCount(0); setAbsentCount(0); setExcusedCount(0) }
  }

  const radius: number | null = liveSession?.radius_m ?? null
  const accuracy = geo?.accuracy ?? null
  const inRange = liveDistance != null && radius != null && liveDistance <= radius
  const borderline = !inRange && liveDistance != null && radius != null && accuracy != null && liveDistance <= radius + accuracy
  const endMs = liveSession ? new Date(liveSession.ends_at).getTime() : null
  const msLeft = endMs != null ? endMs - nowTick : null
  const sessionEnded = msLeft != null && msLeft <= 0
  const geoAgo = lastGeoAt != null ? Math.max(0, Math.round((nowTick - lastGeoAt) / 1000)) : null

  const handleLocationCheckin = async () => {
    if (!user || !course) return
    const enrolled = JSON.parse(localStorage.getItem(`enrolled_${user.id}`) || '[]')
    if (!enrolled.some((c: any) => c.id === courseId)) { toast.error('이 강의에 등록되지 않았습니다.'); return }
    if (!liveSession) { toast.error('관리자가 아직 출석을 시작하지 않았습니다.'); return }
    const existing = JSON.parse(localStorage.getItem(`attendance_${user.id}_${courseId}`) || '[]')
    if (existing.some((r: any) => r.date === todayStr() && r.status === 'present')) { toast('오늘은 이미 출석했어요 ✅', { icon: '👍' }); setIsAttended(true); return }

    setLocBusy(true)
    let loc = geo ? { lat: geo.lat, lng: geo.lng, accuracy: geo.accuracy } : null
    if (!loc) {
      try { loc = await getLoc() } catch { setLocBusy(false); setGeoError('denied'); toast.error('위치 권한을 허용해야 출석할 수 있습니다'); return }
    }
    try {
      const res = await fetch('/api/live/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'checkin', sessionId: liveSession.id, lat: loc!.lat, lng: loc!.lng, userId: user.id, userName: user.name, deviceId: getDeviceId() }) })
      const data = await res.json()
      if (data.ok) {
        const now = new Date()
        const record = { date: todayStr(), enterTime: now.toLocaleTimeString('ko-KR'), status: 'present', class: liveSession.name || '현장 출석', locationVerified: true, distance: data.distance ?? null, accuracy: loc!.accuracy ?? null, lat: loc!.lat, lng: loc!.lng }
        const key = `attendance_${user.id}_${courseId}`
        const saved = localStorage.getItem(key)
        localStorage.setItem(key, JSON.stringify(saved ? [...JSON.parse(saved), record] : [record]))
        vibrate([60,40,120]); setIsAttended(true); setAttendanceStartTime(record.enterTime)
        setVerified({ enterTime: record.enterTime, distance: record.distance, accuracy: record.accuracy, lat: record.lat, lng: record.lng })
        setIsConfirmingAttendance(false); setSelectedStatus(null); loadAttendanceData(user.id)
        toast.success(`출석 인정! 현장 확인됨${typeof data.distance === 'number' ? ` (약 ${data.distance}m)` : ''}`)
      } else {
        vibrate(200)
        toast.error(!data.inRange && typeof data.distance === 'number' ? `현장에서 약 ${data.distance}m 떨어져 있습니다` : data.error || '출석할 수 없습니다')
      }
    } catch { toast.error('네트워크 오류') } finally { setLocBusy(false) }
  }

  const handleEndClass = async () => {
    if (!user) return
    setLocBusy(true)
    let loc: { lat: number; lng: number; accuracy: number } | null = null
    try { loc = await getLoc() } catch { setLocBusy(false); toast.error('위치 권한을 허용해야 퇴장할 수 있습니다'); return }

    if (liveSession) {
      try {
        const res = await fetch('/api/live/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'checkout', sessionId: liveSession.id, lat: loc.lat, lng: loc.lng, userId: user.id, userName: user.name, deviceId: getDeviceId() }) })
        const data = await res.json()
        if (!data.ok) { setLocBusy(false); toast.error(data.error || '퇴장할 수 없습니다'); return }
        setMarkedExit({ lat: loc.lat, lng: loc.lng })
      } catch { setLocBusy(false); toast.error('네트워크 오류'); return }
    }

    const key = `attendance_${user.id}_${courseId}`
    const saved = localStorage.getItem(key)
    if (saved) {
      const arr = JSON.parse(saved)
      for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i].status === 'present' && !arr[i].exitTime) { arr[i].exitTime = new Date().toLocaleTimeString('ko-KR'); arr[i].exitLat = loc?.lat; arr[i].exitLng = loc?.lng; break }
      }
      localStorage.setItem(key, JSON.stringify(arr))
    }
    setIsAttended(false); setAttendanceStartTime(null); setVerified(null); wasInRangeRef.current = null
    loadAttendanceData(user.id); setLocBusy(false)
    toast.success('수고하셨습니다! 퇴장 위치가 기록되었습니다')
  }

  const handleExcuse = () => {
    if (!user || !course || !absenceCategory || !absenceReason.trim()) { toast.error('공가 사유 분류와 상세 정보를 입력하세요'); return }
    const labels: Record<string, string> = { ceremony: '경조사', hospital: '병원', exam: '자격증/시험' }
    const record = { date: todayStr(), time: new Date().toLocaleTimeString('ko-KR'), status: 'excused', class: currentClass?.name || '공가', reason: absenceReason, category: absenceCategory, categoryLabel: labels[absenceCategory] }
    const key = `attendance_${user.id}_${courseId}`
    const saved = localStorage.getItem(key)
    localStorage.setItem(key, JSON.stringify(saved ? [...JSON.parse(saved), record] : [record]))
    loadAttendanceData(user.id); setAbsenceReason(''); setAbsenceCategory(null); setIsConfirmingAttendance(false); setSelectedStatus(null)
    toast.success(`공가 신청 완료! [${labels[absenceCategory]}] ${absenceReason}`)
  }

  const getMaterialStatus = (material: any): { canDownload: boolean; message: string } => {
    if (course?.courseType === 'session') {
      if (!material.availableUntilClass) return { canDownload: true, message: '' }
      if (!currentClass) return { canDownload: true, message: '' }
      if (currentClass.number <= material.availableUntilClass) return { canDownload: true, message: `(${material.availableUntilClass}교시까지 다운로드 가능)` }
      return { canDownload: false, message: `(${material.availableUntilClass}교시까지만 다운로드 가능)` }
    }
    if (!material.availableUntilEpisode) return { canDownload: true, message: '' }
    if (selectedEpisode < material.availableUntilEpisode) return { canDownload: true, message: '' }
    if (selectedEpisode === material.availableUntilEpisode) {
      if (!currentClass || !material.availableUntilClass) return { canDownload: true, message: '' }
      if (currentClass.number <= material.availableUntilClass) return { canDownload: true, message: `(${material.availableUntilClass}교시까지 다운로드 가능)` }
      return { canDownload: false, message: `(${material.availableUntilEpisode}회차 ${material.availableUntilClass}교시까지만)` }
    }
    return { canDownload: false, message: `(${material.availableUntilEpisode}회차까지만 다운로드 가능)` }
  }

  if (!pageLoaded || !user) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: '#080C10' }}><div className="app-spinner" /></div>
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 text-center" style={{ background: '#080C10' }}>
        <p style={{ fontSize: '3rem' }}>🔍</p>
        <p style={{ fontSize: '18px', fontWeight: '700', color: 'white' }}>강의를 찾을 수 없습니다</p>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>이 강의 정보가 없거나 삭제되었습니다.</p>
        <button onClick={() => router.push('/student')} className="btn-gold" style={{ padding: '10px 24px', fontSize: '13px' }}>← 내 강의로 돌아가기</button>
      </div>
    )
  }

  const hour = new Date(nowTick).getHours()
  const greeting = hour < 6 ? '늦은 시간이네요' : hour < 12 ? '좋은 아침이에요' : hour < 18 ? '좋은 오후예요' : '좋은 저녁이에요'
  const sig = signal(accuracy)
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)
  const gaugePct = radius && liveDistance != null ? Math.min(100, Math.round((liveDistance / radius) * 100)) : 0

  // GPS 거리 상태에 따른 색상
  const distColor = inRange ? '#4ade80' : borderline ? '#facc15' : '#fb923c'
  const distBg = inRange ? 'rgba(74,222,128,0.08)' : borderline ? 'rgba(250,204,21,0.08)' : 'rgba(251,146,60,0.08)'
  const distBorder = inRange ? 'rgba(74,222,128,0.25)' : borderline ? 'rgba(250,204,21,0.25)' : 'rgba(251,146,60,0.20)'

  return (
    <div className="min-h-screen" style={{ background: '#080C10' }}>
      {/* 네비게이션 */}
      <nav style={{ background: '#0D1218', borderBottom: '1px solid rgba(255,255,255,0.07)' }} className="sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <button onClick={() => router.push('/student')} className="rd-nav-btn flex items-center gap-1.5">
            ← 돌아가기
          </button>
          <h1 style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.75)' }}>{course.name}</h1>
          <button onClick={() => { doLogout(user?.id).then(() => { setUser(null); router.push('/login') }) }} className="rd-nav-btn">
            <LogOut style={{ width: '15px', height: '15px' }} />
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-8">

        {/* 공지사항 */}
        {notice && (
          <div style={{ background: 'rgba(201,148,26,0.08)', border: '1px solid rgba(201,148,26,0.28)', padding: '18px 20px', marginBottom: '24px' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', color: '#C9941A', marginBottom: '8px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>공지사항</p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.70)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{notice}</p>
          </div>
        )}

        {/* 헤더 */}
        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '10px', fontWeight: '700', color: '#C9941A', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '8px' }}>Course</p>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white' }}>{course.name}</h2>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>강사: {course.instructor}</p>
        </div>

        {/* 회차 선택 */}
        {course?.courseType === 'episode' && (
          <div style={{ background: 'rgba(201,148,26,0.07)', border: '1px solid rgba(201,148,26,0.22)', padding: '18px 20px', marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#C9941A', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: '10px' }}>회차 선택</label>
            <select value={selectedEpisode} onChange={(e) => setSelectedEpisode(Number(e.target.value))} className="rd-select" style={{ width: '100%' }}>
              {Array.from({ length: course.episodeCount || 1 }, (_, i) => (
                <option key={i+1} value={i+1}>{i+1}회차</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* ===== 출석 등록 카드 ===== */}
          <div className="rd-surface p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock style={{ width: '16px', height: '16px', color: '#C9941A' }} />
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'white' }}>출석 등록</h3>
              </div>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.30)' }}>{greeting}, {user.name}님</span>
            </div>
            <div className="flex items-center gap-1.5 mb-4">
              <MapPin style={{ width: '12px', height: '12px', color: '#C9941A' }} />
              <span style={{ fontSize: '11px', color: '#C9941A', fontWeight: '600' }}>현장 위치 확인 방식</span>
            </div>

            {!liveSession ? (
              /* 세션 없음 */
              <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.12)', padding: '28px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📡</p>
                <p style={{ fontSize: '14px', fontWeight: '700', color: 'rgba(255,255,255,0.70)', marginBottom: '6px' }}>아직 출석이 시작되지 않았어요</p>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.30)', lineHeight: 1.6, marginBottom: '16px' }}>관리자가 현장 위치 출석을 시작하면<br />이 화면에서 바로 출석할 수 있어요.</p>
                <button onClick={() => refreshSession(true)} disabled={sessionRefreshing} className="btn-gold" style={{ padding: '9px 20px', fontSize: '13px', opacity: sessionRefreshing ? 0.5 : 1 }}>
                  {sessionRefreshing ? '확인 중...' : '지금 다시 확인'}
                </button>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.20)', marginTop: '12px' }}>20초마다 자동으로 확인하고 있어요</p>
              </div>
            ) : isAttended ? (
              /* 출석 완료 */
              <div className="flex flex-col gap-3">
                <div style={{ background: 'rgba(201,148,26,0.12)', border: '1px solid rgba(201,148,26,0.30)', padding: '20px', textAlign: 'center' }}>
                  <p style={{ fontSize: '2rem', marginBottom: '6px' }}>🎉</p>
                  <p style={{ fontSize: '18px', fontWeight: '800', color: '#C9941A' }}>출석 인정 완료!</p>
                  <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>현장 위치가 확인되었습니다</p>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', padding: '14px 16px' }} className="flex flex-col gap-2">
                  {(
                    [
                      ['출석 시각', verified?.enterTime || attendanceStartTime],
                      verified?.distance != null ? ['확인된 거리', `현장에서 약 ${verified.distance}m`] : null,
                      verified?.accuracy != null ? ['GPS 정확도', `±${verified.accuracy}m`] : null,
                      ['이 강의 출석', `${attendances}번째`],
                    ].filter(Boolean) as [string, string][]
                  ).map(([label, value]) => (
                    <div key={label as string} className="flex items-center justify-between">
                      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.38)' }}>{label}</span>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.80)' }}>{value}</span>
                    </div>
                  ))}
                </div>
                {verified?.lat != null && (
                  <a href={`https://www.google.com/maps?q=${verified.lat},${verified.lng}`} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#C9941A', padding: '9px', border: '1px solid rgba(201,148,26,0.30)', textDecoration: 'none', background: 'rgba(201,148,26,0.06)' }}>
                    🗺️ 내가 출석한 위치 지도로 보기
                  </a>
                )}
                {markedExit && (
                  <a href={`https://www.google.com/maps?q=${markedExit.lat},${markedExit.lng}`} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#4ade80', padding: '9px', border: '1px solid rgba(74,222,128,0.25)', textDecoration: 'none', background: 'rgba(74,222,128,0.06)' }}>
                    🗺️ 내가 퇴장한 위치 지도로 보기
                  </a>
                )}
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.22)', textAlign: 'center' }}>배터리 절약을 위해 출석 후 위치 추적을 멈춰요</p>
                {liveSession && <p style={{ fontSize: '11px', color: '#fb923c', textAlign: 'center', fontWeight: '600' }}>퇴장 시 GPS 위치 확인 필요 · 수업 종료 후 30분 이내</p>}
                <button onClick={handleEndClass} disabled={locBusy} className="btn-gold" style={{ width: '100%', height: '44px', fontSize: '13px', opacity: locBusy ? 0.5 : 1, background: locBusy ? 'rgba(201,148,26,0.40)' : '#C9941A' }}>
                  {locBusy ? '위치 확인 중...' : '🚪 수강 종료 (퇴장 위치 기록)'}
                </button>
              </div>
            ) : isConfirmingAttendance && selectedStatus === 'excused' ? (
              /* 공가 신청 */
              <div className="flex flex-col gap-3">
                <p style={{ fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.55)', marginBottom: '4px' }}>사유 분류:</p>
                <div className="grid grid-cols-3 gap-2">
                  {([['ceremony', '경조사'], ['hospital', '병원'], ['exam', '자격증/시험']] as const).map(([key, label]) => (
                    <button key={key} onClick={() => setAbsenceCategory(key)} style={{ padding: '9px 4px', fontSize: '12px', fontWeight: '600', border: '1px solid', borderColor: absenceCategory === key ? '#C9941A' : 'rgba(255,255,255,0.10)', background: absenceCategory === key ? 'rgba(201,148,26,0.15)' : 'rgba(255,255,255,0.03)', color: absenceCategory === key ? '#C9941A' : 'rgba(255,255,255,0.55)', cursor: 'pointer', transition: 'all 0.12s' }}>
                      {label}
                    </button>
                  ))}
                </div>
                <textarea value={absenceReason} onChange={(e) => setAbsenceReason(e.target.value)} placeholder="구체적인 사유를 입력하세요" rows={2}
                  style={{ background: '#111820', border: '1px solid rgba(255,255,255,0.09)', color: 'white', padding: '10px 14px', fontSize: '13px', resize: 'none', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
                <div className="flex gap-2">
                  <button onClick={() => { setIsConfirmingAttendance(false); setSelectedStatus(null); setAbsenceCategory(null); setAbsenceReason('') }}
                    style={{ flex: 1, height: '42px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.50)', fontSize: '13px', cursor: 'pointer' }}>취소</button>
                  <button onClick={handleExcuse} disabled={!absenceCategory || !absenceReason.trim()} className="btn-gold" style={{ flex: 2, height: '42px', fontSize: '13px', opacity: (!absenceCategory || !absenceReason.trim()) ? 0.4 : 1 }}>공가 신청</button>
                </div>
              </div>
            ) : (
              /* 출석 전 — 실시간 위치 */
              <div className="flex flex-col gap-3">
                {geoError === 'denied' ? (
                  <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)', padding: '16px', textAlign: 'center' }}>
                    <p style={{ fontSize: '2rem', marginBottom: '6px' }}>🔒</p>
                    <p style={{ fontSize: '13px', fontWeight: '700', color: '#f87171', marginBottom: '6px' }}>위치 권한이 꺼져 있어요</p>
                    <p style={{ fontSize: '11px', color: 'rgba(239,68,68,0.70)', lineHeight: 1.6 }}>{isIOS ? '설정 > Safari > 위치 > "허용"' : '주소창 🔒 > 권한 > 위치 > 허용'} 으로 켠 뒤 새로고침하세요.</p>
                  </div>
                ) : geoError === 'unavailable' || liveDistance == null ? (
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', padding: '20px', textAlign: 'center' }}>
                    <div className="app-spinner mx-auto mb-3" />
                    <p style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.60)' }}>GPS로 현장까지 거리를 재고 있어요…</p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '6px' }}>실외나 창가에서 더 정확해요</p>
                  </div>
                ) : (
                  <>
                    <div style={{ background: distBg, border: `1px solid ${distBorder}`, padding: '16px', textAlign: 'center' }}>
                      <p style={{ fontSize: '18px', fontWeight: '800', color: distColor }}>
                        {inRange ? '위치 맞음 ✅' : borderline ? '거의 다 왔어요 🟡' : '현장 밖 📍'}
                      </p>
                      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginTop: '6px' }}>
                        현장까지 <span style={{ fontWeight: '700', color: 'white' }}>{fmtDist(liveDistance)}</span>
                        {trend === 'closer' && <span style={{ color: '#4ade80', fontWeight: '700' }}> 가까워지는 중</span>}
                        {trend === 'farther' && <span style={{ color: '#f87171', fontWeight: '700' }}> 멀어지는 중</span>}
                      </p>
                      {!inRange && radius != null && (
                        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.30)', marginTop: '4px' }}>
                          {borderline ? 'GPS 오차 범위 안이에요. 한 걸음만 더!' : `허용 반경 ${radius}m 안으로 이동하세요`}
                        </p>
                      )}
                    </div>

                    {radius != null && (
                      <div>
                        <div style={{ height: '2px', background: 'rgba(255,255,255,0.08)', borderRadius: '1px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: distColor, width: `${Math.max(4, gaugePct)}%`, transition: 'width 0.5s ease, background 0.3s' }} />
                        </div>
                        <div className="flex justify-between" style={{ marginTop: '4px' }}>
                          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.22)' }}>현장 중심</span>
                          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.22)' }}>반경 {radius}m{!inRange && liveDistance! > radius ? ` (+${liveDistance! - radius}m 초과)` : ''}</span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', padding: '8px 12px' }}>
                      <span className="flex items-center gap-1.5">
                        <Wifi style={{ width: '13px', height: '13px', color: sig.color }} />
                        <span style={{ fontSize: '11px', fontWeight: '700', color: sig.color }}>GPS {sig.text}</span>
                        <span className="inline-flex items-end gap-0.5" style={{ marginLeft: '2px' }}>
                          {[1,2,3].map((b) => <span key={b} style={{ width: '3px', borderRadius: '1px', height: `${b*3+2}px`, background: b <= sig.bars ? sig.color : 'rgba(255,255,255,0.12)' }} />)}
                        </span>
                      </span>
                      <span className="flex items-center gap-1" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                        <Crosshair style={{ width: '12px', height: '12px' }} /> ±{accuracy ?? '-'}m
                      </span>
                      {geoAgo != null && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.22)' }}>{geoAgo < 2 ? '방금 갱신' : `${geoAgo}초 전`}</span>}
                    </div>

                    {accuracy != null && accuracy > 80 && (
                      <p style={{ fontSize: '11px', color: '#fb923c', textAlign: 'center' }}>GPS 신호가 약해요. 실외/창가에서 잠시 기다리면 더 정확해져요.</p>
                    )}
                    {msLeft != null && !sessionEnded && (
                      <p style={{ fontSize: '12px', textAlign: 'center', color: 'rgba(255,255,255,0.35)' }}>출석 마감까지 <span style={{ fontWeight: '700', fontFamily: 'monospace', color: 'rgba(255,255,255,0.70)' }}>{fmtDur(msLeft)}</span></p>
                    )}
                  </>
                )}

                {/* 출석 버튼 */}
                <button
                  onClick={handleLocationCheckin}
                  disabled={locBusy || sessionEnded || (liveDistance != null && !inRange && !borderline)}
                  style={{
                    width: '100%', height: '52px', fontSize: '14px', fontWeight: '700', border: 'none', cursor: 'pointer',
                    background: (inRange || borderline) && !locBusy && !sessionEnded ? '#C9941A' : 'rgba(255,255,255,0.08)',
                    color: (inRange || borderline) && !locBusy && !sessionEnded ? 'white' : 'rgba(255,255,255,0.35)',
                    opacity: locBusy || sessionEnded || (liveDistance != null && !inRange && !borderline) ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    transition: 'background 0.15s',
                  }}
                >
                  <Navigation style={{ width: '16px', height: '16px' }} />
                  {locBusy ? '위치 확인 중...' : sessionEnded ? '출석 시간이 종료되었습니다' : liveDistance == null ? '위치 확인 후 출석' : inRange ? '지금 출석하기 (위치 맞음)' : borderline ? '출석 시도하기 (경계)' : `현장까지 ${fmtDist(liveDistance != null && radius != null ? liveDistance - radius : null)} 더`}
                </button>

                {liveSession?.venue_lat != null && (
                  <a href={`https://www.google.com/maps?q=${liveSession.venue_lat},${liveSession.venue_lng}`} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.30)', textDecoration: 'none' }}>
                    🏫 출석 현장 위치 지도로 보기
                  </a>
                )}

                <button onClick={() => { setSelectedStatus('excused'); setIsConfirmingAttendance(true) }}
                  style={{ width: '100%', height: '40px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                  못 오는 경우 — 공가 신청
                </button>
              </div>
            )}
          </div>

          {/* 출석 현황 */}
          <div className="rd-surface p-6 flex flex-col justify-center">
            <div className="accent-bar" />
            <h3 style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginBottom: '20px' }}>출석 현황</h3>
            <div>
              {[
                { label: '출석', value: attendances, color: '#C9941A', always: true },
                { label: '지각', value: lateCount, color: '#facc15', always: false },
                { label: '결석', value: absentCount, color: '#f87171', always: false },
                { label: '공가', value: excusedCount, color: 'rgba(255,255,255,0.40)', always: true },
              ].filter((r) => r.always || r.value > 0).map((row, i, arr) => (
                <div key={row.label} className="flex items-center justify-between" style={{ padding: '12px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>{row.label}</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: row.color }}>{row.value}회</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 과제 제출 */}
        <div className="rd-surface p-6 mb-6">
          <div className="accent-bar" />
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'rgba(255,255,255,0.80)', marginBottom: '20px' }} className="flex items-center gap-2">
            <Upload style={{ width: '16px', height: '16px', color: '#C9941A' }} /> 과제 제출
          </h3>

          <div style={{ border: '1px dashed rgba(201,148,26,0.30)', padding: '24px', textAlign: 'center', marginBottom: '16px', background: 'rgba(201,148,26,0.04)' }}>
            <input ref={submitInputRef} type="file" className="hidden" id="submit-file-input" onChange={(e) => setSubmitFile(e.target.files?.[0] || null)} />
            {submitFile ? (
              <div className="flex flex-col gap-3 items-center">
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#C9941A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText style={{ width: '15px', height: '15px' }} /> {submitFile.name}
                </p>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.30)' }}>{(submitFile.size / 1024).toFixed(1)} KB</p>
                <div className="flex gap-2">
                  <button onClick={() => { setSubmitFile(null); if (submitInputRef.current) submitInputRef.current.value = '' }}
                    style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.50)', fontSize: '12px', cursor: 'pointer' }}>취소</button>
                  <button onClick={handleFileSubmit} disabled={submitting} className="btn-gold flex items-center gap-2" style={{ padding: '8px 20px', fontSize: '12px', opacity: submitting ? 0.5 : 1 }}>
                    <Upload style={{ width: '13px', height: '13px' }} /> {submitting ? '제출 중...' : '제출하기'}
                  </button>
                </div>
              </div>
            ) : (
              <label htmlFor="submit-file-input" style={{ cursor: 'pointer', display: 'block' }}>
                <p style={{ fontSize: '2rem', marginBottom: '8px' }}>📎</p>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#C9941A' }}>클릭해서 파일 선택</p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '4px' }}>최대 50MB · PDF, 이미지, Word, 압축파일 등</p>
              </label>
            )}
          </div>

          {submissions.length > 0 && (
            <div>
              <p style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>제출 내역</p>
              <div className="flex flex-col gap-2">
                {submissions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', padding: '12px 14px' }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText style={{ width: '14px', height: '14px', color: '#C9941A', flexShrink: 0 }} />
                      <div className="min-w-0">
                        <p style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.75)' }} className="truncate">{s.file_name}</p>
                        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)', marginTop: '2px' }}>{new Date(s.submitted_at).toLocaleString('ko-KR')}{s.file_size ? ` · ${(s.file_size/1024).toFixed(1)} KB` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {s.grade && <span style={{ fontSize: '11px', fontWeight: '700', color: '#4ade80', padding: '2px 8px', border: '1px solid rgba(74,222,128,0.30)', background: 'rgba(74,222,128,0.08)' }}>{s.grade}</span>}
                      <a href={`/api/submissions/download?id=${s.id}`} target="_blank" rel="noopener noreferrer" style={{ padding: '6px', color: '#C9941A' }}>
                        <Download style={{ width: '14px', height: '14px' }} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 강의 자료 */}
        <div className="rd-surface p-6">
          <div className="accent-bar" />
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'rgba(255,255,255,0.80)', marginBottom: '20px' }}>강의 자료</h3>
          {materials.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '32px 0' }}>등록된 강의 자료가 없습니다</p>
          ) : (
            <div className="flex flex-col gap-2">
              {materials.map((material: any) => {
                const { canDownload, message } = getMaterialStatus(material)
                return (
                  <div key={material.id} onClick={() => {
                    if (!canDownload) { toast.error(`다운로드 불가능 ${message}`); return }
                    if (material.data) { const link = document.createElement('a'); link.href = material.data; link.download = material.name; link.click(); toast.success(`${material.name} 다운로드 시작`) }
                  }}
                    style={{ padding: '14px 16px', borderLeft: `3px solid ${canDownload ? '#C9941A' : '#ef4444'}`, background: canDownload ? 'rgba(201,148,26,0.04)' : 'rgba(239,68,68,0.04)', cursor: canDownload ? 'pointer' : 'not-allowed', opacity: canDownload ? 1 : 0.6, transition: 'background 0.12s' }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.80)', marginBottom: '4px' }}>📄 {material.name}</p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.30)' }}>{material.size}</p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.22)', marginTop: '2px' }}>📅 {material.uploadedAt}</p>
                    <p style={{ fontSize: '11px', color: canDownload ? '#C9941A' : '#f87171', marginTop: '6px' }}>
                      {canDownload ? `💾 클릭해서 다운로드 ${message}` : `🔒 다운로드 불가능 ${message}`}
                    </p>
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
