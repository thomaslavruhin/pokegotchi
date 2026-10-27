#!/usr/bin/env node
// Baixa os sprites FireRed/LeafGreen (Geração III) dos Pokémon 1..151 do repositório PokeAPI/sprites.
// Uso: node tools/fetch-sprites.js [--force]   (sem --force, arquivos já presentes e válidos são mantidos)
// Destino: src/sprites/{front,back,shiny,shiny-back}/{id}.png. Sem dependências npm.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-iii/firered-leafgreen/';
const SETS = { front: '', back: 'back/', shiny: 'shiny/', 'shiny-back': 'back/shiny/' };
const MAX_ID = 151, CONCURRENCY = 6;
const force = process.argv.includes('--force');
const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngInfo(buf) {
  if (buf.length < 33 || !buf.subarray(0, 8).equals(SIG) || buf.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), depth: buf[24], color: buf[25] };
}

async function get(url) {
  for (let a = 1; ; a++) {
    try {
      const r = await fetch(url);
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(r.status + ' ' + url);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) { if (a >= 4) throw e; await new Promise(s => setTimeout(s, 500 * a)); }
  }
}

async function main() {
  const jobs = [];
  for (const [dir, sub] of Object.entries(SETS)) {
    fs.mkdirSync(path.join(ROOT, 'src', 'sprites', dir), { recursive: true });
    for (let id = 1; id <= MAX_ID; id++) jobs.push({ dir, id, url: BASE + sub + id + '.png', file: path.join(ROOT, 'src', 'sprites', dir, id + '.png') });
  }
  const missing = [], invalid = [], dims = {}, bytes = {};
  let i = 0, b64 = 0;
  async function worker() {
    while (i < jobs.length) {
      const j = jobs[i++];
      let buf = !force && fs.existsSync(j.file) ? fs.readFileSync(j.file) : null;
      if (!buf || !pngInfo(buf)) {
        buf = await get(j.url);
        if (!buf) { missing.push(j.dir + '/' + j.id); continue; }
        if (!pngInfo(buf)) { invalid.push(j.dir + '/' + j.id); continue; }
        fs.writeFileSync(j.file, buf);
      }
      const p = pngInfo(buf), k = `${j.dir} ${p.w}x${p.h} depth${p.depth} color${p.color}`;
      dims[k] = (dims[k] || 0) + 1;
      bytes[j.dir] = (bytes[j.dir] || 0) + buf.length;
      b64 += Math.ceil(buf.length / 3) * 4;
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  for (const k of Object.keys(dims).sort()) console.log(k.padEnd(36), dims[k], 'arquivos');
  let total = 0;
  for (const d of Object.keys(SETS)) { total += bytes[d] || 0; console.log(d.padEnd(11), bytes[d] || 0, 'bytes'); }
  console.log('total      ', total, 'bytes; em base64 (soma por arquivo):', b64);
  if (missing.length) console.log('FALTANDO:', missing.join(' '));
  if (invalid.length) console.log('INVÁLIDOS:', invalid.join(' '));
  if (missing.length || invalid.length) process.exitCode = 1;
}
main().catch(e => { console.error(e); process.exit(1); });
