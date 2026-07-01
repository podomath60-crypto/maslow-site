const GAS_URL = 'https://script.google.com/macros/s/AKfycbznhBvYFIv_GKeNoGIPFTi_mIXXH04BOvYrb4ZN9dk_Cc4Xjir3TP_vL3bbPrLLxgg2/exec';

function setCommonHeaders(res) {
  // 같은 배포 도메인의 /api 호출이 기본이지만, www/non-www 또는 임시 배포 주소에서
  // 화면을 열어도 프록시를 쓸 수 있게 CORS를 열어둔다.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  setCommonHeaders(res);
  res.end(JSON.stringify(payload));
}

function parseJsonLoose(text) {
  const raw = String(text || '').trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch (_) {}

  // JSONP: callback({...}); 형태 파싱
  const match = raw.match(/^[\w$.]+\(([\s\S]*)\);?$/);
  if (match && match[1]) {
    return JSON.parse(match[1]);
  }

  throw new Error('GAS_NON_JSON_RESPONSE');
}

function parseBodyText(text) {
  const raw = String(text || '').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function getInput(req) {
  if (req.method === 'GET') return req.query || {};

  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return parseBodyText(req.body);

  try {
    const raw = await readRawBody(req);
    return parseBodyText(raw);
  } catch (_) {
    return {};
  }
}

function cleanInput(input, action) {
  const params = {};
  Object.keys(input || {}).forEach((key) => {
    if (key === 'callback' || key === '_ts') return;
    const value = input[key];
    params[key] = value == null ? '' : String(value);
  });
  params.action = action;
  return params;
}

function buildSearchParams(input, action, withCallback) {
  const params = new URLSearchParams();
  const cleaned = cleanInput(input, action);
  Object.keys(cleaned).forEach((key) => {
    params.set(key, cleaned[key] == null ? '' : String(cleaned[key]));
  });
  if (withCallback) {
    params.set('callback', '__maslowPublicPropertyProxyCallback');
  }
  params.set('_ts', String(Date.now()));
  return params;
}

async function fetchGas(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55000);
  try {
    const response = await fetch(url, Object.assign({}, options || {}, { signal: controller.signal }));
    const text = await response.text();
    return { response, text };
  } finally {
    clearTimeout(timer);
  }
}

async function callGasByGetJsonp(input, action) {
  const params = buildSearchParams(input, action, true);
  const result = await fetchGas(`${GAS_URL}?${params.toString()}`, {
    method: 'GET',
    headers: { 'Accept': 'application/javascript, application/json, text/plain, */*' }
  });

  if (!result.response || !result.response.ok) {
    throw new Error('GAS GET 응답 오류: ' + (result.response ? result.response.status : 0));
  }

  return parseJsonLoose(result.text);
}

async function callGasByPostText(input, action) {
  const payload = cleanInput(input, action);
  const result = await fetchGas(GAS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
      'Accept': 'application/json, text/plain, */*'
    },
    body: JSON.stringify(payload)
  });

  if (!result.response || !result.response.ok) {
    throw new Error('GAS POST 응답 오류: ' + (result.response ? result.response.status : 0));
  }

  return parseJsonLoose(result.text);
}

function isUsablePayload(payload) {
  return !!(payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'ok'));
}

module.exports = async function handler(req, res) {
  setCommonHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, message: 'Method not allowed' });
  }

  try {
    const input = await getInput(req);
    const action = String(input.action || '').trim();

    const allowedActions = new Set([
      'fetchPublicPropertyBySearchResult',
      'fetchLandInfoBySearchResult'
    ]);

    if (!allowedActions.has(action)) {
      return sendJson(res, 400, { ok: false, message: '지원하지 않는 요청입니다.' });
    }

    const attempts = [];

    try {
      const payload = await callGasByGetJsonp(input, action);
      if (isUsablePayload(payload)) return sendJson(res, 200, payload);
      attempts.push('GAS GET JSONP: ok 필드 없는 응답');
    } catch (e) {
      attempts.push('GAS GET JSONP: ' + (e && e.message ? e.message : String(e)));
    }

    try {
      const payload = await callGasByPostText(input, action);
      if (isUsablePayload(payload)) return sendJson(res, 200, payload);
      attempts.push('GAS POST: ok 필드 없는 응답');
    } catch (e) {
      attempts.push('GAS POST: ' + (e && e.message ? e.message : String(e)));
    }

    return sendJson(res, 502, {
      ok: false,
      message: '매슬로우 프록시가 GAS 조회 응답을 확인하지 못했습니다.',
      detail: attempts.join(' / ')
    });
  } catch (e) {
    const isAbort = e && e.name === 'AbortError';
    return sendJson(res, isAbort ? 504 : 500, {
      ok: false,
      message: isAbort ? '조회 서버 응답 시간이 초과되었습니다.' : '조회 요청 처리 실패',
      detail: e && e.message ? e.message : String(e)
    });
  }
};
