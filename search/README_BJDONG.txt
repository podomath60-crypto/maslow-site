search 배포 파일

구조:
- index.html
- bjdong-codes.js

법정동 데이터:
- 원본: 국토교통부_전국 법정동_20250807.csv
- 전체 행: 49,878건
- 현존 읍면동/리 단위: 20,275건
- 삭제일자 있는 행 제외
- 시/도, 시/군/구 상위 코드 제외

배포:
- 서버의 기존 /search 폴더를 통째로 교체하세요.
- 접속 주소는 /search 또는 /search/ 모두 동작하도록 index.html에서 /search/bjdong-codes.js 절대경로를 사용했습니다.
- 로컬 파일 테스트용 fallback으로 ./bjdong-codes.js도 걸어두었습니다.

확인용:
- 오식도동: 전북특별자치도 군산시 오식도동 / 5213014700
