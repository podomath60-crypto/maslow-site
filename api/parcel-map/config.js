function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

module.exports = function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { ok: false, message: 'Method Not Allowed' });
  }
  const key = process.env.VWORLD_API_KEY || process.env.VWORLD_KEY || '';
  return sendJson(res, 200, {
    ok: true,
    vworldKey: key,
    source: 'vercel-env'
  });
};
