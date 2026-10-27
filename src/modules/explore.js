/* Exploração (spec B, C): escolha da área, passos na grama alta, itens achados e a tabela de encontros.
   O passeio fica em G.outing ({ area, hp, maxHp, steps, startedAt }); cada passo já paga o custo e grava.
   O encontro sorteado vai para G.enc na hora (antes da animação) e a batalha (battle.js) assume. */
extendDefaults({ prog: { lastArea: 'floresta', stepsSinceStone: 0, exploreLockUntil: 0, fossilFind: 0, legend: {}, charm: false } });

const EX_AREAS = { floresta: 'FLORESTA DE VIRIDIAN', vulcao: 'MONTE BRASA', praia: 'ILHAS ESPUMA' };
const EX_KEYS = Object.keys(EX_AREAS);
/* Tabela de encontros */
// nunca selvagens: formas de pedra (16) e de troca (4), fósseis (estágio 0), iniciais 1/4/7 e lendários (regra própria)
const EX_NEVER = new Set([26, 31, 34, 36, 38, 40, 45, 59, 62, 71, 91, 103, 121, 134, 135, 136, 65, 68, 76, 94, 138, 140, 142, 1, 4, 7, ...LEGENDS]);
const EX_NOCT = new Set([41, 42, 43, 44, 48, 49, 52, 53, 35, 39, 92, 93, 96, 97, 88, 89, 109, 110, 104, 105]);
const EX_DIUR = new Set([10, 11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 84, 85, 83, 123]);
const EX_TIERS = ['C', 'I', 'R', 'MR'];
// exceções à regra da taxa de captura (índice em EX_TIERS)
const EX_TIER_FIX = { 25: 1, 63: 1, 133: 2, 131: 2, 137: 2, 147: 2, 148: 2, 132: 3, 113: 3, 143: 3, 115: 3, 128: 3, 123: 3, 127: 3, 149: 3, 139: 3, 141: 3, 2: 3, 3: 3, 5: 3, 6: 3, 8: 3, 9: 3 };
const EX_PHASE_W = { NOITE: [50, 28, 16, 6], DIA: [55, 28, 13, 4] };
const EX_LEG = { 144: { area: 'praia', lv: P => clamp(P + 5, 35, 50) }, 145: { area: 'floresta', lv: P => clamp(P + 5, 35, 50) },
  146: { area: 'vulcao', lv: P => clamp(P + 5, 35, 50) }, 150: { night: true, lv: P => clamp(P + 8, 45, 70) }, 151: { lv: P => clamp(P, 30, 50) } };

