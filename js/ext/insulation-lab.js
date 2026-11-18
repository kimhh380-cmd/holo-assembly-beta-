/* js/ext/insulation-lab.js — 단열재 실험 모듈
   1부: Gemini가 만든 다층 단열재 열물리 엔진 (holo_tps.js v4.0). 원본에서 export 키워드만 지우고 그대로 넣었습니다.
   2부: Claude가 붙인 HOLO 연결부 (설계 패널, 시험 3종, 단열재 카드 저장, 홀로그램 연출).
   모든 코드는 즉시 실행 함수 안에 있어 전역 이름을 만들지 않습니다. */
(() => {
// ===================== 1부: Gemini 엔진 (원본) =====================
/**
 * ============================================================================
 * HOLO-TPS LAB MODULE (v4.0)
 * 항공우주 다층 단열재(TPS) 및 단일 타일 형상·배열 극한 열환경 시뮬레이션 모듈
 * 
 * - 기존 holo-project 확장 모듈 또는 독립 웹 컨테이너에 즉시 마운트 가능
 * - 포함 기능:
 *   1. 6종 우주항공 표준 단열재 물성 및 미세구조 텍스처 생성기
 *   2. 1D 비정상 열전도 + 삭마(Ablation) + 열분해 블로킹 + 층간 박리 물리 엔진
 *   3. 단일 타일 4종 형상(평판/곡면/쐐기/허니콤) 및 4종 배열(모놀리스/격자/벽돌/육각) 역학
 *   4. 플라즈마 아크젯 / 극저온 증발(LH2, LN2) / 열진공(TVAC) 3대 시험 환경
 *   5. Web Audio API 실시간 챔버 음향 합성기 및 고해상도 캔버스 렌더러
 * ============================================================================
 */

const SIGMA = 5.670374419e-8; // 슈테판-볼츠만 상수 [W/(m²·K⁴)]

/**
 * 1. 항공우주 표준 단열재 물성 데이터베이스 (6종)
 */
const TPS_MATERIALS = {
  rcc_carbon: {
    id: 'rcc_carbon',
    name: 'RCC 강화탄소복합재',
    shortName: 'RCC 탄소재',
    tag: '3000K 내열',
    density: 1650,        // kg/m³
    conductivity: 16.5,   // W/(m·K)
    specificHeat: 1120,   // J/(kg·K)
    meltingPoint: 3050,   // K
    emissivity: 0.85,
    brittle: false,
    ablative: false,
    cte: 4.2e-6,          // 열팽창계수 [1/K]
    baseColor: '#1e2024',
    desc: 'SiC 내산화 코팅이 적용된 3D 직조 탄소섬유 복합재'
  },
  pica_ablator: {
    id: 'pica_ablator',
    name: 'PICA 페놀함침 삭마재',
    shortName: 'PICA 삭마재',
    tag: '열분해 삭마',
    density: 270,
    conductivity: 0.14,
    specificHeat: 1350,
    meltingPoint: 3400,
    emissivity: 0.88,
    brittle: false,
    ablative: true,
    cte: 6.5e-6,
    baseColor: '#3b2820',
    desc: '고온에서 수지가 열분해 가스를 방출해 대류열을 차단하고 탄화·삭마되는 NASA 표준 방열재'
  },
  hrsi_tile: {
    id: 'hrsi_tile',
    name: 'HRSI 실리카 세라믹 타일',
    shortName: 'HRSI 타일',
    tag: '고온 단열',
    density: 144,
    conductivity: 0.082,
    specificHeat: 940,
    meltingPoint: 1920,
    emissivity: 0.91,
    brittle: true,
    ablative: false,
    cte: 0.54e-6,
    baseColor: '#cbd5e1',
    desc: '표면 흑색 RCG 유리 코팅과 내부 다공성 백색 실리카 섬유로 구성된 우주왕복선 타일'
  },
  aerogel: {
    id: 'aerogel',
    name: '실리카 에어로겔 블랭킷',
    shortName: '에어로겔',
    tag: '초저전도',
    density: 95,
    conductivity: 0.017,
    specificHeat: 1000,
    meltingPoint: 950,
    emissivity: 0.75,
    brittle: false,
    ablative: false,
    cte: 3.0e-6,
    baseColor: '#0e7490',
    desc: '나노 다공성 매트릭스 단열재. 950K 초과 시 백색 소결(Sintering) 수축 및 단열 상실'
  },
  mli_foil: {
    id: 'mli_foil',
    name: 'MLI 알루미늄-캡톤 박막',
    shortName: 'MLI 박막',
    tag: '극저온/복사',
    density: 55,
    conductivity: 0.0035,
    specificHeat: 1090,
    meltingPoint: 650,
    emissivity: 0.03,
    brittle: false,
    ablative: false,
    cte: 20.0e-6,
    baseColor: '#b45309',
    desc: '금빛 알루미늄 증착 캡톤 필름과 망사 스페이서 적층. 복사열 차단에 최강이나 고열 취약'
  },
  frci_felt: {
    id: 'frci_felt',
    name: 'FRCI 퀼팅 내열 펠트',
    shortName: '내열 펠트',
    tag: '응력완화',
    density: 190,
    conductivity: 0.055,
    specificHeat: 980,
    meltingPoint: 1250,
    emissivity: 0.80,
    brittle: false,
    ablative: false,
    cte: 2.1e-6,
    baseColor: '#a8a29e',
    desc: '다이아몬드 스티치로 누빈 내열 섬유 블랭킷. 진동 및 열팽창 응력 흡수 완충층'
  }
};

/**
 * 2. 단일 타일 형상(Geometry) 및 배열 방식(Array Layout) 계수 정의
 */
const TILE_SHAPES = {
  flat: {
    id: 'flat',
    name: '평판형 (Flat Plate)',
    heatConcentration: 1.0,    // 정체점 열유속 배율
    radViewFactor: 1.0,        // 복사 냉각 시야계수
    massFactor: 1.0,
    stressFactor: 1.0,
    desc: '표준 정체점 가열 및 안정적 보우 쇼크 형성'
  },
  curved: {
    id: 'curved',
    name: '곡면 노즈콘형 (Blunt Nose)',
    heatConcentration: 0.74,   // 유선형 곡률로 정체점 열유속 26% 분산 감소
    radViewFactor: 1.28,       // 볼록 곡면으로 복사 방열 효율 28% 증가
    massFactor: 1.08,
    stressFactor: 0.85,
    desc: '곡률 반경으로 충격파를 밀어내어 정체점 열부하 26% 저감'
  },
  wedge: {
    id: 'wedge',
    name: '쐐기 예각선단 (Sharp Wedge)',
    heatConcentration: 1.62,   // 예리한 선단 끝(Tip)에 1.62배 극한 열집중
    radViewFactor: 1.15,
    massFactor: 0.78,
    stressFactor: 1.35,
    desc: '경사 충격파 부착으로 선단 끝(TC-TIP)에 극한 공력가열 집중'
  },
  honeycomb: {
    id: 'honeycomb',
    name: '육각 허니콤 코어 (Honeycomb)',
    heatConcentration: 0.95,
    radViewFactor: 1.05,
    massFactor: 0.65,          // 내부 육각 격자 공동으로 35% 경량화
    stressFactor: 0.72,        // 내부 리브 구조로 열응력 분산
    desc: '내부 육각 격자 공동 구조로 질량 35% 경량화 및 열응력 분산'
  }
};

const TILE_ARRAYS = {
  monolith: {
    id: 'monolith',
    name: '단일 일체형 (Monolith)',
    gapIngestionFactor: 0.0,   // 이음매 틈새 없음 -> 플라즈마 침투 0%
    thermalStressMult: 1.85,   // 넓은 단일 면적 구속으로 열팽창 파열 위험 급증
    desc: '틈새 열침투 0%, 단 넓은 면적의 열팽창 구속 응력(1.85x) 발생'
  },
  aligned: {
    id: 'aligned',
    name: '격자 일렬 배열 (Aligned Grid)',
    gapIngestionFactor: 0.42,  // 직선 이음매를 따라 고온 플라즈마가 깊숙이 침투
    thermalStressMult: 0.95,
    desc: '직선 이음매를 따라 고온 유동이 침투하는 틈새 가열(Gap Heating) 발생'
  },
  staggered: {
    id: 'staggered',
    name: '벽돌 엇갈림 배열 (Staggered Brick)',
    gapIngestionFactor: 0.14,  // 엇갈린 T자 이음매로 유동 직진 차단
    thermalStressMult: 0.82,
    desc: '엇갈린 타일 배치로 이음매 열침투 차단 및 열팽창 응력 흡수'
  },
  hex_mosaic: {
    id: 'hex_mosaic',
    name: '육각 모자이크 배열 (Hex Mosaic)',
    gapIngestionFactor: 0.08,  // 120도 굴절 이음매로 틈새 침투 최소화
    thermalStressMult: 0.68,
    desc: '120° 육각 경계로 열유동 굴절 차단 및 등방성 응력 분산 최적 배열'
  }
};

const BASE_STRUCTURE = {
  name: 'Al-Li 2195 합금 선체',
  density: 2700,
  conductivity: 120,
  specificHeat: 900,
  thicknessMm: 10,
  maxTemp: 450 // K
};

/**
 * 3. Web Audio API 기반 실시간 챔버 음향 합성기
 */
class ChamberAudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.noiseNode = null;
    this.gainNode = null;
    this.filterNode = null;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) {
      this.init();
    } else if (this.gainNode && this.ctx) {
      this.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
    return this.enabled;
  }

  init() {
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();

        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        this.noiseNode = this.ctx.createBufferSource();
        this.noiseNode.buffer = buffer;
        this.noiseNode.loop = true;

        this.filterNode = this.ctx.createBiquadFilter();
        this.filterNode.type = 'bandpass';
        this.filterNode.frequency.value = 180;
        this.filterNode.Q.value = 1.4;

        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.value = 0;

        this.noiseNode.connect(this.filterNode);
        this.filterNode.connect(this.gainNode);
        this.gainNode.connect(this.ctx.destination);
        this.noiseNode.start();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    } catch (e) {
      console.warn('[HoloTPS Audio] 오디오 초기화 제한:', e);
    }
  }

  update(isRunning, mode, powerMultiplier) {
    if (!this.ctx || !this.gainNode || !this.filterNode) return;
    if (!this.enabled || !isRunning) {
      this.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      return;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    if (mode === 'plasma') {
      this.filterNode.frequency.setTargetAtTime(160 + powerMultiplier * 220, this.ctx.currentTime, 0.1);
      this.gainNode.gain.setTargetAtTime(Math.min(0.18, 0.06 * powerMultiplier), this.ctx.currentTime, 0.1);
    } else if (mode === 'cryo') {
      this.filterNode.frequency.setTargetAtTime(520, this.ctx.currentTime, 0.1);
      this.gainNode.gain.setTargetAtTime(0.025, this.ctx.currentTime, 0.1);
    } else {
      this.filterNode.frequency.setTargetAtTime(95, this.ctx.currentTime, 0.1);
      this.gainNode.gain.setTargetAtTime(0.015, this.ctx.currentTime, 0.1);
    }
  }

  playCollapseAlarm() {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(42, this.ctx.currentTime + 0.45);
      g.gain.setValueAtTime(0.22, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.45);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.46);
    } catch (e) {
      // ignore audio error
    }
  }
}

