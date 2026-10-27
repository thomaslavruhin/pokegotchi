#!/usr/bin/env node
// Gera src/data/dex.js (Kanto 1..151, dados da Geração III / FireRed-LeafGreen) a partir da PokéAPI.
// Uso: node tools/make-dex.js            (respostas da API ficam em cache em os.tmpdir()/pokegotchi-dex-cache)
// Sem dependências npm. Determinístico: mesma entrada -> mesmo arquivo.
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'src', 'data', 'dex.js');
const CACHE = path.join(os.tmpdir(), 'pokegotchi-dex-cache');
const API = 'https://pokeapi.co/api/v2/';
const GEN = 3;               // geração alvo
const FRLG_VG = 'firered-leafgreen';
const MAX_ID = 151;
const CONCURRENCY = 6;

// ---------- fetch com cache + limite de concorrência ----------
fs.mkdirSync(CACHE, { recursive: true });
let active = 0; const queue = [];
function limit(fn) {
  return new Promise((res, rej) => {
    const run = () => { active++; fn().then(res, rej).finally(() => { active--; if (queue.length) queue.shift()(); }); };
    active < CONCURRENCY ? run() : queue.push(run);
  });
}
async function getJSON(url) {
  if (!/^https?:/.test(url)) url = API + url;
  const file = path.join(CACHE, url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '_') + '.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  return limit(async () => {
    for (let attempt = 1; ; attempt++) {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(r.status + ' ' + url);
        const txt = await r.text();
        fs.writeFileSync(file, txt);
        return JSON.parse(txt);
      } catch (e) {
        if (attempt >= 4) throw e;
        await new Promise(s => setTimeout(s, 500 * attempt));
      }
    }
  });
}
const idOf = url => +url.match(/\/(\d+)\/?$/)[1];

// ---------- tabelas fixas ----------
const TYPE_KEY = {
  normal: 'NORMAL', fire: 'FOGO', water: 'ÁGUA', grass: 'GRAMA', electric: 'ELÉTRICO', ice: 'GELO',
  fighting: 'LUTADOR', poison: 'VENENO', ground: 'TERRA', flying: 'VOADOR', psychic: 'PSÍQUICO',
  bug: 'INSETO', rock: 'PEDRA', ghost: 'FANTASMA', dragon: 'DRAGÃO', dark: 'SOMBRIO', steel: 'AÇO',
};
const EN_TYPES = Object.keys(TYPE_KEY);
const TYPES = EN_TYPES.map(t => TYPE_KEY[t]);
const STONES = {
  'moon-stone': 'PEDRA DA LUA', 'fire-stone': 'PEDRA DE FOGO', 'water-stone': 'PEDRA DA ÁGUA',
  'thunder-stone': 'PEDRA DO TROVÃO', 'leaf-stone': 'PEDRA DA FOLHA',
};
// Golpes por tipo: [nome PokéAPI, nome oficial PT-BR]. Poder/tipo vêm da API (valor da Geração III).
// PokéAPI não tem nomes em pt/pt-BR; nomes PT-BR são os usados no anime/Pokémon GO/TCG brasileiros.
const MOVES1 = {
  normal: ['tackle', 'INVESTIDA'], fire: ['ember', 'BRASAS'], water: ['water-gun', "REVÓLVER D'ÁGUA"],
  grass: ['vine-whip', 'CHICOTE DE VINHA'], electric: ['thunder-shock', 'CHOQUE DO TROVÃO'],
  ice: ['powder-snow', 'NEVE EM PÓ'], fighting: ['karate-chop', 'GOLPE DE CARATÊ'], poison: ['acid', 'ÁCIDO'],
  ground: ['dig', 'CAVAR'], flying: ['wing-attack', 'ATAQUE DE ASA'], psychic: ['confusion', 'CONFUSÃO'],
  bug: ['silver-wind', 'VENTO PRATEADO'], rock: ['rock-throw', 'LANÇAMENTO DE ROCHA'], ghost: ['lick', 'LAMBIDA'],
  dragon: ['twister', 'CICLONE'], dark: ['bite', 'MORDIDA'], steel: ['metal-claw', 'GARRA DE METAL'],
};
const MOVES2 = {
  normal: ['body-slam', 'PANCADA CORPORAL'], fire: ['flamethrower', 'LANÇA-CHAMAS'], water: ['surf', 'SURFAR'],
  grass: ['petal-dance', 'DANÇA DAS PÉTALAS'], electric: ['thunderbolt', 'RELÂMPAGO'], ice: ['ice-beam', 'RAIO DE GELO'],
  fighting: ['brick-break', 'QUEBRA-TELHA'], poison: ['sludge-bomb', 'BOMBA DE LODO'], ground: ['earthquake', 'TERREMOTO'],
  flying: ['drill-peck', 'BICADA BROCA'], psychic: ['psychic', 'PSÍQUICO'], bug: ['signal-beam', 'FEIXE SINALIZADOR'],
  rock: ['rock-slide', 'DESLIZE DE PEDRAS'], ghost: ['shadow-ball', 'BOLA SOMBRIA'], dragon: ['dragon-claw', 'GARRA DE DRAGÃO'],
  dark: ['crunch', 'TRITURAR'], steel: ['steel-wing', 'ASA DE AÇO'],
};
const MOVE_DOUBTS = [
  "CHOQUE DO TROVÃO (Pokémon GO usa 'Trovoada de Choques')", "CICLONE (Twister)", "VENTO PRATEADO (Silver Wind)", "LAMBIDA tem poder 20 na Gen III (abaixo da faixa 35-60; mantida por ser o golpe inicial de Gastly)",
  "FEIXE SINALIZADOR (Signal Beam)", "DESLIZE DE PEDRAS (Rock Slide)", "LANÇAMENTO DE ROCHA (Rock Throw)",
  "MORDIDA/TRITURAR/GARRA DE METAL/ASA DE AÇO: nenhum Pokémon 1-151 é SOMBRIO na Gen III e nenhum AÇO (Magnemite) aprende golpe de aço em FRLG",
  "NEVE EM PÓ (Powder Snow)", "DANÇA DAS PÉTALAS (Petal Dance)", "RELÂMPAGO (Thunderbolt)", "BRASAS (GO usa 'Brasa')",
];

