import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'

// GET /api/special/entitlements?userId=xxx
export async function GET(req: Request) {
  const db = getSupabaseAdmin()
  if (!db) return Response.json({ entitlements: [] })

  const userId = new URL(req.url).searchParams.get('userId')
  if (!userId) return Response.json({ entitlements: [] })

  const { data } = await db
    .from('entitlements')
    .select('id, kind, total, used, created_at')
    .eq('user_id', userId)

  return Response.json({ entitlements: data || [] })
}
