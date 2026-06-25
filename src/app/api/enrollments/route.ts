import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// userId → 수강 강의 id 목록 / courseId → 수강 학생 id 목록 (null이면 localStorage 폴백)
export async function GET(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ courseIds: null, userIds: null })
  const url = new URL(req.url)
  const userId = url.searchParams.get('userId')
  const courseId = url.searchParams.get('courseId')

  if (courseId) {
    const { data, error } = await db.from('enrollments').select('user_id').eq('course_id', courseId)
    if (error) return Response.json({ userIds: null })
    return Response.json({ userIds: (data || []).map((r: any) => r.user_id) })
  }

  if (!userId) return Response.json({ courseIds: [] })
  const { data, error } = await db.from('enrollments').select('course_id').eq('user_id', userId)
  if (error) return Response.json({ courseIds: null })
  return Response.json({ courseIds: (data || []).map((r: any) => r.course_id) })
}

// 수강 신청
export async function POST(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ error: 'no-db' }, { status: 503 })
  let b: any
  try {
    b = await req.json()
  } catch {
    return Response.json({ error: '잘못된 요청' }, { status: 400 })
  }
  if (!b.userId || !b.courseId) return Response.json({ error: '필수값 누락' }, { status: 400 })
  const { error } = await db.from('enrollments').insert({ user_id: String(b.userId), course_id: String(b.courseId) })
  if (error && (error as any).code !== '23505') return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

// 수강 취소
export async function DELETE(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ error: 'no-db' }, { status: 503 })
  const url = new URL(req.url)
  const userId = url.searchParams.get('userId')
  const courseId = url.searchParams.get('courseId')
  if (!userId || !courseId) return Response.json({ error: '필수값 누락' }, { status: 400 })
  const { error } = await db.from('enrollments').delete().eq('user_id', userId).eq('course_id', courseId)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
