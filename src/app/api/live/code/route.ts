import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { currentCode, msUntilNextSlot } from '@/lib/rotatingCode'

export const dynamic = 'force-dynamic'

// 운영자 화면용: 현재 회전 코드 반환 (몇 초마다 폴링)
export async function GET(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ error: 'Supabase 설정 필요' }, { status: 503 })

  const sessionId = new URL(req.url).searchParams.get('session')
  if (!sessionId) return Response.json({ error: 'session 필수' }, { status: 400 })

  const { data, error } = await db
    .from('attendance_sessions')
    .select('secret, ends_at')
    .eq('id', sessionId)
    .single()

  if (error || !data) return Response.json({ error: '세션을 찾을 수 없음' }, { status: 404 })
  if (new Date(data.ends_at).getTime() < Date.now()) {
    return Response.json({ error: '종료된 세션', ended: true }, { status: 410 })
  }

  return Response.json({
    code: currentCode(data.secret),
    refreshInMs: msUntilNextSlot(),
  })
}
