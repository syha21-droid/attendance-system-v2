'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { MapPin, Clock, ShieldCheck } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { apiSignup } from '@/lib/dataStore'

const features = [
  { icon: MapPin,      title: 'GPS 위치 인증',      desc: '현장에서만 출석 가능한 위치 기반 시스템' },
  { icon: Clock,       title: '실시간 입·퇴장 기록', desc: '수업 시작부터 종료까지 자동으로 추적'   },
  { icon: ShieldCheck, title: '대리 출석 방지',      desc: '위치·시간 이중 검증으로 신뢰성 확보'    },
]

export default function SignUp() {
  const router = useRouter()
  const setUser = useStore((state) => state.setUser)
  const [formData, setFormData] = useState({ email: '', password: '', name: '', employeeNo: '', isAdmin: false })
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.email || !formData.password || !formData.name) {
      toast.error('이름, 이메일, 비밀번호를 입력하세요')
      return
    }
    setLoading(true)
    const userId = Math.random().toString(36).substr(2, 9)
    const result = await apiSignup({
      id: userId, email: formData.email, password: formData.password,
      name: formData.name, isAdmin: formData.isAdmin,
      employeeNo: formData.employeeNo.trim() || undefined,
    } as any)

    if (result.error && !result.nodb) { toast.error(result.error); setLoading(false); return }

    const user = result.user || { id: userId, email: formData.email, name: formData.name, isAdmin: formData.isAdmin }
    const usersStr = localStorage.getItem('users')
    const users = usersStr ? JSON.parse(usersStr) : []
    if (!users.some((u: any) => u.email === formData.email)) {
      users.push({ ...user, password: formData.password })
      localStorage.setItem('users', JSON.stringify(users))
    }
    localStorage.setItem('user', JSON.stringify(user))
    setUser(user as any)

    if (!user.isAdmin) {
      const existing = localStorage.getItem('students')
      const students = existing ? JSON.parse(existing) : []
      if (!students.some((s: any) => s.id === user.id)) {
        students.push({ id: user.id, email: user.email, name: user.name, createdAt: new Date().toISOString() })
        localStorage.setItem('students', JSON.stringify(students))
      }
    }

    toast.success('가입 완료!')
    setTimeout(() => router.push(user.isAdmin ? '/admin' : '/student'), 600)
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
        <div style={{ width: '100%', maxWidth: '380px' }}>
          <p style={{ fontSize: '10px', fontWeight: '700', color: '#C9941A', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '10px' }}>Sign up</p>
          <h2 style={{ fontSize: '1.55rem', fontWeight: '700', color: 'white', marginBottom: '6px', fontFamily: 'Georgia, serif' }}>계정 만들기</h2>
          <p style={{ color: 'rgba(255,255,255,0.30)', fontSize: '13px', marginBottom: '32px' }}>정보를 입력해 출석 관리를 시작하세요</p>

          <form onSubmit={handleSubmit}>
            {/* 이름 + 사원번호 */}
            <div className="grid grid-cols-2 gap-3" style={{ marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.38)', marginBottom: '7px', letterSpacing: '0.10em', textTransform: 'uppercase' }}>이름</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="홍길동" className="rd-input" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.38)', marginBottom: '7px', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
                  사원번호 <span style={{ color: 'rgba(255,255,255,0.18)', fontWeight: '400' }}>(선택)</span>
                </label>
                <input type="text" name="employeeNo" value={formData.employeeNo} onChange={handleChange} placeholder="EMP-2024" className="rd-input" />
              </div>
            </div>

            {/* 이메일 */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.38)', marginBottom: '7px', letterSpacing: '0.10em', textTransform: 'uppercase' }}>이메일</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="example@email.com" className="rd-input" />
            </div>

            {/* 비밀번호 */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.38)', marginBottom: '7px', letterSpacing: '0.10em', textTransform: 'uppercase' }}>비밀번호</label>
              <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="8자 이상" className="rd-input" />
            </div>

            {/* 관리자 체크박스 */}
            <label className="flex items-center gap-3 cursor-pointer select-none" style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: '20px' }}>
              <input
                type="checkbox" name="isAdmin" checked={formData.isAdmin} onChange={handleChange}
                style={{ width: '15px', height: '15px', accentColor: '#C9941A', cursor: 'pointer' }}
              />
              <div>
                <p style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginBottom: '2px' }}>관리자로 가입</p>
                <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)' }}>강의 개설 및 출석 현황 관리 가능</p>
              </div>
            </label>

            <button type="submit" disabled={loading} className="btn-gold" style={{ width: '100%', height: '46px', fontSize: '14px', letterSpacing: '0.04em' }}>
              {loading ? '처리 중...' : '계정 만들기'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.26)', marginTop: '24px' }}>
            이미 계정이 있으신가요?{' '}
            <Link href="/login" style={{ color: '#C9941A', fontWeight: '600', textDecoration: 'none' }}>로그인</Link>
          </p>
          <p style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.18)', marginTop: '8px' }}>
            외부 특강 신청자?{' '}
            <Link href="/special/join" style={{ color: 'rgba(201,148,26,0.65)', textDecoration: 'none' }}>외부 신청자로 가입</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
