const GAS_URL = 'https://script.google.com/macros/s/AKfycbznhBvYFIv_GKeNoGIPFTi_mIXXH04BOvYrb4ZN9dk_Cc4Xjir3TP_vL3bbPrLLxgg2/exec';

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
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

function parseGasPayload(text) {
  const raw = String(text || '').trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch (_) {}

  const match = raw.match(/^[\w$.]+\(([\s\S]*)\);?$/);
  if (match && match[1]) {
    return JSON.parse(match[1]);
  }

  throw new Error('GAS_NON_JSON_RESPONSE');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, message: 'Method not allowed' });
  }

  try {
    const input = getInput(req);
    const action = String(input.action || '').trim();

    const allowedActions = new Set([
      'fetchPublicPropertyBySearchResult',
      'fetchLandInfoBySearchResult'
    ]);

    if (!allowedActions.has(action)) {
      return sendJson(res, 400, { ok: false, message: '지원하지 않는 요청입니다.', action });
    }

    const params = new URLSearchParams();
    Object.keys(input || {}).forEach((key) => {
      if (key === 'callback' || key === '_ts') return;
      const value = input[key];
      params.set(key, value == null ? '' : String(value));
    });
    params.set('action', action);
    params.set('callback', '__maslowPublicPropertyProxyCallback');
    params.set('_ts', String(Date.now()));

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55000);

    let gasRes;
    let text;
    try {
      gasRes = await fetch(`${GAS_URL}?${params.toString()}`, {
        method: 'GET',
        headers: { 'Accept': 'application/javascript, application/json, text/plain, */*' },
        signal: controller.signal
      });
      text = await gasRes.text();
    } finally {
      clearTimeout(timer);
    }

    if (!gasRes || !gasRes.ok) {
      return sendJson(res, 502, {
        ok: false,
        message: '조회 서버 응답 오류',
        status: gasRes ? gasRes.status : 0
      });
    }

    let payload;
    try {
      payload = parseGasPayload(text);
    } catch (e) {
      return sendJson(res, 502, {
        ok: false,
        message: '조회 서버 응답이 JSON이 아닙니다.',
        rawHead: String(text || '').slice(0, 160)
      });
    }

    return sendJson(res, 200, payload);
  } catch (e) {
    const isAbort = e && e.name === 'AbortError';
    return sendJson(res, isAbort ? 504 : 500, {
      ok: false,
      message: isAbort ? '조회 서버 응답 시간이 초과되었습니다.' : '조회 요청 처리 실패'
    });
  }
};
