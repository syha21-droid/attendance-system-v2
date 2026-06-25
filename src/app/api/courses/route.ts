import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// 강의 목록 — courses: null 이면 클라이언트가 localStorage 폴백 사용
export async function GET() {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ courses: null })
  const { data, error } = await db.from('courses').select('*').order('created_at', { ascending: true })
  if (error) return Response.json({ courses: null })
  const courses = (data || []).map((c: any) => ({
    id: c.id,
    name: c.name,
    instructor: c.instructor,
    courseType: c.course_type || 'session',
    episodeCount: c.episode_count ?? undefined,
    createdAt: c.created_at,
  }))
  return Response.json({ courses })
}

// 강의 생성 (관리자)
export async function POST(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ error: 'no-db' }, { status: 503 })
  let b: any
  try {
    b = await req.json()
  } catch {
    return Response.json({ error: '잘못된 요청' }, { status: 400 })
  }
  if (!b.id || !b.name || !b.instructor) return Response.json({ error: '필수값 누락' }, { status: 400 })
  const { error } = await db.from('courses').upsert(
    {
      id: String(b.id),
      name: String(b.name),
      instructor: String(b.instructor),
      course_type: b.courseType === 'episode' ? 'episode' : 'session',
      episode_count: b.courseType === 'episode' ? Number(b.episodeCount) || 1 : null,
    },
    { onConflict: 'id' }
  )
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

// 강의 삭제 (관리자)
export async function DELETE(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ error: 'no-db' }, { status: 503 })
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'id 필요' }, { status: 400 })
  const { error } = await db.from('courses').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
