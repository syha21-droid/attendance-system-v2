'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useStore } from '@/store/useStore'
import { getSessionCookie, setSessionCookie } from '@/lib/session'
import { listenForKick } from '@/lib/singleTab'
import { doLogout } from '@/lib/logout'

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  const setUser = useStore((state) => state.setUser)
  const router = useRouter()
  const routerRef = useRef(router)
  routerRef.current = router

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

    // 항상 리스너 1개만 — router는 ref로 참조해 effect 재실행 방지
    const unsubscribe = listenForKick((incomingId) => {
      // 로그인 페이지에서는 킥 무시 (이미 로그인 화면이므로)
      if (window.location.pathname === '/login') return
      try {
        const raw = localStorage.getItem('user')
        if (!raw) return
        const me = JSON.parse(raw)
        if (me.id !== incomingId) return
      } catch { return }
      doLogout()
      setUser(null as any)
      toast.error('다른 탭에서 로그인되어 이 탭은 로그아웃됩니다.', { duration: 4000 })
      setTimeout(() => routerRef.current.push('/login'), 1500)
    })

    return unsubscribe
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // 의도적으로 빈 배열 — 앱 전체에서 리스너 1개만 유지

  return <>{children}</>
}
