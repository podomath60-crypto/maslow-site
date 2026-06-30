const { sendJson, getInput, text, fetchGas } = require('./_common');

function normalizeDashboardStatus(src) {
  src = src && typeof src === 'object' && !Array.isArray(src) ? src : {};
  return {
    internal: src.internal === true,
    needsWork: src.needsWork === true,
    needsPhoto: src.needsPhoto === true,
    needsContact: src.needsContact === true,
    dealDone: src.dealDone === true,
    reviewHold: src.reviewHold === true
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, message: 'Method not allowed' });
  try {
    const input = getInput(req);
    const listingNumber = text(input.listingNumber);
    const status = text(input.status).toLowerCase() === 'visible' ? 'visible' : 'hidden';
    if (!listingNumber) return sendJson(res, 400, { ok: false, message: 'listingNumber가 필요합니다.' });
    const dashboardStatus = normalizeDashboardStatus(input.dashboardStatus);
    const data = await fetchGas({
      action: 'updateDashboardStatus',
      listingNumber,
      status,
      dashboardStatus
    });
    return sendJson(res, 200, data && typeof data === 'object' ? data : { ok: true });
  } catch (e) {
    const isAbort = e && e.name === 'AbortError';
    return sendJson(res, isAbort ? 504 : 500, {
      ok: false,
      message: isAbort ? '상태 저장 시간이 초과되었습니다.' : '상태 저장 실패',
      error: String((e && e.message) || e || '')
    });
  }
};
