/* ════════════ COLHEITA DE FRUTAS (2º minigame do TREINAR, tecla G) ════════════
   30 s pegando o que cai das árvores: FRUTA ORAN, FRUTA SITRUS, PEDRA (atordoa) e POKé BOLA (item de verdade).
   O custo é pago na largada (sair no meio ou recarregar não devolve nada); EXP, felicidade e itens só no fim.
   Contadores do dia: miniGames (só as 5 primeiras partidas dão itens) e miniBalls (teto de 4 bolas/dia).
   miniDate é a data local desses contadores: zera só quando o dia avança (relógio para trás não paga de novo). */
extendDefaults({ prog: { miniBest: 0 }, daily: { miniGames: 0, miniBalls: 0, miniDate: '' } });

const CL_TIME = 30, CL_SPEED = 120, CL_STUN = 1, CL_COUNT = 3;
const CL_STONES = ['lua', 'fogo', 'agua', 'trovao', 'folha'];
// pontos de cada fruta (PEDRA e POKé BOLA não pontuam)
const CL_PTS = { oran: 10, sitrus: 25 };
const CL_RATE = [{ min: 250, txt: 'CRÍTICO!', col: '#f85838' }, { min: 150, txt: 'ÓTIMO!', col: '#f8d030' }, { min: 0, txt: 'BOM', col: '#78d878' }];
const CL_ROCK = ['...KKKK...', '.KKwwggKK.', 'KwwwgggggK', 'KwwggggddK', 'KgggggdddK', 'KggggddddK', '.KdddddKK.', '..KKKKK...'];
const CL_ROCK_PAL = { K: '#383840', w: '#c8c0b0', g: '#988878', d: '#686058' };
// FRUTA SITRUS: bitmap próprio (a ORAN tingida de amarelo virava um borrão sem brilho)
const CL_SITRUS = ['.......GG....', '......GGG....', '.....G.......', '...KKKKKKK...', '..KYYYYYWWK..', '.KYYYYYYYWWK.', 'KYYYYYYYYYWYK', 'KYYYYYYYYYYYK', 'KOYYYYYYYYYYK', 'KOYYYYYYYYYOK', '.KOOYYYYYOOK.', '..KOOOOOOOK..', '...KKKKKKK...'];
const CL_SITRUS_PAL = { K: '#806010', Y: '#f8d030', W: '#fff8c8', O: '#d89818', G: '#58b048' };
const CL_BALL = ['...KKKK...', '.KKRRRRKK.', '.KRWRRRRK.', 'KRWRRRRRrK', 'KKKKwwKKKK', 'KWWKWWKWwK', 'KWWWKKWWwK', '.KWWWWWwK.', '.KKwwwwKK.', '...KKKK...'];
let cl = null;   // a partida em andamento (não persiste: recarregar = desistir)
if (location.hash === '#dev') window.PKG_CL = () => cl;   // teste (só com #dev)

const cl_rating = sc => CL_RATE.find(r => sc >= r.min);
// zera os contadores do minigame quando o dia local avança
function cl_day() {
  const d = G.daily, today = localDate();
  if (today > (d.miniDate || '')) { d.miniDate = today; d.miniGames = 0; d.miniBalls = 0; }
}
// pode sair POKé BOLA agora? (2 por partida e o teto do dia, contando as já pegas nesta partida)
const cl_ballOk = () => cl.balls < 2 && G.daily.miniBalls + cl.balls < 4;

function startColheita() {
  if (blocked()) return Sfx.deny();
  syncFromStorage(); if (!s || scene !== 'habitat') return;   // outra aba pode ter mudado tudo
  const why = trainBlockReason(); if (why) { say(why); return Sfx.deny(); }
  const mul = MUL();
  s.energy = clamp(s.energy - 10 * mul.e); s.hunger = clamp(s.hunger - 4 * mul.h); s.hygiene = clamp(s.hygiene - 3);
  s.lastAttention = Date.now(); cl_day(); save(); updateUI();
  Sfx.click(); go('colheita');
}
TRAIN_MODES.push({ label: 'COLHEITA', fn: startColheita });
HAB_KEYS.g = startColheita;

