const GAS_URL = 'https://script.google.com/macros/s/AKfycbznhBvYFIv_GKeNoGIPFTi_mIXXH04BOvYrb4ZN9dk_Cc4Xjir3TP_vL3bbPrLLxgg2/exec';
const VWORLD_DATA_URL = 'https://api.vworld.kr/req/data';
const VWORLD_DATA_HTTP_URL = 'http://api.vworld.kr/req/data';
const VWORLD_SEARCH_URL = 'https://api.vworld.kr/req/search';
const VWORLD_WFS_URL = 'https://api.vworld.kr/req/wfs';
const VWORLD_WFS_HTTP_URL = 'http://api.vworld.kr/req/wfs';
const CADASTRAL_DATA_ID = 'LP_PA_CBND_BUBUN';

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.end(JSON.stringify(payload));
}

function getInput(req) {
  if (req.method === 'POST') {
    if (req.body && typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body || '{}'); } catch (_) { return {}; }
    }
    return {};
  }
  return req.query || {};
}

function text(value) {
  return value == null ? '' : String(value).trim();
}

function parseGasPayload(bodyText) {
  const raw = String(bodyText || '').trim();
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (_) {}
  const match = raw.match(/^[\w$.]+\(([\s\S]*)\);?$/);
  if (match && match[1]) return JSON.parse(match[1]);
  throw new Error('GAS_NON_JSON_RESPONSE');
}

function parseMaybeJson(value, fallback) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') return value;
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch (_) { return fallback; }
}

async function fetchGas(payload, options = {}) {
  const controller = new AbortController();
  const timeoutMs = Number(options.timeoutMs || 55000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        'Accept': 'application/json, text/plain, */*'
      },
      body: JSON.stringify(payload || {}),
      signal: controller.signal
    });
    const body = await res.text();
    if (!res.ok) {
      const err = new Error(`GAS_HTTP_${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return parseGasPayload(body);
  } finally {
    clearTimeout(timer);
  }
}

function getVworldKey() {
  return process.env.VWORLD_API_KEY || '';
}


function getVworldDomain(req) {
  const explicit = process.env.VWORLD_DOMAIN || process.env.VERCEL_PROJECT_PRODUCTION_URL || '';
  let host = explicit || (req && req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || '';
  host = String(host || '').trim();
  if (!host) return '';
  host = host.replace(/^https?:\/\//i, '').replace(/\/+$/g, '');
  return host;
}

function compactVworldError(payload) {
  const response = payload && payload.response;
  if (!response) return '';
  const status = response.status || response.Status || '';
  const error = response.error || response.Error || {};
  const code = error.code || error.Code || '';
  const textMsg = error.text || error.message || error.Text || error.Message || '';
  return [status, code, textMsg].filter(Boolean).join(' / ');
}

function appendDefinedParams(params, values) {
  Object.keys(values || {}).forEach((key) => {
    const value = values[key];
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });
  return params;
}

async function fetchJsonWithTimeout(url, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (compatible; MaslowParcelMap/1.0)'
      },
      signal: controller.signal
    });
    const body = await res.text();
    if (!res.ok) {
      const err = new Error(`HTTP_${res.status}`);
      err.status = res.status;
      err.statusText = res.statusText || '';
      err.body = body;
      throw err;
    }
    try { return JSON.parse(body); } catch (e) {
      const err = new Error('NON_JSON_RESPONSE');
      err.body = body;
      throw err;
    }
  } catch (e) {
    if (!e.status && e && e.cause) {
      e.causeMessage = e.cause.message || String(e.cause || '');
      e.causeCode = e.cause.code || '';
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}


function uniquePnuList(values) {
  const out = [];
  const seen = new Set();
  (Array.isArray(values) ? values : []).forEach((value) => {
    const pnu = String(value || '').replace(/\D/g, '');
    if (!/^\d{19}$/.test(pnu) || seen.has(pnu)) return;
    seen.add(pnu);
    out.push(pnu);
  });
  return out;
}

function extractPnuFromProps(props) {
  props = props || {};
  const candidates = [
    props.pnu, props.PNU, props.Pnu, props.pnu_cd, props.PNU_CD, props.pnuCode,
    props.PNUCODE, props.a0, props.A0, props.id, props.ID
  ];
  for (const value of candidates) {
    const pnu = String(value || '').replace(/\D/g, '');
    if (/^\d{19}$/.test(pnu)) return pnu;
  }
  return '';
}

function getFeatureCollection(payload) {
  if (payload && payload.type === 'FeatureCollection') return payload;
  if (payload && payload.featureCollection) return payload.featureCollection;
  if (payload && payload.response && payload.response.result && payload.response.result.featureCollection) return payload.response.result.featureCollection;
  return null;
}

function normalizeFeature(feature) {
  if (!feature || typeof feature !== 'object') return null;
  const props = feature.properties || {};
  const pnu = extractPnuFromProps(props);
  const geometry = feature.geometry || null;
  if (!geometry || !geometry.coordinates) return null;
  const address = text(props.addr || props.ADDR || props.jibun || props.JIBUN || props.pnu_nm || props.PNU_NM || props.bonbun || '');
  return {
    pnu,
    geometry,
    properties: props,
    address,
    areaM2: text(props.area || props.AREA || props.jiga_parea || props.JIGA_PAREA || ''),
    landCategory: text(props.jimok || props.JIMOK || props.jimok_nm || props.JIMOK_NM || ''),
    source: 'vworld-cadastral'
  };
}

function normalizeFeatureCollection(payload) {
  const fc = getFeatureCollection(payload);
  const features = Array.isArray(fc && fc.features) ? fc.features : [];
  return features.map(normalizeFeature).filter(Boolean);
}

module.exports = {
  GAS_URL,
  VWORLD_DATA_URL,
  VWORLD_DATA_HTTP_URL,
  VWORLD_SEARCH_URL,
  VWORLD_WFS_URL,
  VWORLD_WFS_HTTP_URL,
  CADASTRAL_DATA_ID,
  sendJson,
  getInput,
  text,
  parseMaybeJson,
  fetchGas,
  getVworldKey,
  appendDefinedParams,
  fetchJsonWithTimeout,
  getVworldDomain,
  compactVworldError,
  uniquePnuList,
  extractPnuFromProps,
  normalizeFeatureCollection
};
