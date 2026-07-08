'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, QrCode, Camera, CheckCircle2, Trash2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'

interface Attendee {
  id: string
  name: string
  at: number
}

// 학생 QR 페이로드(RDQR1:...)에서 이름을 뽑아본다. 실패하면 빈 문자열.
function extractName(token: string): string {
  try {
    if (!token.startsWith('RDQR1:')) return ''
    let b64 = token.slice(6).replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4) b64 += '='
    const json = decodeURIComponent(escape(atob(b64)))
    const obj = JSON.parse(json)
    return typeof obj?.name === 'string' ? obj.name : ''
  } catch {
    return ''
  }
}

const STORAGE_KEY = 'scanOnlyAttendees'

export default function AdminScanOnlyPage() {
  const router = useRouter()
  const [list, setList] = useState<Attendee[]>([])
  const [scanning, setScanning] = useState(false)
  const [pendingName, setPendingName] = useState('')
  const [flash, setFlash] = useState<string | null>(null)

  const scannerRef = useRef<any>(null)
  const startingRef = useRef(false)
  const busyRef = useRef(false)
  const flashTimer = useRef<NodeJS.Timeout | null>(null)
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  // 저장된 목록 불러오기
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setList(JSON.parse(saved))
    } catch {}
  }, [])

  const persist = (next: Attendee[]) => {
    setList(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {}
  }

  const showFlash = useCallback((msg: string) => {
    setFlash(msg)
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(null), 1600)
  }, [])

  // QR 인식 → 이름칸으로 포커스만 이동 (인식되면 성함만 적으면 됨)
  const handleDecoded = useCallback(
    (token: string) => {
      if (busyRef.current) return
      busyRef.current = true
      const nm = extractName(token)
      if (nm) setPendingName(nm)
      showFlash(nm ? `인식됨 · ${nm}` : '인식됨 · 성함을 입력하세요')
      setTimeout(() => {
        nameInputRef.current?.focus()
        busyRef.current = false
      }, 400)
    },
    [showFlash]
  )

  // 카메라 시작
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

  // 페이지 진입 시 자동으로 카메라 켜기
  useEffect(() => {
    startScanner()
    return () => {
      stopScanner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 성함 저장
  const addName = () => {
    const nm = pendingName.trim()
    if (!nm) {
      toast.error('성함을 입력하세요')
      nameInputRef.current?.focus()
      return
    }
    const entry: Attendee = { id: Math.random().toString(36).slice(2), name: nm, at: Date.now() }
    persist([entry, ...list])
    setPendingName('')
    toast.success(`${nm}님 추가됨`)
    nameInputRef.current?.focus()
  }

  const removeOne = (id: string) => {
    persist(list.filter((x) => x.id !== id))
  }

  const clearAll = () => {
    if (!confirm('출석 목록을 모두 지울까요?')) return
    persist([])
  }

  const fmt = (t: number) =>
    new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

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
        {/* 카메라 */}
        <div className="rd-surface p-4">
          <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Camera style={{ width: '16px', height: '16px', color: '#C9941A' }} /> QR을 비추세요
            </h3>
            <span style={{ fontSize: '11px', fontWeight: '700', color: scanning ? '#4ade80' : 'rgba(255,255,255,0.40)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: scanning ? '#4ade80' : 'rgba(255,255,255,0.30)', display: 'inline-block' }} />
              {scanning ? '인식 중' : '대기'}
            </span>
          </div>

          <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
            <div id="qr-reader" style={{ width: '100%' }} />
            {flash && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px', background: 'rgba(20,40,25,0.92)' }}>
                <CheckCircle2 style={{ width: '52px', height: '52px', color: '#4ade80', marginBottom: '10px' }} />
                <p style={{ fontSize: '15px', fontWeight: '700', color: '#86efac' }}>{flash}</p>
              </div>
            )}
          </div>
        </div>

        {/* 성함 입력 */}
        <div className="rd-surface p-4">
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.70)', marginBottom: '8px' }}>성함 입력 후 추가</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              ref={nameInputRef}
              value={pendingName}
              onChange={(e) => setPendingName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addName()}
              placeholder="예: 홍길동"
              className="rd-input"
              style={{ flex: 1 }}
            />
            <button onClick={addName} className="btn-gold" style={{ padding: '0 18px', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
              <Plus style={{ width: '15px', height: '15px' }} /> 추가
            </button>
          </div>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.30)', marginTop: '8px' }}>
            QR을 스캔하면 성함이 자동으로 채워집니다. QR 없이 직접 입력해도 됩니다.
          </p>
        </div>

        {/* 출석 목록 */}
        <div className="rd-surface p-4">
          <div className="flex items-center justify-between" style={{ marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'white' }}>출석 명단 ({list.length}명)</h3>
            {list.length > 0 && (
              <button onClick={clearAll} style={{ fontSize: '12px', color: 'rgba(248,113,113,0.8)', background: 'transparent', border: 'none', cursor: 'pointer' }}>전체 삭제</button>
            )}
          </div>
          {list.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.30)', textAlign: 'center', padding: '20px 0' }}>아직 인식된 사람이 없습니다</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {list.map((a, i) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#C9941A', width: '20px' }}>{list.length - i}</span>
                    <span style={{ fontSize: '14px', fontWeight: '600', color: 'white' }}>{a.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{fmt(a.at)}</span>
                    <button onClick={() => removeOne(a.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.30)' }}>
                      <Trash2 style={{ width: '15px', height: '15px' }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
