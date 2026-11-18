// ============================================================================
// the café: room, furniture, decorations, lights, colliders and the spots where cats like to sit
// ============================================================================
// Room interior: x -6..6, z -4.5..4.5, floor at y 0, ceiling at 3. The sun comes in through three windows in the
// front wall (+z); the bar is against the brick back wall (-z), the sofa corner on the right (+x), books on the left.
const RX = 6, RZ = 4.5, RH = 3;
const SUN = (() => { const l = hypot(0.35, 0.42, 1); return [0.35 / l, 0.42 / l, 1 / l]; })();
const W = new Mesh();       // everything that never moves
const SKYM = new Mesh();    // the outdoor backdrop (drawn, but casts no shadow)
const PROPS = new Mesh();   // movable props (see below)
const COL = [];             // colliders: {x, z, r} or {x0, z0, x1, z1}; cat: false = cats walk under it
const PERCH = [];           // {x, y, z, yaw, sleep}
const BEDS = [];            // floor beds {x, z}
const LIGHTS = [];          // [x, y, z, radius, r, g, b, diffuseOnly]
const ARTS = [];             // canvases for the texture array

const C = {
  oak: hex(0xa8754a), dark: hex(0x5a3a24), walnut: hex(0x4a2e1c), plaster: hex(0xefdcc0), ceil: hex(0xf1e6d4),
  brick: hex(0xa0583a), sage: hex(0x8fa58b), white: hex(0xf2eee6), cream: hex(0xe9dcc4), black: hex(0x1e1c1b),
  brass: hex(0xe0b060), iron: hex(0x2a2a2a), teal: hex(0x2c6a68), mustard: hex(0xd9a031), terracotta: hex(0xc0623c),
  plush: hex(0xd8c8ae), plushG: hex(0x9a8f84), sisal: hex(0xb9a07a), leaf: hex(0x3f7a35), leaf2: hex(0x5d9a40),
  pot: hex(0xb86a45), coffee: hex(0x5a3218), leather: hex(0x7a4a2e), green: hex(0x2f4a3a),
};
const at = (x, y, z, yaw = 0) => place(x, y, z, yaw);
const col = (o) => COL.push(o);

