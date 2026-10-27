/* Batalha selvagem (spec D, E): layout do GBA, golpes por tipo, conta da Gen III e captura.
   O encontro vive em G.enc (gravado a cada turno: recarregar não sorteia de novo); o PS do POKéMON ativo
   vive em G.outing.hp (vale para o passeio inteiro). Cada decisão (dano, captura, desmaio) é sorteada e gravada
   antes da animação; a narração vem depois, em ordem, com await talk(). Recarregar não desfaz nem repete nada. */
extendDefaults({ prog: { legend: {}, captures: 0, wins: 0, charm: false, exploreLockUntil: 0 } });

const btRid = () => Math.random().toString(36).slice(2, 10);
const BT_TAB = btRid();   // esta aba: dono do encontro enquanto batalha
// outra aba está nesta batalha (batimento de menos de 2 min)
const btElsewhere = e => !!(e && e.owner && e.owner !== BT_TAB && Date.now() - num(e.at, 0) < 120e3);
// físico x especial pelo tipo do golpe (Gen III)
const BT_PHYS = new Set(['NORMAL', 'LUTADOR', 'VOADOR', 'VENENO', 'TERRA', 'PEDRA', 'INSETO', 'FANTASMA', 'AÇO']);
const BT_SPLASH = { name: 'SPLASH', power: 0, type: 'NORMAL', strong: false };
const BT_FAIL = ['Ah, não! O POKéMON escapou!', 'Aaah! Parecia que tinha pego!', 'Argh! Quase!', 'Droga! Foi por pouco!'];

/* ── Contas ── */
// status com IV 15, EV 0 e natureza neutra
function btStats(id, L) {
  const b = DEX[id].base, f = x => Math.floor((2 * x + 15) * L / 100);
  return { hp: f(b[0]) + L + 10, atk: f(b[1]) + 5, def: f(b[2]) + 5, spa: f(b[3]) + 5, spd: f(b[4]) + 5, spe: f(b[5]) + 5 };
}
// golpes conhecidos no nível L (até 4): fraco do tipo 1 (Nv1), fraco do tipo 2 ou NORMAL (Nv10), fortes no 22 e no 38
function btMoves(id, L) {
  const t = DEX[id].types, t2 = t[1] || 'NORMAL', mv = (m, type, strong) => ({ name: m.name, power: m.power, type, strong });
  if (id === 129) return L >= 15 ? [BT_SPLASH, mv(MOVES.NORMAL, 'NORMAL', false)] : [BT_SPLASH];
  const out = [mv(MOVES[t[0]], t[0], false)];
  if (L >= 10) out.push(mv(MOVES[t2], t2, false));
  if (L >= 22) out.push(mv(MOVES2[t[0]], t[0], true));
  if (L >= 38) out.push(mv(MOVES2[t2], t2, true));
  return out.filter((m, i) => out.findIndex(o => o.name === m.name) === i);   // NORMAL puro não repete golpe
}
const btEff = (type, id) => DEX[id].types.reduce((a, d) => a * (TYPE_CHART[type][d] ?? 1), 1);
const btPet = () => ({ sp: s.sp, lv: s.level, st: btStats(s.sp, s.level), weak: s.hunger < 20 ? .85 : 1 });
const btWild = e => ({ sp: e.sp, lv: e.lv, st: btStats(e.sp, e.lv), weak: 1 });
function btDamage(att, def, mv, crit) {
  const phys = BT_PHYS.has(mv.type), A = (phys ? att.st.atk : att.st.spa) * att.weak, D = phys ? def.st.def : def.st.spd;
  const base = Math.floor(Math.floor(Math.floor(2 * att.lv / 5 + 2) * mv.power * A / D) / 50) + 2;
  const eff = btEff(mv.type, def.sp), stab = DEX[att.sp].types.includes(mv.type) ? 1.5 : 1;
  const dmg = Math.floor(base * stab * eff * (crit ? 2 : 1) * randInt(85, 100) / 100);
  return { dmg: eff ? Math.max(1, dmg) : 0, eff };
}
// captura Gen III: devolve quantas das 4 checagens passaram (4 = pego)
function btChecks(e, k) {
  if (k === 'master') return 4;
  const M = e.maxHp, H = Math.max(1, e.hp), L = G.prog.legend[e.sp];
  const rate = e.legend ? Math.min(45, 3 + 6 * (L ? L.thrown || 0 : 0)) : DEX[e.sp].catch;
  const a = Math.floor(Math.floor((3 * M - 2 * H) * rate * ITEMS[k].ball / (3 * M)) * (e.asleep ? 2 : 1) * (G.prog.captures < 15 ? 1.5 : 1));
  if (a >= 255) return 4;
  const b = Math.floor(1048560 / Math.floor(Math.sqrt(Math.floor(Math.sqrt(Math.floor(16711680 / Math.max(1, a)))))));
  let n = 0; while (n < 4 && Math.floor(Math.random() * 65536) < b) n++;
  return n;
}
// lendário que escapou (fuga, desmaio, app fechado): volta em 24 h quase certo, com o PS guardado; a pena de captura fica
function btLegendRec(id) {
  const L = G.prog.legend;
  if (!L[id] || typeof L[id] !== 'object') L[id] = { unlockedAt: Date.now(), misses: 0, thrown: 0, hp: null, hpUntil: 0, backAt: 0, caught: false };
  return L[id];
}
function btLegendMiss(e, ko) {
  const L = btLegendRec(e.sp), now = Date.now();
  if (L.caught || dexHas('caught', e.sp)) { L.backAt = now + 7 * 864e5; return; }   // pós-jogo: uma vez por semana
  L.misses = 30; L.backAt = now + 864e5; L.hp = ko ? null : e.hp; L.hpUntil = now + 864e5;
}

