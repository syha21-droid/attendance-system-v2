'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useStore } from '@/store/useStore'
import { getSessionCookie, setSessionCookie } from '@/lib/session'
import { doLogout } from '@/lib/logout'

const PROTECTED = ['/student', '/admin', '/live', '/attend', '/qr', '/special']
const isProtected = (path: string) => PROTECTED.some(p => path.startsWith(p))

// 이 탭의 고유 ID (sessionStorage — 탭 닫으면 사라짐, 페이지 이동해도 유지)
function getMyTabId(): string {
  let id = sessionStorage.getItem('myTabId')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('myTabId', id)
  }
  return id
}

function isAdmin(): boolean {
  try { return JSON.parse(localStorage.getItem('user') || '{}').isAdmin === true } catch { return false }
}

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  const setUser = useStore((state) => state.setUser)
  const router = useRouter()
  const routerRef = useRef(router)
  routerRef.current = router

  const forceLogout = (msg: string) => {
    doLogout()
    setUser(null as any)
    toast.error(msg, { duration: 5000 })
    setTimeout(() => routerRef.current.push('/login'), 800)
  }

  useEffect(() => {
    // ── 세션 복원 ──
    const cookieUser = getSessionCookie()
    if (cookieUser) {
      localStorage.setItem('user', JSON.stringify(cookieUser))
      setUser(cookieUser)
      setSessionCookie(cookieUser)
    } else {
      const raw = localStorage.getItem('user')
      if (raw) {
        try { const u = JSON.parse(raw); setSessionCookie(u); setUser(u) }
        catch { localStorage.removeItem('user') }
      }
    }

    // ── 보호 페이지 진입 시 탭 클레임 확인 ──
    // 관리자는 제한 없음
    if (isProtected(window.location.pathname) && !isAdmin()) {
      const myTabId = getMyTabId()
      const activeTabId = localStorage.getItem('activeTabId')
      if (activeTabId && activeTabId !== myTabId) {
        // 이 탭은 활성 탭이 아님 → 차단
        forceLogout('이미 다른 탭/창에서 로그인 중입니다. 한 기기에 한 탭만 사용할 수 있습니다.')
        return
      }
    }

    // ── 다른 탭이 로그인하면 storage 이벤트로 감지 → 이 탭 킥 ──
    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'activeTabId') return
      if (!isProtected(window.location.pathname)) return
      if (isAdmin()) return
      const myTabId = getMyTabId()
      if (e.newValue && e.newValue !== myTabId) {
        forceLogout('다른 탭에서 로그인하여 이 탭은 자동 로그아웃됩니다.')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <>{children}</>
}
