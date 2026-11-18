// ============================================================================
// cats: one skinned mesh sculpted from distance functions, a 22-bone skeleton, poses, a gait and a little mind
// ============================================================================
// Rest pose: standing, +x forward, +y up, metres. Bone heads below; each bone is a pitch/yaw/roll joint.
const BONES = [
  [-1, -0.12, 0.2, 0], [0, 0.06, 0.2, 0], [1, 0.15, 0.22, 0], [2, 0.21, 0.29, 0],          // 0 hips 1 chest 2 neck 3 head
  [1, 0.11, 0.17, 0.045], [1, 0.11, 0.17, -0.045], [4, 0.095, 0.075, 0.045], [5, 0.095, 0.075, -0.045], // 4,5 shoulders 6,7 elbows
  [6, 0.11, -0.005, 0.045], [7, 0.11, -0.005, -0.045],                                         // 8,9 front paws (wrists)
  [0, -0.15, 0.17, 0.05], [0, -0.15, 0.17, -0.05], [10, -0.095, 0.075, 0.05], [11, -0.095, 0.075, -0.05], // 10,11 hips 12,13 knees
  [12, -0.175, 0.015, 0.05], [13, -0.175, 0.015, -0.05],                                       // 14,15 hocks
  [0, -0.22, 0.21, 0], [16, -0.265, 0.215, 0], [17, -0.31, 0.22, 0], [18, -0.355, 0.225, 0], [19, -0.4, 0.23, 0], [20, -0.445, 0.235, 0], // 16-21 tail
];
const NB = BONES.length, TAILEND = [-0.49, 0.24], G0 = 0.031; // the paws reach y = -G0 in the rest pose
const EYE = [0.254, 0.318, 0.027];
const bh = (b) => BONES[b].slice(1);
const ang2 = (a, b) => atan2(b[1] - a[1], b[0] - a[0]);
const R_UP = ang2(bh(4), bh(6)), R_LO = ang2(bh(6), bh(8)), R_PAW = ang2(bh(8), [0.145, -0.018]);
const R_TH = ang2(bh(10), bh(12)), R_SH = ang2(bh(12), bh(14)), R_FT = ang2(bh(14), [-0.152, -0.018]);
const dist2 = (a, b) => hypot(b[0] - a[0], b[1] - a[1]);
const L_UP = dist2(bh(4), bh(6)), L_LO = dist2(bh(6), bh(8)), L_TH = dist2(bh(10), bh(12)), L_SH = dist2(bh(12), bh(14));

// ---------------------------------------------------------------- the body as distance functions
// [type, bone, fur, blend, ...]: 0 ellipsoid (centre, radii), 1 round cone (a, b, ra, rb), 2 flattened round cone (ears)
const PRIM = [];
const E_ = (b, f, k, c, r) => PRIM.push([0, b, f, k, c, r]);
const RC = (b, f, k, a, c, ra, rb, fl = 1) => PRIM.push([fl === 1 ? 1 : 2, b, f, k, a, c, ra, rb, fl]);
E_(0, 1, 0, [-0.095, 0.19, 0], [0.11, 0.082, 0.072]);
E_(1, 1, 0.05, [0.06, 0.188, 0], [0.1, 0.086, 0.068]);
E_(0, 1, 0.04, [-0.02, 0.172, 0], [0.095, 0.068, 0.074]);
RC(2, 1.1, 0.04, [0.12, 0.215, 0], [0.205, 0.285, 0], 0.054, 0.045);
E_(3, 0.7, 0.03, [0.215, 0.305, 0], [0.056, 0.05, 0.058]);
E_(3, 0.75, 0.02, [0.238, 0.285, 0], [0.046, 0.04, 0.056]);
E_(3, 0.4, 0.015, [0.268, 0.283, 0], [0.03, 0.024, 0.031]);
for (const s of [-1, 1]) E_(3, 0.35, 0.01, [0.277, 0.279, s * 0.013], [0.016, 0.014, 0.015]);
E_(3, 0.35, 0.012, [0.262, 0.264, 0], [0.022, 0.012, 0.018]);
E_(3, 0, 0.006, [0.291, 0.295, 0], [0.0075, 0.0065, 0.0095]);
for (const s of [-1, 1]) RC(3, 0.35, 0.012, [0.206, 0.33, s * 0.036], [0.21, 0.402, s * 0.062], 0.029, 0.004, 2.3);
for (const s of [-1, 1]) E_(3, 0.6, 0.01, [0.247, 0.334, s * 0.024], [0.017, 0.008, 0.014]);   // brows over the eyes
for (const s of [-1, 1]) E_(3, 1.1, 0.02, [0.225, 0.272, s * 0.04], [0.025, 0.022, 0.018]);   // cheek fluff
for (const s of [-1, 1]) E_(1, 1, 0.03, [0.085, 0.255, s * 0.03], [0.045, 0.018, 0.022]);     // shoulder blades
for (const s of [-1, 1]) {
  const z = s * 0.045, zh = s * 0.05;
  RC(s > 0 ? 4 : 5, 0.9, 0.03, [0.1, 0.19, z], [0.095, 0.075, z], 0.036, 0.022);
  RC(s > 0 ? 6 : 7, 0.7, 0.012, [0.095, 0.075, z], [0.11, -0.002, z], 0.02, 0.016);
  E_(s > 0 ? 8 : 9, 0.55, 0.012, [0.122, -0.013, s * 0.046], [0.026, 0.017, 0.021]);
  for (const t of [-0.015, -0.005, 0.005, 0.015]) E_(s > 0 ? 8 : 9, 0.45, 0.006, [0.139 - abs(t) * 0.4, -0.017, s * 0.046 + t], [0.009, 0.009, 0.0075]); // toes
  RC(s > 0 ? 10 : 11, 1, 0.035, [-0.15, 0.18, zh], [-0.095, 0.075, zh], 0.047, 0.024);
  RC(s > 0 ? 12 : 13, 0.8, 0.012, [-0.095, 0.075, zh], [-0.175, 0.015, zh], 0.021, 0.015);
  RC(s > 0 ? 14 : 15, 0.55, 0.01, [-0.175, 0.015, zh], [-0.156, -0.013, zh], 0.015, 0.015);
  E_(s > 0 ? 14 : 15, 0.55, 0.01, [-0.148, -0.014, zh], [0.027, 0.016, 0.021]);
  for (const t of [-0.014, -0.005, 0.005, 0.014]) E_(s > 0 ? 14 : 15, 0.45, 0.006, [-0.126 - abs(t) * 0.4, -0.018, zh + t], [0.0085, 0.0085, 0.007]);
}
for (let i = 0; i < 6; i++) {
  const a = bh(16 + i), b = i < 5 ? bh(17 + i) : [TAILEND[0], TAILEND[1], 0];
  RC(16 + i, 1.2, i ? 0.015 : 0.03, a, b, 0.021 - i * 0.0015, 0.021 - (i + 1) * 0.0015 - (i === 5 ? 0.003 : 0));
}
// bounding spheres (for skipping far primitives)
for (const p of PRIM) {
  if (p[0] === 0) p.push(p[4], max(...p[5]));
  else { const a = p[4], b = p[5]; p.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 2 + max(p[6], p[7]) * (p[8] || 1)); }
}
function sdE(x, y, z, c, r) {
  const px = (x - c[0]) / r[0], py = (y - c[1]) / r[1], pz = (z - c[2]) / r[2];
  const k0 = hypot(px, py, pz), k1 = hypot(px / r[0], py / r[1], pz / r[2]);
  return (k0 * (k0 - 1)) / (k1 || 1e-9);
}
function sdRC(x, y, z, a, b, r1, r2, fl) {
  if (fl !== 1) x = a[0] + (x - a[0]) * fl;
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2], l2 = bax * bax + bay * bay + baz * baz, rr_ = r1 - r2;
  const a2 = l2 - rr_ * rr_, il2 = 1 / l2;
  const pax = x - a[0], pay = y - a[1], paz = z - a[2], yy = pax * bax + pay * bay + paz * baz, zz = yy - l2;
  const qx = pax * l2 - bax * yy, qy = pay * l2 - bay * yy, qz = paz * l2 - baz * yy, x2 = qx * qx + qy * qy + qz * qz;
  const y2 = yy * yy * l2, z2 = zz * zz * l2, k = sign(rr_) * rr_ * rr_ * x2;
  let d;
  if (sign(zz) * a2 * z2 > k) d = sqrt(x2 + z2) * il2 - r2;
  else if (sign(yy) * a2 * y2 < k) d = sqrt(x2 + y2) * il2 - r1;
  else d = (sqrt(x2 * a2 * il2) + yy * rr_) * il2 - r1;
  return fl !== 1 ? d / fl * 1.6 : d;
}
const primD = (p, x, y, z) => (p[0] === 0 ? sdE(x, y, z, p[4], p[5]) : sdRC(x, y, z, p[4], p[5], p[6], p[7], p[8]));
function catSDF(x, y, z) {
  let d = 1e9;
  for (const p of PRIM) {
    const c = p[p.length - 2], lb = hypot(x - c[0], y - c[1], z - c[2]) - p[p.length - 1];
    if (lb > d + p[3] + 0.002) continue;
    const e = primD(p, x, y, z), k = p[3];
    if (k > 0) { const h = max(k - abs(d - e), 0) / k; d = min(d, e) - h * h * k * 0.25; } else d = min(d, e);
  }
  for (const s of [-1, 1]) { // eye sockets
    const e = -(hypot(x - EYE[0], y - EYE[1], z - s * EYE[2]) - 0.0142), k = 0.004, h = max(k - abs(d - e), 0) / k;
    d = max(d, e) + h * h * k * 0.25;
  }
  return d;
}

