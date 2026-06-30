'use client'

import { clearSessionCookie } from '@/lib/session'

export async function doLogout(userId?: string) {
  // 서버 active_token 삭제 (다른 기기/탭에서 로그인 가능해짐)
  const token = typeof window !== 'undefined' ? localStorage.getItem('sessionToken') : null
  if (userId) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, token }),
      })
    } catch {}
  }
  if (typeof window !== 'undefined') {
    localStorage.removeItem('user')
    localStorage.removeItem('sessionToken')
  }
  clearSessionCookie()
}