/* ── Animação: esperas e interpolações movidas pelo quadro (pausam com a aba escondida, como as mensagens) ── */
const ADV = { tw: [] };
function advTween(dur, fn) { return new Promise(r => { if (!(dur > 0)) { fn(1); r(); } else ADV.tw.push({ t: 0, dur, fn, r }); }); }
const advWait = sec => advTween(sec, () => {});
const advUntil = cond => new Promise(r => ADV.tw.push({ cond, r }));
function advTick(dt) {
  for (const w of ADV.tw.slice()) {
    let end;
    if (w.cond) end = w.cond(); else { w.t += dt; w.fn(Math.min(1, w.t / w.dur)); end = w.t >= w.dur; }
    if (end) { ADV.tw.splice(ADV.tw.indexOf(w), 1); w.r(); }
  }
}
// espera a fila de mensagens esvaziar (nível, insígnia...) antes de perguntar algo: o SIM/NÃO apagaria a fila
const advQuiet = () => advUntil(() => !msg.queue.length && !msg.done && (!msg.cur || (msg.shown >= msg.cur.length && msg.hold > 1)));

/* ── Ícones (bitmaps na paleta do núcleo) ── */
const BT_PAL = { ...PAL, H: '#2f7d32', N: '#3870e0', U: '#383840', M: '#8040c0' };
const BT_BM = {
  ball: ['..KKK..', '.KRRRK.', 'KRRWRRK', 'KKKWKKK', 'KWWWWWK', '.KWWWK.', '..KKK..'],
  sword: ['.......WK', '......WwK', '.....WwK.', '....WwK..', '.K.WwK...', '..KwK....', '..LKK....', '.LDK.K...', 'LD.......'],
  run: ['....K....', '....KK...', 'KKKKKWK..', 'KWWWWWWK.', 'KKKKKWK..', '....KK...', '....K....'],
  bag: ['...KKK...', '..K...K..', '.KKKKKKK.', 'KOOOOOOOK', 'KOOYYYOOK', 'KOOOOOOOK', 'KDDDDDDDK', '.KKKKKKK.'],
  ps: ['KKK.KKK', 'K.K.K..', 'KKK.KKK', 'K.....K', 'K...KKK'],
  nv: ['K...K....', 'KK..K....', 'K.K.K.K.K', 'K..KK.K.K', 'K...K..K.'],   // "Nv" miúdo, como o "Lv" do FRLG
};
const BT_BALL_PAL = { poke: BT_PAL, great: { ...BT_PAL, R: '#3870e0' }, ultra: { ...BT_PAL, R: '#383840', W: '#f8d030' }, master: { ...BT_PAL, R: '#8040c0' } };
const btIco = (bm, pal = BT_PAL) => bmSvg(bm, pal);
// selo do tipo no botão do golpe
const btTypeIco = t => `<svg viewBox="0 0 12 12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="${TYPE_COLOR[t]}" stroke="#202028" stroke-width="1"/><circle cx="4.5" cy="4.5" r="1.5" fill="rgba(255,255,255,.5)"/></svg>`;

/* ── Estado da cena (não persiste: o que importa está em G.enc / G.outing) ── */
const BT = { tok: 0, mode: 'main', busy: true, e: null, o: null, fin: false, wipe: 0, wildDx: 0, petDx: 0, wildShown: 0, petShown: 0, petMax: 1,
  holdW: false, holdP: false, blinkW: 0, blinkP: 0, shake: 0, lungeP: 0, lungeW: 0, ball: null, absorb: 0, hideWild: false, sinkW: 0, sinkP: 0, parts: [], later: [] };
const btAlive = tok => tok === BT.tok && scene === 'batalha' && !!G;
// outra aba gravou (o tick dela) e esta adotou o save: o encontro e o passeio desta batalha voltam para G antes de gravar
function btSave(e) {
  if (!G) return;
  if (e && G.enc && G.enc !== e && G.enc.id === e.id && !btElsewhere(G.enc)) G.enc = e;
  const o = BT.o; if (o && G.outing && G.outing !== o && G.outing.startedAt === o.startedAt) G.outing = o;
  save();
}

