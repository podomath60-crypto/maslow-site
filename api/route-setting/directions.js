const DIRECTION_URL = 'https://maps.apigw.ntruss.com/map-direction/v1/driving';

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

function toCoord(value) {
  if (!value || typeof value !== 'object') return null;
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function formatDuration(ms) {
  const totalMin = Math.max(0, Math.round(Number(ms || 0) / 60000));
  if (totalMin < 60) return `${totalMin}분`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

function formatDistance(m) {
  const n = Number(m || 0);
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}km`;
  return `${Math.round(n)}m`;
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
  const start = toCoord(input.start);
  const goal = toCoord(input.goal);
  const option = String(input.option || 'trafast').trim();

  if (!start || !goal) {
    return sendJson(res, 400, { ok: false, message: '출발/도착 좌표가 필요합니다.' });
  }

  const params = new URLSearchParams();
  params.set('start', `${start.lng},${start.lat}`);
  params.set('goal', `${goal.lng},${goal.lat}`);
  params.set('option', option);
  params.set('lang', 'ko');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const apiRes = await fetch(`${DIRECTION_URL}?${params.toString()}`, {
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
        message: '네이버 Directions API 응답 오류',
        status: apiRes.status,
        rawHead: String(text || '').slice(0, 200)
      });
    }

    const routeObj = payload && payload.route ? payload.route : {};
    const routeKey = routeObj[option] ? option : Object.keys(routeObj)[0];
    const selected = routeKey && Array.isArray(routeObj[routeKey]) ? routeObj[routeKey][0] : null;

    if (!selected || !selected.summary) {
      return sendJson(res, 502, { ok: false, message: '경로 결과를 확인하지 못했습니다.' });
    }

    const summary = selected.summary;
    return sendJson(res, 200, {
      ok: true,
      option: routeKey,
      summary: {
        durationText: formatDuration(summary.duration),
        distanceText: formatDistance(summary.distance),
        durationMs: summary.duration,
        distanceM: summary.distance
      },
      path: Array.isArray(selected.path)
        ? selected.path.map((p) => ({ lng: Number(p[0]), lat: Number(p[1]) })).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
        : []
    });
  } catch (e) {
    const isAbort = e && e.name === 'AbortError';
    return sendJson(res, isAbort ? 504 : 500, {
      ok: false,
      message: isAbort ? '경로 확인 시간이 초과되었습니다.' : '경로 확인 처리 실패'
    });
  } finally {
    clearTimeout(timer);
  }
};
