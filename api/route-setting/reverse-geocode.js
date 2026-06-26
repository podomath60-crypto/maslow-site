const REVERSE_GEOCODE_URL = 'https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc';

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

function pickAddress(payload) {
  const results = payload && Array.isArray(payload.results) ? payload.results : [];
  if (!results.length) return '';

  for (const r of results) {
    const region = r.region || {};
    const land = r.land || {};
    const area1 = region.area1 && region.area1.name ? region.area1.name : '';
    const area2 = region.area2 && region.area2.name ? region.area2.name : '';
    const area3 = region.area3 && region.area3.name ? region.area3.name : '';
    const area4 = region.area4 && region.area4.name ? region.area4.name : '';

    const roadName = land.name || '';
    const number1 = land.number1 || '';
    const number2 = land.number2 || '';
    const building = land.addition0 && land.addition0.value ? land.addition0.value : '';

    const roadNumber = number1 ? `${number1}${number2 ? '-' + number2 : ''}` : '';
    const roadAddress = [area1, area2, area3, roadName, roadNumber].filter(Boolean).join(' ');
    if (roadName && roadNumber) return building ? `${roadAddress} ${building}` : roadAddress;

    const jibun = [area1, area2, area3, area4, roadNumber].filter(Boolean).join(' ');
    if (jibun) return jibun;
  }

  return '';
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
  const lat = Number(input.lat);
  const lng = Number(input.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return sendJson(res, 400, { ok: false, message: '현재 위치 좌표가 필요합니다.' });
  }

  const params = new URLSearchParams();
  params.set('coords', `${lng},${lat}`);
  params.set('orders', 'roadaddr,addr');
  params.set('output', 'json');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const apiRes = await fetch(`${REVERSE_GEOCODE_URL}?${params.toString()}`, {
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
        message: '네이버 Reverse Geocoding API 응답 오류',
        status: apiRes.status,
        rawHead: String(text || '').slice(0, 200)
      });
    }

    const address = pickAddress(payload) || `현재위치: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;

    return sendJson(res, 200, {
      ok: true,
      item: {
        address,
        lat,
        lng,
        raw: payload
      }
    });
  } catch (error) {
    const aborted = error && error.name === 'AbortError';
    return sendJson(res, aborted ? 504 : 500, {
      ok: false,
      message: aborted ? '네이버 Reverse Geocoding API 응답 시간이 초과되었습니다.' : '현재 위치 주소 변환 중 오류가 발생했습니다.',
      detail: String(error && error.message ? error.message : error)
    });
  } finally {
    clearTimeout(timer);
  }
};
