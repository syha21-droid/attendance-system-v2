/**
 * 신뢰할 수 있는 시간 (Trusted Time)
 *
 * 보안 핵심: 학생이 기기(PC/휴대폰) 시계를 빨리 돌려서 수업이 끝난 것처럼
 * 위장하고 일찍 퇴장하는 것을 막기 위해, 로컬 new Date() 대신
 * 우리 서버의 시간을 신뢰 기준으로 사용한다.
 *
 * 동작:
 * 1. 같은 도메인의 /api/time 에서 서버 시각(now)을 받아온다. (CORS 문제 없음)
 * 2. (서버시각 - 로컬시각)을 offset 으로 계산해 저장한다.
 * 3. 이후 getTrustedNow() = 로컬시각 + offset 으로 신뢰 시각을 만든다.
 *    → 로컬 시계를 조작해도 offset 이 같이 보정되므로 효과가 없다.
 *
 * 네트워크가 안 되면 isTrusted=false 로 로컬 시간으로 폴백한다.
 */

let timeOffsetMs = 0
let synced = false
let lastSyncAt = 0

/**
 * 서버 시간과 동기화. 페이지 진입 시 + 주기적으로 호출.
 * @param force true 면 캐시 무시하고 다시 동기화
 */
export async function syncTrustedTime(force = false): Promise<boolean> {
  // 30초 이내 재호출이면 스킵 (force 제외)
  if (!force && synced && Date.now() - lastSyncAt < 30_000) {
    return synced
  }

  try {
    const before = Date.now()
    const res = await fetch('/api/time', { cache: 'no-store' })
    if (!res.ok) return synced

    const data = await res.json()
    const serverMs = data?.now
    if (typeof serverMs !== 'number' || isNaN(serverMs)) return synced

    const after = Date.now()
    // 왕복 지연의 절반을 보정 (네트워크 지연 추정)
    const localMid = before + (after - before) / 2
    timeOffsetMs = serverMs - localMid
    synced = true
    lastSyncAt = Date.now()
    return true
  } catch {
    // 네트워크 실패 → 로컬 시간 폴백
    return synced
  }
}

/** 신뢰 시각(서버 보정된 Date) 반환. 동기화 전이면 로컬 시간. */
export function getTrustedNow(): Date {
  return new Date(Date.now() + timeOffsetMs)
}

/** 서버 시간과 실제로 동기화되었는지 여부 */
export function isTimeTrusted(): boolean {
  return synced
}

/** 로컬 시계와 서버 시계의 차이(초). 양수면 로컬이 빠름(미래로 조작). */
export function getClockSkewSeconds(): number {
  return Math.round(-timeOffsetMs / 1000)
}