/**
 * 4. 핵심 단열재 열물리 시뮬레이션 엔진 클래스
 */
class HoloTPSSimulator {
  constructor(options = {}) {
    this.onEvent = options.onEvent || (() => {});
    this.onCollapse = options.onCollapse || (() => {});
    this.audio = new ChamberAudioEngine();
    this.uidCounter = 1;

    this.state = {
      specimenMode: 'stack',     // 'stack' (다층 적층) | 'single_tile' (단일 타일 형상·배열)
      testMode: 'plasma',        // 'plasma' | 'cryo' | 'tvac'
      cryoFluid: 'LH2',          // 'LH2' (20K) | 'LN2' (77K)
      running: false,
      speed: 1,
      powerMultiplier: 1.0,
      time: 0,
      layers: [],
      singleTile: {
        matId: 'hrsi_tile',
        thicknessMm: 35,
        shape: 'curved',
        array: 'staggered',
        surfaceTemp: 293.15,
        tipTemp: 293.15,
        seamTemp: 293.15,
        recessionMm: 0,
        collapsed: false,
        collapseReason: ''
      },
      baseTemp: 293.15,
      history: [],
      tvacPhase: 'solar',
      missionFailed: false
    };

    this.loadPreset('shuttle');
  }

  getAmbientTemp() {
    if (this.state.testMode === 'cryo') {
      return this.state.cryoFluid === 'LH2' ? 20.0 : 77.0;
    }
    if (this.state.testMode === 'tvac') return 250.0;
    return 293.15;
  }

