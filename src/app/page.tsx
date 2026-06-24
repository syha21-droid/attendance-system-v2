'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useStore } from '@/store/useStore'

export default function Home() {
  const router = useRouter()
  const user = useStore((state) => state.user)

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      const userData = JSON.parse(savedUser)
      useStore.setState({ user: userData })

      if (userData.isAdmin) {
        router.push('/admin')
      } else {
        router.push('/student')
      }
    }
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-12 max-w-md w-full">
        <h1 className="text-4xl font-bold text-center mb-2 text-gray-900">
          📚
        </h1>
        <h2 className="text-3xl font-bold text-center mb-8 text-gray-900">
          출석 관리 시스템
        </h2>

        <div className="space-y-4">
          <Link
            href="/login"
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg text-center transition"
          >
            로그인
          </Link>

          <Link
            href="/signup"
            className="block w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg text-center transition"
          >
            회원가입
          </Link>
        </div>

        <div className="mt-8 pt-8 border-t">
          <p className="text-gray-600 text-sm mb-3">테스트 계정:</p>
          <div className="bg-gray-50 p-3 rounded text-xs space-y-2">
            <div>
              <p className="font-semibold">학생</p>
              <p>이메일: student@test.com</p>
              <p>비밀번호: 123456</p>
            </div>
            <div className="pt-2 border-t">
              <p className="font-semibold">관리자</p>
              <p>이메일: admin@test.com</p>
              <p>비밀번호: 123456</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
