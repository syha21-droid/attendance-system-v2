'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MapPin, QrCode, Users, Camera, CheckCircle2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { Course } from '@/types'
import { loadCourses } from '@/lib/dataStore'

interface LiveSession {
  id: string
  name: string
  course_id: string
  radius_m: number
  venue_lat: number
  venue_lng: number
  ends_at: string
}

interface Flash {
  ok: boolean
  name: string
  msg: string
}

export default function AdminQrScannerPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [courseId, setCourseId] = useState('')
  const [name, setName] = useState('')
  const [venue, setVenue] = useState<{ lat: number; lng: number } | null>(null)
  const [venueLabel, setVenueLabel] = useState('')
  const [address, setAddress] = useState('')
  const [geocoding, setGeocoding] = useState(false)
  const [radius, setRadius] = useState(200)
  const [creating, setCreating] = useState(false)

  const [session, setSession] = useState<LiveSession | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scans, setScans] = useState<any[]>([])
  const [flash, setFlash] = useState<Flash | null>(null)

  const scannerRef = useRef<any>(null)
  const startingRef = useRef(false)
  const lastScanRef = useRef<{ token: string; at: number }>({ token: '', at: 0 })
  const busyRef = useRef(false)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const flashTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('user')
    if (!saved || !JSON.parse(saved).isAdmin) {
      router.push('/login')
      return
    }
    ;(async () => {
      const list = await loadCourses()
      setCourses(list)
      if (list[0]) {
        setCourseId(list[0].id)
        setName(`${list[0].name} QR 출석`)
      }
    })()
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
          durationMin: 360,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || '세션 생성 실패')
        return
      }
      setSession(data.session)
      toast.success('📷 QR 인식기 준비 완료. 학생 QR을 비추세요.')
    } catch {
      toast.error('네트워크 오류')
    } finally {
      setCreating(false)
    }
  }

  // 인식 목록 실시간 폴링
  useEffect(() => {
    if (!session) return
    const poll = async () => {
      try {
        const res = await fetch(`/api/qr/scans?session=${session.id}`, { cache: 'no-store' })
        const data = await res.json()
        if (res.ok) setScans(data.scans || [])
      } catch {}
    }
    poll()
    pollRef.current = setInterval(poll, 4000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [session])

  const showFlash = useCallback((f: Flash) => {
    setFlash(f)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(null), 2200)
  }, [])

  // QR 스캔 처리
  const handleDecoded = useCallback(
    async (token: string) => {
      if (!session) return
      const now = Date.now()
      // 같은 코드 연속 인식 / 처리 중 무시
      if (busyRef.current) return
      if (token === lastScanRef.current.token && now - lastScanRef.current.at < 3000) return
      lastScanRef.current = { token, at: now }
      busyRef.current = true
      try {
        const res = await fetch('/api/qr/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: session.id, token }),
        })
        const d = await res.json()
        if (d.ok) {
          const distStr =
            d.hasLocation && d.distance != null
              ? d.inRange
                ? `현장 ✅ (약 ${d.distance}m)`
                : `현장 밖 ⚠️ (약 ${d.distance}m)`
              : '위치 없음'
          showFlash({
            ok: true,
            name: d.userName,
            msg: d.alreadyScanned ? `이미 인식됨 · ${distStr}` : `인식 완료 · ${distStr}`,
          })
          // 즉시 목록 갱신
          try {
            const r = await fetch(`/api/qr/scans?session=${session.id}`, { cache: 'no-store' })
            const j = await r.json()
            if (r.ok) setScans(j.scans || [])
          } catch {}
        } else {
          showFlash({ ok: false, name: d.userName || '', msg: d.error || '인식 실패' })
        }
      } catch {
        showFlash({ ok: false, name: '', msg: '네트워크 오류' })
      } finally {
        // 약간의 쿨다운 후 다음 스캔 허용
        setTimeout(() => {
          busyRef.current = false
        }, 800)
      }
    },
    [session, showFlash]
  )

  // 카메라 스캐너 시작/중지
  const startScanner = useCallback(async () => {
    if (scannerRef.current || startingRef.current) return
    startingRef.current = true
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const el = document.getElementById('qr-reader')
      if (!el) {
        startingRef.current = false
        return
      }
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText: string) => {
          handleDecoded(decodedText)
        },
        () => {}
      )
      setScanning(true)
    } catch (e: any) {
      toast.error('카메라를 시작할 수 없습니다. 권한을 확인하세요.')
      scannerRef.current = null
      setScanning(false)
    } finally {
      startingRef.current = false
    }
  }, [handleDecoded])

  const stopScanner = useCallback(async () => {
    const s = scannerRef.current
    scannerRef.current = null
    setScanning(false)
    if (s) {
      try {
        await s.stop()
        s.clear()
      } catch {}
    }
  }, [])

  // 세션 시작되면 자동으로 카메라 켜기
  useEffect(() => {
    if (session) startScanner()
    return () => {
      stopScanner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  const fmt = (t: string | null) =>
    t ? new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'

  const inRangeCount = scans.filter(
    (s) => s.entry_distance_m != null && s.entry_distance_m <= (session?.radius_m || 200)
  ).length

  return (
    <div className="min-h-screen" style={{ background: '#080C10' }}>
      <nav style={{ background: '#0D1218', borderBottom: '1px solid rgba(255,255,255,0.07)' }} className="sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <button onClick={() => router.push('/admin')} className="flex items-center gap-2" style={{ color: '#C9941A', fontSize: '13px', fontWeight: '600', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <ArrowLeft style={{ width: '15px', height: '15px' }} /> 돌아가기
          </button>
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <QrCode style={{ width: '15px', height: '15px', color: '#C9941A' }} /> QR 출석 인식기
          </span>
          <span style={{ width: '60px' }} />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {!session ? (
          /* ===== 세션 생성 ===== */
          <div className="rd-surface p-6 sm:p-8 max-w-xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <p style={{ fontSize: '10px', fontWeight: '700', color: '#C9941A', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '6px' }}>B안 · QR + 위치</p>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'white' }}>QR 인식기 준비</h2>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.38)', marginTop: '4px' }}>현장 위치를 정한 뒤, 학생들의 출석 QR을 카메라로 스캔하세요.</p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.70)', marginBottom: '8px' }}>강의</label>
              <select
                value={courseId}
                onChange={(e) => {
                  setCourseId(e.target.value)
                  const c = courses.find((x) => x.id === e.target.value)
                  if (c) setName(`${c.name} QR 출석`)
                }}
                className="rd-select"
              >
                {courses.length === 0 && <option value="">강의 없음</option>}
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.70)', marginBottom: '8px' }}>출석 이름</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="rd-input" placeholder="예: 6월 30일 1교시" />
            </div>

            {/* 현장 위치 설정 */}
            <div style={{ background: 'rgba(201,148,26,0.06)', border: '1px solid rgba(201,148,26,0.22)', padding: '16px' }}>
              <p style={{ fontSize: '13px', fontWeight: '700', color: '#C9941A', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin style={{ width: '14px', height: '14px' }} /> 현장 위치 설정
              </p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && geocodeAddress()}
                  placeholder="주소 입력 (예: 서울특별시 중구 세종대로 110)"
                  className="rd-input"
                  style={{ flex: 1 }}
                />
                <button onClick={geocodeAddress} disabled={geocoding} className="btn-gold" style={{ padding: '0 16px', fontSize: '12px', whiteSpace: 'nowrap' }}>
                  {geocoding ? '검색중' : '설정'}
                </button>
              </div>
              <button onClick={getLocation} style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.65)', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <MapPin style={{ width: '14px', height: '14px' }} /> 현재 내 위치로 설정
              </button>
              {venue && (
                <div style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.25)', padding: '10px 12px', marginTop: '10px' }}>
                  <p style={{ fontSize: '12px', fontWeight: '700', color: '#4ade80' }}>✅ 현장 설정됨</p>
                  {venueLabel && <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '3px', wordBreak: 'break-all' }}>{venueLabel}</p>}
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.30)', marginTop: '3px', fontFamily: 'monospace' }}>{venue.lat.toFixed(5)}, {venue.lng.toFixed(5)}</p>
                </div>
              )}
              <div style={{ marginTop: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.55)', marginBottom: '6px' }}>허용 반경: {radius}m</label>
                <input type="range" min={30} max={500} step={10} value={radius} onChange={(e) => setRadius(Number(e.target.value))} style={{ width: '100%' }} />
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.30)', marginTop: '2px' }}>실내/건물은 GPS 오차가 커서 100~200m 권장</p>
              </div>
            </div>

            <button onClick={startSession} disabled={creating} className="btn-gold" style={{ width: '100%', height: '50px', fontSize: '15px', opacity: creating ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Camera style={{ width: '18px', height: '18px' }} /> {creating ? '준비 중...' : 'QR 인식기 시작'}
            </button>
          </div>
        ) : (
          /* ===== 인식기 진행 ===== */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 카메라 */}
            <div className="rd-surface p-5">
              <div className="flex items-center justify-between" style={{ marginBottom: '14px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Camera style={{ width: '16px', height: '16px', color: '#C9941A' }} /> {session.name}
                </h3>
                <span style={{ fontSize: '11px', fontWeight: '700', color: scanning ? '#4ade80' : 'rgba(255,255,255,0.40)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: scanning ? '#4ade80' : 'rgba(255,255,255,0.30)', display: 'inline-block', animation: scanning ? 'pulse 1.5s ease-in-out infinite' : 'none' }} />
                  {scanning ? '인식 중' : '대기'}
                </span>
              </div>

              <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
                <div id="qr-reader" style={{ width: '100%' }} />
                {/* 인식 결과 플래시 */}
                {flash && (
                  <div
                    style={{
                      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px',
                      background: flash.ok ? 'rgba(20,40,25,0.92)' : 'rgba(45,20,20,0.92)',
                    }}
                  >
                    {flash.ok ? (
                      <CheckCircle2 style={{ width: '56px', height: '56px', color: '#4ade80', marginBottom: '10px' }} />
                    ) : (
                      <XCircle style={{ width: '56px', height: '56px', color: '#f87171', marginBottom: '10px' }} />
                    )}
                    {flash.name && <p style={{ fontSize: '22px', fontWeight: '800', color: 'white', marginBottom: '4px' }}>{flash.name}</p>}
                    <p style={{ fontSize: '14px', fontWeight: '600', color: flash.ok ? '#86efac' : '#fca5a5' }}>{flash.msg}</p>
                  </div>
                )}
              </div>

              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: '12px' }}>
                학생의 <b style={{ color: 'rgba(255,255,255,0.6)' }}>출석 QR</b>을 사각형 안에 비추면 자동 인식됩니다
              </p>

              <button onClick={() => { stopScanner(); setSession(null); setScans([]) }} style={{ width: '100%', marginTop: '14px', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)', fontSize: '13px', cursor: 'pointer' }}>
                인식기 종료
              </button>
            </div>

            {/* 인식 목록 */}
            <div className="rd-surface p-5">
              <div className="flex items-center justify-between" style={{ marginBottom: '14px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users style={{ width: '16px', height: '16px', color: '#C9941A' }} /> 인식된 학생
                </h3>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: '#4ade80', background: 'rgba(74,222,128,0.10)', padding: '3px 10px', borderRadius: '999px' }}>현장 {inRangeCount}</span>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.65)', background: 'rgba(255,255,255,0.06)', padding: '3px 10px', borderRadius: '999px' }}>전체 {scans.length}</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '460px', overflowY: 'auto' }}>
                {scans.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '40px 0' }}>아직 인식된 학생이 없습니다</p>
                ) : (
                  scans.map((s, i) => {
                    const hasLoc = s.entry_lat != null && s.entry_lng != null
                    const inRange = s.entry_distance_m != null && s.entry_distance_m <= (session.radius_m || 200)
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div>
                          <p style={{ fontSize: '14px', fontWeight: '700', color: 'white' }}>
                            {hasLoc ? (inRange ? '🟢' : '🟠') : '⚪'} {s.user_name || s.user_id}
                          </p>
                          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>
                            인식 {fmt(s.entry_at)}
                            {s.entry_distance_m != null ? ` · 약 ${s.entry_distance_m}m` : ' · 위치 없음'}
                          </p>
                          {hasLoc && (
                            <a
                              href={`https://www.google.com/maps?q=${s.entry_lat},${s.entry_lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: '11px', color: '#C9941A', textDecoration: 'none' }}
                            >
                              🗺️ 위치 보기
                            </a>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: hasLoc ? (inRange ? '#4ade80' : '#fb923c') : 'rgba(255,255,255,0.40)' }}>
                          {hasLoc ? (inRange ? '현장' : '현장 밖') : '위치없음'}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