// ---------------------------------------------------------------- shell of the room
box(W, at(0, -0.05, 0), 2 * RX + 0.5, 0.1, 2 * RZ + 0.5, C.oak, FLOOR);
box(W, at(0, RH + 0.05, 0), 2 * RX + 0.5, 0.1, 2 * RZ + 0.5, C.ceil, CEIL);
const T = 0.25;
const wb = (x0, x1, y0, y1, z0, z1, c, m) => box(W, at((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), x1 - x0, y1 - y0, z1 - z0, c, m);
wb(-RX - T, RX + T, 0, RH, -RZ - T, -RZ, C.brick, BRICK);              // back: exposed brick
wb(-RX - T, -RX, 0, RH, -RZ, RZ, C.plaster, WALL);                     // left
wb(RX, RX + T, 0, RH, -RZ, 2.6, C.plaster, WALL);                      // right, with the door
wb(RX, RX + T, 0, RH, 3.6, RZ, C.plaster, WALL);
wb(RX, RX + T, 2.2, RH, 2.6, 3.6, C.plaster, WALL);
const WIN = [-3.6, 0, 3.6], WW = 0.95, WY0 = 0.75, WY1 = 2.45;          // front: three tall windows
wb(-RX - T, RX + T, 0, WY0, RZ, RZ + T, C.plaster, WALL);
wb(-RX - T, RX + T, WY1, RH, RZ, RZ + T, C.plaster, WALL);
{ let x = -RX - T; for (const c of WIN) { wb(x, c - WW, WY0, WY1, RZ, RZ + T, C.plaster, WALL); x = c + WW; } wb(x, RX + T, WY0, WY1, RZ, RZ + T, C.plaster, WALL); }

// sage wainscoting with a rail, and dark skirting, on the plaster walls
const wains = (M, len, h) => {
  rbox(W, mat(M, (m) => tr(m, 0, h / 2, 0.012)), len, h, 0.024, 0.004, C.sage, PAINT);
  for (let x = -len / 2 + 0.35; x < len / 2 - 0.2; x += 0.7) rbox(W, mat(M, (m) => tr(m, x + 0.17, h / 2 + 0.02, 0.026)), 0.5, h - 0.28, 0.012, 0.004, shade(C.sage, 1.06), PAINT);
  rbox(W, mat(M, (m) => tr(m, 0, h, 0.03)), len, 0.045, 0.06, 0.012, shade(C.sage, 0.9), PAINT);
  rbox(W, mat(M, (m) => tr(m, 0, 0.05, 0.03)), len, 0.1, 0.035, 0.006, C.walnut, PAINT);
};
wains(at(-RX, 0, 0, PI / 2), 2 * RZ, 0.95);
wains(at(RX, 0, -0.95, -PI / 2), 7.1, 0.95);
wains(at(RX, 0, 4.05, -PI / 2), 0.9, 0.95);
wains(at(0, 0, RZ, PI), 2 * RX, WY0 - 0.04);
// ceiling beams
for (const z of [-3.3, -1.1, 1.1, 3.3]) rbox(W, at(0, RH - 0.11, z), 2 * RX, 0.22, 0.18, 0.01, C.walnut, WOOD);

// ---------------------------------------------------------------- windows: frames, sills, curtains, and the street outside
function curtain(x, z, w, c) {
  for (const s of [1, -1]) W.grid(at(x, 0, z), 18, 3, (u, v) => {
    const X = (u - 0.5) * w, Z = sin(u * PI * 6) * 0.035 * (0.6 + 0.4 * v), dz = cos(u * PI * 6) * 0.035 * PI * 6 / w;
    const l = hypot(dz, 1); return [X, 0.04 + v * 2.62, Z - s * 0.004, (-dz / l) * -s, 0, -s / l];
  }, c, FABRIC);
}
for (const c of WIN) {
  const z = RZ + 0.13, fw = 0.065;
  for (const s of [-1, 1]) rbox(W, at(c + s * (WW - fw / 2), (WY0 + WY1) / 2, z), fw, WY1 - WY0, 0.09, 0.008, C.white, PAINT);
  rbox(W, at(c, WY1 - fw / 2, z), 2 * WW, fw, 0.09, 0.008, C.white, PAINT);
  rbox(W, at(c, 1.95, z), 2 * WW, 0.045, 0.06, 0.006, C.white, PAINT);
  rbox(W, at(c, 1.32, z), 2 * WW, 0.045, 0.06, 0.006, C.white, PAINT);
  rbox(W, at(c, (WY0 + WY1) / 2, z), 0.045, WY1 - WY0, 0.06, 0.006, C.white, PAINT);
  rbox(W, at(c, WY0 - 0.005, RZ + 0.03), 2 * WW + 0.2, 0.05, 0.36, 0.012, C.white, PAINT); // inner sill: a favourite cat spot
  cyl(W, place(c + WW + 0.45, 2.72, RZ - 0.12, 0, 0, PI / 2), 0.014, 2 * WW + 0.9, C.brass, METAL, 10);
  for (const s of [-1, 1]) curtain(c + s * (WW + 0.22), RZ - 0.12, 0.42, C.cream);
}
PERCH.push({ x: 0.3, y: WY0 + 0.02, z: RZ - 0.06, yaw: 0, sleep: 0.6 }, { x: -3.8, y: WY0 + 0.02, z: RZ - 0.06, yaw: PI, sleep: 0.3 });
box(SKYM, at(0, 4, 0), 80, 40, 80, C.white, SKY);
for (let i = 0; i < SKYM.i.length; i += 3) { const t = SKYM.i[i]; SKYM.i[i] = SKYM.i[i + 1]; SKYM.i[i + 1] = t; } // seen from inside

// ---------------------------------------------------------------- the door (closed: the cats must stay in)
{
  const x = RX - 0.03, z = 3.1;
  rbox(W, at(x, 1.08, z), 0.05, 2.16, 0.98, 0.006, C.green, PAINT);
  for (const [y, h] of [[0.5, 0.62]]) rbox(W, at(x - 0.03, y, z), 0.02, h, 0.7, 0.008, shade(C.green, 1.1), PAINT);
  card(W, at(x - 0.03, 1.55, z, -PI / 2), 0.66, 0.72, C.white, SKY, false);
  for (const s of [-1, 1]) rbox(W, at(x - 0.045, 1.55, z + s * 0.35), 0.04, 0.8, 0.05, 0.006, C.green, PAINT);
  for (const s of [-1, 1]) rbox(W, at(x - 0.045, 1.55 + s * 0.38, z), 0.04, 0.05, 0.74, 0.006, C.green, PAINT);
  sphere(W, at(x - 0.07, 1.0, z - 0.4), 0.03, C.brass, METAL, 12);
  for (const s of [-1, 1]) rbox(W, at(x - 0.02, 1.1, z + s * 0.52), 0.06, 2.22, 0.07, 0.01, C.white, PAINT);
  rbox(W, at(x - 0.02, 2.22, z), 0.06, 0.07, 1.1, 0.01, C.white, PAINT);
  card(W, at(x - 0.065, 1.08, z, -PI / 2), 0.42, 0.21, [4 / 255, 0, 0], ART, false); // "please don't let the cats out"
  rbox(W, at(x - 0.6, 0.006, z), 0.6, 0.012, 0.9, 0.004, hex(0x7a5b3a), PLUSH);  // doormat
}

// ---------------------------------------------------------------- the bar
{
  const x0 = -5.2, x1 = 0.6, zf = -3.2, zb = -3.85, h = 1.0, cx = (x0 + x1) / 2, L = x1 - x0;
  rbox(W, at(cx, h / 2, (zf + zb) / 2), L, h, zf - zb, 0.01, C.walnut, WOOD);
  for (let x = x0 + 0.06; x < x1 - 0.04; x += 0.115) rbox(W, at(x, 0.5, zf + 0.012), 0.1, 0.78, 0.024, 0.008, jitter(C.dark, 0.15), WOOD);
  rbox(W, at(cx, 0.05, zf + 0.005), L, 0.1, 0.02, 0.004, C.iron, METAL);
  rbox(W, at(cx, h + 0.022, -3.5), L + 0.2, 0.045, 0.78, 0.015, C.white, MARBLE);
  cyl(W, place(x1 + 0.05, 0.2, zf + 0.16, 0, 0, PI / 2), 0.022, L + 0.1, C.brass, METAL, 12);
  for (let x = x0 + 0.3; x < x1; x += 1.2) cyl(W, at(x, 0, zf + 0.16), 0.012, 0.2, C.brass, METAL, 8);
  // back counter with the espresso machine
  rbox(W, at(cx, 0.45, -4.27), L, 0.9, 0.44, 0.01, C.dark, WOOD);
  rbox(W, at(cx, 0.92, -4.27), L + 0.05, 0.04, 0.48, 0.01, C.black, MARBLE);
  {
    const ex = -0.9, ez = -4.25;
    rbox(W, at(ex, 1.17, ez), 0.75, 0.46, 0.42, 0.05, hex(0xb8bcbf), METAL);
    rbox(W, at(ex, 1.42, ez), 0.7, 0.04, 0.38, 0.01, C.iron, METAL);
    for (const s of [-1, 1]) { cyl(W, at(ex + s * 0.17, 1.0, ez + 0.2), 0.035, 0.08, C.iron, METAL, 12); cyl(W, place(ex + s * 0.17, 1.03, ez + 0.2, 0, PI / 2, 0), 0.008, 0.18, C.iron, PLAIN, 6); }
    for (let i = 0; i < 4; i++) cyl(W, at(ex - 0.25 + i * 0.16, 1.44, ez - 0.05), 0.04, 0.08, i & 1 ? C.white : C.terracotta, CERAMIC, 14);
    sphere(W, at(ex + 0.22, 1.3, ez + 0.22), 0.025, C.iron, METAL, 10);
  }
  // grinder, jars, syrup bottles, cups on the back counter
  cyl(W, at(-1.6, 0.94, -4.25), 0.08, 0.3, C.iron, METAL, 16); cyl(W, at(-1.6, 1.24, -4.25), 0.1, 0.18, hex(0x5a3a1a), GLASS, 16, 3, 0.06);
  const bottle = (x, y, z, c, s = 1) => lathe(W, at(x, y, z), [[0, 0], [0.035 * s, 0], [0.037 * s, 0.2 * s], [0.012 * s, 0.27 * s], [0.012 * s, 0.31 * s], [0, 0.31 * s]], 12, c, GLASS);
  [0x8a1a1a, 0x2a5a1a, 0xc08a20, 0x5a2a6a, 0x1a3a6a, 0xa05010].forEach((c, i) => bottle(-2.3 - i * 0.11, 0.94, -4.3 + (i & 1) * 0.08, hex(c)));
  const jar = (x, y, z, c, h = 0.18) => { cyl(W, at(x, y, z), 0.06, h, c, GLASS, 14); cyl(W, at(x, y + h, z), 0.064, 0.025, C.walnut, WOOD, 14); };
  jar(-3.4, 0.94, -4.25, hex(0x6a3a1a)); jar(-3.6, 0.94, -4.3, hex(0xd8c8a0)); jar(-3.8, 0.94, -4.25, hex(0x3a2a1a), 0.22);
  const cup = (M, c) => {
    lathe(W, M, [[0, 0], [0.032, 0.002], [0.042, 0.06], [0.045, 0.075], [0.04, 0.075], [0.037, 0.03], [0, 0.028]], 16, c, CERAMIC);
    torus(W, mat(M, (m) => rx(tr(m, 0.048, 0.045, 0), PI / 2)), 0.014, 0.004, c, CERAMIC, 10, 6);
    lathe(W, M, [[0, -0.008], [0.07, -0.006], [0.075, 0.0], [0, 0.0]], 18, c, CERAMIC);
  };
  for (let i = 0; i < 5; i++) for (let k = 0; k < 2; k++) cup(at(-4.2 + i * 0.11, 0.95 + k * 0.085, -4.15, i * 0.7), k ? C.white : C.cream);
  // things on the bar top
  const bt = h + 0.045;
  { // cake stand with a dome-shaped cake
    lathe(W, at(-1.9, bt, -3.45), [[0, 0], [0.08, 0], [0.02, 0.02], [0.02, 0.12], [0.16, 0.13], [0.16, 0.14], [0, 0.14]], 20, C.white, CERAMIC);
    lathe(W, at(-1.9, bt + 0.14, -3.45), [[0, 0], [0.11, 0], [0.11, 0.07], [0.1, 0.085], [0, 0.09]], 20, hex(0xf3c6c8), PLAIN);
    for (let i = 0; i < 8; i++) sphere(W, at(-1.9 + cos(i * 0.785) * 0.075, bt + 0.24, -3.45 + sin(i * 0.785) * 0.075), 0.013, hex(0xc0182a), CERAMIC, 8);
  }
  cup(at(-3.0, bt + 0.006, -3.4, 1), C.white); cup(at(-4.1, bt + 0.006, -3.35, 2), C.terracotta);
  lathe(W, at(-0.2, bt, -3.55), [[0, 0], [0.06, 0], [0.065, 0.14], [0.055, 0.16], [0, 0.16]], 16, hex(0xcfd9d6), GLASS); // tip jar
  for (let i = 0; i < 9; i++) cyl(W, place(-0.2 + rr(-0.03, 0.03), bt + 0.01 + i * 0.006, -3.55 + rr(-0.03, 0.03), rr(0, 3), rr(-0.3, 0.3)), 0.012, 0.003, C.brass, METAL, 10);
  // shelves on the brick, with mugs, jars, books and little plants
  for (const [sx0, sx1] of [[-5.0, -3.2], [-0.8, 0.6]]) for (const y of [1.55, 2.02]) {
    rbox(W, at((sx0 + sx1) / 2, y, -4.38), sx1 - sx0, 0.035, 0.24, 0.006, C.oak, WOOD);
    for (const x of [sx0 + 0.15, sx1 - 0.15]) rbox(W, at(x, y - 0.08, -4.42), 0.025, 0.14, 0.16, 0.004, C.iron, METAL);
    for (let x = sx0 + 0.12; x < sx1 - 0.1;) {
      const k = rnd();
      if (k < 0.35) { cup(at(x, y + 0.018, -4.38, rr(0, 6)), jitter(pick([C.white, C.cream, C.terracotta, C.teal, C.mustard]), 0.2)); x += 0.13; }
      else if (k < 0.6) { jar(x, y + 0.018, -4.38, hex(pick([0x6a3a1a, 0xd8c8a0, 0x8a6a2a, 0x3a2a1a])), rr(0.12, 0.2)); x += 0.15; }
      else if (k < 0.85) { const n = 3 + (rnd() * 5) | 0; for (let i = 0; i < n; i++) { const bh = rr(0.15, 0.22); rbox(W, place(x + i * 0.035, y + 0.018 + bh / 2, -4.4, 0, 0, i === n - 1 ? 0.25 : 0), 0.03, bh, rr(0.13, 0.17), 0.003, jitter(hex(pick([0x7a2a2a, 0x2a4a6a, 0x3a5a3a, 0xc0a060, 0x5a3a5a, 0xd8d0c0])), 0.2), PLAIN); } x += n * 0.035 + 0.1; }
      else { pottedPlant(x + 0.03, y + 0.018, -4.38, 0.06, 0.08, 7, 0.12); x += 0.18; }
    }
  }
  // neon sign over the bar, chalkboard menu to the right
  card(W, at(-2.1, 2.1, -RZ + 0.03), 1.8, 0.9, [0, 1, 0], ART, false);
  LIGHTS.push([-2.1, 2.0, -4.05, 2.8, 1.6, 0.25, 0.75, 1]);
  rbox(W, at(2.2, 1.75, -RZ + 0.02), 1.5, 0.85, 0.035, 0.008, C.walnut, WOOD);
  card(W, at(2.2, 1.75, -RZ + 0.04), 1.38, 0.73, [1 / 255, 0, 0], ART, false);
  col({ x0: x0 - 0.05, z0: -RZ, x1: x1 + 0.05, z1: zf + 0.18, cat: true });
  PERCH.push({ x: -4.65, y: bt, z: -3.5, yaw: -PI * 0.5, sleep: 0.5 }, { x: 0.25, y: bt, z: -3.45, yaw: -PI * 0.5, sleep: 0.2 });
  for (const x of [-4.3, -3.2, -2.1, -1.0]) stool(x, -2.75);
}
function stool(x, z) {
  lathe(W, at(x, 0, z), [[0, 0], [0.2, 0], [0.2, 0.015], [0, 0.02]], 20, C.iron, METAL);
  cyl(W, at(x, 0.02, z), 0.025, 0.66, C.iron, METAL, 10, 0);
  torus(W, at(x, 0.28, z), 0.15, 0.01, C.brass, METAL, 20, 6);
  rbox(W, at(x, 0.7, z), 0.38, 0.08, 0.38, 0.035, C.leather, FABRIC);
  col({ x, z, r: 0.22, cat: false });
}

// ---------------------------------------------------------------- plants
function pottedPlant(x, y, z, pr, ph, nl, ll, big = 0) {
  lathe(W, at(x, y, z), [[0, 0], [pr * 0.75, 0], [pr, ph * 0.9], [pr * 1.08, ph], [pr * 0.95, ph], [0, ph * 0.85]], 16, jitter(C.pot, 0.2), TERRA);
  for (let i = 0; i < nl; i++) {
    const a = (i / nl) * TAU + rr(-0.3, 0.3), up = big ? rr(0.4, 1.3) : rr(0.3, 1.0), st = big ? rr(0.4, 1.1) : 0;
    const bx = x + cos(a) * st * 0.12, bz = z - sin(a) * st * 0.12, by = y + ph + st;
    if (big) { // stem from the soil up to the leaf
      const sx = bx - x, sy = by - (y + ph * 0.8), sz = bz - z, sl = hypot(sx, sy, sz);
      const M = M4(); tr(M, x, y + ph * 0.8, z); ry(M, atan2(-sz, sx)); rz(M, atan2(sy, hypot(sx, sz)) - PI / 2); cyl(W, M, 0.007, sl, shade(C.leaf, 0.8), LEAF, 5, 0);
    }
    leaf(W, place(bx, by, bz, a, rr(-0.4, 0.4), up), ll * rr(0.75, 1.15), ll * (big ? 0.7 : 0.45), jitter(i & 1 ? C.leaf : C.leaf2, 0.25), 0.45, 0.25);
  }
}
pottedPlant(5.45, 0, 4.05, 0.2, 0.42, 11, 0.42, 1); col({ x: 5.45, z: 4.05, r: 0.35, cat: true });
pottedPlant(-5.45, 0, -0.5, 0.18, 0.38, 10, 0.38, 1); col({ x: -5.45, z: -0.5, r: 0.32, cat: true });
pottedPlant(1.2, 0, -4.05, 0.17, 0.36, 9, 0.36, 1); col({ x: 1.2, z: -4.05, r: 0.3, cat: true });
// hanging pothos by the windows
for (const hx of [-1.8, 1.8]) {
  const y = 2.25, z = RZ - 0.35;
  cyl(W, at(hx, y + 0.2, z), 0.004, RH - y - 0.2, C.iron, PLAIN, 4, 0);
  lathe(W, at(hx, y, z), [[0, 0], [0.08, 0.01], [0.12, 0.16], [0.13, 0.2], [0, 0.18]], 14, C.white, CERAMIC);
  for (let v = 0; v < 7; v++) {
    const a = (v / 7) * TAU + rr(-0.3, 0.3), len = rr(0.4, 1.2);
    let px = hx + cos(a) * 0.11, pz = z - sin(a) * 0.11, py = y + 0.19;
    for (let s = 0; s < len / 0.07; s++) {
      px += cos(a) * 0.012 + rr(-0.01, 0.01); pz -= sin(a) * 0.012; py -= 0.065;
      leaf(W, place(px, py, pz, rr(0, TAU), rr(-0.6, 0.6), rr(-0.3, 0.6)), rr(0.06, 0.09), 0.06, jitter(C.leaf2, 0.3), 0.2, 0.1);
    }
  }
}

// ---------------------------------------------------------------- tables, chairs and things on them
function chair(x, z, yaw) {
  const M = at(x, 0, z, yaw), c = C.dark;
  rbox(W, mat(M, (m) => tr(m, 0, 0.46, 0)), 0.42, 0.04, 0.42, 0.015, c, WOOD);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(W, mat(M, (m) => rz(rx(tr(m, sx * 0.18, 0, sz * 0.18), -sz * 0.04), sx * 0.04)), 0.016, 0.45, c, WOOD, 8, 0);
  for (const sz of [-1, 1]) cyl(W, mat(M, (m) => tr(m, -0.18, 0.47, sz * 0.18)), 0.015, 0.42, c, WOOD, 8, 2);
  rbox(W, mat(M, (m) => rz(tr(m, -0.19, 0.83, 0), 0.08)), 0.03, 0.09, 0.42, 0.012, c, WOOD);
  rbox(W, mat(M, (m) => rz(tr(m, -0.185, 0.65, 0), 0.06)), 0.02, 0.03, 0.38, 0.008, c, WOOD);
  col({ x: x - cos(yaw) * 0.02, z: z + sin(yaw) * 0.02, r: 0.24, cat: false });
}
function table(x, z) {
  lathe(W, at(x, 0, z), [[0, 0], [0.24, 0], [0.24, 0.02], [0.05, 0.05], [0, 0.05]], 24, C.iron, METAL);
  cyl(W, at(x, 0.05, z), 0.035, 0.66, C.iron, METAL, 12, 0);
  cyl(W, at(x, 0.7, z), 0.42, 0.04, C.oak, WOOD, 32);
  col({ x, z, r: 0.46, cat: false });
}
function latte(x, y, z, a) {
  lathe(W, at(x, y, z, a), [[0, 0], [0.032, 0.002], [0.042, 0.06], [0.045, 0.075], [0.04, 0.075], [0.037, 0.03], [0, 0.028]], 16, C.white, CERAMIC);
  torus(W, mat(at(x, y, z, a), (m) => rx(tr(m, 0.048, 0.045, 0), PI / 2)), 0.014, 0.004, C.white, CERAMIC, 10, 6);
  lathe(W, at(x, y, z), [[0, -0.008], [0.07, -0.006], [0.075, 0.0], [0, 0.0]], 18, C.white, CERAMIC);
  lathe(W, at(x, y + 0.064, z), [[0.039, 0], [0, 0.001]], 16, hex(0xb07a48), PLAIN);
  sphere(W, at(x, y + 0.0655, z), 0.012, hex(0xf0e2cc), PLAIN, 8, 0.05);
}
const TABLES = [[-3.4, 2.5], [-0.9, 0.3], [1.9, 2.5]];
for (const [x, z] of TABLES) {
  table(x, z);
  for (const a of [rr(-0.4, 0.4), PI + rr(-0.4, 0.4)]) chair(x + cos(a) * 0.62, z - sin(a) * 0.62, a + PI);
  latte(x + rr(-0.15, 0.15), 0.748, z + rr(-0.2, 0.2), rr(0, 6));
  lathe(W, at(x + 0.15, 0.74, z - 0.12), [[0, 0], [0.03, 0], [0.04, 0.05], [0.015, 0.11], [0.012, 0.14], [0, 0.14]], 12, hex(0x9ac4c0), GLASS);
  for (let i = 0; i < 3; i++) { // little flowers: five petals around a yellow middle
    const a = rr(0, TAU), fx = x + 0.15 + cos(a) * 0.03, fy = 0.93 + i * 0.025, fz = z - 0.12 - sin(a) * 0.03, pc = hex(pick([0xf47a8a, 0xffffff, 0xb08ae0]));
    const M = M4(); tr(M, x + 0.15, 0.86, z - 0.12); ry(M, a); rz(M, atan2(fy - 0.86, 0.03) - PI / 2); cyl(W, M, 0.0018, hypot(fy - 0.86, 0.03), C.leaf, LEAF, 4, 0);
    for (let k = 0; k < 5; k++) { const b = (k / 5) * TAU; sphere(W, place(fx + cos(b) * 0.009, fy, fz - sin(b) * 0.009, -b), 0.0075, pc, PLAIN, 6, 0.35); }
    sphere(W, at(fx, fy + 0.002, fz), 0.004, hex(0xffc830), PLAIN, 6);
  }
}

// ---------------------------------------------------------------- sofa corner (right wall)
{
  const x = 5.55, z = -0.1, c = C.teal, L = 2.6;
  rbox(W, at(x, 0.26, z), 0.82, 0.32, L, 0.05, c, FABRIC);
  for (const k of [-1, 0, 1]) rbox(W, at(x - 0.08, 0.5, z + k * 0.82), 0.66, 0.16, 0.8, 0.06, jitter(c, 0.05), FABRIC);
  rbox(W, at(x + 0.32, 0.72, z), 0.22, 0.6, L, 0.09, c, FABRIC);
  for (const s of [-1, 1]) rbox(W, at(x, 0.58, z + s * (L / 2 - 0.08)), 0.82, 0.32, 0.18, 0.08, c, FABRIC);
  for (const s of [-1, 1]) for (const t of [-1, 1]) cyl(W, at(x + s * 0.32, 0, z + t * 1.2), 0.02, 0.1, C.brass, METAL, 8);
  rbox(W, place(x + 0.1, 0.78, z - 0.85, 0, 0, -0.35), 0.14, 0.4, 0.42, 0.12, C.mustard, FABRIC);
  rbox(W, place(x + 0.1, 0.78, z + 0.9, 0.2, 0, -0.3), 0.14, 0.36, 0.38, 0.11, C.terracotta, FABRIC);
  col({ x0: x - 0.42, z0: z - L / 2, x1: RX, z1: z + L / 2, cat: true });
  PERCH.push({ x: x - 0.05, y: 0.58, z: z + 0.05, yaw: PI * 0.5, sleep: 0.8 });
  // rug and a low coffee table
  rbox(W, at(4.1, 0.006, -0.1), 2.0, 0.012, 3.0, 0.004, C.white, RUG);
  cyl(W, at(4.25, 0.36, -0.1), 0.45, 0.04, C.walnut, WOOD, 32);
  for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + 0.4; cyl(W, at(4.25 + cos(a) * 0.32, 0, -0.1 + sin(a) * 0.32), 0.02, 0.36, C.walnut, WOOD, 8, 0); }
  latte(4.1, 0.405, 0.0, 1.0);
  for (let i = 0; i < 3; i++) rbox(W, place(4.35, 0.41 + i * 0.022, -0.25, 0.3 + i * 0.4), 0.22, 0.02, 0.16, 0.003, jitter(hex(pick([0x7a2a2a, 0x2a4a6a, 0xd8d0c0])), 0.2), PLAIN);
  col({ x: 4.25, z: -0.1, r: 0.48, cat: false });
  // floor lamp
  lathe(W, at(5.55, 0, -1.9), [[0, 0], [0.16, 0], [0.16, 0.02], [0, 0.03]], 20, C.iron, METAL);
  cyl(W, at(5.55, 0.02, -1.9), 0.012, 1.38, C.brass, METAL, 8, 0);
  lathe(W, at(5.55, 1.3, -1.9), [[0.24, 0], [0.24, 0.005], [0.15, 0.32], [0.15, 0.325]], 24, C.cream, FABRIC);
  lathe(W, at(5.55, 1.3, -1.9), [[0.15, 0.32], [0.235, 0.004]], 24, shade(C.cream, 1.2), FABRIC);
  sphere(W, at(5.55, 1.42, -1.9), 0.045, hex(0xffd9a0), EMIT, 12);
  LIGHTS.push([5.55, 1.42, -1.9, 4.5, 2.6, 1.6, 0.85, 0]);
  col({ x: 5.55, z: -1.9, r: 0.26, cat: true });
}
// paintings
const framed = (M, w, h, layer) => {
  rbox(W, M, w + 0.1, h + 0.1, 0.04, 0.01, C.walnut, WOOD);
  card(W, mat(M, (m) => tr(m, 0, 0, 0.021)), w, h, [layer / 255, 0, 0], ART, false);
};
framed(at(RX - 0.02, 1.8, -0.1, -PI / 2), 1.3, 0.65, 2);
framed(at(-RX + 0.02, 1.75, -0.45, PI / 2), 0.9, 0.45, 3);
framed(at(1.8, 1.85, RZ - 0.02, PI), 0.66, 0.33, 5);