/* ── entrada: teclas seguradas, toque (segurar metade da tela ou arrastar) e botões ◀ ▶ ── */
const cl_keyDir = () => (cl.keys.r ? 1 : 0) - (cl.keys.l ? 1 : 0);
function cl_release() { if (!cl) return; cl.keys.l = cl.keys.r = false; cl.ptr = null; cl.knob = 0; }
window.addEventListener('keyup', e => {
  if (scene !== 'colheita' || !cl) return;
  const k = e.key.toLowerCase();
  if (k === 'arrowleft' || k === 'a') cl.keys.l = false;
  if (k === 'arrowright' || k === 'd') cl.keys.r = false;
});
window.addEventListener('blur', () => { if (scene === 'colheita') cl_release(); });
// soltou o dedo fora da tela do jogo (ou o navegador cancelou o toque)
['pointerup', 'pointercancel'].forEach(ev => window.addEventListener(ev, e => { if (scene === 'colheita' && cl && cl.ptr && cl.ptr.id === e.pointerId) cl.ptr = null; }));
// segurar o dedo não abre menu de contexto nem seleciona
cv.addEventListener('contextmenu', e => { if (scene === 'colheita') e.preventDefault(); });
// aba escondida no meio da partida: pausa (o relógio do jogo não anda escondido, mas os status sim)
document.addEventListener('visibilitychange', () => { if (document.hidden && scene === 'colheita' && cl && cl.phase !== 'end') { cl_release(); cl_pause(true); } });

function cl_knobs() {
  if (cl.phase === 'end') return setKnobs([null, null, null, { label: 'OK', icon: 'OK', fn: cl_done }]);
  // o clique que vem logo depois de soltar o dedo não conta de novo; sem dedo (tecla 1/2, Enter no botão) = passo curto
  const hold = d => ({ fn: () => { if (cl.knobUpD !== d || performance.now() - cl.knobUp > 400) cl_nudge(d); },
    down: () => { cl.knob = d; }, up: () => { if (cl.knob === d) cl.knob = 0; cl.knobUp = performance.now(); cl.knobUpD = d; } });
  const defs = [{ label: '◀', icon: '◀', ...hold(-1) }, { label: '▶', icon: '▶', ...hold(1) },
    { label: cl.paused ? 'JOGAR' : 'PAUSA', icon: cl.paused ? '▶' : 'II', fn: () => cl_pause(!cl.paused) },
    { label: 'SAIR', icon: 'X', fn: cl_quit }];
  defs.center = { fn: () => { if (cl.paused) cl_pause(false); else msgAdvance(); } };
  setKnobs(defs);
}
// botão apertado pelo teclado (1/2, Enter no botão focado): um passo curto
function cl_nudge(d) { if (cl.phase === 'end' || cl.paused || cl.stun > 0) return; cl.x = clamp(cl.x + d * 16, 16, W - 16); cl.dir = d; }
function cl_pause(on) {
  if (!cl || cl.phase === 'end' || cl.paused === on) return;
  cl.paused = on; if (on) cl_release();
  Sfx.click(); cl_knobs();
}
async function cl_quit() {
  if (!cl) return;
  if (cl.phase === 'end') return cl_done();
  const was = cl.paused; cl_pause(true);
  const yes = await confirmYN('Sair da COLHEITA? O cansaço não volta e não há prêmios.', { safeNo: true });
  if (scene !== 'colheita' || !cl) return;
  if (yes) { cl = null; goHome(); say('Você saiu da COLHEITA.'); }
  else if (!was) cl_pause(false);
}
function cl_done() { if (!cl || cl.phase !== 'end' || cl.endT < .8) return; cl = null; goHome(); }

