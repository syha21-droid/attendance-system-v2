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

// phase: 출석 진행 단계 (출석/퇴장 두 시점에만 위치 확인 → 중간엔 창 꺼도 됨)
type Phase =
  | 'locating'    // 위치 확인 중
  | 'too_far'     // 현장 밖 (출석 전)
  | 'ready'       // 현장 안, 출석 가능
  | 'attending'   // 출석함, 수업 중 (창 꺼도 됨)
  | 'can_exit'    // 수업 종료 → 퇴장(위치 확인) 가능
  | 'accepted'    // 출석 인정 완료 (출석+퇴장 위치 확인 완료)
  | 'left_early'  // 미인정 (퇴장 위치 확인 안 함)
  | 'ended'       // 종료된 세션
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

function LiveInner() {
  const router = useRouter()
  const params = useSearchParams()
  const sessionId = params.get('session') || ''

  const [user, setUser] = useState<any>(null)
  const [phase, setPhase] = useState<Phase>('locating')
  const [distance, setDistance] = useState<number | null>(null)
  const [radius, setRadius] = useState<number | null>(null)
  const [endsAt, setEndsAt] = useState<string | null>(null)
  const [marked, setMarked] = useState<{ lat: number; lng: number } | null>(null)      // 출석을 찍은 위치
  const [markedExit, setMarkedExit] = useState<{ lat: number; lng: number } | null>(null) // 퇴장을 찍은 위치
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('user')
    if (!saved) {
      router.push('/login')
      return
    }
    setUser(JSON.parse(saved))
  }, [router])

  const call = useCallback(
    async (action: string, u: any) => {
      let loc: { lat: number; lng: number } | null = null
      try {
        loc = await getLoc()
      } catch {
        // 출석/퇴장은 위치가 반드시 필요. probe는 위치 없이도 진행(현장 밖으로 처리)
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
          action,
          sessionId,
          lat: loc?.lat,
          lng: loc?.lng,
          userId: u.id,
          userName: u.name,
          deviceId: getDeviceId(),
        }),
      })
      const data = await res.json()
      if (typeof data.distance === 'number') setDistance(data.distance)
      if (typeof data.radius === 'number') setRadius(data.radius)
      if (data.endsAt) setEndsAt(data.endsAt)
      if (typeof data.myLat === 'number' && typeof data.myLng === 'number') {
        setMarked({ lat: data.myLat, lng: data.myLng })
      }
      if (typeof data.exitLat === 'number' && typeof data.exitLng === 'number') {
        setMarkedExit({ lat: data.exitLat, lng: data.exitLng })
      }
      return data
    },
    [sessionId]
  )

  // probe 결과로 화면 단계 복원 (새로고침/창 닫았다 다시 접속해도 정확히 복원)
  const applyProbe = (d: any) => {
    if (d.recordStatus === 'completed') setPhase('accepted')
    else if (d.recordStatus === 'left_early') setPhase('left_early')
    else if (d.recordStatus === 'present' || d.recordStatus === 'left') setPhase(d.ended ? 'can_exit' : 'attending')
    else if (d.ended) setPhase('ended')
    else if (d.inRange) setPhase('ready')
    else setPhase('too_far')
  }

  // 최초 위치 확인 (probe)
  useEffect(() => {
    if (!user || !sessionId) return
    ;(async () => {
      const d = await call('probe', user)
      if (d) applyProbe(d)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, sessionId])

  // 수업 중(attending) → 종료 시각이 지나면 자동으로 '퇴장 가능'으로 전환
  useEffect(() => {
    if (phase !== 'attending' || !endsAt) return
    const end = new Date(endsAt).getTime()
    const check = () => {
      if (Date.now() >= end) setPhase('can_exit')
    }
    check()
    const t = setInterval(check, 10000)
    return () => clearInterval(t)
  }, [phase, endsAt])

  const doCheckin = async () => {
    setBusy(true)
    setMsg('')
    const d = await call('checkin', user)
    setBusy(false)
    if (!d) return
    if (d.ok) {
      setPhase(d.ended ? 'can_exit' : 'attending')
    } else {
      setMsg(d.error || '출석할 수 없습니다')
      if (!d.inRange) setPhase('too_far')
      else if (d.ended) setPhase('ended')
    }
  }

  const recheck = async () => {
    setBusy(true)
    setMsg('')
    const d = await call('probe', user)
    setBusy(false)
    if (d) applyProbe(d)
  }

  const doCheckout = async () => {
    setBusy(true)
    setMsg('')
    const d = await call('checkout', user)
    setBusy(false)
    if (!d) return
    if (d.ok) {
      setPhase('accepted')
    } else {
      // 현장 밖이면 can_exit 유지하여 현장 복귀 후 재시도, 아직 종료 전이면 수업중으로
      setMsg(d.error || '퇴장할 수 없습니다')
      if (!d.ended) setPhase('attending')
    }
  }

  if (!sessionId) {
    return (
      <Center>
        <p className="text-5xl">📡</p>
        <p className="text-lg font-bold text-gray-900">출석 세션이 지정되지 않았습니다</p>
        <p className="text-sm text-gray-600">운영자 화면의 QR코드를 스캔해 접속하세요.</p>
      </Center>
    )
  }

  const endTimeStr = endsAt ? new Date(endsAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 py-8">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center">
        <p className="text-sm text-gray-500 mb-4">{user?.name ? `${user.name}님` : ''}</p>

        {phase === 'locating' && (
          <>
            <div className="app-spinner mx-auto mb-4" />
            <p className="text-lg font-bold text-gray-900">위치 확인 중...</p>
          </>
        )}

        {phase === 'too_far' && (
          <>
            <MapPin className="w-16 h-16 text-red-500 mx-auto mb-3" />
            <p className="text-xl font-bold text-gray-900">현장 밖입니다</p>
            <p className="text-sm text-red-600 mt-2 font-semibold">
              현장까지 약 {distance ?? '-'}m {radius ? `(허용 ${radius}m)` : ''}
            </p>
            <p className="text-xs text-gray-500 mt-3">강의실로 이동한 뒤 다시 확인하세요.</p>
            <button onClick={recheck} disabled={busy} className="mt-4 w-full bg-indigo-600 text-white font-bold py-3 rounded-xl disabled:opacity-50">
              {busy ? '확인 중...' : '📍 위치 다시 확인'}
            </button>
          </>
        )}

        {phase === 'ready' && (
          <>
            <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-3" />
            <p className="text-xl font-bold text-gray-900">현장에 도착했습니다</p>
            <p className="text-sm text-gray-600 mt-1">아래 버튼을 눌러 출석하세요.</p>
            <p className="text-xs text-gray-400 mt-1">현장까지 약 {distance}m</p>
            <button onClick={doCheckin} disabled={busy} className="mt-5 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl text-lg disabled:opacity-50">
              {busy ? '출석 중...' : '✅ 출석하기'}
            </button>
            {endTimeStr && <p className="text-xs text-gray-500 mt-3">🕒 {endTimeStr} 종료 후 현장에서 퇴장하면 출석 인정</p>}
          </>
        )}

        {phase === 'attending' && (
          <>
            <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-3" />
            <p className="text-2xl font-bold text-gray-900">출석 완료 ✅</p>
            <p className="text-sm text-gray-600 mt-2">
              {endTimeStr ? `${endTimeStr} 수업이 끝나면 ` : '수업이 끝나면 '}
              현장에서 <b>퇴장하기</b>를 눌러 출석을 마무리하세요.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-5 text-left">
              <p className="text-xs text-blue-800 font-bold">📱 이제 창을 닫으셔도 됩니다</p>
              <p className="text-xs text-blue-700 mt-1">
                수업이 끝난 뒤 이 페이지를 다시 열어 <b>현장에서</b> 퇴장만 찍으면 출석으로 인정됩니다.
              </p>
            </div>
            {marked && <MarkedLocation lat={marked.lat} lng={marked.lng} label="내가 출석한 위치" />}
            <button onClick={recheck} disabled={busy} className="mt-4 w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2 rounded-xl text-sm disabled:opacity-50">
              {busy ? '확인 중...' : '🔄 상태 새로고침'}
            </button>
          </>
        )}

        {phase === 'can_exit' && (
          <>
            <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-3" />
            <p className="text-xl font-bold text-gray-900">🎉 수업 종료!</p>
            <p className="text-sm text-gray-600 mt-2">현장에서 아래 버튼을 눌러 퇴장하면 출석이 인정됩니다.</p>
            {msg && <p className="text-sm text-red-600 mt-2 font-semibold">{msg}</p>}
            <button onClick={doCheckout} disabled={busy} className="mt-5 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl text-lg disabled:opacity-50">
              {busy ? '위치 확인 중...' : '🚪 퇴장하기 (위치 확인)'}
            </button>
            {marked && <MarkedLocation lat={marked.lat} lng={marked.lng} label="내가 출석한 위치" />}
          </>
        )}

        {phase === 'accepted' && (
          <>
            <CheckCircle2 className="w-20 h-20 text-green-600 mx-auto mb-3" />
            <p className="text-2xl font-bold text-gray-900">출석 인정 완료!</p>
            <p className="text-sm text-gray-600 mt-2">출석·퇴장 위치가 모두 확인됐습니다. 수고하셨어요 👏</p>
            {marked && <MarkedLocation lat={marked.lat} lng={marked.lng} label="내가 출석한 위치" />}
            {markedExit && <MarkedLocation lat={markedExit.lat} lng={markedExit.lng} label="내가 퇴장한 위치" tone="green" />}
            <button onClick={() => router.push('/student')} className="mt-4 bg-green-600 text-white font-bold py-2 px-6 rounded-lg">내 강의로</button>
          </>
        )}

        {phase === 'left_early' && (
          <>
            <LogOut className="w-20 h-20 text-orange-500 mx-auto mb-3" />
            <p className="text-2xl font-bold text-gray-900">출석 미인정</p>
            <p className="text-sm text-gray-600 mt-2">수업 종료 후 현장에서 퇴장을 찍지 않아 출석이 인정되지 않았습니다.</p>
            <button onClick={() => router.push('/student')} className="mt-4 bg-gray-600 text-white font-bold py-2 px-6 rounded-lg">내 강의로</button>
          </>
        )}

        {phase === 'ended' && (
          <>
            <XCircle className="w-16 h-16 text-gray-500 mx-auto mb-3" />
            <p className="text-xl font-bold text-gray-900">종료된 출석입니다</p>
            <p className="text-sm text-gray-600 mt-2">{msg}</p>
          </>
        )}

        {phase === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-3" />
            <p className="text-xl font-bold text-gray-900">출석 불가</p>
            <p className="text-sm text-red-600 mt-2 font-semibold">{msg}</p>
            <button onClick={recheck} disabled={busy} className="mt-4 bg-indigo-600 text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50">다시 시도</button>
          </>
        )}
      </div>
    </div>
  )
}

