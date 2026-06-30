const fs = require('fs');
const path = require('path');

const {
  sendJson,
  getInput,
  text,
  parseMaybeJson,
  fetchGas,
  uniquePnuList
} = require('./_common');

function firstNumber(values) {
  const list = Array.isArray(values) ? values : [values];
  for (const value of list) {
    const n = Number(String(value == null ? '' : value).trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function firstHero(raw) {
  const photos = parseMaybeJson(raw && raw.photoUrlsJson, []);
  if (!Array.isArray(photos)) return '';
  const found = photos.find((item) => item && (item.url || item.src));
  return text(found && (found.url || found.src));
}



let bjdongCodesCache = null;

function loadBjdongCodes() {
  if (Array.isArray(bjdongCodesCache)) return bjdongCodesCache;

  // 대시보드/매물입력기의 땅야 연결이 쓰는 동일 법정동 코드 파일을 서버에서도 사용한다.
  // Vercel 함수 번들에 포함되도록 정적 require를 먼저 시도하고, 실패 시 파일 읽기로 보조한다.
  try {
    const previousWindow = global.window;
    const tempWindow = previousWindow && typeof previousWindow === 'object' ? previousWindow : {};
    global.window = tempWindow;
    require('../../search/bjdong-codes.js');
    if (Array.isArray(global.window.BJDONG_CODES)) {
      bjdongCodesCache = global.window.BJDONG_CODES;
      if (!previousWindow) delete global.window;
      return bjdongCodesCache;
    }
    if (!previousWindow) delete global.window;
  } catch (_) {
    try { if (!global.window || !Array.isArray(global.window.BJDONG_CODES)) delete global.window; } catch (__) {}
  }

  try {
    const candidates = [
      path.join(process.cwd(), 'search', 'bjdong-codes.js'),
      path.join(__dirname, '..', '..', 'search', 'bjdong-codes.js')
    ];
    const filePath = candidates.find((candidate) => fs.existsSync(candidate));
    if (!filePath) {
      bjdongCodesCache = [];
      return bjdongCodesCache;
    }
    const body = fs.readFileSync(filePath, 'utf8');
    const match = body.match(/window\.BJDONG_CODES\s*=\s*(\[[\s\S]*\])\s*;?\s*$/);
    bjdongCodesCache = match && match[1] ? JSON.parse(match[1]) : [];
    return bjdongCodesCache;
  } catch (_) {
    bjdongCodesCache = [];
    return bjdongCodesCache;
  }
}

function normalizeBjdongText(value) {
  let valueText = text(value);
  valueText = valueText.replace(/\([^)]*\)/g, ' ');
  valueText = valueText.replace(/\[[^\]]*\]/g, ' ');
  valueText = valueText.replace(/,/g, ' ');
  valueText = valueText.replace(/\s+/g, ' ').trim();
  valueText = valueText.replace(/^전북\s+/, '전북특별자치도 ');
  valueText = valueText.replace(/^전라북도\s+/, '전북특별자치도 ');
  valueText = valueText.replace(/^전북특별자치도\s*전북특별자치도\s+/, '전북특별자치도 ');
  valueText = valueText.replace(/([가-힣]+시)([가-힣]+구)(\s|$)/g, '$1 $2$3');
  return valueText.replace(/\s+/g, ' ').trim();
}

function parseJibunAddressCandidates(address) {
  const clean = normalizeBjdongText(address);
  const matches = [];
  const re = /(산\s*)?(\d+)(?:\s*-\s*(\d+))?/g;
  let match;
  while ((match = re.exec(clean))) {
    const legalName = clean.slice(0, match.index).replace(/(?:번지|일원|필지|외)\s*$/g, '').trim();
    if (!legalName || !match[2]) continue;
    matches.push({
      legalName,
      mountain: !!match[1],
      main: match[2],
      sub: match[3] || '0'
    });
  }
  return matches;
}

function findBjdongCode(legalName) {
  const codes = loadBjdongCodes();
  const target = normalizeBjdongText(legalName);
  if (!target || !Array.isArray(codes) || !codes.length) return '';
  let found = codes.find((row) => normalizeBjdongText(row && row.name) === target);
  if (found && found.code) return String(found.code);
  found = codes
    .filter((row) => {
      const name = normalizeBjdongText(row && row.name);
      return name && (target === name || target.indexOf(name + ' ') === 0 || name.indexOf(target + ' ') === 0);
    })
    .sort((a, b) => String((b && b.name) || '').length - String((a && a.name) || '').length)[0];
  return found && found.code ? String(found.code) : '';
}

function buildPnuFromJibunAddress(address) {
  const candidates = parseJibunAddressCandidates(address);
  // 대시보드/매물입력기 로직은 마지막 지번을 사용한다. 다만 "외 2필지" 같은 꼬리 숫자가 있으면
  // 마지막 후보가 실패할 수 있어 뒤에서부터 성공하는 후보를 사용한다.
  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const parsed = candidates[i];
    const code = findBjdongCode(parsed.legalName);
    if (!/^\d{10}$/.test(code)) continue;
    const main = String(parsed.main || '').padStart(4, '0');
    const sub = String(parsed.sub || '0').padStart(4, '0');
    if (!/^\d{4}$/.test(main) || !/^\d{4}$/.test(sub)) continue;
    return code + (parsed.mountain ? '2' : '1') + main + sub;
  }
  return '';
}

