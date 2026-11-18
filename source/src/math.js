// ============================================================================
// math: random numbers, 4x4 matrices and mesh-building helpers
// ============================================================================
const { sin, cos, tan, abs, min, max, sqrt, floor, PI, hypot, exp, pow, atan2, acos, sign, round } = Math;
const TAU = PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const mix = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => b + (a - b) * exp(-k * dt); // frame-rate independent ease of a towards b
const wrapA = (a) => { while (a > PI) a -= TAU; while (a < -PI) a += TAU; return a; };

// mulberry32: the whole world is built from one seed, so it is the same on every visit
let SEED = 20251;
const rnd = () => { let t = (SEED = (SEED + 0x6d2b79f5) | 0); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rr = (a, b) => a + (b - a) * rnd();
const pick = (a) => a[(rnd() * a.length) | 0];

// ---------------------------------------------------------------- 4x4 matrices, column-major like WGSL
const M4 = () => ident(new Float32Array(16));
function ident(o) { o.fill(0); o[0] = o[5] = o[10] = o[15] = 1; return o; }
const _mt = new Float32Array(16);
function mul4(o, a, b) { // o = a * b (o may alias a or b)
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
    for (let r = 0; r < 4; r++) _mt[c * 4 + r] = a[r] * b0 + a[4 + r] * b1 + a[8 + r] * b2 + a[12 + r] * b3;
  }
  o.set(_mt); return o;
}
// in-place right-multiplications: m = m * T / R / S (no allocation)
function tr(m, x, y, z) { for (let r = 0; r < 4; r++) m[12 + r] += m[r] * x + m[4 + r] * y + m[8 + r] * z; return m; }
function rotAxis(m, i, j, a) { // rotate columns i,j by angle a
  const c = cos(a), s = sin(a);
  for (let r = 0; r < 4; r++) { const u = m[i * 4 + r], v = m[j * 4 + r]; m[i * 4 + r] = u * c + v * s; m[j * 4 + r] = v * c - u * s; }
  return m;
}
const rx = (m, a) => rotAxis(m, 1, 2, a); // y towards z
const ry = (m, a) => rotAxis(m, 2, 0, a); // z towards x
const rz = (m, a) => rotAxis(m, 0, 1, a); // x towards y
function sc(m, x, y = x, z = x) { for (let r = 0; r < 4; r++) { m[r] *= x; m[4 + r] *= y; m[8 + r] *= z; } return m; }
function persp(o, fovy, asp, n, f) {
  const t = 1 / tan(fovy / 2); o.fill(0);
  o[0] = t / asp; o[5] = t; o[10] = f / (n - f); o[11] = -1; o[14] = (n * f) / (n - f); return o;
}
function ortho(o, l, r, b, t, n, f) {
  o.fill(0); o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = 1 / (n - f);
  o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = n / (n - f); o[15] = 1; return o;
}
function lookAt(o, ex, ey, ez, tx, ty, tz, ux = 0, uy = 1, uz = 0) {
  let zx = ex - tx, zy = ey - ty, zz = ez - tz, l = hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
  let xx = uy * zz - uz * zy, xy = uz * zx - ux * zz, xz = ux * zy - uy * zx; l = hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  o[0] = xx; o[1] = yx; o[2] = zx; o[3] = 0; o[4] = xy; o[5] = yy; o[6] = zy; o[7] = 0;
  o[8] = xz; o[9] = yz; o[10] = zz; o[11] = 0;
  o[12] = -(xx * ex + xy * ey + xz * ez); o[13] = -(yx * ex + yy * ey + yz * ez); o[14] = -(zx * ex + zy * ey + zz * ez); o[15] = 1;
  return o;
}
function inv4(o, m) {
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * d; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * d;
  o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * d; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * d;
  o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * d; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * d;
  o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * d; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * d;
  o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * d; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * d;
  o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * d;
  o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d;
  o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d;
  return o;
}
// a placement matrix for building: T(x,y,z) * Ry(yaw) * Rx(a) * Rz(b)
const place = (x, y, z, yaw = 0, ax = 0, az = 0) => rz(rx(ry(tr(M4(), x, y, z), yaw), ax), az);
const mat = (m, f) => { const o = M4(); o.set(m); f(o); return o; }; // a copy of m changed by f

