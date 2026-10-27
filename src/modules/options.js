/* ════════════ OPÇÕES: exportar / importar o jogo ════════════
   Código = 'PKG2.d.<base64url do JSON comprimido>.<crc32 8 hex>' (ou 'PKG2.r.<base64url do JSON>.<crc>' sem
   CompressionStream). O CRC cobre os bytes que vão no código. Importar troca o jogo inteiro (nada é mesclado);
   o jogo substituído fica em .bak para DESFAZER. */
const OP_VER = 2, OP_BAK = SAVE_KEY + '.bak';
const OP_BAD = 'Código inválido ou corrompido.';

// bytes <-> base64url (em blocos: String.fromCharCode(...grande) estoura a pilha)
function op_b64(bytes) {
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function op_unb64(str) {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/')), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function op_pipe(bytes, Stream) {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new Stream('deflate-raw'))).arrayBuffer());
}
const op_hex = n => n.toString(16).padStart(8, '0');

async function op_encode(g) {
  let bytes = new TextEncoder().encode(JSON.stringify(g)), mode = 'r';
  if (typeof CompressionStream === 'function') { try { bytes = await op_pipe(bytes, CompressionStream); mode = 'd'; } catch {} }
  return `PKG${OP_VER}.${mode}.${op_b64(bytes)}.${op_hex(crc32(bytes, 0, bytes.length))}`;
}
// devolve { g, raw } ou { err } (texto para o jogador)
async function op_decode(code) {
  code = String(code || '').replace(/\s+/g, '');
  const p = code.split('.'), mv = /^PKG(\d+)$/.exec(p[0] || '');
  if (!mv || p.length !== 4) return { err: OP_BAD };
  if (+mv[1] > OP_VER) return { err: 'Código de versão mais nova.' };
  if (+mv[1] < OP_VER || !/^[dr]$/.test(p[1]) || !/^[0-9a-f]{8}$/i.test(p[3]) || !/^[A-Za-z0-9_-]+$/.test(p[2])) return { err: OP_BAD };
  let bytes; try { bytes = op_unb64(p[2]); } catch { return { err: OP_BAD }; }
  if (op_hex(crc32(bytes, 0, bytes.length)) !== p[3].toLowerCase()) return { err: OP_BAD };
  if (p[1] === 'd') {
    if (typeof DecompressionStream !== 'function') return { err: 'Este navegador não consegue abrir este código.' };
    try { bytes = await op_pipe(bytes, DecompressionStream); } catch { return { err: OP_BAD }; }
  }
  let o; try { o = JSON.parse(new TextDecoder().decode(bytes)); } catch { return { err: OP_BAD }; }
  if (o && typeof o === 'object' && num(o.v, 0) > OP_VER) return { err: 'Código de versão mais nova.' };
  const g = sanitize(o); if (!g) return { err: OP_BAD };
  return { g };
}

/* Painel por cima da tela (dentro de .screen-wrap): caixa de texto + botões; os botões redondos espelham os botões */
let op_panel = null;   // { el, prevKnobs, guard }
/* Com o painel aberto fica uma entrada vazia na pilha do Menu: o núcleo trata Menu.top como "tem algo por cima"
   e não começa evolução, HALL, toques no habitat nem o START por baixo do painel. Ela nunca é desenhada
   (ninguém chama Menu.render com ela no topo); se alguém esvaziar a pilha (troca de cena), o painel fecha junto. */
function op_open(title, html, knobs) {
  op_close(true);
  Menu.closeAll();
  const el = document.createElement('div');
  el.className = 'op-panel'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', title);
  el.innerHTML = `<div class="op-title">${title}</div>${html}`;
  document.querySelector('.screen-wrap').appendChild(el);
  const prevKnobs = knobDefs, guard = { items: [], sel: 0, prevKnobs, onBack: () => op_close() };
  op_panel = { el, prevKnobs, guard };
  Menu.stack.push(guard);
  setKnobs(knobs);
  return el;
}
function op_close(silent) {
  if (!op_panel) return;
  const p = op_panel; op_panel = null; p.el.remove();
  const i = Menu.stack.indexOf(p.guard); if (i >= 0) Menu.stack.splice(i, 1);
  // no habitat volta aos botões dele, a não ser que a ficha avulsa da POKéDEX esteja aberta por baixo
  const pop = typeof dx !== 'undefined' && dx.mode === 'popup';
  setKnobs(pop ? dx.popKnobs : scene === 'habitat' ? null : p.prevKnobs);
  if (!silent) Sfx.click();
}
setInterval(() => { if (op_panel && !Menu.stack.includes(op_panel.guard)) op_close(true); }, 250);
// teclado com o painel aberto: o jogo não vê as teclas (nem Enter abrindo o START por baixo); digitar na caixa funciona
window.addEventListener('keydown', e => {
  if (!op_panel || pendingChoice) return;
  e.stopImmediatePropagation();   // nem a ficha avulsa da POKéDEX (também em captura) vê a tecla
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase(), typing = e.target.closest && e.target.closest('textarea');
  if (k === 'escape' || (!typing && (k === 'x' || k === 'backspace'))) { e.preventDefault(); op_close(); return; }
  if (!typing && k >= '1' && k <= '4') { e.preventDefault(); if (!e.repeat) knobPress(+k - 1); }
}, true);
// pílulas MENU e DADOS com o painel aberto: fecham o painel em vez de abrir algo por baixo dele
window.addEventListener('click', e => {
  if (op_panel && e.target.closest && e.target.closest('#btnMenu, #btnData')) { e.stopPropagation(); e.preventDefault(); op_close(); }
}, true);

async function op_copy(ta) {
  const t = ta.value;
  try { await navigator.clipboard.writeText(t); }
  catch {
    // sem a API (http, navegador antigo): seleciona e usa o comando antigo
    ta.focus(); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch {}
    if (!ok) { sayNow('Não deu para copiar. Selecione o código e copie à mão.'); return Sfx.deny(); }
  }
  sayNow('Código copiado! Guarde-o em um lugar seguro.'); Sfx.happy();
}
async function op_share(t) {
  if (!navigator.share) return Sfx.deny();
  try { await navigator.share({ title: 'Pokégotchi', text: t }); } catch {}
}

async function op_export() {
  if (!G) return Sfx.deny();
  save();
  let code; try { code = await op_encode(G); } catch { sayNow('Não deu para gerar o código.'); return Sfx.deny(); }
  const share = !!navigator.share;
  const el = op_open('EXPORTAR',
    `<textarea class="op-code" readonly spellcheck="false" aria-label="Código do jogo"></textarea>` +
    `<div class="op-row"><button type="button" class="op-btn" data-a="copy">COPIAR</button>` +
    (share ? `<button type="button" class="op-btn" data-a="share">COMPARTILHAR</button>` : '') +
    `<button type="button" class="op-btn" data-a="close">FECHAR</button></div>`,
    [{ label: 'COPIAR', icon: 'OK', fn: () => op_copy(ta) }, share ? { label: 'COMPART.', icon: '»', fn: () => op_share(code) } : null,
      null, { label: 'FECHAR', icon: '◀', fn: () => op_close() }]);
  const ta = el.querySelector('textarea'); ta.value = code;
  ta.addEventListener('focus', () => ta.select());
  ta.addEventListener('click', () => ta.select());
  el.addEventListener('click', e => {
    const b = e.target.closest('.op-btn'); if (!b) return;
    if (b.dataset.a === 'copy') op_copy(ta); else if (b.dataset.a === 'share') op_share(code); else op_close();
  });
  el.querySelector('.op-btn').focus({ preventScroll: true });
  sayNow('Copie o código e cole em IMPORTAR no outro aparelho.');
}

function op_import() {
  if (!G) return Sfx.deny();
  const canPaste = !!(navigator.clipboard && navigator.clipboard.readText);
  const el = op_open('IMPORTAR',
    `<textarea class="op-code" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="Cole aqui o código (PKG2...)" aria-label="Código para importar"></textarea>` +
    `<div class="op-row">` + (canPaste ? `<button type="button" class="op-btn" data-a="paste">COLAR</button>` : '') +
    `<button type="button" class="op-btn" data-a="go">IMPORTAR</button><button type="button" class="op-btn" data-a="close">CANCELAR</button></div>`,
    [{ label: 'IMPORTAR', icon: 'OK', fn: () => op_doImport(ta.value) }, canPaste ? { label: 'COLAR', icon: '+', fn: () => op_paste(ta) } : null,
      null, { label: 'CANCELAR', icon: '◀', fn: () => pendingChoice ? answer(false) : op_close() }]);
  const ta = el.querySelector('textarea');
  el.addEventListener('click', e => {
    const b = e.target.closest('.op-btn'); if (!b) return;
    if (b.dataset.a === 'paste') op_paste(ta); else if (b.dataset.a === 'go') op_doImport(ta.value); else op_close();
  });
  // no celular, focar a caixa abriria o teclado por cima de tudo: só foca com mouse
  if (matchMedia('(pointer: fine)').matches) ta.focus({ preventScroll: true });
  sayNow('Cole o código de um jogo exportado e toque em IMPORTAR.');
}
async function op_paste(ta) {
  try { ta.value = (await navigator.clipboard.readText()) || ''; Sfx.click(); }
  catch { sayNow('Toque e segure na caixa para colar.'); Sfx.deny(); }
}

let op_busy = false;
const op_when = t => { const d = new Date(t), z = n => String(n).padStart(2, '0'); return `${z(d.getDate())}/${z(d.getMonth() + 1)} ${z(d.getHours())}:${z(d.getMinutes())}`; };
async function op_doImport(code) {
  if (op_busy || !op_panel) return;
  if (!String(code || '').trim()) { sayNow('Cole um código primeiro.'); return Sfx.deny(); }
  op_busy = true;
  try {
    const r = await op_decode(code);
    if (r.err) { sayNow(r.err); return Sfx.deny(); }
    // aviso por progresso (o savedAt daqui é sempre "agora": o núcleo salva a cada 2 s)
    const g = r.g, a = g.active, caught = g.dex.caught.split('1').length - 1;
    const old = !!G && (caught < dexCount('caught') || g.prog.badges < G.prog.badges);
    // a prévia vai no painel: a caixa de texto tem 3 linhas e, no celular, cortaria a pergunta
    const ta = op_panel.el.querySelector('textarea'), pv = document.createElement('div');
    pv.className = 'op-prev';
    // linhas curtas à esquerda: a caixa SIM/NÃO cobre o canto inferior direito da tela
    pv.innerHTML = (old ? '<em>Menos progresso que o seu!</em>' : '') + `<b>${DEX[a.sp].name} Nv. ${a.level}</b>` +
      `<span>Capturados ${caught}/151</span><span>${g.prog.badges} insígnia${g.prog.badges === 1 ? '' : 's'}</span>` +
      `<span>Salvo em ${g.savedAt ? op_when(g.savedAt) : '--/-- --:--'}</span><img src="${spriteURL(monKey(a))}" alt="">`;
    const row = op_panel.el.querySelector('.op-row');
    ta.hidden = true; row.hidden = true; ta.after(pv);
    if (old) Sfx.alert();
    const yes = await confirmYN(old ? 'Este jogo tem menos progresso que o seu. Substituir?' : 'Substituir o jogo atual por este?', { safeNo: true });
    pv.remove(); ta.hidden = false; row.hidden = false;
    if (!yes) { if (G && op_panel) sayNow('Nada mudou.'); return; }
    op_replace(g);
    sayNow('Jogo importado!'); Sfx.evoDone();
  } finally { op_busy = false; }
}
/* Dia do jogo importado: a sequência vem do código, mas o presente e os tetos do dia já pagos aqui não pagam
   de novo. Data = a maior das duas; no mesmo dia, cada contador fica com o maior valor. */
function op_mergeDaily(cur, imp) {
  const out = clone(imp), cd = cur.maxDate || '', id = imp.maxDate || '';
  out.lastSafety = Math.max(num(cur.lastSafety, 0), num(imp.lastSafety, 0));
  if (cd < id) return out;   // o código é de um dia mais novo: fica como veio
  const perDay = f => { for (const key in DEFAULTS.daily) if (!/^(streak|lastSafety)$/.test(key)) f(key); };
  if (cd === id) {
    perDay(k => {
      if (typeof out[k] === 'number') out[k] = Math.max(num(cur[k], 0), out[k]);
      else if (typeof out[k] === 'boolean') out[k] = !!cur[k] || out[k];
      else if (typeof out[k] === 'string' && String(cur[k] || '') > out[k]) out[k] = String(cur[k]);
    });
    out.streak = Math.max(num(cur.streak, 0), out.streak);
    return out;
  }
  // este aparelho já virou um dia mais novo: os contadores são os de hoje daqui; a sequência continua se o código for de ontem
  const [y, m, d] = cd.split('-').map(Number), prev = localDate(new Date(y, m - 1, d - 1, 12).getTime());
  perDay(k => { out[k] = clone(cur[k]); });
  out.streak = id === prev ? out.streak + 1 : 1;
  return out;
}
// troca o jogo atual por g, guardando o atual em .bak
function op_replace(g) {
  save();
  try { const cur = localStorage.getItem(SAVE_KEY); if (cur) localStorage.setItem(OP_BAK, cur); } catch {}
  const now = Date.now();
  g.lastTick = g.savedAt = now; g.enc = null; g.outing = null;   // sem simular o tempo parado nem retomar batalhas
  if (G && G.daily) g.daily = op_mergeDaily(G.daily, g.daily);
  g.rev = Math.max(g.rev, G ? G.rev : 0);
  op_close(true);
  cancelTraining(); training = null; sweep = null; berryFx = null; evo = null; away = null;
  setGame(g); save();
  fire('imported', G);
  goHome(); updateUI();
}

addOption({ label: 'EXPORTAR', order: 10, fn: op_export });
addOption({ label: 'IMPORTAR', order: 20, fn: op_import });
addOption({ label: 'DESFAZER IMPORTAÇÃO', order: 30, fn: async () => {
  let raw = null; try { raw = localStorage.getItem(OP_BAK); } catch {}
  let g = null; try { g = raw && sanitize(JSON.parse(raw)); } catch {}
  if (!g) { sayNow('Não há importação para desfazer.'); return Sfx.deny(); }
  Menu.closeAll();
  const a = g.active;
  if (!await confirmYN(`Voltar ao jogo de antes da importação (${DEX[a.sp].name} Nv. ${a.level})?`, { safeNo: true })) { if (G && scene !== 'select') sayNow('Nada mudou.'); return; }
  op_replace(g);   // o jogo importado vai para o .bak: dá para refazer
  sayNow('Importação desfeita!'); Sfx.happy();
} });
