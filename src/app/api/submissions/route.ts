import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/submissions?courseId=xxx          → 강의 전체 제출물 (관리자)
// GET /api/submissions?courseId=xxx&userId=  → 내 제출물 (학생)
export async function GET(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ submissions: [] })

  const { searchParams } = new URL(req.url)
  const courseId = searchParams.get('courseId')
  const userId = searchParams.get('userId')

  if (!courseId) return Response.json({ error: 'courseId 필요' }, { status: 400 })

  let q = db
    .from('submissions')
    .select('id, course_id, user_id, user_name, file_name, file_size, submitted_at, grade, comment')
    .eq('course_id', courseId)
    .order('submitted_at', { ascending: false })

  if (userId) q = q.eq('user_id', userId)

  const { data, error } = await q
  if (error) {
    if (error.code === '42P01') return Response.json({ submissions: [] }) // 테이블 없음
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json({ submissions: data || [] })
}

// POST /api/submissions  (multipart/form-data)
// fields: file, courseId, userId, userName
export async function POST(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ error: 'no-db' }, { status: 503 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return Response.json({ error: '파일 데이터를 읽지 못했습니다' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const courseId = formData.get('courseId') as string | null
  const userId = formData.get('userId') as string | null
  const userName = (formData.get('userName') as string | null) || ''

  if (!file || !courseId || !userId) {
    return Response.json({ error: 'file, courseId, userId 필수' }, { status: 400 })
  }
  if (file.size > 50 * 1024 * 1024) {
    return Response.json({ error: '파일 크기는 50MB 이하여야 합니다' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() || 'bin'
  const safeName = file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_')
  const path = `${courseId}/${userId}/${Date.now()}_${safeName}`

  const arrayBuffer = await file.arrayBuffer()
  const uint8 = new Uint8Array(arrayBuffer)

  const { error: storageErr } = await db.storage
    .from('submissions')
    .upload(path, uint8, { contentType: file.type || 'application/octet-stream', upsert: false })

  if (storageErr) {
    // 버킷이 없으면 안내 메시지
    if ((storageErr as any).statusCode === '404' || (storageErr.message || '').toLowerCase().includes('bucket')) {
      return Response.json({ error: 'submissions 버킷이 없습니다. supabase/submissions.sql을 먼저 실행하세요.' }, { status: 503 })
    }
    return Response.json({ error: storageErr.message }, { status: 500 })
  }

  const { data, error: dbErr } = await db
    .from('submissions')
    .insert({
      course_id: courseId,
      user_id: userId,
      user_name: userName,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
    })
    .select('id, file_name, file_size, submitted_at')
    .single()

  if (dbErr) return Response.json({ error: dbErr.message }, { status: 500 })

  return Response.json({ ok: true, submission: data })
}

// PATCH /api/submissions  — 채점/코멘트 (관리자)
// body: { id, grade?, comment? }
export async function PATCH(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ error: 'no-db' }, { status: 503 })

  let b: any
  try { b = await req.json() } catch { return Response.json({ error: '잘못된 요청' }, { status: 400 }) }

  const { id, grade, comment } = b
  if (!id) return Response.json({ error: 'id 필요' }, { status: 400 })

  const update: any = {}
  if (grade !== undefined) update.grade = grade
  if (comment !== undefined) update.comment = comment

  const { error } = await db.from('submissions').update(update).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}

// DELETE /api/submissions?id=xxx
export async function DELETE(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ error: 'no-db' }, { status: 503 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'id 필요' }, { status: 400 })

  // file_path 먼저 조회
  const { data: rec } = await db.from('submissions').select('file_path').eq('id', id).maybeSingle()
  if (rec?.file_path) {
    await db.storage.from('submissions').remove([rec.file_path])
  }
  await db.from('submissions').delete().eq('id', id)

  return Response.json({ ok: true })
}
