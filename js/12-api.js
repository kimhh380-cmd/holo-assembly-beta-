/* 12-api.js — 확장 모듈용 공개 API (HOLO)
   다른 AI는 핵심 파일(01~12, 99)을 고치지 말고, js/ext/ 안에 자기 파일을 만들어 HOLO로 기능을 등록합니다.
   자세한 설명과 예시는 docs/api.md, 견본은 js/ext/_template.js를 보세요. */
const HOLO = {
 version: 1,
 // 시험 등록. 같은 id로 다시 등록하면 기본 시험을 대체합니다(예: 'press').
 registerTest(def) {
  if (!def || !def.id || !def.name || typeof def.evaluate !== 'function') throw new Error('registerTest: id, name, evaluate가 필요해요');
  const row = [def.id, def.name, def.desc || ''], i = TESTS.findIndex(q => q[0] === def.id);
  if (i >= 0) TESTS[i] = row; else TESTS.push(row); TEST_EXT[def.id] = def;
 },
 // 기본 카드 등록(엔진·단열재·연료·부착물·구조). 같은 id면 대체합니다.
 registerCard(def) {
  if (!def || !def.id || !def.cat) throw new Error('registerCard: id와 cat이 필요해요');
  const i = BUILTIN.findIndex(c => c.id === def.id); if (i >= 0) BUILTIN[i] = def; else BUILTIN.push(def); rebuildCards();
 },
 registerMaterial(id, m) { if (!id || !m || !m.name) throw new Error('registerMaterial: id와 name이 필요해요'); MATS[id] = m; },
 // 설계 패널에 접히는 구역 추가: { id, title, applies(part), html(part, HOLO), bind(rootEl, part, HOLO) }
 registerPanel(def) { if (!def || !def.id || typeof def.html !== 'function') throw new Error('registerPanel: id와 html이 필요해요'); const i = PANELS.findIndex(q => q.id === def.id); if (i >= 0) PANELS[i] = def; else PANELS.push(def); },
 // 매 프레임 마지막에 불림: f({ ctx, W, H, geo, layout, solo, part, test, tau, now, dt })
 onDraw(f) { DRAW_HOOKS.push(f); },
 // 이벤트: 'changed' { part }, 'testDone' { kind, part, result }
 on(ev, f) { (EVT[ev] = EVT[ev] || []).push(f); },
 // 모듈 전용 저장 공간 (localStorage에 함께 저장됨). 바꾼 뒤 HOLO.save() 호출
 store(moduleId) { return S.ext[moduleId] = S.ext[moduleId] || {}; },
 save() { save(); },
 // 내 카드 저장/삭제 (어떤 cat이든). 반환값은 카드 id
 saveCustomCard(card) {
  if (!card || !card.cat || !card.name) throw new Error('saveCustomCard: cat과 name이 필요해요');
  card.custom = true; card.id = card.id || 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); card.desc = card.desc || '';
  const i = S.custom.findIndex(c => c.id === card.id); if (i >= 0) S.custom[i] = card; else S.custom.unshift(card);
  rebuildCards(); save(); renderDeck(); return card.id;
 },
 removeCustomCard(id) { S.custom = S.custom.filter(c => c.id !== id); rebuildCards(); save(); renderDeck(); },
 refresh() { renderDeck(); changed(); },
 get state() { return S; }, get cards() { return CARD; }, get part() { return ep(); }, get ctx() { return x; }, get geo() { return geo; },
 data: { FUELC, FUELD, MATS, BUILD, ROLES, BUILTIN, TESTS, PLASMA },
 util: { $, esc, fix, m1, nf, n0, toast, snap, touched, massOf, geomM, maxR, rfOf, sigcr, ramp, firstCross, plasmaSim, bb, stressTint, glowLine, ring, label, lineA, aboveMass, armLen, inStack, shapeSvg },
};
window.HOLO = HOLO;
