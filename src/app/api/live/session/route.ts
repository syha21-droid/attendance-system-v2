import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

const SETUP_MSG =
  'Supabase 설정이 필요합니다. (SUPABASE_SERVICE_ROLE_KEY 환경변수 + schema.sql 실행)'

// 위치 기반 라이브 출석 세션 생성 (관리자)
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
  if (typeof venueLat !== 'number' || typeof venueLng !== 'number') {
    return Response.json({ error: '현장 위치(좌표)가 필요합니다' }, { status: 400 })
  }

  const ends = new Date(Date.now() + (Number(durationMin) || 180) * 60000).toISOString()

  const { data, error } = await db
    .from('attendance_sessions')
    .insert({
      course_id: String(courseId),
      name: String(name),
      venue_lat: venueLat,
      venue_lng: venueLng,
      radius_m: Number(radiusM) || 150,
      ends_at: ends,
    })
    .select('id, name, course_id, venue_lat, venue_lng, radius_m, ends_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ session: data })
}

// 진행 중 세션 목록
export async function GET(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ error: SETUP_MSG }, { status: 503 })

  const courseId = new URL(req.url).searchParams.get('courseId')
  let q = db
    .from('attendance_sessions')
    .select('id, name, course_id, venue_lat, venue_lng, radius_m, starts_at, ends_at')
    .gte('ends_at', new Date().toISOString())
    .order('created_at', { ascending: false })
  if (courseId) q = q.eq('course_id', courseId)

  const { data, error } = await q
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ sessions: data })
}
