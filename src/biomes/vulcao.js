BIOMES.vulcao = (() => {
  /* ── palette: volcanic diorama at dusk (32 opaque colours, no alpha anywhere) ── */
  // sky (top → horizon)
  const S0 = '#6a3058', S1 = '#9a3c5a', S2 = '#c84c4c', S3 = '#e8703c', S4 = '#f89848', S5 = '#f8c068';
  // ash / volcano body (dusky violet) + far ridge
  const A0 = '#3e2840', A1 = '#5e3650', A2 = '#86485a', M0 = '#b0566a';
  // lava (crust → white hot)
  const L0 = '#a02c20', L1 = '#e05020', L2 = '#f88830', L3 = '#f8c848', L4 = '#fff0b0';
  // ground: rust & umber rock (light → dark) + hazy far floor
  const G5 = '#cc8c5c', G4 = '#b07048', G3 = '#94583e', G2 = '#784434', G1 = '#5a3230', G0 = '#3a2028', GF = '#a0645a';
  // basalt / obsidian (cool violet greys)
  const B0 = '#1c1828', B1 = '#2c2a3e', B2 = '#423e56', B3 = '#5e5872', B4 = '#8a84a2', OB = '#b4c4f4';
  // dry grass, pumice, steam, pokéball interior
  const DRY = '#c09c5c', PU = '#d0b4a0', ST = '#f4e0d8', DK = '#0e0a14';
  const RAMP = [G5, G4, G3, G2, G1, G0];
  const PAL_EDGE = { soil: [G1, A0, B1, B0], rim: [B3, B2, B0], back: [B0, DK] };
  // glow() runs after the sprite is drawn: it never paints inside the Pokémon's body band
  const inBand = y => y >= 70 && y <= 134;

  /* ── helpers ── */
  const hs = (a, b = 0, k = 0) => { const s = Math.sin(a * 127.1 + b * 311.7 + k * 74.7) * 43758.5453; return s - Math.floor(s); };
  const P = (c, x, y, col) => { c.fillStyle = col; c.fillRect(x, y, 1, 1); };
  let GBC = null;
  const gb = x => { if (!GBC) { GBC = []; for (let i = 0; i < W; i++) GBC.push(groundBottom(i)); } return x >= 0 && x < W ? GBC[x] : groundBottom(x); };
  // rounder ellipse than disc() for small radii
  function ell(c, cx, cy, rx, ry, col) {
    c.fillStyle = col; const q = (ry + .5) * (ry + .5);
    for (let y = -ry; y <= ry; y++) { const h = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / q))); c.fillRect(cx - h, cy + y, h * 2 + 1, 1); }
  }
  function line(c, x0, y0, x1, y1, col, th = 1) {
    c.fillStyle = col;
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1; let err = dx + dy;
    for (;;) { c.fillRect(x0, y0, th, th); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  // 4x4 ordered dither threshold
  const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const bay = (x, y) => (BAY[(y & 3) * 4 + (x & 3)] + .5) / 16;
  // cast shadow on the floor: light from the top-left, so it falls to the lower right (dark core → checker tail)
  function castShadow(c, x, y, len) {
    for (let i = 0; i < len; i++) {
      const X = x + i, k = i / len, ch = (X + y) & 1;
      const a = k < .22 ? G1 : k < .48 ? (ch ? G1 : G2) : k < .74 ? G2 : (ch ? G2 : null);
      if (a) P(c, X, y, a);
      if (i >= 2 && k < .78) { const b = k < .45 ? G2 : (ch ? null : G2); if (b) P(c, X, y + 1, b); }
    }
  }

  /* ── volcano geometry (crater centre x=182, rim y=30, base y=96) ── */
  const VX = 182, VT = 30, RIM = 7, SPAN = 85, EXP = .75;
  const hw = y => RIM + SPAN * Math.pow(Math.max(0, (y - VT) / 66), 1 / EXP);
  function vTop(x) {
    const d = Math.abs(x - VX) - RIM;
    return d <= 0 ? VT : d > SPAN ? 999 : Math.round(VT + 66 * Math.pow(d / SPAN, EXP));
  }
  // lava rivers: k = position across the cone (-1 left edge … 1 right edge)
  const RIVDEF = [
    { k0: -.42, k1: -.6, y0: 33, y1: 95, w0: 1, w1: 3, ph: 0, cool: 999 },
    { k0: -.56, k1: -.86, y0: 67, y1: 91, w0: 1, w1: 1, ph: 0, cool: 999 },
    { k0: .16, k1: .34, y0: 33, y1: 78, w0: 2, w1: 2, ph: 1.7, cool: 62 },
    { k0: -.14, k1: -.3, y0: 33, y1: 60, w0: 1, w1: 1, ph: 3.1, cool: 999 },
  ];
  let RIV = null;
  function rivers() {
    if (RIV) return RIV;
    RIV = RIVDEF.map(d => {
      const rows = [];
      for (let y = d.y0; y <= d.y1; y++) {
        const s = (y - d.y0) / (d.y1 - d.y0), k = d.k0 + (d.k1 - d.k0) * s, w = Math.round(d.w0 + (d.w1 - d.w0) * s);
        rows.push({ x: Math.round(VX + k * hw(y) + 1.4 * Math.sin(y * .33 + d.ph) - w / 2), y, w, cool: y >= d.cool });
      }
      return rows;
    });
    return RIV;
  }

  /* ── cracked floor: perspective Voronoi plates (vanishing row 40) ── */
  const VY = 40;
  let FL = null;
  function floorData() {
    if (FL) return FL;
    const id = new Int32Array(W * H).fill(-1), bx0 = new Int16Array(65536).fill(999), bx1 = new Int16Array(65536).fill(-1);
    for (let y = 96; y < H; y++) {
      const v = y + .5 - VY, Z = 980 / v, s = 4.7 / v, j0 = Math.floor(Z);
      for (let x = 0; x < W; x++) {
        if (y >= gb(x)) continue;
        const X = (x + .5 - 120) * s, i0 = Math.floor(X); let best = 1e9, b = 0;
        for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
          const i = i0 + di, j = j0 + dj, px = i + .12 + .76 * hs(i, j, 1), pz = j + .12 + .76 * hs(i, j, 2), d = (px - X) * (px - X) + (pz - Z) * (pz - Z);
          if (d < best) { best = d; b = (i + 64) * 256 + (j + 64); }
        }
        id[y * W + x] = b;
        if (x < bx0[b]) bx0[b] = x; if (x > bx1[b]) bx1[b] = x;
      }
    }
    const at = (x, y) => (x < 0 || x >= W || y < 96 || y >= H) ? -1 : id[y * W + x];
    const crack = new Uint8Array(W * H), seams = [];
    for (let y = 96; y < H; y++) for (let x = 0; x < W; x++) {
      const a = at(x, y); if (a < 0) continue;
      const r = at(x + 1, y), d = at(x, y + 1);
      const o = (r >= 0 && r !== a) ? r : (d >= 0 && d !== a) ? d : -1;
      if (o < 0) continue;
      crack[y * W + x] = 1;
      if (y >= 103 && y < gb(x) - 2 && hs(Math.min(a, o), Math.max(a, o), 7) < (y < 135 ? .065 : .09)) { crack[y * W + x] = 2; seams.push([x, y, y >= 135 ? 1 : 0]); }
    }
    FL = { at, crack, seams, bx0, bx1 };
    return FL;
  }

  /* ── shared animated things (used by anim + glow) ── */
  const POOL = { x: 174, y: 141, rx: 13, ry: 3 };
  function ember(i, t) {
    const per = 2.6 + hs(i, 1, 1) * 2.8, p0 = t / per + hs(i, 2, 1), cyc = Math.floor(p0), p = p0 - cyc, src = i % 3;
    let x0, y0, rise, drift;
    if (src === 0) { x0 = 163 + hs(i, cyc, 3) * 22; y0 = 140; rise = 30 + hs(i, cyc, 4) * 24; drift = -5 + hs(i, cyc, 5) * 10; }
    else if (src === 1) { x0 = 178 + hs(i, cyc, 3) * 9; y0 = 29; rise = 24; drift = 6 + hs(i, cyc, 5) * 12; }
    else {
      x0 = 26 + hs(i, cyc, 3) * 186; y0 = 138 + hs(i, cyc, 4) * 8; rise = 22 + hs(i, cyc, 4) * 30; drift = -3 + hs(i, cyc, 5) * 6;
      // never start inside the soil band: stay 2px above the lip wherever the drift can carry it
      const xr = Math.round(x0); y0 = Math.min(y0, Math.min(gb(xr - 5), gb(xr + 5)) - 2);
    }
    return { x: Math.round(x0 + drift * p + Math.sin(p * 9 + i) * 1.5), y: Math.round(y0 - rise * p), p, col: p < .2 ? L4 : p < .45 ? L3 : p < .75 ? L2 : L1 };
  }
  function bubble(i, t) {
    const per = 1.6 + hs(i, 9) * 1.3, p0 = t / per + hs(i, 8), cyc = Math.floor(p0), p = p0 - cyc;
    return { x: POOL.x - 8 + Math.round(hs(i, cyc, 1) * 16), y: POOL.y - 1 + Math.round(hs(i, cyc, 2) * 2), p };
  }
  const VENTS = [[128, 147], [118, 140]];
  const TREE_EMB = [[44, 88], [43, 81], [46, 73], [35, 56], [53, 55]];
  const ESTONES = [[116, 147], [154, 148], [197, 142], [38, 140], [68, 146]];
  const fan = () => { const rv = rivers()[0], r = rv[rv.length - 1]; return { x: r.x + 1, y: 98 }; };
  // basalt stones ringing the lava pool (sorted back → front)
  let STN = null;
  function stones() {
    if (STN) return STN;
    STN = [];
    for (let i = 0; i < 13; i++) { const a = (i / 13) * Math.PI * 2 + .2; STN.push([Math.round(POOL.x + Math.cos(a) * 16), Math.round(POOL.y + Math.sin(a) * 4.6), 2 + Math.round(hs(i, 4, 41) * 1.6), 1 + Math.round(hs(i, 5, 41))]); }
    STN.sort((p, q) => p[1] - q[1]);
    return STN;
  }
  // night: opaque checker of lit ground around the pool (outside the stones, thinning outwards)
  let RING = null;
  function poolRing() {
    if (RING) return RING;
    RING = [];
    const occ = new Uint8Array(W * H);
    for (const [sx, sy, w, h] of stones()) for (let yy = sy - h - 1; yy <= sy + h + 1; yy++) for (let xx = sx - w - 1; xx <= sx + w + 1; xx++) if (xx >= 0 && xx < W && yy >= 0 && yy < H) occ[yy * W + xx] = 1;
    for (let y = 135; y < H; y++) for (let x = POOL.x - 26; x <= POOL.x + 26; x++) {
      if (!((x + y) & 1) || y > gb(x) - 2 || occ[y * W + x]) continue;
      const dx = x - POOL.x, dy = y - POOL.y, e1 = (dx / 18.5) ** 2 + (dy / 5.5) ** 2, e2 = (dx / 24) ** 2 + (dy / 7.5) ** 2;
      if (e1 <= 1 || e2 > 1) continue;
      if (e2 > .72 && (((x >> 1) + y) & 1)) continue;
      RING.push(x, y);
    }
    return RING;
  }
  // charred log: alligator char blocks separated by glowing cracks (shared with anim/glow)
  const LOGX0 = 82, LOGX1 = 107, logCy = x => 145 - Math.round((Math.min(x, LOGX1) - LOGX0) * 3 / (LOGX1 - LOGX0));
  let LGB = null;
  function logBlocks() {
    if (LGB) return LGB;
    LGB = [];
    for (let xa = LOGX0 + 2, n = 0; xa < LOGX1 - 2; n++) {
      const row = (n & 1) ? 1 : -1, hot = hs(n, 3, 61) < .55;
      LGB.push({ x: xa, y: logCy(xa) + row, hot, hx: xa + (n & 1) });
      xa += 3 + Math.floor(hs(n, 2, 61) * 3);
    }
    return LGB;
  }
  // glowing magma veins in the soil band (below the platform lip)
  let VN = null;
  function veins() {
    if (VN) return VN;
    VN = [];
    for (const [x0, len, d0, ph] of [[20, 22, 3, 0], [58, 28, 5, 1], [104, 18, 2, 2], [132, 30, 4, 3], [178, 24, 3, 4], [214, 14, 2, 5]]) {
      for (let i = 0; i < len; i++) {
        const x = x0 + i, y = gb(x) + d0 + Math.round(Math.sin(i * .45 + ph) * 1.2);
        if (y >= H || y > gb(x) + 8) continue;
        VN.push([x, y, (i % 6 === 3) ? L2 : (i % 3 === 0) ? L1 : L0]);
      }
    }
    return VN;
  }

  /* ── drawing pieces ── */
  function sky(c) {
    const B = [[0, S0], [16, S1], [32, S2], [48, S3], [62, S4], [76, S5]];
    for (let i = 0; i < B.length; i++) R(c, 0, B[i][0], W, (i + 1 < B.length ? B[i + 1][0] : 96) - B[i][0], B[i][1]);
    for (let i = 1; i < B.length; i++) {
      const y = B[i][0], a = B[i - 1][1], b = B[i][1];
      dither(c, y - 1, W, a, b);
      for (let x = 0; x < W; x += 4) { P(c, x + 1, y - 2, b); P(c, x + 3, y + 1, a); }
    }
    // first stars of the evening (outside the meter zone)
    for (const [x, y] of [[8, 2], [27, 1], [41, 3], [58, 1], [104, 1], [150, 2], [63, 9]]) P(c, x, y, S4);
    P(c, 14, 27, L4); P(c, 13, 27, S4); P(c, 15, 27, S4); P(c, 14, 26, S4); P(c, 14, 28, S4);
    // low sun sinking behind the ridges, crossed by thin ash stripes
    ell(c, 79, 71, 9, 8, S5); ell(c, 79, 71, 8, 7, L3); ell(c, 79, 71, 6, 5, L4);
    R(c, 68, 66, 22, 1, S4); R(c, 66, 70, 26, 1, S4); R(c, 70, 69, 4, 1, S5); R(c, 65, 74, 30, 1, S3); R(c, 72, 73, 12, 1, S4);
  }
  // ash cloud shaded along its own contour: lit upper-left rim, shaded belly, underside lit by the low sun
  const CM = new Uint8Array(W * 80);
  function cloud(c, puffs, segs, far) {
    CM.fill(0);
    let xa = W, xb = 0, ya = 80, yb = 0;
    const mark = (x, y) => { if (x < 0 || x >= W || y < 0 || y >= 80) return; CM[y * W + x] = 1; if (x < xa) xa = x; if (x > xb) xb = x; if (y < ya) ya = y; if (y > yb) yb = y; };
    for (const [x, y, rx, ry] of puffs) {
      const q = (ry + .5) * (ry + .5);
      for (let dy = -ry; dy <= ry; dy++) { const h = Math.round(rx * Math.sqrt(Math.max(0, 1 - dy * dy / q))); for (let dx = -h; dx <= h; dx++) mark(x + dx, y + dy); }
    }
    for (const [a, b, y] of segs) for (let x = a; x < b; x++) { mark(x, y - 1); mark(x, y); }
    // no sky holes between the puffs and the base: fill every column solid
    for (let x = xa; x <= xb; x++) { let y0 = -1, y1 = -1; for (let y = ya; y <= yb; y++) if (CM[y * W + x]) { if (y0 < 0) y0 = y; y1 = y; } for (let y = y0; y >= 0 && y <= y1; y++) CM[y * W + x] = 1; }
    const m =(x, y) => x >= 0 && x < W && y >= 0 && y < 80 && CM[y * W + x] === 1;
    for (let y = ya; y <= yb; y++) {
      let x0 = xa, rc = null;
      for (let x = xa; x <= xb + 1; x++) {
        let col = null;
        if (m(x, y)) {
          if (!m(x, y + 1)) col = far ? M0 : (hs(x, y, 45) < .45 ? L2 : S4);
          else if (!m(x, y - 1) || !m(x - 1, y)) col = far ? M0 : A2;
          else if (!far && !m(x, y + 2)) col = A0;
          else col = far ? A2 : A1;
        }
        if (col !== rc) { if (rc) R(c, x0, y, x - x0, 1, rc); x0 = x; rc = col; }
      }
    }
  }
  function clouds(c) {
    cloud(c, [[9, 14, 5, 3], [19, 11, 7, 5], [31, 10, 8, 5], [43, 13, 6, 4], [53, 15, 4, 3]], [[4, 22, 17], [17, 41, 18], [37, 57, 17]], false);
    cloud(c, [[35, 32, 4, 2], [42, 30, 5, 3], [49, 32, 3, 2]], [[31, 43, 34], [41, 53, 33]], false);
    cloud(c, [[146, 40, 5, 2], [154, 38, 6, 3], [162, 40, 4, 2]], [[141, 155, 42], [152, 167, 41]], true);   // far: paler
    // long ash streaks
    R(c, 6, 45, 40, 1, A2); R(c, 0, 46, 60, 1, A1); R(c, 8, 47, 44, 1, S3);
    R(c, 84, 55, 52, 1, A2); R(c, 76, 56, 74, 1, A1); R(c, 88, 57, 50, 1, S4);
    R(c, 96, 33, 30, 1, S2); R(c, 90, 34, 44, 1, A2); R(c, 100, 35, 28, 1, S3);   // soft high streak below the meter zone
    R(c, 18, 68, 30, 1, A2); R(c, 12, 69, 44, 1, S3);
  }
  function distant(c) {
    // a small far-away cone peeking behind the big volcano + low far hills
    for (let x = 92; x < 140; x++) { const top = Math.round(68 + Math.abs(x - 114) * .72); if (top < 92) R(c, x, top, 1, 92 - top, S3); }
    R(c, 112, 67, 4, 1, S2); P(c, 113, 65, A2); P(c, 115, 63, A2); P(c, 114, 61, M0);
    for (let x = 0; x < W; x++) {
      const top = Math.round(80 + 5 * Math.sin(x * .045 + .8) + 3 * Math.sin(x * .13 + 2.1) + 1.4 * Math.sin(x * .41));
      R(c, x, top, 1, 96 - top, M0);
      const prev = Math.round(80 + 5 * Math.sin((x - 1) * .045 + .8) + 3 * Math.sin((x - 1) * .13 + 2.1) + 1.4 * Math.sin((x - 1) * .41));
      if (prev > top) P(c, x, top, S3);
      // faint rock strata on the far ridge (kept low-contrast: it is far away)
      for (let y = top + 3; y < 96; y++) if (hs(x, y, 71) < .07) R(c, x, y, 2, 1, A2);
    }
  }
  function volcano(c) {
    for (let x = 88; x < W; x++) {
      let top = vTop(x); if (top > 95) continue;
      if ((x < VX - RIM || x > VX + RIM) && hs(x, 1, 31) > .78) top -= 1;
      for (let y = top; y < 96; y++) {
        const h = hw(y), f = (x - (VX - h)) / (2 * h) + (((x + y) & 1) ? .015 : -.015);
        let col = f < .2 ? A2 : f < .56 ? A1 : A0;
        // dithered sunlit patch on the upper-left flank, thinning away from the top-left
        if (y >= 34 && y <= 52 && x >= 150 && x <= 176 && ((x + y) & 1) && col !== A0 && hs(x, y, 41) < (1 - f / .36 - (y - 34) / 26) * 1.3) col = col === A2 ? M0 : A2;
        P(c, x, y, col);
      }
      if (x < VX - RIM) P(c, x, top, M0); else if (x > VX + RIM) P(c, x, top, A1);
    }
    // curved lava strata wrapping the cone (front arc of a horizontal ring), lit edge on the sunny side
    for (let y0 = 38 + Math.floor(hs(1, 1, 42) * 3); y0 < 90; y0 += 6 + Math.floor(hs(y0, 2, 42) * 3)) {
      const h0 = hw(y0), e = Math.max(1, Math.round(h0 * .07));
      for (let x = Math.round(VX - h0 + 2 + hs(y0, 3, 42) * 4); x < VX + h0 - 2;) {
        const len = 3 + Math.floor(hs(x, y0, 43) * 6);
        for (let i = 0; i < len && x + i < VX + h0 - 1; i++) {
          const X = x + i, dx = (X - VX) / h0, y = y0 + Math.round(e * Math.sqrt(Math.max(0, 1 - dx * dx)));
          if (y <= vTop(X) + 1 || y >= 95) continue;
          const f = (X - (VX - hw(y))) / (2 * hw(y));
          P(c, X, y, f < .2 ? A1 : f < .56 ? A0 : B1);
          if (i === 0 && f < .56) P(c, X, y - 1, f < .2 ? M0 : A2);
        }
        x += len + 4 + Math.floor(hs(x, y0, 44) * 7);
      }
    }
    // gullies & ridges radiating from the crater (groove + lit ridge on its left)
    [-.84, -.7, -.3, -.04, .26, .5, .7, .86].forEach((k, n) => {
      const ys = 36 + Math.floor(hs(n, 2, 32) * 16), ye = 80 + Math.floor(hs(n, 3, 32) * 15), f = (k + 1) / 2;
      for (let y = ys; y < ye; y++) {
        if (hs(n, y, 35) < .14) continue;
        const x = Math.round(VX + k * hw(y) + Math.sin(y * .17 + n * 2) * 1.6);
        const lit = hs(y, n, 36) < .75, hot = hs(y, n, 37) < .4;
        if (f < .2) { P(c, x, y, A1); if (lit) P(c, x - 1, y, M0); }
        else if (f < .56) { P(c, x, y, A0); if (lit) P(c, x - 1, y, hot ? M0 : A2); }
        else { P(c, x, y, B1); if (lit) P(c, x - 1, y, hot ? A2 : A1); }
      }
    });
    // volcanic bombs
    for (let i = 0; i < 60; i++) {
      const x = 96 + Math.floor(hs(i, 5, 33) * 142), y = 40 + Math.floor(hs(i, 6, 33) * 50);
      if (y <= vTop(x) + 2) continue;
      const f = (x - (VX - hw(y))) / (2 * hw(y));
      R(c, x, y, 2, 1, f < .56 ? A0 : B1); P(c, x, y - 1, f < .2 ? M0 : A2);
    }
    // crater: jagged back rim, glowing elliptical bowl, front lip the rivers spill over
    P(c, 177, 27, A2); P(c, 178, 27, A1); R(c, 185, 27, 2, 1, A1); P(c, 185, 27, A2);
    R(c, 176, 28, 4, 1, A2); P(c, 176, 28, M0); R(c, 184, 28, 5, 1, A1); P(c, 184, 28, A2);
    R(c, 175, 29, 15, 1, A1); R(c, 175, 29, 3, 1, A2); R(c, 188, 29, 2, 1, A0);
    R(c, 174, 30, 17, 1, A1); R(c, 174, 30, 2, 1, A2); R(c, 189, 30, 2, 1, A0);
    R(c, 173, 31, 19, 1, A1); R(c, 173, 31, 2, 1, M0); R(c, 190, 31, 2, 1, A0);
    R(c, 173, 32, 19, 1, A1); R(c, 173, 32, 4, 1, M0); R(c, 189, 32, 3, 1, A0);
    ell(c, 182, 31, 7, 1, L1); R(c, 177, 30, 11, 1, L0); P(c, 176, 30, A0);
    R(c, 178, 31, 9, 1, L2); R(c, 180, 31, 5, 1, L3); P(c, 182, 31, L4); P(c, 179, 32, L2); R(c, 183, 32, 3, 1, L2);
    // old cooled flows: flat crusted lobes with dying cracks (their feet vanish into the scree)
    for (const [x, y, w] of [[116, 87, 7], [150, 86, 7], [205, 82, 8], [170, 89, 6]]) {
      ell(c, x, y, w, 1, A0);
      const h = Math.round(w * .745);
      R(c, x - h, y - 1, 2 * h + 1, 1, B1); P(c, x - h, y - 1, A1);
      R(c, x - 3, y, 2, 1, L0); R(c, x + 2, y + 1, 2, 1, L0); P(c, x + w - 1, y, B1);
    }
    // lava rivers
    for (const rv of rivers()) for (const r of rv) {
      if (r.cool) { R(c, r.x - 1, r.y, r.w + 2, 1, A0); if ((r.y & 1) === 0) R(c, r.x, r.y, r.w, 1, L0); continue; }
      P(c, r.x - 1, r.y, L0); P(c, r.x + r.w, r.y, L0);
      R(c, r.x, r.y, r.w, 1, L1);
      P(c, r.x + (r.w >> 1), r.y, hs(r.y, r.x, 34) < .25 ? L3 : L2);
      // spatter and warm glow on the rock beside the flow
      if (hs(r.y, r.x, 37) < .12) P(c, r.x - 2 - Math.floor(hs(r.y, 1, 38) * 3), r.y, L0);
      if (hs(r.y, r.x, 39) < .1) P(c, r.x + r.w + 1 + Math.floor(hs(r.y, 2, 38) * 2), r.y, L0);
    }
  }
  function plume(c) {
    const PF = [[231, 2, 14, 8], [215, 4, 11, 7], [203, 9, 9, 6], [195, 15, 7, 5], [189, 20, 5, 4], [185, 24, 4, 3]];
    for (const [x, y, rx, ry] of PF) { ell(c, x + 1, y + 1, rx, ry, A0); ell(c, x - 1, y - 1, rx - 1, ry - 1, A2); ell(c, x, y, rx - 1, ry - 1, A1); }
    // crater light on the plume's underside
    R(c, 183, 27, 6, 1, L0); R(c, 187, 24, 5, 1, S2); R(c, 192, 20, 6, 1, L0); R(c, 199, 15, 6, 1, L0);
  }
  function backCliff(c, xa, xb, topAt) {
    // columnar basalt wall: hazier than the near columns (aerial perspective)
    let x = xa;
    while (x < xb) {
      const fw = 3 + Math.floor(hs(x, 3, 21) * 3), mx = x + fw / 2;
      const top = Math.round(topAt(mx) + Math.sin(mx * .29) * 4 + Math.sin(mx * .83 + 1) * 2 + (hs(x, 4, 21) - .5) * 5), h = 97 - top;
      R(c, x, top, fw, h, B2); R(c, x, top + 1, 1, h - 1, B3); R(c, x + fw - 1, top + 1, 1, h - 1, B1);
      R(c, x, top, fw, 1, B4); P(c, x + fw - 1, top, B3);
      if (hs(x, 5, 21) < .3) { P(c, x + fw - 1, top, B2); P(c, x + fw - 2, top + 1, B1); }   // chipped cap
      for (let j = top + 5 + Math.floor(hs(x, 6, 21) * 6); j < 94; j += 6 + Math.floor(hs(x, j, 22) * 7)) { R(c, x, j, fw - 1, 1, B1); P(c, x, j + 1, B4); }
      x += fw;
    }
  }
  function column(c, x0, w, top, bot, joints) {
    const lw = Math.max(1, Math.round(w * .3)), rw = Math.max(1, Math.round(w * .28)), fw = Math.max(0, w - 2 - lw - rw), h = bot - top;
    R(c, x0 + 1, top + 3, w - 2, h - 3, B2);
    R(c, x0 + 1, top + 3, 1, h - 3, B4); R(c, x0 + 2, top + 3, lw - 1, h - 3, B3);
    R(c, x0 + w - 1 - rw, top + 3, rw, h - 3, B1);
    R(c, x0, top + 2, 1, h - 1, B0); R(c, x0 + w - 1, top + 2, 1, h - 1, B0);
    // hexagonal cap
    R(c, x0 + 2, top, w - 4, 1, B0); P(c, x0 + 1, top + 1, B0); P(c, x0 + w - 2, top + 1, B0);
    R(c, x0 + 2, top + 1, w - 4, 1, B4); R(c, x0 + 1, top + 2, w - 2, 1, B3); if (fw) R(c, x0 + 1 + lw, top + 2, fw, 1, B4);
    R(c, x0, bot, w, 1, B0);
    for (const j of joints) { R(c, x0 + 1, top + j, w - 2, 1, B1); P(c, x0 + 1, top + j + 1, B4); P(c, x0 + 2, top + j - 1, B2); }
    // texture chips
    if (fw) for (let y = top + 6; y < bot - 2; y += 5) P(c, x0 + 1 + lw + Math.floor(hs(x0, y, 23) * fw), y, hs(y, x0, 24) < .5 ? B1 : B3);
  }
  function stump(c, x0, w, top, bot) {
    // short basalt column at the back edge: hex cap + three-tone faces
    R(c, x0, top + 1, w, bot - top, B2); R(c, x0 + 1, top + 2, 1, bot - top - 2, B3); R(c, x0 + w - 2, top + 2, 1, bot - top - 2, B1);
    R(c, x0, top + 2, 1, bot - top - 1, B0); R(c, x0 + w - 1, top + 2, 1, bot - top - 1, B0); R(c, x0, bot, w, 1, B0);
    R(c, x0 + 1, top, w - 2, 1, B0); R(c, x0 + 1, top + 1, w - 2, 1, B4); P(c, x0, top + 1, B0); P(c, x0 + w - 1, top + 1, B0);
    R(c, x0 + 1, top + 2, w - 3, 1, B3);
  }
  const plateIdx = (a, y) => Math.max(1, Math.min(4, Math.round(2.15 + 1.35 * (y - 96) / 56 + (hs(a, 0, 3) - .5) * .95)));
  function floor(c, rnd) {
    const { at, crack, bx0, bx1 } = floorData();
    // the far floor melts into the haze under the ridge (checker instead of a hard seam)
    for (let x = 47; x < 91; x += 2) P(c, x, 95, GF);
    for (let y = 96; y < H; y++) {
      const zone = y < 102 ? 0 : y < 112 ? 1 : y < 135 ? 2 : 3, dens = [.02, .02, .025, .06][zone];
      for (let x = 0; x < W; x++) {
        const a = at(x, y); if (a < 0) continue;
        const dk = y >= gb(x) - 3 ? 5 : 4;   // G0 only in the last 2 rows above the lip
        let idx = plateIdx(a, y); if (zone === 3 && y < 142) idx = Math.min(idx, 3);
        const k = crack[y * W + x];
        let col;
        if (k === 2) {
          const v = hs(x, y, 11);
          col = zone === 3 ? (v < .05 ? L3 : v < .35 ? L2 : L1) : zone === 2 ? (v < .22 ? L1 : L0) : L0;
        } else if (k === 1) {
          col = (zone === 2 && hs(x, y, 9) < .14) ? RAMP[idx] : RAMP[Math.min(dk, idx + 1)];
        } else {
          const u = at(x, y - 1), l = at(x - 1, y);
          // sparse top-edge light, only on the sunward (left) part of each plate
          if (u >= 0 && u !== a && hs(x, y, 8) < .3 && x - bx0[a] < .6 * (bx1[a] - bx0[a] + 1)) col = RAMP[idx - 1];
          else if (l >= 0 && l !== a && hs(x, y, 10) < .35) col = RAMP[idx - 1];
          else { const v = hs(x, y, 5); col = v < dens ? RAMP[Math.min(dk, idx + 1)] : v > 1 - dens * .5 ? RAMP[idx - 1] : RAMP[idx]; }
        }
        // rows 96-101: ordered dither from the pale hazy far floor into the plates (no band break)
        if (zone === 0 && bay(x, y) >= (y - 96) / 6) col = k ? G3 : GF;
        if (y === 96 && x >= 47 && x < 91 && (x & 1)) col = M0;
        P(c, x, y, col);
      }
    }
    // magma seams warm the rock just below them (front only; the lane stays calm)
    for (const [x, y, fg] of floorData().seams) if (fg && y + 1 < gb(x) - 1 && crack[(y + 1) * W + x] === 0) P(c, x, y + 1, G4);
    // sun glints on the top-left corner of plates in the sunward half
    const best = new Map();
    for (let y = 102; y < 132; y++) for (let x = 40; x <= 120; x++) {
      const a = at(x, y); if (a < 0 || crack[y * W + x] || at(x, y - 1) === a || at(x - 1, y) === a) continue;
      const s = x + 2 * y, b = best.get(a); if (!b || s < b[2]) best.set(a, [x, y, s]);
    }
    for (const [a, [x, y]] of best) {
      if (hs(a, 7, 13) > .6) continue;
      const idx = plateIdx(a, y);
      P(c, x, y, RAMP[Math.max(0, idx - 2)]);
      if (at(x + 1, y) === a && !crack[y * W + x + 1]) P(c, x + 1, y, RAMP[idx - 1]);
      if (y > 116 && at(x, y + 1) === a && !crack[(y + 1) * W + x]) P(c, x, y + 1, RAMP[idx - 1]);
    }
    // hairline sub-cracks and gas pores break up the plates
    for (let n = 0; n < 90; n++) {
      let x = Math.floor(rnd() * W), y = 103 + Math.floor(rnd() * 50);
      const a = at(x, y); if (a < 0 || y >= gb(x) - 2) continue;
      const dark = RAMP[Math.min(4, plateIdx(a, y) + 1)], len = 2 + Math.floor(rnd() * (y < 120 ? 3 : 5)), dir = rnd() < .5 ? -1 : 1;
      if (n % 3 === 0) { P(c, x, y, dark); P(c, x, y + 1, RAMP[plateIdx(a, y) - 1]); continue; }
      for (let i = 0; i < len; i++) { if (at(x, y) !== a || crack[y * W + x]) break; P(c, x, y, dark); x += 1; if (rnd() < .45) y += dir; }
    }
  }
  function volcanoFoot(c) {
    // scree / talus apron along the cone base: seats the volcano ON the floor (overlaps the first floor rows)
    const rm = new Uint8Array(W * H);
    for (const rv of rivers()) for (const r of rv) if (!r.cool && r.y >= 84) for (let x = r.x - 1; x <= r.x + r.w; x++) rm[r.y * W + x] = 1;
    const TOP = [], BOT = [];
    for (let x = 92; x < 236; x++) {
      let top = Math.round(90 + 2 * Math.sin(x * .31)) + Math.floor(hs(x, 3, 81) * 3);
      if (x >= 197) top = Math.max(top, 95);   // low talus in front of the right cliff
      top = Math.max(top, vTop(x) + 1);
      const bot = 97 + Math.floor(hs(x, 4, 81) * 2.99);
      TOP[x] = top; BOT[x] = bot;
      const lit = x < 124 ? 2 : x < 138 ? 1 : 0;
      for (let y = top; y <= bot; y++) {
        if (rm[y * W + x]) continue;
        P(c, x, y, y < bot && (lit === 2 || (lit === 1 && ((x + y) & 1))) ? A1 : A0);
      }
      // ragged crest: checker into the slope above
      if (!(x & 1) && top - 1 > vTop(x) && !rm[(top - 1) * W + x]) P(c, x, top - 1, lit ? A1 : A0);
    }
    // loose rocks lit from the top-left: small up the slope, bigger near the floor (perspective)
    const clear = (x, y, w) => { for (let i = -1; i <= w; i++) if (rm[y * W + x + i] || rm[(y - 1) * W + x + i]) return false; return true; };
    for (let i = 0; i < 90; i++) {
      const x = 93 + Math.floor(hs(i, 1, 82) * 141), top = TOP[x], bot = BOT[x], sun = x < 140;
      const y = top + 1 + Math.floor(hs(i, 2, 82) * Math.max(1, bot - top - 1)), big = y >= bot - 2 && i % 2;
      if (!clear(x, y, big ? 3 : 2)) continue;
      if (big) { P(c, x, y - 1, sun ? M0 : A2); R(c, x + 1, y - 1, 2, 1, sun ? A2 : A1); R(c, x, y, 3, 1, B1); P(c, x + 2, y, B0); P(c, x + 3, y, B0); }
      else { R(c, x, y, 2, 1, B1); P(c, x, y - 1, sun ? M0 : A2); }
    }
    // warm glints of half-buried lava
    for (let i = 0; i < 9; i++) {
      const x = 100 + Math.floor(hs(i, 3, 83) * 96), y = TOP[x] + 2 + Math.floor(hs(i, 4, 83) * 3);
      if (y < BOT[x] && !rm[y * W + x]) { P(c, x, y, L0); if (i % 3 === 0) P(c, x + 1, y, L1); }
    }
    // pebbles that rolled out onto the floor
    for (let i = 0; i < 16; i++) {
      const x = 94 + Math.floor(hs(i, 5, 84) * 104), y = BOT[x] + 1 + Math.floor(hs(i, 6, 84) * 2);
      P(c, x, y, i % 3 ? B1 : A0); if (i % 2) P(c, x + 1, y, G2);
    }
  }
  function tree(c) {
    // roots
    line(c, 37, 98, 41, 96, B1); line(c, 52, 98, 48, 96, B1); P(c, 36, 98, B0); P(c, 53, 98, B0); P(c, 44, 98, B0); P(c, 45, 98, B1);
    // trunk: flared base, gnarled taper, charred bark with a lit left edge
    for (let y = 60; y <= 97; y++) {
      const w = y >= 96 ? 10 : y >= 94 ? 8 : y >= 90 ? 7 : y >= 82 ? 6 : y >= 72 ? 5 : y >= 66 ? 4 : 3, cx = 44 + Math.round((97 - y) * .05 + Math.sin(y * .16) * .8), x0 = cx - (w >> 1);
      R(c, x0, y, w, 1, B1); P(c, x0, y, B0); P(c, x0 + 1, y, B2); P(c, x0 + w - 1, y, B0);
      if (w >= 5 && hs(y, 1, 72) < .6) P(c, x0 + 1, y, B3);
      if (w >= 5) P(c, x0 + 2 + ((y >> 2) % 2), y, (y % 6) < 3 ? B0 : B1);   // bark furrows
      if (w >= 6 && (y % 5) === 1) P(c, x0 + w - 2, y, B2);
    }
    R(c, 39, 96, 2, 2, B0); R(c, 48, 96, 2, 2, B0);
    // knot hole with embers
    R(c, 43, 85, 2, 2, B0); P(c, 43, 86, L0);
    // limbs: shadow line first, then the limb, then lit pixels
    const limbs = [[43, 67, 36, 57, 2], [36, 57, 30, 49, 1], [30, 49, 27, 43, 1], [33, 53, 27, 52, 1], [30, 49, 33, 44, 1],
      [46, 65, 53, 56, 2], [53, 56, 58, 49, 1], [58, 49, 60, 42, 1], [55, 53, 60, 54, 1], [60, 54, 63, 52, 1], [58, 49, 62, 47, 1],
      [45, 60, 46, 54, 1], [46, 54, 45, 50, 1], [47, 79, 51, 76, 1]];
    for (const [a, b, d, e, th] of limbs) line(c, a + 1, b + 1, d + 1, e + 1, B0, th);
    for (const [a, b, d, e, th] of limbs) line(c, a, b, d, e, B1, th);
    for (const [a, b, d, e, th] of limbs) if (th === 2) line(c, a, b, d, e, B2);
    for (const [x, y] of [[27, 43], [60, 42], [63, 52], [45, 50], [27, 52], [33, 44], [62, 47]]) P(c, x, y, B4);
    P(c, 51, 76, L1);
    for (const [x, y] of TREE_EMB) { P(c, x, y, L1); P(c, x, y + 1, L0); }
  }
  function backEdge(c) {
    // the main river reaches the floor and spreads into a flat lava puddle
    const fx = fan().x;
    P(c, fx - 2, 96, L0); R(c, fx - 1, 96, 3, 1, L1); P(c, fx, 96, L2); P(c, fx + 2, 96, L0);
    ell(c, fx, 98, 9, 1, L0); R(c, fx - 6, 98, 12, 1, L1); R(c, fx - 2, 98, 5, 1, L2); P(c, fx, 98, L3);
    R(c, fx - 2, 97, 4, 1, L1); P(c, fx - 1, 97, L2);
    // crust at its rim + warm reflections on the plates beside it
    P(c, fx - 10, 98, B1); P(c, fx + 10, 98, B1); P(c, fx - 7, 99, B1); R(c, fx + 5, 99, 2, 1, B1); P(c, fx + 7, 97, B1);
    P(c, fx - 12, 99, L0); P(c, fx - 14, 100, L0); P(c, fx - 11, 100, G4); P(c, fx + 12, 99, L0); P(c, fx + 13, 100, L0); P(c, fx + 11, 100, G4);
    // cast shadows first (light from the top-left: they fall to the lower right)
    castShadow(c, 49, 99, 11);                               // dead tree
    castShadow(c, 61, 100, 16); castShadow(c, 71, 99, 6);    // left stumps
    castShadow(c, 184, 100, 19); castShadow(c, 199, 99, 7);  // right stumps
    const BOUL = [[80, 97, 5], [99, 98, 3], [152, 98, 5], [163, 97, 3], [24, 98, 4], [212, 98, 3], [58, 99, 2]];
    for (const [x, y, w] of BOUL) castShadow(c, x + 2, y + 1, w + 4);
    // basalt stumps at the back edge
    stump(c, 63, 5, 88, 98); stump(c, 67, 4, 92, 99); stump(c, 60, 4, 94, 99);
    stump(c, 186, 5, 87, 98); stump(c, 190, 5, 91, 99); stump(c, 195, 4, 94, 99); stump(c, 183, 4, 93, 99);
    // boulders
    for (const [x, y, w] of BOUL) { R(c, x, y - 1, w, 2, B2); R(c, x + 1, y - 2, w - 2, 1, B3); P(c, x, y - 1, B3); R(c, x, y, w, 1, B1); }
    // a little scree at the foot of the left cliff
    for (const [x, y] of [[26, 96], [31, 97], [34, 96], [29, 99]]) { R(c, x, y, 2, 1, B1); P(c, x, y - 1, B3); P(c, x + 2, y, G2); }
  }
  function nearColumns(c) {
    column(c, 0, 9, 34, 129, [14, 31, 52, 70]);
    column(c, 8, 8, 58, 126, [11, 30, 47]);
    column(c, 14, 6, 88, 129, [12, 27]);
    // their shadow falls on the floor to the lower right: dithered G1/G2 wedge
    for (let y = 127; y <= 131; y++) {
      const len = 4 + Math.round((y - 127) * 2.5);
      for (let i = 0; i < len; i++) {
        const x = 20 + i, k = i / len, ch = (x + y) & 1;
        const col = k < .3 ? G1 : k < .6 ? (ch ? G1 : G2) : k < .85 ? G2 : (ch ? G2 : null);
        if (col) P(c, x, y, col);
      }
    }
    R(c, 0, 130, 20, 1, G1);
    column(c, 231, 9, 38, 130, [12, 33, 55, 77]);
    column(c, 224, 8, 58, 127, [16, 36, 52]);
    column(c, 221, 5, 84, 130, [14, 30]);
    // ambient occlusion where the right columns meet the floor
    for (let y = 128; y <= 131; y++) { const xs = 221 - (y - 127) * 2; for (let x = xs; x < 221; x++) if (x > xs + 1 || ((x + y) & 1)) P(c, x, y, x >= 218 || ((x + y) & 1) ? G1 : G2); }
    R(c, 221, 131, 19, 1, G1);
    // sulfur crust at the bases
    for (const [x, y] of [[3, 128], [10, 125], [16, 128], [233, 129], [226, 126], [222, 129]]) { P(c, x, y, L3); P(c, x + 1, y, DRY); }
  }
  function lily(c, x, y, red, tall) {
    const pa = red ? L1 : L2, pb = red ? L2 : L3;
    const h = tall ? 4 : 1;
    R(c, x, y - h + 1, 1, h, G0); if (tall) { P(c, x + 1, y - 1, DRY); P(c, x - 1, y - 2, DRY); }
    const fy = y - h;
    P(c, x - 1, fy, pa); P(c, x, fy, L3); P(c, x + 1, fy, pa);
    P(c, x - 1, fy - 1, pb); P(c, x + 1, fy - 1, pb); if (tall) { P(c, x, fy - 1, pa); P(c, x - 2, fy - 2, pb); P(c, x + 2, fy - 2, pb); P(c, x, fy + 1, L0); }
  }
  function tuft(c, x, y, h) {
    R(c, x - 1, y - h + 2, 1, h - 2, G4); R(c, x, y - h, 1, h, DRY); R(c, x + 1, y - h + 1, 1, h - 1, DRY); R(c, x + 2, y - h + 3, 1, h - 3, G4);
    if (h > 3) { P(c, x - 2, y - 1, G4); P(c, x + 3, y - 1, DRY); }
    R(c, x - 1, y + 1, 4, 1, G1);
  }
  function rock(c, x, y, w, h, glow) {
    // rounded basalt rock with base at y, light from top-left
    ell(c, x, y - h, w, h, B0);
    ell(c, x, y - h, w - 1, h - 1, B1);
    ell(c, x - 1, y - h - 1, Math.max(1, w - 2), Math.max(0, h - 2), B2);
    R(c, x - w + 2, y - 2 * h + 1, 2, 1, B3);
    R(c, x - w + 1, y + 1, 2 * w + 2, 1, G1);
    if (glow) { line(c, x - w + 2, y - h + 1, x, y - h, L1); line(c, x, y - h, x + w - 2, y - h - 1, L1); P(c, x, y - h, L2); P(c, x - 2, y - h + 1, L2); }
  }
  function emberStone(c, x, y) {
    R(c, x - 1, y - 1, 4, 2, B1); P(c, x - 1, y - 1, B2); P(c, x, y - 1, L1); P(c, x + 1, y - 1, L2); P(c, x + 1, y, L0); P(c, x + 2, y, B0); P(c, x + 3, y, G1);
  }
  function crystals(c) {
    // obsidian shards: [x, base, w, h, lean]
    const SH = [[47, 144, 2, 4, -1], [51, 144, 3, 8, 0], [55, 145, 3, 6, 1], [59, 145, 2, 4, 1], [62, 146, 2, 2, 0], [44, 143, 1, 2, 0]];
    for (const [x, b, w, h, lean] of SH) {
      for (let r = 0; r < h; r++) {
        const y = b - r, off = Math.round(lean * r / Math.max(1, h)), ww = r >= h - 2 ? Math.max(1, w - (r - (h - 3))) : w;
        R(c, x + off - 1, y, ww + 2, 1, B0); R(c, x + off, y, ww, 1, B1); P(c, x + off, y, B2);
      }
      P(c, x + Math.round(lean * (h - 1) / Math.max(1, h)), b - h, B0);
      P(c, x + Math.round(lean * (h - 2) / Math.max(1, h)), b - h + 1, OB);
      if (h > 4) { P(c, x, b - 2, OB); P(c, x, b - 3, B3); }
    }
    R(c, 45, 146, 19, 1, G1);
  }
  function log(c) {
    // charred fallen log lying across the front (cylinder lit from the top-left), hollow end on the right
    for (let x = LOGX0; x <= LOGX1 + 4; x++) P(c, x, logCy(x) + 3, G0);   // contact shadow under its whole length
    for (let x = LOGX0; x <= LOGX1; x++) {
      const cy = logCy(x);
      P(c, x, cy - 4, G0); P(c, x, cy - 3, G1); P(c, x, cy - 2, hs(x, 2, 62) < .7 ? G2 : G1); P(c, x, cy - 1, G1);
      P(c, x, cy, hs(x, 3, 62) < .25 ? G1 : G0); P(c, x, cy + 1, G0); P(c, x, cy + 2, B1);
    }
    // ash-lit top edge, broken every 3-5 px
    for (let x = LOGX0 + 1, n = 0; x < LOGX1 - 1; n++) {
      const len = 3 + Math.floor(hs(n, 1, 61) * 3);
      for (let i = 0; i < len && x + i < LOGX1 - 1; i++) P(c, x + i, logCy(x + i) - 3, i < 2 ? PU : G5);
      x += len + 1;
    }
    // alligator char: blocks with a lit top-left corner, separated by staggered glowing cracks
    for (const b of logBlocks()) {
      const cy = logCy(b.x);
      P(c, b.x - 1, cy - 2, G3); P(c, b.x + 2, cy - 2, G0);
      R(c, b.x, b.y, 2, 1, L0); if (b.hot) P(c, b.hx, b.y, L1);
    }
    // jagged broken left end with splinters
    P(c, 81, 142, G0); P(c, 81, 143, G4); P(c, 81, 144, G2); P(c, 81, 145, G0); P(c, 81, 146, G0);
    P(c, 80, 143, G0); P(c, 80, 144, G3); P(c, 80, 145, G0); P(c, 79, 144, G0);
    // hollow cut end: sapwood ring, inner ring, dark hole with embers inside
    const hx = 109, hy = 141;
    ell(c, hx, hy, 3, 3, G0); ell(c, hx, hy, 2, 2, G4); R(c, hx - 1, hy - 1, 3, 3, G2);
    R(c, hx, hy - 1, 1, 2, B0); P(c, hx + 1, hy, B0); P(c, hx, hy + 1, L0);
    P(c, hx - 2, hy - 1, G5); P(c, hx - 1, hy - 2, G5); P(c, hx + 1, hy + 2, G3); P(c, hx + 2, hy + 1, G3);
    // two snapped branch stubs
    P(c, 93, 139, G0); P(c, 94, 138, G0); P(c, 95, 137, G0); P(c, 94, 139, G2); P(c, 95, 138, PU); P(c, 95, 139, G1); P(c, 96, 138, G1); P(c, 96, 137, G0); P(c, 97, 138, G0);
    P(c, 87, 140, G0); P(c, 86, 139, G0); P(c, 85, 139, G0); P(c, 86, 140, G2); P(c, 85, 140, G1); P(c, 84, 140, G0); P(c, 85, 141, G1);
  }
  function vent(c, x, y) {
    ell(c, x, y, 4, 1, G3); R(c, x - 3, y - 1, 6, 1, G4); R(c, x - 1, y, 3, 1, B0); P(c, x, y, L0);
    P(c, x - 3, y, L3); P(c, x + 3, y - 1, L3); P(c, x + 2, y + 1, DRY); P(c, x - 4, y + 1, G1); R(c, x - 2, y + 2, 6, 1, G1);
  }
  function pool(c) {
    const { x, y } = POOL;
    ell(c, x, y, 16, 4, B0);
    ell(c, x, y, 15, 3, L0);
    ell(c, x, y, 13, 3, L1);
    ell(c, x + 1, y, 10, 2, L2);
    ell(c, x + 2, y, 6, 1, L3);
    R(c, x - 1, y, 4, 1, L4); P(c, x + 5, y - 1, L4);
    R(c, x - 9, y - 1, 3, 1, L0); R(c, x + 6, y + 1, 4, 1, L1); R(c, x - 5, y + 2, 2, 1, L0);
    // ring of basalt stones (back first), inner faces lit by the lava
    for (const [sx, sy, w, h] of stones()) {
      const ty = sy - h + (h > 1 ? 1 : 0);
      ell(c, sx, sy, w, h, B0); ell(c, sx, sy, w - 1, Math.max(0, h - 1), B1); R(c, sx - w + 1, ty, Math.max(1, w), 1, B2); R(c, sx - w + 1, ty, 2, 1, B3); P(c, sx - w + 1, ty, B4);
      if (sy < y) P(c, sx, sy + h, L0); else P(c, sx, sy - h, L1);
    }
  }

  return {
    bg(c, rnd) {
      sky(c); clouds(c); distant(c); volcano(c); plume(c);
      backCliff(c, 0, 42, x => 50 + x * .85);
      backCliff(c, 198, 240, x => 94 - (x - 198) * 1.05);
      floor(c, rnd);
      volcanoFoot(c);
      backEdge(c); tree(c); nearColumns(c);
      // ── mid ground (walk lane): low, calm details
      const occ = [];
      const free = (x, y, d) => occ.every(([a, b]) => Math.abs(a - x) > d || Math.abs(b - y) > d * .6);
      const kinds = ['peb', 'peb', 'obs', 'rock', 'rock', 'tuft', 'tuft', 'lily', 'lily', 'peb'];
      for (let n = 0, tries = 0; n < 44 && tries < 600; tries++) {
        const x = 22 + Math.floor(rnd() * 196), y = 102 + Math.floor(rnd() * 33), kd = kinds[Math.floor(rnd() * kinds.length)];
        if (!free(x, y, 7)) continue; occ.push([x, y]); n++;
        const far = y < 112, mid = y < 124;
        if (kd === 'peb') { if (far) P(c, x, y, G5); else { R(c, x, y, 2, 1, G5); P(c, x, y, PU); P(c, x + 1, y + 1, G1); if (!mid) { R(c, x, y + 1, 2, 1, G4); P(c, x + 2, y + 1, G1); } } }
        else if (kd === 'obs') { if (far) { P(c, x, y, B0); } else { R(c, x, y - 1, 2, 2, B1); P(c, x, y - 1, OB); P(c, x + 1, y, B0); P(c, x + 2, y, G1); } }
        else if (kd === 'rock') { const w = far ? 2 : mid ? 3 : 4; R(c, x, y - 1, w, 1, B2); P(c, x, y - 1, B3); R(c, x, y, w, 1, B1); P(c, x + w - 1, y, B0); R(c, x + 1, y + 1, w, 1, G1); }
        else if (kd === 'tuft') { if (far) { P(c, x, y, DRY); P(c, x + 1, y - 1, G4); } else tuft(c, x, y, mid ? 2 : 3); }
        else if (kd === 'lily') { if (far) { P(c, x, y, L1); } else lily(c, x, y, rnd() < .5, false); }
      }
      // ── foreground strip: big low props
      crystals(c);
      log(c);
      pool(c);
      rock(c, 144, 146, 5, 2, true);
      rock(c, 206, 140, 4, 1, true);
      rock(c, 74, 140, 3, 1, false);
      for (const [x, y] of VENTS) vent(c, x, y);
      for (const [x, y] of ESTONES) emberStone(c, x, y);
      lily(c, 70, 143, true, true); lily(c, 134, 150, false, true); lily(c, 190, 145, true, true); lily(c, 213, 139, false, false);
      tuft(c, 33, 141, 4); tuft(c, 120, 150, 5); tuft(c, 151, 150, 4); tuft(c, 201, 143, 4); tuft(c, 160, 149, 3);
      for (let i = 0; i < 30; i++) {
        const x = 24 + Math.floor(rnd() * 192), y = 137 + Math.floor(rnd() * 14);
        if (y >= gb(x) - 2 || !free(x, y, 4)) continue;
        if (x > 154 && x < 194 && y < 148) continue; if (x > 42 && x < 66) continue; if (x > 77 && x < 114 && y > 135) continue;
        occ.push([x, y]);
        const v = rnd();
        if (v < .5) { R(c, x, y, 2, 1, PU); P(c, x, y, ST); P(c, x + 2, y, G1); }
        else if (v < .68) { R(c, x, y - 1, 2, 2, B1); P(c, x, y - 1, OB); P(c, x + 2, y, G1); }
        else if (v < .85) { R(c, x, y, 3, 1, B1); P(c, x, y - 1, B2); P(c, x + 1, y - 1, B3); P(c, x + 3, y, G0); }
        else { P(c, x, y, L1); P(c, x + 1, y, B1); }
      }
      // platform lip
      for (let x = 0; x < W; x++) { const y = gb(x) - 1; if (y >= 96) P(c, x, y, hs(x, 1, 51) < .2 ? G4 : G5); }
      dioramaEdge(c, PAL_EDGE);
      // ── soil band: basalt pebbles and glowing magma veins
      for (let i = 0; i < 26; i++) {
        const x = Math.floor(rnd() * 236), y = gb(x) + 2 + Math.floor(rnd() * 5);
        if (y + 1 >= H) continue;
        R(c, x, y, 2 + (i % 2), 1, B2); P(c, x, y, B3); P(c, x + 1, y + 1, B0);
      }
      for (const [x, y, col] of veins()) P(c, x, y, col);
    },

    anim(c, t) {
      // crater shimmer
      const cf = Math.floor(t * 6);
      for (let i = 0; i < 6; i++) P(c, 178 + Math.floor(hs(i, cf, 61) * 9), 30 + Math.floor(hs(i, cf, 62) * 3), hs(i, cf, 63) < .5 ? L4 : L3);
      // lava pulses running down the rivers
      rivers().forEach((rv, ri) => {
        rv.forEach((r, j) => {
          if (r.cool) return;
          const ph = ((j - t * 9 + ri * 5) / 13) % 1, q = ph < 0 ? ph + 1 : ph;
          if (q < .16) P(c, r.x + (r.w >> 1), r.y, q < .06 ? L4 : L3);
          else if (hs(j, Math.floor(t * 7), ri) < .05) R(c, r.x, r.y, r.w, 1, L2);
        });
      });
      // a hot glint drifting across the lava puddle at the volcano's foot
      const fx = fan().x, gx = Math.floor((t * 3.5) % 13);
      P(c, fx - 6 + gx, 98, L3); if (gx > 3 && gx < 10) P(c, fx - 5 + gx, 98, L4);
      // smoke puffs rising from the crater, drifting right (away from the meter zone)
      const puffs = [];
      for (let i = 0; i < 6; i++) puffs.push([(t / 7 + i / 6) % 1, i]);
      puffs.sort((a, b) => b[0] - a[0]);
      for (const [p, i] of puffs) {
        const x = Math.round(184 + p * 30 + Math.sin(p * 4 + i * 1.7) * 2), y = Math.round(26 - p * 28), rx = Math.round(2 + p * 8), ry = Math.round(1 + p * 5);
        ell(c, x + 1, y + 1, rx, ry, p < .18 ? L0 : A0);
        ell(c, x - 1, y - 1, rx, ry, A2);
        ell(c, x, y, Math.max(1, rx - 1), Math.max(0, ry - 1), A1);
      }
      // heat seams shimmering
      const S = floorData().seams;
      for (let i = 0; i < S.length; i++) {
        const [x, y, fg] = S[i], v = Math.sin(t * 2.6 - x * .19 + y * .41 + hs(i) * 2.5);
        if (v > .82) P(c, x, y, fg ? (v > .97 ? L4 : L3) : L2);
      }
      // lava pool: drifting crust, hot swirls, bubbles
      const { x: px, y: py } = POOL;
      for (let i = 0; i < 6; i++) R(c, px + Math.round(Math.sin(t * .35 + i * 1.05) * 9), py + Math.round(Math.sin(t * .27 + i * 2.1) * 1.6), 2, 1, i % 2 ? L0 : L1);
      for (let i = 0; i < 3; i++) { const a = t * .8 + i * 2.1; R(c, px + Math.round(Math.cos(a) * 7), py + Math.round(Math.sin(a) * 1.4), 2, 1, L3); }
      for (let i = 0; i < 4; i++) {
        const b = bubble(i, t), { x, y, p } = b;
        if (p < .3) P(c, x, y, L3);
        else if (p < .55) { R(c, x - 1, y, 3, 1, L2); P(c, x, y - 1, L4); }
        else if (p < .68) { R(c, x - 2, y, 5, 1, L2); R(c, x - 1, y - 1, 3, 1, L3); P(c, x - 1, y - 1, L4); }
        else if (p < .8) { P(c, x - 2, y - 2, L3); P(c, x + 2, y - 2, L3); P(c, x, y - 3, L2); R(c, x - 1, y, 3, 1, L1); }
      }
      // heat shimmer just above the pool rim (below the feet line, every other frame)
      const hf = Math.floor(t * 8);
      if (!(hf & 1)) for (let i = 0; i < 3; i++) P(c, 166 + Math.floor(hs(i, hf, 93) * 19), 135 + i, ST);
      // steam from the vents and the pool
      const steam = [...VENTS, [168, 138], [181, 138]];
      steam.forEach(([vx, vy], vi) => {
        for (let k = 0; k < 3; k++) {
          const p = (t / 2.6 + k / 3 + vi * .37) % 1, x = vx + Math.round(Math.sin(p * 6 + k * 2) * 1.5 + p * 3), y = vy - 2 - Math.round(p * (vi < 2 ? 22 : 11));
          if (p < .3) P(c, x, y, ST);
          else if (p < .62) { R(c, x - 1, y, 3, 1, ST); P(c, x, y - 1, ST); }
          else { P(c, x - 1, y, ST); P(c, x + 1, y - 1, ST); if (p < .8) P(c, x + 2, y + 1, ST); }
        }
      });
      // embers drifting up
      for (let i = 0; i < 21; i++) { const e = ember(i, t); if (hs(i, Math.floor(t * 10), 6) < .12) continue; P(c, e.x, e.y, e.col); }
      // glowing cracks on the tree, the log and the ember stones
      TREE_EMB.forEach(([x, y], i) => P(c, x, y, Math.sin(t * 3 + i * 1.7) > .2 ? L2 : L1));
      logBlocks().forEach((b, i) => { if (b.hot) P(c, b.hx, b.y, Math.sin(t * 2.4 + i * 1.9) > .4 ? L2 : L1); });
      ESTONES.forEach(([x, y], i) => P(c, x + 1, y - 1, Math.sin(t * 2.2 + i * 2.3) > 0 ? L3 : L2));
    },

    glow(c, t) {
      // (nothing is drawn inside y 70..134: glow paints over the sleeping Pokémon)
      // crater flanks catching the lava light: opaque checker thinning with distance
      for (let y = 32; y <= 37; y++) {
        const h = hw(y);
        for (let x = 168; x <= 196; x++) {
          if (!((x + y) & 1) || Math.abs(x - VX) > h - 1) continue;
          const d = Math.abs(x - VX) / 14 + (y - 32) / 7;
          if (hs(x, y, 95) > 1.1 - d * .8) continue;
          P(c, x, y, d < .75 ? L0 : A1);
        }
      }
      // crater bowl + inner rim
      ell(c, 182, 31, 7, 1, L1); R(c, 178, 31, 9, 1, L3); R(c, 180, 31, 5, 1, L4);
      for (let x = 175; x <= 189; x += 2) P(c, x, 29, L0);
      P(c, 174, 30, L0); P(c, 176, 30, L0); P(c, 188, 30, L0); P(c, 190, 30, L0);
      // crater light catching the underside of the youngest smoke puffs
      for (let i = 0; i < 6; i++) {
        const p = (t / 7 + i / 6) % 1; if (p > .3) continue;
        const x = Math.round(184 + p * 30 + Math.sin(p * 4 + i * 1.7) * 2), y = Math.round(26 - p * 28), rx = Math.round(2 + p * 8), ry = Math.round(1 + p * 5);
        R(c, x - rx + 2, y + ry + 1, Math.max(1, 2 * rx - 2), 1, p < .15 ? L1 : L0);
      }
      // lava rivers at full width (upper flank): L1 body + bright core, merged into vertical runs
      rivers().forEach(rv => {
        let b = null, k = null;
        const fb = () => { if (b) R(c, b.x, b.y, b.w, b.h, L1); b = null; };
        const fk = () => { if (k) R(c, k.x, k.y, 1, k.h, k.col); k = null; };
        for (const r of rv) {
          // the light fades out above the body band instead of stopping on a hard line
          const fade = r.y >= 64 ? 2 : r.y >= 57 ? 1 : 0;
          if (r.cool || inBand(r.y) || (fade === 2 && (r.y & 1))) { fb(); fk(); continue; }
          if (r.w > 1 && !fade) { if (b && b.x === r.x && b.w === r.w && b.y + b.h === r.y) b.h++; else { fb(); b = { x: r.x, y: r.y, w: r.w, h: 1 }; } } else fb();
          const cx = r.x + (r.w >> 1), col = fade === 2 ? L1 : fade ? L2 : r.w > 1 ? L3 : L2;
          if (k && k.x === cx && k.col === col && k.y + k.h === r.y) k.h++; else { fk(); k = { x: cx, y: r.y, h: 1, col }; }
        }
        fb(); fk();
      });
      // volcano light on the faces of the right columns that look at it
      for (let y = 60; y < 70; y += 2) P(c, 225, y, L0);
      for (let y = 41; y < 70; y += 3) P(c, 232, y, L0);
      // lava pool: bright surface, inner faces of the ring stones, lit ground around it
      const { x: px, y: py } = POOL;
      ell(c, px, py, 13, 3, L1); ell(c, px + 1, py, 10, 2, L2); ell(c, px + 2, py, 6, 1, L3); R(c, px - 1, py, 4, 1, L4);
      for (let i = 0; i < 4; i++) { const b = bubble(i, t); if (b.p < .68) P(c, b.x, b.y - 1, L4); }
      for (const [sx, sy, , h] of stones()) if (sy < py) P(c, sx, sy + h, L1); else P(c, sx, sy - h, L2);
      const RG = poolRing(); for (let i = 0; i < RG.length; i += 2) P(c, RG[i], RG[i + 1], L0);
      // front seams (half of them); the lane seams stay dark under the sleeping Pokémon
      const S = floorData().seams;
      for (let i = 0; i < S.length; i++) {
        const [x, y, fg] = S[i];
        if (!fg || (i % 2)) continue;
        P(c, x, y, Math.sin(t * 2.6 - x * .19 + y * .41 + hs(i) * 2.5) > .6 ? L3 : L2);
      }
      // veins in the soil
      const VN = veins();
      for (let i = 0; i < VN.length; i += 2) if (VN[i][2] !== L0) P(c, VN[i][0], VN[i][1], L2);
      // embers as moving points of light (outside the body band)
      for (let i = 0; i < 21; i++) { const e = ember(i, t); if (hs(i, Math.floor(t * 10), 6) < .12 || inBand(e.y)) continue; P(c, e.x, e.y, e.p < .5 ? L4 : L3); }
      TREE_EMB.forEach(([x, y], i) => { if (!inBand(y)) P(c, x, y, Math.sin(t * 3 + i * 1.7) > .2 ? L3 : L2); });
      logBlocks().forEach((b, i) => { if (b.hot) P(c, b.hx, b.y, Math.sin(t * 2.4 + i * 1.9) > .4 ? L3 : L2); });
      ESTONES.forEach(([x, y]) => P(c, x + 1, y - 1, L3));
      for (const [x, y] of VENTS) P(c, x, y, L2);
      // stars
      for (const [x, y, k] of [[8, 2, 0], [27, 6, 1], [41, 3, 2], [58, 10, 3], [104, 1, 4], [150, 2, 5], [14, 27, 6], [36, 40, 7]]) if (Math.sin(t * 1.7 + k * 2.3) > -.4) P(c, x, y, k % 3 ? ST : L4);
    },
  };
})();