function exTier(id) {
  if (id in EX_TIER_FIX) return EX_TIER_FIX[id];
  const cr = DEX[id].catch; let t = cr >= 190 ? 0 : cr >= 120 ? 1 : cr >= 45 ? 2 : 3;
  return DEX[id].stage === 2 ? Math.min(3, t + 1) : t;   // 3º estágio sobe um nível de raridade
}
const exTierOpen = t => t < 2 || (t === 2 && G.prog.badges >= 1) || (t === 3 && G.prog.badges >= 3);
// iniciais evoluídos viram selvagens (MR) na insígnia 5; OMASTAR e KABUTOPS na 6
function exWildOk(id) {
  if (EX_NEVER.has(id)) return false;
  if ([2, 3, 5, 6, 8, 9].includes(id)) return G.prog.badges >= 5;
  if (id === 139 || id === 141) return G.prog.badges >= 6;
  return exTierOpen(exTier(id));
}
function exTimeF(id, ph) {
  let f = 1;
  if (EX_NOCT.has(id)) f *= ph === 'NOITE' ? 3 : ph === 'DIA' ? .5 : 1;
  if (EX_DIUR.has(id) && ph === 'NOITE') f *= .3;
  if ((ph === 'AMANHECER' || ph === 'ENTARDECER') && (id === 25 || id === 63 || id === 133)) f *= 1.5;
  if (ph === 'ENTARDECER' && DEX[id].types.includes('FANTASMA')) f *= 2;
  return f;
}
function exPick(list, wf) {
  let sum = 0; const w = list.map(x => (sum += wf(x), sum));
  if (!(sum > 0)) return null;
  const r = Math.random() * sum; return list[w.findIndex(v => r < v)];
}
// lendário elegível nesta área e fase? Sorteia com a pena (2% + 3% por falha); no pós-jogo, 2% fixo uma vez por semana
function exRollLegend(area, ph, now) {
  for (const id of [144, 145, 146, 150, 151]) {
    const r = EX_LEG[id], L = G.prog.legend[id];
    const unlocked = id === 151 ? !!((G.prog.legend[150] && G.prog.legend[150].caught) || dexHas('caught', 150)) : !!(L && L.unlockedAt);
    if (!unlocked || (r.area && r.area !== area) || (r.night && ph !== 'NOITE') || (L && L.backAt > now)) continue;
    const caught = (L && L.caught) || dexHas('caught', id);
    if (caught && !G.hof) continue;
    let p = caught ? .02 : .02 + .03 * (L ? L.misses || 0 : 0);
    if (id === 151 && ph === 'AMANHECER') p *= 3;
    if (Math.random() < p) { if (caught) btLegendRec(id).backAt = now + 7 * 864e5; return id; }
    if (!caught) btLegendRec(id).misses = (btLegendRec(id).misses || 0) + 1;
  }
  return 0;
}
// sorteio do encontro, na ordem da spec: novidade garantida > lendário > raridade > espécie
function exRollEncounter(area, ph = phaseAt()) {
  const now = Date.now(), all = [];
  for (let id = 1; id <= 151; id++) if (exWildOk(id)) all.push(id);
  let id = 0, legend = false, pity = false;
  if (G.prog.sinceNew >= 7) {
    const pool = all.filter(i => !dexHas('caught', i));
    if (pool.length) { id = pool[randInt(0, pool.length - 1)]; pity = true; }
  }
  if (!id) { id = exRollLegend(area, ph, now); legend = !!id; }
  if (!id) {
    const tw = EX_PHASE_W[ph === 'NOITE' ? 'NOITE' : 'DIA'];
    let t = exPick([0, 1, 2, 3].filter(exTierOpen), i => tw[i]);
    for (; t >= 0 && !id; t--) id = exPick(all.filter(i => exTier(i) === t),
      i => (dexHas('caught', i) ? 1 : 3) * (biomeOf(i) === area ? 1 : .15) * exTimeF(i, ph)) || 0;
    if (!id) id = 16;
  }
  const P = s.level, d = DEX[id];
  let lv;
  if (legend) lv = EX_LEG[id].lv(P);
  else { const fl = [2, 10, 18][Math.min(2, d.stage)]; lv = clamp(Math.round(.85 * P) + randInt(-2, 1) + exTier(id), fl, Math.max(fl, P + 6)); }
  lv = clamp(lv, 1, 100);
  const maxHp = btStats(id, lv).hp, L = legend && G.prog.legend[id];
  const hp = L && L.hp > 0 && now < L.hpUntil ? Math.min(L.hp, maxHp) : maxHp;
  // emboscada noturna: não-noturnos às vezes estão dormindo
  const asleep = !legend && ph === 'NOITE' && !EX_NOCT.has(id) && Math.random() < .2;
  return { sp: id, lv, shiny: Math.random() < (G.prog.charm ? 1 / 256 : 1 / 512), hp, maxHp, asleep, sleepTurns: asleep ? randInt(1, 3) : 0,
    turn: 0, area, id: btRid(), owner: BT_TAB, at: now, legend, pity, petHp0: null, animar: false, pump: false, endured: false,
    introDone: false, owe: false, done: null };
}

