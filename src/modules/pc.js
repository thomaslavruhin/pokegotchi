/* ════════════ PC do PROF. CARVALHO ════════════
   12 CAIXAS x 30 (G.pc na ordem de guarda: caixa = índice / 30). Tela cheia em HTML por cima do canvas:
   o ativo à esquerda (fora das caixas), a caixa 6x5 à direita. ESCOLHER: ATIVAR, DADOS, USAR ITEM, TROCAR, SOLTAR.
   Nada daqui guarda POKéMON por referência entre esperas: outra aba pode trocar o G (sempre busca pelo uid). */
extendDefaults({ prog: { fossils: 0, stoneTradeEvos: 0, trades: 0 } });

const PC_BOXES = 12, PC_SLOTS = 30, PC_SWAP_MS = 30 * 60e3;
const PC_WALL = ['#78b0e0', '#88c878', '#e0a070', '#c090d8', '#e0d070', '#70c8c0', '#e08898', '#98a8c8', '#b8c870', '#d8a8e0', '#90d0a8', '#e8b858'];
const pc = { box: 0, cur: 0, row: 0, sheet: null, busy: false, el: null, html: '' };   // cur: 0-29 na caixa, -1 = o ativo
const pc_wait = ms => new Promise(r => setTimeout(r, ms));
const pc_idx = () => pc.box * PC_SLOTS + pc.cur;
const pc_monAt = () => pc.cur < 0 ? s : G.pc[pc_idx()] || null;
const pc_find = uid => G.pc.find(m => m.uid === uid) || null;
const pc_tradeTo = m => (DEX[m.sp].evo.find(e => e.trade) || {}).to;
const pc_types = d => d.types.map(t => `<span class="pc-type" style="background:${TYPE_COLOR[t]}">${t}</span>`).join('');
// o brilhante é montado na 1ª vez (assíncrono): redesenha logo depois para trocar o sprite normal pelo dele
let pc_redraw = 0, pc_tries = 0;   // tentativas limitadas: sem paleta brilhante, fica o normal
const pc_img = m => {
  const k = monKey(m), url = spriteURL(k);
  if (m.shiny && !SHINY_URL[k] && !pc_redraw && pc_tries < 8) { pc_tries++; pc_redraw = setTimeout(() => { pc_redraw = 0; if (!pc.busy) pc_render(); }, 250); }
  return `<img src="${url}" alt="">`;
};

function openPC() {
  if (!G || !s || scene !== 'habitat' || evo || pendingChoice) return Sfx.deny();
  if (training) { say('Termine o treino primeiro!'); return Sfx.deny(); }
  syncFromStorage(); if (!G || scene !== 'habitat') return;
  go('pc'); Sfx.click(); sayNow('Acessou o PC do PROF. CARVALHO.');
}

