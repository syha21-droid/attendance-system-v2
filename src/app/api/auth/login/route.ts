import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// 로그인 (서버 계정). user:null 이면 클라이언트가 localStorage 폴백 시도
export async function POST(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ user: null, nodb: true })

  let b: any
  try {
    b = await req.json()
  } catch {
    return Response.json({ error: '잘못된 요청' }, { status: 400 })
  }
  const email = String(b.email || '').trim().toLowerCase()

  const { data } = await db.from('app_users').select('*').eq('email', email).maybeSingle()
  if (!data || data.password !== String(b.password)) {
    return Response.json({ user: null })
  }
  return Response.json({ user: { id: data.id, email: data.email, name: data.name, isAdmin: data.is_admin } })
}
