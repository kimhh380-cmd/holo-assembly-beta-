/* 05-deck.js — 카드 덱 렌더링, 조립 규칙, 작업대 열고 닫기, 정보·선택 상자
   모든 js 파일은 같은 전역 공간을 공유하는 일반 <script>입니다. 순서대로 로드되고, 마지막 99-boot.js가 앱을 시작합니다. */
/* ---------- 덱 ---------- */
function dotsHtml(tests) { return `<span class="dots">${TESTS.filter(([k]) => !TEST_EXT[k] || TEST_EXT[k].cat !== 'engine').map(([k]) => `<i class="${tests && tests[k] ? (tests[k].ok ? 'ok' : 'no') : ''}" title="${k}"></i>`).join('')}</span>`; }
function cardHtml(c) { return `<div class="card ${c.custom ? 'mine' : ''}" data-card="${c.id}" tabindex="0" role="button" aria-label="${esc(c.name)} 카드">${c.custom ? `${c.cat === 'st' ? `<button class="cbtn edt" data-editcard="${c.id}">작업대</button>` : ''}<button class="cbtn del" data-delcard="${c.id}" aria-label="${esc(c.name)} 카드 지우기">지우기</button>` : ''}${icon(c)}<b>${esc(c.name)}</b><small>${esc(c.desc)}</small>${c.custom && c.cat === 'st' ? dotsHtml(c.part.tests) : ''}</div>`; }
function renderDeck() {
 const E = ep(), edp = !!E && S.panel === 'editor';
 $('#cats').innerHTML = CATS.map(([k, l]) => `<button class="cat ${!edp && S.cat === k ? 'on' : ''}" data-cat="${k}" role="tab">${l}</button>`).join('') + (E ? `<button class="cat ed ${edp ? 'on' : ''}" data-cat="ed" role="tab">${S.bench ? '작업대' : '부품 편집'}</button>` : '');
 $('#cards').hidden = edp; $('#editor').hidden = !edp; $('#hint').hidden = edp;
 document.body.classList.toggle('editing', !!E); document.body.classList.toggle('edpanel', edp);
 const md = $('#mode'); md.hidden = !isSolo(); md.textContent = S.bench ? `작업대 · ${E.name}` : E ? `부품 편집 · ${E.name}` : '';
 if (edp) return renderEditor();
 const list = BUILTIN.filter(c => c.cat === S.cat), mine = S.custom.filter(c => c.cat === S.cat);
 $('#cards').innerHTML = S.cat === 'st'
  ? `<div class="card new" data-new="1" tabindex="0" role="button"><svg viewBox="0 0 100 60"><rect x="36" y="8" width="28" height="44" rx="3" fill="none" stroke="#ffc24a" stroke-dasharray="4 3" stroke-width="1.6"/><path d="M50 22V38M42 30H58" stroke="#ffc24a" stroke-width="2.4"/></svg><b>새 부품 설계</b><small>작업대에 부품 하나만 띄워 모양·재질을 정하고 시험해요</small></div>`
   + (mine.length ? `<div class="sec">내 설계 카드 ${mine.length}장 · 막대는 시험 결과</div>` + mine.map(cardHtml).join('') + `<div class="sec">기본 부품</div>` : '') + list.map(cardHtml).join('')
  : (E ? `<div class="sec">카드를 누르면 ${esc(E.name)}에 바로 붙어요</div>` : '') + (mine.length ? `<div class="sec">내 카드 ${mine.length}장</div>` + mine.map(cardHtml).join('') + `<div class="sec">기본 카드</div>` : '') + list.map(cardHtml).join('');
}
$('#cats').onclick = e => { const b = e.target.closest('[data-cat]'); if (!b) return; if (b.dataset.cat === 'ed') S.panel = 'editor'; else { S.cat = b.dataset.cat; S.panel = 'cards'; } renderDeck(); };
/* ---------- 조립 규칙 ---------- */
const TOPS = ['shell', 'capsule'];
function diamAt(i) { const b = S.parts[i - 1], a = S.parts[i]; if (b && b.shape.d1 > 0.3) return b.shape.d1; if (a && a.shape.d0 > 0.3) return a.shape.d0; if (b) return b.shape.d0; return 5; }
function defaultIns(role) { let i = S.parts.length; if (!TOPS.includes(role)) while (i > 0 && TOPS.includes(S.parts[i - 1].role)) i--; return i; }
function touched(p) { if (p === S.bench) S.benchDirty = true; if (S.test && S.test.p === p) S.test = null; }
function apply(cardId, target, insertAt) {
 const c = CARD[cardId]; if (!c) return; const E = ep();
 if (c.cat === 'st') {
  if (E && isSolo()) return toast('작업대에는 부품 하나만 올라가요 — 작업대를 닫은 뒤 끼워 주세요');
  snap(); const at = insertAt != null ? insertAt : defaultIns(c.kind), p = mkPart(cardId, fix(diamAt(at))); if (c.custom) { p.v = Object.assign({}, p.shape, { h: 0 }); }
  S.parts.splice(at, 0, p); S.sel = p.uid; toast(`${c.name}을(를) 끼웠어요${c.custom ? '' : ' · 지름은 이웃 부품에 맞췄어요'}`); return changed();
 }
 snap(); let t = target || E || cur();
 if (c.kind === 'engine') { if (!t || t.role !== 'engbay') t = E && E.role === 'engbay' ? E : (E ? null : S.parts.find(p => p.role === 'engbay')); if (!t) { if (E) { S.hist.pop(); return toast('엔진은 역할이 “엔진부”인 부품에만 달 수 있어요'); } t = mkPart('engbay', fix(diamAt(0))); S.parts.unshift(t); toast('엔진부가 없어 맨 아래에 만들었어요'); } if (t.engines.length >= 40) { S.hist.pop(); return toast('엔진부가 가득 찼어요'); } t.engines.push(cardId); touched(t); if (!E) S.sel = t.uid; toast(`${c.name} 장착 · 이 엔진부에 ${t.engines.length}개`); return changed(); }
 if (!t) { S.hist.pop(); return toast('먼저 투사대의 부품을 누르거나, 카드를 부품 위로 끌어 놓으세요'); }
 if (c.kind === 'fuel') { if (t.role !== 'tank') { S.hist.pop(); return toast('연료는 탱크에만 채울 수 있어요'); } t.fuel = cardId; toast(`${t.name}에 ${c.name} 충전`); }
 else if (c.kind === 'tps') { t.tps = cardId; t.tpsT = c.tdef; toast(`${t.name}에 ${c.name} ${c.tdef} mm 부착`); }
 else if (c.kind === 'att') { if (cardId === 'legs' && t.role !== 'engbay') { S.hist.pop(); return toast('착륙 다리는 엔진부에 달아요'); } if (t.att.includes(cardId)) t.att = t.att.filter(a => a !== cardId); else t.att.push(cardId); toast(`${t.name}: ${c.name} ${t.att.includes(cardId) ? '부착' : '제거'}`); }
 touched(t); if (!E) S.sel = t.uid; changed();
}
function blankPart(d) { return normPart({ card: null, name: '새 부품', role: 'tank', engines: [], tps: null, fuel: null, att: [], from: null, shape: { prof: 'line', h: fix(d * 1.5), d0: d, d1: d, dm: fix(d * 1.3), k: 1.7, sp: 0.6 }, uid: uidN++, v: { prof: 'line', h: 0, d0: d, d1: d, dm: d, k: 1.7, sp: 0.6 } }); }
function openBench(p) { snap(); S.bench = p; S.edit = null; S.sel = null; S.panel = 'editor'; S.test = null; S.benchDirty = false; renderDeck(); changed(); }
function newPart() { openBench(blankPart(fix(diamAt(defaultIns('tank'))))); toast('작업대에 새 부품을 띄웠어요 · 모양·재질을 정하고 시험해 보세요'); }
function editCard(id) { const c = CARD[id]; if (!c) return; const p = revive1(JSON.parse(JSON.stringify(c.part))); p.from = id; openBench(p); toast(`‘${c.name}’ 카드를 작업대에 올렸어요`); }
function openEditor(uid) { S.bench = null; S.sel = S.edit = uid; S.panel = 'editor'; S.showAll = false; S.test = null; renderDeck(); changed(); }
function closeEdit() { S.bench = null; S.edit = null; S.test = null; S.panel = 'cards'; S.cat = 'st'; S.benchDirty = false; renderDeck(); changed(); }
/* ---------- 정보 ---------- */
function updInfo() {
 const E = ep(); if (isSolo() && E) { const m = massOf(E); $('#info').innerHTML = `부품 질량 <b>${nf(m.tot / 1000, 2)} t</b>${m.prop ? ` (추진제 ${nf(m.prop / 1000, 1)} t)` : ''}<br>${esc(E.mat.name)} · 벽 ${nf(E.t, 1)} mm`; return; }
 const H = S.parts.reduce((a, p) => a + p.shape.h, 0) + nozzleM(), D = S.parts.reduce((a, p) => Math.max(a, maxR(p.shape) * 2), 0), Mt = S.parts.reduce((a, p) => a + massOf(p).tot, 0);
 $('#info').innerHTML = S.parts.length ? `전체 높이 <b>${m1(H)} m</b> · 최대 지름 <b>${m1(D)} m</b><br>이륙 질량 약 <b>${nf(Mt / 1000, 0)} t</b> · 부품 ${S.parts.length}개` : '';
}
function changed() { emit('changed', { part: ep() }); save(); renderSel(); if (S.panel === 'editor' && ep()) renderEditor(); updInfo(); $('#empty').hidden = S.parts.length > 0 || !!ep(); const md = $('#mode'); md.hidden = !isSolo(); }
/* ---------- 선택 상자 ---------- */
function renderSel() {
 const box = $('#selbox'), p = cur(); if (!p || ep()) { box.hidden = true; return; } box.hidden = false; const i = S.parts.indexOf(p), s = p.shape;
 const eng = {}; p.engines.forEach(e => eng[e] = (eng[e] || 0) + 1);
 const chips = [].concat(Object.keys(eng).map(e => `<span class="chip"><i style="background:${FUEL_OF(CARD[e].fuel)}"></i>${CARD[e].name} × ${eng[e]}<button data-rmeng="${e}" aria-label="${CARD[e].name} 하나 빼기">−</button></span>`),
  p.fuel ? [`<span class="chip"><i style="background:${FUEL_OF(p.fuel)}"></i>${CARD[p.fuel].name}<button data-rm="fuel" aria-label="연료 비우기">×</button></span>`] : [],
  p.tps ? [`<span class="chip"><i style="background:${CARD[p.tps].col}"></i>${CARD[p.tps].name}<button data-rm="tps" aria-label="단열재 떼기">×</button></span>`] : [],
  p.att.map(a => `<span class="chip"><i style="background:#3ff0ff"></i>${CARD[a].name}<button data-rmatt="${a}" aria-label="${CARD[a].name} 떼기">×</button></span>`));
 box.innerHTML = `<h2>${esc(p.name)}</h2><p>${ROLES[p.role]} · ${esc(p.mat.name)} · 길이 ${m1(s.h)} m · 지름 ${m1(s.d0)}${Math.abs(s.d1 - s.d0) > 0.05 ? ` → ${m1(s.d1)}` : ''} m</p>${chips.length ? `<div class="chips">${chips.join('')}</div>` : ''}
  <div class="tb" style="margin-top:6px"><button class="b hot" data-edit="1">편집·시험</button><button class="b" data-mv="1" ${i >= S.parts.length - 1 ? 'disabled' : ''} aria-label="위로">▲</button><button class="b" data-mv="-1" ${i <= 0 ? 'disabled' : ''} aria-label="아래로">▼</button><button class="b" data-dup="1">복제</button><button class="b" data-del="1" style="color:var(--warn)">삭제</button></div>`;
}
$('#selbox').onclick = e => { const p = cur(); if (!p) return; const b = e.target.closest('button'); if (!b) return; if (b.dataset.edit) return openEditor(p.uid); snap(); const i = S.parts.indexOf(p);
 if (b.dataset.rmeng) p.engines.splice(p.engines.lastIndexOf(b.dataset.rmeng), 1);
 else if (b.dataset.rm) p[b.dataset.rm] = null; else if (b.dataset.rmatt) p.att = p.att.filter(a => a !== b.dataset.rmatt);
 else if (b.dataset.mv) { const j = i + +b.dataset.mv; if (j >= 0 && j < S.parts.length) { S.parts.splice(i, 1); S.parts.splice(j, 0, p); } }
 else if (b.dataset.dup) { const q = revive1(JSON.parse(JSON.stringify(strip1(p)))); S.parts.splice(i + 1, 0, q); S.sel = q.uid; }
 else if (b.dataset.del) { S.parts.splice(i, 1); S.sel = null; }
 changed(); };