// ---------------------------------------------------------------- mesh builder
// vertex: position f32x3, normal snorm8x4, colour unorm8x4 (sRGB rgb + material id), uv unorm16x2 = 24 bytes
const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const shade = (c, k) => c.map((v) => clamp(v * k, 0, 1));
const jitter = (c, k) => { const f = 1 + (rnd() - 0.5) * k; return c.map((v) => clamp(v * f * (1 + (rnd() - 0.5) * k * 0.3), 0, 1)); };
class Mesh {
  constructor() { this.p = []; this.a = []; this.i = []; this.n = 0; }
  // add a vertex: local position / normal transformed by M
  v(M, x, y, z, nx, ny, nz, col, m, u = 0, w = 0) {
    this.p.push(M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]);
    let X = M[0] * nx + M[4] * ny + M[8] * nz, Y = M[1] * nx + M[5] * ny + M[9] * nz, Z = M[2] * nx + M[6] * ny + M[10] * nz;
    const l = hypot(X, Y, Z) || 1;
    this.a.push(X / l, Y / l, Z / l, col[0], col[1], col[2], m, u, w);
    return this.n++;
  }
  // a triangle, wound so its face points the same way as its vertex normals (so callers never think about winding)
  t(a, b, c) {
    const P = this.p, A = this.a;
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const nx = A[a * 9] + A[b * 9] + A[c * 9], ny = A[a * 9 + 1] + A[b * 9 + 1] + A[c * 9 + 1], nz = A[a * 9 + 2] + A[b * 9 + 2] + A[c * 9 + 2];
    if (fx * nx + fy * ny + fz * nz < 0) this.i.push(a, c, b); else this.i.push(a, b, c);
  }
  q(a, b, c, d) { this.t(a, b, c); this.t(a, c, d); }
  // grid of (nu+1)*(nv+1) vertices from f(u,v) -> [x,y,z,nx,ny,nz], then quads between them
  grid(M, nu, nv, f, col, m, uv) {
    const b = this.n;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const r = f(i / nu, j / nv); this.v(M, r[0], r[1], r[2], r[3], r[4], r[5], r[6] || col, m, uv ? i / nu : 0, uv ? j / nv : 0); }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = b + j * (nu + 1) + i; this.q(a, a + 1, a + nu + 2, a + nu + 1); }
  }
  // pack into the GPU layout
  pack() {
    const ab = new ArrayBuffer(this.n * 24), f = new Float32Array(ab), u8 = new Uint8Array(ab), i8 = new Int8Array(ab), u16 = new Uint16Array(ab);
    for (let k = 0; k < this.n; k++) {
      const o = k * 24, A = this.a, s = k * 9;
      f[o / 4] = this.p[k * 3]; f[o / 4 + 1] = this.p[k * 3 + 1]; f[o / 4 + 2] = this.p[k * 3 + 2];
      i8[o + 12] = round(A[s] * 127); i8[o + 13] = round(A[s + 1] * 127); i8[o + 14] = round(A[s + 2] * 127);
      u8[o + 16] = round(clamp(A[s + 3], 0, 1) * 255); u8[o + 17] = round(clamp(A[s + 4], 0, 1) * 255); u8[o + 18] = round(clamp(A[s + 5], 0, 1) * 255); u8[o + 19] = A[s + 6];
      u16[o / 2 + 10] = round(clamp(A[s + 7], 0, 1) * 65535); u16[o / 2 + 11] = round(clamp(A[s + 8], 0, 1) * 65535);
    }
    return { vb: ab, ib: new Uint32Array(this.i), count: this.i.length };
  }
}

// material ids (must match the switch in shaders.js)
const FLOOR = 0, WALL = 1, BRICK = 2, WOOD = 3, FABRIC = 4, SISAL = 5, PLUSH = 6, CERAMIC = 7, METAL = 8, EMIT = 9,
  LEAF = 10, RUG = 11, SKY = 12, MARBLE = 13, ART = 14, GLASS = 15, YARN = 16, PLAIN = 17, TERRA = 18, PAINT = 19, CEIL = 20;