function buildPnuFromAddressSources(values) {
  const sources = Array.isArray(values) ? values : [values];
  for (const source of sources) {
    const pnu = buildPnuFromJibunAddress(source);
    if (/^\d{19}$/.test(pnu)) return pnu;
  }
  return '';
}

function normalizeDashboardStatus(value) {
  const parsed = parseMaybeJson(value, {});
  const src = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  return {
    internal: src.internal === true,
    needsWork: src.needsWork === true,
    needsPhoto: src.needsPhoto === true,
    needsContact: src.needsContact === true,
    dealDone: src.dealDone === true,
    reviewHold: src.reviewHold === true
  };
}

function normalizeLandParcels(value, listingNumber) {
  const parsed = parseMaybeJson(value, []);
  const arr = Array.isArray(parsed) ? parsed : [];
  return arr.map((parcel, idx) => {
    parcel = parcel || {};
    const addressSources = [parcel.address, parcel.displayAddress, parcel.jibun].map(text).filter(Boolean);
    const directPnu = String(parcel.pnu || parcel.PNU || '').replace(/\D/g, '');
    const generatedPnu = /^\d{19}$/.test(directPnu) ? directPnu : buildPnuFromAddressSources(addressSources);
    return {
      parcelId: text(parcel.parcelId) || `${listingNumber || 'LISTING'}-P${String(idx + 1).padStart(3, '0')}`,
      listingNumber: text(parcel.listingNumber) || listingNumber,
      parcelOrder: Number(parcel.parcelOrder || idx + 1),
      isRepresentative: /^(Y|YES|TRUE|1)$/i.test(String(parcel.isRepresentative || (idx === 0 ? 'Y' : ''))),
      parcelStatus: text(parcel.parcelStatus || 'active'),
      pnu: /^\d{19}$/.test(generatedPnu) ? generatedPnu : '',
      address: text(parcel.address),
      displayAddress: text(parcel.displayAddress),
      jibun: text(parcel.jibun),
      areaM2: text(parcel.areaM2),
      areaPy: text(parcel.areaPy),
      landCategory: text(parcel.landCategory),
      zoning1: text(parcel.zoning1),
      zoning2: text(parcel.zoning2),
      baseYearMonth: text(parcel.baseYearMonth),
      landUseSituation: text(parcel.landUseSituation),
      roadSide: text(parcel.roadSide),
      roadAccess: text(parcel.roadAccess),
      terrainHeight: text(parcel.terrainHeight),
      terrainShape: text(parcel.terrainShape),
      officialLandPrice: text(parcel.officialLandPrice),
      officialLandPriceTotal: text(parcel.officialLandPriceTotal),
      usePlanSummary: text(parcel.usePlanSummary),
      restrictionMemo: text(parcel.restrictionMemo)
    };
  }).filter((parcel) => parcel.parcelStatus.toLowerCase() !== 'deleted');
}

function pnuCandidates(raw, landParcels) {
  const candidates = [];
  const directFields = ['pnu', 'PNU', 'landPnu', 'parcelPnu', 'representativePnu', 'primaryPnu'];
  directFields.forEach((key) => candidates.push(raw && raw[key]));
  const listFields = ['pnuList', 'pnus', 'pnuListJson', 'parcelPnuList'];
  listFields.forEach((key) => {
    const parsed = parseMaybeJson(raw && raw[key], []);
    if (Array.isArray(parsed)) parsed.forEach((v) => candidates.push(v));
    else candidates.push(raw && raw[key]);
  });
  (Array.isArray(landParcels) ? landParcels : []).forEach((parcel) => {
    candidates.push(parcel && parcel.pnu);
    candidates.push(buildPnuFromAddressSources([
      parcel && parcel.address,
      parcel && parcel.displayAddress,
      parcel && parcel.jibun
    ]));
  });

  candidates.push(buildPnuFromAddressSources([
    raw && raw.address,
    raw && raw.jibunAddress,
    raw && raw.parcelAddress,
    raw && raw.displayAddress,
    raw && raw.landAddress,
    raw && raw.location
  ]));

  return uniquePnuList(candidates);
}