  createLayer(matId, thicknessMm) {
    const initT = this.getAmbientTemp();
    return {
      uid: this.uidCounter++,
      matId,
      initialThicknessMm: thicknessMm,
      thicknessMm,
      recessionMm: 0,
      charRatio: 0,
      delaminated: false,
      temp: initT,
      prevTemp: initT,
      heatFluxIn: 0,
      heatFluxOut: 0,
      collapsed: false,
      collapseProgress: 0,
      collapseReason: ''
    };
  }

  loadPreset(presetKey) {
    const presets = {
      shuttle: [
        { matId: 'rcc_carbon', thicknessMm: 12 },
        { matId: 'hrsi_tile', thicknessMm: 36 },
        { matId: 'frci_felt', thicknessMm: 18 }
      ],
      mars_pica: [
        { matId: 'pica_ablator', thicknessMm: 38 },
        { matId: 'aerogel', thicknessMm: 22 },
        { matId: 'frci_felt', thicknessMm: 14 }
      ],
      jwst_cryo: [
        { matId: 'mli_foil', thicknessMm: 24 },
        { matId: 'aerogel', thicknessMm: 38 },
        { matId: 'mli_foil', thicknessMm: 16 }
      ],
      fragile_test: [
        { matId: 'mli_foil', thicknessMm: 12 },
        { matId: 'hrsi_tile', thicknessMm: 22 },
        { matId: 'aerogel', thicknessMm: 15 }
      ]
    };

    const list = presets[presetKey] || presets.shuttle;
    this.state.layers = list.map(item => this.createLayer(item.matId, item.thicknessMm));
    this.reset();
  }

  reset() {
    this.state.running = false;
    this.state.time = 0;
    this.state.history = [];
    this.state.missionFailed = false;

    const initT = this.getAmbientTemp();
    this.state.baseTemp = initT;

    this.state.layers.forEach(l => {
      l.thicknessMm = l.initialThicknessMm;
      l.recessionMm = 0;
      l.charRatio = 0;
      l.delaminated = false;
      l.temp = initT;
      l.prevTemp = initT;
      l.heatFluxIn = 0;
      l.heatFluxOut = 0;
      l.collapsed = false;
      l.collapseProgress = 0;
      l.collapseReason = '';
    });

    const st = this.state.singleTile;
    st.surfaceTemp = initT;
    st.tipTemp = initT;
    st.seamTemp = initT;
    st.recessionMm = 0;
    st.collapsed = false;
    st.collapseReason = '';

    this.audio.update(false, this.state.testMode, this.state.powerMultiplier);
  }

  step(dt) {
    this.audio.update(this.state.running, this.state.testMode, this.state.powerMultiplier);
    if (!this.state.running) return;

    const subSteps = 14;
    const subDt = (dt * this.state.speed) / subSteps;

    for (let s = 0; s < subSteps; s++) {
      this.state.time += subDt;
      if (this.state.specimenMode === 'stack') {
        this._solveMultiLayerStep(subDt);
      } else {
        this._solveSingleTileStep(subDt);
      }
    }

    if (this.state.history.length === 0 || this.state.time - this.state.history[this.state.history.length - 1].t >= 0.2) {
      const temps = this.state.specimenMode === 'stack'
        ? this.state.layers.map(l => l.temp)
        : [this.state.singleTile.tipTemp, this.state.singleTile.surfaceTemp, this.state.singleTile.seamTemp];

      this.state.history.push({
        t: this.state.time,
        temps,
        baseT: this.state.baseTemp
      });
      if (this.state.history.length > 240) this.state.history.shift();
    }
  }

  _computeExternalHeatFlux(surfaceTemp, emissivity, isAblative) {
    const mode = this.state.testMode;
    const pwr = this.state.powerMultiplier;

    if (mode === 'plasma') {
      const plasmaGasT = 4100 * Math.pow(pwr, 0.42);
      let hConv = 680 * pwr;

      if (isAblative && surfaceTemp > 1100) {
        const blowingFactor = Math.min(0.42, ((surfaceTemp - 1100) / 1800) * 0.42);
        hConv *= (1 - blowingFactor);
      }

      const qConv = Math.max(0, hConv * (plasmaGasT - surfaceTemp));
      const qRadOut = emissivity * SIGMA * (Math.pow(surfaceTemp, 4) - Math.pow(300, 4));
      return { qNet: qConv - qRadOut, sinkT: 293.15 };
    }

    if (mode === 'cryo') {
      const outerTemp = 380 * Math.pow(pwr, 0.35);
      const qRad = emissivity * SIGMA * (Math.pow(outerTemp, 4) - Math.pow(surfaceTemp, 4));
      const qGas = 3.5 * (outerTemp - surfaceTemp);
      const sinkT = this.state.cryoFluid === 'LH2' ? 20.0 : 77.0;
      return { qNet: qRad + qGas, sinkT };
    }

    // TVAC 모드 (12초 태양광 조사 / 12초 심우주 냉각)
    const cyclePos = this.state.time % 24;
    this.state.tvacPhase = cyclePos < 12 ? 'solar' : 'eclipse';
    if (this.state.tvacPhase === 'solar') {
      const solarFlux = 14500 * pwr;
      const qAbs = solarFlux * Math.max(0.12, emissivity);
      const qLoss = emissivity * SIGMA * (Math.pow(surfaceTemp, 4) - Math.pow(4, 4));
      return { qNet: qAbs - qLoss, sinkT: 293.15 };
    } else {
      const qCool = -emissivity * SIGMA * (Math.pow(surfaceTemp, 4) - Math.pow(77, 4)) * 3.8;
      return { qNet: qCool, sinkT: 293.15 };
    }
  }