SCENES.colheita = {
  enter() {
    const f = footOf(monKey(s));
    cl = { uid: s.uid, phase: 'count', t: 0, count: CL_COUNT, paused: false, x: 120, dir: -1, run: 0, stun: 0,
      score: 0, streak: 0, best: 0, oran: 0, balls: 0, caught: 0, drops: [], fx: [], spawnT: .3,
      keys: { l: false, r: false }, ptr: null, knob: 0, knobUp: 0, knobUpD: 0, endT: 0, res: null,
      h: clamp(f.base - (f.top || 0), 16, 56) };
    cv.style.touchAction = 'none';   // arrastar o dedo não rola a página
    cl_knobs(); Sfx.blip(660);
    sayNow('Pegue as FRUTAS que caem! Cuidado com as PEDRAS.');
  },
  exit() { cl = null; cv.style.touchAction = ''; },
  key(e, k) {
    if (!cl) return false;
    if (k === 'arrowleft' || k === 'a') { e.preventDefault(); cl.keys.l = true; return true; }
    if (k === 'arrowright' || k === 'd') { e.preventDefault(); cl.keys.r = true; return true; }
    if (e.repeat) { if (k.startsWith('arrow') || k === ' ') e.preventDefault(); return true; }
    if (k === 'p') { e.preventDefault(); cl_pause(!cl.paused); return true; }
    if (k === 'escape' || k === 'x' || k === 'backspace') { e.preventDefault(); cl_quit(); return true; }
    if (k === 'enter' || k === ' ' || k === 'z') {
      e.preventDefault();
      if (cl.phase === 'end') cl_done(); else if (cl.paused) cl_pause(false); else msgAdvance();
      return true;
    }
    return k.startsWith('arrow');
  },
  pointer(x, y, e) {
    if (!cl) return;
    if (cl.phase === 'end') return cl_done();
    if (cl.paused) return cl_pause(false);
    e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch {}
    cl.ptr = { id: e.pointerId, x0: x, x, side: x < W / 2 ? -1 : 1, drag: false };
  },
  pointerMove(x, y, e) {
    const p = cl && cl.ptr; if (!p || p.id !== e.pointerId) return;
    p.x = clamp(x, 0, W); if (Math.abs(p.x - p.x0) > 6) p.drag = true;
  },
  pointerUp(x, y, e) { if (cl && cl.ptr && cl.ptr.id === e.pointerId) cl.ptr = null; },
  update(dt) {
    if (!cl) return;
    // o POKéMON mudou (outra aba trocou o ativo), dormiu ou adoeceu: a partida acaba sem prêmio
    if (!s || s.uid !== cl.uid || s.asleep || s.sick) { cl = null; goHome(); say('A COLHEITA foi interrompida.'); return; }
    for (const p of cl.fx) { p.life += dt; p.y += p.vy * dt; p.x += (p.vx || 0) * dt; if (p.g) p.vy += p.g * dt; }
    cl.fx = cl.fx.filter(p => p.life < p.max);
    if (cl.phase === 'end') { cl.endT += dt; return; }
    if (cl.paused || pendingChoice) return;
    // 3-2-1: os itens só começam no JÁ!
    if (cl.phase === 'count') {
      const prev = Math.ceil(cl.count); cl.count -= dt; const now = Math.ceil(cl.count);
      if (now !== prev) Sfx.blip(now >= 1 ? 660 : 1320);
      if (cl.count > 0) return;
      if (cl.count <= -.6) cl.phase = 'play';
    }
    cl_play(dt);
  },
  draw() { if (cl) cl_draw(); },
};

