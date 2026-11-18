# 홀로그램 기체 조립대 — 다른 AI와 함께 만들기

로켓 부품을 카드로 만들어 홀로그램 위에서 조립하고, 압력·플라즈마 같은 구조 시험을 해 보는 웹 앱입니다.
`index.html`을 더블클릭하면 브라우저에서 바로 실행됩니다. 설치할 것은 없습니다.

## 세 AI에게 나눠 맡기기 (지금 쓰는 방법)

| AI | 맡은 일 | 지시서 |
|---|---|---|
| ChatGPT | 구조 시험을 실제 시뮬레이션으로 | `prompts/1-ChatGPT-구조시험.md` |
| Gemini | 단열재 설계·실험 | `prompts/2-Gemini-단열재.md` |
| Grok | 엔진 설계·연소 시험·엔진 이미지 | `prompts/3-Grok-엔진.md` |

**순서**

1. 각 지시서를 열어 **“올릴 파일”** 을 그 AI에게 올립니다.
2. **“첫 메시지”** 를 복사해 붙여 넣습니다.
3. AI가 먼저 계획을 보여 주면, 괜찮은지 보고 “좋아, 코드 써 줘”라고 합니다.
4. 받은 파일을 이 폴더에 넣습니다.
   - `js/ext/…lab.js`와 `docs/ext-….md`
   - 이미지는 `assets/engines/`
5. `index.html`의 주석 처리된 줄(`<!-- <script src="js/ext/…"> -->`)에서 그 모듈의 `<!--`와 `-->`를 지우면 켜집니다.
6. 브라우저로 열어 확인합니다. 오류가 나면 F12 콘솔의 빨간 글씨를 그 AI에게 그대로 보여 주세요.
7. 세 모듈이 모이면 Claude에게 파일들을 올려 주세요. 합치고, 충돌을 고치고, 웹에 올려 드려요.

**세 AI가 서로 부딪히지 않는 이유**

- 각자 `js/ext/` 안의 **자기 파일 하나만** 만들고, 핵심 파일은 건드리지 않아요.
- 기능은 `docs/api.md`의 `HOLO` API로 등록만 해요.
- 자세한 규칙은 `AGENTS.md` 8~9장에 있어요.

## 그 밖의 방법

- **폴더를 직접 여는 코딩 AI:** Cursor, Codex, Claude Code, Gemini CLI는 폴더를 열면 `AGENTS.md`를 자동으로 읽어요.
- **작은 일을 다른 AI에게 맡길 때:** `prompts/0-공통-시작용.md`를 쓰세요.
- **부품 데이터만 맡길 때:** `docs/data-format.md` 형식으로 JSON을 받아 앱의 **내 기체 → 파일 가져오기**로 넣으세요.

## 여러 AI가 번갈아 고칠 때 지킬 것

- **한 번에 한 AI가 한 기능**만 고칩니다. 둘이 같은 파일을 동시에 고치면 한쪽 작업이 사라집니다.
- **파일이 역할별로 나뉘어 있습니다.** 그래서 “엔진 쪽은 A AI, 시험 쪽은 B AI”처럼 나눠 맡기기 좋습니다. 어떤 파일이 무슨 일을 하는지는 `AGENTS.md` 3장을 보세요.
- **기능을 넣은 AI**에게는 `AGENTS.md` 맨 아래 CHANGELOG에 한 줄을 남기라고 하세요. 다음 AI가 흐름을 알 수 있습니다.
- **고친 뒤에는** `AGENTS.md` 8장의 확인 목록을 해 보세요.
  - 예시 기체 2개가 뜨는지
  - 카드 저장 후 새로고침해도 남아 있는지
  - 시험 5종이 끝까지 도는지
- **결과를 다시 Claude에게 가져올 때**는 바뀐 파일을 대화에 올리면 됩니다. 합쳐서 확인하고, 웹 아티팩트도 새 버전으로 올려 드려요.

## 더 편하게: GitHub 저장소

여러 AI와 오래 같이 만들 계획이라면 GitHub 저장소에 올리는 것이 가장 안전합니다.

- 누가 무엇을 바꿨는지 기록이 남습니다.
- 잘못 고쳐도 예전 버전으로 되돌릴 수 있습니다.
- Codex, Copilot, Claude Code 같은 AI는 저장소에 바로 연결해서 작업할 수 있습니다.

## 폴더 구조

```
index.html  css/style.css  js/01-data.js … js/11-input.js
AGENTS.md            AI용 안내서 (구조·데이터·규칙·할 일)
CLAUDE.md, GEMINI.md AGENTS.md를 가리키는 짧은 파일
prompts/             AI별 작업 지시서 (GPT·Gemini·Grok·공통)
docs/api.md          확장 모듈 API(HOLO)
js/12-api.js, js/99-boot.js, js/ext/_template.js  확장 API·시작·견본 모듈
assets/engines/      엔진 카드 이미지 넣는 곳
docs/data-format.md  카드·부품 JSON 형식
docs/physics.md      시험 공식과 가정
examples/example-cards.json  가져오기 예시
```
