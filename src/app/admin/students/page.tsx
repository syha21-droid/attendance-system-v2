'use client'

import { useRouter } from 'next/navigation'
import { LogOut, ArrowLeft } from 'lucide-react'

export default function StudentsPage() {
  const router = useRouter()

  const handleLogout = () => {
    localStorage.removeItem('user')
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/admin')} className="flex items-center gap-2 text-blue-600 font-medium hover:underline">
            <ArrowLeft className="w-4 h-4" />
            돌아가기
          </button>
          <h1 className="text-2xl font-bold text-gray-900">👥 학생 관리</h1>
          <button onClick={handleLogout} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
            <LogOut className="w-4 h-4 inline mr-2" />
            로그아웃
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">등록된 학생 목록</h2>

          <div className="space-y-3">
            <div className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
              <div>
                <p className="font-semibold text-gray-900">김학생</p>
                <p className="text-sm text-gray-600">📧 kim.student@example.com</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-600">수강 강의: 2개</p>
                <p className="text-xs text-gray-500">가입: 2026-06-20</p>
              </div>
            </div>

            <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-lg border border-blue-200">
              <div>
                <p className="font-semibold text-gray-900">이학생</p>
                <p className="text-sm text-gray-600">📧 lee.student@example.com</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-600">수강 강의: 1개</p>
                <p className="text-xs text-gray-500">가입: 2026-06-21</p>
              </div>
            </div>

            <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
              <div>
                <p className="font-semibold text-gray-900">박학생</p>
                <p className="text-sm text-gray-600">📧 park.student@example.com</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-600">수강 강의: 1개</p>
                <p className="text-xs text-gray-500">가입: 2026-06-22</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
