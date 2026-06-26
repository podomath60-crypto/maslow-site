route-setting map clean patch

수정 내용:
- 초기 하드코딩 샘플 주소 제거
- 초기 경유지 샘플 제거
- 네이버 지도 연결 후 fallback 핀/SVG/안내문이 남지 않도록 정리
- clearMap에서 fallback DOM pin과 routeLine도 제거
- 네이버 지도 객체가 연결되면 좌표가 없어도 실제 네이버 기본 지도가 먼저 보이도록 수정

덮어쓸 파일:
- route-setting/index.html
