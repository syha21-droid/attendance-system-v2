import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

/**
 * 외부(일반인) 자유가입 — member_type='external'
 * 내부(사원번호) 가입과 "완전히 분리된 별도의 문". 화이트리스트(staff_roster)를
 * 거치지 않는다. 정식 출석/슈퍼루키 집계에는 절대 포함되지 않음(분모 제외).
 */
function isMissingColumn(e: any): boolean {
  const m = (e?.message || '').toLowerCase()
  return e?.code === '42703' || e?.code === 'PGRST204' || m.includes('phone') || m.includes('member_type')
}

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
    return Response.json({ error: '이메일/비밀번호/이름을 입력하세요' }, { status: 400 })
  }

  const email = String(b.email).trim().toLowerCase()
  const id = b.id ? String(b.id) : Math.random().toString(36).slice(2, 11)

  const { data: exist } = await db.from('app_users').select('id').eq('email', email).maybeSingle()
  if (exist) return Response.json({ error: '이미 가입된 이메일입니다' }, { status: 409 })

  const row: any = {
    id,
    email,
    password: String(b.password),
    name: String(b.name),
    is_admin: false,
    member_type: 'external', // ★ 외부 회원 표시 (정식 집계 제외 기준)
  }
  if (b.phone) row.phone = String(b.phone)

  let { error } = await db.from('app_users').insert(row)
  // phone/member_type 컬럼이 아직 없으면(마이그레이션 전) 빼고 재시도 → 가입은 되게
  if (error && isMissingColumn(error)) {
    delete row.phone
    delete row.member_type
    ;({ error } = await db.from('app_users').insert(row))
  }
  if (error) {
    if ((error as any).code === '23505') return Response.json({ error: '이미 가입된 이메일입니다' }, { status: 409 })
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ user: { id, email, name: String(b.name), isAdmin: false, memberType: 'external' } })
}
