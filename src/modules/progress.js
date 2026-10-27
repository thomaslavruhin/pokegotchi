/* ════════════ Progresso: insígnias, medalhas, presentes do PROF. CARVALHO ════════════
   Presente diário, POKé BOLAS por bom cuidado, rede de segurança de bolas, as 8 insígnias de Kanto,
   as medalhas e o gatilho do HALL DA FAMA. As recompensas vão para o save na hora; as mensagens
   esperam o POKéMON estar em casa (fila prog.notes, no save: fechar o app no meio não as perde). */
extendDefaults({
  prog: { medals: [], wins: 0, careDays: 0, nightCaps: 0, stoneTradeEvos: 0, trades: 0, fossils: 0, starterGifts: 0,
    charm: false, legend: {}, miniBest: 0, legendsCaught: 0, notes: [] },
  daily: { date: '', maxDate: '', streak: 0, careMin: 0, careBalls: 0, careDayCounted: false, miniGames: 0, miniBalls: 0,
    lastSafety: 0, giftDate: '' },
});

const PG_BADGE_NAMES = ['', 'ROCHA', 'CASCATA', 'TROVÃO', 'ARCO-ÍRIS', 'ALMA', 'PÂNTANO', 'VULCÃO', 'TERRA'];
const badgeName = n => PG_BADGE_NAMES[n] || '';
// onde corre o boato de cada lendário
const PG_RUMOR = { 144: 'nas ILHAS ESPUMA', 145: 'na FLORESTA DE VIRIDIAN', 146: 'no MONTE BRASA', 150: 'em algum lugar, à noite' };
const pg_lvl30 = () => s.level >= 30 || G.pc.some(m => m.level >= 30);
// condição de cada insígnia (a anterior já é exigida por pg_check, que vai em ordem)
const PG_BADGES = [null,
  { ok: c => c >= 10, items: [['poke', 10]], hint: 'POKéMON mais raros vão aparecer agora!' },
  { ok: c => c >= 25 && G.prog.careDays >= 3, items: [['great', 5], ['agua', 1]], hint: 'Agora você pode usar GRANDES BOLAS!', starter: true },
  { ok: c => c >= 40 && G.prog.wins >= 15, items: [['trovao', 1], ['cabo', 1], ['helix', 1]], hint: 'POKéMON muito raros vão aparecer agora!' },
  { ok: c => c >= 55 && G.prog.miniBest >= 200, items: [['folha', 1], ['ultra', 3], ['domo', 1]], hint: 'Agora você pode usar ULTRA BOLAS!', starter: true },
  { ok: c => c >= 70 && G.prog.stoneTradeEvos >= 1, items: [['lua', 1], ['cabo', 2]], legend: 144, hint: 'As evoluções dos iniciais agora vivem na natureza!' },
  { ok: c => c >= 85 && pg_lvl30(), items: [['fogo', 1], ['ambar', 1]], legend: 145, hint: 'OMASTAR e KABUTOPS agora vivem na natureza!' },
  { ok: c => c >= 100 && G.prog.nightCaps >= 10, items: [['lua', 1], ['cabo', 1], ['ultra', 5]], legend: 146 },
  { ok: c => c >= 120 && [144, 145, 146].every(id => dexHas('caught', id)), items: [['master', 1]], legend: 150 },
];
const PG_STONES = ['lua', 'fogo', 'agua', 'trovao', 'folha'];
// medalhas automáticas (MESTRE DO TREINO e MESTRE POKéMON vêm de ganchos)
const PG_MEDALS = [
  { name: 'BRILHO', ok: () => dexCount('shiny') >= 1, items: [['ultra', 5]] },
  { name: 'VETERANO', ok: () => G.prog.wins >= 100, items: [['great', 5]] },
  { name: 'FIEL', ok: () => G.daily.streak >= 7, items: [['ultra', 3]] },
  { name: 'COLHEDOR', ok: () => G.prog.miniBest >= 350, items: [['stone', 1]] },
  { name: 'PALEONTÓLOGO', ok: () => G.prog.fossils >= 3, items: [['ultra', 3]] },
  { name: 'NEGOCIANTE', ok: () => G.prog.trades >= 4, items: [['cabo', 1]] },
  { name: 'CAÇADOR DE LENDAS', ok: () => LEGENDS.every(id => dexHas('caught', id)), items: [['ultra', 5]] },
];

// "10 POKé BOLAS", "1 PEDRA DA LUA", "3 DOCES RAROS"
function pg_itemTxt(k, n) {
  let nm = ITEMS[k].name;
  if (n > 1) nm = nm.replace(/BOLA$/, 'BOLAS').replace(/^GRANDE /, 'GRANDES ').replace(/^DOCE RARO$/, 'DOCES RAROS').replace(/^CABO /, 'CABOS ').replace(/^PEDRA /, 'PEDRAS ')
    .replace(/^FÓSSIL /, 'FÓSSEIS ').replace(/^POÇÃO$/, 'POÇÕES');
  return `${n} ${nm}`;
}
function pg_give(k, n) {
  if (k === 'stone') k = PG_STONES[randInt(0, PG_STONES.length - 1)];   // COLHEDOR: uma pedra qualquer
  bagAdd(k, n); pg_note(`Você recebeu ${pg_itemTxt(k, n)}!`);
}

