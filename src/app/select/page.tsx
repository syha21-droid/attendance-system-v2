'use client'

import Link from 'next/link'
import { Check, QrCode, MapPin, LayoutGrid, ArrowRight, UserCog, GraduationCap } from 'lucide-react'

interface Plan {
  key: string
  badge: string
  title: string
  summary: string
  icon: any
  features: string[]
  adminHref: string
  studentHref: string
  recommended?: boolean
}

const PLANS: Plan[] = [
  {
    key: 'A',
    badge: 'A안',
    title: '풀 시스템 (올인원)',
    summary: '출석부터 강의안·미션지 제출, 회원가입까지 전부 포함된 통합 시스템',
    icon: LayoutGrid,
    features: [
      '회원가입 / 로그인',
      '강의안 제출 · 미션지 제출',
      '위치추적(GPS) 출석체크',
      '성적표 · 통계 · 학생관리',
    ],
    adminHref: '/admin',
    studentHref: '/student',
  },
  {
    key: 'B',
    badge: 'B안',
    title: '위치추적 기반 QR 출석',
    summary: '관리자가 학생 QR을 스캔하면 학생 위치(GPS)를 함께 확인해 출석 인식',
    icon: MapPin,
    features: [
      '학생 QR에 실시간 위치 내장',
      '관리자 카메라로 QR 스캔',
      '현장 반경 안/밖 자동 판별',
      '실시간 인식 목록 + 지도',
    ],
    adminHref: '/admin/qr',
    studentHref: '/qr',
    recommended: true,
  },
  {
    key: 'C',
    badge: 'C안',
    title: 'QR만 출석 (간편)',
    summary: '위치 확인 없이 QR 스캔만으로 출석 인식 — 가장 단순하고 빠름',
    icon: QrCode,
    features: [
      '학생 QR 표시',
      '관리자 카메라로 QR 스캔',
      '위치 확인 없음 (가장 간단)',
      '실시간 인식 목록',
    ],
    adminHref: '/admin/qr-only',
    studentHref: '/qr-only',
  },
]