/* ── desenho (HTML) ── */
function pc_render() {
  if (!pc.el || !G) return;
  pc.box = Math.max(0, Math.min(PC_BOXES - 1, pc.box));
  const base = pc.box * PC_SLOTS, n = G.pc.slice(base, base + PC_SLOTS).length, m = pc_monAt();
  let cells = '';
  for (let i = 0; i < PC_SLOTS; i++) {
    const c = G.pc[base + i];
    cells += `<button type="button" class="pc-cell${i === pc.cur ? ' sel' : ''}" data-slot="${i}" aria-label="${c ? `${N(c)} Nv ${c.level}` : 'vazio'}">` +
      (c ? pc_img(c) + (c.shiny ? '<i class="pc-shiny">✦</i>' : '') : '') + '</button>';
  }
  const info = !m ? '<div class="pc-nm">—</div><div class="pc-dim">VAZIO</div>' :
    `<div class="pc-nm">${N(m)}${m.shiny ? ' ✦' : ''}</div><div>Nv ${m.level}</div><div class="pc-types">${pc_types(DEX[m.sp])}</div>`;
  const html =
    `<div class="pc-side">` +
      `<button type="button" class="pc-card pc-act${pc.cur < 0 ? ' sel' : ''}" data-slot="-1"><span class="pc-lbl">HABITAT</span>${pc_img(s)}<span class="pc-nm">${N(s)}${s.shiny ? ' ✦' : ''}</span><span>Nv ${s.level}</span></button>` +
      `<div class="pc-card pc-info">${info}<div class="pc-dim pc-total">PC ${G.pc.length}/${PC_BOXES * PC_SLOTS}</div></div>` +
    `</div><div class="pc-main">` +
      `<div class="pc-head"><button type="button" class="pc-arr" data-d="-1" aria-label="Caixa anterior">◀</button><span class="pc-title">CAIXA ${pc.box + 1} <small class="pc-dim">${n}/${PC_SLOTS}</small></span><button type="button" class="pc-arr" data-d="1" aria-label="Próxima caixa">▶</button></div>` +
      `<div class="pc-grid" style="--wall:${PC_WALL[pc.box]}">${cells}</div>` +
    `</div>` + (pc.sheet != null ? pc_sheetHTML() : '') + `<div class="pc-link" hidden></div>`;
  // só troca o DOM se algo mudou: o tick redesenha a cada 2 s e não pode roubar o toque/foco nem reiniciar o cursor piscando
  if (html !== pc.html) { pc.html = html; pc.el.innerHTML = html; }
}
// ficha (DADOS): o estado congelado no PC (ou o do ativo)
function pc_sheetHTML() {
  // sumiu (outra aba soltou/ativou): fecha a ficha e devolve os botões do PC
  const m = pc.sheet === -1 ? s : pc_find(pc.sheet); if (!m) { pc.sheet = null; if (scene === 'pc') setKnobs(SCENES.pc.knobs); return ''; }
  const d = DEX[m.sp], need = needExp(m.level), dt = new Date(m.caughtAt);
  const bar = (lbl, v) => { v = Math.round(v); return `<div class="pc-bar"><span>${lbl}</span><b><i style="width:${v}%;background:${barColor(v)}"></i></b><span>${v}</span></div>`; };
  return `<div class="pc-sheet" role="dialog" aria-label="Dados de ${d.name}">` +
    `<div class="pc-sh-l">${pc_img(m)}<div>No.${String(d.id).padStart(3, '0')}</div><div class="pc-nm">${d.name}</div>${m.shiny ? '<div class="pc-shtxt">✦ BRILHANTE</div>' : ''}</div>` +
    `<div class="pc-sh-r">` +
      `<div>Nv ${m.level} · EXP ${m.level >= 100 ? 'MAX' : `${Math.floor(m.exp)}/${need}`}${m.sick ? ' <span class="pc-type" style="background:#9850b8">DOENTE</span>' : ''}</div>` +
      `<div class="pc-types">${pc_types(d)}</div>` +
      bar('FOME', m.hunger) + bar('ENERGIA', m.energy) + bar('FELIC.', m.happy) + bar('HIGIENE', m.hygiene) +
      `<div class="pc-evo">${evoText(d)}</div>` +
      `<div class="pc-dim">${pc.sheet === -1 ? 'NO HABITAT' : 'NO PC'} · ${ITEMS[m.ball] ? ITEMS[m.ball].name : ''} · ${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}</div>` +
    `</div></div>`;
}

/* ── cursor e caixas ── */
function pc_box(d) {
  if (pc.busy) return Sfx.deny();
  pc.box = (pc.box + d + PC_BOXES) % PC_BOXES; if (pc.cur < 0) pc.cur = pc.row * 6;
  Sfx.click(); pc_render();
}
function pc_move(dx, dy) {
  if (pc.cur < 0) { if (dx > 0) pc.cur = pc.row * 6; else return; }
  else {
    const x = pc.cur % 6, y = Math.floor(pc.cur / 6);
    if (dx < 0 && x === 0) pc.cur = -1;                               // à esquerda da caixa fica o ativo
    else if (dx > 0 && x === 5) { pc.box = (pc.box + 1) % PC_BOXES; pc.cur = y * 6; }
    else if (dy && (y + dy < 0 || y + dy > 4)) return;
    else pc.cur += dx + dy * 6;
    if (pc.cur >= 0) pc.row = Math.floor(pc.cur / 6);
  }
  Sfx.click(); pc_render();
}
function pc_select(slot) {
  if (slot === pc.cur) return pc_choose();   // tocar de novo no mesmo = ESCOLHER
  pc.cur = slot; if (slot >= 0) pc.row = Math.floor(slot / 6);
  Sfx.click(); pc_render();
}

