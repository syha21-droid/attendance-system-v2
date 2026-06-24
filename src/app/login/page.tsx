'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useStore } from '@/store/useStore'

export default function Login() {
  const router = useRouter()
  const setUser = useStore((state) => state.setUser)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    if (!email || !password) {
      toast.error('이메일과 비밀번호를 입력하세요')
      setLoading(false)
      return
    }

    setTimeout(() => {
      const testUsers = [
        {
          id: '1',
          email: 'student@test.com',
          password: '123456',
          name: '학생',
          isAdmin: false,
        },
        {
          id: '2',
          email: 'admin@test.com',
          password: '123456',
          name: '관리자',
          isAdmin: true,
        },
      ]

      const user = testUsers.find((u) => u.email === email && u.password === password)

      if (user) {
        const { password, ...userWithoutPassword } = user
        localStorage.setItem('user', JSON.stringify(userWithoutPassword))
        setUser(userWithoutPassword as any)
        toast.success('✅ 로그인 성공!')

        setTimeout(() => {
          if (user.isAdmin) {
            router.push('/admin')
          } else {
            router.push('/student')
          }
        }, 500)
      } else {
        toast.error('이메일 또는 비밀번호가 잘못되었습니다')
      }

      setLoading(false)
    }, 500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <h2 className="text-3xl font-bold text-center mb-8 text-gray-900">
          로그인
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이메일
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="example@email.com"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

        <div className="mt-6 pt-6 border-t">
          <p className="text-sm text-gray-600 mb-3">테스트 계정:</p>
          <div className="bg-blue-50 p-3 rounded text-xs space-y-2">
            <div>
              <p className="font-semibold">학생</p>
              <p>student@test.com</p>
              <p>123456</p>
            </div>
            <div className="pt-2 border-t">
              <p className="font-semibold">관리자</p>
              <p>admin@test.com</p>
              <p>123456</p>
            </div>
          </div>
        </div>

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
