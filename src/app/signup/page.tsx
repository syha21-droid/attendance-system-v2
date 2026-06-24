'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useStore } from '@/store/useStore'

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.email || !formData.password || !formData.name) {
      toast.error('모든 필드를 입력하세요')
      return
    }

    const userId = Math.random().toString(36).substr(2, 9)
    const user = {
      id: userId,
      email: formData.email,
      name: formData.name,
      isAdmin: formData.isAdmin,
    }

    localStorage.setItem('user', JSON.stringify(user))
    setUser(user)

    // 학생이 아닌 경우만 회원가입 (관리자는 제외)
    if (!formData.isAdmin) {
      // 기존 학생 목록에서 이 사용자가 이미 있는지 확인
      const studentsKey = 'students'
      const existingStudents = localStorage.getItem(studentsKey)
      const students = existingStudents ? JSON.parse(existingStudents) : []

      // 중복 확인
      const isDuplicate = students.some((s: any) => s.id === userId)
      if (!isDuplicate) {
        students.push({
          id: userId,
          email: formData.email,
          name: formData.name,
          createdAt: new Date().toISOString(),
        })
        localStorage.setItem(studentsKey, JSON.stringify(students))
      }
    }

    toast.success('✅ 회원가입 완료!')

    setTimeout(() => {
      if (user.isAdmin) {
        router.push('/admin')
      } else {
        router.push('/student')
      }
    }, 1000)
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
