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

function normalizeQuery(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function uniquePush(list, value) {
  const v = normalizeQuery(value);
  if (!v) return;
  const key = v.toLowerCase();
  if (!list.some((x) => x.toLowerCase() === key)) list.push(v);
}

function buildQueryCandidates(query) {
  const q = normalizeQuery(query);
  const list = [];
  uniquePush(list, q);

  // 도로명 주소 뒤에 건물명/상호명이 붙으면 Geocoding 실패가 잦다.
  // 예: 전북특별자치도 군산시 나운동 대학로 342 동아26빌딩
  // → 전북특별자치도 군산시 나운동 대학로 342
  const roadOnly = q.match(/^(.+?\s(?:[가-힣A-Za-z0-9·.\-]+(?:대로|로|길))\s*\d+(?:-\d+)?)(?:\s+.+)?$/);
  if (roadOnly && roadOnly[1]) uniquePush(list, roadOnly[1]);

  // 도로명 주소에 동/읍/면/리 명칭이 끼어 있으면 제거한 후보도 시도한다.
  // 예: 전북특별자치도 군산시 나운동 대학로 342
  // → 전북특별자치도 군산시 대학로 342
  const withoutDong = q.match(/^(.+?(?:시|군|구))\s+\S+(?:읍|면|동|가|리)\s+(.+?\s(?:[가-힣A-Za-z0-9·.\-]+(?:대로|로|길))\s*\d+(?:-\d+)?)(?:\s+.+)?$/);
  if (withoutDong && withoutDong[1] && withoutDong[2]) uniquePush(list, `${withoutDong[1]} ${withoutDong[2]}`);

  // 위 정규식이 놓친 경우를 위해 roadOnly 후보에서도 동 제거를 한 번 더 시도한다.
  if (roadOnly && roadOnly[1]) {
    const r = roadOnly[1].match(/^(.+?(?:시|군|구))\s+\S+(?:읍|면|동|가|리)\s+(.+)$/);
    if (r && r[1] && r[2]) uniquePush(list, `${r[1]} ${r[2]}`);
  }

  return list;
}

async function callGeocode(query, clientId, clientSecret, signal) {
  const url = `${GEOCODE_URL}?query=${encodeURIComponent(query)}`;
  const apiRes = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'x-ncp-apigw-api-key-id': clientId,
      'x-ncp-apigw-api-key': clientSecret
    },
    signal
  });

  const text = await apiRes.text();
  let payload;
  try { payload = JSON.parse(text); } catch (_) { payload = null; }

  if (!apiRes.ok) {
    const err = new Error('네이버 Geocoding API 응답 오류');
    err.status = apiRes.status;
    err.rawHead = String(text || '').slice(0, 200);
    throw err;
  }

  const addresses = payload && Array.isArray(payload.addresses) ? payload.addresses : [];
  return { payload, addresses };
}

function pickResolvedAddress(item, fallback) {
  // 좌표 계산은 Geocoding 결과 x/y를 사용한다.
  // 화면 표시는 사용자가 입력한 원문 주소를 유지하고, 지번/도로명은 내부 보조값으로만 둔다.
  return item.jibunAddress || item.roadAddress || fallback;
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
  const query = normalizeQuery(input.query || input.address || '');
  if (!query) {
    return sendJson(res, 400, { ok: false, message: '주소를 입력하세요.' });
  }

  const candidatesToTry = buildQueryCandidates(query);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    let lastResult = null;
    let matchedQuery = query;

    for (const candidate of candidatesToTry) {
      const result = await callGeocode(candidate, clientId, clientSecret, controller.signal);
      lastResult = result;
      if (result.addresses.length) {
        matchedQuery = candidate;
        break;
      }
    }

    const addresses = lastResult && Array.isArray(lastResult.addresses) ? lastResult.addresses : [];
    if (!addresses.length) {
      return sendJson(res, 404, {
        ok: false,
        message: '주소를 찾지 못했습니다.',
        query,
        tried: candidatesToTry
      });
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
      matchedQuery,
      item: {
        address: query,
        resolvedAddress: pickResolvedAddress(first, matchedQuery),
        roadAddress: first.roadAddress || '',
        jibunAddress: first.jibunAddress || '',
        englishAddress: first.englishAddress || '',
        lat,
        lng
      },
      candidates: addresses.slice(0, 5).map((a) => ({
        address: query,
        resolvedAddress: pickResolvedAddress(a, matchedQuery),
        roadAddress: a.roadAddress || '',
        jibunAddress: a.jibunAddress || '',
        lat: Number(a.y),
        lng: Number(a.x)
      })),
      tried: candidatesToTry
    });
  } catch (error) {
    const aborted = error && error.name === 'AbortError';
    return sendJson(res, aborted ? 504 : (error.status || 500), {
      ok: false,
      message: aborted ? '네이버 Geocoding API 응답 시간이 초과되었습니다.' : '주소 좌표 변환 중 오류가 발생했습니다.',
      status: error.status,
      rawHead: error.rawHead,
      detail: String(error && error.message ? error.message : error)
    });
  } finally {
    clearTimeout(timer);
  }
};
