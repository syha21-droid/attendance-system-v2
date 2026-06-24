'use client'

import { useRouter } from 'next/navigation'
import { LogOut, ArrowLeft, Settings, X, Plus, Trash2, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Course } from '@/types'

interface StudentWithAttendance {
  id: string
  name: string
  email: string
  createdAt: string
  enrolledCourses: Course[]
  attendanceCount: number
  lateCount: number
  absentCount: number
  excusedCount: number
  exitCount: number
  lastExitTime: string | null
}

export default function StudentsPage() {
  const router = useRouter()
  const [students, setStudents] = useState<StudentWithAttendance[]>([])
  const [allCourses, setAllCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // 수강 관리 모달
  const [managingStudent, setManagingStudent] = useState<StudentWithAttendance | null>(null)
  const [editingCourses, setEditingCourses] = useState<Course[]>([])

  useEffect(() => {
    loadStudents()
  }, [])

  const loadStudents = () => {
    try {
      // 1. 전체 강의 목록 로드
      const coursesData = localStorage.getItem('courses')
      const courses: Course[] = coursesData ? JSON.parse(coursesData) : []
      setAllCourses(courses)

      // 2. 회원가입한 모든 학생 수집 (users 배열 + students 배열 병합)
      const studentMap = new Map<string, { id: string; name: string; email: string; createdAt: string }>()

      // users 배열에서 관리자가 아닌 사용자 추출
      const usersData = localStorage.getItem('users')
      if (usersData) {
        const users = JSON.parse(usersData)
        users.forEach((u: any) => {
          if (!u.isAdmin) {
            studentMap.set(u.id, {
              id: u.id,
              name: u.name || u.id,
              email: u.email || '',
              createdAt: u.createdAt || new Date().toISOString(),
            })
          }
        })
      }

      // students 배열에서 추가 정보 병합 (createdAt 등)
      const studentsData = localStorage.getItem('students')
      if (studentsData) {
        const registered = JSON.parse(studentsData)
        registered.forEach((s: any) => {
          const existing = studentMap.get(s.id)
          studentMap.set(s.id, {
            id: s.id,
            name: s.name || existing?.name || s.id,
            email: s.email || existing?.email || '',
            createdAt: s.createdAt || existing?.createdAt || new Date().toISOString(),
          })
        })
      }

      // 출석 기록만 있고 회원정보가 없는 학생도 포함
      const allKeys = Object.keys(localStorage)
      allKeys.forEach((key) => {
        if (key.startsWith('attendance_')) {
          const parts = key.split('_')
          if (parts.length >= 3) {
            const userId = parts.slice(1, -1).join('_')
            if (!studentMap.has(userId)) {
              studentMap.set(userId, {
                id: userId,
                name: `학생 ${userId.substring(0, 6)}`,
                email: '',
                createdAt: new Date().toISOString(),
              })
            }
          }
        }
      })

      // 3. 각 학생의 수강 강의 + 출석 정보 수집
      const result: StudentWithAttendance[] = []
      studentMap.forEach((student) => {
        // 수강 강의
        const enrolledData = localStorage.getItem(`enrolled_${student.id}`)
        const enrolledCourses: Course[] = enrolledData ? JSON.parse(enrolledData) : []

        // 출석 통계
        let attendanceCount = 0
        let lateCount = 0
        let absentCount = 0
        let excusedCount = 0
        let exitCount = 0
        let lastExitTime: string | null = null

        allKeys.forEach((key) => {
          if (key.startsWith(`attendance_${student.id}_`)) {
            const data = JSON.parse(localStorage.getItem(key) || '[]')
            attendanceCount += data.filter((r: any) => r.status === 'present').length
            lateCount += data.filter((r: any) => r.status === 'late').length
            absentCount += data.filter((r: any) => r.status === 'absent').length
            excusedCount += data.filter((r: any) => r.status === 'excused').length

            const exits = data.filter((r: any) => r.exitTime)
            exitCount += exits.length
            if (exits.length > 0) {
              const recent = exits[exits.length - 1]
              if (!lastExitTime || recent.exitTime > lastExitTime) {
                lastExitTime = recent.exitTime
              }
            }
          }
        })

        result.push({
          id: student.id,
          name: student.name,
          email: student.email,
          createdAt: student.createdAt,
          enrolledCourses,
          attendanceCount,
          lateCount,
          absentCount,
          excusedCount,
          exitCount,
          lastExitTime,
        })
      })

      // 최근 가입순 정렬
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setStudents(result)
    } catch (error) {
      console.error('Error loading students:', error)
    } finally {
      setLoading(false)
    }
  }

  const openManageModal = (student: StudentWithAttendance) => {
    setManagingStudent(student)
    setEditingCourses([...student.enrolledCourses])
  }

  const closeManageModal = () => {
    setManagingStudent(null)
    setEditingCourses([])
  }

  const addCourseToStudent = (course: Course) => {
    if (editingCourses.some((c) => c.id === course.id)) {
      toast.error('이미 등록된 강의입니다')
      return
    }
    setEditingCourses([...editingCourses, course])
  }

  const removeCourseFromStudent = (courseId: string) => {
    setEditingCourses(editingCourses.filter((c) => c.id !== courseId))
  }

  const saveEnrollmentChanges = () => {
    if (!managingStudent) return

    localStorage.setItem(`enrolled_${managingStudent.id}`, JSON.stringify(editingCourses))
    toast.success(`✅ ${managingStudent.name}님의 수강 정보가 변경되었습니다`)
    closeManageModal()
    loadStudents()
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    router.push('/login')
  }

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
  )

  const activeCount = students.filter((s) => s.enrolledCourses.length > 0).length

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
        {/* 통계 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm font-semibold mb-2">총 회원가입 학생</p>
            <p className="text-3xl font-bold text-purple-600">{students.length}</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm font-semibold mb-2">📚 수강 중</p>
            <p className="text-3xl font-bold text-green-600">{activeCount}</p>
            <p className="text-xs text-gray-600 mt-1">강의 등록함</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm font-semibold mb-2">⏳ 미수강</p>
            <p className="text-3xl font-bold text-yellow-600">{students.length - activeCount}</p>
            <p className="text-xs text-gray-600 mt-1">강의 미등록</p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm font-semibold mb-2">📊 평균 출석</p>
            <p className="text-3xl font-bold text-blue-600">
              {students.length > 0
                ? Math.round(students.reduce((acc, s) => acc + s.attendanceCount, 0) / students.length)
                : 0}
            </p>
            <p className="text-xs text-gray-600 mt-1">회/인</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <h2 className="text-2xl font-bold text-gray-900">📋 등록된 학생 목록</h2>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="이름 또는 이메일 검색"
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-900 font-semibold placeholder-gray-500 focus:ring-2 focus:ring-purple-500 w-64"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">로딩 중...</div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-lg font-semibold">
              {search ? '검색 결과가 없습니다.' : '등록된 학생이 없습니다.'}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredStudents.map((student, idx) => (
                <div
                  key={student.id}
                  className={`p-5 rounded-lg border-2 ${
                    idx % 3 === 0
                      ? 'bg-gradient-to-r from-purple-50 to-pink-50 border-purple-300'
                      : idx % 3 === 1
                      ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-300'
                      : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-300'
                  } hover:shadow-lg transition`}
                >
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <p className="font-bold text-lg text-gray-900">👤 {student.name}</p>
                        <span
                          className={`text-xs font-bold px-3 py-1 rounded-full ${
                            student.enrolledCourses.length > 0
                              ? 'bg-green-200 text-green-800'
                              : 'bg-yellow-200 text-yellow-800'
                          }`}
                        >
                          {student.enrolledCourses.length > 0
                            ? `📚 ${student.enrolledCourses.length}개 수강`
                            : '⏳ 미수강'}
                        </span>
                      </div>
                      <p className="text-base text-gray-700 font-semibold">📧 {student.email || '이메일 없음'}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        가입일: {new Date(student.createdAt).toLocaleDateString('ko-KR')}
                      </p>

                      {/* 수강 중인 강의 표시 */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {student.enrolledCourses.length === 0 ? (
                          <span className="text-sm text-gray-500 italic">등록된 강의 없음</span>
                        ) : (
                          student.enrolledCourses.map((c) => (
                            <span
                              key={c.id}
                              className="text-xs font-semibold bg-white border border-gray-300 text-gray-800 px-3 py-1 rounded-full"
                            >
                              📖 {c.name}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      {/* 수강 관리 버튼 */}
                      <button
                        onClick={() => openManageModal(student)}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition text-sm whitespace-nowrap"
                      >
                        <Settings className="w-4 h-4" />
                        수강 변경
                      </button>

                      {/* 출석 통계 */}
                      <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
                        <div className="bg-green-100 text-green-700 p-2 rounded text-center">✅ {student.attendanceCount}</div>
                        <div className="bg-yellow-100 text-yellow-700 p-2 rounded text-center">⏰ {student.lateCount}</div>
                        <div className="bg-red-100 text-red-700 p-2 rounded text-center">❌ {student.absentCount}</div>
                        <div className="bg-blue-100 text-blue-700 p-2 rounded text-center">🏥 {student.excusedCount}</div>
                        <div className="bg-purple-100 text-purple-700 p-2 rounded text-center">🚪 {student.exitCount}</div>
                        <div className="bg-gray-100 text-gray-600 p-2 rounded text-center text-[10px] flex items-center justify-center">
                          {student.lastExitTime ? student.lastExitTime : '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 수강 변경 모달 */}
      {managingStudent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">⚙️ 수강 변경</h3>
                <p className="text-sm text-gray-600 mt-1">
                  👤 {managingStudent.name} ({managingStudent.email || '이메일 없음'})
                </p>
              </div>
              <button onClick={closeManageModal} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* 현재 수강 중인 강의 */}
              <div>
                <h4 className="font-bold text-gray-900 mb-3">📚 현재 수강 강의 ({editingCourses.length}개)</h4>
                {editingCourses.length === 0 ? (
                  <p className="text-gray-500 text-sm bg-gray-50 p-4 rounded-lg text-center">
                    수강 중인 강의가 없습니다
                  </p>
                ) : (
                  <div className="space-y-2">
                    {editingCourses.map((course) => (
                      <div
                        key={course.id}
                        className="flex items-center justify-between bg-green-50 border border-green-200 p-3 rounded-lg"
                      >
                        <div>
                          <p className="font-semibold text-gray-900">📖 {course.name}</p>
                          <p className="text-xs text-gray-600">👨‍🏫 {course.instructor}</p>
                        </div>
                        <button
                          onClick={() => removeCourseFromStudent(course.id)}
                          className="bg-red-100 hover:bg-red-200 text-red-700 p-2 rounded-lg transition flex items-center gap-1 text-sm font-medium"
                        >
                          <Trash2 className="w-4 h-4" />
                          제거
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 추가 가능한 강의 */}
              <div>
                <h4 className="font-bold text-gray-900 mb-3">➕ 강의 추가</h4>
                {allCourses.filter((c) => !editingCourses.some((ec) => ec.id === c.id)).length === 0 ? (
                  <p className="text-gray-500 text-sm bg-gray-50 p-4 rounded-lg text-center">
                    추가할 수 있는 강의가 없습니다
                  </p>
                ) : (
                  <div className="space-y-2">
                    {allCourses
                      .filter((c) => !editingCourses.some((ec) => ec.id === c.id))
                      .map((course) => (
                        <div
                          key={course.id}
                          className="flex items-center justify-between bg-blue-50 border border-blue-200 p-3 rounded-lg"
                        >
                          <div>
                            <p className="font-semibold text-gray-900">📖 {course.name}</p>
                            <p className="text-xs text-gray-600">👨‍🏫 {course.instructor}</p>
                          </div>
                          <button
                            onClick={() => addCourseToStudent(course)}
                            className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition flex items-center gap-1 text-sm font-medium"
                          >
                            <Plus className="w-4 h-4" />
                            추가
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* 저장 버튼 */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex gap-3">
              <button
                onClick={closeManageModal}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 rounded-lg transition"
              >
                취소
              </button>
              <button
                onClick={saveEnrollmentChanges}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg transition"
              >
                ✅ 변경 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
