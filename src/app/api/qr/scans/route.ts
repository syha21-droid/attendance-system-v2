import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// 관리자 스캐너의 실시간 인식 목록
export async function GET(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ error: 'Supabase 설정 필요' }, { status: 503 })

  const sessionId = new URL(req.url).searchParams.get('session')
  if (!sessionId) return Response.json({ error: 'session 필수' }, { status: 400 })

  const WITH_META =
    'user_id, user_name, status, entry_at, exit_at, last_seen_at, entry_distance_m, entry_lat, entry_lng, meta'
  const FULL =
    'user_id, user_name, status, entry_at, exit_at, last_seen_at, entry_distance_m, entry_lat, entry_lng'
  const BASIC = 'user_id, user_name, status, entry_at, last_seen_at, entry_distance_m'

  const query = (cols: string) =>
    db
      .from('attendance_records')
      .select(cols)
      .eq('session_id', sessionId)
      .order('entry_at', { ascending: false })

  let res: any = await query(WITH_META)
  if (res.error) res = await query(FULL)
  if (res.error) res = await query(BASIC)

  if (res.error) return Response.json({ error: res.error.message }, { status: 500 })

  const scans = res.data || []
  return Response.json({ scans, count: scans.length })
}
