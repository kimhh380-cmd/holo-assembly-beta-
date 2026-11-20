/* 14-studio.js — 제작·시험 영상관: 로켓을 만들고 시험하는 과정을 단계별 애니메이션으로 보여 줌
   - 머리의 “제작·시험 영상” 버튼, 또는 부품 편집 패널의 “제작·시험 영상” 구역에서 열기
   - 장면은 시간 t(초)만으로 그려져서 되감기·건너뛰기를 해도 같은 화면이 나옴
   - 홀로그램/실제 보기(LOOK)를 따라 와이어프레임 또는 실제 모습으로 그림
   - 지금 고른 부품의 재질·단열재·엔진, 그리고 내 기체(S.parts)를 장면에 씀
   - 확장 모듈은 HOLO.registerScene({ id, cat, name, desc, dur, steps, opts, draw })로 장면을 더할 수 있음 (docs/api.md)
   모든 js 파일은 같은 전역 공간을 공유하는 일반 <script>입니다. 이 파일은 즉시 실행 함수 안에 있어 이름이 새지 않습니다. */
(() => {
const VW = 1000, VH = 560, HOL = '63,240,255';
const SCENES = [];
const V = { open: false, sc: null, t: 0, play: true, speed: 1, last: 0, opt: {}, c: null, k: 1, ox: 0, oy: 0, dpr: 1, raf: 0 };
let g = null, cvS = null;
const real = () => LOOK === 'real';
const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const seg = (t, a, b) => cl((t - a) / (b - a));
const ez = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const hs = (i, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7 + 0.5) * 43758.5453; return v - Math.floor(v); };
const TAU = Math.PI * 2;

/* ---------- 색과 칠하기 ---------- */
const MC = { alu: [0.82, 0.83, 0.85], steel: [0.72, 0.73, 0.75], copper: [0.85, 0.5, 0.32], niobium: [0.5, 0.48, 0.55], dark: [0.17, 0.17, 0.18], white: [0.9, 0.9, 0.89], concrete: [0.6, 0.58, 0.55], yellow: [0.95, 0.72, 0.12], orange: [0.9, 0.45, 0.13], blue: [0.2, 0.38, 0.7], rubber: [0.08, 0.08, 0.09], glass: [0.5, 0.65, 0.75], red: [0.78, 0.16, 0.12], green: [0.25, 0.6, 0.38], wall: [0.24, 0.26, 0.29], silica: [0.94, 0.94, 0.92], gold: [1, 0.78, 0.36], water: [0.3, 0.55, 0.85], hill: [0.3, 0.42, 0.25] };
for (const k in MC) MC[k] = lin(MC[k]);
const METAL = new Set(['alu', 'steel', 'copper', 'niobium', 'gold']);
function albOf(m) {
 if (Array.isArray(m)) return m;
 if (typeof m === 'string') { if (MC[m]) return MC[m]; if (RTPS[m]) return RTPS[m].alb; if (RMAT[m]) return RMAT[m].alb; if (CARD[m] && CARD[m].col) return hexLin(CARD[m].col); return MC.steel; }
 if (m && m.name) return rmatOf(m).alb; return MC.steel;
}
function metOf(m) { if (typeof m === 'string') return METAL.has(m) || (RMAT[m] ? RMAT[m].metal > 0.5 : RTPS[m] ? RTPS[m].metal > 0.5 : false); if (m && m.name) return rmatOf(m).metal > 0.5; return false; }
const rgb = (a, f = 1, al = 1) => { const c = a.map(v => Math.round(255 * Math.min(1, Math.pow(Math.max(0, v * f), 1 / 2.2)))); return `rgba(${c[0]},${c[1]},${c[2]},${al})`; };
function glow(p, a = 0.9, w = 1.3, col = HOL) { g.save(); g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = `rgba(${col},${a * 0.2})`; g.lineWidth = w * 3.6; g.stroke(p); g.strokeStyle = `rgba(${col},${a})`; g.lineWidth = w; g.stroke(p); g.restore(); }
// 모양 칠하기: 실제는 재질 색 그러데이션(금속은 반짝임), 홀로그램은 옅은 청록 + 빛나는 선
function paint(p, m, x0, x1, dir, o = {}) {
 if (!real()) { g.fillStyle = `rgba(${HOL},${o.ha ?? 0.07})`; g.fill(p); glow(p, o.a ?? 0.85, o.w ?? 1.2); return; }
 const a = albOf(m), met = o.met ?? metOf(m), L = o.lum || 1; let fs;
 if (o.flat) fs = rgb(a, (o.flat === true ? 1 : o.flat) * L);
 else { fs = dir === 'v' ? g.createLinearGradient(0, x0, 0, x1) : g.createLinearGradient(x0, 0, x1, 0); (met ? [[0, 0.32], [0.16, 0.85], [0.36, 1.75], [0.5, 1.1], [0.78, 0.55], [1, 0.28]] : [[0, 0.5], [0.3, 1.05], [0.45, 1.12], [0.78, 0.72], [1, 0.42]]).forEach(([q, f]) => fs.addColorStop(q, rgb(a, f * L))); }
 g.fillStyle = fs; g.fill(p); if (o.edge !== false) { g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 0.8; g.stroke(p); }
}
function rectP(x, y, w, h, r) { const p = new Path2D(); if (r && p.roundRect) p.roundRect(x, y, w, h, r); else p.rect(x, y, w, h); return p; }
function box(x, y, w, h, m, o = {}) { const p = rectP(x, y, w, h, o.r); paint(p, m, o.v ? y : x, o.v ? y + h : x + w, o.v ? 'v' : 'h', o); return p; }
function polyP(pts) { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); p.closePath(); return p; }
function poly(pts, m, o = {}) { const p = polyP(pts); let a = 1e9, b = -1e9; pts.forEach(q => { const v = o.v ? q[1] : q[0]; a = Math.min(a, v); b = Math.max(b, v); }); paint(p, m, a, b, o.v ? 'v' : 'h', o); return p; }
function circle(x, y, r, m, o = {}) { const p = new Path2D(); p.arc(x, y, r, 0, TAU); paint(p, m, x - r, x + r, 'h', o); return p; }
// 세로 회전체: rf(u), u = 0(위) ~ 1(아래)
function revV(cx, y0, h, rf, m, o = {}) {
 const p = new Path2D(), N = o.n || 26; let R = 0.5;
 for (let i = 0; i <= N; i++) { const u = i / N, r = rf(u); R = Math.max(R, r); p.lineTo(cx - r, y0 + u * h); }
 for (let i = N; i >= 0; i--) { const u = i / N; p.lineTo(cx + rf(u), y0 + u * h); } p.closePath();
 paint(p, m, cx - R, cx + R, 'h', o); ringsV(cx, y0, h, rf, o.rings ?? (real() ? 0 : 5), o); if (!real() && o.mer !== 0) merV(cx, y0, h, rf, o.mer ?? 4); return p;
}
function ringsV(cx, y0, h, rf, n, o = {}) { if (!n) return; const p = new Path2D(); for (let k = 1; k < n; k++) { const u = k / n, r = rf(u), y = y0 + u * h; if (r < 1) continue; p.moveTo(cx - r, y); p.quadraticCurveTo(cx, y + r * 0.22, cx + r, y); } if (real()) { g.strokeStyle = o.ringCol || 'rgba(0,0,0,.3)'; g.lineWidth = 0.9; g.stroke(p); } else glow(p, 0.45, 0.8); }
function merV(cx, y0, h, rf, n) { const p = new Path2D(); for (let k = 1; k < n; k++) { const s = Math.sin(-Math.PI / 2 + k / n * Math.PI); for (let i = 0; i <= 16; i++) { const u = i / 16, X = cx + s * rf(u), Y = y0 + u * h; i ? p.lineTo(X, Y) : p.moveTo(X, Y); } } glow(p, 0.4, 0.8); }
// 가로 회전체: u = 0(왼쪽) ~ 1(오른쪽). 세로 회전체를 돌려서 그림
function revH(x0, cy, len, rf, m, o = {}) { g.save(); g.translate(x0, cy); g.rotate(-Math.PI / 2); const p = revV(0, 0, len, rf, m, o); g.restore(); return p; }
function pipe(pts, w, m = 'steel') { const p = new Path2D(); pts.forEach((q, i) => i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1])); if (real()) { g.save(); g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = rgb(albOf(m), 0.4); g.lineWidth = w + 1.2; g.stroke(p); g.strokeStyle = rgb(albOf(m), 1.25); g.lineWidth = Math.max(0.6, w * 0.45); g.stroke(p); g.restore(); } else glow(p, 0.7, Math.max(0.8, w * 0.4)); return p; }
function line(pts, col, w = 1, dash) { g.save(); g.strokeStyle = col; g.lineWidth = w; if (dash) g.setLineDash(dash); g.beginPath(); pts.forEach((q, i) => i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])); g.stroke(); g.restore(); }