/* Fila de mensagens do progresso: uma de cada vez, só em casa, com a caixa livre (um sayNow de outra parte
   do jogo não apaga a fila inteira, e o som toca quando a mensagem aparece). Fica no save como [texto, som]. */
const PG_SFX = { happy: () => Sfx.happy(), fan: () => pg_fanfare(), medal: () => Sfx.levelUp(), evo: () => Sfx.evoDone() };
function pg_note(text, sfx) { const q = G.prog.notes; q.push([text, sfx || '']); if (q.length > 40) q.splice(0, q.length - 40); }
function pg_pump() {
  // nem no treino (apagaria a instrução), nem com menu ou o painel de OPÇÕES aberto (op_panel vem de options.js)
  if (!G || !G.prog.notes.length || !atHome() || document.hidden || pendingChoice || evo || training || sweep || Menu.top || op_panel
    || msg.queue.length || !msgIdle()) return;
  const e = G.prog.notes.shift(); save();
  if (!Array.isArray(e) || typeof e[0] !== 'string') return;   // save adulterado
  const sfx = String(e[1] || ''); say(e[0]);
  if (/^cry:\d+$/.test(sfx)) Sfx.cry(+sfx.slice(4)); else if (Object.hasOwn(PG_SFX, sfx)) PG_SFX[sfx]();
}
setInterval(pg_pump, 250);
// fanfarra curta de insígnia (no estilo do jingle de item importante)
const pg_fanfare = () => { Sfx.seq([[784, .1], [784, .1], [784, .1], [1046, .3], [0, .06], [932, .12], [1046, .45]], { vol: .07 });
  Sfx.seq([[392, .3], [523, .3], [466, .18], [523, .45]], { type: 'triangle', vol: .1 }); };

/* Virada do dia: só quando a data local passa da maior já vista (relógio para trás nunca paga duas vezes) */
function pg_day() {
  if (!G) return;
  const D = G.daily, today = localDate();
  if (D.maxDate && today <= D.maxDate) return;
  const y = new Date(); y.setHours(12, 0, 0, 0); y.setDate(y.getDate() - 1);   // meio-dia evita erro no horário de verão
  D.streak = D.maxDate === localDate(y.getTime()) ? D.streak + 1 : 1;
  // zera os contadores do dia (inclusive os de outros módulos), menos a sequência e a rede de segurança
  for (const k in DEFAULTS.daily) {
    if (k === 'streak' || k === 'lastSafety') continue;
    if (typeof D[k] === 'number') D[k] = 0; else if (typeof D[k] === 'boolean') D[k] = false;
  }
  D.date = D.maxDate = D.giftDate = today;
  const b = G.prog.badges;
  bagAdd('poke', 5); pg_note('PROF. CARVALHO: Separei 5 POKé BOLAS para você hoje!', 'happy');
  if (b >= 2) pg_give('great', 2);
  if (b >= 4) pg_give('ultra', 1);
  if (D.streak % 7 === 0) {
    pg_note(`PROF. CARVALHO: ${D.streak} dias seguidos! Isto é para você.`);
    if (b >= 4) pg_give('ultra', 1); else pg_give('great', 3);
  }
  save();
}

/* POKé BOLA por bom cuidado: 1 a cada 60 min bem cuidados (simulados também), no máx. 4 por dia */
on('wellCared', min => {
  if (!G) return;
  pg_day();
  const D = G.daily; D.careMin += min;
  if (!D.careDayCounted && D.careMin >= 60) { D.careDayCounted = true; G.prog.careDays++; }
  const target = Math.min(4, Math.floor(D.careMin / 60));
  while (D.careBalls < target) {
    D.careBalls++; bagAdd('poke', 1);
    // duas mensagens: numa só, nomes de 10 letras passam das 3 linhas da caixa no celular
    pg_note(`PROF. CARVALHO viu como você cuida bem de ${N()}!`, 'happy'); pg_note('Você ganhou 1 POKé BOLA!');
  }
});

// rede de segurança: sem bolas, o professor manda 5 (no máx. a cada 6 h)
function pg_safety() {
  if (!G || !atHome() || ballCount() >= 3) return;
  const now = Date.now();
  if (now - G.daily.lastSafety < 6 * 3600e3 && G.daily.lastSafety <= now) return;   // relógio para trás não trava
  G.daily.lastSafety = now; bagAdd('poke', 5);
  pg_note('PROF. CARVALHO: Tome 5 POKé BOLAS. Boa sorte!', 'happy'); save();
}

