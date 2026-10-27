/* ════════════ POKéDEX ════════════
   Cena 'pokedex' (START → POKéDEX, tecla D): a lista dos 151 em HTML por cima da tela e a ficha de cada espécie.
   showDexEntry(id): só a ficha, por cima de qualquer cena (a 1ª captura de uma espécie, como no FRLG).
   Devolve uma Promise que resolve quando o jogador fecha a ficha; a cena de baixo continua onde estava. */

// nunca aparecem na grama (spec C): formas de pedra e de troca, fóssil estágio 0, iniciais
const DX_NEVER = new Set([26, 31, 34, 36, 38, 40, 45, 59, 62, 71, 91, 103, 121, 134, 135, 136, 65, 68, 76, 94, 138, 140, 142, 1, 4, 7]);
const DX_AREA = { floresta: 'FLORESTA DE VIRIDIAN', vulcao: 'MONTE BRASA', praia: 'ILHAS ESPUMA' };
const DX_STAT = ['PS', 'ATQ', 'DEF', 'AT.E', 'DF.E', 'VEL'];
const DX_BALL = bmSvg(['..KKK..', '.KRRRK.', 'KRRRRRK', 'KKKWKKK', 'KWWWWWK', '.KWWWK.', '..KKK..']);
const dxNo = id => 'Nº' + String(id).padStart(3, '0');
// onde a espécie vive. Estágios 1/2 dos iniciais viram selvagens na 5ª insígnia, OMASTAR e KABUTOPS na 6ª [fan]
function dexArea(id) {
  if (LEGENDS.includes(id)) return 'LENDÁRIO';
  const b = G ? G.prog.badges : 0;
  if (DX_NEVER.has(id) || ([2, 3, 5, 6, 8, 9].includes(id) && b < 5) || ((id === 139 || id === 141) && b < 6)) return 'NÃO É SELVAGEM';
  return DX_AREA[biomeOf(id)];
}
// DEX guarda altura em decímetros e peso em hectogramas
const dxMeasure = (v, u) => (v / 10).toFixed(1).replace('.', ',') + ' ' + u;

// botão redondo que repete enquanto apertado (listas longas). O clique que encerra um aperto longo não anda de novo.
// step() devolve false quando não há mais o que fazer (a tela fechou): o repetidor para sozinho.
function dxHoldKnob(label, icon, step) {
  let timer = 0, repeated = false;
  const stop = () => { clearTimeout(timer); clearInterval(timer); timer = 0; };
  return { label, icon, up: stop,
    down() { stop(); repeated = false; timer = setTimeout(() => { repeated = true; if (step() === false) return stop(); timer = setInterval(() => { if (step() === false) stop(); }, 90); }, 380); },
    fn() { stop(); if (repeated) { repeated = false; return; } step(); } };
}

const dx = { el: null, list: null, page: null, mode: null, view: 'list', sel: 0, id: 0, shiny: false, done: null, prevKnobs: null };

function dx_build() {
  if (dx.el) return;
  const el = document.createElement('div'); el.className = 'dx'; el.hidden = true;
  el.innerHTML = '<div class="dx-head"><span class="dx-title">POKéDEX</span><span class="dx-shc"></span></div>' +
    '<div class="dx-count"><span class="dx-seen"></span><span class="dx-caught"></span></div>' +
    '<div class="dx-list" role="listbox" aria-label="POKéDEX"></div><div class="dx-page" hidden></div>';
  document.querySelector('.screen-wrap').appendChild(el);
  dx.el = el; dx.list = el.querySelector('.dx-list'); dx.page = el.querySelector('.dx-page');
  // toque numa linha: escolhe e abre (as não vistas só recebem o cursor)
  dx.list.addEventListener('click', e => {
    const r = e.target.closest('.dx-row'); if (!r) return;
    dx_select(+r.dataset.id - 1); dx_ok();
  });
  el.addEventListener('click', e => { if (e.target.closest('.dx-shbtn')) dx_toggleShiny(); else if (e.target.closest('.dx-pic')) Sfx.cry(dx.id); });
  // outra aba zerou o jogo (volta à escolha do inicial sem passar pelo exit da cena): some junto
  new MutationObserver(() => { if (!$('selectLayer').hidden) dx_close(); }).observe($('selectLayer'), { attributes: true, attributeFilter: ['hidden'] });
}

