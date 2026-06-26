export default async function handler(req, res) {
  const q = String((req.query && req.query.q) || '').trim();
  if (!q) {
    return res.status(400).json({ ok: false, message: '검색어가 없습니다.', items: [] });
  }

  const clientId = process.env.NAVER_SEARCH_CLIENT_ID;
  const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(500).json({ ok: false, message: '네이버 검색 API 환경변수가 없습니다.', items: [] });
  }

  try {
    const url = new URL('https://openapi.naver.com/v1/search/local.json');
    url.searchParams.set('query', q);
    url.searchParams.set('display', '10');
    url.searchParams.set('start', '1');
    url.searchParams.set('sort', 'random');

    const upstream = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret
      }
    });

    const data = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      return res.status(upstream.status).json({
        ok: false,
        message: (data && (data.errorMessage || data.message)) || '네이버 지역 검색 요청이 실패했습니다.',
        items: []
      });
    }

    const items = Array.isArray(data && data.items) ? data.items.map(item => ({
      title: item.title || '',
      address: item.address || '',
      roadAddress: item.roadAddress || '',
      telephone: item.telephone || '',
      category: item.category || ''
    })) : [];

    return res.status(200).json({ ok: true, items });
  } catch (err) {
    return res.status(500).json({ ok: false, message: '검색 서버 연결에 실패했습니다.', items: [] });
  }
}
