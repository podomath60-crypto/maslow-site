/parcel-map 필지 폴리곤 실패 지점 확인용 로그패널 패치

수정 파일:
- parcel-map/index.html
- api/parcel-map/_common.js
- api/parcel-map/polygons.js

변경 내용:
1. /parcel-map 화면 왼쪽 아래 패치 진단 패널에 '폴리곤 로그' 영역 추가.
2. 현재화면 필지 ON, 선택 매물 필지 조회, 배치 PNU 조회 요청/응답/에러를 화면에 기록.
3. /api/parcel-map/polygons 서버 응답에 debug 배열 추가.
   - handler:input
   - bbox:data:request
   - bbox:data:response 또는 bbox:data:error
   - bbox:data:fallback-to-wfs
   - bbox:wfs:request
   - bbox:wfs:response 또는 bbox:wfs:error
   - handler:catch
4. VWorld key는 로그에서 *** 처리.
5. _common.js에서 VWORLD_WFS_URL export 누락 수정.

확인 방법:
- /parcel-map 접속
- 현재화면 필지 ON 클릭
- 실패하면 화면 왼쪽 아래 '폴리곤 로그'에서 마지막 phase 확인
- bbox:data:error면 Data API 호출 단계 실패
- bbox:wfs:error면 fallback WFS 호출도 실패
- handler:input의 domain/hasKey/bbox 값을 먼저 확인