/* ── ESCOLHER ── */
function pc_choose() {
  if (pc.busy || pendingChoice) return Sfx.deny();
  syncFromStorage(); if (!G || scene !== 'pc') return;
  const m = pc_monAt(); if (!m) { pc_render(); return Sfx.deny(); }
  if (pc.cur < 0) return Menu.open({ title: `${N(s)} Nv ${s.level}`, items: [
    { label: 'DADOS', fn: () => { Menu.closeAll(); pc_openSheet(-1); } }, { label: 'CANCELAR', fn: () => Menu.close() }] });
  const uid = m.uid;
  Menu.open({ title: `${N(m)} Nv ${m.level}`, items: [
    { label: 'ATIVAR', fn: () => pc_activate(uid) },
    { label: 'DADOS', fn: () => { Menu.closeAll(); pc_openSheet(uid); } },
    { label: 'USAR ITEM', fn: () => pc_itemMenu(uid) },
    ...(pc_tradeTo(m) ? [{ label: 'TROCAR', sub: 'x' + (G.bag.cabo || 0), fn: () => pc_trade(uid) }] : []),
    { label: 'SOLTAR', fn: () => pc_release(uid) },
    { label: 'CANCELAR', fn: () => Menu.close() }] });
}

// ATIVAR: em casa, acordado, parado, sem fruta nem sujeira no chão, e 30 min desde a última troca
function pc_swapWhy() {
  if (G.outing) return `${N()} está fora de casa.`;
  if (evo || training) return `${N()} está ocupado agora.`;
  if (s.asleep) return `${N()} está dormindo... Acenda as luzes primeiro.`;
  if (s.berry || pk.mode === 'eat') return `Primeiro deixe ${N()} comer a FRUTA!`;
  if (s.poops.length) return 'Limpe o habitat antes da mudança.';
  const left = G.prog.swapAt + PC_SWAP_MS - Date.now();
  if (left > 0 && G.prog.swapAt <= Date.now()) return `O PC ainda está transferindo dados... (${Math.ceil(left / 60e3)}min)`;
  return null;
}
function pc_activate(uid) {
  syncFromStorage(); if (!G || !pc_find(uid)) { Menu.closeAll(); pc_render(); return Sfx.deny(); }
  const why = pc_swapWhy(); if (why) { sayNow(why); return Sfx.deny(); }
  Menu.closeAll(); goHome();
  // a volta para casa simula o tempo no PC: pode ter aparecido sujeira
  const why2 = pc_swapWhy(); if (why2) { sayNow(why2); return Sfx.deny(); }
  if (!pc_find(uid)) return Sfx.deny();
  const old = N(); swapActive(uid);
  say(`${old}, volte!`); say(`Vai, ${N()}! Eu escolho você!`); Sfx.cry(s.sp);
}

// USAR ITEM num POKéMON do PC: DOCE RARO ou pedra; tudo na hora, sem animação
function pc_itemMenu(uid) {
  const m = pc_find(uid); if (!m) return Sfx.deny();
  const items = [...(bagHas('doce') ? [{ label: `${bag_icon('doce')}${ITEMS.doce.name}`, sub: 'x ' + G.bag.doce, fn: () => pc_candy(uid) }] : []),
    ...bag_stonesFor(m.sp).map(e => ({ label: `${bag_icon(e.k)}${ITEMS[e.k].name}`, sub: 'x ' + G.bag[e.k], fn: () => pc_stone(uid, e.k) }))];
  if (!items.length) { sayNow(`Nenhum item da BOLSA serve para ${N(m)}.`); return Sfx.deny(); }
  Menu.open({ title: 'USAR ITEM', wide: true, items: [...items, { label: 'VOLTAR', fn: () => Menu.close() }] });
}
// evolução na hora (PC): marca a POKéDEX e avisa os módulos como a do habitat
function pc_evolve(m, to) {
  const from = m.sp; m.sp = to; m.happy = clamp(m.happy + 10);
  dexMark(to, true, m.shiny); fire('evolved', m, from); m.pendingEvo = !!levelEvo(m);
  say(`Parabéns! Seu ${DEX[from].name} evoluiu para ${DEX[to].name}!`); Sfx.evoDone();
}
function pc_candy(uid) {
  syncFromStorage(); const m = G && pc_find(uid); if (!m) return Sfx.deny();
  if (!bag_candy(m, false)) return;
  const e = levelEvo(m); if (e) { pc_evolve(m, e.to); save(); }
  Menu.closeAll(); pc_render();
}
async function pc_stone(uid, k) {
  let m = pc_find(uid); const to = m && bag_stoneTo(m.sp, k); if (!to) return Sfx.deny();
  if (bag_stoneEvos(m.sp).length > 1) {   // EEVEE: a pedra escolhe a forma
    bag_preview(to, m.shiny);
    const ok = await confirmYN(`Usar a ${ITEMS[k].name}? ${N(m)} vai evoluir para ${DEX[to].name}!`);
    bag_preview(null); if (!ok || scene !== 'pc') return;
  }
  syncFromStorage(); m = G && pc_find(uid);
  if (!m || bag_stoneTo(m.sp, k) !== to || !bagUse(k)) return Sfx.deny();
  G.prog.stoneTradeEvos++; pc_evolve(m, to); save();
  Menu.closeAll(); pc_render();
}