// ---------------------------------------------------------------- cat furniture
function catTree(x, z, levels) {
  rbox(W, at(x, 0.04, z), 0.85, 0.08, 0.7, 0.03, C.plushG, PLUSH);
  let px = x - 0.18, pz = z - 0.12, y = 0.08;
  for (const [h, dx, dz, w, d, top] of levels) {
    cyl(W, at(px, y, pz), 0.055, h, C.sisal, SISAL, 18, 0);
    y += h;
    const cx = px + dx, cz = pz + dz;
    rbox(W, at(cx, y + 0.025, cz), w, 0.05, d, 0.022, C.plushG, PLUSH);
    if (top) { torus(W, at(cx, y + 0.07, cz), 0.19, 0.045, C.plush, PLUSH, 28, 10); PERCH.push({ x: cx, y: y + 0.05, z: cz, yaw: rr(0, TAU), sleep: 1 }); }
    else PERCH.push({ x: cx + dx * 0.4, y: y + 0.05, z: cz, yaw: dz > 0 ? -PI / 2 : PI / 2, sleep: 0.3 });
    y += 0.05; px = cx - dx * 0.6; pz = cz - dz * 0.4;
  }
}
catTree(4.35, -3.6, [[0.55, 0.12, 0.08, 0.6, 0.45, 0], [0.55, -0.1, 0.1, 0.52, 0.42, 0], [0.5, 0.05, -0.05, 0.5, 0.48, 1]]);
// condo box with a round door, and a pompom on a string
rbox(W, at(4.62, 0.27, -3.75), 0.4, 0.38, 0.4, 0.03, C.plushG, PLUSH);
{ const M = place(4.62, 0.27, -3.545, 0, PI / 2, 0); lathe(W, M, [[0.12, 0], [0, 0.002]], 20, hex(0x0a0807), PLAIN); }
cyl(W, at(4.55, 0.95, -3.35), 0.002, 0.25, C.cream, PLAIN, 4, 0); sphere(W, at(4.55, 0.93, -3.35), 0.035, hex(0xe04a6a), YARN, 12);
col({ x0: 3.9, z0: -RZ, x1: 4.85, z1: -3.2, cat: true });
catTree(-5.35, 3.65, [[0.6, 0.15, -0.05, 0.5, 0.45, 0], [0.55, 0.0, 0.05, 0.48, 0.48, 1]]);
col({ x: -5.35, z: 3.65, r: 0.45, cat: true });
// wall steps on the left wall
[[-3.3, 0.85], [-2.65, 1.3], [-2.0, 1.75], [-1.35, 2.2]].forEach(([z, y], i) => {
  rbox(W, at(-RX + 0.16, y, z), 0.32, 0.04, 0.5, 0.012, C.oak, WOOD);
  rbox(W, at(-RX + 0.16, y + 0.025, z), 0.3, 0.012, 0.48, 0.005, C.plushG, PLUSH);
  for (const s of [-1, 1]) rbox(W, at(-RX + 0.04, y - 0.08, z + s * 0.18), 0.06, 0.14, 0.025, 0.004, C.iron, METAL);
  if (i === 1 || i === 3) PERCH.push({ x: -RX + 0.17, y: y + 0.03, z, yaw: i === 3 ? -PI / 2 : PI / 2, sleep: 0.5 });
});
// bookshelf
{
  const x = -RX + 0.18, z0 = 0.25, z1 = 2.05, h = 2.0, cz = (z0 + z1) / 2;
  for (const z of [z0, z1]) rbox(W, at(x, h / 2, z), 0.36, h, 0.03, 0.006, C.dark, WOOD);
  rbox(W, at(x - 0.17, h / 2, cz), 0.015, h, z1 - z0, 0.003, C.dark, WOOD);
  for (let s = 0; s <= 5; s++) {
    const y = 0.04 + s * 0.39;
    rbox(W, at(x, y, cz), 0.36, 0.03, z1 - z0, 0.006, C.dark, WOOD);
    if (s === 5) break;
    for (let z = z0 + 0.04; z < z1 - 0.08;) {
      if (rnd() < 0.12) { pottedPlant(x, y + 0.015, z + 0.09, 0.055, 0.08, 6, 0.12); z += 0.2; continue; }
      const n = 4 + (rnd() * 9) | 0;
      for (let i = 0; i < n && z < z1 - 0.06; i++) {
        const bw = rr(0.025, 0.045), bh = rr(0.2, 0.3), lean = i === n - 1 && rnd() < 0.4 ? 0.2 : 0;
        rbox(W, place(x + 0.02, y + 0.015 + bh / 2, z + bw / 2, 0, lean, 0), rr(0.17, 0.24), bh, bw, 0.004, jitter(hex(pick([0x7a2a2a, 0x2a4a6a, 0x3a5a3a, 0xc0a060, 0x5a3a5a, 0xd8d0c0, 0x8a4a2a, 0x2a2a3a])), 0.25), PLAIN);
        z += bw + 0.002;
      }
      z += 0.06;
    }
  }
  pottedPlant(x, h + 0.055, z0 + 0.25, 0.07, 0.1, 7, 0.16);
  col({ x0: -RX, z0: z0 - 0.02, x1: -RX + 0.38, z1: z1 + 0.02, cat: true });
  PERCH.push({ x: x + 0.02, y: h + 0.055, z: cz + 0.35, yaw: PI / 2, sleep: 0.7 });
}
// beds on the floor: one in the sunbeam, one by the sofa
for (const [x, z] of [[-0.9, 2.3], [3.05, 1.9], [-4.6, -1.3]]) {
  lathe(W, at(x, 0, z), [[0, 0], [0.27, 0], [0.27, 0.03], [0, 0.04]], 28, C.plush, PLUSH);
  torus(W, at(x, 0.08, z), 0.22, 0.075, jitter(pick([C.plush, hex(0xc9a8a0), hex(0xa8b8c8)]), 0.1), PLUSH, 30, 12);
  BEDS.push({ x, z });
}
// food and water bowls
for (const [x, c] of [[0.95, C.white], [1.15, hex(0x7ab0c8)]]) {
  lathe(W, at(x, 0.012, -2.95), [[0, 0], [0.05, 0], [0.075, 0.05], [0.07, 0.052], [0.05, 0.015], [0, 0.015]], 18, c, CERAMIC);
}
// what is in them is a prop (it goes up and down): BOWL.food / BOWL.water from 0 (empty) to 1 (full)
var BOWL = { food: 0.6, water: 0.7, fx: 0.95, wx: 1.15, z: -2.95 };
rbox(W, at(1.05, 0.004, -2.95), 0.5, 0.008, 0.3, 0.004, hex(0xc86a5a), PLAIN);
// toy mice on the floor
for (const [x, z, a] of [[2.6, 0.4, 1], [-2.2, -1.4, 2.5], [4.6, 1.6, 4]]) {
  sphere(W, place(x, 0.018, z, a), 0.02, hex(0x9a9a9a), FABRIC, 10, 0.8);
  sphere(W, place(x + cos(a) * 0.018, 0.022, z - sin(a) * 0.018, a), 0.009, hex(0xe0a0a0), FABRIC, 8);
  cyl(W, place(x - cos(a) * 0.02, 0.006, z + sin(a) * 0.02, a, 0, PI / 2 + 0.1), 0.0025, 0.07, hex(0xe0a0a0), PLAIN, 4, 0);
}