/* ---------- 효과: 빛 점, 연기·수증기, 불꽃, 불티 ---------- */
let SPR = null;
function sprites() {
 if (SPR) return SPR; const mk = stops => { const c = document.createElement('canvas'); c.width = c.height = 128; const x2 = c.getContext('2d'), gr = x2.createRadialGradient(64, 64, 0, 64, 64, 64); stops.forEach(([q, col]) => gr.addColorStop(q, col)); x2.fillStyle = gr; x2.fillRect(0, 0, 128, 128); return c; };
 return SPR = { white: mk([[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(240,243,246,.6)'], [1, 'rgba(230,235,240,0)']]), grey: mk([[0, 'rgba(110,114,122,1)'], [0.5, 'rgba(100,104,112,.5)'], [1, 'rgba(90,95,105,0)']]), fire: mk([[0, 'rgba(255,240,200,1)'], [0.3, 'rgba(255,160,60,.6)'], [1, 'rgba(255,80,20,0)']]), cyan: mk([[0, 'rgba(160,250,255,.9)'], [0.5, 'rgba(63,240,255,.35)'], [1, 'rgba(63,240,255,0)']]), violet: mk([[0, 'rgba(255,240,255,1)'], [0.35, 'rgba(200,120,255,.6)'], [1, 'rgba(120,60,255,0)']]) };
}
function spr(name, x, y, r, a, add) { if (a <= 0.003 || r <= 0) return; g.save(); if (add) g.globalCompositeOperation = 'lighter'; g.globalAlpha = Math.min(1, a); g.drawImage(sprites()[name], x - r, y - r, r * 2, r * 2); g.restore(); }
// 연기·수증기 구름: t0~t1 동안 (x, y)에서 뿜어 퍼짐
function cloud(seed, x, y, t, t0, t1, o = {}) {
 const n = o.n || 80, life = o.life || 6, nm = real() ? (o.spr || 'white') : 'cyan';
 for (let i = 0; i < n; i++) {
  const b = t0 + (t1 - t0) * (i + hs(i, seed)) / n, age = t - b; if (age < 0 || age > life) continue;
  const k = age / life, ang = (o.ang ?? -Math.PI / 2) + (hs(i, seed + 1) - 0.5) * (o.spread ?? 0.8), sp = (o.speed ?? 60) * (0.6 + 0.8 * hs(i, seed + 2)), d = sp * age / (1 + age * (o.drag ?? 0.5));
  let px = x + Math.cos(ang) * d + (o.wind || 0) * age, py = y + Math.sin(ang) * d - (o.rise || 0) * age * age * 0.5; const r = (o.r0 ?? 10) + (o.grow ?? 20) * age;
  if (o.floor != null) py = Math.min(py, o.floor - r * 0.35);
  const a = (o.a ?? 0.5) * Math.pow(1 - k, 1.4) * Math.min(1, age * 3) * (real() ? 1 : 0.45);
  if (real() && o.shade !== false) spr('grey', px + r * 0.12, py + r * 0.22, r * 0.95, a * 0.3);
  spr(nm, px, py, r, a);
 }
}
const PLUME = { kerolox: ['255,250,225', '255,170,60', '255,95,25'], methalox: ['235,235,255', '150,130,255', '255,120,90'], hydrolox: ['245,250,255', '200,215,255', '255,170,140'], hyper: ['255,240,210', '255,150,80', '230,90,50'], solid: ['255,255,240', '255,200,120', '255,140,60'] };
// 엔진 불꽃: (x, y)에서 ang 방향으로 len만큼. r0 = 노즐 출구 반지름
function plume(x, y, ang, len, r0, t, fuel = 'kerolox', o = {}) {
 const C = PLUME[fuel] || PLUME.kerolox, f = 1 + 0.07 * Math.sin(t * 47) + 0.05 * Math.sin(t * 83 + 1), L = len * f, I = o.I ?? 1; if (I <= 0.01) return;
 g.save(); g.translate(x, y); g.rotate(ang - Math.PI / 2); g.globalCompositeOperation = 'lighter';
 const sp = o.spread ?? 1.6, p = new Path2D(); p.moveTo(-r0 * 0.95, 0); p.bezierCurveTo(-r0 * 1.15, L * 0.3, -r0 * sp, L * 0.7, -r0 * sp * 0.6, L); p.lineTo(r0 * sp * 0.6, L); p.bezierCurveTo(r0 * sp, L * 0.7, r0 * 1.15, L * 0.3, r0 * 0.95, 0); p.closePath();
 const gr = g.createLinearGradient(0, 0, 0, L); gr.addColorStop(0, `rgba(${C[0]},${0.95 * I})`); gr.addColorStop(0.25, `rgba(${C[1]},${0.8 * I})`); gr.addColorStop(0.65, `rgba(${C[2]},${0.4 * I})`); gr.addColorStop(1, `rgba(${C[2]},0)`); g.fillStyle = gr; g.fill(p);
 const p2 = new Path2D(); p2.moveTo(-r0 * 0.7, 0); p2.quadraticCurveTo(-r0 * 0.5, L * 0.35, 0, L * 0.55); p2.quadraticCurveTo(r0 * 0.5, L * 0.35, r0 * 0.7, 0); p2.closePath(); const g2 = g.createLinearGradient(0, 0, 0, L * 0.55); g2.addColorStop(0, `rgba(255,255,250,${0.9 * I})`); g2.addColorStop(1, `rgba(${C[0]},0)`); g.fillStyle = g2; g.fill(p2);
 if (o.diamonds !== false) for (let k = 0; k < 5; k++) { const yk = r0 * (1.2 + k * 1.45), rr = r0 * (0.42 - k * 0.06); if (yk > L * 0.8) break; g.fillStyle = `rgba(255,255,245,${(0.55 - k * 0.1) * I})`; g.beginPath(); g.ellipse(0, yk, rr, rr * 0.45, 0, 0, TAU); g.fill(); }
 g.restore(); spr('fire', x, y, r0 * 3.2 * f, 0.55 * I, true);
}
function sparks(seed, x, y, t, o = {}) {
 const n = o.n || 24; g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
 for (let i = 0; i < n; i++) { const per = o.life || 0.6, age = ((t + hs(i, seed) * per) % per), ph = age / per, ang = (o.ang ?? -Math.PI / 2) + (hs(i, seed + 3) - 0.5) * (o.spread ?? 2.2), sp = (o.speed ?? 120) * (0.5 + hs(i, seed + 4)), gy = o.grav ?? 320, px = x + Math.cos(ang) * sp * age, py = y + Math.sin(ang) * sp * age + gy * 0.5 * age * age, vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp + gy * age;
  g.strokeStyle = o.col ? `rgba(${o.col},${1 - ph})` : `rgba(255,${(200 - ph * 120) | 0},${(120 - ph * 100) | 0},${1 - ph})`; g.lineWidth = o.w || 1.4; g.beginPath(); g.moveTo(px, py); g.lineTo(px - vx * 0.02, py - vy * 0.02); g.stroke(); }
 g.restore();
}
// 물줄기(냉각수 분사)
function jets(x, y, ang, len, n, t, a = 0.6) { g.save(); g.strokeStyle = real() ? `rgba(190,220,255,${a})` : `rgba(${HOL},${a * 0.7})`; g.lineWidth = 1.2; g.setLineDash([10, 7]); for (let i = 0; i < n; i++) { const an = ang + (i / Math.max(1, n - 1) - 0.5) * 0.7; g.lineDashOffset = -t * 260 - i * 5; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(an) * len * 0.6, y + Math.sin(an) * len * 0.6 - 10, x + Math.cos(an) * len, y + Math.sin(an) * len + len * 0.25); g.stroke(); } g.restore(); }

/* ---------- 엔진·기체 그리기 ---------- */
const nozMat = id => { const E = CARD[id]; return { copper: 'copper', niobium: 'niobium', dark: 'dark', carbon: 'dark' }[NOZ_OF[id] || NOZ_FUEL[E && E.fuel] || 'dark']; };
// 엔진 옆모습 (Grok 홀로그램 그림 윤곽 ENG_SHAPE). y0 = 꼭대기, L = 전체 길이
function engine(cx, y0, L, id, o = {}) {
 const E = CARD[id] || CARD.merlin, SH = engShape(id, E.fuel), hf = Math.min(0.42, SH.hf), re = L / SH.asp, hmax = re * Math.max(...SH.h);
 if (!o.bare) { box(cx - re * 0.22, y0 - L * 0.05, re * 0.44, L * 0.05, 'dark');
  if (L > 40) { const px = cx + hmax + re * 0.2; revV(px, y0 + L * 0.03, L * 0.2, () => re * 0.16, 'steel', { rings: 0, mer: 0 }); pipe([[px, y0 + L * 0.23], [px, y0 + L * hf * 0.95], [cx + re * SH.b[0] * 1.1, y0 + L * hf * 1.02]], Math.max(1.2, re * 0.07)); pipe([[cx - hmax - re * 0.08, y0 + L * 0.05], [cx - hmax - re * 0.22, y0 + L * hf * 0.7], [cx - re * SH.b[0], y0 + L * hf]], Math.max(1, re * 0.05)); } }
 revV(cx, y0, L * hf, u => Math.max(1, re * lerpArr(SH.h, u)), 'steel', { rings: real() ? 2 : 3, mer: 3 });
 const bell = revV(cx, y0 + L * hf, L * (1 - hf), u => re * lerpArr(SH.b, u), o.mat || nozMat(id), { rings: real() ? 0 : 6, mer: 4, n: 24 });
 if (o.hot > 0) { g.save(); g.clip(bell); g.globalCompositeOperation = 'lighter'; const gr = g.createLinearGradient(0, y0 + L * hf, 0, y0 + L); gr.addColorStop(0, `rgba(255,120,40,${0.8 * o.hot})`); gr.addColorStop(0.5, `rgba(255,70,20,${0.5 * o.hot})`); gr.addColorStop(1, `rgba(200,40,10,${0.15 * o.hot})`); g.fillStyle = gr; g.fillRect(cx - re * 1.2, y0, re * 2.4, L * 1.05); g.restore(); }
 return { exitY: y0 + L, exitR: re, throatY: y0 + L * hf, hmax, fuel: E.fuel };
}
const partMat = p => p.tps && p.tps !== 'hex' ? p.tps : p.mat;
const stackH = (parts, withNoz = true) => parts.reduce((a, p) => a + p.shape.h, 0) + (withNoz ? engLen(parts) : 0);
const engLen = parts => { const eb = parts[0]; return eb && eb.role === 'engbay' && eb.engines.length ? Math.max(...eb.engines.map(e => CARD[e] ? CARD[e].noz : 1)) * 1.9 : 0; };
const maxD = parts => parts.reduce((a, p) => Math.max(a, maxR(p.shape) * 2), 1);
// 기체를 세워서 그림: 아래(첫 부품)부터 위로. yB = 노즐 끝(바닥). 돌려 쓰면 눕힌 기체도 됨
function ship(parts, cx, yB, sc, o = {}) {
 let y = yB - engLen(parts) * sc; const eb = parts[0] && parts[0].role === 'engbay' && parts[0].engines.length ? parts[0] : null, out = { exits: [], bodyY: y };
 if (eb && o.engines !== false) { const nE = eb.engines.length, show = Math.min(nE, 5), R = eb.shape.d0 / 2 * sc, pos = show === 1 ? [0] : Array.from({ length: show }, (_, i) => (-1 + 2 * i / (show - 1)) * R * 0.62);
  pos.forEach((dx, i) => { const id = eb.engines[Math.floor(i * nE / show)], L = (CARD[id] ? CARD[id].noz : 1) * 1.9 * sc * 0.96, e = engine(cx + dx, y, L, id, { bare: true, hot: o.hot || 0 }); out.exits.push([cx + dx, e.exitY, e.exitR, e.fuel]); }); }
 parts.forEach((p, i) => { const h = p.shape.h * sc, rf0 = rfOf(p.shape, sc), rf = u => rf0(1 - u), path = revV(cx, y - h, h, rf, partMat(p), { rings: real() ? 0 : 4 });
  if (real() && p.tps === 'hex') { g.save(); g.clip(path); g.fillStyle = rgb(RTPS.hex.alb, 1.4); g.fillRect(cx - maxR(p.shape) * sc - 2, y - h, maxR(p.shape) * sc + 2, h); g.restore(); }
  if (real() && o.frost && p.role === 'tank' && p.fuel && p.fuel !== 'hyper' && p.fuel !== 'solid' && !p.tps) { g.save(); g.clip(path); g.globalAlpha = o.frost; const gr = g.createLinearGradient(0, y, 0, y - h); gr.addColorStop(0, 'rgba(245,248,252,.95)'); gr.addColorStop(0.7, 'rgba(240,245,250,.6)'); gr.addColorStop(1, 'rgba(240,245,250,0)'); g.fillStyle = gr; g.fillRect(cx - 400, y - h, 800, h); g.restore(); }
  const R = Math.max(2, maxR(p.shape) * sc);
  p.att.forEach(t => { const m = t === 'fins' ? 'dark' : p.tps === 'hex' ? 'dark' : p.mat;
   if (t === 'fins') for (const s of [-1, 1]) poly([[cx + s * R, y - h * 0.55], [cx + s * R * 1.9, y + R * 0.1], [cx + s * R, y]], m);
   if (t === 'flaps') for (const s of [-1, 1]) poly([[cx + s * R * 0.95, y - h * (p.role === 'shell' ? 0.7 : 0.9)], [cx + s * R * 1.65, y - h * (p.role === 'shell' ? 0.6 : 0.8)], [cx + s * R * 1.65, y - h * (p.role === 'shell' ? 0.15 : 0.45)], [cx + s * R * 0.95, y - h * (p.role === 'shell' ? 0.05 : 0.35)]], m);
   if (t === 'gridfin') for (const s of [-1, 1]) { const gx = s > 0 ? cx + R : cx - R - R * 0.6; box(gx, y - h * 0.97, R * 0.6, R * 0.32, 'steel'); }
   if (t === 'legs' && !o.legsUp) for (const s of [-1, 1]) pipe([[cx + s * R * 0.9, y - h * 0.8], [cx + s * R * 1.9, yB]], Math.max(1.5, R * 0.1), 'dark'); });
  y -= h; });
 out.top = y; return out;
}
// 단 나누기: 단간부·핫 스테이징 링에서 위 단이 시작
function stages(parts) { const out = [[]]; parts.forEach((p, i) => { if (i > 0 && (p.role === 'inter' || p.role === 'hotring')) out.push([]); out[out.length - 1].push(p); }); return out; }

/* ---------- 배경, 글자, 계기 ---------- */
function bg(kind, o = {}) {
 const fy = o.floor ?? 470;
 if (!real()) { const gr = g.createLinearGradient(0, 0, 0, VH); gr.addColorStop(0, '#04101d'); gr.addColorStop(1, '#08202f'); g.fillStyle = gr; g.fillRect(0, 0, VW, VH); g.strokeStyle = 'rgba(63,240,255,.1)'; g.lineWidth = 1; g.beginPath(); for (let i = -6; i <= 26; i++) { const x0 = i * 50; g.moveTo(x0, fy); g.lineTo(VW / 2 + (x0 - VW / 2) * 2.4, VH); } for (let j = 1; j < 6; j++) { const yy = fy + (VH - fy) * Math.pow(j / 6, 1.5); g.moveTo(0, yy); g.lineTo(VW, yy); } g.stroke(); g.strokeStyle = 'rgba(63,240,255,.35)'; g.beginPath(); g.moveTo(0, fy); g.lineTo(VW, fy); g.stroke(); if (kind === 'day' || kind === 'night' || kind === 'hill') { g.strokeStyle = 'rgba(63,240,255,.18)'; g.beginPath(); g.moveTo(0, fy - 60); for (let x0 = 0; x0 <= VW; x0 += 20) g.lineTo(x0, fy - 60 - 25 * Math.sin(x0 / 140) - 12 * Math.sin(x0 / 47)); g.stroke(); } return; }
 if (kind === 'factory' || kind === 'lab') {
  let gr = g.createLinearGradient(0, 0, 0, fy); gr.addColorStop(0, kind === 'lab' ? '#1b2027' : '#2a3038'); gr.addColorStop(1, kind === 'lab' ? '#2a3038' : '#3a4049'); g.fillStyle = gr; g.fillRect(0, 0, VW, fy);
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.beginPath(); for (let x0 = 40; x0 < VW; x0 += 80) { g.moveTo(x0, 60); g.lineTo(x0, fy); } g.stroke();
  for (let x0 = 100; x0 < VW; x0 += 200) { spr('white', x0, 70, 90, 0.08); g.fillStyle = 'rgba(255,250,235,.85)'; g.fillRect(x0 - 26, 52, 52, 5); }
  gr = g.createLinearGradient(0, fy, 0, VH); gr.addColorStop(0, '#4a4f56'); gr.addColorStop(1, '#25282d'); g.fillStyle = gr; g.fillRect(0, fy, VW, VH - fy);
  g.strokeStyle = 'rgba(255,214,90,.5)'; g.lineWidth = 3; g.setLineDash([22, 14]); g.beginPath(); g.moveTo(0, fy + 40); g.lineTo(VW, fy + 40); g.stroke(); g.setLineDash([]);
  if (kind === 'factory') { box(0, 28, VW, 14, 'yellow', { v: true }); box(0, 42, VW, 4, 'dark', { flat: true, edge: false }); }
  return;
 }
 if (kind === 'night') { let gr = g.createLinearGradient(0, 0, 0, fy); gr.addColorStop(0, '#04060b'); gr.addColorStop(1, '#151c29'); g.fillStyle = gr; g.fillRect(0, 0, VW, fy); for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + 0.5 * hs(i, 9)})`; g.fillRect(hs(i, 3) * VW, hs(i, 4) * fy * 0.6, 1.3, 1.3); }
  g.fillStyle = '#0b1018'; g.beginPath(); g.moveTo(0, fy - 70); for (let x0 = 0; x0 <= VW; x0 += 20) g.lineTo(x0, fy - 70 - 30 * Math.sin(x0 / 160 + 1) - 14 * Math.sin(x0 / 51)); g.lineTo(VW, fy); g.lineTo(0, fy); g.fill();
  gr = g.createLinearGradient(0, fy, 0, VH); gr.addColorStop(0, '#1c1f24'); gr.addColorStop(1, '#0c0d10'); g.fillStyle = gr; g.fillRect(0, fy, VW, VH - fy); return; }
 // day / hill
 let gr = g.createLinearGradient(0, 0, 0, fy); gr.addColorStop(0, '#5f97cf'); gr.addColorStop(1, '#cfe2f1'); g.fillStyle = gr; g.fillRect(0, 0, VW, fy);
 for (let i = 0; i < 9; i++) spr('white', hs(i, 21) * VW, 40 + hs(i, 22) * 150, 50 + hs(i, 23) * 70, 0.45);
 if (o.sea) { g.fillStyle = '#5d86a8'; g.fillRect(0, o.sea, VW, fy - o.sea); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, o.sea, VW, 2); }
 g.fillStyle = '#5d7a4c'; g.beginPath(); g.moveTo(0, fy - 40); for (let x0 = 0; x0 <= VW; x0 += 20) g.lineTo(x0, fy - 40 - 26 * Math.sin(x0 / 150 + 2) - 10 * Math.sin(x0 / 43)); g.lineTo(VW, fy); g.lineTo(0, fy); g.fill();
 gr = g.createLinearGradient(0, fy, 0, VH); gr.addColorStop(0, '#8d8a80'); gr.addColorStop(1, '#5c5a54'); g.fillStyle = gr; g.fillRect(0, fy, VW, VH - fy);
}
function lightUp(x, y, r, I) { if (I <= 0.01) return; g.save(); g.globalCompositeOperation = 'lighter'; spr('fire', x, y, r, 0.35 * I); g.fillStyle = `rgba(255,130,50,${0.07 * I})`; g.fillRect(0, 0, VW, VH); g.restore(); }
const FONT = s => `600 ${s}px "IBM Plex Sans KR","Space Grotesk",sans-serif`;
function tag(x, y, tx, ty, text, a = 1) {
 if (a <= 0.02) return; g.save(); g.globalAlpha = a; const col = 'rgba(255,194,74,.95)'; g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(tx, ty); g.stroke(); g.fillStyle = col; g.beginPath(); g.arc(x, y, 2.6, 0, TAU); g.fill();
 g.font = FONT(13); const w = g.measureText(text).width, lx = tx >= x ? tx : tx - w - 12; g.fillStyle = 'rgba(5,11,20,.85)'; g.fillRect(lx, ty - 11, w + 12, 22); g.strokeRect(lx, ty - 11, w + 12, 22); g.fillStyle = '#f2fbff'; g.textBaseline = 'middle'; g.fillText(text, lx + 6, ty); g.restore();
}
function panel(x, y, w, rows, title) {
 const h = 28 + rows.length * 20; g.save(); g.fillStyle = 'rgba(5,11,20,.84)'; g.strokeStyle = real() ? 'rgba(255,255,255,.2)' : 'rgba(63,240,255,.55)'; g.lineWidth = 1; g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h);
 g.textBaseline = 'middle'; g.font = '700 12px "Space Grotesk","IBM Plex Sans KR",sans-serif'; g.fillStyle = '#7fe9ff'; g.fillText(title, x + 10, y + 14);
 g.font = FONT(12.5); rows.forEach((r, i) => { const yy = y + 36 + i * 20; g.fillStyle = '#a9c6d4'; g.textAlign = 'left'; g.fillText(r[0], x + 10, yy); g.fillStyle = r[2] || '#f2fbff'; g.textAlign = 'right'; g.fillText(r[1], x + w - 10, yy); }); g.restore();
}
function graph(x, y, w, h, series, t, tmax, title) {
 g.save(); g.fillStyle = 'rgba(5,11,20,.84)'; g.strokeStyle = real() ? 'rgba(255,255,255,.2)' : 'rgba(63,240,255,.55)'; g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h); g.font = '700 12px "Space Grotesk","IBM Plex Sans KR",sans-serif'; g.fillStyle = '#7fe9ff'; g.textBaseline = 'middle'; g.fillText(title, x + 10, y + 13);
 const px = x + 10, py = y + 26, pw = w - 20, ph = h - 36; g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); for (let i = 1; i < 4; i++) { g.moveTo(px, py + ph * i / 4); g.lineTo(px + pw, py + ph * i / 4); } g.stroke();
 series.forEach((s, j) => { g.strokeStyle = s.col; g.lineWidth = 1.8; g.beginPath(); const tn = Math.min(t, tmax); for (let i = 0; i <= 80; i++) { const tt = tn * i / 80, v = cl(s.f(tt) / s.max), X = px + pw * tt / tmax, Y = py + ph * (1 - v); i ? g.lineTo(X, Y) : g.moveTo(X, Y); } g.stroke(); g.fillStyle = s.col; g.font = FONT(11); g.textAlign = 'right'; g.fillText(s.label, x + w - 10, y + 13 + j * 0); g.textAlign = 'left'; });
 g.restore();
}
function big(text, x, y, size, col = '#ffffff', a = 1) { if (a <= 0.02) return; g.save(); g.globalAlpha = a; g.font = `700 ${size}px "Space Grotesk","IBM Plex Sans KR",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeText(text, x, y); g.fillStyle = col; g.fillText(text, x, y); g.restore(); }
function check(x, y, ok = true, a = 1) { if (a <= 0.02) return; g.save(); g.globalAlpha = a; g.lineWidth = 4; g.lineCap = 'round'; g.strokeStyle = ok ? '#5dff9e' : '#ff5d73'; g.beginPath(); if (ok) { g.moveTo(x - 9, y); g.lineTo(x - 2, y + 7); g.lineTo(x + 11, y - 9); } else { g.moveTo(x - 8, y - 8); g.lineTo(x + 8, y + 8); g.moveTo(x + 8, y - 8); g.lineTo(x - 8, y + 8); } g.stroke(); g.restore(); }
function crane(x, yTop, yHook) { box(x - 30, 30, 60, 22, 'yellow', { v: true }); line([[x - 4, 52], [x - 4, yHook]], real() ? '#222' : `rgba(${HOL},.8)`, 1.5); line([[x + 4, 52], [x + 4, yHook]], real() ? '#222' : `rgba(${HOL},.8)`, 1.5); box(x - 12, yHook - 6, 24, 14, 'yellow', { v: true }); line([[x, yHook + 8], [x, yHook + 18]], real() ? '#333' : `rgba(${HOL},.8)`, 3); }
function dial(x, y, r, frac, label, val) { g.save(); circle(x, y, r, 'white', { met: false, lum: real() ? 1 : 1 }); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r * 0.8, Math.PI * 0.75, Math.PI * 2.25); g.stroke(); g.strokeStyle = '#ff5d73'; g.beginPath(); g.arc(x, y, r * 0.8, Math.PI * 2.0, Math.PI * 2.25); g.stroke(); const a = Math.PI * 0.75 + Math.PI * 1.5 * cl(frac); g.strokeStyle = real() ? '#111' : '#ffc24a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75); g.stroke(); g.font = FONT(12); g.textAlign = 'center'; g.fillStyle = real() ? '#111' : '#eafcff'; g.fillText(val, x, y + r * 0.45); g.fillStyle = '#eafcff'; g.fillText(label, x, y + r + 14); g.restore(); }

/* ---------- 장면 ---------- */
const THR = { raptor: 230, raptorvac: 258, merlin: 86, mvac: 98, rs25: 232, rl10: 11, be4: 250 }, PC = { raptor: 300, raptorvac: 300, merlin: 97, mvac: 97, rs25: 206, rl10: 44, be4: 134 };
const engName = id => CARD[id] ? CARD[id].name : id;
function reg(def) { const i = SCENES.findIndex(s => s.id === def.id); if (i >= 0) SCENES[i] = def; else SCENES.push(def); if (V.open) renderList(); }

// 1. 추진제 탱크 제작
reg({ id: 'tank', cat: 'make', name: '추진제 탱크 제작', desc: '판 → 격자 가공 → 롤 성형 → 마찰교반용접 → 돔 → 내압 시험', dur: 44,
 steps: [[0, '탱크 판 준비', c => `탱크 벽이 될 판을 들여와요. 재질은 지금 고른 부품의 재질(${c.mat.name})이에요.`], [5, '아이소그리드 가공', '판 안쪽을 삼각형 격자 모양으로 깎아요. 무게는 줄이고 어느 방향의 힘에도 잘 버티게 해요.'], [13, '롤 성형', '판을 롤러 사이로 통과시켜 둥글게 말아 원통 패널을 만들어요.'], [19, '마찰교반용접', '빠르게 도는 공구로 금속을 녹이지 않고 비벼서 이어요. 중간에 멈추면 결함이 생기기 쉬워서 원통 둘레를 한 번에 용접해요.'], [27, '돔 스피닝', '평평한 원판을 돌리면서 롤러로 눌러 돔 모양으로 만들어요.'], [33, '돔-원통 용접', '돔과 원통이 맞닿는 둘레를 용접해 탱크를 완성해요.'], [37, '내압 시험', '탈이온수를 채우고 압력을 올려 새는 곳이나 이상한 변형이 없는지 확인해요.']],
 draw(t, c) {
  bg('factory'); const M = c.mat, FY = 470;
  if (t < 13) {
   const X0 = lerp(-560, 230, ez(seg(t, 0, 4))); box(170, FY - 60, 660, 16, 'steel', { v: true }); for (const lx of [200, 480, 780]) box(lx, FY - 44, 16, 44, 'dark');
   const Q = (u, v) => [X0 + u * 520 + v * 90, FY - 72 - v * 60]; poly([Q(0, 0), Q(1, 0), [Q(1, 0)[0], Q(1, 0)[1] + 10], [Q(0, 0)[0], Q(0, 0)[1] + 10]], M, { lum: 0.6, v: true }); poly([Q(0, 0), Q(1, 0), Q(1, 1), Q(0, 1)], M, { v: true });
   if (t > 5) { const hu = seg(t, 5.5, 12.5); g.save(); g.clip(polyP([Q(0, 0), Q(hu, 0), Q(hu, 1), Q(0, 1)])); const p = new Path2D(), s = 0.11, tn = 0.58;
    for (let k = 0; k <= 6; k++) { const a = Q(0, k / 6), b = Q(1, k / 6); p.moveTo(a[0], a[1]); p.lineTo(b[0], b[1]); }
    for (let k = -8; k <= 12; k++) for (const sg of [1, -1]) { const u0 = k * s, u1 = u0 + sg * tn * 0.2; const a = Q(u0, 0), b = Q(u0 + sg * 0.19, 1); p.moveTo(a[0], a[1]); p.lineTo(b[0], b[1]); }
    if (real()) { g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 2; g.stroke(p); g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 0.8; g.stroke(p); } else glow(p, 0.55, 0.8); g.restore();
    if (hu < 1) { const vv = 0.5 + 0.45 * Math.sin(t * 5), a = Q(hu, -0.15), b = Q(hu, 1.15); box(a[0] - 8, a[1] - 140, 16, 140, 'yellow'); box(b[0] - 8, b[1] - 140, 16, 140, 'yellow'); poly([[a[0], a[1] - 140], [b[0], b[1] - 140], [b[0], b[1] - 124], [a[0], a[1] - 124]], 'yellow', { v: true });
     const h0 = Q(hu, vv); box(h0[0] - 14, h0[1] - 128, 28, 70, 'steel'); box(h0[0] - 4, h0[1] - 58, 8, 54, 'steel'); sparks(5, h0[0], h0[1] - 4, t, { col: '220,225,230', n: 14, speed: 90, life: 0.5, grav: 200 }); tag(h0[0] + 14, h0[1] - 100, h0[0] + 120, h0[1] - 150, 'CNC 밀링 공구'); }
   }
   tag(Q(0.25, 0.5)[0], Q(0.25, 0.5)[1], Q(0.25, 0.5)[0] - 40, FY - 210, `${M.name} 판`, seg(t, 3, 4));
  } else if (t < 19) {
   const p = ez(seg(t, 13.3, 18.3)), cx = 500, cy = 250, R = 140, P0 = [cx, cy + R], sw = p * 1.9 * Math.PI, Lp = 1.9 * Math.PI * R;
   box(cx - 170, cy + R + 66, 340, 30, 'yellow', { v: true }); box(cx - 120, cy + R + 96, 240, FY - (cy + R + 96), 'dark');
   const pl = new Path2D(); pl.moveTo(P0[0] - (1 - p) * Lp, P0[1]); pl.lineTo(P0[0], P0[1]); for (let i = 0; i <= 60; i++) { const a = Math.PI / 2 - sw * i / 60; pl.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a)); }
   g.save(); g.lineCap = 'round'; if (real()) { g.strokeStyle = rgb(albOf(M), 0.45); g.lineWidth = 12; g.stroke(pl); g.strokeStyle = rgb(albOf(M), 1.15); g.lineWidth = 8; g.stroke(pl); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.setLineDash([2, 9]); g.stroke(pl); } else { glow(pl, 0.9, 3); } g.restore();
   const rol = (x, y, r) => { circle(x, y, r, 'steel'); const a = t * 4; line([[x - Math.cos(a) * r * 0.8, y - Math.sin(a) * r * 0.8], [x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8]], real() ? 'rgba(0,0,0,.5)' : `rgba(${HOL},.7)`, 2); };
   rol(cx, P0[1] - 36, 28); rol(cx - 72, P0[1] + 34, 26); rol(cx + 72, P0[1] + 34, 26); tag(cx + 72, P0[1] + 34, cx + 200, P0[1] + 40, '굽힘 롤러'); tag(cx - (1 - p) * Lp * 0.5, P0[1], cx - 300, P0[1] - 90, '격자를 깎은 판', 1 - p);
  } else if (t < 27) {
   const p = seg(t, 19.5, 26.5), cx = 450, y0 = 110, h = 320, R = 150, seam = y0 + h / 2, rot = t * 0.9;
   box(cx - 200, 430, 400, 24, 'dark', { v: true }); box(cx - 230, 454, 460, 16, 'steel', { v: true });
   const body = revV(cx, y0, h, () => R, M, { rings: real() ? 2 : 6 });
   if (real()) { g.save(); g.clip(body); for (let k = 0; k < 12; k++) { const a = k / 12 * TAU + rot, s = Math.sin(a); if (Math.cos(a) < 0) continue; line([[cx + s * R, y0], [cx + s * R, y0 + h]], 'rgba(0,0,0,.12)', 1); } g.restore(); }
   const sw = Math.min(Math.PI, p * TAU), bead = new Path2D(); for (let i = 0; i <= 40; i++) { const a = Math.PI / 2 - sw * i / 40; bead.lineTo(cx + R * Math.sin(a), seam + R * 0.11 * Math.cos(a)); }
   g.save(); g.lineCap = 'round'; g.strokeStyle = real() ? 'rgba(235,238,242,.95)' : 'rgba(255,194,74,.95)'; g.lineWidth = 5; g.stroke(bead); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.setLineDash([2, 3]); g.stroke(bead); g.restore();
   const tx = cx + R + 4; box(tx + 40, 70, 70, 400, 'yellow'); box(tx + 6, seam - 30, 110, 34, 'yellow', { v: true }); box(tx - 2, seam - 14, 22, 28, 'steel'); spr('fire', tx + 2, seam, 26, p < 1 ? 0.6 : 0, true);
   if (p < 1) for (let k = 0; k < 3; k++) line([[tx + 10, seam - 12 + k * 12], [tx + 18, seam - 16 + k * 12]], real() ? 'rgba(255,255,255,.6)' : `rgba(${HOL},.8)`, 1.2);
   panel(700, 70, 260, [['용접 진행', `${Math.round(p * 100)}%`], ['공구 회전', '800 rpm'], ['방식', '녹이지 않고 비벼 잇기'], ['원칙', '둘레를 한 번에']], '마찰교반용접 (FSW)'); tag(tx, seam, 780, seam + 90, '회전 공구 (어깨 + 핀)');
  } else if (t < 33) {
   const p = ez(seg(t, 27.4, 32.4)), ax = 330, ay = 270, R = 150, d = p * 120;
   box(80, 170, 170, 230, 'steel'); box(60, 400, 230, 70, 'dark', { v: true }); box(250, ay - 26, 40, 52, 'steel', { v: true });
   const outer = [], inner = []; for (let i = 0; i <= 40; i++) { const yy = -R + 2 * R * i / 40, xx = ax + d * (1 - (yy / R) ** 2); outer.push([xx + 8, ay + yy]); inner.push([xx, ay + yy]); }
   poly(outer.concat(inner.reverse()), M, { v: true });
   if (real()) for (let k = 0; k < 6; k++) { const yy = ay - R + ((k / 6 + t * 3) % 1) * 2 * R; line([[ax + d * (1 - ((yy - ay) / R) ** 2) + 2, yy], [ax + d * (1 - ((yy - ay) / R) ** 2) + 7, yy]], 'rgba(255,255,255,.35)', 1); }
   const rr = R * (0.15 + 0.8 * p), rx = ax + d * (1 - (rr / R) ** 2) + 26, ry = ay - rr; circle(rx, ry, 17, 'steel'); pipe([[rx + 12, ry - 8], [720, ay - rr * 0.5 - 30]], 7, 'steel'); box(700, ay - rr * 0.5 - 70, 120, 80, 'yellow'); box(690, ay - rr * 0.5 + 10, 140, FY - (ay - rr * 0.5 + 10), 'dark');
   tag(rx + 10, ry - 14, rx + 120, ry - 90, '스피닝 롤러'); tag(ax + d * 0.7, ay + R * 0.6, ax + 160, ay + R + 20, '돔이 되는 원판');
  } else if (t < 37) {
   const cx = 500, top = 170, h = 220, R = 140, dy = -(1 - ez(seg(t, 33, 35))) * 170;
   box(cx - 180, 450, 360, 20, 'dark', { v: true }); revV(cx, top + h, 70, u => R * Math.sqrt(Math.max(0, 1 - u * u)), M, { rings: 0 }); revV(cx, top, h, () => R, M, { rings: real() ? 3 : 6 });
   revV(cx, top - 70 + dy, 70, u => R * Math.sqrt(Math.max(0, 1 - (1 - u) ** 2)), M, { rings: 0 }); crane(cx, 30, top - 88 + dy);
   const p = seg(t, 35, 36.8); if (p > 0) { const bead = new Path2D(); for (let i = 0; i <= 40; i++) { const a = Math.PI / 2 - Math.PI * p * i / 40; bead.lineTo(cx + R * Math.sin(a), top + R * 0.11 * Math.cos(a)); } g.save(); g.strokeStyle = real() ? 'rgba(235,238,242,.95)' : 'rgba(255,194,74,.95)'; g.lineWidth = 4; g.stroke(bead); g.restore(); spr('fire', cx + R * Math.sin(Math.PI / 2 - Math.PI * p), top + R * 0.11 * Math.cos(Math.PI / 2 - Math.PI * p), 24, 0.7, true); }
   tag(cx + R, top + 30, cx + 280, top + 10, '원통 몸체'); tag(cx, top - 40 + dy, cx + 260, top - 90, '위 돔', seg(t, 33, 34));
  } else {
   const p = seg(t, 37, 43.5), cx = 460, top = 150, h = 230, R = 140 * (1 + 0.012 * seg(p, 0.5, 1)), Pt = (c.meop || 3) * 1.25, P = Pt * seg(p, 0.5, 0.95), wl = seg(p, 0, 0.5);
   box(cx - 180, 450, 360, 20, 'dark', { v: true });
   const pth = new Path2D(); const rfAll = u => { const yy = u * (h + 140) - 70; return yy < 0 ? R * Math.sqrt(Math.max(0, 1 - ((yy + 70) / 70 - 1) ** 2)) : yy > h ? R * Math.sqrt(Math.max(0, 1 - ((yy - h) / 70) ** 2)) : R; };
   const body = revV(cx, top - 70, h + 140, rfAll, M, { rings: real() ? 0 : 7, n: 40 });
   g.save(); g.clip(body); g.fillStyle = real() ? 'rgba(20,24,30,.85)' : 'rgba(5,15,28,.6)'; g.fillRect(cx, top - 80, R + 4, h + 160); const wy = top + h + 70 - (h + 140) * wl; g.fillStyle = real() ? 'rgba(70,140,220,.75)' : 'rgba(63,240,255,.25)'; g.fillRect(cx, wy, R + 4, top + h + 80 - wy); g.restore();
   line([[cx, top - 70], [cx, top + h + 70]], real() ? 'rgba(255,255,255,.4)' : `rgba(${HOL},.6)`, 1, [4, 4]);
   pipe([[cx - R - 60, 460], [cx - R - 60, top + h + 30], [cx - R * 0.6, top + h + 50]], 6, 'steel'); dial(800, 210, 60, P / (Pt * 1.1), '압력계', `${nf(P, 1)} bar`);
   panel(700, 320, 270, [['물 채우기', `${Math.round(wl * 100)}%`], ['시험 압력', `${nf(Pt, 1)} bar`], ['지금 압력', `${nf(P, 1)} bar`], ['새는 곳', p > 0.95 ? '없음' : '확인 중', p > 0.95 ? '#5dff9e' : null]], '내압 시험 (탈이온수)'); check(940, 456 - 4, true, seg(p, 0.95, 1));
   tag(cx + R * 0.5, wy + 30, cx + 220, top - 40, '탈이온수', wl > 0.2 ? 1 : 0);
  }
 } });