// TROCAR: gasta 1 CABO DE TROCA; o resultado é gravado antes da animação (recarregar no meio não perde nem duplica nada)
async function pc_trade(uid) {
  let m = pc_find(uid); const to = m && pc_tradeTo(m); if (!to) return Sfx.deny();
  if (!bagHas('cabo')) { sayNow('Você precisa de um CABO DE TROCA.'); return Sfx.deny(); }
  const ok = await confirmYN(`Usar 1 CABO DE TROCA para trocar ${N(m)}?`); if (!ok || scene !== 'pc') return;   // fechado de fora: vale NÃO
  syncFromStorage(); m = G && pc_find(uid);
  if (!m || pc_tradeTo(m) !== to || !bagUse('cabo')) return Sfx.deny();
  const from = m.sp, shiny = m.shiny;
  m.sp = to; m.happy = clamp(m.happy + 10); m.pendingEvo = !!levelEvo(m);
  G.prog.trades++; G.prog.stoneTradeEvos++; dexMark(to, true, shiny); fire('evolved', m, from); save();
  Menu.closeAll(); pc.busy = true;
  // botões apagados enquanto a troca roda (só A/toque passam as mensagens)
  setKnobs(Object.assign(SCENES.pc.knobs.map(d => ({ ...d, disabled: true })), { center: null }));
  const k = id => 'f' + id + (shiny ? 's' : '');
  try {
    // a frase do FRLG não cabe nas 3 linhas da caixa no celular: vai em duas
    await talk(`PROF. CARVALHO vai trocar ${DEX[from].name} com um amigo...`); await talk('...e trazê-lo de volta!');
    await pc_linkAnim(k(from), k(to));
    Sfx.evoDone();
    await talk(`Parabéns! Seu ${DEX[from].name} evoluiu para ${DEX[to].name}!`);
  } finally { pc.busy = false; if (scene === 'pc') { setKnobs(SCENES.pc.knobs); const l = pc.el && pc.el.querySelector('.pc-link'); if (l) l.hidden = true; pc_render(); } }
}
// animação do cabo: o POKéMON vai ao outro aparelho, volta e evolui (silhueta piscando)
async function pc_linkAnim(fromKey, toKey) {
  const l = pc.el && pc.el.querySelector('.pc-link'); if (!l) return;
  const fast = RM.matches ? .4 : 1;
  l.innerHTML = '<div class="pc-gba"></div><div class="pc-cable"><i></i></div><div class="pc-gba"></div>' +
    `<img class="pc-lmon" src="${spriteURL(fromKey)}" alt="">`;
  l.hidden = false;
  const im = l.querySelector('.pc-lmon');
  await pc_wait(500 * fast);
  l.classList.add('go'); Sfx.whoosh(); await pc_wait(1300 * fast);
  l.classList.remove('go'); l.classList.add('back'); Sfx.whoosh(); await pc_wait(1300 * fast);
  l.classList.remove('back'); l.classList.add('evo'); Sfx.cry(+fromKey.replace(/\D/g, ''));
  for (let i = 0, n = RM.matches ? 4 : 12; i < n; i++) {
    im.src = spriteURL(i % 2 ? toKey : fromKey); Sfx.blip(320 + i * 70);
    await pc_wait(RM.matches ? 500 : 260 - i * 14);
  }
  im.src = spriteURL(toKey); l.classList.remove('evo'); await pc_wait(300);
}

// SOLTAR: duas confirmações; devolve uma bola (GRANDE BOLA se já evoluiu)
async function pc_release(uid) {
  let m = pc_find(uid); if (!m) return Sfx.deny();
  const name = N(m);
  if (!await confirmYN(`Soltar ${name}?`, { safeNo: true })) return;
  if (!await confirmYN(`Tem certeza? ${name} não vai voltar.`, { safeNo: true }) || scene !== 'pc') return;
  syncFromStorage(); if (!G) return;
  const i = G.pc.findIndex(x => x.uid === uid); if (i < 0) return Sfx.deny();
  const ball = DEX[G.pc[i].sp].stage >= 1 ? 'great' : 'poke';
  const had = G.bag[ball] || 0;
  G.pc.splice(i, 1); bagAdd(ball, 1); save();
  Menu.closeAll(); pc_render();
  // com 99 na BOLSA o bagAdd não soma nada: não dá para dizer que recebeu
  sayNow(`Tchau, ${name}!`); say(G.bag[ball] > had ? `Você recebeu 1 ${ITEMS[ball].name}.` : `A BOLSA já está cheia de ${ITEMS[ball].name}S.`); Sfx.click();
}

