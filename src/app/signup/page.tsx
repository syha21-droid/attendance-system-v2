'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useStore } from '@/store/useStore'
import { apiSignup } from '@/lib/dataStore'
import { setSessionCookie } from '@/lib/session'
import { checkAndBindDevice } from '@/lib/deviceLock'
import { recordLogin } from '@/lib/loginHistory'

const ADMIN_CODE = 'RD-ADMIN-2025'

export default function SignUp() {
  const router = useRouter()
  const setUser = useStore((state) => state.setUser)
  const [formData, setFormData] = useState({ email: '', password: '', name: '', employeeNo: '', adminCode: '' })
  const [loading, setLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.email || !formData.password || !formData.name) {
      toast.error('이름, 이메일, 비밀번호를 입력하세요')
      return
    }
    const isAdmin = formData.adminCode.trim() === ADMIN_CODE
    if (formData.adminCode.trim() && !isAdmin) {
      toast.error('관리자 코드가 올바르지 않습니다')
      return
    }
    setLoading(true)
    const userId = Math.random().toString(36).substr(2, 9)
    const result = await apiSignup({
      id: userId, email: formData.email, password: formData.password,
      name: formData.name, isAdmin,
      employeeNo: formData.employeeNo.trim() || undefined,
    } as any)

    if (result.error && !result.nodb) { toast.error(result.error); setLoading(false); return }

    const user = result.user || { id: userId, email: formData.email, name: formData.name, isAdmin }

    // 계정 1개 = 기기 1대 (서버 강제, 관리자 예외)
    const lock = await checkAndBindDevice(user)
    if (!lock.ok) {
      toast.error(lock.error || '이 계정은 다른 기기에서 사용 중입니다.', { duration: 6000 })
      setLoading(false)
      return
    }

    const usersStr = localStorage.getItem('users')
    const users = usersStr ? JSON.parse(usersStr) : []
    if (!users.some((u: any) => u.email === formData.email)) {
      users.push({ ...user, password: formData.password })
      localStorage.setItem('users', JSON.stringify(users))
    }
    localStorage.setItem('user', JSON.stringify(user))
    setSessionCookie(user)
    setUser(user as any)
    recordLogin(user)

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
      {/* ── 왼쪽 패널 ── */}
      <div
        className="hidden lg:flex flex-col justify-between"
        style={{
          width: '40%', padding: '48px 44px',
          background: '#080C10',
          backgroundImage: `
            radial-gradient(ellipse 100% 60% at -10% 120%, rgba(201,148,26,0.08) 0%, transparent 55%),
            radial-gradient(rgba(255,255,255,0.014) 1px, transparent 1px)
          `,
          backgroundSize: 'auto, 28px 28px',
        }}
      >
        <div>
          <div className="flex items-center gap-2.5" style={{ marginBottom: '72px' }}>
            <div style={{ width: '28px', height: '28px', border: '1.5px solid #C9941A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontFamily: 'Georgia, serif', color: '#C9941A', fontSize: '14px', fontWeight: '700', lineHeight: '1' }}>R</span>
            </div>
            <span style={{ fontFamily: 'Georgia, serif', color: 'white', fontSize: '11px', fontWeight: '600', letterSpacing: '0.16em', textTransform: 'uppercase' }}>Rich Divine Partners</span>
          </div>

          <div style={{ marginBottom: '40px' }}>
            <div className="accent-bar" style={{ marginBottom: '20px' }} />
            <h1 style={{ fontSize: '1.6rem', fontWeight: '700', color: 'white', lineHeight: 1.4, fontFamily: 'Georgia, serif' }}>
              당신의 인생 중<br />
              가장 찬란한 순간을<br />
              함께합니다
            </h1>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {[
              ['수강 등록', '담당자가 직접 강의에 배정합니다'],
              ['출석 인증', 'GPS로 현장 위치를 확인합니다'],
              ['기록 보관', '출석·지각·결석 이력이 자동 저장됩니다'],
            ].map(([title, desc]) => (
              <div key={title} style={{ padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '4px', height: '4px', background: '#C9941A', borderRadius: '50%', flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.70)', marginBottom: '2px' }}>{title}</p>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)' }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.12)', fontSize: '11px' }}>© 2025 ㈜리치디바인 파트너즈</p>
      </div>

      {/* ── 오른쪽 폼 ── */}
      <div className="flex-1 flex items-center justify-center" style={{ padding: '40px 24px', background: '#0D1218' }}>
        <div style={{ width: '100%', maxWidth: '370px' }}>
          <p style={{ fontSize: '10px', fontWeight: '700', color: '#C9941A', letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '10px' }}>계정 만들기</p>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'white', marginBottom: '28px', fontFamily: 'Georgia, serif' }}>수강생 등록</h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.35)', marginBottom: '7px', letterSpacing: '0.10em', textTransform: 'uppercase' }}>이름</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="홍길동" className="rd-input" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.35)', marginBottom: '7px', letterSpacing: '0.10em', textTransform: 'uppercase' }}>사원번호</label>
                <input type="text" name="employeeNo" value={formData.employeeNo} onChange={handleChange} placeholder="선택" className="rd-input" />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.35)', marginBottom: '7px', letterSpacing: '0.10em', textTransform: 'uppercase' }}>이메일</label>
              <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="example@email.com" className="rd-input" />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.35)', marginBottom: '7px', letterSpacing: '0.10em', textTransform: 'uppercase' }}>비밀번호</label>
              <input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="8자 이상" className="rd-input" />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.35)', marginBottom: '7px', letterSpacing: '0.10em', textTransform: 'uppercase' }}>관리자 코드 <span style={{ color: 'rgba(255,255,255,0.18)', fontWeight: '400', letterSpacing: 0 }}>(없으면 공란)</span></label>
              <input type="password" name="adminCode" value={formData.adminCode} onChange={handleChange} placeholder="담당자 전용" className="rd-input" />
            </div>

            <button type="submit" disabled={loading} className="btn-gold" style={{ width: '100%', height: '46px', fontSize: '14px', marginTop: '6px' }}>
              {loading ? '처리 중...' : '가입하기'}
            </button>
          </form>

          <p style={{ textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.25)', marginTop: '22px' }}>
            이미 계정이 있으신가요?{' '}
            <Link href="/login" style={{ color: '#C9941A', fontWeight: '600', textDecoration: 'none' }}>로그인</Link>
          </p>
          <p style={{ textAlign: 'center', fontSize: '11px', color: 'rgba(255,255,255,0.16)', marginTop: '8px' }}>
            외부 특강 신청자 →{' '}
            <Link href="/special/join" style={{ color: 'rgba(201,148,26,0.60)', textDecoration: 'none' }}>외부 신청자 등록</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
