/**
 * 계정 1개 = 기기 1대 (서버 강제).
 *
 * - 서버(device_bindings)에서 계정↔기기를 1:1로 묶는다.
 * - 시크릿모드/다른 기기로 로그인 시도해도 서버가 막는다(=다른 deviceId).
 * - 관리자(isAdmin)는 예외 — 여러 기기에서 자유롭게 로그인.
 * - 잠금 해제는 관리자 화면에서 서버 바인딩을 삭제.
 *
 * DB(device_bindings) 미설정 시에는 잠그지 않음(락아웃 방지).
 */

/** 이 기기의 안정적인 식별자 (브라우저 프로필별). 시크릿모드는 새 id가 됨. */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server'
  let id = localStorage.getItem('deviceId')
  if (!id) {
    id =
      (crypto as any)?.randomUUID
        ? crypto.randomUUID()
        : 'd-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem('deviceId', id)
  }
  return id
}

/**
 * 로그인/가입 시 호출. 서버에 계정↔기기 바인딩을 확인·등록한다.
 * 반환 { ok, error }. ok=false면 로그인 차단.
 */
export async function checkAndBindDevice(user: {
  id: string
  name: string
  isAdmin?: boolean
}): Promise<{ ok: boolean; error?: string }> {
  if (user.isAdmin) return { ok: true } // 관리자 예외
  try {
    const res = await fetch('/api/device-bind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        userName: user.name,
        deviceId: getDeviceId(),
        isAdmin: !!user.isAdmin,
      }),
    })
    const d = await res.json()
    if (d.ok) return { ok: true }
    return { ok: false, error: d.error || '이 계정은 다른 기기에서 사용 중입니다.' }
  } catch {
    // 네트워크 오류 시 잠그지 않음(락아웃 방지)
    return { ok: true }
  }
}
