const {
  VWORLD_DATA_URL,
  VWORLD_WFS_URL,
  CADASTRAL_DATA_ID,
  sendJson,
  getInput,
  getVworldKey,
  getVworldDomain,
  compactVworldError,
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

function assertVworldOk(payload, context) {
  const response = payload && payload.response;
  if (!response) return;
  const status = String(response.status || response.Status || '').toUpperCase();
  if (!status || status === 'OK' || status === 'NOT_FOUND') return;
  const msg = compactVworldError(payload) || 'VWORLD_ERROR';
  const err = new Error(`${context || 'VWORLD'}: ${msg}`);
  err.vworldPayload = payload;
  throw err;
}

function normalizeAndTag(payload, fallbackPnu) {
  assertVworldOk(payload, 'VWORLD_DATA');
  return normalizeFeatureCollection(payload).map((feature) => ({ ...feature, pnu: feature.pnu || fallbackPnu || '' })).filter((feature) => feature.geometry && feature.coordinates !== null);
}

async function requestVworldData(paramsObj, req, timeoutMs = 25000) {
  const key = getVworldKey();
  if (!key) {
    const err = new Error('VWORLD_API_KEY 환경변수가 없습니다.');
    err.code = 'NO_VWORLD_KEY';
    throw err;
  }
  const domain = getVworldDomain(req);
  const params = appendDefinedParams(new URLSearchParams(), {
    service: 'data',
    request: 'GetFeature',
    version: '2.0',
    data: CADASTRAL_DATA_ID,
    format: 'json',
    geometry: 'true',
    attribute: 'true',
    crs: 'EPSG:4326',
    key,
    domain,
    page: '1',
    size: '1000',
    ...paramsObj
  });
  const url = `${VWORLD_DATA_URL}?${params.toString()}`;
  const payload = await fetchJsonWithTimeout(url, timeoutMs);
  assertVworldOk(payload, 'VWORLD_DATA');
  return payload;
}

async function requestVworldWfs(paramsObj, req, timeoutMs = 25000) {
  const key = getVworldKey();
  if (!key) throw new Error('VWORLD_API_KEY 환경변수가 없습니다.');
  const domain = getVworldDomain(req);
  const params = appendDefinedParams(new URLSearchParams(), {
    service: 'WFS',
    request: 'GetFeature',
    version: '1.1.0',
    typename: CADASTRAL_DATA_ID,
    output: 'application/json',
    srsName: 'EPSG:4326',
    key,
    domain,
    maxFeatures: '1000',
    ...paramsObj
  });
  const url = `${VWORLD_WFS_URL}?${params.toString()}`;
  return fetchJsonWithTimeout(url, timeoutMs);
}

async function fetchByPnu(pnu, req) {
  const payload = await requestVworldData({
    attrFilter: `pnu:=:${pnu}`,
    size: '10'
  }, req, 18000);
  const rows = normalizeAndTag(payload, pnu);
  return rows.map((feature) => ({ ...feature, pnu: feature.pnu || pnu }));
}

async function fetchByBbox(bbox, limit, req) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const size = Math.max(1, Math.min(Number(limit || 450), 1000));
  const boxText = `${minLng},${minLat},${maxLng},${maxLat}`;
  try {
    const payload = await requestVworldData({
      geomFilter: `BOX(${boxText})`,
      size: String(size)
    }, req, 25000);
    return normalizeAndTag(payload);
  } catch (dataErr) {
    // 데이터 API bbox가 키/domain/레이어 정책에 걸리는 경우가 있어서 WFS로 한 번 더 확인한다.
    try {
      const payload = await requestVworldWfs({
        bbox: boxText,
        maxFeatures: String(size)
      }, req, 25000);
      const rows = normalizeFeatureCollection(payload);
      if (rows.length) return rows;
      const err = new Error('WFS 응답에 필지 geometry가 없습니다.');
      err.cause = dataErr;
      throw err;
    } catch (wfsErr) {
      const msg = [dataErr && dataErr.message, wfsErr && wfsErr.message].filter(Boolean).join(' / WFS: ');
      const err = new Error(msg || 'bbox 필지 조회 실패');
      err.dataError = dataErr;
      err.wfsError = wfsErr;
      throw err;
    }
  }
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
    const limit = Number(input.limit || 450);

    let parcels = [];
    const failed = [];

    if (pnuList.length) {
      const maxPnu = Math.min(pnuList.length, 80);
      for (let i = 0; i < maxPnu; i += 1) {
        const pnu = pnuList[i];
        try {
          const rows = await fetchByPnu(pnu, req);
          if (rows.length) parcels.push(...rows);
          else failed.push({ pnu, message: 'NO_FEATURE' });
        } catch (e) {
          failed.push({ pnu, message: text(e && e.message) || 'FETCH_FAILED' });
        }
      }
    } else if (bbox) {
      parcels = await fetchByBbox(bbox, limit, req);
    } else {
      return sendJson(res, 400, { ok: false, message: 'pnuList 또는 bbox가 필요합니다.' });
    }

    const deduped = [];
    const seen = new Set();
    parcels.forEach((parcel) => {
      const key = `${parcel.pnu || ''}:${JSON.stringify(parcel.geometry).slice(0, 120)}`;
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(parcel);
    });

    return sendJson(res, 200, {
      ok: true,
      parcels: deduped,
      failed,
      requested: { pnuCount: pnuList.length, bbox, limit, domain: getVworldDomain(req) },
      source: bbox ? 'vworld:data:GetFeature:bbox' : 'vworld:data:GetFeature:pnu',
      count: deduped.length
    });
  } catch (e) {
    const isAbort = e && e.name === 'AbortError';
    return sendJson(res, isAbort ? 504 : 500, {
      ok: false,
      message: isAbort ? '필지 폴리곤 조회 시간이 초과되었습니다.' : '필지 폴리곤 조회 실패',
      error: String((e && e.message) || e || ''),
      hint: 'VWorld Data API에는 geometry=true, attribute=true, domain 파라미터가 필요할 수 있습니다. 현재 서버가 자동으로 host를 domain에 넣어 호출합니다.'
    });
  }
};
