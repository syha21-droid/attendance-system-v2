import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { distanceMeters } from '@/lib/rotatingCode'

export const dynamic = 'force-dynamic'

const GRACE_MS = 3 * 60000 // 종료 3분 전부터 '끝까지 있었음'으로 인정

/**
 * 위치 핑 — 행동(action)별로 처리
 *  probe     : 현장 안/밖만 확인 (기록 안 함) → 출석 버튼 활성화 판단용
 *  checkin   : 현장 안일 때만 출석 시작 (와서 누르기)
 *  heartbeat : 주기적 위치 확인 → 현장 벗어나면 자동 '조퇴(left)' 처리
 *  checkout  : 수업 종료 후에만 정상 퇴장 (완료)
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

  const { action, sessionId, lat, lng, userId, userName, deviceId } = body
  if (!sessionId || !userId) {
    return Response.json({ ok: false, error: '필수 정보 누락' }, { status: 400 })
  }

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
  const endMs = new Date(session.ends_at).getTime()
  const ended = now > endMs

  const hasLoc = typeof lat === 'number' && typeof lng === 'number'
  const distance = hasLoc ? distanceMeters(session.venue_lat, session.venue_lng, lat, lng) : null
  const inRange = distance != null && distance <= session.radius_m

  const base = { ended, endsAt: session.ends_at, distance, radius: session.radius_m, inRange }

  // ---- probe: 위치만 확인 ----
  if (action === 'probe') {
    return Response.json({ ok: true, ...base })
  }

  // 기존 기록
  const { data: rec } = await db
    .from('attendance_records')
    .select('*')
    .eq('session_id', sessionId)
    .eq('user_id', String(userId))
    .maybeSingle()

  // ---- checkin: 현장에서만 출석 시작 ----
  if (action === 'checkin') {
    if (ended) return Response.json({ ok: false, ...base, error: '⏰ 이미 종료된 출석입니다' })
    if (!hasLoc) return Response.json({ ok: false, ...base, error: '📍 위치 권한을 허용하세요' })
    if (!inRange) {
      return Response.json({ ok: false, ...base, error: `📍 현장에서만 출석할 수 있습니다 (약 ${distance}m, 허용 ${session.radius_m}m)` })
    }
    if (!rec) {
      const { error } = await db.from('attendance_records').insert({
        session_id: sessionId,
        user_id: String(userId),
        user_name: userName ? String(userName) : null,
        device_id: deviceId ? String(deviceId) : null,
        entry_at: nowIso,
        last_seen_at: nowIso,
        entry_distance_m: distance,
        status: 'present',
      })
      if (error && (error as any).code !== '23505') {
        return Response.json({ ok: false, error: error.message }, { status: 500 })
      }
    } else {
      await db.from('attendance_records').update({ last_seen_at: nowIso, status: 'present', exit_at: null }).eq('id', rec.id)
    }
    return Response.json({ ok: true, ...base, status: 'present' })
  }

  // ---- heartbeat: 현장 유지/이탈 감지 ----
  if (action === 'heartbeat') {
    if (!rec) return Response.json({ ok: true, ...base, status: 'none' })
    if (inRange) {
      await db.from('attendance_records').update({ last_seen_at: nowIso, status: 'present', exit_at: null }).eq('id', rec.id)
      return Response.json({ ok: true, ...base, status: 'present' })
    } else {
      if (rec.status === 'present') {
        await db.from('attendance_records').update({ status: 'left', exit_at: nowIso }).eq('id', rec.id)
      }
      return Response.json({ ok: true, ...base, status: 'left', error: '⚠️ 현장을 벗어났습니다. 돌아오지 않으면 출석이 인정되지 않습니다.' })
    }
  }

  // ---- checkout: 수업 종료 후에만 정상 퇴장 ----
  if (action === 'checkout') {
    if (!ended) {
      return Response.json({ ok: false, ...base, error: '🔒 수업이 종료되어야 퇴장할 수 있습니다' })
    }
    if (!rec) return Response.json({ ok: false, ...base, error: '출석 기록이 없습니다' })
    // 종료 시점까지 현장에 있었는지로 인정 판정
    const lastSeen = new Date(rec.last_seen_at).getTime()
    const stayed = lastSeen >= endMs - GRACE_MS && rec.status !== 'left'
    await db.from('attendance_records').update({
      status: stayed ? 'completed' : 'left_early',
      exit_at: rec.exit_at || nowIso,
    }).eq('id', rec.id)
    return Response.json({ ok: true, ...base, status: stayed ? 'completed' : 'left_early' })
  }

  return Response.json({ ok: false, error: '알 수 없는 action' }, { status: 400 })
}