// ---------------------------------------------------------------- pendant lamps and string lights
function pendant(x, y, z) {
  cyl(W, at(x, y + 0.24, z), 0.004, RH - y - 0.24, C.black, PLAIN, 4, 0);
  const prof = [[0.21, 0], [0.205, 0.015], [0.07, 0.2], [0.025, 0.24], [0, 0.245]];
  lathe(W, at(x, y, z), prof, 28, C.green, PAINT);
  lathe(W, at(x, y + 0.004, z), prof.map(([r, h]) => [r * 0.97, h]).reverse(), 28, hex(0xf3e6c8), PLAIN);
  torus(W, at(x, y, z), 0.208, 0.006, C.brass, METAL, 28, 6);
  sphere(W, at(x, y + 0.06, z), 0.05, hex(0xffd9a0), EMIT, 14);
  LIGHTS.push([x, y + 0.03, z, 7, 4.2, 2.5, 1.15, 0]);
}
for (const [x, z] of TABLES) pendant(x, 2.05, z);
pendant(-3.6, 2.1, -3.45); pendant(-0.9, 2.1, -3.45);
{ // string lights along the front wall, sagging between hooks
  for (let x = -5.8; x < 5.79; x += 0.18) {
    const k = ((x + 5.8) % 1.44) / 1.44, y = 2.78 - sin(k * PI) * 0.16;
    sphere(W, at(x, y - 0.025, RZ - 0.06), 0.016, hex(0xffcf80), EMIT, 8);
    const k2 = ((x + 0.18 + 5.8) % 1.44) / 1.44, y2 = 2.78 - sin(k2 * PI) * 0.16;
    if (k2 > k) { const M = M4(); tr(M, x, y, RZ - 0.06); rz(M, -PI / 2 + atan2(y2 - y, 0.18)); cyl(W, M, 0.0025, hypot(0.18, y2 - y), C.black, PLAIN, 4, 0); }
  }
}
// bounce light from the sun patch on the floor
LIGHTS.push([-1.4, 0.4, 1.6, 6.5, 2.4, 1.6, 0.9, 1]);

