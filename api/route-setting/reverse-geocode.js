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

function regionText(region) {
  const r = region || {};
  return [
    r.area1 && r.area1.name,
    r.area2 && r.area2.name,
    r.area3 && r.area3.name,
    r.area4 && r.area4.name
  ].filter(Boolean).join(' ');
}

function landNumber(land) {
  const l = land || {};
  const n1 = l.number1 || '';
  const n2 = l.number2 || '';
  return n1 ? `${n1}${n2 ? '-' + n2 : ''}` : '';
}

function buildJibunAddress(result) {
  if (!result) return '';
  const base = regionText(result.region);
  const num = landNumber(result.land);
  return [base, num].filter(Boolean).join(' ').trim();
}

function buildRoadAddressWithoutBuilding(result) {
  if (!result) return '';
  const region = result.region || {};
  const land = result.land || {};
  const area1 = region.area1 && region.area1.name ? region.area1.name : '';
  const area2 = region.area2 && region.area2.name ? region.area2.name : '';
  const area3 = region.area3 && region.area3.name ? region.area3.name : '';
  const roadName = land.name || '';
  const number = landNumber(land);
  return [area1, area2, area3, roadName, number].filter(Boolean).join(' ').trim();
}

function pickAddress(payload) {
  const results = payload && Array.isArray(payload.results) ? payload.results : [];
  if (!results.length) return '';

  // 현재위치 출발지는 경로조회 안정성을 위해 건물명/상호명이 붙는 도로명 주소보다
  // 지번 주소를 우선 사용한다. 예: 전북특별자치도 군산시 나운동 805-1
  const addrResult = results.find((r) => r && r.name === 'addr');
  const jibun = buildJibunAddress(addrResult);
  if (jibun) return jibun;

  // 일부 응답은 name이 다르게 오거나 addr 결과가 없을 수 있으므로,
  // land.number가 있는 결과에서 지번 형태를 한 번 더 시도한다.
  for (const r of results) {
    const candidate = buildJibunAddress(r);
    if (candidate && /\d/.test(candidate)) return candidate;
  }

  // 마지막 대안: 도로명 주소를 쓰되 건물명(addition0)은 절대 붙이지 않는다.
  const roadResult = results.find((r) => r && r.name === 'roadaddr') || results[0];
  const road = buildRoadAddressWithoutBuilding(roadResult);
  if (road) return road;

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
  params.set('orders', 'addr,roadaddr');
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