  _solveMultiLayerStep(dt) {
    const N = this.state.layers.length;
    if (N === 0) return;

    const surfLayer = this.state.layers[0];
    const surfMat = TPS_MATERIALS[surfLayer.matId];
    const effEmiss = surfLayer.collapsed ? 0.95 : surfMat.emissivity;

    const { qNet, sinkT } = this._computeExternalHeatFlux(surfLayer.temp, effEmiss, surfMat.ablative && !surfLayer.collapsed);

    // PICA 삭마 침식 계산
    if (this.state.testMode === 'plasma' && surfMat.ablative && !surfLayer.collapsed && surfLayer.temp > 1500) {
      const rate = ((surfLayer.temp - 1500) / 1500) * 0.35 * this.state.powerMultiplier;
      surfLayer.recessionMm += rate * dt;
      surfLayer.thicknessMm = Math.max(2.0, surfLayer.initialThicknessMm - surfLayer.recessionMm);
      surfLayer.charRatio = Math.min(1, surfLayer.recessionMm / (surfLayer.initialThicknessMm * 0.6));

      if (surfLayer.thicknessMm <= 2.5) {
        this._failLayer(0, `삭마재 두께 완전 소진으로 열관통 발생`);
      }
    }

    const fluxes = new Array(N + 1).fill(0);
    fluxes[0] = qNet;

    for (let i = 0; i < N - 1; i++) {
      const L1 = this.state.layers[i];
      const L2 = this.state.layers[i + 1];
      const m1 = TPS_MATERIALS[L1.matId];
      const m2 = TPS_MATERIALS[L2.matId];

      const k1 = L1.collapsed ? 48.0 : m1.conductivity;
      const k2 = L2.collapsed ? 48.0 : m2.conductivity;
      const d1 = (L1.collapsed ? L1.thicknessMm * 0.25 : L1.thicknessMm) / 1000;
      const d2 = (L2.collapsed ? L2.thicknessMm * 0.25 : L2.thicknessMm) / 1000;

      const contactRes = L1.delaminated ? 0.015 : 0.0005;
      const rTotal = (d1 / (2 * k1)) + (d2 / (2 * k2)) + contactRes;
      fluxes[i + 1] = (L1.temp - L2.temp) / rTotal;
    }

    const lastL = this.state.layers[N - 1];
    const lastM = TPS_MATERIALS[lastL.matId];
    const kLast = lastL.collapsed ? 48.0 : lastM.conductivity;
    const dLast = (lastL.collapsed ? lastL.thicknessMm * 0.25 : lastL.thicknessMm) / 1000;
    const rBase = (dLast / (2 * kLast)) + ((BASE_STRUCTURE.thicknessMm / 1000) / (2 * BASE_STRUCTURE.conductivity));
    fluxes[N] = (lastL.temp - this.state.baseTemp) / rBase;

    for (let i = 0; i < N; i++) {
      const L = this.state.layers[i];
      const mat = TPS_MATERIALS[L.matId];
      L.prevTemp = L.temp;
      L.heatFluxIn = fluxes[i];
      L.heatFluxOut = fluxes[i + 1];

      const effMass = mat.density * (L.thicknessMm / 1000) * (L.collapsed ? 0.35 : 1.0);
      const heatCap = Math.max(10, effMass * mat.specificHeat);
      L.temp = Math.max(4, L.temp + ((fluxes[i] - fluxes[i + 1]) / heatCap) * dt);

      if (!L.delaminated && !L.collapsed && i < N - 1 && L.temp > 880 && mat.id !== 'rcc_carbon') {
        L.delaminated = true;
        this.onEvent(`⚡ [L${i + 1} 층간 박리] 접착 계면 열화로 미세 간극(Delamination) 발생`, 'warning');
      }

      if (!L.collapsed) {
        const dTdt = Math.abs(L.temp - L.prevTemp) / dt;
        if (L.temp >= mat.meltingPoint) {
          this._failLayer(i, `한계 융점(${mat.meltingPoint}K) 초과로 용융 붕괴`);
        } else if (mat.brittle && dTdt > 290 && L.temp > 720) {
          this._failLayer(i, `열충격(${Math.round(dTdt)}K/s)으로 세라믹 균열 파손`);
        }
      }
    }

    this._updateBaseStructure(fluxes[N], sinkT, dt);
  }

  _solveSingleTileStep(dt) {
    const st = this.state.singleTile;
    const mat = TPS_MATERIALS[st.matId];
    const shape = TILE_SHAPES[st.shape];
    const array = TILE_ARRAYS[st.array];

    const effEmiss = st.collapsed ? 0.95 : mat.emissivity * shape.radViewFactor;
    const { qNet, sinkT } = this._computeExternalHeatFlux(st.surfaceTemp, Math.min(0.98, effEmiss), mat.ablative && !st.collapsed);

    // 형상별 정체점/선단 끝 열집중 및 배열별 이음매 틈새 침투 계산
    const qSurface = qNet * shape.heatConcentration;
    const qTip = qNet * Math.pow(shape.heatConcentration, 1.35);
    const qSeam = qNet * (0.35 + array.gapIngestionFactor * 1.45);

    const effThickM = Math.max(0.002, (st.thicknessMm - st.recessionMm) / 1000);
    const effMass = mat.density * effThickM * shape.massFactor * (st.collapsed ? 0.35 : 1.0);
    const heatCap = Math.max(12, effMass * mat.specificHeat);

    const kEff = st.collapsed ? 48.0 : mat.conductivity;
    const rCond = (effThickM / kEff) + ((BASE_STRUCTURE.thicknessMm / 1000) / (2 * BASE_STRUCTURE.conductivity));

    // 이음매 틈새 침투 열유속은 기저 구조물(TC-Back)로 직통 누설됨
    const qCondToBase = (st.surfaceTemp - this.state.baseTemp) / rCond;
    const qGapLeakToBase = Math.max(0, qSeam * array.gapIngestionFactor * 0.45);
    const totalFluxToBase = qCondToBase + qGapLeakToBase;

    const prevSurfT = st.surfaceTemp;
    st.surfaceTemp = Math.max(4, st.surfaceTemp + ((qSurface - qCondToBase) / heatCap) * dt);
    st.tipTemp = Math.max(4, st.tipTemp + ((qTip - qCondToBase * 1.1) / (heatCap * 0.65)) * dt);
    st.seamTemp = Math.max(4, st.seamTemp + ((qSeam - qGapLeakToBase) / (heatCap * 0.8)) * dt);

    // PICA 삭마 처리
    if (this.state.testMode === 'plasma' && mat.ablative && !st.collapsed && st.surfaceTemp > 1500) {
      st.recessionMm += ((st.surfaceTemp - 1500) / 1500) * 0.35 * this.state.powerMultiplier * dt;
    }

    // 파손 및 열팽창 응력 파괴 판정
    if (!st.collapsed) {
      const maxLocalT = Math.max(st.surfaceTemp, st.tipTemp);
      const dTdt = Math.abs(st.surfaceTemp - prevSurfT) / dt;
      const thermalStressIndex = dTdt * shape.stressFactor * array.thermalStressMult;

      if (maxLocalT >= mat.meltingPoint) {
        this._failSingleTile(`국부 최고온도(${Math.round(maxLocalT)}K)가 융점(${mat.meltingPoint}K)을 초과하여 용융 파손!`);
      } else if (mat.brittle && thermalStressIndex > 340 && st.surfaceTemp > 680) {
        this._failSingleTile(`${array.name} 열팽창 구속 응력 한계 초과로 취성 균열 파열!`);
      }
    }

    this._updateBaseStructure(totalFluxToBase, sinkT, dt);
  }

