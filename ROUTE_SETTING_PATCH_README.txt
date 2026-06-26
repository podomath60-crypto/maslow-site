경로설정(/route-setting) 추가 패치

추가/수정 파일:
- route-setting/index.html
- api/route-setting/config.js
- api/route-setting/geocode.js
- api/route-setting/directions.js
- .gitignore

Vercel 환경변수:
- NEXT_PUBLIC_NAVER_MAP_CLIENT_ID = 네이버 Maps Client ID
- NAVER_MAP_CLIENT_ID = 네이버 Maps Client ID
- NAVER_MAP_CLIENT_SECRET = 네이버 Maps Client Secret

접속 경로:
- /route-setting

API 경로:
- GET  /api/route-setting/config
- POST /api/route-setting/geocode
- POST /api/route-setting/directions

주의:
- Client Secret은 GitHub에 올리지 말고 Vercel Environment Variables에만 넣는다.
- 네이버 클라우드 Maps Application Web 서비스 URL에 운영 도메인과 Vercel 도메인이 등록되어 있어야 지도 로딩이 된다.
- 화면에는 '마법카펫' 명칭을 쓰지 않고 '경로설정 / 임장 동선표'로 표시했다.
