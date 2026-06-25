'use client'

import { useRouter } from 'next/navigation'
import { LogOut, ArrowLeft, AlertTriangle, Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { Course } from '@/types'

interface AttendanceLog {
  userId: string
  studentName: string
  email: string
  courseId: string
  courseName: string
  className: string
  date: string
  enterTime: string
  exitTime: string
  status: string // present | late | absent | excused
  notCompleted: boolean
  attendedRatio?: number
  attendedMinutes?: number
  awayMinutes?: number
  missedChecks?: number
  reason?: string
}

export default function AttendancePage() {
  const router = useRouter()
  const [logs, setLogs] = useState<AttendanceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'failed'>('all')

  useEffect(() => {
    loadLogs()
  }, [])

  const loadLogs = () => {
    try {
      // 학생 id → 이름/이메일
      const nameMap = new Map<string, { name: string; email: string }>()
      const usersData = localStorage.getItem('users')
      if (usersData) {
        JSON.parse(usersData).forEach((u: any) => {
          if (!u.isAdmin) nameMap.set(u.id, { name: u.name || u.id, email: u.email || '' })
        })
      }
      const studentsData = localStorage.getItem('students')
      if (studentsData) {
        JSON.parse(studentsData).forEach((s: any) => {
          nameMap.set(s.id, { name: s.name || s.id, email: s.email || '' })
        })
      }

      // 강의 id → 이름
      const courseMap = new Map<string, string>()
      const coursesData = localStorage.getItem('courses')
      if (coursesData) {
        JSON.parse(coursesData).forEach((c: Course) => courseMap.set(c.id, c.name))
      }

      const result: AttendanceLog[] = []
      Object.keys(localStorage).forEach((key) => {
        // attendance_{userId}_{courseId}
        if (!key.startsWith('attendance_')) return
        const rest = key.slice('attendance_'.length)
        // courseId 는 마지막 토큰, userId 는 그 사이
        const lastUnderscore = rest.lastIndexOf('_')
        if (lastUnderscore < 0) return
        const userId = rest.slice(0, lastUnderscore)
        const courseId = rest.slice(lastUnderscore + 1)

        const records = JSON.parse(localStorage.getItem(key) || '[]')
        const info = nameMap.get(userId)
        records.forEach((r: any) => {
          result.push({
            userId,
            studentName: info?.name || `학생 ${userId.substring(0, 6)}`,
            email: info?.email || '',
            courseId,
            courseName: courseMap.get(courseId) || courseId,
            className: r.class || '-',
            date: r.date || '-',
            enterTime: r.enterTime || r.time || '-',
            exitTime: r.exitTime || '-',
            status: r.status || 'present',
            notCompleted: !!r.notCompleted,
            attendedRatio: r.attendedRatio,
            attendedMinutes: r.attendedMinutes,
            awayMinutes: r.awayMinutes,
            missedChecks: r.missedChecks,
            reason: r.reason,
          })
        })
      })

      // 최신순 정렬 (날짜+입장시간 문자열 역순)
      result.sort((a, b) => (b.date + b.enterTime).localeCompare(a.date + a.enterTime))
      setLogs(result)
    } catch (e) {
      console.error('Error loading attendance logs:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('user')
    router.push('/login')
  }

  // 출석 미인정 = 결석이면서 수강 미완료(찍고 도망) 또는 일반 결석
  const failedLogs = logs.filter((l) => l.notCompleted || l.status === 'absent')
  const displayed = filter === 'failed' ? failedLogs : logs

  const statusBadge = (log: AttendanceLog) => {
    if (log.notCompleted) {
      return <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-bold">🚫 수강 미완료</span>
    }
    switch (log.status) {
      case 'present':
        return <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-bold">✅ 출석</span>
      case 'late':
        return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-bold">⏰ 지각</span>
      case 'absent':
        return <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-bold">❌ 결석</span>
      case 'excused':
        return <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-bold">🏥 공가</span>
      default:
        return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-bold">{log.status}</span>
    }
  }

  const handleDownload = () => {
    if (displayed.length === 0) return
    const data = displayed.map((l) => ({
      학생명: l.studentName,
      이메일: l.email,
      강의: l.courseName,
      교시: l.className,
      날짜: l.date,
      입장시간: l.enterTime,
      퇴장시간: l.exitTime,
      상태: l.notCompleted ? '수강 미완료' : l.status,
      참여율: l.attendedRatio != null ? `${l.attendedRatio}%` : '',
      자리비움: l.awayMinutes != null ? `${l.awayMinutes}분` : '',
      미응답: l.missedChecks != null ? `${l.missedChecks}회` : '',
      사유: l.reason || '',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '출석상세')
    XLSX.writeFile(wb, `출석상세_${new Date().toLocaleDateString('ko-KR')}.xlsx`)
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
        {/* 요약 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-5">
            <p className="text-gray-600 text-sm font-semibold mb-1">전체 기록</p>
            <p className="text-3xl font-bold text-gray-900">{logs.length}</p>
          </div>
          <div className="bg-green-50 rounded-lg shadow p-5 border border-green-200">
            <p className="text-gray-600 text-sm font-semibold mb-1">✅ 출석 인정</p>
            <p className="text-3xl font-bold text-green-600">
              {logs.filter((l) => !l.notCompleted && (l.status === 'present' || l.status === 'late')).length}
            </p>
          </div>
          <div className="bg-red-50 rounded-lg shadow p-5 border border-red-300">
            <p className="text-gray-600 text-sm font-semibold mb-1">🚫 수강 미완료</p>
            <p className="text-3xl font-bold text-red-600">{logs.filter((l) => l.notCompleted).length}</p>
            <p className="text-xs text-gray-500 mt-1">찍고 도망/이탈</p>
          </div>
          <div className="bg-blue-50 rounded-lg shadow p-5 border border-blue-200">
            <p className="text-gray-600 text-sm font-semibold mb-1">🏥 공가</p>
            <p className="text-3xl font-bold text-blue-600">{logs.filter((l) => l.status === 'excused').length}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 md:p-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <h2 className="text-2xl font-bold text-gray-900">학생별 출석 상세</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition ${
                  filter === 'all' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                전체 ({logs.length})
              </button>
              <button
                onClick={() => setFilter('failed')}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition ${
                  filter === 'failed' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                🚫 출석 미인정만 ({failedLogs.length})
              </button>
              {displayed.length > 0 && (
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 rounded-lg font-bold text-sm bg-green-600 text-white hover:bg-green-700 transition flex items-center gap-1"
                >
                  <Download className="w-4 h-4" />
                  엑셀
                </button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">로딩 중...</div>
          ) : displayed.length === 0 ? (
            <div className="text-center py-12 text-gray-500 font-semibold">
              {filter === 'failed' ? '출석 미인정 기록이 없습니다. 👍' : '출석 기록이 없습니다.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border px-3 py-3 text-left font-semibold">학생</th>
                    <th className="border px-3 py-3 text-left font-semibold">강의 / 교시</th>
                    <th className="border px-3 py-3 text-left font-semibold">날짜</th>
                    <th className="border px-3 py-3 text-center font-semibold">입장</th>
                    <th className="border px-3 py-3 text-center font-semibold">퇴장</th>
                    <th className="border px-3 py-3 text-center font-semibold">참여율</th>
                    <th className="border px-3 py-3 text-center font-semibold">상태</th>
                    <th className="border px-3 py-3 text-left font-semibold">사유 / 비고</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((log, idx) => (
                    <tr
                      key={idx}
                      className={log.notCompleted || log.status === 'absent' ? 'bg-red-50' : 'hover:bg-gray-50'}
                    >
                      <td className="border px-3 py-3">
                        <p className="font-semibold text-gray-900">{log.studentName}</p>
                        <p className="text-xs text-gray-500">{log.email}</p>
                      </td>
                      <td className="border px-3 py-3">
                        <p className="text-gray-900">{log.courseName}</p>
                        <p className="text-xs text-gray-500">{log.className}</p>
                      </td>
                      <td className="border px-3 py-3 text-gray-700">{log.date}</td>
                      <td className="border px-3 py-3 text-center font-mono text-gray-900">{log.enterTime}</td>
                      <td className="border px-3 py-3 text-center font-mono text-gray-900">{log.exitTime}</td>
                      <td className="border px-3 py-3 text-center">
                        {log.attendedRatio != null ? (
                          <span
                            className={`font-bold ${
                              log.attendedRatio >= 80 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {log.attendedRatio}%
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="border px-3 py-3 text-center">{statusBadge(log)}</td>
                      <td className="border px-3 py-3">
                        {log.notCompleted ? (
                          <div className="text-red-700 text-xs font-semibold flex items-start gap-1">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <div>
                              <p>{log.reason}</p>
                              {log.awayMinutes != null && log.awayMinutes > 0 && (
                                <p className="text-red-500">자리비움 {log.awayMinutes}분</p>
                              )}
                            </div>
                          </div>
                        ) : log.reason ? (
                          <span className="text-gray-600 text-xs">{log.reason}</span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
