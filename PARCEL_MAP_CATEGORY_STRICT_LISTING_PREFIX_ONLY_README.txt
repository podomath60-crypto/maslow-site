parcel-map 분류칩 매물번호 prefix 전용 패치

수정 파일:
- parcel-map/index.html

반영 내용:
1. 산업용/상업용/토지 분류칩은 오직 listingNumber 앞 영문 2자리만 봅니다.
2. MK = 산업용
3. SK = 상업용
4. DK = 토지
5. title / address / propertyType / summary / zoning / buildingComposition / landParcels 등은 분류 fallback으로 절대 사용하지 않습니다.
6. 매물번호 앞 2자리가 MK/SK/DK가 아니면 어떤 분류칩에도 들어가지 않습니다.

유지:
- 검색창 일반 검색 로직
- 핀 꽂는 로직
- PNU 보정/캐시
- 오른쪽 패널 스냅샷
- 진단/현황 패널 숨김