// ---------------------------------------------------------------- surface nets -> skinned mesh
function buildCatMesh() {
  const h = 0.0046, ox = -0.52, oy = -0.036, oz = -0.11;
  const nx = ceil_((0.335 - ox) / h) + 1, ny = ceil_((0.43 - oy) / h) + 1, nz = ceil_((0.11 - oz) / h) + 1;
  const F = new Float32Array(nx * ny * nz);
  // the distance bound lets us skip ahead along each row while far from the surface
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx;) {
    const d = catSDF(ox + i * h, oy + j * h, oz + k * h), o = i + nx * (j + ny * k);
    F[o] = d; i++;
    const skip = Math.floor(abs(d) * 0.9 / h) - 1;
    for (let s = 1; s <= skip && i < nx; s++, i++) F[o + s] = d > 0 ? d - s * h : d + s * h;
  }
  const id = (i, j, k) => i + nx * (j + ny * k);
  const VI = new Int32Array(nx * ny * nz).fill(-1), P = [];
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let m = 0;
    for (let c = 0; c < 8; c++) { cv[c] = F[id(i + (c & 1), j + ((c >> 1) & 1), k + (c >> 2))]; if (cv[c] < 0) m |= 1 << c; }
    if (m === 0 || m === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of E) {
      if ((cv[a] < 0) === (cv[b] < 0)) continue;
      const t = cv[a] / (cv[a] - cv[b]);
      sx += (a & 1) + ((b & 1) - (a & 1)) * t; sy += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t; sz += (a >> 2) + ((b >> 2) - (a >> 2)) * t; n++;
    }
    VI[id(i, j, k)] = P.length / 3;
    P.push(ox + (i + sx / n) * h, oy + (j + sy / n) * h, oz + (k + sz / n) * h);
  }
  const Q = [];
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const s0 = F[id(i, j, k)] < 0;
    if (s0 !== F[id(i + 1, j, k)] < 0) Q.push(VI[id(i, j - 1, k - 1)], VI[id(i, j, k - 1)], VI[id(i, j, k)], VI[id(i, j - 1, k)]);
    if (s0 !== F[id(i, j + 1, k)] < 0) Q.push(VI[id(i - 1, j, k - 1)], VI[id(i, j, k - 1)], VI[id(i, j, k)], VI[id(i - 1, j, k)]);
    if (s0 !== F[id(i, j, k + 1)] < 0) Q.push(VI[id(i - 1, j - 1, k)], VI[id(i, j - 1, k)], VI[id(i, j, k)], VI[id(i - 1, j, k)]);
  }
  // project onto the surface, then normals, bone weights and fur length
  const nv = P.length / 3, ab = new ArrayBuffer(nv * 24), f32 = new Float32Array(ab), u8 = new Uint8Array(ab), i8 = new Int8Array(ab), N = new Float32Array(nv * 3);
  const e = 0.0008, grad = (x, y, z) => [catSDF(x + e, y, z) - catSDF(x - e, y, z), catSDF(x, y + e, z) - catSDF(x, y - e, z), catSDF(x, y, z + e) - catSDF(x, y, z - e)];
  const wb = new Float32Array(NB);
  for (let v = 0; v < nv; v++) {
    let x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    for (let it = 0; it < 2; it++) { const d = catSDF(x, y, z), g = grad(x, y, z), l = hypot(...g) / (2 * e) || 1; x -= (g[0] / (2 * e) / l) * d / l; y -= (g[1] / (2 * e) / l) * d / l; z -= (g[2] / (2 * e) / l) * d / l; }
    const g = grad(x, y, z), gl = hypot(...g) || 1;
    N[v * 3] = g[0] / gl; N[v * 3 + 1] = g[1] / gl; N[v * 3 + 2] = g[2] / gl;
    wb.fill(0); let dm = 1e9;
    const ds = PRIM.map((p) => { const d = primD(p, x, y, z); dm = min(dm, d); return d; });
    let fur = 0, fw = 0;
    PRIM.forEach((p, i) => { const w = exp(-(ds[i] - dm) / 0.006); wb[p[1]] += w; fur += p[2] * w; fw += w; });
    fur /= fw;
    for (const s of [-1, 1]) fur *= sstep(0.013, 0.03, hypot(x - EYE[0], y - EYE[1], z - s * EYE[2]));
    // the four strongest bones
    const top = [...wb.keys()].sort((a, b) => wb[b] - wb[a]).slice(0, 4), tw = top.reduce((s, b) => s + wb[b], 0);
    const o = v * 24;
    f32[o / 4] = x; f32[o / 4 + 1] = y; f32[o / 4 + 2] = z;
    i8[o + 12] = round(N[v * 3] * 127); i8[o + 13] = round(N[v * 3 + 1] * 127); i8[o + 14] = round(N[v * 3 + 2] * 127); i8[o + 15] = round(clamp(fur / 1.25, 0, 1) * 127);
    let acc = 0;
    top.forEach((b, i) => { u8[o + 16 + i] = b; const q = i < 3 ? min(255 - acc, round((wb[b] / tw) * 255)) : 255 - acc; u8[o + 20 + i] = q; acc += q; });
  }
  const idx = [];
  for (let q = 0; q < Q.length; q += 4) {
    const a = Q[q], b = Q[q + 1], c = Q[q + 2], d = Q[q + 3];
    if (a < 0 || b < 0 || c < 0 || d < 0) continue;
    for (const [p0, p1, p2] of [[a, b, c], [a, c, d]]) { // orient by the normals
      const ux = P[p1 * 3] - P[p0 * 3], uy = P[p1 * 3 + 1] - P[p0 * 3 + 1], uz = P[p1 * 3 + 2] - P[p0 * 3 + 2];
      const vx = P[p2 * 3] - P[p0 * 3], vy = P[p2 * 3 + 1] - P[p0 * 3 + 1], vz = P[p2 * 3 + 2] - P[p0 * 3 + 2];
      const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
      const s = fx * (N[p0 * 3] + N[p1 * 3] + N[p2 * 3]) + fy * (N[p0 * 3 + 1] + N[p1 * 3 + 1] + N[p2 * 3 + 1]) + fz * (N[p0 * 3 + 2] + N[p1 * 3 + 2] + N[p2 * 3 + 2]);
      if (s < 0) idx.push(p0, p2, p1); else idx.push(p0, p1, p2);
    }
  }
  if (typeof SHOT !== 'undefined' && SHOT) console.log('cat mesh: ' + nv + ' vertices, ' + idx.length / 3 + ' triangles');
  return { vb: ab, ib: new Uint32Array(idx), count: idx.length };
}
function ceil_(x) { return Math.ceil(x); }

