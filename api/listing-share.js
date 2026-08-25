const fs = require('fs/promises');
const path = require('path');

const GAS_URL = 'https://script.google.com/macros/s/AKfycbznhBvYFIv_GKeNoGIPFTi_mIXXH04BOvYrb4ZN9dk_Cc4Xjir3TP_vL3bbPrLLxgg2/exec';
const SITE_ORIGIN = 'https://www.maslowkorea.site';
const TEMPLATE_PATH = path.join(process.cwd(), 'listings', 'index.html');
const FETCH_TIMEOUT_MS = 9000;

let templatePromise;

function text(value) {
  return String(value == null ? '' : value).trim();
}

function firstNonEmpty() {
  for (let index = 0; index < arguments.length; index += 1) {
    const value = text(arguments[index]);
    if (value) return value;
  }
  return '';
}

function escapeAttribute(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeUrl(value) {
  const candidate = text(value);
  if (!candidate) return '';

  try {
    return new URL(candidate, SITE_ORIGIN).href;
  } catch (_) {
    return '';
  }
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!text(value)) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function photoUrl(value) {
  if (typeof value === 'string') return normalizeUrl(value);
  if (!value || typeof value !== 'object') return '';
  return normalizeUrl(firstNonEmpty(value.url, value.src, value.image, value.thumbnailUrl));
}

function firstPhotoFromList(value) {
  const list = parseJsonArray(value);
  for (let index = 0; index < list.length; index += 1) {
    const url = photoUrl(list[index]);
    if (url) return url;
  }
  return '';
}

function extractFirstPhoto(item) {
  const source = item && typeof item === 'object' ? item : {};
  return firstNonEmpty(
    firstPhotoFromList(source.photos),
    firstPhotoFromList(source.photoUrls),
    firstPhotoFromList(source.photoUrlsJson),
    firstPhotoFromList(source.images),
    photoUrl(source.image),
    photoUrl(source.heroUrl),
    photoUrl(source.heroImageUrl),
    photoUrl(source.thumbnailUrl),
    photoUrl(source.basic && source.basic.image)
  );
}

function setMeta(html, attributeName, key, value) {
  if (!text(value)) return html;
  const expression = new RegExp(
    '<meta\\s+' + escapeRegExp(attributeName) + '=["\\\']' + escapeRegExp(key) + '["\\\'][^>]*>',
    'i'
  );
  const tag = '  <meta ' + attributeName + '="' + escapeAttribute(key) + '" content="' + escapeAttribute(value) + '" />';

  if (expression.test(html)) return html.replace(expression, tag);
  return html.replace('</head>', tag + '\n</head>');
}

function setCanonical(html, url) {
  const tag = '  <link rel="canonical" href="' + escapeAttribute(url) + '" />';
  const expression = /<link\s+rel=["']canonical["'][^>]*>/i;
  if (expression.test(html)) return html.replace(expression, tag);
  return html.replace('</head>', tag + '\n</head>');
}

function setDocumentTitle(html, title) {
  return html.replace(/<title>[\s\S]*?<\/title>/i, '<title>' + escapeAttribute(title) + '</title>');
}

function buildShareUrl(listingNumber) {
  const url = new URL('/listings', SITE_ORIGIN);
  url.searchParams.set('open', '1');
  url.searchParams.set('listingNumber', listingNumber);
  return url.href;
}

function buildListingHtml(template, item, listingNumber) {
  const image = extractFirstPhoto(item);
  if (!image) return template;

  const rawTitle = firstNonEmpty(item && item.title, item && item.cardTitle, listingNumber);
  const title = 'MASLOW - ' + rawTitle;
  const description = '매물번호 ' + listingNumber + '의 상세 조건과 사진을 확인하세요.';
  const shareUrl = buildShareUrl(listingNumber);

  let html = setDocumentTitle(template, title);
  html = setCanonical(html, shareUrl);
  html = setMeta(html, 'property', 'og:title', title);
  html = setMeta(html, 'property', 'og:description', description);
  html = setMeta(html, 'property', 'og:image', image);
  html = setMeta(html, 'property', 'og:image:secure_url', image);
  html = setMeta(html, 'property', 'og:image:alt', rawTitle + ' 첫 번째 매물 사진');
  html = setMeta(html, 'property', 'og:url', shareUrl);
  html = setMeta(html, 'name', 'twitter:title', title);
  html = setMeta(html, 'name', 'twitter:description', description);
  html = setMeta(html, 'name', 'twitter:image', image);
  html = setMeta(html, 'name', 'twitter:image:alt', rawTitle + ' 첫 번째 매물 사진');
  return html;
}

function normalizeListingNumber(value) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const normalized = text(candidate);
  return /^[A-Za-z0-9_-]{1,100}$/.test(normalized) ? normalized : '';
}

async function loadTemplate() {
  if (!templatePromise) templatePromise = fs.readFile(TEMPLATE_PATH, 'utf8');
  return templatePromise;
}

async function fetchListing(listingNumber) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(GAS_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'text/plain;charset=UTF-8'
      },
      body: JSON.stringify({
        action: 'getPropertyByListingNumber',
        listingNumber
      }),
      signal: controller.signal
    });

    if (!response.ok) throw new Error('GAS_HTTP_' + response.status);
    const payload = await response.json();
    return payload && (payload.item || payload.property || (payload.data && payload.data.item)) || null;
  } finally {
    clearTimeout(timer);
  }
}

function sendHtml(req, res, html, cacheControl) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(req.method === 'HEAD' ? '' : html);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    return res.end('Method not allowed');
  }

  const template = await loadTemplate();
  const listingNumber = normalizeListingNumber(req.query && req.query.listingNumber);
  if (!listingNumber) {
    return sendHtml(req, res, template, 'public, s-maxage=300, stale-while-revalidate=3600');
  }

  try {
    const item = await fetchListing(listingNumber);
    const html = item ? buildListingHtml(template, item, listingNumber) : template;
    const hasListingPhoto = Boolean(item && extractFirstPhoto(item));
    return sendHtml(
      req,
      res,
      html,
      hasListingPhoto
        ? 'public, s-maxage=300, stale-while-revalidate=86400'
        : 'public, s-maxage=60, stale-while-revalidate=3600'
    );
  } catch (error) {
    console.error('listing share metadata fetch failed', {
      listingNumber,
      message: error && error.message ? error.message : String(error)
    });
    return sendHtml(req, res, template, 'public, s-maxage=30, stale-while-revalidate=300');
  }
};

module.exports._test = {
  buildListingHtml,
  extractFirstPhoto,
  normalizeListingNumber
};


