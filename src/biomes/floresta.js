BIOMES.floresta = (() => {
  /* ═══ Palette — GBA FireRed look: soft saturated ramps, cooler shadows, warmer highlights ═══ */
  const PAL = [
    '#70b0f0', '#98d0f8', '#c4e8f8', '#f8f8f8', '#d0e4f4',             // 0-4  sky ramp, white, cloud shade
    '#b4dcc8', '#90c4ac', '#72aa98',                                     // 5-7  far hills / far tree line (hazy)
    '#5aa870', '#3c885a',                                                // 8-9  mid tree line
    '#d0f088', '#98d860', '#68b848', '#44943c', '#2c6c3c', '#1c4838',    // 10-15 foliage + moss ramp
    '#c8945c', '#9a6a42', '#6c4632', '#46282c', '#f0dcaa',               // 16-20 bark ramp, pale wood
    '#58a8d8', '#3270a8',                                                // 21-22 water
    '#a8acc0', '#6c6c88',                                                // 23-24 stone
    '#f8a0c0', '#d05890', '#f8d840', '#7898f0', '#b088e0', '#e88830',    // 25-30 flowers / accents
  ];
  const SKY0 = 0, SKY1 = 1, SKY2 = 2, WHT = 3, CLD = 4, FAR0 = 5, FAR1 = 6, FAR2 = 7, MID0 = 8, MID1 = 9,
    G0 = 10, G1 = 11, G2 = 12, G3 = 13, G4 = 14, G5 = 15, B0 = 16, B1 = 17, B2 = 18, B3 = 19, WOOD = 20,
    WAT1 = 21, WAT2 = 22, ST1 = 23, ST2 = 24, PINK = 25, PINKD = 26, YEL = 27, BLUE = 28, PURP = 29, ORNG = 30;
  /* the diorama edge reuses the bark ramp: only three extra darks, 34 colours on screen in total */
  const SOILD = '#38201e', BACK0 = '#2a1c26', BACK1 = '#160f18';
  const PAL_EDGE = { soil: [PAL[B2], PAL[B2], PAL[B3], SOILD], rim: [PAL[B1], PAL[B2], BACK0], back: [BACK0, BACK1] };

  const DARK = PAL.map((_, i) => i), LITE = PAL.map((_, i) => i);
  [[G0, G1], [G1, G2], [G2, G3], [G3, G4], [G4, G5], [B0, B1], [B1, B2], [B2, B3], [WOOD, B0], [WHT, CLD], [CLD, ST1], [ST1, ST2],
    [SKY2, SKY1], [SKY1, WAT1], [WAT1, WAT2], [PINK, PINKD], [YEL, ORNG], [MID0, MID1], [FAR0, FAR1], [FAR1, FAR2], [BLUE, PURP]]
    .forEach(([a, b]) => { DARK[a] = b; if (LITE[b] === b) LITE[b] = a; });
  /* foliage ramps: [highlight, lv0, lv1, lv2, lv3, darkest shade / default outline] */
  const RAMP_G = [G0, G1, G2, G3, G4, G5], RAMP_M = [FAR0, FAR1, MID0, MID1, MID1, MID1];

  /* ownership tags in the private frame buffer */
  const O_SKY = 1, O_CLOUD = 2, O_FAR = 3, O_MID = 4, O_GROUND = 6, O_TRUNK = 7, O_PROP = 8, O_WATER = 9, O_CANOPY = 20;

  /* ═══ shared geometry (bg + anim + glow) ═══ */
  const POND = { cx: 68, cy: 142, rx: 21, ryT: 5, ryB: 4 };   // water rows 137..146 (far half 5 rows, near half 4)
  const SHROOM_SPOTS = [], STARS = [], RIM = [];
  const SWAY = [                           // tall blades whose tips sway in anim (bg draws all but the top 4 px)
    { x: 4, yb: 131, h: 19, lean: -1.2 }, { x: 9, yb: 132, h: 24, lean: .6 }, { x: 14, yb: 134, h: 16, lean: 1 },
    { x: 225, yb: 135, h: 21, lean: -.4 }, { x: 233, yb: 132, h: 25, lean: -.2 }, { x: 238, yb: 131, h: 19, lean: -.4 },
  ];
  const bladeX = (b, k) => b.x + Math.round(b.lean * (k / b.h) * (k / b.h) * 3);
  /* where a sprite can stand: glow() draws after the sprites, so only dim 1px lights are allowed in here */
  const BODY = (x, y) => x >= 24 && x <= 216 && y >= 68 && y <= 135;

  /* ═══ tiny math ═══ */
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => (BAY[((y & 3) << 2) | (x & 3)] + .5) / 16;
  const bay2 = (x, y) => [.125, .625, .875, .375][((y & 1) << 1) | (x & 1)];
  function hh(a, b, s) { let n = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
  function vn(x, y, s) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hh(ix, iy, s), b = hh(ix + 1, iy, s), c = hh(ix, iy + 1, s), d = hh(ix + 1, iy + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  /* ═══ private indexed frame buffer, flushed with run-length fillRects ═══ */
  let buf = null, own = null, GB = null, GT = null, skyRows = null, waterRows = null, clipLane = false;
  const ok = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
  const lane = (x, y) => x >= 20 && x <= 220 && y >= 100 && y <= 134;
  /* while clipLane is on (trees, tall props), nothing can leak into the walk lane */
  function set(x, y, col, o) { if (!ok(x, y) || y >= GB[x] || (clipLane && lane(x, y))) return; const i = y * W + x; buf[i] = col; if (o) own[i] = o; }
  const get = (x, y) => ok(x, y) ? buf[y * W + x] : 255;
  const ownAt = (x, y) => ok(x, y) ? own[y * W + x] : 0;
  function rect(x, y, w, h, col, o) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, col, o); }
  const half = (rx, ry, dy) => ry <= 0 ? rx : Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / (ry + .5)) ** 2)));
  function ell(cx, cy, rx, ry, col, o) { for (let dy = -ry; dy <= ry; dy++) { const h = half(rx, ry, dy); for (let dx = -h; dx <= h; dx++) set(cx + dx, cy + dy, col, o); } }
  function darken(x, y, onlyO) { if (!ok(x, y) || y >= GB[x]) return; const i = y * W + x; if (onlyO && own[i] !== onlyO) return; buf[i] = DARK[buf[i]]; }
  function shadowEll(cx, cy, rx, ry, onlyO, soft) {
    for (let dy = -ry; dy <= ry; dy++) {
      const h = half(rx, ry, dy);
      for (let dx = -h; dx <= h; dx++) {
        const e = (dx / (rx + .5)) ** 2 + (dy / (ry + .5)) ** 2;
        if (soft && e > .45 && bay(cx + dx, cy + dy) < (e - .45) / .55) continue;
        darken(cx + dx, cy + dy, onlyO);
      }
    }
  }
  function spr(rows, x, y, map, o) { for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const ch = rows[j][i]; if (ch !== '.') set(x + i, y + j, map[ch], o || O_PROP); } }
  function flush(c) {
    for (let y = 0; y < H; y++) {
      let x0 = 0, cur = buf[y * W];
      for (let x = 1; x <= W; x++) {
        const v = x < W ? buf[y * W + x] : -1;
        if (v !== cur) { if (cur !== 255) R(c, x0, y, x - x0, 1, PAL[cur]); x0 = x; cur = v; }
      }
    }
  }

  /* thick organic limb (branch / root): outline pass, then a fill shaded for light from the top-left.
     The outline never overwrites pixels the same owner already has (so roots and branches merge into the trunk);
     `bare` > 0 fades the outline out over the thin end, so tips taper to a clean 1px point. */
  function limb(pts, r0, r1, o, outline = B3, bare = 0) {
    const segs = []; let L = 0;
    for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(l); L += l; }
    for (const pass of [0, 1]) {
      let acc = 0;
      for (let i = 1; i < pts.length; i++) {
        const n = Math.max(1, Math.ceil(segs[i - 1] * 2));
        for (let k = 0; k <= n; k++) {
          const t = k / n, x = Math.round(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t), y = Math.round(pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t);
          const r = r0 + (r1 - r0) * ((acc + segs[i - 1] * t) / L);
          const rr = pass ? r : r + (bare ? Math.max(0, Math.min(1, (r - r1) / bare)) : 1), R2 = rr * rr + rr * .6, ri = Math.ceil(rr);
          for (let dy = -ri; dy <= ri; dy++) for (let dx = -ri; dx <= ri; dx++) {
            if (dx * dx + dy * dy > R2) continue;
            if (!pass) { if (ownAt(x + dx, y + dy) !== o) set(x + dx, y + dy, outline, o); continue; }
            const s = (dx + dy * 1.4) / Math.max(1, r);
            set(x + dx, y + dy, s < -.6 ? B0 : s > .7 ? B2 : B1, o);
          }
        }
        acc += segs[i - 1];
      }
    }
  }

  /* leaf-scale foliage clump: pointed leaves drawn bottom→top so upper leaves overlap (and shade) lower ones,
     lit per clump from the top-left; outline only against the background, soft shade where it overlaps an older clump.
     opt.tips: bright leaf tips (only the clusters that face the sun); opt.ol: outline colour (aerial perspective) */
  const LEAF_L = [[1, 4], [0, 6], [0, 6], [1, 4], [2, 2]], LEAF_S = [[1, 2], [0, 4], [0, 4], [1, 2]];
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function clump(cx, cy, rx, ry, id, opt = {}) {
    const small = opt.small, ramp = opt.ramp || RAMP_G, bias = opt.bias || 0, shift = opt.shift || 0, tips = opt.tips;
    const sh = small ? LEAF_S : LEAF_L, sw = small ? 4 : 6, sx = small ? 3 : 5, sy = small ? 2 : 3;
    const rows = []; for (let gy = cy - ry - 2; gy <= cy + ry - 2; gy += sy) rows.push(gy);
    ell(cx, cy, Math.max(1, rx - 2), Math.max(1, ry - 2), ramp[4], id);          // dark core seen through gaps between leaves
    for (let ri = rows.length - 1; ri >= 0; ri--) {
      for (let gx0 = cx - rx - sw + ((ri & 1) ? sx >> 1 : 0); gx0 <= cx + rx; gx0 += sx) {
        const j = hh(gx0, rows[ri], id * 13 + 1), gx = gx0 + (j < .2 ? -1 : j > .8 ? 1 : 0), gy = rows[ri] + (hh(gx0, rows[ri], id) < .25 ? 1 : 0);
        const lx = gx + (sw >> 1), ly = gy + 2, nx = (lx - cx) / rx, ny = (ly - cy) / ry, d = nx * nx + ny * ny;
        if (d > 1.04 + (j - .5) * .3) continue;
        const l = -(nx * .55 + ny * .85) - d * .3 + bias + (hh(gx, gy, 3) - .5) * .5;
        const lv = Math.max(0, Math.min(3, (l > .38 ? 0 : l > -.12 ? 1 : l > -.6 ? 2 : 3) + shift));
        const base = ramp[1 + lv], shade = ramp[Math.min(5, 2 + lv)], hi = ramp[lv];
        stamp(sh, gx, gy, base, id);
        const under = small ? [[0, 3], [3, 3], [1, 4], [2, 4]] : [[1, 4], [4, 4], [2, 5], [3, 5], [0, 3], [5, 3]];
        for (const [ux, uy] of under) if (ownAt(gx + ux, gy + uy) === id && get(gx + ux, gy + uy) !== base) set(gx + ux, gy + uy, shade);
        set(gx + 1, gy + 1, hi);
        if (lv === 0 && (tips || small)) { set(gx + 2, gy + 1, hi); if (!small) set(gx + 1, gy + 2, hi); }
        if (lv === 0 && tips && !small && j > .6) set(gx + 2, gy, ramp[0]);
      }
    }
    const ed = [], sh2 = new Set();
    for (let y = Math.max(0, cy - ry - 6); y <= Math.min(H - 1, cy + ry + 6); y++) for (let x = Math.max(0, cx - rx - 8); x <= Math.min(W - 1, cx + rx + 8); x++) {
      if (own[y * W + x] !== id) continue;
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy; if (!ok(nx, ny)) continue;
        const o = own[ny * W + nx]; if (o === id) continue;
        if (o >= O_CANOPY) sh2.add(ny * W + nx); else { ed.push(y * W + x); break; }
      }
    }
    for (const i of sh2) { const v = buf[i]; const k = ramp.indexOf(v); buf[i] = k >= 0 ? ramp[Math.min(5, k + 1)] : DARK[v]; }
    if (!opt.noOutline) for (const i of ed) buf[i] = opt.ol != null ? opt.ol : ramp[5];
  }
  function stamp(sh, x, y, col, o) { for (let r = 0; r < sh.length; r++) { const [ox, w] = sh[r]; for (let i = 0; i < w; i++) set(x + ox + i, y + r, col, o); } }
  let nextId = O_CANOPY;
  const clumps = (list, opt) => list.forEach(([cx, cy, rx, ry, bias]) => clump(cx, cy, rx, ry, nextId++, { ...opt, bias: (opt && opt.bias || 0) + (bias || 0) }));

  /* ═══ sky & distance ═══ */
  function sky() {
    for (let y = 0; y < 104; y++) for (let x = 0; x < W; x++) {
      let col = SKY2;
      if (y < 20) col = SKY0;
      else if (y < 25) col = bay2(x, y) < (y - 19) / 6 ? SKY1 : SKY0;
      else if (y < 44) col = SKY1;
      else if (y < 49) col = bay2(x, y) < (y - 43) / 6 ? SKY2 : SKY1;
      set(x, y, col, O_SKY);
    }
  }
  function cloud(puffs, base) {
    const m = new Set();
    for (const [cx, cy, rx, ry] of puffs) for (let dy = -ry; dy <= ry; dy++) {
      const y = cy + dy; if (y > base || y < 0) continue; const h = half(rx, ry, dy);
      for (let dx = -h; dx <= h; dx++) { const x = cx + dx; if (x >= 0 && x < W) m.add(y * W + x); }
    }
    const inM = (x, y) => m.has(y * W + x);
    for (const k of m) {
      const x = k % W, y = (k / W) | 0; if (own[k] !== O_SKY && own[k] !== O_CLOUD) continue;
      let col = WHT;
      if (!inM(x, y + 1)) col = SKY2;
      else if (!inM(x, y + 2) || (!inM(x, y + 3) && ((x + y) & 1))) col = CLD;
      else if (!inM(x + 1, y) || !inM(x + 2, y + 1)) col = CLD;
      set(x, y, col, O_CLOUD);
    }
  }
  const hillTop = x => Math.round(61 + 4 * Math.sin(x * .031 + .4) + 3 * Math.sin(x * .083 + 2.2) + 1.2 * Math.sin(x * .19));
  /* far layers use hashes, not rnd: the sky silhouette must be rebuildable without the caller's seed */
  function farLayers() {
    for (let x = 0; x < W; x++) { const t = hillTop(x); set(x, t, SKY2, O_FAR); for (let y = t + 1; y < 104; y++) set(x, y, FAR0, O_FAR); }
    // forest fuzz on the far hills: a soft bumpy band of tiny crowns
    for (let x = -2, i = 0; x < W + 2; x += 3, i++) { const t = hillTop(x) + 4 + Math.floor(hh(i, 1, 91) * 2); ell(x, t, 2, 1, FAR1, O_FAR); rect(x - 2, t + 1, 5, 104 - t, FAR1, O_FAR); }
    // far tree line: rounded hazy crowns with a small lit cap on the top-left
    let x = -6, i = 0;
    while (x < W + 8) {
      const r = 5 + Math.floor(hh(i, 2, 92) * 4), ry = r - 1, top = 70 + Math.floor(hh(i, 3, 92) * 5), cy = top + ry;
      rect(x - r, cy, 2 * r + 1, 104 - cy, FAR2, O_FAR);
      ell(x + 1, cy + 1, r, ry, FAR2, O_FAR);
      ell(x, cy, r, ry, FAR1, O_FAR);
      for (let dy = -ry; dy <= -ry + 2; dy++) { const h = half(r, ry, dy); for (let dx = -h; dx <= -h + Math.round(h * (dy === -ry + 2 ? .5 : .9)); dx++) set(x + dx, cy + dy, FAR0, O_FAR); }
      x += r + 1 + Math.floor(hh(i, 4, 92) * 4); i++;
    }
    // two taller hazy trees rising out of the mid tree line (pale outline: they sit in the haze)
    for (const tx of [98, 157]) {
      rect(tx, 72, 1, 32, FAR2, O_MID); rect(tx + 1, 72, 1, 32, MID0, O_MID);
      clumps([[tx, 68, 9, 6, .3], [tx - 7, 74, 7, 5, .15], [tx + 7, 75, 7, 5, .1]], { small: true, ramp: RAMP_M, ol: FAR2 });
    }
    // mid tree line: small-leaf clumps over a dark under-canopy (MID1 only in the gaps) with hazy trunks
    x = -4; i = 0; const crowns = [];
    while (x < W + 10) { const r = 8 + Math.floor(hh(i, 5, 93) * 4), top = 78 + Math.floor(hh(i, 6, 93) * 6); crowns.push([x, top + r - 2, r, r - 3]); x += r + 3 + Math.floor(hh(i, 7, 93) * 5); i++; }
    for (const [cx, cy, r] of crowns) { rect(cx - r + 3, cy, 2 * r - 5, 104 - cy, MID1, O_MID); rect(cx, cy + 2, 1, 104 - cy, FAR2, O_MID); rect(cx + 1, cy + 2, 1, 104 - cy, MID0, O_MID); }
    clumps(crowns.map(([a, b, c2, d]) => [a, b, c2, d, .2]), { small: true, ramp: RAMP_M, ol: MID0 });
  }

  /* ═══ meadow ═══ */
  function ground() {
    for (let x = 0; x < W; x++) {
      GT[x] = 97 + Math.round(Math.sin(x * .09 + 1) * .8 + Math.sin(x * .21) * .6);
      for (let y = GT[x]; y < GB[x]; y++) {
        const d = y - 62, X = (x - 120) / d, Z = 200 / d;
        let n = vn(X * 4.2, Z * 1.25, 11) * .72 + vn(X * 11, Z * 3.4, 29) * .28;
        const sx = (x - 124) / 96, sy = (y - 112) / 24; n += .12 * Math.max(0, 1 - sx * sx - sy * sy);   // sunlit patch mid-meadow, not under the feet
        n -= Math.max(0, GT[x] + 8 - y) * .03;
        n += (bay(x, y) - .5) * .1;
        set(x, y, n > .64 ? G1 : n > .34 ? G2 : n > .15 ? G3 : G4, O_GROUND);
      }
    }
  }
  /* faint trodden path along the walk line (the FireRed "route" cue): calm G2/G1 dither, earth specks, worn dashes */
  const pathC = x => 133 + Math.round(Math.sin(x * .031 + .9) * .9);
  function pathW(x, y) {
    const d = Math.abs(y - pathC(x)), e = d <= 2 ? 1 : d === 3 ? .5 : d === 4 ? .2 : 0;
    return e * Math.max(0, Math.min(1, (x - 8) / 22, (232 - x) / 22));
  }
  function path() {
    for (let x = 0; x < W; x++) for (let y = pathC(x) - 4; y <= pathC(x) + 4; y++) {
      if (ownAt(x, y) !== O_GROUND || y >= GB[x] - 1) continue;
      const w = pathW(x, y); if (w <= 0 || bay(x, y) >= w) continue;
      const n = vn(x * .19, y * .6, 73) + (bay(x + 2, y + 1) - .5) * .4;
      set(x, y, n > .6 ? G1 : G2);
    }
    for (let i = 0; i < 90; i++) {
      const x = 12 + Math.floor(hh(i, 1, 75) * 216), y = pathC(x) - 3 + Math.floor(hh(i, 2, 75) * 7);
      if (pathW(x, y) < .45 || ownAt(x, y) !== O_GROUND || ownAt(x + 1, y) !== O_GROUND) continue;
      if (i % 5 === 0) { set(x, y, B0); if (hh(i, 3, 75) < .4) set(x + 1, y, B1); }        // bare earth showing through
      else if (i % 5 < 3) { set(x, y, G3); set(x + 1, y, G3); }                            // worn grass dashes
    }
  }
  function groundDetails(rnd) {
    for (let i = 0; i < 460; i++) {                        // grass tufts, bigger toward the viewer
      const x = Math.floor(rnd() * (W - 3)), y = GT[x] + 2 + Math.floor(rnd() * (GB[x] - GT[x] - 3));
      if (ownAt(x, y) !== O_GROUND) continue;
      if (pathW(x, y) > .45 && rnd() < .85) continue;
      const s = (y - 62) / 72, cur = get(x, y), dk = DARK[cur], lt = LITE[cur], lane = y <= 135 && x >= 20 && x <= 220;
      if (s < .6) set(x, y, rnd() < .7 ? dk : lt);
      else if (s < .97 || lane) { if (lane && rnd() < .35) continue; set(x, y - 1, dk); set(x + 1, y, dk); set(x + 2, y - 1, dk); }
      else { set(x, y - 1, dk); set(x + 1, y - 2, dk); set(x + 1, y - 1, dk); set(x + 2, y - 1, dk); set(x + 1, y - 3, lt); set(x + 3, y - 2, dk); }
    }
    for (let i = 0; i < 70; i++) {                         // leaf-scale moss arcs (outside the walk lane)
      const x = Math.floor(rnd() * (W - 4)), y = GT[x] + 1 + Math.floor(rnd() * (GB[x] - GT[x] - 2));
      if (y <= 137 && y > GT[x] + 6 && x > 22 && x < 218) continue;
      if (ownAt(x, y) !== O_GROUND || ownAt(x + 3, y) !== O_GROUND) continue;
      const dk = DARK[get(x + 1, y)]; set(x, y - 1, dk); set(x + 1, y, dk); set(x + 2, y, dk); set(x + 3, y - 1, dk); set(x + 1, y - 1, LITE[get(x + 1, y - 1)]);
    }
    for (let p = 0; p < 10; p++) {                         // clover patches
      const x0 = 24 + Math.floor(rnd() * 190), y0 = 104 + Math.floor(rnd() * 40), n = 3 + Math.floor(rnd() * 4), s = (y0 - 62) / 72;
      for (let k = 0; k < n; k++) {
        const x = x0 + Math.round((rnd() * 2 - 1) * 7 * s), y = y0 + Math.round((rnd() * 2 - 1) * 2 * s);
        if (ownAt(x, y) !== O_GROUND || pathW(x, y) > .3) continue;
        set(x - 1, y, G1); set(x + 1, y, G1); set(x, y - 1, G1); set(x, y, G3); set(x, y + 1, G3); if (s > .9) set(x - 1, y - 1, G0);
      }
    }
    for (let p = 0; p < 15; p++) {                         // tiny flowers in drifts
      const x0 = 20 + Math.floor(rnd() * 200), y0 = 101 + Math.floor(rnd() * 46), n = 2 + Math.floor(rnd() * 4), col = [WHT, YEL, PINK, WHT, BLUE][p % 5];
      for (let k = 0; k < n; k++) {
        const x = x0 + Math.floor(rnd() * 9) - 4, y = y0 + Math.floor(rnd() * 3) - 1;
        if (ownAt(x, y) !== O_GROUND || ownAt(x, y + 1) !== O_GROUND || pathW(x, y) > .3) continue;
        set(x, y, col); set(x, y + 1, G3); if (y > 120 && k === 0) { set(x - 1, y, col); set(x + 1, y, col); set(x, y - 1, col); set(x, y, YEL === col ? ORNG : YEL); }
      }
    }
    for (let p = 0; p < 10; p++) {                         // pebbles
      const x = 22 + Math.floor(rnd() * 196), y = 102 + Math.floor(rnd() * 44);
      if (ownAt(x, y) !== O_GROUND || ownAt(x + 1, y + 1) !== O_GROUND) continue;
      set(x, y, CLD); set(x + 1, y, ST1); set(x, y + 1, ST2); set(x + 1, y + 1, ST2); darken(x + 2, y + 1, O_GROUND);
    }
  }
  function backFringe(rnd) {
    for (let x = 0; x < W; x++) {                           // contact shadow + grass fringe where the meadow meets the woods
      let y = 80; while (y < 110 && ownAt(x, y) !== O_GROUND) y++;
      if (y >= 110) continue;
      darken(x, y, O_GROUND); darken(x, y + 1, O_GROUND); if (bay(x, y + 2) < .5) darken(x, y + 2, O_GROUND);
      if (rnd() < .6) { const h = 1 + Math.floor(rnd() * 4); for (let k = 1; k <= h; k++) set(x, y - k + 1, k === h ? G2 : G3); }
    }
  }

  /* ═══ small shared props ═══ */
  const TUFT_S = ['.1.1.', '12121', '23332'], TUFT_B = ['1...1', '.1.1.', '12121', '23332'];
  function tuft(x, yb, big) { const s = big ? TUFT_B : TUFT_S; spr(s, x - 2, yb - s.length + 1, { 1: G1, 2: G2, 3: G3 }); }
  /* moss on the top edge of a limb (first pixel of owner o from the top in each column) */
  function mossRun(x0, x1, ymin, ymax, o) {
    for (let x = x0; x <= x1; x++) for (let y = ymin; y <= ymax; y++) if (ownAt(x, y) === o) { set(x, y, x === x0 || x === x1 ? G2 : G1); set(x, y + 1, G2); break; }
  }

  /* ═══ trees ═══ */
  /* dark underside where a canopy meets its trunk: bottom leaves to G4, cast shadow on the bark below */
  function canopyShade(x0, x1) {
    for (let x = x0; x <= x1; x++) {
      let yb = -1;
      for (let y = 64; y >= 30; y--) if (ownAt(x, y) >= O_CANOPY) { yb = y; break; }
      if (yb < 0) continue;
      for (let k = 1; k <= 3; k++) { const y = yb - k, v = get(x, y); if (ownAt(x, y) >= O_CANOPY && v >= G0 && v < G4 && (k < 3 || bay2(x, y) < .5)) set(x, y, G4); }
      for (let k = 1; k <= 3; k++) if (ownAt(x, yb + k) === O_TRUNK && (k < 3 || bay2(x, yb + k) < .5)) darken(x, yb + k, O_TRUNK);
    }
  }
  function heroTree() {
    const tx = y => 29 + (98 - y) * .1 + Math.sin(y * .13) * 1.2;
    const tw = y => 8 + (y - 46) * .06 + Math.max(0, y - 89) ** 2 * .14;
    limb([[30, 62], [19, 50], [8, 42]], 3, 1.5, O_TRUNK);
    limb([[33, 60], [46, 48], [60, 40]], 3, 1.5, O_TRUNK);
    limb([[31, 54], [34, 36], [36, 20]], 3, 1.5, O_TRUNK);
    for (let y = 44; y <= 98; y++) {
      const w = Math.round(tw(y)), l = Math.round(tx(y) - w / 2), r = l + w - 1;
      for (let x = l; x <= r; x++) {
        const f = (x - l + .5) / w;
        let col = f < .3 ? B0 : f < .7 ? B1 : B2;
        const g = Math.sin((x - tx(y)) * 1.3 + Math.sin(y * .29 + x * .7) * .7);
        if (g > .78 && hh(x, y >> 1, 5) > .2) col = DARK[col];
        else if (g < -.88 && f < .62 && hh(x, y, 6) > .4) col = LITE[col];
        if (x === l || x === r) col = B3;
        set(x, y, col, O_TRUNK);
      }
    }
    ell(33, 74, 1, 2, B3, O_TRUNK); set(32, 72, B2); set(34, 76, B0); set(33, 73, B2);    // knot hole
    // root flare: two main roots dive down into the moss, tapering to bare tips hidden under grass tufts
    limb([[24, 92], [18, 95], [12, 98]], 2.4, .5, O_TRUNK, B3, .8);
    limb([[34, 92], [42, 95], [50, 98]], 2.4, .5, O_TRUNK, B3, .8);
    limb([[27, 95], [25, 98]], 1.4, .5, O_TRUNK, B3, .6);
    limb([[32, 95], [35, 98]], 1.3, .5, O_TRUNK, B3, .6);
    mossRun(13, 15, 88, 99, O_TRUNK); mossRun(41, 43, 88, 99, O_TRUNK); mossRun(46, 47, 88, 99, O_TRUNK);
    tuft(11, 99, 1); tuft(50, 99, 1); tuft(25, 99, 0); tuft(36, 99, 0);
    shadowEll(31, 100, 30, 2, O_GROUND);
    // canopy: only the two sun-facing clusters get bright leaf tips; the lower clusters fall into shade
    clumps([[36, 6, 15, 9, .25], [18, 12, 13, 9, .2]], { tips: true });
    clumps([[52, 14, 10, 8, .15], [5, 20, 11, 10, .1], [28, 24, 15, 10, .1], [50, 29, 14, 9, 0], [10, 34, 13, 9, 0], [66, 38, 11, 8, -.05],
      [22, 44, 13, 8, -.45], [44, 45, 13, 7, -.45], [60, 47, 8, 5, -.45], [4, 46, 9, 7, -.45]]);
    canopyShade(18, 48);
  }
  function rightTree() {
    limb([[207, 60], [196, 50]], 1.6, 1, O_TRUNK); limb([[209, 58], [222, 47]], 1.6, 1, O_TRUNK);
    for (let y = 46; y <= 97; y++) {
      const cxT = 208 - (97 - y) * .06 + Math.sin(y * .15) * .6, w = Math.round(7 + (y - 46) * .03 + Math.max(0, y - 90) ** 2 * .16), l = Math.round(cxT - w / 2), r = l + w - 1;
      for (let x = l; x <= r; x++) {
        const f = (x - l + .5) / w; let col = f < .3 ? B0 : f < .7 ? B1 : B2;
        if (Math.sin((x - cxT) * 1.5 + Math.sin(y * .4 + x) * .8) > .8 && hh(x, y >> 1, 9) > .25) col = DARK[col];
        if (x === l || x === r) col = B3;
        set(x, y, col, O_TRUNK);
      }
    }
    limb([[203, 94], [198, 97], [194, 98]], 1.5, .5, O_TRUNK, B3, .6);
    limb([[214, 94], [219, 97], [223, 98]], 1.5, .5, O_TRUNK, B3, .6);
    tuft(194, 99, 0); tuft(223, 99, 0);
    shadowEll(209, 99, 18, 1, O_GROUND);
    clumps([[208, 24, 12, 8, .25]], { tips: true });
    clumps([[226, 28, 12, 9, .2], [192, 34, 11, 8, .1], [212, 38, 13, 9, .05], [234, 42, 9, 9, 0],
      [198, 52, 12, 7, -.3], [222, 54, 13, 7, -.35], [184, 50, 8, 6, -.3], [236, 58, 7, 6, -.35]]);
    canopyShade(200, 218);
  }
  function bushes() {
    clumps([[4, 90, 12, 8], [58, 93, 11, 5], [94, 95, 8, 3], [146, 95, 7, 3], [176, 92, 11, 6], [196, 91, 14, 7], [228, 88, 14, 10]], { small: true, shift: 1 });
    for (const [x, y] of [[188, 88], [194, 92], [201, 87], [222, 84], [231, 90], [9, 88], [55, 92]]) { set(x, y, WHT, O_PROP); set(x + 1, y, BLUE, O_PROP); set(x, y + 1, BLUE, O_PROP); set(x + 1, y + 1, WAT2, O_PROP); }
  }

  /* ═══ props ═══ */
  /* grass blade: 2px wide lit/shaded lower part, 1px tip, warm highlight on tall blades */
  const bladeCol = (b, k) => { const f = k / b.h; return f < .12 ? G4 : f < .55 ? G2 : f < .86 || b.h < 10 ? G1 : G0; };
  function blade(b, upto) {
    for (let k = 0; k < upto; k++) {
      const y = b.yb - k, x = bladeX(b, k), f = k / b.h;
      set(x, y, bladeCol(b, k), O_PROP);
      if (f < .55) set(x + 1, y, f < .12 ? G4 : G3, O_PROP);
    }
  }
  function tallGrass(x0, yb, n, hMin, hMax, rnd, xmin = -99, xmax = 999) {
    for (let i = 0; i < n; i++) {
      const x = Math.max(xmin, Math.min(xmax - 1, x0 + Math.round((i / Math.max(1, n - 1) - .5) * n * 1.2) + Math.floor(rnd() * 2))), h = hMin + Math.floor(rnd() * (hMax - hMin));
      let lean = ((i / Math.max(1, n - 1)) - .5) * 3.4 + (rnd() - .5);
      lean = Math.max((xmin - x) / 3, Math.min((xmax - 1 - x) / 3, lean));
      blade({ x, yb: yb + Math.floor(rnd() * 2), h, lean }, h);
    }
  }
  /* 3-tone stone with volume: ST2 outline + shadow side, ST1 face, CLD highlight on the top-left */
  function stone(x, y, rx, ry, moss, noShadow) {
    if (!noShadow) shadowEll(x + 1, y + ry, rx, 1, O_GROUND);
    const inS = (dx, dy) => Math.abs(dy) <= ry && Math.abs(dx) <= half(rx, ry, dy);
    for (let dy = -ry; dy <= ry; dy++) {
      const h = half(rx, ry, dy);
      for (let dx = -h; dx <= h; dx++) {
        const rim = !inS(dx - 1, dy) || !inS(dx + 1, dy) || !inS(dx, dy - 1) || !inS(dx, dy + 1);
        const l = -(dx / (rx + .5)) * .5 - dy / (ry + .5) + .1;
        set(x + dx, y + dy, rim ? ST2 : l > .45 ? CLD : l > -.2 ? ST1 : ST2, O_PROP);
      }
    }
    if (ry <= 1) set(x - half(rx, ry, -ry), y - ry, CLD, O_PROP);
    if (moss) { set(x + 1, y - ry, G2, O_PROP); set(x + 2, y - ry, G1, O_PROP); set(x + 2, y - ry + 1, G3, O_PROP); }
  }
  const pondHalf = dy => half(POND.rx, dy < 0 ? POND.ryT : POND.ryB, dy);
  function pond() {
    const { cx, cy, rx, ryT, ryB } = POND;
    // damp, darker moss around the water
    for (let dy = -ryT - 2; dy <= ryB + 2; dy++) {
      const ry = dy < 0 ? ryT + 2 : ryB + 2, h = half(rx + 4, ry, dy);
      for (let dx = -h; dx <= h; dx++) {
        const x = cx + dx, y = cy + dy, e = (dx / (rx + 4.5)) ** 2 + (dy / (ry + .5)) ** 2;
        if (e > .75 && bay(x, y) < (e - .75) / .25) continue;
        darken(x, y, O_GROUND);
      }
    }
    // water: far rows reflect the dark bank, a broad band in the middle reflects the sky
    waterRows = {};
    for (let dy = -ryT; dy <= ryB; dy++) {
      const h = pondHalf(dy), y = cy + dy; waterRows[y] = [cx - h, cx + h];
      for (let dx = -h; dx <= h; dx++) {
        const x = cx + dx, edge = h - Math.abs(dx);
        let col = WAT1;
        if (dy <= -ryT + 1 || edge < 1) col = WAT2;
        else if (dy === -ryT + 2) col = edge < 3 ? WAT2 : WAT1;
        else if (dy === -2) col = edge > 3 && hh(x >> 2, y, 4) < .35 ? SKY1 : WAT1;
        else if (dy === -1) col = edge > 2 ? (edge > 5 && hh(x >> 3, y, 3) < .5 ? SKY2 : SKY1) : WAT1;
        else if (dy === 0) col = edge > 5 ? SKY2 : edge > 1 ? SKY1 : WAT1;
        else if (dy === 1) col = edge > 3 ? SKY1 : WAT1;
        else if (dy === 2) col = edge > 5 && hh(x >> 2, y, 5) < .35 ? SKY1 : WAT1;
        else if (dy === ryB) col = edge < 3 || bay2(x, y) < .25 ? WAT2 : WAT1;
        set(x, y, col, O_WATER);
      }
    }
    // earth bank on the far half, lit moss lip on the near half
    for (let y = cy - ryT; y <= cy + ryB; y++) {
      const [a, b] = waterRows[y], col = y <= cy ? B2 : G2;
      if (ownAt(a - 1, y) === O_GROUND) set(a - 1, y, col); if (ownAt(b + 1, y) === O_GROUND) set(b + 1, y, col);
    }
    for (let x = cx - rx; x <= cx + rx; x++) {
      let top = -1, bot = -1;
      for (let y = cy - ryT; y <= cy + ryB; y++) if (ownAt(x, y) === O_WATER) { if (top < 0) top = y; bot = y; }
      if (top < 0) continue;
      if (ownAt(x, top - 1) === O_GROUND) set(x, top - 1, B2);
      if (ownAt(x, bot + 1) === O_GROUND) set(x, bot + 1, G2);
    }
    // far-bank stones with a 1px reflection, side boulders, near-bank stones
    for (const [dx, dy, a, b] of [[-14, -4, 3, 2], [1, -5, 4, 2], [14, -4, 3, 2]]) {
      const x = cx + dx, y = cy + dy; stone(x, y, a, b, dx === 1, true);
      for (let i = -a + 1; i <= a - 1; i++) if (ownAt(x + i, y + b + 1) === O_WATER) set(x + i, y + b + 1, ST2);
    }
    stone(cx - 23, cy + 1, 3, 2, true); stone(cx + 22, cy, 3, 3, false); stone(cx + 10, cy + 5, 3, 2, false);
    // lily pads, a pink water lily, sun glints
    spr(['.aab.', 'abbbb', 'bbc..', '.cc..'], cx + 5, cy - 1, { a: G1, b: G2, c: G4 }, O_WATER);
    spr(['.p.', 'pwp'], cx + 6, cy - 3, { p: PINK, w: WHT }, O_WATER);
    spr(['.ab', 'abc'], cx - 13, cy + 1, { a: G1, b: G2, c: G4 }, O_WATER);
    set(cx - 9, cy, WHT, O_WATER); set(cx - 8, cy, WHT, O_WATER); set(cx + 1, cy - 1, WHT, O_WATER); set(cx - 4, cy + 2, SKY2, O_WATER);
  }
  /* fallen hollow log: hollow end faces the viewer (left), broken end with thick roots (right) */
  const LOG_END = [
    '..BBBBB..',
    '.BWWWWWB.',
    'BWWHHHWoB',
    'BWHHHHHoB',
    'BWHHHHHoB',
    'BWHhhhHoB',
    'BWohhhooB',
    '.BWooooB.',
    '..BBBBB..',
  ];
  const SHELF = ['.sso.', 'sssoo', '.ggg.'];
  function hollowLog(rnd) {
    const x0 = 131, x1 = 178, y0 = 143, y1 = 140, r = 4;
    const cyAt = x => Math.round(y0 + (y1 - y0) * (x - x0) / (x1 - x0));
    // the log rests on moss: G3 contact shadow, then G2 moss down to the lip
    for (let x = x0 - 5; x <= x1 + 2; x++) {
      const yb = cyAt(Math.max(x0, Math.min(x, x1))) + r + 1;
      for (let y = yb; y < GB[x] - 1; y++) if (ownAt(x, y) === O_GROUND) set(x, y, y === yb ? G3 : y === yb + 1 && bay2(x, y) < .5 ? G3 : bay(x, y) < .2 ? G1 : G2);
    }
    // bark body: dark top outline, lit B0 upper band, B1 flank, B2 only on the bottom two rows
    const groove = [];
    for (const dy of [-2, 0, 2]) { const row = new Set(); let x = x0 + 1 + Math.floor(rnd() * 4); while (x < x1) { const len = 4 + Math.floor(rnd() * 8); for (let k = 0; k < len; k++) row.add(x + k); x += len + 2 + Math.floor(rnd() * 5); } groove[dy] = row; }
    const cracks = new Set([x0 + 9, x0 + 23, x0 + 37]);
    for (let x = x0; x <= x1; x++) {
      const cy = cyAt(x);
      for (let dy = -r; dy <= r; dy++) {
        let col = dy === -r || dy === r ? B3 : dy <= -2 ? B0 : dy <= 1 ? B1 : B2;
        if (groove[dy] && groove[dy].has(x)) col = dy < 0 ? B1 : B3;
        else if (groove[dy + 1] && groove[dy + 1].has(x) && dy === -3 && hh(x, 2, 57) < .5) col = WOOD;   // sheen on the bark ridge
        if (cracks.has(x) && dy >= -2 && dy <= 2) col = DARK[col];
        set(x, cy + dy, col, O_PROP);
      }
    }
    spr(['.bb.', 'bHob', '.bb.'], 151, cyAt(151) - 1, { b: B2, H: B3, o: B0 });                 // knot
    // moss caps on top, with a dark rim so they read against the meadow behind
    for (const [xc, w] of [[134, 6], [153, 7], [162, 4]]) {
      for (let i = 0; i < w; i++) {
        const x = xc + i, top = cyAt(x) - r, inner = i > 0 && i < w - 1;
        if (inner) { set(x, top - 2, G4, O_PROP); set(x, top - 1, i <= (w >> 1) - 1 ? G0 : G1, O_PROP); } else set(x, top - 1, G4, O_PROP);
        set(x, top, inner ? G1 : G3, O_PROP);
        if (inner && hh(x, 5, 55) < .6) set(x, top + 1, G2, O_PROP);
        if (inner && hh(x, 6, 55) < .3) set(x, top + 2, G3, O_PROP);
      }
    }
    // shelf fungi on the bark
    spr(SHELF, 161, cyAt(161), { s: WOOD, o: B0, g: B2 }); spr(SHELF, 165, cyAt(165) + 2, { s: WOOD, o: B0, g: B2 });
    // hollow end (facing the viewer): bark rim → pale wood ring → darker inner ring → dark hollow
    const ex = x0 - 1, ey = y0;
    spr(LOG_END, ex - 4, ey - 4, { B: B3, W: WOOD, o: B0, H: B3, h: B2 });
    set(ex - 1, ey - 5, G1, O_PROP); set(ex, ey - 5, G1, O_PROP); set(ex + 1, ey - 5, G2, O_PROP); set(ex - 2, ey - 4, G2, O_PROP);
    // jagged broken end + thick gnarled roots fanning into the moss
    for (const [dx, dy] of [[1, -3], [1, -1], [2, -2], [1, 1], [1, 2]]) set(x1 + dx, y1 + dy, dy < 0 ? B1 : B2, O_PROP);
    twig([[x1 + 1, y1 - 2], [x1 + 4, y1 - 4], [x1 + 7, y1 - 4], [x1 + 9, y1 - 5]]);
    limb([[x1 - 2, y1 - 1], [x1 + 3, y1], [x1 + 8, y1 + 2], [x1 + 11, y1 + 4]], 1.8, .5, O_PROP, B3, .7);
    limb([[x1 - 3, y1 + 3], [x1, y1 + 5], [x1 + 4, y1 + 6]], 1.8, .5, O_PROP, B3, .7);
    tuft(x1 + 11, y1 + 5, 0); tuft(x1 + 5, y1 + 6, 0);
    mushroom(145, 139, 1); mushroom(150, 140, 0);
  }
  /* 1px root / twig with a dark underside */
  function twig(pts) {
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
      for (let k = 0; k <= n; k++) {
        const x = Math.round(ax + (bx - ax) * k / n), y = Math.round(ay + (by - ay) * k / n);
        set(x, y, B1, O_PROP); if (ownAt(x, y + 1) !== O_PROP) set(x, y + 1, B3, O_PROP);
      }
    }
  }
  function mushroom(x, yb, size) {
    const crx = [2, 3, 5][size], cry = [1, 1, 2][size], sh = [2, 3, 4][size], sw = [1, 2, 3][size];
    if (ownAt(x, yb + 1) === O_GROUND) shadowEll(x + 2, yb + 1, crx, 1, O_GROUND);
    const sl = x - (sw >> 1);
    rect(sl, yb - sh + 1, sw, sh, WOOD, O_PROP); if (sw > 1) rect(sl + sw - 1, yb - sh + 1, 1, sh, B0, O_PROP); set(sl, yb, B0, O_PROP);
    const cy = yb - sh - cry + 1;
    ell(x, cy, crx, cry, B3, O_PROP);
    ell(x, cy, crx - 1, Math.max(0, cry - 1), B1, O_PROP);
    for (let dx = -crx + 1; dx <= (size ? 0 : -1); dx++) set(x + dx, cy - cry + (cry > 1 ? 1 : 0), B0, O_PROP);
    if (cry > 1) { for (let dx = -crx + 2; dx <= crx - 1; dx++) set(x + dx, cy + 1, B2, O_PROP); set(x - crx + 1, cy - 1, B0, O_PROP); }
    const spots = size === 2 ? [[-2, 0], [2, -1], [0, -1], [3, 0]] : size === 1 ? [[-1, 0], [1, 0]] : [[0, 0]];
    for (const [dx, dy] of spots) { set(x + dx, cy + dy, WOOD, O_PROP); SHROOM_SPOTS.push([x + dx, cy + dy]); }
  }
  /* reference-style big mushroom: 13x6 cap (outline, body, top-left highlight, pale spots, gill line), 3x7 stem */
  const BIGSHROOM = [
    '....BBBBB....',
    '..BBhhhh1BB..',
    '.Bhhssh1111B.',
    'Bhh111s11s12B',
    'B1s111111122B',
    '.BgggggggggB.',
    '...BBgggBB...',
    '.....wwo.....',
    '.....wwo.....',
    '.....wwo.....',
    '.....wwo.....',
    '.....wwo.....',
    '....wwwoo....',
  ];
  function bigMushroom(x, yb) {
    shadowEll(x + 1, yb + 1, 5, 1, O_GROUND);
    const x0 = x - 6, y0 = yb - BIGSHROOM.length + 1;
    spr(BIGSHROOM, x0, y0, { B: B3, h: B0, 1: B1, 2: B2, s: WOOD, g: B2, w: WOOD, o: B0 });
    for (let j = 0; j < 5; j++) for (let i = 0; i < 13; i++) if (BIGSHROOM[j][i] === 's') SHROOM_SPOTS.push([x0 + i, y0 + j]);
  }
  /* five round petals (plus-shaped blobs) around a contrasting centre; size 2 ≈ 7x7, size 1 = 3x3 cross, size 0 = bud */
  const FL7 = ['.LL.PP.', 'LLL.PPP', 'LL.C.PP', '..CCc..', 'PP.c.DD', 'PPP.DDD', '.PP.DD.'];
  function flower(x, y, pet, ctr, size) {
    const lite = LITE[pet] === pet ? WHT : LITE[pet], dark = DARK[pet], n = size === 2 ? 3 : 1, stem = size === 2 ? 4 : size === 1 ? 3 : 2;
    for (let k = 0; k < stem; k++) set(x + (k > 1 ? 1 : 0), y + n + k, G3, O_PROP);
    if (size) { set(x + 2, y + n + 1, G2, O_PROP); set(x + 3, y + n, G1, O_PROP); set(x - 1, y + n + 2, G2, O_PROP); set(x - 2, y + n + 1, G1, O_PROP); }
    if (size === 2) spr(FL7, x - 3, y - 3, { L: lite, P: pet, D: dark, C: ctr, c: DARK[ctr] }, O_PROP);
    else if (size === 1) {
      set(x, y - 1, lite, O_PROP); set(x - 1, y, lite, O_PROP); set(x + 1, y, pet, O_PROP); set(x, y + 1, dark, O_PROP); set(x, y, ctr, O_PROP);
    } else { set(x, y, pet, O_PROP); set(x, y + 1, dark, O_PROP); }
  }
  function leaf(x, y, flip, col) {
    const rows = flip ? ['...bba.', '.bbaaad', 'cccccd.', '.ddd...'] : ['.abb...', 'daaabb.', '.dccccc', '...ddd.'];
    spr(rows, x, y, { a: col, b: LITE[col], c: DARK[DARK[col]], d: G4 }, O_PROP);
  }
  /* arching fern frond: curved rachis with alternating leaflets, lit on the upper side */
  function fern(x, yb, dir, len) {
    for (let k = 0; k < len; k++) {
      const t = k / len, px = Math.round(x + dir * (t * t * len * .9)), py = Math.round(yb - Math.sin(t * 2.4) * len * .8);
      set(px, py, G3, O_PROP);
      if (k > 1 && k < len - 1) {
        const l = Math.max(1, Math.round((1 - t) * 3));
        for (let i = 1; i <= l; i++) { set(px - i, py - (k & 1 ? 1 : 0), i === l ? G0 : G1, O_PROP); set(px + i, py + (k & 1 ? 0 : 1), i === l ? G1 : G2, O_PROP); }
      }
    }
  }
  function foreground(rnd) {
    clipLane = true;
    // back edge of the meadow (bases above y 100)
    tallGrass(57, 98, 6, 8, 16, rnd); tallGrass(170, 98, 6, 8, 15, rnd); tallGrass(152, 98, 3, 5, 9, rnd); tallGrass(86, 98, 3, 5, 9, rnd);
    fern(12, 98, -1, 12); fern(66, 98, 1, 10); fern(182, 98, -1, 10); fern(229, 97, 1, 11);
    mushroom(55, 98, 1); mushroom(60, 97, 0); mushroom(187, 98, 0); mushroom(191, 99, 1);
    for (const [x, y, rx, ry] of [[74, 97, 2, 1], [16, 99, 2, 1], [227, 98, 2, 1]]) stone(x, y, rx, ry, true);
    // the sides (outside the lane): tall grass, a pink flower on the left, the hero mushrooms on the right
    tallGrass(5, 128, 8, 9, 18, rnd, 0, 18); tallGrass(14, 133, 6, 7, 13, rnd, 0, 18);
    tallGrass(229, 134, 6, 8, 15, rnd, 222, 240); tallGrass(236, 129, 7, 8, 17, rnd, 222, 240);
    for (const b of SWAY) blade(b, b.h - 4);
    flower(10, 123, PINK, YEL, 2); mushroom(16, 131, 1);
    bigMushroom(229, 133); mushroom(236, 131, 1);
    // foreground strip (y 136+): pond, log, mushrooms, flowers, leaves
    pond();
    hollowLog(rnd);
    mushroom(106, 148, 2); mushroom(113, 149, 1); mushroom(100, 149, 0); mushroom(118, 150, 0);
    flower(33, 138, PINK, YEL, 2); flower(26, 137, PINK, YEL, 1); flower(97, 139, WHT, YEL, 2); flower(122, 143, PURP, YEL, 2);
    flower(199, 139, BLUE, YEL, 2); flower(207, 138, YEL, ORNG, 2); flower(214, 137, BLUE, WHT, 1); flower(219, 136, YEL, ORNG, 0);
    flower(110, 151, PINK, YEL, 0); flower(127, 149, PURP, YEL, 0);
    leaf(158, 146, false, G1); leaf(138, 148, true, G1); leaf(20, 136, false, G0);
    tallGrass(38, 143, 3, 3, 5, rnd); tallGrass(92, 150, 3, 3, 5, rnd); tallGrass(203, 144, 2, 3, 4, rnd);
    clipLane = false;
  }
  function lip() {
    for (let x = 0; x < W; x++) { const y = GB[x] - 1; if (ownAt(x, y) === O_GROUND) set(x, y, G0); if (ownAt(x, y - 1) === O_GROUND && get(x, y - 1) >= G3) set(x, y - 1, G2); }
  }
  /* soil-band details: every pixel is clamped to rows groundBottom(x) .. groundBottom(x)+8 */
  function soilDetails(c, rnd) {
    const sp = (x, y, w, col) => { for (let i = x; i < x + w; i++) if (i >= 0 && i < W && y >= GB[i] && y <= GB[i] + 8) R(c, i, y, 1, 1, col); };
    for (let x = 0; x < W; x++) if (hh(x, 9, 61) < .2) { sp(x, GB[x], 1, PAL[G3]); if (hh(x, 10, 61) < .4) sp(x, GB[x] + 1, 1, PAL[G4]); }
    for (let i = 0; i < 24; i++) { const x = Math.floor(rnd() * (W - 6)), y = GB[x] + 2 + Math.floor(rnd() * 6); sp(x, y, 2 + Math.floor(rnd() * 4), SOILD); }
    for (let i = 0; i < 12; i++) { const x = Math.floor(rnd() * W), y = GB[x] + 1 + Math.floor(rnd() * 7); sp(x, y, 1, PAL[B1]); }
    for (let i = 0; i < 10; i++) {
      let x = 4 + Math.floor(rnd() * (W - 8)); const y0 = GB[x], len = 3 + Math.floor(rnd() * 5);
      for (let k = 0; k < len; k++) { sp(x, y0 + k, 1, PAL[k < 2 ? B1 : B2]); if (rnd() < .4) x += rnd() < .5 ? -1 : 1; }
    }
    // the log roots and the hero tree's line continue down through the loam
    for (const [x, len, dir] of [[189, 6, 1], [185, 5, -1], [131, 4, 1]]) {
      let px = x; for (let k = 0; k < len; k++) { sp(px, GB[px] + k, 1, PAL[k < 2 ? B1 : B2]); if (k & 1) px += dir; }
    }
    for (let i = 0; i < 16; i++) {
      const x = 2 + Math.floor(rnd() * (W - 6)), y = GB[x] + 2 + Math.floor(rnd() * 5), w = 1 + Math.floor(rnd() * 2);
      sp(x, y, w + 1, PAL[ST1]); sp(x, y, 1, PAL[CLD]); sp(x + 1, y + 1, w, PAL[ST2]);
    }
  }

  /* everything static lands in the private buffer; anim/glow geometry is derived from it */
  function paint(rnd) {
    buf = new Uint8Array(W * H).fill(255); own = new Uint8Array(W * H); nextId = O_CANOPY;
    GB = []; GT = []; for (let x = 0; x < W; x++) GB[x] = groundBottom(x);
    SHROOM_SPOTS.length = 0; clipLane = false;
    sky();
    cloud([[194, 22, 8, 5], [206, 16, 10, 8], [220, 19, 9, 7], [233, 24, 8, 5], [184, 26, 6, 3]], 28);
    cloud([[84, 55, 9, 3], [98, 52, 8, 5], [112, 54, 10, 4], [128, 56, 7, 3]], 57);
    cloud([[150, 57, 8, 3], [162, 55, 7, 4], [174, 57, 6, 2]], 58);
    farLayers();
    ground();
    path();
    groundDetails(rnd);
    clipLane = true; bushes(); clipLane = false;
    backFringe(rnd);
    clipLane = true; heroTree(); rightTree(); clipLane = false;
    shadowEll(52, 102, 36, 4, O_GROUND, true);
    shadowEll(212, 101, 24, 3, O_GROUND, true);
    foreground(rnd);
    lip();
    skyRows = [];
    for (let y = 0; y < 72; y++) {
      const iv = []; let s = -1;
      for (let x = 0; x <= W; x++) { const o = x < W ? own[y * W + x] : 0, isSky = o === O_SKY || o === O_CLOUD; if (isSky && s < 0) s = x; if (!isSky && s >= 0) { iv.push(s, x - 1); s = -1; } }
      skyRows.push(iv);
    }
    // night: stars in open sky (never in the UI meter zone), a moonlit rim along the canopy tops
    STARS.length = 0;
    const free = (x, y) => { for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) if (ownAt(x + i, y + j) !== O_SKY) return false; return !STARS.some(([a, b]) => Math.abs(a - x) + Math.abs(b - y) < 12); };
    for (let i = 0; i < 800 && STARS.length < 12; i++) { const x = 70 + Math.floor(hh(i, 1, 301) * 116), y = 28 + Math.floor(hh(i, 2, 301) * 30); if (free(x, y)) STARS.push([x, y, .8 + hh(i, 3, 301) * 1.5, hh(i, 4, 301) * 6.283]); }
    for (let i = 0; i < 400 && STARS.length < 15; i++) { const x = 196 + Math.floor(hh(i, 5, 301) * 40), y = 2 + Math.floor(hh(i, 6, 301) * 5); if (free(x, y)) STARS.push([x, y, .8 + hh(i, 7, 301) * 1.5, hh(i, 8, 301) * 6.283]); }
    RIM.length = 0;
    for (let x = 0; x < W; x++) {
      for (let y = 1; y < 70; y++) {
        const o = own[y * W + x];
        if (o >= O_CANOPY) { const a = own[(y - 1) * W + x]; if ((a === O_SKY || a === O_CLOUD) && hh(x >> 1, y >> 2, 401) < .16) { const p = RIM[RIM.length - 1]; if (p && p[1] === y && p[0] + p[2] === x) p[2]++; else RIM.push([x, y, 1]); } break; }
        if (o !== O_SKY && o !== O_CLOUD) break;
      }
    }
  }
  const ensure = () => { if (!skyRows || !waterRows) paint(rng(1234)); };

  /* ═══ animation data ═══ */
  function cloudRuns(puffs, base) {
    const m = new Set(), runs = [], inM = (x, y) => m.has(y * 100 + x);
    for (const [cx, cy, rx, ry] of puffs) for (let dy = -ry; dy <= ry; dy++) { if (cy + dy > base) continue; const h = half(rx, ry, dy); for (let dx = -h; dx <= h; dx++) m.add((cy + dy) * 100 + cx + dx); }
    const colAt = (x, y) => !inM(x, y + 1) ? SKY2 : (!inM(x, y + 2) || !inM(x + 1, y)) ? CLD : WHT;
    for (let y = 0; y <= base; y++) {
      let x = 0;
      while (x < 100) {
        if (!inM(x, y)) { x++; continue; }
        const col = colAt(x, y); let e = x;
        while (e + 1 < 100 && inM(e + 1, y) && colAt(e + 1, y) === col) e++;
        runs.push([y, x, e, col]); x = e + 1;
      }
    }
    return runs;
  }
  const CLOUDS = [
    { runs: cloudRuns([[8, 5, 6, 3], [15, 3, 6, 3], [22, 5, 6, 2]], 7), y: 30, v: 2.1, off: 0, w: 30 },
    { runs: cloudRuns([[6, 4, 5, 2], [12, 3, 5, 3], [18, 4, 4, 2]], 6), y: 41, v: 1.3, off: 150, w: 24 },
  ];
  const cloudX = (k, t) => Math.floor(((t * k.v + k.off) % (W + k.w + 40)) - k.w - 20);
  function cloudCovers(x0, x1, y0, y1, t) {
    for (const k of CLOUDS) { const ox = cloudX(k, t); for (const [dy, a, b] of k.runs) { const y = k.y + dy - 3; if (y >= y0 && y <= y1 && ox + a <= x1 && ox + b >= x0) return true; } }
    return false;
  }
  const BUTTER = [
    { cx: 120, cy: 55, ax: 44, ay: 7, w1: .37, w2: .83, p: 0, c1: PINK, c2: PINKD },
    { cx: 172, cy: 76, ax: 20, ay: 9, w1: .52, w2: 1.07, p: 2.4, c1: YEL, c2: ORNG },
  ];
  /* fireflies hover over the pond, the foreground strip, the sides and under the canopies — not where sprites stand */
  const FIREFLY = [[68, 141, 15, 3], [56, 144, 6, 2], [84, 140, 6, 3], [110, 141, 10, 3], [150, 137, 16, 2], [196, 140, 8, 2], [120, 147, 8, 2],
    [10, 112, 6, 14], [229, 106, 7, 12], [12, 84, 6, 8], [228, 82, 6, 8], [40, 61, 10, 4], [88, 63, 12, 4], [150, 60, 16, 5],
    [200, 63, 10, 4], [118, 65, 10, 2], [178, 56, 8, 5], [66, 57, 8, 5], [120, 96, 40, 4], [70, 97, 14, 2]];
  function drawSkyRun(c, y, x0, x1, col) {
    const iv = skyRows && skyRows[y]; if (!iv) return;
    for (let k = 0; k < iv.length; k += 2) { const a = Math.max(x0, iv[k]), b = Math.min(x1, iv[k + 1]); if (a <= b) R(c, a, y, b - a + 1, 1, col); }
  }
  const inWater = (x, y) => !!(waterRows && waterRows[y] && x > waterRows[y][0] && x < waterRows[y][1]);
  const MOON = ['.wwc.', 'wwwcc', 'wwcsc', 'wcccc', '.ccc.'];

  return {
    bg(c, rnd) {
      paint(rnd);
      flush(c);
      dioramaEdge(c, PAL_EDGE);
      soilDetails(c, rnd);
    },

    anim(c, t) {
      ensure();
      // drifting clouds, clipped to the open sky so they pass behind the trees
      for (const k of CLOUDS) {
        const ox = cloudX(k, t);
        for (const [dy, a, b, col] of k.runs) drawSkyRun(c, k.y + dy - 3, ox + a, ox + b, PAL[col]);
      }
      // a pair of distant birds gliding across now and then
      { const P = 26, k = Math.floor(t / P), ph = (t - k * P) / P;
        for (let i = 0; i < 2; i++) {
          const x = Math.round(-12 + ph * (W + 24) + i * 7), y = 34 + Math.floor(hh(k, 5, 81) * 14) + i * 3 + Math.round(Math.sin(t * 1.3 + i) * 1.5), up = (Math.floor(t * 4 + i * 2) & 3) === 0;
          drawSkyRun(c, y, x, x, PAL[ST2]); drawSkyRun(c, y + (up ? -1 : 1), x - 1, x - 1, PAL[ST2]); drawSkyRun(c, y + (up ? -1 : 1), x + 1, x + 1, PAL[ST2]);
        } }
      // butterflies on looping paths
      BUTTER.forEach((b, i) => {
        const x = Math.round(b.cx + b.ax * Math.sin(t * b.w1 + b.p) + 5 * Math.sin(t * b.w1 * 2.3 + b.p));
        const y = Math.round(b.cy + b.ay * Math.sin(t * b.w2 + b.p * 1.7) + 1.5 * Math.sin(t * 6 + i));
        const f = Math.floor(t * 9 + i * 2) % 3, c1 = PAL[b.c1], c2 = PAL[b.c2];
        R(c, x, y, 1, 3, PAL[B3]);
        if (f === 0) { R(c, x - 2, y - 1, 2, 2, c1); R(c, x + 1, y - 1, 2, 2, c1); R(c, x - 2, y - 1, 1, 1, c2); R(c, x + 2, y - 1, 1, 1, c2); R(c, x - 1, y + 1, 1, 1, c1); R(c, x + 1, y + 1, 1, 1, c1); }
        else if (f === 1) { R(c, x - 1, y - 1, 1, 2, c1); R(c, x + 1, y - 1, 1, 2, c1); R(c, x - 1, y - 1, 1, 1, c2); }
        else { R(c, x - 1, y - 2, 1, 2, c1); R(c, x + 1, y - 2, 1, 2, c1); }
      });
      // an occasional leaf drifting down from the big tree
      { const P = 8, k = Math.floor(t / P), ph = t - k * P;
        if (ph < 6) {
          const x0 = 26 + Math.floor(hh(k, 1, 77) * 40), y0 = 46 + Math.floor(hh(k, 2, 77) * 8), y1 = 100 + Math.floor(hh(k, 3, 77) * 24), tf = Math.min(ph, 4.4);
          const fall = tf / 4.4, x = Math.round(x0 + tf * 5 + Math.sin(tf * 2.6) * 5), y = Math.round(y0 + (y1 - y0) * fall);
          const fr = fall >= 1 ? 0 : Math.floor(ph * 5) % 4, a = PAL[G0], b2 = PAL[G2], d = PAL[G4];
          if (fr === 0) { R(c, x, y, 3, 1, a); R(c, x + 3, y, 1, 1, b2); R(c, x + 1, y + 1, 3, 1, b2); R(c, x, y + 1, 1, 1, d); }
          else if (fr === 1) { R(c, x, y, 2, 1, a); R(c, x + 1, y + 1, 2, 1, a); R(c, x + 2, y + 2, 1, 1, b2); R(c, x, y + 1, 1, 1, d); }
          else if (fr === 2) { R(c, x + 1, y, 1, 2, a); R(c, x + 2, y + 1, 1, 2, b2); R(c, x + 1, y + 2, 1, 1, d); }
          else { R(c, x + 2, y, 1, 1, a); R(c, x + 1, y + 1, 2, 1, a); R(c, x, y + 2, 2, 1, b2); R(c, x + 3, y, 1, 1, d); }
        } }
      // pond shimmer + ripple rings
      const { cx, cy } = POND;
      for (let i = 0; i < 7; i++) {
        const y = cy - 2 + (i % 4), x = cx - 18 + Math.floor((t * (2 + i * .7) + i * 9) % 36), on = hh(Math.floor(t * 2.5 + i * 3), i, 41) < .7;
        if (on && inWater(x, y) && inWater(x + 1, y)) R(c, x, y, i % 2 ? 2 : 1, 1, PAL[i % 3 ? SKY1 : WHT]);
      }
      for (let j = 0; j < 2; j++) {
        const P = 2.9, k = Math.floor((t + j * 1.45) / P), ph = (t + j * 1.45) / P - k;
        const rx = cx - 12 + Math.floor(hh(k, j, 43) * 24), ry = cy - 2 + Math.floor(hh(k, j, 44) * 4), r = 1 + ph * 6, col = PAL[ph < .5 ? SKY1 : WAT1];
        for (let a = 0; a < 16; a++) {
          if (ph > .6 && (a & 1)) continue;
          const x = rx + Math.round(Math.cos(a * Math.PI / 8) * r), y = ry + Math.round(Math.sin(a * Math.PI / 8) * r * .34);
          if (inWater(x, y)) R(c, x, y, 1, 1, col);
        }
      }
      // swaying grass tips
      for (const b of SWAY) {
        const amp = Math.sin(t * 1.7 + b.x * .37) * 1.6 + Math.sin(t * 2.9 + b.x) * .5;
        for (let k = b.h - 4; k < b.h; k++) {
          const s = (k - (b.h - 5)) / 4, x = bladeX(b, k) + Math.round(amp * s * s);
          R(c, x, b.yb - k, 1, 1, PAL[bladeCol(b, k)]);
        }
      }
    },

    glow(c, t) {
      ensure();
      // a small moon in the open sky (right of the UI meter zone) and twinkling stars
      MOON.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') R(c, 186 + i, 1 + j, 1, 1, PAL[row[i] === 'w' ? WHT : row[i] === 'c' ? CLD : ST1]); });
      STARS.forEach(([x, y, w, p]) => {
        if (cloudCovers(x - 1, x + 1, y - 1, y + 1, t)) return;
        const b = Math.sin(t * w + p);
        if (b > .9) { R(c, x - 1, y, 3, 1, PAL[SKY2]); R(c, x, y - 1, 1, 3, PAL[SKY2]); R(c, x, y, 1, 1, PAL[WHT]); }
        else if (b > .1) R(c, x, y, 1, 1, PAL[b > .55 ? WHT : SKY2]);
        else if (b > -.5) R(c, x, y, 1, 1, PAL[SKY1]);
      });
      // moonlight catching the top edge of the canopies
      RIM.forEach(([x, y, w], i) => { if (hh(i, Math.floor(t * .7), 402) > .08) R(c, x, y, w, 1, PAL[CLD]); });
      // moon path on the pond
      const { cx, cy } = POND;
      for (let dy = -3; dy <= 3; dy++) {
        const x = cx + 3 + Math.round(Math.sin(t * 1.3 + dy * .9) * 1.5), w = 3 - Math.min(2, Math.abs(dy));
        if (inWater(x, cy + dy) && inWater(x + w - 1, cy + dy)) R(c, x, cy + dy, w, 1, PAL[Math.abs(dy) <= 1 ? WHT : Math.abs(dy) === 2 ? CLD : SKY1]);
      }
      for (let i = 0; i < 4; i++) {
        const k = Math.floor(t * 3 + i * 1.7), x = cx - 18 + Math.floor(hh(k, i, 45) * 36), y = cy - 4 + Math.floor(hh(k, i, 46) * 9);
        if (inWater(x, y)) R(c, x, y, 1, 1, PAL[i & 1 ? WHT : SKY1]);
      }
      // faint glow on mushroom spots (only those a sprite can never stand in front of)
      SHROOM_SPOTS.forEach(([x, y], i) => { if (BODY(x, y)) return; const s = Math.sin(t * 1.1 + i * 1.9); if (s > -.2) R(c, x, y, 1, 1, PAL[s > .6 ? SKY1 : SKY2]); });
      // fireflies (inside the sprite zone they stay a dim 1px speck)
      FIREFLY.forEach(([fx, fy, ax, ay], i) => {
        const w = .35 + (i % 5) * .07, x = Math.round(fx + ax * Math.sin(t * w + i * 2.1) + 3 * Math.sin(t * w * 2.7 + i)), y = Math.round(fy + ay * Math.sin(t * w * .8 + i * 1.3));
        const b = .5 + .5 * Math.sin(t * (1.6 + (i % 4) * .23) + i * 2.3);
        if (BODY(x, y) || BODY(x - 2, y) || BODY(x + 2, y) || BODY(x, y - 1) || BODY(x, y + 1)) { if (b > .32) R(c, x, y, 1, 1, PAL[G1]); return; }
        if (b > .8) { R(c, x - 1, y, 3, 1, PAL[G0]); R(c, x, y - 1, 1, 3, PAL[G0]); R(c, x, y, 1, 1, PAL[WHT]); if (b > .95) { R(c, x - 2, y, 1, 1, PAL[G1]); R(c, x + 2, y, 1, 1, PAL[G1]); } }
        else if (b > .55) { R(c, x, y, 1, 1, PAL[YEL]); R(c, x, y + 1, 1, 1, PAL[G1]); }
        else if (b > .32) R(c, x, y, 1, 1, PAL[G1]);
        const my = 2 * (POND.cy - POND.ryT) - y;                       // reflection in the pond
        if (b > .55 && inWater(x, my)) R(c, x, my, 1, 1, PAL[b > .8 ? G0 : G1]);
      });
    },
  };
})();
