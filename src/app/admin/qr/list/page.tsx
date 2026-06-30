'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Users, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

// 학생 QR과 동일한 페이로드 포맷 (외부 참가자 수동 추가용)
function encodePayload(obj: any): string {
  const json = JSON.stringify(obj)
  const b64 = btoa(unescape(encodeURIComponent(json)))
  return 'RDQR1:' + b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function ListInner() {
  const router = useRouter()
  const params = useSearchParams()
  const sessionId = params.get('session') || ''
  const sessionName = params.get('name') || 'QR 출석'
  const radius = Number(params.get('radius')) || 200

  const [scans, setScans] = useState<any[]>([])
  const [extName, setExtName] = useState('')
  const [addingExt, setAddingExt] = useState(false)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('user')
    if (!saved || !JSON.parse(saved).isAdmin) {
      router.push('/login')
      return
    }
  }, [router])

  const poll = useCallback(async () => {
    if (!sessionId) return
    try {
      const res = await fetch(`/api/qr/scans?session=${sessionId}`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setScans(data.scans || [])
    } catch {}
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    poll()
    pollRef.current = setInterval(poll, 4000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [sessionId, poll])

  const addExternal = async () => {
    if (!sessionId) return
    const nm = extName.trim()
    if (!nm) return toast.error('이름을 입력하세요')
    setAddingExt(true)
    try {
      const token = encodePayload({ v: 1, uid: 'ext-' + nm, name: nm, ts: Date.now() })
      const res = await fetch('/api/qr/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, token }),
      })
      const d = await res.json()
      if (d.ok) {
        toast.success(d.alreadyScanned ? `${nm}님 이미 추가됨` : `${nm}님 출석 추가 완료`)
        setExtName('')
        poll()
      } else {
        toast.error(d.error || '추가 실패')
      }
    } catch {
      toast.error('네트워크 오류')
    } finally {
      setAddingExt(false)
    }
  }

  const fmt = (t: string | null) =>
    t ? new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'

  const inRangeCount = scans.filter((s) => s.entry_distance_m != null && s.entry_distance_m <= radius).length

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080C10' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📋</p>
          <p style={{ fontSize: '15px', fontWeight: '700', color: 'white', marginBottom: '6px' }}>세션이 지정되지 않았습니다</p>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.38)' }}>QR 인식기 화면에서 "인식된 학생 따로 보기"로 열어주세요.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#080C10' }}>
      <nav style={{ background: '#0D1218', borderBottom: '1px solid rgba(255,255,255,0.07)' }} className="sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <button onClick={() => router.push('/admin/qr')} className="flex items-center gap-2" style={{ color: '#C9941A', fontSize: '13px', fontWeight: '600', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <ArrowLeft style={{ width: '15px', height: '15px' }} /> 인식기로
          </button>
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users style={{ width: '15px', height: '15px', color: '#C9941A' }} /> 인식된 학생
          </span>
          <button onClick={poll} className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <RefreshCw style={{ width: '13px', height: '13px' }} /> 새로고침
          </button>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-6">
        <div className="rd-surface p-5">
          <div className="flex items-center justify-between" style={{ marginBottom: '14px' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: '700', color: 'white' }}>{sessionName}</h2>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>실시간 인식 목록 (4초마다 자동 갱신)</p>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: '700', color: '#4ade80', background: 'rgba(74,222,128,0.10)', padding: '3px 10px', borderRadius: '999px' }}>현장 {inRangeCount}</span>
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.65)', background: 'rgba(255,255,255,0.06)', padding: '3px 10px', borderRadius: '999px' }}>전체 {scans.length}</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '60vh', overflowY: 'auto' }}>
            {scans.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '40px 0' }}>아직 인식된 학생이 없습니다</p>
            ) : (
              scans.map((s, i) => {
                const hasLoc = s.entry_lat != null && s.entry_lng != null
                const inRange = s.entry_distance_m != null && s.entry_distance_m <= radius
                const isExt = String(s.user_id).startsWith('ext-')
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: '700', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{hasLoc ? (inRange ? '🟢' : '🟠') : '⚪'} {s.user_name || s.user_id}</span>
                        {isExt && (
                          <span style={{ fontSize: '10px', fontWeight: '700', color: '#C9941A', background: 'rgba(201,148,26,0.10)', border: '1px solid rgba(201,148,26,0.30)', padding: '1px 6px', borderRadius: '4px' }}>외부</span>
                        )}
                      </p>
                      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>
                        인식 {fmt(s.entry_at)}
                        {s.entry_distance_m != null ? ` · 약 ${s.entry_distance_m}m` : ' · 위치 없음'}
                      </p>
                      {hasLoc && (
                        <a href={`https://www.google.com/maps?q=${s.entry_lat},${s.entry_lng}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#C9941A', textDecoration: 'none' }}>
                          🗺️ 위치 보기
                        </a>
                      )}
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: hasLoc ? (inRange ? '#4ade80' : '#fb923c') : 'rgba(255,255,255,0.40)' }}>
                      {hasLoc ? (inRange ? '현장' : '현장 밖') : isExt ? '외부' : '위치없음'}
                    </span>
                  </div>
                )
              })
            )}
          </div>

          {/* 토요특강 · 외부 참가자 직접 추가 */}
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ fontSize: '13px', fontWeight: '700', color: '#C9941A', marginBottom: '4px' }}>🎟️ 토요특강 · 외부 참가자 추가</p>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '10px', lineHeight: 1.6 }}>
              계정·QR 없이 오신 외부 참가자는 이름만 입력하면 바로 출석에 추가됩니다.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                value={extName}
                onChange={(e) => setExtName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addExternal()}
                placeholder="외부 참가자 이름"
                className="rd-input"
                style={{ flex: 1 }}
              />
              <button onClick={addExternal} disabled={addingExt} className="btn-gold" style={{ padding: '0 18px', fontSize: '13px', whiteSpace: 'nowrap', opacity: addingExt ? 0.5 : 1 }}>
                {addingExt ? '추가중' : '출석 추가'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function QrListPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080C10' }}>
        <div className="app-spinner" />
      </div>
    }>
      <ListInner />
    </Suspense>
  )
}
