'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MapPin, CheckCircle2, XCircle, LogOut } from 'lucide-react'

function getDeviceId(): string {
  let id = localStorage.getItem('deviceId')
  if (!id) {
    id = (crypto as any).randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now()
    localStorage.setItem('deviceId', id)
  }
  return id
}

type Phase =
  | 'locating'
  | 'too_far'
  | 'ready'
  | 'attending'
  | 'can_exit'
  | 'accepted'
  | 'left_early'
  | 'ended'
  | 'error'

function getLoc(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('no geo'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  })
}

const CARD_STYLE: React.CSSProperties = {
  background: '#0F1420',
  border: '1px solid rgba(255,255,255,0.08)',
  padding: '36px 32px',
  maxWidth: '380px',
  width: '100%',
  textAlign: 'center',
}

function LiveInner() {
  const router = useRouter()
  const params = useSearchParams()
  const sessionId = params.get('session') || ''

  const [user, setUser] = useState<any>(null)
  const [phase, setPhase] = useState<Phase>('locating')
  const [distance, setDistance] = useState<number | null>(null)
  const [radius, setRadius] = useState<number | null>(null)
  const [endsAt, setEndsAt] = useState<string | null>(null)
  const [nowTick, setNowTick] = useState(Date.now())
  const [marked, setMarked] = useState<{ lat: number; lng: number } | null>(null)
  const [markedExit, setMarkedExit] = useState<{ lat: number; lng: number } | null>(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('user')
    if (!saved) { router.push('/login'); return }
    setUser(JSON.parse(saved))
  }, [router])

  const call = useCallback(
    async (action: string, u: any) => {
      let loc: { lat: number; lng: number } | null = null
      try {
        loc = await getLoc()
      } catch {
        if (action === 'checkin' || action === 'checkout') {
          setPhase('error')
          setMsg('위치 권한을 허용해야 출석/퇴장할 수 있습니다')
          return null
        }
      }
      const res = await fetch('/api/live/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action, sessionId, lat: loc?.lat, lng: loc?.lng,
          userId: u.id, userName: u.name, deviceId: getDeviceId(),
        }),
      })
      const data = await res.json()
      if (typeof data.distance === 'number') setDistance(data.distance)
      if (typeof data.radius === 'number') setRadius(data.radius)
      if (data.endsAt) setEndsAt(data.endsAt)
      if (typeof data.myLat === 'number' && typeof data.myLng === 'number') setMarked({ lat: data.myLat, lng: data.myLng })
      if (typeof data.exitLat === 'number' && typeof data.exitLng === 'number') setMarkedExit({ lat: data.exitLat, lng: data.exitLng })
      return data
    },
    [sessionId]
  )

  const applyProbe = (d: any) => {
    if (d.recordStatus === 'completed') setPhase('accepted')
    else if (d.recordStatus === 'left_early') setPhase('left_early')
    else if (d.recordStatus === 'present' || d.recordStatus === 'left') {
      if (d.canCheckout) setPhase('can_exit')
      else if (d.ended) setPhase('left_early')
      else setPhase('attending')
    }
    else if (d.ended) setPhase('ended')
    else if (d.inRange) setPhase('ready')
    else setPhase('too_far')
  }

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!user || !sessionId) return
    ;(async () => {
      const d = await call('probe', user)
      if (d) applyProbe(d)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, sessionId])

  useEffect(() => {
    if (phase !== 'attending' || !endsAt) return
    const end = new Date(endsAt).getTime()
    const CHECKOUT_GRACE_MS = 30 * 60 * 1000
    const check = () => {
      const now = Date.now()
      const sinceEnd = now - end
      if (sinceEnd > CHECKOUT_GRACE_MS) setPhase('left_early')
      else if (now >= end) setPhase('can_exit')
    }
    check()
    const t = setInterval(check, 5000)
    return () => clearInterval(t)
  }, [phase, endsAt])

  const doCheckin = async () => {
    setBusy(true); setMsg('')
    const d = await call('checkin', user)
    setBusy(false)
    if (!d) return
    if (d.ok) {
      if (d.canCheckout) setPhase('can_exit')
      else setPhase('attending')
    } else {
      setMsg(d.error || '출석할 수 없습니다')
      if (!d.inRange) setPhase('too_far')
      else if (d.ended) setPhase('ended')
    }
  }

  const recheck = async () => {
    setBusy(true); setMsg('')
    const d = await call('probe', user)
    setBusy(false)
    if (d) applyProbe(d)
  }

  const doCheckout = async () => {
    setBusy(true); setMsg('')
    const d = await call('checkout', user)
    setBusy(false)
    if (!d) return
    if (d.ok) setPhase('accepted')
    else {
      setMsg(d.error || '퇴장할 수 없습니다')
      if (!d.ended) setPhase('attending')
    }
  }

  if (!sessionId) {
    return (
      <PageWrap>
        <div style={CARD_STYLE}>
          <p style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📡</p>
          <p style={{ fontSize: '16px', fontWeight: '700', color: 'white', marginBottom: '8px' }}>출석 세션이 지정되지 않았습니다</p>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.38)' }}>운영자 화면의 QR코드를 스캔해 접속하세요.</p>
        </div>
      </PageWrap>
    )
  }

  const endTimeStr = endsAt ? new Date(endsAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''
  const msToEnd = endsAt ? new Date(endsAt).getTime() - nowTick : null
  const minToEnd = msToEnd != null && msToEnd > 0 ? Math.ceil(msToEnd / 60000) : 0

  return (
    <PageWrap>
      <div style={CARD_STYLE}>
        {/* 브랜드 */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div style={{ width: '20px', height: '20px', border: '1px solid #C9941A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'Georgia, serif', color: '#C9941A', fontSize: '10px', fontWeight: '700' }}>R</span>
          </div>
          <span style={{ fontFamily: 'Georgia, serif', color: 'rgba(255,255,255,0.50)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Rich Divine Partners</span>
        </div>

        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', marginBottom: '24px' }}>{user?.name ? `${user.name}님` : ''}</p>

        {phase === 'locating' && (
          <>
            <div className="app-spinner mx-auto mb-5" />
            <p style={{ fontSize: '15px', fontWeight: '600', color: 'white' }}>위치 확인 중...</p>
          </>
        )}

        {phase === 'too_far' && (
          <>
            <MapPin style={{ width: '52px', height: '52px', color: '#ef4444', margin: '0 auto 16px' }} />
            <p style={{ fontSize: '18px', fontWeight: '700', color: 'white', marginBottom: '8px' }}>현장 밖입니다</p>
            <p style={{ fontSize: '13px', color: '#f87171', fontWeight: '600', marginBottom: '6px' }}>
              현장까지 약 {distance ?? '-'}m {radius ? `(허용 ${radius}m)` : ''}
            </p>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.28)', marginBottom: '20px' }}>강의실로 이동한 뒤 다시 확인하세요.</p>
            <button onClick={recheck} disabled={busy} className="btn-gold" style={{ width: '100%', height: '48px', fontSize: '14px', opacity: busy ? 0.5 : 1 }}>
              {busy ? '확인 중...' : '📍 위치 다시 확인'}
            </button>
          </>
        )}

        {phase === 'ready' && (
          <>
            <CheckCircle2 style={{ width: '52px', height: '52px', color: '#4ade80', margin: '0 auto 16px' }} />
            <p style={{ fontSize: '18px', fontWeight: '700', color: 'white', marginBottom: '6px' }}>현장에 도착했습니다</p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.38)', marginBottom: '4px' }}>아래 버튼을 눌러 출석하세요.</p>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.25)', marginBottom: '20px' }}>현장까지 약 {distance}m</p>
            <button onClick={doCheckin} disabled={busy} className="btn-gold" style={{ width: '100%', height: '52px', fontSize: '15px', opacity: busy ? 0.5 : 1 }}>
              {busy ? '출석 중...' : '✅ 출석하기'}
            </button>
            {endTimeStr && (
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '14px' }}>
                수업 종료: {endTimeStr} — 종료 후 현장에서 퇴장하면 출석 인정
              </p>
            )}
          </>
        )}

        {phase === 'attending' && (
          <>
            <CheckCircle2 style={{ width: '52px', height: '52px', color: '#C9941A', margin: '0 auto 16px' }} />
            <p style={{ fontSize: '20px', fontWeight: '700', color: 'white', marginBottom: '8px' }}>출석 완료 ✅</p>
            {endTimeStr && (
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.40)', marginBottom: '12px' }}>
                수업 종료: <span style={{ color: 'white', fontWeight: '600' }}>{endTimeStr}</span>
              </p>
            )}
            <div style={{ background: 'rgba(201,148,26,0.08)', border: '1px solid rgba(201,148,26,0.22)', padding: '14px 16px', textAlign: 'left', marginBottom: '16px' }}>
              <p style={{ fontSize: '12px', fontWeight: '700', color: '#C9941A', marginBottom: '6px' }}>퇴장 방법 (중요)</p>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.50)', lineHeight: 1.6 }}>
                수업이 <span style={{ color: 'white', fontWeight: '600' }}>완전히 끝난 후</span> 퇴장 버튼이 나타납니다.<br />
                종료 후 <span style={{ color: 'white', fontWeight: '600' }}>30분 이내</span>에 퇴장을 찍어야 출석 인정됩니다.
              </p>
              {minToEnd > 0 && (
                <p style={{ fontSize: '12px', color: '#C9941A', fontWeight: '700', marginTop: '8px' }}>
                  수업 종료까지: 약 {minToEnd}분
                </p>
              )}
            </div>
            {marked && <MarkedLocation lat={marked.lat} lng={marked.lng} label="내가 출석한 위치" />}
            <button onClick={recheck} disabled={busy} style={{ marginTop: '12px', width: '100%', height: '40px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.50)', fontSize: '13px', cursor: 'pointer' }}>
              {busy ? '확인 중...' : '🔄 상태 새로고침'}
            </button>
          </>
        )}

        {phase === 'can_exit' && (
          <>
            <CheckCircle2 style={{ width: '52px', height: '52px', color: '#fb923c', margin: '0 auto 16px' }} />
            <p style={{ fontSize: '18px', fontWeight: '700', color: 'white', marginBottom: '8px' }}>수업이 종료되었습니다!</p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginBottom: '6px' }}>
              지금 현장에서 <span style={{ color: 'white', fontWeight: '600' }}>퇴장하기</span>를 눌러야 출석이 인정됩니다.
            </p>
            <p style={{ fontSize: '12px', color: '#f87171', fontWeight: '600', marginBottom: '20px' }}>30분 이내에 퇴장하지 않으면 출석 미인정</p>
            {msg && <p style={{ fontSize: '13px', color: '#f87171', fontWeight: '600', marginBottom: '12px' }}>{msg}</p>}
            <button
              onClick={doCheckout} disabled={busy}
              style={{
                width: '100%', height: '52px', fontSize: '15px', fontWeight: '700', border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
                background: busy ? 'rgba(251,146,60,0.40)' : '#ea580c', color: 'white',
                animation: busy ? 'none' : 'pulse 1.5s ease-in-out infinite', opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? '위치 확인 중...' : '🚪 지금 퇴장하기 (위치 확인)'}
            </button>
            {marked && <MarkedLocation lat={marked.lat} lng={marked.lng} label="내가 출석한 위치" />}
          </>
        )}

        {phase === 'accepted' && (
          <>
            <CheckCircle2 style={{ width: '60px', height: '60px', color: '#C9941A', margin: '0 auto 16px' }} />
            <p style={{ fontSize: '20px', fontWeight: '700', color: 'white', marginBottom: '8px' }}>출석 인정 완료!</p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.40)', marginBottom: '16px' }}>출석·퇴장 위치가 모두 확인됐습니다. 수고하셨어요 👏</p>
            {marked && <MarkedLocation lat={marked.lat} lng={marked.lng} label="내가 출석한 위치" />}
            {markedExit && <MarkedLocation lat={markedExit.lat} lng={markedExit.lng} label="내가 퇴장한 위치" tone="gold" />}
            <button onClick={() => router.push('/student')} className="btn-gold" style={{ marginTop: '16px', padding: '10px 28px', fontSize: '13px' }}>
              내 강의로
            </button>
          </>
        )}

        {phase === 'left_early' && (
          <>
            <LogOut style={{ width: '52px', height: '52px', color: '#fb923c', margin: '0 auto 16px' }} />
            <p style={{ fontSize: '20px', fontWeight: '700', color: 'white', marginBottom: '8px' }}>출석 미인정</p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.38)', marginBottom: '16px' }}>
              수업 종료 후 현장에서 퇴장을 찍지 않아 출석이 인정되지 않았습니다.
            </p>
            <button onClick={() => router.push('/student')} style={{ padding: '10px 28px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.60)', fontSize: '13px', cursor: 'pointer' }}>
              내 강의로
            </button>
          </>
        )}

        {phase === 'ended' && (
          <>
            <XCircle style={{ width: '52px', height: '52px', color: 'rgba(255,255,255,0.30)', margin: '0 auto 16px' }} />
            <p style={{ fontSize: '18px', fontWeight: '700', color: 'white', marginBottom: '8px' }}>종료된 출석입니다</p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)' }}>{msg}</p>
          </>
        )}

        {phase === 'error' && (
          <>
            <XCircle style={{ width: '52px', height: '52px', color: '#ef4444', margin: '0 auto 16px' }} />
            <p style={{ fontSize: '18px', fontWeight: '700', color: 'white', marginBottom: '8px' }}>출석 불가</p>
            <p style={{ fontSize: '13px', color: '#f87171', fontWeight: '600', marginBottom: '16px' }}>{msg}</p>
            <button onClick={recheck} disabled={busy} className="btn-gold" style={{ padding: '10px 28px', fontSize: '13px', opacity: busy ? 0.5 : 1 }}>다시 시도</button>
          </>
        )}
      </div>
    </PageWrap>
  )
}

