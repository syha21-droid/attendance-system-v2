import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// 한 강의의 위치 기반 출석 기록 (수강생 명단에 위치 표시용)
export async function GET(req: Request) {
  const db = getSupabaseAdmin()
  // 설정 안 됐으면 빈 결과 (명단은 그대로 동작)
  if (!db) return Response.json({ records: [] })

  const courseId = new URL(req.url).searchParams.get('courseId')
  if (!courseId) return Response.json({ records: [] })

  // 이 강의의 세션들
  const { data: sessions } = await db
    .from('attendance_sessions')
    .select('id, name, venue_lat, venue_lng, ends_at')
    .eq('course_id', courseId)

  if (!sessions || sessions.length === 0) return Response.json({ records: [] })

  const sessMap = new Map(sessions.map((s: any) => [s.id, s]))
  const sessionIds = sessions.map((s: any) => s.id)

  const FULL = 'session_id, user_id, user_name, status, entry_at, exit_at, last_seen_at, entry_distance_m, entry_lat, entry_lng, exit_lat, exit_lng'
  const BASIC = 'session_id, user_id, user_name, status, entry_at, exit_at, last_seen_at, entry_distance_m'
  let records: any[] | null = null
  const full = await db
    .from('attendance_records')
    .select(FULL)
    .in('session_id', sessionIds)
    .order('entry_at', { ascending: false })
  records = full.data
  // 좌표 컬럼 마이그레이션 전이면 기본 컬럼만으로 재시도
  if (full.error) {
    const basic = await db
      .from('attendance_records')
      .select(BASIC)
      .in('session_id', sessionIds)
      .order('entry_at', { ascending: false })
    records = basic.data
  }

  const result = (records || []).map((r: any) => {
    const s: any = sessMap.get(r.session_id)
    const endMs = s ? new Date(s.ends_at).getTime() : 0
    const ended = Date.now() > endMs
    // 인정 = 출석(checkin) + 종료 후 현장 퇴장(checkout) 완료(status=completed)
    let final = r.status
    if (ended) final = r.status === 'completed' ? 'accepted' : 'left_early'
    return {
      userId: r.user_id,
      userName: r.user_name,
      distance: r.entry_distance_m,
      myLat: r.entry_lat,
      myLng: r.entry_lng,
      exitLat: r.exit_lat,
      exitLng: r.exit_lng,
      venueLat: s?.venue_lat,
      venueLng: s?.venue_lng,
      sessionName: s?.name,
      entryAt: r.entry_at,
      exitAt: r.exit_at,
      final,
    }
  })

  return Response.json({ records: result })
}