SCENES.batalha = {
  get knobs() { return btKnobsMain(); },
  enter(arg) {
    ADV.tw = []; BT.tok++;
    const e = G && G.enc; if (!e) { setTimeout(goHome); return; }
    if (!e.id) e.id = btRid();
    // outra aba está nesta batalha: a mensagem vem do exResume, em casa
    if (btElsewhere(e)) { setTimeout(goHome); return; }
    // o save guarda encontro e passeio como vieram: revalida aqui
    e.lv = clamp(Math.floor(num(e.lv, 5)), 1, 100); e.maxHp = btStats(e.sp, e.lv).hp; e.hp = clamp(Math.round(num(e.hp, e.maxHp)), 0, e.maxHp);
    e.turn = Math.max(0, Math.floor(num(e.turn, 0))); e.sleepTurns = clamp(Math.floor(num(e.sleepTurns, 0)), 0, 3); e.asleep = !!e.asleep && e.sleepTurns > 0;
    if (!EX_AREAS[e.area]) e.area = 'floresta';
    if (!G.outing || typeof G.outing !== 'object') G.outing = exNewOuting(e.area);
    const o = G.outing;
    o.maxHp = btStats(s.sp, s.level).hp; o.hp = clamp(Math.round(num(o.hp, o.maxHp)), 0, o.maxHp);
    Object.assign(BT, { e, o, fin: false });
    // resultado já decidido (recarregou no meio da narração), nocaute ou desmaio gravados: só conclui
    if (e.done || e.hp <= 0 || o.hp <= 0) { if (!e.done) btSettle(e.hp <= 0 ? { won: true } : { fainted: true }, e); btFinish(e, true); setTimeout(goHome); return; }
    if (e.petHp0 == null) e.petHp0 = o.hp;   // custo de energia da batalha = PS perdido nela
    e.owner = BT_TAB; e.at = Date.now(); save();
    Object.assign(BT, { mode: 'main', wipe: RM.matches ? 0 : 1, wildDx: -170, petDx: -150, boxW: false, boxP: false, wildShown: e.hp, petShown: o.hp, petMax: o.maxHp,
      holdW: false, holdP: false, blinkW: 0, blinkP: 0, shake: 0, lungeP: 0, lungeW: 0, ball: null, absorb: 0, hideWild: false, sinkW: 0, sinkP: 0, parts: [], later: [] });
    btIntro(arg && arg.resume);
  },
  exit() { ADV.tw = []; BT.tok++; btMovesUi(false); },
  update(dt) {
    advTick(dt);
    const e = BT.e, o = BT.o, rate = m => Math.max(14, m * .9) * dt;   // a barra escorre, não pula
    if (e && !BT.holdW) BT.wildShown = btToward(BT.wildShown, Math.max(0, e.hp), rate(e.maxHp));
    if (o && !BT.holdP) { BT.petMax = o.maxHp; BT.petShown = btToward(BT.petShown, Math.max(0, o.hp), rate(o.maxHp)); }
    BT.blinkW = Math.max(0, BT.blinkW - dt); BT.blinkP = Math.max(0, BT.blinkP - dt); BT.shake = Math.max(0, BT.shake - dt);
    for (const p of BT.parts) { p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    BT.parts = BT.parts.filter(p => p.life < p.max);
  },
  draw(c) { btDraw(c); },
  key(e, k) {
    if (BT.mode === 'moves' && !BT.busy && (k === 'x' || k === 'escape' || k === 'backspace')) { e.preventDefault(); btMain(); return true; }
    // botão focado: Enter/Espaço passa a mensagem, senão deixa o clique nativo acontecer (o núcleo cancelaria)
    if (e.target.closest && e.target.closest('button') && (k === 'enter' || k === ' ')) { if (e.repeat || msgAdvance()) e.preventDefault(); return true; }
    // A no menu principal = LUTAR (o cursor do FRLG começa nele)
    if ((k === 'enter' || k === ' ' || k === 'z') && !e.repeat) { e.preventDefault(); if (!msgAdvance() && !BT.busy && BT.mode === 'main') btFight(); return true; }
    return false;
  },
};
const btToward = (v, to, step) => v < to ? Math.min(to, v + step) : Math.max(to, v - step);

/* ── Botões ── */
const btLive = () => !!(BT.e && !BT.e.done && !BT.fin);
function btKnobsMain() {
  const e = BT.e, off = BT.busy;
  return [
    { label: 'LUTAR', icon: btIco(BT_BM.sword), fn: () => !BT.busy && btFight(), disabled: off },
    { label: 'BOLSA', icon: btIco(BT_BM.bag), fn: () => !BT.busy && btBag(), disabled: off },
    { label: 'ANIMAR', icon: 'heart', fn: () => !BT.busy && btCheer(), disabled: off || !!(e && e.animar) },
    { label: 'FUGIR', icon: btIco(BT_BM.run), fn: () => !BT.busy && btRun(), disabled: off },
  ];
}
function btSetBusy(b) { BT.busy = b; if (!Menu.top && scene === 'batalha' && BT.mode === 'main') setKnobs(btKnobsMain()); }
// lista de golpes: o botão do meio vira VOLTAR (rótulo e ícone trocados pelo battle.css)
function btMovesUi(on) { $('device').classList.toggle('bt-moves', on); $('btnPet').setAttribute('aria-label', on ? 'Voltar' : 'Fazer carinho'); }
function btMain() { BT.mode = 'main'; btMovesUi(false); setKnobs(btKnobsMain()); Sfx.click(); }
function btFight() {
  if (BT.busy || !btLive()) return;
  BT.mode = 'moves'; btMovesUi(true); Sfx.click();
  const mv = btMoves(s.sp, s.level), defs = [0, 1, 2, 3].map(i => mv[i] ? { label: mv[i].name, icon: btTypeIco(mv[i].type), fn: () => !BT.busy && btTurn({ kind: 'move', mv: mv[i] }) } : null);
  defs.center = { label: 'VOLTAR', icon: '◀', fn: () => !BT.busy && btMain() };
  setKnobs(defs);
}
// volta ao "O que X vai fazer?" (ou encerra, se ele desmaiou de cansaço no meio)
function btMenu() {
  if (!btAlive(BT.tok) || !btLive()) return;
  if (s.asleep || s.energy <= 0) return btEnd({ fled: true, exhausted: true }, BT.e);
  BT.mode = 'main'; btMovesUi(false); btSetBusy(false);
  sayNow(`O que ${N()} vai fazer?`);
}

/* ── Fluxo ── */
async function btIntro(resume) {
  const tok = BT.tok, e = BT.e, nm = DEX[e.sp].name, quick = RM.matches;
  btSetBusy(true);
  advTween(quick ? 0 : .45, p => { BT.wipe = 1 - p; });
  Sfx.cry(e.sp);
  await advTween(quick ? 0 : .7, p => { BT.wildDx = Math.round(-170 * (1 - p)); });
  if (!btAlive(tok)) return;
  BT.boxW = true;
  if (e.shiny) btShinyFx();
  // recarregou antes do fim da abertura: ela se repete inteira (lendário e brilhante nunca passam sem aviso)
  if (resume && e.introDone) await talk(`O ${nm} selvagem ainda está aqui!`);
  else if (e.legend) { await talk('Gyaoo!'); await talk(`O ${nm} lendário encara você!`); }
  else await talk(`Um ${nm} selvagem apareceu!`);
  if (!btAlive(tok)) return;
  if (e.shiny) await talk('Ele está brilhando!');
  if (e.asleep) await talk(`O ${nm} selvagem está dormindo!`);
  if (!btAlive(tok)) return;
  Sfx.whoosh();
  const vai = talk(`Vai! ${N()}!`);
  await advTween(quick ? 0 : .5, p => { BT.petDx = Math.round(-150 * (1 - p)); });
  BT.boxP = true; Sfx.cry(s.sp); await vai;
  if (!btAlive(tok)) return;
  if (s.hunger < 20) await talk(`${N()} está com fome e sem forças...`);
  if (!e.introDone) { e.introDone = true; btSave(e); }
  // recarregou depois da ação do seu POKéMON: o selvagem ainda tem a vez dele
  if (e.owe) {
    const r = await btWildAct(e, tok); if (!btAlive(tok)) return;
    if (r) return btEnd(r, e);
    e.turn++; e.at = Date.now(); btSave(e);
  }
  btMenu();
}
async function btTurn(act) {
  const tok = BT.tok; if (!btLive() || BT.busy) return;
  syncFromStorage(); if (!btAlive(tok)) return;
  // outra aba encerrou ou assumiu a batalha: volta para casa (lá o aviso aparece)
  const e = BT.e, g = G.enc;
  if (!g || g.id !== e.id || g.done || btElsewhere(g)) { btSetBusy(true); BT.fin = true; goHome(); return; }
  G.enc = e; e.owner = BT_TAB;
  BT.mode = 'main'; btMovesUi(false); btSetBusy(true); Sfx.click();
  const pet = btPet(), wild = btWild(e);
  // BOLSA e ANIMAR vão primeiro; golpes pela VELOCIDADE (empate: sorteio)
  const petFirst = act.kind !== 'move' || pet.st.spe > wild.st.spe || (pet.st.spe === wild.st.spe && Math.random() < .5);
  // a vez do selvagem fica devida já: recarregar no meio do turno não a pula
  e.owe = petFirst; e.at = Date.now(); btSave(e);
  for (const who of petFirst ? ['pet', 'wild'] : ['wild', 'pet']) {
    const r = who === 'pet' ? await btPetAct(act, e, tok) : await btWildAct(e, tok);
    if (!btAlive(tok)) return;
    if (r) return btEnd(r, e);
  }
  e.turn++; e.owe = false; e.at = Date.now(); btSave(e);
  btMenu();
}
async function btPetAct(act, e, tok) {
  const nm = DEX[e.sp].name, n = N(), o = BT.o;
  if (act.kind === 'ball') return btThrow(act.k, e, tok);
  if (act.kind === 'pocao') {
    bagUse('pocao'); const gain = Math.min(20, o.maxHp - o.hp); o.hp += gain; btSave(e); Sfx.happy();
    await talk('Você usou uma POÇÃO!'); await advUntil(() => BT.petShown === o.hp);
    await talk(`${n} recuperou ${gain} PS!`); return null;
  }
  if (act.kind === 'animar') {
    e.animar = true; e.pump = true; s.happy = clamp(s.happy + 2); btSave(e); updateUI(); Sfx.happy();
    for (let i = 0; i < 4; i++) BT.parts.push({ type: 'heart', x: 50 + Math.random() * 30, y: 110, vx: (Math.random() - .5) * 20, vy: -25, life: 0, max: 1 });
    await talk(`${n} ficou animado!`); return null;
  }
  // golpe: tudo sorteado e gravado antes da narração (a barra fica parada até o golpe acertar)
  if (s.happy < 25 && Math.random() < .2) { await talk(`${n} está emburrado...`); return null; }
  const mv = act.mv, hit = !!mv.power && !(mv.strong && Math.random() >= .9);
  let r = null, crit = false, held = false, woke = false;
  if (hit) {
    crit = Math.random() < (e.pump ? 1 / 4 : s.happy >= 80 ? 1 / 8 : 1 / 16); e.pump = false;
    r = btDamage(btPet(), btWild(e), mv, crit);
    if (r.eff) {
      // golpe gentil: espécie ainda não capturada não desmaia (fica com 1 PS); lendários e já capturados podem
      let dmg = r.dmg;
      if (!e.legend && !dexHas('caught', e.sp) && dmg >= e.hp) { dmg = Math.max(0, e.hp - 1); held = true; }
      e.hp = Math.max(0, e.hp - dmg); woke = e.asleep && e.hp > 0;
      if (woke) { e.asleep = false; e.sleepTurns = 0; }
      BT.holdW = true;
    }
  }
  e.at = Date.now();
  if (r && r.eff && e.hp <= 0) btSettle({ won: true }, e); else btSave(e);
  await talk(`${n} usou ${mv.name}!`);
  if (!mv.power) { await talk('Mas nada aconteceu!'); return null; }
  if (!hit) { await talk(`O ataque de ${n} errou!`); return null; }
  if (!r.eff) { await talk(`Não afeta o ${nm} selvagem...`); return null; }
  await btHitFx('wild', r.eff); BT.holdW = false;
  await advUntil(() => BT.wildShown === e.hp);
  if (crit) await talk('Um golpe crítico!');
  if (r.eff > 1) await talk('É super efetivo!'); else if (r.eff < 1) await talk('Não é muito efetivo...');
  if (held) await talk(`O ${nm} selvagem aguentou firme!`);
  if (e.hp <= 0) return btWildFaint(e, tok);
  if (woke) await talk(`O ${nm} selvagem acordou!`);
  return null;
}
async function btWildAct(e, tok) {
  const nm = DEX[e.sp].name, n = N(), o = BT.o, wild = btWild(e), pet = btPet();
  e.owe = false;   // vai junto no próximo save deste turno
  if (e.asleep) {
    if (--e.sleepTurns <= 0) { e.asleep = false; btSave(e); await talk(`O ${nm} selvagem acordou!`); }
    else { btSave(e); await talk(`O ${nm} selvagem está dormindo.`); }
    return null;
  }
  // brilhante nunca foge (nem com TELETRANSPORTE)
  if (e.sp === 63 && !e.shiny && e.turn === 0 && Math.random() < .5) return btWildFlee(e, `O ${nm} selvagem usou TELETRANSPORTE!`);
  if (!e.legend && !e.shiny && e.hp < e.maxHp * .25 && wild.st.spe > pet.st.spe && Math.random() < .1) return btWildFlee(e);
  // IA: 70% o golpe de maior dano esperado, 30% um qualquer; lendários sempre o melhor
  const mvs = btMoves(e.sp, e.lv), score = m => m.power * (DEX[e.sp].types.includes(m.type) ? 1.5 : 1) * btEff(m.type, s.sp) * (m.strong ? .9 : 1);
  const mv = e.legend || Math.random() < .7 ? mvs.reduce((a, b) => score(b) > score(a) ? b : a) : mvs[randInt(0, mvs.length - 1)];
  // dano sorteado e gravado antes da narração; desmaio já com as penas no mesmo save (recarregar não o desfaz)
  const hit = !!mv.power && !(mv.strong && Math.random() >= .9), crit = hit && Math.random() < 1 / 16, r = hit ? btDamage(wild, pet, mv, crit) : null;
  let endured = false;
  if (r && r.eff) {
    let hp = o.hp - r.dmg;
    if (hp <= 0 && s.happy >= 80 && !e.endured) { hp = 1; endured = e.endured = true; }   // aguenta por você, 1x por batalha
    o.hp = Math.max(0, hp); BT.holdP = true;
  }
  e.at = Date.now();
  if (o.hp <= 0) btSettle({ fainted: true }, e); else btSave(e);
  await talk(`O ${nm} selvagem usou ${mv.name}!`);
  if (!mv.power) { await talk('Mas nada aconteceu!'); return null; }
  if (!hit) { await talk(`O ataque do ${nm} selvagem errou!`); return null; }
  if (!r.eff) { await talk(`Não afeta ${n}...`); return null; }
  await btHitFx('pet', r.eff); BT.holdP = false;
  await advUntil(() => BT.petShown === o.hp);
  if (crit) await talk('Um golpe crítico!');
  if (r.eff > 1) await talk('É super efetivo!'); else if (r.eff < 1) await talk('Não é muito efetivo...');
  if (endured) await talk(`${n} aguentou firme por você!`);
  if (o.hp <= 0) {
    Sfx.cry(s.sp); await advTween(RM.matches ? 0 : .5, p => { BT.sinkP = p; });
    await talk(`${n} desmaiou!`); return { fainted: true };
  }
  return null;
}
async function btWildFaint(e, tok) {
  Sfx.cry(e.sp); await advTween(RM.matches ? 0 : .5, p => { BT.sinkW = p; });
  await talk(`O ${DEX[e.sp].name} selvagem desmaiou!`);
  await btPayExp(e);
  return { won: true };
}
async function btWildFlee(e, pre) {
  btSettle({ wildFled: true }, e);
  if (pre) await talk(pre);
  Sfx.whoosh(); await advTween(RM.matches ? 0 : .4, p => { BT.wildDx = Math.round(170 * p); });
  await talk(`O ${DEX[e.sp].name} selvagem fugiu!`);
  return { wildFled: true };
}
// EXP do nocaute/captura: anotada no resultado (e.done.exp) e paga aqui, com o nível e a evolução pendente do addExp do núcleo
const btExpFor = e => Math.round(Math.max(3, Math.round(DEX[e.sp].exp * e.lv / 7 * .1)) * (e.lv > s.level ? 1.2 : 1));
async function btPayExp(e) {
  const d = e.done; if (!d || !d.exp || d.expPaid) return;
  const oldL = s.level, oldMax = btStats(s.sp, s.level).hp, known = btMoves(s.sp, s.level).map(m => m.name);
  await talk(`${N()} ganhou ${d.exp} pontos de EXP.!`);
  if (d.expPaid) return;
  addExp(d.exp, true); d.expPaid = true;
  const o = BT.o;
  if (s.level > oldL && o) { const mx = btStats(s.sp, s.level).hp; o.hp += mx - oldMax; o.maxHp = mx; BT.petShown += mx - oldMax; }
  btSave(e); updateUI();
  for (const m of btMoves(s.sp, s.level)) if (!known.includes(m.name)) await talk(`${N()} aprendeu ${m.name}!`);
}
async function btThrow(k, e, tok) {
  const nm = DEX[e.sp].name, quick = RM.matches;
  // bola gasta, pena do lendário e, se pegou, a captura inteira num save só, antes da animação
  const checks = btChecks(e, k);
  bagUse(k); if (e.legend) btLegendRec(e.sp).thrown++;
  e.at = Date.now();
  if (checks >= 4) btSettle({ caught: true, k }, e); else btSave(e);
  sayNow(`Você jogou uma ${ITEMS[k].name}!`); Sfx.whoosh();
  const b = BT.ball = { k, x: 60, y: 112, dx: 0, open: 0, dim: false };
  await advTween(quick ? .2 : .6, p => { b.x = 60 + 116 * p; b.y = 112 - 58 * p + -60 * Math.sin(p * Math.PI) * .9; });
  Sfx.noise(.15, { freq: 2400, q: 1, vol: .2 });
  await advTween(quick ? 0 : .35, p => { BT.absorb = p; b.open = 1 - p; });
  BT.hideWild = true; BT.absorb = 0; b.open = 0;
  await advTween(quick ? .1 : .35, p => { b.y = 54 + 22 * (p < .7 ? (p / .7) ** 2 : 1 - Math.sin((p - .7) / .3 * Math.PI) * .2); });
  b.y = 76; Sfx.bounce();
  const shakes = Math.min(3, checks);
  for (let i = 0; i < shakes; i++) {
    await advWait(quick ? .25 : .45); if (!btAlive(tok)) return null;
    Sfx.tone(260, .06, { vol: .08 });
    await advTween(quick ? .2 : .4, p => { b.dx = Math.round(Math.sin(p * Math.PI * 2) * 3); });
    b.dx = 0;
  }
  await advWait(quick ? .2 : .45); if (!btAlive(tok)) return null;
  if (checks < 4) {
    Sfx.noise(.2, { freq: 1800, q: .8, vol: .25 });
    await advTween(quick ? 0 : .3, p => { b.open = p; BT.absorb = 1 - p; BT.hideWild = false; });
    BT.ball = null; BT.absorb = 0;
    await talk(BT_FAIL[shakes]); return null;
  }
  b.dim = true; Sfx.seq([[784, .1], [988, .1], [1175, .1], [1568, .3]], { vol: .07 });
  for (let i = 0; i < 6; i++) BT.parts.push({ type: 'star', x: 176, y: 72, vx: (i % 3 - 1) * 28, vy: i < 3 ? -26 : -8, life: 0, max: .9 });
  await talk(`Parabéns! ${nm} foi pego!`);
  await btPayExp(e);
  if (e.done.novo) {
    await talk(`Os dados de ${nm} foram registrados na POKéDEX.`);
    if (typeof showDexEntry === 'function') await showDexEntry(e.sp);   // a ficha nova, como no FRLG
  }
  await talk(`${nm} foi enviado para o PC do PROF. CARVALHO.`);
  btLater();
  return { caught: true };
}
// avisos que outros módulos deram na captura (gancho 'caught'): guardados para depois da narração, sem estragar a surpresa
function btLater() { for (const m of BT.later) msg.queue.push(m); BT.later = []; }
/* Resultado: btSettle grava tudo o que o resultado muda (captura, vitória, custo de cuidado, desmaio, lendário) num save só
   e marca e.done; btFinish, depois da narração (ou no próximo boot, se recarregou), paga a EXP que faltou, solta o encontro e avisa. */
function btSettle(r, e) {
  if (e.done) return e.done;
  const o = BT.o, now = Date.now(), mul = MUL();
  const d = { won: !!r.won, caught: !!r.caught, fled: !!r.fled, fainted: !!r.fainted, exhausted: false, novo: false, night: phaseAt() === 'NOITE', exp: 0, expPaid: false };
  if (r.caught) {
    d.novo = !dexHas('caught', e.sp);
    const q0 = msg.queue.length;
    receiveMon(e.sp, e.lv, { shiny: !!e.shiny, ball: r.k }, 'catch');
    BT.later = msg.queue.splice(q0);
    G.prog.captures++; if (e.legend) btLegendRec(e.sp).caught = true;
  }
  if (r.won) { G.prog.wins++; s.happy = clamp(s.happy + 2); }
  if (r.won || r.caught) d.exp = btExpFor(e);
  const lost = o ? Math.max(0, (num(e.petHp0, o.hp) - o.hp) / o.maxHp) : 0;
  s.energy = clamp(s.energy - (2 + Math.round(8 * lost))); s.hunger = clamp(s.hunger - 2 * mul.h);
  if (e.legend && !r.caught) btLegendMiss(e, !!r.won);
  if (r.fainted) { if (o) o.hp = 0; s.energy = Math.max(5, s.energy - 20); s.happy = clamp(s.happy - 8); G.prog.exploreLockUntil = now + 15 * 60e3; }
  d.exhausted = !r.fainted && (!!r.exhausted || s.energy <= 0);
  if (d.exhausted && !s.asleep) { s.asleep = true; s.sleptAt = now; }   // o sono de exaustão de sempre
  e.done = d; e.owe = false; e.at = now;
  btSave(e); updateUI();
  return d;
}
function btFinish(e, home) {
  const d = e.done; if (!d || !G) return;
  if (d.exp && !d.expPaid) { addExp(d.exp, true); d.expPaid = true; }   // recarregou antes do "ganhou EXP"
  if (e === BT.e) BT.fin = true;
  if (G.enc && G.enc.id === e.id) G.enc = null;
  if (d.fainted || d.exhausted || home) G.outing = null;
  save(); updateUI();
  fire('battleEnd', { won: d.won, caught: d.caught, fled: d.fled, fainted: d.fainted, sp: e.sp, shiny: !!e.shiny, night: d.night });
  if (!home) return;
  const nm = DEX[e.sp].name;
  if (d.caught) { if (d.novo) say(`Os dados de ${nm} foram registrados na POKéDEX.`); say(`${nm} foi enviado para o PC do PROF. CARVALHO.`); btLater(); }
  if (d.fainted) say(`${N()} voltou para casa para descansar.`);
  else if (d.exhausted) say(`${N()} está exausto!`);
}
// fim da narração: conclui e decide para onde ir (passeio continua, ou casa)
async function btEnd(r, e) {
  const tok = BT.tok; if (!e || !G) return;
  btSetBusy(true);
  const d = btSettle(r, e);
  if (d.fainted) await talk(`${N()} voltou para casa para descansar.`);
  if (d.exhausted) await talk(`${N()} está exausto!`);
  if (!btAlive(tok)) return;
  btFinish(e);
  if (d.fainted || d.exhausted) goHome(); else go('explorar', { after: true });
}
function btRun() {
  if (BT.busy || !btLive()) return;
  btSetBusy(true); Sfx.whoosh();
  const e = BT.e, tok = BT.tok;
  btSettle({ fled: true }, e);
  talk('Fugiu sem problemas!').then(() => btAlive(tok) && btEnd({ fled: true }, e));
  advTween(RM.matches ? 0 : .4, p => { BT.petDx = -Math.round(150 * p); });
}
function btCheer() {
  if (BT.busy || !btLive()) return;
  if (BT.e.animar) { sayNow(`${N()} já está animado!`); return Sfx.deny(); }
  btTurn({ kind: 'animar' });
}
function btBag() {
  if (BT.busy || !btLive()) return;
  const items = BALLS.filter(k => G.bag[k] > 0).map(k => ({ label: ITEMS[k].name, sub: '×' + G.bag[k], fn: () => { Menu.closeAll(); btBall(k); } }));
  if (!items.length) items.push({ label: 'POKé BOLA', sub: '×0', fn: () => { Menu.closeAll(); btBall('poke'); } });
  items.push({ label: 'POÇÃO', sub: '×' + (G.bag.pocao || 0), disabled: !bagHas('pocao'), fn: () => {
    const o = BT.o; if (o.hp >= o.maxHp) { sayNow(`O PS de ${N()} já está cheio!`); return Sfx.deny(); }
    Menu.closeAll(); btTurn({ kind: 'pocao' });
  } });
  items.push({ label: 'VOLTAR', fn: () => Menu.close() });
  Menu.open({ title: 'BOLSA', items });
}
// PC cheio ou sem bola: recusa antes de jogar, nada é gasto
function btBall(k) {
  if (G.pc.length >= 360) { sayNow('O PC está cheio!'); return Sfx.deny(); }
  if (!bagHas(k)) { sayNow('Não há POKé BOLAS!'); return Sfx.deny(); }
  btTurn({ kind: 'ball', k });
}
// só uma aba batalha por vez (spec N5): batimento a cada 15 s pelo tick; quem perde a vez volta para casa
on('tick', now => {
  if (scene !== 'batalha' || !BT.e || BT.fin) return;
  const g = G.enc, e = BT.e;
  if (g && g.id === e.id && !btElsewhere(g)) {
    G.enc = e;   // o tick acabou de adotar o save: a batalha segue com o objeto dela
    if (e.owner !== BT_TAB || now - num(e.at, 0) > 15e3) { e.owner = BT_TAB; e.at = now; }
  } else if (!BT.busy) { BT.fin = true; goHome(); }
});
// recarregar ou fechar: solta a batalha na hora (a mesma aba, ao voltar, retoma sem esperar os 2 min)
window.addEventListener('pagehide', () => {
  const g = G && G.enc; if (!g || g.owner !== BT_TAB) return;
  g.owner = null; if (BT.e && BT.e.id === g.id) BT.e.owner = null;
  save();
});

/* ── Efeitos ── */
async function btHitFx(who, eff) {
  const quick = RM.matches;
  Sfx.whoosh();
  await advTween(quick ? 0 : .22, p => { const v = Math.sin(p * Math.PI); if (who === 'wild') BT.lungeP = v; else BT.lungeW = v; });
  BT.lungeP = BT.lungeW = 0;
  Sfx.hit(eff > 1 ? 0 : eff < 1 ? 3 : 1);
  if (who === 'wild') BT.blinkW = .5; else { BT.blinkP = .5; if (!quick) BT.shake = .3; }
  await advWait(.5);
}
function btShinyFx() {
  Sfx.seq([[1568, .06], [2093, .06], [1568, .06], [2637, .16]], { vol: .05 });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; BT.parts.push({ type: 'star', x: 176 + Math.cos(a) * 10, y: 50 + Math.sin(a) * 10, vx: Math.cos(a) * 30, vy: Math.sin(a) * 30, life: 0, max: .8 }); }
}

