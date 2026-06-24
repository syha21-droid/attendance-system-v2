/**
 * 신뢰할 수 있는 시간 (Trusted Time)
 *
 * 보안 핵심: 학생이 기기(PC/휴대폰) 시계를 빨리 돌려서 수업이 끝난 것처럼
 * 위장하고 일찍 퇴장하는 것을 막기 위해, 로컬 new Date() 대신
 * 외부 서버의 시간을 신뢰 기준으로 사용한다.
 *
 * 동작:
 * 1. 서버(Supabase)의 HTTP Date 헤더에서 서버 UTC 시각을 읽는다.
 * 2. (서버시각 - 로컬시각)을 offset 으로 계산해 저장한다.
 * 3. 이후 getTrustedNow() = 로컬시각 + offset 으로 신뢰 시각을 만든다.
 *    → 로컬 시계를 조작해도 offset 이 같이 보정되므로 효과가 없다.
 *
 * 네트워크가 안 되면 isTrusted=false 로 로컬 시간으로 폴백한다.
 */

let timeOffsetMs = 0
let synced = false
let lastSyncAt = 0

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

// 서버 시간을 가져올 수 있는 후보들 (앞에서부터 시도)
const TIME_SOURCES: string[] = [
  ...(SUPABASE_URL ? [`${SUPABASE_URL}/rest/v1/`] : []),
  'https://www.google.com/generate_204',
  'https://cloudflare.com/cdn-cgi/trace',
]

/**
 * 서버 시간과 동기화. 페이지 진입 시 + 주기적으로 호출.
 * @param force true 면 캐시 무시하고 다시 동기화
 */
export async function syncTrustedTime(force = false): Promise<boolean> {
  // 30초 이내 재호출이면 스킵 (force 제외)
  if (!force && synced && Date.now() - lastSyncAt < 30_000) {
    return synced
  }

  for (const url of TIME_SOURCES) {
    try {
      const before = Date.now()
      const res = await fetch(url, {
        method: 'HEAD',
        cache: 'no-store',
        mode: 'cors',
      }).catch(() =>
        // HEAD/CORS 가 막히면 GET no-cors 로 재시도 (헤더는 못 읽지만 일부 환경 대비)
        fetch(url, { method: 'GET', cache: 'no-store' })
      )

      const dateHeader = res?.headers?.get('date')
      if (!dateHeader) continue

      const serverMs = new Date(dateHeader).getTime()
      if (isNaN(serverMs)) continue

      const after = Date.now()
      // 왕복 지연의 절반을 보정 (네트워크 지연 추정)
      const localMid = before + (after - before) / 2
      timeOffsetMs = serverMs - localMid
      synced = true
      lastSyncAt = Date.now()
      return true
    } catch {
      // 다음 소스 시도
      continue
    }
  }

  // 모든 소스 실패 → 로컬 시간 폴백
  return synced
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