// cabeçalho vermelho: na lista, os contadores; na ficha, Nº e nome (sobra altura para os dados em tela de celular)
function dx_header() {
  const q = c => dx.el.querySelector(c);
  if (dx.view === 'page') {
    const id = dx.id;
    q('.dx-title').textContent = `${dxNo(id)} ${DEX[id].name}`;
    q('.dx-shc').innerHTML = (dexHas('caught', id) ? DX_BALL : '') + (dexHas('shiny', id) && dexHas('caught', id)
      ? `<button type="button" class="dx-shbtn${dx.shiny ? ' on' : ''}" tabindex="-1" aria-label="Ver cores ${dx.shiny ? 'normais' : 'brilhantes'}">✦</button>` : '');
    return;
  }
  q('.dx-title').textContent = 'POKéDEX';
  q('.dx-seen').textContent = `VISTOS: ${dexCount('seen')}`;
  q('.dx-caught').textContent = `CAPTURADOS: ${dexCount('caught')} / 151`;
  q('.dx-shc').textContent = G.hof ? `BRILHANTES: ${dexCount('shiny')} / 151` : '';
}
function dx_rowHTML(id) {
  const d = DEX[id], seen = dexHas('seen', id), caught = dexHas('caught', id), sel = id - 1 === dx.sel;
  const pic = caught ? `<img src="${SPRITES['f' + id] || ''}" alt="" loading="lazy">` : seen ? `<img class="dx-sil" src="${SPRITES['f' + id] || ''}" alt="" loading="lazy">` : '';
  const mk = (caught ? DX_BALL : '') + (dexHas('shiny', id) ? '<b class="dx-shy" title="Brilhante capturado">✦</b>' : '');
  return `<div class="dx-row${sel ? ' sel' : ''}${seen ? '' : ' unseen'}" role="option" aria-selected="${sel}" data-id="${id}">` +
    `<span class="dx-ico">${pic}</span><span>${dxNo(id)}</span><span class="dx-nm">${seen ? d.name : '-----'}</span><span class="dx-mk">${mk}</span></div>`;
}
function dx_renderList() {
  dx_header();
  let h = ''; for (let id = 1; id <= 151; id++) h += dx_rowHTML(id);
  dx.list.innerHTML = h;
}
function dx_select(i, center) {
  i = Math.max(0, Math.min(150, i));
  const old = dx.list.children[dx.sel], row = dx.list.children[i];
  if (old) { old.classList.remove('sel'); old.setAttribute('aria-selected', 'false'); }
  dx.sel = i;
  if (row) { row.classList.add('sel'); row.setAttribute('aria-selected', 'true'); row.scrollIntoView({ block: center ? 'center' : 'nearest' }); }
}
function dx_move(d) {
  if (!dx.el || dx.el.hidden || dx.view !== 'list') return false;
  const i = Math.max(0, Math.min(150, dx.sel + d));
  if (i === dx.sel) return false;
  dx_select(i); Sfx.click();
}

function dx_show() {
  dx.el.hidden = false; dx.el.parentNode.appendChild(dx.el);   // por último no DOM: fica sobre camadas de outros módulos
}
function dx_openList() {
  dx.view = 'list'; dx.page.hidden = true; dx.list.hidden = false; dx.el.classList.remove('paged');
  dx_renderList(); dx_select(dx.sel, true);
  setKnobs([dxHoldKnob('▲', '▲', () => dx_move(-1)), dxHoldKnob('▼', '▼', () => dx_move(1)),
    { label: 'OK', icon: 'OK', fn: dx_ok }, { label: 'VOLTAR', icon: '◀', fn: dx_back }]);
  knobDefs.center = { fn: dx_ok };
}
function dx_ok() {
  const id = dx.sel + 1;
  if (!dexHas('seen', id)) return Sfx.deny();
  Sfx.click(); dx_openPage(id);
}
function dx_back() {
  if (dx.mode === 'popup') return dx_close();
  if (dx.view === 'page') { Sfx.click(); dx_openList(); return; }
  Sfx.click(); goHome();
}

