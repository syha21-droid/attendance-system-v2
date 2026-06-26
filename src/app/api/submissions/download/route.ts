import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/submissions/download?id=xxx
// 서명된 다운로드 URL 생성 후 리다이렉트 (5분 유효)
export async function GET(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ error: 'no-db' }, { status: 503 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return Response.json({ error: 'id 필요' }, { status: 400 })

  const { data: rec } = await db
    .from('submissions')
    .select('file_path, file_name')
    .eq('id', id)
    .maybeSingle()

  if (!rec) return Response.json({ error: '파일을 찾을 수 없습니다' }, { status: 404 })

  const { data: urlData, error } = await db.storage
    .from('submissions')
    .createSignedUrl(rec.file_path, 300) // 5분

  if (error || !urlData?.signedUrl) {
    return Response.json({ error: '다운로드 URL 생성 실패' }, { status: 500 })
  }

  return Response.redirect(urlData.signedUrl)
}
