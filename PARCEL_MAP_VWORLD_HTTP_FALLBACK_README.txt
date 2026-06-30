/parcel-map 필지 폴리곤 조회 원인분리 패치

수정 파일:
- api/parcel-map/_common.js
- api/parcel-map/polygons.js

로그 기준 원인:
- 매물/지도/핀 문제 아님.
- /api/parcel-map/polygons가 VWorld 연속지적도 호출 단계에서 실패.
- Data API는 fetch failed로 응답 본문 없이 실패.
- WFS fallback은 VWorld 측 HTTP 502 반환.

수정 내용:
1. VWorld key가 debug params에 그대로 노출되던 문제 수정
   - key/serviceKey/apiKey는 ***로 마스킹
2. VWorld Data API 호출을 https → http 순서로 재시도
   - 공식/활용 예제에서 http endpoint 사용 사례가 있어 fallback 추가
3. WFS 호출도 https → http 순서로 재시도
4. fetch failed 원인 확인을 위해 causeCode/causeMessage/statusText 로그 추가
5. User-Agent 헤더 추가

적용 후 확인:
- 현재화면 필지 ON 클릭
- 폴리곤 로그에서 bbox:data:request:https → error → request:http 순서 확인
- http에서 정상 response가 오면 필지 표시됨
- http도 실패하면 debug의 causeMessage/status/body를 기준으로 다음 원인 분리
