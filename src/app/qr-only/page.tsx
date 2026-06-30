'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { RefreshCw, QrCode } from 'lucide-react'
import { syncTrustedTime, getTrustedNow } from '@/lib/trustedTime'

// QR 갱신 주기 (오래된 화면 캡처 재사용 방지)
const REFRESH_MS = 20000

// base64url 인코딩 (QR 안전)
function encodePayload(obj: any): string {
  const json = JSON.stringify(obj)
  const b64 = btoa(unescape(encodeURIComponent(json)))
  return 'RDQR1:' + b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export default function StudentQrOnlyPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [qr, setQr] = useState('')

  useEffect(() => {
    const saved = localStorage.getItem('user')
    if (!saved) {
      router.push('/login')
      return
    }
    const u = JSON.parse(saved)
    // 검토용: 관리자도 학생 QR 화면을 미리 볼 수 있게 튕기지 않음
    setUser(u)
    syncTrustedTime(true)
  }, [router])

  // QR 재생성 (위치 없음 — uid/name/ts 만)
  const rebuild = useCallback(() => {
    if (!user) return
    setQr(
      encodePayload({
        v: 1,
        uid: user.id,
        name: user.name,
        ts: getTrustedNow().getTime(),
      })
    )
  }, [user])

  useEffect(() => {
    rebuild()
    const t = setInterval(rebuild, REFRESH_MS)
    return () => clearInterval(t)
  }, [rebuild])

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

        <p style={{ fontSize: '11px', fontWeight: '700', color: '#C9941A', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '6px' }}>출석 QR · C안</p>
        <p style={{ fontSize: '18px', fontWeight: '700', color: 'white', marginBottom: '4px' }}>{user?.name ? `${user.name}님` : ''}</p>
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.38)', marginBottom: '22px' }}>관리자에게 이 QR을 보여주세요</p>

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

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', padding: '12px 14px', marginBottom: '14px' }}>
          <p style={{ fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            <QrCode style={{ width: '13px', height: '13px' }} /> QR만으로 출석 (위치 확인 없음)
          </p>
        </div>

        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
          <RefreshCw style={{ width: '11px', height: '11px' }} /> {Math.round(REFRESH_MS / 1000)}초마다 자동 갱신 · 캡처 재사용 방지
        </p>

        <button
          onClick={() => router.push(user?.isAdmin ? '/select' : '/student')}
          style={{ marginTop: '18px', padding: '9px 24px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)', fontSize: '13px', cursor: 'pointer' }}
        >
          {user?.isAdmin ? '← 선택 화면으로' : '내 강의로'}
        </button>
      </div>
    </div>
  )
}
