import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

function isMissingColumn(e: any): boolean {
  const m = (e?.message || '').toLowerCase()
  return e?.code === '42703' || e?.code === 'PGRST204' || m.includes('member_type') || m.includes('employee_no')
}

// 회원가입 (서버 계정). 사원번호(employeeNo) 제공 시 staff_roster 검증 후 official 가입.
export async function POST(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ error: 'no-db', nodb: true }, { status: 503 })

  let b: any
  try {
    b = await req.json()
  } catch {
    return Response.json({ error: '잘못된 요청' }, { status: 400 })
  }
  if (!b.email || !b.password || !b.name) {
    return Response.json({ error: '모든 필드를 입력하세요' }, { status: 400 })
  }

  const email = String(b.email).trim().toLowerCase()
  const id = b.id ? String(b.id) : Math.random().toString(36).slice(2, 11)
  const employeeNo = b.employeeNo ? String(b.employeeNo).trim() : null

  // 이메일 중복
  const { data: exist } = await db.from('app_users').select('id').eq('email', email).maybeSingle()
  if (exist) return Response.json({ error: '이미 가입된 이메일입니다' }, { status: 409 })

  // 사원번호 검증 (제공된 경우)
  let rosterId: string | null = null
  if (employeeNo) {
    const { data: roster } = await db
      .from('staff_roster')
      .select('id, used')
      .eq('employee_no', employeeNo)
      .maybeSingle()
    if (!roster) return Response.json({ error: '등록된 사원번호가 아닙니다' }, { status: 400 })
    if (roster.used) return Response.json({ error: '이미 사용된 사원번호입니다' }, { status: 409 })
    rosterId = roster.id
  }

  const row: any = {
    id,
    email,
    password: String(b.password),
    name: String(b.name),
    is_admin: !!b.isAdmin,
  }
  if (employeeNo) {
    row.employee_no = employeeNo
    row.member_type = 'official'
  }

  let { error } = await db.from('app_users').insert(row)
  // member_type/employee_no 컬럼이 없으면(마이그레이션 전) 빼고 재시도
  if (error && isMissingColumn(error)) {
    delete row.member_type
    delete row.employee_no
    ;({ error } = await db.from('app_users').insert(row))
  }
  if (error) {
    if ((error as any).code === '23505') return Response.json({ error: '이미 가입된 이메일입니다' }, { status: 409 })
    return Response.json({ error: error.message }, { status: 500 })
  }

  // 사원번호 사용 처리
  if (rosterId) {
    await db.from('staff_roster').update({ used: true }).eq('id', rosterId)
  }

  return Response.json({
    user: {
      id,
      email,
      name: String(b.name),
      isAdmin: !!b.isAdmin,
      memberType: employeeNo ? 'official' : undefined,
      employeeNo: employeeNo || undefined,
    },
  })
}