// ---------------------------------------------------------------- movable props: toys, shop items, accessories, the petting hand
// Each prop is a range of PROPS indices, drawn with its own matrix. Accessories are modelled in the cat's rest pose and
// drawn with the skin matrix of the bone they sit on, so they follow the head or the neck.
const PM = {};
const prop = (name, f) => { const i0 = PROPS.i.length; f(PROPS); PM[name] = [i0, PROPS.i.length - i0]; };
const YARNC = [0xc8304a, 0x3a6ab0, 0xe0a030, 0x8a4ac0, 0x30a070, 0xf07aa0];
YARNC.forEach((c, k) => prop('yarn' + k, (m) => { sphere(m, M4(), 0.045, hex(c), YARN, 18); torus(m, rx(M4(), 0.7), 0.043, 0.004, shade(hex(c), 0.9), YARN, 24, 5); }));
prop('mouse', (m) => { // wind-up toy mouse, +x forward, sitting on the floor
  const g = hex(0x9a9aa0), pk = hex(0xf0a0a8);
  sphere(m, sc(tr(M4(), 0, 0.022, 0), 1.6, 0.85, 1), 0.024, g, FABRIC, 14);
  sphere(m, tr(M4(), 0.04, 0.026, 0), 0.016, g, FABRIC, 12);
  for (const s of [-1, 1]) { lathe(m, rx(tr(M4(), 0.034, 0.042, s * 0.013), s * -1.2), [[0, 0], [0.011, 0], [0.011, 0.002], [0, 0.003]], 12, pk, FABRIC); sphere(m, tr(M4(), 0.052, 0.031, s * 0.007), 0.0035, hex(0x111111), CERAMIC, 6); }
  sphere(m, tr(M4(), 0.057, 0.025, 0), 0.0045, pk, PLAIN, 6);
  cyl(m, rz(tr(M4(), -0.036, 0.016, 0), PI / 2 + 0.25), 0.0025, 0.08, pk, PLAIN, 5, 0);
  cyl(m, tr(M4(), -0.005, 0.04, 0), 0.003, 0.012, C.brass, METAL, 6, 0); torus(m, rx(tr(M4(), -0.005, 0.058, 0), PI / 2), 0.008, 0.0025, C.brass, METAL, 12, 5);
});
prop('box', (m) => { // an open cardboard box, origin at the floor
  const c = hex(0xb98a58), w = 0.46, d = 0.36, h = 0.2, t = 0.008;
  rbox(m, tr(M4(), 0, t / 2, 0), w, t, d, 0.002, shade(c, 0.85), TERRA);
  for (const s of [-1, 1]) { rbox(m, tr(M4(), s * (w / 2 - t / 2), h / 2, 0), t, h, d, 0.002, c, TERRA); rbox(m, tr(M4(), 0, h / 2, s * (d / 2 - t / 2)), w, h, t, 0.002, c, TERRA); }
  for (const s of [-1, 1]) { rbox(m, rx(tr(M4(), 0, h, s * d / 2), s * 0.5), w, t, 0.14, 0.002, shade(c, 1.05), TERRA); rbox(m, rz(tr(M4(), s * w / 2, h, 0), -s * 0.5), 0.12, t, d, 0.002, shade(c, 1.05), TERRA); }
  rbox(m, tr(M4(), 0, 0.12, d / 2 + 0.001), 0.16, 0.05, 0.002, 0.001, hex(0x3a6ab0), PLAIN);
});
prop('nip', (m) => { // a catnip cushion
  rbox(m, tr(M4(), 0, 0.016, 0), 0.12, 0.032, 0.08, 0.014, hex(0x5a9a40), FABRIC);
  for (let k = 0; k < 3; k++) leaf(m, place(-0.035 + k * 0.03, 0.033, 0, k * 1.1), 0.03, 0.018, hex(0x2f6a28), 0.05, 0.05);
});
prop('hand', (m) => { // a hand, palm down, fingers along +x
  const s = hex(0xe8b48e);
  rbox(m, M4(), 0.085, 0.024, 0.078, 0.011, s, FABRIC);
  for (let k = 0; k < 4; k++) { const z = -0.027 + k * 0.018, l = [0.05, 0.06, 0.057, 0.045][k]; cyl(m, rz(tr(M4(), 0.04, -0.002, z), -PI / 2 - 0.12), 0.0085 - k * 0.0004, l, s, FABRIC, 8, 2); }
  cyl(m, ry(rz(tr(M4(), 0.01, -0.004, 0.038), -PI / 2 - 0.2), -0.9), 0.0095, 0.045, s, FABRIC, 8, 2);
});
// accessories, in the cat's rest pose (head bone 3, neck bone 2)
const ACC = {};
const acc = (name, bone, f) => { prop('a_' + name, f); ACC[name] = bone; };
const hatCone = (m, M, r, h, c, bend, tip) => { // a soft cone that flops backwards, with a pompom
  const n = 6; let x = 0, y = 0;
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, a = bend * t1 * t1, l = h / n;
    const M2 = mat(M, (q) => rz(tr(q, x, y, 0), a));
    cyl(m, M2, r * (1 - t0) + 0.002, l + 0.002, c, FABRIC, 16, 0, r * (1 - t1) + 0.002);
    x -= sin(a) * l; y += cos(a) * l;
  }
  if (tip) sphere(m, mat(M, (q) => tr(q, x, y, 0)), 0.011, tip, FABRIC, 10);
};
acc('santa', 3, (m) => { const M = rz(tr(M4(), 0.205, 0.343, 0), 0.25); hatCone(m, M, 0.037, 0.085, hex(0xc81e28), 0.9, hex(0xffffff)); torus(m, mat(M, (q) => tr(q, 0, 0.004, 0)), 0.036, 0.0095, hex(0xf6f4f0), FABRIC, 24, 8); });
acc('elf', 3, (m) => { const M = rz(tr(M4(), 0.205, 0.343, 0), 0.2); hatCone(m, M, 0.035, 0.09, hex(0x2a8a3a), 1.3, hex(0xf0c040)); torus(m, mat(M, (q) => tr(q, 0, 0.004, 0)), 0.034, 0.008, hex(0xc81e28), FABRIC, 24, 8); });
acc('witch', 3, (m) => {
  const M = rz(tr(M4(), 0.205, 0.345, 0), 0.15), k = hex(0x1c1626);
  lathe(m, M, [[0, -0.002], [0.075, -0.002], [0.078, 0.002], [0, 0.003]], 28, k, FABRIC);
  hatCone(m, mat(M, (q) => tr(q, 0, 0.002, 0)), 0.034, 0.1, k, 0.7, null);
  torus(m, mat(M, (q) => tr(q, 0, 0.012, 0)), 0.031, 0.006, hex(0x7a3ac0), FABRIC, 24, 6);
});
acc('crown', 3, (m) => {
  const M = rz(tr(M4(), 0.207, 0.348, 0), 0.12), g = hex(0xf2c040);
  cyl(m, M, 0.03, 0.016, g, METAL, 24, 0, 0.032);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; lathe(m, mat(M, (q) => tr(q, cos(a) * 0.03, 0.015, -sin(a) * 0.03)), [[0, 0], [0.007, 0], [0, 0.018]], 8, g, METAL); sphere(m, mat(M, (q) => tr(q, cos(a) * 0.032, 0.008, -sin(a) * 0.032)), 0.0045, hex(k & 1 ? 0xe02040 : 0x2060e0), GLASS, 8); }
});
acc('halo', 3, (m) => torus(m, rz(tr(M4(), 0.2, 0.42, 0), 0.15), 0.04, 0.0045, hex(0xffe08a), EMIT, 28, 6));
acc('antlers', 3, (m) => {
  const b = hex(0x6a4a2a);
  for (const s of [-1, 1]) {
    const M = rx(rz(tr(M4(), 0.2, 0.345, s * 0.022), 0.25), -s * 0.35);
    cyl(m, M, 0.0055, 0.07, b, WOOD, 8, 2, 0.0035);
    cyl(m, mat(M, (q) => rz(tr(q, 0, 0.035, 0), -0.9)), 0.004, 0.03, b, WOOD, 6, 2, 0.0025);
    cyl(m, mat(M, (q) => rx(tr(q, 0, 0.05, 0), -s * 0.8)), 0.0035, 0.025, b, WOOD, 6, 2, 0.002);
  }
  sphere(m, tr(M4(), 0.298, 0.296, 0), 0.0095, hex(0xff2a2a), EMIT, 10);
});
const neckM = () => rz(tr(M4(), 0.168, 0.248, 0), -0.88);
acc('scarf', 2, (m) => {
  const c = hex(0xc0202a);
  torus(m, neckM(), 0.05, 0.013, c, FABRIC, 28, 10);
  rbox(m, rz(tr(M4(), 0.19, 0.19, 0.03), -0.25), 0.03, 0.07, 0.012, 0.006, shade(c, 0.9), FABRIC);
});
acc('bow', 2, (m) => {
  const c = hex(0xd02040), M = rz(tr(M4(), 0.205, 0.22, 0), -0.5);
  torus(m, neckM(), 0.049, 0.004, c, FABRIC, 28, 6);
  for (const s of [-1, 1]) lathe(m, mat(M, (q) => rx(q, s * PI / 2)), [[0, 0], [0.006, 0], [0.018, 0.026], [0, 0.028]], 10, c, FABRIC);
  sphere(m, M, 0.007, c, FABRIC, 8);
});
acc('bell', 2, (m) => {
  torus(m, neckM(), 0.049, 0.0045, hex(0x2a6ad0), FABRIC, 28, 6);
  sphere(m, tr(M4(), 0.205, 0.21, 0), 0.009, hex(0xf2c040), METAL, 10);
});

