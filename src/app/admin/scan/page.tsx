'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, MapPin, QrCode, Camera, CheckCircle2, XCircle, Users, Plus } from 'lucide-react'
import toast from 'react-hot-toast'

interface ScanSession {
  id: string
  name: string
  radius_m: number
  venue_lat: number
  venue_lng: number
}

interface Flash {
  ok: boolean
  name: string
  msg: string
}

// 스캐너 폰 잠금용 쿠키 (한 폰 = 한 코드/세션)
const COOKIE = 'rd_scan_session'
function setCookie(val: string) {
  // 12시간 유지
  document.cookie = `${COOKIE}=${encodeURIComponent(val)}; path=/; max-age=${12 * 3600}`
}
function getCookie(): string | null {
  const m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : null
}
function clearCookie() {
  document.cookie = `${COOKIE}=; path=/; max-age=0`
}

// 외부 참가자(QR 없이 이름만) 토큰 생성
function encodePayload(obj: any): string {
  const json = JSON.stringify(obj)
  const b64 = btoa(unescape(encodeURIComponent(json)))
  return 'RDQR1:' + b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export default function AdminScanPage() {
  const router = useRouter()

  // 세션 설정
  const [name, setName] = useState('QR 출석')
  const [venue, setVenue] = useState<{ lat: number; lng: number } | null>(null)
  const [venueLabel, setVenueLabel] = useState('')
  const [address, setAddress] = useState('')
  const [geocoding, setGeocoding] = useState(false)
  const [radius, setRadius] = useState(150)
  const [creating, setCreating] = useState(false)

  const [session, setSession] = useState<ScanSession | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scans, setScans] = useState<any[]>([])
  const [flash, setFlash] = useState<Flash | null>(null)
  const [extName, setExtName] = useState('')
  const [addingExt, setAddingExt] = useState(false)
  const [ready, setReady] = useState(false)

  const scannerRef = useRef<any>(null)
  const startingRef = useRef(false)
  const lastScanRef = useRef<{ token: string; at: number }>({ token: '', at: 0 })
  const busyRef = useRef(false)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const flashTimer = useRef<NodeJS.Timeout | null>(null)

  // 쿠키에 저장된 세션이 있으면 그대로 이어감 (한 폰 = 한 코드)
  useEffect(() => {
    const saved = getCookie()
    if (saved) {
      try {
        const s = JSON.parse(saved) as ScanSession
        if (s?.id) setSession(s)
      } catch {
        clearCookie()
      }
    }
    setReady(true)
  }, [])

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
    if (!name.trim()) return toast.error('출석 이름을 입력하세요')
    if (!venue) return toast.error('현장 위치를 먼저 설정하세요')
    setCreating(true)
    try {
      const res = await fetch('/api/live/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: 'scan-only',
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
      const s: ScanSession = {
        id: data.session.id,
        name: data.session.name,
        radius_m: data.session.radius_m,
        venue_lat: data.session.venue_lat,
        venue_lng: data.session.venue_lng,
      }
      setSession(s)
      setCookie(JSON.stringify(s)) // 이 폰을 이 코드에 고정
      toast.success('📷 준비 완료. 학생 QR을 비추세요.')
    } catch {
      toast.error('네트워크 오류')
    } finally {
      setCreating(false)
    }
  }

  const endSession = async () => {
    if (!confirm('이 코드를 종료할까요? (다른 코드로 새로 시작할 수 있습니다)')) return
    await stopScanner()
    clearCookie()
    setSession(null)
    setScans([])
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

  const refreshScans = useCallback(async (sid: string) => {
    try {
      const r = await fetch(`/api/qr/scans?session=${sid}`, { cache: 'no-store' })
      const j = await r.json()
      if (r.ok) setScans(j.scans || [])
    } catch {}
  }, [])

  // QR 스캔 처리 (위치 검증 + 기기 1대=1명 은 서버가 처리)
  const handleDecoded = useCallback(
    async (token: string) => {
      if (!session) return
      const now = Date.now()
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
          refreshScans(session.id)
        } else {
          showFlash({ ok: false, name: d.userName || '', msg: d.error || '인식 실패' })
        }
      } catch {
        showFlash({ ok: false, name: '', msg: '네트워크 오류' })
      } finally {
        setTimeout(() => {
          busyRef.current = false
        }, 800)
      }
    },
    [session, showFlash, refreshScans]
  )

  // 외부 참가자(토요특강) — 이름만으로 추가
  const addExternal = async () => {
    if (!session) return
    const nm = extName.trim()
    if (!nm) return toast.error('이름을 입력하세요')
    setAddingExt(true)
    try {
      const token = encodePayload({ v: 1, uid: 'ext-' + nm, name: nm, ts: Date.now() })
      const res = await fetch('/api/qr/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, token }),
      })
      const d = await res.json()
      if (d.ok) {
        toast.success(d.alreadyScanned ? `${nm}님 이미 추가됨` : `${nm}님 추가 완료`)
        setExtName('')
        refreshScans(session.id)
      } else {
        toast.error(d.error || '추가 실패')
      }
    } catch {
      toast.error('네트워크 오류')
    } finally {
      setAddingExt(false)
    }
  }

  // 카메라 시작/중지
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
        (decodedText: string) => handleDecoded(decodedText),
        () => {}
      )
      setScanning(true)
    } catch {
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

  useEffect(() => {
    if (session) startScanner()
    return () => {
      stopScanner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  const fmt = (t: string | null) =>
    t ? new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-'

  if (!ready) return <div className="min-h-screen" style={{ background: '#080C10' }} />

  return (
    <div className="min-h-screen" style={{ background: '#080C10' }}>
      <nav style={{ background: '#0D1218', borderBottom: '1px solid rgba(255,255,255,0.07)' }} className="sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3.5 flex items-center justify-between">
          <button onClick={() => router.push('/select')} className="flex items-center gap-2" style={{ color: '#C9941A', fontSize: '13px', fontWeight: '600', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <ArrowLeft style={{ width: '15px', height: '15px' }} /> 나가기
          </button>
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <QrCode style={{ width: '15px', height: '15px', color: '#C9941A' }} /> QR 스캔 출석
          </span>
          <span style={{ width: '50px' }} />
        </div>
      </nav>

      <main className="max-w-md mx-auto px-4 py-6" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {!session ? (
          /* ===== 세션 설정 (위치) ===== */
          <div className="rd-surface p-5" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '10px', fontWeight: '700', color: '#C9941A', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '6px' }}>B안 · 스캔 전용</p>
              <h2 style={{ fontSize: '1.3rem', fontWeight: '700', color: 'white' }}>현장 위치 설정</h2>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.38)', marginTop: '4px' }}>위치를 정하면 이 폰은 이 코드에 고정됩니다.</p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.70)', marginBottom: '8px' }}>출석 이름</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="rd-input" placeholder="예: 7월 12일 토요특강" />
            </div>

            <div style={{ background: 'rgba(201,148,26,0.06)', border: '1px solid rgba(201,148,26,0.22)', padding: '16px' }}>
              <p style={{ fontSize: '13px', fontWeight: '700', color: '#C9941A', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin style={{ width: '14px', height: '14px' }} /> 현장 위치
              </p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && geocodeAddress()}
                  placeholder="주소 입력 (예: 서울 중구 세종대로 110)"
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
              <Camera style={{ width: '18px', height: '18px' }} /> {creating ? '준비 중...' : '스캔 시작'}
            </button>
          </div>
        ) : (
          /* ===== 스캔 진행 ===== */
          <>
            <div className="rd-surface p-4">
              <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Camera style={{ width: '16px', height: '16px', color: '#C9941A' }} /> {session.name}
                </h3>
                <span style={{ fontSize: '11px', fontWeight: '700', color: scanning ? '#4ade80' : 'rgba(255,255,255,0.40)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: scanning ? '#4ade80' : 'rgba(255,255,255,0.30)', display: 'inline-block' }} />
                  {scanning ? '인식 중' : '대기'}
                </span>
              </div>

              <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
                <div id="qr-reader" style={{ width: '100%' }} />
                {flash && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px', background: flash.ok ? 'rgba(20,40,25,0.92)' : 'rgba(45,20,20,0.92)' }}>
                    {flash.ok ? (
                      <CheckCircle2 style={{ width: '52px', height: '52px', color: '#4ade80', marginBottom: '10px' }} />
                    ) : (
                      <XCircle style={{ width: '52px', height: '52px', color: '#f87171', marginBottom: '10px' }} />
                    )}
                    {flash.name && <p style={{ fontSize: '20px', fontWeight: '800', color: 'white', marginBottom: '4px' }}>{flash.name}</p>}
                    <p style={{ fontSize: '13px', fontWeight: '600', color: flash.ok ? '#86efac' : '#fca5a5' }}>{flash.msg}</p>
                  </div>
                )}
              </div>

              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: '12px' }}>
                학생의 <b style={{ color: 'rgba(255,255,255,0.6)' }}>출석 QR</b>을 비추면 위치 확인 후 자동 인식됩니다
              </p>
            </div>

            {/* 토요특강 외부 참가자 (이름만) */}
            <div className="rd-surface p-4">
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.70)', marginBottom: '8px' }}>외부 참가자 (QR 없이 이름만)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  value={extName}
                  onChange={(e) => setExtName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addExternal()}
                  placeholder="예: 홍길동"
                  className="rd-input"
                  style={{ flex: 1 }}
                />
                <button onClick={addExternal} disabled={addingExt} className="btn-gold" style={{ padding: '0 16px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                  <Plus style={{ width: '15px', height: '15px' }} /> 추가
                </button>
              </div>
            </div>

            {/* 인식된 명단 */}
            <div className="rd-surface p-4">
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'white', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
                <Users style={{ width: '16px', height: '16px', color: '#C9941A' }} /> 인식된 명단 ({scans.length}명)
              </h3>
              {scans.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.30)', textAlign: 'center', padding: '18px 0' }}>아직 인식된 사람이 없습니다</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {scans.map((s, i) => {
                    const ext = String(s.user_id || '').startsWith('ext-')
                    const inRange = s.entry_distance_m != null && s.entry_distance_m <= session.radius_m
                    const dot = ext ? '⚪' : s.entry_distance_m == null ? '⚪' : inRange ? '🟢' : '🟠'
                    return (
                      <div key={s.id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span>{dot}</span>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: 'white' }}>{s.user_name}</span>
                          {ext && <span style={{ fontSize: '10px', color: '#C9941A', border: '1px solid rgba(201,148,26,0.4)', padding: '1px 5px', borderRadius: '4px' }}>외부</span>}
                        </div>
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                          {s.entry_distance_m != null && !ext ? `${Math.round(s.entry_distance_m)}m · ` : ''}{fmt(s.entry_at || s.last_seen_at)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <button onClick={endSession} style={{ width: '100%', padding: '11px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)', fontSize: '13px', cursor: 'pointer' }}>
              코드 종료 / 새 코드 시작
            </button>
          </>
        )}
      </main>
    </div>
  )
}