// ficha de uma espécie: completa se capturada, só a silhueta se apenas vista
function dx_openPage(id, quiet) {
  dx.view = 'page'; dx.id = id; dx.shiny = false; dx.sel = id - 1;
  dx.list.hidden = true; dx.page.hidden = false; dx.el.classList.add('paged');
  dx_renderPage();
  if (dexHas('caught', id) && !quiet) Sfx.cry(id);
  const pop = dx.mode === 'popup';
  setKnobs(pop ? [null, null, { label: 'OK', icon: 'OK', fn: dx_close }, { label: 'VOLTAR', icon: '◀', fn: dx_close }]
    : [{ label: '▲', icon: '▲', fn: () => dx_step(-1) }, { label: '▼', icon: '▼', fn: () => dx_step(1) },
      { label: 'OK', icon: 'OK', fn: dx_pageOk }, { label: 'VOLTAR', icon: '◀', fn: dx_back }]);
  knobDefs.center = { fn: pop ? dx_close : dx_pageOk };
}
function dx_renderPage() {
  const id = dx.id, d = DEX[id], caught = dexHas('caught', id);
  const key = 'f' + id + (dx.shiny ? 's' : ''), src = caught ? spriteURL(key) : SPRITES['f' + id] || '';
  dx_header();
  if (!caught) {
    dx.page.innerHTML = `<div class="dx-pbody"><div class="dx-pic"><img class="dx-sil" src="${src}" alt=""></div>` +
      '<div class="dx-info"><div>Capture para ver os dados.</div></div></div>';
    return;
  }
  // o PNG brilhante é montado na 1ª vez (assíncrono): até lá spriteURL devolve o normal, então redesenha logo depois
  if (dx.shiny && !SHINY_URL[key]) setTimeout(() => { if (dx.view === 'page' && dx.id === id && dx.shiny && SHINY_URL[key]) dx_renderPage(); }, 150);
  dx.page.innerHTML =
    `<div class="dx-pbody"><div class="dx-pic${dx.shiny ? ' shiny' : ''}"><img src="${src}" alt="${d.name}"></div><div class="dx-info">` +
    `<div class="types">${d.types.map(t => `<span class="type" style="background:${TYPE_COLOR[t]}">${t}</span>`).join('')}</div>` +
    `<div><span class="dx-lbl">ALTURA</span> ${dxMeasure(d.h, 'm')}</div><div><span class="dx-lbl">PESO</span> ${dxMeasure(d.w, 'kg')}</div>` +
    `<div><span class="dx-lbl">ÁREA</span> ${dexArea(id)}</div></div></div>` +
    `<div class="dx-stats">${d.base.map((b, i) => `<div class="dx-st"><span>${DX_STAT[i]}</span><span class="b"><i style="width:${Math.min(100, b / 130 * 100)}%"></i></span><span class="n">${b}</span></div>`).join('')}</div>` +
    `<div class="dx-evo">${evoText(d).replace(/→/g, '»')}</div>`;   // a fonte pixel não tem a seta
}
function dx_pageOk() { if (dexHas('shiny', dx.id)) dx_toggleShiny(); else Sfx.cry(dx.id); }
function dx_toggleShiny() {
  if (dx.view !== 'page' || !dexHas('shiny', dx.id) || !dexHas('caught', dx.id)) return Sfx.deny();
  dx.shiny = !dx.shiny; dx_renderPage(); Sfx.cry(dx.id);
}
// ▲▼ na ficha: a espécie vista anterior/seguinte (como no FRLG)
function dx_step(d) {
  for (let id = dx.id + d; id >= 1 && id <= 151; id += d) if (dexHas('seen', id)) { Sfx.click(); dx_openPage(id); return; }
  Sfx.deny();
}

