/parcel-map 필지 조회 구조 변경 패치

수정 파일
- parcel-map/index.html
- api/parcel-map/config.js

변경 내용
1. 현재화면 전체 bbox 폴리곤 조회를 중단했습니다.
   - VWorld 연속지적도 GetFeature 대량 bbox 조회 대신 WMS 필지선 레이어를 사용합니다.
   - 버튼명: 현재화면 필지 → 필지선

2. 선택 매물 필지만 JSONP GetFeature로 조회합니다.
   - 매물 핀 클릭 시 오른쪽 패널을 먼저 표시합니다.
   - 그 매물의 pnuList에 들어 있는 PNU만 조회합니다.
   - pnuList가 3개면 3개만 조회합니다.
   - 캐시에 이미 있는 PNU는 재요청하지 않고 표시만 합니다.

3. VWorld 호출 방식
   - WMS: VWorld WMS 타일로 필지선 표시
   - 선택 필지: VWorld /req/data JSONP
   - request=getfeature
   - data=LP_PA_CBND_BUBUN
   - attrfilter=pnu:=:<PNU>

4. VWorld 키
   - api/parcel-map/config.js에서 Vercel 환경변수 VWORLD_API_KEY를 읽어 프론트로 내려줍니다.
   - VWorld JSONP/WMS는 브라우저에서 직접 호출됩니다.

대시보드 원본은 수정하지 않았습니다.
