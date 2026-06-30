/parcel-map 현재화면 필지 폴리곤 조회 실패 수정 패치

수정 파일:
- parcel-map/index.html
- api/parcel-map/_common.js
- api/parcel-map/polygons.js

핵심 수정:
1. VWorld Data API 호출에 geometry=true, attribute=true, domain 자동 포함
2. bbox 조회 실패 시 WFS 방식으로 1회 fallback
3. API 에러 응답에 실제 VWorld 오류 메시지 노출
4. 현재화면 필지 조회 limit 450 -> 300으로 낮춤
5. 화면 하단 mapNote에 필지 조회 건수/실패 상세 표시

주의:
- /dashboard는 수정하지 않음.
- /parcel-map에서 현재화면 필지 ON 후 줌 16 이상에서 테스트.
- 그래도 실패하면 mapNote에 표시되는 VWorld 오류문구를 그대로 확인하면 됨.
