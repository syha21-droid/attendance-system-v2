import crypto from 'crypto'

/**
 * 회전 코드 (TOTP 방식) — 15초마다 갱신
 *
 * 운영자 화면과 서버가 같은 비밀키(secret)를 공유한다.
 * 코드 = HMAC-SHA256(secret, 현재 15초 슬롯) 에서 6자리 추출.
 * 서버가 동일하게 계산해 대조하므로, 화면을 캡처해 원격에 보내도
 * 15초 후 만료된다. 비밀키는 서버에만 있고 클라이언트로 절대 안 나간다.
 */

export const SLOT_MS = 15000

export function currentSlot(now: number = Date.now()): number {
  return Math.floor(now / SLOT_MS)
}

export function codeForSlot(secret: string, slot: number): string {
  const h = crypto.createHmac('sha256', secret).update(String(slot)).digest()
  const offset = h[h.length - 1] & 0xf
  const bin =
    ((h[offset] & 0x7f) << 24) |
    (h[offset + 1] << 16) |
    (h[offset + 2] << 8) |
    h[offset + 3]
  return String(bin % 1000000).padStart(6, '0')
}

export function currentCode(secret: string, now: number = Date.now()): string {
  return codeForSlot(secret, currentSlot(now))
}

/** 현재 슬롯 ±1 까지 허용 (네트워크 지연 대비, 최대 약 30초) */
export function verifyCode(secret: string, code: string, now: number = Date.now()): boolean {
  const slot = currentSlot(now)
  return code === codeForSlot(secret, slot) || code === codeForSlot(secret, slot - 1)
}

/** 다음 갱신까지 남은 ms */
export function msUntilNextSlot(now: number = Date.now()): number {
  return SLOT_MS - (now % SLOT_MS)
}

/** 두 좌표 사이 거리(m) — 하버사인 */
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)))
}
