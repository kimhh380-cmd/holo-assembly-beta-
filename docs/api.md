# 확장 모듈 API — `HOLO`

새 기능은 핵심 파일을 고치지 않고 `js/ext/모듈이름.js` 한 파일로 만듭니다.
모듈은 `js/12-api.js`가 만든 전역 객체 `HOLO`로 시험·카드·패널·그리기를 **등록만** 합니다.
그러면 앱이 알아서 버튼을 만들고, 저장하고, 애니메이션을 돌립니다.
바로 동작하는 견본은 `js/ext/_template.js`(저울 시험 + 견본 패널)에 있습니다.

## 0. 모듈 뼈대

```js
(() => {                                  // 전역 이름 충돌을 막기 위해 꼭 즉시 실행 함수로 감싸기
  const MOD = 'engine';                   // 내 저장 키
  const U = HOLO.util;
  HOLO.registerTest({ ... });
  HOLO.registerPanel({ ... });
})();
```
`index.html`의 `<script src="js/99-boot.js">` 바로 위에 `<script src="js/ext/engine-lab.js"></script>` 한 줄을 넣으면 켜집니다.
**모듈은 앱이 시작되기 전에 로드됩니다.** 그래서 파일 맨 위에서는 등록만 하고, `HOLO.state`나 `HOLO.part`를 쓰는 코드는 이벤트·버튼·시험 함수 안에서 실행하세요.

## 1. 시험 — `HOLO.registerTest(def)`

| 필드 | 필수 | 설명 |
|---|---|---|
| `id` | ✔ | 고유 id. 모듈 접두사를 붙입니다(`st_` `tp_` `en_`). 기본 시험 id(`press` `comp` `bend` `plasma` `vib`)를 쓰면 **그 시험을 대체**합니다 |
| `name` | ✔ | 버튼에 보일 짧은 이름 (2~4글자 권장) |
| `desc` | | 설정 칸 위에 보일 설명 한두 문장 |
| `evaluate(part, cfg, HOLO)` | ✔ | 결과 객체 R을 돌려줌 (아래) |
| `cfgHtml(part, cfg, HOLO)` | | 시험 설정 HTML. 아래 data 속성을 쓰면 값이 `cfg[키]`에 자동 저장됨 |
| `deform(L, tau, T, HOLO)` | | 부품 변형 연출 (아래) |
| `rig(L, tau, now, dt, T, HOLO)` | | 시험 장비·불꽃·파편 그리기. `HOLO.ctx`가 캔버스 2D |
| `applies(part)` | | false면 이 부품에서 버튼을 숨김 (예: 엔진부에만) |
| `dur` | | 애니메이션 길이 ms (기본 7000) |
| `cat` | | `'engine'`이면 구조 카드의 시험 막대에서 빠짐 |

**설정 HTML에서 자동 저장되는 속성** (키는 모듈 접두사로 시작하세요)
- `<button data-cfg="en_mode" data-val="full">`: 여러 버튼 중 하나 고르기. 눌린 버튼에는 `class="on"`을 직접 붙입니다
- `<input type="number" data-cfgn="en_dur">`: 숫자
- `<input type="checkbox" data-cfgc="en_gimbal">`: 켜기·끄기
- `<select>`나 다른 입력이 필요하면 `registerPanel`의 `bind`에서 직접 처리합니다. `cfg`는 `HOLO.state.tcfg`와 같은 객체입니다.

