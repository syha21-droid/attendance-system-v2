/**
 * 기기당 학생 1명 고정 (대리 출석/계정 돌려쓰기 방지)
 *
 * - 한 기기(브라우저)에 처음 로그인한 학생 계정을 묶어 둔다.
 * - 다른 학생이 같은 기기로 로그인하려 하면 차단한다.
 * - 관리자 계정은 예외(자유 로그인) — 잠긴 기기에 들어가 잠금을 해제할 수 있다.
 *
 * localStorage 기반이라 브라우저 데이터를 지우면 초기화된다(=A안의 기존 모델과 동일).
 * 더 강한 서버 강제(기기↔계정 DB 바인딩)가 필요하면 별도 작업.
 */

const KEY = 'deviceOwner'

export interface DeviceOwner {
  id: string
  name: string
  boundAt: string
}

export function getDeviceOwner(): DeviceOwner | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as DeviceOwner) : null
  } catch {
    return null
  }
}

/** 이 기기를 학생 계정에 묶는다(이미 같은 계정이면 유지). */
export function bindDeviceOwner(user: { id: string; name: string }) {
  if (typeof window === 'undefined') return
  const existing = getDeviceOwner()
  if (existing && existing.id === user.id) return
  localStorage.setItem(
    KEY,
    JSON.stringify({ id: user.id, name: user.name, boundAt: new Date().toISOString() })
  )
}

/** 관리자용: 이 기기의 잠금 해제. */
export function clearDeviceOwner() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(KEY)
}

/**
 * 로그인 허용 여부 판정.
 * - 관리자: 항상 허용(묶지 않음)
 * - 학생: 미잠금이거나 같은 계정이면 허용, 다른 계정이면 차단
 */
export function checkDeviceLogin(user: { id: string; name: string; isAdmin?: boolean }): {
  ok: boolean
  ownerName?: string
} {
  if (user.isAdmin) return { ok: true }
  const owner = getDeviceOwner()
  if (owner && owner.id !== user.id) {
    return { ok: false, ownerName: owner.name }
  }
  return { ok: true }
}