// whiskers (head-bone space): x,y,z,alpha per vertex, as line pairs
function buildWhiskers() {
  const v = [];
  for (const s of [-1, 1]) for (let i = 0; i < 7; i++) {
    const brow = i >= 5, k = brow ? i - 5 : i;
    let x = brow ? 0.255 : 0.28 - k * 0.003, y = brow ? 0.336 + k * 0.004 : 0.284 - k * 0.0035, z = s * (brow ? 0.022 + k * 0.006 : 0.022);
    const len = brow ? 0.035 : 0.075 - abs(k - 2) * 0.006, dy = brow ? 0.5 : 0.15 - k * 0.12, dx = brow ? 0.5 : 0.35;
    let px = x, py = y, pz = z;
    for (let sgm = 1; sgm <= 4; sgm++) {
      const t = sgm / 4, nx_ = x + dx * len * t, nz_ = z + s * len * t, ny_ = y + dy * len * t - 0.25 * len * t * t;
      v.push(px, py, pz, 1 - (t - 0.25) * 0.8, nx_, ny_, nz_, 1 - t * 0.8);
      px = nx_; py = ny_; pz = nz_;
    }
  }
  return new Float32Array(v);
}

// ---------------------------------------------------------------- the cats
const lin = (h) => hex(h).map((c) => pow(c, 2.2));
const BREEDS = [
  // name, breed, pattern, base, second, white, eyes, fur, scale, third, pink nose, dark whiskers
  ['Tigro', 'Europeo tigrato', 1, 0xa08868, 0x261c12, 0, 0xb8c040, 0.012, 1, 0, 1, 0],
  ['Luna', 'Siamese', 3, 0xefe2cc, 0x4a3226, 0, 0x3a90e0, 0.008, 0.95, 0, 1, 0],
  ['Briciola', 'Calico', 2, 0xe08a3a, 0, 0.55, 0xd0a030, 0.012, 0.95, 0x1e1a18, 1, 0],
  ['Oreo', 'Tuxedo', 0, 0x151313, 0, 0.42, 0xe0c040, 0.011, 1, 0, 0, 0],
  ['Nuvola', 'Persiano', 0, 0xf2efe8, 0, 0, 0x5a9ad8, 0.026, 1, 0, 1, 0],
  ['Zucca', 'Rosso tigrato', 1, 0xe39445, 0xa8521c, 0.15, 0xd09030, 0.013, 1.08, 0, 1, 0],
  ['Ombra', 'Nero', 0, 0x121010, 0, 0, 0xe8b020, 0.01, 0.95, 0, 0, 0.6],
  ['Fumo', 'Certosino', 0, 0x7c8088, 0, 0, 0xd0a020, 0.011, 1.02, 0, 0, 0],
  ['Leone', 'Maine Coon', 1, 0x8a6a48, 0x2a1e14, 0.2, 0xc09040, 0.026, 1.22, 0, 1, 0],
  ['Pepe', 'Bengala', 4, 0xd8a060, 0x2a1a10, 0, 0x80b040, 0.008, 1, 0, 1, 0],
  ['Mochi', 'Gattino tigrato', 1, 0x9c9c9c, 0x38383a, 0.3, 0x6ab0d0, 0.015, 0.62, 0, 1, 0],
  ['Biscotto', 'Gattina tartarugata', 5, 0xc06a2a, 0, 0, 0xc0a030, 0.013, 0.6, 0x1a1412, 1, 0],
  ['Ragù', 'Ragdoll', 3, 0xeee4d4, 0x6a5040, 0.35, 0x4a8ae8, 0.022, 1.05, 0, 1, 0],
];
// special cats, found in card packs: [id, name it, name en, rarity 0-3, tag, pattern, base, second, white, eyes, fur, scale,
// third, pink nose, glow, sparkle, metal, accessories]
const SPECIALS = [
  ['pallina', 'Pallina', 'Pallina', 0, '', 0, 0x141212, 0, 0.7, 0x70c050, 0.012, 0.95, 0, 1, 0, 0, 0, ['bell']],
  ['caramella', 'Caramella', 'Caramel', 0, '', 0, 0xe8cfa0, 0, 0.2, 0xd09030, 0.014, 1, 0, 1, 0, 0, 0, ['bow']],
  ['polpetta', 'Polpetta', 'Meatball', 0, '', 1, 0xe8964a, 0xb05a20, 0.4, 0xd0a030, 0.016, 0.66, 0, 1, 0, 0, 0, []],
  ['nebbia', 'Nebbia', 'Mist', 0, '', 1, 0xa8a8a8, 0x4a4a4c, 0.25, 0x60b0c0, 0.026, 1.05, 0, 1, 0, 0, 0, []],
  ['cacao', 'Cacao', 'Cocoa', 0, '', 0, 0x5a3a28, 0, 0, 0xd0a020, 0.01, 1, 0, 0, 0, 0, 0, ['bell']],
  ['babbo', 'Babbo Miao', 'Santa Paws', 1, 'xmas', 0, 0xe0904a, 0, 0.6, 0x5aa0e0, 0.016, 1.08, 0, 1, 0, 0, 0, ['santa']],
  ['rudolph', 'Rudolph', 'Rudolph', 1, 'xmas', 1, 0x8a6040, 0x3a2414, 0.25, 0xc08030, 0.013, 1, 0, 1, 0, 0, 0, ['antlers']],
  ['elfo', 'Elfo', 'Elf', 1, 'xmas', 0, 0x161414, 0, 0.45, 0x60d070, 0.011, 0.9, 0, 0, 0, 0, 0, ['elf', 'bell']],
  ['strega', 'Strega', 'Witch', 1, 'halloween', 0, 0x0e0c0c, 0, 0, 0x60ff60, 0.011, 1, 0, 0, 0.6, 0, 0, ['witch']],
  ['panda', 'Panda', 'Panda', 1, '', 13, 0xeeeae2, 0x141212, 0, 0x806040, 0.02, 1.05, 0, 0, 0, 0, 0, []],
  ['bastoncino', 'Bastoncino', 'Candy Cane', 2, 'xmas', 9, 0xc81e28, 0xf2f0ec, 0, 0x40c060, 0.014, 1, 0, 1, 0, 0.3, 0, ['scarf']],
  ['fiocco', 'Fiocco di Neve', 'Snowflake', 2, 'xmas', 10, 0xeef4ff, 0x9ad0ff, 0, 0x7ad0ff, 0.024, 1, 0, 1, 0.25, 1, 0, ['scarf']],
  ['lanterna', 'Zucca Lanterna', 'Jack-o-Lantern', 2, 'halloween', 11, 0xf07a10, 0xffa020, 0, 0xffb020, 0.013, 1.05, 0, 0, 1, 0, 0, ['witch']],
  ['neon', 'Neon', 'Neon', 2, '', 12, 0x080810, 0x30f0ff, 0, 0xff40d0, 0.01, 1, 0, 0, 1.2, 0, 0, []],
  ['arcobaleno', 'Arcobaleno', 'Rainbow', 2, '', 8, 0xffffff, 0, 0, 0xffffff, 0.02, 1, 0, 1, 0.15, 0.6, 0, ['bow']],
  ['galassia', 'Galassia', 'Galaxy', 3, '', 6, 0x10082a, 0x8040ff, 0, 0xc0a0ff, 0.016, 1.05, 0, 0, 1, 1.4, 0, []],
  ['mida', 'Re Mida', 'King Midas', 3, '', 7, 0xf0b040, 0, 0, 0x40d0a0, 0.012, 1.1, 0, 0, 0, 1, 1, ['crown']],
  ['angelo', 'Angelo', 'Angel', 3, 'xmas', 0, 0xfaf8f4, 0xffe6a0, 0, 0x8ad0ff, 0.024, 1, 0, 1, 0.5, 1, 0, ['halo']],
  ['lava', 'Lava', 'Lava', 3, '', 14, 0x0c0a0a, 0xff5010, 0, 0xff8020, 0.011, 1.05, 0, 0, 1.3, 0.3, 0, []],
];
const MAXC = 48, NPOSE = 8;
var LASER = { on: false, x: 0, z: 0 }; // the laser pointer dot (main.js moves it)
const CPD = new Float32Array(MAXC * 24);          // per-cat shader parameters (6 vec4)
const BND = new Float32Array(MAXC * NB * 16);     // skin matrices
const CATS = [];
function addCat(name, breed, typ, base, sec, white, eye, fur, scale, third, pink, wd, glow = 0, sparkle = 0, metal = 0, accs = [], special = null) {
  const i = CATS.length; if (i >= MAXC) return null;
  const P = CPD.subarray(i * 24, i * 24 + 24);
  P.set([...lin(base), typ, ...lin(sec || base), white, ...hex(eye), fur * 1.25, 12, 0, rr(0, 50), wd, ...lin(third || base), pink, typ, glow, sparkle, metal]);
  const c = {
    i, name, breed, P, scale, fur, special, acc: accs, x: 0, y: 0, z: 0, yaw: rr(0, TAU), spd: 0, st: 'idle', tm: rr(1, 6), goal: null, perch: null,
    pw: new Float32Array(NPOSE), pv: new Float32Array(24), gait: rnd(), walk: 0, lid: 0, blink: rr(1, 5), look: 0, lookYaw: 0, lookPitch: 0,
    tail: rr(0, 9), mood: 0, pet: 0, petTotal: 0, coinT: 0, meowT: rr(4, 20), purr: 0, lick: 0, toy: null, ph: 0, stuck: 0, lx: 0, lz: 0,
    jump: 0, hx: 0, hz: 0, sp: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], vis: true, shells: 12, dcam: 5, pose: 1, sleepiness: rr(0.2, 0.8),
    petMode: null, petPh: 0, nipT: 0, hunger: rr(0.1, 0.45), thirst: rr(0.1, 0.45), joy: rr(0.35, 0.6), M: Array.from({ length: NB }, () => M4()),
  };
  CATS.push(c); return c;
}
const BREED_EN = { 'Europeo tigrato': 'European tabby', 'Siamese': 'Siamese', 'Calico': 'Calico', 'Tuxedo': 'Tuxedo', 'Persiano': 'Persian',
  'Rosso tigrato': 'Ginger tabby', 'Nero': 'Black', 'Certosino': 'Chartreux', 'Maine Coon': 'Maine Coon', 'Bengala': 'Bengal',
  'Gattino tigrato': 'Tabby kitten', 'Gattina tartarugata': 'Tortoiseshell kitten', 'Ragdoll': 'Ragdoll' };
