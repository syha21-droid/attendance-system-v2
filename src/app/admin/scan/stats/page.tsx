'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, BarChart3, Download, RefreshCw } from 'lucide-react'

function StatsInner() {
  const router = useRouter()
  const params = useSearchParams()
  const sessionId = params.get('session') || ''
  const sessionName = params.get('name') || '출석 통계'
  const radius = Number(params.get('radius')) || 150

  const [scans, setScans] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!sessionId) return
    try {
      const res = await fetch(`/api/qr/scans?session=${sessionId}`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setScans(data.scans || [])
    } catch {}
    setLoading(false)
  }, [sessionId])

  useEffect(() => {
    load()
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [load])

  const isExt = (s: any) => String(s.user_id || '').startsWith('ext-') || s.meta?.ext
  const dist = (s: any) => (s.entry_distance_m != null ? Number(s.entry_distance_m) : null)

  const total = scans.length
  const external = scans.filter(isExt)
  const students = scans.filter((s) => !isExt(s))
  const inRange = scans.filter((s) => dist(s) != null && dist(s)! <= radius).length
  const outRange = scans.filter((s) => dist(s) != null && dist(s)! > radius).length
  const noLoc = scans.filter((s) => dist(s) == null && !isExt(s)).length
  const exited = scans.filter((s) => !!s.exit_at).length

  // 유입 경로별 집계 (외부 참가자)
  const sourceCounts: Record<string, number> = {}
  external.forEach((s) => {
    const src = s.meta?.source || '미기재'
    sourceCounts[src] = (sourceCounts[src] || 0) + 1
  })
  // 소개자별 집계
  const referrerCounts: Record<string, number> = {}
  external.forEach((s) => {
    const r = (s.meta?.referrer || '').trim()
    if (r) referrerCounts[r] = (referrerCounts[r] || 0) + 1
  })
  // 사업단별 집계
  const orgCounts: Record<string, number> = {}
  external.forEach((s) => {
    const o = (s.meta?.org || '').trim()
    if (o) orgCounts[o] = (orgCounts[o] || 0) + 1
  })

  const fmt = (t: string | null) =>
    t ? new Date(t).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'

  const downloadCsv = () => {
    const header = ['번호', '교시', '구분', '표시이름', '사업단', '성함', '지점', '유입경로', '소개자', '거리(m)', '입장시간', '퇴장시간']
    const rows = scans.map((s, i) => {
      const ext = isExt(s)
      const m = s.meta || {}
      const d = dist(s)
      return [
        String(scans.length - i),
        sessionName,
        ext ? '외부' : '학생',
        s.user_name || '',
        m.org || '',
        m.name || (ext ? '' : s.user_name || ''),
        m.branch || '',
        ext ? m.source || '' : '',
        m.referrer || '',
        d != null ? String(Math.round(d)) : '',
        fmt(s.entry_at || s.last_seen_at),
        s.exit_at ? fmt(s.exit_at) : '',
      ]
    })
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\r\n')
    // 엑셀 한글 깨짐 방지 BOM
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sessionName}_통계.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const Stat = ({ label, value, color }: { label: string; value: number; color?: string }) => (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px 14px', textAlign: 'center' }}>
      <p style={{ fontSize: '28px', fontWeight: '800', color: color || 'white', lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '6px' }}>{label}</p>
    </div>
  )

  const Breakdown = ({ title, data }: { title: string; data: Record<string, number> }) => {
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1])
    const max = entries[0]?.[1] || 1
    return (
      <div className="rd-surface p-4">
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'white', marginBottom: '12px' }}>{title}</h3>
        {entries.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.30)', textAlign: 'center', padding: '12px 0' }}>데이터 없음</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {entries.map(([k, v]) => (
              <div key={k}>
                <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)' }}>{k}</span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#C9941A' }}>{v}명</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(v / max) * 100}%`, background: '#C9941A', borderRadius: '3px' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: '#080C10' }}>
      <nav style={{ background: '#0D1218', borderBottom: '1px solid rgba(255,255,255,0.07)' }} className="sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <button onClick={() => router.back()} className="flex items-center gap-2" style={{ color: '#C9941A', fontSize: '13px', fontWeight: '600', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <ArrowLeft style={{ width: '15px', height: '15px' }} /> 돌아가기
          </button>
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <BarChart3 style={{ width: '15px', height: '15px', color: '#C9941A' }} /> 출석 통계
          </span>
          <button onClick={load} style={{ color: 'rgba(255,255,255,0.5)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <RefreshCw style={{ width: '15px', height: '15px' }} />
          </button>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-6" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <p style={{ fontSize: '10px', fontWeight: '700', color: '#C9941A', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '4px' }}>실시간 통계 · 5초 자동 갱신</p>
          <h1 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'white' }}>{sessionName}</h1>
        </div>

        {loading ? (
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '30px 0' }}>불러오는 중...</p>
        ) : (
          <>
            {/* 요약 카드 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <Stat label="총 인원" value={total} color="#C9941A" />
              <Stat label="학생(QR)" value={students.length} />
              <Stat label="외부 참가자" value={external.length} />
              <Stat label="현장 안 🟢" value={inRange} color="#4ade80" />
              <Stat label="퇴장 완료 📤" value={exited} color="#60a5fa" />
              <Stat label="현장 밖 🟠" value={outRange} color="#fbbf24" />
            </div>

            {/* 유입 경로별 */}
            <Breakdown title="유입 경로별 (외부 참가자)" data={sourceCounts} />
            {Object.keys(referrerCounts).length > 0 && <Breakdown title="소개자별 (지인 소개)" data={referrerCounts} />}
            {Object.keys(orgCounts).length > 0 && <Breakdown title="사업단별" data={orgCounts} />}

            {/* 엑셀 다운로드 */}
            <button onClick={downloadCsv} className="btn-gold" style={{ width: '100%', height: '48px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Download style={{ width: '16px', height: '16px' }} /> 엑셀(CSV) 다운로드
            </button>

            {/* 전체 명단 표 */}
            <div className="rd-surface p-4" style={{ overflowX: 'auto' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'white', marginBottom: '12px' }}>전체 명단</h3>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: 'rgba(255,255,255,0.45)', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>#</th>
                    <th style={{ padding: '6px 8px' }}>구분</th>
                    <th style={{ padding: '6px 8px' }}>이름</th>
                    <th style={{ padding: '6px 8px' }}>유입경로</th>
                    <th style={{ padding: '6px 8px' }}>거리</th>
                    <th style={{ padding: '6px 8px' }}>입장</th>
                    <th style={{ padding: '6px 8px' }}>퇴장</th>
                  </tr>
                </thead>
                <tbody>
                  {scans.map((s, i) => {
                    const ext = isExt(s)
                    const d = dist(s)
                    return (
                      <tr key={s.id || i} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.80)' }}>
                        <td style={{ padding: '7px 8px' }}>{scans.length - i}</td>
                        <td style={{ padding: '7px 8px', color: ext ? '#C9941A' : 'rgba(255,255,255,0.55)' }}>{ext ? '외부' : '학생'}</td>
                        <td style={{ padding: '7px 8px', fontWeight: 600 }}>{s.user_name}</td>
                        <td style={{ padding: '7px 8px' }}>{ext ? (s.meta?.source || '미기재') + (s.meta?.referrer ? `(${s.meta.referrer})` : '') : '-'}</td>
                        <td style={{ padding: '7px 8px' }}>{d != null ? `${Math.round(d)}m` : '-'}</td>
                        <td style={{ padding: '7px 8px', color: 'rgba(255,255,255,0.45)' }}>{fmt(s.entry_at || s.last_seen_at)}</td>
                        <td style={{ padding: '7px 8px', color: s.exit_at ? '#60a5fa' : 'rgba(255,255,255,0.25)' }}>{s.exit_at ? fmt(s.exit_at) : '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default function ScanStatsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" style={{ background: '#080C10' }} />}>
      <StatsInner />
    </Suspense>
  )
}
