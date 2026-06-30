/**
 * 접속(로그인) 기록.
 * - 서버(login_history)에 저장 → 관리자가 기기 상관없이 전체(학생 포함) 조회
 * - localStorage 에도 남겨 오프라인/서버 미설정 시 폴백
 */
export async function recordLogin(user: {
  id: string
  name: string
  email: string
  isAdmin?: boolean
}) {
  const device =
    typeof navigator !== 'undefined' && /Mobile|Android|iPhone/i.test(navigator.userAgent)
      ? '모바일'
      : 'PC'

  // 로컬 폴백
  try {
    const history = JSON.parse(localStorage.getItem('login_history') || '[]')
    history.unshift({
      userId: user.id,
      name: user.name,
      email: user.email,
      isAdmin: !!user.isAdmin,
      time: new Date().toISOString(),
      device,
    })
    localStorage.setItem('login_history', JSON.stringify(history.slice(0, 300)))
  } catch {}

  // 서버 (기기 간 공유)
  try {
    await fetch('/api/login-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        name: user.name,
        email: user.email,
        isAdmin: !!user.isAdmin,
        device,
      }),
    })
  } catch {}
}