// 학생이 찍은 위치(출석/퇴장) + 지도 링크
function MarkedLocation({
  lat,
  lng,
  label,
  tone = 'indigo',
}: {
  lat: number
  lng: number
  label: string
  tone?: 'indigo' | 'green'
}) {
  const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`
  const c =
    tone === 'green'
      ? { box: 'bg-green-50 border-green-200', title: 'text-green-800', coord: 'text-green-700', btn: 'bg-green-600 hover:bg-green-700' }
      : { box: 'bg-indigo-50 border-indigo-200', title: 'text-indigo-800', coord: 'text-indigo-700', btn: 'bg-indigo-600 hover:bg-indigo-700' }
  return (
    <div className={`border rounded-lg p-3 mt-4 text-left ${c.box}`}>
      <p className={`text-xs font-bold flex items-center gap-1 ${c.title}`}>
        <MapPin className="w-3.5 h-3.5" /> {label}
      </p>
      <p className={`text-xs mt-1 font-mono ${c.coord}`}>{lat.toFixed(5)}, {lng.toFixed(5)}</p>
      <a
        href={mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-block mt-2 text-xs font-bold text-white px-3 py-1.5 rounded-lg ${c.btn}`}
      >
        🗺️ 지도에서 보기
      </a>
    </div>
  )
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4 text-center gap-3">
      {children}
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
