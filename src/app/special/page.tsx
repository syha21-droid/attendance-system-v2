'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { LogOut, Ticket, RefreshCw, CheckCircle, Clock, XCircle } from 'lucide-react'
import { clearSessionCookie } from '@/lib/session'

interface Lecture {
  id: string
  name: string
  instructor: string
  description: string
  createdAt: string
  myRegistration: {
    id: string
    status: 'pending' | 'approved'
    member_type: string
    paid: boolean
    attended: boolean
  } | null
}

interface Entitlement {
  id: string
  kind: string
  total: number
  used: number
}

export default function SpecialHome() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [entitlements, setEntitlements] = useState<Entitlement[]>([])
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('user')
    if (!saved) { router.push('/login'); return }
    const u = JSON.parse(saved)
    setUser(u)
  }, [router])

  const load = useCallback(async (u: any) => {
    setLoading(true)
    try {
      const [lectRes, entRes] = await Promise.all([
        fetch(`/api/special/lectures?userId=${encodeURIComponent(u.id)}`, { cache: 'no-store' }),
        u.memberType !== 'external'
          ? fetch(`/api/special/entitlements?userId=${encodeURIComponent(u.id)}`, { cache: 'no-store' })
          : Promise.resolve(null),
      ])
      const lectData = await lectRes.json()
      setLectures(lectData.lectures || [])
      if (entRes) {
        const entData = await entRes.json()
        setEntitlements(entData.entitlements || [])
      }
    } catch {
      toast.error('데이터를 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) load(user)
  }, [user, load])

  const register = async (lecture: Lecture) => {
    if (!user) return
    setRegistering(lecture.id)
    try {
      const res = await fetch('/api/special/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: lecture.id,
          userId: user.id,
          memberType: user.memberType || 'official',
          entitlementKind: 'saturday_special',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.noEntitlement) {
          toast.error('사용 가능한 수강권이 없습니다. 관리자에게 문의하세요.')
        } else {
          toast.error(data.error || '신청 실패')
        }
        return
      }
      toast.success(data.message || '신청 완료!')
      load(user)
    } catch {
      toast.error('네트워크 오류')
    } finally {
      setRegistering(null)
    }
  }

  const logout = () => {
    clearSessionCookie()
    localStorage.removeItem('user')
    router.push('/login')
  }

  const totalRemaining = entitlements.reduce((s, e) => s + (e.total - e.used), 0)
  const memberLabel =
    user?.memberType === 'external' ? '외부 참가자' : user?.memberType === 'official' ? '사내 수강생' : '수강생'

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <div className="app-spinner" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-100">
      <nav className="bg-white shadow sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">🎟️ 특강</h1>
            <p className="text-xs text-gray-500">{memberLabel} · {user.name}</p>
          </div>
          <button onClick={logout} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-1 text-sm">
            <LogOut className="w-4 h-4" /> 로그아웃
          </button>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* 수강권 잔여 (내부 회원만) */}
        {user.memberType !== 'external' && (
          <div className="bg-white rounded-2xl shadow p-5">
            <div className="flex items-center gap-2 mb-3">
              <Ticket className="w-5 h-5 text-orange-500" />
              <h2 className="font-bold text-gray-900">내 수강권</h2>
            </div>
            {entitlements.length === 0 ? (
              <p className="text-sm text-gray-500">보유 수강권이 없습니다. 관리자에게 문의하세요.</p>
            ) : (
              <div className="space-y-2">
                {entitlements.map((e) => (
                  <div key={e.id} className="flex items-center justify-between bg-orange-50 rounded-lg px-4 py-2">
                    <span className="text-sm font-medium text-gray-700">{e.kind}</span>
                    <span className="font-bold text-orange-600">
                      잔여 {e.total - e.used} / {e.total}장
                    </span>
                  </div>
                ))}
                <p className="text-right text-xs text-gray-400">총 잔여 {totalRemaining}장</p>
              </div>
            )}
          </div>
        )}

        {/* 특강 목록 */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">특강 목록</h2>
          <button
            onClick={() => load(user)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <RefreshCw className="w-4 h-4" /> 새로고침
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="app-spinner" /></div>
        ) : lectures.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-10 text-center">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-gray-500">현재 신청 가능한 특강이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {lectures.map((lec) => {
              const reg = lec.myRegistration
              return (
                <div key={lec.id} className="bg-white rounded-2xl shadow p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 text-lg leading-snug">{lec.name}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">👨‍🏫 {lec.instructor}</p>
                      {lec.description && (
                        <p className="text-sm text-gray-600 mt-2">{lec.description}</p>
                      )}
                    </div>
                    <RegistrationBadge reg={reg} />
                  </div>

                  <div className="mt-4">
                    {!reg ? (
                      <button
                        onClick={() => register(lec)}
                        disabled={registering === lec.id}
                        className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition text-sm"
                      >
                        {registering === lec.id
                          ? '신청 중...'
                          : user.memberType === 'external'
                            ? '신청하기 (승인 필요)'
                            : `수강권 사용하여 신청 (잔여 ${totalRemaining}장)`}
                      </button>
                    ) : reg.status === 'pending' ? (
                      <p className="text-center text-sm text-amber-600 bg-amber-50 rounded-xl py-2.5 font-medium">
                        ⏳ 관리자 승인 대기 중
                      </p>
                    ) : (
                      <p className="text-center text-sm text-green-700 bg-green-50 rounded-xl py-2.5 font-medium">
                        ✅ 신청 승인됨 — 현장에서 GPS 출석 체크를 하세요
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 외부 회원 안내 */}
        {user.memberType === 'external' && (
          <div className="bg-white rounded-2xl shadow p-5 text-sm text-gray-600 space-y-1">
            <p className="font-bold text-gray-800">📌 외부 참가자 안내</p>
            <p>• 신청 후 관리자 승인이 필요합니다.</p>
            <p>• 승인 완료 시 현장에서 GPS 출석 체크가 가능합니다.</p>
            <p>• 사내 수강생은 <a href="/signup" className="text-orange-500 underline">사원번호로 가입</a>하세요.</p>
          </div>
        )}
      </main>
    </div>
  )
}

function RegistrationBadge({ reg }: { reg: Lecture['myRegistration'] }) {
  if (!reg) return null
  if (reg.status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium whitespace-nowrap">
        <Clock className="w-3 h-3" /> 승인 대기
      </span>
    )
  }
  if (reg.attended) {
    return (
      <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium whitespace-nowrap">
        <CheckCircle className="w-3 h-3" /> 출석 완료
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium whitespace-nowrap">
      <CheckCircle className="w-3 h-3" /> 승인됨
    </span>
  )
}
