/parcel-map 함수 개수 제한 수정 패치

원인:
- Vercel Hobby는 Serverless Functions가 12개까지입니다.
- 기존 api가 7개이고 parcel-map에서 5개를 추가해 12개였는데,
  api/parcel-map/config.js를 추가하면서 13개가 되어 Build Failed가 났습니다.

수정:
- api/parcel-map/config.js 새 함수 사용을 중단했습니다.
- 기존 api/route-setting/config.js에 VWORLD_API_KEY 반환만 추가했습니다.
- parcel-map/index.html은 /api/route-setting/config에서 clientId와 vworldKey를 같이 받습니다.

중요 삭제 파일:
- 반드시 repo에서 api/parcel-map/config.js 파일을 삭제하세요.
- 이 파일이 남아 있으면 서버리스 함수 13개로 계속 Build Failed 납니다.

포함 파일:
- parcel-map/index.html
- api/route-setting/config.js
- DELETE_THIS_FILE.txt