// 2. 단열재 제작·부착 (고른 단열재에 따라 분사형 · 타일 · 판형)
const TPS_MAKE = { cork: '코르크 알갱이를 수지와 섞어 틀에 넣고 눌러 판으로 굳혀요.', pica: '탄소 섬유 틀에 페놀 수지를 스며들게 해 가볍고 구멍 많은 블록으로 굳혀요.', blanket: '세라믹 섬유를 천 사이에 넣고 바느질로 누벼요.', mli: '금속을 입힌 아주 얇은 필름과 그물망을 여러 겹 번갈아 쌓아요.', rcc: '탄소 천에 수지를 먹여 굽고, 탄소를 채워 넣는 과정을 여러 번 되풀이해요.' };
const tpsKind = id => id === 'foam' || (CARD[id] && CARD[id].pat === 'none') ? 'spray' : id === 'hex' || (CARD[id] && CARD[id].pat === 'hex') ? 'tile' : 'sheet';
reg({ id: 'tps', cat: 'make', name: '단열재 제작·부착', desc: '고른 단열재에 따라 분사·타일·판 붙이기', dur: 40, opts: ['tps'],
 steps: c => tpsKind(c.tps) === 'spray' ? [[0, '표면 준비', '탱크 겉면을 닦고 프라이머를 발라 폼이 잘 붙게 해요.'], [6, '폼 분사', '탱크를 천천히 돌리면서 로봇이 폴리우레탄 폼을 뿜어요. 폼은 몇 초 만에 부풀며 굳어요.'], [18, '경화', '폼이 속까지 굳을 때까지 온도와 습도를 맞춰 기다려요.'], [23, '트리밍', '울퉁불퉁한 겉면을 깎아 정해진 두께로 맞춰요.'], [31, '두께·접착 검사', '초음파로 두께를 재고 들뜬 곳이 없는지 확인해요.']]
  : tpsKind(c.tps) === 'tile' ? [[0, '타일 깎기', '실리카 섬유 블록을 CNC로 깎아 붙일 자리에 꼭 맞는 모양으로 만들어요. 타일마다 모양이 조금씩 달라요.'], [8, '코팅·굽기', '겉면에 검은 유리질 코팅을 뿌리고 가마에서 구워 단단하고 열을 잘 내뿜게 해요.'], [16, '접착제 바르기', '타일 뒷면과 기체 표면에 고온용 접착제를 발라요.'], [22, '부착', '타일을 하나씩 눌러 붙여요. 열로 늘어날 것을 생각해 틈을 조금 남겨요.'], [32, '틈 메우기·검사', '틈에 갭 필러를 끼우고, 하나씩 당겨 보며 들뜬 타일이 없는지 확인해요.']]
  : [[0, '재료 만들기', TPS_MAKE[c.tps] || '재료를 틀에 넣고 눌러 판으로 만들어요.'], [8, '재단', '레이저 커터로 붙일 자리 모양대로 잘라요.'], [15, '접착제 바르기', '기체 표면과 판 뒷면에 접착제를 고르게 발라요.'], [21, '부착·압착', '판을 붙이고 롤러로 눌러 공기 방울이 남지 않게 해요.'], [30, '경화·검사', '접착제가 굳은 뒤 두드려 보고 사진을 찍어 들뜬 곳을 찾아요.']],
 draw(t, c) {
  bg('factory'); const kind = tpsKind(c.tps), T = c.tps, cy = 260, x0 = 160, len = 640, R = 110, rot = t * 0.8;
  if (kind === 'spray') {
   for (const sx of [x0 + 90, x0 + len - 90]) { box(sx - 50, cy + R, 100, 470 - cy - R, 'dark'); circle(sx - 26, cy + R - 4, 12, 'steel'); circle(sx + 26, cy + R - 4, 12, 'steel'); }
   const body = revH(x0, cy, len, u => R * (u < 0.06 ? Math.sqrt(u / 0.06) * 0.3 + 0.7 : u > 0.94 ? Math.sqrt((1 - u) / 0.06) * 0.3 + 0.7 : 1), c.mat, { rings: 0, n: 40 });
   if (t < 6) { const p = seg(t, 1, 5.5); g.save(); g.clip(body); g.fillStyle = real() ? 'rgba(200,190,90,.35)' : 'rgba(63,240,255,.12)'; g.fillRect(x0, cy - R - 2, len * p, 2 * R + 4); g.restore(); box(x0 + len * p - 10, cy - R - 70, 20, 60, 'steel'); tag(x0 + len * p, cy - R, x0 + len * p + 40, cy - R - 100, '프라이머 바르기'); }
   const thick = Math.max(8, (c.tpsT || 25) * 0.6), cov = t < 6 ? 0 : ez(seg(t, 6.5, 17.5)), trim = seg(t, 23.5, 30.5);
   if (cov > 0) { const ax = x0 + 20 + (len - 40) * cov, pth = new Path2D(); pth.moveTo(x0 + 20, cy - R); for (let x1 = x0 + 20; x1 <= ax; x1 += 6) { const bump = (x1 > x0 + 20 + (len - 40) * trim) ? 4 * Math.sin(x1 * 0.37) + 3 * Math.sin(x1 * 0.13 + 2) : 0; pth.lineTo(x1, cy - R - thick - bump); } pth.lineTo(ax, cy + R + thick); for (let x1 = ax; x1 >= x0 + 20; x1 -= 6) { const bump = (x1 > x0 + 20 + (len - 40) * trim) ? 4 * Math.sin(x1 * 0.29 + 1) : 0; pth.lineTo(x1, cy + R + thick + bump); } pth.closePath(); paint(pth, T, cy - R - thick, cy + R + thick, 'v');
    if (real()) { g.save(); g.clip(pth); for (let k = 0; k < 10; k++) { const yy = cy - R + ((k / 10 + rot * 0.15) % 1) * 2 * R; line([[x0 + 20, yy], [ax, yy]], 'rgba(0,0,0,.08)', 2); } g.restore(); }
    if (t < 18) { const robX = ax, ry = cy - R - thick - 130; box(robX - 60, 60, 120, 18, 'steel', { v: true }); pipe([[robX, 78], [robX + 30, ry + 30], [robX + 8, ry + 90]], 10, 'orange'); box(robX - 5, ry + 88, 14, 26, 'steel');
     g.save(); g.globalCompositeOperation = real() ? 'source-over' : 'lighter'; for (let i = 0; i < 26; i++) { const ph = (t * 3 + hs(i, 7)) % 1, sx = robX + 2 + (hs(i, 8) - 0.5) * 30 * ph, sy = ry + 114 + ph * (cy - R - thick - ry - 114); g.fillStyle = real() ? `rgba(240,160,70,${1 - ph * 0.5})` : `rgba(${HOL},.7)`; g.fillRect(sx, sy, 2.5, 2.5); } g.restore(); tag(robX + 8, ry + 100, robX + 110, ry + 60, '분사 로봇'); }
   }
   if (t >= 18 && t < 23) { const p = seg(t, 18, 23); for (let k = 0; k < 5; k++) spr('fire', x0 + 60 + k * 130, cy - R - 60, 40, 0.18, true); panel(700, 60, 260, [['온도', '24 °C'], ['습도', '45 %'], ['경화', `${Math.round(p * 100)}%`]], '경화 중'); }
   if (t >= 23 && t < 31) { const tx = x0 + 20 + (len - 40) * trim; box(tx - 8, cy - R - thick - 70, 16, 64, 'steel'); circle(tx, cy - R - thick - 4, 9, 'steel'); sparks(31, tx, cy - R - thick - 6, t, { col: '240,150,60', n: 18, speed: 70, life: 0.7, grav: 260 }); tag(tx, cy - R - thick - 40, tx + 100, cy - R - thick - 110, '트리밍 공구'); }
   if (t >= 31) { const p = seg(t, 31, 39), px = x0 + 20 + (len - 40) * p; box(px - 6, cy - R - thick - 60, 12, 54, 'blue'); g.save(); g.globalAlpha = 0.35; g.fillStyle = '#5dff9e'; g.fillRect(x0 + 20, cy - R - thick - 6, px - x0 - 20, 6); g.restore(); panel(700, 60, 260, [['목표 두께', `${nf(c.tpsT || 25, 0)} mm`], ['잰 두께', `${nf((c.tpsT || 25) * (1 + 0.01 * Math.sin(t * 7)), 1)} mm`], ['들뜬 곳', p > 0.98 ? '없음' : '찾는 중', p > 0.98 ? '#5dff9e' : null]], '초음파 검사'); }
   tag(x0 + len * 0.15, cy, x0 + 40, cy + R + 60, `${CARD[T] ? CARD[T].name : '폼'} · 회전대 위 탱크`, cov > 0 ? 1 : 0);
   return;
  }
  if (kind === 'tile') {
   if (t < 16) { const p = seg(t, 0.5, 7.5); box(260, 330, 300, 140, 'dark'); box(270, 320, 280, 12, 'steel', { v: true });
    const tile = [[340, 320 - 60], [470, 320 - 60], [480, 320], [330, 320]]; const cut = t < 8 ? p : 1;
    poly([[340 - 20 * (1 - cut), 260 - 20 * (1 - cut)], [470 + 20 * (1 - cut), 260 - 20 * (1 - cut)], [480 + 20 * (1 - cut), 320], [330 - 20 * (1 - cut), 320]], t < 8 ? 'silica' : t < 12 ? 'silica' : T, { v: true });
    if (t < 8) { const hx = 330 + 150 * ((t * 0.6) % 1); box(hx - 8, 150, 16, 96, 'steel'); sparks(41, hx, 250, t, { col: '240,240,240', n: 16, speed: 60, life: 0.6, grav: 120 }); tag(hx, 200, hx + 140, 160, '다이아몬드 공구'); tag(400, 300, 220, 230, '실리카 섬유 블록'); }
    if (t >= 8) { const k = seg(t, 8, 15.5); box(620, 180, 260, 290, 'brick', { v: true }); box(640, 200, 220, 200, 'dark', { flat: true }); spr('fire', 750, 300, 140, 0.7 * Math.sin(Math.PI * cl(k)), true); panel(640, 410, 220, [['가마 온도', `${Math.round(20 + 1180 * Math.sin(Math.PI * cl(k)))} °C`]], '코팅 굽기'); g.save(); g.fillStyle = real() ? `rgba(20,20,24,${seg(t, 8, 10)})` : `rgba(${HOL},.15)`; g.fill(polyP(tile)); g.restore(); tag(410, 280, 410, 160, '검은 유리질 코팅', seg(t, 8, 9)); }
    return; }
   const px0 = 180, py0 = 110, pw = 640, ph = 330; box(px0, py0, pw, ph, c.mat); const s = 30, hx = (i, j) => [px0 + 34 + i * s * 1.5, py0 + 34 + j * s * 1.732 + (i % 2 ? s * 0.866 : 0)];
   const order = []; for (let i = 0; i < 14; i++) for (let j = 0; j < 6; j++) order.push([i, j]);
   const glue = seg(t, 16, 21.5), placed = Math.floor(seg(t, 22, 31.5) * order.length);
   g.save(); g.globalAlpha = 0.6 * glue; g.fillStyle = real() ? 'rgba(210,200,170,1)' : `rgba(${HOL},.25)`; g.fillRect(px0 + 10, py0 + 10, (pw - 20) * glue, ph - 20); g.restore();
   order.forEach(([i, j], n) => { const [x1, y1] = hx(i, j), pts = Array.from({ length: 6 }, (_, k) => [x1 + Math.cos(k * Math.PI / 3) * (s - 1.5), y1 + Math.sin(k * Math.PI / 3) * (s - 1.5)]); if (n < placed) { poly(pts, T, { v: true }); if (t > 32 && real()) { g.save(); g.strokeStyle = 'rgba(240,240,235,.75)'; g.lineWidth = 2.5; g.stroke(polyP(pts)); g.restore(); } } else if (!real()) { const pp = polyP(pts); g.save(); g.setLineDash([3, 4]); g.strokeStyle = `rgba(${HOL},.25)`; g.stroke(pp); g.restore(); } });
   if (t >= 22 && t < 32 && placed < order.length) { const [x1, y1] = hx(...order[placed]), drop = 1 - ((seg(t, 22, 31.5) * order.length) % 1); poly(Array.from({ length: 6 }, (_, k) => [x1 + Math.cos(k * Math.PI / 3) * (s - 1.5), y1 - drop * 60 + Math.sin(k * Math.PI / 3) * (s - 1.5)]), T, { v: true }); box(x1 - 6, y1 - drop * 60 - 70, 12, 50, 'steel'); tag(x1, y1 - drop * 60 - 40, x1 + 80, 70, '진공 집게로 타일 붙이기'); }
   if (t >= 32) { const p = seg(t, 32, 39); panel(700, 455, 270, [['틈 메움(갭 필러)', `${Math.round(p * 100)}%`], ['당김 시험', p > 0.95 ? '모두 통과' : '진행 중', p > 0.95 ? '#5dff9e' : null]], '마무리 검사'); }
   return;
  }
  // sheet
  if (t < 15) {
   if (t < 8) { const p = seg(t, 0.5, 7), py = lerp(90, 250, ez(cl(p * 1.6))); box(300, 330, 400, 140, 'dark'); box(320, py, 360, 40, 'steel', { v: true }); pipe([[500, 40], [500, py]], 26, 'steel'); poly([[340, 330], [660, 330], [660, 302], [340, 302]], T, { v: true }); tag(500, 316, 760, 260, `${CARD[T] ? CARD[T].name : '단열재'} 재료 판`); panel(720, 60, 240, [['누르는 힘', `${Math.round(200 * cl(p * 1.6))} t`], ['온도', '150 °C']], '성형 프레스'); }
   else { const p = seg(t, 8.3, 14.5); box(200, 380, 600, 90, 'dark'); poly([[260, 380], [740, 380], [740, 360], [260, 360]], T, { v: true }); const path = [[300, 370], [480, 370], [520, 366], [700, 370]]; const lx = lerp(300, 700, p); box(lx - 14, 150, 28, 60, 'steel'); g.save(); g.globalCompositeOperation = 'lighter'; line([[lx, 210], [lx, 366]], 'rgba(255,60,60,.9)', 2); spr('fire', lx, 366, 18, 0.9, true); g.restore(); line([[300, 368], [lx, 368]], real() ? 'rgba(0,0,0,.7)' : 'rgba(255,194,74,.9)', 2); cloud(51, lx, 360, t, 8.3, 14.5, { n: 30, life: 2, speed: 20, r0: 4, grow: 10, a: 0.25, spr: 'grey' }); tag(lx, 180, lx + 120, 120, '레이저 커터'); }
   return;
  }
  const cyl = revV(500, 90, 360, () => 150, c.mat, { rings: real() ? 3 : 6 }); box(320, 450, 360, 20, 'dark', { v: true });
  const glue = seg(t, 15, 20.5), put = seg(t, 21, 29.5);
  g.save(); g.clip(cyl); g.globalAlpha = 0.55; g.fillStyle = real() ? 'rgba(220,210,170,1)' : `rgba(${HOL},.2)`; g.fillRect(350, 90, 300 * glue, 360); g.restore();
  if (t < 21) { const rx = 350 + 300 * glue; circle(rx, 270 + 120 * Math.sin(t * 3), 14, 'orange'); tag(rx, 270, rx + 120, 200, '접착제 롤러'); }
  const nP = 4; for (let k = 0; k < nP; k++) { const a = seg(put, k / nP, (k + 1) / nP); if (a <= 0) continue; const yy = 90 + k * 90; g.save(); g.clip(cyl); const p = rectP(350, yy + 2 - (1 - a) * 60, 300, 86); paint(p, T, 350, 650, 'h'); if (T === 'blanket' || T === 'mli') { g.strokeStyle = real() ? 'rgba(0,0,0,.25)' : `rgba(${HOL},.4)`; g.lineWidth = 1; g.beginPath(); for (let xx = 360; xx < 650; xx += 24) { g.moveTo(xx, yy + 2); g.lineTo(xx, yy + 88); } g.stroke(); } g.restore(); }
  if (t >= 21 && t < 30) { const yy = 90 + Math.min(3, Math.floor(put * nP)) * 90 + 45; circle(650 + 20, yy, 20, 'rubber'); pipe([[690, yy], [800, yy - 80]], 6, 'steel'); tag(670, yy, 800, yy + 60, '압착 롤러'); }
  if (t >= 30) { const p = seg(t, 30, 39); panel(700, 70, 260, [['경화', `${Math.round(p * 100)}%`], ['두드림 검사', p > 0.95 ? '이상 없음' : '진행 중', p > 0.95 ? '#5dff9e' : null]], '경화·검사'); }
 } });

