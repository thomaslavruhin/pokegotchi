// Gera src/data/shiny.js: só a paleta (chunk PLTE) dos sprites brilhantes.
// Os sprites brilhantes do FRLG são idênticos aos normais a não ser pela paleta, então o jogo embute só os
// normais e monta o brilhante trocando o PLTE em tempo de execução (economiza ~280 KB no index.html).
//
//   node tools/make-shiny.js        (depois de tools/fetch-sprites.js)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');

function chunks(buf) {
  const out = []; let p = 8;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8);
    out.push({ type, data: buf.subarray(p + 8, p + 8 + len) }); p += 12 + len;
  }
  return out;
}
const pal = (dir, id) => {
  const normal = chunks(fs.readFileSync(path.join(root, 'src/sprites', dir[0], `${id}.png`)));
  const shiny = chunks(fs.readFileSync(path.join(root, 'src/sprites', dir[1], `${id}.png`)));
  const a = normal.filter(c => c.type !== 'PLTE'), b = shiny.filter(c => c.type !== 'PLTE');
  if (a.length !== b.length || a.some((c, i) => c.type !== b[i].type || !c.data.equals(b[i].data)))
    throw new Error(`${dir[1]}/${id}.png difere do normal em algo além da paleta`);
  const pn = normal.find(c => c.type === 'PLTE').data, ps = shiny.find(c => c.type === 'PLTE').data;
  if (pn.length !== ps.length) throw new Error(`${dir[1]}/${id}.png: paleta de tamanho diferente`);
  return ps.toString('hex');
};

const lines = [];
for (let id = 1; id <= 151; id++) lines.push(`  ${id}: ['${pal(['front', 'shiny'], id)}', '${pal(['back', 'shiny-back'], id)}'],`);
const out = `// ARQUIVO GERADO por tools/make-shiny.js. NÃO EDITE À MÃO.
// SHINY_PAL[id] = [paleta PLTE do sprite de frente, do de costas], em hex (RGB): o brilhante é o sprite normal com esta paleta.
const SHINY_PAL = {
${lines.join('\n')}
};
`;
fs.writeFileSync(path.join(root, 'src/data/shiny.js'), out);
console.log(`src/data/shiny.js: ${out.length} bytes`);
