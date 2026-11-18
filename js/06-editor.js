/* 06-editor.js — 설계 패널(모양·재질·시험 설정) 렌더링과 입력 처리
   모든 js 파일은 같은 전역 공간을 공유하는 일반 <script>입니다. 순서대로 로드되고, 마지막 99-boot.js가 앱을 시작합니다. */
/* ---------- 설계 패널 ---------- */
function fldHtml(f, v, lab, pref) { const mul = f.mul || 1; return `<div class="fld"><label for="r_${f.k}">${lab}</label><input type="range" id="r_${f.k}" data-${pref}="${f.k}" min="${f.min * mul}" max="${f.max * mul}" step="${f.st * mul}" value="${v * mul}"><span class="num"><input type="number" id="n_${f.k}" data-${pref}="${f.k}" min="${f.min * mul}" max="${f.max * mul}" step="${f.st * mul}" value="${fix(v * mul)}" inputmode="decimal">${f.u}</span></div>`; }
function derivedHtml(p) { const m = massOf(p); return `<div><b>${nf(m.st / 1000, 2)} t</b>구조 질량</div><div><b>${p.role === 'tank' ? nf(m.V, 1) + ' m³' : nf(m.A, 1) + ' m²'}</b>${p.role === 'tank' ? '탱크 부피' : '겉넓이'}</div><div><b>${m.prop ? nf(m.prop / 1000, 1) + ' t' : m.tps ? nf(m.tps / 1000, 2) + ' t' : nf(maxR(p.shape) / (p.t / 1000), 0)}</b>${m.prop ? '추진제' : m.tps ? '단열재' : '반지름/두께'}</div>`; }
function testCfgHtml(p) {
 const c = S.tcfg, k = S.tkind, seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-cfg="${key}" data-val="${v}" class="${c[key] === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
 let h = `<p class="tdesc">${(TESTS.find(q => q[0] === k) || [])[2] || ''}</p>`;
 const X = TEST_EXT[k]; if (X) return h + (X.cfgHtml ? X.cfgHtml(p, c, HOLO) : '');
 if (k === 'press' || k === 'comp' || k === 'bend') h += seg('mode', [['qual', '인증 시험 (요구 하중까지)'], ['fail', '파괴 시험 (부서질 때까지)']]);
 if (k === 'press') h += seg('medium', [['water', '물 (상온)'], ['ln2', '액체질소 (−196°C)']]);
 if (k === 'comp') { h += inStack(p) ? `<p class="note">위에 얹힌 부품 무게 ${nf(aboveMass(p) / 1000, 1)} t를 기체에서 자동으로 계산해요.</p>` : `<label class="row"><span>위 질량</span><span class="num"><input type="number" data-cfgn="above" value="${c.above}" min="0" max="20000" step="1"> t</span></label>`; if (p.role === 'tank') h += `<label class="chk"><input type="checkbox" data-cfgc="pressurize" ${c.pressurize ? 'checked' : ''}> 운용 압력으로 가압한 채 시험 (압력이 벽을 받쳐 줌)</label>`; }
 if (k === 'bend') h += inStack(p) ? `<p class="note">이 부품 위로 ${nf(armLen(p), 1)} m가 바람을 받아요 (기체에서 자동 계산).</p>` : `<label class="row"><span>위쪽 길이</span><span class="num"><input type="number" data-cfgn="arm" value="${c.arm}" min="1" max="300" step="1"> m</span></label>`;
 if (k === 'plasma') h += `<label class="row"><span>조건</span><select id="pPreset">${Object.entries(PLASMA).map(([kk, v]) => `<option value="${kk}" ${c.preset === kk ? 'selected' : ''}>${v[0]}</option>`).join('')}<option value="custom" ${c.preset === 'custom' ? 'selected' : ''}>직접 입력</option></select></label>
  <div class="fld"><label>열유속</label><span></span><span class="num"><input type="number" data-cfgn="q" value="${c.q}" min="1" max="20000" step="10"> kW/m²</span></div><div class="fld"><label>시간</label><span></span><span class="num"><input type="number" data-cfgn="dur" value="${c.dur}" min="5" max="3600" step="5"> s</span></div>
  ${p.tps ? '' : '<p class="note">단열재가 없어요 — 벽이 플라즈마를 그대로 맞아요.</p>'}`;
 if (k === 'vib') h += `<p class="note">한쪽 끝을 가진기에 고정하고 비어 있는 상태(추진제 없음)로 흔들어요.</p>`;
 return h;
}
function resHtml(p) { const r = p.tests[S.tkind]; if (!r) return ''; return `<div class="res ${r.ok ? 'ok' : 'no'}"><b>${r.ok ? '통과' : '실패'}</b> · ${esc(r.sum)}<p>${esc(r.detail)}${r.ms != null && isFinite(r.ms) && r.kind !== 'plasma' ? ` · 안전 여유 ${r.ms > 9.99 ? '+999% 이상' : (r.ms >= 0 ? '+' : '') + nf(r.ms * 100, 0) + '%'}` : ''}</p></div>`; }
function renderEditor() {
 const p = ep(), ed = $('#editor'); if (!p) return; const s = p.shape, key = shapeKey(s), fromC = p.from && CARD[p.from], bench = p === S.bench, run = S.test && !S.test.done;
 const sf = FIELDS.filter(f => !f.only || f.only === s.prof).map(f => fldHtml(f, s[f.k], f.k === 'd1' && s.prof !== 'line' && s.prof !== 'boat' ? '끝 지름' : f.l, 'f')).join('');
 const pf = PFIELDS.filter(f => !f.tps || p.tps).map(f => fldHtml(f, p[f.k], f.l, 'pf')).join('');
 const mid = MATS[p.mat.id] ? p.mat.id : 'custom';
 const vt = visTests(p); if (!vt.some(([k]) => k === S.tkind) && vt.length) S.tkind = vt[0][0];
 const thumb = cardImgSrc(CARD[p.from] || CARD[p.card]);
 ed.innerHTML = `<div class="edhead">${thumb ? `<img class="edthumb" src="${esc(thumb)}" alt="" onerror="this.remove()">` : ''}<h2>${bench ? '부품 작업대' : '부품 편집'}</h2><small>${bench ? '이 부품만 띄워 놓고 설계해요' : '기체에 끼워진 부품이에요'}</small></div>
  <label class="row"><span>이름</span><input id="edName" value="${esc(p.name)}" maxlength="30"></label>
  <label class="row"><span>역할</span><select id="edRole">${Object.entries(ROLES).map(([k, l]) => `<option value="${k}" ${p.role === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
  <details data-open="shape" ${S.open.shape ? 'open' : ''}><summary>모양·크기 <small style="color:var(--mut);font-weight:400">${shapeName(s)} · ${m1(s.h)} m</small></summary>
   <div class="shapes">${SHAPES.map(([k, l]) => `<button class="shp ${key === k ? 'on' : ''}" data-shape="${k}" aria-pressed="${key === k}">${shapeSvg(SHAPE_DEMO[k], null, 60, 34)}${l}</button>`).join('')}</div>
   ${sf}
   <div class="tb"><button class="b" data-scale="0.9">전체 10% 작게</button><button class="b" data-scale="1.1">전체 10% 크게</button>${inStack(p) && S.parts.indexOf(p) > 0 ? '<button class="b" data-fit="1">아래 부품 지름에 맞추기</button>' : ''}</div>
  </details>
  <details data-open="mat" ${S.open.mat ? 'open' : ''}><summary>재질·구조 <small style="color:var(--mut);font-weight:400">${esc(p.mat.name)}</small></summary>
   <label class="row"><span>재질</span><select id="edMat">${Object.entries(MATS).map(([k, m]) => `<option value="${k}" ${mid === k ? 'selected' : ''}>${m.name}</option>`).join('')}${mid === 'custom' ? `<option value="custom" selected>${esc(p.mat.name)}</option>` : ''}</select></label>
   <p class="note" style="margin:0 0 6px">${esc(p.mat.note || '성질을 직접 고친 재질')}</p>
   <label class="row"><span>구조 방식</span><select id="edBuild">${Object.entries(BUILD).map(([k, b]) => `<option value="${k}" ${p.build === k ? 'selected' : ''}>${b.name}</option>`).join('')}</select></label>
   ${pf}
   <div class="derived" id="derived">${derivedHtml(p)}</div>
   <details data-open="props" ${S.open.props ? 'open' : ''} style="border:0;padding:4px 0 0"><summary style="font-size:13.5px;font-weight:400;color:var(--mut)">재질 성질 직접 고치기</summary>
    <div class="props">${MPROPS.map(([k, l, u, mn, mx]) => `<label>${l}<span><input type="number" data-mp="${k}" value="${p.mat[k]}" min="${mn}" max="${mx}" step="any">${u}</span></label>`).join('')}</div>
    <p class="note">값을 고치면 ‘${esc(p.mat.name.replace(/ \(수정\)$/, ''))} (수정)’ 재질이 되고, 카드에 함께 저장돼요.</p>
   </details>
  </details>
  <details data-open="test" ${S.open.test ? 'open' : ''}><summary>시험 <small style="color:var(--mut);font-weight:400">${vt.filter(([k]) => p.tests[k] && p.tests[k].ok).length}/${vt.length} 통과</small></summary>
   <div class="tests">${vt.map(([k, l]) => `<button class="tbtn ${S.tkind === k ? 'on' : ''}" data-tk="${k}">${l}<i class="${p.tests[k] ? (p.tests[k].ok ? 'ok' : 'no') : ''}"></i></button>`).join('')}</div>
   ${testCfgHtml(p)}
   <div class="tb"><button class="b hot" data-run="1" ${run ? 'disabled' : ''}>${run ? '시험 중…' : `${testName(S.tkind)} 시험 시작`}</button>${S.test && S.test.done ? '<button class="b" data-clrtest="1">시험대 정리</button>' : ''}</div>
   ${resHtml(p)}
  </details>
  ${PANELS.filter(q => !q.applies || q.applies(p)).map(q => `<details data-open="x_${q.id}" ${S.open['x_' + q.id] !== false ? 'open' : ''}><summary>${esc(q.title)}</summary><div data-panel="${q.id}">${q.html(p, HOLO)}</div></details>`).join('')}
  <div class="tb" style="border-top:1px solid var(--line);padding-top:10px"><button class="b hot" data-savecard="1">${fromC ? '새 카드로 저장' : '내 카드로 저장'}</button>${fromC ? `<button class="b" data-overwrite="1">‘${esc(fromC.name)}’ 덮어쓰기</button>` : ''}
   ${bench ? '<button class="b" data-insert="1">기체에 끼우기</button>' : `<button class="b ${S.showAll ? 'on' : ''}" data-showall="1">${S.showAll ? '이 부품만 보기' : '전체 기체에서 보기'}</button>`}
   <button class="b" data-close="1">${bench ? '작업대 닫기' : '편집 닫기'}</button></div>
  <p class="note">카드로 저장하면 모양·재질·두께와 붙어 있는 엔진·연료·단열재, 그리고 시험 결과까지 한 장에 담겨요.</p>`;
 PANELS.forEach(q => { const el = ed.querySelector(`[data-panel="${q.id}"]`); if (el && q.bind) { try { q.bind(el, p, HOLO); } catch (e) { console.error('[확장 패널 오류]', q.id, e); } } });
}
let gest = false;
function setNum(kind, k, raw, from) {
 const p = ep(); if (!p) return; const F = (kind === 'f' ? FIELDS : PFIELDS).find(q => q.k === k); let v = parseFloat(raw); if (!isFinite(v)) return; v = Math.min(F.max, Math.max(F.min, v / (F.mul || 1)));
 if (!gest) { snap(); gest = true; }
 if (kind === 'f') { p.shape[k] = fix(v); if (k === 'd0' && p.shape.prof === 'bulb' && p.shape.dm < p.shape.d0) p.shape.dm = p.shape.d0; } else p[k] = fix(v);
 touched(p); const o = $(from === 'r' ? `#n_${k}` : `#r_${k}`); if (o) o.value = fix(v * (F.mul || 1));
 const d = $('#derived'); if (d) d.innerHTML = derivedHtml(p); updInfo();
}
const ED = $('#editor');
ED.addEventListener('toggle', e => { const d = e.target; if (d.dataset && d.dataset.open) S.open[d.dataset.open] = d.open; }, true);
ED.addEventListener('input', e => { const t = e.target, p = ep(); if (!p) return;
 if (t.dataset.f) setNum('f', t.dataset.f, t.value, t.type === 'range' ? 'r' : 'n');
 else if (t.dataset.pf) setNum('pf', t.dataset.pf, t.value, t.type === 'range' ? 'r' : 'n');
 else if (t.id === 'edName') { p.name = t.value || '이름 없는 부품'; touched(p); $('#mode').textContent = (S.bench ? '작업대 · ' : '부품 편집 · ') + p.name; }
 else if (t.dataset.cfgn) { const v = parseFloat(t.value); if (isFinite(v)) { S.tcfg[t.dataset.cfgn] = v; if (t.dataset.cfgn === 'q' || t.dataset.cfgn === 'dur') S.tcfg.preset = 'custom'; } } });
ED.addEventListener('change', e => { const t = e.target, p = ep(); if (!p) return; gest = false;
 if (t.dataset.mp) { const v = parseFloat(t.value); if (isFinite(v)) { snap(); const base = MATS[p.mat.id] ? p.mat.name : p.mat.name.replace(/ \(수정\)$/, ''); p.mat = Object.assign({}, p.mat, { [t.dataset.mp]: v, id: 'custom', name: base + ' (수정)', note: '성질을 직접 고친 재질' }); touched(p); return changed(); } }
 if (t.id === 'edMat') { snap(); p.mat = Object.assign({ id: t.value }, MATS[t.value]); touched(p); toast(`재질: ${p.mat.name}`); return changed(); }
 if (t.id === 'edBuild') { snap(); p.build = t.value; touched(p); return changed(); }
 if (t.id === 'edRole') { snap(); p.role = t.value; let m = ''; if (p.role !== 'engbay' && p.engines.length) { p.engines = []; m = ' · 엔진은 엔진부에만 달 수 있어 떼었어요'; } if (p.role !== 'tank' && p.fuel) { p.fuel = null; m += ' · 연료를 비웠어요'; } touched(p); toast(`역할: ${ROLES[p.role]}${m}`); return changed(); }
 if (t.id === 'pPreset') { S.tcfg.preset = t.value; if (PLASMA[t.value]) { S.tcfg.q = PLASMA[t.value][1]; S.tcfg.dur = PLASMA[t.value][2]; } return renderEditor(); }
 if (t.dataset.cfgc) { S.tcfg[t.dataset.cfgc] = t.checked; return; }
 if ((t.dataset.f || t.dataset.pf) && t.type === 'number') return changed();
 save(); });
ED.addEventListener('click', e => { const b = e.target.closest('button'); const p = ep(); if (!b || !p) return; const s = p.shape;
 if (b.dataset.shape) { snap(); const k = b.dataset.shape; if (k === 'cyl') { s.prof = 'line'; s.d1 = s.d0; } else if (k === 'cone') { s.prof = 'line'; s.d1 = 0; } else if (k === 'taper') { s.prof = 'line'; if (Math.abs(s.d1 - s.d0) < 0.05 || s.d1 < 0.05) s.d1 = fix(s.d0 * 0.6); } else { s.prof = k; if (k === 'boat') { if (Math.abs(s.d1 - s.d0) < 0.05) s.d1 = fix(s.d0 * 0.7); } else s.d1 = 0; if (k === 'bulb') s.dm = Math.max(s.dm || 0, fix(s.d0 * 1.3)); } touched(p); return changed(); }
 if (b.dataset.scale) { snap(); const f = +b.dataset.scale; ['h', 'd0', 'd1', 'dm'].forEach(k => { const F = FIELDS.find(q => q.k === k); s[k] = fix(Math.min(F.max, Math.max(k === 'd1' ? 0 : F.min, s[k] * f))); }); touched(p); return changed(); }
 if (b.dataset.fit) { const below = S.parts[S.parts.indexOf(p) - 1]; if (!below) return; snap(); const d = below.shape.d1 > 0.3 ? below.shape.d1 : below.shape.d0, wasCyl = shapeKey(s) === 'cyl'; s.d0 = d; if (wasCyl) s.d1 = d; if (s.prof === 'bulb' && s.dm < d) s.dm = d; touched(p); toast(`아래 지름을 ${m1(d)} m로 맞췄어요`); return changed(); }
 if (b.dataset.tk) { S.tkind = b.dataset.tk; return renderEditor(); }
 if (b.dataset.cfg) { S.tcfg[b.dataset.cfg] = b.dataset.val; return renderEditor(); }
 if (b.dataset.run) return startTest();
 if (b.dataset.clrtest) { S.test = null; $('#hud').hidden = true; document.body.classList.remove('testing'); return renderEditor(); }
 if (b.dataset.savecard || b.dataset.overwrite) {
  const part = strip1(JSON.parse(JSON.stringify(Object.assign({}, p, { v: null })))); delete part.from; delete part.card;
  const body = { cat: 'st', custom: true, name: p.name, kind: p.role, part, desc: `${shapeName(s)} · ${p.mat.name} · ${m1(s.h)}×Ø${m1(s.d0)} m` };
  if (b.dataset.overwrite) { const c = S.custom.find(q => q.id === p.from); if (c) Object.assign(c, body); toast(`‘${p.name}’ 카드를 새 설계로 덮어썼어요`); }
  else { if (S.custom.length >= 60) return toast('내 카드는 60장까지 저장돼요'); const c = Object.assign({ id: 'u' + Date.now().toString(36) }, body); S.custom.unshift(c); p.from = c.id; toast(`‘${p.name}’을(를) 내 카드로 저장했어요`); }
  S.benchDirty = false; rebuildCards(); return changed();
 }
 if (b.dataset.insert) { snap(); const at = defaultIns(p.role), q = revive1(JSON.parse(JSON.stringify(strip1(p)))); S.parts.splice(at, 0, q); S.bench = null; S.test = null; S.sel = q.uid; S.panel = 'cards'; S.cat = 'st'; S.benchDirty = false; toast(`${q.name}을(를) 기체에 끼웠어요${p.from ? '' : ' · 카드로 저장하지 않은 설계예요'}`); renderDeck(); return changed(); }
 if (b.dataset.showall) { S.showAll = !S.showAll; S.test = null; $('#hud').hidden = true; renderDeck(); return changed(); }
 if (b.dataset.close) { if (p === S.bench && S.benchDirty && !b.classList.contains('arm')) { b.classList.add('arm'); b.textContent = '저장 안 하고 닫을까요?'; setTimeout(() => { if (b.isConnected) { b.classList.remove('arm'); b.textContent = '작업대 닫기'; } }, 2600); return; } $('#hud').hidden = true; return closeEdit(); }
});
