import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// 로그아웃 시 서버 active_token 삭제 → 다른 기기에서 로그인 가능해짐
export async function POST(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ ok: true, nodb: true })

  let b: any
  try { b = await req.json() } catch { return Response.json({ ok: false }, { status: 400 }) }

  const { userId, token } = b
  if (!userId) return Response.json({ ok: false, error: 'userId 필수' }, { status: 400 })

  // 토큰 일치 확인 후 삭제 (다른 탭이 남의 세션 날리는 것 방지)
  const { data } = await db.from('app_users').select('active_token').eq('id', userId).maybeSingle()
  if (data && (!token || data.active_token === token)) {
    await db.from('app_users').update({ active_token: null, token_set_at: null }).eq('id', userId)
  }

  return Response.json({ ok: true })
}
