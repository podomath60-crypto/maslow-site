const { sendJson, getInput, text, fetchGas } = require('./_common');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, message: 'Method not allowed' });
  try {
    const input = getInput(req);
    const listingNumber = text(input.listingNumber);
    const memo = text(input.memo);
    const writerCode = text(input.writerCode);
    if (!listingNumber) return sendJson(res, 400, { ok: false, message: 'listingNumber가 필요합니다.' });
    if (!writerCode) return sendJson(res, 400, { ok: false, message: 'writerCode가 필요합니다.' });
    const data = await fetchGas({
      action: 'updatePropertyMemo',
      listingNumber,
      memo,
      writerCode
    });
    return sendJson(res, 200, data && typeof data === 'object' ? data : { ok: true });
  } catch (e) {
    const isAbort = e && e.name === 'AbortError';
    return sendJson(res, isAbort ? 504 : 500, {
      ok: false,
      message: isAbort ? '메모 저장 시간이 초과되었습니다.' : '메모 저장 실패',
      error: String((e && e.message) || e || '')
    });
  }
};
