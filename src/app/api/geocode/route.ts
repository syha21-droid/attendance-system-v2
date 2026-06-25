export const dynamic = 'force-dynamic'

/**
 * 주소 → 좌표 변환 (지오코딩)
 * OpenStreetMap Nominatim 사용 (무료, API 키 불필요).
 * 서버에서 호출해 User-Agent를 붙이고 CORS 문제를 피한다.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')
  if (!q || q.trim().length < 2) {
    return Response.json({ error: '주소를 입력하세요' }, { status: 400 })
  }

  try {
    const url =
      'https://nominatim.openstreetmap.org/search?format=json&limit=1' +
      '&countrycodes=kr&accept-language=ko&q=' +
      encodeURIComponent(q.trim())

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'attendance-system-v2 (contact: seoyunha87@gmail.com)',
        'Accept-Language': 'ko',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      return Response.json({ error: '주소 검색 서버 오류' }, { status: 502 })
    }

    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) {
      return Response.json({ error: '주소를 찾을 수 없습니다. 더 자세히 입력해보세요.' }, { status: 404 })
    }

    const top = data[0]
    return Response.json({
      lat: parseFloat(top.lat),
      lng: parseFloat(top.lon),
      displayName: top.display_name,
    })
  } catch {
    return Response.json({ error: '주소 검색 중 오류가 발생했습니다' }, { status: 500 })
  }
}
