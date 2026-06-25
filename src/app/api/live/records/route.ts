import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// 운영자/관리자: 이 세션의 출석자 목록 (실시간 폴링)
export async function GET(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ error: 'Supabase 설정 필요' }, { status: 503 })

  const sessionId = new URL(req.url).searchParams.get('session')
  if (!sessionId) return Response.json({ error: 'session 필수' }, { status: 400 })

  const { data, error } = await db
    .from('attendance_records')
    .select('user_name, user_id, distance_m, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ records: data, count: data?.length || 0 })
}