function pg_legendUnlock(id) {
  const L = G.prog.legend;
  if (!L[id]) L[id] = { unlockedAt: Date.now(), misses: 0, thrown: 0, hp: null, hpUntil: 0, backAt: 0, caught: false };
  return L[id];
}
// próximo inicial de presente: BULBASAUR -> CHARMANDER -> SQUIRTLE, pulando a linha escolhida no começo
function pg_starterGift() {
  const list = STARTERS.filter(id => id !== G.prog.firstStarter), id = list[G.prog.starterGifts];
  if (!id) return;
  G.prog.starterGifts++;
  receiveMon(id, 5, {}, 'gift');
  pg_note(`PROF. CARVALHO: Cuide bem deste ${DEX[id].name}! Ele está no seu PC.`, 'cry:' + id);
}
function pg_badge(n) {
  const B = PG_BADGES[n];
  G.prog.badges = n;
  pg_note(`Você recebeu a INSÍGNIA ${badgeName(n)}!`, 'fan');
  for (const [k, q] of B.items) pg_give(k, q);
  if (B.starter) pg_starterGift();
  if (B.legend) { pg_legendUnlock(B.legend); pg_note(`Dizem que um POKéMON lendário foi visto ${PG_RUMOR[B.legend]}...`); }
  if (B.hint) pg_note(B.hint);
}
function pg_medal(name, items) {
  if (G.prog.medals.includes(name)) return false;
  G.prog.medals.push(name);
  pg_note(`Você recebeu a medalha ${name}!`, 'medal');
  for (const [k, q] of items || []) pg_give(k, q);
  return true;
}
// confere insígnias (em ordem: a N exige a N-1) e medalhas; pg_busy evita reentrar pelo 'caught' do presente
let pg_busy = false;
function pg_check() {
  if (!G || !s || pg_busy) return;
  pg_busy = true;
  try {
    let changed = false;
    const c = dexCount('caught');
    while (G.prog.badges < 8 && PG_BADGES[G.prog.badges + 1].ok(c)) { pg_badge(G.prog.badges + 1); changed = true; }
    for (const m of PG_MEDALS) if (!G.prog.medals.includes(m.name) && m.ok()) changed = pg_medal(m.name, m.items) || changed;
    if (changed) { save(); updateUI(); }
  } finally { pg_busy = false; }
}

// HALL DA FAMA: POKéDEX completa, em casa e acordado (fora do 'home' em andamento, para não trocar de cena dentro dele)
function pg_hall() {
  setTimeout(() => {
    if (G && s && atHome() && !G.hof && !s.asleep && !evo && !pendingChoice && !Menu.top && !training && !sweep && !document.hidden
      && !op_panel && !msg.queue.length && msgIdle() && !G.prog.notes.length && !G.outing && !G.enc && dexCount('caught') === 151)
      typeof startHall === 'function' && startHall();
  }, 0);
}

on('boot', () => { if (G) { pg_day(); pg_check(); } });
on('home', () => { pg_day(); pg_safety(); pg_check(); pg_hall(); });
on('tick', () => { pg_day(); pg_safety(); pg_check(); pg_hall(); });   // completou em casa (evolução, presente) ou acordou
on('caught', (m, how) => {
  if (!G) return;
  // o contador de fósseis é só deste gancho: o módulo que revive o fóssil não mexe em prog.fossils
  if (how === 'fossil') G.prog.fossils++;
  if (LEGENDS.includes(m.sp)) {
    pg_legendUnlock(m.sp).caught = true;
    G.prog.legendsCaught = LEGENDS.filter(id => G.prog.legend[id] && G.prog.legend[id].caught).length;
    // MEW só depois de MEWTWO
    if (m.sp === 150 && !G.prog.legend[151]) { pg_legendUnlock(151); pg_note('Dizem que um POKéMON parecido com MEWTWO foi visto...'); }
  }
  pg_check(); save();
});
on('battleEnd', r => {
  if (!G || !r) return;
  // prog.wins é contado pela batalha, junto com o resultado gravado (aqui contaria em dobro)
  if (r.caught && (r.night ?? phaseAt() === 'NOITE')) G.prog.nightCaps++;
  pg_check(); save();
});
on('evolved', () => pg_check());
on('levelUp', () => pg_check());
on('minigame', r => {
  if (!G || !r) return;
  G.prog.miniBest = Math.max(G.prog.miniBest, Math.floor(num(r.score, 0)));
  pg_check(); save();
});
on('trained', notes => {
  if (!G || !Array.isArray(notes)) return;
  if (notes.length >= 3 && notes.every(q => q === 0) && pg_medal('MESTRE DO TREINO', [['doce', 3]])) save();
});
on('hallDone', () => {
  if (!G) return;
  G.prog.charm = true;
  // o HALL pode ser revisto (CARTÃO): o amuleto só é anunciado na primeira vez
  if (!pg_medal('MESTRE POKéMON', [])) { save(); return; }
  pg_note('Você recebeu o AMULETO BRILHANTE!', 'evo'); pg_note('POKéMON brilhantes vão aparecer mais vezes.');
  save(); updateUI();
});
