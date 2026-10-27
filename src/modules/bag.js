/* ════════════ BOLSA (em casa) ════════════
   Lista os itens que o jogador tem; DOCE RARO e pedras no POKéMON ativo, fósseis viram POKéMON no PC.
   A batalha tem a sua própria bolsa; esta é a de casa (START → BOLSA, tecla I). As peças de pedra/doce
   (bag_stonesFor, bag_candy…) também servem ao PC (pc.js). */
extendDefaults({ prog: { fossils: 0, stoneTradeEvos: 0, trades: 0 } });

// ordem na lista: remédios, evolução, fósseis, bolas
const BAG_ORDER = ['pocao', 'doce', 'lua', 'fogo', 'agua', 'trovao', 'folha', 'cabo', 'helix', 'domo', 'ambar', 'poke', 'great', 'ultra', 'master'];
const BAG_DESC = {
  pocao: 'Recupera PS na batalha.', doce: 'Sobe 1 nível.', cabo: 'Use no PC: TROCAR.',
  poke: 'Para capturar POKéMON.', great: 'Captura melhor que a POKé BOLA.', ultra: 'Captura melhor que a GRANDE BOLA.', master: 'Captura sem falhar.',
};
// ícones 8-bit (X = cor do item)
const BAG_BM = {
  ball: ['..KKKK..', '.KXXXXK.', 'KXXWXXXK', 'KKKKKKKK', 'KWWKKWWK', 'KWWWWWWK', '.KWWWWK.', '..KKKK..'],
  pocao: ['..KKK..', '..KwK..', '.KKKKK.', 'KXXXXXK', 'KXWXXXK', 'KXXXXXK', 'KXXXXXK', '.KKKKK.'],
  doce: ['KK.KKK.KK', 'KXKXXXKXK', '.KXXWXXK.', 'KXKXXXKXK', 'KK.KKK.KK'],
  stone: ['..KKK..', '.KXXXK.', 'KXWXXXK', 'KXXXXXK', 'KXXXXXK', '.KXXXK.', '..KKK..'],
  cabo: ['.KK......', 'KggK.....', 'KggKKKKK.', '.KK....YK', '.......KK'],
  fossil: ['.KKKK.', 'KXXXXK', 'KXDXXK', 'KXXDXK', 'KXXXXK', '.KKKK.'],
};
const BAG_COL = { poke: '#e83838', great: '#4878e0', ultra: '#f8d030', master: '#9050c0', pocao: '#9050c0', doce: '#70c8f8',
  lua: '#8890a8', fogo: '#f08030', agua: '#6890f0', trovao: '#a8d848', folha: '#58b048', helix: '#c08848', domo: '#c08848', ambar: '#f0a030' };
function bag_icon(k) {
  const it = ITEMS[k], bm = BALLS.includes(k) ? BAG_BM.ball : it.stone ? BAG_BM.stone : it.fossil ? BAG_BM.fossil : BAG_BM[k] || BAG_BM.stone;
  return `<span class="bag-ico">${bmSvg(bm, { ...PAL, X: BAG_COL[k] || '#c0c0c0' })}</span>`;
}

// evoluções por pedra de uma espécie: [{ k, to }] (k = chave do item; o nome bate com DEX[].evo[].item)
const bag_stoneEvos = spId => DEX[spId].evo.filter(e => e.item).map(e => ({ k: Object.keys(ITEMS).find(k => ITEMS[k].name === e.item), to: e.to })).filter(e => e.k);
const bag_stoneTo = (spId, k) => (bag_stoneEvos(spId).find(e => e.k === k) || {}).to;
// pedras da BOLSA que servem para a espécie
const bag_stonesFor = spId => bag_stoneEvos(spId).filter(e => bagHas(e.k));

// DOCE RARO: +1 nível pelas regras do núcleo (EXP vai a 0). No ativo, live = mensagem e pendingEvo (o núcleo evolui em casa).
function bag_candy(m, live) {
  if (m.level >= 100) { sayNow('Não teria efeito.'); Sfx.deny(); return false; }
  if (!bagUse('doce')) return false;
  addExp(needExp(m.level) - m.exp, live, m);
  if (!live) { sayNow(`${N(m)} subiu para o Nv. ${m.level}!`); Sfx.levelUp(); }
  save(); updateUI(); return true;
}

