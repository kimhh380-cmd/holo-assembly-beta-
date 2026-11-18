/* 07-test-run.js — 시험 시작·종료, 계기판(HUD)
   모든 js 파일은 같은 전역 공간을 공유하는 일반 <script>입니다. 순서대로 로드되고, 마지막 99-boot.js가 앱을 시작합니다. */
/* ---------- 시험 실행 ---------- */
const TDUR = { press: 7000, comp: 6500, bend: 6500, plasma: 8000, vib: 8000 };
function startTest() {
 const p = ep(); if (!p) return; if (S.test && !S.test.done) return;
 if (S.tkind === 'plasma' && !TEST_EXT.plasma && !(S.tcfg.q > 0 && S.tcfg.dur > 0)) return toast('열유속과 시간을 넣어 주세요');
 const R = evalTest(S.tkind, p, S.tcfg); S.showAll = false;
 S.test = { kind: S.tkind, medium: S.tcfg.medium, p, R, t0: performance.now(), dur: RM ? 1500 : ((TEST_EXT[S.tkind] && TEST_EXT[S.tkind].dur) || TDUR[S.tkind] || 7000), post: R.failAt != null ? 2600 : 900, done: false, frags: null, parts: [] };
 renderDeck(); $('#hud').hidden = false; document.body.classList.add('testing'); renderEditor();
}
function finishTest() {
 const T = S.test, R = T.R, p = T.p; T.done = true;
 p.tests[T.kind] = { kind: T.kind, ok: R.ok, ms: R.ms, sum: R.sum, detail: R.detail, at: Date.now() }; touched(p); S.test = T; save();
 emit('testDone', { kind: T.kind, part: p, result: R }); toast(`${testName(T.kind)} 시험 ${R.ok ? '통과' : '실패'} — ${R.sum}`); if (S.panel === 'editor') renderEditor();
}
let hudTick = 0;
function updHud(tau) {
 if (++hudTick % 3 && !S.test.done) return; const T = S.test, R = T.R, h = R.hud(tau), failed = R.failAt != null && tau >= R.failAt;
 const pc = v => Math.max(0, Math.min(100, v / h.max * 100));
 $('#hud').innerHTML = `<h3>${testName(T.kind)} 시험 <em>${esc(T.p.name)}</em></h3><dl>${h.rows.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>
  <div class="meter"><div class="fill" style="width:${pc(h.v)}%;${failed ? 'background:var(--warn)' : ''}"></div>${(() => { let last = -99, up = false; return h.marks.slice().sort((a, b) => a[0] - b[0]).map(([v, l, c]) => { const q = pc(v); up = q - last < 12 ? !up : false; last = q; return `<div class="mk" style="left:${q}%;background:${c}"><span style="color:${c};${up ? 'top:-20px' : ''}">${l}</span></div>`; }).join(''); })()}</div>
  <div class="verdict ${T.done ? (R.ok ? 'ok' : 'no') : failed ? 'no' : ''}">${T.done ? (R.ok ? '통과 — ' : '실패 — ') + esc(R.sum) : failed ? R.failLabel ? esc(R.failLabel) : (T.kind === 'press' ? '파열!' : T.kind === 'plasma' ? '손상 발생' : T.kind === 'vib' ? '균열 발생' : R.aux.modeTxt + '!') : esc(R.runLabel || '하중을 거는 중…')}</div>`;
}
