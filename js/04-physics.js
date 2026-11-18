/* 04-physics.js — 물리: 질량, 좌굴, 압력·압축·굽힘·진동·플라즈마 시험 계산
   모든 js 파일은 같은 전역 공간을 공유하는 일반 <script>입니다. 순서대로 로드되고, 마지막 99-boot.js가 앱을 시작합니다. */
/* ---------- 물리: 질량·시험 ---------- */
function geomM(s) { const N = 40, rf = rfOf(s, 1), dh = s.h / N; let A = 0, V = 0; for (let i = 0; i < N; i++) { const a = rf(i / N), b = rf((i + 1) / N); A += Math.PI * (a + b) * Math.hypot(dh, b - a); V += Math.PI * dh * (a * a + a * b + b * b) / 3; } return { A, V }; }
function massOf(p) { const g = geomM(p.shape), B = BUILD[p.build], st = g.A * p.t / 1000 * p.mat.rho * B.massF, tps = p.tps ? g.A * p.tpsT / 1000 * CARD[p.tps].trho : 0, prop = p.role === 'tank' && p.fuel ? g.V * 0.95 * FUELD[p.fuel] : 0, eng = p.engines.reduce((a, e) => a + CARD[e].m * 1000, 0); return { A: g.A, V: g.V, st, tps, prop, eng, dry: st + tps + eng, tot: st + tps + prop + eng }; }
const inStack = p => S.parts.indexOf(p) >= 0;
const aboveMass = p => { const i = S.parts.indexOf(p); return i < 0 ? null : S.parts.slice(i + 1).reduce((a, q) => a + massOf(q).tot, 0); };
const armLen = p => { const i = S.parts.indexOf(p); return i < 0 ? null : S.parts.slice(i).reduce((a, q) => a + q.shape.h, 0); };
function sigcr(p) { const s = p.shape, B = BUILD[p.build], R = Math.max(maxR(s), 0.05), tb = p.t / 1000 * B.bendF, phi = Math.sqrt(R / tb) / 16, g = B.gamma != null ? B.gamma : 1 - 0.901 * (1 - Math.exp(-phi)), cosA = s.prof === 'line' ? s.h / Math.hypot(s.h, (s.d0 - s.d1) / 2) : 1, gf = s.prof === 'line' ? cosA * cosA : 0.9; return g * 0.605 * p.mat.E * 1e9 * tb / R * gf; }
function ramp(cfgMode, target, pre) { // 하중 경로: pre(보증) 있으면 0~.3 상승, .45까지 유지, .9까지 목표, 이후 유지
 if (pre && pre < target) return t => t < 0.3 ? pre * t / 0.3 : t < 0.45 ? pre : t < 0.9 ? pre + (target - pre) * (t - 0.45) / 0.45 : target;
 return t => t < 0.85 ? target * t / 0.85 : target;
}
function firstCross(f, cap) { for (let i = 0; i <= 600; i++) { const t = i / 600; if (f(t) >= cap) return t; } return null; }
function plasmaSim(p, qk, durS) {
 const W = p.mat, sig = 5.67e-8, q = qk * 1e3, tp = p.tps ? CARD[p.tps] : null, N = tp ? 12 : 0, Cw = W.rho * W.cp * p.t / 1000;
 let s = tp ? p.tpsT / 1000 : 0; const s0 = s, T = new Float64Array(Math.max(N, 1)).fill(293); let Tw = 293, t = 0, it = 0, failT = null, mode = '', maxS = 293, maxW = 293;
 const out = []; let nextS = 0;
 while (t < durS && it < 600000) {
  let dt;
  if (tp && s > 0.0004) {
   const dx = s / N, al = tp.tk / (tp.trho * tp.tcp); dt = Math.min(0.5, 0.35 * dx * dx / al, durS - t + 1e-9);
   const C0 = tp.trho * tp.tcp * dx / 2, n = T.slice();
   n[0] = T[0] + (q - tp.teps * sig * T[0] ** 4 - tp.tk * (T[0] - T[1]) / dx) * dt / C0;
   for (let i = 1; i < N - 1; i++) n[i] = T[i] + al * dt / (dx * dx) * (T[i - 1] - 2 * T[i] + T[i + 1]);
   const fw = tp.tk * (T[N - 1] - Tw) / (dx / 2);
   n[N - 1] = T[N - 1] + (tp.tk * (T[N - 2] - T[N - 1]) / dx - fw) * dt / (tp.trho * tp.tcp * dx);
   Tw += fw * dt / Cw; T.set(n);
   if (tp.abl && T[0] - 273 > tp.tA) { const ex = (T[0] - 273 - tp.tA) * C0; T[0] = tp.tA + 273; s -= ex / (tp.trho * tp.Qs * 1e6); }
   if (!tp.abl && T[0] - 273 > tp.tT && failT == null) { failT = t; mode = `표면이 ${tp.name} 한계 온도 ${tp.tT}°C를 넘어 균열·용융`; }
   if (s <= 0.0004 && failT == null) { failT = t; mode = '단열재가 모두 깎여 벽이 드러남'; }
  } else { dt = Math.min(0.05, durS - t + 1e-9); Tw += (q - W.eps * sig * Tw ** 4) * dt / Cw; T[0] = Tw; }
  if (Tw - 273 > W.Tmax && failT == null) { failT = t; mode = `벽 온도가 ${W.name} 한계 ${W.Tmax}°C를 넘어 구조가 약해지고 관통`; }
  const Ts = tp && s > 0.0004 ? T[0] : Tw; maxS = Math.max(maxS, Ts); maxW = Math.max(maxW, Tw);
  t += dt; it++;
  if (t >= nextS) { out.push({ t, Ts: Ts - 273, Tw: Tw - 273, s: s * 1000 }); nextS += durS / 240; }
  if (failT != null && t > failT + durS * 0.02) break;
 }
 out.push({ t, Ts: (tp && s > 0.0004 ? T[0] : Tw) - 273, Tw: Tw - 273, s: s * 1000 });
 return { out, failT, mode, maxS: maxS - 273, maxW: maxW - 273, rec: (s0 - Math.max(s, 0)) * 1000, sLeft: Math.max(s, 0) * 1000 };
}
function evalTest(kind, p, cfg) {
 const X = TEST_EXT[kind]; if (X && X.evaluate) return Object.assign({ kind, failAt: null, aux: {} }, X.evaluate(p, cfg, HOLO));
 const s = p.shape, M = p.mat, B = BUILD[p.build], R = Math.max(maxR(s), 0.05), t = p.t / 1000, L = Math.max(s.h, 0.1), fail = cfg.mode === 'fail';
 const cosA = s.prof === 'line' ? s.h / Math.hypot(s.h, (s.d0 - s.d1) / 2) : 1, shapeF = s.prof === 'dome' ? 0.5 : 1, sy = M.Sy * 1e6;
 if (kind === 'press') {
  const cf = cfg.medium === 'ln2' ? M.cryo : 1, k = t * cosA / (R * shapeF), Py = M.Sy * 1e6 * cf * k / 1e5, Pb = M.Su * 1e6 * cf * k / 1e5, meop = Math.max(p.meop, 0.1), req = 1.4 * meop, proof = 1.1 * meop;
  const target = fail ? Pb * 1.0005 : req, load = ramp(cfg.mode, target, proof), ft = firstCross(load, Pb), yt = firstCross(load, Py), ok = Pb >= req && Py >= proof;
  const hoop = P => P * 1e5 / k / 1e6;
  return { kind, ok, ms: Pb / req - 1, load, cap: Pb, failAt: ft, yieldAt: yt, aux: { Py, Pb, cf, hoop, Su: M.Su * cf },
   hud: tau => { const P = load(Math.min(tau, ft ?? 1)); return { rows: [['압력', `${nf(P, 2)} bar`], ['후프 응력', `${nf(hoop(P), 0)} MPa`], ['매질', cfg.medium === 'ln2' ? '액체질소 −196°C' : '물 (상온)'], ['재질 강도', `${nf(M.Su * cf, 0)} MPa`]], v: P, max: Math.max(Pb, req) * 1.12, marks: [[meop, '운용', '#86adbf'], [proof, '보증', '#3ff0ff'], [req, '요구', '#ffc24a'], [Pb, '파열', '#ff5d73']] }; },
   sum: ok ? `파열 ${nf(Pb, 2)} bar ≥ 요구 ${nf(req, 2)} bar (운용 ${nf(meop, 1)} bar의 1.4배)` : Py < proof && Pb >= req ? `보증 압력 ${nf(proof, 2)} bar에서 영구 변형 (항복 ${nf(Py, 2)} bar)` : `요구 ${nf(req, 2)} bar 전에 ${nf(Pb, 2)} bar에서 파열`,
   detail: `항복 ${nf(Py, 2)} bar · 파열 ${nf(Pb, 2)} bar · 벽 ${nf(p.t, 1)} mm, 반지름 ${nf(R, 2)} m${cf !== 1 ? ` · 극저온 강도 ×${cf}` : ''}` };
 }
 if (kind === 'comp' || kind === 'bend') {
  const sc = sigcr(p) * (kind === 'bend' ? 1.3 : 1), sf = Math.min(sc, sy), modeTxt = sc < sy ? '좌굴' : '항복(압궤)';
  if (kind === 'comp') {
   const A = 2 * Math.PI * R * t * B.areaF, Fp = p.role === 'tank' && cfg.pressurize ? p.meop * 1e5 * Math.PI * R * R : 0, cap = (sf * A + Fp) / 1e6, am = inStack(p) ? aboveMass(p) : cfg.above * 1000, req = 1.4 * 2.5 * 9.81 * am / 1e6;
   const target = fail ? cap * 1.0005 : Math.max(req, cap * 0.02), load = ramp(cfg.mode, target), ft = firstCross(load, cap), ok = cap >= req;
   return { kind, ok, ms: req > 0 ? cap / req - 1 : 9.99, load, cap, failAt: ft, aux: { modeTxt, sc },
    hud: tau => { const F = load(Math.min(tau, ft ?? 1)); return { rows: [['누르는 힘', `${nf(F, 2)} MN`], ['무게로 치면', `${nf(F * 1e6 / 9.81 / 1000, 0)} t`], ['위 질량', `${nf(am / 1000, 1)} t`], ['좌굴 응력', `${nf(sc / 1e6, 0)} MPa`]], v: F, max: Math.max(cap, req) * 1.12, marks: [[req, '요구', '#ffc24a'], [cap, modeTxt, '#ff5d73']] }; },
    sum: ok ? `${nf(cap, 2)} MN까지 견딤 ≥ 요구 ${nf(req, 2)} MN` : `요구 ${nf(req, 2)} MN 전에 ${nf(cap, 2)} MN에서 ${modeTxt}`,
    detail: `위 질량 ${nf(am / 1000, 1)} t × 2.5g × 1.4${Fp ? ` · 내부 압력이 ${nf(Fp / 1e6, 2)} MN를 받쳐 줌` : ''} · ${BUILD[p.build].name}` };
  }
  const Z = Math.PI * R * R * t * B.areaF, cap = sf * Z / 1e6, arm = inStack(p) ? armLen(p) : cfg.arm, req = 1.4 * 35e3 * 0.0873 * 2 * Math.PI * R * R * arm * 0.5 / 1e6;
  const target = fail ? cap * 1.0005 : Math.max(req, cap * 0.02), load = ramp(cfg.mode, target), ft = firstCross(load, cap), ok = cap >= req, EI = M.E * 1e9 * Math.PI * R ** 3 * t * B.bendF;
  return { kind, ok, ms: req > 0 ? cap / req - 1 : 9.99, load, cap, failAt: ft, aux: { modeTxt, EI, L },
   hud: tau => { const Mo = load(Math.min(tau, ft ?? 1)); return { rows: [['굽힘 모멘트', `${nf(Mo, 2)} MN·m`], ['최대 응력', `${nf(Mo * 1e6 / Z / 1e6, 0)} MPa`], ['위쪽 길이', `${nf(arm, 1)} m`], ['끝 처짐', `${nf(Mo * 1e6 * L * L / (2 * EI) * 1000, 1)} mm`]], v: Mo, max: Math.max(cap, req) * 1.12, marks: [[req, '요구', '#ffc24a'], [cap, modeTxt, '#ff5d73']] }; },
   sum: ok ? `${nf(cap, 2)} MN·m까지 견딤 ≥ 요구 ${nf(req, 2)} MN·m` : `요구 ${nf(req, 2)} MN·m 전에 ${nf(cap, 2)} MN·m에서 ${modeTxt}`,
   detail: `동압 35 kPa · 받음각 5° · 위쪽 길이 ${nf(arm, 1)} m · ${BUILD[p.build].name}` };
 }
 if (kind === 'vib') {
  const m = massOf(p), mp = m.dry / L, EI = M.E * 1e9 * Math.PI * R ** 3 * t * B.bendF, Z = Math.PI * R * R * t * B.areaF, f1 = 3.516 / (2 * Math.PI * L * L) * Math.sqrt(EI / mp), Q = 10, a0 = 0.25 * 9.81, allow = Math.min(sy, 1.3 * sigcr(p));
  const fr = tau => 5 * Math.pow(20, Math.min(1, tau)), Hf = f => { const r = f / f1; return 1 / Math.sqrt((1 - r * r) ** 2 + (r / Q) ** 2); }, st = f => 0.6 * mp * a0 * Hf(f) * L * L / 2 / Z / 1e6;
  const load = tau => st(fr(tau)); let mx = 0; for (let i = 0; i <= 600; i++) mx = Math.max(mx, load(i / 600));
  const lim = allow / 1e6 * 0.8, ft = firstCross(load, allow / 1e6), ok = mx <= lim;
  return { kind, ok, ms: lim / mx - 1, load, cap: allow / 1e6, failAt: ft, aux: { f1, fr, Hf },
   hud: tau => { const f = fr(tau); return { rows: [['가진 주파수', `${nf(f, 1)} Hz`], ['1차 고유진동수', `${nf(f1, 1)} Hz`], ['응답 배율', `×${nf(Hf(f), 1)}`], ['응력', `${n0(st(f))} MPa`]], v: st(f), max: Math.max(mx, allow / 1e6) * 1.12, marks: [[lim, '허용 80%', '#ffc24a'], [allow / 1e6, '항복', '#ff5d73']] }; },
   sum: ok ? `공진 응력 최대 ${n0(mx)} MPa ≤ 허용 ${nf(lim, 0)} MPa` : `공진 응력 ${n0(mx)} MPa이 허용 ${nf(lim, 0)} MPa를 넘음`,
   detail: `1차 고유진동수 ${nf(f1, 2)} Hz ${f1 < 5 ? '(5 Hz 아래라 가진 범위 밖)' : f1 > 100 ? '(100 Hz 위라 공진 없음)' : '— 훑는 범위 안에서 공진'} · 건조 질량 ${nf(m.dry / 1000, 2)} t` };
 }
 const pr = plasmaSim(p, cfg.q, cfg.dur), ok = pr.failT == null, at = tau => { const tt = tau * cfg.dur; let a = pr.out[0]; for (const o of pr.out) { if (o.t > tt) break; a = o; } return a; };
 return { kind, ok, ms: ok ? (M.Tmax - pr.maxW) / Math.max(M.Tmax - 20, 1) : -1, load: tau => at(tau).Tw, cap: M.Tmax, failAt: pr.failT != null ? pr.failT / cfg.dur : null, aux: { at, pr },
  hud: tau => { const o = at(tau); return { rows: [['경과', `${nf(Math.min(tau, 1) * cfg.dur, 0)} / ${cfg.dur} s`], ['열유속', `${nf(cfg.q, 0)} kW/m²`], ['표면 온도', `${nf(o.Ts, 0)} °C`], ['벽 온도', `${nf(o.Tw, 0)} °C`]].concat(p.tps ? [['단열재 남은 두께', `${nf(o.s, 1)} mm`]] : []), v: o.Tw, max: Math.max(M.Tmax * 1.15, pr.maxW * 1.05), marks: [[M.Tmax, '벽 한계', '#ff5d73']] }; },
  sum: ok ? `${cfg.dur}초 견딤 · 벽 최고 ${nf(pr.maxW, 0)}°C (한계 ${M.Tmax}°C)` : pr.mode,
  detail: `표면 최고 ${nf(pr.maxS, 0)}°C${p.tps ? ` · ${CARD[p.tps].name} ${nf(p.tpsT, 0)} mm 중 ${nf(pr.rec, 1)} mm 깎임` : ' · 단열재 없음'}` };
}