  _updateBaseStructure(fluxToBase, sinkT, dt) {
    const baseCap = BASE_STRUCTURE.density * (BASE_STRUCTURE.thicknessMm / 1000) * BASE_STRUCTURE.specificHeat;
    if (this.state.testMode === 'cryo') {
      this.state.baseTemp = sinkT;
    } else {
      const qLoss = 0.25 * SIGMA * (Math.pow(this.state.baseTemp, 4) - Math.pow(sinkT, 4));
      this.state.baseTemp += ((fluxToBase - qLoss) / baseCap) * dt;
    }

    if (!this.state.missionFailed && this.state.testMode !== 'cryo' && this.state.baseTemp >= BASE_STRUCTURE.maxTemp) {
      this.state.missionFailed = true;
      this.onEvent(`🚨 [시험 불합격] 기저 선체 온도(TC-Back)가 구조 한계(${BASE_STRUCTURE.maxTemp}K)를 초과했습니다!`, 'danger');
    }
  }

  _failLayer(idx, reason) {
    const L = this.state.layers[idx];
    if (L.collapsed) return;
    L.collapsed = true;
    L.collapseReason = reason;
    this.audio.playCollapseAlarm();
    this.onCollapse({ mode: 'stack', layerIndex: idx, reason });
  }

  _failSingleTile(reason) {
    const st = this.state.singleTile;
    if (st.collapsed) return;
    st.collapsed = true;
    st.collapseReason = reason;
    this.audio.playCollapseAlarm();
    this.onCollapse({ mode: 'single_tile', reason });
  }
}


// ===================== 2부: HOLO 연결 (Claude) =====================
const MOD = 'insulation', U = HOLO.util, K0 = 273.15;
const MATS = TPS_MATERIALS;
const noEmoji = s => String(s).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim();
// 앱 기본 단열재 카드 → Gemini 재료
const MAP = { hex: 'hrsi_tile', pica: 'pica_ablator', blanket: 'frci_felt', mli: 'mli_foil', rcc: 'rcc_carbon' };
const PRESETS = {
 shuttle: ['우주왕복선형', [['rcc_carbon', 12], ['hrsi_tile', 36], ['frci_felt', 18]]],
 mars_pica: ['화성 PICA형', [['pica_ablator', 38], ['aerogel', 22], ['frci_felt', 14]]],
 jwst_cryo: ['극저온 MLI형', [['mli_foil', 24], ['aerogel', 38], ['mli_foil', 16]]],
 fragile_test: ['약한 조합(실패 체험)', [['mli_foil', 12], ['hrsi_tile', 22], ['aerogel', 15]]],
};
const LATENT = { LH2: 446e3, LN2: 199e3 }; // 증발 잠열 J/kg (약)
const FLUID = { LH2: '액체수소 (20 K)', LN2: '액체질소 (77 K)' };

// 부품의 다층 설계 읽기: 부품에 직접 저장된 설계 → 붙은 카드의 층 정보 → 기본 단열재 대응 → 우주왕복선형
function getDesign(p) {
 if (p.x_tps && Array.isArray(p.x_tps.layers)) return p.x_tps;
 const c = p.tps && HOLO.cards[p.tps];
 if (c && Array.isArray(c.layers)) return { mode: c.x_mode === 'single_tile' ? 'single_tile' : 'stack', layers: c.layers.map(l => ({ m: l.m, t: l.t })), tile: c.x_tile ? Object.assign({}, c.x_tile) : defTile(c.layers[0] && c.layers[0].m) };
 if (p.tps && MAP[p.tps]) return { mode: 'stack', layers: [{ m: MAP[p.tps], t: p.tpsT || 30 }, { m: 'frci_felt', t: 10 }], tile: defTile(MAP[p.tps]) };
 return { mode: 'stack', layers: PRESETS.shuttle[1].map(([m, t]) => ({ m, t })), tile: defTile() };
}
function defTile(m) { return { m: m || 'hrsi_tile', t: 35, shape: 'curved', array: 'staggered' }; }
function editDesign(p) { if (!p.x_tps) p.x_tps = JSON.parse(JSON.stringify(getDesign(p))); return p.x_tps; }
function stackStats(d) {
 const L = d.layers.filter(l => MATS[l.m]), tt = L.reduce((a, l) => a + l.t, 0) || 1;
 const R = L.reduce((a, l) => a + l.t / 1000 / MATS[l.m].conductivity, 0), areal = L.reduce((a, l) => a + l.t / 1000 * MATS[l.m].density, 0);
 return { tt, R, areal, keff: (tt / 1000) / Math.max(R, 1e-9), rho: areal / (tt / 1000), cp: L.reduce((a, l) => a + l.t * MATS[l.m].specificHeat, 0) / tt };
}

// 시뮬레이션 실행 (시험 시작 때 한 번에 계산하고, 애니메이션은 기록을 재생)
function runSim(p, mode, opt) {
 const d = getDesign(p), events = [], fails = [];
 const sim = new HoloTPSSimulator({ onEvent: (m, lv) => events.push({ t: sim.state.time, m: noEmoji(m), lv }), onCollapse: c => fails.push({ t: sim.state.time, ...c }) });
 const saved = Object.assign({}, BASE_STRUCTURE);
 Object.assign(BASE_STRUCTURE, { name: p.mat.name, density: p.mat.rho, conductivity: p.mat.k, specificHeat: p.mat.cp, thicknessMm: p.t, maxTemp: p.mat.Tmax + K0 });
 try {
  const S = sim.state; S.testMode = mode; S.cryoFluid = opt.fluid || 'LH2'; S.powerMultiplier = opt.power || 1; S.specimenMode = d.mode === 'single_tile' ? 'single_tile' : 'stack';
  S.layers = d.layers.filter(l => MATS[l.m]).map(l => sim.createLayer(l.m, l.t));
  Object.assign(S.singleTile, { matId: d.tile.m, thicknessMm: d.tile.t, shape: d.tile.shape, array: d.tile.array });
  sim.reset(); S.running = true;
  const T = opt.dur, dt = 0.1, frames = [], every = T / 240; let next = 0, failT = null;
  const snap = () => frames.push({ t: S.time, base: S.baseTemp, tvac: S.tvacPhase,
   temps: S.specimenMode === 'stack' ? S.layers.map(l => l.temp) : [S.singleTile.tipTemp, S.singleTile.surfaceTemp, S.singleTile.seamTemp],
   thick: S.layers.map(l => l.thicknessMm), col: S.specimenMode === 'stack' ? S.layers.map(l => l.collapsed) : [S.singleTile.collapsed], del: S.layers.map(l => l.delaminated), rec: S.singleTile.recessionMm });
  snap();
  while (S.time < T) { sim.step(dt); if (S.time >= next) { snap(); next += every; } if (failT == null && (fails.length || S.missionFailed)) failT = S.time; }
  snap();
  const maxBase = Math.max(...frames.map(f => f.base));
  return { d, frames, events, fails, failT, maxBase, mission: S.missionFailed, T };
 } finally { Object.assign(BASE_STRUCTURE, saved); }
}
const frameAt = (r, tau) => { const t = Math.min(1, tau) * r.T; let a = r.frames[0]; for (const f of r.frames) { if (f.t > t) break; a = f; } return a; };
const layerLabel = (d, i) => d.mode === 'single_tile' ? ['선단', '표면', '이음매'][i] : `L${i + 1} ${MATS[d.layers[i].m].shortName}`;

