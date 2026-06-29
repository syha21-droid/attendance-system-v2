'use client'

import { useRouter } from 'next/navigation'
import { LogOut, ArrowLeft } from 'lucide-react'
import { clearSessionCookie } from '@/lib/session'

export default function LatePage() {
  const router = useRouter()

  const handleLogout = () => {
    clearSessionCookie()
    localStorage.removeItem('user')
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-50 to-orange-100">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/admin')} className="flex items-center gap-2 text-blue-600 font-medium hover:underline">
            <ArrowLeft className="w-4 h-4" />
            돌아가기
          </button>
          <h1 className="text-2xl font-bold text-gray-900">⏰ 지각 관리</h1>
          <button onClick={handleLogout} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
            <LogOut className="w-4 h-4 inline mr-2" />
            로그아웃
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">지각 학생 현황</h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between bg-yellow-50 p-4 rounded-lg border border-yellow-300">
              <div>
                <p className="font-semibold text-gray-900">김학생</p>
                <p className="text-sm text-gray-600">Python 기초 - 2026-06-24 10:15</p>
              </div>
              <span className="bg-yellow-200 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">⏰ 지각</span>
            </div>

            <div className="flex items-center justify-between bg-yellow-50 p-4 rounded-lg border border-yellow-300">
              <div>
                <p className="font-semibold text-gray-900">박학생</p>
                <p className="text-sm text-gray-600">데이터분석 - 2026-06-23 14:05</p>
              </div>
              <span className="bg-yellow-200 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">⏰ 지각</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
