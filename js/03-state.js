/* 03-state.js — 상태 S, 부품 생성·정규화, 예시 기체, 저장/불러오기
   모든 js 파일은 같은 전역 공간을 공유하는 일반 <script>입니다. 순서대로 로드되고, 마지막 99-boot.js가 앱을 시작합니다. */
/* ---------- 상태 ---------- */
const S = { parts: [], custom: [], ships: [], ext: {}, bench: null, sel: null, edit: null, panel: 'cards', showAll: false, rot: 0.5, auto: true, hist: [], cat: 'st', drag: null, hover: null, scv: 0, test: null, tkind: 'press', benchDirty: false,
 open: { shape: true, mat: true, props: false, test: true }, tcfg: { mode: 'qual', medium: 'water', above: 50, pressurize: true, arm: 30, preset: 'leo', q: 300, dur: 900 } };
let uidN = 1;
const defMat = role => role === 'engbay' ? 'al2219' : role === 'shell' || role === 'capsule' ? 'al7075' : 'al2219';
const defT = d => fix(Math.min(20, 1.5 + d * 0.4));
function normPart(p) {
 if (!p.mat || !p.mat.name) p.mat = Object.assign({ id: defMat(p.role) }, MATS[defMat(p.role)]);
 if (!BUILD[p.build]) p.build = p.role === 'engbay' ? 'stringer' : 'mono';
 if (!(p.t > 0)) p.t = defT(p.shape.d0);
 if (p.meop == null) p.meop = p.role === 'tank' ? 3 : 0.3;
 if (p.tps && !(p.tpsT > 0)) p.tpsT = CARD[p.tps].tdef;
 if (!p.tests) p.tests = {};
 return p;
}
function shapeFromCard(c, d) {
 if (c.custom) return JSON.parse(JSON.stringify(c.part.shape));
 const q = c.sh; return { prof: q.prof, h: fix(q.hr * d), d0: d, d1: q.d1r != null ? fix(q.d1r * d) : d, dm: fix((q.dmr || 1.3) * d), k: q.k || 1.7, sp: q.sp || 0.6 };
}
function mkPart(cardId, d, o) {
 const c = CARD[cardId]; let p;
 if (c.custom) { p = JSON.parse(JSON.stringify(c.part)); p.from = c.id; p.card = cardId; }
 else p = { card: cardId, name: c.name, role: c.kind, engines: [], tps: null, fuel: null, att: [], from: null, shape: shapeFromCard(c, d) };
 if (o) { const { shape, ...rest } = o; Object.assign(p, rest); if (shape) Object.assign(p.shape, shape); }
 p.uid = uidN++; p.v = Object.assign({}, p.shape, { h: 0 }); return normPart(p);
}
const M_ = id => Object.assign({ id }, MATS[id]);
const EX = {
 ss: () => [mkPart('engbay', 9, { shape: { h: 3.6 }, engines: Array(33).fill('raptor'), tps: 'blanket', mat: M_('ss301'), t: 12, build: 'stringer' }), mkPart('tankL', 9, { shape: { h: 62 }, fuel: 'methalox', att: ['gridfin'], mat: M_('ss301'), t: 5.5, meop: 4, build: 'stringer' }), mkPart('hotring', 9, { shape: { h: 1.8 }, mat: M_('ss301'), t: 10, build: 'stringer' }), mkPart('engbay', 9, { shape: { h: 3 }, engines: ['raptor', 'raptor', 'raptor', 'raptorvac', 'raptorvac', 'raptorvac'], mat: M_('ss301'), t: 8, build: 'stringer' }), mkPart('tankM', 9, { shape: { h: 33 }, fuel: 'methalox', tps: 'hex', att: ['flaps'], mat: M_('ss301'), t: 4, meop: 4, build: 'stringer' }), mkPart('nose', 9, { shape: { h: 17 }, tps: 'hex', att: ['flaps'], mat: M_('ss301'), t: 4, build: 'stringer' })],
 f9: () => [mkPart('engbay', 3.7, { shape: { h: 2 }, engines: Array(9).fill('merlin'), att: ['legs'], mat: M_('al2195'), t: 6 }), mkPart('tankL', 3.7, { shape: { h: 40 }, fuel: 'kerolox', mat: M_('al2195'), t: 4.5, meop: 3.5, build: 'stringer' }), mkPart('inter', 3.7, { shape: { h: 6.5 }, att: ['gridfin'], mat: M_('cfrp'), t: 8, build: 'honey' }), mkPart('engbay', 3.7, { shape: { h: 1.6 }, engines: ['mvac'], mat: M_('al2195'), t: 4 }), mkPart('tankS', 3.7, { shape: { h: 10 }, fuel: 'kerolox', mat: M_('al2195'), t: 3.5, meop: 3.5, build: 'stringer' }), mkPart('fairing', 3.7, { shape: { h: 13.1, dm: 5.2, sp: 0.55 }, tps: 'cork', mat: M_('cfrp'), t: 6, build: 'honey' })],
};
const strip1 = ({ uid, v, ...r }) => r;
const strip = parts => parts.map(strip1);
const revive1 = p => normPart(Object.assign({}, p, { uid: uidN++, v: Object.assign({}, p.shape, { h: 0 }), engines: (p.engines || []).filter(e => CARD[e]), att: (p.att || []).filter(a => CARD[a]), tps: CARD[p.tps] ? p.tps : null }));
const revive = arr => (arr || []).filter(p => p && p.shape && p.role).map(revive1);
function load() {
 let d = null; try { d = JSON.parse(localStorage.getItem('holo.v2') || 'null'); } catch (e) { d = null; }
 S.custom = (d && Array.isArray(d.custom) ? d.custom : []).map(c => c.part ? c : (c.shape ? { id: c.id, cat: 'st', custom: true, name: c.name, desc: c.desc || '', kind: c.kind, part: { name: c.name, role: c.kind, shape: c.shape, engines: c.engines || [], tps: c.tps || null, fuel: c.fuel || null, att: c.att || [] } } : (c.cat && c.cat !== 'st' ? c : null))).filter(Boolean);
 S.ext = d && d.ext && typeof d.ext === 'object' ? d.ext : {};
 S.ships = d && Array.isArray(d.ships) ? d.ships : [];
 rebuildCards(); S.custom.forEach(c => { if (c.cat === 'st') c.part = strip1(normPart(Object.assign({ shape: c.part.shape }, c.part))); });
 S.parts = d && Array.isArray(d.parts) ? revive(d.parts) : EX.ss();
 S.bench = d && d.bench && d.bench.shape ? revive1(d.bench) : null; if (S.bench) S.panel = 'editor';
}
const save = () => { try { localStorage.setItem('holo.v2', JSON.stringify({ parts: strip(S.parts), custom: S.custom, ships: S.ships, bench: S.bench ? strip1(S.bench) : null, ext: S.ext })); } catch (e) { toast('이 브라우저에서는 저장할 수 없어요. 파일로 내보내기를 써 주세요'); } };
const snap = () => { S.hist.push(JSON.stringify({ parts: S.parts, bench: S.bench })); if (S.hist.length > 80) S.hist.shift(); };
function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.T); toast.T = setTimeout(() => el.classList.remove('on'), 2600); }
const cur = () => S.parts.find(q => q.uid === S.sel);
const ep = () => S.bench || (S.edit != null ? S.parts.find(q => q.uid === S.edit) : null) || null;
const isSolo = () => !!ep() && (!S.showAll || !!S.test || !!S.bench);
