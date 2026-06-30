import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

// 토큰 유효 시간: 24시간 (탭 닫고 나서 자동 만료)
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000

export async function POST(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ user: null, nodb: true })

  let b: any
  try {
    b = await req.json()
  } catch {
    return Response.json({ error: '잘못된 요청' }, { status: 400 })
  }
  const email = String(b.email || '').trim().toLowerCase()

  const { data } = await db.from('app_users').select('*').eq('email', email).maybeSingle()
  if (!data || data.password !== String(b.password)) {
    return Response.json({ user: null })
  }

  // 관리자는 제한 없음
  if (!data.is_admin) {
    // 이미 활성 토큰이 있고 아직 만료 안 됐으면 로그인 차단
    if (data.active_token && data.token_set_at) {
      const age = Date.now() - new Date(data.token_set_at).getTime()
      if (age < TOKEN_TTL_MS) {
        return Response.json({
          user: null,
          blocked: true,
          error: '이미 다른 곳에서 로그인 중입니다. 기존 세션에서 로그아웃 후 다시 시도하세요.',
        })
      }
    }

    // 새 토큰 발급
    const token = randomUUID()
    await db
      .from('app_users')
      .update({ active_token: token, token_set_at: new Date().toISOString() })
      .eq('id', data.id)

    return Response.json({
      user: { id: data.id, email: data.email, name: data.name, isAdmin: data.is_admin },
      token,
    })
  }

  return Response.json({ user: { id: data.id, email: data.email, name: data.name, isAdmin: data.is_admin } })
}