// 3. 엔진 제작
reg({ id: 'engmake', cat: 'make', name: '엔진 제작', desc: '냉각 채널 가공 → 브레이징 → 인젝터 → 터보펌프 → 기밀 시험', dur: 42, opts: ['eng'],
 steps: [[0, '연소기 라이너 가공', '구리 합금 라이너 바깥에 가는 냉각 채널 수백 개를 깎아요. 연료가 이 홈을 흐르며 뜨거운 벽을 식혀요(재생 냉각).'], [8, '외피 브레이징', '바깥 껍데기를 씌우고 진공로에서 1000 °C 가까이 가열해 한 몸으로 붙여요.'], [15, '인젝터 헤드 조립', '연료와 산화제를 뿜는 분사기 수백 개가 달린 헤드를 연소기 위에 붙여요.'], [21, '터보펌프 조립', '가스발생기의 뜨거운 가스로 터빈을 돌리고, 같은 축의 펌프가 추진제를 높은 압력으로 밀어 넣어요.'], [29, '배관 연결·기밀 시험', '배관을 잇고 헬륨을 넣어 새는 곳이 없는지 하나하나 검사해요.'], [36, '엔진 완성', c => `${engName(c.eng)} 엔진이 짐벌(방향 조종 장치)과 함께 완성돼 연소시험장으로 가요.`]],
 draw(t, c) {
  bg('factory'); const id = c.eng, E = CARD[id] || CARD.merlin, SH = engShape(id, E.fuel), L = 330, cx = 470, y0 = 90, hf = Math.min(0.42, SH.hf), re = L / SH.asp, bellTop = y0 + L * hf;
  box(cx - 150, y0 + L + 12, 300, 470 - y0 - L - 12, 'dark'); box(cx - 170, y0 + L, 340, 14, 'steel', { v: true });
  if (t < 15) {
   const bell = revV(cx, bellTop, L * (1 - hf), u => re * lerpArr(SH.b, u), t < 8 ? 'copper' : nozMat(id), { rings: 0, n: 24 });
   if (t < 8) { const p = seg(t, 0.5, 7.5); g.save(); g.clip(bell); const n = 26; for (let k = 0; k < n * p; k++) { const s = Math.sin(-Math.PI / 2 + (k + 0.5) / n * Math.PI); const pp = new Path2D(); for (let i = 0; i <= 12; i++) { const u = i / 12; pp.lineTo(cx + s * re * lerpArr(SH.b, u), bellTop + u * L * (1 - hf)); } if (real()) { g.strokeStyle = 'rgba(60,25,10,.6)'; g.lineWidth = 1.4; g.stroke(pp); } else glow(pp, 0.6, 0.8); } g.restore();
    const s = Math.sin(-Math.PI / 2 + (n * p) / n * Math.PI), u = (t * 0.8) % 1, tx = cx + s * re * lerpArr(SH.b, u) + 6, ty = bellTop + u * L * (1 - hf); box(tx, ty - 8, 90, 16, 'steel', { v: true }); sparks(61, tx, ty, t, { col: '255,170,110', n: 14, speed: 70, life: 0.4, grav: 200 }); tag(tx + 40, ty - 8, tx + 120, ty - 80, '채널 가공 공구'); tag(cx, bellTop + L * 0.3, cx - 260, bellTop + 40, '구리 합금 라이너 + 냉각 채널'); }
   else { const p = seg(t, 8, 14.5), drop = 1 - ez(seg(t, 8, 9.5)), lift = ez(seg(t, 13.2, 14.5)), fy = -drop * 300 - lift * 300; const hot = Math.sin(Math.PI * seg(t, 9.5, 13.2));
    engine(cx, bellTop, L * (1 - hf), id, { bare: true, hot }); g.save(); g.globalAlpha = 0.92; box(cx - re * 1.4, bellTop - 40 + fy, re * 2.8, L * (1 - hf) + 50, 'steel'); g.restore(); g.save(); g.fillStyle = `rgba(255,120,40,${0.35 * hot})`; g.globalCompositeOperation = 'lighter'; g.fillRect(cx - re * 1.4, bellTop - 40 + fy, re * 2.8, L * (1 - hf) + 50); g.restore();
    panel(720, 70, 240, [['노 온도', `${Math.round(20 + 960 * hot)} °C`], ['진공도', '10⁻⁵ mbar']], '진공 브레이징로'); tag(cx + re * 1.4, bellTop + 60 + fy, cx + re * 1.4 + 90, bellTop + 140 + fy, '진공로 덮개', drop < 0.5 && lift < 0.5 ? 1 : 0); }
   return;
  }
  const headIn = ez(seg(t, 15.2, 18)), pumpIn = ez(seg(t, 21.5, 24)), pipesIn = seg(t, 29, 33);
  revV(cx, bellTop, L * (1 - hf), u => re * lerpArr(SH.b, u), nozMat(id), { rings: real() ? 0 : 6, n: 24 });
  const hy = y0 - (1 - headIn) * 160; revV(cx, hy, L * hf, u => Math.max(1, re * lerpArr(SH.h, u)), 'steel', { rings: real() ? 2 : 3 }); if (headIn < 1) crane(cx, 30, hy - 18);
  if (t < 21) { const ix = 830, iy = 200; circle(ix, iy, 90, 'steel'); g.save(); for (let k = 0; k < 4; k++) for (let a = 0; a < 6 + k * 6; a++) { const ang = a / (6 + k * 6) * TAU, rr = 18 + k * 18; g.fillStyle = real() ? '#1d2024' : `rgba(${HOL},.8)`; g.beginPath(); g.arc(ix + Math.cos(ang) * rr, iy + Math.sin(ang) * rr, 3.2, 0, TAU); g.fill(); } g.restore(); big('인젝터 면', ix, iy + 110, 14, '#eafcff'); }
  const hmax = re * Math.max(...SH.h), px = cx + hmax + 70 + (1 - pumpIn) * 260; if (t >= 21) { revV(px, y0 + 20, L * 0.3, u => re * 0.32 * (u < 0.3 ? 1.15 : 0.85), 'steel', { rings: real() ? 2 : 4 }); box(px - re * 0.12, y0 + L * 0.3 + 20, re * 0.24, 30, 'dark'); }
  if (t >= 21 && t < 29) { const ix = 840, iy = 210, a = t * 9; circle(ix, iy, 80, 'steel'); for (let k = 0; k < 14; k++) { const an = a + k / 14 * TAU; poly([[ix + Math.cos(an) * 26, iy + Math.sin(an) * 26], [ix + Math.cos(an + 0.18) * 72, iy + Math.sin(an + 0.18) * 72], [ix + Math.cos(an + 0.32) * 72, iy + Math.sin(an + 0.32) * 72], [ix + Math.cos(an + 0.12) * 26, iy + Math.sin(an + 0.12) * 26]], 'niobium'); } circle(ix, iy, 22, 'dark'); big('터빈 휠 (수만 rpm)', ix, iy + 100, 14, '#eafcff'); tag(px, y0 + 60, px + 60, y0 - 20, '터보펌프'); }
  if (t >= 29) { const pts = [[[px, y0 + L * 0.3 + 50], [px, bellTop + 10], [cx + re * SH.b[0] * 1.2, bellTop + 18]], [[px - re * 0.3, y0 + 40], [cx + hmax + 6, y0 + 40]], [[cx - hmax - 4, y0 + 30], [cx - hmax - 40, y0 + 120], [cx - re * SH.b[0] * 1.2, bellTop + 8]]]; pts.forEach((pp, k) => { const a = seg(pipesIn, k / 3, (k + 1) / 3); if (a > 0) { const n = Math.max(2, Math.ceil(pp.length * a)); pipe(pp.slice(0, n), 7); } });
   if (t < 36) { const k = Math.floor(seg(t, 33, 36) * 3 - 1e-6), pp = pts[Math.max(0, k)], q = pp[pp.length - 1]; box(q[0] - 4, q[1] - 46, 8, 34, 'blue'); check(q[0] + 22, q[1] - 30, true, seg(t, 33.4, 34)); panel(720, 70, 240, [['헬륨 누설', '1×10⁻⁷ 이하', '#5dff9e'], ['검사한 이음매', `${Math.min(3, k + 1)} / 3`]], '기밀 시험'); } }
  if (t >= 36) { box(cx - re * 0.25, y0 - 22, re * 0.5, 22, 'dark'); big(engName(id) + ' 완성', cx + 260, 150, 26, '#ffc24a', seg(t, 36.3, 37)); tag(cx, y0 - 12, cx + 170, y0 - 30, '짐벌 받침'); }
 } });