for (const b of BREEDS) addCat(b[0], L_(b[1], BREED_EN[b[1]]), ...b.slice(2));
function addSpecial(id) {
  const d = SPECIALS.find((s) => s[0] === id); if (!d) return null;
  const [, it, en, rar, , typ, base, sec, white, eye, fur, scale, third, pink, glow, sparkle, metal, accs] = d;
  return addCat(L_(it, en), L_(RARITY[rar][0], RARITY[rar][1]), typ, base, sec, white, eye, fur, scale, third, pink, 0, glow, sparkle, metal, accs, d);
}
const RARITY = [['Comune', 'Common', '#c9c2b8'], ['Raro', 'Rare', '#5aa8ff'], ['Epico', 'Epic', '#c070ff'], ['Leggendario', 'Legendary', '#ffc640']];

// ---------------------------------------------------------------- poses
// parameters: 0 rootY 1 rootX 2 rootPitch 3 rootRoll 4 chestPitch 5 chestYaw 6 neckPitch 7 headPitch (world) 8 headYaw 9 headRoll
// 10 tailLift 11 tailCurve 12 tailCurl 13-20 wrist/hock targets FL FR HL HR (x, y) 21 paw angle 22 foot angle 23 neckYaw
const STAND = 0, SIT = 1, LOAF = 2, SLEEP = 3, GROOM = 4, CROUCH = 5, STRETCH = 6, ROLL = 7;
const POSES = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -0.45, 0.2, 0, 0.11, -0.005, 0.11, -0.005, -0.175, 0.015, -0.175, 0.015, R_PAW, R_FT, 0],
  [-0.124, 0.012, 0.66, 0, 0.0, 0, -0.32, 0.04, 0, 0, 0.55, 0.02, 0.45, 0.085, -0.006, 0.085, -0.006, -0.11, -0.012, -0.11, -0.012, -0.25, -0.05, 0],
  [-0.108, 0, 0.0, 0, 0.0, 0, 0.4, 0.05, 0, 0, -0.3, 0.04, 0.38, 0.05, -0.002, 0.05, -0.002, -0.16, -0.008, -0.16, -0.008, -2.9, 0.05, 0],
  [-0.156, 0, 0.15, 1.42, -1.0, 0, -0.9, -2.55, 0, 0.25, -0.9, -0.5, 0, 0.17, 0.03, 0.15, 0.05, -0.04, 0.04, -0.02, 0.06, -0.8, 0.1, 0],
  [-0.124, 0.012, 0.66, 0, 0.0, 0, -0.15, -0.55, -0.3, 0.15, 0.55, 0.02, 0.45, 0.16, 0.17, 0.085, -0.006, -0.11, -0.012, -0.11, -0.012, 1.2, -0.05, 0],
  [-0.08, 0, -0.04, 0, -0.1, 0, 0.18, 0.04, 0, 0, -0.25, 0.1, 0, 0.15, -0.005, 0.15, -0.005, -0.13, 0.012, -0.13, 0.012, R_PAW, -0.6, 0],
  [-0.04, 0, -0.32, 0, -0.15, 0, 0.32, 0.25, 0, 0, 0.7, -0.08, 0, 0.32, -0.008, 0.3, -0.008, -0.18, 0.015, -0.18, 0.015, -0.1, R_FT, 0],
  [-0.148, 0, 0.1, 2.75, -0.25, 0, 0.1, 0.5, 0, 0.3, 0.1, 0.05, 0.35, 0.15, 0.05, 0.13, 0.07, -0.09, 0.06, -0.07, 0.08, 0.6, 0.4, 0], // on the back, paws up
];
// eating/sniffing: crouch with the head down is POSES[CROUCH] with headPitch overridden in update

