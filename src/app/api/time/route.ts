// 서버 시간 제공 (같은 도메인이라 CORS 문제 없음)
// 학생이 기기 시계를 조작해도 이 서버 시간 기준으로 검증됨
export const dynamic = 'force-dynamic'

export async function GET() {
  return Response.json(
    { now: Date.now() },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
