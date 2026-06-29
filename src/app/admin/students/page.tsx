'use client'

import { useRouter } from 'next/navigation'
import { LogOut, ArrowLeft, Settings, X, Plus, Trash2, Search, UserX } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Course } from '@/types'
import { clearSessionCookie } from '@/lib/session'

interface StudentWithAttendance {
  id: string
  name: string
  email: string
  createdAt: string
  enrolledCourses: Course[]
  droppedOut: boolean
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
  const [managingStudent, setManagingStudent] = useState<StudentWithAttendance | null>(null)
  const [editingCourses, setEditingCourses] = useState<Course[]>([])
  const [dropoutTarget, setDropoutTarget] = useState<StudentWithAttendance | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StudentWithAttendance | null>(null)

  useEffect(() => { loadStudents() }, [])

  const loadStudents = () => {
    try {
      const coursesData = localStorage.getItem('courses')
      const courses: Course[] = coursesData ? JSON.parse(coursesData) : []
      setAllCourses(courses)

      const studentMap = new Map<string, { id: string; name: string; email: string; createdAt: string }>()

      const usersData = localStorage.getItem('users')
      if (usersData) {
        JSON.parse(usersData).forEach((u: any) => {
          if (!u.isAdmin) {
            studentMap.set(u.id, { id: u.id, name: u.name || u.id, email: u.email || '', createdAt: u.createdAt || new Date().toISOString() })
          }
        })
      }

      const studentsData = localStorage.getItem('students')
      if (studentsData) {
        JSON.parse(studentsData).forEach((s: any) => {
          const existing = studentMap.get(s.id)
          studentMap.set(s.id, { id: s.id, name: s.name || existing?.name || s.id, email: s.email || existing?.email || '', createdAt: s.createdAt || existing?.createdAt || new Date().toISOString() })
        })
      }

      const allKeys = Object.keys(localStorage)
      allKeys.forEach((key) => {
        if (key.startsWith('attendance_')) {
          const parts = key.split('_')
          if (parts.length >= 3) {
            const userId = parts.slice(1, -1).join('_')
            if (!studentMap.has(userId)) {
              studentMap.set(userId, { id: userId, name: `학생 ${userId.substring(0, 6)}`, email: '', createdAt: new Date().toISOString() })
            }
          }
        }
      })

      const result: StudentWithAttendance[] = []
      studentMap.forEach((student) => {
        const enrolledData = localStorage.getItem(`enrolled_${student.id}`)
        const enrolledCourses: Course[] = enrolledData ? JSON.parse(enrolledData) : []

        let attendanceCount = 0, lateCount = 0, absentCount = 0, excusedCount = 0, exitCount = 0
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
              if (!lastExitTime || recent.exitTime > lastExitTime) lastExitTime = recent.exitTime
            }
          }
        })

