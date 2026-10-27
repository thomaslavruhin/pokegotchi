/* ════════════ HALL DA FAMA ════════════
   startHall(): o encerramento quando a POKéDEX chega a 151 (o módulo de progresso chama, com o POKéMON em casa e acordado).
   Tela preta → o time desfila (ativo + os 5 de maior nível do PC) → os capturados sobem como créditos → PROF. CARVALHO → DIPLOMA.
   1ª vez (sem G.hof): ao chegar no DIPLOMA grava G.hof = { at, team } e dispara 'hallDone' (o prêmio é de quem ouve).
   Com G.hof é reprise (CARTÃO): mostra o time gravado e não concede nada. startHall({ diploma: true }) vai direto ao DIPLOMA.
   A (toque) avança, B pula para o DIPLOMA; no DIPLOMA, A ou B volta para casa. */
const HL_STARS = (() => { const r = rng(151); return Array.from({ length: 70 }, () => ({ x: Math.floor(r() * W), y: Math.floor(r() * H), b: r() })); })();
const HL_CONF = ['#f85838', '#f8d030', '#58d080', '#40b8f0', '#e868b0', '#f8f8f8'];
const HL_COLS = 4, HL_ROW = 68, HL_TOP = 36;   // créditos: 4 por linha
let hl = null;

function startHall(opt = {}) {
  if (!G || !s) return;
  hl = hl_make(); go('hall', opt);
}
function hl_make() {
  const replay = !!G.hof, saved = replay && Array.isArray(G.hof.team) ? G.hof.team.filter(m => m && m.sp >= 1 && m.sp <= 151) : [];
  const caught = []; for (let id = 1; id <= 151; id++) if (dexHas('caught', id)) caught.push(id);
  return { replay, team: saved.length ? saved : hl_team(), caught, phase: '', t: 0, i: 0, at: replay ? num(G.hof.at, Date.now()) : Date.now(), music: 0 };
}
// o ativo e os 5 de maior nível do PC (empate: o mais antigo)
function hl_team() {
  const top = [...G.pc].sort((a, b) => b.level - a.level || a.caughtAt - b.caughtAt).slice(0, 5);
  return [s, ...top].map(m => ({ sp: m.sp, level: m.level, shiny: !!m.shiny }));
}
const hl_key = m => 'f' + m.sp + (m.shiny ? 's' : '');

function hl_phase(p) {
  hl.phase = p; hl.t = 0;
  if (p === 'intro') { sayNow('Bem-vindo ao HALL DA FAMA!'); hl_fanfare(); }
  else if (p === 'team') { hl.i = 0; hl_member(); }
  else if (p === 'lineup') Sfx.happy();
  else if (p === 'credits') { hl.music = 0; say('Parabéns! Você completou a POKéDEX de KANTO!'); }
  else if (p === 'prof') { sayNow('PROF. CARVALHO: Fantástico! Você completou a POKéDEX!'); Sfx.levelUp(); }
  else if (p === 'diploma') hl_diploma();
}
function hl_member() { const m = hl.team[hl.i]; hl.t = 0; sayNow(`${DEX[m.sp].name}${m.shiny ? ' ✦' : ''} · Nv. ${m.level}`); Sfx.cry(m.sp); }
function hl_diploma() {
  hl.phase = 'diploma'; hl.t = 0;
  Sfx.evoDone(); Sfx.seq([[0, .9], [1046, .12], [1318, .12], [1568, .4]], { vol: .06 });
  if (hl.replay || G.hof) { sayNow('DIPLOMA da POKéDEX de KANTO.'); return; }
  // 1ª vez: grava antes de qualquer outra coisa (fechar o app agora não repete o HALL nem o prêmio)
  G.hof = { at: hl.at, team: hl.team }; hl.replay = true; save();
  sayNow('Seu time entrou para o HALL DA FAMA!');
  fire('hallDone');
}
function hl_fanfare() {
  Sfx.seq([[523, .12], [523, .12], [523, .12], [784, .36], [659, .12], [784, .12], [1046, .6]], { vol: .07 });
  Sfx.seq([[262, .36], [330, .36], [392, .36], [523, .72]], { type: 'triangle', vol: .1 });
}
const HL_TUNE = [[784, .2], [659, .2], [523, .2], [659, .2], [698, .4], [880, .4], [784, .6], [0, .2], [659, .2], [698, .2], [784, .2], [1046, .2], [988, .4], [784, .4], [880, .8]];

