'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useStore } from '@/store/useStore'
import { getSessionCookie, setSessionCookie, clearSessionCookie } from '@/lib/session'
import { listenForKick } from '@/lib/singleTab'

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  const setUser = useStore((state) => state.setUser)
  const router = useRouter()

  useEffect(() => {
    const cookieUser = getSessionCookie()
    if (cookieUser) {
      localStorage.setItem('user', JSON.stringify(cookieUser))
      setUser(cookieUser)
      setSessionCookie(cookieUser)
    } else {
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

    // 같은 계정이 다른 탭에서 로그인하면 이 탭 강제 로그아웃
    const lsRaw = localStorage.getItem('user')
    const currentUser = lsRaw ? (() => { try { return JSON.parse(lsRaw) } catch { return null } })() : null
    if (!currentUser) return

    const unsubscribe = listenForKick(currentUser.id, () => {
      localStorage.removeItem('user')
      clearSessionCookie()
      setUser(null as any)
      toast.error('다른 탭에서 로그인되어 이 탭은 로그아웃됩니다.', { duration: 4000 })
      setTimeout(() => router.push('/login'), 1500)
    })

    return unsubscribe
  }, [setUser, router])

  return <>{children}</>
}
