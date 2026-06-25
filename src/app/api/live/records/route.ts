import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const GRACE_MS = 3 * 60000

// 운영자/관리자: 출석자 목록 + 최종 인정 판정
export async function GET(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ error: 'Supabase 설정 필요' }, { status: 503 })

  const sessionId = new URL(req.url).searchParams.get('session')
  if (!sessionId) return Response.json({ error: 'session 필수' }, { status: 400 })

  const { data: session } = await db
    .from('attendance_sessions')
    .select('ends_at')
    .eq('id', sessionId)
    .single()

  const { data, error } = await db
    .from('attendance_records')
    .select('user_name, user_id, status, entry_at, exit_at, last_seen_at, entry_distance_m')
    .eq('session_id', sessionId)
    .order('entry_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const now = Date.now()
  const endMs = session ? new Date(session.ends_at).getTime() : now
  const ended = now > endMs

  // final: present(현장) | left(이탈) | accepted(인정) | left_early(조퇴/미인정)
  const records = (data || []).map((r: any) => {
    let final = r.status
    if (ended) {
      if (r.status === 'completed') final = 'accepted'
      else if (r.status === 'left_early') final = 'left_early'
      else {
        const lastSeen = new Date(r.last_seen_at).getTime()
        final = lastSeen >= endMs - GRACE_MS && r.status !== 'left' ? 'accepted' : 'left_early'
      }
    }
    return { ...r, final }
  })

  return Response.json({
    records,
    ended,
    count: records.length,
    present: records.filter((r: any) => r.final === 'present').length,
    accepted: records.filter((r: any) => r.final === 'accepted').length,
    leftEarly: records.filter((r: any) => r.final === 'left_early' || r.final === 'left').length,
  })
}
