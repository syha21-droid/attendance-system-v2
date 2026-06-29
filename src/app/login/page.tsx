'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { MapPin, Clock, ShieldCheck } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { apiLogin } from '@/lib/dataStore'
import { setSessionCookie } from '@/lib/session'

const features = [
  { icon: MapPin,      title: 'GPS 위치 인증',      desc: '현장에서만 출석 가능한 위치 기반 시스템' },
  { icon: Clock,       title: '실시간 입·퇴장 기록', desc: '수업 시작부터 종료까지 자동으로 추적'   },
  { icon: ShieldCheck, title: '대리 출석 방지',      desc: '위치·시간 이중 검증으로 신뢰성 확보'    },
]

export default function Login() {
  const router = useRouter()
  const setUser = useStore((state) => state.setUser)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { toast.error('이메일과 비밀번호를 입력하세요'); return }
    setLoading(true)

    const result = await apiLogin(email, password)
    let user = result.user

    if (!user) {
      const users = JSON.parse(localStorage.getItem('users') || '[]')
      const found = users.find((u: any) => u.email === email && u.password === password)
      if (found) { const { password: _pw, ...rest } = found; user = rest }
    }

    if (user) {
      localStorage.setItem('user', JSON.stringify(user))
      setSessionCookie(user)
      setUser(user as any)
      toast.success('로그인 성공')
      setTimeout(() => router.push(user.isAdmin ? '/admin' : '/student'), 400)
    } else {
      toast.error('이메일 또는 비밀번호가 잘못되었습니다')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex">
      {/* ── 왼쪽 다크 패널 ── */}
      <div
        className="hidden lg:flex flex-col justify-between"
        style={{
          width: '42%', padding: '44px',
          background: '#080C10',
          backgroundImage: `
            radial-gradient(ellipse 90% 70% at -15% 110%, rgba(201,148,26,0.07) 0%, transparent 52%),
            radial-gradient(rgba(255,255,255,0.016) 1px, transparent 1px)
          `,
          backgroundSize: 'auto, 30px 30px',
        }}
      >
        <div>
          {/* 로고 */}
          <div className="flex items-center gap-2.5" style={{ marginBottom: '60px' }}>
            <div style={{ width: '28px', height: '28px', border: '1.5px solid #C9941A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontFamily: 'Georgia, serif', color: '#C9941A', fontSize: '14px', fontWeight: '700', lineHeight: '1' }}>R</span>
            </div>
            <span style={{ fontFamily: 'Georgia, serif', color: 'white', fontSize: '11px', fontWeight: '600', letterSpacing: '0.16em', textTransform: 'uppercase' }}>Rich Divine Partners</span>
          </div>

          <p style={{ fontSize: '10px', fontWeight: '700', color: '#C9941A', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '16px' }}>
            Training Center
          </p>
          <h1 style={{ fontSize: '1.7rem', fontWeight: '700', color: 'white', lineHeight: 1.35, marginBottom: '12px', fontFamily: 'Georgia, serif' }}>
            당신의 인생 중<br />
            가장 찬란한 순간을<br />
            함께합니다
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.30)', fontSize: '13px', lineHeight: 1.75, marginBottom: '48px' }}>
            전문직 MBA 수강생을 위한<br />출석 관리 플랫폼
          </p>

          <div className="flex flex-col gap-5">
            {features.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3.5">
                <div style={{
                  width: '36px', height: '36px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid rgba(201,148,26,0.22)', background: 'rgba(201,148,26,0.07)',
                }}>
                  <Icon style={{ width: '15px', height: '15px', color: '#C9941A' }} />
                </div>
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.80)', fontSize: '13px', fontWeight: '600', marginBottom: '3px' }}>{title}</p>
                  <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: '11px', lineHeight: 1.6 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.14)', fontSize: '11px', letterSpacing: '0.06em' }}>© 2025 ㈜리치디바인 파트너즈</p>
      </div>

      {/* ── 오른쪽 폼 패널 ── */}
      <div className="flex-1 flex items-center justify-center" style={{ padding: '40px 24px', background: '#0D1218' }}>
        <div style={{ width: '100%', maxWidth: '360px' }}>
          <p style={{ fontSize: '10px', fontWeight: '700', color: '#C9941A', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '10px' }}>Sign in</p>
          <h2 style={{ fontSize: '1.55rem', fontWeight: '700', color: 'white', marginBottom: '6px', fontFamily: 'Georgia, serif' }}>다시 오셨군요</h2>
          <p style={{ color: 'rgba(255,255,255,0.30)', fontSize: '13px', marginBottom: '36px' }}>계속하려면 로그인하세요</p>

          <form onSubmit={handleSubmit} className="flex flex-col">
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.38)', marginBottom: '8px', letterSpacing: '0.10em', textTransform: 'uppercase' }}>이메일</label>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com" disabled={loading}
                className="rd-input"
              />
            </div>
            <div style={{ marginBottom: '28px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.38)', marginBottom: '8px', letterSpacing: '0.10em', textTransform: 'uppercase' }}>비밀번호</label>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력" disabled={loading}
                className="rd-input"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-gold" style={{ width: '100%', height: '46px', fontSize: '14px', letterSpacing: '0.04em' }}>
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.26)', marginTop: '28px' }}>
            계정이 없으신가요?{' '}
            <Link href="/signup" style={{ color: '#C9941A', fontWeight: '600', textDecoration: 'none' }}>회원가입</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
