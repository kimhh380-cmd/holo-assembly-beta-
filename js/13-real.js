/* 13-real.js — 실제 모드: 부품을 실제 모습(입체·광택·질감)으로 그림. 재질(p.mat)과 단열재(p.tps)에 따라 색·광택·무늬가 달라짐
   홀로그램/실제 전환은 머리의 [홀로그램 | 실제] 버튼. LOOK('holo' | 'real')은 01-data.js에 있고 localStorage 'holo.look'에 저장
   모든 js 파일은 같은 전역 공간을 공유하는 일반 <script>입니다. 순서대로 로드되고, 마지막 99-boot.js가 앱을 시작합니다. */
/* ---------- 보기 전환 ---------- */
function setLook(v) {
 LOOK = v === 'real' ? 'real' : 'holo'; try { localStorage.setItem('holo.look', LOOK); } catch (e) { /* 저장 못 해도 계속 */ }
 document.body.classList.toggle('real', LOOK === 'real');
 document.querySelectorAll('[data-look]').forEach(b => { const on = b.dataset.look === LOOK; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
}
document.addEventListener('click', e => { const b = e.target.closest('[data-look]'); if (!b) return; setLook(b.dataset.look); renderDeck(); changed(); toast(LOOK === 'real' ? '실제 모습으로 보여요 · 재질과 단열재에 따라 색과 질감이 달라져요' : '홀로그램으로 보여요'); });
setLook(LOOK);

/* ---------- 재질 → 겉모습 ---------- */
// alb: 반사색(선형), metal: 금속 정도(0~1), rough: 거칠기(0 매끈 ~ 1 무광), tex: 표면 무늬
const lin = c => c.map(v => Math.pow(v, 2.2));
const hexLin = h => { const n = parseInt(String(h).replace('#', '').padEnd(6, '0').slice(0, 6), 16); return lin([(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]); };
const RMAT = {
 ss304: { alb: lin([0.78, 0.78, 0.80]), metal: 1, rough: 0.24, tex: 'steel' },
 ss301: { alb: lin([0.83, 0.83, 0.85]), metal: 1, rough: 0.17, tex: 'steel' },
 al2195: { alb: lin([0.86, 0.87, 0.88]), metal: 1, rough: 0.48, tex: 'alu' },
 al2219: { alb: lin([0.80, 0.80, 0.76]), metal: 1, rough: 0.56, tex: 'alu' },
 al7075: { alb: lin([0.88, 0.89, 0.92]), metal: 1, rough: 0.38, tex: 'alu' },
 ti64: { alb: lin([0.58, 0.55, 0.52]), metal: 1, rough: 0.36, tex: 'ti' },
 in718: { alb: lin([0.66, 0.62, 0.54]), metal: 1, rough: 0.42, tex: 'ti' },
 cfrp: { alb: lin([0.10, 0.10, 0.11]), metal: 0, rough: 0.26, tex: 'weave' },
 st4130: { alb: lin([0.42, 0.44, 0.48]), metal: 1, rough: 0.5, tex: 'alu' },
};
const RTPS = {
 hex: { alb: lin([0.07, 0.07, 0.08]), metal: 0, rough: 0.45, tex: 'hex' },
 pica: { alb: lin([0.30, 0.21, 0.14]), metal: 0, rough: 0.95, tex: 'blocks' },
 cork: { alb: lin([0.66, 0.47, 0.30]), metal: 0, rough: 0.9, tex: 'speck' },
 blanket: { alb: lin([0.86, 0.84, 0.78]), metal: 0, rough: 0.88, tex: 'quilt' },
 foam: { alb: lin([0.88, 0.45, 0.14]), metal: 0, rough: 0.8, tex: 'mottle' },
 mli: { alb: lin([1.0, 0.78, 0.36]), metal: 1, rough: 0.22, tex: 'crinkle' },
 rcc: { alb: lin([0.22, 0.23, 0.25]), metal: 0, rough: 0.55, tex: 'weave' },
};
const PAT_TEX = { hex: 'hex', speck: 'speck', dots: 'speck', quilt: 'quilt', none: 'mottle', sheen: 'crinkle', weave: 'weave' };
function rmatOf(m) {
 if (!m) return RMAT.al2219; if (RMAT[m.id]) return RMAT[m.id];
 const base = Object.keys(RMAT).find(k => m.name && m.name.startsWith(MATS[k].name)); if (base) return RMAT[base];
 let best = 'al2219', bd = 1e9; for (const k in RMAT) { const d = Math.abs(MATS[k].rho - (m.rho || 2800)); if (d < bd) { bd = d; best = k; } } return RMAT[best]; // 직접 만든 재질은 밀도가 가장 가까운 재질처럼
}
function rtpsOf(id) { if (RTPS[id]) return RTPS[id]; const c = CARD[id]; if (!c) return null; return { alb: hexLin(c.col || '#888888'), metal: c.pat === 'sheen' ? 1 : 0, rough: c.pat === 'sheen' ? 0.25 : 0.75, tex: PAT_TEX[c.pat] || 'mottle' }; }
// 엔진 노즐: 엔진마다 다른 재질(구리 재생냉각, 니오븀 연장부, 검은 노즐, 탄소 복합재)
const NOZ_OF = { raptor: 'copper', raptorvac: 'niobium', merlin: 'dark', mvac: 'niobium', rs25: 'copper', rl10: 'dark', be4: 'copper', srb: 'carbon' };
const NOZ_FUEL = { methalox: 'copper', kerolox: 'dark', hydrolox: 'copper', hyper: 'niobium', solid: 'carbon' };
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const NOZ = {
 copper: u => ({ alb: mix3(lin([0.88, 0.52, 0.34]), lin([0.32, 0.22, 0.22]), Math.max(0, 0.75 - u) * 0.7), metal: 1, rough: 0.3 }),
 niobium: u => ({ alb: mix3(lin([0.44, 0.44, 0.49]), lin([0.55, 0.42, 0.64]), Math.exp(-(((u - 0.82) / 0.1) ** 2)) * 0.9), metal: 1, rough: 0.34 }),
 dark: () => ({ alb: lin([0.13, 0.13, 0.14]), metal: 0.4, rough: 0.48 }),
 carbon: () => ({ alb: lin([0.16, 0.16, 0.17]), metal: 0, rough: 0.6 }),
};
// 엔진 모양: Grok 홀로그램 그림의 윤곽을 잰 값. asp = 전체 길이/출구 반지름, b = 노즐 반지름(목→출구, 출구 = 1), h = 연소실·파워헤드 반지름(위→목, 출구 대비), hf = 전체 길이 중 머리 비율
const ENG_SHAPE = {"raptor":{"asp":4.2,"b":[0.23,0.423,0.571,0.675,0.775,0.849,0.923,0.977,1.0],"h":[0.0,0.347,0.337,0.328,0.27,0.27,0.23],"hf":0.358},"raptorvac":{"asp":3.66,"b":[0.298,0.427,0.534,0.64,0.732,0.81,0.876,0.942,1.0],"h":[0.597,0.597,0.597,0.597,0.44,0.419,0.298],"hf":0.317},"merlin":{"asp":2.8,"b":[0.301,0.428,0.51,0.619,0.724,0.815,0.889,0.951,1.0],"h":[0.0,0.288,0.378,0.396,0.362,0.308,0.301],"hf":0.291},"mvac":{"asp":3.27,"b":[0.272,0.434,0.563,0.67,0.767,0.849,0.913,0.965,1.0],"h":[0.0,0.187,0.205,0.187,0.217,0.246,0.272],"hf":0.242},"rs25":{"asp":3.4,"b":[0.494,0.529,0.569,0.642,0.731,0.812,0.883,0.948,1.0],"h":[0.338,0.338,0.338,0.338,0.383,0.437,0.494],"hf":0.389},"rl10":{"asp":3.5,"b":[0.203,0.373,0.493,0.602,0.695,0.779,0.857,0.938,1.0],"h":[0.338,0.338,0.473,0.405,0.459,0.215,0.203],"hf":0.321},"be4":{"asp":4.3,"b":[0.361,0.417,0.494,0.606,0.701,0.789,0.869,0.943,1.0],"h":[0.0,0.492,0.492,0.492,0.492,0.429,0.361],"hf":0.431},"srb":{"asp":3.0,"b":[0.735,0.678,0.691,0.734,0.783,0.847,0.912,0.956,1.0],"h":[0.74,0.74,0.74,0.74,0.74,0.74,0.735],"hf":0.16}};
const lerpArr = (a, t) => { const f = Math.min(1, Math.max(0, t)) * (a.length - 1), i = Math.min(a.length - 2, Math.floor(f)); return a[i] + (a[i + 1] - a[i]) * (f - i); };
const engShape = (id, fuel) => ENG_SHAPE[id] || ENG_SHAPE[{ methalox: 'raptor', kerolox: 'merlin', hydrolox: 'rs25', hyper: 'rl10', solid: 'srb' }[fuel]] || ENG_SHAPE.raptor;
// 홀로그램 보기의 엔진 와이어프레임 (Grok 그림 윤곽): 머리 + 노즐을 세로선·고리로. 그렸으면 true
function engWire(it, E, w, hh, al) {
 const SH = engShape(it.id, E.fuel), hr = hh / Math.max(VCOS, 0.05), wr = Math.max(0.8, Math.min(w, hr / SH.asp)), hf = Math.min(0.42, SH.hf), N = 12;
 const rf = s => s < hf ? Math.max(0.3, wr * lerpArr(SH.h, s / hf)) : wr * lerpArr(SH.b, (s - hf) / (1 - hf)); // s: 0(위)~1(출구)
 for (let k = 0; k < 10; k++) { const ph = k / 10 * Math.PI * 2 + S.rot, d = Math.cos(ph), pts = []; for (let i = 0; i <= N; i++) { const s = i / N, r = rf(s); pts.push([it.X + Math.sin(ph) * r, it.Y + s * hh + d * r * TILT]); } glowLine(pts, al * (d > 0 ? 0.8 : 0.22), d > 0 ? 1 : 0.8); }
 [hf * 0.35, hf, hf + (1 - hf) * 0.3, hf + (1 - hf) * 0.65].forEach(s => { const r = rf(s), y = it.Y + s * hh, pts = []; if (r < 0.8) return; for (let i = 0; i <= 20; i++) { const t = -Math.PI / 2 + i / 20 * Math.PI; pts.push([it.X + Math.sin(t) * r, y + Math.cos(t) * r * TILT]); } glowLine(pts, al * 0.6, 0.8); });
 x.beginPath(); x.ellipse(it.X, it.Y + hh, Math.max(wr, 0.5), Math.max(wr * Math.abs(TILT), 0.3), 0, 0, Math.PI * 2); x.fillStyle = FUEL_OF(E.fuel) + '55'; x.fill(); x.strokeStyle = lineA(al * 0.8); x.stroke();
 return true;
}
const STEEL_M = { alb: lin([0.74, 0.75, 0.77]), metal: 1, rough: 0.3 };

/* ---------- 빛 계산 (스튜디오 조명) ---------- */
const nrm3 = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const LK = nrm3([-0.42, 0.62, 0.66]), LFL = nrm3([0.8, 0.1, 0.6]), LH = nrm3([LK[0], LK[1], LK[2] + 1]);
const aces = v => Math.min(1, Math.max(0, (v * (2.51 * v + 0.03)) / (v * (2.43 * v + 0.59) + 0.14)));
const toC = (r, g, b, a) => `rgba(${Math.round(Math.pow(aces(r), 1 / 2.2) * 255)},${Math.round(Math.pow(aces(g), 1 / 2.2) * 255)},${Math.round(Math.pow(aces(b), 1 / 2.2) * 255)},${a == null ? 1 : a})`;
function envL(rx, ryc, ry, ro) { // 반사 방향의 주변 밝기: 카메라와 함께 도는 왼쪽 위 소프트박스·오른쪽 세로 조명(ryc) + 위가 밝고 바닥이 어두운 방(ry, 세계 기준)
 const w = 0.06 + ro * 0.7, soft = 2.6 * Math.exp(-((rx + 0.45) ** 2 + (ryc - 0.6) ** 2) / (w * 1.3)) * (0.25 / (w + 0.15)), strip = 1.7 * Math.exp(-((rx - 0.9) ** 2) / (w * 0.35 + 0.01)) * Math.max(0, 1 - Math.abs(ryc - 0.15) * 1.3) * (0.2 / (w + 0.1));
 return (ry < -0.12 ? 0.07 : 0.11 + 0.34 * Math.min(1.2, ry + 0.25)) + soft + strip;
}
function shadeC(nx, ny, nz, M, a) { // 카메라 좌표의 법선(n) → 화면 색
 const nv = Math.max(nz, 0), al = M.alb, met = M.metal, ro = M.rough;
 const dk = Math.max(0, nx * LK[0] + ny * LK[1] + nz * LK[2]), df = Math.max(0, nx * LFL[0] + ny * LFL[1] + nz * LFL[2]), amb = 0.15 + 0.1 * ny;
 const shin = Math.pow(2, 1 + (1 - ro) * 9), sp = Math.pow(Math.max(0, nx * LH[0] + ny * LH[1] + nz * LH[2]), shin) * (shin + 2) * 0.012;
 const rx = 2 * nv * nx, ryc = 2 * nv * ny, rzc = 2 * nv * nz - 1, ry = ryc * VCOS + rzc * TILT, e = envL(rx, ryc, ry, ro) + sp, fr = Math.pow(1 - nv, 5), dif = dk * 1.25 + df * 0.3 + amb, ks = met ? 1 : 0.55 * (1 - ro) + 0.06;
 const ch = i => { const F0 = met ? al[i] * met + 0.04 * (1 - met) : 0.04, F = F0 + (1 - F0) * fr; return (1 - met) * al[i] * dif + F * e * ks; };
 return toC(ch(0), ch(1), ch(2), a);
}
const camN = (nx, ny, nz) => [nx, ny * VCOS - nz * TILT, ny * TILT + nz * VCOS]; // 세계 법선 → 카메라 법선 (위에서 보면 윗면이 보임)

/* ---------- 회전체 표면 ---------- */
// u: 0(아래)~1(위), ph: 화면 기준 각도(0 = 보는 사람 쪽). 점 = (cxu(u) + sin ph·r, y0 − u·h + cos ph·r·TILT)
function ringArc(cxu, y0, h, rf, u, p0, p1, first, n = 16) { const r = rf(u), cx = cxu(u), y = y0 - u * h; for (let i = 0; i <= n; i++) { const ph = p0 + (p1 - p0) * i / n, X = cx + Math.sin(ph) * r, Y = y + Math.cos(ph) * r * TILT; if (first && !i) x.moveTo(X, Y); else x.lineTo(X, Y); } }
// 보이는 겉모양(실루엣): 옆선 + 뚜껑 쪽은 뒤쪽 호, 반대쪽은 앞쪽 호
function silPath(cxu, y0, h, rf) { const up = TILT >= 0, N = 24; x.beginPath();
 for (let i = 0; i <= N; i++) { const u = i / N; x.lineTo(cxu(u) - rf(u), y0 - u * h); }
 if (up) ringArc(cxu, y0, h, rf, 1, -Math.PI / 2, -3 * Math.PI / 2, false); else ringArc(cxu, y0, h, rf, 1, -Math.PI / 2, Math.PI / 2, false);
 for (let i = N; i >= 0; i--) { const u = i / N; x.lineTo(cxu(u) + rf(u), y0 - u * h); }
 if (up) ringArc(cxu, y0, h, rf, 0, Math.PI / 2, -Math.PI / 2, false); else ringArc(cxu, y0, h, rf, 0, Math.PI / 2, 3 * Math.PI / 2, false);
 x.closePath(); }
// 회전체를 띠로 나눠 칠함. 띠마다 가로 그러데이션 = 각도별 빛. M은 재질 또는 u → 재질 함수
function shadeRev(cxu, y0, h, hraw, rf, M, nb, alpha) { const up = TILT >= 0;
 for (let b = 0; b < nb; b++) { const k = up ? b : nb - 1 - b, u0 = k / nb, u1 = (k + 1) / nb, um = (u0 + u1) / 2, r0 = rf(u0), r1 = rf(u1), Rb = Math.max(r0, r1, rf(um), 0.5), cm = cxu(um);
  const s = (r1 - r0) / Math.max((u1 - u0) * hraw, 1e-3), ca = 1 / Math.sqrt(1 + s * s), sa = -s * ca, Mm = typeof M === 'function' ? M(um) : M, g = x.createLinearGradient(cm - Rb, 0, cm + Rb, 0);
  for (let i = 0; i <= 12; i++) { const ph = -Math.PI / 2 + i / 12 * Math.PI, n = camN(Math.sin(ph) * ca, sa, Math.cos(ph) * ca); g.addColorStop((Math.sin(ph) + 1) / 2, shadeC(n[0], n[1], n[2], Mm, alpha)); }
  x.beginPath(); ringArc(cxu, y0, h, rf, up ? u0 : u1, -Math.PI / 2, Math.PI / 2, true); ringArc(cxu, y0, h, rf, up ? u1 : u0, Math.PI / 2, 3 * Math.PI / 2, false); x.closePath(); x.fillStyle = g; x.fill(); } }
// 뚜껑(윗면 또는 아랫면): 위에서 보면 윗면, 아래에서 보면 아랫면
function capFill(cxu, y0, h, rf, M, col) { const up = TILT >= 0, u = up ? 1 : 0, r = rf(u); if (r < 1 || Math.abs(TILT) < 0.02) return; const cx = cxu(u), y = y0 - u * h; x.beginPath(); x.ellipse(cx, y, r, Math.max(0.5, r * Math.abs(TILT)), 0, 0, Math.PI * 2);
 if (col) x.fillStyle = col; else { const n = camN(0, up ? 1 : -1, 0), n2 = camN(-0.35, up ? 0.94 : -0.94, 0), n3 = camN(0.35, up ? 0.94 : -0.94, 0), g = x.createLinearGradient(cx - r, 0, cx + r, 0); g.addColorStop(0, shadeC(n2[0], n2[1], n2[2], M)); g.addColorStop(0.5, shadeC(n[0], n[1], n[2], M)); g.addColorStop(1, shadeC(n3[0], n3[1], n3[2], M)); x.fillStyle = g; }
 x.fill(); }
// 각도 a0~a1(기체 기준, S.rot과 함께 돎), 높이 u0~u1인 표면 조각의 보이는 부분. 없으면 false
function patchPath(cxu, y0, h, rf, a0, a1, u0 = 0, u1 = 1) {
 let p0 = a0 + S.rot, p1 = a1 + S.rot; const TP = Math.PI * 2; p0 = ((p0 + Math.PI) % TP + TP) % TP - Math.PI; p1 = p0 + (a1 - a0);
 for (const off of [0, -TP, TP]) { const lo = Math.max(p0 + off, -Math.PI / 2), hi = Math.min(p1 + off, Math.PI / 2); if (hi - lo < 1e-3) continue; const n = Math.max(2, Math.ceil((hi - lo) * 8)); x.beginPath();
  ringArc(cxu, y0, h, rf, u0, lo, hi, true, n); for (let i = 1; i <= 8; i++) { const u = u0 + (u1 - u0) * i / 8, r = rf(u); x.lineTo(cxu(u) + Math.sin(hi) * r, y0 - u * h + Math.cos(hi) * r * TILT); }
  ringArc(cxu, y0, h, rf, u1, hi, lo, false, n); for (let i = 7; i >= 0; i--) { const u = u0 + (u1 - u0) * i / 8, r = rf(u); x.lineTo(cxu(u) + Math.sin(lo) * r, y0 - u * h + Math.cos(lo) * r * TILT); } x.closePath(); return true; }
 return false; }
// 표면 위 선: 둘레 선(고리)과 세로 선(자오선)
function surfRings(cxu, y0, h, rf, us, col, w) { x.strokeStyle = col; x.lineWidth = w || 1; x.beginPath(); us.forEach(u => { if (u > 0.002 && u < 0.998 && rf(u) > 2) ringArc(cxu, y0, h, rf, u, -Math.PI / 2, Math.PI / 2, true, 20); }); x.stroke(); }
function surfMer(cxu, y0, h, rf, n, col, w, a0 = 0, a1 = Math.PI * 2) { x.strokeStyle = col; x.lineWidth = w || 1; x.beginPath(); for (let k = 0; k < n; k++) { const a = a0 + (a1 - a0) * k / n, ph = a + S.rot; if (Math.cos(ph) < 0.05) continue; for (let i = 0; i <= 12; i++) { const u = i / 12, r = rf(u), X = cxu(u) + Math.sin(ph) * r, Y = y0 - u * h + Math.cos(ph) * r * TILT; if (!i) x.moveTo(X, Y); else x.lineTo(X, Y); } } x.stroke(); }

/* ---------- 질감 무늬 (한 번 만들어 재사용) ---------- */
const PATS = {};
function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function pat(kind) {
 if (PATS[kind]) return PATS[kind]; const N = 128, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d'), R = rnd(kind.length * 977 + 13);
 g.fillStyle = 'rgb(128,128,128)'; g.fillRect(0, 0, N, N);
 const blob = (x0, y0, r, col) => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { const gr = g.createRadialGradient(x0 + dx, y0 + dy, 0, x0 + dx, y0 + dy, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(128,128,128,0)'); g.fillStyle = gr; g.fillRect(x0 + dx - r, y0 + dy - r, r * 2, r * 2); } };
 if (kind === 'speck') for (let i = 0; i < 900; i++) { const v = R() < 0.5 ? 40 : 220; g.fillStyle = `rgba(${v},${v},${v},${0.25 + R() * 0.35})`; const s = 0.6 + R() * 1.6; g.fillRect(R() * N, R() * N, s, s); }
 if (kind === 'mottle') { for (let i = 0; i < 70; i++) blob(R() * N, R() * N, 5 + R() * 16, R() < 0.5 ? 'rgba(90,90,90,.35)' : 'rgba(175,175,175,.35)'); for (let i = 0; i < 300; i++) { g.fillStyle = 'rgba(70,70,70,.25)'; g.fillRect(R() * N, R() * N, 1, 1); } }
 if (kind === 'crinkle') { for (let i = 0; i < 40; i++) blob(R() * N, R() * N, 6 + R() * 14, R() < 0.5 ? 'rgba(40,40,40,.45)' : 'rgba(250,250,250,.5)'); for (let i = 0; i < 90; i++) { const v = R() < 0.5 ? 30 : 245; g.strokeStyle = `rgba(${v},${v},${v},.45)`; g.lineWidth = 0.6 + R(); g.beginPath(); let px = R() * N, py = R() * N; g.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (R() - 0.5) * 22; py += (R() - 0.5) * 22; g.lineTo(px, py); } g.stroke(); } }
 if (kind === 'weave') { const s = 8; for (let i = 0; i < N / s; i++) for (let j = 0; j < N / s; j++) { const hz = (i + j) % 2 === 0, gr = hz ? g.createLinearGradient(0, j * s, 0, j * s + s) : g.createLinearGradient(i * s, 0, i * s + s, 0); gr.addColorStop(0, 'rgb(70,70,70)'); gr.addColorStop(0.5, 'rgb(190,190,190)'); gr.addColorStop(1, 'rgb(70,70,70)'); g.fillStyle = gr; g.fillRect(i * s, j * s, s, s); } }
 if (kind === 'brush') for (let i = 0; i < 260; i++) { const v = R() < 0.5 ? 95 : 165; g.fillStyle = `rgba(${v},${v},${v},${0.3 + R() * 0.3})`; g.fillRect(0, R() * N, N, 0.5 + R() * 0.8); }
 if (kind === 'mill') { for (let i = 0; i < 30; i++) blob(R() * N, R() * N, 10 + R() * 20, R() < 0.5 ? 'rgba(110,110,110,.25)' : 'rgba(150,150,150,.25)'); }
 return PATS[kind] = x.createPattern(c, 'repeat');
}
function patFill(kind, alpha, R, op) { const p = pat(kind); if (!p) return; x.save(); x.globalCompositeOperation = op || 'overlay'; x.globalAlpha = alpha; const off = ((S.rot * R) % 128 + 128) % 128; x.translate(off, 0); x.fillStyle = p; x.fillRect(-off - 4, 0, W + 136, H); x.restore(); }

// 육각 타일: 각도 a0~a1 범위만. 타일 사이 회색 줄 + 타일마다 살짝 다른 밝기
function hexTiles(cxu, y0, h, hraw, rf, R, a0, a1) {
 let ts = Math.max(4, Math.min(16, geo.sc * 0.5)); const circ = 2 * Math.PI * Math.max(R, 4); let nC = Math.max(6, Math.round(circ / (ts * 1.5))), rowU = ts * 0.75 / Math.max(hraw, 1), nR = Math.ceil(1 / rowU);
 while (nC * nR > 5000) { ts *= 1.4; nC = Math.max(6, Math.round(circ / (ts * 1.5))); rowU = ts * 0.75 / Math.max(hraw, 1); nR = Math.ceil(1 / rowU); }
 const dA = Math.PI * 2 / nC, hu = rowU / 1.5 * 1.0, P = (u, ph) => { const r = rf(Math.min(1, Math.max(0, u))); return [cxu(u) + Math.sin(ph) * r, y0 - u * h + Math.cos(ph) * r * TILT]; };
 const lines = new Path2D(), lite = new Path2D();
 for (let j = 0; j <= nR; j++) { const uc = j * rowU, off = j % 2 ? dA / 2 : 0; if (uc > 1.02) break; for (let i = 0; i < nC; i++) { const a = i * dA + off; if (a1 - a0 < Math.PI * 2 - 1e-6) { const aa = ((a - a0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2); if (aa > a1 - a0) continue; } const ph = a + S.rot; if (Math.cos(ph) < 0.06) continue;
  const V = [[0, hu], [dA / 2, hu / 2], [dA / 2, -hu / 2], [0, -hu], [-dA / 2, -hu / 2], [-dA / 2, hu / 2]].map(([da, du]) => P(uc + du, ph + da * 0.94)); const tgt = (i * 7 + j * 13) % 5 === 0 ? lite : null;
  [lines, tgt].forEach(pp => { if (!pp) return; pp.moveTo(V[0][0], V[0][1]); for (let q = 1; q < 6; q++) pp.lineTo(V[q][0], V[q][1]); pp.closePath(); }); } }
 const la = Math.min(1, Math.max(0.25, (ts - 3) / 7)); x.fillStyle = `rgba(255,255,255,${0.05 * la})`; x.fill(lite); x.strokeStyle = `rgba(150,150,148,${0.55 * la})`; x.lineWidth = ts > 7 ? 1 : 0.7; x.stroke(lines);
}

/* ---------- 부품 그리기 (실제) ---------- */
function partLook(p) { const T = p.tps ? rtpsOf(p.tps) : null, M = rmatOf(p.mat); return { M, T, half: p.tps === 'hex' }; } // 육각 타일은 바람 받는 쪽 절반만 (스타십처럼)
function texture(tex, cxu, y0, h, hraw, rf, R, p, a0 = 0, a1 = Math.PI * 2) {
 const full = a1 - a0 >= Math.PI * 2 - 1e-6, vh = p.v.h || 1;
 if (tex === 'steel') { patFill('brush', 0.3, R); const st = 1.8 / vh, us = []; for (let u = st; u < 1; u += st) us.push(u); surfRings(cxu, y0, h, rf, us, 'rgba(40,42,46,.35)', 1); surfRings(cxu, y0, h, rf, us.map(u => u + 0.6 / Math.max(hraw, 1)), 'rgba(255,255,255,.12)', 1); }
 if (tex === 'alu') { patFill('mill', 0.6, R); const st = Math.max(0.8, p.shape.d0 || 2) / vh, us = []; for (let u = st; u < 1; u += st) us.push(u); surfRings(cxu, y0, h, rf, us, 'rgba(30,32,36,.22)', 1); if (full) surfMer(cxu, y0, h, rf, 8, 'rgba(30,32,36,.16)', 1); }
 if (tex === 'ti') { patFill('mill', 0.5, R); x.save(); x.globalCompositeOperation = 'overlay'; const g = x.createLinearGradient(0, y0, 0, y0 - h); g.addColorStop(0, 'rgba(80,95,190,.28)'); g.addColorStop(0.5, 'rgba(128,128,128,0)'); g.addColorStop(1, 'rgba(210,160,70,.25)'); x.fillStyle = g; x.fillRect(0, y0 - h - 4, W, h + 8); x.restore(); }
 if (tex === 'weave') patFill('weave', 0.55, R);
 if (tex === 'hex') hexTiles(cxu, y0, h, hraw, rf, R, a0, a1);
 if (tex === 'blocks') { patFill('speck', 0.6, R); const st = Math.max(0.12, (R * 0.9) / Math.max(hraw, 1)), us = []; for (let u = st; u < 1; u += st) us.push(u); surfRings(cxu, y0, h, rf, us, 'rgba(20,12,8,.55)', 1.2); surfMer(cxu, y0, h, rf, 14, 'rgba(20,12,8,.55)', 1.2); }
 if (tex === 'speck') patFill('speck', 0.7, R);
 if (tex === 'quilt') { patFill('mottle', 0.35, R); const st = Math.max(0.03, (R * 0.3) / Math.max(hraw, 1)), us = []; for (let u = st; u < 1; u += st) us.push(u); surfRings(cxu, y0, h, rf, us, 'rgba(110,100,85,.45)', 1); surfMer(cxu, y0, h, rf, 28, 'rgba(110,100,85,.45)', 1); }
 if (tex === 'mottle') patFill('mottle', 0.6, R);
 if (tex === 'crinkle') { patFill('crinkle', 0.85, R); surfMer(cxu, y0, h, rf, 6, 'rgba(90,60,10,.5)', 1.2); }
 if (p.build === 'stringer' && tex !== 'hex' && full && !p.tps) surfMer(cxu, y0, h, rf, 24, 'rgba(0,0,0,.08)', 1);
 if (p.build === 'iso' && full && !p.tps) { x.strokeStyle = 'rgba(0,0,0,.1)'; x.lineWidth = 1; x.beginPath(); for (let k = 0; k < 12; k++) for (const sg of [1, -1]) { let on = false; for (let i = 0; i <= 12; i++) { const u = i / 12, ph = k / 12 * Math.PI * 2 + S.rot + sg * u * 1.1, r = rf(u); if (Math.cos(ph) < 0.05) { on = false; continue; } const X = cxu(u) + Math.sin(ph) * r, Y = y0 - u * h + Math.cos(ph) * r * TILT; if (!on) x.moveTo(X, Y); else x.lineTo(X, Y); on = true; } } x.stroke(); }
}
function drawPartReal(L, sel, hov, D) {
 D = D || NOD; const p = L.p, h = (L.y0 - L.y1) * D.hm, hraw = (L.hraw ?? h) * D.hm, y0 = L.y0, cxu = u => geo.cx + D.dx(u), rf = u => Math.max(0, L.rf(u) * D.rm(u)), R0 = Math.max(rf(0), 2), R = Math.max(L.mr, 2);
 if ((L.hraw ?? h) < 0.5) return; x.save(); x.globalCompositeOperation = 'source-over';
 const up = TILT >= 0, { M, T, half } = partLook(p), base = T && !half ? T : M, smooth = p.v.prof === 'line' && D.rm === NOD.rm, nb = smooth ? 2 : Math.min(28, Math.max(10, Math.round(h / 10)));
 // 뒤쪽 부착물과 (위에서 볼 때) 엔진은 몸통보다 먼저
 p.att.forEach(t => drawAttReal(t, cxu(0.5), y0, h, R, p, -1));
 const showEng = p.role === 'engbay' && p.engines.length && (geo.solo || L === layout[0]); // 위 단의 엔진은 단간부 안에 숨어 있음
 if (showEng && up) drawEnginesReal(p, cxu(0), y0, R0);
 shadeRev(cxu, y0, h, hraw, rf, base, nb); capFill(cxu, y0, h, rf, base, p.role === 'engbay' && !up ? '#1c1f23' : p.role === 'capsule' && !up ? '#3a2a1e' : null);
 x.save(); silPath(cxu, y0, h, rf); x.clip();
 texture(base.tex, cxu, y0, h, hraw, rf, R, p);
 if (half && T) { const a0 = -Math.PI / 2, a1 = Math.PI / 2; if (patchPath(cxu, y0, h, rf, a0, a1)) { x.save(); x.clip(); shadeRev(cxu, y0, h, hraw, rf, T, nb); texture('hex', cxu, y0, h, hraw, rf, R, p, a0, a1); x.restore(); } }
 if (p.role === 'capsule') { for (let k = 0; k < 4; k++) if (patchPath(cxu, y0, h, rf, k * Math.PI / 2 - 0.12, k * Math.PI / 2 + 0.12, 0.5, 0.64)) { x.fillStyle = '#0b0f14'; x.fill(); x.strokeStyle = 'rgba(200,210,220,.5)'; x.lineWidth = 1; x.stroke(); }
  if (patchPath(cxu, y0, h, rf, 0, Math.PI * 2 - 1e-4, 0, 0.05)) { x.fillStyle = 'rgba(58,40,28,.9)'; x.fill(); } }
 if (p.role === 'hotring') for (let k = 0; k < 12; k++) if (patchPath(cxu, y0, h, rf, k * Math.PI / 6 - 0.13, k * Math.PI / 6 + 0.13, 0.2, 0.8)) { x.fillStyle = '#08090b'; x.fill(); }
 if (p.role === 'inter') { const g = x.createLinearGradient(0, y0, 0, y0 - h); g.addColorStop(0, 'rgba(0,0,0,.25)'); g.addColorStop(0.12, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, y0 - h - 2, W, h + 4); }
 if (D.fill) { x.fillStyle = D.fill; x.fillRect(0, y0 - h - 50, W, h + 100); }
 if (D.tint) { x.fillStyle = `rgba(${D.tint},.28)`; x.fillRect(0, y0 - h - 50, W, h + 100); }
 x.restore();
 if (D.heat) D.heat(cxu, y0, h, rf);
 if (sel || hov) { x.save(); silPath(cxu, y0, h, rf); x.strokeStyle = sel ? 'rgba(255,194,74,.95)' : 'rgba(216,246,255,.55)'; x.lineWidth = sel ? 2 : 1.2; if (sel) { x.shadowColor = 'rgba(255,194,74,.8)'; x.shadowBlur = 10; } x.stroke(); x.restore(); }
 if (D.wrinkle) { x.save(); x.globalCompositeOperation = 'lighter'; D.wrinkle(cxu, y0, h, rf); x.restore(); tintCol = null; }
 if (showEng && !up) drawEnginesReal(p, cxu(0), y0, R0);
 p.att.forEach(t => drawAttReal(t, cxu(0.5), y0, h, R, p, 1));
 x.restore();
}
function drawEnginesReal(p, cx, y0, R) {
 const n = p.engines.length, lay = engLayout(n), sp = n <= 1 ? 1 : n <= 4 ? 0.6 : n <= 9 ? 0.42 : n <= 20 ? 0.3 : 0.17, up = TILT >= 0;
 const items = lay.map((q, i) => { const ph = S.rot, px = q[0] * Math.cos(ph) - q[1] * Math.sin(ph), pz = q[0] * Math.sin(ph) + q[1] * Math.cos(ph); return { id: p.engines[i], X: cx + px * R * 0.92, Y: y0 + pz * R * TILT * 0.92, d: pz }; }).sort((u, v) => u.d - v.d);
 items.forEach(it => { const E = CARD[it.id]; if (!E) return; const w = Math.max(1.2, Math.min(E.noz, E.vac ? 1.8 : 1) * R * sp * (E.vac ? 1.25 : 1)), hh = E.noz * 1.9 * geo.sc * VCOS * (n > 9 ? 0.75 : 1), hr = E.noz * 1.9 * geo.sc * (n > 9 ? 0.75 : 1), t0 = w * 0.32;
  const nz = NOZ[NOZ_OF[it.id] || NOZ_FUEL[E.fuel] || 'dark'], SH = engShape(it.id, E.fuel), cxc = () => it.X;
  const wr = Math.min(w, hr / SH.asp), hf = Math.min(0.42, SH.hf), ph = hh * hf, hp = hr * hf, yb = it.Y + hh, bh = hh - ph, bhr = hr - hp;
  const bell = u => wr * lerpArr(SH.b, 1 - u), rh = u => Math.max(0.3, wr * lerpArr(SH.h, 1 - u)), hmax = wr * Math.max(...SH.h);
  const drawHead = () => { shadeRev(cxc, it.Y + ph, ph, hp, rh, STEEL_M, 6); capFill(cxc, it.Y + ph, ph, rh, STEEL_M); if (wr > 6) { const rp = Math.max(0.6, hmax * 0.28); for (const sd of [-1, 1]) { const rx = it.X + sd * hmax * 1.3, rr = () => rp; shadeRev(() => rx, it.Y + ph * 0.85, ph * 0.7, hp * 0.7, rr, STEEL_M, 2); capFill(() => rx, it.Y + ph * 0.85, ph * 0.7, rr, STEEL_M); } } };
  const drawBell = () => { shadeRev(cxc, yb, bh, bhr, bell, nz, 16); if (!up) { const r = bell(0); x.beginPath(); x.ellipse(it.X, yb, r, Math.max(0.5, r * Math.abs(TILT)), 0, 0, Math.PI * 2); const g = x.createRadialGradient(it.X, yb, 0, it.X, yb, r); g.addColorStop(0, '#020304'); g.addColorStop(0.75, '#14171b'); g.addColorStop(1, '#2a2e33'); x.fillStyle = g; x.fill(); } };
  if (up) { drawBell(); drawHead(); } else { drawHead(); drawBell(); } });
}
function drawAttReal(t, cx, y0, h, R, p, side) {
 const role = p.role, tiles = p.tps === 'hex';
 for (let k = 0; k < 4; k++) { const ph = k / 4 * Math.PI * 2 + S.rot + Math.PI / 4, s = Math.sin(ph), d = Math.cos(ph); if ((d >= 0 ? 1 : -1) !== side) continue; const xs = cx + s * R, dir = Math.sign(s) || 1;
  const facN = M => { const sg = -Math.sin(ph) >= 0 ? 1 : -1, n = camN(Math.cos(ph) * sg, 0, -Math.sin(ph) * sg); return shadeC(n[0], n[1], n[2], M); };
  if (t === 'gridfin') { if (Math.abs(s) < 0.2) continue; const yy = y0 - h * 0.92, Lw = R * 0.75 * Math.abs(s), gh = R * 0.45, x0 = Math.min(xs, xs + dir * Lw); x.fillStyle = facN({ alb: lin([0.5, 0.5, 0.53]), metal: 1, rough: 0.45 }); x.fillRect(x0, yy, Lw, gh);
   x.fillStyle = 'rgba(8,9,11,.85)'; const nx = 5, ny = 4, cw = Lw / nx, ch = gh / ny; for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) x.fillRect(x0 + a * cw + cw * 0.16, yy + b * ch + ch * 0.16, cw * 0.68, ch * 0.68); x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 1; x.strokeRect(x0, yy, Lw, gh); }
  if (t === 'legs') { if (Math.abs(s) < 0.15) continue; const Lg = R * 1.6, ex = xs + dir * Lg * Math.abs(s), ey = y0 + R * 1.5, lw = Math.max(2.5, R * 0.07);
   x.lineCap = 'round'; x.strokeStyle = '#121417'; x.lineWidth = lw; x.beginPath(); x.moveTo(xs, y0 - h * 0.9); x.lineTo(ex, ey); x.stroke(); x.strokeStyle = 'rgba(120,130,145,.45)'; x.lineWidth = Math.max(1, lw * 0.25); x.stroke();
   x.strokeStyle = '#8b9096'; x.lineWidth = Math.max(1.5, lw * 0.45); x.beginPath(); x.moveTo(xs, y0 - h * 0.2); x.lineTo(xs + dir * Lg * 0.55 * Math.abs(s), y0 + R * 0.7); x.stroke();
   x.fillStyle = '#6f757c'; x.beginPath(); x.ellipse(ex, ey, lw * 2.2, Math.max(1, lw * 2.2 * Math.abs(TILT)) + 1, 0, 0, Math.PI * 2); x.fill(); x.lineCap = 'butt'; }
  if ((t === 'flaps' && k % 2 === 0) || t === 'fins') { if (t === 'flaps' && Math.abs(s) < 0.3) continue; const Lf = R * (t === 'flaps' ? 1 : 0.8) * Math.abs(s), top = role === 'shell', yt = top ? y0 - h * 0.35 : t === 'fins' ? y0 - h * 0.7 : y0 - h * 0.15, yb = t === 'fins' ? y0 + R * 0.4 : top ? y0 - h * 0.05 : y0 - h * 0.65;
   const M = t === 'fins' ? { alb: lin([0.12, 0.12, 0.13]), metal: 0, rough: 0.4 } : tiles ? RTPS.hex : rmatOf(p.mat);
   x.beginPath(); x.moveTo(xs, yt); x.lineTo(xs + dir * Lf, yt + (yb - yt) * 0.3); x.lineTo(xs + dir * Lf, yb); x.lineTo(xs, yb + (t === 'fins' ? -R * 0.3 : 0)); x.closePath(); x.fillStyle = facN(M); x.fill(); x.strokeStyle = 'rgba(255,255,255,.16)'; x.lineWidth = 1; x.stroke(); }
 }
}
// 스튜디오 바닥: 투사대 대신 은은한 바닥 빛과 그림자
function drawStudio() {
 const z = VIEW.zoom, cx = geo.cx, by = geo.base + 3 * VCOS, fr = Math.min(W * 0.48, 440) * Math.min(z, 3), at = Math.abs(TILT);
 x.save(); const g = x.createRadialGradient(cx, by, 0, cx, by, fr); g.addColorStop(0, 'rgba(150,170,195,.18)'); g.addColorStop(1, 'rgba(150,170,195,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(cx, by, fr, Math.max(1, fr * at), 0, 0, Math.PI * 2); x.fill();
 if (TILT > 0.02) { const r = Math.max(geo.mr * 1.7, 24); x.translate(cx, by); x.scale(1, Math.max(0.02, at)); const sg = x.createRadialGradient(0, 0, 0, 0, 0, r); sg.addColorStop(0, 'rgba(0,0,0,.55)'); sg.addColorStop(0.6, 'rgba(0,0,0,.25)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = sg; x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill(); }
 x.restore();
}