// A / toque: pula para a próxima parte (com um respiro, para um toque duplo não pular duas)
function hl_next() {
  if (!hl || hl.t < .35) return;
  Sfx.click();
  if (hl.phase === 'intro') hl_phase('team');
  else if (hl.phase === 'team') { if (++hl.i < hl.team.length) hl_member(); else hl_phase('lineup'); }
  else if (hl.phase === 'lineup') hl_phase('credits');
  else if (hl.phase === 'credits') hl_phase('prof');
  else if (hl.phase === 'prof') hl_phase('diploma');
  else if (hl.phase === 'diploma' && hl.t > .8) hl_end();
}
function hl_skip() {
  if (!hl) return;
  if (hl.phase === 'diploma') { if (hl.t > .8) hl_end(); return; }
  Sfx.click(); hl_phase('diploma');
}
function hl_end() { hl = null; goHome(); }

SCENES.hall = {
  enter(opt) {
    if (!hl) hl = hl_make();   // entrou por go('hall') direto
    setKnobs([{ label: 'AVANÇAR', icon: '▶', fn: hl_next }, null, null, { label: 'PULAR', icon: '▶▶', fn: hl_skip }]);
    knobDefs.center = { fn: hl_next };
    if (opt && opt.diploma) hl_diploma(); else hl_phase('intro');
  },
  exit(next) { if (next !== 'hall') hl = null; },
  update(dt) {
    if (!hl) return;
    hl.t += dt;
    const p = hl.phase, still = RM.matches;
    if (p === 'intro' && hl.t > 3.2) hl_phase('team');
    else if (p === 'team' && hl.t > 2.8) { if (++hl.i < hl.team.length) hl_member(); else hl_phase('lineup'); }
    else if (p === 'lineup' && hl.t > 3.4) hl_phase('credits');
    else if (p === 'credits') {
      if (hl.t >= hl.music) { hl.music = hl.t + 6.4; Sfx.seq(HL_TUNE, { type: 'triangle', vol: .07 }); }
      const rows = Math.ceil(hl.caught.length / HL_COLS), len = HL_TOP + rows * HL_ROW + H;
      if (hl.t * (still ? 40 : 64) > len) hl_phase('prof');
    } else if (p === 'prof' && hl.t > 5) hl_phase('diploma');
  },
  draw(c) {
    if (!hl) return R(c, 0, 0, W, H, '#000');
    const p = hl.phase;
    if (p === 'prof') return hl_drawProf(c);
    if (p === 'diploma') return hl_drawDiploma(c);
    hl_drawSky(c, p !== 'intro');
    if (p === 'intro') {
      // o texto acende devagar (sem piscar)
      c.globalAlpha = Math.min(1, Math.max(0, (hl.t - .4) / .8));
      hl_text(c, 'BEM-VINDO AO', 120, 62, '#f8d030'); hl_text(c, 'HALL DA FAMA!', 120, 78, '#f8d030');
      c.globalAlpha = 1;
    } else if (p === 'team') hl_drawMember(c);
    else if (p === 'lineup') hl_drawLineup(c);
    else if (p === 'credits') hl_drawCredits(c);
  },
  key(e, k) {
    if (k === 'enter' || k === ' ' || k === 'z') { if (!e.repeat) hl_next(); }
    else if (k === 'escape' || k === 'x' || k === 'backspace') { if (!e.repeat) hl_skip(); }
    else if (!k.startsWith('arrow')) return false;
    e.preventDefault(); return true;
  },
  pointer() { hl_next(); },
};

