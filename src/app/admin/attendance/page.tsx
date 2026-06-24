'use client'

import { useRouter } from 'next/navigation'
import { LogOut, ArrowLeft } from 'lucide-react'

export default function AttendancePage() {
  const router = useRouter()

  const handleLogout = () => {
    localStorage.removeItem('user')
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-100">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => router.push('/admin')} className="flex items-center gap-2 text-blue-600 font-medium hover:underline">
            <ArrowLeft className="w-4 h-4" />
            돌아가기
          </button>
          <h1 className="text-2xl font-bold text-gray-900">📊 출석 현황 조회</h1>
          <button onClick={handleLogout} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
            <LogOut className="w-4 h-4 inline mr-2" />
            로그아웃
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">학생별 출석 현황</h2>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border px-4 py-3 text-left font-semibold">학생명</th>
                  <th className="border px-4 py-3 text-left font-semibold">수강 강의</th>
                  <th className="border px-4 py-3 text-left font-semibold">총 출석</th>
                  <th className="border px-4 py-3 text-left font-semibold">상태</th>
                </tr>
              </thead>
              <tbody>
                <tr className="hover:bg-gray-50">
                  <td className="border px-4 py-3">김학생</td>
                  <td className="border px-4 py-3">Python 기초, 웹개발</td>
                  <td className="border px-4 py-3"><span className="bg-green-100 text-green-800 px-2 py-1 rounded">3회</span></td>
                  <td className="border px-4 py-3"><span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">✅ 수강 중</span></td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="border px-4 py-3">이학생</td>
                  <td className="border px-4 py-3">데이터분석</td>
                  <td className="border px-4 py-3"><span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded">1회</span></td>
                  <td className="border px-4 py-3"><span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">✅ 수강 중</span></td>
                </tr>
                <tr className="hover:bg-gray-50">
                  <td className="border px-4 py-3">박학생</td>
                  <td className="border px-4 py-3">Python 기초</td>
                  <td className="border px-4 py-3"><span className="bg-green-100 text-green-800 px-2 py-1 rounded">5회</span></td>
                  <td className="border px-4 py-3"><span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">✅ 수강 중</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
