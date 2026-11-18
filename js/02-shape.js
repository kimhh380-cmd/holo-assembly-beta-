/* 02-shape.js — 모양: 치수 필드, 외형 곡선 rfOf, 카드 아이콘 SVG
   모든 js 파일은 같은 전역 공간을 공유하는 일반 <script>입니다. 순서대로 로드되고, 마지막 99-boot.js가 앱을 시작합니다. */
/* ---------- 모양 ---------- */
const FIELDS = [
 { k: 'h', l: '길이', min: 0.3, max: 80, st: 0.1, u: 'm' },
 { k: 'd0', l: '아래 지름', min: 0.3, max: 15, st: 0.1, u: 'm' },
 { k: 'd1', l: '위 지름', min: 0, max: 15, st: 0.1, u: 'm' },
 { k: 'dm', l: '최대 지름', min: 0.3, max: 18, st: 0.1, u: 'm', only: 'bulb' },
 { k: 'sp', l: '닫히는 지점', min: 0.3, max: 0.85, st: 0.01, u: '%', mul: 100, only: 'bulb' },
 { k: 'k', l: '뾰족함', min: 1, max: 4, st: 0.05, u: '', only: 'ogive' },
];
const PFIELDS = [
 { k: 't', l: '벽 두께', min: 0.5, max: 40, st: 0.1, u: 'mm' },
 { k: 'meop', l: '운용 압력', min: 0, max: 20, st: 0.1, u: 'bar' },
 { k: 'tpsT', l: '단열재 두께', min: 1, max: 150, st: 1, u: 'mm', tps: true },
];
const SHAPES = [['cyl', '원통'], ['cone', '원뿔'], ['taper', '테이퍼'], ['ogive', '오자이브'], ['dome', '돔'], ['bulb', '페어링'], ['boat', '스커트']];
const SHAPE_DEMO = { cyl: { prof: 'line', h: 3, d0: 2, d1: 2 }, cone: { prof: 'line', h: 3, d0: 2, d1: 0 }, taper: { prof: 'line', h: 2, d0: 2.4, d1: 1.4 }, ogive: { prof: 'ogive', h: 3, d0: 2, d1: 0, k: 1.7 }, dome: { prof: 'dome', h: 1.4, d0: 2.4, d1: 0 }, bulb: { prof: 'bulb', h: 3.4, d0: 1.6, d1: 0, dm: 2.4, sp: 0.6 }, boat: { prof: 'boat', h: 2, d0: 2.6, d1: 1.6 } };
const shapeKey = s => s.prof !== 'line' ? s.prof : Math.abs(s.d1 - s.d0) < 0.05 ? 'cyl' : s.d1 < 0.05 ? 'cone' : 'taper';
const shapeName = s => SHAPES.find(q => q[0] === shapeKey(s))[1];
function rfOf(s, sc) {
 const r0 = s.d0 / 2 * sc, r1 = s.d1 / 2 * sc, rm = (s.dm || s.d0) / 2 * sc, k = s.k || 1.7, sp = s.sp || 0.6;
 if (s.prof === 'ogive') return u => r1 + (r0 - r1) * Math.sqrt(Math.max(0, 1 - Math.pow(u, k)));
 if (s.prof === 'dome') return u => r1 + (r0 - r1) * Math.sqrt(Math.max(0, 1 - u * u));
 if (s.prof === 'boat') return u => r0 + (r1 - r0) * Math.sin(u * Math.PI / 2);
 if (s.prof === 'bulb') return u => { if (u < 0.12) { const t = u / 0.12; return r0 + (rm - r0) * t * t * (3 - 2 * t); } if (u < sp) return rm; const t = (u - sp) / (1 - sp); return r1 + (rm - r1) * Math.sqrt(Math.max(0, 1 - Math.pow(t, 1.8))); };
 return u => r0 + (r1 - r0) * u;
}
const maxR = s => Math.max(s.d0, s.d1, s.prof === 'bulb' ? s.dm : 0) / 2;
function shapeSvg(s, col, W = 100, H = 60) {
 const mr = Math.max(maxR(s), 0.01), sc = Math.min((H - 8) / Math.max(s.h, 0.01), W * 0.32 / mr), rf = rfOf(s, sc), h = s.h * sc, by = H - 4 - (H - 8 - h) / 2, cx = W / 2, pts = [];
 for (let i = 0; i <= 24; i++) { const u = i / 24; pts.push(`${(cx - rf(u)).toFixed(1)},${(by - u * h).toFixed(1)}`); }
 for (let i = 24; i >= 0; i--) { const u = i / 24; pts.push(`${(cx + rf(u)).toFixed(1)},${(by - u * h).toFixed(1)}`); }
 return `<svg viewBox="0 0 ${W} ${H}"><polygon points="${pts.join(' ')}" fill="${col || 'rgba(63,240,255,.14)'}" fill-opacity=".55" stroke="#3ff0ff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}
function icon(c) {
 const s = 'stroke="#3ff0ff" stroke-width="2" fill="rgba(63,240,255,.12)"';
 if (c.img) return `<img src="${esc(c.img)}" alt="" loading="lazy">`;
 if (c.cat === 'st') { const d = 2, sh = c.custom ? c.part.shape : { prof: c.sh.prof, h: c.sh.hr * d, d0: d, d1: c.sh.d1r != null ? c.sh.d1r * d : d, dm: (c.sh.dmr || 1) * d, k: c.sh.k, sp: c.sh.sp }; return shapeSvg(sh, c.custom && c.part.fuel ? FUEL_OF(c.part.fuel) : c.custom && c.part.tps ? CARD[c.part.tps].col : null); }
 if (c.kind === 'engine') { const w = 10 + c.noz * 14, col = FUEL_OF(c.fuel); return `<span class="ic"><svg viewBox="0 0 100 60"><rect x="44" y="4" width="12" height="12" ${s}/><path d="M46 16C46 26 ${50 - w} 40 ${50 - w} 54H${50 + w}C${50 + w} 40 54 26 54 16z" ${s}/><ellipse cx="50" cy="55" rx="${w}" ry="3" fill="${col}" opacity=".8"/></svg><img src="assets/engines/${esc(c.id)}.png" alt="" loading="lazy" onload="this.parentNode.classList.add('has')" onerror="this.remove()"></span>`; }
 if (c.kind === 'tps') { const pat = c.pat === 'hex' ? [0, 1, 2, 3].map(i => [0, 1, 2].map(j => `<path d="M${30 + i * 12 + (j % 2) * 6} ${16 + j * 11}l5 -3 5 3 0 6 -5 3 -5 -3z" fill="${c.col}" stroke="#3ff0ff" stroke-width="1"/>`).join('')).join('') : `<rect x="28" y="12" width="44" height="36" rx="4" fill="${c.col}" stroke="#3ff0ff" stroke-width="1.5"/>`; return `<svg viewBox="0 0 100 60">${pat}</svg>`; }
 if (c.kind === 'fuel') { const col = FUEL_OF(c.id); return `<svg viewBox="0 0 100 60"><path d="M50 6C60 22 66 30 66 40A16 16 0 0 1 34 40C34 30 40 22 50 6z" fill="${col}" fill-opacity=".55" stroke="${col}" stroke-width="2"/></svg>`; }
 if (c.id === 'gridfin') return `<svg viewBox="0 0 100 60"><rect x="30" y="16" width="40" height="28" fill="none" stroke="#3ff0ff" stroke-width="2"/><path d="M38 16V44M46 16V44M54 16V44M62 16V44M30 23H70M30 30H70M30 37H70" stroke="#3ff0ff" stroke-width="1" opacity=".7"/></svg>`;
 if (c.id === 'legs') return `<svg viewBox="0 0 100 60"><rect x="42" y="6" width="16" height="30" ${s}/><path d="M44 30L24 54M56 30L76 54" stroke="#3ff0ff" stroke-width="3"/></svg>`;
 if (c.id === 'flaps') return `<svg viewBox="0 0 100 60"><rect x="44" y="6" width="12" height="48" ${s}/><path d="M44 12L22 18L24 34L44 36M56 12L78 18L76 34L56 36" ${s}/></svg>`;
 return `<svg viewBox="0 0 100 60"><rect x="44" y="6" width="12" height="48" ${s}/><path d="M44 30L26 54H44M56 30L74 54H56" ${s}/></svg>`;
}
