/* js/ext/_template.js — 확장 모듈 견본 (기본으로는 로드되지 않음)
   새 모듈은 이 파일을 복사해서 시작하세요. index.html의 99-boot.js 바로 위에 한 줄로 넣으면 켜집니다.
   규칙: 전역 이름 충돌을 막기 위해 모든 코드를 즉시 실행 함수 안에 넣고, 밖으로는 HOLO만 씁니다. */
(() => {
 const MOD = 'template';                 // 모듈 이름 (저장 공간 키)
 const U = HOLO.util;                    // 도우미 함수 모음

 // 1) 시험 등록: '저울 측정' — 부품 무게를 재는 아주 단순한 예시
 HOLO.registerTest({
  id: 'x_weigh',                          // 고유 id (확장 시험은 x_ 로 시작하기)
  name: '저울',                           // 시험 버튼에 보일 짧은 이름
  desc: '부품을 저울에 올려 질량을 재요. 확장 모듈 API를 보여 주는 견본입니다.',
  cat: 'struct',                          // 'engine'이면 구조 카드의 시험 막대에서 빠짐
  dur: 4000,                              // 애니메이션 길이(ms)
  applies: part => true,                  // 이 부품에서 시험 버튼을 보여 줄지
  cfgHtml: (part, cfg) => `<label class="chk"><input type="checkbox" data-cfgc="x_weigh_dry" ${cfg.x_weigh_dry ? 'checked' : ''}> 추진제 빼고 재기</label>`,
  // 결과 계산: 숫자는 미리 다 계산하고, tau(0~1)에 따른 값을 함수로 돌려줍니다
  evaluate(part, cfg) {
   const m = U.massOf(part), kg = cfg.x_weigh_dry ? m.dry : m.tot, limit = 5e6;   // 저울 한계 5000 t
   const load = tau => kg * Math.min(1, tau / 0.8);
   return {
    ok: kg <= limit, ms: limit / kg - 1, cap: limit, load,
    failAt: kg > limit ? U.firstCross(load, limit) : null,
    hud: tau => ({ rows: [['질량', `${U.nf(load(tau) / 1000, 2)} t`], ['저울 한계', '5,000 t']], v: load(tau), max: Math.max(kg, limit) * 1.1, marks: [[limit, '한계', '#ff5d73']] }),
    sum: `질량 ${U.nf(kg / 1000, 2)} t`, detail: cfg.x_weigh_dry ? '추진제를 뺀 건조 질량' : '추진제를 포함한 질량',
    failLabel: '저울이 부서짐!', runLabel: '재는 중…',
   };
  },
  // 부품 모양 바꾸기(선택): 무게에 눌려 살짝 낮아지는 연출
  deform: (L, tau, T) => ({ dx: () => 0, rm: () => 1, hm: 1 - 0.01 * Math.min(1, tau / 0.8) }),
  // 시험 장비 그리기(선택): ctx는 캔버스 2D, geo.cx는 부품 중심 x, L.y0은 부품 바닥 y
  rig(L, tau, now, dt, T, H) {
   const c = H.ctx, cx = H.geo.cx, w = Math.max(L.mr, 20) * 1.8;
   c.fillStyle = 'rgba(20,50,70,.9)'; c.fillRect(cx - w, L.y0 + 2, w * 2, 14);
   U.label(`${U.nf(T.R.load(tau) / 1000, 1)} t`, cx - 30, L.y0 + 32, '#ffc24a');
  },
 });

 // 2) 설계 패널에 구역 추가
 HOLO.registerPanel({
  id: 'template_info', title: '견본 패널',
  applies: part => true,
  html: part => `<p class="note">이 부품 겉넓이 ${U.nf(U.massOf(part).A, 1)} m²</p><button class="b" data-x-template="hi">눌러 보기</button>`,
  bind(root, part) {
   root.querySelector('[data-x-template="hi"]').onclick = () => {
    const st = HOLO.store(MOD); st.count = (st.count || 0) + 1; HOLO.save();
    U.toast(`견본 버튼을 ${st.count}번 눌렀어요`);
   };
  },
 });

 // 3) 이벤트 구독
 HOLO.on('testDone', ({ kind, part, result }) => { if (kind === 'x_weigh') console.log('[template] 저울 결과', result.sum); });
})();
