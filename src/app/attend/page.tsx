'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { CheckCircle, AlertCircle, Clock } from 'lucide-react'

function AttendContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'time-error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const courseId = searchParams.get('courseId')
    const episode = searchParams.get('episode')
    const classNum = searchParams.get('class')

    if (!courseId || !classNum) {
      setStatus('error')
      setMessage('잘못된 QR코드입니다')
      return
    }

    // 강의 정보 로드
    const savedCourses = localStorage.getItem('courses')
    if (!savedCourses) {
      setStatus('error')
      setMessage('강의 정보를 찾을 수 없습니다')
      return
    }

    const courses = JSON.parse(savedCourses)
    const course = courses.find((c: any) => c.id === courseId)

    if (!course) {
      setStatus('error')
      setMessage('강의를 찾을 수 없습니다')
      return
    }

    // 시간표 로드
    const scheduleKey = course.courseType === 'episode'
      ? `course_schedule_${courseId}_episode_${episode}`
      : `course_schedule_${courseId}`

    const savedSchedule = localStorage.getItem(scheduleKey)
    if (!savedSchedule) {
      setStatus('error')
      setMessage('시간표를 찾을 수 없습니다')
      return
    }

    const scheduleData = JSON.parse(savedSchedule)
    const schedule = scheduleData.classes || []
    const currentClass = schedule.find((c: any) => c.number === Number(classNum))

    if (!currentClass) {
      setStatus('error')
      setMessage('교시를 찾을 수 없습니다')
      return
    }

    // 현재 시간이 강의 시간 범위 내인지 확인
    const now = new Date()
    const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0')

    if (currentTime < currentClass.startTime) {
      setStatus('time-error')
      setMessage(`강의가 아직 시작하지 않았습니다. ${currentClass.startTime}부터 출석 가능합니다`)
      return
    }

    if (currentTime >= currentClass.endTime) {
      setStatus('time-error')
      setMessage(`강의 시간이 종료되었습니다. (${currentClass.startTime} ~ ${currentClass.endTime})`)
      return
    }

    // 사용자 정보 확인
    const savedUser = localStorage.getItem('user')
    if (!savedUser) {
      setStatus('error')
      setMessage('로그인이 필요합니다')
      setTimeout(() => router.push('/login'), 2000)
      return
    }

    const user = JSON.parse(savedUser)

    // ✅ 강의 수강 여부 확인 (출석 권한 체크)
    const enrolledKey = `enrolled_${user.id}`
    const enrolledData = localStorage.getItem(enrolledKey)
    const enrolledCourses = enrolledData ? JSON.parse(enrolledData) : []
    const isEnrolled = enrolledCourses.some((c: any) => c.id === courseId)

    if (!isEnrolled) {
      setStatus('error')
      setMessage('❌ 이 강의에 등록되지 않았습니다.\n먼저 강의에 등록해주세요.')
      setTimeout(() => router.push(`/student/course/${courseId}`), 3000)
      return
    }

    // 출석 등록
    const now2 = new Date()
    const todayDate = now2.toLocaleDateString('ko-KR')
    const currentTime2 = now2.toLocaleTimeString('ko-KR')

    // 지각 판정
    let status_result: 'present' | 'late' | 'absent' = 'present'
    const [hours, minutes] = currentTime2.split(':').map(Number)
    const recordTime = new Date()
    recordTime.setHours(hours, minutes)

    const [classStartHour, classStartMin] = currentClass.startTime.split(':').map(Number)
    const classStartTime = new Date()
    classStartTime.setHours(classStartHour, classStartMin)

    const lateThreshold = 10 * 60000
    const absentThreshold = 30 * 60000
    const diff = recordTime.getTime() - classStartTime.getTime()

    if (diff >= lateThreshold && diff < absentThreshold) {
      status_result = 'late'
    } else if (diff >= absentThreshold) {
      status_result = 'absent'
    }

    const attendanceRecord = {
      date: todayDate,
      time: currentTime2,
      status: status_result,
      class: currentClass.name,
      method: 'qr-code',
    }

    const attendanceKey = `attendance_${user.id}_${courseId}`
    const saved = localStorage.getItem(attendanceKey)
    const updated = saved ? [...JSON.parse(saved), attendanceRecord] : [attendanceRecord]
    localStorage.setItem(attendanceKey, JSON.stringify(updated))

    const statusText = status_result === 'present' ? '✅ 출석' : status_result === 'late' ? '⏰ 지각' : '❌ 결석'
    setStatus('success')
    setMessage(`${statusText}\n${course.name} ${currentClass.name}\n${currentTime2}`)

    setTimeout(() => router.push(`/student/course/${courseId}`), 3000)
  }, [searchParams, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="inline-block p-4 bg-blue-100 rounded-full mb-4">
              <Clock className="w-12 h-12 text-blue-600 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">출석 처리 중...</h2>
            <p className="text-gray-600">잠깐만 기다려주세요</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="inline-block p-4 bg-green-100 rounded-full mb-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">✅ 출석이 완료되었습니다!</h2>
            <p className="text-gray-600 whitespace-pre-wrap">{message}</p>
            <p className="text-sm text-gray-500 mt-4">3초 후 강의 페이지로 이동합니다...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="inline-block p-4 bg-red-100 rounded-full mb-4">
              <AlertCircle className="w-12 h-12 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">❌ 오류가 발생했습니다</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <button
              onClick={() => router.push('/student')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg"
            >
              학생 페이지로 이동
            </button>
          </>
        )}

        {status === 'time-error' && (
          <>
            <div className="inline-block p-4 bg-yellow-100 rounded-full mb-4">
              <AlertCircle className="w-12 h-12 text-yellow-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">⏰ 강의 시간이 아닙니다</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <button
              onClick={() => router.push('/student')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg"
            >
              학생 페이지로 이동
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function AttendPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 text-center">
            <div className="inline-block p-4 bg-blue-100 rounded-full mb-4">
              <Clock className="w-12 h-12 text-blue-600 animate-spin" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">출석 처리 중...</h2>
            <p className="text-gray-600">잠깐만 기다려주세요</p>
          </div>
        </div>
      }
    >
      <AttendContent />
    </Suspense>
  )
}