        const droppedOut = localStorage.getItem(`dropout_${student.id}`) === 'true'
        result.push({ id: student.id, name: student.name, email: student.email, createdAt: student.createdAt, enrolledCourses, droppedOut, attendanceCount, lateCount, absentCount, excusedCount, exitCount, lastExitTime })
      })

      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      setStudents(result)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const openManageModal = (student: StudentWithAttendance) => {
    setManagingStudent(student)
    setEditingCourses([...student.enrolledCourses])
  }
  const closeManageModal = () => { setManagingStudent(null); setEditingCourses([]) }

  const saveEnrollmentChanges = () => {
    if (!managingStudent) return
    localStorage.setItem(`enrolled_${managingStudent.id}`, JSON.stringify(editingCourses))
    toast.success(`${managingStudent.name}님의 수강 정보가 변경되었습니다`)
    closeManageModal()
    loadStudents()
  }

  // 탈락 처리: 모든 강의 수강 취소 + 탈락 플래그
  const confirmDropout = () => {
    if (!dropoutTarget) return
    localStorage.setItem(`enrolled_${dropoutTarget.id}`, JSON.stringify([]))
    localStorage.setItem(`dropout_${dropoutTarget.id}`, 'true')
    toast.success(`${dropoutTarget.name}님이 탈락 처리되었습니다`)
    setDropoutTarget(null)
    loadStudents()
  }

  // 계정 완전 삭제
  const confirmDelete = () => {
    if (!deleteTarget) return
    const s = deleteTarget
    // users 목록에서 제거
    const usersRaw = localStorage.getItem('users')
    if (usersRaw) localStorage.setItem('users', JSON.stringify(JSON.parse(usersRaw).filter((u: any) => u.id !== s.id)))
    // students 목록에서 제거
    const stRaw = localStorage.getItem('students')
    if (stRaw) localStorage.setItem('students', JSON.stringify(JSON.parse(stRaw).filter((u: any) => u.id !== s.id)))
    // 관련 localStorage 키 전부 삭제
    Object.keys(localStorage).forEach((key) => {
      if (key === `enrolled_${s.id}` || key === `dropout_${s.id}` || key.startsWith(`attendance_${s.id}_`)) {
        localStorage.removeItem(key)
      }
    })
    toast.success(`${s.name}님 계정이 삭제되었습니다`)
    setDeleteTarget(null)
    loadStudents()
  }

  const filteredStudents = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  )
  const activeCount = students.filter((s) => s.enrolledCourses.length > 0).length

  const statStyle = (color: string): React.CSSProperties => ({
    fontSize: '11px', fontWeight: '600', color, padding: '5px 10px',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
    textAlign: 'center',
  })

  return (
    <div className="min-h-screen" style={{ background: '#080C10' }}>
      {/* 네비게이션 */}
      <nav style={{ background: '#0D1218', borderBottom: '1px solid rgba(255,255,255,0.07)' }} className="sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <button onClick={() => router.push('/admin')} className="rd-nav-btn flex items-center gap-2">
            <ArrowLeft style={{ width: '15px', height: '15px' }} />
            <span>돌아가기</span>
          </button>
          <div className="flex items-center gap-2.5">
            <div style={{ width: '22px', height: '22px', border: '1px solid #C9941A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'Georgia, serif', color: '#C9941A', fontSize: '11px', fontWeight: '700' }}>R</span>
            </div>
            <span style={{ fontFamily: 'Georgia, serif', color: 'rgba(255,255,255,0.60)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.14em', textTransform: 'uppercase' }}>학생 관리</span>
          </div>
          <button onClick={() => { clearSessionCookie(); localStorage.removeItem('user'); router.push('/login') }} className="rd-nav-btn">
            <LogOut style={{ width: '15px', height: '15px' }} />
            <span>로그아웃</span>
          </button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* 통계 */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-6">
          {[
            { label: '총 학생', value: students.length, color: 'white' },
            { label: '수강 중', value: activeCount, color: '#C9941A', sub: '강의 등록함' },
            { label: '미수강', value: students.length - activeCount, color: 'rgba(255,255,255,0.45)', sub: '강의 미등록' },
            { label: '평균 출석', value: students.length > 0 ? Math.round(students.reduce((a, s) => a + s.attendanceCount, 0) / students.length) : 0, color: 'rgba(255,255,255,0.70)', sub: '회/인' },
          ].map((stat) => (
            <div key={stat.label} className="rd-surface p-5">
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '10px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{stat.label}</p>
              <p style={{ fontSize: '2rem', fontWeight: '700', color: stat.color, lineHeight: 1 }}>{stat.value}</p>
              {stat.sub && <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.22)', marginTop: '6px' }}>{stat.sub}</p>}
            </div>
          ))}
        </div>

        {/* 검색 + 목록 */}
        <div className="rd-surface overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 sm:py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h2 style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.75)' }}>등록된 학생 목록</h2>
            <div style={{ position: 'relative' }}>
              <Search style={{ width: '14px', height: '14px', color: 'rgba(255,255,255,0.30)', position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="이름 또는 이메일"
                className="rd-input"
                style={{ width: '100%', maxWidth: '280px', minWidth: '160px', height: '38px', paddingLeft: '36px', fontSize: '13px' }}
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16"><div className="app-spinner" /></div>
          ) : filteredStudents.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '13px' }}>
              {search ? '검색 결과가 없습니다.' : '등록된 학생이 없습니다.'}
            </div>
          ) : (
            <div>
              {filteredStudents.map((student) => (
                <div key={student.id} style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="sm:px-6 sm:py-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: '6px' }}>
                        <p style={{ fontSize: '15px', fontWeight: '700', color: 'white' }}>{student.name}</p>
                        <span style={{
                          fontSize: '11px', fontWeight: '600', padding: '2px 10px',
                          color: student.enrolledCourses.length > 0 ? '#C9941A' : 'rgba(255,255,255,0.35)',
                          border: `1px solid ${student.enrolledCourses.length > 0 ? 'rgba(201,148,26,0.35)' : 'rgba(255,255,255,0.12)'}`,
                          background: student.enrolledCourses.length > 0 ? 'rgba(201,148,26,0.08)' : 'rgba(255,255,255,0.03)',
                        }}>
                          {student.enrolledCourses.length > 0 ? `${student.enrolledCourses.length}개 수강` : '미수강'}
                        </span>
                        {student.droppedOut && (
                          <span style={{ fontSize: '10px', fontWeight: '700', color: '#ef4444', padding: '2px 8px', border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.06)', letterSpacing: '0.08em' }}>
                            탈락
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginBottom: '3px' }}>{student.email || '이메일 없음'}</p>
                      <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.20)', marginBottom: '10px' }}>
                        가입일: {new Date(student.createdAt).toLocaleDateString('ko-KR')}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {student.enrolledCourses.length === 0 ? (
                          <span style={{ fontSize: '12px', color: student.droppedOut ? 'rgba(239,68,68,0.50)' : 'rgba(255,255,255,0.22)', fontStyle: 'italic' }}>
                            {student.droppedOut ? '수강 자격 없음' : '수강 강의 없음'}
                          </span>
                        ) : student.enrolledCourses.map((c) => (
                          <span key={c.id} style={{ fontSize: '11px', fontWeight: '500', color: 'rgba(255,255,255,0.55)', padding: '3px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col items-start sm:items-end gap-3">
                      {/* 버튼 그룹 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => openManageModal(student)}
                          className="flex items-center gap-1.5"
                          style={{ padding: '7px 12px', background: 'rgba(201,148,26,0.12)', border: '1px solid rgba(201,148,26,0.30)', color: '#C9941A', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'background 0.15s' }}
                        >
                          <Settings style={{ width: '13px', height: '13px' }} />
                          수강 변경
                        </button>
                        {!student.droppedOut && (
                          <button
                            onClick={() => setDropoutTarget(student)}
                            className="flex items-center gap-1.5"
                            style={{ padding: '7px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'background 0.15s' }}
                          >
                            <UserX style={{ width: '13px', height: '13px' }} />
                            탈락
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteTarget(student)}
                          className="flex items-center gap-1.5"
                          style={{ padding: '7px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.35)', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'background 0.15s' }}
                        >
                          <Trash2 style={{ width: '13px', height: '13px' }} />
                          삭제
                        </button>
                      </div>
                      {/* 출석 통계 */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <div style={statStyle('#4ade80')}>출석 {student.attendanceCount}</div>
                        <div style={statStyle('#facc15')}>지각 {student.lateCount}</div>
                        <div style={statStyle('#f87171')}>결석 {student.absentCount}</div>
                        <div style={statStyle('#60a5fa')}>공가 {student.excusedCount}</div>
                        <div style={statStyle('rgba(255,255,255,0.45)')}>퇴장 {student.exitCount}</div>
                        <div style={{ ...statStyle('rgba(255,255,255,0.25)'), fontSize: '10px' }}>
                          {student.lastExitTime ? student.lastExitTime.slice(0, 8) : '-'}
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
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.70)' }}>
          <div style={{ background: '#0F1420', border: '1px solid rgba(255,255,255,0.10)', width: '100%', maxWidth: '520px', maxHeight: '88vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between px-6 py-5 sticky top-0" style={{ background: '#0F1420', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div>
                <p style={{ fontSize: '10px', fontWeight: '700', color: '#C9941A', letterSpacing: '0.20em', textTransform: 'uppercase', marginBottom: '6px' }}>수강 변경</p>
                <p style={{ fontSize: '15px', fontWeight: '700', color: 'white' }}>{managingStudent.name}</p>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.30)', marginTop: '2px' }}>{managingStudent.email}</p>
              </div>
              <button onClick={closeManageModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: '4px' }}>
                <X style={{ width: '20px', height: '20px' }} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* 현재 수강 강의 */}
              <div>
                <p style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.38)', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: '12px' }}>
                  현재 수강 강의 ({editingCourses.length}개)
                </p>
                {editingCourses.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.25)', padding: '16px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    수강 중인 강의가 없습니다
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {editingCourses.map((course) => (
                      <div key={course.id} className="flex items-center justify-between" style={{ padding: '12px 14px', background: 'rgba(201,148,26,0.07)', border: '1px solid rgba(201,148,26,0.20)' }}>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.80)' }}>{course.name}</p>
                          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.30)', marginTop: '2px' }}>{course.instructor}</p>
                        </div>
                        <button
                          onClick={() => setEditingCourses(editingCourses.filter((c) => c.id !== course.id))}
                          className="flex items-center gap-1"
                          style={{ padding: '5px 10px', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                        >
                          <Trash2 style={{ width: '12px', height: '12px' }} />
                          제거
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 추가 가능한 강의 */}
              <div>
                <p style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.38)', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: '12px' }}>강의 추가</p>
                {allCourses.filter((c) => !editingCourses.some((ec) => ec.id === c.id)).length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.25)', padding: '16px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    추가할 수 있는 강의가 없습니다
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {allCourses.filter((c) => !editingCourses.some((ec) => ec.id === c.id)).map((course) => (
                      <div key={course.id} className="flex items-center justify-between" style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: '600', color: 'rgba(255,255,255,0.70)' }}>{course.name}</p>
                          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)', marginTop: '2px' }}>{course.instructor}</p>
                        </div>
                        <button
                          onClick={() => { if (!editingCourses.some((c) => c.id === course.id)) setEditingCourses([...editingCourses, course]) }}
                          className="flex items-center gap-1"
                          style={{ padding: '5px 10px', background: 'rgba(201,148,26,0.12)', border: '1px solid rgba(201,148,26,0.30)', color: '#C9941A', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                        >
                          <Plus style={{ width: '12px', height: '12px' }} />
                          추가
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 sticky bottom-0" style={{ background: '#0F1420', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button onClick={closeManageModal} style={{ flex: 1, height: '44px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.50)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                취소
              </button>
              <button onClick={saveEnrollmentChanges} className="btn-gold" style={{ flex: 1, height: '44px', fontSize: '13px' }}>
                변경 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 계정 삭제 확인 모달 */}
      {deleteTarget && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div style={{ background: '#0F1420', border: '1px solid rgba(255,255,255,0.12)', width: '100%', maxWidth: '360px', padding: '28px' }}>
            <p style={{ fontSize: '15px', fontWeight: '700', color: 'white', marginBottom: '10px' }}>계정 삭제</p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, marginBottom: '24px' }}>
              <span style={{ color: 'rgba(255,255,255,0.80)', fontWeight: '600' }}>{deleteTarget.name}</span> 계정을 영구 삭제합니다.<br />
              출석 기록·수강 내역이 모두 제거됩니다.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, height: '42px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.45)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                취소
              </button>
              <button onClick={confirmDelete} style={{ flex: 1, height: '42px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.70)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 탈락 확인 모달 */}
      {dropoutTarget && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.75)' }}>
          <div style={{ background: '#0F1420', border: '1px solid rgba(239,68,68,0.25)', width: '100%', maxWidth: '380px', padding: '32px 28px' }}>
            <div style={{ marginBottom: '20px' }}>
              <UserX style={{ width: '36px', height: '36px', color: '#f87171', marginBottom: '16px' }} />
              <p style={{ fontSize: '16px', fontWeight: '700', color: 'white', marginBottom: '8px' }}>탈락 처리 확인</p>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                <span style={{ color: 'white', fontWeight: '600' }}>{dropoutTarget.name}</span>님을 탈락 처리합니다.<br />
                모든 수강 강의({dropoutTarget.enrolledCourses.length}개)에서 제외됩니다.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDropoutTarget(null)} style={{ flex: 1, height: '44px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.50)', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
                취소
              </button>
              <button
                onClick={confirmDropout}
                style={{ flex: 1, height: '44px', background: '#dc2626', color: 'white', border: 'none', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
              >
                탈락 처리
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
