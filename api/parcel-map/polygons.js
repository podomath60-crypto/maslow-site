const {
  VWORLD_DATA_URL,
  CADASTRAL_DATA_ID,
  sendJson,
  getInput,
  getVworldKey,
  appendDefinedParams,
  fetchJsonWithTimeout,
  uniquePnuList,
  normalizeFeatureCollection,
  text
} = require('./_common');

function parseBbox(value) {
  if (Array.isArray(value)) {
    const nums = value.map(Number);
    if (nums.length >= 4 && nums.every(Number.isFinite)) return nums.slice(0, 4);
  }
  const parts = String(value || '').split(',').map((v) => Number(String(v).trim()));
  if (parts.length >= 4 && parts.slice(0, 4).every(Number.isFinite)) return parts.slice(0, 4);
  return null;
}

async function requestVworldData(paramsObj) {
  const key = getVworldKey();
  if (!key) {
    const err = new Error('VWORLD_API_KEY 환경변수가 없습니다.');
    err.code = 'NO_VWORLD_KEY';
    throw err;
  }
  const params = appendDefinedParams(new URLSearchParams(), {
    service: 'data',
    request: 'GetFeature',
    version: '2.0',
    data: CADASTRAL_DATA_ID,
    format: 'json',
    crs: 'EPSG:4326',
    key,
    page: '1',
    size: '1000',
    ...paramsObj
  });
  const url = `${VWORLD_DATA_URL}?${params.toString()}`;
  return fetchJsonWithTimeout(url, 30000);
}

async function fetchByPnu(pnu) {
  const payload = await requestVworldData({
    attrFilter: `pnu:=:${pnu}`,
    size: '10'
  });
  const features = normalizeFeatureCollection(payload);
  return features.map((feature) => ({ ...feature, pnu: feature.pnu || pnu }));
}

async function fetchByBbox(bbox, limit) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const size = Math.max(1, Math.min(Number(limit || 500), 1000));
  const payload = await requestVworldData({
    geomFilter: `BOX(${minLng},${minLat},${maxLng},${maxLat})`,
    size: String(size)
  });
  return normalizeFeatureCollection(payload);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, message: 'Method not allowed' });
  }
  try {
    const input = getInput(req);
    const rawList = Array.isArray(input.pnuList)
      ? input.pnuList
      : String(input.pnuList || input.pnus || '').split(/[\s,|]+/);
    const pnuList = uniquePnuList(rawList);
    const bbox = parseBbox(input.bbox);
    const limit = Number(input.limit || 500);

    let parcels = [];
    const failed = [];

    if (pnuList.length) {
      const maxPnu = Math.min(pnuList.length, 80);
      for (let i = 0; i < maxPnu; i += 1) {
        const pnu = pnuList[i];
        try {
          const rows = await fetchByPnu(pnu);
          if (rows.length) parcels.push(...rows);
          else failed.push({ pnu, message: 'NO_FEATURE' });
        } catch (e) {
          failed.push({ pnu, message: text(e && e.message) || 'FETCH_FAILED' });
        }
      }
    } else if (bbox) {
      parcels = await fetchByBbox(bbox, limit);
    } else {
      return sendJson(res, 400, { ok: false, message: 'pnuList 또는 bbox가 필요합니다.' });
    }

    const deduped = [];
    const seen = new Set();
    parcels.forEach((parcel) => {
      const key = `${parcel.pnu || ''}:${JSON.stringify(parcel.geometry).slice(0, 80)}`;
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(parcel);
    });

    return sendJson(res, 200, {
      ok: true,
      parcels: deduped,
      failed,
      requested: { pnuCount: pnuList.length, bbox, limit },
      source: 'vworld:data:GetFeature:LP_PA_CBND_BUBUN'
    });
  } catch (e) {
    const isAbort = e && e.name === 'AbortError';
    return sendJson(res, isAbort ? 504 : 500, {
      ok: false,
      message: isAbort ? '필지 폴리곤 조회 시간이 초과되었습니다.' : '필지 폴리곤 조회 실패',
      error: String((e && e.message) || e || '')
    });
  }
};