// three yarn balls to start with; more come from the shop
prop('kibble', (m) => { for (let i = 0; i < 26; i++) { const a = rr(0, TAU), r = sqrt(rnd()) * 0.045; sphere(m, place(cos(a) * r, 0.03 - r * 0.35 + rr(0, 0.006), sin(a) * r, rr(0, 6)), 0.0075, jitter(hex(0x8a5230), 0.25), PLAIN, 6, 0.75); } });
prop('water', (m) => lathe(m, M4(), [[0.062, 0], [0, 0.0005]], 18, hex(0x6a8a98), GLASS));
prop('snack', (m) => { sphere(m, sc(M4(), 1.4, 0.7, 1), 0.012, hex(0xd88a6a), PLAIN, 8); });
const TOYS = [], BOXES = [], NIPS = [];
function addToy(kind, x, z, mesh) {
  const t = { kind, mesh: mesh || kind, x, z, vx: 0, vz: 0, r: kind === 'yarn' ? 0.045 : 0.035, R: M4(), yaw: rr(0, TAU), wind: 0 };
  TOYS.push(t); return t;
}
[[1.0, 0.8], [-2.0, 3.4], [3.3, -1.0]].forEach(([x, z], k) => addToy('yarn', x, z, 'yarn' + k));

// ---------------------------------------------------------------- canvases: neon sign, menu, paintings, door sign
function mkCanvas(draw) { const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const g = c.getContext('2d'); draw(g, c); ARTS.push(c); }
const SCRIPT = "'Brush Script MT','Segoe Script','Lucida Handwriting','Apple Chancery',cursive";
const HAND = "'Segoe Print','Bradley Hand','Chalkboard SE','Comic Sans MS','Comic Neue',cursive";
mkCanvas((g) => { // 0: neon
  g.lineCap = g.lineJoin = 'round';
  const tube = (f, c1, c2) => { g.strokeStyle = c1; g.lineWidth = 16; f(); g.strokeStyle = c2; g.lineWidth = 7; f(); };
  g.font = `bold 230px ${SCRIPT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  tube(() => g.strokeText('Cat Bar', 600, 270), '#ff3d9a', '#ffd6ec');
  tube(() => { // a sitting cat outline
    g.beginPath(); g.moveTo(150, 430); g.bezierCurveTo(95, 430, 80, 330, 120, 270); g.lineTo(108, 190); g.lineTo(140, 225);
    g.quadraticCurveTo(160, 215, 180, 225); g.lineTo(212, 190); g.lineTo(200, 270); g.bezierCurveTo(240, 330, 225, 430, 170, 430);
    g.quadraticCurveTo(260, 440, 250, 380); g.stroke();
  }, '#3de8ff', '#d6fbff');
  tube(() => { g.beginPath(); g.moveTo(905, 105); g.bezierCurveTo(880, 70, 840, 100, 905, 150); g.bezierCurveTo(970, 100, 930, 70, 905, 105); g.stroke(); }, '#ffcf3d', '#fff3c8');
});
mkCanvas((g) => { // 1: chalkboard menu
  g.fillStyle = '#1e2a26'; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,255,255,${rnd() * 0.04})`; g.fillRect(rnd() * 1024, rnd() * 512, rr(2, 30), rr(1, 3)); }
  g.fillStyle = '#f4efe2'; g.font = `bold 64px ${HAND}`; g.textAlign = 'center'; g.fillText(L_('~ Menù ~', '~ Menu ~'), 512, 80);
  g.font = `38px ${HAND}`; g.textAlign = 'left';
  const items = IT ? [['Espresso', '1,20'], ['Cappuccino', '1,80'], ['Latte & miao', '2,50'], ['Tè matcha', '3,00'], ['Torta del giorno', '3,50'], ['Coccole', 'gratis ♥']] : [['Espresso', '1.20'], ['Cappuccino', '1.80'], ['Latte & meow', '2.50'], ['Matcha tea', '3.00'], ['Cake of the day', '3.50'], ['Cuddles', 'free ♥']];
  items.forEach(([a, b], i) => { const y = 150 + i * 55; g.fillStyle = ['#f4efe2', '#ffd1dc', '#cfe8ff'][i % 3]; g.fillText(a, 90, y); g.textAlign = 'right'; g.fillText(b, 930, y); g.textAlign = 'left'; g.fillStyle = 'rgba(244,239,226,.35)'; g.fillRect(420, y - 10, 300, 2); });
  g.strokeStyle = '#f4efe2'; g.lineWidth = 4; g.beginPath(); g.arc(940, 440, 34, 0, TAU); g.moveTo(912, 420); g.lineTo(915, 385); g.lineTo(930, 408); g.moveTo(968, 420); g.lineTo(965, 385); g.lineTo(950, 408); g.stroke();
});
mkCanvas((g) => { // 2: sunset over the rooftops, a cat watching it
  const s = g.createLinearGradient(0, 0, 0, 512); s.addColorStop(0, '#3a2a6a'); s.addColorStop(0.45, '#e0607a'); s.addColorStop(0.75, '#ffb060'); s.addColorStop(1, '#ffe0a0');
  g.fillStyle = s; g.fillRect(0, 0, 1024, 512);
  g.fillStyle = '#fff2c0'; g.beginPath(); g.arc(640, 330, 90, 0, TAU); g.fill();
  for (let i = 0; i < 400; i++) { g.fillStyle = `hsla(${rr(-20, 40)},80%,${rr(50, 80)}%,.12)`; g.beginPath(); g.ellipse(rnd() * 1024, rnd() * 360, rr(10, 60), rr(3, 10), rr(-0.2, 0.2), 0, TAU); g.fill(); }
  g.fillStyle = '#2a1a2a';
  let x = 0; while (x < 1024) { const w = rr(80, 180), h = rr(330, 420); g.fillRect(x, h, w, 512); g.beginPath(); g.moveTo(x - 10, h); g.lineTo(x + w / 2, h - rr(30, 60)); g.lineTo(x + w + 10, h); g.fill(); if (rnd() < 0.5) g.fillRect(x + w * 0.7, h - 70, 18, 60); x += w; }
  g.beginPath(); g.ellipse(300, 330, 26, 40, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(300, 280, 20, 0, TAU); g.fill();
  g.beginPath(); g.moveTo(282, 272); g.lineTo(284, 248); g.lineTo(296, 264); g.moveTo(318, 272); g.lineTo(316, 248); g.lineTo(304, 264); g.fill();
  g.lineWidth = 9; g.strokeStyle = '#2a1a2a'; g.beginPath(); g.moveTo(322, 360); g.quadraticCurveTo(370, 370, 360, 320); g.stroke();
});
mkCanvas((g) => { // 3: impressionist flowers
  g.fillStyle = '#e8dcc0'; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 1600; i++) {
    const y = rnd() * 512, f = y / 512, h = f > 0.55 ? rr(80, 140) : rr(180, 230);
    g.fillStyle = `hsla(${h},${rr(30, 60)}%,${rr(35, 65)}%,.5)`; g.beginPath(); g.ellipse(rnd() * 1024, y, rr(6, 26), rr(3, 9), rr(-1, 1), 0, TAU); g.fill();
  }
  for (let i = 0; i < 260; i++) { g.fillStyle = `hsla(${pick([350, 10, 45, 280, 0])},80%,${rr(55, 75)}%,.85)`; g.beginPath(); g.arc(rnd() * 1024, rr(260, 500), rr(5, 14), 0, TAU); g.fill(); }
});
mkCanvas((g) => { // 4: door sign
  g.fillStyle = '#f6efe0'; g.fillRect(0, 0, 1024, 512); g.strokeStyle = '#3a5a4a'; g.lineWidth = 18; g.strokeRect(30, 30, 964, 452);
  g.fillStyle = '#3a5a4a'; g.textAlign = 'center'; g.font = `bold 78px ${HAND}`; g.fillText(L_('Per favore,', 'Please,'), 512, 190);
  g.fillText(L_('non far uscire i gatti!', "don't let the cats out!"), 512, 300); g.font = `64px ${HAND}`; g.fillStyle = '#c0405a'; g.fillText(L_('♥ grazie ♥', '♥ thank you ♥'), 512, 410);
});
mkCanvas((g) => { // 5: line drawing of a cat face
  g.fillStyle = '#f2e8d8'; g.fillRect(0, 0, 1024, 512); g.strokeStyle = '#2a2420'; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(400, 300); g.quadraticCurveTo(380, 160, 430, 110); g.lineTo(470, 190); g.quadraticCurveTo(512, 175, 554, 190); g.lineTo(594, 110); g.quadraticCurveTo(644, 160, 624, 300); g.quadraticCurveTo(512, 420, 400, 300); g.stroke();
  g.beginPath(); g.moveTo(455, 260); g.quadraticCurveTo(470, 245, 485, 260); g.moveTo(539, 260); g.quadraticCurveTo(554, 245, 569, 260); g.moveTo(500, 300); g.lineTo(524, 300); g.lineTo(512, 314); g.closePath();
  g.moveTo(512, 314); g.quadraticCurveTo(500, 335, 485, 328); g.moveTo(512, 314); g.quadraticCurveTo(524, 335, 539, 328);
  for (const s of [-1, 1]) for (const k of [0, 1, 2]) { g.moveTo(512 + s * 50, 310 + k * 10); g.lineTo(512 + s * 170, 290 + k * 22); }
  g.stroke(); g.fillStyle = '#d04050'; g.beginPath(); g.arc(760, 400, 16, 0, TAU); g.fill();
});