// Valor "como na Geração GEN" de um campo com histórico `past_*` (entradas = valor ATÉ aquela geração, inclusive).
const genNum = g => idOf(g.url);
function pickPast(list, has) {
  return (list || []).filter(p => genNum(p.generation) >= GEN && has(p))
    .sort((a, b) => genNum(a.generation) - genNum(b.generation))[0];
}

async function main() {
  const ids = Array.from({ length: MAX_ID }, (_, i) => i + 1);
  const [pokes, species] = await Promise.all([
    Promise.all(ids.map(i => getJSON('pokemon/' + i))),
    Promise.all(ids.map(i => getJSON('pokemon-species/' + i))),
  ]);
  const chainUrls = [...new Set(species.map(s => s.evolution_chain.url))].sort((a, b) => idOf(a) - idOf(b));
  const chains = await Promise.all(chainUrls.map(getJSON));
  const types = await Promise.all(EN_TYPES.map(t => getJSON('type/' + t)));
  const moveNames = [...new Set([...Object.values(MOVES1), ...Object.values(MOVES2)].map(m => m[0]))].sort();
  const moves = Object.fromEntries(await Promise.all(moveNames.map(async n => [n, await getJSON('move/' + n)])));
  const vgs = {}; // version-group -> generation id
  for (const m of Object.values(moves)) for (const pv of m.past_values) vgs[pv.version_group.name] = pv.version_group.url;
  const vgGen = {};
  for (const [name, url] of Object.entries(vgs)) vgGen[name] = genNum((await getJSON(url)).generation);
  const warnings = [];

  // ----- TYPE_CHART (atacante -> defensor) -----
  const relOf = t => {
    const p = pickPast(t.past_damage_relations, () => true);
    return p ? p.damage_relations : t.damage_relations;
  };
  const TYPE_CHART = {};
  for (const t of types) {
    const r = relOf(t), row = {};
    for (const [k, mult] of [['double_damage_to', 2], ['half_damage_to', .5], ['no_damage_to', 0]])
      for (const d of r[k]) if (TYPE_KEY[d.name]) row[TYPE_KEY[d.name]] = mult;
    TYPE_CHART[TYPE_KEY[t.name]] = Object.fromEntries(TYPES.filter(x => x in row).map(x => [x, row[x]]));
  }
  // conferência cruzada com o lado defensor
  for (const t of types) {
    const r = relOf(t);
    for (const [k, mult] of [['double_damage_from', 2], ['half_damage_from', .5], ['no_damage_from', 0]])
      for (const a of r[k]) if (TYPE_KEY[a.name] && TYPE_CHART[TYPE_KEY[a.name]][TYPE_KEY[t.name]] !== mult)
        warnings.push(`type chart mismatch ${a.name}->${t.name}`);
  }

  // ----- evoluções -----
  const evoOut = {}, fromOf = {}, stageOf = {};
  function methodOf(details, to) {
    const lv = details.find(d => d.trigger.name === 'level-up' && d.min_level && !d.location && !d.held_item && !d.known_move);
    const stone = details.find(d => d.trigger.name === 'use-item' && d.item && STONES[d.item.name]);
    const trade = details.find(d => d.trigger.name === 'trade' && !d.held_item && !d.trade_species);
    if (lv) return { to, lv: lv.min_level };
    if (stone) return { to, item: STONES[stone.item.name] };
    if (trade) return { to, trade: true };
    throw new Error('método de evolução desconhecido -> ' + to + ' ' + JSON.stringify(details));
  }
  function walk(node, parent, stage) {
    const id = idOf(node.species.url);
    const inKanto = id <= MAX_ID;
    if (inKanto) {
      evoOut[id] = evoOut[id] || [];
      fromOf[id] = parent || 0;
      stageOf[id] = stage;
    }
    for (const ch of node.evolves_to) {
      const cid = idOf(ch.species.url);
      if (inKanto && cid <= MAX_ID) evoOut[id].push(methodOf(ch.evolution_details, cid));
      walk(ch, inKanto ? id : 0, inKanto ? stage + 1 : 0);
    }
  }
  for (const c of chains) walk(c.chain, 0, 0);
  for (const id in evoOut) evoOut[id].sort((a, b) => a.to - b.to);

  // ----- DEX -----
  const STAT_ORDER = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];
  const DEX = [null];
  for (const i of ids) {
    const p = pokes[i - 1], s = species[i - 1];
    const pt = pickPast(p.past_types, () => true);
    const tps = (pt ? pt.types : p.types).slice().sort((a, b) => a.slot - b.slot).map(t => TYPE_KEY[t.type.name]);
    const base = STAT_ORDER.map(st => {
      const past = pickPast(p.past_stats, e => e.stats.some(x => x.stat.name === st));
      const src = past ? past.stats : p.stats;
      return src.find(x => x.stat.name === st).base_stat;
    });
    const en = s.names.find(n => n.language.name === 'en').name;
    DEX.push({
      id: i, name: en.toUpperCase().replace(/[’`]/g, "'"), types: tps, base,
      catch: s.capture_rate, exp: p.base_experience, evo: evoOut[i] || [],
      stage: stageOf[i] || 0, from: fromOf[i] || 0, h: p.height, w: p.weight,
    });
  }

  // ----- MOVES -----
  const vgOrder = n => idOf(vgs[n]);
  function moveGen3(name) {
    const m = moves[name];
    const pv = m.past_values.filter(v => vgGen[v.version_group.name] > GEN).sort((a, b) => vgOrder(a.version_group.name) - vgOrder(b.version_group.name));
    const field = f => { const e = pv.find(v => v[f] != null); return e ? e[f] : m[f]; };
    return { power: field('power'), type: (pv.find(v => v.type) || m).type.name, gen: genNum(m.generation) };
  }
  // quem aprende o golpe em FRLG (para documentar)
  const learners = {};
  for (const p of pokes) for (const mv of p.moves)
    if (moves[mv.move.name] && mv.version_group_details.some(d => d.version_group.name === FRLG_VG))
      (learners[mv.move.name] = learners[mv.move.name] || []).push(p.id);
  const buildMoves = (tbl, label) => {
    const out = {};
    for (const en of EN_TYPES) {
      const [api, ptName] = tbl[en], g = moveGen3(api);
      if (g.type !== en) warnings.push(`${label} ${api}: tipo ${g.type} != ${en}`);
      if (g.gen > GEN) warnings.push(`${label} ${api}: não existe na Geração III`);
      const sameType = (learners[api] || []).filter(id => DEX[id].types.includes(TYPE_KEY[en]));
      if (!sameType.length) warnings.push(`${label} ${api}: nenhum Pokémon ${en} (<=151) aprende em FRLG`);
      out[TYPE_KEY[en]] = { name: ptName, power: g.power };
    }
    return out;
  };
  const M1 = buildMoves(MOVES1, 'MOVES'), M2 = buildMoves(MOVES2, 'MOVES2');

  // ----- escrita -----
  const lit = v => {
    if (v === null) return 'null';
    if (Array.isArray(v)) return '[' + v.map(lit).join(',') + ']';
    if (typeof v === 'string') return "'" + v.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
    if (typeof v === 'number') return String(v).replace(/^0\./, '.');
    if (typeof v === 'boolean') return String(v);
    return '{' + Object.entries(v).map(([k, x]) => (/^[a-z_$][\w$]*$/i.test(k) ? k : lit(k)) + ':' + lit(x)).join(',') + '}';
  };
  const block = (obj) => '{\n' + Object.entries(obj).map(([k, v]) => '  ' + lit(k) + ': ' + lit(v)).join(',\n') + '\n}';
  const src = [
    '// ARQUIVO GERADO por tools/make-dex.js a partir da PokéAPI (https://pokeapi.co). NÃO EDITE À MÃO.',
    '// Dados da Geração III (FireRed/LeafGreen): tipos (past_types), status-base (past_stats) e tabela de tipos',
    '// (past_damage_relations) como eram na Gen III. `exp` = base_experience ATUAL da PokéAPI (a API não tem o valor da Gen III).',
    '// DEX[id] = { id, name, types, base:[hp,atk,def,spa,spd,spe], catch, exp, evo:[{to,lv}|{to,item}|{to,trade}], stage, from, h(dm), w(hg) }',
    '// Nomes PT-BR de golpes: a PokéAPI não traz pt-BR; usados os nomes brasileiros oficiais mais difundidos. Incertos:',
    ...MOVE_DOUBTS.map(d => '//   - ' + d),
    '',
    'const TYPES = ' + lit(TYPES) + ';',
    'const TYPE_KEY = ' + block(TYPE_KEY) + ';',
    'const TYPE_CHART = ' + block(TYPE_CHART) + ';',
    '// golpe básico por tipo (até o nível 29) e golpe forte (a partir do nível 30); poder da Geração III',
    'const MOVES = ' + block(M1) + ';',
    'const MOVES2 = ' + block(M2) + ';',
    'const DEX = [null,',
    DEX.slice(1).map(d => '  ' + lit(d)).join(',\n'),
    '];',
    '',
  ].join('\n');
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, src);
  console.log('escrito', path.relative(ROOT, OUT), src.length, 'bytes');
  for (const t of EN_TYPES) for (const [tbl, lab] of [[MOVES1, 'M1'], [MOVES2, 'M2']]) {
    const api = tbl[t][0];
    const same = (learners[api] || []).filter(id => DEX[id].types.includes(TYPE_KEY[t]));
    console.log(`${lab} ${t.padEnd(8)} ${api.padEnd(13)} pow=${(lab === 'M1' ? M1 : M2)[TYPE_KEY[t]].power} FRLG(mesmo tipo): ${same.join(',') || '-'}`);
  }
  for (const w of warnings) console.warn('AVISO:', w);
}
main().catch(e => { console.error(e); process.exit(1); });