function buildResult(kind, p, r, extra) {
 const lim = p.mat.Tmax + K0, failed = r.failT != null, why = r.fails.length ? r.fails[0].reason : r.mission ? `바닥 구조(${p.mat.name}) 온도가 한계 ${p.mat.Tmax}°C를 넘음` : '';
 const delam = r.events.filter(e => /박리/.test(e.m)).length;
 return Object.assign({
  ok: !failed, ms: failed ? -1 : (lim - r.maxBase) / Math.max(lim - 293, 1), cap: lim, failAt: failed ? r.failT / r.T : null, aux: { r },
  load: tau => frameAt(r, tau).base,
  hud: tau => { const f = frameAt(r, tau); return { rows: [['경과', `${U.nf(f.t, 0)} / ${r.T} s`]].concat(f.temps.slice(0, 4).map((T, i) => [layerLabel(r.d, i) + (f.col[i] ? ' (파손)' : ''), `${U.nf(T, 0)} K`]), [['바닥 구조', `${U.nf(f.base - K0, 0)} °C`]]), v: f.base, max: Math.max(lim * 1.1, r.maxBase * 1.05), marks: [[lim, '구조 한계', '#ff5d73']] }; },
  sum: failed ? noEmoji(why) : `${r.T}초 견딤 · 바닥 구조 최고 ${U.nf(r.maxBase - K0, 0)}°C (한계 ${p.mat.Tmax}°C)`,
  detail: `${r.d.mode === 'single_tile' ? `타일 한 장 · ${TILE_SHAPES[r.d.tile.shape].name} · ${TILE_ARRAYS[r.d.tile.array].name}` : r.d.layers.map(l => `${MATS[l.m].shortName} ${l.t}mm`).join(' + ')}${delam ? ` · 층간 박리 ${delam}회` : ''}`,
  failLabel: '단열재 파손!', runLabel: '가열 중…',
 }, extra || {});
}

// ---------- 시험 3종 ----------
const segBtn = (key, cfg, opts, def) => `<div class="seg">${opts.map(([v, l]) => `<button data-cfg="${key}" data-val="${v}" class="${String(cfg[key] ?? def) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
const numRow = (key, cfg, def, label, unit) => `<div class="fld"><label>${label}</label><span></span><span class="num"><input type="number" data-cfgn="${key}" value="${cfg[key] ?? def}" min="1" max="3600" step="10"> ${unit}</span></div>`;
HOLO.registerTest({
 id: 'tp_arc', deform: deformFor, rig: rigFor, name: '다층 아크젯', cat: 'insul', dur: 8000,
 desc: '플라즈마 아크젯(약 4,000 K 가스)을 여러 층 단열재에 쏴요. 층마다 온도·박리·삭마를 따로 계산하고, 바닥 구조가 재질 한계 온도를 넘거나 층이 무너지면 실패예요.',
 cfgHtml: (p, cfg) => `<p class="note">단열재 구성은 아래 “다층 단열재 설계”에서 바꿔요.</p>${segBtn('tp_pw', cfg, [[0.75, '약하게'], [1, '보통'], [1.5, '강하게'], [2, '매우 강하게']], 1)}${numRow('tp_dur', cfg, 300, '시험 시간', 's')}`,
 evaluate(p, cfg) { const r = runSim(p, 'plasma', { power: +(cfg.tp_pw || 1), dur: Math.max(10, +(cfg.tp_dur || 300)) }); return buildResult('tp_arc', p, r); },
});
HOLO.registerTest({
 id: 'tp_cryo', deform: deformFor, rig: rigFor, name: '극저온', cat: 'insul', dur: 7000,
 desc: '탱크 안을 극저온 액체로 채우고 바깥(약 380 K)에서 들어오는 열을 재요. 새어 든 열만큼 추진제가 끓어 사라져요(증발 손실). 열 유입이 30 W/m² 이하면 통과예요.',
 cfgHtml: (p, cfg) => `${segBtn('tp_fluid', cfg, [['LH2', '액체수소'], ['LN2', '액체질소']], 'LH2')}${numRow('tp_cdur', cfg, 600, '시험 시간', 's')}`,
 evaluate(p, cfg) {
  const fluid = cfg.tp_fluid || 'LH2', r = runSim(p, 'cryo', { fluid, dur: Math.max(10, +(cfg.tp_cdur || 600)) }), d = r.d;
  const sink = fluid === 'LH2' ? 20 : 77, Rb = (p.t / 1000) / p.mat.k;
  const R = d.mode === 'single_tile' ? (d.tile.t / 1000) / MATS[d.tile.m].conductivity : stackStats(d).R;
  const q = (380 - sink) / (R + Rb + 0.02), A = U.massOf(p).A, kgph = q * A * 3600 / LATENT[fluid], ok = q <= 30 && !r.fails.length;
  const base = buildResult('tp_cryo', p, r);
  return Object.assign(base, { ok, ms: 30 / q - 1, cap: 30, load: tau => q * Math.min(1, tau / 0.6),
   hud: tau => { const f = frameAt(r, tau); return { rows: [['액체', FLUID[fluid]], ['겉면 온도', `${U.nf(f.temps[0], 0)} K`], ['열 유입', `${U.nf(q * Math.min(1, tau / 0.6), 1)} W/m²`], ['증발 손실', `${U.nf(kgph * Math.min(1, tau / 0.6), 1)} kg/h`]], v: q * Math.min(1, tau / 0.6), max: Math.max(36, q * 1.15), marks: [[30, '허용', '#ffc24a']] }; },
   failAt: ok ? null : 0.62, failLabel: '열이 너무 많이 새어 들어와요', runLabel: '냉각 중…',
   sum: `열 유입 ${U.nf(q, 1)} W/m² → ${fluid === 'LH2' ? '수소' : '질소'} 증발 ${U.nf(kgph, 1)} kg/h (겉넓이 ${U.nf(A, 0)} m²)${r.fails.length ? ' · ' + noEmoji(r.fails[0].reason) : ''}`,
   detail: `정상 상태 열저항 ${U.nf(R + Rb, 2)} m²·K/W · ${base.detail}` });
 },
});
HOLO.registerTest({
 id: 'tp_tvac', deform: deformFor, rig: rigFor, name: '열진공', cat: 'insul', dur: 8000,
 desc: '진공 챔버에서 햇빛(12초)과 그늘(12초)을 번갈아 반복해요. 우주에서 궤도를 돌 때의 온도 변화예요. 반복 중에 깨지거나 바닥 구조가 한계를 넘으면 실패예요.',
 cfgHtml: (p, cfg) => numRow('tp_cyc', cfg, 5, '반복 횟수', '회'),
 evaluate(p, cfg) { const n = Math.max(1, Math.min(40, Math.round(+(cfg.tp_cyc || 5)))); const r = runSim(p, 'tvac', { dur: n * 24 }); return buildResult('tp_tvac', p, r, { runLabel: '햇빛·그늘 반복 중…' }); },
});

