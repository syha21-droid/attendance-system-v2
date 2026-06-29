'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { ArrowRight } from 'lucide-react'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const testAccountsInitialized = localStorage.getItem('testAccountsInitialized')
    if (!testAccountsInitialized) {
      const testAccounts = [
        { id: 'admin001', email: 'admin@test.com', password: 'admin123', name: '관리자', isAdmin: true },
        { id: 'student001', email: 'student1@test.com', password: 'student123', name: '학생1', isAdmin: false },
        { id: 'student002', email: 'student2@test.com', password: 'student123', name: '학생2', isAdmin: false },
      ]
      const existingUsers = JSON.parse(localStorage.getItem('users') || '[]')
      localStorage.setItem('users', JSON.stringify([...existingUsers, ...testAccounts]))
      localStorage.setItem('testAccountsInitialized', 'true')
    }

    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      const userData = JSON.parse(savedUser)
      useStore.setState({ user: userData })
      router.push(userData.isAdmin ? '/admin' : '/student')
    }
  }, [router])

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 relative"
      style={{
        background: '#080C10',
        backgroundImage: `
          radial-gradient(ellipse 80% 55% at 50% -10%, rgba(201,148,26,0.07) 0%, transparent 55%),
          radial-gradient(rgba(255,255,255,0.016) 1px, transparent 1px)
        `,
        backgroundSize: 'auto, 30px 30px',
      }}
    >
      {/* Logo */}
      <div className="absolute top-8 left-8 flex items-center gap-2.5">
        <div style={{ width: '28px', height: '28px', border: '1.5px solid #C9941A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontFamily: 'Georgia, serif', color: '#C9941A', fontSize: '14px', fontWeight: '700', lineHeight: '1' }}>R</span>
        </div>
        <span style={{ fontFamily: 'Georgia, serif', color: 'white', fontSize: '11px', fontWeight: '600', letterSpacing: '0.16em', textTransform: 'uppercase' }}>Rich Divine Partners</span>
      </div>

      <div className="text-center max-w-lg">
        <p style={{ fontSize: '10px', fontWeight: '700', color: '#C9941A', letterSpacing: '0.28em', textTransform: 'uppercase', marginBottom: '24px' }}>
          Training Center
        </p>

        <h1 style={{ fontSize: '2.4rem', fontWeight: '700', color: 'white', lineHeight: 1.25, marginBottom: '20px', fontFamily: 'Georgia, serif' }}>
          당신의 인생 중<br />
          <span style={{ color: '#C9941A' }}>가장 찬란한 순간</span>을<br />
          함께합니다
        </h1>

        <p style={{ color: 'rgba(255,255,255,0.36)', fontSize: '13px', lineHeight: 1.85, marginBottom: '52px' }}>
          전문직 컨설팅 MBA 수강생 출석 관리 시스템<br />
          GPS 위치 기반 입·퇴장 자동 인증
        </p>

        <div className="flex flex-col gap-3" style={{ maxWidth: '240px', margin: '0 auto' }}>
          <Link
            href="/login"
            className="btn-gold flex items-center justify-center gap-2"
            style={{ padding: '13px 24px', textDecoration: 'none', fontSize: '14px', letterSpacing: '0.03em' }}
          >
            로그인 <ArrowRight style={{ width: '15px', height: '15px' }} />
          </Link>
          <Link
            href="/signup"
            className="flex items-center justify-center"
            style={{
              background: 'transparent', color: 'rgba(255,255,255,0.42)', fontWeight: '500', fontSize: '14px',
              padding: '13px 24px', border: '1px solid rgba(255,255,255,0.10)', textDecoration: 'none',
              transition: 'border-color 0.15s, color 0.15s',
            }}
          >
            계정 만들기
          </Link>
        </div>
      </div>

      <p style={{ position: 'absolute', bottom: '28px', color: 'rgba(255,255,255,0.14)', fontSize: '10px', letterSpacing: '0.08em' }}>
        © 2025 ㈜리치디바인 파트너즈. All Rights Reserved.
      </p>
    </div>
  )
}
