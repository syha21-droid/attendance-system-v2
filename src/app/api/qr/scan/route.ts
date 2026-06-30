import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { distanceMeters } from '@/lib/rotatingCode'

export const dynamic = 'force-dynamic'

const SETUP_MSG =
  'Supabase 설정이 필요합니다. (SUPABASE_SERVICE_ROLE_KEY 환경변수 + schema.sql 실행)'

// 학생 QR이 만료로 거부되는 유효 시간 (오래된 화면 캡처 재사용 방지)
const FRESH_MS = 10 * 60 * 1000

// QR 안에 담긴 학생 페이로드 해독
// 형식: "RDQR1:" + base64url(JSON.stringify({ uid, name, lat, lng, ts }))
function parsePayload(token: string): any | null {
  try {
    let s = String(token).trim()
    if (s.startsWith('RDQR1:')) s = s.slice(6)
    s = s.replace(/-/g, '+').replace(/_/g, '/')
    while (s.length % 4) s += '='
    const json = Buffer.from(s, 'base64').toString('utf-8')
    const obj = JSON.parse(json)
    if (!obj || typeof obj !== 'object') return null
    return obj
  } catch {
    return null
  }
}

// 관리자 스캐너가 학생 QR을 읽어서 호출 → 위치 검증 후 출석 기록
export async function POST(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ ok: false, error: SETUP_MSG }, { status: 503 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: '잘못된 요청' }, { status: 400 })
  }

  const { sessionId, token } = body
  if (!sessionId || !token) {
    return Response.json({ ok: false, error: 'sessionId, token 필수' }, { status: 400 })
  }

  const payload = parsePayload(token)
  if (!payload || !payload.uid) {
    return Response.json({
      ok: false,
      reason: 'invalid',
      error: '학생 출석 QR이 아닙니다',
    })
  }

  // QR 신선도 검증 (학생 페이지가 서버 보정 시각을 ts에 담음)
  const ts = Number(payload.ts)
  if (Number.isFinite(ts) && Date.now() - ts > FRESH_MS) {
    return Response.json({
      ok: false,
      reason: 'expired',
      userName: payload.name || payload.uid,
      error: 'QR이 만료됐습니다. 학생에게 화면을 새로고침하게 하세요.',
    })
  }

  // 세션(현장 위치/반경) 로드
  const { data: session, error: sErr } = await db
    .from('attendance_sessions')
    .select('venue_lat, venue_lng, radius_m, ends_at, name')
    .eq('id', sessionId)
    .single()
  if (sErr || !session) {
    return Response.json({ ok: false, reason: 'no_session', error: '세션을 찾을 수 없습니다' })
  }

  // 학생 위치 → 현장과의 거리 계산 (위치추적)
  let distance: number | null = null
  let inRange: boolean | null = null
  const lat = Number(payload.lat)
  const lng = Number(payload.lng)
  const hasLoc = Number.isFinite(lat) && Number.isFinite(lng)
  // 반경 0 = C안(위치 미사용) → 거리 검증 건너뜀
  const venueOn = (session.radius_m || 0) > 0 && session.venue_lat != null && session.venue_lng != null
  if (hasLoc && venueOn) {
    distance = distanceMeters(session.venue_lat, session.venue_lng, lat, lng)
    inRange = distance <= (session.radius_m || 200)
  }

  const userId = String(payload.uid)
  const userName = payload.name ? String(payload.name) : userId
  const now = new Date().toISOString()

  // 이미 인식된 학생인지 확인
  const { data: existing } = await db
    .from('attendance_records')
    .select('id, entry_at')
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()

  const fullRow: any = {
    session_id: sessionId,
    user_id: userId,
    user_name: userName,
    last_seen_at: now,
    entry_lat: hasLoc ? lat : null,
    entry_lng: hasLoc ? lng : null,
    entry_distance_m: distance,
    status: 'present',
  }
  // 좌표 컬럼이 없는 구버전 DB 폴백용
  const basicRow: any = {
    session_id: sessionId,
    user_id: userId,
    user_name: userName,
    last_seen_at: now,
    entry_distance_m: distance,
    status: 'present',
  }

  const writeError = async (row: any): Promise<string | null> => {
    if (existing) {
      const { error } = await db.from('attendance_records').update(row).eq('id', existing.id)
      return error?.message || null
    }
    const { error } = await db.from('attendance_records').insert({ ...row, entry_at: now })
    return error?.message || null
  }

  let err = await writeError(fullRow)
  if (err && /column|entry_lat|entry_lng/i.test(err)) {
    err = await writeError(basicRow)
  }
  if (err) return Response.json({ ok: false, error: err }, { status: 500 })

  return Response.json({
    ok: true,
    alreadyScanned: !!existing,
    userId,
    userName,
    distance,
    inRange,
    hasLocation: hasLoc,
    radius: session.radius_m,
  })
}