// teclado: ▲▼ anda, ◀▶ pula 7 linhas (na ficha: cores brilhantes), A abre, B volta
function dx_key(e, k) {
  const A = k === 'enter' || k === ' ' || k === 'z', B = k === 'escape' || k === 'x' || k === 'backspace';
  const up = k === 'arrowup' || k === 'w', down = k === 'arrowdown' || k === 's', side = k === 'arrowleft' || k === 'arrowright';
  if (dx.view === 'list') {
    if (up || down) dx_move(up ? -1 : 1);
    else if (side || k === 'pageup' || k === 'pagedown') dx_move(k === 'arrowleft' || k === 'pageup' ? -7 : 7);
    else if (k === 'home' || k === 'end') { dx_select(k === 'home' ? 0 : 150); Sfx.click(); }
    else if (A) { if (!e.repeat) dx_ok(); }
    else if (B) { if (!e.repeat) dx_back(); }
    else return false;
  } else if (dx.mode === 'popup') {
    if (side) { if (!e.repeat) dx_toggleShiny(); }
    else if (A || B) { if (!e.repeat) dx_close(); }
    else if (!up && !down) return false;
  } else {
    if (up || down) dx_step(up ? -1 : 1);
    else if (side) { if (!e.repeat) dx_toggleShiny(); }
    else if (k === 'pageup' || k === 'pagedown') dx.page.scrollTop += (k === 'pageup' ? -.6 : .6) * dx.page.clientHeight;   // ficha longa (EEVEE) em tela pequena
    else if (A) { if (!e.repeat) dx_pageOk(); }
    else if (B) { if (!e.repeat) dx_back(); }
    else return false;
  }
  e.preventDefault(); return true;
}
// na ficha avulsa a cena de baixo não pode receber as teclas: escuta antes de todo mundo (captura) e para a propagação
function dx_popKey(e) {
  if (pendingChoice || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k >= '1' && k <= '4') { e.stopImmediatePropagation(); e.preventDefault(); if (!e.repeat) $(KNOB_IDS[+k - 1]).click(); return; }
  if (!dx_key(e, k) && k === 'm') return;   // só o SOM passa; o resto (F, T, C...) não pode agir na cena escondida
  e.stopImmediatePropagation();
}

function showDexEntry(id) {
  id = Math.floor(+id);
  if (!G || !(id >= 1 && id <= 151) || !dexHas('seen', id)) return Promise.resolve();
  dx_build();
  if (dx.mode === 'scene') { dx_openPage(id); return Promise.resolve(); }
  if (dx.mode === 'popup') { dx_openPage(id); return dx.wait; }
  dx.mode = 'popup'; dx.prevKnobs = knobDefs;
  window.addEventListener('keydown', dx_popKey, true);
  dx.wait = new Promise(res => { dx.done = res; });
  dx_show(); dx_openPage(id);
  return dx.wait;
}
// fecha a POKéDEX (cena ou ficha avulsa); a avulsa devolve os botões da cena de baixo e resolve a Promise
function dx_close() {
  if (!dx.el || !dx.mode) return;
  const pop = dx.mode === 'popup', done = dx.done;
  dx.el.hidden = true; dx.mode = null; dx.done = null;
  if (pop) {
    window.removeEventListener('keydown', dx_popKey, true);
    if (knobDefs && knobDefs.center && (knobDefs.center.fn === dx_close)) setKnobs(dx.prevKnobs);
    dx.prevKnobs = null; Sfx.click(); done && done();
  }
}

SCENES.pokedex = {
  enter(arg) { dx_build(); dx_close(); dx.mode = 'scene'; dx_show(); if (arg && arg.id && dexHas('seen', arg.id)) dx_openPage(arg.id); else dx_openList(); },
  exit() { if (dx.mode === 'scene') dx_close(); },
  draw(c) { R(c, 0, 0, W, H, '#b8261f'); },
  key: dx_key,
};
// a ficha avulsa sobrevive à volta para casa (quem chamou pode não ter esperado): retoma os botões, e ao fechar
// eles voltam a ser os do habitat. A cena da POKéDEX já foi fechada pelo exit.
on('home', () => { if (dx.mode === 'popup') { dx.prevKnobs = null; dx_openPage(dx.id, true); } });
on('newGame', dx_close);

addStartItem({ label: 'POKéDEX', order: 20, fn: () => go('pokedex') });
HAB_KEYS.d = () => { Sfx.click(); go('pokedex'); };
// testes (#dev): a ficha avulsa e o HALL no console
on('boot', () => { if (window.PKG) Object.assign(window.PKG, { showDexEntry, startHall, dexArea }); });
