import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

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
    .select('user_name, user_id, status, entry_at, exit_at, last_seen_at, entry_distance_m, entry_lat, entry_lng, exit_lat, exit_lng')
    .eq('session_id', sessionId)
    .order('entry_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const now = Date.now()
  const endMs = session ? new Date(session.ends_at).getTime() : now
  const ended = now > endMs

  // final: present(출석·수업중) | accepted(인정) | left_early(퇴장 안 함=미인정)
  // 인정 = 현장에서 출석(checkin) + 수업 종료 후 현장에서 퇴장(checkout) 모두 완료(status=completed)
  const records = (data || []).map((r: any) => {
    let final = r.status
    if (ended) final = r.status === 'completed' ? 'accepted' : 'left_early'
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