function MarkedLocation({ lat, lng, label, tone = 'default' }: { lat: number; lng: number; label: string; tone?: 'default' | 'gold' }) {
  const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`
  const borderColor = tone === 'gold' ? 'rgba(201,148,26,0.35)' : 'rgba(255,255,255,0.10)'
  const bgColor = tone === 'gold' ? 'rgba(201,148,26,0.07)' : 'rgba(255,255,255,0.03)'
  const labelColor = tone === 'gold' ? '#C9941A' : 'rgba(255,255,255,0.55)'
  return (
    <div style={{ border: `1px solid ${borderColor}`, background: bgColor, padding: '12px 14px', marginTop: '14px', textAlign: 'left' }}>
      <p style={{ fontSize: '11px', fontWeight: '700', color: labelColor, display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
        <MapPin style={{ width: '12px', height: '12px' }} /> {label}
      </p>
      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.30)', fontFamily: 'monospace', marginBottom: '8px' }}>{lat.toFixed(5)}, {lng.toFixed(5)}</p>
      <a
        href={mapUrl} target="_blank" rel="noopener noreferrer"
        style={{ fontSize: '12px', fontWeight: '600', color: '#C9941A', textDecoration: 'none' }}
      >
        🗺️ 지도에서 보기
      </a>
    </div>
  )
}

function PageWrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{
        background: '#080C10',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.016) 1px, transparent 1px)',
        backgroundSize: '30px 30px',
      }}
    >
      {children}
    </div>
  )
}

export default function LivePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080C10' }}>
        <div className="app-spinner" />
      </div>
    }>
      <LiveInner />
    </Suspense>
  )
}
