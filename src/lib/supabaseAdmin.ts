import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * 서버 전용 Supabase 클라이언트 (service_role 키 사용)
 * - RLS를 우회해 서버에서 안전하게 읽기/쓰기
 * - service_role 키는 절대 클라이언트로 노출되면 안 됨 (NEXT_PUBLIC_ 아님)
 * - 키가 설정되지 않았으면 null 반환 → API가 친절한 에러 응답
 */
let cached: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  if (!cached) {
    cached = createClient(url, key, { auth: { persistSession: false } })
  }
  return cached
}
