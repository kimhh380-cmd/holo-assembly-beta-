/* 08-render.js — 홀로그램 그리기: 배치, 와이어프레임, 엔진, 부착물, 치수선, 투사대
   모든 js 파일은 같은 전역 공간을 공유하는 일반 <script>입니다. 순서대로 로드되고, 마지막 99-boot.js가 앱을 시작합니다. */
/* ---------- 홀로그램 ---------- */
const cv = $('#cv'), x = cv.getContext('2d'); let W = 0, H = 0, layout = [], geo = null;
let TILT = 0.26, VCOS = 0.966; const HC = '63,240,255';
// 3D 카메라: pitch(내려다보는 각도, rad), zoom(배율), px·py(화면 이동 px). S.rot이 좌우 회전(yaw)
const VIEW = { pitch: 0.263, zoom: 1, px: 0, py: 0, to: null };
const VIEW0 = { pitch: 0.263, zoom: 1, px: 0, py: 0 };
function applyView() {
 if (VIEW.to) { let done = true; for (const k of ['pitch', 'zoom', 'px', 'py']) { const d = VIEW.to[k] - VIEW[k]; if (Math.abs(d) > (k === 'zoom' || k === 'pitch' ? 1e-3 : 0.3)) { VIEW[k] += d * (RM ? 1 : 0.2); done = false; } else VIEW[k] = VIEW.to[k]; } if (done) VIEW.to = null; }
 TILT = Math.sin(VIEW.pitch); VCOS = Math.cos(VIEW.pitch);
}
function setView(v) { VIEW.to = Object.assign({ pitch: VIEW.pitch, zoom: VIEW.zoom, px: VIEW.px, py: VIEW.py }, v); }
// 화면의 한 점(sx, sy)을 고정한 채로 확대·축소
function zoomAt(sx, sy, f) { const z = Math.min(12, Math.max(0.25, VIEW.zoom * f)), k = z / VIEW.zoom; if (!geo) { VIEW.zoom = z; return; } VIEW.to = null; VIEW.px += (sx - geo.cx) * (1 - k); VIEW.py += (sy - geo.base) * (1 - k); VIEW.zoom = z; }
function size() { const r = cv.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1); W = r.width; H = r.height; cv.width = Math.round(W * d); cv.height = Math.round(H * d); x.setTransform(d, 0, 0, d, 0, 0); }
new ResizeObserver(size).observe(cv); size();
const nozM = p => p.engines.reduce((m, e) => Math.max(m, CARD[e].noz * 1.9), 0);
function nozzleM() { const b = S.parts[0]; return b && b.role === 'engbay' ? nozM(b) : 0; }
const centerX = () => W > 760 ? W * 0.56 : W * 0.55;
function computeLayout(list, solo) {
 const k = RM ? 1 : 0.2;
 list.forEach(p => { if (!p.v) p.v = Object.assign({}, p.shape); for (const f of ['h', 'd0', 'd1', 'dm', 'k', 'sp']) { const t = p.shape[f] ?? 0, c = p.v[f] ?? t; p.v[f] = Math.abs(t - c) < 1e-3 ? t : c + (t - c) * k; } p.v.prof = p.shape.prof; });
 const nh = solo ? (list[0] && list[0].role === 'engbay' ? nozM(list[0]) : 0) : nozzleM(), total = list.reduce((a, p) => a + p.v.h, 0) + nh, mD = list.reduce((a, p) => Math.max(a, maxR(p.v) * 2), 0.5);
 const hb = W <= 760 && S.test ? $('#hud').offsetHeight + 24 : 0, base = solo ? Math.min(H * 0.78, H - hb - 12) : H * 0.86, avail = solo ? Math.min(H * 0.56, base - 40) : base - 50, target = Math.min(avail / Math.max(total, solo ? 0.5 : 4), W * (solo ? 0.26 : 0.3) / mD, solo ? 400 : 70);
 S.scv = S.scv && !RM ? S.scv + (target - S.scv) * 0.12 : target;
 const sc = S.scv * VIEW.zoom, cx = centerX() + VIEW.px, b0 = base + VIEW.py; let y = b0 - nh * sc * VCOS; layout = [];
 list.forEach(p => { const h = p.v.h * sc * VCOS; layout.push({ p, y0: y, y1: y - h, hraw: p.v.h * sc, rf: rfOf(p.v, sc), mr: maxR(p.v) * sc, ex: p.role === 'engbay' ? nozM(p) * sc * VCOS : 0 }); y -= h; });
 geo = { sc, vc: VCOS, tilt: TILT, cx, base: b0, top: y, solo, mr: layout.reduce((a, L) => Math.max(a, L.mr), 10) };
}
const lineA = a => `rgba(${HC},${a})`;
let tintCol = null;
function glowLine(pts, a, w) { const c = tintCol || HC; x.lineWidth = (w || 1.2) * 3.2; x.strokeStyle = `rgba(${c},${a * 0.18})`; x.beginPath(); pts.forEach((q, i) => i ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.stroke(); x.lineWidth = w || 1.2; x.strokeStyle = `rgba(${c},${a})`; x.stroke(); }
function ring(cxv, y, r, a) { const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40 * Math.PI * 2; pts.push([cxv + Math.sin(t) * r, y + Math.cos(t) * r * TILT]); } glowLine(pts.slice(0, 21), a); glowLine(pts.slice(20), a * 0.35); }
function profile(cxu, y0, h, rf, a, nMer, rings) { const N = 26; for (let k = 0; k < nMer; k++) { const ph = k / nMer * Math.PI * 2 + S.rot, d = Math.cos(ph), pts = []; for (let i = 0; i <= N; i++) { const u = i / N, r = rf(u); pts.push([cxu(u) + Math.sin(ph) * r, y0 - u * h + d * r * TILT]); } glowLine(pts, a * (d > 0 ? 0.85 : 0.22), d > 0 ? 1.2 : 0.9); } rings.forEach(u => { const r = rf(u); if (r > 0.8) ring(cxu(u), y0 - u * h, r, a * 0.9); }); }
function bodyPath(cxu, y0, h, rf) { x.beginPath(); for (let i = 0; i <= 30; i++) { const u = i / 30; x.lineTo(cxu(u) - rf(u), y0 - u * h); } for (let i = 30; i >= 0; i--) { const u = i / 30; x.lineTo(cxu(u) + rf(u), y0 - u * h); } x.closePath(); }
function fillBody(cxu, y0, h, rf, col, alpha) { bodyPath(cxu, y0, h, rf); const R = Math.max(rf(0.5), 1), c = cxu(0.5), g = x.createLinearGradient(c - R, 0, c + R, 0); g.addColorStop(0, col + '10'); g.addColorStop(0.45, col + Math.round(Math.min(1, alpha) * 255).toString(16).padStart(2, '0')); g.addColorStop(1, col + '18'); x.fillStyle = g; x.fill(); }
function tpsOverlay(cxu, y0, h, rf, t, R) { const T = CARD[t]; if (!T) return; x.save(); bodyPath(cxu, y0, h, rf); x.clip(); x.globalAlpha = 0.55; x.fillStyle = T.col; x.fill(); x.globalAlpha = 1; const cx = cxu(0.5);
 if (T.pat === 'hex') { const s = Math.max(4, R / 5); for (let yy = y0; yy > y0 - h - s; yy -= s * 0.9) for (let k = -8; k <= 8; k++) { const ph = (k / 8) * Math.PI / 2 + (S.rot % (Math.PI / 8)), sh = Math.cos(ph); if (sh < 0.1) continue; const xx = cx + Math.sin(ph) * R * 1.02, w = s * 0.5 * sh; x.strokeStyle = lineA(0.28 * sh); x.lineWidth = 1; x.beginPath(); x.moveTo(xx - w, yy); x.lineTo(xx - w / 2, yy - s * 0.42); x.lineTo(xx + w / 2, yy - s * 0.42); x.lineTo(xx + w, yy); x.lineTo(xx + w / 2, yy + s * 0.42); x.lineTo(xx - w / 2, yy + s * 0.42); x.closePath(); x.stroke(); } }
 else if (T.pat === 'quilt') { x.strokeStyle = 'rgba(255,255,255,.25)'; for (let yy = y0; yy > y0 - h; yy -= 7) { x.beginPath(); x.moveTo(cx - R, yy); x.lineTo(cx + R, yy - 7); x.stroke(); } }
 else if (T.pat === 'sheen') { const g = x.createLinearGradient(cx - R, 0, cx + R, 0); g.addColorStop(((S.rot * 0.3) % 1 + 1) % 1, 'rgba(255,250,200,.45)'); g.addColorStop(1, 'rgba(255,250,200,0)'); x.fillStyle = g; x.fillRect(cx - R, y0 - h, 2 * R, h); }
 else if (T.pat !== 'none') { x.fillStyle = 'rgba(255,255,255,.18)'; for (let q = 0; q < 60; q++) { const u = (q * 0.618) % 1, v = (q * 0.383) % 1; x.fillRect(cx - R + u * 2 * R, y0 - v * h, 1.5, 1.5); } }
 x.restore(); }