function cl_play(dt) {
  cl.t = Math.min(CL_TIME, cl.t + dt);
  const k = cl.t / CL_TIME;
  // movimento: teclas > botão segurado > toque (arrastar segue o dedo; segurar anda para o lado tocado)
  let dir = cl_keyDir() || cl.knob, target = null;
  if (!dir && cl.ptr) { if (cl.ptr.drag) target = cl.ptr.x; else dir = cl.ptr.side; }
  cl.stun = Math.max(0, cl.stun - dt);
  let moved = 0;
  if (cl.stun <= 0) {
    if (target != null) { const d = target - cl.x; moved = Math.abs(d) < 2 ? 0 : Math.sign(d) * Math.min(Math.abs(d), CL_SPEED * dt); }
    else if (dir) moved = dir * CL_SPEED * dt;
    if (moved) { cl.x = clamp(cl.x + moved, 16, W - 16); cl.dir = Math.sign(moved); }
  }
  cl.run = moved ? cl.run + dt : 0;
  // chuva de itens: intervalo 1,2 s -> 0,6 s, queda 40 -> 90 px/s
  if (cl.t < CL_TIME - .4) {
    cl.spawnT -= dt;
    if (cl.spawnT <= 0) { cl.spawnT += 1.2 - .6 * k; cl_spawn(40 + 50 * k); }
  }
  const key = monKey(s), f = footOf(key);
  const cx = Math.round(cl.x) - 32 + (cl.dir > 0 ? 63 - f.cx : f.cx), half = clamp(f.w / 2 + 8, 14, 24);
  for (const d of cl.drops) {
    if (d.done) continue;
    d.y += d.v * dt; d.wob += dt;
    if (d.y >= FEET - cl.h - 4 && d.y <= FEET - 2 && Math.abs(d.x - cx) <= half) { d.done = true; cl_catch(d, cx); }
    else if (d.y >= FEET - 3) { d.done = true; cl_miss(d); }
  }
  cl.drops = cl.drops.filter(d => !d.done);
  // fim do tempo: o que ainda está no ar cai logo, depois o placar
  if (cl.t >= CL_TIME) { if (!cl.drops.length) cl_end(); else cl.drops.forEach(d => { d.v = Math.max(d.v, 140); }); }
}
function cl_spawn(v) {
  const r = Math.random();
  let kind = r < .70 ? 'oran' : r < .82 ? 'sitrus' : r < .97 ? 'rock' : 'ball';
  if (kind === 'ball' && !cl_ballOk()) kind = 'oran';
  // longe do último item, para não cair tudo no mesmo lugar
  let x, tries = 0; do { x = 16 + Math.random() * (W - 32); } while (cl.lastX != null && Math.abs(x - cl.lastX) < 20 && ++tries < 6);
  cl.lastX = x;
  cl.drops.push({ kind, x, y: -8, v, wob: Math.random() * 6 });
}
function cl_pop(txt, x, y, col) { cl.fx.push({ txt, col, x, y, vy: -18, life: 0, max: .9 }); }
function cl_catch(d, cx) {
  if (d.kind === 'rock') {
    cl.stun = CL_STUN; cl.streak = 0; cl_release(); Sfx.deny();
    for (let i = 0; i < 5; i++) cl.fx.push({ dust: true, x: d.x, y: d.y, vx: (Math.random() - .5) * 50, vy: -20 - Math.random() * 30, g: 120, life: 0, max: .5 });
    cl_pop('AI!', cx, FEET - cl.h - 14, '#c0c8d8'); return;
  }
  cl.streak++; cl.best = Math.max(cl.best, cl.streak); cl.caught++;
  if (cl.streak === 5) Sfx.blip(1568);
  const combo = cl.streak > 5 ? 1.5 : 1;
  if (d.kind === 'ball') {
    cl.balls++; Sfx.blip(1046); setTimeout(() => Sfx.blip(1397), 70);
    cl_pop('BOLA!', cx, FEET - cl.h - 14, '#f85838'); return;
  }
  const pts = Math.round(CL_PTS[d.kind] * combo);
  cl.score += pts;
  if (d.kind === 'oran' && cl.oran < 10) { cl.oran++; s.hunger = clamp(s.hunger + 1); }   // come a fruta (até +10 por partida)
  if (d.kind === 'sitrus') Sfx.blip(1318);
  Sfx.crunch();
  cl_pop('+' + pts, cx, FEET - cl.h - 14, combo > 1 ? '#f8d030' : '#f8f8f8');
}
// caiu no chão: fruta ou bola perdida quebra a sequência; pedra só levanta poeira
function cl_miss(d) {
  if (d.kind !== 'rock') cl.streak = 0;
  const col = d.kind === 'rock' ? 'dust' : d.kind === 'ball' ? 'red' : d.kind;
  for (let i = 0; i < 4; i++) cl.fx.push({ [col === 'dust' ? 'dust' : 'bit']: true, col, x: d.x, y: FEET - 3, vx: (Math.random() - .5) * 40, vy: -15 - Math.random() * 20, g: 120, life: 0, max: .45 });
}

