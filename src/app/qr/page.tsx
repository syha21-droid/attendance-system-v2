'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { MapPin, RefreshCw } from 'lucide-react'
import { syncTrustedTime, getTrustedNow } from '@/lib/trustedTime'

// QR 갱신 주기 (오래된 화면 캡처 재사용 방지)
const REFRESH_MS = 20000

type LocState = 'locating' | 'ok' | 'denied'

// base64url 인코딩 (QR 안전)
function encodePayload(obj: any): string {
  const json = JSON.stringify(obj)
  const b64 = btoa(unescape(encodeURIComponent(json)))
  return 'RDQR1:' + b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export default function StudentQrPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [name, setName] = useState('')
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null)
  const [locState, setLocState] = useState<LocState>('locating')
  const [qr, setQr] = useState('')
  const [tick, setTick] = useState(0)
  const locRef = useRef<{ lat: number; lng: number } | null>(null)
  const watchRef = useRef<number | null>(null)
  const deviceIdRef = useRef<string>('')

  useEffect(() => {
    // 기기 고유 ID — localStorage에 영구 저장 (기기 1대 = 1학생 제한용)
    let did = localStorage.getItem('rdDeviceId')
    if (!did) {
      did = 'dev-' + crypto.randomUUID()
      localStorage.setItem('rdDeviceId', did)
    }
    deviceIdRef.current = did

    const saved = localStorage.getItem('user')
    if (saved) {
      // 로그인된 사용자(학생/관리자 미리보기)는 본인 신원 사용
      const u = JSON.parse(saved)
      setUser(u)
      setName(u.name || '')
    } else {
      // 로그인/쿠키 없이도 동작 (시연용) — 게스트 신원 자동 생성, 이름은 직접 입력
      let gid = localStorage.getItem('qrGuestId')
      if (!gid) {
        gid = 'g-' + Math.random().toString(36).slice(2, 9)
        localStorage.setItem('qrGuestId', gid)
      }
      setUser({ id: gid, name: '게스트', isAdmin: false, guest: true })
      setName('게스트')
    }
    // 서버 시간과 동기화 (기기 시계 조작 무효화)
    syncTrustedTime(true)
  }, [])

  // 위치 지속 추적
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocState('denied')
      return
    }
    watchRef.current = navigator.geolocation.watchPosition(
      (p) => {
        const next = { lat: p.coords.latitude, lng: p.coords.longitude }
        locRef.current = next
        setLoc(next)
        setLocState('ok')
      },
      () => setLocState('denied'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    )
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current)
    }
  }, [])

  // QR 재생성
  const rebuild = useCallback(() => {
    if (!user) return
    const l = locRef.current
    setQr(
      encodePayload({
        v: 1,
        uid: user.id,
        name: (name || user.name || '게스트').trim(),
        lat: l?.lat,
        lng: l?.lng,
        ts: getTrustedNow().getTime(),
        did: deviceIdRef.current,
      })
    )
    setTick((t) => t + 1)
  }, [user, name])

  useEffect(() => {
    rebuild()
    const t = setInterval(rebuild, REFRESH_MS)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loc, name])

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{
        background: '#080C10',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.016) 1px, transparent 1px)',
        backgroundSize: '30px 30px',
      }}
    >
      <div
        style={{
          background: '#0F1420',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '28px 20px',
          maxWidth: '420px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        {/* 브랜드 */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div style={{ width: '20px', height: '20px', border: '1px solid #C9941A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'Georgia, serif', color: '#C9941A', fontSize: '10px', fontWeight: '700' }}>R</span>
          </div>
          <span style={{ fontFamily: 'Georgia, serif', color: 'rgba(255,255,255,0.50)', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Rich Divine Partners</span>
        </div>

        <p style={{ fontSize: '11px', fontWeight: '700', color: '#C9941A', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '6px' }}>출석 QR</p>
        {user?.guest ? (
          <div style={{ marginBottom: '18px' }}>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.40)', marginBottom: '8px' }}>이름을 입력하면 QR이 만들어집니다</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름"
              className="rd-input"
              style={{ textAlign: 'center', maxWidth: '220px', margin: '0 auto' }}
            />
          </div>
        ) : (
          <>
            <p style={{ fontSize: '18px', fontWeight: '700', color: 'white', marginBottom: '4px' }}>{user?.name ? `${user.name}님` : ''}</p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.38)', marginBottom: '22px' }}>관리자에게 이 QR을 보여주세요</p>
          </>
        )}

        {/* QR */}
        <div style={{ background: 'white', padding: '18px', display: 'inline-block', borderRadius: '12px', marginBottom: '18px' }}>
          {qr ? (
            <QRCodeSVG value={qr} size={220} level="M" />
          ) : (
            <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="app-spinner" />
            </div>
          )}
        </div>

        {/* 위치 상태 */}
        {locState === 'ok' && loc && (
          <div style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.25)', padding: '12px 14px', marginBottom: '14px' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', color: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
              <MapPin style={{ width: '13px', height: '13px' }} /> 위치 확인됨
            </p>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.30)', fontFamily: 'monospace', marginTop: '4px' }}>
              {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
            </p>
          </div>
        )}
        {locState === 'locating' && (
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.40)', marginBottom: '14px' }}>📍 위치 확인 중...</p>
        )}
        {locState === 'denied' && (
          <div style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', padding: '12px 14px', marginBottom: '14px' }}>
            <p style={{ fontSize: '12px', fontWeight: '700', color: '#f87171' }}>위치 권한이 필요합니다</p>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '4px' }}>위치를 허용해야 출석이 인정됩니다. 브라우저 설정에서 위치를 켜주세요.</p>
          </div>
        )}

        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
          <RefreshCw style={{ width: '11px', height: '11px' }} /> {Math.round(REFRESH_MS / 1000)}초마다 자동 갱신 · 캡처 재사용 방지
        </p>

        <button
          onClick={() => router.push(user?.isAdmin || user?.guest ? '/select' : '/student')}
          style={{ marginTop: '18px', padding: '9px 24px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)', fontSize: '13px', cursor: 'pointer' }}
        >
          {user?.isAdmin || user?.guest ? '← 선택 화면으로' : '내 강의로'}
        </button>
      </div>
    </div>
  )
}
