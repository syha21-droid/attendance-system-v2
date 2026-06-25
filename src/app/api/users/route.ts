import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// 학생 목록 (관리자용) — students: null 이면 localStorage 폴백
export async function GET(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ students: null })
  const includeAdmin = new URL(req.url).searchParams.get('all') === '1'
  let q = db.from('app_users').select('id, email, name, is_admin, created_at').order('created_at', { ascending: false })
  if (!includeAdmin) q = q.eq('is_admin', false)
  const { data, error } = await q
  if (error) return Response.json({ students: null })
  const students = (data || []).map((u: any) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    isAdmin: u.is_admin,
    createdAt: u.created_at,
  }))
  return Response.json({ students })
}
