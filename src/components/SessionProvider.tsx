'use client'

import { useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { getSessionCookie, setSessionCookie } from '@/lib/session'

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  const setUser = useStore((state) => state.setUser)

  useEffect(() => {
    const cookieUser = getSessionCookie()
    if (cookieUser) {
      // 쿠키가 살아있으면 → localStorage 동기화 + Zustand 복원 + 쿠키 30일 갱신
      localStorage.setItem('user', JSON.stringify(cookieUser))
      setUser(cookieUser)
      setSessionCookie(cookieUser)
    } else {
      // 쿠키 없어도 localStorage에 있으면 → 쿠키 새로 발급
      const lsRaw = localStorage.getItem('user')
      if (lsRaw) {
        try {
          const user = JSON.parse(lsRaw)
          setSessionCookie(user)
          setUser(user)
        } catch {
          localStorage.removeItem('user')
        }
      }
    }
  }, [setUser])

  return <>{children}</>
}
