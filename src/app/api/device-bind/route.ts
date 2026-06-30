import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// 계정 1개 = 기기 1대 (서버 강제). 관리자는 예외.
// POST: 로그인 시 호출 → 허용/차단 판정 + 바인딩
export async function POST(req: Request) {
  const db = getSupabaseAdmin()
  // DB 없으면 잠그지 않음(락아웃 방지)
  if (!db) return Response.json({ ok: true, nodb: true })

  let b: any
  try {
    b = await req.json()
  } catch {
    return Response.json({ ok: false, error: '잘못된 요청' }, { status: 400 })
  }

  const { userId, userName, deviceId, isAdmin } = b
  if (isAdmin) return Response.json({ ok: true, admin: true }) // 관리자 예외
  if (!userId || !deviceId) {
    return Response.json({ ok: false, error: 'userId, deviceId 필수' }, { status: 400 })
  }

  // 테이블이 없으면(마이그레이션 전) 잠그지 않음
  const probe = await db.from('device_bindings').select('user_id').limit(1)
  if (probe.error) return Response.json({ ok: true, notable: true })

  // 1) 이 계정이 이미 다른 기기에 묶여 있나? (계정 1개 = 기기 1대)
  const { data: mine } = await db
    .from('device_bindings')
    .select('device_id')
    .eq('user_id', String(userId))
    .maybeSingle()
  if (mine && mine.device_id !== String(deviceId)) {
    return Response.json({
      ok: false,
      reason: 'account',
      error: '이 계정은 이미 다른 기기에서 로그인되어 있습니다. 한 계정은 한 기기에서만 사용할 수 있습니다. (관리자에게 기기 해제를 요청하세요)',
    })
  }

  // 2) 이 기기가 이미 다른 계정에 묶여 있나? (기기 1대 = 계정 1개)
  const { data: deviceRows } = await db
    .from('device_bindings')
    .select('user_id, user_name')
    .eq('device_id', String(deviceId))
  const other = (deviceRows || []).find((r: any) => r.user_id !== String(userId))
  if (other) {
    return Response.json({
      ok: false,
      reason: 'device',
      ownerName: other.user_name,
      error: `이 기기는 이미 '${other.user_name}' 계정에 연결되어 있습니다. 다른 계정으로는 로그인할 수 없습니다. (관리자에게 기기 해제를 요청하세요)`,
    })
  }

  // 통과 → 바인딩(upsert)
  const { error } = await db
    .from('device_bindings')
    .upsert(
      { user_id: String(userId), user_name: userName ? String(userName) : null, device_id: String(deviceId), bound_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
  if (error) return Response.json({ ok: true, warn: error.message }) // 바인딩 실패해도 로그인은 허용
  return Response.json({ ok: true })
}

// 관리자용: 바인딩 목록
export async function GET() {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ bindings: [], nodb: true })
  const { data, error } = await db
    .from('device_bindings')
    .select('user_id, user_name, device_id, bound_at')
    .order('bound_at', { ascending: false })
  if (error) return Response.json({ bindings: [], error: error.message })
  return Response.json({ bindings: data || [] })
}

// 관리자용: 해제 (userId 또는 deviceId)
export async function DELETE(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ ok: false, nodb: true })
  const url = new URL(req.url)
  const userId = url.searchParams.get('userId')
  const deviceId = url.searchParams.get('deviceId')
  if (!userId && !deviceId) {
    return Response.json({ ok: false, error: 'userId 또는 deviceId 필수' }, { status: 400 })
  }
  let q = db.from('device_bindings').delete()
  q = userId ? q.eq('user_id', userId) : q.eq('device_id', deviceId as string)
  const { error } = await q
  if (error) return Response.json({ ok: false, error: error.message })
  return Response.json({ ok: true })
}
