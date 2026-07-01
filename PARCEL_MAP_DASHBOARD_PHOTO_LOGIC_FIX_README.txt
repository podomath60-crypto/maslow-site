PARCEL MAP DASHBOARD PHOTO LOGIC FIX

수정 파일:
- parcel-map/index.html
- api/parcel-map/listings.js

수정 내용:
1. 매물카드 썸네일을 덮고 있던 .thumb:empty::after 회색 오버레이 제거
   - 배경이미지가 있어도 빈 div라서 pseudo-element가 위를 덮고 있었음
   - 대시보드처럼 thumb div의 background-image가 그대로 보이게 변경

2. 대표사진 추출은 대시보드 normalizeItem과 같은 방식으로 정리
   - photoUrlsJson 파싱
   - photos[0].url만 heroUrl로 사용
   - 다른 임의 필드 추측 로직 제거

대시보드 원본 파일은 수정하지 않음.
