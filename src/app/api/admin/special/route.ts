import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

/**
 * 특강 관리 통합 API (관리자 전용 — service_role 만 접근)
 *
 * GET ?action=lectures              → 특강 목록 + 신청 수
 * GET ?action=registrations&courseId → 특강별 신청 내역 + 사용자 정보
 * GET ?action=staff                 → 사원 명단(staff_roster)
 * GET ?action=users                 → 수강권 부여 대상 사용자 목록
 * GET ?action=entitlements&userId   → 특정 사용자 수강권
 *
 * POST { action:'createLecture', name, instructor, description }
 * POST { action:'grantEntitlement', userId, kind, amount }
 * POST { action:'approveRegistration', registrationId }
 * POST { action:'addStaff', employeeNo, name }
 * POST { action:'deleteStaff', staffId }
 * POST { action:'deleteLecture', courseId }
 */

export async function GET(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ error: 'no-db' }, { status: 503 })

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (action === 'lectures') {
    const { data, error } = await db
      .from('courses')
      .select('id, name, instructor, description, created_at')
      .eq('type', 'special')
      .order('created_at', { ascending: false })
    if (error && (error.code === '42703' || (error.message || '').includes('type'))) {
      return Response.json({ lectures: [] })
    }
    if (error) return Response.json({ error: error.message }, { status: 500 })

    // 신청 수 집계
    const ids = (data || []).map((l: any) => l.id)
    let regCounts: Record<string, number> = {}
    if (ids.length > 0) {
      const { data: regs } = await db
        .from('special_registrations')
        .select('course_id')
        .in('course_id', ids)
      ;(regs || []).forEach((r: any) => {
        regCounts[r.course_id] = (regCounts[r.course_id] || 0) + 1
      })
    }

    const lectures = (data || []).map((l: any) => ({
      ...l,
      description: l.description || '',
      registrationCount: regCounts[l.id] || 0,
    }))
    return Response.json({ lectures })
  }

  if (action === 'registrations') {
    const courseId = searchParams.get('courseId')
    let q = db
      .from('special_registrations')
      .select('*')
      .order('created_at', { ascending: true })
    if (courseId) q = q.eq('course_id', courseId)

    const { data: regs, error } = await q
    if (error) return Response.json({ error: error.message }, { status: 500 })

    // 사용자 이름 조인
    const userIds = [...new Set((regs || []).map((r: any) => r.user_id))]
    let userMap: Record<string, any> = {}
    if (userIds.length > 0) {
      const { data: users } = await db
        .from('app_users')
        .select('id, name, email, employee_no, member_type')
        .in('id', userIds as string[])
      ;(users || []).forEach((u: any) => (userMap[u.id] = u))
    }

    const registrations = (regs || []).map((r: any) => ({
      ...r,
      userName: userMap[r.user_id]?.name || r.user_id,
      userEmail: userMap[r.user_id]?.email || '',
      employeeNo: userMap[r.user_id]?.employee_no || '',
    }))
    return Response.json({ registrations })
  }

  if (action === 'staff') {
    const { data, error } = await db
      .from('staff_roster')
      .select('id, employee_no, name, used, created_at')
      .order('created_at', { ascending: false })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ staff: data || [] })
  }

  if (action === 'users') {
    const { data, error } = await db
      .from('app_users')
      .select('id, name, email, employee_no, member_type')
      .order('created_at', { ascending: true })
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ users: data || [] })
  }

  if (action === 'entitlements') {
    const userId = searchParams.get('userId')
    if (!userId) return Response.json({ entitlements: [] })
    const { data } = await db
      .from('entitlements')
      .select('id, kind, total, used, created_at')
      .eq('user_id', userId)
    return Response.json({ entitlements: data || [] })
  }

  return Response.json({ error: 'action 필요' }, { status: 400 })
}

export async function POST(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ error: 'no-db' }, { status: 503 })

  let b: any
  try {
    b = await req.json()
  } catch {
    return Response.json({ error: '잘못된 요청' }, { status: 400 })
  }

  const { action } = b

  if (action === 'createLecture') {
    const { name, instructor, description } = b
    if (!name || !instructor) return Response.json({ error: 'name, instructor 필수' }, { status: 400 })
    const id = Math.random().toString(36).slice(2, 11)
    const row: any = { id, name, instructor, type: 'special' }
    if (description) row.description = description

    let { error } = await db.from('courses').insert(row)
    if (error && (error.code === '42703' || (error.message || '').includes('description'))) {
      delete row.description
      ;({ error } = await db.from('courses').insert(row))
    }
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, id })
  }

  if (action === 'grantEntitlement') {
    const { userId, kind, amount } = b
    if (!userId || !kind || !amount) return Response.json({ error: 'userId, kind, amount 필수' }, { status: 400 })

    // upsert: 있으면 total 증가, 없으면 새로 생성
    const { data: existing } = await db
      .from('entitlements')
      .select('id, total')
      .eq('user_id', userId)
      .eq('kind', kind)
      .maybeSingle()

    if (existing) {
      const { error } = await db
        .from('entitlements')
        .update({ total: existing.total + Number(amount) })
        .eq('id', existing.id)
      if (error) return Response.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await db
        .from('entitlements')
        .insert({ user_id: userId, kind, total: Number(amount), used: 0 })
      if (error) return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json({ ok: true })
  }

  if (action === 'approveRegistration') {
    const { registrationId } = b
    if (!registrationId) return Response.json({ error: 'registrationId 필수' }, { status: 400 })
    const { error } = await db
      .from('special_registrations')
      .update({ status: 'approved', paid: true })
      .eq('id', registrationId)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  if (action === 'addStaff') {
    const { employeeNo, name } = b
    if (!employeeNo || !name) return Response.json({ error: 'employeeNo, name 필수' }, { status: 400 })
    const { error } = await db.from('staff_roster').insert({ employee_no: employeeNo, name })
    if (error) {
      if ((error as any).code === '23505') return Response.json({ error: '이미 등록된 사원번호입니다' }, { status: 409 })
      return Response.json({ error: error.message }, { status: 500 })
    }
    return Response.json({ ok: true })
  }

  if (action === 'deleteStaff') {
    const { staffId } = b
    if (!staffId) return Response.json({ error: 'staffId 필수' }, { status: 400 })
    const { error } = await db.from('staff_roster').delete().eq('id', staffId)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  if (action === 'deleteLecture') {
    const { courseId } = b
    if (!courseId) return Response.json({ error: 'courseId 필수' }, { status: 400 })
    const { error } = await db.from('courses').delete().eq('id', courseId)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  return Response.json({ error: '알 수 없는 action' }, { status: 400 })
}