/* ── fim: prêmios (com o save mais novo de outra aba) ── */
function cl_end() {
  syncFromStorage();
  if (!s || s.uid !== cl.uid) { cl = null; goHome(); say('A COLHEITA foi interrompida.'); return; }
  cl_day();
  const d = G.daily, sc = cl.score, n = N(), rewarded = d.miniGames < 5, rate = cl_rating(sc);
  d.miniGames++;
  const gain = Math.floor((15 + 1.2 * s.level) * Math.min(1.5, sc / 150));
  s.happy = clamp(s.happy + (sc >= 200 ? 8 : 5)); s.lastAttention = Date.now();
  // bolas (das quedas e dos pontos) dentro do teto de 4 por dia
  const got = { poke: 0, great: 0 };
  const give = k => { if (d.miniBalls >= 4) return; d.miniBalls++; bagAdd(k); got[k]++; };
  for (let i = 0; i < cl.balls; i++) give('poke');
  if (rewarded && sc >= 150) give('poke');
  if (rewarded && sc >= 250) give(G.prog.badges >= 2 ? 'great' : 'poke');
  const stone = rewarded && sc >= 350 && Math.random() < .1 ? CL_STONES[randInt(0, CL_STONES.length - 1)] : null;
  if (stone) bagAdd(stone);
  const record = sc > G.prog.miniBest; if (record) G.prog.miniBest = sc;
  cl.phase = 'end'; cl.endT = 0; cl.drops = []; cl_release();
  cl.res = { rate, gain, got, stone, record, best: G.prog.miniBest };
  cl_knobs(); Sfx.happy();
  sayNow(`Fim da COLHEITA! ${sc} pontos: ${rate.txt}${record ? ' NOVO RECORDE!' : ''}`);
  talk(`${n} ganhou ${gain} EXP e ficou mais feliz.`);
  const bolas = (q, k) => `${q} ${ITEMS[k].name.replace('BOLA', q > 1 ? 'BOLAS' : 'BOLA')}`;
  const list = ['poke', 'great'].filter(k => got[k]).map(k => bolas(got[k], k));
  if (list.length) talk(`Você ganhou ${list.join(' e ')}!`);
  if (stone) talk(`Você encontrou ${ITEMS[stone].name}!`);
  if (!rewarded && sc >= 150) talk('Os prêmios da COLHEITA de hoje acabaram. Volte amanhã!');
  else if (rewarded && sc >= 150 && !list.length) talk('Já ganhou as POKé BOLAS da COLHEITA de hoje.');
  if (s.energy < 20) talk(`${n} está exausto... Deixe-o dormir.`);
  addExp(gain, true); fire('minigame', { score: sc }); save(); updateUI();
}

