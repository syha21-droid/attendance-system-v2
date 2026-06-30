'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useStore } from '@/store/useStore'
import { getSessionCookie, setSessionCookie } from '@/lib/session'
import { doLogout } from '@/lib/logout'

/**
 * 탭 1개만 활성 허용 로직:
 * - 로그인 시 sessionStorage에 tabToken 저장 (탭 고유, 새 탭엔 없음)
 * - localStorage엔 user 저장 (기존대로 복원용)
 * - 보호 페이지 진입 시: localStorage에 user 있는데 sessionStorage에 tabToken 없으면
 *   → 다른 탭에서 열린 것 → 로그인 화면으로 차단
 * - 로그인 성공 시 localStorage의 activeTabToken 갱신 → storage 이벤트로 기존 탭 킥
 */

const PROTECTED = ['/student', '/admin', '/live', '/attend', '/qr', '/special']

function isProtected(path: string) {
  return PROTECTED.some(p => path.startsWith(p))
}

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  const setUser = useStore((state) => state.setUser)
  const router = useRouter()
  const routerRef = useRef(router)
  routerRef.current = router

  const kick = (msg: string) => {
    doLogout()
    setUser(null as any)
    toast.error(msg, { duration: 4000 })
    setTimeout(() => routerRef.current.push('/login'), 800)
  }

  useEffect(() => {
    // 1) 세션 복원
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

    // 2) 보호 페이지에서 탭 토큰 검사
    //    로그인한 탭만 sessionStorage에 'tabToken'이 있음
    //    새 탭으로 열면 sessionStorage가 비어 있어서 차단됨
    if (isProtected(window.location.pathname)) {
      const lsUser = localStorage.getItem('user')
      const tabToken = sessionStorage.getItem('tabToken')
      if (lsUser && !tabToken) {
        // 다른 탭에서 이 URL을 복사해서 열었거나 새 탭으로 접근한 경우
        try {
          const u = JSON.parse(lsUser)
          if (!u.isAdmin) {
            // 관리자 제외
            kick('이미 다른 탭에서 로그인 중입니다. 탭은 1개만 사용할 수 있습니다.')
            return
          }
        } catch {}
      }
    }

    // 3) 다른 탭이 로그인하면 activeTabToken이 바뀜 → storage 이벤트로 감지
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'activeTabToken') return
      if (window.location.pathname === '/login') return
      const myToken = sessionStorage.getItem('tabToken')
      if (!myToken) return
      // 내 토큰과 새 토큰이 다르면 → 다른 탭이 로그인한 것
      if (e.newValue && e.newValue !== myToken) {
        // 같은 계정인지 확인
        try {
          const raw = localStorage.getItem('user')
          if (!raw) return
          const me = JSON.parse(raw)
          if (me.isAdmin) return
        } catch { return }
        kick('다른 탭에서 로그인되어 이 탭은 로그아웃됩니다.')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <>{children}</>
}
