'use client'

import { useRouter } from 'next/navigation'
import { LogOut, ArrowLeft } from 'lucide-react'

export default function DropoutPage() {
  const router = useRouter()

  const handleLogout = () => {
    localStorage.removeItem('user')
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/admin')} className="flex items-center gap-2 text-blue-600 font-medium hover:underline">
            <ArrowLeft className="w-4 h-4" />
            돌아가기
          </button>
          <h1 className="text-2xl font-bold text-gray-900">🚫 중간이탈 관리</h1>
          <button onClick={handleLogout} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
            <LogOut className="w-4 h-4 inline mr-2" />
            로그아웃
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">중간이탈 학생</h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between bg-red-50 p-4 rounded-lg border border-red-300">
              <div>
                <p className="font-semibold text-gray-900">정학생</p>
                <p className="text-sm text-gray-600">웹개발 - 2026-06-20 중단</p>
                <p className="text-xs text-gray-500">사유: 개인 사정</p>
              </div>
              <span className="bg-red-200 text-red-800 px-3 py-1 rounded-full text-sm font-medium">🚫 중단</span>
            </div>
          </div>

          {/* 중간이탈 없으면 표시 */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
            <p className="text-blue-800">현재 중간이탈한 학생이 거의 없습니다! ✨</p>
          </div>
        </div>
      </main>
    </div>
  )
}