// ---------------------------------------------------------------- forward kinematics with two-bone IK for the legs
const LOC = new Float32Array(NB * 3); // local pitch, yaw, roll per bone
function ik(jx, jy, tx, ty, L1, L2, bend, out, o) {
  const dx = tx - jx, dy = ty - jy, d = clamp(hypot(dx, dy), abs(L1 - L2) + 1e-4, L1 + L2 - 1e-4);
  const a = atan2(dy, dx), c = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1), a1 = a + bend * acos(c);
  const kx = jx + cos(a1) * L1, ky = jy + sin(a1) * L1;
  out[o] = a1; out[o + 1] = atan2(ty - ky, tx - kx);
}
const IKO = new Float32Array(2);
const rot2 = (a, x, y) => [x * cos(a) - y * sin(a), x * sin(a) + y * cos(a)];
function pose(cat, t) {
  const v = cat.pv; LOC.fill(0);
  const rp = v[2], cp = v[4], hx = BONES[0][1] + v[1], hy = BONES[0][2] + v[0];
  const [cx, cy] = rot2(rp, 0.18, 0); const chx = hx + cx, chy = hy + cy;
  LOC[1 * 3] = cp; LOC[1 * 3 + 1] = v[5];
  LOC[2 * 3] = v[6]; LOC[2 * 3 + 1] = v[23];
  LOC[3 * 3] = v[7] - (rp + cp + v[6]); LOC[3 * 3 + 1] = v[8]; LOC[3 * 3 + 2] = v[9];
  // front legs
  cat.slide = 0;
  for (let s = 0; s < 2; s++) { // a shoulder blade slides down when the paw is out of reach (sitting)
    let [sx, sy] = rot2(rp + cp, 0.05, -0.03);
    const over = hypot(v[13 + s * 2] - chx - sx, v[14 + s * 2] - chy - sy) - (L_UP + L_LO - 0.004);
    if (over > 0) { const sl = min(over * 1.05, 0.04); cat.slide = max(cat.slide, sl); [sx, sy] = rot2(rp + cp, 0.05, -0.03 - sl); }
    ik(chx + sx, chy + sy, v[13 + s * 2], v[14 + s * 2], L_UP, L_LO, -1, IKO, 0);
    const up = IKO[0] - R_UP, lo = IKO[1] - R_LO;
    LOC[(4 + s) * 3] = up - (rp + cp); LOC[(6 + s) * 3] = lo - up; LOC[(8 + s) * 3] = v[21] - R_PAW - lo;
  }
  for (let s = 0; s < 2; s++) {
    const [jx, jy] = rot2(rp, -0.03, -0.03);
    ik(hx + jx, hy + jy, v[17 + s * 2], v[18 + s * 2], L_TH, L_SH, 1, IKO, 0);
    const th = IKO[0] - R_TH, sh = IKO[1] - R_SH;
    LOC[(10 + s) * 3] = th - rp; LOC[(12 + s) * 3] = sh - th; LOC[(14 + s) * 3] = v[22] - R_FT - sh;
  }
  // tail: lift at the base, a curve along it, a sideways curl, and a slow swish
  const sw = cat.tailSw || 0;
  for (let i = 0; i < 6; i++) {
    LOC[(16 + i) * 3] = -(i === 0 ? v[10] : 0) - v[11] * (i > 0 ? 1 : 0) - (i > 2 ? cat.tailTip || 0 : 0);
    LOC[(16 + i) * 3 + 1] = v[12] + sw * sin(t * (cat.tailF || 1.3) - i * 0.7) * (0.4 + i * 0.12);
  }
  // matrices
  const M = cat.M, S = cat.scale;
  ident(M[0]); tr(M[0], cat.x, cat.y + G0 * S, cat.z); ry(M[0], cat.yaw); sc(M[0], S, S, S);
  tr(M[0], hx, hy, 0); rx(M[0], v[3]); rz(M[0], rp);
  for (let b = 1; b < NB; b++) {
    const p = BONES[b][0], m = M[b];
    m.set(M[p]); tr(m, BONES[b][1] - BONES[p][1], BONES[b][2] - BONES[p][2] - (b === 4 || b === 5 ? cat.slide : 0), BONES[b][3] - BONES[p][3]);
    ry(m, LOC[b * 3 + 1]); rz(m, LOC[b * 3]); rx(m, LOC[b * 3 + 2]);
  }
  for (let b = 0; b < NB; b++) {
    const o = BND.subarray((cat.i * NB + b) * 16, (cat.i * NB + b) * 16 + 16);
    o.set(M[b]); tr(o, -BONES[b][1], -BONES[b][2], -BONES[b][3]);
  }
  // picking spheres: hips, chest, head (world)
  const pt = (m, x, y, z, o) => { o[0] = m[0] * x + m[4] * y + m[8] * z + m[12]; o[1] = m[1] * x + m[5] * y + m[9] * z + m[13]; o[2] = m[2] * x + m[6] * y + m[10] * z + m[14]; };
  pt(M[0], 0.02, -0.01, 0, cat.sp[0]); pt(M[1], 0.02, -0.01, 0, cat.sp[1]); pt(M[3], 0.03, 0.01, 0, cat.sp[2]);
}

// ---------------------------------------------------------------- behaviour
const CATR = 0.17;
function freeAt(x, z, r) {
  if (abs(x) > RX - r || abs(z) > RZ - r) return false;
  for (const c of COL) {
    if (!c.cat) continue;
    if (c.r !== undefined) { if (hypot(x - c.x, z - c.z) < c.r + r) return false; }
    else if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) return false;
  }
  return true;
}
function randFree(r = 0.3) { for (let i = 0; i < 200; i++) { const x = rr(-RX + 0.5, RX - 0.5), z = rr(-RZ + 0.5, RZ - 0.5); if (freeAt(x, z, r)) return [x, z]; } return [0, 0]; }
// steer: push away from colliders, walls and other cats
function avoid(cat, out) {
  let ax = 0, az = 0; const x = cat.x, z = cat.z, R = 0.45;
  for (const c of COL) {
    if (!c.cat) continue;
    let dx, dz, d;
    if (c.r !== undefined) { dx = x - c.x; dz = z - c.z; d = hypot(dx, dz) - c.r; }
    else { const px = clamp(x, c.x0, c.x1), pz = clamp(z, c.z0, c.z1); dx = x - px; dz = z - pz; d = hypot(dx, dz); }
    if (d < R) { const l = hypot(dx, dz) || 1, k = (R - d) / R; ax += (dx / l) * k * k * 2; az += (dz / l) * k * k * 2; }
  }
  for (const o of CATS) {
    if (o === cat || o.perch) continue;
    const dx = x - o.x, dz = z - o.z, d = hypot(dx, dz);
    if (d < 0.5 && d > 1e-4) { const k = (0.5 - d) / 0.5; ax += (dx / d) * k * 1.5; az += (dz / d) * k * 1.5; }
  }
  const pdx = x - PL.x, pdz = z - PL.z, pd = hypot(pdx, pdz);
  if (pd < 0.6 && cat.st !== 'beg') { const k = (0.6 - pd) / 0.6; ax += (pdx / pd) * k * 2; az += (pdz / pd) * k * 2; }
  ax += sstep(RX - 0.6, RX - 0.2, -x) - sstep(RX - 0.6, RX - 0.2, x);
  az += sstep(RZ - 0.6, RZ - 0.2, -z) - sstep(RZ - 0.6, RZ - 0.2, z);
  out[0] = ax; out[1] = az;
}
const AV = [0, 0];
function setPose(cat, p) { cat.pose = p; }
function decide(cat) {
  const r = rnd();
  cat.toy = null; cat.mood = 0; cat.box = null; cat.y = cat.perch ? cat.y : 0;
  if (cat.perch) {
    const pr = cat.perch;
    if (r < pr.sleep * cat.sleepiness * 1.3) { cat.st = 'sleep'; setPose(cat, SLEEP); cat.tm = rr(18, 40); }
    else if (r < 0.75) { cat.st = 'idle'; setPose(cat, pick([SIT, LOAF, LOAF, SIT, STAND])); cat.tm = rr(6, 18); }
    else { cat.st = 'groom'; setPose(cat, GROOM); cat.tm = rr(5, 10); }
    return;
  }
  const dp = hypot(cat.x - PL.x, cat.z - PL.z);
  // needs come first: water, then food; with an empty bowl the cat comes to ask you
  if (cat.thirst > 0.55 && BOWL.water > 0.03) { cat.st = 'walk'; cat.goal = [BOWL.wx + rr(-0.2, 0.25), BOWL.z + rr(0.24, 0.36)]; cat.next = 'drink'; setPose(cat, STAND); cat.tm = 30; return; }
  if (cat.hunger > 0.55 && BOWL.food > 0.03) { cat.st = 'walk'; cat.goal = [BOWL.fx + rr(-0.25, 0.2), BOWL.z + rr(0.24, 0.36)]; cat.next = 'eat'; setPose(cat, STAND); cat.tm = 30; return; }
  if ((cat.hunger > 0.6 || cat.thirst > 0.6) && dp < 7 && rnd() < 0.6) { cat.st = 'beg'; cat.goal = [PL.x, PL.z]; setPose(cat, STAND); cat.tm = 15; cat.meowT = rr(0.5, 2); return; }
  // shop items are irresistible: a free box, a catnip cushion nearby
  if (BOXES.length && rnd() < 0.35) { const bx = pick(BOXES); if (!CATS.some((o) => o.box === bx)) { cat.st = 'walk'; cat.goal = [bx.x, bx.z]; cat.next = 'box'; cat.box = bx; setPose(cat, STAND); cat.tm = 30; return; } }
  for (const n of NIPS) if (cat.nipT <= 0 && hypot(n.x - cat.x, n.z - cat.z) < 3 && rnd() < 0.6) { cat.st = 'walk'; cat.goal = [n.x, n.z]; cat.next = 'nip'; setPose(cat, STAND); cat.tm = 30; return; }
  if (r < 0.12 && dp < 5 && dp > 1) { cat.st = 'beg'; cat.goal = [PL.x, PL.z]; setPose(cat, STAND); cat.tm = 20; return; }
  if (r < 0.32) { // play with the nearest free toy
    let best = null, bd = 1e9; for (const t of TOYS) { const d = hypot(t.x - cat.x, t.z - cat.z); if (d < bd && !CATS.some((o) => o.toy === t)) { bd = d; best = t; } }
    if (best) { cat.st = 'play'; cat.toy = best; cat.ph = 0; setPose(cat, STAND); cat.tm = 30; return; }
  }
  if (r < 0.42) { const b = pick(BEDS); if (!CATS.some((o) => o !== cat && hypot(o.x - b.x, o.z - b.z) < 0.4)) { cat.st = 'walk'; cat.goal = [b.x, b.z]; cat.next = 'bed'; setPose(cat, STAND); cat.tm = 30; return; } }
  if (r < 0.56) { cat.st = 'stretch'; setPose(cat, STRETCH); cat.tm = rr(2.5, 4); return; }
  if (r < 0.68) { cat.st = 'groom'; setPose(cat, GROOM); cat.tm = rr(5, 10); return; }
  if (r < 0.8) { cat.st = 'idle'; setPose(cat, pick([SIT, LOAF, SIT])); cat.tm = rr(5, 14); return; }
  cat.st = 'walk'; cat.goal = randFree(0.35); cat.next = null; setPose(cat, STAND); cat.tm = 30;
}
// walk towards (gx, gz); returns true when there
function walkTo(cat, gx, gz, dt, speed, stopAt = 0.12) {
  const dx = gx - cat.x, dz = gz - cat.z, d = hypot(dx, dz);
  if (d < stopAt) { cat.spd = damp(cat.spd, 0, 8, dt); return true; }
  avoid(cat, AV);
  let ux = dx / d + AV[0], uz = dz / d + AV[1]; const ul = hypot(ux, uz) || 1; ux /= ul; uz /= ul;
  const want = atan2(-uz, ux), da = wrapA(want - cat.yaw);
  cat.yaw += clamp(da, -3.2 * dt, 3.2 * dt);
  const sp = speed * clamp(1.2 - abs(da) / 1.6, 0.15, 1) * clamp(d / 0.3, 0.35, 1);
  cat.spd = damp(cat.spd, sp, 5, dt);
  const nx = cat.x + cos(cat.yaw) * cat.spd * dt, nz = cat.z - sin(cat.yaw) * cat.spd * dt;
  if (freeAt(nx, nz, CATR * cat.scale)) { cat.x = nx; cat.z = nz; } else if (freeAt(nx, cat.z, CATR * cat.scale)) cat.x = nx; else if (freeAt(cat.x, nz, CATR * cat.scale)) cat.z = nz;
  return false;
}
function faceTo(cat, x, z, dt, k = 3) { const want = atan2(-(z - cat.z), x - cat.x), da = wrapA(want - cat.yaw); cat.yaw += clamp(da, -k * dt, k * dt); return abs(da); }