// pedra no ativo: o núcleo anima; a pedra só é gasta quando a evolução acontece de fato (recarregar no meio não perde a pedra)
// Só vale enquanto a animação daquele uid está rodando: se ela for abortada (outra aba trocou o ativo), a pendência morre
let bag_stonePending = null;   // { k, uid, to }
const bag_dropStale = () => { const p = bag_stonePending; if (p && !(evo && evo.uid === p.uid)) bag_stonePending = null; };
on('evolved', (m, from) => {
  bag_dropStale(); const p = bag_stonePending; if (!p || m !== s || m.uid !== p.uid || m.sp !== p.to) return;
  bag_stonePending = null; bagUse(p.k); G.prog.stoneTradeEvos++;   // o núcleo grava logo depois
});
on('tick', bag_dropStale);
// por que a pedra não pode ser usada agora no ativo (null = pode)
function bag_activeBusy() {
  if (scene !== 'habitat' || G.outing) return 'Use em casa, no habitat.';
  if (evo || training || pendingChoice) return 'Não dá para usar isso agora.';
  if (s.asleep) return `Shh... ${N()} está dormindo. Acenda as luzes primeiro.`;
  if (s.berry || pk.mode === 'eat') return `Primeiro deixe ${N()} comer a FRUTA!`;
  return null;
}
// prévia do POKéMON que vai surgir (EEVEE: a pedra escolhe a forma)
function bag_preview(spId, shiny) {
  const wrap = document.querySelector('.screen-wrap'); let el = document.getElementById('bagPreview');
  if (spId == null) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'bagPreview'; el.className = 'bag-preview'; wrap.appendChild(el); }
  el.innerHTML = `<img src="${spriteURL('f' + spId + (shiny ? 's' : ''))}" alt=""><span>${DEX[spId].name}</span>`;
  // o brilhante é montado na 1ª vez (assíncrono): troca a imagem quando ficar pronto
  if (shiny) setTimeout(() => { const im = el.isConnected && el.querySelector('img'); if (im) im.src = spriteURL('f' + spId + 's'); }, 300);
}
async function bag_useStone(k) {
  bag_dropStale(); const to = bag_stoneTo(s.sp, k);
  if (!to) { sayNow(`Não teria efeito em ${N()}.`); return Sfx.deny(); }
  const why = bag_activeBusy(); if (why) { sayNow(why); return Sfx.deny(); }
  if (bag_stoneEvos(s.sp).length > 1) {
    bag_preview(to, s.shiny);
    const ok = await confirmYN(`Usar a ${ITEMS[k].name}? ${N()} vai evoluir para ${DEX[to].name}!`);
    bag_preview(null);
    if (!ok) return;
    const why2 = bag_activeBusy(); if (why2) { sayNow(why2); return Sfx.deny(); }   // algo mudou durante a pergunta
  }
  if (!bagHas(k) || bag_stoneTo(s.sp, k) !== to) return Sfx.deny();
  Menu.closeAll();
  bag_stonePending = { k, uid: s.uid, to };
  startEvolution(to, { forced: true });
}
// fóssil: o PROF. CARVALHO revive e manda para o PC
function bag_fossil(k) {
  if (G.pc.length >= 360) { sayNow('O PC está cheio!'); return Sfx.deny(); }
  if (!bagUse(k)) return Sfx.deny();
  const m = receiveMon(ITEMS[k].fossil, 5, {}, 'fossil'); save();   // prog.fossils é contado pelo progresso (gancho caught)
  sayNow('PROF. CARVALHO reviveu o fóssil!'); say(`${N(m)} foi enviado para o PC do PROF. CARVALHO.`);
  Sfx.cry(m.sp); return true;
}

function bag_use(k) {
  const it = ITEMS[k]; syncFromStorage(); if (!G || !bagHas(k)) return bag_refresh();
  if (k === 'doce') { if (bag_candy(s, true)) bag_refresh(); return; }
  if (it.stone) return bag_useStone(k);
  if (it.fossil) { if (bag_fossil(k)) bag_refresh(); return; }
  sayNow(k === 'cabo' ? 'Use o CABO DE TROCA no PC (TROCAR).' : 'Não dá para usar isso agora.'); Sfx.deny();
}
function bag_items() {
  // pedras: só as que servem para o ativo (as outras ficam guardadas, aparecem no USAR ITEM do PC)
  const list = BAG_ORDER.filter(k => bagHas(k) && !(ITEMS[k].stone && !bag_stoneTo(s.sp, k))).map(k => {
    const it = ITEMS[k];
    return { label: `${bag_icon(k)}<span>${it.name}</span>`, sub: 'x ' + G.bag[k], fn: () => {
      const desc = it.stone ? `Evolui ${N()} em ${DEX[bag_stoneTo(s.sp, k)].name}.` : it.fossil ? `Revive um ${DEX[it.fossil].name}.` : BAG_DESC[k] || '';
      Menu.open({ title: `${it.name}<div class="bag-desc">${desc}</div>`, items: [
        { label: 'USAR', fn: () => bag_use(k) }, { label: 'VOLTAR', fn: () => Menu.close() }] });
    } };
  });
  if (!list.length) list.push({ label: 'A BOLSA está vazia.', disabled: true });
  return [...list, { label: 'FECHAR', fn: () => Menu.close() }];
}
// depois de usar: fecha o submenu do item e atualiza a lista (quantidades)
let bag_menu = null;
function bag_refresh() {
  while (Menu.top && Menu.top !== bag_menu && Menu.stack.includes(bag_menu)) Menu.close();
  if (Menu.top === bag_menu) { const n = bag_items(); bag_menu.items = n; bag_menu.sel = Math.min(bag_menu.sel, n.length - 1); Menu.render(); }
}
function openBag() {
  if (!G || !s || evo || pendingChoice) return Sfx.deny();
  if (training) { say('Termine o treino primeiro!'); return Sfx.deny(); }
  syncFromStorage(); if (!G) return;
  Menu.open({ title: 'BOLSA', items: bag_items(), wide: true });
  bag_menu = Menu.top;
}
addStartItem({ label: 'BOLSA', order: 40, fn: openBag });
HAB_KEYS.i = openBag;