function classifyKind(raw) {
  const listingNumber = text(raw.listingNumber).toUpperCase();
  const haystack = [raw.propertyType, raw.title, raw.zoning, raw.buildingComposition].map(text).join(' ');
  if (/^DK-/.test(listingNumber)) return 'land';
  if (/토지|대지|임야|잡종지|창고용지|전\b|답\b/.test(haystack) && !/공장|제조/.test(haystack)) return 'land';
  if (/창고|저온|냉장|냉동/.test(haystack)) return 'warehouse';
  if (/상가|상업|근린|근생|사무실|오피스|판매시설|업무시설/.test(haystack)) return 'commercial';
  return 'factory';
}

function normalizeItem(raw) {
  raw = raw || {};
  const listingNumber = text(raw.listingNumber);
  const landParcels = normalizeLandParcels(raw.landParcels, listingNumber);
  const pnuList = pnuCandidates(raw, landParcels);
  const representativeParcel = landParcels.find((parcel) => parcel.isRepresentative && parcel.pnu) || landParcels.find((parcel) => parcel.pnu) || null;
  return {
    listingNumber,
    title: text(raw.title),
    address: text(raw.address),
    lat: firstNumber([raw.lat, raw.latitude, raw.y, raw.mapLat, raw.naverLat]),
    lng: firstNumber([raw.lng, raw.lon, raw.longitude, raw.x, raw.mapLng, raw.naverLng]),
    geocodeAddress: text(raw.geocodeAddress || raw.address),
    dealType: text(raw.dealType),
    price: text(raw.price),
    status: text(raw.status || 'hidden').toLowerCase(),
    createdAt: text(raw.createdAt),
    updatedAt: text(raw.updatedAt),
    lastEditor: text(raw.lastEditedBy || raw.updatedBy || raw.editorName || ''),
    heroUrl: firstHero(raw),
    summary1: text(raw.summary1),
    summary2: text(raw.summary2),
    summary3: text(raw.summary3),
    propertyType: text(raw.propertyType),
    propertyKind: classifyKind(raw),
    zoning: text(raw.zoning),
    approvalDate: text(raw.approvalDate),
    landAreaM2: text(raw.landAreaM2),
    landAreaPy: text(raw.landAreaPy),
    totalFloorAreaM2: text(raw.totalFloorAreaM2),
    totalFloorAreaPy: text(raw.totalFloorAreaPy),
    buildingComposition: text(raw.buildingComposition),
    ceilingHeight: text(raw.ceilingHeight),
    crane: text(raw.crane),
    hoist: text(raw.hoist),
    powerCapacity: text(raw.powerCapacity),
    mainFacilities: text(raw.mainFacilities),
    recommendedUse: text(raw.recommendedUse),
    restrictedUse: text(raw.restrictedUse),
    roadWidth: text(raw.roadWidth),
    doorWidth: text(raw.doorWidth),
    truckAccess: text(raw.truckAccess),
    loadingAvailable: text(raw.loadingAvailable),
    officeIncluded: text(raw.officeIncluded),
    yardSize: text(raw.yardSize),
    readyToOperate: text(raw.readyToOperate),
    requesterName: text(raw.requesterName),
    requesterPhone: text(raw.requesterPhone),
    memo: text(raw.memo),
    memoUpdatedAt: text(raw.memoUpdatedAt),
    dashboardStatusJson: text(raw.dashboardStatusJson),
    dashboardStatus: normalizeDashboardStatus(raw.dashboardStatusJson),
    landParcels,
    pnuList,
    representativePnu: text(representativeParcel && representativeParcel.pnu) || pnuList[0] || '',
    parcelCount: pnuList.length,
    pnuResolved: pnuList.length > 0
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, message: 'Method not allowed' });
  }
  try {
    const input = getInput(req);
    const includeInvisible = String(input.includeInvisible || 'false') === 'true';
    const data = await fetchGas({ action: 'listAdminProperties' });
    const rawItems = Array.isArray(data && data.items) ? data.items : [];
    const items = rawItems.map(normalizeItem).filter((item) => {
      if (includeInvisible) return true;
      return item.status !== 'invisible';
    });
    const stats = items.reduce((acc, item) => {
      acc.total += 1;
      if (item.pnuList.length) acc.withPnu += 1;
      else acc.noPnu += 1;
      if (item.pnuList.length > 1) acc.multiParcel += 1;
      return acc;
    }, { total: 0, withPnu: 0, noPnu: 0, multiParcel: 0 });
    return sendJson(res, 200, { ok: true, items, stats, source: 'gas:listAdminProperties' });
  } catch (e) {
    const isAbort = e && e.name === 'AbortError';
    return sendJson(res, isAbort ? 504 : 500, {
      ok: false,
      message: isAbort ? '매물 목록 응답 시간이 초과되었습니다.' : '매물 목록을 불러오지 못했습니다.',
      error: String((e && e.message) || e || '')
    });
  }
};