function initCats() {
  // shuffle the perches, give about half of the cats one
  const perches = PERCH.slice().sort(() => rnd() - 0.5);
  CATS.forEach((c, i) => {
    if (i % 2 === 0 && perches.length && c.scale > 0.7) {
      const p = perches.pop(); c.perch = p; c.x = p.x; c.y = p.y; c.z = p.z; c.yaw = p.yaw + rr(-0.3, 0.3);
    } else { const [x, z] = randFree(0.4); c.x = x; c.z = z; }
    decide(c); c.tm *= rnd();
    c.pw[c.pose] = 1;
  });
}

function updateCat(cat, dt, t) {
  cat.tm -= dt;
  // needs: hungry in ~8 minutes, thirsty in ~6; well-being drifts towards how fed and loved the cat is
  cat.hunger = min(1, cat.hunger + dt / 480); cat.thirst = min(1, cat.thirst + dt / 360);
  const target = 0.85 - 0.5 * max(cat.hunger, cat.thirst) - (cat.st === 'sleep' ? -0.05 : 0);
  cat.joy = clamp(cat.joy + (target - cat.joy) * dt / 240 + (cat.pet > 0 ? dt * (SAVE && SAVE.brush ? 0.09 : 0.05) : 0), 0, 1);
  // a perched cat that is very hungry or thirsty jumps down
  if (cat.perch && (cat.hunger > 0.75 || cat.thirst > 0.75) && cat.pet <= 0 && cat.st !== 'sleep') {
    const [x, z] = (() => { for (let k = 0; k < 40; k++) { const a = rr(0, TAU), x = cat.perch.x + cos(a) * rr(0.4, 0.9), z = cat.perch.z + sin(a) * rr(0.4, 0.9); if (freeAt(x, z, 0.25)) return [x, z]; } return randFree(0.3); })();
    cat.perch = null; cat.x = x; cat.z = z; cat.y = 0; decide(cat);
  }
  const P = cat.pv;
  let walking = false, targetLid = 0, look = 0;
  const dpl = hypot(cat.x - PL.x, cat.z - PL.z);
  cat.tailSw = 0.25; cat.tailF = 1.1; cat.tailTip = 0;
  if (cat.pet > 0) { // being petted: each cat answers in its own way (see the reactions below)
    cat.spd = damp(cat.spd, 0, 8, dt); targetLid = cat.st === 'sleep' ? 1 : 0.8; look = 1; cat.tailSw = 0.08; cat.hop = 0;
    if (!cat.petMode) {
      const floor = !cat.perch && cat.st !== 'box';
      cat.petMode = cat.st === 'sleep' ? 'sleepy' : floor && rnd() < 0.22 ? 'roll' : cat.pose === STAND && rnd() < 0.6 ? 'arch' : pick(['rub', 'rub', 'knead']);
      if (cat.petMode === 'roll') setPose(cat, ROLL);
      else if (cat.petMode !== 'arch' && cat.pose !== LOAF && cat.st !== 'sleep') setPose(cat, SIT);
      if (cat.petMode === 'knead' && cat.pose === LOAF) setPose(cat, SIT);
      if (rnd() < 0.5) cat.meowT = rr(0.3, 1.5);
    }
    cat.petPh += dt / 1.25;
    if (!cat.perch && cat.st !== 'box' && cat.petMode !== 'roll' && cat.st !== 'sleep') faceTo(cat, PL.x, PL.z, dt, 1.2);
    if (cat.st !== 'sleep' && cat.st !== 'box') { cat.st = 'petted'; cat.tm = rr(4, 8); }
  } else {
    if (cat.petMode) { if (cat.petMode === 'roll' && cat.st === 'petted') setPose(cat, SIT); cat.petMode = null; }
    if (cat.nipT > 0) cat.nipT -= dt;
    // the laser dot pulls in every awake cat on the floor that can see it
    if (LASER.on && !cat.perch && cat.st !== 'chase' && cat.st !== 'sleep' && cat.st !== 'box' && hypot(LASER.x - cat.x, LASER.z - cat.z) < 5) { cat.st = 'chase'; cat.ph = 0; cat.toy = null; cat.tm = 60; setPose(cat, STAND); }
  }
  if (cat.pet <= 0) switch (cat.st) {
    case 'idle': case 'petted':
      look = dpl < 3.5 ? 1 : 0;
      targetLid = cat.pose === LOAF ? 0.45 : 0.05;
      if (cat.tm < 0) decide(cat);
      break;
    case 'sleep': targetLid = 1; cat.tailSw = 0.04; if (cat.tm < 0) decide(cat); break;
    case 'groom': { targetLid = 0.6; cat.lick = (cat.lick + dt * 4.5) % TAU; if (cat.tm < 0) decide(cat); break; }
    case 'stretch': targetLid = 0.7; cat.tailSw = 0.1; if (cat.tm < 0) { cat.st = 'idle'; setPose(cat, SIT); cat.tm = rr(3, 8); } break;
    case 'walk': {
      walking = true; cat.tailSw = 0.35; cat.tailTip = -0.3;
      if (cat.zoom > 0) cat.zoom -= dt;
      if (walkTo(cat, cat.goal[0], cat.goal[1], dt, cat.zoom > 0 ? 1.1 : 0.38) || cat.tm < 0) {
        if (cat.next === 'bed') { cat.st = 'sleep'; setPose(cat, SLEEP); cat.tm = rr(20, 45); }
        else if (cat.next === 'eat' || cat.next === 'drink') { cat.st = cat.next; setPose(cat, CROUCH); cat.tm = rr(6, 10); }
        else if (cat.next === 'box' && cat.box) { cat.st = 'box'; setPose(cat, rnd() < 0.5 ? LOAF : SIT); cat.tm = rr(20, 45); cat.x = cat.box.x; cat.z = cat.box.z; cat.y = 0.008; }
        else if (cat.next === 'nip') { cat.st = 'nip'; setPose(cat, ROLL); cat.tm = rr(7, 11); cat.nipT = 45; meow(cat, 0.8); }
        else { cat.st = 'idle'; setPose(cat, pick([SIT, STAND, LOAF])); cat.tm = rr(3, 9); }
      }
      break;
    }
    case 'eat': case 'drink': { // the bowl empties as they eat; an empty bowl ends the meal
      const food = cat.st === 'eat', bx = food ? BOWL.fx : BOWL.wx;
      faceTo(cat, bx, BOWL.z, dt); targetLid = 0.3;
      if (food) { if (BOWL.food > 0) { cat.hunger = max(0, cat.hunger - dt * 0.09); BOWL.food = max(0, BOWL.food - dt * 0.006); } else cat.tm = min(cat.tm, 0); }
      else { if (BOWL.water > 0) { cat.thirst = max(0, cat.thirst - dt * 0.12); BOWL.water = max(0, BOWL.water - dt * 0.005); } else cat.tm = min(cat.tm, 0); }
      if (cat.tm < 0 || (food ? cat.hunger : cat.thirst) < 0.02) { cat.joy = min(1, cat.joy + 0.1); decide(cat); }
      break;
    }
    case 'snack': targetLid = 0.6; cat.mood = 1; if (cat.tm < 0) decide(cat); break;
    case 'box': look = dpl < 3 ? 1 : 0; targetLid = 0.3; cat.x = cat.box.x; cat.z = cat.box.z; if (cat.tm < 0) { cat.y = 0; decide(cat); } break;
    case 'nip': { // catnip: roll around on the back, then zoom off
      targetLid = 0.55; cat.happy = 1; cat.tailSw = 0.6; cat.tailF = 4; cat.mood = 1;
      if (cat.tm < 0) { cat.st = 'walk'; cat.goal = randFree(0.35); cat.next = null; cat.zoom = 6; setPose(cat, STAND); cat.tm = 12; }
      break;
    }
    case 'chase': { // the laser dot
      walking = true; cat.tailSw = 0.6; cat.tailF = 5;
      const d = hypot(LASER.x - cat.x, LASER.z - cat.z);
      if (!LASER.on || d > 6) { decide(cat); break; }
      if (cat.ph === 2) {
        cat.jump += dt / 0.35; const k = min(cat.jump, 1);
        const nx = mix(cat.jx, cat.ex, sstep(0, 1, k)), nz = mix(cat.jz, cat.ez, sstep(0, 1, k));
        if (freeAt(nx, nz, CATR * cat.scale)) { cat.x = nx; cat.z = nz; }
        cat.hop = sin(PI * k) * 0.14; walking = false;
        if (k >= 1) { cat.hop = 0; cat.ph = 0; }
      } else if (d < 0.5 && d > 0.2 && rnd() < dt * 2.5) { cat.ph = 2; cat.jump = 0; cat.jx = cat.x; cat.jz = cat.z; cat.ex = LASER.x; cat.ez = LASER.z; faceTo(cat, LASER.x, LASER.z, 1, 10); }
      else { setPose(cat, d < 0.25 ? CROUCH : STAND); walkTo(cat, LASER.x, LASER.z, dt, 0.95, 0.18); if (d < 0.25) faceTo(cat, LASER.x, LASER.z, dt, 6); }
      break;
    }
    case 'beg': {
      walking = dpl > 0.75; look = dpl < 2.5 ? 1 : 0;
      if (walking) { cat.tailSw = 0.2; cat.mood = 1; walkTo(cat, PL.x, PL.z, dt, 0.42, 0.7); }
      else { cat.spd = damp(cat.spd, 0, 8, dt); faceTo(cat, PL.x, PL.z, dt); if (cat.pose !== SIT) setPose(cat, SIT); cat.mood = 1; if (cat.meowT > 2) cat.meowT = rr(0.5, 2); }
      if (cat.tm < 0 || dpl > 6) decide(cat);
      break;
    }
    case 'play': {
      const ty = cat.toy, d = hypot(ty.x - cat.x, ty.z - cat.z);
      cat.tailSw = 0.5; cat.tailF = 3;
      if (cat.ph === 0) { // stalk up to it
        walking = true; setPose(cat, STAND);
        if (walkTo(cat, ty.x, ty.z, dt, 0.4, 0.45)) { cat.ph = 1; cat.tm2 = rr(1, 2.2); setPose(cat, CROUCH); }
      } else if (cat.ph === 1) { // crouch and wiggle
        faceTo(cat, ty.x, ty.z, dt, 4); cat.tm2 -= dt; cat.tailSw = 0.7; cat.tailF = 6;
        if (d > 0.7) cat.ph = 0;
        if (cat.tm2 < 0) { cat.ph = 2; cat.jump = 0; cat.jx = cat.x; cat.jz = cat.z; setPose(cat, STAND); }
      } else if (cat.ph === 2) { // pounce
        cat.jump += dt / 0.4;
        const k = min(cat.jump, 1), ex = ty.x - cos(cat.yaw) * 0.18, ez = ty.z + sin(cat.yaw) * 0.18;
        const nx = mix(cat.jx, ex, sstep(0, 1, k)), nz = mix(cat.jz, ez, sstep(0, 1, k));
        if (freeAt(nx, nz, CATR * cat.scale)) { cat.x = nx; cat.z = nz; }
        cat.hop = sin(PI * k) * 0.12;
        if (k >= 1) { cat.hop = 0; cat.ph = 3; cat.tm2 = rr(1.2, 2.5); hitToy(ty, cat.yaw + rr(-0.6, 0.6), rr(0.6, 1.4)); }
      } else { // bat it
        faceTo(cat, ty.x, ty.z, dt, 4); cat.tm2 -= dt;
        if (d > 0.5) { cat.ph = 0; }
        else if (cat.tm2 < 0) { if (rnd() < 0.4) { hitToy(ty, cat.yaw + rr(-1, 1), rr(0.3, 0.9)); cat.swipe = 1; } cat.tm2 = rr(0.6, 1.6); }
        setPose(cat, d < 0.35 ? SIT : STAND);
      }
      if (cat.tm < 0) decide(cat);
      break;
    }
  }
  if (cat.perch) { cat.x = cat.perch.x; cat.y = cat.perch.y; cat.z = cat.perch.z; }
  // blend the pose weights
  for (let k = 0; k < NPOSE; k++) cat.pw[k] = damp(cat.pw[k], k === cat.pose ? 1 : 0, cat.pose === SLEEP || cat.pw[SLEEP] > 0.1 ? 2.2 : 3.5, dt);
  let ws = 0; for (let k = 0; k < NPOSE; k++) ws += cat.pw[k];
  P.fill(0);
  for (let k = 0; k < NPOSE; k++) { const w = cat.pw[k] / ws; if (w < 1e-4) continue; const Q = POSES[k]; for (let j = 0; j < 24; j++) P[j] += Q[j] * w; }
  if (cat.st === 'eat' || cat.st === 'drink' || cat.st === 'snack') { P[7] = -0.75 + 0.06 * sin(t * (cat.st === 'drink' ? 9 : 5)); }
  // walk cycle
  cat.walk = damp(cat.walk, walking ? clamp(cat.spd / 0.25, 0, 1) : 0, 6, dt);
  if (cat.walk > 0.01) {
    cat.gait = (cat.gait + dt * (cat.spd / (0.15 * cat.scale) + 0.15)) % 1;
    const OFF = [0.25, 0.75, 0, 0.5], S = 0.13;
    for (let l = 0; l < 4; l++) {
      const ph = (cat.gait + OFF[l]) % 1; let dx, dy = 0;
      if (ph < 0.62) dx = S * (0.5 - ph / 0.62);
      else { const s = (ph - 0.62) / 0.38; dx = S * (-0.5 + sstep(0, 1, s)); dy = sin(PI * s) * 0.032; if (l < 2) P[21] -= sin(PI * s) * 0.6 * cat.walk / 2; else P[22] -= sin(PI * s) * 0.5 * cat.walk / 2; }
      P[13 + l * 2] += dx * cat.walk; P[14 + l * 2] += dy * cat.walk;
    }
    P[0] -= abs(sin(cat.gait * TAU * 2)) * 0.006 * cat.walk;
    P[3] += sin(cat.gait * TAU) * 0.03 * cat.walk;
    P[7] += sin(cat.gait * TAU * 2) * 0.03 * cat.walk;
  }
  if (cat.hop) P[0] += cat.hop;
  // crouch wiggle before pouncing
  if (cat.st === 'play' && cat.ph === 1) { P[1] += sin(t * 18) * 0.008; P[3] += sin(t * 18) * 0.06; }
  // grooming: lick the raised paw
  if (cat.st === 'groom') { P[7] += sin(cat.lick) * 0.12; P[14] += sin(cat.lick) * 0.01; }
  if (cat.swipe > 0) { cat.swipe -= dt * 3; P[13] += sin(cat.swipe * PI) * 0.12; P[14] += sin(cat.swipe * PI) * 0.1; P[21] += sin(cat.swipe * PI) * 1.2; }
  // petting reactions, in rhythm with the strokes
  if (cat.pet > 0 && cat.petMode) {
    const ph = cat.petPh * TAU, sn = sin(ph);
    if (cat.petMode === 'rub') { P[7] += 0.16 * sn; P[9] += 0.32 * sin(ph + 1); P[6] += 0.12 * sn; P[3] += 0.07 * sin(ph + 0.5); P[0] += 0.006 * (sn + 1); P[23] += 0.15 * sin(ph * 0.5); }
    else if (cat.petMode === 'knead') { const k = sin(ph * 1.7); P[14] += 0.028 * max(0, k); P[16] += 0.028 * max(0, -k); P[13] += 0.012 * k; P[15] -= 0.012 * k; P[9] += 0.12 * sin(ph * 0.5); P[7] += 0.08; }
    else if (cat.petMode === 'arch') { P[0] += 0.012 + 0.006 * sn; P[2] += 0.06; P[4] -= 0.16; P[6] += 0.1; P[10] = 1.6; P[11] = -0.06; cat.tailSw = 0.05; cat.tailF = 14; P[1] += 0.01 * sn; }
    else if (cat.petMode === 'roll') { P[3] += 0.22 * sin(ph * 0.5); P[14] += 0.03 * sin(t * 4.5); P[16] += 0.03 * sin(t * 4.5 + 2); P[21] += 0.5 * sin(t * 4.5); P[9] += 0.25 * sin(ph * 0.5); }
    else { P[4] += 0.04 * sn; P[9] += 0.05 * sn; } // sleepy: a slow stretch into the hand
  }
  if (cat.st === 'nip') { const w = t * 3.2; P[3] += 0.35 * sin(w * 0.6); P[14] += 0.035 * sin(w * 1.7); P[16] += 0.035 * sin(w * 1.9 + 1); P[18] += 0.03 * sin(w * 1.3); P[21] += 0.7 * sin(w * 1.7); P[9] += 0.4 * sin(w * 0.5); }
  // breathing
  P[4] += sin(t * (cat.st === 'sleep' ? 1.8 : 2.6) + cat.i) * 0.012;
  // happy tail: up with a curl at the tip
  const happy = cat.mood > 0 || cat.pet > 0 ? 1 : 0;
  cat.happy = damp(cat.happy || 0, happy, 3, dt);
  if (cat.pw[STAND] > 0.3) { P[10] = mix(P[10], 1.35, cat.happy * cat.pw[STAND]); P[11] = mix(P[11], -0.12, cat.happy * cat.pw[STAND]); }
  // look at the player (head and neck share it)
  cat.look = damp(cat.look, look && cat.st !== 'sleep' ? 1 : 0, 2.5, dt);
  if (cat.look > 0.01) {
    const hx = cat.sp[2][0], hy = cat.sp[2][1], hz = cat.sp[2][2];
    const dx = PL.x - hx, dz = PL.z - hz, dy = PL.eye - hy;
    const rel = wrapA(atan2(-dz, dx) - cat.yaw), el = atan2(dy, hypot(dx, dz));
    cat.lookYaw = damp(cat.lookYaw, clamp(rel, -1.3, 1.3), 4, dt); cat.lookPitch = damp(cat.lookPitch, clamp(el, -0.4, 0.9), 4, dt);
    P[23] += cat.lookYaw * 0.4 * cat.look; P[8] += cat.lookYaw * 0.6 * cat.look; P[7] += cat.lookPitch * 0.8 * cat.look;
  }
  // eyelids and blinking
  cat.blink -= dt; if (cat.blink < 0) cat.blink = rr(2, 7);
  const bl = cat.blink < 0.14 ? 1 : 0;
  cat.lid = damp(cat.lid, max(targetLid, bl), bl ? 30 : 6, dt);
  cat.P[13] = cat.lid;
  // meows
  cat.meowT -= dt * (dpl < 3 ? 1.6 : 1);
  if (cat.meowT < 0) { cat.meowT = rr(10, 35); if (cat.st !== 'sleep' && typeof meow === 'function') meow(cat, cat.pet > 0 ? 0.55 : 1); }
  pose(cat, t + cat.i * 3.7);
}

