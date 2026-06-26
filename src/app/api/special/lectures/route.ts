import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/special/lectures?userId=xxx
// 특강 목록 + 내 신청 현황
export async function GET(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ error: 'no-db' }, { status: 503 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')

  const { data: lectures, error } = await db
    .from('courses')
    .select('id, name, instructor, description, created_at, type')
    .eq('type', 'special')
    .order('created_at', { ascending: false })

  if (error) {
    // type 컬럼 없으면(마이그레이션 전) 빈 배열
    if (error.code === '42703' || (error.message || '').includes('type')) {
      return Response.json({ lectures: [] })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  let myRegistrations: any[] = []
  if (userId) {
    const { data } = await db
      .from('special_registrations')
      .select('*')
      .eq('user_id', userId)
    myRegistrations = data || []
  }

  const result = (lectures || []).map((l: any) => {
    const myReg = myRegistrations.find((r: any) => r.course_id === l.id) || null
    return {
      id: l.id,
      name: l.name,
      instructor: l.instructor,
      description: l.description || '',
      createdAt: l.created_at,
      myRegistration: myReg,
    }
  })

  return Response.json({ lectures: result })
}