/* Passeio */
function exNewOuting(area) {
  const max = btStats(s.sp, s.level).hp;
  return { area: EX_AREAS[area] ? area : 'floresta', hp: Math.min(max, Math.ceil(max * (.5 + s.energy / 200))), maxHp: max, steps: 0, startedAt: Date.now() };
}
// condições para sair e para cada passo (null = pode)
function exBlock() {
  const n = N(), lock = G.prog.exploreLockUntil - Date.now();
  if (s.asleep) return 'Está dormindo... deixe-o descansar.';
  if (s.sick) return `${n} está doente. Cuide dele primeiro.`;
  if (s.pendingEvo) return `Hã? ${n} está prestes a evoluir! Hora de voltar para casa.`;
  if (s.berry) return `Primeiro deixe ${n} comer a FRUTA!`;
  if (lock > 0) return `${n} ainda está se recuperando... (${Math.ceil(lock / 60e3)}min)`;
  if (s.energy < 25) return `${n} está cansado demais para explorar.`;
  if (s.hunger < 20) return 'Está com fome! Dê uma fruta antes de sair.';
  if (s.happy < 15) return `${n} não está com vontade de sair...`;
  return null;
}
// START → EXPLORAR (ou tecla E): lista de áreas no estilo FRLG, com o cursor na última usada
function exOpen() {
  if (!G || scene !== 'habitat' || evo || pendingChoice || training) return Sfx.deny();
  syncFromStorage(); if (!G || scene !== 'habitat') return;
  // encontro pendente (recarregou, ou outra aba): resolve ele antes de sair de novo
  if (G.enc) { Menu.closeAll(); if (exTakeEnc('user') === 'busy') Sfx.deny(); return; }
  const why = exBlock(); if (why) { Menu.closeAll(); sayNow(why); return Sfx.deny(); }
  Menu.open({ title: 'EXPLORAR', sel: Math.max(0, EX_KEYS.indexOf(G.prog.lastArea)),
    items: [...EX_KEYS.map(k => ({ label: EX_AREAS[k], fn: () => { Menu.closeAll(); exStart(k); } })), { label: 'VOLTAR', fn: () => Menu.close() }] });
}
function exStart(area) {
  if (G.enc) { if (exTakeEnc('user') === 'busy') Sfx.deny(); return; }
  const why = exBlock(); if (why) { sayNow(why); return Sfx.deny(); }
  G.prog.lastArea = area; G.outing = exNewOuting(area); save();
  go('explorar', { area });
}
addStartItem({ label: 'EXPLORAR', order: 10, fn: exOpen });
HAB_KEYS.e = exOpen;

