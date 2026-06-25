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
  require_gps: boolean
  ends_at: string
}

export default function AdminLivePage() {
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [courseId, setCourseId] = useState('')
  const [name, setName] = useState('')
  const [requireGps, setRequireGps] = useState(true)
  const [venue, setVenue] = useState<{ lat: number; lng: number } | null>(null)
  const [radius, setRadius] = useState(150)
  const [duration, setDuration] = useState(180)
  const [creating, setCreating] = useState(false)

  const [session, setSession] = useState<LiveSession | null>(null)
  const [code, setCode] = useState('------')
  const [records, setRecords] = useState<any[]>([])
  const [origin, setOrigin] = useState('')

  const codeTimer = useRef<NodeJS.Timeout | null>(null)
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
    if (!navigator.geolocation) {
      toast.error('이 기기는 위치를 지원하지 않습니다')
      return
    }
    toast.loading('현재 위치 확인 중...', { id: 'loc' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setVenue({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        toast.success('✅ 현재 위치를 현장으로 설정했습니다', { id: 'loc' })
      },
      () => toast.error('위치 권한을 허용해주세요', { id: 'loc' }),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const startSession = async () => {
    if (!courseId || !name.trim()) return toast.error('강의와 이름을 입력하세요')
    if (requireGps && !venue) return toast.error('현장 위치를 먼저 설정하세요')

    setCreating(true)
    try {
      const res = await fetch('/api/live/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          name,
          requireGps,
          venueLat: venue?.lat,
          venueLng: venue?.lng,
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
      toast.success('🛰️ 라이브 출석 시작!')
    } catch {
      toast.error('네트워크 오류')
    } finally {
      setCreating(false)
    }
  }

  // 코드/출석자 폴링
  useEffect(() => {
    if (!session) return

    const pollCode = async () => {
      try {
        const res = await fetch(`/api/live/code?session=${session.id}`, { cache: 'no-store' })
        const data = await res.json()
        if (res.ok && data.code) setCode(data.code)
      } catch {}
    }
    const pollRecords = async () => {
      try {
        const res = await fetch(`/api/live/records?session=${session.id}`, { cache: 'no-store' })
        const data = await res.json()
        if (res.ok) setRecords(data.records || [])
      } catch {}
    }

    pollCode()
    pollRecords()
    codeTimer.current = setInterval(pollCode, 3000)
    recTimer.current = setInterval(pollRecords, 5000)

    return () => {
      if (codeTimer.current) clearInterval(codeTimer.current)
      if (recTimer.current) clearInterval(recTimer.current)
    }
  }, [session])

  const attendUrl = session ? `${origin}/live?session=${session.id}` : ''

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-100">
      <nav className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/admin')} className="flex items-center gap-2 text-blue-600 font-medium hover:underline">
            <ArrowLeft className="w-4 h-4" /> 돌아가기
          </button>
          <h1 className="text-xl font-bold text-gray-900">🛰️ 라이브 출석 (서버 검증)</h1>
          <span />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {!session ? (
          /* ===== 세션 생성 ===== */
          <div className="bg-white rounded-2xl shadow p-8 max-w-xl mx-auto space-y-5">
            <h2 className="text-2xl font-bold text-gray-900">새 라이브 출석 시작</h2>

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

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
              <label className="flex items-center gap-2 font-bold text-gray-800">
                <input type="checkbox" checked={requireGps} onChange={(e) => setRequireGps(e.target.checked)} className="w-5 h-5" />
                📍 위치(GPS) 검증 사용
              </label>
              {requireGps && (
                <>
                  <button onClick={getLocation} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2">
                    <MapPin className="w-4 h-4" /> 현재 위치를 현장으로 설정
                  </button>
                  {venue && (
                    <p className="text-xs text-green-700 font-semibold text-center">
                      ✅ 현장: {venue.lat.toFixed(5)}, {venue.lng.toFixed(5)}
                    </p>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">허용 반경: {radius}m</label>
                    <input type="range" min={30} max={500} step={10} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="w-full" />
                    <p className="text-xs text-gray-500">실내/건물은 GPS 오차가 커서 100~200m 권장</p>
                  </div>
                </>
              )}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">지속 시간: {duration}분</label>
              <input type="range" min={10} max={360} step={10} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full" />
            </div>

            <button
              onClick={startSession}
              disabled={creating}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl text-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Radio className="w-5 h-5" /> {creating ? '시작 중...' : '라이브 출석 시작'}
            </button>
          </div>
        ) : (
          /* ===== 진행 중: 회전 코드 + 출석자 ===== */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-2xl shadow-xl p-8 text-center text-white">
              <p className="text-lg font-semibold opacity-90">{session.name}</p>
              <p className="text-sm opacity-70 mb-6">현장 화면에 띄워주세요 · 15초마다 갱신</p>
              <p className="text-7xl md:text-8xl font-black tracking-widest tabular-nums my-6">{code}</p>
              <p className="text-sm opacity-80">{session.require_gps ? `📍 현장 반경 ${session.radius_m}m 안에서만 인정` : '위치 검증 없음'}</p>

              <div className="bg-white rounded-xl p-4 mt-6 inline-block">
                {attendUrl && <QRCodeSVG value={attendUrl} size={160} level="M" />}
              </div>
              <p className="text-xs opacity-80 mt-3">학생: QR 스캔 또는 {origin}/live</p>
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Users className="w-5 h-5" /> 실시간 출석
                </h3>
                <span className="bg-green-100 text-green-800 font-bold px-3 py-1 rounded-full">{records.length}명</span>
              </div>
              <div className="space-y-2 max-h-[420px] overflow-y-auto">
                {records.length === 0 ? (
                  <p className="text-gray-400 text-center py-12">아직 출석한 사람이 없습니다</p>
                ) : (
                  records.map((r, i) => (
                    <div key={i} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                      <span className="font-semibold text-gray-900">✅ {r.user_name || r.user_id}</span>
                      <span className="text-xs text-gray-500">
                        {r.distance_m != null ? `${r.distance_m}m · ` : ''}
                        {new Date(r.created_at).toLocaleTimeString('ko-KR')}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <button onClick={() => setSession(null)} className="w-full mt-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 rounded-lg">
                닫기 (세션은 계속 유효)
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
