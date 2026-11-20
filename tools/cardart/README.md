# 카드 그림 생성기

이미지 AI가 아니라 3D 모양을 계산해서 그리는 도구예요. 카드마다 **홀로그램 그림**과 **실제 그림** 두 장을 만들어요.

## sdf/ — 모든 카드 (구조·엔진·연료·부착물·단열재)
numpy로 거리장(SDF) 광선 추적을 해요. 같은 모양을 두 가지로 칠해요.
- 실제: 물리 기반 재질(금속 반사, 거칠기, 범프), 스튜디오 조명, 부드러운 그림자
- 홀로그램: 가장자리 빛, 청록 격자선, 재질 무늬 선, 번짐(bloom), 주사선
- 장면: `scenes.py`의 `S_<카드id>()` · 렌더러: `sdfr.py`
- 실행: `python3 runall.py all 760` → `out/real_<id>.png`, `out/holo_<id>.png` (단열재의 실제 그림은 아래 real/)
- 비교 시트: `python3 sheet.py nose,tankM,raptor real 4`

## real/ — 단열재 7종의 실제 그림
`python3 render_real.py` → `out/<id>.png` (곡면 패널, 두께 단면, 재질별 질감)

## 앱에 넣기
256×256으로 줄여서 홀로그램은 `assets/cards/<id>.png`, 실제는 `assets/cards/real/<id>.png`에 두고, `js/01-data.js`의 `CARD_ART` / `CARD_ART_REAL`에 id를 넣어요.

## 예전 도구
- `tps.html`, `render.py`: 처음 만든 코드 홀로그램 단열재 그림(지금은 sdf/ 그림으로 바뀜)
