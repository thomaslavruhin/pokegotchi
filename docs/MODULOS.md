# Módulos da aventura

O jogo é um arquivo só (`index.html`), mas o código-fonte é dividido. O **núcleo** (`src/game.html`) cuida do habitat, dos cuidados, do save e da interface do aparelho. As telas da aventura (exploração, batalha, PC, POKéDEX…) são **módulos** em `src/modules/*.js` (e `*.css`), que o build cola dentro do script do núcleo, em ordem alfabética, antes do boot.

Como ficam no mesmo escopo, os módulos usam as funções e variáveis do núcleo diretamente. Não há `import`/`export`.

## Regras

- Um módulo só cria coisas com nomes próprios (prefixe funções internas, ex.: `bt_`, ou feche num objeto).
- Campos novos no save: declare com `extendDefaults({ prog: {...}, daily: {...}, bag: {...} })` no topo do módulo. O `sanitize` só preserva campos que existem nos padrões. Declarar o mesmo campo em dois módulos, com o mesmo padrão, é permitido.
- Nunca guarde estado do jogo fora de `G`: o que não está em `G` some ao recarregar e não passa entre abas.
- Depois de mudar `G`, chame `save()`; se mudou o que aparece na caixa de status, `updateUI()`.
- Textos do jogo em português do Brasil, em MAIÚSCULAS para nomes (POKéMON, POKé BOLA), como no FRLG.
- Nada de rede: tudo funciona offline.

## Estado

| Nome | O que é |
|---|---|
| `G` | o save inteiro (v2): `active`, `pc[]`, `dex`, `bag`, `prog`, `daily`, `outing`, `enc`, `hof`, `lastTick`, `savedAt` |
| `s` | `G.active`, o POKéMON do habitat. Campos: `uid, sp` (nº da POKéDEX), `shiny, level, exp, hunger, energy, happy, hygiene, asleep, sick, poops, berry, pendingEvo, evoRefused, caughtAt, ball, count` |
| `DEX[id]` | `{ id, name, types, base:[ps,atk,def,atkEsp,defEsp,vel], catch, exp, evo:[{to,lv}\|{to,item}\|{to,trade}], stage, from, h, w }` |
| `TYPES`, `TYPE_CHART[atk][def]`, `MOVES[tipo]`, `MOVES2[tipo]` | tipos da Gen III, eficácia (só os ≠ 1), golpe fraco e forte de cada tipo |
| `ITEMS[chave]` | itens da BOLSA: `poke great ultra master pocao doce cabo lua fogo agua trovao folha helix domo ambar` |
| `scene` | `'select' \| 'habitat' \|` nome de uma cena de módulo |

## Funções do núcleo

