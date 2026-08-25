const assert = require('assert');
const fs = require('fs');
const path = require('path');

const listingShare = require('../api/listing-share.js')._test;
const template = fs.readFileSync(path.join(__dirname, '..', 'listings', 'index.html'), 'utf8');

const firstPhoto = 'https://drive.google.com/thumbnail?id=first-photo&sz=w1200';
const secondPhoto = 'https://drive.google.com/thumbnail?id=second-photo&sz=w1200';
const listingNumber = 'MK-260821-6051-hji';

assert.strictEqual(
  listingShare.extractFirstPhoto({ photos: [firstPhoto, secondPhoto] }),
  firstPhoto,
  'photos 배열의 첫 번째 사진을 선택해야 합니다.'
);

assert.strictEqual(
  listingShare.extractFirstPhoto({ photoUrlsJson: JSON.stringify([{ url: firstPhoto }]) }),
  firstPhoto,
  'photoUrlsJson 형식에서도 첫 번째 사진을 선택해야 합니다.'
);

const html = listingShare.buildListingHtml(template, {
  title: '[인천 원창동] 태양광 수익 보장된 스펙 좋은 2동 공장',
  photos: [firstPhoto, secondPhoto]
}, listingNumber);

assert.ok(html.includes('property="og:image" content="' + firstPhoto.replace(/&/g, '&amp;') + '"'));
assert.ok(html.includes('name="twitter:image" content="' + firstPhoto.replace(/&/g, '&amp;') + '"'));
assert.match(html, /property="og:image:secure_url"/);
assert.match(html, /property="og:title" content="MASLOW - \[인천 원창동\] 태양광 수익 보장된 스펙 좋은 2동 공장"/);
assert.match(html, /listingNumber=MK-260821-6051-hji/);
assert.ok(!html.includes('property="og:image" content="https://cdn.imweb.me/thumbnail/20260404/cc7830f0b48cc.jpg"'));

assert.strictEqual(listingShare.normalizeListingNumber(listingNumber), listingNumber);
assert.strictEqual(listingShare.normalizeListingNumber('<script>'), '');

console.log('listing-share OG tests passed');