/* ── desenho ── */
function hl_text(c, t, x, y, col, size = 8, align = 'center') {
  c.font = `${size}px "Press Start 2P", monospace`; c.textAlign = align; c.textBaseline = 'top';
  c.fillStyle = 'rgba(0,0,0,.6)'; c.fillText(t, x + 1, y + 1); c.fillStyle = col; c.fillText(t, x, y);
}
// céu estrelado; confete caindo (sem confete nem cintilar com "reduzir movimento")
function hl_drawSky(c, party) {
  R(c, 0, 0, W, H, '#080818');
  const still = RM.matches, T = clock;
  for (let i = 0; i < HL_STARS.length; i++) {
    const st = HL_STARS[i], a = still ? .5 + st.b * .4 : .35 + .55 * (.5 + .5 * Math.sin(T * 1.3 + i * 1.7));
    c.globalAlpha = a; R(c, st.x, st.y, 1, 1, st.b > .8 ? '#f8e8a0' : '#c8d8f8'); if (st.b > .93) { R(c, st.x - 1, st.y, 3, 1, '#f8e8a0'); R(c, st.x, st.y - 1, 1, 3, '#f8e8a0'); }
  }
  c.globalAlpha = 1;
  if (!party || still) return;
  for (let i = 0; i < 36; i++) {
    const sp = 22 + (i % 5) * 7, y = ((T * sp + i * 41) % (H + 20)) - 10, x = (i * 67 + Math.sin(T * 1.5 + i) * 8 + 240) % W;
    R(c, Math.round(x), Math.round(y), 2, (Math.floor(T * 4 + i) % 2) ? 3 : 2, HL_CONF[i % HL_CONF.length]);
  }
}
function hl_spot(c, x, y) { disc(c, x, y, 34, 6, 'rgba(248,232,160,.18)'); disc(c, x, y, 24, 4, 'rgba(248,232,160,.22)'); }
function hl_drawMember(c) {
  const m = hl.team[hl.i]; if (!m) return;
  hl_text(c, 'HALL DA FAMA', 120, 8, '#f8d030');
  // entra deslizando pela direita (parado com "reduzir movimento")
  const k = RM.matches ? 1 : Math.min(1, hl.t / .7), x = Math.round(120 + (1 - k) * (1 - k) * 200);
  hl_spot(c, x, 112);
  drawPokemon(hl_key(m), x, 112, {});
  if (k >= 1) { hl_text(c, DEX[m.sp].name + (m.shiny ? ' ✦' : ''), 120, 122, '#f8f8f8'); hl_text(c, `Nv. ${m.level}`, 120, 136, '#a8c8f8'); }
  hl_text(c, `${hl.i + 1}/${hl.team.length}`, 232, 8, '#8890b0', 8, 'right');
}
function hl_drawLineup(c) {
  hl_text(c, 'HALL DA FAMA', 120, 6, '#f8d030');
  const n = hl.team.length, top = Math.min(3, n), bottom = n - top;
  hl.team.forEach((m, i) => {
    const row = i < top ? 0 : 1, cnt = row ? bottom : top, j = row ? i - top : i;
    const x = Math.round(120 + (j - (cnt - 1) / 2) * 72), y = n > 3 ? (row ? 150 : 88) : 120;
    hl_spot(c, x, y); drawPokemon(hl_key(m), x, y, {});
  });
}
function hl_drawCredits(c) {
  const off = hl.t * (RM.matches ? 40 : 64), base = H - off;
  if (base + 8 > -12) hl_text(c, 'POKéMON CAPTURADOS', 120, base + 8, '#f8d030');
  hl.caught.forEach((id, i) => {
    const r = Math.floor(i / HL_COLS), col = i % HL_COLS, y = base + HL_TOP + r * HL_ROW;
    if (y < -HL_ROW || y > H + 4) return;
    const x = 30 + col * 60;
    drawPokemon('f' + id + (dexHas('shiny', id) ? 's' : ''), x, y + 46, {});
    hl_text(c, dxNo(id), x, y + 48, '#c8d8f8');
  });
  // faixas escuras em cima e embaixo: os créditos "saem" de trás delas
  R(c, 0, 0, W, 4, '#080818'); R(c, 0, H - 4, W, 4, '#080818');
}
function hl_drawProf(c) {
  c.drawImage(bg('lab'), 0, 0);
  R(c, 10, 10, 220, 64, '#202840'); R(c, 12, 12, 216, 60, '#f8f8f8'); R(c, 14, 14, 212, 56, '#f8f8f8');
  R(c, 12, 12, 216, 1, '#a8d0f0'); R(c, 12, 71, 216, 1, '#a8d0f0');
  const t = Math.min(1, hl.t / .6);
  c.globalAlpha = t;
  hl_text(c, 'PROF. CARVALHO:', 120, 20, '#e05040'); hl_text(c, 'Fantástico! Você', 120, 38, '#3a3a44'); hl_text(c, 'completou a POKéDEX!', 120, 54, '#3a3a44');
  c.globalAlpha = 1;
  drawShadow(monKey(s), 120, -1, 0);
  drawPokemon(monKey(s), 120, FEET, {});
}
function hl_drawDiploma(c) {
  R(c, 0, 0, W, H, '#5a3a20');
  for (let y = 0; y < H; y += 4) R(c, 0, y, W, 1, '#4e321a');   // mesa de madeira
  R(c, 8, 5, 224, 150, '#f8f0d0'); R(c, 8, 5, 224, 1, '#fff8e8');
  R(c, 8, 154, 224, 1, '#c8b890');
  // moldura dupla dourada com cantos
  const fr = (i, col) => { R(c, 8 + i, 5 + i, 224 - 2 * i, 1, col); R(c, 8 + i, 154 - i, 224 - 2 * i, 1, col); R(c, 8 + i, 5 + i, 1, 150 - 2 * i, col); R(c, 231 - i, 5 + i, 1, 150 - 2 * i, col); };
  fr(3, '#b08838'); fr(4, '#d8b050'); fr(7, '#b08838');
  for (const [x, y] of [[11, 8], [222, 8], [11, 145], [222, 145]]) { R(c, x, y, 7, 7, '#b08838'); R(c, x + 2, y + 2, 3, 3, '#f8d030'); }
  hl_text(c, 'DIPLOMA', 120, 16, '#a03020', 16);
  R(c, 56, 36, 128, 1, '#d8b050');
  hl_text(c, 'Este documento certifica', 120, 44, '#3a3a44');
  hl_text(c, 'que você completou a', 120, 58, '#3a3a44');
  hl_text(c, 'POKéDEX de KANTO', 120, 74, '#2050a0');
  hl_text(c, cdDate(hl.at), 120, 92, '#3a3a44');
  // assinatura
  c.strokeStyle = '#3a3a44'; c.lineWidth = 1; c.beginPath();
  for (let i = 0; i <= 40; i++) { const x = 116 + i * 2.2, y = 120 + Math.sin(i * .9) * 4 * Math.sin(i / 40 * Math.PI) - i * .12; i ? c.lineTo(x, y) : c.moveTo(x, y); }
  c.stroke();
  R(c, 106, 127, 108, 1, '#3a3a44');
  hl_text(c, 'PROF. CARVALHO', 160, 131, '#3a3a44');
  // selo: uma POKé BOLA dourada com fitas
  R(c, 34, 128, 5, 16, '#c03028'); R(c, 47, 128, 5, 16, '#c03028'); R(c, 34, 143, 2, 2, '#f8f0d0'); R(c, 50, 143, 2, 2, '#f8f0d0');
  disc(c, 43, 122, 15, 15, '#b08838'); disc(c, 43, 122, 13, 13, '#f8d030');
  disc(c, 43, 122, 10, 10, '#f8f8f8'); c.save(); c.beginPath(); c.rect(30, 108, 28, 14); c.clip(); disc(c, 43, 122, 10, 10, '#e83838'); c.restore();
  R(c, 33, 121, 21, 2, '#202028'); disc(c, 43, 122, 3, 3, '#202028'); disc(c, 43, 122, 2, 2, '#f8f8f8');
  // ▼ vermelho: pode tocar para sair
  if (hl.t > .8 && (RM.matches || Math.floor(hl.t * 1.5) % 2 === 0)) for (let i = 0; i < 4; i++) R(c, 219 + i, 143 + i, 7 - 2 * i, 1, '#e05040');
}
