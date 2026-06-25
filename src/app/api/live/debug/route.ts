export const dynamic = 'force-dynamic'

// 임시 진단용 — 환경변수 이름만 확인 (값은 절대 노출 안 함)
export async function GET() {
  // SUPA/SERVICE/ROLE/KEY 가 들어간 모든 env 변수 '이름'만 수집
  const matchingKeys = Object.keys(process.env).filter((k) =>
    /SUPA|SERVICE|ROLE|SECRET/i.test(k)
  )

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  let role: string | null = null
  let keyType: string | null = null
  if (key) {
    if (key.startsWith('sb_secret_')) { keyType = 'new-secret'; role = 'service_role' }
    else if (key.startsWith('sb_publishable_')) { keyType = 'new-publishable'; role = 'ANON(잘못됨!)' }
    else if (key.startsWith('eyJ')) {
      keyType = 'jwt'
      try { role = JSON.parse(Buffer.from(key.split('.')[1] || '', 'base64').toString()).role } catch { role = '?' }
    } else { keyType = 'unknown' }
  }

  return Response.json({
    matchingKeys, // 어떤 이름으로 저장됐는지 보여줌
    hasServiceKey: !!key,
    keyLen: key ? key.length : 0,
    keyType,
    role,
  })
}
