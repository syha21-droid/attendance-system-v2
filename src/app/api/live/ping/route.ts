import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { distanceMeters } from '@/lib/rotatingCode'

export const dynamic = 'force-dynamic'

// entry_lat/lng·exit_lat/lng 컬럼 마이그레이션 전이면 좌표 없이도 동작하게 판별
function isMissingLocColumn(error: any): boolean {
  const msg = (error?.message || '').toLowerCase()
  return (
    error?.code === '42703' ||
    error?.code === 'PGRST204' ||
    msg.includes('entry_lat') ||
    msg.includes('entry_lng') ||
    msg.includes('exit_lat') ||
    msg.includes('exit_lng')
  )
}

/**
 * 위치 핑 — 출석/퇴장 두 시점에만 위치 확인 (연속추적 없음 → 중간에 창 꺼도 됨)
 *  probe    : 현재 위치(현장 안/밖) + 내 출석 기록 상태 조회 (새로고침/재접속 시 화면 복원)
 *  checkin  : 현장 안일 때만 출석 시작 (출석 위치 기록)
 *  checkout : 수업 종료 후 현장 안일 때만 퇴장 (퇴장 위치 기록 → 출석 인정)
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

  // 기존 기록 (probe 포함 항상 조회 → 창을 닫았다 다시 들어와도 상태/위치 복원)
  const { data: rec } = await db
    .from('attendance_records')
    .select('*')
    .eq('session_id', sessionId)
    .eq('user_id', String(userId))
    .maybeSingle()

  // 기록에 저장된 출석/퇴장 좌표를 응답에 실어 화면 복원에 사용
  const recCoords = rec
    ? {
        myLat: typeof rec.entry_lat === 'number' ? rec.entry_lat : undefined,
        myLng: typeof rec.entry_lng === 'number' ? rec.entry_lng : undefined,
        exitLat: typeof rec.exit_lat === 'number' ? rec.exit_lat : undefined,
        exitLng: typeof rec.exit_lng === 'number' ? rec.exit_lng : undefined,
      }
    : {}

  // ---- probe: 현재 위치 + 내 기록 상태 ----
  if (action === 'probe') {
    return Response.json({ ok: true, ...base, recordStatus: rec?.status ?? null, ...recCoords })
  }

  // ---- checkin: 현장에서만 출석 시작 (출석 위치 기록) ----
  if (action === 'checkin') {
    if (ended) return Response.json({ ok: false, ...base, error: '⏰ 이미 종료된 출석입니다' })
    if (!hasLoc) return Response.json({ ok: false, ...base, error: '📍 위치 권한을 허용하세요' })
    if (!inRange) {
      return Response.json({ ok: false, ...base, error: `📍 현장에서만 출석할 수 있습니다 (약 ${distance}m, 허용 ${session.radius_m}m)` })
    }
    if (!rec) {
      const insertRow: any = {
        session_id: sessionId,
        user_id: String(userId),
        user_name: userName ? String(userName) : null,
        device_id: deviceId ? String(deviceId) : null,
        entry_at: nowIso,
        last_seen_at: nowIso,
        entry_distance_m: distance,
        entry_lat: lat,
        entry_lng: lng,
        status: 'present',
      }
      let { error } = await db.from('attendance_records').insert(insertRow)
      if (error && isMissingLocColumn(error)) {
        // 좌표 컬럼이 아직 없으면(마이그레이션 전) 좌표 없이라도 출석은 되게
        delete insertRow.entry_lat
        delete insertRow.entry_lng
        ;({ error } = await db.from('attendance_records').insert(insertRow))
      }
      if (error && (error as any).code !== '23505') {
        return Response.json({ ok: false, error: error.message }, { status: 500 })
      }
    } else {
      const updateRow: any = { last_seen_at: nowIso, status: 'present', exit_at: null, entry_lat: lat, entry_lng: lng }
      let { error } = await db.from('attendance_records').update(updateRow).eq('id', rec.id)
      if (error && isMissingLocColumn(error)) {
        delete updateRow.entry_lat
        delete updateRow.entry_lng
        await db.from('attendance_records').update(updateRow).eq('id', rec.id)
      }
    }
    return Response.json({ ok: true, ...base, status: 'present', myLat: lat, myLng: lng })
  }

  // ---- checkout: 수업 종료 후 현장에서만 퇴장 → 출석 인정 (퇴장 위치 기록) ----
  if (action === 'checkout') {
    if (!rec) return Response.json({ ok: false, ...base, error: '출석 기록이 없습니다' })
    if (!ended) {
      return Response.json({ ok: false, ...base, error: '🔒 수업이 종료되어야 퇴장할 수 있습니다' })
    }
    if (!hasLoc) return Response.json({ ok: false, ...base, error: '📍 위치 권한을 허용하세요' })
    if (!inRange) {
      return Response.json({ ok: false, ...base, error: `📍 현장에서만 퇴장할 수 있습니다 (약 ${distance}m, 허용 ${session.radius_m}m)` })
    }
    const updateRow: any = { status: 'completed', exit_at: nowIso, exit_lat: lat, exit_lng: lng }
    let { error } = await db.from('attendance_records').update(updateRow).eq('id', rec.id)
    if (error && isMissingLocColumn(error)) {
      delete updateRow.exit_lat
      delete updateRow.exit_lng
      await db.from('attendance_records').update(updateRow).eq('id', rec.id)
    }
    return Response.json({
      ok: true,
      ...base,
      status: 'completed',
      myLat: typeof rec.entry_lat === 'number' ? rec.entry_lat : undefined,
      myLng: typeof rec.entry_lng === 'number' ? rec.entry_lng : undefined,
      exitLat: lat,
      exitLng: lng,
    })
  }

  return Response.json({ ok: false, error: '알 수 없는 action' }, { status: 400 })
}
