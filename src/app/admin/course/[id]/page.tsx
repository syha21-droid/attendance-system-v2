'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { LogOut, ArrowLeft, Upload, Trash2, Download } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { supabase } from '@/lib/supabase'
import * as XLSX from 'xlsx'
import { Course } from '@/types'

interface CourseMaterial {
  id: string
  name: string
  size: string
  uploadedAt: string
}

interface StudentAttendance {
  id: string
  name: string
  email: string
  attendanceCount: number
  lateCount: number
}

export default function CourseDetailPage() {
  const router = useRouter()
  const params = useParams()
  const courseId = params.id as string
  const user = useStore((state) => state.user)
  const setUser = useStore((state) => state.setUser)

  const [course, setCourse] = useState<Course | null>(null)
  const [materials, setMaterials] = useState<CourseMaterial[]>([])
  const [students, setStudents] = useState<StudentAttendance[]>([])
  const [newMaterialName, setNewMaterialName] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [instructorName, setInstructorName] = useState('')
  const [isEditingInstructor, setIsEditingInstructor] = useState(false)
  const [notice, setNotice] = useState('')
  const [isEditingNotice, setIsEditingNotice] = useState(false)

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
      const courses = JSON.parse(savedCourses)
      const found = courses.find((c: Course) => c.id === courseId)
      if (found) {
        setCourse(found)
        setInstructorName(found.instructor)
        loadMaterials(found.id)
        loadStudents(found.id)

        const noticeKey = `course_notice_${found.id}`
        const savedNotice = localStorage.getItem(noticeKey)
        if (savedNotice) {
          setNotice(savedNotice)
        }
      }
    }
    setLoading(false)
  }, [courseId, router, setUser])

  const loadMaterials = (cId: string) => {
    const key = `course_materials_${cId}`
    const saved = localStorage.getItem(key)
    if (saved) {
      setMaterials(JSON.parse(saved))
    }
  }

  const loadStudents = async (cId: string) => {
    try {
      const studentsMap = new Map<string, any>()

      const allKeys = Object.keys(localStorage)
      for (const key of allKeys) {
        if (key.startsWith(`attendance_`) && key.endsWith(`_${cId}`)) {
          const parts = key.split('_')
          if (parts.length >= 3) {
            const userId = parts.slice(1, -1).join('_')
            if (!studentsMap.has(userId)) {
              const data = JSON.parse(localStorage.getItem(key) || '[]')
              const attendanceCount = data.filter((r: any) => r.status === 'present').length
              const lateCount = data.filter((r: any) => r.status === 'late').length

              studentsMap.set(userId, {
                id: userId,
                name: `학생 ${userId.substring(0, 8)}`,
                email: `student_${userId.substring(0, 8)}@example.com`,
                attendanceCount,
                lateCount,
              })
            }
          }
        }
      }

      if (supabase) {
        const { data: usersData } = await supabase
          .from('users')
          .select('*')
          .eq('role', 'student')

        if (usersData && usersData.length > 0) {
          for (const user of usersData) {
            const { data: attendanceData } = await supabase!
              .from('attendances')
              .select('*')
              .eq('user_id', user.id)
              .eq('course_id', cId)

            const attendanceCount = attendanceData?.filter(
              (a: any) => a.status === 'present'
            ).length || 0
            const lateCount = attendanceData?.filter(
              (a: any) => a.status === 'late'
            ).length || 0

            if (attendanceCount + lateCount > 0) {
              studentsMap.set(user.id, {
                id: user.id,
                name: user.name,
                email: user.email,
                attendanceCount,
                lateCount,
              })
            }
          }
        }
      }

      setStudents(Array.from(studentsMap.values()))
    } catch (error) {
      console.error('Error loading students:', error)
      setStudents([])
    }
  }

  const handleAddMaterial = () => {
    if (!selectedFile) {
      toast.error('파일을 선택하세요')
      return
    }

    if (!course) return

    const fileSizeInMB = (selectedFile.size / (1024 * 1024)).toFixed(2)

    const newMaterial: CourseMaterial = {
      id: Math.random().toString(36).substr(2, 9),
      name: selectedFile.name,
      size: `${fileSizeInMB}MB`,
      uploadedAt: new Date().toLocaleDateString('ko-KR'),
    }

    const updated = [...materials, newMaterial]
    const key = `course_materials_${course.id}`
    localStorage.setItem(key, JSON.stringify(updated))
    setMaterials(updated)
    toast.success('✅ 강의 자료가 추가되었습니다')
    setNewMaterialName('')
    setSelectedFile(null)
  }

  const handleDeleteMaterial = (id: string) => {
    if (!course) return

    const updated = materials.filter((m) => m.id !== id)
    const key = `course_materials_${course.id}`
    localStorage.setItem(key, JSON.stringify(updated))
    setMaterials(updated)
    toast.success('✅ 강의 자료가 삭제되었습니다')
  }

  const handleSaveInstructor = () => {
    if (!course || !instructorName.trim()) {
      toast.error('강사명을 입력하세요')
      return
    }

    const savedCourses = localStorage.getItem('courses')
    if (savedCourses) {
      const courses = JSON.parse(savedCourses)
      const updated = courses.map((c: Course) =>
        c.id === course.id ? { ...c, instructor: instructorName } : c
      )
      localStorage.setItem('courses', JSON.stringify(updated))
      setCourse({ ...course, instructor: instructorName })
      toast.success('✅ 강사명이 저장되었습니다')
      setIsEditingInstructor(false)
    }
  }

  const handleSaveNotice = () => {
    if (!course) return

    const noticeKey = `course_notice_${course.id}`
    localStorage.setItem(noticeKey, notice)
    toast.success('✅ 공지사항이 저장되었습니다')
    setIsEditingNotice(false)
  }

  const handleDownloadStudentExcel = () => {
    if (students.length === 0) {
      toast.error('내보낼 학생 데이터가 없습니다')
      return
    }

    const excelData = students.map((student) => ({
      학생명: student.name,
      이메일: student.email,
      출석: `${student.attendanceCount}회`,
      지각: `${student.lateCount}회`,
      총출석: `${student.attendanceCount + student.lateCount}회`,
    }))

    const ws = XLSX.utils.json_to_sheet(excelData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '수강생명단')
    XLSX.writeFile(
      wb,
      `${course?.name}_수강생명단_${new Date().toLocaleDateString('ko-KR')}.xlsx`
    )
    toast.success('✅ 엑셀 파일이 다운로드되었습니다')
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    setUser(null)
    router.push('/login')
  }

  if (loading || !course) {
    return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/admin')}
            className="text-blue-600 font-medium hover:underline flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            돌아가기
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{course.name}</h1>
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
        {/* 강의 정보 */}
        <div className="bg-white rounded-lg shadow p-8 mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">{course.name}</h2>

          {/* 공지사항 */}
          <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg mb-6">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-blue-900">📢 공지사항</p>
              <button
                onClick={() => setIsEditingNotice(!isEditingNotice)}
                className="text-sm text-blue-600 hover:underline"
              >
                {isEditingNotice ? '취소' : '편집'}
              </button>
            </div>
            {isEditingNotice ? (
              <div className="space-y-2">
                <textarea
                  value={notice}
                  onChange={(e) => setNotice(e.target.value)}
                  placeholder="공지사항을 입력하세요"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
                <button
                  onClick={handleSaveNotice}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg"
                >
                  저장
                </button>
              </div>
            ) : (
              <p className="text-gray-700">{notice || '공지사항이 없습니다'}</p>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">강사</p>
              {isEditingInstructor ? (
                <div className="space-y-2 mt-2">
                  <input
                    type="text"
                    value={instructorName}
                    onChange={(e) => setInstructorName(e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={handleSaveInstructor}
                      className="flex-1 bg-green-500 text-white py-1 rounded text-xs font-medium"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => setIsEditingInstructor(false)}
                      className="flex-1 bg-gray-400 text-white py-1 rounded text-xs font-medium"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <p
                  onClick={() => setIsEditingInstructor(true)}
                  className="text-lg font-semibold text-gray-900 cursor-pointer hover:underline"
                >
                  {instructorName}
                </p>
              )}
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">수강생</p>
              <p className="text-lg font-semibold text-gray-900">{students.length}명</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">강의 자료</p>
              <p className="text-lg font-semibold text-gray-900">{materials.length}개</p>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">평균 출석률</p>
              <p className="text-lg font-semibold text-gray-900">
                {students.length > 0
                  ? Math.round(
                      (students.reduce((acc, s) => acc + s.attendanceCount, 0) /
                        (students.length * 4)) *
                        100
                    )
                  : 0}
                %
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 강의 자료 관리 */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">📚 강의 자료 관리</h3>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📁 파일 선택
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  {selectedFile && (
                    <p className="text-sm text-gray-600 mt-2">선택됨: {selectedFile.name}</p>
                  )}
                </div>
                <button
                  onClick={handleAddMaterial}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
                  disabled={!selectedFile}
                >
                  <Upload className="w-4 h-4" />
                  파일 업로드
                </button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {materials.length === 0 ? (
                  <p className="text-gray-500 text-center py-8 text-sm">강의 자료가 없습니다</p>
                ) : (
                  materials.map((material) => (
                    <div
                      key={material.id}
                      className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-200"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate text-sm">
                          📄 {material.name}
                        </p>
                        <p className="text-xs text-gray-500">{material.uploadedAt}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteMaterial(material.id)}
                        className="ml-2 p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 수강생 명단 */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">👥 수강생 명단</h3>
                {students.length > 0 && (
                  <button
                    onClick={handleDownloadStudentExcel}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition text-sm"
                  >
                    <Download className="w-4 h-4" />
                    엑셀 다운로드
                  </button>
                )}
              </div>

              {students.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  아직 이 강의에 출석한 학생이 없습니다
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">학생명</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">이메일</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-900">✅ 출석</th>
                        <th className="text-center py-3 px-4 font-semibold text-gray-900">⏰ 지각</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, idx) => (
                        <tr
                          key={student.id}
                          className={`border-b border-gray-100 ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                          }`}
                        >
                          <td className="py-3 px-4 font-medium text-gray-900">{student.name}</td>
                          <td className="py-3 px-4 text-gray-600 text-sm">{student.email}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                              {student.attendanceCount}회
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                              {student.lateCount}회
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