/* ── Desenho (240x160) ── */
const BT_LOOK = {
  floresta: { sky: ['#78c0f8', '#d0f0d8'], far: '#4a9850', ground: ['#98d070', '#88c060'], pad: ['#5c9840', '#a8d880', '#c0e898'] },
  vulcao: { sky: ['#e88860', '#f8d8a8'], far: '#8a5848', ground: ['#c09060', '#b08050'], pad: ['#7a5034', '#c8a070', '#d8b888'] },
  praia: { sky: ['#60a8f0', '#d8f0f8'], far: '#3880d0', ground: ['#f0d8a0', '#e4c890'], pad: ['#b89858', '#f8e4b0', '#fff0c8'] },
};
const BT_BG = {};
const btHex = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
function btBg(area, ph) {
  const key = area + ph; if (BT_BG[key]) return BT_BG[key];
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  const L = BT_LOOK[area] || BT_LOOK.floresta, a = btHex(L.sky[0]), b = btHex(L.sky[1]);
  // céu em faixas de 4px (degradê "pixelado")
  for (let y = 0; y < 92; y += 4) { const k = y / 92; R(c, 0, y, W, 4, `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`); }
  const rnd = rng(area.length * 131);
  if (area === 'praia') { R(c, 0, 84, W, 8, L.far); for (let x = 0; x < W; x += 6) R(c, x + (x % 12 ? 2 : 0), 86, 3, 1, '#a8d8f8'); }
  else for (let x = 0; x < W; x += 2) { const hh = area === 'vulcao' ? 10 + Math.abs(((x + 40) % 120) - 60) / 3 : 8 + Math.round(rnd() * 3 + Math.sin(x * .15) * 3); R(c, x, 92 - hh, 2, hh, L.far); }
  R(c, 0, 92, W, H - 92, L.ground[0]);
  for (let y = 94; y < H; y += 6) for (let x = (y / 6 % 2) * 8; x < W; x += 16) R(c, x, y, 6, 2, L.ground[1]);
  // plataformas (ovais) do selvagem e do seu POKéMON
  for (const [x, y, rx, ry] of [[176, 80, 46, 11], [62, 152, 60, 13]]) { disc(c, x, y, rx, ry, L.pad[0]); disc(c, x, y - 1, rx - 2, ry - 2, L.pad[1]); disc(c, x - 6, y - 3, Math.round(rx * .55), Math.round(ry * .4), L.pad[2]); }
  if (PHASE_TINT[ph]) { c.fillStyle = PHASE_TINT[ph]; c.fillRect(0, 0, W, H); }
  return (BT_BG[key] = cv);
}
function btText(c, t, x, y, col = '#404048', align = 'left') {
  c.font = '8px "Press Start 2P", monospace'; c.textAlign = align; c.textBaseline = 'top';
  c.fillStyle = '#d8d0b8'; c.fillText(t, x + 1, y + 1); c.fillStyle = col; c.fillText(t, x, y);
}
// nível: o "Nv" miúdo e os números em 8px (cabe Nv100 antes do rótulo PS)
function btLv(c, L, x, y) { drawBm(c, BT_BM.nv, x + 1, y + 3, { K: '#d8d0b8' }); drawBm(c, BT_BM.nv, x, y + 2, { K: '#404048' }); btText(c, String(L), x + 10, y); }
function btBar(c, x, y, w, v, max) {
  const f = max > 0 ? Math.max(0, v) / max : 0, col = f > .5 ? '#58d080' : f > .2 ? '#f8d030' : '#f05030';
  R(c, x - 14, y - 2, w + 16, 7, '#505058'); drawBm(c, BT_BM.ps, x - 12, y - 1, { K: '#f8d030' });
  R(c, x, y - 1, w, 5, '#505058'); R(c, x + 1, y, w - 2, 3, '#f8f8f8');
  const fw = Math.ceil((w - 2) * f); if (fw > 0) { R(c, x + 1, y, fw, 3, col); R(c, x + 1, y, fw, 1, 'rgba(255,255,255,.4)'); }
}
function btBox(c, x, y, w, h) {
  R(c, x + 2, y + 2, w, h, 'rgba(0,0,0,.25)'); R(c, x, y, w, h, '#404848'); R(c, x + 1, y + 1, w - 2, h - 2, '#f8f8e0');
  R(c, x + 1, y + h - 3, w - 2, 2, '#d8d8b8');
}
function btDraw(c) {
  const e = BT.e; if (!e) { R(c, 0, 0, W, H, '#000'); return; }
  const area = e.area in BT_LOOK ? e.area : 'floresta', quake = BT.shake > 0 ? Math.round(Math.sin(BT.shake * 60) * 2) : 0;
  c.drawImage(btBg(area, phaseAt()), 0, 0);
  ctx = c;
  // selvagem (no alto, à direita)
  const wk = 'f' + e.sp + (e.shiny ? 's' : ''), wx = 176 + BT.wildDx - Math.round(BT.lungeW * 10);
  if (!BT.hideWild && !(BT.blinkW > 0 && Math.floor(BT.blinkW * 16) % 2)) {
    if (BT.absorb > 0) {
      const im = tinted(wk, '#f8f8f8'), z = 1 - BT.absorb, f = footOf(wk);
      if (im) c.drawImage(im, Math.round(wx - 32 * z), Math.round(80 - f.base * z), Math.round(64 * z), Math.round(64 * z));
    } else {
      c.save(); c.beginPath(); c.rect(0, 0, W, 84); c.clip();
      drawPokemon(wk, wx, 80 + Math.round(BT.sinkW * 64), {}); c.restore();
    }
    if (e.asleep && !BT.sinkW) drawBm(c, BM.zz, wx + 18, 22 - Math.floor(clock * 2) % 3, PAL);
  }
  // bola
  const b = BT.ball;
  if (b) {
    const pal = b.dim ? { ...BT_BALL_PAL[b.k], R: '#806060', W: '#a0a0a0' } : BT_BALL_PAL[b.k] || BT_PAL;
    drawBm(c, BT_BM.ball, Math.round(b.x + b.dx - 3), Math.round(b.y - 6 - b.open * 2), pal);
    if (b.open > 0) { c.globalAlpha = b.open; disc(c, Math.round(b.x), Math.round(b.y - 4), 8, 8, '#f8f8f8'); c.globalAlpha = 1; }
  }
  // seu POKéMON (de costas, embaixo à esquerda)
  const pk2 = monKey(s, true), px = 62 + BT.petDx + Math.round(BT.lungeP * 10) + quake;
  if (!(BT.blinkP > 0 && Math.floor(BT.blinkP * 16) % 2)) drawPokemon(pk2, px, 160 + Math.round(BT.sinkP * 70), {});
  // caixas (cada uma aparece quando o seu POKéMON entra)
  if (BT.boxW) btWildBox(c, e);
  if (BT.boxP) btPetBox(c, quake);
  btFx(c);
}
function btWildBox(c, e) {
  btBox(c, 6, 8, 108, 32);
  btText(c, DEX[e.sp].name, 12, 13);
  if (e.shiny) drawBm(c, BM.star, 104, 13, PAL);
  if (dexHas('caught', e.sp)) drawBm(c, BT_BM.ball, 104, 25, BT_PAL);
  btLv(c, e.lv, 12, 26);
  btBar(c, 62, 28, 40, BT.wildShown, e.maxHp);
}
function btPetBox(c, quake) {
  const bx = 124 + quake, by = 102;
  btBox(c, bx, by, 112, 46);
  btText(c, N(), bx + 6, by + 5);
  if (s.shiny) drawBm(c, BM.star, bx + 102, by + 5, PAL);
  btLv(c, s.level, bx + 6, by + 18);
  btBar(c, bx + 60, by + 20, 46, BT.petShown, BT.petMax);
  btText(c, `${Math.ceil(BT.petShown)}/${BT.petMax}`, bx + 106, by + 29, '#404048', 'right');
  R(c, bx + 6, by + 40, 100, 3, '#505058');
  const ef = s.level >= 100 ? 1 : Math.min(1, s.exp / needExp(s.level)); if (ef > 0) R(c, bx + 7, by + 41, Math.round(98 * ef), 1, '#40b8f0');
}
// partículas e a abertura
function btFx(c) {
  for (const p of BT.parts) {
    if (p.type === 'heart') drawBm(c, BM.heart, p.x - 4, p.y - 4, PAL);
    else if (Math.floor(p.life * 12) % 2 === 0) drawBm(c, BM.star, p.x - 2, p.y - 2, PAL);
  }
  // abertura: barras pretas se abrindo
  if (BT.wipe > 0) for (let i = 0; i < 8; i++) { const w = Math.ceil(W * BT.wipe); R(c, i % 2 ? W - w : 0, i * 20, w, 20, '#000'); }
}