/* Cena */
const EX = { tok: 0, phase: 'idle', walkT: 0, transT: 0, item: null, parts: [] };
const EX_ICO = {
  grass: ['.H...H...', '.H.H.H.H.', 'HG.H.GHH.', 'HGHGHGHGH', 'GGGGGGGGG', 'GGHGGGHGG'],
  map: ['KKKKKKKKK', 'KGGCCGGGK', 'KGCCGGYGK', 'KGGGGGGGK', 'KGGRGGCCK', 'KGGGGCCCK', 'KKKKKKKKK'],
  house: ['....K....', '...KRK...', '..KRRRK..', '.KRRRRRK.', 'KKKKKKKKK', '.KWWWWWK.', '.KDDWCWK.', '.KDDWWWK.', '.KKKKKKK.'],
};
const exIco = k => bmSvg(EX_ICO[k], BT_PAL);
function exKnobs() {
  const ph = EX.phase, ask = ph === 'ask', off = !(ph === 'idle' || ask);
  const k = [
    ask ? { label: 'SIM', icon: 'SIM', fn: () => pendingChoice && answer(true) } : { label: 'ANDAR', icon: exIco('grass'), fn: exStep, disabled: off },
    { label: 'BOLSA', icon: btIco(BT_BM.bag), fn: () => exFromAsk() && exBag(), disabled: off },
    { label: 'ÁREA', icon: exIco('map'), fn: () => exFromAsk() && exArea(), disabled: off },
    ask ? { label: 'NÃO', icon: 'NÃO', fn: () => pendingChoice && answer(false) } : { label: 'CASA', icon: exIco('house'), fn: () => EX.phase === 'idle' && exHome(), disabled: off },
  ];
  k.center = { fn: () => { if (pendingChoice) return; if (!msgAdvance() && EX.phase === 'idle') exStep(); } };
  return k;
}
function exSetPhase(p) { EX.phase = p; if (scene === 'explorar' && !Menu.top) setKnobs(exKnobs()); }
// BOLSA/ÁREA com a pergunta aberta: fecha a pergunta e fica parado na grama
function exFromAsk() {
  if (EX.phase === 'ask') { closeChoice(); exSetPhase('idle'); }
  return EX.phase === 'idle';
}
SCENES.explorar = {
  get knobs() { return exKnobs(); },
  enter(arg) {
    ADV.tw = []; EX.tok++; EX.item = null; EX.parts = []; EX.walkT = 0;
    if (!G.outing) G.outing = exNewOuting(G.prog.lastArea);
    EX.phase = 'idle';
    if (arg && arg.after) { exSetPhase('wait'); exAfter(); }
    else sayNow(`${EX_AREAS[G.outing.area]}! Toque em ANDAR para entrar na grama alta.`);
  },
  exit() { ADV.tw = []; EX.tok++; if (pendingChoice && EX.phase === 'ask') closeChoice(); },
  update(dt) {
    advTick(dt);
    if (EX.phase === 'walk') {
      const before = EX.walkT; EX.walkT += dt;
      if (Math.floor(before / .4) !== Math.floor(EX.walkT / .4)) Sfx.noise(.12, { freq: 2800 + Math.random() * 1200, q: .9, vol: .13 });   // farfalhar
    }
    if (EX.phase === 'trans') EX.transT += dt;
    for (const p of EX.parts) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    EX.parts = EX.parts.filter(p => p.life < p.max);
  },
  draw(c) { exDraw(c); },
  key(e, k) {
    // botão focado: Enter/Espaço passa a mensagem, senão deixa o clique nativo acontecer (o núcleo cancelaria)
    if (e.target.closest && e.target.closest('button') && (k === 'enter' || k === ' ')) { if (e.repeat || msgAdvance()) e.preventDefault(); return true; }
    if ((k === 'enter' || k === ' ' || k === 'z') && !e.repeat) { e.preventDefault(); if (!msgAdvance() && EX.phase === 'idle') exStep(); return true; }
    if ((k === 'x' || k === 'escape' || k === 'backspace') && EX.phase === 'idle') { e.preventDefault(); exHome(); return true; }
    if (k === 'i' && EX.phase === 'idle') { exBag(); return true; }
    return false;
  },
};
function exHome() {
  if (G) { G.outing = null; save(); say(`${N()} voltou para casa.`); }
  goHome();
}
async function exStep() {
  if (EX.phase !== 'idle' || scene !== 'explorar' || pendingChoice) return Sfx.deny();
  syncFromStorage(); if (!G || scene !== 'explorar') return;
  // nunca sorteia por cima de um encontro guardado (outra aba ou recarregamento)
  if (G.enc) { const r = exTakeEnc('user'); if (r === 'busy') Sfx.deny(); else if (r !== 'battle') goHome(); return; }
  if (!G.outing) G.outing = exNewOuting(G.prog.lastArea);
  const tok = EX.tok, why = exBlock();
  if (why) { Sfx.deny(); exSetPhase('wait'); await talk(why); return tok === EX.tok && exHome(); }
  // custo do passo, gravado já (recarregar não devolve)
  const mul = MUL(), now = Date.now();
  s.energy = clamp(s.energy - 6 * mul.e); s.hunger = clamp(s.hunger - 4 * mul.h); s.hygiene = clamp(s.hygiene - 4);
  s.happy = clamp(s.happy + 1); s.lastAttention = now;
  G.outing.steps++; G.prog.stepsSinceStone++; save(); updateUI();
  EX.walkT = 0; exSetPhase('walk'); Sfx.click();
  sayNow(`${N()} entrou na grama alta...`);
  await advWait(3); if (tok !== EX.tok) return;
  if (Math.random() < .85) {
    const enc = exRollEncounter(G.outing.area);
    G.enc = enc; dexMark(enc.sp, false); G.prog.sinceNew++; save();
    fire('encounter', enc);
    EX.transT = 0; exSetPhase('trans');
    Sfx.seq([[1046, .06], [784, .06], [1046, .06], [784, .06], [1318, .14]], { vol: .07 });
    await advWait(RM.matches ? .5 : 1.1); if (tok !== EX.tok) return;
    go('batalha');
  } else {
    exSetPhase('item'); await exItem(); if (tok === EX.tok) exAfter();
  }
}
// item achado (tabela da spec B, com as trocas por insígnia e a pena da pedra)
async function exItem() {
  const o = G.outing, b = G.prog.badges, area = o.area;
  let k = G.prog.stepsSinceStone >= 40 ? 'stone'
    : exPick(['poke', 'great', 'ultra', 'pocao', 'stone', 'doce', 'cabo', 'oran', 'fossil'], x => ({ poke: 35, great: 12, ultra: 5, pocao: 14, stone: 18, doce: 5, cabo: 4, oran: 5, fossil: 2 })[x]);
  if (k === 'ultra' && b < 4) k = 'great';
  if (k === 'great' && b < 2) k = 'poke';
  if (k === 'cabo' && b < 3) k = 'pocao';
  if (k === 'fossil' && area !== 'vulcao') k = 'poke';
  if (k === 'stone') { k = area === 'floresta' ? (phaseAt() === 'NOITE' ? 'lua' : 'folha') : area === 'vulcao' ? (Math.random() < .5 ? 'fogo' : 'trovao') : 'agua'; G.prog.stepsSinceStone = 0; }
  if (k === 'fossil') { k = ['helix', 'domo', 'ambar'][G.prog.fossilFind % 3]; G.prog.fossilFind++; }
  EX.item = { k, t: 0 };
  for (let i = 0; i < 5; i++) EX.parts.push({ x: 120 + (Math.random() - .5) * 20, y: 96, vx: (Math.random() - .5) * 40, vy: -20 - Math.random() * 20, life: 0, max: .8 });
  Sfx.seq([[784, .08], [1046, .08], [1318, .16]], { vol: .07 });
  if (k === 'oran') {   // comida na hora, não vai para a BOLSA
    s.hunger = clamp(s.hunger + 15); save(); updateUI();
    await talk('Você encontrou FRUTA ORAN!'); Sfx.crunch(); await talk(`${N()} comeu a FRUTA ORAN ali mesmo!`);
  } else {
    bagAdd(k, 1); save();
    await talk(`Você encontrou ${ITEMS[k].name}!`); await talk(`Você guardou ${ITEMS[k].name} na BOLSA.`);
  }
  EX.item = null;
}
// depois de batalha ou item: confere as condições (senão volta sozinho) e pergunta se continua
async function exAfter() {
  const tok = EX.tok;
  exSetPhase('wait');
  await advQuiet(); if (tok !== EX.tok || scene !== 'explorar') return;
  syncFromStorage(); if (!G || scene !== 'explorar') return;
  const why = exBlock();
  if (why) { Sfx.deny(); await talk(why); return tok === EX.tok && exHome(); }
  exSetPhase('ask');
  ask('Continuar explorando?', yes => { exSetPhase('idle'); if (yes) exStep(); else exHome(); });
}
function exBag() {
  if (EX.phase !== 'idle') return Sfx.deny();
  const o = G.outing;
  Menu.open({ title: 'BOLSA', items: [
    { label: 'POÇÃO', sub: '×' + (G.bag.pocao || 0), disabled: !bagHas('pocao'), fn: () => {
      if (o.hp >= o.maxHp) { sayNow(`O PS de ${N()} já está cheio!`); return Sfx.deny(); }
      bagUse('pocao'); const n = Math.min(20, o.maxHp - o.hp); o.hp += n; save(); Menu.closeAll(); Sfx.happy();
      sayNow(`${N()} recuperou ${n} PS!`);
    } },
    ...BALLS.filter(k => G.bag[k] > 0).map(k => ({ label: ITEMS[k].name, sub: '×' + G.bag[k], disabled: true })),
    { label: 'VOLTAR', fn: () => Menu.close() }] });
}
function exArea() {
  if (EX.phase !== 'idle') return Sfx.deny();
  Menu.open({ title: 'ÁREA', sel: Math.max(0, EX_KEYS.indexOf(G.outing.area)),
    items: [...EX_KEYS.map(k => ({ label: EX_AREAS[k], sub: k === G.outing.area ? '◀' : '', fn: () => {
      Menu.closeAll(); if (k === G.outing.area) return;
      G.outing.area = k; G.prog.lastArea = k; save(); Sfx.whoosh(); sayNow(`Você foi para ${EX_AREAS[k]}.`);
    } })), { label: 'VOLTAR', fn: () => Menu.close() }] });
}