// 4. 단 조립 · 총조립
reg({ id: 'assembly', cat: 'make', name: '단 조립·총조립', desc: '엔진 장착 → 배관 → 탱크 결합 → 단 결합 → 페어링', dur: 46, opts: ['ship'],
 steps: [[0, '엔진 장착', c => `들어 올림 장치로 엔진을 추력 구조에 하나씩 끼우고 볼트로 고정해요. 이 기체는 엔진 ${c.nEng}기를 달아요.`], [10, '배관·전선 연결', '추진제 배관, 가압 배관, 전선을 엔진과 탱크에 이어요. 이음매 하나하나 기밀을 확인해요.'], [16, '탱크 결합', '크레인으로 탱크를 들어 아래 부품 위에 정확히 맞춰 내려놓고 고정해요.'], [24, '단 수평 결합', '조립동에서 단들을 눕힌 채 레일 위 받침대로 밀어 정확히 맞춰 결합해요.'], [33, '위성 탑재·페어링', '위성을 어댑터에 올리고 페어링 두 쪽을 닫아요.'], [40, '최종 점검', '전기·기밀·정렬 점검을 마치면 발사대로 옮길 준비가 끝나요.']],
 draw(t, c) {
  bg('factory'); const P = c.parts, st = stages(P), s1 = st[0];
  if (t < 24) {
   const eb = s1.find(p => p.role === 'engbay') || null, tanks = s1.filter(p => p.role !== 'engbay'), part0 = eb || s1[0];
   const sc = Math.min(300 / Math.max(1, stackH(s1)), 260 / maxD(s1)), cx = 470, yB = 450;
   if (t < 16) { const sc2 = Math.min(150 / Math.max(1, part0.shape.h + engLen([part0])), 300 / (part0.shape.d0)), ebY = 210, h = part0.shape.h * sc2, R = part0.shape.d0 / 2 * sc2;
    box(cx - R - 50, ebY - 10, 30, 260, 'yellow'); box(cx + R + 20, ebY - 10, 30, 260, 'yellow');
    revV(cx, ebY - h, h, u => rfOf(part0.shape, sc2)(1 - u), partMat(part0), { rings: real() ? 0 : 3 });
    if (eb) { const nE = eb.engines.length, show = Math.min(nE, 5), pos = show === 1 ? [0] : Array.from({ length: show }, (_, i) => (-1 + 2 * i / (show - 1)) * R * 0.62), done = seg(t, 0.5, 9.5) * show;
     pos.forEach((dx, i) => { const id = eb.engines[Math.floor(i * nE / show)], L = (CARD[id] ? CARD[id].noz : 1) * 1.9 * sc2 * 0.96, a = cl(done - i); if (a <= 0) return; const dy = (1 - ez(a)) * 160; engine(cx + dx, ebY + dy, L, id, { bare: true }); if (a < 1) { box(cx + dx - 26, ebY + L + dy + 4, 52, 10, 'steel', { v: true }); pipe([[cx + dx, ebY + L + dy + 14], [cx + dx, 470]], 10, 'steel'); } else if (a < 1.2 || t < 10) check(cx + dx, ebY - 14, true, seg(done - i, 1, 1.15) * (t < 10 ? 1 : 0)); });
     panel(720, 70, 250, [['장착한 엔진', `${Math.min(nE, Math.round(seg(t, 0.5, 9.5) * nE))} / ${nE}기`], ['엔진 종류', engName(eb.engines[0])]], '엔진 장착');
     if (t >= 10) { const p = seg(t, 10, 15.5); for (let i = 0; i < pos.length; i++) { const dx = pos[i], pp = [[cx + dx, ebY + 6], [cx + dx * 0.5, ebY - h * 0.5], [cx + dx * 0.2, ebY - h + 4]]; const n = Math.max(2, Math.ceil(3 * cl(p * 1.4 - i * 0.1))); if (p * 1.4 - i * 0.1 > 0) pipe(pp.slice(0, n), 4, i % 2 ? 'steel' : 'gold'); } panel(720, 70, 250, [['추진제 배관', `${Math.round(p * 100)}%`], ['전선 묶음', `${Math.round(p * 100)}%`], ['기밀 확인', p > 0.95 ? '완료' : '진행 중', p > 0.95 ? '#5dff9e' : null]], '배관·전선'); } }
    else big('엔진부가 없는 단이에요', cx, 420, 16, '#eafcff');
    return; }
   // 탱크 쌓기
   const p = seg(t, 16, 23.5), n = s1.length; let y = yB - engLen(s1) * sc; const ex = ship([s1[0]], cx, yB, sc); y = ex.top;
   s1.slice(1).forEach((q, i) => { const a = cl(p * (n - 1) - i); const h = q.shape.h * sc, dy = -(1 - ez(a)) * 220; if (a <= 0) return; revV(cx, y - h + dy, h, u => rfOf(q.shape, sc)(1 - u), partMat(q), { rings: real() ? 0 : 4 }); if (a < 1) crane(cx, 30, y - h + dy - 18); y -= h; });
   tag(cx + maxD(s1) * sc / 2, yB - 100, cx + 220, yB - 160, '1단 조립 중'); return;
  }
  // 수평 결합 · 페어링 · 점검
  const total = stackH(P), sc = Math.min(860 / total, 150 / maxD(P)), cy = 300, gap = (1 - ez(seg(t, 24.5, 31))) * 70; let x = 70;
  const last = P[P.length - 1], nose = last && (last.role === 'shell' || last.role === 'capsule') && P.length > 1 ? last : null, fgap = nose ? (t < 33 ? 1 : 1 - ez(seg(t, 34, 39))) * Math.max(16, maxR(nose.shape) * sc * 0.9) : 0;
  const Dm = maxD(P) * sc; box(30, cy + Dm / 2 + 56, 940, 12, 'steel', { v: true });
  st.forEach((S_, i) => { const isLast = i === st.length - 1, body = isLast && nose ? S_.slice(0, -1) : S_, L = stackH(body, i === 0) * sc, xx = x + i * gap;
   for (const f of [0.25, 0.75]) { box(xx + L * f - 30, cy + Dm / 2 + 6, 60, 40, 'yellow'); box(xx + L * f - 40, cy + Dm / 2 + 46, 80, 10, 'dark', { v: true }); }
   if (body.length) { g.save(); g.translate(xx + L, cy); g.rotate(Math.PI / 2); ship(body, 0, L, sc, { engines: i === 0, legsUp: true }); g.restore(); }
   if (i > 0 && gap < 2) check(xx, cy - Dm / 2 - 18, true, seg(t, 31, 32));
   if (isLast && nose) { const nl = nose.shape.h * sc, nx = xx + L, rf0 = rfOf(nose.shape, sc);
    for (const sg of [-1, 1]) { g.save(); g.beginPath(); g.rect(nx - 2, sg < 0 ? cy - 400 : cy, nl + 4, 400); g.clip(); g.translate(0, sg * fgap); revH(nx, cy, nl, u => rf0(u), partMat(nose), { rings: real() ? 0 : 4 }); g.restore(); }
    if (fgap > 2) { const sh2 = Math.min(fgap * 1.5, rf0(0) * 1.2, 52); box(nx + 6, cy - sh2 / 2, Math.min(nl * 0.45, 60), sh2, 'gold', { met: true }); box(nx, cy - 4, 8, 8, 'dark'); tag(nx + 30, cy, nx + 60, cy + Dm / 2 + 30, '위성'); }
    x += nl; }
   x += L; });
  if (t >= 33 && t < 40) big('페어링 닫는 중', 70 + total * sc - 60, cy - Dm / 2 - 70, 15, '#eafcff', 1 - seg(t, 39, 40));
  if (t >= 40) { const p = seg(t, 40, 45.5), sx = 70 + (total * sc) * p; g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createLinearGradient(sx - 40, 0, sx + 40, 0); gr.addColorStop(0, 'rgba(63,240,255,0)'); gr.addColorStop(0.5, 'rgba(63,240,255,.35)'); gr.addColorStop(1, 'rgba(63,240,255,0)'); g.fillStyle = gr; g.fillRect(sx - 40, cy - 120, 80, 240); g.restore(); panel(700, 60, 270, [['전기 점검', p > 0.3 ? '정상' : '확인 중', p > 0.3 ? '#5dff9e' : null], ['기밀 점검', p > 0.6 ? '정상' : '확인 중', p > 0.6 ? '#5dff9e' : null], ['정렬', p > 0.9 ? '정상' : '확인 중', p > 0.9 ? '#5dff9e' : null]], '최종 점검'); }
 } });