| Função | Uso |
|---|---|
| `save()`, `updateUI()` | grava; redesenha a caixa de status |
| `say(t)`, `sayNow(t)` | mensagem na caixa de diálogo (fila / imediata) |
| `await talk(t)` | mensagem que espera sair da tela (toque, A, ou ~1,4 s): para narrar batalhas em ordem |
| `await confirmYN(t, { safeNo })` | pergunta SIM/NÃO; `safeNo` põe o foco no NÃO |
| `go(nome, arg)`, `goHome()` | troca de cena (chama `exit` da atual e `enter(arg)` da nova) |
| `Menu.open({ title, items:[{label, sub, fn, disabled}], onBack, sel, wide })`, `Menu.close()`, `Menu.closeAll()`, `Menu.render()` | lista no estilo FRLG por cima da tela, com pilha |
| `setKnobs(defs)` | troca os 4 botões redondos: `[{ label, icon, fn, down, up, disabled, inChoice }] x4` e `defs.center`; `null` volta aos do habitat. Com um SIM/NÃO aberto só funcionam os marcados com `inChoice` |
| `addStartItem({ label, order, fn, when })` | item no menu START (EXPLORAR 10, POKéDEX 20, POKéMON 30, BOLSA 40, PC 50, CARTÃO 60) |
| `addOption({ label, order, fn })` | item em OPÇÕES |
| `TRAIN_MODES.push({ label, fn })` | mais um minigame no botão TREINAR (vira uma escolha) |
| `HAB_KEYS[tecla] = fn` | atalho de teclado no habitat |
| `on(evento, fn)`, `fire(evento, ...args)` | ganchos (abaixo) |
| `dexMark(id, caught, shiny)`, `dexHas(kind, id)`, `dexCount(kind)` | POKéDEX (`kind`: `seen`, `caught`, `shiny`) |
| `bagAdd(k, n)`, `bagUse(k)`, `bagHas(k, n)`, `ballCount()` | BOLSA (teto 99) |
| `receiveMon(sp, nível, extra, how)` | POKéMON novo vai para o PC e marca a POKéDEX; dispara `caught` |
| `swapActive(uid)` | troca o ativo por um do PC (quem chama confere as regras) |
| `newMon(sp, nível, extra)`, `addToPC(m)`, `freezeMon(m)` | peças do PC |
| `startEvolution(paraId, { forced, intro })` | evolução animada do ativo (só no habitat, acordado e parado) |
| `addExp(n, live, mon)`, `needExp(nv)`, `levelEvo(mon)` | EXP e nível |
| `MUL(mon)`, `sizeClass(id)`, `biomeOf(id)` | porte e habitat da espécie |
| `phaseAt(t)`, `sleepyAt(t)`, `localDate(t)` | `AMANHECER \| DIA \| ENTARDECER \| NOITE`; dia local `AAAA-MM-DD` |
| `drawBiome(ctx, bioma, luzesApagadas)` | cenário de um bioma com a hora do dia |
| `drawPokemon(chave, x, yPés, { dir, sil, alpha })`, `drawShadow(...)`, `footOf(chave)` | sprite no canvas, alinhado pelos pés |
| `monKey(mon, costas)`, `img(chave)`, `spriteURL(chave)` | chaves de sprite (`f25`, `b25`, `f25s` brilhante); imagem para canvas; URL para `<img>` |
| `pixelText(t, x, y, cor)`, `drawBm`, `bmSvg`, `BM`, `R`, `disc`, `burst` | desenho em pixel art |
| `Sfx.*` | sons 8-bit (`click deny happy levelUp alert cry(id) hit(i) whoosh blip(f) evoDone …`) |
| `TYPE_COLOR[tipo]` | cor do selo de tipo |

## Cenas

```js
SCENES.batalha = {
  knobs: [...],            // botões redondos ao entrar (ou setKnobs no enter)
  enter(arg) {}, exit(proxima) {},
  update(dt) {}, draw(ctx) {},               // canvas 240x160; o núcleo chama a cada quadro
  key(e, k) { return true; },                // teclado (k em minúsculas); true = tratou
  pointer(x, y, e) {}, pointerUp(x, y, e) {}, pointerMove(x, y, e) {},   // toque em pixels da tela
};
```

Enquanto a cena não é o habitat, os cuidados continuam sendo simulados, mas calados: os avisos (sujeira, fome…) viram um resumo mostrado na volta para casa.

## Ganchos

| Evento | Quem dispara | Argumentos |
|---|---|---|
| `boot` | núcleo, depois de carregar o save | |
| `newGame` | núcleo | `G` |
| `home` | núcleo, ao entrar no habitat | |
| `tick` | núcleo, a cada tick lógico (2 s) | `agora` |
| `wellCared` | núcleo, por passo simulado com o ativo bem cuidado | `minutos, t` |
| `levelUp` | núcleo | `mon` |
| `evolved` | núcleo | `mon, deId` |
| `caught` | `receiveMon` | `mon, how` (`catch`, `gift`, `fossil`); o progresso conta `prog.fossils` aqui, quem revive o fóssil não conta |
| `trained` | núcleo, fim do treino | `[nota de cada golpe: 0 CRÍTICO … 3 FRACO]` |
| `encounter` | exploração | `enc` |
| `battleEnd` | batalha | `{ won, caught, fled, fainted, sp, shiny, night }` |
| `minigame` | COLHEITA | `{ score }` |

## Testes

Com `#dev` no endereço (`index.html#dev`), `window.PKG` expõe o estado e as funções principais no console.
