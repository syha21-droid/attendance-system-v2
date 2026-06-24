'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { LogOut, BookOpen, Award } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Course } from '@/types'

export default function StudentPage() {
  const router = useRouter()
  const user = useStore((state) => state.user)
  const setUser = useStore((state) => state.setUser)
  const [courses, setCourses] = useState<Course[]>([])
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState('')
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (!savedUser) {
      router.push('/login')
      return
    }

    const userData = JSON.parse(savedUser)
    if (userData.isAdmin) {
      router.push('/admin')
      return
    }

    setUser(userData)

    const savedCourses = localStorage.getItem('courses')
    if (savedCourses) {
      const allCourses = JSON.parse(savedCourses)
      setCourses(allCourses)
    } else {
      const defaultCourses = [
        { id: '1', name: 'Python 기초', instructor: '김교수', createdAt: new Date().toISOString() },
        { id: '2', name: '웹개발', instructor: '이교수', createdAt: new Date().toISOString() },
        { id: '3', name: '데이터분석', instructor: '박교수', createdAt: new Date().toISOString() },
      ]
      setCourses(defaultCourses)
      localStorage.setItem('courses', JSON.stringify(defaultCourses))
    }

    const saved = localStorage.getItem(`enrolled_${userData.id}`)
    if (saved) {
      setEnrolledCourses(JSON.parse(saved))
    }
  }, [router, setUser])

  const handleEnroll = () => {
    if (!selectedCourse) {
      toast.error('강의를 선택하세요')
      return
    }

    const course = courses.find((c) => c.id === selectedCourse)
    if (!course) return

    if (enrolledCourses.some((c) => c.id === course.id)) {
      toast.error('이미 등록한 강의입니다')
      return
    }

    const updated = [...enrolledCourses, course]
    setEnrolledCourses(updated)
    localStorage.setItem(`enrolled_${user?.id}`, JSON.stringify(updated))
    toast.success('✅ 강의 등록 완료!')
    setSelectedCourse('')
    setShowForm(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    setUser(null)
    router.push('/login')
  }

  const handleCourseClick = (courseId: string) => {
    router.push(`/student/course/${courseId}`)
  }

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">학생 대시보드</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/student/grades')}
              className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg flex items-center gap-2 font-medium"
            >
              <Award className="w-4 h-4" />
              성적표
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              로그아웃
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-8 mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            반갑습니다, {user.name}님!
          </h2>
          <p className="text-gray-600">📧 {user.email}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
            <p className="text-gray-600 text-sm">등록한 강의</p>
            <p className="text-3xl font-bold text-blue-600">{enrolledCourses.length}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-6 border border-green-200">
            <p className="text-gray-600 text-sm">총 출석</p>
            <p className="text-3xl font-bold text-green-600">0회</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-6 border border-purple-200">
            <p className="text-gray-600 text-sm">평균 출석률</p>
            <p className="text-3xl font-bold text-purple-600">0%</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-2xl font-bold text-gray-900">
              <BookOpen className="w-6 h-6 inline mr-2" />
              수강 강의
            </h3>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              + 강의 등록
            </button>
          </div>

          {showForm && (
            <div className="bg-blue-50 p-6 rounded-lg mb-6 border border-blue-200">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                강의 선택
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">-- 강의를 선택하세요 --</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name} ({course.instructor})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleEnroll}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                >
                  등록
                </button>
              </div>
            </div>
          )}

          {enrolledCourses.length === 0 ? (
            <p className="text-gray-500 text-center py-8">등록한 강의가 없습니다</p>
          ) : (
            <div className="space-y-3">
              {enrolledCourses.map((course) => (
                <div
                  key={course.id}
                  onClick={() => handleCourseClick(course.id)}
                  className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200 hover:shadow-lg transition cursor-pointer"
                >
                  <div>
                    <p className="font-semibold text-gray-900">{course.name}</p>
                    <p className="text-sm text-gray-600">👨‍🏫 {course.instructor}</p>
                  </div>
                  <span className="text-green-600 font-bold">✅ 등록됨</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