/* Ao abrir o jogo / voltar para casa: encontro recente continua (anti-reroll); velho foge; passeio velho acaba */
const exEncFresh = () => G && G.enc && Date.now() - num(G.enc.at, 0) < 30 * 60e3;
let exResumeT = 0;
on('boot', () => { if (G && G.outing && !exEncFresh()) { G.outing = null; save(); } });
on('home', () => {
  if (!G) return;
  if (G.enc) { clearTimeout(exResumeT); exResumeT = setTimeout(exResume, 500); return; }
  if (G.outing) { G.outing = null; save(); }
});
// em casa: espera menus e perguntas fecharem; batalha em outra aba → tenta de novo a cada 15 s (o batimento dela vence em 2 min)
function exResume(how = 'auto') {
  if (!G || !G.enc || scene !== 'habitat') return;
  if (evo || pendingChoice || Menu.top || training) { exResumeT = setTimeout(() => exResume(how), 1000); return; }
  if (exTakeEnc(how) === 'busy') exResumeT = setTimeout(() => exResume('retry'), 15e3);
}
// encontro guardado: conclui o que já foi decidido, retoma o recente (se nenhuma outra aba está nele) ou deixa fugir.
// how: 'user' (avisa já), 'auto' (entra na fila de mensagens), 'retry' (calado)
function exTakeEnc(how) {
  const e = G.enc, nm = DEX[e.sp].name;
  if (!e.id) e.id = btRid();
  if (btElsewhere(e)) {
    const t = 'Batalha em andamento em outra aba.';
    if (how === 'user') sayNow(t); else if (how === 'auto') say(t);
    return 'busy';
  }
  BT.e = e; BT.o = G.outing;
  // resultado já gravado, nocaute ou desmaio sem narração (fechou bem na hora): conclui com as recompensas/penas
  if (e.done || !(e.hp > 0) || (G.outing && !(num(G.outing.hp, 1) > 0))) {
    if (!e.done) btSettle(e.hp > 0 ? { fainted: true } : { won: true }, e);
    btFinish(e, true); return 'done';
  }
  if (exEncFresh() && !s.asleep && !s.sick) {
    if (!G.outing) G.outing = exNewOuting(e.area);
    go('batalha', { resume: true });
    return 'battle';
  }
  if (e.legend) btLegendMiss(e, false);
  G.enc = null; G.outing = null; save();
  say(`O ${nm} selvagem fugiu enquanto você estava fora.`);
  return 'fled';
}
// testes (#dev): as contas da aventura no console
on('boot', () => { if (window.PKG) window.PKG.adv = { BT, EX, ADV, exRollEncounter, exTier, exWildOk, exNewOuting, btStats, btMoves, btChecks, btDamage }; });
// desmaiou de exaustão parado na grama (a simulação continua lá fora): volta para casa
on('tick', () => {
  if (scene === 'explorar' && EX.phase === 'idle' && !Menu.top && s && s.asleep) { say(`${N()} está exausto!`); exHome(); }
});

