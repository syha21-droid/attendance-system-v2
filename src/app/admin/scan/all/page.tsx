'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, LayoutGrid, BarChart3, RefreshCw, Camera } from 'lucide-react'

interface Sess {
  id: string
  name: string
  radius_m: number
  ends_at: string
  starts_at?: string
}

export default function AdminScanAllPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Sess[]>([])
  const [counts, setCounts] = useState<Record<string, { total: number; exited: number }>>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/live/session?courseId=scan-only&all=1', { cache: 'no-store' })
      const data = await res.json()
      const list: Sess[] = res.ok ? data.sessions || [] : []
      setSessions(list)
      // 각 세션 인원/퇴장 수 집계
      const c: Record<string, { total: number; exited: number }> = {}
      await Promise.all(
        list.map(async (s) => {
          try {
            const r = await fetch(`/api/qr/scans?session=${s.id}`, { cache: 'no-store' })
            const j = await r.json()
            const scans = r.ok ? j.scans || [] : []
            c[s.id] = { total: scans.length, exited: scans.filter((x: any) => x.exit_at).length }
          } catch {
            c[s.id] = { total: 0, exited: 0 }
          }
        })
      )
      setCounts(c)
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 8000)
    return () => clearInterval(t)
  }, [load])

  const fmt = (t?: string) =>
    t ? new Date(t).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'
  const isLive = (s: Sess) => new Date(s.ends_at).getTime() > Date.now()

  return (
    <div className="min-h-screen" style={{ background: '#080C10' }}>
      <nav style={{ background: '#0D1218', borderBottom: '1px solid rgba(255,255,255,0.07)' }} className="sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <button onClick={() => router.push('/select')} className="flex items-center gap-2" style={{ color: '#C9941A', fontSize: '13px', fontWeight: '600', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <ArrowLeft style={{ width: '15px', height: '15px' }} /> 나가기
          </button>
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LayoutGrid style={{ width: '15px', height: '15px', color: '#C9941A' }} /> 관리자 · 전체 보기
          </span>
          <button onClick={load} style={{ color: 'rgba(255,255,255,0.5)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <RefreshCw style={{ width: '15px', height: '15px' }} />
          </button>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div className="flex items-center justify-between">
          <div>
            <p style={{ fontSize: '10px', fontWeight: '700', color: '#C9941A', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '4px' }}>모든 교시 · 명단 · 통계</p>
            <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'white' }}>스캔 출석 전체</h1>
          </div>
          <button onClick={() => router.push('/admin/scan')} className="btn-gold" style={{ padding: '9px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Camera style={{ width: '14px', height: '14px' }} /> 새 스캔
          </button>
        </div>

        {loading ? (
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '30px 0' }}>불러오는 중...</p>
        ) : sessions.length === 0 ? (
          <div className="rd-surface p-8" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.40)' }}>아직 생성된 스캔 코드가 없습니다</p>
            <button onClick={() => router.push('/admin/scan')} className="btn-gold" style={{ marginTop: '16px', padding: '10px 20px', fontSize: '13px' }}>첫 스캔 시작하기</button>
          </div>
        ) : (
          sessions.map((s) => {
            const c = counts[s.id] || { total: 0, exited: 0 }
            const live = isLive(s)
            return (
              <div key={s.id} className="rd-surface p-4">
                <div className="flex items-center justify-between" style={{ marginBottom: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3 style={{ fontSize: '15px', fontWeight: '700', color: 'white' }}>{s.name}</h3>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '10px', background: live ? 'rgba(74,222,128,0.13)' : 'rgba(255,255,255,0.06)', color: live ? '#4ade80' : 'rgba(255,255,255,0.40)' }}>
                        {live ? '진행중' : '종료'}
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '3px' }}>시작 {fmt(s.starts_at)} · 반경 {s.radius_m}m</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '18px', marginBottom: '12px' }}>
                  <div><span style={{ fontSize: '22px', fontWeight: 800, color: '#C9941A' }}>{c.total}</span><span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginLeft: '4px' }}>명 인식</span></div>
                  <div><span style={{ fontSize: '22px', fontWeight: 800, color: '#60a5fa' }}>{c.exited}</span><span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginLeft: '4px' }}>명 퇴장</span></div>
                </div>

                <button
                  onClick={() => window.open(`/admin/scan/stats?session=${s.id}&name=${encodeURIComponent(s.name)}&radius=${s.radius_m}`, '_blank')}
                  className="btn-gold"
                  style={{ width: '100%', height: '42px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <BarChart3 style={{ width: '15px', height: '15px' }} /> 명단 · 통계 보기 (엑셀 다운로드)
                </button>
              </div>
            )
          })
        )}
      </main>
    </div>
  )
}
