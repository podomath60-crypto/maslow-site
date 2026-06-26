const GEOCODE_URL = 'https://maps.apigw.ntruss.com/map-geocode/v2/geocode';

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.end(JSON.stringify(payload));
}

function getInput(req) {
  if (req.method === 'POST') {
    if (req.body && typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body || '{}'); } catch (_) { return {}; }
    }
    return {};
  }
  return req.query || {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, message: 'Method not allowed' });
  }

  const clientId = process.env.NAVER_MAP_CLIENT_ID || process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
  const clientSecret = process.env.NAVER_MAP_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return sendJson(res, 500, {
      ok: false,
      message: '네이버 Maps 서버 환경변수가 없습니다. NAVER_MAP_CLIENT_ID / NAVER_MAP_CLIENT_SECRET을 확인하세요.'
    });
  }

  const input = getInput(req);
  const query = String(input.query || input.address || '').trim();
  if (!query) {
    return sendJson(res, 400, { ok: false, message: '주소를 입력하세요.' });
  }

  const url = `${GEOCODE_URL}?query=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const apiRes = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-ncp-apigw-api-key-id': clientId,
        'x-ncp-apigw-api-key': clientSecret
      },
      signal: controller.signal
    });

    const text = await apiRes.text();
    let payload;
    try { payload = JSON.parse(text); } catch (_) { payload = null; }

    if (!apiRes.ok) {
      return sendJson(res, apiRes.status || 502, {
        ok: false,
        message: '네이버 Geocoding API 응답 오류',
        status: apiRes.status,
        rawHead: String(text || '').slice(0, 200)
      });
    }

    const addresses = payload && Array.isArray(payload.addresses) ? payload.addresses : [];
    if (!addresses.length) {
      return sendJson(res, 404, { ok: false, message: '주소를 찾지 못했습니다.', query });
    }

    const first = addresses[0];
    const lng = Number(first.x);
    const lat = Number(first.y);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return sendJson(res, 502, { ok: false, message: '좌표 변환 결과가 올바르지 않습니다.' });
    }

    return sendJson(res, 200, {
      ok: true,
      query,
      item: {
        address: first.roadAddress || first.jibunAddress || query,
        roadAddress: first.roadAddress || '',
        jibunAddress: first.jibunAddress || '',
        englishAddress: first.englishAddress || '',
        lat,
        lng
      },
      candidates: addresses.slice(0, 5).map((a) => ({
        address: a.roadAddress || a.jibunAddress || '',
        roadAddress: a.roadAddress || '',
        jibunAddress: a.jibunAddress || '',
        lat: Number(a.y),
        lng: Number(a.x)
      }))
    });
  } catch (e) {
    const isAbort = e && e.name === 'AbortError';
    return sendJson(res, isAbort ? 504 : 500, {
      ok: false,
      message: isAbort ? '주소 검색 시간이 초과되었습니다.' : '주소 검색 처리 실패'
    });
  } finally {
    clearTimeout(timer);
  }
};