// ---------- 홀로그램 연출: 단면 온도 막대 + 시험 장비 ----------
const kCol = T => { const c = U.bb(T - K0); if (c) return `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0.55, c[3])})`; return T < 120 ? 'rgba(160,210,255,.9)' : T < 250 ? 'rgba(90,150,220,.85)' : 'rgba(63,140,170,.75)'; };
function drawSection(c, x0, y0, h, r, f) {
 const d = r.d, n = f.temps.length, w = 34, thick = d.mode === 'single_tile' ? [1, 1, 1] : f.thick, tt = thick.reduce((a, b) => a + b, 0) || 1; let y = y0;
 c.font = '600 11px "IBM Plex Sans KR",sans-serif'; c.textBaseline = 'middle';
 for (let i = 0; i < n; i++) { const hh = Math.max(10, h * thick[i] / tt); c.fillStyle = kCol(f.temps[i]); c.fillRect(x0, y, w, hh - 2); if (f.col[i]) { c.strokeStyle = '#ff5d73'; c.lineWidth = 2; c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + w, y + hh - 2); c.moveTo(x0 + w, y); c.lineTo(x0, y + hh - 2); c.stroke(); } if (f.del[i]) { c.fillStyle = '#ffc24a'; c.fillRect(x0, y + hh - 3, w, 2); } c.fillStyle = 'rgba(216,246,255,.9)'; c.fillText(`${layerLabel(d, i)} ${Math.round(f.temps[i])}K`, x0 + w + 6, y + hh / 2); y += hh; }
 c.fillStyle = kCol(f.base); c.fillRect(x0, y + 2, w, 10); c.fillStyle = 'rgba(216,246,255,.9)'; c.fillText(`바닥 구조 ${Math.round(f.base - K0)}°C`, x0 + w + 6, y + 7);
 c.fillStyle = 'rgba(134,173,191,.9)'; c.fillText('단면 온도 (바깥 → 안)', x0, y0 - 12);
}
function deformFor(L, tau, T) {
 const r = T.R.aux.r, f = frameAt(r, tau), surf = f.temps[0], col = kCol(surf), cold = T.kind === 'tp_cryo';
 return { dx: () => 0, rm: () => 1, hm: 1, tint: f.col.some(Boolean) ? '255,93,115' : cold ? '160,210,255' : null,
  heat: (cxu, y0, h, rf) => { const c = HOLO.ctx; c.save(); c.globalCompositeOperation = 'lighter'; const cx = cxu(0.5), R = Math.max(rf(0.5), 4), g = c.createLinearGradient(cx - R, 0, cx + R, 0); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.globalAlpha = cold ? 0.35 : 0.8; c.fillRect(cx - R * 1.1, y0 - h, R * 2.2, h); c.restore(); } };
}
function rigFor(L, tau, now, dt, T, H) {
 const c = H.ctx, r = T.R.aux.r, f = frameAt(r, tau), cx = H.geo.cx, h = L.y0 - L.y1, ny = L.y0 - h * 0.5, rx = cx - Math.max(L.rf(0.5), 6), mr = Math.max(L.mr, 12), running = !T.done;
 const sx = Math.max(12, rx - Math.max(210, mr * 3.2) - 120); drawSection(c, sx, Math.max(40, ny - 90), 180, r, f);
 if (T.kind === 'tp_arc' && running) { const nx = Math.max(sx + 150, rx - 170), jw = Math.min(h * 0.32, 56) + 8; c.globalCompositeOperation = 'lighter'; const g = c.createLinearGradient(nx, 0, rx, 0); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.3, 'rgba(255,120,230,.7)'); g.addColorStop(1, 'rgba(150,90,255,.3)'); c.fillStyle = g; c.beginPath(); c.moveTo(nx, ny - jw * 0.3); c.quadraticCurveTo((nx + rx) / 2, ny - jw * (0.6 + 0.08 * Math.sin(now / 40)), rx, ny - jw); c.lineTo(rx, ny + jw); c.quadraticCurveTo((nx + rx) / 2, ny + jw * 0.6, nx, ny + jw * 0.3); c.closePath(); c.fill(); if (Math.random() < 0.5) T.parts.push({ x: rx, y: ny + (Math.random() - 0.5) * jw * 1.6, vx: -1 - Math.random() * 3, vy: (Math.random() - 0.5) * 5, r: 1.5, life: 1, spark: true }); }
 if (T.kind === 'tp_cryo' && running && Math.random() < 0.6) T.parts.push({ x: cx + (Math.random() - 0.5) * mr * 2.2, y: L.y0 - Math.random() * h, vx: (Math.random() - 0.5) * 1.2, vy: 0.3 + Math.random() * 0.6, r: 4 + Math.random() * 8, life: 1 });
 if (T.kind === 'tp_tvac') { const sun = f.tvac === 'solar' && running, lx = Math.max(sx + 160, rx - 150); c.globalCompositeOperation = 'lighter'; const g = c.createRadialGradient(lx, ny, 2, lx, ny, 70); g.addColorStop(0, sun ? 'rgba(255,240,180,.95)' : 'rgba(60,80,120,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(lx, ny, 70, 0, Math.PI * 2); c.fill(); c.globalCompositeOperation = 'source-over'; U.label(sun ? '햇빛' : '그늘', lx - 16, ny + 84, sun ? '#ffc24a' : '#86adbf'); }
}

// ---------- 설계 패널: 다층 단열재 ----------
const opt = (obj, sel) => Object.values(obj).map(m => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${U.esc(m.name)}</option>`).join('');
HOLO.registerPanel({
 id: 'tp_design', title: '다층 단열재 설계',
 html(p) {
  const d = getDesign(p), st = stackStats(d), single = d.mode === 'single_tile';
  const bar = d.layers.map(l => `<span title="${U.esc(MATS[l.m].name)} ${l.t} mm" style="flex:${l.t};background:${MATS[l.m].baseColor};border-right:1px solid #050b14"></span>`).join('');
  return `<div class="seg"><button data-xt="mode" data-v="stack" class="${single ? '' : 'on'}">여러 층 쌓기</button><button data-xt="mode" data-v="single_tile" class="${single ? 'on' : ''}">타일 한 장 (형상·배열)</button></div>
  ${single ? `<label class="row"><span>재료</span><select data-xt="tm">${opt(MATS, d.tile.m)}</select></label>
   <div class="fld"><label>두께</label><span></span><span class="num"><input type="number" data-xt="tt" value="${d.tile.t}" min="2" max="200" step="1"> mm</span></div>
   <label class="row"><span>형상</span><select data-xt="shape">${opt(TILE_SHAPES, d.tile.shape)}</select></label><p class="note" style="margin:0 0 6px">${U.esc(TILE_SHAPES[d.tile.shape].desc)}</p>
   <label class="row"><span>배열</span><select data-xt="array">${opt(TILE_ARRAYS, d.tile.array)}</select></label><p class="note" style="margin:0">${U.esc(TILE_ARRAYS[d.tile.array].desc)}</p>`
  : `<div class="lbl">바깥(플라즈마 쪽) → 안(기체 벽 쪽)</div>
   ${d.layers.map((l, i) => `<div class="fld" style="grid-template-columns:minmax(0,1fr) auto auto"><select data-xt="lm" data-i="${i}" style="background:#06111f;border:1px solid #23506f;border-radius:7px;padding:5px;font-size:14px">${opt(MATS, l.m)}</select><span class="num"><input type="number" data-xt="lt" data-i="${i}" value="${l.t}" min="1" max="200" step="1"> mm</span><span class="tb" style="margin:0"><button class="b" data-xt="up" data-i="${i}" ${i ? '' : 'disabled'} aria-label="위로" style="min-height:30px;padding:3px 8px">▲</button><button class="b" data-xt="del" data-i="${i}" ${d.layers.length > 1 ? '' : 'disabled'} aria-label="층 빼기" style="min-height:30px;padding:3px 8px">×</button></span></div>`).join('')}
   <div style="display:flex;height:14px;border-radius:4px;overflow:hidden;margin:6px 0">${bar}</div>
   <p class="note" style="margin:0">${d.layers.map(l => `${MATS[l.m].shortName} ${U.nf(l.t / st.tt * 100, 0)}%`).join(' · ')}</p>
   <div class="derived"><div><b>${U.nf(st.tt, 0)} mm</b>전체 두께</div><div><b>${U.nf(st.areal, 1)} kg/m²</b>면적당 질량</div><div><b>${U.nf(st.R, 2)}</b>열저항 m²K/W</div></div>
   <div class="tb"><button class="b" data-xt="add" ${d.layers.length >= 6 ? 'disabled' : ''}>층 추가</button>${Object.entries(PRESETS).map(([k, v]) => `<button class="b" data-xt="pre" data-v="${k}">${v[0]}</button>`).join('')}</div>`}
  <div class="tb"><button class="b hot" data-xt="save">단열재 카드로 저장</button></div>
  <p class="note">재료 값과 계산은 Gemini 엔진(대표값)을 써요. 저장한 카드는 단열재 덱에 들어가고, 다른 부품에도 붙일 수 있어요.</p>`;
 },
 bind(root, p) {
  const redo = () => { U.touched(p); HOLO.refresh(); };
  root.addEventListener('click', e => { const b = e.target.closest('[data-xt]'); if (!b || b.tagName !== 'BUTTON') return; const d = editDesign(p), i = +b.dataset.i, k = b.dataset.xt; U.snap();
   if (k === 'mode') d.mode = b.dataset.v;
   else if (k === 'add') d.layers.push({ m: 'frci_felt', t: 10 });
   else if (k === 'del') d.layers.splice(i, 1);
   else if (k === 'up' && i > 0) [d.layers[i - 1], d.layers[i]] = [d.layers[i], d.layers[i - 1]];
   else if (k === 'pre') d.layers = PRESETS[b.dataset.v][1].map(([m, t]) => ({ m, t }));
   else if (k === 'save') return saveCard(p);
   redo(); });
  root.addEventListener('change', e => { const t = e.target, k = t.dataset.xt; if (!k) return; const d = editDesign(p), i = +t.dataset.i; U.snap();
   if (k === 'lm') d.layers[i].m = t.value; else if (k === 'lt') d.layers[i].t = Math.max(1, Math.min(200, +t.value || 1));
   else if (k === 'tm') d.tile.m = t.value; else if (k === 'tt') d.tile.t = Math.max(2, Math.min(200, +t.value || 2));
   else if (k === 'shape') d.tile.shape = t.value; else if (k === 'array') d.tile.array = t.value;
   redo(); });
 },
});
function saveCard(p) {
 const d = getDesign(p), layers = d.mode === 'single_tile' ? [{ m: d.tile.m, t: d.tile.t }] : d.layers, st = stackStats({ layers }), top = MATS[layers[0].m];
 const name = d.mode === 'single_tile' ? `${top.shortName} 타일` : layers.map(l => MATS[l.m].shortName).join('+');
 const id = HOLO.saveCustomCard({ cat: 'tp', kind: 'tps', name, desc: `${layers.length}층 · ${U.nf(st.tt, 0)} mm · ${U.nf(st.areal, 1)} kg/m²`,
  col: top.baseColor, pat: top.id === 'hrsi_tile' ? 'hex' : top.ablative ? 'speck' : top.id === 'mli_foil' ? 'sheen' : top.id === 'frci_felt' ? 'quilt' : top.id === 'rcc_carbon' ? 'weave' : 'none',
  tk: st.keff, trho: st.rho, tcp: st.cp, tT: top.meltingPoint - K0, teps: top.emissivity, tdef: Math.round(st.tt), abl: top.ablative, tA: 1227, Qs: 25,
  layers: layers.map(l => ({ m: l.m, t: l.t })), x_mode: d.mode, x_tile: d.mode === 'single_tile' ? d.tile : null });
 U.snap(); p.tps = id; p.tpsT = Math.round(st.tt); U.touched(p); HOLO.refresh();
 U.toast(`‘${name}’ 단열재 카드를 저장하고 이 부품에 붙였어요`);
}
})();
