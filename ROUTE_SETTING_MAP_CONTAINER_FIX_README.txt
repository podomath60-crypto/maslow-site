route-setting map container fix

덮어쓸 파일:
- route-setting/index.html

수정 내용:
- 네이버 지도 전용 div class를 naverMapCanvas로 분리/명확화
- 네이버 지도 준비 후 mapWrap에 mapReady 클래스 추가
- fallback 배경/가상 핀/가상 점선이 네이버 지도 위를 덮지 않도록 강제 숨김
- 지도 생성 시 문자열 id 대신 실제 DOM 엘리먼트로 초기화
- 지도 생성/렌더/리사이즈 후 naver.maps.Event.trigger(map, 'resize') 재호출
- 지도 영역 크기가 잡힌 뒤 초기화하도록 대기 로직 보강