function ringsFor(p) { const s = p.v; if (s.prof === 'ogive') return [0, 0.35, 0.65, 0.85]; if (s.prof === 'dome') return [0, 0.4, 0.75]; if (s.prof === 'bulb') return [0, 0.12, s.sp, (s.sp + 1) / 2]; if (p.role === 'tank') { const n = Math.max(2, Math.min(8, Math.round(s.h / Math.max(s.d0, 0.5) * 1.2))); return Array.from({ length: n + 1 }, (_, i) => i / n); } return [0, 0.5, 1].slice(0, s.h > 0.5 ? 3 : 2); }
const NOD = { dx: () => 0, rm: () => 1, hm: 1 };
function drawPart(L, sel, hov, D) {
 D = D || NOD; const p = L.p, h = (L.y0 - L.y1) * D.hm, y0 = L.y0, a = sel ? 1 : hov ? 0.95 : 0.8, cxu = u => geo.cx + D.dx(u), rf = u => L.rf(u) * D.rm(u), R0 = Math.max(rf(0), 2), R = Math.max(L.mr, 2);
 if ((L.hraw ?? h) < 0.5) return; x.save();
 if (p.fuel && p.role === 'tank') fillBody(cxu, y0, h, u => rf(u) * 0.93, FUEL_OF(p.fuel), 0.35 + 0.08 * Math.sin(performance.now() / 600)); else fillBody(cxu, y0, h, rf, '#3ff0ff', 0.06);
 if (p.tps) tpsOverlay(cxu, y0, h, rf, p.tps, R);
 if (D.fill) { x.save(); bodyPath(cxu, y0, h, rf); x.fillStyle = D.fill; x.fill(); x.restore(); }
 if (D.heat) D.heat(cxu, y0, h, rf);
 if (sel) { x.save(); x.globalCompositeOperation = 'lighter'; fillBody(cxu, y0, h, u => rf(u) * 1.04, '#ffc24a', 0.16); x.restore(); }
 x.globalCompositeOperation = 'lighter'; tintCol = D.tint || null;
 profile(cxu, y0, h, rf, a, p.role === 'engbay' || p.role === 'inter' ? 10 : p.build === 'stringer' ? 22 : 14, ringsFor(p));
 if (p.build === 'iso') { for (let k = 0; k < 10; k++) { const ph = k / 10 * Math.PI * 2 + S.rot; for (const sgn of [1, -1]) { const pts = []; for (let i = 0; i <= 12; i++) { const u = i / 12, q = ph + sgn * u * 0.9, d = Math.cos(q); pts.push([cxu(u) + Math.sin(q) * rf(u), y0 - u * h + d * rf(u) * TILT, d]); } glowLine(pts.filter(q => q[2] > 0), 0.18); } } }
 if (p.role === 'capsule') { for (let k = 0; k < 4; k++) { const ph = k / 4 * Math.PI * 2 + S.rot, d = Math.cos(ph); if (d < 0.2) continue; const r = rf(0.55); x.fillStyle = `rgba(255,194,74,${0.6 * d})`; x.fillRect(cxu(0.55) + Math.sin(ph) * r * 0.9 - 3, y0 - h * 0.6, 6 * d, h * 0.12); } }
 if (p.role === 'inter') { for (let k = 0; k < 8; k++) { const ph = k / 8 * Math.PI * 2 + S.rot, ph2 = ph + Math.PI / 8, d = Math.cos(ph); if (d < -0.2) continue; glowLine([[cxu(0) + Math.sin(ph) * rf(0), y0 + Math.cos(ph) * rf(0) * TILT], [cxu(1) + Math.sin(ph2) * rf(1), y0 - h + Math.cos(ph2) * rf(1) * TILT]], 0.5 * (d + 0.4)); } }
 if (p.role === 'hotring') { for (let k = 0; k < 12; k++) { const ph = k / 12 * Math.PI * 2 + S.rot, d = Math.cos(ph); if (d < 0) continue; const xx = cxu(0.5) + Math.sin(ph) * rf(0.5); x.fillStyle = `rgba(255,194,74,${0.55 * d})`; x.fillRect(xx - 2 * d, y0 - h * 0.8, 4 * d, h * 0.6); } }
 if (D.wrinkle) D.wrinkle(cxu, y0, h, rf);
 if (p.role === 'engbay' && p.engines.length) drawEngines(p, cxu(0), y0, R0, a);
 p.att.forEach(t => drawAtt(t, cxu(0.5), y0, h, R, a, p.role));
 tintCol = null; x.restore();
}
function engLayout(n) { const P = [], rg = (m, r, o) => { for (let q = 0; q < m; q++) { const t = o + 2 * Math.PI * q / m; P.push([Math.cos(t) * r, Math.sin(t) * r]); } };
 if (n === 1) P.push([0, 0]); else if (n <= 4) rg(n, 0.5, 0); else if (n <= 9) { P.push([0, 0]); rg(n - 1, 0.66, 0); } else if (n <= 20) { const i = Math.max(3, Math.round(n * 0.3)); rg(i, 0.33, 0); rg(n - i, 0.78, 0); } else { const b = Math.round((n - 3) * 0.34); rg(3, 0.14, Math.PI / 2); rg(b, 0.46, 0); rg(n - 3 - b, 0.84, 0); } return P; }
