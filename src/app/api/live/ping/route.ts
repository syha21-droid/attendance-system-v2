import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { distanceMeters } from '@/lib/rotatingCode'

export const dynamic = 'force-dynamic'

/**
 * 위치 핑 — 입장/현장유지/퇴장을 위치(GPS)만으로 자동 처리
 * 학생 페이지가 처음 열릴 때 + 주기적으로(약 1분) 호출한다.
 *
 * - 반경 안 + 기록 없음   → 입장 (entry_at 기록)
 * - 반경 안 + 기록 있음   → 현장 유지 (last_seen 갱신, 재입장 시 status 복구)
 * - 반경 밖 + 현장이었음   → 퇴장 (exit_at 기록)
 * - 반경 밖 + 기록 없음    → 거부 (현장에서 너무 멈)
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

  const { sessionId, lat, lng, userId, userName, deviceId } = body
  if (!sessionId || !userId) {
    return Response.json({ ok: false, error: '필수 정보 누락' }, { status: 400 })
  }
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return Response.json({ ok: false, error: '📍 위치 정보가 필요합니다. 위치 권한을 허용하세요.' }, { status: 422 })
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

  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const ended = now > new Date(session.ends_at).getTime()

  const distance = distanceMeters(session.venue_lat, session.venue_lng, lat, lng)
  const inRadius = distance <= session.radius_m

  // 기존 기록 확인
  const { data: rec } = await db
    .from('attendance_records')
    .select('*')
    .eq('session_id', sessionId)
    .eq('user_id', String(userId))
    .maybeSingle()

  // 세션 종료됨
  if (ended) {
    return Response.json({ ok: false, status: 'ended', error: '⏰ 종료된 출석입니다', distance })
  }

  if (!rec) {
    // 기록 없음
    if (!inRadius) {
      return Response.json({
        ok: false,
        status: 'too_far',
        distance,
        radius: session.radius_m,
        error: `📍 현장에서 너무 멉니다 (약 ${distance}m, 허용 ${session.radius_m}m)`,
      })
    }
    // 입장
    const { error: insErr } = await db.from('attendance_records').insert({
      session_id: sessionId,
      user_id: String(userId),
      user_name: userName ? String(userName) : null,
      device_id: deviceId ? String(deviceId) : null,
      entry_at: nowIso,
      last_seen_at: nowIso,
      entry_distance_m: distance,
      status: 'present',
    })
    if (insErr) {
      if ((insErr as any).code === '23505') {
        return Response.json({ ok: true, status: 'present', distance })
      }
      return Response.json({ ok: false, error: insErr.message }, { status: 500 })
    }
    return Response.json({ ok: true, status: 'checked_in', distance })
  }

  // 기록 있음
  if (inRadius) {
    // 현장 유지 (재입장 포함)
    await db
      .from('attendance_records')
      .update({ last_seen_at: nowIso, status: 'present', exit_at: null })
      .eq('id', rec.id)
    return Response.json({ ok: true, status: 'present', distance })
  } else {
    // 현장 벗어남 → 퇴장 (이미 퇴장이면 그대로)
    if (rec.status === 'present') {
      await db
        .from('attendance_records')
        .update({ status: 'left', exit_at: nowIso })
        .eq('id', rec.id)
    }
    return Response.json({ ok: true, status: 'left', distance, error: `📍 현장을 벗어나 퇴장 처리됨 (${distance}m)` })
  }
}
