/* 09-test-fx.js — 시험 연출(변형·장비·파편)과 매 프레임 루프 frame()
   모든 js 파일은 같은 전역 공간을 공유하는 일반 <script>입니다. 순서대로 로드되고, 마지막 99-boot.js가 앱을 시작합니다. */
/* ---------- 시험 연출 ---------- */
function bb(T) { // 온도(°C) → 빛 색
 if (T < 450) return null; const u = Math.min(1, (T - 450) / 1800), r = 255, g = Math.round(40 + 215 * Math.min(1, u * 1.4)), b = Math.round(255 * Math.max(0, u - 0.55) * 2.2); return [r, g, Math.min(255, b), Math.min(0.85, 0.25 + u)];
}
function stressTint(ratio) { const r = Math.max(0, Math.min(1, ratio)); return r < 0.5 ? null : r < 0.85 ? '255,194,74' : '255,93,115'; }
function testDeform(L, tau, now) {
 const X = TEST_EXT[S.test.kind]; if (X) return X.deform ? X.deform(L, tau, S.test, HOLO) : null;
 const T = S.test, R = T.R, failed = R.failAt != null && tau >= R.failAt, h = L.y0 - L.y1, ld = R.load(Math.min(tau, R.failAt ?? 1)), lr = ld / R.cap;
 if (T.kind === 'press') { const A = R.aux, P = ld, sig = A.hoop(P), E = L.p.mat.E * 1000, eps = sig < A.Su * 0.98 * (A.Py / A.Pb) ? sig / E : A.Py / A.Pb * A.Su / E + (sig - A.Py / A.Pb * A.Su) / (E * 0.015), bul = Math.min(0.3, eps * 35);
  if (failed) return null; return { dx: () => 0, rm: u => 1 + bul * Math.sin(Math.PI * Math.min(1, Math.max(0, u * 1.05 - 0.02))), hm: 1, tint: stressTint(lr), fill: T.medium === 'ln2' ? 'rgba(220,240,255,.10)' : 'rgba(90,170,255,.12)' }; }
 if (T.kind === 'comp') { const sq = failed ? 0.9 : 1 - 0.01 * lr, nW = 4; return { dx: () => 0, hm: sq, rm: failed ? u => 1 + 0.07 * Math.max(0, Math.sin(u * Math.PI * nW * 2 + 0.5)) : () => 1, tint: failed ? '255,93,115' : stressTint(lr),
  wrinkle: failed ? (cxu, y0, hh, rf) => { tintCol = '255,93,115'; for (let j = 0; j < nW; j++) for (let k = 0; k < 10; k++) { const ph = k / 10 * Math.PI * 2 + S.rot, d = Math.cos(ph); if (d < 0.1) continue; const u0 = j / nW, u1 = (j + 0.5) / nW, u2 = (j + 1) / nW; glowLine([[cxu(u0) + Math.sin(ph) * rf(u0), y0 - u0 * hh], [cxu(u1) + Math.sin(ph + 0.3) * rf(u1), y0 - u1 * hh], [cxu(u2) + Math.sin(ph) * rf(u2), y0 - u2 * hh]], 0.8 * d, 1.4); } } : null }; }
 if (T.kind === 'bend') { const EI = R.aux.EI, Lm = R.aux.L, defl = ld * 1e6 * Lm * Lm / (2 * EI), dpx = Math.min(h * 0.12, defl * geo.sc * 60) + (failed ? h * 0.18 * Math.min(1, (tau - R.failAt) * 6) : 0);
  return { dx: u => dpx * u * u * (failed ? 0.4 : 1) + (failed ? dpx * 0.6 * Math.min(1, u * 8) : 0), rm: () => 1, hm: 1, tint: failed ? '255,93,115' : stressTint(lr),
   wrinkle: failed ? (cxu, y0, hh, rf) => { tintCol = '255,93,115'; for (let k = 0; k < 8; k++) { const ph = k / 8 * Math.PI * 2 + S.rot, d = Math.cos(ph); if (d < 0) continue; const u = 0.06 + k % 2 * 0.03; glowLine([[cxu(u) + Math.sin(ph) * rf(u) - 6, y0 - u * hh - 4], [cxu(u) + Math.sin(ph) * rf(u), y0 - u * hh + 4], [cxu(u) + Math.sin(ph) * rf(u) + 6, y0 - u * hh - 4]], 0.9 * d, 1.5); } } : null }; }
 if (T.kind === 'vib') { const f = R.aux.fr(tau), H_ = R.aux.Hf(f), amp = Math.min(h * 0.16, 2 + H_ * h * 0.012) * (T.done ? 0.2 : 1), ph = T.vph; return { dx: u => amp * (1 - Math.cos(Math.PI * u / 2)) * Math.sin(ph) + Math.sin(ph) * 2, rm: () => 1, hm: 1, tint: failed ? '255,93,115' : stressTint(lr),
  wrinkle: failed ? (cxu, y0, hh, rf) => { tintCol = '255,93,115'; ring(cxu(0.04), y0 - 0.04 * hh, rf(0.04) * 1.02, 1); } : null }; }
 if (T.kind === 'plasma') { const o = R.aux.at(Math.min(tau, 1)), c = bb(o.Ts); return { dx: () => 0, rm: () => 1, hm: 1, tint: failed ? '255,93,115' : null,
  heat: (cxu, y0, hh, rf) => { if (!c) return; x.save(); bodyPath(cxu, y0, hh, rf); x.clip(); const cx = cxu(0.5), Rr = Math.max(rf(0.5), 4), g = x.createLinearGradient(cx - Rr, 0, cx + Rr * 0.6, 0); g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${c[3]})`); g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`); x.globalCompositeOperation = 'lighter'; x.fillStyle = g; x.fillRect(cx - Rr * 1.2, y0 - hh, Rr * 2.4, hh); x.restore(); } }; }
 return null;
}
function drawRig(L, tau, now, dt) {
 const T = S.test, R = T.R, failed = R.failAt != null && tau >= R.failAt, cx = geo.cx, y0 = L.y0, h = L.y0 - L.y1, mr = Math.max(L.mr, 12);
 const X = TEST_EXT[T.kind];
 x.save(); x.globalCompositeOperation = 'source-over';
 if (X && X.rig) { x.save(); try { X.rig(L, tau, now, dt, T, HOLO); } catch (e) { console.error('[확장 시험 그리기 오류]', T.kind, e); } x.restore(); }
 const slab = (y, w, th, col) => { x.fillStyle = col; x.fillRect(cx - w, y, w * 2, th); x.strokeStyle = lineA(0.7); x.strokeRect(cx - w, y, w * 2, th); };
 if (!X && T.kind === 'comp') { const sq = failed ? 0.9 : 1 - 0.01 * (R.load(Math.min(tau, R.failAt ?? 1)) / R.cap), top = y0 - h * sq; slab(y0, mr * 1.6, 12, 'rgba(20,50,70,.9)'); slab(top - 14, mr * 1.6, 14, 'rgba(20,50,70,.9)');
  for (const sx of [-1.45, 1.45]) { x.strokeStyle = lineA(0.6); x.lineWidth = 6; x.beginPath(); x.moveTo(cx + sx * mr, top - 14); x.lineTo(cx + sx * mr, Math.max(20, top - 14 - H * 0.2)); x.stroke(); x.lineWidth = 1; }
  x.fillStyle = 'rgba(255,194,74,.95)'; x.beginPath(); x.moveTo(cx, top - 18); x.lineTo(cx - 10, top - 36); x.lineTo(cx + 10, top - 36); x.fill(); }
 if (!X && T.kind === 'bend') { slab(y0, mr * 1.8, 16, 'rgba(20,50,70,.9)'); const D = testDeform(L, tau, now), tx = cx + D.dx(1) + mr * 1.1, ty = y0 - h; x.strokeStyle = 'rgba(255,194,74,.95)'; x.lineWidth = 3; x.beginPath(); x.moveTo(tx + 50, ty + 8); x.lineTo(tx + 4, ty + 8); x.stroke(); x.fillStyle = 'rgba(255,194,74,.95)'; x.beginPath(); x.moveTo(tx, ty + 8); x.lineTo(tx + 14, ty); x.lineTo(tx + 14, ty + 16); x.fill(); x.lineWidth = 1; }
 if (!X && T.kind === 'vib') { const D = testDeform(L, tau, now), bx = D.dx(0); slab(y0 + 2, mr * 1.7, 18, 'rgba(20,50,70,.95)'); x.fillStyle = 'rgba(63,240,255,.15)'; x.fillRect(cx - mr * 2 + bx, y0 + 20, mr * 4, 26); x.strokeStyle = lineA(0.6); x.strokeRect(cx - mr * 2 + bx, y0 + 20, mr * 4, 26); x.fillStyle = 'rgba(216,246,255,.85)'; x.font = '600 12px "IBM Plex Sans KR",sans-serif'; x.textAlign = 'center'; x.fillText('가진기', cx + bx, y0 + 37); x.textAlign = 'left'; }
 if (!X && T.kind === 'press') { slab(y0 + 2, mr * 1.4, 10, 'rgba(20,50,70,.9)'); x.strokeStyle = 'rgba(120,190,255,.8)'; x.lineWidth = 3; x.beginPath(); x.moveTo(cx - mr * 1.4, y0 + 7); x.lineTo(cx - mr * 2.4, y0 + 7); x.lineTo(cx - mr * 2.4, H - 10); x.stroke(); x.lineWidth = 1;
  if (failed && !T.frags) { T.frags = []; const n = 46; for (let i = 0; i < n; i++) { const u = Math.random(), side = Math.random() < 0.5 ? -1 : 1, r = L.rf(u), sp = 3 + Math.random() * 9; T.frags.push({ x: cx + side * r * Math.random(), y: y0 - u * h, vx: side * sp * (0.5 + Math.random()), vy: -Math.random() * 7, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, s: 4 + Math.random() * mr * 0.35 }); } for (let i = 0; i < 60; i++) T.parts.push({ x: cx + (Math.random() - 0.5) * mr, y: y0 - Math.random() * h, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.7) * 6, r: 6 + Math.random() * 18, life: 1 }); } }
 if (!X && T.kind === 'plasma') { const o = R.aux.at(Math.min(tau, 1)), ny = y0 - h * 0.5, rx = cx - Math.max(L.rf(0.5), 6), nx = Math.max(16, rx - Math.max(180, W * 0.22)), jw = Math.min(h * 0.35, 60) + 8, on = !T.done || tau < 1;
  x.fillStyle = 'rgba(30,60,80,.95)'; x.fillRect(nx - 40, ny - jw * 0.7, 40, jw * 1.4); x.strokeStyle = lineA(0.7); x.strokeRect(nx - 40, ny - jw * 0.7, 40, jw * 1.4);
  if (on && !T.done) { x.globalCompositeOperation = 'lighter'; const g = x.createLinearGradient(nx, 0, rx, 0); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.25, 'rgba(255,120,230,.75)'); g.addColorStop(1, 'rgba(150,90,255,.35)'); x.fillStyle = g; x.beginPath(); x.moveTo(nx, ny - jw * 0.3); x.quadraticCurveTo((nx + rx) / 2, ny - jw * (0.6 + 0.08 * Math.sin(now / 40)), rx, ny - jw); x.lineTo(rx, ny + jw); x.quadraticCurveTo((nx + rx) / 2, ny + jw * (0.6 + 0.08 * Math.cos(now / 37)), nx, ny + jw * 0.3); x.closePath(); x.fill();
   const sg = x.createRadialGradient(rx, ny, 2, rx, ny, jw * 1.3); sg.addColorStop(0, 'rgba(255,255,255,.8)'); sg.addColorStop(1, 'rgba(255,120,230,0)'); x.fillStyle = sg; x.beginPath(); x.ellipse(rx, ny, jw * 0.5, jw * 1.3, 0, 0, Math.PI * 2); x.fill();
   if (!RM && Math.random() < 0.6) T.parts.push({ x: rx, y: ny + (Math.random() - 0.5) * jw * 1.6, vx: -1 - Math.random() * 3, vy: (Math.random() - 0.5) * 5, r: 1.5, life: 1, spark: true }); }
  if (failed) { x.globalCompositeOperation = 'lighter'; const hg = x.createRadialGradient(rx + 4, ny, 1, rx + 4, ny, 26); hg.addColorStop(0, 'rgba(255,255,230,1)'); hg.addColorStop(1, 'rgba(255,90,40,0)'); x.fillStyle = hg; x.beginPath(); x.arc(rx + 4, ny, 26, 0, Math.PI * 2); x.fill(); if (!RM && !T.done) for (let i = 0; i < 3; i++) T.parts.push({ x: rx + 4, y: ny, vx: 2 + Math.random() * 5, vy: (Math.random() - 0.8) * 5, r: 2, life: 1, spark: true, hot: true }); }
  x.globalCompositeOperation = 'source-over'; label(`${nf(o.Ts, 0)}°C`, rx - 8, ny - jw - 16, 'rgba(255,210,150,.95)', 'r'); }
 // 파편·입자
 if (T.frags) { x.globalCompositeOperation = 'lighter'; T.frags.forEach(f => { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 0.35 * dt; f.rot += f.vr * dt; if (f.y > H * 0.9) { f.y = H * 0.9; f.vy *= -0.3; f.vx *= 0.7; } x.save(); x.translate(f.x, f.y); x.rotate(f.rot); x.strokeStyle = 'rgba(255,140,120,.9)'; x.fillStyle = 'rgba(63,240,255,.15)'; x.beginPath(); x.moveTo(-f.s / 2, -f.s / 4); x.lineTo(f.s / 2, -f.s / 3); x.lineTo(f.s / 3, f.s / 4); x.lineTo(-f.s / 3, f.s / 3); x.closePath(); x.fill(); x.stroke(); x.restore(); }); }
 x.globalCompositeOperation = 'lighter';
 T.parts = T.parts.filter(q => (q.life -= (q.spark ? 0.03 : 0.012) * dt) > 0);
 T.parts.forEach(q => { q.x += q.vx * dt; q.y += q.vy * dt; if (!q.spark) { q.r += 0.6 * dt; q.vx *= 0.97; q.vy *= 0.97; } else q.vy += 0.15 * dt;
  if (q.spark) { x.fillStyle = q.hot ? `rgba(255,220,150,${q.life})` : `rgba(255,170,240,${q.life})`; x.fillRect(q.x, q.y, 2, 2); } else { const g = x.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.r); const c = T.medium === 'ln2' ? '235,245,255' : '150,200,255'; g.addColorStop(0, `rgba(${c},${0.35 * q.life})`); g.addColorStop(1, `rgba(${c},0)`); x.fillStyle = g; x.beginPath(); x.arc(q.x, q.y, q.r, 0, Math.PI * 2); x.fill(); } });
 x.restore();
}
let lastT = 0;
function frame(tm) {
 const dt = Math.min(3, lastT ? (tm - lastT) / 16.67 : 1); lastT = tm;
 if (S.auto && !S.dragRot && !RM && !(S.test && !S.test.done)) S.rot += 0.004 * dt;
 const solo = isSolo(), E = ep();
 let shake = 0; const T = S.test; let tau = 0;
 document.body.classList.toggle('testing', !!T); if (!T && !$('#hud').hidden) $('#hud').hidden = true;
 if (T) { const el = tm - T.t0; tau = el / T.dur; T.vph = (T.vph || 0) + (T.kind === 'vib' && !TEST_EXT.vib ? 2 * Math.PI * Math.min(T.R.aux.fr(Math.min(tau, 1)), 14) / 60 * dt * 0.5 : 0);
  if (!T.done && el > T.dur + T.post) finishTest(); if (T.R.failAt != null && tau >= T.R.failAt && tau < T.R.failAt + 0.06 && !TEST_EXT[T.kind] && (T.kind === 'press' || T.kind === 'comp')) shake = 6; if (T.shake) { shake = T.shake; T.shake = 0; } updHud(Math.min(tau, 1)); }
 x.clearRect(0, 0, W, H); x.save(); if (shake && !RM) x.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
 drawProjector(tm); computeLayout(solo && E ? [E] : S.parts, solo);
 x.save(); if (!RM) x.globalAlpha = 0.92 + 0.08 * Math.sin(tm / 90) * Math.sin(tm / 37);
 layout.forEach(L => { const D = T && solo && L.p === T.p ? testDeform(L, Math.min(tau, 1), tm) : null; if (T && solo && L.p === T.p && (T.kind === 'press' && !TEST_EXT.press || T.R.hidePart) && T.R.failAt != null && tau >= T.R.failAt) return; drawPart(L, !solo && (L.p.uid === S.sel || (E && L.p === E)), S.hover && S.hover.uid === L.p.uid, D); });
 x.restore();
 if (T && solo && layout[0]) drawRig(layout[0], Math.min(tau, 1), tm, dt);
 const SL = solo ? (!T ? layout[0] : null) : layout.find(L => L.p.uid === S.sel || L.p === E); if (SL) drawDims(SL);
 if (S.drag && S.drag.over) { const D = S.drag, hw = geo.mr * 1.6 + 20; x.save(); x.globalCompositeOperation = 'lighter';
  if (D.ins != null) { const y = D.ins < layout.length ? layout[D.ins].y0 : (layout.length ? layout[layout.length - 1].y1 : geo.base - 20); glowLine([[geo.cx - hw, y], [geo.cx + hw, y]], 1, 2.4); x.fillStyle = '#ffc24a'; x.font = '600 13px "IBM Plex Sans KR",sans-serif'; x.fillText('여기에 끼우기', Math.min(geo.cx + hw + 8, W - 90), y + 4); }
  else if (D.tgt) { const L = layout.find(q => q.p === D.tgt); if (L) { const w = Math.max(L.mr, 10) * 1.5; x.strokeStyle = '#ffc24a'; x.lineWidth = 2; x.strokeRect(geo.cx - w, L.y1 - 6, w * 2, L.y0 - L.y1 + 12 + L.ex); } }
  x.restore(); }
 for (const f of DRAW_HOOKS) { if (f.dead) continue; x.save(); try { f({ ctx: x, W, H, geo, layout, solo, part: E, test: T, tau: Math.min(tau, 1), now: tm, dt }); } catch (e) { f.dead = true; console.error('[확장 그리기 오류 — 이 훅은 꺼짐]', e); } x.restore(); }
 x.restore();
 requestAnimationFrame(frame);
}
