/* 01-data.js — 데이터: 연료·재질·구조방식·기본 카드·시험 목록
   모든 js 파일은 같은 전역 공간을 공유하는 일반 <script>입니다. 순서대로 로드되고, 마지막 99-boot.js가 앱을 시작합니다. */
const $ = s => document.querySelector(s);
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = t => String(t).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const fix = v => Math.round(v * 100) / 100;
const m1 = v => (Math.round(v * 10) / 10).toFixed(1);
const n0 = v => nf(v, Math.abs(v) < 10 ? 1 : 0);
const nf = (v, d = 1) => !isFinite(v) ? '—' : Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('ko-KR') : v.toFixed(d);
/* ---------- 데이터 ---------- */
const FUELC = { methalox: '#b28cff', kerolox: '#ffb347', hydrolox: '#bff4ff', hyper: '#ff7a45', solid: '#c9ced6' };
const FUELD = { methalox: 830, kerolox: 1030, hydrolox: 360, hyper: 1200, solid: 1800 };
const ROLES = { tank: '탱크', engbay: '엔진부', inter: '단간부', hotring: '핫 스테이징 링', shell: '외피 (노즈·페어링)', capsule: '캡슐' };
// 재질 성질은 대표값(약)
const MATS = {
 ss304: { name: '스테인리스 304L', rho: 7900, E: 193, Sy: 210, Su: 520, Tmax: 870, k: 16, cp: 500, eps: 0.6, cryo: 1.6, note: '스타십 계열 · 극저온에서 더 강해짐' },
 ss301: { name: '스테인리스 301 (냉간 가공)', rho: 7880, E: 193, Sy: 760, Su: 1030, Tmax: 800, k: 16, cp: 500, eps: 0.6, cryo: 1.35, note: '얇게 만들 수 있는 고강도 강판' },
 al2195: { name: '알루미늄-리튬 2195', rho: 2710, E: 76, Sy: 560, Su: 600, Tmax: 150, k: 90, cp: 900, eps: 0.3, cryo: 1.15, note: '팰컨 9 · 우주왕복선 외부 탱크' },
 al2219: { name: '알루미늄 2219-T87', rho: 2840, E: 73, Sy: 393, Su: 476, Tmax: 175, k: 120, cp: 860, eps: 0.3, cryo: 1.2, note: '새턴 V · 용접이 쉬움' },
 al7075: { name: '알루미늄 7075-T6', rho: 2810, E: 72, Sy: 503, Su: 572, Tmax: 120, k: 130, cp: 960, eps: 0.3, cryo: 1.1, note: '가볍고 강하지만 용접이 어려움' },
 ti64: { name: '티타늄 Ti-6Al-4V', rho: 4430, E: 114, Sy: 880, Su: 950, Tmax: 400, k: 6.7, cp: 526, eps: 0.4, cryo: 1.4, note: '고온·고강도, 비쌈' },
 in718: { name: '인코넬 718', rho: 8190, E: 200, Sy: 1030, Su: 1240, Tmax: 700, k: 11.4, cp: 435, eps: 0.7, cryo: 1.15, note: '엔진·고온부용 초합금' },
 cfrp: { name: '탄소섬유 복합재', rho: 1600, E: 70, Sy: 600, Su: 600, Tmax: 120, k: 5, cp: 900, eps: 0.85, cryo: 0.95, note: '가장 가벼움 · 수지가 열에 약하고 깨지듯 파손' },
 st4130: { name: '크롬몰리 강 4130', rho: 7850, E: 205, Sy: 435, Su: 670, Tmax: 400, k: 42, cp: 477, eps: 0.6, cryo: 0.6, note: '값싸고 튼튼하지만 극저온에서 잘 깨짐' },
};
const MPROPS = [['rho', '밀도', 'kg/m³', 100, 20000], ['E', '탄성계수', 'GPa', 1, 500], ['Sy', '항복강도', 'MPa', 5, 3000], ['Su', '인장강도', 'MPa', 5, 3500], ['Tmax', '최고 사용 온도', '°C', 50, 3000], ['k', '열전도율', 'W/m·K', 0.01, 500], ['cp', '비열', 'J/kg·K', 100, 3000], ['eps', '방사율', '0~1', 0.02, 1], ['cryo', '극저온 강도 배율', '×', 0.2, 3]];
const BUILD = {
 mono: { name: '단일 외피 (모노코크)', areaF: 1, bendF: 1, massF: 1, gamma: null },
 stringer: { name: '스트링거 보강', areaF: 1.3, bendF: 2.2, massF: 1.3, gamma: 0.65 },
 iso: { name: '아이소그리드 (삼각 격자)', areaF: 1.25, bendF: 2.6, massF: 1.25, gamma: 0.7 },
 honey: { name: '허니콤 샌드위치', areaF: 1, bendF: 5, massF: 1.2, gamma: 0.75 },
};
const BUILTIN = [
 { id: 'nose', cat: 'st', name: '노즈콘', desc: '공기를 가르는 뾰족한 머리', kind: 'shell', sh: { prof: 'ogive', hr: 1.8, d1r: 0, k: 1.7 } },
 { id: 'fairing', cat: 'st', name: '페어링', desc: '탑재체를 감싸는 둥근 덮개', kind: 'shell', sh: { prof: 'bulb', hr: 3, d1r: 0, dmr: 1.35, sp: 0.58 } },
 { id: 'capsule', cat: 'st', name: '유인 캡슐', desc: '사람이 타는 원뿔 귀환선', kind: 'capsule', sh: { prof: 'line', hr: 0.8, d1r: 0.38 } },
 { id: 'tankS', cat: 'st', name: '짧은 탱크', desc: '상단용 작은 추진제 탱크', kind: 'tank', sh: { prof: 'line', hr: 1.4 } },
 { id: 'tankM', cat: 'st', name: '중간 탱크', desc: '가장 흔한 길이의 탱크', kind: 'tank', sh: { prof: 'line', hr: 3 } },
 { id: 'tankL', cat: 'st', name: '긴 탱크', desc: '1단 부스터용 큰 탱크', kind: 'tank', sh: { prof: 'line', hr: 6.5 } },
 { id: 'adapter', cat: 'st', name: '지름 전환 어댑터', desc: '굵기가 다른 두 단을 잇는 테이퍼', kind: 'inter', sh: { prof: 'line', hr: 0.7, d1r: 0.65 } },
 { id: 'inter', cat: 'st', name: '단간부', desc: '두 단을 잇고 분리되는 연결부', kind: 'inter', sh: { prof: 'line', hr: 0.6 } },
 { id: 'hotring', cat: 'st', name: '핫 스테이징 링', desc: '위 단 엔진을 켠 채 분리할 때의 배기 통로', kind: 'hotring', sh: { prof: 'line', hr: 0.22 } },
 { id: 'engbay', cat: 'st', name: '엔진부', desc: '엔진을 다는 추력 구조', kind: 'engbay', sh: { prof: 'line', hr: 0.45 } },
 { id: 'raptor', cat: 'en', name: '랩터', desc: '메탄 · 전유량 다단 연소', kind: 'engine', fuel: 'methalox', noz: 0.9, m: 1.6 },
 { id: 'raptorvac', cat: 'en', name: '랩터 진공형', desc: '메탄 · 큰 노즐의 상단용', kind: 'engine', fuel: 'methalox', noz: 1.5, vac: true, m: 2.0 },
 { id: 'merlin', cat: 'en', name: '멀린', desc: '케로신 · 가스 발생기', kind: 'engine', fuel: 'kerolox', noz: 0.8, m: 0.47 },
 { id: 'mvac', cat: 'en', name: '멀린 진공형', desc: '케로신 · 거대한 노즐 연장부', kind: 'engine', fuel: 'kerolox', noz: 1.7, vac: true, m: 0.49 },
 { id: 'rs25', cat: 'en', name: 'RS-25', desc: '수소 · 다단 연소', kind: 'engine', fuel: 'hydrolox', noz: 1.1, m: 3.5 },
 { id: 'rl10', cat: 'en', name: 'RL10', desc: '수소 · 익스팬더 상단용', kind: 'engine', fuel: 'hydrolox', noz: 1.2, vac: true, m: 0.3 },
 { id: 'be4', cat: 'en', name: 'BE-4', desc: '메탄 · 산화제 과잉 다단 연소', kind: 'engine', fuel: 'methalox', noz: 1, m: 2.1 },
 { id: 'srb', cat: 'en', name: '고체 모터', desc: '한 번 켜면 끌 수 없는 강력한 추력', kind: 'engine', fuel: 'solid', noz: 1.1, m: 1.2 },
 { id: 'hex', cat: 'tp', name: '육각 세라믹 타일', desc: '재진입 열을 견디는 검은 타일', kind: 'tps', col: '#1a1d22', pat: 'hex', tk: 0.06, trho: 200, tcp: 1000, tT: 1500, teps: 0.85, tdef: 40 },
 { id: 'pica', cat: 'tp', name: 'PICA 삭마재', desc: '녹아 깎이며 열을 가져감', kind: 'tps', col: '#6b4a2e', pat: 'speck', tk: 0.25, trho: 270, tcp: 1500, tT: 3000, teps: 0.9, abl: true, tA: 2200, Qs: 60, tdef: 50 },
 { id: 'cork', cat: 'tp', name: '코르크', desc: '값싸고 튼튼한 단열층', kind: 'tps', col: '#b08050', pat: 'dots', tk: 0.05, trho: 480, tcp: 1900, tT: 600, teps: 0.8, abl: true, tA: 450, Qs: 8, tdef: 15 },
 { id: 'blanket', cat: 'tp', name: '세라믹 담요', desc: '엔진부를 감싸는 누빔 담요', kind: 'tps', col: '#d4d3cb', pat: 'quilt', tk: 0.04, trho: 120, tcp: 1000, tT: 1100, teps: 0.8, tdef: 20 },
 { id: 'foam', cat: 'tp', name: '분무형 폼', desc: '극저온 탱크의 주황색 단열', kind: 'tps', col: '#e8873a', pat: 'none', tk: 0.025, trho: 38, tcp: 1500, tT: 200, teps: 0.9, abl: true, tA: 180, Qs: 2, tdef: 25 },
 { id: 'mli', cat: 'tp', name: '다층 단열재', desc: '진공에서 빛나는 금빛 포일', kind: 'tps', col: '#d9b84a', pat: 'sheen', tk: 0.02, trho: 60, tcp: 1000, tT: 400, teps: 0.05, tdef: 10 },
 { id: 'rcc', cat: 'tp', name: '탄소-탄소', desc: '노즈·앞전용 초고온 소재', kind: 'tps', col: '#3c4048', pat: 'weave', tk: 6, trho: 1600, tcp: 800, tT: 1650, teps: 0.85, tdef: 8 },
 { id: 'methalox', cat: 'fu', name: '메탈록스', desc: '액체산소 + 액체메탄', kind: 'fuel' },
 { id: 'kerolox', cat: 'fu', name: '케로록스', desc: '액체산소 + 케로신', kind: 'fuel' },
 { id: 'hydrolox', cat: 'fu', name: '하이드로록스', desc: '액체산소 + 액체수소', kind: 'fuel' },
 { id: 'hyper', cat: 'fu', name: '하이퍼골릭', desc: '닿기만 해도 점화되는 상온 추진제', kind: 'fuel' },
 { id: 'solid', cat: 'fu', name: '고체 추진제', desc: '탱크 대신 굳은 그레인', kind: 'fuel' },
 { id: 'gridfin', cat: 'at', name: '그리드 핀', desc: '귀환할 때 방향을 잡는 격자 날개', kind: 'att' },
 { id: 'legs', cat: 'at', name: '착륙 다리', desc: '엔진부에 접혀 있다 펼쳐짐', kind: 'att' },
 { id: 'flaps', cat: 'at', name: '공력 플랩', desc: '배면 재진입 때 자세를 잡는 날개', kind: 'att' },
 { id: 'fins', cat: 'at', name: '안정 핀', desc: '꼬리를 뒤로 유지하는 삼각 날개', kind: 'att' },
];
// assets/cards/에 그림이 있는 카드 id 목록 (그림을 추가하면 여기에도 id를 넣기 — 없는 그림을 불러오는 오류를 막음)
const CARD_ART = new Set(['raptor', 'raptorvac', 'merlin', 'mvac', 'rs25', 'rl10', 'be4', 'srb']);
const CATS = [['st', '구조'], ['en', '엔진'], ['tp', '단열재'], ['fu', '연료'], ['at', '부착물']];
const TESTS = [
 ['press', '압력', '물이나 액체질소를 채우고 압력을 올려 보증 압력(운용의 1.1배)과 요구 파열 압력(1.4배)을 확인해요.'],
 ['comp', '압축', '위에서 유압 프레스로 눌러요. 위에 얹힐 무게 × 최대 축하중 계수 2.5g × 안전계수 1.4를 버텨야 해요.'],
 ['bend', '굽힘', '맥스큐(동압 35 kPa)에서 받음각 5°로 부는 바람이 만드는 굽힘 모멘트 × 1.4를 걸어요.'],
 ['plasma', '플라즈마', '아크젯 플라즈마로 재진입 열을 쏘아요. 단열재가 다 깎이거나 벽이 재질 한계 온도를 넘으면 실패예요.'],
 ['vib', '진동', '가진기로 0.25 g 사인파를 5→100 Hz로 훑어요. 공진에서 응력이 항복의 80%를 넘으면 실패예요.'],
];
// 확장 모듈이 채우는 등록부 (12-api.js의 HOLO로 등록)
const TEST_EXT = {};   // 시험 id → { evaluate, cfgHtml, deform, rig, applies, dur }
const PANELS = [];     // 설계 패널에 덧붙는 구역
const DRAW_HOOKS = []; // 매 프레임 마지막에 불리는 그리기 함수
const EVT = {};        // 'changed', 'testDone' 이벤트 구독자
function emit(ev, d) { (EVT[ev] || []).forEach(f => { try { f(d); } catch (e) { console.error('[확장 이벤트 오류]', ev, e); } }); }
const testName = k => (TESTS.find(q => q[0] === k) || [k, k])[1];
const visTests = p => TESTS.filter(([k]) => !TEST_EXT[k] || !TEST_EXT[k].applies || TEST_EXT[k].applies(p));
const PLASMA = { ascent: ['상승 중 공력 가열', 8, 100], leo: ['지구 저궤도 재진입', 300, 900], mars: ['화성 진입', 900, 400], lunar: ['달 귀환 재진입', 3500, 300] };
const FUEL_OF = id => FUELC[id] || '#7fa6b8';
let CARD = {};
const rebuildCards = () => { CARD = Object.fromEntries(BUILTIN.concat(S.custom).map(c => [c.id, c])); };