// 5. 엔진 연소시험 (지상 / 진공형은 고공 모사)
reg({ id: 'engtest', cat: 'test', name: '엔진 연소시험', desc: '밤의 연소시험장: 충전 → 점화 → 연소 → 종료', dur: 40, opts: ['eng'],
 steps: c => [[0, '추진제 충전', '시험장 탱크에 액체산소와 연료를 채워요. 액체산소가 증발하며 하얀 김이 나요.'], [7, '점화 준비', '모든 사람은 수백 m 떨어진 제어계측동으로 옮기고 카운트다운을 해요.'], [11, '점화', '점화기가 불을 붙이고 터보펌프가 돌기 시작하면 몇 초 만에 최대 추력에 올라요.'], [14, CARD[c.eng] && CARD[c.eng].vac ? '고공 모사 연소' : '정상 연소', CARD[c.eng] && CARD[c.eng].vac ? '진공형 엔진은 공기가 거의 없는 높은 하늘을 흉내 낸 챔버에서 시험해요. 디퓨저가 배기를 빨아내 낮은 압력을 만들어요.' : '화염유도로가 불꽃을 옆으로 꺾고, 냉각수를 뿌려 열과 소음을 줄여요. 그 물이 끓어 거대한 수증기 구름이 생겨요.'], [30, '연소 종료', '밸브를 닫고 질소로 배관을 불어 내요. 뜨거워진 노즐은 붉게 빛나다가 식어요.'], [35, '데이터 분석', '추력·압력·온도 기록을 보고 설계대로 탔는지 확인해요.']],
 draw(t, c) {
  bg('night'); const id = c.eng, E = CARD[id] || CARD.merlin, vac = !!E.vac, ign = seg(t, 11, 13.5), off = seg(t, 30, 31.5), I = ign * (1 - off), cx = 330, y0 = 120, L = 200;
  const thr = THR[id] || 75, pc = PC[id] || 60, Tt = t < 11 ? 0 : (t - 11) * 6;
  // 화염유도로·시험대
  poly([[0, 330], [cx - 90, 330], [cx - 90, 470], [0, 470]], 'concrete', { v: true }); poly([[cx + 90, 330], [1000, 330], [1000, 360], [cx + 160, 360], [cx + 90, 380]], 'concrete', { v: true });
  const tr = polyP([[cx - 90, 330], [cx + 90, 330], [cx + 90, 380], [cx + 160, 360], [1000, 360], [1000, 470], [cx - 90, 470]]); g.save(); g.fillStyle = real() ? '#121417' : 'rgba(63,240,255,.05)'; g.fill(tr); g.restore(); if (!real()) glow(tr, 0.4, 1);
  poly([[cx - 90, 470], [cx - 90, 440], [cx + 60, 420], [1000, 420], [1000, 470]], 'concrete', { v: true, lum: 0.7 });
  for (const sx of [cx - 140, cx + 140]) box(sx - 9, 30, 18, 300, 'steel'); for (const yy of [40, 110, 190, 260]) box(cx - 150, yy, 300, 10, 'steel', { v: true }); box(cx - 60, 60, 120, 40, 'dark', { v: true });
  for (const yy of [110, 190]) for (let k = 0; k < 14; k++) line([[cx - 150 + k * 22, yy - 26], [cx - 150 + k * 22, yy]], real() ? 'rgba(255,214,90,.6)' : `rgba(${HOL},.3)`, 1);
  box(560, 150, 70, 180, 'white'); box(650, 190, 60, 140, 'steel'); tag(595, 160, 640, 110, '런 탱크 (산화제·연료)', seg(t, 0.5, 1.5) * (1 - seg(t, 6, 7)));
  pipe([[560, 300], [cx + 60, 300], [cx + 40, y0 + 20]], 7, 'steel'); pipe([[650, 310], [cx + 80, 312], [cx + 50, y0 + 40]], 5, 'steel');
  let e;
  if (vac) { box(cx - 120, y0 - 20, 240, 250, 'steel'); g.save(); const win = new Path2D(); win.ellipse(cx, y0 + 105, 85, 110, 0, 0, TAU); g.clip(win); g.fillStyle = real() ? '#0b0d10' : 'rgba(5,15,28,.6)'; g.fillRect(cx - 120, y0 - 20, 240, 250); e = engine(cx, y0 + 20, L * 0.8, id, { hot: Math.max(I * 0.6, (1 - seg(t, 31.5, 38)) * (t > 30 ? 0.9 : 0)) }); plume(cx, e.exitY, Math.PI / 2, 140, e.exitR, t, E.fuel, { I, spread: 1.1 }); g.restore(); if (real()) { g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 3; g.stroke(win); } box(cx - 50, y0 + 230, 100, 100, 'steel'); tag(cx + 120, y0 + 60, cx + 220, y0 + 20, '고공 모사 챔버'); tag(cx + 50, y0 + 280, cx + 200, y0 + 250, '디퓨저'); plume(cx, y0 + 330, Math.PI / 2, 60, 40, t, E.fuel, { I: I * 0.7, diamonds: false }); plume(cx + 60, 400, 0.12, 380, 30, t, E.fuel, { I: I * 0.6, spread: 2.5, diamonds: false }); }
  else { e = engine(cx, y0, L, id, { hot: Math.max(I * 0.5, t > 30 ? 0.9 * (1 - seg(t, 31.5, 38)) : 0) }); plume(cx, e.exitY, Math.PI / 2, 380 - e.exitY + 20, e.exitR, t, E.fuel, { I }); plume(cx + 40, 405, 0.1, 520, 34, t, E.fuel, { I: I * 0.8, spread: 2.6, diamonds: false }); }
  // 충전 김, 냉각수, 수증기
  cloud(71, 600, 150, t, 0, 12, { n: 40, life: 4, speed: 18, ang: -1.9, spread: 0.9, r0: 6, grow: 14, a: 0.35, wind: -6 });
  if (t > 11) { jets(cx + 100, 350, 0.3, 160, 5, t, 0.5 * I); jets(cx + 300, 350, 0.5, 140, 4, t, 0.4 * I); }
  cloud(73, 760, 420, t, 11.5, 31, { n: 140, life: 10, speed: 110, ang: -0.8, spread: 1.1, r0: 30, grow: 36, a: 0.6, rise: 4, wind: 10, floor: 470 }); cloud(77, 600, 400, t, 12, 31, { n: 50, life: 8, speed: 50, ang: -1.4, spread: 0.8, r0: 20, grow: 26, a: 0.4, rise: 4, wind: 6 });
  cloud(75, cx + 60, e.exitY + 40, t, 30.2, 33, { n: 30, life: 5, speed: 30, ang: 0.4, spread: 1.5, r0: 10, grow: 16, a: 0.35, spr: 'white' });
  lightUp(cx, e.exitY + 60, 380, I);
  // 계기
  big(t >= 7 && t < 11 ? `T−${Math.ceil(11 - t)}` : '', 770, 90, 44, '#ffc24a');
  if (t >= 11) panel(720, 40, 250, [['시간', `T+ ${nf(Tt, 1)} s (빠르게)`], ['연소실 압력', `${nf(pc * I, 1)} bar`], ['추력', `${nf(thr * I, 1)} tf`], ['엔진', engName(id)]], vac ? '고공 모사 연소시험' : '지상 연소시험');
  if (t >= 11) graph(720, 160, 250, 120, [{ f: tt => thr * seg(tt, 0, 2.5) * (1 - seg(tt, 19, 20.5)), max: thr * 1.2, col: '#ffc24a', label: '추력' }], t - 11, 26, '추력 기록');
  if (t >= 35) { check(750, 310, true, seg(t, 35.5, 36)); big('설계 성능 확인', 850, 312, 15, '#5dff9e', seg(t, 35.5, 36)); }
 } });