// ---------------------------------------------------------------- toys roll and bounce
function hitToy(ty, a, s) { ty.vx += cos(a) * s; ty.vz -= sin(a) * s; }
const RT = new Float32Array(16), RT2 = new Float32Array(16);
function updateToys(dt) {
  for (const ty of TOYS) {
    if (ty.kind === 'mouse') { // a wind-up mouse scurries in curves until it runs down; a hit winds it up again
      if (hypot(ty.vx, ty.vz) > 0.25) { ty.wind = rr(3, 6); ty.yaw = atan2(-ty.vz, ty.vx); }
      ty.vx = ty.vz = 0;
      if (ty.wind > 0) {
        ty.wind -= dt; ty.yaw += sin(ty.wind * 2.3 + ty.x * 3) * 2.5 * dt;
        const v = 0.55 * min(1, ty.wind), nx = ty.x + cos(ty.yaw) * v * dt, nz = ty.z - sin(ty.yaw) * v * dt;
        if (freeAt(nx, nz, 0.05)) { ty.x = nx; ty.z = nz; } else ty.yaw += PI * 0.6;
      }
      ident(ty.R); ry(ty.R, ty.yaw); rz(ty.R, ty.wind > 0 ? sin(ty.wind * 40) * 0.05 : 0);
      const dx = ty.x - PL.x, dz = ty.z - PL.z; if (hypot(dx, dz) < 0.3 && ty.wind <= 0) { ty.wind = rr(3, 5); ty.yaw = atan2(-dz, dx); }
      continue;
    }
    const sp = hypot(ty.vx, ty.vz);
    if (sp > 1e-3) {
      let nx = ty.x + ty.vx * dt, nz = ty.z + ty.vz * dt;
      if (!freeAt(nx, ty.z, ty.r)) { ty.vx *= -0.6; nx = ty.x; }
      if (!freeAt(ty.x, nz, ty.r)) { ty.vz *= -0.6; nz = ty.z; }
      for (const c of COL) { if (c.cat || c.r === undefined) continue; const dx = nx - c.x, dz = nz - c.z, d = hypot(dx, dz); if (d < 0.05 + ty.r && d > 0) { const vn = (ty.vx * dx + ty.vz * dz) / d; if (vn < 0) { ty.vx -= 1.6 * vn * dx / d; ty.vz -= 1.6 * vn * dz / d; } } }
      ty.x = nx; ty.z = nz;
      // roll: rotate about the axis perpendicular to the motion
      const ax = ty.vz / sp, az = -ty.vx / sp, an = (sp * dt) / ty.r;
      ident(RT); const c = cos(an), s = sin(an), k = 1 - c;
      RT[0] = c + ax * ax * k; RT[1] = az * s; RT[2] = ax * az * k; RT[4] = -az * s; RT[5] = c; RT[6] = ax * s; RT[8] = ax * az * k; RT[9] = -ax * s; RT[10] = c + az * az * k;
      mul4(ty.R, RT, ty.R);
      const f = exp(-dt * 1.4); ty.vx *= f; ty.vz *= f;
    }
    // the player can kick them
    const dx = ty.x - PL.x, dz = ty.z - PL.z, d = hypot(dx, dz);
    if (d < 0.32 && d > 0) { const push = (0.32 - d) * 8; ty.vx += (dx / d) * push * dt * 10; ty.vz += (dz / d) * push * dt * 10; }
  }
}
