'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, LogOut, Monitor, Smartphone, Shield, User } from 'lucide-react'
import { clearSessionCookie } from '@/lib/session'

interface LoginRecord {
  userId: string
  name: string
  email: string
  isAdmin: boolean
  time: string
  device: string
}

export default function LoginHistoryPage() {
  const router = useRouter()
  const [records, setRecords] = useState<LoginRecord[]>([])
  const [filter, setFilter] = useState<'all' | 'admin' | 'student'>('all')

  useEffect(() => {
    const saved = localStorage.getItem('login_history')
    if (saved) {
      try { setRecords(JSON.parse(saved)) } catch { setRecords([]) }
    }
  }, [])

  const filtered = records.filter((r) => {
    if (filter === 'admin') return r.isAdmin
    if (filter === 'student') return !r.isAdmin
    return true
  })

  const fmt = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen" style={{ background: '#080C10' }}>
      <nav style={{ background: '#0D1218', borderBottom: '1px solid rgba(255,255,255,0.07)' }} className="sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <button onClick={() => router.push('/admin')} className="rd-nav-btn flex items-center gap-2">
            <ArrowLeft style={{ width: '15px', height: '15px' }} />
            <span>돌아가기</span>
          </button>
          <div className="flex items-center gap-2.5">
            <div style={{ width: '22px', height: '22px', border: '1px solid #C9941A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'Georgia, serif', color: '#C9941A', fontSize: '11px', fontWeight: '700' }}>R</span>
            </div>
            <span style={{ fontFamily: 'Georgia, serif', color: 'rgba(255,255,255,0.60)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em', textTransform: 'uppercase' }}>로그인 기록</span>
          </div>
          <button onClick={() => { clearSessionCookie(); localStorage.removeItem('user'); router.push('/login') }} className="rd-nav-btn">
            <LogOut style={{ width: '15px', height: '15px' }} />
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* 요약 통계 */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4" style={{ marginBottom: '24px' }}>
          {[
            { label: '전체 접속', value: records.length, color: 'white' },
            { label: '관리자', value: records.filter((r) => r.isAdmin).length, color: '#C9941A' },
            { label: '수강생', value: records.filter((r) => !r.isAdmin).length, color: 'rgba(255,255,255,0.60)' },
          ].map((s) => (
            <div key={s.label} className="rd-surface p-5">
              <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.30)', marginBottom: '10px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{s.label}</p>
              <p style={{ fontSize: '2rem', fontWeight: '700', color: s.color, lineHeight: 1 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* 필터 + 목록 */}
        <div className="rd-surface overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.70)' }}>접속 이력</h2>
            <div className="flex gap-2">
              {(['all', 'admin', 'student'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '5px 14px', fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                    background: filter === f ? 'rgba(201,148,26,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${filter === f ? 'rgba(201,148,26,0.40)' : 'rgba(255,255,255,0.08)'}`,
                    color: filter === f ? '#C9941A' : 'rgba(255,255,255,0.35)',
                    transition: 'all 0.15s',
                  }}
                >
                  {f === 'all' ? '전체' : f === 'admin' ? '관리자' : '수강생'}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.22)', fontSize: '13px' }}>
              접속 기록이 없습니다
            </div>
          ) : (
            <div>
              {filtered.map((r, i) => (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                  style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <div className="flex items-center gap-3">
                    <div style={{
                      width: '32px', height: '32px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: r.isAdmin ? 'rgba(201,148,26,0.10)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${r.isAdmin ? 'rgba(201,148,26,0.25)' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                      {r.isAdmin
                        ? <Shield style={{ width: '13px', height: '13px', color: '#C9941A' }} />
                        : <User style={{ width: '13px', height: '13px', color: 'rgba(255,255,255,0.40)' }} />
                      }
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.82)' }}>{r.name}</p>
                        <span style={{
                          fontSize: '10px', fontWeight: '700', padding: '1px 7px',
                          color: r.isAdmin ? '#C9941A' : 'rgba(255,255,255,0.35)',
                          border: `1px solid ${r.isAdmin ? 'rgba(201,148,26,0.30)' : 'rgba(255,255,255,0.10)'}`,
                          background: r.isAdmin ? 'rgba(201,148,26,0.07)' : 'rgba(255,255,255,0.03)',
                        }}>
                          {r.isAdmin ? '관리자' : '수강생'}
                        </span>
                      </div>
                      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)', marginTop: '2px' }}>{r.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4" style={{ flexShrink: 0 }}>
                    <div className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.28)' }}>
                      {r.device === '모바일'
                        ? <Smartphone style={{ width: '12px', height: '12px' }} />
                        : <Monitor style={{ width: '12px', height: '12px' }} />
                      }
                      <span style={{ fontSize: '11px' }}>{r.device}</span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', minWidth: '90px', textAlign: 'right' }}>
                      {fmt(r.time)}
                    </p>
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