/* Desenho: o cenário do bioma, a grama alta na frente e o POKéMON andando */
const EX_GEM = { lua: '#b0a8d8', fogo: '#f07030', agua: '#4890f0', trovao: '#f8d030', folha: '#58b048', helix: '#b08850', domo: '#a07850', ambar: '#e8a830', doce: '#58a8f8', pocao: '#c060c0', cabo: '#a0a8b8' };
const EX_GRASS = { floresta: ['#2f6f2a', '#3f8f38', '#5cb048', '#88d060'], vulcao: ['#5a5a28', '#767a34', '#98a040', '#b8c060'], praia: ['#22705a', '#2f9070', '#48b088', '#78d0a8'] };
const exAct = document.createElement('canvas'); exAct.width = W; exAct.height = H;
const exActCtx = exAct.getContext('2d'); exActCtx.imageSmoothingEnabled = false;
// uma fileira de tufos (lâminas afinando para cima); scroll = andar, sway = vento
function exGrass(c, y0, hMax, cols, scroll, walking, seed) {
  const step = 7, sh = ((scroll % step) + step) % step;
  for (let i = -1; i <= W / step + 1; i++) {
    const n = i + Math.floor(scroll / step), x = i * step - sh + ((n * 37 + seed) % 5);
    const near = walking && Math.abs(x - 120) < 30 ? Math.sin(clock * 30 + n) * 2 : 0;
    for (let bl = 0; bl < 3; bl++) {
      const hh = Math.round(hMax * (.6 + (((n * 13 + bl * 7 + seed) % 9) / 9) * .4)), bx = x + bl * 2 - 2;
      const sway = Math.sin(clock * 1.6 + n * .7 + bl) * 1.5 + near, col = cols[(n + bl + seed) % 2 ? 1 : 2];
      for (let yy = 0; yy < hh; yy++) { const k = yy / hh, w = k < .5 ? 2 : 1; R(c, Math.round(bx + sway * k), y0 - yy, w, 1, yy === hh - 1 ? cols[3] : col); }
    }
  }
}
function exDraw(c) {
  const o = G.outing, area = o && EX_AREAS[o.area] ? o.area : 'floresta', cols = EX_GRASS[area], ph = phaseAt();
  drawBiome(c, area, false);
  // atores (grama + POKéMON) numa camada própria, para receber a cor da hora do dia só onde há pixel
  const a = exActCtx; a.clearRect(0, 0, W, H);
  const walking = EX.phase === 'walk', scroll = EX.walkT * 26;
  exGrass(a, 128, 20, cols, scroll * .6, false, 3);
  ctx = a;
  const lift = walking ? Math.floor(EX.walkT * 8) % 2 : 0;
  drawPokemon(monKey(s), 120, 138 - lift, { dir: 1 });
  R(a, 0, 138, W, H - 138, cols[0]);
  exGrass(a, 146, 22, cols, scroll, walking, 0);
  exGrass(a, 160, 18, cols, scroll * 1.3, walking, 5);
  ctx = c;
  if (PHASE_ACTOR[ph]) { a.globalCompositeOperation = 'source-atop'; a.fillStyle = PHASE_ACTOR[ph]; a.fillRect(0, 0, W, H); a.globalCompositeOperation = 'source-over'; }
  c.drawImage(exAct, 0, 0);
  // item achado: aparece sobre a cabeça
  if (EX.item) {
    const k = EX.item.k, y = 78 - Math.round(Math.abs(Math.sin(clock * 5)) * 3), gem = EX_GEM[k];
    if (BALLS.includes(k)) drawBm(c, BT_BM.ball, 117, y, BT_BALL_PAL[k]);
    else if (k === 'oran' && IMG.berry) c.drawImage(IMG.berry, 105, y - 14);
    else if (gem) { disc(c, 120, y + 3, 5, 5, '#202028'); disc(c, 120, y + 3, 4, 4, gem); R(c, 118, y + 1, 2, 2, 'rgba(255,255,255,.7)'); }
    else drawBm(c, BM.star, 118, y, PAL);
  }
  for (const p of EX.parts) if (Math.floor(p.life * 12) % 2 === 0) drawBm(c, BM.star, p.x - 2, p.y - 2, PAL);
  // placa: área e PS do passeio
  if (o) {
    const name = EX_AREAS[area];
    btBox(c, 4, 4, 172, 32);
    btText(c, name, 10, 9);
    btBar(c, 26, 23, 70, o.hp, o.maxHp);
    btText(c, `${o.hp}/${o.maxHp}`, 168, 21, '#404048', 'right');
  }
  // transição FRLG: 3 clarões brancos e barras fechando (sem clarões com "reduzir movimento")
  if (EX.phase === 'trans') {
    const t = EX.transT, fl = RM.matches ? 0 : .6;
    if (t < fl && Math.floor(t / .1) % 2 === 0) R(c, 0, 0, W, H, 'rgba(248,248,248,.9)');
    else if (t >= fl) { const k = Math.min(1, (t - fl) / .45); for (let i = 0; i < 8; i++) { const w = Math.ceil(W * k); R(c, i % 2 ? W - w : 0, i * 20, w, 20, '#000'); } }
  }
}
