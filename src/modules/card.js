/* ════════════ CARTÃO DE TREINADOR ════════════
   Cena 'card' (START → CARTÃO): POKéDEX, dias de jogo, vitórias, as 8 insígnias de Kanto e as medalhas.
   Depois do HALL DA FAMA, rever o HALL e o DIPLOMA (hall.js). Só lê o progresso: quem concede é o módulo de progresso. */
extendDefaults({ prog: { medals: [], wins: 0 } });

// insígnias em pixel art 13x13 (K = contorno). Apagada: só o contorno, cinza.
const CD_BADGES = [
  { name: 'ROCHA', pal: { K: '#303040', W: '#f8f8f8', w: '#c8c8d0', g: '#9098a8', D: '#606878' }, bm: ['....KKKKK....', '...KWwwwwK...', '..KWwwwwwgK..', '.KWwwwwwwggK.', 'KWwwwwwwwgggK', 'KwwwwwwwggggK', 'KwwwwwwggggDK', 'KwwwwwggggDDK', 'KwwwwggggDDDK', '.KwggggDDDDK.', '..KggDDDDDK..', '...KDDDDDK...', '....KKKKK....'] },
  { name: 'CASCATA', pal: { K: '#203058', C: '#68a8f0', B: '#3868c0', W: '#f8f8f8' }, bm: ['......K......', '.....KCK.....', '....KCCCK....', '....KCCCK....', '...KCWCCCK...', '..KCWCCCCBK..', '..KCWCCCCBK..', '.KCCCCCCCBBK.', '.KCCCCCCBBBK.', '.KCCCCCCBBBK.', '..KCCCCBBBK..', '...KKBBBKK...', '.....KKK.....'] },
  { name: 'TROVÃO', pal: { K: '#583010', O: '#f08030', Y: '#f8d030', W: '#fff8c0' }, bm: ['......K......', '.....KOK.....', '....KOOOK....', '...KOOYOOK...', '..KOOYYYOOK..', '.KOOYYWYYOOK.', 'KOOYYWWWYYOOK', '.KOOYYWYYOOK.', '..KOOYYYOOK..', '...KOOYOOK...', '....KOOOK....', '.....KOK.....', '......K......'] },
  { name: 'ARCO-ÍRIS', pal: { K: '#303040', R: '#e83838', G: '#58b048', Y: '#f8d030', B: '#5880e0', W: '#f8f8f8' }, bm: ['.....KKK.....', '....KRRRK....', '....KRRRK....', '.KKK.KRK.KKK.', 'KGGGK.K.KYYYK', 'KGGGGKWKYYYYK', 'KGGGGWWWYYYYK', 'KGGGGKWKYYYYK', 'KGGGK.K.KYYYK', '.KKK.KBK.KKK.', '....KBBBK....', '....KBBBK....', '.....KKK.....'] },
  { name: 'ALMA', pal: { K: '#602048', P: '#e868b0', W: '#fff0f8' }, bm: ['.............', '..KKK...KKK..', '.KPPPK.KPPPK.', 'KPWPPPKPPPPPK', 'KPWPPPPPPPPPK', 'KPPPPPPPPPPPK', '.KPPPPPPPPPK.', '..KPPPPPPPK..', '...KPPPPPK...', '....KPPPK....', '.....KPK.....', '......K......', '.............'] },
  { name: 'PÂNTANO', pal: { K: '#584010', Y: '#f8d030', O: '#c89020' }, bm: ['....KKKKK....', '..KKYYYYYKK..', '.KYYOOOOOYYK.', '.KYOKKKKKOYK.', 'KYOK.....KOYK', 'KYOK.KKK.KOYK', 'KYOK.KYK.KOYK', 'KYOK.KKK.KOYK', 'KYOK.....KOYK', '.KYOKKKKKOYK.', '.KYYOOOOOYYK.', '..KKYYYYYKK..', '....KKKKK....'] },
  { name: 'VULCÃO', pal: { K: '#581818', R: '#e83838', O: '#f08030', Y: '#f8d030' }, bm: ['.....K.......', '....KRK......', '....KRRK.....', '...KRRRK..K..', '...KRRORK.KK.', '..KRROORKKRK.', '..KRROOORRRK.', '.KRROOYOORRK.', '.KRROYYYOORK.', '.KRROYYYOORK.', '..KRROYOORK..', '...KRRRRRK...', '....KKKKK....'] },
  { name: 'TERRA', pal: { K: '#204818', G: '#58b048', L: '#a8e070' }, bm: ['.........KKK.', '.......KKGGK.', '.....KKGGGGK.', '....KGGGGGLK.', '...KGGGGGLGK.', '..KGGGGGLGGK.', '..KGGGGLGGK..', '.KGGGGLGGGK..', '.KGGGLGGGK...', '.KGGLGGKK....', '.KGLKKK......', '.KLK.........', 'KK...........'] },
];
const CD_DIM = { K: '#8a90a8' };
// chaves das medalhas: o módulo de progresso grava em G.prog.medals. Aceita a chave curta daqui ou o nome
// (sem acento, qualquer caixa): a ordem importa — "mestre do treino" casa com treino antes de mestre
const CD_MEDALS = [
  { k: 'brilho', name: 'BRILHO', hint: 'Capture um POKéMON brilhante.', re: /brilh|shiny/ },
  { k: 'veterano', name: 'VETERANO', hint: 'Vença 100 batalhas.', re: /veteran/ },
  { k: 'fiel', name: 'FIEL', hint: 'Jogue 7 dias seguidos.', re: /fiel|streak/ },
  { k: 'treino', name: 'MESTRE DO TREINO', hint: 'Faça um treino com 3 CRÍTICOS.', re: /trein|train/ },
  { k: 'colhedor', name: 'COLHEDOR', hint: 'Faça 350 pontos na COLHEITA.', re: /colhe|harvest/ },
  { k: 'paleontologo', name: 'PALEONTÓLOGO', hint: 'Reviva 3 fósseis.', re: /paleo|fossil/ },
  { k: 'negociante', name: 'NEGOCIANTE', hint: 'Faça 4 trocas.', re: /negoci|troca|trade/ },
  { k: 'lendas', name: 'CAÇADOR DE LENDAS', hint: 'Capture os 5 lendários.', re: /lend|legend/ },
  { k: 'mestre', name: 'MESTRE POKéMON', hint: 'Entre no HALL DA FAMA.', re: /mestre|master|hall|hof/ },
];
const cdNorm = v => String(v && typeof v === 'object' ? v.k || v.key || v.id || '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
function cardMedals() {
  const got = new Set();
  for (const m of Array.isArray(G.prog.medals) ? G.prog.medals : []) { const n = cdNorm(m); const i = n ? CD_MEDALS.findIndex(md => md.re.test(n)) : -1; if (i >= 0) got.add(i); }
  return got;
}
const cdDate = t => { const d = new Date(t); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };
// início do jogo: o POKéMON mais antigo que você tem (o inicial, salvo se foi solto)
const cardStart = () => Math.min(s.born, ...G.pc.map(m => m.born || Date.now()));

const cd = { el: null, body: null };
function cd_build() {
  if (cd.el) return;
  const el = document.createElement('div'); el.className = 'cd'; el.hidden = true;
  el.innerHTML = '<div class="cd-card"><div class="cd-title">CARTÃO DE TREINADOR</div><div class="cd-body"></div></div>';
  document.querySelector('.screen-wrap').appendChild(el);
  cd.el = el; cd.body = el.querySelector('.cd-body');
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-cd]'); if (!b) return;
    const a = b.dataset.cd;
    if (a === 'hall') { Sfx.click(); startHall(); }
    else if (a === 'diploma') { Sfx.click(); startHall({ diploma: true }); }
    else if (a.startsWith('badge')) { const i = +a.slice(5), n = CD_BADGES[i].name; Sfx.click(); sayNow(i < G.prog.badges ? `INSÍGNIA ${n}!` : `INSÍGNIA ${n}: ainda não conquistada.`); }
  });
  new MutationObserver(() => { if (!$('selectLayer').hidden) cd.el.hidden = true; }).observe($('selectLayer'), { attributes: true, attributeFilter: ['hidden'] });
}
function cd_render() {
  const now = Date.now(), days = Math.floor((now - cardStart()) / 864e5) + 1, nb = clamp(Math.floor(G.prog.badges) || 0, 0, 8), med = cardMedals();
  const row = (l, v) => `<div class="cd-row"><span>${l}</span><span>${v}</span></div>`;
  cd.body.innerHTML =
    `<div class="cd-top"><div class="cd-pic"><img src="${spriteURL(monKey(s))}" alt=""></div><div class="cd-rows">` +
      row('POKéDEX', `${dexCount('caught')} / 151`) + row('VISTOS', dexCount('seen')) +
      (G.hof || dexCount('shiny') ? row('BRILHANTES', `${dexCount('shiny')} / 151`) : '') +
      row('DIAS DE JOGO', days) + row('VITÓRIAS', Math.floor(G.prog.wins) || 0) + row('INÍCIO', cdDate(cardStart())) +
    '</div></div>' +
    `<div class="cd-sec">INSÍGNIAS <span>${nb} / 8</span></div><div class="cd-badges">` +
      CD_BADGES.map((b, i) => `<button type="button" tabindex="-1" class="cd-badge${i < nb ? ' on' : ''}" data-cd="badge${i}" aria-label="INSÍGNIA ${b.name}${i < nb ? '' : ' (não conquistada)'}">` +
        `${bmSvg(b.bm, i < nb ? b.pal : CD_DIM)}<span>${i < nb ? b.name : '???'}</span></button>`).join('') + '</div>' +
    `<div class="cd-sec">MEDALHAS <span>${med.size} / ${CD_MEDALS.length}</span></div><div class="cd-medals">` +
      CD_MEDALS.map((m, i) => med.has(i) ? `<div class="cd-medal on"><i></i><span>${m.name}</span></div>`
        : `<div class="cd-medal"><i></i><span>???<small>${m.hint}</small></span></div>`).join('') + '</div>' +
    (G.hof ? `<div class="cd-sec">HALL DA FAMA <span>${cdDate(num(G.hof.at, now))}</span></div>` +
      '<div class="cd-hof"><button type="button" tabindex="-1" data-cd="hall">HALL DA FAMA</button><button type="button" tabindex="-1" data-cd="diploma">DIPLOMA</button></div>' : '');
}
function cd_scroll(d) {
  if (!cd.el || cd.el.hidden || Menu.top) return false;
  const b = cd.body, top = b.scrollTop; b.scrollTop = top + d * Math.max(16, b.clientHeight * .4);
  if (b.scrollTop === top) return false;
  Sfx.click();
}
// OK: com o HALL DA FAMA aberto, o menu para revê-lo; antes disso, só um lembrete
function cd_ok() {
  if (!G.hof) { sayNow(`Complete a POKéDEX (${dexCount('caught')} / 151) para entrar no HALL DA FAMA!`); return Sfx.click(); }
  Menu.open({ title: 'HALL DA FAMA', items: [
    { label: 'REVER O HALL', fn: () => startHall() },
    { label: 'VER DIPLOMA', fn: () => startHall({ diploma: true }) },
    { label: 'VOLTAR', fn: () => Menu.close() }] });
}

