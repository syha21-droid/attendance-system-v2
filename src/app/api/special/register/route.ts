import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// POST /api/special/register
// 내부(official): 수강권 차감 → approved
// 외부(external): pending (관리자 승인 필요)
export async function POST(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ error: 'no-db' }, { status: 503 })

  let b: any
  try {
    b = await req.json()
  } catch {
    return Response.json({ error: '잘못된 요청' }, { status: 400 })
  }

  const { courseId, userId, memberType } = b
  if (!courseId || !userId) return Response.json({ error: 'courseId, userId 필수' }, { status: 400 })

  // 중복 신청
  const { data: existing } = await db
    .from('special_registrations')
    .select('id, status')
    .eq('course_id', courseId)
    .eq('user_id', userId)
    .maybeSingle()
  if (existing) return Response.json({ error: '이미 신청한 특강입니다', existing }, { status: 409 })

  const row: any = {
    course_id: courseId,
    user_id: userId,
    member_type: memberType || 'official',
    status: 'pending',
    paid: false,
  }

  // 외부 회원: 바로 pending (관리자 승인 대기)
  if (memberType === 'external') {
    const { data, error } = await db.from('special_registrations').insert(row).select().single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, registration: data, message: '신청 완료! 관리자 승인 후 참여 가능합니다.' })
  }

  // 내부 회원: 수강권 확인 & 원자적 차감
  const kind = b.entitlementKind || 'saturday_special'
  const { data: ent } = await db
    .from('entitlements')
    .select('id, total, used')
    .eq('user_id', userId)
    .eq('kind', kind)
    .maybeSingle()

  if (!ent || ent.used >= ent.total) {
    return Response.json({ error: '사용 가능한 수강권이 없습니다', noEntitlement: true }, { status: 403 })
  }

  const { data: deducted } = await db.rpc('use_entitlement', { p_user_id: userId, p_kind: kind })
  if (!deducted) return Response.json({ error: '수강권 차감 실패 (동시 요청 충돌)' }, { status: 500 })

  row.status = 'approved'
  row.entitlement_id = ent.id

  const { data: reg, error: regErr } = await db.from('special_registrations').insert(row).select().single()
  if (regErr) return Response.json({ error: regErr.message }, { status: 500 })

  return Response.json({ ok: true, registration: reg, message: '✅ 특강 신청 완료!' })
}
