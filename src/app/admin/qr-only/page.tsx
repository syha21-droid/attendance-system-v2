'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, QrCode, Users, Camera, CheckCircle2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { Course } from '@/types'
import { loadCourses } from '@/lib/dataStore'

interface QrSession {
  id: string
  name: string
  course_id: string
}

interface Flash {
  ok: boolean
  name: string
  msg: string
}

export default function AdminQrOnlyScannerPage() {
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [courseId, setCourseId] = useState('')
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  const [session, setSession] = useState<QrSession | null>(null)
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

  const startSession = async () => {
    if (!courseId || !name.trim()) return toast.error('강의와 이름을 입력하세요')
    setCreating(true)
    try {
      const res = await fetch('/api/qr/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 위치 없이 생성 (C안)
        body: JSON.stringify({ courseId, name, durationMin: 360 }),
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
          showFlash({
            ok: true,
            name: d.userName,
            msg: d.alreadyScanned ? '이미 인식됨' : '출석 인식 완료',
          })
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
        setTimeout(() => {
          busyRef.current = false
        }, 800)
      }
    },
    [session, showFlash]
  )

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
    t ? new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'

  return (
    <div className="min-h-screen" style={{ background: '#080C10' }}>
      <nav style={{ background: '#0D1218', borderBottom: '1px solid rgba(255,255,255,0.07)' }} className="sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <button onClick={() => router.push('/admin')} className="flex items-center gap-2" style={{ color: '#C9941A', fontSize: '13px', fontWeight: '600', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <ArrowLeft style={{ width: '15px', height: '15px' }} /> 돌아가기
          </button>
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <QrCode style={{ width: '15px', height: '15px', color: '#C9941A' }} /> QR 출석 인식기 · C안
          </span>
          <span style={{ width: '60px' }} />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {!session ? (
          /* ===== 세션 생성 (위치 없음) ===== */
          <div className="rd-surface p-6 sm:p-8 max-w-xl mx-auto" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <p style={{ fontSize: '10px', fontWeight: '700', color: '#C9941A', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '6px' }}>C안 · QR만</p>
              <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'white' }}>QR 인식기 준비</h2>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.38)', marginTop: '4px' }}>학생들의 출석 QR을 카메라로 스캔하면 출석 인식됩니다. (위치 확인 없음)</p>
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
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.65)', background: 'rgba(255,255,255,0.06)', padding: '3px 10px', borderRadius: '999px' }}>전체 {scans.length}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '460px', overflowY: 'auto' }}>
                {scans.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '40px 0' }}>아직 인식된 학생이 없습니다</p>
                ) : (
                  scans.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div>
                        <p style={{ fontSize: '14px', fontWeight: '700', color: 'white' }}>✅ {s.user_name || s.user_id}</p>
                        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '2px' }}>인식 {fmt(s.entry_at)}</p>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: '700', color: '#4ade80' }}>출석</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
