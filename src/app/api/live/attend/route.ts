import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { verifyCode, distanceMeters } from '@/lib/rotatingCode'

export const dynamic = 'force-dynamic'

/**
 * 출석 제출 — 서버에서 ①②③ 모두 검증 후 INSERT
 * ① 코드 = 현재 시간슬롯 코드?
 * ② 좌표가 현장 반경 안?
 * ③ 이 계정/디바이스 이번 회차 첫 입력?
 * 하나라도 실패 → 거부
 */
export async function POST(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ ok: false, error: 'Supabase 설정 필요' }, { status: 503 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: '잘못된 요청' }, { status: 400 })
  }

  const { sessionId, code, lat, lng, deviceId, userId, userName } = body
  if (!sessionId || !code || !userId) {
    return Response.json({ ok: false, error: '필수 정보 누락' }, { status: 400 })
  }

  // 세션 로드
  const { data: session, error: sErr } = await db
    .from('attendance_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()
  if (sErr || !session) {
    return Response.json({ ok: false, error: '세션을 찾을 수 없습니다' }, { status: 404 })
  }

  // 세션 시간 확인
  const now = Date.now()
  if (now > new Date(session.ends_at).getTime()) {
    return Response.json({ ok: false, error: '⏰ 종료된 출석입니다' }, { status: 410 })
  }

  // ① 회전 코드 검증
  if (!verifyCode(session.secret, String(code), now)) {
    return Response.json({ ok: false, error: '❌ 코드가 틀렸거나 만료되었습니다 (15초마다 갱신)' }, { status: 422 })
  }

  // ② 위치 검증
  let distance: number | null = null
  if (session.require_gps) {
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return Response.json({ ok: false, error: '📍 위치 정보가 필요합니다. 위치 권한을 허용하세요.' }, { status: 422 })
    }
    distance = distanceMeters(session.venue_lat, session.venue_lng, lat, lng)
    if (distance > session.radius_m) {
      return Response.json(
        { ok: false, error: `📍 현장에서 너무 멉니다 (약 ${distance}m, 허용 ${session.radius_m}m)` },
        { status: 422 }
      )
    }
  }

  // ③ 중복 입력 차단 + INSERT (unique 제약으로 원자적 처리)
  const { error: insErr } = await db.from('attendance_records').insert({
    session_id: sessionId,
    user_id: String(userId),
    user_name: userName ? String(userName) : null,
    device_id: deviceId ? String(deviceId) : null,
    lat: typeof lat === 'number' ? lat : null,
    lng: typeof lng === 'number' ? lng : null,
    distance_m: distance,
  })

  if (insErr) {
    // 23505 = unique 위반 (이미 출석함)
    if ((insErr as any).code === '23505') {
      return Response.json({ ok: false, error: '✅ 이미 이번 회차에 출석했습니다' }, { status: 409 })
    }
    return Response.json({ ok: false, error: insErr.message }, { status: 500 })
  }

  return Response.json({
    ok: true,
    distance,
    message: '✅ 출석 완료!',
  })
}
