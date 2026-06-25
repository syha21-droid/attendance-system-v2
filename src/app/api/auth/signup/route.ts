import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// 회원가입 (서버 계정). no-db면 클라이언트가 localStorage 폴백
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

  const { data: exist } = await db.from('app_users').select('id').eq('email', email).maybeSingle()
  if (exist) return Response.json({ error: '이미 가입된 이메일입니다' }, { status: 409 })

  const { error } = await db.from('app_users').insert({
    id,
    email,
    password: String(b.password),
    name: String(b.name),
    is_admin: !!b.isAdmin,
  })
  if (error) {
    if ((error as any).code === '23505') return Response.json({ error: '이미 가입된 이메일입니다' }, { status: 409 })
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ user: { id, email, name: String(b.name), isAdmin: !!b.isAdmin } })
}
