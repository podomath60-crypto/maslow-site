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
    const display = 5; // 네이버 지역검색 API 1회 최대치
    const starts = [1, 6, 11, 16, 21, 26]; // 최대 30개까지 페이지 조회
    const collected = [];
    let firstError = null;

    for (const start of starts) {
      const url = new URL('https://openapi.naver.com/v1/search/local.json');
      url.searchParams.set('query', q);
      url.searchParams.set('display', String(display));
      url.searchParams.set('start', String(start));
      url.searchParams.set('sort', 'accuracy');

      const upstream = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret
        }
      });

      const data = await upstream.json().catch(() => null);
      if (!upstream.ok) {
        firstError = {
          status: upstream.status,
          message: (data && (data.errorMessage || data.message)) || '네이버 지역 검색 요청이 실패했습니다.'
        };
        break;
      }

      const pageItems = Array.isArray(data && data.items) ? data.items : [];
      if (!pageItems.length) break;
      collected.push(...pageItems);
      if (pageItems.length < display) break;
    }

    if (firstError && !collected.length) {
      return res.status(firstError.status).json({ ok: false, message: firstError.message, items: [] });
    }

    const seen = new Set();
    const items = [];
    for (const item of collected) {
      const normalized = {
        title: item.title || '',
        address: item.address || '',
        roadAddress: item.roadAddress || '',
        telephone: item.telephone || '',
        category: item.category || ''
      };
      const key = [normalized.title, normalized.roadAddress, normalized.address, normalized.telephone]
        .join('|')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      items.push(normalized);
    }

    return res.status(200).json({ ok: true, items, count: items.length });
  } catch (err) {
    return res.status(500).json({ ok: false, message: '검색 서버 연결에 실패했습니다.', items: [] });
  }
}
