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
  // 주소 텍스트는 절대 바꾸지 않는다.
  // 앞뒤 공백과 연속 공백/탭/줄바꿈 같은 whitespace만 1칸으로 정리한다.
  return String(value || '').trim().replace(/\s+/g, ' ');
}


function makeRoadNumberSpacingCandidate(query) {
  // 주소 글자는 건드리지 않고, 도로명과 건물번호가 붙어 있는 경우에만 공백 후보를 만든다.
  // 예: "대학로342" -> "대학로 342", "새만금북로466-12" -> "새만금북로 466-12"
  return String(query || '').replace(
    /([가-힣A-Za-z0-9·.\-]+(?:대로|로|길))(\d+(?:-\d+)?)(?=\s|$)/g,
    '$1 $2'
  );
}

function stripTrailingPlaceNameForLookup(query) {
  // 조회용으로만 주소 핵심 뒤의 상호명/건물명 꼬리를 제거한다.
  // 행정구역(읍/면/동/리)은 제거하지 않는다. API 호출은 이 결과로 1번만 한다.
  const q = String(query || '').trim();

  // 도로명주소: "... 대학로 342 동아26빌딩" -> "... 대학로 342"
  const road = q.match(/^(.+?\s[가-힣A-Za-z0-9·.\-]+(?:대로|로|길)\s+\d+(?:-\d+)?)(?:\s+.+)$/);
  if (road && road[1]) return road[1].trim();

  // 지번주소: "... 나운동 805-1 동아26빌딩" -> "... 나운동 805-1"
  // 리 지번도 보존: "... 성산면 성덕리 123-4 상호" -> "... 성산면 성덕리 123-4"
  const jibun = q.match(/^(.+?(?:읍|면|동|가|리)\s+\d+(?:-\d+)?)(?:\s+.+)$/);
  if (jibun && jibun[1]) return jibun[1].trim();

  return q;
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    // 주소 1개당 네이버 Geocoding API는 무조건 1번만 조회한다.
    // 조회 전에 필요한 보정만 한 번 적용한다.
    // 1) 도로명과 건물번호가 붙어 있으면 공백을 넣는다. 예: "대학로342" -> "대학로 342"
    // 2) 주소 핵심 뒤에 붙은 상호명/건물명 꼬리만 제거한다.
    // 읍면동/리/행정구역명은 삭제하거나 치환하지 않는다.
    const lookupQuery = stripTrailingPlaceNameForLookup(makeRoadNumberSpacingCandidate(query));
    const result = await callGeocode(lookupQuery, clientId, clientSecret, controller.signal);
    const addresses = result && Array.isArray(result.addresses) ? result.addresses : [];
    const matchedQuery = lookupQuery;

    if (!addresses.length) {
      return sendJson(res, 404, {
        ok: false,
        message: '주소를 찾지 못했습니다.',
        query,
        lookupQuery,
        failedAddress: query,
        tried: [lookupQuery]
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
      tried: [lookupQuery]
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
