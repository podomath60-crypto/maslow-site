function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, message: 'Method not allowed' });
  }

  const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || process.env.NAVER_MAP_CLIENT_ID || '';
  if (!clientId) {
    return sendJson(res, 500, {
      ok: false,
      message: 'NEXT_PUBLIC_NAVER_MAP_CLIENT_ID 또는 NAVER_MAP_CLIENT_ID 환경변수가 없습니다.'
    });
  }

  return sendJson(res, 200, { ok: true, clientId });
};
