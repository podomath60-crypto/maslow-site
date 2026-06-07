const GAS_URL = 'https://script.google.com/macros/s/AKfycbznhBvYFIv_GKeNoGIPFTi_mIXXH04BOvYrb4ZN9dk_Cc4Xjir3TP_vL3bbPrLLxgg2/exec';

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.end(JSON.stringify(payload));
}

function parseGasPayload(text) {
  const raw = String(text || '').trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch (_) {}

  const match = raw.match(/^[\w$.]+\((([\s\S]*))\);?$/);
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
    const input = req.method === 'POST' ? (req.body || {}) : (req.query || {});
    const action = String(input.action || '').trim();

    if (action !== 'fetchBuildingsByDongAndUseAprDay') {
      return sendJson(res, 400, { ok: false, message: '지원하지 않는 요청입니다.' });
    }

    const params = new URLSearchParams();
    params.set('action', action);
    params.set('bcode', String(input.bcode || '').trim());
    params.set('sido', String(input.sido || '').trim());
    params.set('sigungu', String(input.sigungu || '').trim());
    params.set('bname', String(input.bname || '').trim());
    params.set('useAprDay', String(input.useAprDay || '').replace(/\D/g, '').slice(0, 8));
    params.set('callback', '__maslowProxyCallback');
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
