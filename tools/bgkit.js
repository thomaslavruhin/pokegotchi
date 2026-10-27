/* Kit de pixel art usado pela bancada de biomas (tools/bg-harness.html).
   É uma cópia fiel dos helpers de src/game.html (R, rng, dither, disc, EDGE, groundBottom, dioramaEdge):
   se mudar um lado, mude o outro, senão o bioma fica diferente na bancada e no jogo. */
const W = 240, H = 160, FEET = 134;
function R(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/* two-row checker transition from colA (row y) to colB (row y+1) */
function dither(c, y, w, colA, colB) { for (let x = 0; x < w; x++) { c.fillStyle = (x % 2) ? colA : colB; c.fillRect(x, y, 1, 1); c.fillStyle = (x % 2) ? colB : colA; c.fillRect(x, y + 1, 1, 1); } }
/* filled pixel ellipse centred on (cx, cy), radii rx/ry, integer rows */
function disc(c, cx, cy, rx, ry, col) { c.fillStyle = col; for (let y = -ry; y <= ry; y++) { const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)))); c.fillRect(cx - half, cy + y, half * 2 + 1, 1); } }

/* The habitat is a round diorama platform seen from slightly above.
   The ground surface ends at the front lip groundBottom(x) (an ellipse arc: ~132 at the screen edges, 152 at the centre).
   Below the lip: soil cross-section (EDGE.soil rows), base rim (EDGE.rim rows), then the dark interior of the Pokéball. */
const EDGE = { cx: 120, cy: 96, rx: 156, ry: 56, soil: 9, rim: 4 };
function groundBottom(x) { const dx = (x + .5 - EDGE.cx) / EDGE.rx; return Math.round(EDGE.cy + EDGE.ry * Math.sqrt(Math.max(0, 1 - dx * dx))); }
/* pal = { soil: [4 colours top→bottom], rim: [highlight, mid, shadow], back: [upper, lower] } */
function dioramaEdge(c, pal) {
  for (let x = 0; x < W; x++) {
    const top = groundBottom(x), s1 = top + EDGE.soil, r1 = s1 + EDGE.rim, wob = Math.round(Math.sin(x * .23) + Math.sin(x * .071 + 2));
    for (let y = top; y < H; y++) {
      let col;
      if (y < s1) {
        const k = y - top + wob * .5, n = pal.soil.length, i = Math.max(0, Math.min(n - 1, Math.floor(k / EDGE.soil * n)));
        col = pal.soil[i];
      } else if (y < r1) col = y === s1 ? pal.rim[0] : y < r1 - 1 ? pal.rim[1] : pal.rim[2];
      else { const k = (y - r1) / Math.max(1, H - r1); col = (k < .45 || (((x + y) & 1) && k < .7)) ? pal.back[0] : pal.back[1]; }
      c.fillStyle = col; c.fillRect(x, y, 1, 1);
    }
  }
}
