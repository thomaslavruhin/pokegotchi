BIOMES.praia = (() => {
  /* ── palette: 34 colours in the static scene + 2 night-only lights ── */
  const SK0 = '#68b0f0', SK1 = '#88c8f8', SK2 = '#a8dcf8', SK3 = '#d0f0f8', WH = '#f8f8f8';
  const SE0 = '#3070c8', SE1 = '#4088d8', SE2 = '#48a8e8', SE3 = '#40c8e0', SE4 = '#88e8e0';
  const G0 = '#286038', G1 = '#3c8c40', G2 = '#68b848', G3 = '#a8d868', GI = '#98ccb0';
  const W0 = '#5a3828', W1 = '#8a5c38', W2 = '#b88850';
  const S0 = '#f8f0d0', S1 = '#f0dca8', S2 = '#e0c488', S3 = '#c8a470', WS = '#c8b48c';   // WS = cool wet-sand / cast-shadow tone
  const K0 = '#484868', K1 = '#707090', K2 = '#9c9cb4', K3 = '#d0d0dc';
  const PK = '#f87898', PK0 = '#b84068', RD = '#e85840', RD0 = '#a02830', OR = '#f8a048';
  const DK0 = '#2a2030', DK1 = '#18121c';
  const PAL_EDGE = { soil: [S2, S3, W2, W1], rim: [W2, W0, DK0], back: [DK0, DK1] };
  // night lights (the moon reuses S0 / SK3)
  const MOON = S0, MOONB = SK3, LAMP = '#f8f088', BIO = '#70f8e0';

  /* ── helpers ── */
  // waterline: bowed back toward the middle (echoes the round platform) + small wobble
  const shore = x => { const u = (x - 128) / 128; return 89 + Math.round(u * u * 4 + Math.sin(x * .045 + .6) * 1.6 + Math.sin(x * .11 + 2) * .8); };
  function h2(x, y) { let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; }
  function vn(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = h2(xi, yi), b = h2(xi + 1, yi), cc = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
    return a + (b - a) * sx + (cc - a) * sy + (a - b - cc + d) * sx * sy;
  }
  const BAY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const put = (M, x, y, col) => { if (x >= 0 && x < W && y >= 0 && y < H) M.set(y * W + x, col); };
  function outlineMap(M, col, skipBelow) {
    const out = [];
    for (const k of M.keys()) {
      const x = k % W, y = (k / W) | 0;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ox, ny = y + oy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H || (skipBelow && ny > skipBelow)) continue;
        if (!M.has(ny * W + nx)) out.push(ny * W + nx);
      }
    }
    for (const k of out) M.set(k, col);
  }
  function flush(c, M) {
    const keys = [...M.keys()].sort((a, b) => a - b);
    let i = 0;
    while (i < keys.length) {
      const k = keys[i], col = M.get(k), y = (k / W) | 0; let n = 1;
      while (i + n < keys.length && keys[i + n] === k + n && M.get(keys[i + n]) === col && ((keys[i + n] / W) | 0) === y) n++;
      R(c, k - y * W, y, n, 1, col); i += n;
    }
  }
  function spr(c, x, y, rows, map, flip) {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j], L = row.length; let i = 0;
      const at = i2 => flip ? row[L - 1 - i2] : row[i2];
      while (i < L) {
        const ch = at(i);
        if (!map[ch]) { i++; continue; }
        let n = 1; while (i + n < L && at(i + n) === ch) n++;
        R(c, x + i, y + j, n, 1, map[ch]); i += n;
      }
    }
  }
  // rect clipped so it never reaches the lip row (gb-1) or the soil: foreground props stay on the ground plane
  function Rc(c, x, y, w, h, col) {
    for (let j = 0; j < h; j++) {
      const yy = y + j; let s = -1;
      for (let i = x; i <= x + w; i++) {
        const ok = i < x + w && yy <= groundBottom(i) - 2;
        if (ok && s < 0) s = i; else if (!ok && s >= 0) { R(c, s, yy, i - s, 1, col); s = -1; }
      }
    }
  }
  function discC(c, cx, cy, rx, ry, col) {
    for (let y = -ry; y <= ry; y++) { const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry)))); Rc(c, cx - half, cy + y, half * 2 + 1, 1, col); }
  }

  /* ── static geometry shared by bg (drawing) and anim (occlusion mask) ── */
  const SURF = [[110, 3], [146, 4], [176, 2]];          // little wet rocks breaking the surf: x, rows above the waterline
  let GEO = null;
  function geo() {
    if (GEO) return GEO;
    const palm = buildPalm(), rock = buildRock(), surf = buildSurf(), occ = new Uint8Array(W * H);
    for (const M of [palm, rock, surf.M]) for (const k of M.keys()) occ[k] = 1;
    GEO = { palm, rock, surf, occ };
    return GEO;
  }
  // horizontal run that skips occluded pixels (palm / rocks stand in front of sky and sea)
  function mrow(c, x0, y, w, col) {
    if (y < 0 || y >= H) return;
    const occ = geo().occ, x1 = Math.min(W, x0 + w); let s = -1;
    c.fillStyle = col;
    for (let x = Math.max(0, x0); x <= x1; x++) {
      const free = x < x1 && !occ[y * W + x];
      if (free && s < 0) s = x;
      else if (!free && s >= 0) { c.fillRect(s, y, x - s, 1); s = -1; }
    }
  }
  function mR(c, x, y, w, h, col) { for (let j = 0; j < h; j++) mrow(c, x, y + j, w, col); }
  function mspr(c, x, y, rows, map) {
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) {
      const col = map[rows[j][i]]; if (col) mrow(c, x + i, y + j, 1, col);
    }
  }

  function buildPalm() {
    const T = new Map(), F = new Map();
    const BY = 98, TY = 22, cxAt = s => 11 + 33 * s - 5 * s * s;
    for (let y = TY; y <= BY; y++) {
      const s = (BY - y) / (BY - TY), up = BY - y;
      const w = Math.round(6.4 - 2.2 * s) + (up < 3 ? 3 - up : 0);
      const xl = Math.round(cxAt(s) - w / 2), xr = xl + w - 1, seg = up % 4;
      for (let x = xl; x <= xr; x++) {
        let col;
        if (x === xl) col = seg === 0 ? W0 : W1;
        else if (x === xr) col = W0;
        else if (seg === 0) col = x === xl + 1 ? W2 : W1;
        else if (x === xl + 1) col = S2;
        else if (x === xl + 2 && seg === 2) col = S2;
        else if (x === xr - 1) col = W1;
        else col = W2;
        put(T, x, y, col);
      }
      if (seg === 0 && up > 2) put(T, xr + 1, y, W0);
      if (up === 0) { put(T, xl - 1, y, W0); put(T, xr + 1, y, W0); }
    }
    for (let x = 6; x <= 20; x++) put(T, x, BY + 1, WS);   // contact shadow
    const C = [Math.round(cxAt(1)), TY - 2];
    const FR = [
      [-.25, -1, 18, .35, 1], [.5, -.88, 20, .45, 1], [-.95, -.1, 17, .5, 1], [.95, .05, 18, .55, 1],
      [-1, -.3, 30, .55, 0], [-.62, -.78, 25, .5, 0], [.12, -1, 21, .3, 0],
      [.72, -.69, 28, .5, 0], [1, -.15, 27, .62, 0], [-.85, .35, 20, .55, 0], [.8, .4, 21, .55, 0]];
    for (const [dx, dy, len, dr, back] of FR) {
      // one frond = arched band: lit rachis on top, leaflets hanging below with a notched (comb) edge,
      // outlined on its own so neighbouring fronds stay separated
      const Fi = new Map(), cR = back ? G1 : G3, cL = back ? G1 : G2, cM = back ? G0 : G1;
      const n = Math.ceil(len * 2.5), pts = [];
      for (let i = 0; i <= n; i++) {
        const u = i / n, s = u * len, px = C[0] + dx * len * u, py = C[1] + dy * len * u + dr * len * u * u;
        let tx = dx * len, ty = dy * len + 2 * dr * len * u; const tl = Math.hypot(tx, ty); tx /= tl; ty /= tl;
        let nx = -ty, ny = tx; if (ny < 0) { nx = -nx; ny = -ny; }
        pts.push([px, py]);
        const wl = Math.max(1, Math.round(4.8 * Math.sin(Math.PI * Math.min(1, .1 + u * .95)))), wu = Math.round(wl * .4);
        const notch = Math.floor(s) % 3 === 0;
        for (let k = 1; k <= wl; k++) {
          if (notch && k >= wl - 1 && wl > 2) continue;
          put(Fi, Math.round(px + nx * k + tx * k * .7), Math.round(py + ny * k + ty * k * .7), k > wl * .55 ? cM : cL);
        }
        for (let k = 1; k <= wu; k++) put(Fi, Math.round(px - nx * k + tx * k * .6), Math.round(py - ny * k + ty * k * .6), cR);
      }
      for (const [px, py] of pts) put(Fi, Math.round(px), Math.round(py), cR);
      outlineMap(Fi, G0);
      for (const [k, v] of Fi) F.set(k, v);
    }
    const P = new Map(T);
    for (const [k, v] of F) P.set(k, v);
    // coconuts
    const nut = ['.oo.', 'oLMo', 'oMMo', '.oo.'];
    const nutAt = (x, y, o, L, M) => nut.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') put(P, x + i, y + j, ch === 'o' ? o : ch === 'L' ? L : M); }));
    for (const [x, y, o, L, M] of [[34, 21, W0, W2, W1], [38, 22, W0, W2, W1], [41, 20, G0, G2, G1], [36, 24, W0, W2, W1]]) nutAt(x, y, o, L, M);
    // fallen coconut + small tufts at the palm foot
    nutAt(21, 95, W0, W2, W1); put(P, 21, 99, WS); put(P, 22, 99, WS); put(P, 23, 99, WS);
    const tuft = (bx, by, hs) => hs.forEach((h, i) => { const x = bx + i * 2 - hs.length; for (let k = 0; k < h; k++) put(P, x + (k > h / 2 ? (i < hs.length / 2 ? -1 : 1) : 0), by - k, k < 2 ? G1 : k < h - 1 ? G2 : G3); });
    tuft(5, 99, [3, 5, 4, 6, 3]); tuft(18, 99, [2, 4, 3]);
    return P;
  }

  function buildRock() {
    const M = new Map(), BASE = 97;
    const blobs = [[230, 74, 14, 25], [235, 54, 8, 9], [215, 87, 8, 11], [222, 66, 7, 9], [200, 90, 4, 3]];
    const info = new Map();       // pixel -> [boulder, dx, dy]
    for (let y = 40; y <= BASE; y++) for (let x = 190; x < W; x++) {
      let best = -9, bi = -1, bx = 0, by = 0;
      for (let i = 0; i < blobs.length; i++) {
        const [cx, cy, rx, ry] = blobs[i], dx = (x - cx) / rx, dy = (y - cy) / ry, f = 1 - dx * dx - dy * dy;
        if (f > best) { best = f; bi = i; bx = dx; by = dy; }
      }
      if (best + (vn(x * .3, y * .3) - .5) * .35 - .06 <= 0) continue;
      info.set(y * W + x, [bi, bx, by]);
    }
    const blob = (x, y) => { const v = info.get(y * W + x); return v ? v[0] : -1; };
    const plane = new Map();
    // three flat planes per boulder (light from the top-left): top/left faces K3, front K2, right/under K1;
    // a lit 1px rim on every upper edge and K0 crevices where one boulder meets another
    for (const [k, [bi, dx, dy]] of info) {
      const x = k % W, y = (k / W) | 0;
      const lvl = (dy < -.45 || (dx < -.42 && dy < .3)) ? 3 : (dx > .45 || dy > .62) ? 1 : 2;
      plane.set(k, lvl);
      const up = blob(x, y - 1), dn = blob(x, y + 1), lf = blob(x - 1, y);
      let col = [K0, K1, K2, K3][lvl];
      if (up !== bi) col = lvl === 1 ? K2 : K3;
      if ((dn >= 0 && dn !== bi) || (lf >= 0 && lf !== bi)) col = K0;
      if (y >= 90) col = col === K3 ? K2 : col === K2 ? K1 : ((x + y) % 3 === 0 ? K0 : K1);    // wet tide band
      put(M, x, y, col);
    }
    // sedimentary ledges: dark seam with a lit lip above it
    for (const L of [60, 72, 84]) for (let x = 190; x < W; x++) {
      const y = L + Math.round(Math.sin(x * .35 + L) * .6);
      if (!info.has(y * W + x) || !info.has((y - 1) * W + x) || !info.has((y + 1) * W + x)) continue;
      put(M, x, y, K0); put(M, x, y - 1, plane.get((y - 1) * W + x) === 1 ? K2 : K3);
    }
    const r = rng(91);
    // moss on top-facing surfaces
    for (const [k, [, , dy]] of info) { const x = k % W, y = (k / W) | 0; if (dy < -.5 && y < 84 && !info.has(k - W * 2)) { put(M, x, y, r() < .3 ? G3 : G2); if (r() < .6) put(M, x, y + 1, G1); } }
    // cracks
    for (const [cx0, cy0, len] of [[226, 63, 6], [236, 75, 7], [219, 78, 5]]) {
      let x = cx0, y = cy0;
      for (let s = 0; s < len; s++) {
        if (!info.has(y * W + x) || !info.has(y * W + x + 1)) break;
        put(M, x, y, K1); if (s % 3 === 1) put(M, x + 1, y, K3);
        y++; if (r() < .4) x += r() < .5 ? -1 : 1;
      }
    }
    // barnacle clusters around the tide line (tiny white domes with a shadow)
    for (let i = 0; i < 9; i++) {
      const bx = 204 + Math.floor(r() * 34), by = 82 + Math.floor(r() * 9);
      for (let j = 0; j < 4; j++) {
        const x = bx + Math.floor(r() * 4), y = by + Math.floor(r() * 3);
        if (!info.has(y * W + x) || !info.has((y + 1) * W + x)) continue;
        put(M, x, y, WH); put(M, x, y + 1, K1);
      }
    }
    // a little orange starfish clinging to the stone
    [[2, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [1, 2], [2, 2], [3, 2], [1, 3], [3, 3], [0, 4], [4, 4]].forEach(([i, j]) => put(M, 210 + i, 79 + j, (i === 2 && j === 1) ? S0 : OR));
    outlineMap(M, K0, BASE);
    // hanging seaweed at the foot
    for (let i = 0; i < 9; i++) {
      const x = 204 + Math.floor(r() * 36), y0 = 86 + Math.floor(r() * 5), len = 3 + Math.floor(r() * 5);
      if (!info.has(y0 * W + x)) continue;
      for (let k = 0; k < len && y0 + k <= BASE; k++) put(M, x + ((k >> 1) & 1), y0 + k, k === len - 1 ? G0 : (k & 1) ? G1 : G2);
    }
    // wet sand with a sky reflection at the base (part of the occluder so the swash wraps around it)
    for (let x = 194; x < W; x++) if (info.has(BASE * W + x) || info.has((BASE - 1) * W + x)) { put(M, x, BASE + 1, WS); put(M, x, BASE + 2, (x % 4) === 3 ? WS : SE4); }
    [[198, 96, K2], [202, 98, K1], [206, 98, K2], [194, 98, K1]].forEach(([x, y, col]) => { put(M, x, y, col); put(M, x + 1, y, col); put(M, x, y - 1, K3); put(M, x + 2, y, K0); put(M, x, y + 1, K0); put(M, x + 1, y + 1, K0); });
    return M;
  }

  function buildSurf() {
    const M = new Map(), pos = [], rows = ['.31..', '2111.', '21110', '00000'], map = { 3: K3, 2: K2, 1: K1, 0: K0 };
    for (const [x0, h] of SURF) {
      const y0 = shore(x0 + 2) - h; pos.push([x0, y0]);
      rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') put(M, x0 + i, y0 + j, map[ch]); }));
    }
    return { M, pos };
  }

  /* ── static layers ── */
  function sky(c) {
    R(c, 0, 0, W, 16, SK0); dither(c, 16, W, SK0, SK1); R(c, 0, 18, W, 14, SK1); dither(c, 32, W, SK1, SK2);
    R(c, 0, 34, W, 12, SK2); dither(c, 46, W, SK2, SK3); R(c, 0, 48, W, 12, SK3);
    // thin cirrus streaks in the high right sky
    for (const [x, y, l] of [[180, 9, 16], [203, 13, 21], [186, 20, 12], [222, 23, 14]]) {
      const lo = y < 16 ? SK1 : SK2, hi = y < 16 ? SK2 : SK3;
      R(c, x, y, l, 1, lo); R(c, x + 3, y, l - 7, 1, hi); R(c, x + 6, y + 1, l - 4, 1, lo); R(c, x - 3, y - 1, 5, 1, lo);
    }
    // a far flock of gulls (pale = distant)
    for (const [x, y, w] of [[216, 6, 3], [223, 9, 5], [211, 10, 3]]) { R(c, x, y, 1, 1, SK3); R(c, x + w - 1, y, 1, 1, SK3); R(c, x + 1, y + 1, w - 2, 1, SK3); }
    const bank = [[74, 57, 5, 3], [82, 55, 7, 5], [91, 56, 6, 4], [100, 57, 5, 3], [108, 58, 4, 2], [178, 57, 5, 3], [187, 55, 7, 5], [196, 56, 6, 4], [204, 58, 4, 2]];
    for (const [x, y, rx, ry] of bank) disc(c, x + 1, y + 1, rx, ry, SK2);
    for (const [x, y, rx, ry] of bank) disc(c, x, y, rx, ry, WH);
    for (const [x, y, rx] of bank) R(c, x - rx, 59, rx * 2 + 2, 1, SK2);
  }
  function sea(c, rnd) {
    for (let x = 0; x < W; x++) {
      const sh = shore(x);
      R(c, x, 60, 1, 1, SE0); R(c, x, 61, 1, 5, SE1);
      R(c, x, 66, 1, 1, x & 1 ? SE1 : SE2); R(c, x, 67, 1, 1, x & 1 ? SE2 : SE1);
      R(c, x, 68, 1, 8, SE2);
      R(c, x, 76, 1, 1, x & 1 ? SE2 : SE3); R(c, x, 77, 1, 1, x & 1 ? SE3 : SE2);
      R(c, x, 78, 1, sh - 82, SE3);
      R(c, x, sh - 4, 1, 1, x & 1 ? SE3 : SE4); R(c, x, sh - 3, 1, 1, x & 1 ? SE4 : SE3);
      R(c, x, sh - 2, 1, 2, SE4);
    }
    // submerged rocks / seagrass seen through the clear shallows
    for (const [sx, sy, w] of [[30, 81, 16], [92, 81, 18], [164, 80, 12]]) for (let j = 0; j < 3; j++) for (let x = sx + j * 2; x < sx + w - j * 2; x++) if (((x + j) & 1) === 0 && sy + j < shore(x) - 4) R(c, x, sy + j, 1, 1, SE2);
    const dash = (y0, y1, n, lmin, lmax, hi, lo) => {
      for (let i = 0; i < n; i++) {
        const y = y0 + Math.floor(rnd() * (y1 - y0 + 1)), l = lmin + Math.floor(rnd() * (lmax - lmin + 1)), x = Math.floor(rnd() * (W - l));
        if (y + 1 >= shore(x) - 4) continue;
        R(c, x, y, l, 1, hi); if (lo) R(c, x + 1, y + 1, l, 1, lo);
      }
    };
    dash(62, 65, 30, 2, 3, SE2, null);
    dash(69, 74, 28, 3, 5, SE3, SE1);
    dash(79, 84, 22, 4, 7, SE4, SE2);
    for (let i = 0; i < 10; i++) R(c, Math.floor(rnd() * W), 61 + Math.floor(rnd() * 4), 1, 1, SK3);
    // far islets on the horizon (small, pale)
    for (const [x, w, h] of [[46, 8, 3], [56, 4, 2], [184, 5, 2]]) {
      for (let i = 0; i < w; i++) { const hh = Math.round(h * Math.sin(Math.PI * (i + .5) / w)); if (hh > 0) { R(c, x + i, 60 - hh, 1, hh, i < w / 2 ? K2 : K1); if (i < w / 2) R(c, x + i, 60 - hh, 1, 1, K3); } }
      R(c, x - 1, 60, w + 2, 1, SK3); R(c, x, 61, w, 1, SE0);
    }
  }
  function island(c) {
    const h1 = x => { const d = (x - 146) / 21; return d * d < 1 ? 10 * Math.pow(1 - d * d, .7) : 0; };
    const h2i = x => { const d = (x - 167) / 7; return d * d < 1 ? 5 * Math.sqrt(1 - d * d) : 0; };
    const top = x => Math.round(60 - Math.max(h1(x), h2i(x)));
    for (let x = 124; x <= 176; x++) {
      const a = h1(x), b = h2i(x); if (Math.max(a, b) < .5) continue;
      const tp = top(x), rocky = b > a;
      const lit = rocky ? x < 166 : x < 144;
      R(c, x, tp, 1, 60 - tp, rocky ? (lit ? K2 : K1) : GI);
      if (!rocky && !lit) for (let y = tp + 1; y < 60; y++) if ((x + y) & 1) R(c, x, y, 1, 1, K2);   // shaded slope: soft green/grey checker
      if (lit) R(c, x, tp, 1, 1, rocky ? K3 : SK3);
    }
    // sandy fringe and surf
    R(c, 127, 59, 46, 1, S1); R(c, 129, 59, 3, 1, S0);
    for (let x = 126; x < 176; x += 3) R(c, x, 60, 2, 1, WH);
    R(c, 130, 61, 40, 1, SE0);
    // tiny palms
    for (const [x, h] of [[133, 6], [138, 7], [150, 6]]) {
      const b = top(x) - 1;
      for (let k = 0; k < h; k++) R(c, x + (k > h / 2 ? 1 : 0), b - k, 1, 1, K2);
      const fx = x + 1, fy = b - h;
      R(c, fx - 2, fy, 5, 1, K2); R(c, fx - 3, fy + 1, 1, 1, K2); R(c, fx + 3, fy + 1, 1, 1, K2); R(c, fx, fy - 1, 1, 1, K2);
    }
    // lighthouse on the rocky head
    const lx = 166, lb = top(167) - 1;
    for (let y = 43; y <= lb; y++) {
      const stripe = ((y - 43) % 6) >= 3;
      R(c, lx, y, 2, 1, stripe ? RD : WH); R(c, lx + 2, y, 1, 1, stripe ? RD0 : SK2);
    }
    R(c, lx - 1, 42, 5, 1, K1); R(c, lx, 40, 1, 2, K1); R(c, lx + 1, 40, 1, 2, S0); R(c, lx + 2, 40, 1, 2, K1);
    R(c, lx, 39, 3, 1, RD0); R(c, lx + 1, 38, 1, 1, RD0);
    // keeper's hut on the hill shoulder
    const hb = top(158) - 1;
    R(c, 157, hb - 2, 4, 3, WH); R(c, 160, hb - 2, 1, 3, SK2); R(c, 156, hb - 3, 6, 1, RD0); R(c, 158, hb - 1, 1, 2, K1);
  }
  function sand(c, rnd) {
    for (let x = 0; x < W; x++) {
      const sh = shore(x), gb = groundBottom(x);
      R(c, x, sh, 1, gb - sh, S1);
      R(c, x, sh, 1, 1, S3); R(c, x, sh + 1, 1, 2, WS);
      R(c, x, sh + 3, 1, 1, (x & 1) ? WS : S2); R(c, x, sh + 4, 1, 1, S2); if (x & 1) R(c, x, sh + 5, 1, 1, S2);
      // bleached dry berm right behind the wet zone
      if (x % 2 === 0) R(c, x, sh + 7, 1, 1, S0);
      if (x % 4 === 1) R(c, x, sh + 8, 1, 1, S0);
    }
    // low dune undulation: soft S1/S2 checker patches, lit crest on their upper edge
    const dune = (x, y) => y > shore(x) + 9 && y < 133 && vn(x * .05, y * .18) > .6;
    for (let y = 96; y < 133; y++) for (let x = 0; x < W; x++) {
      if (!dune(x, y)) continue;
      if (!dune(x, y - 1)) R(c, x, y, 1, 1, S0);
      else if ((x + y) & 1) R(c, x, y, 1, 1, S2);
    }
    // ripple marks in perspective: far rows soft (S2 under the crest), near rows as 6-14px dashes with a cool shadow
    const RIP = [101, 105, 110, 116, 123, 131, 141, 151];
    RIP.forEach((ry, k) => {
      const near = (ry - 96) / 56, amp = .8 + near * 1.4, freq = .12 - near * .06;
      const rip = x => {
        const y = ry + Math.round(Math.sin(x * freq + k * 1.9) * amp);
        if (y <= shore(x) + 9 || y >= groundBottom(x) - 3) return;
        R(c, x, y - 1, 1, 1, S0); R(c, x, y, 1, 1, ry >= 116 ? WS : S2);
      };
      if (ry < 116) { for (let x = 0; x < W; x++) if (vn(x * (.07 - near * .035) + k * 13, k * 3.1) >= .44) rip(x); return; }
      let x = Math.floor(h2(k, 1) * 10);
      while (x < W) {
        const len = 6 + Math.floor(h2(x, k + 30) * 9), gap = 3 + Math.floor(h2(x + 1, k + 9) * (6 + near * 8));
        for (let i = 0; i < len && x + i < W; i++) rip(x + i);
        x += len + gap;
      }
    });
    // the front of the platform darkens from the feet line down to the lip (ordered dither, solid by gb-2)
    for (let x = 0; x < W; x++) {
      const gb = groundBottom(x), y0 = Math.min(135, gb - 8), y1 = gb - 2;
      for (let y = y0; y <= y1; y++) if (BAY[y & 3][x & 3] < (.2 + .8 * (y - y0) / (y1 - y0)) * 16) R(c, x, y, 1, 1, S2);
    }
    // one long faint ripple running right under the feet line
    for (let x = 16; x < 225; x++) {
      if ((x * 7 + 3) % 41 < 4) continue;
      const y = 134 + Math.round(Math.sin(x * .055 + .7) * 1.2);
      R(c, x, y - 1, 1, 1, S0); R(c, x, y, 1, 1, S2);
    }
    // wrack line: dried seaweed, twigs and shell bits left by the high tide
    for (let x = 24; x < 194; x++) {
      const v = vn(x * .21, 7.3); if (v < .5) continue;
      const y = shore(x) + 10 + Math.round(Math.sin(x * .045 + 1) * 1.5), r = rnd();
      if (v > .72 && r < .5) { R(c, x, y - 1, 2, 1, G2); R(c, x, y, 3, 1, G1); R(c, x + 1, y + 1, 2, 1, G0); x += 2; }
      else if (r < .4) { R(c, x, y, 1, 1, G1); R(c, x, y + 1, 1, 1, G0); }
      else if (r < .6) R(c, x, y, 2, 1, W1);
      else if (r < .7) R(c, x, y, 1, 1, WH);
      else if (r < .8) R(c, x, y, 1, 1, PK);
    }
    // grains, denser toward the viewer
    for (let i = 0; i < 300; i++) {
      const x = Math.floor(rnd() * W), y = 100 + Math.floor(Math.sqrt(rnd()) * 54);
      if (y >= groundBottom(x) - 2 || y < shore(x) + 9) continue;
      const r = rnd();
      if (r < .5) R(c, x, y, 1, 1, S2); else if (r < .8) R(c, x, y, 1, 1, S0); else { R(c, x, y, 1, 1, S3); R(c, x - 1, y - 1, 1, 1, S0); }
    }
    // extra grain right around the feet line (~1 per 10px²) so the sprites stand on texture
    for (let i = 0; i < 230; i++) {
      const x = 20 + Math.floor(rnd() * 201), y = 128 + Math.floor(rnd() * 11), r = rnd();
      if (y >= groundBottom(x) - 2) continue;
      if (r < .42) R(c, x, y, 1, 1, S2); else if (r < .6) R(c, x, y, 1, 1, WS); else if (r < .74) { R(c, x, y, 1, 1, S3); R(c, x - 1, y - 1, 1, 1, S0); } else R(c, x, y, 1, 1, S0);
    }
    // sky reflections in the wet band
    for (let i = 0; i < 14; i++) { const x = Math.floor(rnd() * (W - 4)), y = shore(x) + 1 + Math.floor(rnd() * 2); R(c, x, y, 2 + Math.floor(rnd() * 3), 1, SK3); }
    // tiny crab holes and bubbles in the damp sand
    for (let i = 0; i < 10; i++) { const x = 26 + Math.floor(rnd() * 166), y = shore(x) + 3 + Math.floor(rnd() * 4); R(c, x, y, 1, 1, S3); R(c, x + 1, y, 1, 1, S0); if (i & 1) R(c, x - 2, y + 1, 1, 1, S3); }
    // footprints heading to the water
    for (let i = 0; i < 9; i++) {
      const u = i / 8, x = Math.round(94 - 26 * u + (i & 1 ? 2 : -2)), y = Math.round(133 - 31 * u);
      if (y > 120) { R(c, x, y, 3, 1, S3); R(c, x, y + 1, 3, 1, WS); R(c, x + 1, y + 2, 2, 1, S0); R(c, x - 1, y - 2, 1, 1, S3); R(c, x + 1, y - 2, 1, 1, S3); R(c, x + 3, y - 2, 1, 1, S3); }
      else if (y > 110) { R(c, x, y, 2, 1, S3); R(c, x, y + 1, 2, 1, S0); R(c, x, y - 1, 1, 1, S3); R(c, x + 2, y - 1, 1, 1, S3); }
      else R(c, x, y, 2, 1, S3);
    }
    // small shells in the mid-ground
    const SH = [[['PwP', '.P.'], { P: PK, w: WH }], [['wK'], { w: WH, K: K3 }], [['.w', 'wK'], { w: S0, K: K2 }], [['owo'], { o: OR, w: S0 }]];
    for (const [x, y, i] of [[30, 104, 0], [58, 110, 1], [102, 108, 2], [140, 112, 0], [176, 105, 3], [196, 118, 1], [214, 110, 2], [128, 126, 3], [44, 126, 2], [166, 130, 1], [82, 118, 3]]) {
      const [rows, map] = SH[i]; spr(c, x, y, rows, map); R(c, x + 1, y + rows.length, rows[0].length, 1, WS);
    }
    // dappled shadow of the palm crown on the sand (light from the top-left)
    for (let y = -3; y <= 3; y++) {
      const hw = Math.round(17 * Math.sqrt(1 - (y * y) / 12.25));
      for (let x = -hw; x <= hw; x++) {
        const X = 44 + x + Math.round(y * .8), Y = 104 + y;
        if (((X + Y) & 1) && vn(X * .45, Y * .9 + 40) > .3) R(c, X, Y, 1, 1, S2);
      }
    }
    // little rocks half buried at the back-left, behind the beach grass
    stone(c, 6, 110, 4, 2, 0); stone(c, 13, 113, 3, 2, 1);
  }
  function sandCastle(c) {
    // a small sand castle at the extreme right side, outlined in warm brown so it reads on the sand
    const O = W1, B = S1, L = S0, D = S2;
    R(c, 222, 118, 18, 1, S2); R(c, 224, 119, 16, 1, WS); R(c, 227, 120, 13, 2, WS);    // moat + cast shadow down-right
    R(c, 224, 109, 15, 9, O); R(c, 225, 110, 13, 8, B); R(c, 225, 110, 2, 8, L); R(c, 235, 110, 2, 8, D); R(c, 237, 110, 1, 8, W2);   // wall
    for (const [tx, ty, tw] of [[224, 102, 6], [233, 105, 6]]) {
      R(c, tx, ty, tw, 118 - ty, O); R(c, tx + 1, ty + 1, tw - 2, 116 - ty, B); R(c, tx + 1, ty + 1, 1, 116 - ty, L); R(c, tx + tw - 2, ty + 1, 1, 116 - ty, W2);
      for (let i = 0; i < tw; i += 2) R(c, tx + i, ty - 1, 1, 1, O);          // crenels
      R(c, tx + 2, ty + 3, 2, 2, W1); R(c, tx + 2, ty + 3, 1, 1, W0);            // window
    }
    for (let i = 0; i < 4; i++) R(c, 230 + i, 108, 1, 1, i & 1 ? O : B);
    R(c, 230, 113, 3, 5, W1); R(c, 231, 112, 1, 1, W1); R(c, 230, 113, 2, 4, W0);   // gate
    R(c, 226, 95, 1, 7, W0); R(c, 227, 95, 3, 1, RD); R(c, 227, 96, 2, 1, RD0);    // flag
    R(c, 228, 115, 1, 1, PK); R(c, 234, 115, 1, 1, WH); R(c, 226, 116, 1, 1, OR);  // shell decor
    // spade stuck in the sand + red pail
    spr(c, 222, 117, ['....hh', '....w.', '...w..', '...w..', '..w...', '.bbB..', '.bBB..', '.BBk..', '..k...'], { h: W1, w: W2, b: K3, B: K2, k: K1 });
    R(c, 224, 126, 3, 1, WS);
    spr(c, 230, 120, ['.kkk.', 'k...k', 'ooooo', 'lrrrd', 'lrrrd', '.lrd.'], { k: K1, o: RD0, l: OR, r: RD, d: RD0 });
    R(c, 231, 126, 5, 1, WS);
  }
  function stone(c, x, y, rx, ry, mossy) {
    discC(c, x, y, rx + 1, ry + 1, K0);
    discC(c, x, y, rx, ry, K1);
    discC(c, x - 1, y - 1, Math.max(1, rx - 1), Math.max(1, ry - 1), K2);
    Rc(c, x - Math.ceil(rx / 2), y - ry + 1, 2, 1, K3);
    if (mossy) {
      Rc(c, x - rx + 1, y - ry - 1, rx * 2 - 1, 1, G0);
      Rc(c, x - rx + 1, y - ry, rx * 2 - 2, 1, G2); Rc(c, x - rx + 2, y - ry + 1, rx - 1, 1, G1);
      Rc(c, x - rx + 2, y - ry, 2, 1, G3);
    }
  }
  const POOL = { cx: 68, cy: 141, rx: 20, ry: 5 };
  function tidePool(c) {
    const { cx, cy, rx, ry } = POOL;
    discC(c, cx, cy + 1, rx + 3, ry + 1, WS);      // damp sand ring
    discC(c, cx, cy, rx + 1, ry, S3);              // inner lip
    for (let y = -ry; y < ry; y++) {
      const hw = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
      Rc(c, cx - hw, cy + y, hw * 2 + 1, 1, y === -ry ? S3 : y === -ry + 1 ? SE0 : y === -ry + 2 ? SE1 : y === -ry + 3 ? SE2 : y >= ry - 2 ? SE4 : SE3);
    }
    // caustic ripples and the sandy floor seen through the water
    for (const [x, y, w] of [[cx - 9, cy - 1, 3], [cx + 2, cy, 4], [cx - 3, cy - 2, 2], [cx + 8, cy - 1, 3], [cx - 14, cy + 1, 2], [cx + 13, cy + 1, 2]]) R(c, x, y, w, 1, SE4);
    R(c, cx - 5, cy + 3, 4, 1, SK3); R(c, cx + 5, cy + 3, 3, 1, SK3);
    spr(c, cx - 11, cy - 1, ['..o..', 'ooOoo', '.oOo.', '.o.o.'], { o: OR, O: S0 });   // pool starfish
    for (const [x, h] of [[cx + 3, 5], [cx + 5, 3], [cx - 16, 3], [cx - 5, 2], [cx + 15, 3]]) for (let k = 0; k < h; k++) R(c, x + ((k >> 1) & 1), cy + 3 - k, 1, 1, k === h - 1 ? G3 : G1);
    R(c, cx + 10, cy + 1, 2, 1, SE2); R(c, cx - 2, cy + 2, 2, 1, SE2); R(c, cx + 7, cy + 2, 1, 1, WH);
    R(c, cx - 13, cy - 3, 2, 1, WH); R(c, cx - 14, cy - 2, 1, 1, WH);      // glint on the water, top-left
    // anemone clinging to the inner right edge
    R(c, cx + 11, cy, 3, 1, PK0); R(c, cx + 12, cy - 1, 1, 1, PK);
    // rounded grey stones ringing the pool (the front middle stays open to show the water)
    stone(c, cx - 10, cy - 4, 2, 1, 1); stone(c, cx + 8, cy - 4, 3, 1, 0);      // back rim
    stone(c, cx - 21, cy - 1, 4, 3, 1); stone(c, cx + 21, cy + 1, 4, 3, 1);     // ends
    stone(c, cx - 13, cy + 2, 3, 1, 0); stone(c, cx + 12, cy + 4, 5, 2, 1);     // front
  }
  function driftwood(c) {
    // a hollow log lying on the sand: dark opening at the left end, bark grain, warm underside
    const x0 = 140, x1 = 176, yt = x => 138 + Math.round((x1 - x) * 2 / (x1 - x0));
    for (let x = x0 - 1; x <= x1 + 3; x++) { const y = yt(Math.min(x, x1)) + 8; Rc(c, x, y, 1, x > 160 ? 2 : 1, WS); }   // cool cast shadow
    for (let x = x1 + 1; x <= x1 + 3; x++) Rc(c, x, yt(x1) + 4 + (x - x1), 1, 4, WS);
    for (let x = x0; x <= x1; x++) {
      const y = yt(x), u = (x - x0) / (x1 - x0);
      R(c, x, y, 1, 1, W0);
      R(c, x, y + 1, 1, 1, (x * 7) % 11 < 3 && u < .75 ? S0 : S2);
      R(c, x, y + 2, 1, 3, W2);
      if ((x + 1) % 9 < 4) R(c, x, y + 2, 1, 1, W1);
      if ((x + 5) % 7 < 3) R(c, x, y + 4, 1, 1, W1);
      if ((x * 3) % 13 === 0) R(c, x, y + 3, 1, 1, S2);
      R(c, x, y + 5, 1, 2, W1);
      if ((x + 2) % 8 < 2) R(c, x, y + 6, 1, 1, W0);
      R(c, x, y + 7, 1, 1, W0);
    }
    // broken right end
    R(c, x1 + 1, yt(x1) + 1, 1, 6, W0); R(c, x1, yt(x1) + 2, 1, 4, W1);
    // twig forking off the right end (stays at y >= 137)
    for (let k = 0; k < 6; k++) {
      const x = x1 + 1 + k, y = Math.max(138, yt(x1) + 3 - (k >> 1));
      R(c, x, y - 1, 1, 1, W0); R(c, x, y, 1, 1, k === 5 ? S2 : W2); R(c, x, y + 1, 1, 1, W1); R(c, x, y + 2, 1, 1, W0);
    }
    R(c, x1 + 4, yt(x1) + 5, 1, 1, W1); R(c, x1 + 5, yt(x1) + 6, 1, 1, W1); R(c, x1 + 5, yt(x1) + 5, 1, 1, W0); R(c, x1 + 6, yt(x1) + 6, 1, 1, W0);
    // stub on top
    R(c, 166, yt(166) - 1, 1, 1, W2); R(c, 166, yt(166) - 2, 1, 1, W0); R(c, 165, yt(166) - 1, 1, 1, W0); R(c, 167, yt(166) - 1, 1, 1, W0);
    // knot
    { const y = yt(158); R(c, 157, y + 3, 3, 2, W1); R(c, 158, y + 4, 1, 1, W0); R(c, 157, y + 3, 1, 1, S2); }
    // hollow end face
    spr(c, x0 - 4, yt(x0) - 1, ['..oooo..', '.oLLLLo.', 'oLLddLWo', 'oLdkkdWo', 'oLdkkdWo', 'oLdkddWo', 'oWLddWWo', '.oWWWWo.', '..oooo..'],
      { o: W0, L: S2, W: W2, d: W0, k: DK0 });
    // seaweed draped over the log
    { const yy = yt(152);
      for (const [x, dy] of [[151, 1], [152, 2], [153, 2], [153, 3], [154, 4], [150, 2], [150, 3], [151, 2]]) R(c, x, yy + dy, 1, 1, (x + dy) & 1 ? G1 : G2);
      R(c, 149, yy + 4, 1, 2, G0); R(c, 154, yy + 5, 1, 1, G0); R(c, 152, yy + 1, 1, 1, G3); }
  }
  function grassTuft(c, bx, by, n, hmax, seed, side) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const x0 = bx + Math.round((r() - .5) * 10), len = Math.round(hmax * (.35 + r() * .65)), lean = (r() - .5) * 10 + side * 4, dry = r() < .25;
      let px = x0;
      for (let k = 0; k < len; k++) {
        const u = k / len, x = Math.round(x0 + lean * u * u), y = by - k;
        const col = k === 0 ? G0 : u < .45 ? G1 : u < .8 ? (dry ? S3 : G2) : (dry ? S2 : G3);
        const a = Math.min(px, x); R(c, a, y, Math.abs(px - x) + 1, 1, col);
        if (u < .25) R(c, x + 1, y, 1, 1, u < .1 ? G0 : G2);
        px = x;
      }
    }
    // dense clump at the base
    for (let i = -5; i <= 5; i++) { const h = Math.round(3 - Math.abs(i) * .45 + ((i * 7) & 1)); if (h > 0) { R(c, bx + i, by - h + 1, 1, h, (i & 1) ? G1 : G2); R(c, bx + i, by - h + 1, 1, 1, (i & 1) ? G2 : G3); } }
    Rc(c, bx - 5, by + 1, 11, 1, G0); Rc(c, bx - 6, by + 2, 13, 1, WS);
  }
  function flower(c, x, y) { R(c, x, y - 1, 1, 1, PK); R(c, x - 1, y, 3, 1, PK); R(c, x, y + 1, 1, 1, PK0); R(c, x, y, 1, 1, S0); R(c, x + 1, y + 2, 1, 1, G1); R(c, x + 2, y + 1, 2, 1, G2); }
  function foreground(c) {
    tidePool(c);
    driftwood(c);
    // pink starfish on the sand
    spr(c, 97, 139, ['...o...', '..oPo..', 'ooPwPoo', 'oPPwPPo', '.oPPPo.', 'oPPoPPo', 'oPo.oPo', 'oo...oo'], { o: PK0, P: PK, w: S0 });
    R(c, 99, 147, 6, 1, WS);
    // message in a bottle
    spr(c, 184, 139, ['...ooooooo', 'conLwLgggo', 'conggpppgo', '...ooooooo'], { o: G0, n: G1, L: G3, w: WH, g: G2, p: S0, c: W2 });
    R(c, 186, 143, 8, 1, WS);
    // shells
    spr(c, 198, 137, ['.oPo.', 'oPwPo', 'oPwPo', '.ooo.'], { o: PK0, P: PK, w: WH }); R(c, 199, 141, 4, 1, WS);
    spr(c, 110, 146, ['.wK.', 'wwKo', '.oo.'], { w: S0, K: K3, o: K1 }); R(c, 111, 149, 3, 1, WS);
    spr(c, 106, 138, ['ww', 'KK'], { w: WH, K: K2 });
    spr(c, 92, 148, ['PwP', '.o.'], { P: PK, w: WH, o: PK0 });
    spr(c, 128, 148, ['owo'], { o: OR, w: S0 }); R(c, 129, 149, 3, 1, WS);
    // pebbles
    for (const [x, y, s] of [[106, 143, 1], [122, 149, 0], [131, 140, 1], [195, 142, 0], [208, 137, 1], [26, 136, 0], [38, 139, 1], [214, 136, 0], [180, 145, 0]]) {
      if (s) { R(c, x, y, 3, 2, K2); R(c, x, y, 1, 1, K3); R(c, x + 2, y + 1, 1, 1, K1); R(c, x, y + 2, 3, 1, K0); R(c, x + 3, y + 1, 1, 1, K0); }
      else { R(c, x, y, 2, 1, K2); R(c, x, y + 1, 2, 1, K0); }
    }
    // beach grass + beach morning glory at the sides
    grassTuft(c, 8, 131, 16, 26, 11, -1);
    grassTuft(c, 239, 130, 9, 15, 23, 1);
    flower(c, 15, 130); flower(c, 4, 125); flower(c, 224, 131); flower(c, 236, 126);
  }
  function soil(c, rnd) {
    for (let i = 0; i < 90; i++) {
      const x = 1 + Math.floor(rnd() * (W - 4)), gb = groundBottom(x), r = rnd();
      if (r < .18) { const y = gb + 1 + Math.floor(rnd() * 3); R(c, x, y, 2, 1, rnd() < .5 ? WH : PK); R(c, x, y + 1, 2, 1, S3); }
      else if (r < .45) { const y = gb + 4 + Math.floor(rnd() * 3); R(c, x, y, 2, 1, K2); R(c, x, y + 1, 2, 1, K1); }
      else if (r < .75) { const y = gb + 2 + Math.floor(rnd() * 5); R(c, x, y, 1, Math.min(2 + Math.floor(rnd() * 2), gb + 8 - y), rnd() < .5 ? W2 : W1); }
      else R(c, x, gb + 5, 3 + Math.floor(rnd() * 4), 1, W1);
    }
    // palm and grass roots
    for (let x = 4; x < 24; x++) { const gb = groundBottom(x); if ((x * 7) % 5 < 3) R(c, x, gb + 1 + ((x >> 1) % 4), 1, 2, W0); }
    for (let x = 228; x < 239; x += 3) { const gb = groundBottom(x); R(c, x, gb, 1, 2, W0); R(c, x + (x & 1 ? 1 : -1), gb + 2, 1, 1 + (x % 2), W0); }
  }

  /* ── animation ── */
  const CLOUDS = [
    { y: 8, sp: 2.1, off: 20, bot: 9, c: [[0, 5, 4], [6, 2, 6], [13, 4, 5], [19, 6, 3], [-5, 6, 3]] },
    { y: 24, sp: 1.4, off: 160, bot: 7, c: [[0, 4, 3], [5, 2, 4], [11, 4, 3], [-4, 5, 2]] },
    { y: 14, sp: 1.7, off: 260, bot: 8, c: [[0, 4, 4], [7, 2, 5], [14, 5, 3], [-5, 5, 3]] },
  ];
  function cloud(c, x0, y0, circ, bot) {
    let top = 99; for (const [, cy, r] of circ) top = Math.min(top, cy - r);
    const span = (yy, ox) => { let l = 999, r = -999; for (const [cx, cy, rr] of circ) { const dy = yy - cy; if (Math.abs(dy) > rr) continue; const hw = Math.round(Math.sqrt(rr * rr - dy * dy)); l = Math.min(l, cx - hw + ox); r = Math.max(r, cx + hw + ox); } return [l, r]; };
    for (let yy = top + 1; yy <= bot + 1; yy++) { const [l, r] = span(Math.min(yy - 1, bot), 2); if (l <= r) mrow(c, x0 + l, y0 + yy, r - l + 1, SK2); }
    for (let yy = top; yy <= bot; yy++) {
      const [l, r] = span(yy, 0); if (l > r) continue;
      mrow(c, x0 + l, y0 + yy, r - l + 1, yy >= bot - 1 ? SK3 : WH);
    }
  }
  const GULL = [['.ww...ww.', 'K..w.w..K', '....w....'], ['K.......K', '.w.....w.', '..wwkww..'], ['...www...', '..w...w..', '.w.....w.', 'K.......K']];
  function waveState(t) {
    const wt = t / 5.2, n = Math.floor(wt), tau = wt - n;
    const E = tt => tt < .5 ? -1 : tt < .7 ? 1 - (1 - (tt - .5) / .2) ** 2 : tt < 1.2 ? (d => 1 - d * d * (3 - 2 * d))((tt - .7) / .5) : -1;
    let e = E(tau), wn = n, back = tau > .7;
    if (e < 0) { e = E(tau + 1); wn = n - 1; back = true; }
    return { n, tau, e, wn, back };
  }
  const front = (x, ws) => shore(x) - 1 + Math.round(ws.e * 5 * (.65 + .35 * Math.sin(x * .05 + ws.wn * 1.7)));
  const inPool = (x, y) => { const dx = (x - POOL.cx) / (POOL.rx - 1), dy = (y - POOL.cy + .5) / (POOL.ry - 1); return dx * dx + dy * dy < 1; };
  const CRAB = [['.oo.k.k.oo.', 'olroo.oorlo', 'orrooooorro', '.oollllroo.', '..orrrrro..', '.o.o...o.o.'],
    ['.oo.k.k.oo.', 'olroo.oorlo', 'orrooooorro', '.oollllroo.', '..orrrrro..', 'o.o.....o.o'],
    ['.o..k.k..o.', 'olroo.oorlo', 'orrooooorro', '.oollllroo.', '..orrrrro..', '.o.o...o.o.']];
  const boatBob = t => Math.floor(t * 1.3) % 2;
  const MOONSPR = ['..MMm..', '.MMm...', 'MMm....', 'MMm....', 'MMm....', '.MMm...', '..MMm..'];

  return {
    bg(c, rnd) {
      const g = geo();
      sky(c);
      sea(c, rnd);
      island(c);
      sand(c, rnd);
      flush(c, g.surf.M);
      for (const [x0, y0] of g.surf.pos) { R(c, x0 - 1, y0 + 3, 1, 1, WH); R(c, x0 + 5, y0 + 3, 1, 1, WH); R(c, x0, y0 + 4, 5, 1, SE4); }
      flush(c, g.rock);
      sandCastle(c);
      flush(c, g.palm);
      foreground(c);
      for (let x = 0; x < W; x++) R(c, x, groundBottom(x) - 1, 1, 1, S0);
      dioramaEdge(c, PAL_EDGE);
      soil(c, rnd);
    },
    anim(c, t) {
      const g = geo();
      // drifting clouds (they pass behind the palm and the rock)
      for (const cl of CLOUDS) { const x = Math.round(((t * cl.sp + cl.off) % (W + 70)) - 35); cloud(c, x, cl.y, cl.c, cl.bot); }
      // far gull + near gull (kept below the UI meter band)
      { const x = Math.round(W + 20 - ((t * 5 + 90) % (W + 40))), y = 41 + Math.round(Math.sin(t * .5 + 1) * 2); mspr(c, x, y, ['w...w', '.w.w.'], { w: WH }); }
      { const x = Math.round(((t * 13) % (W + 60)) - 30), y = 33 + Math.round(Math.sin(t * .7) * 5), ph = (t * .35) % 1;
        const f = ph < .3 ? (Math.floor(t * 8) % 2 ? 1 : 2) : 0;
        mspr(c, x, y, GULL[f], { w: WH, K: K1, k: K2 }); }
      // sailboat bobbing on the horizon
      { const b = boatBob(t), x = 98;
        spr(c, x, 55 + b, ['..k..', '.wk..', 'wwkw.', 'wwkww', 'hhhhh'], { k: K1, w: WH, h: RD0 }); R(c, x + 1, 60 + b, 4, 1, SE0); }
      // red buoy bobbing in the bay
      { const b = Math.floor(t * 1.1 + .5) % 2, x = 58, y = 72 + b;
        R(c, x + 1, y - 1, 1, 1, K1); R(c, x, y, 2, 1, RD); R(c, x + 2, y, 1, 1, RD0); R(c, x, y + 1, 2, 1, WH); R(c, x + 2, y + 1, 1, 1, K3);
        R(c, x, y + 2, 2, 1, RD); R(c, x + 2, y + 2, 1, 1, RD0); R(c, x - 1, y + 3, 5, 1, b ? SE3 : WH); R(c, x, y + 4, 3, 1, SE1); }
      // a little fish leaping now and then
      { const k = Math.floor(t / 9), ph = (t % 9) / 1.1;
        if (ph < 1) {
          const fx = 70 + Math.floor(h2(k, 3) * 90), fy = 77 + Math.floor(h2(k, 4) * 5), x = fx + Math.round(ph * 9), y = fy - Math.round(Math.sin(Math.PI * ph) * 8);
          if (ph > .1 && ph < .92) { if (ph < .5) { R(c, x, y, 3, 1, OR); R(c, x - 1, y + 1, 1, 1, RD); R(c, x + 2, y - 1, 1, 1, OR); } else { R(c, x, y, 3, 1, OR); R(c, x - 1, y - 1, 1, 1, RD); R(c, x + 2, y + 1, 1, 1, OR); } }
          if (ph < .3) { R(c, fx - 1, fy, 1, 1, WH); R(c, fx + 2, fy, 1, 1, WH); R(c, fx, fy - 1 - Math.round(ph * 6), 1, 1, WH); }
          if (ph > .8) { R(c, fx + 7, fy, 1, 1, WH); R(c, fx + 11, fy, 1, 1, WH); R(c, fx + 9, fy - Math.round((ph - .8) * 15), 1, 1, WH); R(c, fx + 8, fy + 1, 3, 1, SE4); }
        } }
      // sea sparkles
      for (let i = 0; i < 18; i++) {
        const cyc = t * .55 + i * .383, n = Math.floor(cyc), f = cyc - n;
        if (f < .45) continue;
        const x = Math.floor(h2(i, n) * W), y = 61 + Math.floor(h2(i + 50, n) * 24);
        if (y >= shore(x) - 3 || g.occ[y * W + x]) continue;
        const a = (f - .45) / .55;
        if (y > 68 && a > .35 && a < .7) { R(c, x - 1, y, 3, 1, WH); R(c, x, y - 1, 1, 3, WH); if (y > 76) { R(c, x - 2, y, 1, 1, SE4); R(c, x + 2, y, 1, 1, SE4); } }
        else R(c, x, y, 1, 1, a < .2 || a > .85 ? SE4 : WH);
      }
      // waves: incoming crest, swash with a foam line, spray on the little rock
      const ws = waveState(t);
      if (ws.tau < .5) {
        const q = ws.tau / .5;
        for (let x = 0; x < W; x += 2) {
          if (h2(x >> 3, ws.n + 77) < .5 - q * .6) continue;
          const yc = shore(x) - 2 - Math.round((1 - q) * (1 - q) * 12 + Math.sin(x * .07 + ws.n) * .6);
          mR(c, x, yc, 2, 1, q > .45 ? WH : SE4); mR(c, x, yc + 1, 2, 1, SE2);
        }
      }
      if (ws.e > 0) {
        for (let x = 0; x < W; x += 2) {
          const sh = shore(x), fy = front(x, ws);
          if (fy >= sh) mR(c, x, sh - 1, 2, fy - sh + 1, SE4);
          const gone = ws.back && h2(x >> 1, ws.wn) < (1 - ws.e) * 1.4;
          if (!gone) mR(c, x, fy, 2, 1, WH);
          if (!ws.back && fy - 1 >= sh && (x >> 1) % 3 === 0) mR(c, x, fy - 1, 1, 1, WH);
        }
      }
      if (ws.tau >= .46 && ws.tau < .8) {
        const k = (ws.tau - .46) / .34;
        for (let i = 0; i < 10; i++) {
          const sx = 195 + Math.floor(h2(i, ws.n) * 12), hgt = Math.sin(Math.PI * k) * (2 + h2(i + 20, ws.n) * 8) * (i % 2 ? 1 : .6);
          R(c, sx + Math.round((h2(i + 40, ws.n) - .5) * 6 * k), 89 - Math.round(hgt), 1, 1, i % 3 ? WH : SE4);
        }
      }
      // foam ring pulsing around the little surf rocks
      for (const [x0, y0] of g.surf.pos) {
        const ph = (Math.floor(t * 3) + x0) & 1;
        if (ws.e > .12) { mR(c, x0 - 1, y0 + 1 + ph, 1, 2, WH); mR(c, x0 + 5, y0 + 2 - ph, 1, 2, WH); mR(c, x0 - 1 + ph, y0 + 4, 6, 1, WH); mR(c, x0 + 1, y0 - 1, 2 + ph, 1, SE4); }
        else { R(c, x0 - 1, y0 + 3, 1, 1, ph ? WH : SE4); R(c, x0 + 5, y0 + 3, 1, 1, ph ? SE4 : WH); }
        if (ws.tau > .38 && ws.tau < .5) { R(c, x0 + 1, y0 - 2 - ph, 1, 1, WH); R(c, x0 + 3, y0 - 1 - ph, 1, 1, WH); }
      }
      // tide pool shimmer, anemone tentacles, seaweed sway
      for (let i = 0; i < 7; i++) {
        const x = POOL.cx - 18 + Math.floor((t * 3.2 + i * 6.1) % 36), y = 138 + (i * 2) % 6;
        if (inPool(x, y) && inPool(x + 1, y)) R(c, x, y, (i & 1) + 1, 1, (Math.floor(t * 3 + i) % 3) ? WH : SE4);
      }
      for (let i = 0; i < 3; i++) { const sw = Math.round(Math.sin(t * 2.2 + i * 1.3) * .8); R(c, POOL.cx + 11 + i + sw, POOL.cy - 2 + (i === 1 ? -1 : 0), 1, 1, i === 1 ? S0 : PK); }
      { const sw = Math.round(Math.sin(t * 1.7)); R(c, POOL.cx + 4 + sw, POOL.cy - 2, 1, 1, G3); }
      // crab scuttling sideways between the starfish and the log
      { const cyc = t % 7; let off, mv;
        if (cyc < 1) { off = cyc * 5; mv = 1; } else if (cyc < 3.5) { off = 5; mv = 0; } else if (cyc < 4.5) { off = 5 - (cyc - 3.5) * 5; mv = 1; } else { off = 0; mv = 0; }
        const x = 116 + Math.round(off), y = 139;
        const fr = mv ? (Math.floor(t * 12) % 2) : (Math.floor(t * 1.5) % 4 === 0 ? 2 : 0);
        R(c, x + 2, y + 6, 7, 1, WS);
        spr(c, x, y, CRAB[fr], { o: RD0, r: RD, l: OR, k: K0 }); }
    },
    glow(c, t) {
      const g = geo();
      // crescent moon (outside the UI band) and a few twinkling stars
      for (let j = 0; j < MOONSPR.length; j++) for (let i = 0; i < 7; i++) { const ch = MOONSPR[j][i]; if (ch !== '.') R(c, 200 + i, 29 + j, 1, 1, ch === 'M' ? MOON : MOONB); }
      for (let i = 0; i < 22; i++) {
        const x = Math.floor(h2(i, 77) * W), y = 2 + Math.floor(h2(i, 78) * 44);
        if ((x >= 64 && x <= 176 && y >= 3 && y <= 27) || (x > 194 && x < 212 && y > 24 && y < 40) || (x > 118 && x < 180 && y > 34) || g.occ[y * W + x]) continue;
        const s = h2(i, Math.floor(t * 1.3 + i * .37));
        if (s < .18) continue;
        if (s > .9) { mrow(c, x - 1, y, 3, MOONB); mrow(c, x, y - 1, 1, MOONB); mrow(c, x, y + 1, 1, MOONB); mrow(c, x, y, 1, WH); }
        else mrow(c, x, y, 1, s > .55 ? WH : MOONB);
      }
      // moon path on the far sea, widening toward the shore
      for (let y = 61; y < 70; y++) {
        const slot = Math.floor(t * 2.5 + y * .7);
        if (y < 63) { if (h2(y, slot) < .25) continue; mrow(c, 202 + Math.floor(h2(y + 7, slot) * 3), y, 1 + (h2(y + 99, slot) > .5 ? 1 : 0), MOONB); continue; }
        // each row = broken glints (dashes with dark gaps), bright in the middle, ragged and bluish at the ends
        const d = (y - 62) / 7, w = Math.round(3 + d * 6 * (.75 + h2(y + 99, slot) * .25));
        const x0 = 203 - (w >> 1) + Math.round((h2(y + 7, slot) - .5) * 2);
        for (let x = x0, s = 0; x < x0 + w; s++) {
          const len = 1 + Math.floor(h2(x + s, slot + y) * (1 + d * 3)), mid = Math.abs(x + len / 2 - 203.5) < w / 4;
          mrow(c, x, y, Math.min(len, x0 + w - x), mid ? MOON : MOONB);
          x += len + 1 + (h2(x, slot + 11) < .3 ? 1 : 0);
        }
        if (y > 63 && h2(y + 31, slot) > .55) mrow(c, x0 + w + 2 + Math.floor(h2(y, slot + 3) * 3), y, 1 + (y & 1), MOONB);
        if (y > 64 && h2(y + 53, slot) > .6) mrow(c, x0 - 4 - Math.floor(h2(y, slot + 5) * 3), y, 2, MOONB);
      }
      // starlight glints on the far sea
      for (let i = 0; i < 6; i++) { const n = Math.floor(t * .7 + i * .3); if (h2(i, n) < .4) continue; mrow(c, Math.floor(h2(i + 3, n) * W), 62 + Math.floor(h2(i + 5, n) * 6), 1, MOONB); }
      // lighthouse lamp blinking with a short beam
      const on = (t % 2.4) < 1.1;
      R(c, 167, 40, 1, 2, on ? LAMP : W2);
      if (on) {
        const sw = Math.floor(t * 4) % 2;
        for (let k = 1; k <= 6; k++) { const y = 40 + (k > 3 ? 1 : 0), col = k < 3 ? LAMP : MOONB; R(c, 167 - k * 3 - sw, y, 2, 1, col); R(c, 168 + k * 3 + sw, y, 2, 1, col); }
        R(c, 166, 39, 3, 1, LAMP); R(c, 166, 42, 3, 1, LAMP);
      }
      // keeper's window + masthead light on the sailboat
      R(c, 158, 50, 1, 1, LAMP);
      if ((t % 1.6) < 1.2) R(c, 100, 55 + boatBob(t), 1, 1, LAMP);
      // bioluminescent specks drifting in the tide pool
      for (let i = 0; i < 12; i++) {
        const cyc = t * .8 + i * .41, n = Math.floor(cyc), f = cyc - n;
        const x = POOL.cx - 18 + Math.floor(h2(i, n) * 36) + Math.round(Math.sin(t + i)), y = 137 + Math.floor(h2(i + 9, n) * 8);
        if (!inPool(x, y) || f > .8) continue;
        R(c, x, y, 1, 1, f > .3 && f < .55 ? SK3 : BIO);
      }
      // plankton stranded on the damp sand around the pool, pulsing slowly
      for (let i = 0; i < 7; i++) {
        const a = i * .9 + 2.2, x = POOL.cx + Math.round(Math.cos(a) * (POOL.rx + 2)), y = Math.min(groundBottom(x) - 2, POOL.cy + 1 + Math.round(Math.sin(a) * (POOL.ry + 1)));
        const p = (t * .9 + i * .37) % 1; if (p > .55) continue;
        R(c, x, y, 1, 1, p > .2 && p < .35 ? SK3 : BIO);
      }
      // glowing anemone tip and moon glints on the wet shells in front
      if (Math.floor(t * 2) % 3) R(c, POOL.cx + 12, POOL.cy - 3, 1, 1, PK);
      for (const [x, y, p] of [[200, 138, 0], [111, 146, 1], [188, 140, 2], [100, 141, 3]]) if ((Math.floor(t * 1.5) + p) % 4 === 0) R(c, x, y, 1, 1, MOONB);
    },
  };
})();