/* ── desenho ── */
function cl_drawDrop(c, d) {
  const x = Math.round(d.x + (d.kind === 'rock' ? 0 : Math.sin(d.wob * 5) * 1)), y = Math.round(d.y);
  if (d.kind === 'rock') return drawBm(c, CL_ROCK, x - 5, y - 4, CL_ROCK_PAL);
  if (d.kind === 'ball') return drawBm(c, CL_BALL, x - 5, y - 5);
  if (d.kind === 'sitrus') return drawBm(c, CL_SITRUS, x - 6, y - 8, CL_SITRUS_PAL);
  const im = img('berry');
  if (!im) return disc(c, x, y, 5, 5, '#4060c8');
  // a fruta do sprite fica na parte de baixo do quadro 30x30; o centro dela fica em ~(15, 20)
  c.drawImage(im, x - 15, y - 20);
}
function cl_draw() {
  ctx = screenCtx;
  const key = monKey(s), f = footOf(key);
  drawBiome(ctx, biomeOf(s.sp), false);
  // atores numa camada própria, escurecida com a hora do dia como no habitat
  ctx = actorsCtx; ctx.clearRect(0, 0, W, H);
  // sombra de quem está caindo (cresce perto do chão)
  for (const d of cl.drops) { const k = clamp(d.y / FEET, 0, 1); if (k > .3) R(ctx, Math.round(d.x - 2 - 3 * k), FEET - 1, Math.round(4 + 6 * k), 1, 'rgba(20,16,30,.25)'); }
  const lift = cl.run > 0 ? Math.floor(cl.run * 10) % 2 * 2 : 0;
  drawShadow(key, cl.x, cl.dir, lift);
  const blink = cl.stun > 0 && Math.floor(cl.stun * 12) % 2;
  drawPokemon(key, cl.x, FEET - lift, { dir: cl.dir, alpha: blink ? .45 : 1 });
  for (const d of cl.drops) cl_drawDrop(ctx, d);
  const ph = phaseAt();
  if (PHASE_ACTOR[ph]) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = PHASE_ACTOR[ph]; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over'; }
  ctx = screenCtx; ctx.drawImage(actors, 0, 0);
  const cx = Math.round(cl.x) - 32 + (cl.dir > 0 ? 63 - f.cx : f.cx), top = FEET - cl.h - lift;
  // atordoado: estrelinhas girando sobre a cabeça
  if (cl.stun > 0) for (let i = 0; i < 3; i++) { const a = clock * 8 + i * 2.1; drawBm(ctx, BM.star, cx + Math.cos(a) * 10 - 2, top - 6 + Math.sin(a) * 3); }
  for (const p of cl.fx) {
    if (p.txt) pixelText(p.txt, p.x, p.y, p.col);
    else R(ctx, Math.round(p.x), Math.round(p.y), 2, 2, p.dust ? '#a89878' : p.col === 'oran' ? '#4060c8' : p.col === 'sitrus' ? '#f8d030' : '#e83838');
  }
  cl_hud();
  if (cl.phase === 'count') {
    const n = Math.ceil(cl.count);
    cl_big(n >= 1 ? String(n) : 'JÁ!', 120, 58, n >= 1 ? '#f8f8f8' : '#f8d030', n >= 1 ? 3 : 2);
  }
  if (cl.paused && cl.phase !== 'end') {
    ctx.fillStyle = 'rgba(16,16,32,.55)'; ctx.fillRect(0, 0, W, H);
    cl_big('PAUSA', 120, 56, '#f8f8f8', 2); pixelText('P OU TOQUE: JOGAR', 120, 84, '#c8d0e0');
  }
  if (cl.phase === 'end') cl_drawEnd();
}
function cl_big(t, x, y, col, z) { ctx.save(); ctx.translate(x, y); ctx.scale(z, z); pixelText(t, 0, 0, col); ctx.restore(); }
function cl_hud() {
  // pontos (esquerda), tempo (barra no meio), sequência/combo (direita)
  pixelText(String(cl.score).padStart(4, '0'), 22, 4, '#f8f8f8');
  const left = 1 - cl.t / CL_TIME, bw = 84, bx = 78;
  R(ctx, bx - 1, 5, bw + 2, 7, '#202028'); R(ctx, bx, 6, bw, 5, '#506070');
  R(ctx, bx, 6, Math.round(bw * left), 5, left > .33 ? '#58d070' : left > .16 ? '#f8d030' : '#f85838');
  R(ctx, bx, 6, Math.round(bw * left), 1, 'rgba(255,255,255,.35)');
  if (cl.streak >= 2) {
    const on = cl.streak > 5;
    pixelText(`SEQ ${cl.streak}`, 204, 4, on ? '#f8d030' : '#f8f8f8');
    if (on && Math.floor(clock * 4) % 2) pixelText('x1.5', 216, 14, '#f8d030');
  }
}
function cl_drawEnd() {
  const r = cl.res, k = Math.min(1, cl.endT / .25);
  ctx.fillStyle = `rgba(16,16,32,${.45 * k})`; ctx.fillRect(0, 0, W, H);
  // caixa branca de borda dupla, como as do FRLG
  const bx = 36, by = 24, bw = 168, bh = 104;
  R(ctx, bx, by, bw, bh, '#202028'); R(ctx, bx + 2, by + 2, bw - 4, bh - 4, '#f8f8f8'); R(ctx, bx + 4, by + 4, bw - 8, bh - 8, '#5878a8'); R(ctx, bx + 5, by + 5, bw - 10, bh - 10, '#f8f8f8');
  pixelText('COLHEITA', 120, by + 10, '#5878a8');
  cl_big(r.rate.txt, 120, by + 24, r.rate.col, 2);
  pixelText(`${cl.score} PONTOS`, 120, by + 46, '#404048');
  pixelText(r.record ? 'NOVO RECORDE!' : `RECORDE ${r.best}`, 120, by + 58, r.record ? '#f85838' : '#707880');
  let line = `+${r.gain} EXP`; const nb = r.got.poke + r.got.great;
  if (nb) line += `  +${nb}`;
  pixelText(line, nb ? 112 : 120, by + 72, '#3878c8');
  if (nb) drawBm(ctx, CL_BALL, 112 + line.length * 4 + 2, by + 71);
  if (r.stone) pixelText(ITEMS[r.stone].name, 120, by + 84, '#8858c0');
  // seta vermelha do FRLG: pode sair
  if (cl.endT > .8 && Math.floor(clock * 2) % 2) for (let i = 0; i < 4; i++) R(ctx, bx + bw - 18 + i, by + bh - 14 + i, 7 - 2 * i, 1, '#e83838');
}