/* ── DADOS ── */
function pc_openSheet(uid) {
  pc.sheet = uid; pc_render();
  setKnobs([{ label: 'ANTERIOR', icon: '◀', fn: () => pc_sheetStep(-1) }, null, { label: 'PRÓXIMO', icon: '▶', fn: () => pc_sheetStep(1) },
    { label: 'VOLTAR', icon: '◀', fn: pc_closeSheet }]);
  knobDefs.center = { fn: pc_closeSheet };
  Sfx.click();
}
function pc_closeSheet() { pc.sheet = null; setKnobs(SCENES.pc.knobs); Sfx.click(); pc_render(); }
// anda pela ordem: o ativo, depois o PC; o cursor da caixa acompanha
function pc_sheetStep(d) {
  const list = [-1, ...G.pc.map(m => m.uid)], i = Math.max(0, list.indexOf(pc.sheet)), j = (i + d + list.length) % list.length;
  pc.sheet = list[j];
  if (j === 0) pc.cur = -1; else { pc.box = Math.floor((j - 1) / PC_SLOTS); pc.cur = (j - 1) % PC_SLOTS; pc.row = Math.floor(pc.cur / 6); }
  Sfx.click(); pc_render();
}

function pc_exit() { if (pc.busy || pendingChoice) return Sfx.deny(); Sfx.click(); goHome(); }
SCENES.pc = {
  knobs: Object.assign([
    { label: '◀ CAIXA', icon: '◀', fn: () => pc_box(-1) }, { label: 'ESCOLHER', icon: 'OK', fn: () => pc_choose() },
    { label: 'CAIXA ▶', icon: '▶', fn: () => pc_box(1) }, { label: 'SAIR', icon: 'X', fn: () => pc_exit() }], { center: { fn: () => pc_choose() } }),
  enter() {
    pc.sheet = null; pc.busy = false; pc_tries = 0; pc.html = '';
    pc.el = document.createElement('div'); pc.el.className = 'pc-layer'; pc.el.id = 'pcLayer';
    document.querySelector('.screen-wrap').appendChild(pc.el);
    pc.el.addEventListener('click', pc_click);
    pc_render();
  },
  exit() { if (pendingChoice) closeChoice(); if (pc.el) pc.el.remove(); pc.el = null; pc.sheet = null; pc.busy = false; bag_preview(null); },
  draw(c) { R(c, 0, 0, W, H, '#28406a'); },
  key(e, k) {
    if (pc.busy) return false;   // A/Enter ainda passa as mensagens da troca
    const dir = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] }[k];
    const A = k === 'enter' || k === ' ' || k === 'z', B = k === 'escape' || k === 'x' || k === 'backspace';
    if (!dir && !A && !B && !['q', 'e', 'pageup', 'pagedown'].includes(k)) return false;
    e.preventDefault();
    if (pc.sheet != null) { if (A || B) { if (!e.repeat) pc_closeSheet(); } else if (dir) pc_sheetStep(dir[0] || dir[1]); return true; }
    if (dir) pc_move(dir[0], dir[1]);
    else if (k === 'q' || k === 'pageup') pc_box(-1);
    else if (k === 'e' || k === 'pagedown') pc_box(1);
    else if (e.repeat) return true;
    else if (A) pc_choose();
    else if (B) pc_exit();
    return true;
  },
};
function pc_click(e) {
  if (pc.busy || pendingChoice) return;
  if (Menu.top) { Menu.closeAll(); Sfx.click(); return; }   // tocar fora do menu fecha
  if (pc.sheet != null) return pc_closeSheet();
  const arr = e.target.closest('.pc-arr'); if (arr) return pc_box(+arr.dataset.d);
  const c = e.target.closest('[data-slot]'); if (c) pc_select(+c.dataset.slot);
}
// outra aba mudou o save / a simulação andou: redesenha (sem atrapalhar a animação da troca)
on('tick', () => { if (scene === 'pc' && !pc.busy) pc_render(); });

addStartItem({ label: 'PC', order: 50, fn: openPC });
HAB_KEYS.k = openPC;
