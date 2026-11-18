/* 11-input.js — 카드 끌어 놓기, 캔버스 선택·회전, 앱 시작
   모든 js 파일은 같은 전역 공간을 공유하는 일반 <script>입니다. 순서대로 로드되고, 마지막 99-boot.js가 앱을 시작합니다. */
/* ---------- 끌어 놓기 · 선택 · 회전 ---------- */
function hitPart(px, py) { if (!geo) return null; const r = cv.getBoundingClientRect(), X = px - r.left, Y = py - r.top; const L = layout.find(q => Y <= q.y0 + q.ex + 2 && Y >= q.y1 - 2 && Math.abs(X - geo.cx) <= Math.max(q.mr * 1.4, 26)); return L ? L.p : null; }
function insIndex(py) { const r = cv.getBoundingClientRect(), Y = py - r.top; if (!layout.length) return 0; let best = 0, bd = 1e9; for (let i = 0; i <= layout.length; i++) { const y = i < layout.length ? layout[i].y0 : layout[layout.length - 1].y1, d = Math.abs(Y - y); if (d < bd) { bd = d; best = i; } } return best; }
function overStage(px, py) { const r = cv.getBoundingClientRect(); return px >= r.left && px <= r.right && py >= r.top && py <= r.bottom; }
const CARDS_EL = $('#cards');
CARDS_EL.addEventListener('pointerdown', e => {
 if (e.target.closest('.cbtn') || e.target.closest('[data-new]')) return;
 const el = e.target.closest('[data-card]'); if (!el) return; const id = el.dataset.card, sx = e.clientX, sy = e.clientY, touch = e.pointerType === 'touch'; let started = false, ghost = null;
 const move = ev => { const dx = ev.clientX - sx, dy = ev.clientY - sy;
  if (!started) { if (Math.hypot(dx, dy) < 8) return; const narrow = innerWidth <= 760; if (touch && narrow && Math.abs(dx) > Math.abs(dy) * 1.2) return cleanup(); if (touch && !narrow && Math.abs(dy) > Math.abs(dx)) return cleanup(); started = true; ghost = el.cloneNode(true); ghost.classList.add('ghost'); document.body.appendChild(ghost); S.drag = { id }; }
  ev.preventDefault(); ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; const D = S.drag; D.over = overStage(ev.clientX, ev.clientY);
  if (D.over) { if (CARD[id].cat === 'st' && !isSolo()) { D.ins = insIndex(ev.clientY); D.tgt = null; } else { D.ins = null; D.tgt = hitPart(ev.clientX, ev.clientY); } } };
 const up = () => { if (started) { const D = S.drag; if (D && D.over) apply(id, D.tgt, D.ins); else if (D) toast('투사대 위에 놓아야 붙어요'); } else apply(id, null, null); cleanup(); };
 const cleanup = () => { if (ghost) ghost.remove(); S.drag = null; removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', cleanup); };
 addEventListener('pointermove', move, { passive: false }); addEventListener('pointerup', up); addEventListener('pointercancel', cleanup);
});
CARDS_EL.addEventListener('click', e => {
 if (e.target.closest('[data-new]')) return newPart();
 const ec = e.target.closest('[data-editcard]'); if (ec) { e.stopPropagation(); return editCard(ec.dataset.editcard); }
 const pc = e.target.closest('[data-piccard]'); if (pc) { e.stopPropagation(); return pickCardImage(pc.dataset.piccard); }
 const b = e.target.closest('[data-delcard]'); if (!b) return; e.stopPropagation(); if (!b.classList.contains('arm')) { b.classList.add('arm'); b.textContent = '정말 지울까요?'; setTimeout(() => { if (b.isConnected) { b.classList.remove('arm'); b.textContent = '지우기'; } }, 2500); return; }
 const id = b.dataset.delcard; S.custom = S.custom.filter(c => c.id !== id); S.parts.forEach(p => { if (p.from === id) p.from = null; }); if (S.bench && S.bench.from === id) S.bench.from = null; rebuildCards(); save(); renderDeck(); toast('카드를 지웠어요 · 이미 끼운 부품은 그대로예요'); });
CARDS_EL.addEventListener('keydown', e => { if (e.key !== 'Enter' && e.key !== ' ') return; if (e.target.closest('.cbtn')) return; if (e.target.closest('[data-new]')) { e.preventDefault(); return newPart(); } const el = e.target.closest('[data-card]'); if (el) { e.preventDefault(); apply(el.dataset.card, null, null); } });
let lastTap = { t: 0, uid: null };
cv.addEventListener('pointerdown', e => { const sx = e.clientX, r0 = S.rot; let moved = false; cv.setPointerCapture(e.pointerId);
 const mv = ev => { const dx = ev.clientX - sx; if (Math.abs(dx) > 4) { moved = true; S.dragRot = true; S.rot = r0 + dx * 0.01; } };
 const up = ev => { cv.removeEventListener('pointermove', mv); cv.removeEventListener('pointerup', up); S.dragRot = false; if (moved || isSolo()) return; const p = hitPart(ev.clientX, ev.clientY), now = performance.now();
  if (p && lastTap.uid === p.uid && now - lastTap.t < 380) { lastTap = { t: 0, uid: null }; return openEditor(p.uid); } lastTap = { t: now, uid: p ? p.uid : null };
  if (ep() && p) return openEditor(p.uid); S.sel = p ? p.uid : null; renderSel(); };
 cv.addEventListener('pointermove', mv); cv.addEventListener('pointerup', up); });
cv.addEventListener('pointermove', e => { if (!S.drag) S.hover = isSolo() ? null : hitPart(e.clientX, e.clientY); cv.style.cursor = S.hover ? 'pointer' : 'grab'; });
cv.addEventListener('pointerleave', () => { S.hover = null; });
// 내 카드에 그림 넣기: 고른 이미지를 256px 정사각형으로 줄여 카드에 저장 (Grok 등으로 만든 그림)
function pickCardImage(id) {
 const c = S.custom.find(q => q.id === id); if (!c) return; const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
 inp.onchange = () => { const f = inp.files[0]; if (!f) return; const img = new Image(), url = URL.createObjectURL(f);
  img.onload = () => { const N = 256, cv2 = document.createElement('canvas'); cv2.width = cv2.height = N; const g = cv2.getContext('2d'); g.fillStyle = '#050b14'; g.fillRect(0, 0, N, N); const k = Math.min(N / img.width, N / img.height), w = img.width * k, h = img.height * k; g.drawImage(img, (N - w) / 2, (N - h) / 2, w, h); URL.revokeObjectURL(url);
   c.img = cv2.toDataURL('image/jpeg', 0.86); rebuildCards(); save(); renderDeck(); toast(`‘${c.name}’ 카드에 그림을 넣었어요`); };
  img.onerror = () => toast('이 파일은 그림으로 읽을 수 없어요'); img.src = url; };
 inp.click();
}
