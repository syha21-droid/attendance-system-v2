'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { LogOut, BookOpen, Award, ChevronRight, Plus, X } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Course } from '@/types'
import { useIsomorphicLayoutEffect } from '@/lib/useIsomorphicLayoutEffect'
import { loadCourses, loadEnrolledCourses, enrollCourse } from '@/lib/dataStore'
import { clearSessionCookie } from '@/lib/session'

export default function StudentPage() {
  const router = useRouter()
  const user = useStore((state) => state.user)
  const setUser = useStore((state) => state.setUser)
  const [courses, setCourses] = useState<Course[]>([])
  const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [totalAttendance, setTotalAttendance] = useState(0)
  const [attendanceRate, setAttendanceRate] = useState(0)

  useIsomorphicLayoutEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (!savedUser) { router.push('/login'); return }
    const userData = JSON.parse(savedUser)
    if (userData.isAdmin) { router.push('/admin'); return }
    setUser(userData)

    ;(async () => {
      const list = await loadCourses()
      setCourses(list)
      const enrolled = await loadEnrolledCourses(userData.id, list)
      setEnrolledCourses(enrolled)
    })()

    let present = 0, late = 0, absent = 0
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(`attendance_${userData.id}_`)) {
        const data = JSON.parse(localStorage.getItem(key) || '[]')
        present += data.filter((r: any) => r.status === 'present').length
        late += data.filter((r: any) => r.status === 'late').length
        absent += data.filter((r: any) => r.status === 'absent').length
      }
    })
    setTotalAttendance(present + late)
    const denom = present + late + absent
    setAttendanceRate(denom > 0 ? Math.round(((present + late) / denom) * 100) : 0)
  }, [router, setUser])

  const handleEnroll = async () => {
    if (!selectedCourse) { toast.error('강의를 선택하세요'); return }
    const course = courses.find((c) => c.id === selectedCourse)
    if (!course || !user) return
    if (enrolledCourses.some((c) => c.id === course.id)) { toast.error('이미 등록한 강의입니다'); return }
    const updated = [...enrolledCourses, course]
    setEnrolledCourses(updated)
    await enrollCourse(user.id, course)
    toast.success('강의 등록 완료!')
    setSelectedCourse('')
    setShowForm(false)
  }

  const handleLogout = () => { clearSessionCookie(); localStorage.removeItem('user'); setUser(null); router.push('/login') }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080C10' }}>
        <div className="app-spinner" />
      </div>
    )
  }

  const ratePct = Math.min(100, attendanceRate)

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
          <div className="flex items-center gap-1">
            <button onClick={() => router.push('/student/grades')} className="rd-nav-btn">
              <Award style={{ width: '15px', height: '15px' }} /> 성적표
            </button>
            <button onClick={handleLogout} className="rd-nav-btn">
              <LogOut style={{ width: '15px', height: '15px' }} />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* 헤더 */}
        <div style={{ marginBottom: '32px' }}>
          <p style={{ fontSize: '10px', fontWeight: '700', color: '#C9941A', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: '8px' }}>Student</p>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '700', color: 'white' }}>{user.name}님</h1>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.30)', marginTop: '4px' }}>{user.email}</p>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-3 gap-4" style={{ marginBottom: '28px' }}>
          <div className="rd-surface p-5">
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '10px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>등록 강의</p>
            <p style={{ fontSize: '2rem', fontWeight: '700', color: 'white', lineHeight: 1 }}>{enrolledCourses.length}</p>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.22)', marginTop: '6px' }}>개</p>
          </div>
          <div className="rd-surface p-5">
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '10px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>총 출석</p>
            <p style={{ fontSize: '2rem', fontWeight: '700', color: 'white', lineHeight: 1 }}>{totalAttendance}</p>
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.22)', marginTop: '6px' }}>회</p>
          </div>
          <div className="rd-surface p-5">
            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '10px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>출석률</p>
            <p style={{ fontSize: '2rem', fontWeight: '700', color: '#C9941A', lineHeight: 1 }}>
              {attendanceRate}<span style={{ fontSize: '1rem', fontWeight: '500', color: 'rgba(255,255,255,0.22)' }}>%</span>
            </p>
            <div style={{ marginTop: '10px', height: '2px', background: 'rgba(255,255,255,0.08)', borderRadius: '1px', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#C9941A', borderRadius: '1px', width: `${ratePct}%`, transition: 'width 0.6s ease' }} />
            </div>
          </div>
        </div>

        {/* 수강 강의 */}
        <div className="rd-surface overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2">
              <BookOpen style={{ width: '15px', height: '15px', color: '#C9941A' }} />
              <h2 style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.80)' }}>수강 강의</h2>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1.5"
              style={{
                padding: '7px 12px', background: showForm ? 'rgba(255,255,255,0.06)' : '#C9941A',
                color: showForm ? 'rgba(255,255,255,0.60)' : 'white',
                fontSize: '12px', fontWeight: '600', border: 'none', cursor: 'pointer',
                borderRadius: '4px', transition: 'background 0.15s',
              }}
            >
              {showForm ? <X style={{ width: '13px', height: '13px' }} /> : <Plus style={{ width: '13px', height: '13px' }} />}
              {showForm ? '닫기' : '강의 등록'}
            </button>
          </div>

          {showForm && (
            <div className="px-6 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
              <p style={{ fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: '14px' }}>강의 선택</p>
              {courses.length > 0 ? (
                <div className="flex flex-col gap-2" style={{ marginBottom: '14px', maxHeight: '192px', overflowY: 'auto' }}>
                  {courses.map((course) => (
                    <button
                      key={course.id} onClick={() => setSelectedCourse(course.id)}
                      style={{
                        textAlign: 'left', padding: '12px 14px', border: '1px solid',
                        borderColor: selectedCourse === course.id ? '#C9941A' : 'rgba(255,255,255,0.08)',
                        background: selectedCourse === course.id ? 'rgba(201,148,26,0.12)' : 'rgba(255,255,255,0.02)',
                        cursor: 'pointer', transition: 'all 0.12s',
                      }}
                    >
                      <p style={{ fontSize: '13px', fontWeight: '600', color: selectedCourse === course.id ? '#C9941A' : 'rgba(255,255,255,0.80)' }}>{course.name}</p>
                      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.30)', marginTop: '2px' }}>{course.instructor}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.28)', textAlign: 'center', padding: '16px 0', marginBottom: '14px' }}>등록된 강의가 없습니다</p>
              )}
              <button
                onClick={handleEnroll} disabled={!selectedCourse}
                className="btn-gold" style={{ width: '100%', height: '42px', fontSize: '13px' }}
              >
                등록하기
              </button>
            </div>
          )}

          {enrolledCourses.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: '13px' }}>등록한 강의가 없습니다</p>
              <p style={{ color: 'rgba(255,255,255,0.16)', fontSize: '12px', marginTop: '6px' }}>위 버튼으로 강의를 등록해보세요</p>
            </div>
          ) : (
            <div>
              {enrolledCourses.map((course) => (
                <button key={course.id} onClick={() => router.push(`/student/course/${course.id}`)} className="rd-row-btn">
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.82)' }}>{course.name}</p>
                    <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.30)', marginTop: '3px' }}>{course.instructor}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: '11px', fontWeight: '600', color: '#C9941A', padding: '3px 10px', border: '1px solid rgba(201,148,26,0.35)', background: 'rgba(201,148,26,0.08)' }}>등록됨</span>
                    <ChevronRight style={{ width: '15px', height: '15px', color: 'rgba(255,255,255,0.22)' }} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
