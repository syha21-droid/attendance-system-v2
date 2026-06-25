'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useStore } from '@/store/useStore'
import { apiLogin } from '@/lib/dataStore'

export default function Login() {
  const router = useRouter()
  const setUser = useStore((state) => state.setUser)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email || !password) {
      toast.error('이메일과 비밀번호를 입력하세요')
      return
    }

    setLoading(true)

    // 1) 서버 로그인 (모든 기기 공유)
    const result = await apiLogin(email, password)
    let user = result.user

    // 2) 서버에 없으면 로컬(이 기기에서 가입한 계정) 폴백
    if (!user) {
      const users = JSON.parse(localStorage.getItem('users') || '[]')
      const found = users.find((u: any) => u.email === email && u.password === password)
      if (found) {
        const { password: _pw, ...rest } = found
        user = rest
      }
    }

    if (user) {
      localStorage.setItem('user', JSON.stringify(user))
      setUser(user as any)
      toast.success('✅ 로그인 성공!')
      setTimeout(() => {
        router.push(user.isAdmin ? '/admin' : '/student')
      }, 400)
    } else {
      toast.error('이메일 또는 비밀번호가 잘못되었습니다')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <h2 className="text-3xl font-bold text-center mb-8 text-gray-900">
          로그인
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-base font-bold text-gray-900 mb-2">
              📧 이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-semibold placeholder-gray-600"
              placeholder="example@email.com"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-base font-bold text-gray-900 mb-2">
              🔒 비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-semibold placeholder-gray-600"
              placeholder="비밀번호 입력"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 rounded-lg transition"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p className="text-center text-gray-600 mt-6">
          계정이 없으신가요?{' '}
          <Link href="/signup" className="text-blue-600 hover:underline font-semibold">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  )
}
