const {
  VWORLD_SEARCH_URL,
  sendJson,
  getInput,
  getVworldKey,
  appendDefinedParams,
  fetchJsonWithTimeout,
  text
} = require('./_common');

async function searchAddress(query, category) {
  const key = getVworldKey();
  if (!key) throw new Error('VWORLD_API_KEY 환경변수가 없습니다.');
  const params = appendDefinedParams(new URLSearchParams(), {
    service: 'search',
    request: 'search',
    version: '2.0',
    size: '1',
    page: '1',
    type: 'address',
    category,
    format: 'json',
    key,
    query
  });
  const data = await fetchJsonWithTimeout(`${VWORLD_SEARCH_URL}?${params.toString()}`, 20000);
  const items = data && data.response && data.response.result && data.response.result.items;
  return Array.isArray(items) && items.length ? items[0] : null;
}

function pnuFromItem(item) {
  return String((item && item.id) || '').replace(/\D/g, '');
}

function normalizeFound(item, query, searchType) {
  const pnu = pnuFromItem(item);
  if (!/^\d{19}$/.test(pnu)) throw new Error('필지 식별정보를 확인하지 못했습니다.');
  return {
    pnu,
    address: text(item.address && item.address.parcel) || text(item.address && item.address.road) || text(item.title) || query,
    parcelAddress: text(item.address && item.address.parcel),
    roadAddress: text(item.address && item.address.road),
    title: text(item.title),
    point: item.point || {},
    query,
    searchType
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, message: 'Method not allowed' });
  }
  try {
    const input = getInput(req);
    const query = text(input.query || input.address);
    if (!query) return sendJson(res, 400, { ok: false, message: '주소가 필요합니다.' });

    let item = await searchAddress(query, 'parcel');
    let searchType = 'parcel';
    if (!item || !/^\d{19}$/.test(pnuFromItem(item))) {
      item = await searchAddress(query, 'road');
      searchType = 'road';
    }
    if (!item) return sendJson(res, 404, { ok: false, message: '주소 검색 결과가 없습니다.' });

    const parcelAddress = text(item.address && item.address.parcel);
    if (!/^\d{19}$/.test(pnuFromItem(item)) && parcelAddress) {
      const parcelItem = await searchAddress(parcelAddress, 'parcel');
      if (parcelItem && /^\d{19}$/.test(pnuFromItem(parcelItem))) {
        item = parcelItem;
        searchType = 'road-to-parcel';
      }
    }

    return sendJson(res, 200, { ok: true, item: normalizeFound(item, query, searchType) });
  } catch (e) {
    const isAbort = e && e.name === 'AbortError';
    return sendJson(res, isAbort ? 504 : 500, {
      ok: false,
      message: isAbort ? 'PNU 보정 시간이 초과되었습니다.' : 'PNU 보정 실패',
      error: String((e && e.message) || e || '')
    });
  }
};
