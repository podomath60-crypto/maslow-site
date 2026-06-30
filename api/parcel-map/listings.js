const {
  sendJson,
  getInput,
  text,
  parseMaybeJson,
  fetchGas,
  uniquePnuList
} = require('./_common');

function firstHero(raw) {
  const photos = parseMaybeJson(raw && raw.photoUrlsJson, []);
  if (!Array.isArray(photos)) return '';
  const found = photos.find((item) => item && (item.url || item.src));
  return text(found && (found.url || found.src));
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
    const pnu = String(parcel.pnu || parcel.PNU || '').replace(/\D/g, '');
    return {
      parcelId: text(parcel.parcelId) || `${listingNumber || 'LISTING'}-P${String(idx + 1).padStart(3, '0')}`,
      listingNumber: text(parcel.listingNumber) || listingNumber,
      parcelOrder: Number(parcel.parcelOrder || idx + 1),
      isRepresentative: /^(Y|YES|TRUE|1)$/i.test(String(parcel.isRepresentative || (idx === 0 ? 'Y' : ''))),
      parcelStatus: text(parcel.parcelStatus || 'active'),
      pnu: /^\d{19}$/.test(pnu) ? pnu : '',
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
  (Array.isArray(landParcels) ? landParcels : []).forEach((parcel) => candidates.push(parcel && parcel.pnu));
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
