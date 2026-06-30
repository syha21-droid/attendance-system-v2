'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { LogOut, ArrowLeft, Award, Star, Zap, Trophy, Target } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { Course } from '@/types'
import { doLogout } from '@/lib/logout'

interface CourseStats {
  courseId: string
  courseName: string
  instructor: string
  attendanceRate: number
  rank: 'superRookie' | 'rookie' | 'none'
  present: number
  late: number
  absent: number
  excused: number
  total: number
}

interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  unlocked: boolean
  courses?: string[]
}

export default function GradesPage() {
  const router = useRouter()
  const user = useStore((state) => state.user)
  const setUser = useStore((state) => state.setUser)

  const [stats, setStats] = useState<CourseStats[]>([])
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (!savedUser) {
      router.push('/login')
      return
    }

    const userData = JSON.parse(savedUser)
    setUser(userData)

    // 사용자가 수강하는 강의 로드
    const enrolledKey = `enrolled_${userData.id}`
    const enrolledStr = localStorage.getItem(enrolledKey)
    const enrolled = enrolledStr ? JSON.parse(enrolledStr) : []

    const savedCourses = localStorage.getItem('courses')
    const allCourses = savedCourses ? JSON.parse(savedCourses) : []

    // 각 강의별 통계 계산
    const courseStats: CourseStats[] = enrolled.map((course: Course) => {
      const courseInfo = allCourses.find((c: Course) => c.id === course.id)
      const attendanceKey = `attendance_${userData.id}_${course.id}`
      const attendanceData = localStorage.getItem(attendanceKey)
      const records = attendanceData ? JSON.parse(attendanceData) : []

      const present = records.filter((r: any) => r.status === 'present').length
      const late = records.filter((r: any) => r.status === 'late').length
      const absent = records.filter((r: any) => r.status === 'absent').length
      const excused = records.filter((r: any) => r.status === 'excused').length
      const total = records.length

      const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0

      let rank: 'superRookie' | 'rookie' | 'none' = 'none'
      if (attendanceRate >= 95) {
        rank = 'superRookie'
      } else if (attendanceRate >= 80) {
        rank = 'rookie'
      }

      return {
        courseId: course.id,
        courseName: courseInfo?.name || course.name,
        instructor: courseInfo?.instructor || '',
        attendanceRate,
        rank,
        present,
        late,
        absent,
        excused,
        total,
      }
    })

    setStats(courseStats)

    // 업적 계산
    const achievementList: Achievement[] = [
      {
        id: 'perfect-attendance',
        name: '완벽한 출석',
        description: '한 강의에서 100% 출석률 달성',
        icon: '⭐',
        unlocked: courseStats.some((s) => s.attendanceRate === 100),
        courses: courseStats.filter((s) => s.attendanceRate === 100).map((s) => s.courseName),
      },
      {
        id: 'super-rookie-all',
        name: '슈퍼루키 마스터',
        description: '모든 강의에서 슈퍼루키(95%↑) 달성',
        icon: '✨',
        unlocked:
          courseStats.length > 0 &&
          courseStats.every((s) => s.rank === 'superRookie'),
      },
      {
        id: 'no-late',
        name: '시간 준수가',
        description: '한 강의에서 지각 0회 달성',
        icon: '⏰',
        unlocked: courseStats.some((s) => s.late === 0),
        courses: courseStats.filter((s) => s.late === 0).map((s) => s.courseName),
      },
      {
        id: 'perfect-discipline',
        name: '진정한 학생',
        description: '한 강의에서 결석 0회 달성',
        icon: '🎯',
        unlocked: courseStats.some((s) => s.absent === 0),
        courses: courseStats.filter((s) => s.absent === 0).map((s) => s.courseName),
      },
      {
        id: 'rookie-achieved',
        name: '루키 달성',
        description: '한 강의에서 루키(80%↑) 달성',
        icon: '🏆',
        unlocked: courseStats.some((s) => s.rank !== 'none'),
        courses: courseStats.filter((s) => s.rank !== 'none').map((s) => s.courseName),
      },
    ]

    setAchievements(achievementList)
    setLoading(false)
  }, [router, setUser])

  const handleLogout = () => {
    
    localStorage.removeItem('user')
    setUser(null)
    router.push('/login')
  }

  const getRankBadge = (rank: string) => {
    if (rank === 'superRookie') {
      return {
        label: '🌟 슈퍼루키',
        color: 'bg-purple-100 text-purple-800 border-purple-300',
        description: '95% 이상',
      }
    } else if (rank === 'rookie') {
      return {
        label: '⭐ 루키',
        color: 'bg-blue-100 text-blue-800 border-blue-300',
        description: '80% 이상',
      }
    }
    return {
      label: '진행 중',
      color: 'bg-gray-100 text-gray-800 border-gray-300',
      description: '80% 미만',
    }
  }

  if (loading) {
    return <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gradient-to-br from-blue-50 to-indigo-100"><div className="app-spinner" /><p className="text-gray-600 font-semibold">로딩 중...</p></div>
  }

  const unlockedCount = achievements.filter((a) => a.unlocked).length
  const totalAchievements = achievements.length

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/student')}
            className="text-blue-600 font-medium hover:underline flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            돌아가기
          </button>
          <h1 className="text-2xl font-bold text-gray-900">🎓 학습 현황</h1>
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
        {/* 업적 요약 */}
        <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-lg shadow-lg p-8 mb-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-sm mb-2">🏆 업적 달성</p>
              <p className="text-5xl font-bold">
                {unlockedCount}/{totalAchievements}
              </p>
              <p className="text-amber-200 text-sm mt-2">
                {unlockedCount === totalAchievements
                  ? '모든 업적을 달성했습니다! 🎉'
                  : `${totalAchievements - unlockedCount}개 업적 남음`}
              </p>
            </div>
            <Trophy className="w-24 h-24 text-amber-100 opacity-50" />
          </div>
        </div>

        {/* 강의별 출석 현황 */}
        <div className="bg-white rounded-lg shadow p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">📚 강의별 출석 현황</h2>

          {stats.length === 0 ? (
            <p className="text-gray-500 text-center py-8">수강 강의가 없습니다</p>
          ) : (
            <div className="space-y-4">
              {stats.map((course) => {
                const badge = getRankBadge(course.rank)
                return (
                  <div
                    key={course.courseId}
                    className="border-l-4 border-indigo-500 bg-gray-50 p-6 rounded-lg hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900">
                          {course.courseName}
                        </h3>
                        <p className="text-sm text-gray-600">
                          👨‍🏫 {course.instructor}
                        </p>
                      </div>
                      <div
                        className={`px-6 py-3 rounded-lg border-2 text-center ${badge.color}`}
                      >
                        <p className="text-2xl font-bold">{badge.label}</p>
                        <p className="text-xs font-semibold mt-1">
                          {badge.description}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                      <div className="bg-green-50 p-3 rounded">
                        <p className="text-xs text-gray-600">✅ 출석</p>
                        <p className="text-2xl font-bold text-green-600">
                          {course.present}
                        </p>
                      </div>
                      <div className="bg-yellow-50 p-3 rounded">
                        <p className="text-xs text-gray-600">⏰ 지각</p>
                        <p className="text-2xl font-bold text-yellow-600">
                          {course.late}
                        </p>
                      </div>
                      <div className="bg-red-50 p-3 rounded">
                        <p className="text-xs text-gray-600">❌ 결석</p>
                        <p className="text-2xl font-bold text-red-600">
                          {course.absent}
                        </p>
                      </div>
                      <div className="bg-blue-50 p-3 rounded">
                        <p className="text-xs text-gray-600">🏥 공가</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {course.excused}
                        </p>
                      </div>
                      <div className="bg-purple-50 p-3 rounded">
                        <p className="text-xs text-gray-600">출석률</p>
                        <p className="text-2xl font-bold text-purple-600">
                          {course.attendanceRate}%
                        </p>
                      </div>
                    </div>

                    {/* 진행도 바 */}
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          course.rank === 'superRookie'
                            ? 'bg-purple-600'
                            : course.rank === 'rookie'
                            ? 'bg-blue-600'
                            : 'bg-indigo-600'
                        }`}
                        style={{ width: `${course.attendanceRate}%` }}
                      ></div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 업적 시스템 */}
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">🏅 업적</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {achievements.map((achievement) => (
              <div
                key={achievement.id}
                className={`p-4 rounded-lg border-2 transition ${
                  achievement.unlocked
                    ? 'bg-yellow-50 border-yellow-300'
                    : 'bg-gray-50 border-gray-300 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3 mb-2">
                  <span className="text-3xl">{achievement.icon}</span>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">
                      {achievement.name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {achievement.description}
                    </p>
                  </div>
                  {achievement.unlocked && (
                    <span className="text-yellow-600 text-xl">✓</span>
                  )}
                </div>
                {achievement.courses && achievement.courses.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    {achievement.courses.join(', ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 루키/슈퍼루키 기준 */}
        <div className="bg-indigo-50 border-l-4 border-indigo-500 rounded-lg p-6 mt-8">
          <h3 className="font-bold text-indigo-900 mb-3">📖 출석 등급 기준</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-semibold text-indigo-900">🌟 슈퍼루키</p>
              <p className="text-indigo-700">95% 이상</p>
            </div>
            <div>
              <p className="font-semibold text-indigo-900">⭐ 루키</p>
              <p className="text-indigo-700">80% 이상</p>
            </div>
            <div>
              <p className="font-semibold text-indigo-900">진행 중</p>
              <p className="text-indigo-700">80% 미만</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