// 6. 단 종합수류·연소시험
reg({ id: 'stagetest', cat: 'test', name: '단 종합연소시험', desc: '언덕 위 시험대에서 1단 전체를 실제 비행 시간만큼 연소', dur: 48, opts: ['ship'],
 steps: c => [[0, '단 설치', '완성된 1단을 언덕 위 시험대로 옮겨 세우고 시험 설비와 연결해요.'], [7, '종합 수류 시험', '불을 붙이지 않고 추진제를 흘려 밸브·배관·시동 순서가 맞는지 먼저 확인해요.'], [14, '추진제 충전', '실제 비행처럼 단 탱크에 추진제를 채워요. 극저온 탱크 겉면에 서리가 껴요.'], [19, '점화', c.nEng > 1 ? `엔진 ${c.nEng}기가 함께 점화돼요. 묶음(클러스터) 엔진은 시동 시간을 아주 정확히 맞춰야 해요.` : '엔진이 점화돼요.'], [22, '연소 (비행 시간만큼)', '실제 비행처럼 2분 넘게 태워요. 꺾인 불꽃과 냉각수가 산더미 같은 수증기를 만들어 언덕을 덮어요.'], [40, '종료·점검', '연소가 끝나면 단을 점검하고 기록을 분석해 발사에 쓸 수 있는지 판단해요.']],
 draw(t, c) {
  bg('day', { sea: 330, floor: 480 }); const s1 = stages(c.parts)[0], cx = 300, base = 300;
  poly([[0, 350], [470, 350], [1000, 500], [1000, 560], [0, 560]], 'hill', { v: true }); box(cx - 120, 340, 240, 14, 'concrete', { v: true });
  const trench = polyP([[cx - 40, 352], [cx + 40, 352], [cx + 60, 372], [640, 400], [600, 384], [cx - 10, 392]]); g.save(); g.fillStyle = real() ? '#15171b' : 'rgba(63,240,255,.06)'; g.fill(trench); g.restore(); if (!real()) glow(trench, 0.4, 1); else { g.strokeStyle = 'rgba(200,195,185,.6)'; g.lineWidth = 2; g.stroke(trench); }
  const sc = Math.min(290 / Math.max(1, stackH(s1)), 120 / maxD(s1)), drop = (1 - ez(seg(t, 0.3, 5))) * -300;
  for (const sx of [cx - 95, cx + 95]) box(sx - 8, 20, 16, 322, 'steel'); for (const yy of [30, 105, 180, 255, 320]) box(cx - 105, yy, 210, 9, 'steel', { v: true });
  const ign = seg(t, 19, 21.5), off = seg(t, 40, 41.5), I = ign * (1 - off);
  const sh = ship(s1, cx, 372 + drop, sc, { frost: seg(t, 14, 18) * (1 - seg(t, 42, 47)) });
  if (drop < -5) crane(cx, 0, sh.top - 20);
  box(cx + 120, 120, 50, 190, 'white'); pipe([[cx + 120, 280], [cx + 40, 270]], 6, 'steel'); tag(cx + 145, 130, cx + 240, 80, '추진제 공급 탱크', seg(t, 7, 8) * (1 - seg(t, 13, 14)));
  if (t >= 7 && t < 14) { g.save(); g.strokeStyle = real() ? 'rgba(80,150,255,.9)' : `rgba(${HOL},.9)`; g.lineWidth = 3; g.setLineDash([8, 8]); g.lineDashOffset = -t * 60; g.beginPath(); g.moveTo(cx + 120, 276); g.lineTo(cx + 40, 266); g.lineTo(cx + 10, base); g.stroke(); g.restore(); sh.exits.forEach(([x1, y1]) => cloud(81 + x1, x1, y1, t, 10, 13.5, { n: 10, life: 2, speed: 25, ang: Math.PI / 2, r0: 4, grow: 8, a: 0.3, shade: false })); panel(700, 40, 270, [['흘린 시간', `${nf((t - 7) * 3, 1)} s`], ['밸브 순서', t > 12 ? '정상' : '확인 중', t > 12 ? '#5dff9e' : null]], '종합 수류 시험'); }
  cloud(83, cx + 40, 120, t, 14, 22, { n: 30, life: 4, speed: 16, ang: -1.6, spread: 1, r0: 5, grow: 12, a: 0.4, wind: 10 });
  sh.exits.forEach(([x1, y1, r1, fu], i) => { const Ii = seg(t, 19 + i * 0.25, 21 + i * 0.25) * (1 - off); plume(x1, y1, Math.PI / 2, 30, Math.max(3, r1), t, fu, { I: Ii, diamonds: false }); });
  const fu0 = (sh.exits[0] || [0, 0, 0, 'kerolox'])[3]; plume(cx + 10, 378, 0.42, 340, 22, t, fu0, { I: I * 0.5, spread: 2.2, diamonds: false }); plume(620, 395, 0.3, 300, 40, t, fu0, { I: I * 0.4, spread: 2.6, diamonds: false });
  if (t > 19) { jets(cx + 60, 360, 0.5, 110, 5, t, 0.5 * I); jets(cx + 160, 372, 0.5, 120, 4, t, 0.45 * I); }
  cloud(85, 660, 405, t, 19.5, 41, { n: 150, life: 12, speed: 120, ang: -0.3, spread: 1.3, r0: 34, grow: 38, a: 0.65, rise: 4, wind: 16, floor: 560 });
  cloud(87, 600, 390, t, 20, 41, { n: 70, life: 10, speed: 70, ang: -1.25, spread: 0.9, r0: 28, grow: 30, a: 0.5, rise: 5, wind: 8 });
  const Tt = t < 21 ? 0 : Math.min(127, (t - 21) * 127 / 19), nE = c.nEng, thr = sh.exits.length ? (THR[c.engId] || 75) * nE : 0;
  if (t >= 19) panel(700, 40, 270, [['시간', `T+ ${nf(Tt, 0)} s`], ['단 추력', `${nf(thr * I, 0)} tf`], ['엔진', `${nE}기 · ${engName(c.engId)}`], ['상태', off > 0.5 ? '연소 종료' : '정상', '#5dff9e']], '1단 종합연소시험');
  if (t >= 19) graph(700, 160, 270, 110, [{ f: tt => thr * seg(tt, 0, 2) * (1 - seg(tt, 19, 20.5)), max: Math.max(1, thr * 1.2), col: '#ffc24a', label: '단 추력' }], t - 19, 26, '추력 기록');
  if (t >= 42) { check(720, 300, true, seg(t, 42.5, 43)); big('비행 시간만큼 연소 성공', 860, 302, 15, '#5dff9e', seg(t, 42.5, 43)); }
 } });

