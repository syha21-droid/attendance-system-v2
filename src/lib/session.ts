const COOKIE_NAME = 'rd_session'
const MAX_AGE = 30 * 24 * 60 * 60 // 30일

export function setSessionCookie(user: object) {
  if (typeof document === 'undefined') return
  const encoded = btoa(encodeURIComponent(JSON.stringify(user)))
  document.cookie = `${COOKIE_NAME}=${encoded}; max-age=${MAX_AGE}; path=/; SameSite=Lax`
}

export function getSessionCookie(): any | null {
  if (typeof document === 'undefined') return null
  const row = document.cookie.split('; ').find((r) => r.startsWith(`${COOKIE_NAME}=`))
  if (!row) return null
  try {
    return JSON.parse(decodeURIComponent(atob(row.split('=')[1])))
  } catch {
    return null
  }
}

export function clearSessionCookie() {
  if (typeof document === 'undefined') return
  document.cookie = `${COOKIE_NAME}=; max-age=0; path=/; SameSite=Lax`
}
