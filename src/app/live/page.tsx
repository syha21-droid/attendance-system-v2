'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MapPin, CheckCircle2, XCircle } from 'lucide-react'

function getDeviceId(): string {
  let id = localStorage.getItem('deviceId')
  if (!id) {
    id = (crypto as any).randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now()
    localStorage.setItem('deviceId', id)
  }
  return id
}

function LiveAttendInner() {
  const router = useRouter()
  const params = useSearchParams()
  const sessionId = params.get('session') || ''

  const [user, setUser] = useState<any>(null)
  const [code, setCode] = useState('')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locState, setLocState] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('user')
    if (!saved) {
      router.push('/login')
      return
    }
    setUser(JSON.parse(saved))
    requestLocation()
  }, [router])

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocState('fail')
      return
    }
    setLocState('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocState('ok')
      },
      () => setLocState('fail'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const submit = async () => {
    if (code.length < 6) {
      setResult({ ok: false, msg: '6자리 코드를 입력하세요' })
      return
    }
    setSubmitting(true)
    setResult(null)
    try {
      const res = await fetch('/api/live/attend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          code,
          lat: coords?.lat,
          lng: coords?.lng,
          deviceId: getDeviceId(),
          userId: user?.id,
          userName: user?.name,
        }),
      })
      const data = await res.json()
      setResult({ ok: !!data.ok, msg: data.ok ? (data.message || '✅ 출석 완료!') : (data.error || '출석 실패') })
    } catch {
      setResult({ ok: false, msg: '네트워크 오류' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!sessionId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 text-center gap-3">
        <p className="text-5xl">📡</p>
        <p className="text-lg font-bold text-gray-900">출석 세션이 지정되지 않았습니다</p>
        <p className="text-sm text-gray-600">운영자 화면의 QR코드를 스캔해 접속하세요.</p>
      </div>
    )
  }

  if (result?.ok) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 px-4 text-center gap-4">
        <CheckCircle2 className="w-20 h-20 text-green-600" />
        <p className="text-2xl font-bold text-gray-900">출석 완료!</p>
        <p className="text-gray-600">{user?.name}님, 출석이 서버에 기록되었습니다.</p>
        <button onClick={() => router.push('/student')} className="mt-2 bg-green-600 text-white font-bold py-2 px-6 rounded-lg">
          내 강의로
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-8">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-1">📡 현장 출석</h1>
        <p className="text-sm text-gray-500 text-center mb-6">{user?.name ? `${user.name}님` : ''}</p>

        {/* 위치 상태 */}
        <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 text-sm font-semibold ${
          locState === 'ok' ? 'bg-green-50 text-green-700'
          : locState === 'fail' ? 'bg-red-50 text-red-700'
          : 'bg-gray-50 text-gray-600'
        }`}>
          <MapPin className="w-4 h-4" />
          {locState === 'ok' && '위치 확인됨'}
          {locState === 'loading' && '위치 확인 중...'}
          {locState === 'idle' && '위치 대기'}
          {locState === 'fail' && (
            <button onClick={requestLocation} className="underline">위치 권한 허용하고 다시 시도</button>
          )}
        </div>

        {/* 코드 입력 */}
        <label className="block text-sm font-bold text-gray-800 mb-2">현장 화면의 6자리 코드</label>
        <input
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          className="w-full text-center text-4xl font-black tracking-[0.3em] tabular-nums px-4 py-4 border-2 border-gray-300 rounded-xl text-gray-900 focus:border-indigo-500"
        />

        {result && !result.ok && (
          <div className="flex items-start gap-2 bg-red-50 text-red-700 p-3 rounded-lg mt-4 text-sm font-semibold">
            <XCircle className="w-5 h-5 flex-shrink-0" /> {result.msg}
          </div>
        )}

        <button
          onClick={submit}
          disabled={submitting || code.length < 6}
          className="w-full mt-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl text-lg disabled:opacity-50"
        >
          {submitting ? '확인 중...' : '출석하기'}
        </button>
        <p className="text-xs text-gray-400 text-center mt-3">코드는 15초마다 바뀝니다. 현장 화면을 보세요.</p>
      </div>
    </div>
  )
}

export default function LiveAttendPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100"><div className="app-spinner" /></div>}>
      <LiveAttendInner />
    </Suspense>
  )
}
