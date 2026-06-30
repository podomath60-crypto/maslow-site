const {
  VWORLD_DATA_URL,
  VWORLD_DATA_HTTP_URL,
  VWORLD_WFS_URL,
  VWORLD_WFS_HTTP_URL,
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

function sanitizeUrl(url) {
  return String(url || '').replace(/([?&]key=)[^&]+/i, '$1***');
}

function bodySnippet(body) {
  return String(body || '').slice(0, 700);
}

function sanitizeParams(params) {
  const out = {};
  for (const [key, value] of params.entries()) {
    if (/^(key|apikey|servicekey)$/i.test(key)) out[key] = '***';
    else out[key] = value;
  }
  return out;
}

function summarizeFetchError(e) {
  return {
    message: text(e && e.message) || 'FETCH_FAILED',
    name: e && e.name || '',
    status: e && e.status || '',
    statusText: e && e.statusText || '',
    causeCode: e && e.causeCode || '',
    causeMessage: e && e.causeMessage || '',
    body: bodySnippet(e && e.body)
  };
}

function summarizePayload(payload) {
  const response = payload && payload.response;
  const fc = payload && (payload.type === 'FeatureCollection' ? payload : null);
  const features = Array.isArray(fc && fc.features)
    ? fc.features
    : Array.isArray(response && response.result && response.result.featureCollection && response.result.featureCollection.features)
      ? response.result.featureCollection.features
      : Array.isArray(payload && payload.features)
        ? payload.features
        : [];
  return {
    topType: payload && payload.type || '',
    status: response && (response.status || response.Status) || '',
    error: compactVworldError(payload),
    featureCount: features.length,
    resultKeys: response && response.result ? Object.keys(response.result).slice(0, 12) : []
  };
}

function pushDebug(logs, entry) {
  if (!Array.isArray(logs)) return;
  logs.push({
    at: new Date().toISOString(),
    ...entry
  });
  if (logs.length > 30) logs.splice(0, logs.length - 30);
}

function enrichError(err, logs) {
  if (err && Array.isArray(logs)) err.debugLogs = logs.slice();
  return err;
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
  return normalizeFeatureCollection(payload)
    .map((feature) => ({ ...feature, pnu: feature.pnu || fallbackPnu || '' }))
    .filter((feature) => feature.geometry && feature.geometry.coordinates);
}

async function requestVworldData(paramsObj, req, timeoutMs = 25000, logs, phase = 'data') {
  const key = getVworldKey();
  if (!key) {
    const err = new Error('VWORLD_API_KEY 환경변수가 없습니다.');
    err.code = 'NO_VWORLD_KEY';
    throw enrichError(err, logs);
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
  const endpoints = [
    { label: 'https', base: VWORLD_DATA_URL },
    { label: 'http', base: VWORLD_DATA_HTTP_URL }
  ].filter((entry) => entry.base);
  const errors = [];
  for (const endpoint of endpoints) {
    const url = `${endpoint.base}?${params.toString()}`;
    pushDebug(logs, {
      phase: `${phase}:request:${endpoint.label}`,
      api: 'vworld-data',
      url: sanitizeUrl(url),
      domain,
      data: CADASTRAL_DATA_ID,
      params: sanitizeParams(params)
    });
    try {
      const payload = await fetchJsonWithTimeout(url, timeoutMs);
      pushDebug(logs, {
        phase: `${phase}:response:${endpoint.label}`,
        api: 'vworld-data',
        summary: summarizePayload(payload)
      });
      assertVworldOk(payload, 'VWORLD_DATA');
      return payload;
    } catch (e) {
      const summary = summarizeFetchError(e);
      errors.push(`${endpoint.label}:${summary.message}${summary.status ? ':' + summary.status : ''}${summary.causeMessage ? ':' + summary.causeMessage : ''}`);
      pushDebug(logs, {
        phase: `${phase}:error:${endpoint.label}`,
        api: 'vworld-data',
        ...summary
      });
    }
  }
  const err = new Error(errors.join(' / ') || 'VWORLD_DATA_FETCH_FAILED');
  throw enrichError(err, logs);
}


async function requestVworldWfs(paramsObj, req, timeoutMs = 25000, logs, phase = 'wfs') {
  const key = getVworldKey();
  if (!key) throw enrichError(new Error('VWORLD_API_KEY 환경변수가 없습니다.'), logs);
  if (!VWORLD_WFS_URL && !VWORLD_WFS_HTTP_URL) throw enrichError(new Error('VWORLD_WFS_URL 상수가 export되지 않았습니다.'), logs);
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
  const endpoints = [
    { label: 'https', base: VWORLD_WFS_URL },
    { label: 'http', base: VWORLD_WFS_HTTP_URL }
  ].filter((entry) => entry.base);
  const errors = [];
  for (const endpoint of endpoints) {
    const url = `${endpoint.base}?${params.toString()}`;
    pushDebug(logs, {
      phase: `${phase}:request:${endpoint.label}`,
      api: 'vworld-wfs',
      url: sanitizeUrl(url),
      domain,
      typename: CADASTRAL_DATA_ID,
      params: sanitizeParams(params)
    });
    try {
      const payload = await fetchJsonWithTimeout(url, timeoutMs);
      pushDebug(logs, {
        phase: `${phase}:response:${endpoint.label}`,
        api: 'vworld-wfs',
        summary: summarizePayload(payload)
      });
      return payload;
    } catch (e) {
      const summary = summarizeFetchError(e);
      errors.push(`${endpoint.label}:${summary.message}${summary.status ? ':' + summary.status : ''}${summary.causeMessage ? ':' + summary.causeMessage : ''}`);
      pushDebug(logs, {
        phase: `${phase}:error:${endpoint.label}`,
        api: 'vworld-wfs',
        ...summary
      });
    }
  }
  const err = new Error(errors.join(' / ') || 'VWORLD_WFS_FETCH_FAILED');
  throw enrichError(err, logs);
}


async function fetchByPnu(pnu, req, logs) {
  const payload = await requestVworldData({
    attrFilter: `pnu:=:${pnu}`,
    size: '10'
  }, req, 18000, logs, `pnu:${pnu}`);
  const rows = normalizeAndTag(payload, pnu);
  pushDebug(logs, { phase: `pnu:${pnu}:normalized`, count: rows.length });
  return rows.map((feature) => ({ ...feature, pnu: feature.pnu || pnu }));
}

async function fetchByBbox(bbox, limit, req, logs) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const size = Math.max(1, Math.min(Number(limit || 450), 1000));
  const boxText = `${minLng},${minLat},${maxLng},${maxLat}`;
  pushDebug(logs, { phase: 'bbox:start', bbox, boxText, limit: size });
  try {
    const payload = await requestVworldData({
      geomFilter: `BOX(${boxText})`,
      size: String(size)
    }, req, 25000, logs, 'bbox:data');
    const rows = normalizeAndTag(payload);
    pushDebug(logs, { phase: 'bbox:data:normalized', count: rows.length });
    return rows;
  } catch (dataErr) {
    pushDebug(logs, { phase: 'bbox:data:fallback-to-wfs', reason: text(dataErr && dataErr.message) });
    try {
      const payload = await requestVworldWfs({
        bbox: boxText,
        maxFeatures: String(size)
      }, req, 25000, logs, 'bbox:wfs');
      const rows = normalizeFeatureCollection(payload);
      pushDebug(logs, { phase: 'bbox:wfs:normalized', count: rows.length });
      if (rows.length) return rows;
      const err = new Error('WFS 응답에 필지 geometry가 없습니다.');
      err.cause = dataErr;
      throw enrichError(err, logs);
    } catch (wfsErr) {
      const msg = [dataErr && dataErr.message, wfsErr && wfsErr.message].filter(Boolean).join(' / WFS: ');
      const err = new Error(msg || 'bbox 필지 조회 실패');
      err.dataError = dataErr;
      err.wfsError = wfsErr;
      throw enrichError(err, logs);
    }
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, message: 'Method not allowed' });
  }
  const debug = [];
  try {
    const input = getInput(req);
    const rawList = Array.isArray(input.pnuList)
      ? input.pnuList
      : String(input.pnuList || input.pnus || '').split(/[\s,|]+/);
    const pnuList = uniquePnuList(rawList);
    const bbox = parseBbox(input.bbox);
    const limit = Number(input.limit || 450);
    pushDebug(debug, {
      phase: 'handler:input',
      method: req.method,
      mode: pnuList.length ? 'pnuList' : (bbox ? 'bbox' : 'none'),
      pnuCount: pnuList.length,
      bbox,
      limit,
      domain: getVworldDomain(req),
      hasKey: !!getVworldKey()
    });

    let parcels = [];
    const failed = [];

    if (pnuList.length) {
      const maxPnu = Math.min(pnuList.length, 80);
      for (let i = 0; i < maxPnu; i += 1) {
        const pnu = pnuList[i];
        try {
          const rows = await fetchByPnu(pnu, req, debug);
          if (rows.length) parcels.push(...rows);
          else failed.push({ pnu, message: 'NO_FEATURE' });
        } catch (e) {
          failed.push({ pnu, message: text(e && e.message) || 'FETCH_FAILED' });
        }
      }
    } else if (bbox) {
      parcels = await fetchByBbox(bbox, limit, req, debug);
    } else {
      pushDebug(debug, { phase: 'handler:error', message: 'pnuList 또는 bbox가 필요합니다.' });
      return sendJson(res, 400, { ok: false, message: 'pnuList 또는 bbox가 필요합니다.', debug });
    }

    const deduped = [];
    const seen = new Set();
    parcels.forEach((parcel) => {
      const key = `${parcel.pnu || ''}:${JSON.stringify(parcel.geometry).slice(0, 120)}`;
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(parcel);
    });
    pushDebug(debug, { phase: 'handler:done', rawCount: parcels.length, dedupedCount: deduped.length, failedCount: failed.length });

    return sendJson(res, 200, {
      ok: true,
      parcels: deduped,
      failed,
      requested: { pnuCount: pnuList.length, bbox, limit, domain: getVworldDomain(req) },
      source: bbox ? 'vworld:data/GetFeature:bbox+fallback-wfs' : 'vworld:data/GetFeature:pnu',
      count: deduped.length,
      debug
    });
  } catch (e) {
    const isAbort = e && e.name === 'AbortError';
    pushDebug(debug, {
      phase: 'handler:catch',
      message: text(e && e.message) || String(e || ''),
      name: e && e.name || '',
      status: e && e.status || '',
      body: bodySnippet(e && e.body)
    });
    return sendJson(res, isAbort ? 504 : 500, {
      ok: false,
      message: isAbort ? '필지 폴리곤 조회 시간이 초과되었습니다.' : '필지 폴리곤 조회 실패',
      error: String((e && e.message) || e || ''),
      hint: 'debug 배열에서 handler:input → bbox:data:request → bbox:data:response/error → bbox:wfs:* 순서로 어디서 실패했는지 확인하세요.',
      debug: (e && e.debugLogs) || debug
    });
  }
};