export default function SelectPlanPage() {
  return (
    <div
      className="min-h-screen px-4 py-10 sm:py-14"
      style={{
        background: '#080C10',
        backgroundImage: `
          radial-gradient(ellipse 80% 50% at 50% -10%, rgba(201,148,26,0.07) 0%, transparent 55%),
          radial-gradient(rgba(255,255,255,0.016) 1px, transparent 1px)
        `,
        backgroundSize: 'auto, 30px 30px',
      }}
    >
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="text-center" style={{ marginBottom: '44px' }}>
          <div className="flex items-center justify-center gap-2.5" style={{ marginBottom: '20px' }}>
            <div style={{ width: '26px', height: '26px', border: '1.5px solid #C9941A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'Georgia, serif', color: '#C9941A', fontSize: '13px', fontWeight: '700' }}>R</span>
            </div>
            <span style={{ fontFamily: 'Georgia, serif', color: 'white', fontSize: '11px', fontWeight: '600', letterSpacing: '0.16em', textTransform: 'uppercase' }}>Rich Divine Partners</span>
          </div>
          <p style={{ fontSize: '10px', fontWeight: '700', color: '#C9941A', letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: '14px' }}>For Review</p>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', color: 'white', fontFamily: 'Georgia, serif', marginBottom: '12px' }}>
            출석 시스템 — 3가지 안 중 선택
          </h1>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.40)', lineHeight: 1.7 }}>
            팀장님, 아래 세 가지 방식을 직접 체험해보시고 어떤 방향으로 진행할지 결정해주세요.<br />
            각 안마다 <span style={{ color: 'rgba(255,255,255,0.7)' }}>관리자 화면</span>과 <span style={{ color: 'rgba(255,255,255,0.7)' }}>학생 화면</span> 링크가 따로 있습니다.
          </p>
        </div>

        {/* 3안 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((p) => {
            const Icon = p.icon
            return (
              <div
                key={p.key}
                className="rd-surface"
                style={{
                  padding: '28px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  border: p.recommended ? '1px solid rgba(201,148,26,0.45)' : '1px solid rgba(255,255,255,0.08)',
                  background: p.recommended ? 'rgba(201,148,26,0.05)' : undefined,
                }}
              >
                {p.recommended && (
                  <span style={{ position: 'absolute', top: '-11px', left: '24px', background: '#C9941A', color: '#080C10', fontSize: '10px', fontWeight: '800', padding: '4px 12px', letterSpacing: '0.08em' }}>
                    추천
                  </span>
                )}

                <div className="flex items-center gap-2.5" style={{ marginBottom: '16px' }}>
                  <div style={{ width: '38px', height: '38px', border: '1px solid rgba(201,148,26,0.35)', background: 'rgba(201,148,26,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon style={{ width: '18px', height: '18px', color: '#C9941A' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: '800', color: '#C9941A', letterSpacing: '0.12em' }}>{p.badge}</p>
                    <p style={{ fontSize: '15px', fontWeight: '700', color: 'white' }}>{p.title}</p>
                  </div>
                </div>

                <p style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, marginBottom: '18px', minHeight: '54px' }}>
                  {p.summary}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '24px', flex: 1 }}>
                  {p.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <Check style={{ width: '14px', height: '14px', color: '#C9941A', flexShrink: 0 }} />
                      <span style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.62)' }}>{f}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Link
                    href={p.adminHref}
                    className="flex items-center justify-between"
                    style={{ padding: '12px 16px', background: '#C9941A', color: '#080C10', fontSize: '13px', fontWeight: '700', textDecoration: 'none' }}
                  >
                    <span className="flex items-center gap-2"><UserCog style={{ width: '15px', height: '15px' }} /> 관리자 화면</span>
                    <ArrowRight style={{ width: '15px', height: '15px' }} />
                  </Link>
                  <Link
                    href={p.studentHref}
                    className="flex items-center justify-between"
                    style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.75)', fontSize: '13px', fontWeight: '600', textDecoration: 'none' }}
                  >
                    <span className="flex items-center gap-2"><GraduationCap style={{ width: '15px', height: '15px' }} /> 학생 화면</span>
                    <ArrowRight style={{ width: '15px', height: '15px', opacity: 0.6 }} />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>

        {/* 비교 요약 */}
        <div className="rd-surface" style={{ marginTop: '36px', padding: '24px', overflowX: 'auto' }}>
          <p style={{ fontSize: '12px', fontWeight: '700', color: 'rgba(255,255,255,0.75)', marginBottom: '16px' }}>한눈에 비교</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', minWidth: '520px' }}>
            <thead>
              <tr style={{ color: 'rgba(255,255,255,0.40)', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px', fontWeight: '600' }}>구분</th>
                <th style={{ padding: '8px 12px', fontWeight: '600' }}>A안 · 풀 시스템</th>
                <th style={{ padding: '8px 12px', fontWeight: '600' }}>B안 · 위치 QR</th>
                <th style={{ padding: '8px 12px', fontWeight: '600' }}>C안 · QR만</th>
              </tr>
            </thead>
            <tbody style={{ color: 'rgba(255,255,255,0.70)' }}>
              {[
                ['출석 방식', 'GPS 자동 + 제출', '관리자 QR 스캔', '관리자 QR 스캔'],
                ['위치 확인', '있음', '있음 (현장 반경)', '없음'],
                ['강의안/미션 제출', '있음', '없음', '없음'],
                ['회원/성적/통계', '있음', '없음', '없음'],
                ['복잡도', '높음', '중간', '낮음 (가장 간단)'],
              ].map((row, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.45)', fontWeight: '600' }}>{row[0]}</td>
                  <td style={{ padding: '10px 12px' }}>{row[1]}</td>
                  <td style={{ padding: '10px 12px' }}>{row[2]}</td>
                  <td style={{ padding: '10px 12px' }}>{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.16)', fontSize: '11px', marginTop: '36px' }}>
          © 2025 ㈜리치디바인 파트너즈. 내부 검토용
        </p>
      </div>
    </div>
  )
}
