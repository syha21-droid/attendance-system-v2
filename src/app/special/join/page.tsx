'use client'

// 특강 외부(일반인) 자유가입 페이지.
// 내부(사원번호) 가입과 완전히 분리된 "별도의 문". member_type='external' 로 생성됨.
// 화이트리스트(사원번호) 검증 없이 누구나 가입 → 단, 정식 출석/슈퍼루키 집계에는 미포함.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useStore } from '@/store/useStore'
import { apiSignupExternal } from '@/lib/dataStore'

export default function ExternalJoin() {
  const router = useRouter()
  const setUser = useStore((s) => s.setUser)
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '' })
  const [busy, setBusy] = useState(false)

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }))

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email || !form.password || !form.name) {
      toast.error('이메일/비밀번호/이름을 입력하세요')
      return
    }
    setBusy(true)
    const id = Math.random().toString(36).slice(2, 11)
    const result = await apiSignupExternal({ id, ...form })
    setBusy(false)

    if (result.error && !result.nodb) {
      toast.error(result.error)
      return
    }
    const user = result.user || { id, email: form.email, name: form.name, isAdmin: false, memberType: 'external' }

    // 로컬 캐시 (폴백 로그인용)
    const usersStr = localStorage.getItem('users')
    const users = usersStr ? JSON.parse(usersStr) : []
    if (!users.some((u: any) => u.email === form.email)) {
      users.push({ ...user, password: form.password })
      localStorage.setItem('users', JSON.stringify(users))
    }
    localStorage.setItem('user', JSON.stringify(user))
    setUser(user as any)

    toast.success('✅ 특강 외부 신청자 가입 완료!')
    setTimeout(() => router.push('/special'), 800)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <p className="text-4xl mb-2">🎟️</p>
          <h2 className="text-2xl font-bold text-gray-900">특강 외부 신청자 가입</h2>
          <p className="text-sm text-gray-500 mt-2">
            일반인 / 외부 참가자용 가입입니다.<br />
            (사내 정식 수강생은 별도 사원번호 가입을 이용하세요)
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-1">📧 이메일</label>
            <input
              type="email" name="email" value={form.email} onChange={onChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-gray-900 font-semibold placeholder-gray-500"
              placeholder="example@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-1">🔒 비밀번호</label>
            <input
              type="password" name="password" value={form.password} onChange={onChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-gray-900 font-semibold placeholder-gray-500"
              placeholder="비밀번호"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-1">👤 이름</label>
            <input
              type="text" name="name" value={form.name} onChange={onChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-gray-900 font-semibold placeholder-gray-500"
              placeholder="홍길동"
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-1">📞 연락처 (선택)</label>
            <input
              type="tel" name="phone" value={form.phone} onChange={onChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-gray-900 font-semibold placeholder-gray-500"
              placeholder="010-0000-0000"
            />
          </div>

          <button
            type="submit" disabled={busy}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-lg transition disabled:opacity-50"
          >
            {busy ? '가입 중...' : '특강 신청자로 가입'}
          </button>
        </form>

        <p className="text-center text-gray-600 mt-5 text-sm">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-orange-600 hover:underline font-semibold">로그인</Link>
        </p>
        <p className="text-center text-gray-400 mt-2 text-xs">
          사내 정식 수강생이신가요?{' '}
          <Link href="/signup" className="text-gray-500 hover:underline">사원번호로 가입 →</Link>
        </p>
      </div>
    </div>
  )
}
