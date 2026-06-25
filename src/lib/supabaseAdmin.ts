import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * 서버 전용 Supabase 클라이언트 (service_role 키 사용)
 * - service_role 키는 절대 클라이언트로 노출되면 안 됨 (NEXT_PUBLIC_ 아님)
 * - URL은 비밀이 아니라서 직접 명시 (NEXT_PUBLIC_ 변수를 Sensitive로 두면
 *   빌드 시 undefined로 박히는 문제가 있어 서버에서는 비공개 env/하드코딩 사용)
 */
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://npocfseejwbkiqefwvga.supabase.co'

let cached: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !key) return null
  if (!cached) {
    cached = createClient(SUPABASE_URL, key, { auth: { persistSession: false } })
  }
  return cached
}
