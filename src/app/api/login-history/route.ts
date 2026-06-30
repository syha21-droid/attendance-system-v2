import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// 접속(로그인) 기록 — 기기 상관없이 서버에 모아 관리자가 전체 조회
export async function POST(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ ok: false, nodb: true })

  let b: any
  try {
    b = await req.json()
  } catch {
    return Response.json({ ok: false }, { status: 400 })
  }

  const { error } = await db.from('login_history').insert({
    user_id: b.userId ? String(b.userId) : null,
    name: b.name ? String(b.name) : null,
    email: b.email ? String(b.email) : null,
    is_admin: !!b.isAdmin,
    device: b.device ? String(b.device) : null,
  })
  // 테이블이 아직 없거나 오류면 조용히 실패(클라이언트는 localStorage 폴백)
  if (error) return Response.json({ ok: false, error: error.message })
  return Response.json({ ok: true })
}

export async function GET() {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ records: [], nodb: true })

  const { data, error } = await db
    .from('login_history')
    .select('user_id, name, email, is_admin, device, created_at')
    .order('created_at', { ascending: false })
    .limit(300)

  if (error) return Response.json({ records: [], error: error.message })

  const records = (data || []).map((r: any) => ({
    userId: r.user_id,
    name: r.name,
    email: r.email,
    isAdmin: r.is_admin,
    time: r.created_at,
    device: r.device,
  }))
  return Response.json({ records })
}
