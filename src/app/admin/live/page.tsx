'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MapPin, Radio, Users } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import { Course } from '@/types'

interface LiveSession {
  id: string
  name: string
  course_id: string
  radius_m: number
  venue_lat: number
  venue_lng: number
  ends_at: string
}

export default function AdminLivePage() {
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [courseId, setCourseId] = useState('')
  const [name, setName] = useState('')
  const [venue, setVenue] = useState<{ lat: number; lng: number } | null>(null)
  const [venueLabel, setVenueLabel] = useState('')
  const [address, setAddress] = useState('')
  const [geocoding, setGeocoding] = useState(false)
  const [radius, setRadius] = useState(150)
  const [duration, setDuration] = useState(180)
  const [creating, setCreating] = useState(false)

  const [session, setSession] = useState<LiveSession | null>(null)
  const [records, setRecords] = useState<any[]>([])
  const [origin, setOrigin] = useState('')
  const recTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
    const saved = localStorage.getItem('user')
    if (!saved || !JSON.parse(saved).isAdmin) {
      router.push('/login')
      return
    }
    const c = localStorage.getItem('courses')
    if (c) {
      const list = JSON.parse(c)
      setCourses(list)
      if (list[0]) {
        setCourseId(list[0].id)
        setName(`${list[0].name} 출석`)
      }
    }
  }, [router])

  const getLocation = () => {
    if (!navigator.geolocation) return toast.error('이 기기는 위치를 지원하지 않습니다')
    toast.loading('현재 위치 확인 중...', { id: 'loc' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setVenue({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setVenueLabel('현재 위치')
        toast.success('✅ 현재 위치를 현장으로 설정했습니다', { id: 'loc' })
      },
      () => toast.error('위치 권한을 허용해주세요', { id: 'loc' }),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const geocodeAddress = async () => {
    if (address.trim().length < 2) return toast.error('주소를 입력하세요')
    setGeocoding(true)
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '주소를 찾을 수 없습니다')
        return
      }
      setVenue({ lat: data.lat, lng: data.lng })
      setVenueLabel(data.displayName || address)
      toast.success('✅ 주소로 현장을 설정했습니다')
    } catch {
      toast.error('주소 검색 오류')
    } finally {
      setGeocoding(false)
    }
  }

  const startSession = async () => {
    if (!courseId || !name.trim()) return toast.error('강의와 이름을 입력하세요')
    if (!venue) return toast.error('현장 위치를 먼저 설정하세요')

    setCreating(true)
    try {
      const res = await fetch('/api/live/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          name,
          venueLat: venue.lat,
          venueLng: venue.lng,
          radiusM: radius,
          durationMin: duration,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '세션 생성 실패')
        return
      }
      setSession(data.session)
      toast.success('🛰️ 라이브 출석 시작! 이제 신경 안 쓰셔도 됩니다.')
    } catch {
      toast.error('네트워크 오류')
    } finally {
      setCreating(false)
    }
  }

  // 출석자 실시간 폴링
  useEffect(() => {
    if (!session) return
    const poll = async () => {
      try {
        const res = await fetch(`/api/live/records?session=${session.id}`, { cache: 'no-store' })
        const data = await res.json()
        if (res.ok) setRecords(data.records || [])
      } catch {}
    }
    poll()
    recTimer.current = setInterval(poll, 5000)
    return () => {
      if (recTimer.current) clearInterval(recTimer.current)
    }
  }, [session])

  const attendUrl = session ? `${origin}/live?session=${session.id}` : ''
  const presentCount = records.filter((r) => (r.final || r.status) === 'present').length
  const acceptedCount = records.filter((r) => r.final === 'accepted').length

  const fmt = (t: string | null) => (t ? new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-')

  // 최종 표시 라벨
  const label = (r: any): { text: string; cls: string; dot: string } => {
    const s = r.final || r.status
    if (s === 'accepted') return { text: '인정', cls: 'text-green-700', dot: '🟢' }
    if (s === 'present') return { text: '현장', cls: 'text-blue-700', dot: '🔵' }
    if (s === 'left') return { text: '이탈', cls: 'text-orange-700', dot: '🟠' }
    return { text: '조퇴(미인정)', cls: 'text-red-700', dot: '🔴' }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100">
      <nav className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/admin')} className="flex items-center gap-2 text-blue-600 font-medium hover:underline">
            <ArrowLeft className="w-4 h-4" /> 돌아가기
          </button>
          <h1 className="text-xl font-bold text-gray-900">🛰️ 위치 기반 자동 출석</h1>
          <span />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {!session ? (
          /* ===== 세션 생성 ===== */
          <div className="bg-white rounded-2xl shadow p-8 max-w-xl mx-auto space-y-5">
            <h2 className="text-2xl font-bold text-gray-900">새 출석 시작</h2>
            <p className="text-sm text-gray-500">현장 위치만 정하면, 입장·퇴장은 학생 위치로 자동 처리됩니다.</p>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">강의</label>
              <select
                value={courseId}
                onChange={(e) => {
                  setCourseId(e.target.value)
                  const c = courses.find((x) => x.id === e.target.value)
                  if (c) setName(`${c.name} 출석`)
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-semibold bg-white"
              >
                {courses.length === 0 && <option value="">강의 없음</option>}
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">출석 이름</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-semibold"
                placeholder="예: 6월 25일 1교시"
              />
            </div>

            {/* 현장 위치 설정 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <p className="font-bold text-gray-800">📍 현장 위치 설정</p>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">주소로 지정</label>
                <div className="flex gap-2">
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && geocodeAddress()}
                    placeholder="예: 서울특별시 중구 세종대로 110"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-semibold text-sm"
                  />
                  <button onClick={geocodeAddress} disabled={geocoding} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 rounded-lg text-sm disabled:opacity-50 whitespace-nowrap">
                    {geocoding ? '검색중' : '🔍 설정'}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">또는</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              <button onClick={getLocation} className="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2">
                <MapPin className="w-4 h-4" /> 현재 내 위치로 설정
              </button>

              {venue && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-xs text-green-800 font-bold">✅ 현장 설정됨</p>
                  {venueLabel && <p className="text-xs text-green-700 mt-1 break-words">{venueLabel}</p>}
                  <p className="text-xs text-green-600 mt-1">좌표: {venue.lat.toFixed(5)}, {venue.lng.toFixed(5)}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">허용 반경: {radius}m</label>
                <input type="range" min={30} max={500} step={10} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full" />
                <p className="text-xs text-gray-500">실내/건물은 GPS 오차가 커서 100~200m 권장</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">지속 시간: {duration}분</label>
              <input type="range" min={10} max={360} step={10} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full" />
            </div>

            <button onClick={startSession} disabled={creating} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl text-lg disabled:opacity-50 flex items-center justify-center gap-2">
              <Radio className="w-5 h-5" /> {creating ? '시작 중...' : '출석 시작 (이후 자동)'}
            </button>
          </div>
        ) : (
          /* ===== 진행 중 ===== */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl shadow-xl p-8 text-center text-white">
              <p className="text-lg font-semibold">{session.name}</p>
              <p className="text-sm opacity-80 mb-4">학생은 이 QR로 접속만 하면 자동 출석됩니다</p>
              <div className="bg-white rounded-xl p-4 inline-block">
                {attendUrl && <QRCodeSVG value={attendUrl} size={200} level="M" />}
              </div>
              <p className="text-xs opacity-80 mt-4">또는 {origin}/live 접속</p>
              <div className="bg-white/15 rounded-lg p-3 mt-5 text-sm">
                📍 현장 반경 <b>{session.radius_m}m</b> 안에서만 인정 · 벗어나면 자동 퇴장
              </div>
              <p className="text-xs opacity-70 mt-4">✅ 이제 관리자는 신경 쓸 게 없습니다. 자동으로 출·퇴장이 기록됩니다.</p>
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Users className="w-5 h-5" /> 실시간 출석
                </h3>
                <div className="flex gap-2">
                  <span className="bg-green-100 text-green-800 font-bold px-3 py-1 rounded-full text-sm">현장 {presentCount}</span>
                  {acceptedCount > 0 && <span className="bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full text-sm">인정 {acceptedCount}</span>}
                  <span className="bg-gray-100 text-gray-700 font-bold px-3 py-1 rounded-full text-sm">전체 {records.length}</span>
                </div>
              </div>
              <div className="space-y-2 max-h-[440px] overflow-y-auto">
                {records.length === 0 ? (
                  <p className="text-gray-400 text-center py-12">아직 출석한 사람이 없습니다</p>
                ) : (
                  records.map((r, i) => {
                    const lb = label(r)
                    return (
                      <div key={i} className="flex items-center justify-between rounded-lg px-4 py-2 border bg-gray-50 border-gray-200">
                        <div>
                          <span className="font-semibold text-gray-900">{lb.dot} {r.user_name || r.user_id}</span>
                          <p className="text-xs text-gray-500">
                            입장 {fmt(r.entry_at)}{r.exit_at ? ` · 퇴장 ${fmt(r.exit_at)}` : ''}
                            {r.entry_distance_m != null ? ` · 약 ${r.entry_distance_m}m` : ''}
                          </p>
                          <div className="flex items-center gap-2">
                            {r.entry_lat != null && r.entry_lng != null && (
                              <a
                                href={`https://www.google.com/maps?q=${r.entry_lat},${r.entry_lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline font-medium"
                              >
                                🗺️ 출석 위치
                              </a>
                            )}
                            {r.exit_lat != null && r.exit_lng != null && (
                              <a
                                href={`https://www.google.com/maps?q=${r.exit_lat},${r.exit_lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-green-600 hover:underline font-medium"
                              >
                                🚪 퇴장 위치
                              </a>
                            )}
                          </div>
                        </div>
                        <span className={`text-xs font-bold ${lb.cls}`}>{lb.text}</span>
                      </div>
                    )
                  })
                )}
              </div>
              <button onClick={() => setSession(null)} className="w-full mt-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 rounded-lg">
                닫기 (출석은 계속 자동 진행)
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
