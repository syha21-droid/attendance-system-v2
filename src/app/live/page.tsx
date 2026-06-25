'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
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

type Status = 'init' | 'locating' | 'checked_in' | 'present' | 'left' | 'too_far' | 'ended' | 'error'

function LiveInner() {
  const router = useRouter()
  const params = useSearchParams()
  const sessionId = params.get('session') || ''

  const [user, setUser] = useState<any>(null)
  const [status, setStatus] = useState<Status>('init')
  const [message, setMessage] = useState('')
  const [distance, setDistance] = useState<number | null>(null)
  const timer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('user')
    if (!saved) {
      router.push('/login')
      return
    }
    setUser(JSON.parse(saved))
  }, [router])

  // 위치 핑 1회
  const sendPing = (u: any) => {
    if (!navigator.geolocation) {
      setStatus('error')
      setMessage('이 기기는 위치를 지원하지 않습니다')
      return
    }
    if (status === 'init') setStatus('locating')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch('/api/live/ping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId,
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              userId: u.id,
              userName: u.name,
              deviceId: getDeviceId(),
            }),
          })
          const data = await res.json()
          setDistance(typeof data.distance === 'number' ? data.distance : null)
          if (data.status === 'ended') {
            setStatus('ended')
            setMessage(data.error || '종료된 출석입니다')
            stopLoop()
          } else if (data.ok && (data.status === 'checked_in' || data.status === 'present')) {
            setStatus('present')
            setMessage('')
          } else if (data.status === 'left') {
            setStatus('left')
            setMessage(data.error || '현장을 벗어났습니다')
          } else if (data.status === 'too_far') {
            setStatus('too_far')
            setMessage(data.error || '현장에서 너무 멉니다')
          } else {
            setStatus('error')
            setMessage(data.error || '오류가 발생했습니다')
          }
        } catch {
          setStatus('error')
          setMessage('네트워크 오류')
        }
      },
      () => {
        setStatus('error')
        setMessage('위치 권한을 허용해야 출석할 수 있습니다')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const stopLoop = () => {
    if (timer.current) {
      clearInterval(timer.current)
      timer.current = null
    }
  }

  // 자동 체크인 + 주기적 위치 핑(1분)
  useEffect(() => {
    if (!user || !sessionId) return
    sendPing(user)
    timer.current = setInterval(() => sendPing(user), 60000)
    return () => stopLoop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, sessionId])

  if (!sessionId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 text-center gap-3">
        <p className="text-5xl">📡</p>
        <p className="text-lg font-bold text-gray-900">출석 세션이 지정되지 않았습니다</p>
        <p className="text-sm text-gray-600">운영자 화면의 QR코드를 스캔해 접속하세요.</p>
      </div>
    )
  }

  // 화면 구성
  const isPresent = status === 'present' || status === 'checked_in'

  return (
    <div className={`min-h-screen flex items-center justify-center px-4 py-8 ${
      isPresent ? 'bg-gradient-to-br from-green-50 to-emerald-100'
      : status === 'left' ? 'bg-gradient-to-br from-orange-50 to-amber-100'
      : status === 'too_far' || status === 'error' || status === 'ended' ? 'bg-gradient-to-br from-red-50 to-rose-100'
      : 'bg-gradient-to-br from-blue-50 to-indigo-100'
    }`}>
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
        <p className="text-sm text-gray-500 mb-4">{user?.name ? `${user.name}님` : ''}</p>

        {(status === 'init' || status === 'locating') && (
          <>
            <div className="app-spinner mx-auto mb-4" />
            <p className="text-lg font-bold text-gray-900">위치 확인 중...</p>
            <p className="text-sm text-gray-500 mt-2">위치 권한을 허용해주세요</p>
          </>
        )}

        {isPresent && (
          <>
            <CheckCircle2 className="w-20 h-20 text-green-600 mx-auto mb-3" />
            <p className="text-2xl font-bold text-gray-900">출석 중 ✅</p>
            <p className="text-sm text-gray-600 mt-2">현장에 있는 동안 자동으로 출석이 유지됩니다.</p>
            {distance != null && <p className="text-xs text-gray-400 mt-2">현장까지 약 {distance}m</p>}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-5 text-left">
              <p className="text-xs text-green-800 font-semibold">📌 이 화면을 켜두세요</p>
              <p className="text-xs text-green-700 mt-1">현장을 벗어나면 자동으로 퇴장 처리됩니다.</p>
            </div>
          </>
        )}

        {status === 'left' && (
          <>
            <LogOut className="w-20 h-20 text-orange-500 mx-auto mb-3" />
            <p className="text-2xl font-bold text-gray-900">퇴장 처리됨</p>
            <p className="text-sm text-gray-600 mt-2">{message}</p>
            <p className="text-xs text-gray-400 mt-2">현장에 다시 들어오면 자동으로 출석이 복구됩니다.</p>
          </>
        )}

        {status === 'too_far' && (
          <>
            <MapPin className="w-20 h-20 text-red-500 mx-auto mb-3" />
            <p className="text-2xl font-bold text-gray-900">현장 밖입니다</p>
            <p className="text-sm text-red-600 mt-2 font-semibold">{message}</p>
            <p className="text-xs text-gray-500 mt-3">현장(강의실)으로 이동하면 자동으로 출석됩니다.</p>
            <button onClick={() => sendPing(user)} className="mt-4 bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg">
              다시 확인
            </button>
          </>
        )}

        {(status === 'error' || status === 'ended') && (
          <>
            <XCircle className="w-20 h-20 text-red-500 mx-auto mb-3" />
            <p className="text-xl font-bold text-gray-900">{status === 'ended' ? '종료됨' : '출석 불가'}</p>
            <p className="text-sm text-red-600 mt-2 font-semibold">{message}</p>
            {status === 'error' && (
              <button onClick={() => sendPing(user)} className="mt-4 bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg">
                다시 시도
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function LivePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100"><div className="app-spinner" /></div>}>
      <LiveInner />
    </Suspense>
  )
}