function drawEngines(p, cx, y0, R, a) {
 const n = p.engines.length, lay = engLayout(n), sp = n <= 1 ? 1 : n <= 4 ? 0.6 : n <= 9 ? 0.42 : n <= 20 ? 0.3 : 0.17;
 const items = lay.map((q, i) => { const ph = S.rot, px = q[0] * Math.cos(ph) - q[1] * Math.sin(ph), pz = q[0] * Math.sin(ph) + q[1] * Math.cos(ph); return { id: p.engines[i], X: cx + px * R * 0.92, Y: y0 + pz * R * TILT * 0.92, d: pz }; }).sort((u, v) => u.d - v.d);
 items.forEach(it => { const E = CARD[it.id], w = Math.min(E.noz, E.vac ? 1.8 : 1) * R * sp * (E.vac ? 1.25 : 1), hh = E.noz * 1.9 * geo.sc * VCOS * (n > 9 ? 0.75 : 1), al = a * (0.45 + 0.55 * (it.d + 1) / 2), t0 = w * 0.32;
  glowLine([[it.X - t0, it.Y], [it.X - w * 0.5, it.Y + hh * 0.45], [it.X - w, it.Y + hh], [it.X + w, it.Y + hh], [it.X + w * 0.5, it.Y + hh * 0.45], [it.X + t0, it.Y]], al, 1);
  x.beginPath(); x.ellipse(it.X, it.Y + hh, Math.max(w, 0.5), Math.max(w * TILT, 0.3), 0, 0, Math.PI * 2); x.fillStyle = FUEL_OF(E.fuel) + '55'; x.fill(); x.strokeStyle = lineA(al * 0.8); x.stroke(); });
}
function drawAtt(t, cx, y0, h, R, a, role) {
 for (let k = 0; k < 4; k++) { const ph = k / 4 * Math.PI * 2 + S.rot + Math.PI / 4, s = Math.sin(ph), d = Math.cos(ph), xs = cx + s * R, al = a * (d > 0 ? 0.9 : 0.3), dir = Math.sign(s) || 1;
  if (t === 'gridfin') { if (Math.abs(s) < 0.2) continue; const yy = y0 - h * 0.92, L = R * 0.75 * Math.abs(s); glowLine([[xs, yy], [xs + dir * L, yy], [xs + dir * L, yy + R * 0.45], [xs, yy + R * 0.45], [xs, yy]], al); for (let g = 1; g < 4; g++) glowLine([[xs + dir * L * g / 4, yy], [xs + dir * L * g / 4, yy + R * 0.45]], al * 0.6, 0.8); }
  if (t === 'legs') { if (Math.abs(s) < 0.15) continue; const L = R * 1.6; glowLine([[xs, y0 - h * 0.9], [xs + dir * L * Math.abs(s), y0 + R * 1.5]], al, 1.6); glowLine([[xs, y0 - h * 0.2], [xs + dir * L * 0.55 * Math.abs(s), y0 + R * 0.7]], al * 0.7, 1); }
  if ((t === 'flaps' && k % 2 === 0) || t === 'fins') { if (t === 'flaps' && Math.abs(s) < 0.3) continue; const L = R * (t === 'flaps' ? 1 : 0.8) * Math.abs(s), top = role === 'shell', yt = top ? y0 - h * 0.35 : t === 'fins' ? y0 - h * 0.7 : y0 - h * 0.15, yb = t === 'fins' ? y0 + R * 0.4 : top ? y0 - h * 0.05 : y0 - h * 0.65;
   glowLine([[xs, yt], [xs + dir * L, yt + (yb - yt) * 0.3], [xs + dir * L, yb], [xs, yb + (t === 'fins' ? -R * 0.3 : 0)]], al, 1.2); }
 }
}
function label(txt, X, Y, col, align) { x.font = '600 13px "Space Grotesk","IBM Plex Sans KR",sans-serif'; x.textBaseline = 'middle'; const w = x.measureText(txt).width, xl = align === 'r' ? X - w : X; x.fillStyle = 'rgba(5,11,20,.85)'; x.fillRect(xl - 5, Y - 10, w + 10, 20); x.fillStyle = col; x.fillText(txt, xl, Y); }
function drawDims(L) {
 const s = L.p.shape, cx = geo.cx, off = Math.max(L.mr, 8) * 1.35 + 14, xr = cx + off, y0 = L.y0, y1 = L.y1, col = 'rgba(255,194,74,.95)';
 x.save(); x.globalCompositeOperation = 'source-over'; x.strokeStyle = col; x.lineWidth = 1.2;
 x.setLineDash([4, 4]); x.beginPath(); x.moveTo(cx + L.rf(0), y0); x.lineTo(xr + 6, y0); x.moveTo(cx + L.rf(1), y1); x.lineTo(xr + 6, y1); x.stroke(); x.setLineDash([]);
 x.beginPath(); x.moveTo(xr, y0); x.lineTo(xr, y1); x.stroke(); [y0, y1].forEach((yy, i) => { x.beginPath(); x.moveTo(xr - 4, yy + (i ? 6 : -6)); x.lineTo(xr, yy); x.lineTo(xr + 4, yy + (i ? 6 : -6)); x.stroke(); });
 label(`${m1(s.h)} m`, xr + 11, (y0 + y1) / 2, col);
 const r0 = L.rf(0); x.beginPath(); x.moveTo(cx - r0, y0); x.lineTo(cx + r0, y0); x.stroke(); label(`Ø ${m1(s.d0)} m`, cx - off, y0, col, 'r');
 if (Math.abs(s.d1 - s.d0) > 0.05 && s.d1 > 0.05 && y0 - y1 > 30) label(`Ø ${m1(s.d1)} m`, cx - off, y1, col, 'r');
 if (s.prof === 'bulb' && y0 - y1 > 50) { const um = (s.sp + 0.12) / 2, ym = y0 - (y0 - y1) * um, rm = L.rf(um); x.setLineDash([3, 3]); x.beginPath(); x.moveTo(cx - rm, ym); x.lineTo(cx + rm, ym); x.stroke(); x.setLineDash([]); label(`최대 Ø ${m1(s.dm)} m`, cx - off, ym, col, 'r'); }
 if (isSolo()) label(`벽 ${nf(L.p.t, 1)} mm · ${L.p.mat.name}`, cx - off, y1 - 22 > 30 ? y1 - 22 : y0 + 26, 'rgba(216,246,255,.9)', 'r');
 x.restore();
}
function drawProjector(tm) {
 const z = VIEW.zoom, cx = geo.cx, by = geo.base + (geo.solo ? 0.06 : 0.02) * H * z * VCOS, r = Math.min(W * 0.32, 230) * Math.min(z, 3), ch = H * 0.8 * z * VCOS;
 const g = x.createRadialGradient(cx, by, 4, cx, by, r * 1.4); g.addColorStop(0, 'rgba(63,240,255,.35)'); g.addColorStop(1, 'rgba(63,240,255,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(cx, by, r * 1.4, r * 0.42, 0, 0, Math.PI * 2); x.fill();
 for (let i = 0; i < 4; i++) { const rr = r * (0.35 + i * 0.22); x.strokeStyle = lineA(0.45 - i * 0.08); x.lineWidth = 1.2; x.setLineDash([12 + i * 6, 8]); x.lineDashOffset = (RM ? 0 : tm / 3000 * (i % 2 ? -1 : 1)) * 60; x.beginPath(); x.ellipse(cx, by, rr, rr * TILT, 0, 0, Math.PI * 2); x.stroke(); } x.setLineDash([]);
 const cg = x.createLinearGradient(0, by, 0, by - ch); cg.addColorStop(0, 'rgba(63,240,255,.10)'); cg.addColorStop(1, 'rgba(63,240,255,0)'); x.fillStyle = cg; x.beginPath(); x.moveTo(cx - r * 0.6, by); x.lineTo(cx - r * 0.95, by - ch); x.lineTo(cx + r * 0.95, by - ch); x.lineTo(cx + r * 0.6, by); x.fill();
 if (!RM) for (let i = 0; i < 26; i++) { const ph = (tm / 4000 + i * 0.137) % 1, xx = cx + Math.sin(i * 12.9898) * r * 0.8, yy = by - ph * ch * 0.94; x.fillStyle = lineA(0.5 * (1 - ph)); x.fillRect(xx, yy, 1.6, 1.6); }
}
