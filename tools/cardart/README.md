# 카드 그림 생성기

Grok 엔진 그림과 같은 스타일(남색 바탕, 청록 홀로그램 와이어프레임)로 카드 그림을 **코드로 그리는** 도구예요. 이미지 AI가 아니라 3D 곡면을 계산해서 캔버스에 그려요.

- `tps.html`: 단열재 7종(hex, pica, cork, blanket, foam, mli, rcc). 브라우저 콘솔에서 `render('hex')`처럼 부르면 512×512로 그려져요.
- `render.py`: Playwright로 한꺼번에 PNG를 저장하는 스크립트예요.
  - 실행: `python3 render.py "$(pwd)/tps.html" hex,pica,cork,blanket,foam,mli,rcc`
  - 결과: `out/` 폴더에 저장돼요.
- 앱에 넣을 때는 256×256으로 줄여서 `assets/cards/<id>.png`에 두고, `js/01-data.js`의 `CARD_ART`에 id를 넣어요.
