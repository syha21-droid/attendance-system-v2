'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { LogOut, Users, BookOpen, BarChart3 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Course } from '@/types'

export default function AdminPage() {
  const router = useRouter()
  const user = useStore((state) => state.user)
  const setUser = useStore((state) => state.setUser)

  const [courses, setCourses] = useState<Course[]>([])
  const [newCourseName, setNewCourseName] = useState('')
  const [newCourseInstructor, setNewCourseInstructor] = useState('')

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (!savedUser) {
      router.push('/login')
      return
    }

    const userData = JSON.parse(savedUser)
    if (!userData.isAdmin) {
      router.push('/student')
      return
    }

    setUser(userData)

    const savedCourses = localStorage.getItem('courses')
    if (savedCourses) {
      setCourses(JSON.parse(savedCourses))
    } else {
      const defaultCourses = [
        { id: '1', name: 'Python 기초', instructor: '김교수', createdAt: new Date().toISOString() },
        { id: '2', name: '웹개발', instructor: '이교수', createdAt: new Date().toISOString() },
        { id: '3', name: '데이터분석', instructor: '박교수', createdAt: new Date().toISOString() },
      ]
      setCourses(defaultCourses)
      localStorage.setItem('courses', JSON.stringify(defaultCourses))
    }
  }, [router, setUser])

  const handleAddCourse = () => {
    if (!newCourseName || !newCourseInstructor) {
      toast.error('강의명과 강사명을 입력하세요')
      return
    }

    const newCourse: Course = {
      id: Math.random().toString(36).substr(2, 9),
      name: newCourseName,
      instructor: newCourseInstructor,
      createdAt: new Date().toISOString(),
    }

    const updated = [...courses, newCourse]
    setCourses(updated)
    localStorage.setItem('courses', JSON.stringify(updated))
    toast.success('✅ 강의가 추가되었습니다')
    setNewCourseName('')
    setNewCourseInstructor('')
  }

  const handleDeleteCourse = (id: string) => {
    const updated = courses.filter((c) => c.id !== id)
    setCourses(updated)
    localStorage.setItem('courses', JSON.stringify(updated))
    toast.success('✅ 강의가 삭제되었습니다')
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    setUser(null)
    router.push('/login')
  }

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">👨‍💼 관리자 대시보드</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-8 mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            안녕하세요, {user.name}님!
          </h2>
          <p className="text-gray-600">관리자 권한으로 로그인했습니다</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
            <BookOpen className="w-8 h-8 text-blue-600 mb-2" />
            <p className="text-gray-600 text-sm">등록된 강의</p>
            <p className="text-3xl font-bold text-blue-600">{courses.length}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-6 border border-green-200">
            <Users className="w-8 h-8 text-green-600 mb-2" />
            <p className="text-gray-600 text-sm">학생 수</p>
            <p className="text-3xl font-bold text-green-600">0</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-6 border border-purple-200">
            <BarChart3 className="w-8 h-8 text-purple-600 mb-2" />
            <p className="text-gray-600 text-sm">평균 출석률</p>
            <p className="text-3xl font-bold text-purple-600">0%</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg shadow p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">📚 강의 추가</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  강의명
                </label>
                <input
                  type="text"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="예: JavaScript 기초"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  강사명
                </label>
                <input
                  type="text"
                  value={newCourseInstructor}
                  onChange={(e) => setNewCourseInstructor(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="예: 홍길동"
                />
              </div>
              <button
                onClick={handleAddCourse}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition"
              >
                + 강의 추가
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">📋 등록된 강의</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {courses.length === 0 ? (
                <p className="text-gray-500 text-center py-8">등록된 강의가 없습니다</p>
              ) : (
                courses.map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center justify-between bg-gray-50 p-4 rounded-lg border border-gray-200 hover:shadow-lg transition cursor-pointer"
                    onClick={() => router.push(`/admin/course/${course.id}`)}
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{course.name}</p>
                      <p className="text-sm text-gray-600">👨‍🏫 {course.instructor}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteCourse(course.id)
                      }}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition font-medium text-sm"
                    >
                      삭제
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-8 mt-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">🎯 관리 메뉴</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button onClick={() => router.push('/admin/attendance')} className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition text-left cursor-pointer">
              <p className="font-semibold text-blue-900">📊 출석 현황 조회</p>
              <p className="text-sm text-blue-700">학생별 출석 현황을 조회합니다</p>
            </button>
            <button onClick={() => router.push('/admin/students')} className="p-4 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition text-left cursor-pointer">
              <p className="font-semibold text-green-900">👥 학생 관리</p>
              <p className="text-sm text-green-700">학생 목록을 조회합니다</p>
            </button>
            <button onClick={() => router.push('/admin/late')} className="p-4 bg-yellow-50 hover:bg-yellow-100 rounded-lg border border-yellow-200 transition text-left cursor-pointer">
              <p className="font-semibold text-yellow-900">⏰ 지각 관리</p>
              <p className="text-sm text-yellow-700">지각 학생을 관리합니다</p>
            </button>
            <button onClick={() => router.push('/admin/dropout')} className="p-4 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition text-left cursor-pointer">
              <p className="font-semibold text-red-900">🚫 중간이탈 관리</p>
              <p className="text-sm text-red-700">중간이탈 학생을 관리합니다</p>
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
