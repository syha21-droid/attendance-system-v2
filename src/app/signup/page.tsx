'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useStore } from '@/store/useStore'
import { apiSignup } from '@/lib/dataStore'

export default function SignUp() {
  const router = useRouter()
  const setUser = useStore((state) => state.setUser)

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    isAdmin: false,
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.email || !formData.password || !formData.name) {
      toast.error('모든 필드를 입력하세요')
      return
    }

    const userId = Math.random().toString(36).substr(2, 9)

    // 서버 가입 시도 (모든 기기 공유). no-db면 로컬 폴백.
    const result = await apiSignup({
      id: userId,
      email: formData.email,
      password: formData.password,
      name: formData.name,
      isAdmin: formData.isAdmin,
    })
    if (result.error && !result.nodb) {
      toast.error(result.error) // 예: 이미 가입된 이메일
      return
    }

    const user = result.user || {
      id: userId,
      email: formData.email,
      name: formData.name,
      isAdmin: formData.isAdmin,
    }

    // 로컬 캐시 (오프라인/폴백 로그인용 — 비밀번호 포함)
    const usersStr = localStorage.getItem('users')
    const users = usersStr ? JSON.parse(usersStr) : []
    if (!users.some((u: any) => u.email === formData.email)) {
      users.push({ ...user, password: formData.password })
      localStorage.setItem('users', JSON.stringify(users))
    }

    // 로그인 세션
    localStorage.setItem('user', JSON.stringify(user))
    setUser(user as any)

    // 학생이면 로컬 학생 목록에도 캐시
    if (!user.isAdmin) {
      const existingStudents = localStorage.getItem('students')
      const students = existingStudents ? JSON.parse(existingStudents) : []
      if (!students.some((s: any) => s.id === user.id)) {
        students.push({ id: user.id, email: user.email, name: user.name, createdAt: new Date().toISOString() })
        localStorage.setItem('students', JSON.stringify(students))
      }
    }

    toast.success('✅ 회원가입 완료!')

    setTimeout(() => {
      router.push(user.isAdmin ? '/admin' : '/student')
    }, 800)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <h2 className="text-3xl font-bold text-center mb-8 text-gray-900">
          회원가입
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-base font-bold text-gray-900 mb-2">
              📧 이메일
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 font-semibold placeholder-gray-600"
              placeholder="example@email.com"
            />
          </div>

          <div>
            <label className="block text-base font-bold text-gray-900 mb-2">
              🔒 비밀번호
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 font-semibold placeholder-gray-600"
              placeholder="비밀번호 입력"
            />
          </div>

          <div>
            <label className="block text-base font-bold text-gray-900 mb-2">
              👤 이름
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 font-semibold placeholder-gray-600"
              placeholder="홍길동"
            />
          </div>

          <div className="flex items-center bg-green-50 p-4 rounded-lg border border-green-200">
            <input
              type="checkbox"
              id="isAdmin"
              name="isAdmin"
              checked={formData.isAdmin}
              onChange={handleChange}
              className="h-5 w-5 text-green-600 rounded"
            />
            <label htmlFor="isAdmin" className="ml-3 text-base font-semibold text-gray-900">
              👨‍💼 관리자로 가입
            </label>
          </div>

          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition"
          >
            회원가입
          </button>
        </form>

        <p className="text-center text-gray-600 mt-6">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-green-600 hover:underline font-semibold">
            로그인
          </Link>
        </p>
      </div>
    </div>
  )
}
