'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { LogOut, Users, BookOpen, BarChart3, Download, ChevronRight, Trash2, Radio } from 'lucide-react'
import { useStore } from '@/store/useStore'
import * as XLSX from 'xlsx'
import { Course } from '@/types'
import { useIsomorphicLayoutEffect } from '@/lib/useIsomorphicLayoutEffect'
import { loadCourses, createCourse, deleteCourse, syncLocalCoursesToServer, loadStudents } from '@/lib/dataStore'
import { clearSessionCookie } from '@/lib/session'

export default function AdminPage() {
  const router = useRouter()
  const user = useStore((state) => state.user)
  const setUser = useStore((state) => state.setUser)
  const [courses, setCourses] = useState<Course[]>([])
  const [newCourseName, setNewCourseName] = useState('')
  const [newCourseInstructor, setNewCourseInstructor] = useState('')
  const [newCourseType, setNewCourseType] = useState<'session' | 'episode'>('session')
  const [newEpisodeCount, setNewEpisodeCount] = useState(9)
  const [studentCount, setStudentCount] = useState(0)
  const [avgAttendanceRate, setAvgAttendanceRate] = useState(0)

  useIsomorphicLayoutEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (!savedUser) { router.push('/login'); return }
    const userData = JSON.parse(savedUser)
    if (!userData.isAdmin) { router.push('/student'); return }
    setUser(userData)

    ;(async () => {
      const beforeRaw = localStorage.getItem('courses')
      const beforeLocal: Course[] = beforeRaw ? JSON.parse(beforeRaw) : []
      const server = await loadCourses()
      let list = server
      if (beforeLocal.length) {
        const changed = await syncLocalCoursesToServer(beforeLocal, server)
        if (changed) list = await loadCourses()
      }
      setCourses(list)
    })()

    loadStats()
  }, [router, setUser])

  const loadStats = async () => {
    const studentIds = new Set<string>()
    const usersData = localStorage.getItem('users')
    if (usersData) JSON.parse(usersData).forEach((u: any) => { if (!u.isAdmin) studentIds.add(u.id) })
    const studentsData = localStorage.getItem('students')
    if (studentsData) JSON.parse(studentsData).forEach((s: any) => studentIds.add(s.id))
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('attendance_')) {
        const parts = key.split('_')
        if (parts.length >= 3) studentIds.add(parts.slice(1, -1).join('_'))
      }
    })
    const serverStudents = await loadStudents()
    if (serverStudents) serverStudents.forEach((s: any) => studentIds.add(s.id))
    setStudentCount(studentIds.size)

    let totalPresent = 0, totalRecords = 0
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('attendance_')) {
        const data = JSON.parse(localStorage.getItem(key) || '[]')
        data.forEach((r: any) => { totalRecords++; if (r.status === 'present' || r.status === 'late') totalPresent++ })
      }
    })
    setAvgAttendanceRate(totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0)
  }

  const handleAddCourse = async () => {
    if (!newCourseName || !newCourseInstructor) { toast.error('강의명과 강사명을 입력하세요'); return }
    const newCourse: Course = {
      id: Math.random().toString(36).substr(2, 9),
      name: newCourseName, instructor: newCourseInstructor,
      createdAt: new Date().toISOString(), courseType: newCourseType,
      episodeCount: newCourseType === 'episode' ? newEpisodeCount : undefined,
    }
    setCourses((prev) => [...prev, newCourse])
    await createCourse(newCourse)
    setCourses(await loadCourses())
    toast.success('강의가 추가되었습니다')
    setNewCourseName(''); setNewCourseInstructor('')
    setNewCourseType('session'); setNewEpisodeCount(9)
  }

  const handleDeleteCourse = async (id: string) => {
    setCourses((prev) => prev.filter((c) => c.id !== id))
    await deleteCourse(id)
    setCourses(await loadCourses())
    toast.success('강의가 삭제되었습니다')
  }

  const handleDownloadExcel = () => {
    const attendanceData: any[] = []
    courses.forEach((course) => {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith(`attendance_`) && key.endsWith(`_${course.id}`)) {
          const data = JSON.parse(localStorage.getItem(key) || '[]')
          const parts = key.split('_')
          const userId = parts.slice(1, -1).join('_')
          data.forEach((record: any) => {
            const statusMap: any = { present: '출석', late: '지각', absent: '결석', excused: '공가' }
            attendanceData.push({
              강의명: course.name, 강사: course.instructor, 학생ID: userId,
              날짜: record.date, 시간: record.time, 상태: statusMap[record.status] || record.status, 사유: record.reason || '',
            })
          })
        }
      })
    })
    if (attendanceData.length === 0) { toast.error('내보낼 출석 데이터가 없습니다'); return }
    const ws = XLSX.utils.json_to_sheet(attendanceData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '출석현황')
    XLSX.writeFile(wb, `출석현황_${new Date().toLocaleDateString('ko-KR')}.xlsx`)
    toast.success('엑셀 파일이 다운로드되었습니다')
  }

  const handleLogout = () => { clearSessionCookie(); localStorage.removeItem('user'); setUser(null); router.push('/login') }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080C10' }}>
        <div className="app-spinner" />
      </div>
    )
  }

  const menuItems = [
    { label: '통계 대시보드', desc: '강의별 출석 통계', path: '/admin/statistics' },
    { label: '출석 현황',    desc: '입·퇴장 시간 및 미인정 기록', path: '/admin/attendance' },
    { label: '학생 관리',    desc: '학생 조회 및 수강 변경', path: '/admin/students' },
    { label: '지각 관리',    desc: '지각 학생 관리', path: '/admin/late' },
    { label: '특강 관리',    desc: '특강·수강권·사원 명단', path: '/admin/special' },
  ]

  return (
    <div className="min-h-screen" style={{ background: '#080C10' }}>
      {/* 네비게이션 */}
      <nav style={{ background: '#0D1218', borderBottom: '1px solid rgba(255,255,255,0.07)' }} className="sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div style={{ width: '22px', height: '22px', border: '1px solid #C9941A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontFamily: 'Georgia, serif', color: '#C9941A', fontSize: '11px', fontWeight: '700', lineHeight: '1' }}>R</span>
            </div>
            <span style={{ fontFamily: 'Georgia, serif', color: 'rgba(255,255,255,0.70)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Rich Divine Partners</span>
          </div>
          <button onClick={handleLogout} className="rd-nav-btn">
            <LogOut style={{ width: '15px', height: '15px' }} />
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div style={{ marginBottom: '28px' }}>
          <p style={{ fontSize: '10px', fontWeight: '700', color: '#C9941A', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '8px' }}>Admin</p>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '700', color: 'white' }}>{user.name}님</h1>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.30)', marginTop: '4px' }}>관리자 대시보드</p>
        </div>

        {/* 통계 */}
        <div className="grid grid-cols-3 gap-4" style={{ marginBottom: '20px' }}>
          <div className="rd-surface p-5">
            <BookOpen style={{ width: '15px', height: '15px', color: 'rgba(201,148,26,0.60)', marginBottom: '12px' }} />
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '8px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>등록된 강의</p>
            <p style={{ fontSize: '2rem', fontWeight: '700', color: 'white', lineHeight: 1 }}>{courses.length}</p>
          </div>
          <button onClick={() => router.push('/admin/students')} className="rd-surface p-5 text-left" style={{ cursor: 'pointer', transition: 'border-color 0.15s', borderRadius: '8px' }}>
            <Users style={{ width: '15px', height: '15px', color: 'rgba(201,148,26,0.60)', marginBottom: '12px' }} />
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '8px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>학생 수</p>
            <p style={{ fontSize: '2rem', fontWeight: '700', color: 'white', lineHeight: 1 }}>{studentCount}</p>
          </button>
          <div className="rd-surface p-5">
            <BarChart3 style={{ width: '15px', height: '15px', color: 'rgba(201,148,26,0.60)', marginBottom: '12px' }} />
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '8px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>평균 출석률</p>
            <p style={{ fontSize: '2rem', fontWeight: '700', color: '#C9941A', lineHeight: 1 }}>
              {avgAttendanceRate}<span style={{ fontSize: '1rem', fontWeight: '500', color: 'rgba(255,255,255,0.22)' }}>%</span>
            </p>
            <div style={{ marginTop: '10px', height: '2px', background: 'rgba(255,255,255,0.08)', borderRadius: '1px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#C9941A', width: `${avgAttendanceRate}%` }} />
            </div>
          </div>
        </div>

        {/* 위치 기반 출석 CTA */}
        <button
          onClick={() => router.push('/admin/live')}
          className="w-full flex items-center justify-between"
          style={{
            marginBottom: '20px', padding: '20px 24px',
            background: 'linear-gradient(135deg, rgba(201,148,26,0.18) 0%, rgba(201,148,26,0.08) 100%)',
            border: '1px solid rgba(201,148,26,0.30)', cursor: 'pointer', transition: 'border-color 0.15s',
            textAlign: 'left',
          }}
        >
          <div>
            <div className="flex items-center gap-2" style={{ marginBottom: '6px' }}>
              <Radio style={{ width: '15px', height: '15px', color: '#C9941A' }} />
              <p style={{ fontSize: '13px', fontWeight: '700', color: 'white' }}>위치 기반 출석 시작</p>
            </div>
            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.38)' }}>현장 위치 설정 후 학생 입·퇴장 자동 기록</p>
          </div>
          <ChevronRight style={{ width: '18px', height: '18px', color: 'rgba(201,148,26,0.60)', flexShrink: 0 }} />
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" style={{ marginBottom: '20px' }}>
          {/* 강의 추가 */}
          <div className="rd-surface p-6">
            <div className="accent-bar" />
            <h2 style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginBottom: '16px' }}>강의 추가</h2>
            <div className="flex flex-col gap-3">
              <input
                type="text" value={newCourseName} onChange={(e) => setNewCourseName(e.target.value)}
                placeholder="강의명" className="rd-input"
              />
              <input
                type="text" value={newCourseInstructor} onChange={(e) => setNewCourseInstructor(e.target.value)}
                placeholder="강사명" className="rd-input"
              />
              <select
                value={newCourseType} onChange={(e) => setNewCourseType(e.target.value as 'session' | 'episode')}
                className="rd-select"
              >
                <option value="session">특강식 (회차 없음)</option>
                <option value="episode">회차식 (MBA, 연속강의)</option>
              </select>
              {newCourseType === 'episode' && (
                <input
                  type="number" value={newEpisodeCount} onChange={(e) => setNewEpisodeCount(Number(e.target.value))}
                  min="1" max="50" placeholder="회차 수" className="rd-input"
                />
              )}
              <button onClick={handleAddCourse} className="btn-gold" style={{ width: '100%', height: '42px', fontSize: '13px' }}>
                추가하기
              </button>
            </div>
          </div>

          {/* 강의 목록 */}
          <div className="rd-surface p-6">
            <div className="accent-bar" />
            <h2 style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginBottom: '16px' }}>강의 목록 ({courses.length})</h2>
            <div className="flex flex-col gap-2" style={{ maxHeight: '280px', overflowY: 'auto' }}>
              {courses.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.24)', textAlign: 'center', padding: '32px 0' }}>등록된 강의가 없습니다</p>
              ) : courses.map((course) => (
                <div
                  key={course.id}
                  className="flex items-center justify-between"
                  style={{
                    padding: '12px 14px', background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', transition: 'border-color 0.12s',
                  }}
                  onClick={() => router.push(`/admin/course/${course.id}`)}
                >
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.80)' }}>{course.name}</p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)', marginTop: '2px' }}>{course.instructor}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteCourse(course.id) }}
                    style={{ padding: '6px', color: 'rgba(255,255,255,0.22)', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 0.12s', borderRadius: '4px' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.22)'}
                  >
                    <Trash2 style={{ width: '15px', height: '15px' }} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 데이터 관리 */}
        <div className="rd-surface p-6" style={{ marginBottom: '20px' }}>
          <div className="accent-bar" />
          <h2 style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.75)', marginBottom: '16px' }}>데이터 관리</h2>
          <button
            onClick={handleDownloadExcel}
            className="flex items-center gap-2"
            style={{
              padding: '10px 16px', border: '1px solid rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.60)',
              fontSize: '13px', fontWeight: '500', cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(201,148,26,0.40)'; e.currentTarget.style.color = 'rgba(255,255,255,0.85)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.color = 'rgba(255,255,255,0.60)' }}
          >
            <Download style={{ width: '15px', height: '15px' }} />
            출석 현황 엑셀 다운로드
          </button>
        </div>

        {/* 관리 메뉴 */}
        <div className="rd-surface overflow-hidden">
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.75)' }}>관리 메뉴</h2>
          </div>
          {menuItems.map((item) => (
            <button key={item.path} onClick={() => router.push(item.path)} className="rd-row-btn">
              <div className="flex items-center gap-3">
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#C9941A', padding: '3px 10px', border: '1px solid rgba(201,148,26,0.30)', background: 'rgba(201,148,26,0.07)' }}>
                  {item.label}
                </span>
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.30)' }}>{item.desc}</span>
              </div>
              <ChevronRight style={{ width: '15px', height: '15px', color: 'rgba(255,255,255,0.20)', flexShrink: 0 }} />
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}