// rounded box w*h*d centred at the origin of M, edge radius r (0 = sharp, flat normals)
function rbox(m, M, w, h, d, r, col, mt, rs = 3) {
  const H = [w / 2, h / 2, d / 2];
  r = min(r, H[0], H[1], H[2]);
  const coords = (hh) => {
    const c = [], k = hh - r;
    if (r > 0) for (let i = rs; i >= 1; i--) c.push(-k - r * tan((i / rs) * PI / 4));
    c.push(-k); if (k > 1e-6) c.push(k);
    if (r > 0) for (let i = 1; i <= rs; i++) c.push(k + r * tan((i / rs) * PI / 4));
    return c;
  };
  const L = H.map(coords);
  for (let ax = 0; ax < 3; ax++) for (const s of [-1, 1]) {
    const a1 = (ax + 1) % 3, a2 = (ax + 2) % 3, C1 = L[a1], C2 = L[a2], b = m.n;
    for (const y of C2) for (const x of C1) {
      const p = [0, 0, 0]; p[ax] = s * H[ax]; p[a1] = x; p[a2] = y;
      let n = [0, 0, 0];
      if (r > 0) {
        const c = p.map((v, i) => clamp(v, -(H[i] - r), H[i] - r)), dd = p.map((v, i) => v - c[i]), l = hypot(...dd);
        n = dd.map((v) => v / l); for (let i = 0; i < 3; i++) p[i] = c[i] + n[i] * r;
      } else n[ax] = s;
      m.v(M, p[0], p[1], p[2], n[0], n[1], n[2], col, mt, (p[a1] / (2 * H[a1])) + 0.5, (p[a2] / (2 * H[a2])) + 0.5);
    }
    const nu = C1.length;
    for (let j = 0; j < C2.length - 1; j++) for (let i = 0; i < nu - 1; i++) { const a = b + j * nu + i; m.q(a, a + 1, a + nu + 1, a + nu); }
  }
}
const box = (m, M, w, h, d, col, mt) => rbox(m, M, w, h, d, 0, col, mt);
// surface of revolution around +y; prof = [[r, y], ...] from bottom to top
function lathe(m, M, prof, seg, col, mt, a0 = 0, a1 = TAU) {
  const n = prof.length, N = [];
  for (let i = 0; i < n; i++) { // profile normal: average of the neighbouring segment normals
    let nx = 0, ny = 0;
    for (const [j, k] of [[i - 1, i], [i, i + 1]]) {
      if (j < 0 || k >= n) continue;
      const dr = prof[k][0] - prof[j][0], dy = prof[k][1] - prof[j][1], l = hypot(dr, dy) || 1;
      nx += dy / l; ny += -dr / l;
    }
    const l = hypot(nx, ny) || 1; N.push([nx / l, ny / l]);
  }
  m.grid(M, seg, n - 1, (u, v) => {
    const a = a0 + (a1 - a0) * u, i = round(v * (n - 1)), [r, y] = prof[i], [nr, ny] = N[i];
    return [cos(a) * r, y, -sin(a) * r, cos(a) * nr, ny, -sin(a) * nr];
  }, col, mt, true);
}
function cyl(m, M, r, h, col, mt, seg = 20, caps = 3, r2 = r) {
  lathe(m, M, [[r, 0], [r2, h]], seg, col, mt);
  if (caps & 1) lathe(m, M, [[0, 0], [r, 0]], seg, col, mt);
  if (caps & 2) lathe(m, M, [[r2, h], [0, h]], seg, col, mt);
}
function sphere(m, M, r, col, mt, seg = 16, sy = 1) {
  const p = []; for (let i = 0; i <= seg / 2; i++) { const a = (i / (seg / 2)) * PI; p.push([sin(a) * r, -cos(a) * r * sy]); }
  lathe(m, M, p, seg, col, mt);
}
function torus(m, M, R, r, col, mt, s1 = 32, s2 = 12) {
  m.grid(M, s1, s2, (u, v) => {
    const a = u * TAU, b = v * TAU, cx = cos(a), cz = -sin(a), cb = cos(b), sb = sin(b);
    return [cx * (R + r * cb), r * sb, cz * (R + r * cb), cx * cb, sb, cz * cb];
  }, col, mt);
}
// thin double-sided quad in the local xy plane, facing +z (and a back face facing -z)
function card(m, M, w, h, col, mt, back = true) {
  m.grid(M, 1, 1, (u, v) => [(u - 0.5) * w, (v - 0.5) * h, 0, 0, 0, 1], col, mt, true);
  if (back) m.grid(M, 1, 1, (u, v) => [(u - 0.5) * w, (v - 0.5) * h, -0.002, 0, 0, -1], col, mt, true);
}
// a leaf along +x, length L, width W, bent down by `bend`, both sides
function leaf(m, M, L, W, col, bend = 0.3, fold = 0.2) {
  for (const s of [1, -1]) m.grid(M, 6, 2, (u, v) => {
    const x = u * L, wv = (v - 0.5) * 2, wid = W * sin(PI * pow(u, 0.7)) * 0.5, z = wv * wid, y = -bend * u * u * L + abs(wv) * wid * fold;
    const dy = -2 * bend * u; // slope along the leaf
    let nx = -dy * s, ny = 1 * s, nz = -sign(wv) * fold * s; const l = hypot(nx, ny, nz);
    return [x, y + (s < 0 ? -0.0015 : 0), z, nx / l, ny / l, nz / l];
  }, col, LEAF, true);
}