**결과 객체 R** — 시험 시작 순간에 모든 계산을 끝내 두고, 시간에 따른 값은 함수로 줍니다. `tau`는 0(시작)에서 1(끝)까지입니다.
```js
{
  ok: true,                   // 통과 여부
  ms: 0.35,                   // 안전 여유(0.35 = +35%). 모르면 null
  sum: '추력 2.3 MN, 목표 달성', // 결과 한 줄 (카드에 저장됨)
  detail: '연소실 압력 30 MPa · 노즐 팽창비 40', // 결과 둘째 줄
  load: tau => 값,            // 계기판 막대와 연출에 쓰는 대표 값
  cap: 한계값,                // load가 이 값에 닿으면 실패
  failAt: 0.72,               // 실패한 시점(0~1), 실패 없으면 null
  hud: tau => ({ rows: [['추력','2.1 MN'], ...], v: 막대값, max: 막대최대, marks: [[값,'이름','#ffc24a'], ...] }),
  failLabel: '노즐 파손!',     // 실패 순간 계기판 문구 (선택)
  runLabel: '연소 중…',        // 진행 중 문구 (선택)
  hidePart: false,            // true면 실패 뒤 부품을 숨김 (폭발 등)
  aux: {}                     // deform/rig에서 쓸 내 데이터
}
```

**변형 객체 D** (`deform`이 돌려줌): 모두 선택이고, `u`는 부품 아래(0)에서 위(1)까지입니다.
```js
{ dx: u => 가로이동px, rm: u => 반지름배율, hm: 높이배율,
  tint: '255,93,115',          // 와이어프레임 색 (r,g,b)
  fill: 'rgba(...)',           // 몸통 안 채우기
  heat: (cxu, y0, h, rf) => {},    // 몸통 위에 덧그리기 (cxu(u)=중심 x, rf(u)=반지름 px)
  wrinkle: (cxu, y0, h, rf) => {} }
```

**그리기에 쓰는 값**
- `L`(부품 배치): `L.y0`는 바닥 y, `L.y1`은 위 y, `L.rf(u)`는 반지름 px, `L.mr`은 최대 반지름 px, `L.p`는 부품입니다.
- `HOLO.geo`: `geo.cx`는 중심 x, `geo.base`는 바닥 y, `geo.sc`는 1 m당 px(확대 배율 포함)입니다.
- **3D 시점:** 홀로그램은 내려다보는 각도(pitch)를 바꿀 수 있어요. 높이 방향 길이(m)를 그릴 때는 `geo.vc`(= cos pitch)를 곱하고, 둥근 고리의 세로 납작함은 `geo.tilt`(= sin pitch)를 쓰세요. 예: 높이 2 m는 `2 * geo.sc * geo.vc` px, 반지름 r px 고리는 가로 r, 세로 `r * geo.tilt`. 좌우 회전 각도는 `HOLO.state.rot`입니다. 기체 기울기(roll)는 앱이 캔버스를 돌려 처리하므로, `rig`·`onDraw`에서는 기체가 똑바로 서 있다고 보고 그리면 됩니다. `geo.tilt`는 아래에서 볼 때 음수가 되니 `ellipse` 반지름에는 `Math.abs`를 쓰세요.
- `T`(실행 중인 시험): `T.R`, `T.p`, `T.done`이 있습니다. 화면을 흔들려면 `T.shake = 6`을 넣습니다.
- 파티클은 `T.parts.push({x,y,vx,vy,r,life:1,spark:true})`로 넣으면 앱이 대신 그려 줍니다.

## 2. 카드

- `HOLO.registerCard(def)`: 기본 카드를 추가하거나 대체합니다(같은 id면 대체). `cat`은 `st` `en` `tp` `fu` `at` 중 하나입니다.
  - **엔진** (`cat:'en'`, `kind:'engine'`): `fuel`(FUELC 키), `noz`(노즐 길이 계수, 0.8~1.7), `m`(질량 t), `vac`(진공형이면 true)가 필요합니다. 그 밖의 설계값은 자유롭게 더해도 됩니다.
  - **단열재** (`cat:'tp'`, `kind:'tps'`): `col`, `pat`(`hex` `speck` `dots` `quilt` `none` `sheen` `weave`), `tk`(W/m·K), `trho`(kg/m³), `tcp`, `tT`(°C 한계), `teps`, `tdef`(기본 두께 mm)가 필요합니다. 삭마 재료면 `abl:true, tA, Qs`도 넣습니다.
  - **그림:** 기본 카드는 `assets/cards/<카드id>.png`가 있고 `CARD_ART`(js/01-data.js)에 id가 있으면 그 그림이 나옵니다. 확장 모듈은 `HOLO.data`가 아니라 카드의 `img`로 지정하세요. 다른 경로를 쓰려면 `img: '경로 또는 데이터 URL'`을 넣으세요. 내 카드(`saveCustomCard`)에도 `img`를 넣을 수 있습니다.
