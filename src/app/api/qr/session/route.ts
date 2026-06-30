import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const SETUP_MSG =
  'Supabase 설정이 필요합니다. (SUPABASE_SERVICE_ROLE_KEY 환경변수 + schema.sql 실행)'

// QR 출석 세션 생성 — 위치(venue)는 선택사항.
// C안(QR만)은 위치 없이, B안은 위치와 함께 사용 가능.
export async function POST(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ error: SETUP_MSG }, { status: 503 })

  let body: any
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: '잘못된 요청' }, { status: 400 })
  }

  const { courseId, name, venueLat, venueLng, radiusM, durationMin } = body
  if (!courseId || !name) {
    return Response.json({ error: 'courseId, name 필수' }, { status: 400 })
  }

  const hasVenue = typeof venueLat === 'number' && typeof venueLng === 'number'
  const ends = new Date(Date.now() + (Number(durationMin) || 360) * 60000).toISOString()

  const { data, error } = await db
    .from('attendance_sessions')
    .insert({
      course_id: String(courseId),
      name: String(name),
      // 위치 미사용(C안)일 때는 0,0 + 반경 0 으로 저장 (위치 검증 안 함)
      venue_lat: hasVenue ? venueLat : 0,
      venue_lng: hasVenue ? venueLng : 0,
      radius_m: hasVenue ? Number(radiusM) || 200 : 0,
      ends_at: ends,
    })
    .select('id, name, course_id, venue_lat, venue_lng, radius_m, ends_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ session: data })
}