// 7. 단열재 시험
reg({ id: 'tpstest', cat: 'test', name: '단열재 시험', desc: '아크젯 플라즈마 가열 · 극저온 충전', dur: 36, opts: ['tps'],
 steps: [[0, '시편 준비', '단열재 시편 뒷면에 온도 센서(열전대)를 붙여요.'], [5, '진공 챔버', '시편을 챔버에 넣고 공기를 빼서 높은 하늘처럼 만들어요.'], [9, '아크젯 가열', '전기 아크로 기체를 수천 도로 달군 플라즈마를 시편에 쏘아 재진입 때와 같은 열을 만들어요.'], [22, '결과 확인', '겉면이 아주 뜨거워도 뒷면이 얼마나 차갑게 유지되는지 봐요. 삭마재는 얼마나 깎였는지도 재요.'], [28, '극저온 시험', '반대로 액체질소를 채운 탱크에 붙여 서리·균열·들뜸이 없는지 확인해요.']],
 draw(t, c) {
  bg('lab'); const T = c.tps, C = CARD[T] || {}, tk = c.tpsT || C.tdef || 20, Tmax = Math.min(C.tT ? C.tT * 1.05 : 1400, 1650), heat = seg(t, 9.5, 12) * (1 - seg(t, 21, 22)), Ts = 20 + (Tmax - 20) * heat, back = 20 + (Ts - 20) * Math.exp(-tk / 12) * seg(t, 11, 21);
  if (t < 28) {
   box(150, 120, 500, 300, 'steel'); const win = new Path2D(); win.rect(190, 160, 420, 220); g.save(); g.clip(win); g.fillStyle = real() ? '#0c0f13' : 'rgba(5,15,28,.6)'; g.fillRect(190, 160, 420, 220);
   const cxp = 480, cyp = 270; box(cxp + 20, cyp - 70, 40, 140, 'steel'); const coupon = box(cxp, cyp - 60, 22, 120, T, { v: true }); box(cxp - 120 - 70 + (t < 5 ? -200 * (1 - seg(t, 0, 3)) : 0), cyp - 34, 90, 68, 'steel');
   if (heat > 0) { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createLinearGradient(cxp - 100, 0, cxp, 0); gr.addColorStop(0, `rgba(255,240,255,${0.95 * heat})`); gr.addColorStop(0.5, `rgba(200,120,255,${0.7 * heat})`); gr.addColorStop(1, `rgba(150,90,255,${0.4 * heat})`); g.fillStyle = gr; g.beginPath(); g.moveTo(cxp - 100, cyp - 14); g.quadraticCurveTo(cxp - 50, cyp - 30 - 4 * Math.sin(t * 40), cxp, cyp - 56); g.lineTo(cxp, cyp + 56); g.quadraticCurveTo(cxp - 50, cyp + 30, cxp - 100, cyp + 14); g.fill(); g.restore(); spr('violet', cxp, cyp, 70, heat, true);
    const hc = bb(Ts); if (hc) { g.save(); g.clip(coupon); g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(${hc[0]},${hc[1]},${hc[2]},${hc[3]})`; g.fillRect(cxp, cyp - 60, 10, 120); g.restore(); } if (C.abl) cloud(91, cxp - 4, cyp, t, 11, 21, { n: 40, life: 2.5, speed: 40, ang: Math.PI + 0.3, spread: 1.6, r0: 4, grow: 10, a: 0.3, spr: 'grey' }); }
   g.restore(); if (real()) { g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; g.stroke(win); }
   if (t < 5) tag(cxp + 22, cyp + 30, cxp + 140, cyp + 170, '뒷면 열전대', seg(t, 1, 2)); tag(cxp, cyp - 60, cxp + 60, 90, `${C.name || '단열재'} 시편 · ${nf(tk, 0)} mm`); tag(cxp - 160, cyp, 230, 460, '아크젯 토치', seg(t, 9, 10));
   if (t >= 5) panel(700, 40, 270, [['챔버 압력', `${t < 9 ? nf(1013 * (1 - seg(t, 5, 8.5)) + 5, 0) : '5'} mbar`], ['겉면 온도', `${Math.round(Ts)} °C`, Ts > (C.tT || 1e9) ? '#ff5d73' : null], ['뒷면 온도', `${Math.round(back)} °C`, '#5dff9e'], ['재료 한계', C.tT ? `${C.tT} °C` : '—']], '아크젯 시험');
   if (t >= 9) graph(700, 170, 270, 130, [{ f: tt => 20 + (Tmax - 20) * seg(tt, 0.5, 3) * (1 - seg(tt, 12, 13)), max: 1700, col: '#ff9d5c', label: '겉면 / 뒷면' }, { f: tt => 20 + (Tmax - 20) * seg(tt, 0.5, 3) * (1 - seg(tt, 12, 13)) * Math.exp(-tk / 12) * seg(tt, 2, 12), max: 1700, col: '#5dff9e', label: '' }], t - 9, 18, '온도 기록');
   if (t >= 22) { check(720, 330, true, seg(t, 22.5, 23)); big(C.abl ? `깎인 두께 ${nf(tk * 0.12, 1)} mm` : '뒷면 온도 기준 통과', 850, 332, 14, '#5dff9e', seg(t, 22.5, 23)); }
   return;
  }
  const p = seg(t, 28.3, 35), cx = 450; revV(cx, 140, 280, () => 120, T, { rings: real() ? 0 : 6 }); box(cx - 160, 420, 320, 50, 'dark', { v: true });
  g.save(); g.globalAlpha = 0.7 * p; g.fillStyle = 'rgba(240,248,255,1)'; g.fillRect(cx - 120, 420 - 280 * p, 240, 280 * p); g.restore(); cloud(93, cx, 140, t, 28.3, 36, { n: 40, life: 4, speed: 20, ang: -1.57, spread: 1.2, r0: 6, grow: 14, a: 0.45 });
  pipe([[cx + 220, 470], [cx + 220, 160], [cx + 60, 150]], 8, 'steel'); panel(700, 60, 270, [['안쪽 온도', `${Math.round(20 - 216 * seg(p, 0, 0.6))} °C`], ['균열', p > 0.9 ? '없음' : '확인 중', p > 0.9 ? '#5dff9e' : null], ['들뜸', p > 0.9 ? '없음' : '확인 중', p > 0.9 ? '#5dff9e' : null]], '극저온 시험 (액체질소)'); tag(cx + 120, 300, cx + 220, 360, '단열재 겉면의 서리');
 } });

// 8. 진동·음향 시험
reg({ id: 'vibtest', cat: 'test', name: '진동·음향 시험', desc: '가진기 사인 스윕 · 랜덤 진동 · 음향실', dur: 28,
 steps: [[0, '가진기에 고정', '부품을 가진기(진동대) 위에 단단히 고정하고 가속도계를 붙여요.'], [5, '사인 스윕', '5 Hz에서 100 Hz까지 천천히 올리며 크게 흔들리는 진동수(공진)를 찾아요.'], [15, '랜덤 진동', '발사 때처럼 여러 진동수가 섞인 진동을 줘서 견디는지 봐요.'], [21, '음향 시험', '커다란 스피커가 있는 방에서 140 dB가 넘는 소리를 들려줘요. 페어링 안 위성은 소리로도 흔들려요.']],
 draw(t, c) {
  bg('lab'); const part = c.sel || c.parts[c.parts.length > 1 ? 1 : 0], cx = 420;
  if (t < 21) {
   const f = t < 5 ? 0 : t < 15 ? 5 + 95 * seg(t, 5, 15) : 0, res = Math.exp(-(((f - 38) / 6) ** 2)), amp = t < 5 ? 0 : t < 15 ? 2 + 14 * res : 5 * (Math.sin(t * 37) * 0.6 + Math.sin(t * 91) * 0.4 + Math.sin(t * 13) * 0.3), dy = t < 15 ? amp * Math.sin(t * (6 + f * 0.9)) : amp;
   box(cx - 170, 400, 340, 70, 'dark'); box(cx - 140, 380 + dy * 0.3, 280, 22, 'steel', { v: true });
   const sc = Math.min(260 / part.shape.h, 220 / (maxR(part.shape) * 2)), h = part.shape.h * sc; g.save(); g.translate(0, dy); revV(cx, 380 - h, h, u => rfOf(part.shape, sc)(1 - u), partMat(part), { rings: real() ? 0 : 5 }); box(cx + maxR(part.shape) * sc * 0.6, 380 - h * 0.6, 12, 12, 'blue'); g.restore();
   tag(cx + maxR(part.shape) * sc * 0.6 + 12, 380 - h * 0.6 + dy, cx + 260, 380 - h * 0.6 - 40, '가속도계', seg(t, 1, 2));
   panel(700, 40, 270, [['진동수', t < 15 ? `${nf(f, 0)} Hz` : '20~2000 Hz'], ['입력', '0.25 g'], ['응답', `${nf(Math.abs(amp) / 6, 2)} g`, res > 0.6 ? '#ffc24a' : null], ['공진', t > 10 ? '38 Hz' : '찾는 중']], t < 15 ? '사인 스윕' : '랜덤 진동');
   graph(700, 170, 270, 120, [{ f: tt => tt < 10 ? (2 + 14 * Math.exp(-((((5 + 9.5 * tt) - 38) / 6) ** 2))) : 5 + 2 * Math.sin(tt * 9), max: 18, col: '#7fe9ff', label: '응답' }], t - 5, 16, '응답 기록');
   return;
  }
  const p = seg(t, 21, 27.5); box(80, 60, 840, 410, 'wall', { v: true }); for (const sx of [130, 870]) { box(sx - 30, 120, 60, 260, 'dark'); for (let k = 0; k < 3; k++) circle(sx, 160 + k * 90, 24, 'rubber'); }
  const sc = Math.min(260 / part.shape.h, 200 / (maxR(part.shape) * 2)), h = part.shape.h * sc; revV(500, 420 - h, h, u => rfOf(part.shape, sc)(1 - u), partMat(part), { rings: real() ? 0 : 5 });
  g.save(); for (let k = 0; k < 6; k++) { const r = ((t * 120 + k * 60) % 360); g.strokeStyle = real() ? `rgba(255,255,255,${0.25 * (1 - r / 360)})` : `rgba(${HOL},${0.5 * (1 - r / 360)})`; g.lineWidth = 2; for (const sx of [160, 840]) { g.beginPath(); g.arc(sx, 250, r, sx < 500 ? -0.5 : Math.PI - 0.5, sx < 500 ? 0.5 : Math.PI + 0.5); g.stroke(); } } g.restore();
  panel(700, 70, 200, [['소리 크기', `${Math.round(100 + 42 * ez(p))} dB`], ['시간', `${nf(p * 60, 0)} s`]], '음향 시험');
 } });

// 9. 발사
reg({ id: 'launch', cat: 'test', name: '이송·기립·발사', desc: '발사대로 옮겨 세우고 충전한 뒤 발사', dur: 44, opts: ['ship'],
 steps: [[0, '발사대 이송', '무인 특수 차량(트랜스포터)이 눕힌 기체를 시속 몇 km로 아주 천천히 발사대까지 옮겨요.'], [8, '기립', '이렉터가 기체를 세워 발사대에 고정하고, 엄빌리컬(탯줄) 타워를 연결해요.'], [15, '추진제 충전', '연료와 액체산소를 채워요. 극저온 산화제 때문에 하얀 김이 피어올라요.'], [22, '카운트다운·점화', '엄빌리컬을 떼고 엔진이 점화돼요. 추력이 무게보다 커지면 고정 장치가 풀려요.'], [26, '이륙', '불꽃과 수증기를 뿜으며 하늘로 올라가요.'], [35, '상승', '점점 빨라지고 조금씩 기울며 궤도로 향해요.']],
 draw(t, c) {
  const P = c.parts, H = stackH(P), sc = Math.min(330 / H, 70 / maxD(P)), lift = t < 26 ? 0 : Math.pow(t - 26, 2) * 2.2, cam = Math.max(0, lift - 140);
  g.save(); g.translate(0, cam); bg('day', { sea: 360, floor: 470 }); if (cam > 0) { if (real()) { const sk = g.createLinearGradient(0, -2600, 0, 0); sk.addColorStop(0, '#02040a'); sk.addColorStop(0.6, '#1d3f6e'); sk.addColorStop(1, '#5f97cf'); g.fillStyle = sk; } else g.fillStyle = '#04101d'; g.fillRect(0, -cam - 2, VW, cam + 2); }
  const padX = 560, padY = 430; box(padX - 120, padY, 240, 40, 'concrete', { v: true }); poly([[padX - 60, padY + 40], [padX + 60, padY + 40], [padX + 260, 470 + 10], [padX - 40, 470 + 10]], 'concrete', { lum: 0.6, v: true });
  box(padX + 70, padY - 350, 26, 350, 'red'); for (let k = 0; k < 8; k++) line([[padX + 70, padY - k * 44], [padX + 96, padY - k * 44 - 44]], real() ? 'rgba(0,0,0,.4)' : `rgba(${HOL},.4)`, 1);
  const um = t < 22 ? 1 : 1 - ez(seg(t, 22, 23.5)); if (t >= 12) for (const k of [0.3, 0.6, 0.85]) box(padX + 70 - 50 * um, padY - H * sc * k, 50 * um, 6, 'steel', { v: true });
  const ang = t < 8 ? Math.PI / 2 : t < 15 ? (Math.PI / 2) * (1 - ez(seg(t, 8.5, 14.5))) : 0, tx = t < 8 ? lerp(-200, padX - 20, ez(seg(t, 0, 7.5))) : padX - 20, pitch = t > 35 ? 0.25 * ez(seg(t, 35, 44)) : 0;
  if (t < 15) { box(tx - 200, padY - 6, 380, 26, 'yellow', { v: true }); for (let k = 0; k < 6; k++) circle(tx - 180 + k * 70, padY + 26, 13, 'rubber'); }
  const shipX = t < 8 ? tx + 20 : padX, shipY = padY - lift - (t < 15 ? maxD(P) * sc / 2 * Math.sin(ang) + 4 : 0); g.save(); g.translate(shipX, shipY); g.rotate(ang + pitch); const sh = ship(P, 0, 0, sc, { frost: seg(t, 15, 21), hot: 0, legsUp: t < 15 }); g.restore();
  if (t < 15 && t >= 8) pipe([[padX - 80, padY], [padX - 30, padY - H * sc * 0.5 * Math.cos(ang)]], 12, 'yellow');
  cloud(101, padX + 10, padY - H * sc * 0.6, t, 15, 24, { n: 40, life: 4, speed: 18, ang: 0.2, spread: 1.2, r0: 6, grow: 14, a: 0.4, wind: 12 });
  const ign = seg(t, 23.5, 25), I = ign; if (t >= 23.5) { sh.exits.forEach(([x1, y1, r1, fu]) => plume(padX + x1, padY - lift + y1, Math.PI / 2 + pitch, 140 + lift * 0.3, Math.max(3, r1), t, fu, { I })); }
  cloud(103, padX + 120, 470, t, 23.6, 40, { n: 120, life: 10, speed: 120, ang: -0.15, spread: 1.0, r0: 30, grow: 34, a: 0.6, rise: 2, wind: 10, floor: 480 });
  cloud(105, padX - 120, 470, t, 23.6, 34, { n: 60, life: 9, speed: 90, ang: Math.PI + 0.15, spread: 0.8, r0: 26, grow: 30, a: 0.5, rise: 2, wind: -6, floor: 480 });
  lightUp(padX, padY - lift + 40, 260, I * (t < 34 ? 1 : 0.6));
  g.restore();
  big(t >= 18 && t < 23.5 ? `T−${Math.ceil(23.5 - t)}` : '', 820, 90, 44, '#ffc24a'); if (t >= 26) panel(700, 40, 270, [['시간', `T+ ${nf(t - 23.5, 1)} s`], ['고도', `${nf(lift * 2.2, 0)} m`], ['속도', `${nf((t - 26) * 4.4 * 3.6 * 2.2 / 2, 0)} km/h`]], '비행');
 } });

/* ---------- 화면(영상관) ---------- */
function ctxNow() {
 const sel = ep() || cur(), parts = V.opt.ship === 'ss' ? EX.ss() : V.opt.ship === 'f9' ? EX.f9() : (S.parts.length ? S.parts : EX.f9());
 const ebAll = parts.find(p => p.role === 'engbay' && p.engines.length), selEng = sel && sel.engines && sel.engines[0];
 const liquid = id => CARD[id] && CARD[id].cat === 'en' && CARD[id].fuel !== 'solid';
 let eng = V.opt.eng || (liquid(selEng) ? selEng : ebAll && liquid(ebAll.engines[0]) ? ebAll.engines[0] : 'merlin');
 const tps = V.opt.tps || (sel && sel.tps) || (parts.find(p => p.tps) || {}).tps || 'foam', tpsPart = (sel && sel.tps === tps ? sel : parts.find(p => p.tps === tps));
 const matP = sel && sel.role === 'tank' ? sel : parts.find(p => p.role === 'tank') || sel, eb0 = parts[0] && parts[0].role === 'engbay' ? parts[0] : null;
 return { sel, parts, eng, tps, tpsT: tpsPart ? tpsPart.tpsT : (CARD[tps] && CARD[tps].tdef) || 25, mat: matP ? matP.mat : M_('al2195'), meop: matP ? matP.meop : 3, nEng: eb0 ? eb0.engines.length : 0, engId: eb0 && eb0.engines[0] };
}
const stepsOf = sc => typeof sc.steps === 'function' ? sc.steps(V.c) : sc.steps;
const txt = v => typeof v === 'function' ? v(V.c) : v;
function curStep(sc, t) { const st = stepsOf(sc); let i = 0; st.forEach((s, k) => { if (t >= s[0] - 1e-6) i = k; }); return i; }
function build() {
 if ($('#studio')) return; const el = document.createElement('div'); el.id = 'studio'; el.className = 'studio'; el.hidden = true; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', '제작·시험 영상관');
 el.innerHTML = `<div class="st-head"><b>제작·시험 영상관</b><span>로켓을 만들고 시험하는 과정을 단계별 애니메이션으로 봐요 · 지금 고른 부품과 내 기체가 나와요</span><button class="b" id="stClose">닫기</button></div>
 <div class="st-body"><nav class="st-list" id="stList" aria-label="장면 목록"></nav>
 <div class="st-main"><div class="st-cvw"><canvas id="stCv"></canvas></div>
 <div class="st-cap" id="stCap"></div>
 <div class="st-bar"><div class="st-ticks" id="stTicks"></div><input type="range" id="stSeek" min="0" max="1000" value="0" aria-label="재생 위치"></div>
 <div class="st-ctl"><button class="b" data-sv="start">처음</button><button class="b" data-sv="prev">이전 단계</button><button class="b hot" data-sv="play" id="stPlay">일시정지</button><button class="b" data-sv="next">다음 단계</button><label class="st-sp">속도 <select id="stSpeed"><option value="0.5">0.5배</option><option value="1" selected>1배</option><option value="2">2배</option><option value="4">4배</option></select></label><span class="st-time" id="stTime"></span><span class="st-opts" id="stOpts"></span></div></div></div>`;
 document.body.appendChild(el); cvS = $('#stCv'); g = cvS.getContext('2d');
 $('#stClose').onclick = closeStudio;
 el.addEventListener('click', e => { const b = e.target.closest('[data-sv]'); if (b) { const v = b.dataset.sv, sc = V.sc, st = stepsOf(sc), i = curStep(sc, V.t);
   if (v === 'play') { if (V.t >= sc.dur - 0.01) V.t = 0; V.play = !V.play; } else if (v === 'start') { V.t = 0; V.play = true; } else if (v === 'prev') V.t = st[Math.max(0, V.t - st[i][0] > 1.2 ? i : i - 1)][0]; else if (v === 'next') V.t = i + 1 < st.length ? st[i + 1][0] : sc.dur; ui(); }
  const s = e.target.closest('[data-scene]'); if (s) openScene(s.dataset.scene); const tk = e.target.closest('[data-tick]'); if (tk) { V.t = +tk.dataset.tick; ui(); } });
 $('#stSeek').addEventListener('input', e => { V.t = V.sc.dur * e.target.value / 1000; V.play = false; ui(); });
 $('#stSpeed').onchange = e => { V.speed = +e.target.value; };
 $('#stOpts').addEventListener('change', e => { const s = e.target.closest('[data-opt]'); if (!s) return; V.opt[s.dataset.opt] = s.value; V.c = ctxNow(); ui(true); });
 document.addEventListener('keydown', e => { if (!V.open || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return; if (e.key === 'Escape') closeStudio(); else if (e.key === ' ') { e.preventDefault(); $('#stPlay').click(); } else if (e.key === 'ArrowRight') el.querySelector('[data-sv="next"]').click(); else if (e.key === 'ArrowLeft') el.querySelector('[data-sv="prev"]').click(); else return; e.stopPropagation(); }, true);
 new ResizeObserver(fit).observe($('.st-cvw'));
}
function fit() { const w = cvS.parentNode.clientWidth, h = cvS.parentNode.clientHeight, d = Math.min(2, devicePixelRatio || 1); cvS.width = Math.max(1, Math.round(w * d)); cvS.height = Math.max(1, Math.round(h * d)); cvS.style.width = w + 'px'; cvS.style.height = h + 'px'; V.dpr = d; V.k = Math.min(w / VW, h / VH); V.ox = (w - VW * V.k) / 2; V.oy = (h - VH * V.k) / 2; }
function renderList() {
 const grp = (cat, title) => `<h4>${title}</h4>` + SCENES.filter(s => s.cat === cat).map(s => `<button class="st-item ${V.sc && V.sc.id === s.id ? 'on' : ''}" data-scene="${esc(s.id)}"><b>${esc(s.name)}</b><small>${esc(s.desc || '')}</small></button>`).join('');
 $('#stList').innerHTML = grp('make', '만들기') + grp('test', '시험하기') + (SCENES.some(s => s.cat !== 'make' && s.cat !== 'test') ? grp('ext', '확장') : '');
}
function optHtml(sc) {
 const o = sc.opts || [], c = V.c, sel = (k, items, cur) => `<label>${{ eng: '엔진', tps: '단열재', ship: '기체' }[k]} <select data-opt="${k}">${items.map(([v, n]) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
 return o.map(k => k === 'eng' ? sel('eng', Object.values(CARD).filter(q => q.cat === 'en' && q.fuel !== 'solid').map(q => [q.id, q.name]), c.eng) : k === 'tps' ? sel('tps', Object.values(CARD).filter(q => q.cat === 'tp').map(q => [q.id, q.name]), c.tps) : k === 'ship' ? sel('ship', [['mine', S.parts.length ? '내 기체' : '내 기체(비어 있어 예시)'], ['ss', '스타십형 예시'], ['f9', '팔콘형 예시']], V.opt.ship || 'mine') : '').join('');
}
function ui(full) {
 const sc = V.sc; if (!sc) return; const st = stepsOf(sc), i = curStep(sc, V.t), s = st[i];
 $('#stCap').innerHTML = `<span class="st-n">${i + 1} / ${st.length}</span><b>${esc(txt(s[1]))}</b><p>${esc(txt(s[2]))}</p>`;
 $('#stSeek').value = Math.round(V.t / sc.dur * 1000); $('#stTime').textContent = `${nf(V.t, 0)} / ${sc.dur} s`; $('#stPlay').textContent = V.play ? '일시정지' : V.t >= sc.dur - 0.01 ? '다시 보기' : '재생';
 if (full || ui.last !== sc.id + '|' + st.length) { $('#stTicks').innerHTML = st.map((q, k) => `<button class="st-tick ${k === i ? 'on' : ''}" data-tick="${q[0]}" style="left:${q[0] / sc.dur * 100}%" title="${esc(txt(q[1]))}" aria-label="${k + 1}단계: ${esc(txt(q[1]))}"></button>`).join(''); $('#stOpts').innerHTML = optHtml(sc); ui.last = sc.id + '|' + st.length; }
 else $('#stTicks').querySelectorAll('.st-tick').forEach((b, k) => b.classList.toggle('on', k === i));
}
function openScene(id) { const sc = SCENES.find(s => s.id === id) || SCENES[0]; V.sc = sc; V.t = 0; V.play = true; V.c = ctxNow(); renderList(); ui(true); }
function frameS(now) {
 if (!V.open) return; const dt = V.last ? Math.min(0.1, (now - V.last) / 1000) : 0; V.last = now; const sc = V.sc;
 if (V.play && !RM) { V.t = Math.min(sc.dur, V.t + dt * V.speed); if (V.t >= sc.dur) V.play = false; } else if (V.play && RM) { V.t = Math.min(sc.dur, V.t + dt * V.speed); }
 const d = V.dpr; g.setTransform(d, 0, 0, d, 0, 0); g.fillStyle = '#02060c'; g.fillRect(0, 0, cvS.width, cvS.height); g.setTransform(d * V.k, 0, 0, d * V.k, d * V.ox, d * V.oy); g.save(); g.beginPath(); g.rect(0, 0, VW, VH); g.clip();
 try { sc.draw(V.t, V.c, { g, real: real(), VW, VH }); } catch (e) { console.error('[영상관 그리기 오류]', sc.id, e); }
 g.restore(); if (Math.floor(now / 120) !== frameS.tk) { frameS.tk = Math.floor(now / 120); ui(); }
 V.raf = requestAnimationFrame(frameS);
}
function openStudio(id) { build(); V.open = true; $('#studio').hidden = false; document.body.classList.add('studio-open'); fit(); openScene(id || (V.sc && V.sc.id) || SCENES[0].id); V.last = 0; cancelAnimationFrame(V.raf); V.raf = requestAnimationFrame(frameS); $('#stClose').focus(); }
function closeStudio() { V.open = false; cancelAnimationFrame(V.raf); $('#studio').hidden = true; document.body.classList.remove('studio-open'); const b = $('#studioBtn'); if (b) b.focus(); }

const btn = $('#studioBtn'); if (btn) btn.onclick = () => openStudio();
// 부품 편집 패널에 바로가기
HOLO.registerPanel({ id: 'studio', title: '제작·시험 영상', html: p => { const L = [['tank', '탱크 제작 과정', p.role === 'tank'], ['tps', '단열재 붙이는 과정', !!p.tps], ['engmake', '엔진 제작 과정', p.role === 'engbay' && p.engines.length], ['engtest', '엔진 연소시험', p.role === 'engbay' && p.engines.length], ['tpstest', '단열재 시험', !!p.tps], ['vibtest', '진동·음향 시험', true], ['assembly', '단 조립 과정', true]].filter(q => q[2]); return `<div class="tb">${L.map(q => `<button class="b" data-studio="${q[0]}">${q[1]}</button>`).join('')}</div>`; }, bind: el => el.addEventListener('click', e => { const b = e.target.closest('[data-studio]'); if (b) openStudio(b.dataset.studio); }) });
HOLO.registerScene = def => { if (!def || !def.id || !def.name || typeof def.draw !== 'function' || !def.dur || !def.steps) throw new Error('registerScene: id, name, dur, steps, draw가 필요해요'); reg(Object.assign({ cat: 'ext' }, def)); };
HOLO.openStudio = openStudio;
HOLO.studio = { box, poly, circle, revV, revH, pipe, line, engine, ship, plume, cloud, sparks, jets, bg, tag, panel, graph, big, check, crane, dial, seg, ez, lerp, hs, VW, VH };
})();