- `HOLO.saveCustomCard(card)`: 사용자가 만든 카드를 "내 카드"로 저장합니다. 덱의 해당 카테고리 맨 앞에 나오고, localStorage와 파일 내보내기에 포함됩니다. 반환값은 id입니다.
- `HOLO.removeCustomCard(id)`
- `HOLO.registerMaterial(id, { name, rho, E, Sy, Su, Tmax, k, cp, eps, cryo, note })`: 구조 재질을 추가합니다.

## 3. 설계 패널 — `HOLO.registerPanel(def)`

`{ id, title, applies(part), html(part, HOLO), bind(rootEl, part, HOLO) }`

- 작업대·부품 편집 패널의 "시험" 구역 아래에 접히는 구역으로 나옵니다.
- **패널은 자주 다시 그려집니다.** 그래서 이벤트는 매번 `bind`에서 `rootEl.querySelector`로 붙입니다.
- 패널 안 요소에는 `data-x-모듈=…` 같은 자기 속성을 쓰세요. 앱이 쓰는 `data-f` `data-pf` `data-mp` `data-tk` `data-run` 등은 피합니다. `data-cfg*`만 일부러 쓸 수 있습니다.
- 부품 값을 바꿨다면 `HOLO.util.snap()`(되돌리기 지점) → 값 변경 → `HOLO.util.touched(part)` → `HOLO.refresh()` 순서로 부르세요.

## 4. 그리기·이벤트·저장

- `HOLO.onDraw(f)`: 매 프레임 마지막에 `f({ ctx, W, H, geo, layout, solo, part, test, tau, now, dt })`가 불립니다. 오류가 나면 그 훅은 자동으로 꺼집니다.
- `HOLO.on('changed', ({part}) => …)`, `HOLO.on('testDone', ({kind, part, result}) => …)`
- `HOLO.store('engine')`: 모듈 전용 객체입니다. 값을 바꾸고 `HOLO.save()`를 부르면 저장됩니다. 부품마다 저장하고 싶으면 `part.x_engine = {...}`처럼 부품에 접두사 필드를 붙여도 됩니다(카드·파일에 함께 저장됨).
- **읽기 전용 값:**
  - `HOLO.state`: 전체 상태 S
  - `HOLO.part`: 지금 편집 중인 부품
  - `HOLO.cards`: id → 카드
  - `HOLO.data`: `FUELC` `FUELD` `MATS` `BUILD` `ROLES` `BUILTIN` `TESTS` `PLASMA`
- **도우미 `HOLO.util`:**
  - 형식·화면: `esc` `fix` `m1` `nf(값, 소수자리)` `n0` `toast` `snap` `touched`
  - 계산: `massOf(part)` → `{A,V,st,tps,prop,eng,dry,tot}`, `geomM` `maxR` `rfOf` `sigcr` `ramp` `firstCross(f, cap)` `plasmaSim` `aboveMass` `armLen` `inStack`
  - 그리기: `bb(°C)` → 빛 색, `stressTint` `glowLine(pts, alpha, width)` `ring` `label(text, x, y, color, 'r')` `lineA` `shapeSvg`

## 5. 확인 방법

1. `index.html`에 내 모듈 한 줄을 넣고 브라우저로 엽니다.
2. 개발자 도구(F12) 콘솔에 빨간 오류가 없어야 합니다.
3. 새 부품 설계 → 내 시험 버튼 → 시험 시작 → 결과가 카드에 남는지 확인합니다.
4. 새로고침해도 내 카드와 저장값이 남아 있어야 합니다.
5. 기존 시험 5종과 예시 기체 2개가 여전히 잘 동작해야 합니다.
6. 400px 폭(휴대폰)에서도 패널이 깨지지 않아야 합니다.
