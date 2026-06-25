export const dynamic = 'force-dynamic'

// 임시 진단용 — 환경변수가 런타임에 보이는지 확인 (값은 노출 안 함)
export async function GET() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  let keyType: string | null = null
  let role: string | null = null
  if (key) {
    if (key.startsWith('sb_secret_')) { keyType = 'new-secret'; role = 'service_role' }
    else if (key.startsWith('sb_publishable_')) { keyType = 'new-publishable'; role = 'ANON(잘못됨!)' }
    else if (key.startsWith('eyJ')) {
      keyType = 'jwt'
      try { role = JSON.parse(Buffer.from(key.split('.')[1] || '', 'base64').toString()).role } catch { role = '?' }
    } else { keyType = 'unknown' }
  }
  return Response.json({
    hasUrlPublic: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceKey: !!key,
    keyLen: key ? key.length : 0,
    keyType,
    role,
  })
}
