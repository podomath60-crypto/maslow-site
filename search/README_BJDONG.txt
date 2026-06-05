search 프론트

구성:
- index.html: 법정동 검색 + 사용승인일 조회 화면
- bjdong-codes.js: 국토교통부_전국 법정동_20250807.csv에서 변환한 현존 법정동 내장 데이터
- script.js: 참고용 분리 스크립트

법정동 데이터 반영 기준:
- 전체 CSV 행: 49,878행
- 삭제일자 없는 현존 법정동 중 읍면동/리 단위: 20,275건
- 시도/시군구 상위 코드는 선택 대상에서 제외

조회 payload:
{
  action: 'fetchBuildingsByDongAndUseAprDay',
  bcode: '10자리 법정동코드',
  useAprDay: 'YYYYMMDD'
}