SCENES.card = {
  enter() {
    cd_build(); cd_render(); cd.el.hidden = false; cd.el.parentNode.appendChild(cd.el); cd.body.scrollTop = 0;
    setKnobs([dxHoldKnob('▲', '▲', () => cd_scroll(-1)), dxHoldKnob('▼', '▼', () => cd_scroll(1)),
      { label: 'OK', icon: 'OK', fn: cd_ok }, { label: 'VOLTAR', icon: '◀', fn: () => { Sfx.click(); goHome(); } }]);
    knobDefs.center = { fn: cd_ok };
  },
  exit() { if (cd.el) cd.el.hidden = true; },
  draw(c) { R(c, 0, 0, W, H, '#3a5a90'); },
  key(e, k) {
    if (k === 'arrowup' || k === 'w' || k === 'arrowdown' || k === 's') cd_scroll(k === 'arrowup' || k === 'w' ? -1 : 1);
    else if (k === 'enter' || k === ' ' || k === 'z') { if (!e.repeat) cd_ok(); }
    else if (k === 'escape' || k === 'x' || k === 'backspace') { if (!e.repeat) { Sfx.click(); goHome(); } }
    else return false;
    e.preventDefault(); return true;
  },
};
on('newGame', () => { if (cd.el) cd.el.hidden = true; });

addStartItem({ label: 'CARTÃO', order: 60, fn: () => go('card') });
