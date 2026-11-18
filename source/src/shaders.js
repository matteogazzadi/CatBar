// ============================================================================
// WGSL sources
// ============================================================================
// Shared scene code: uniforms, noise, sun shadow, lights. Everything in the room is lit by one shadowed sun coming
// in through the front windows, a few warm lamps, a fake bounce light and an ambient term darkened by SSAO.

const W_COMMON = /*wgsl*/`
struct G {
  vp: mat4x4f, ivp: mat4x4f, svp: mat4x4f,
  cam: vec4f,   // camera position, time
  sun: vec4f,   // direction to the sun, ssao on
  sunc: vec4f,  // sun colour, light shaft density
  scr: vec4f,   // render size, 1 / size
  misc: vec4f,  // exposure, frame, ambient, -
  cr: vec4f, cu: vec4f, // camera right / up
  L: array<vec4f, 16>, // 8 lights: position + radius, colour + diffuse-only flag
};
struct CatP { c0: vec4f, c1: vec4f, c2: vec4f, c3: vec4f, c4: vec4f };
@group(0) @binding(0) var<uniform> u: G;
@group(0) @binding(1) var sRep: sampler;
@group(0) @binding(2) var sCl: sampler;
@group(0) @binding(3) var sCmp: sampler_comparison;
@group(0) @binding(4) var tSh: texture_depth_2d;
@group(0) @binding(5) var tAO: texture_2d<f32>;
@group(0) @binding(6) var tArt: texture_2d_array<f32>;
@group(0) @binding(7) var<storage, read> MD: array<mat4x4f>;
@group(0) @binding(8) var<storage, read> BN: array<mat4x4f>;
@group(0) @binding(9) var<storage, read> CP: array<CatP>;
@group(0) @binding(10) var<storage, read> PT: array<vec4f>;

const PI = 3.14159265;
fn sat(x: f32) -> f32 { return clamp(x, 0., 1.); }
fn ss(a: f32, b: f32, x: f32) -> f32 { let t = sat((x - a) / (b - a)); return t * t * (3. - 2. * t); }
fn srgb(c: vec3f) -> vec3f { return pow(c, vec3f(2.2)); }
fn h21(p: vec2f) -> f32 { var q = fract(p * vec2f(.1031, .1030)); q += dot(q, q.yx + 33.33); return fract((q.x + q.y) * q.y * 1.37 + q.x); }
fn h31(p: vec3f) -> f32 { var q = fract(p * vec3f(.1031, .1030, .0973)); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
fn h33(p: vec3f) -> vec3f { var q = fract(p * vec3f(.1031, .1030, .0973)); q += dot(q, q.yxz + 33.33); return fract((q.xxy + q.yxx) * q.zyx); }
fn n2(p: vec2f) -> f32 {
  let i = floor(p); let f = fract(p); let w = f * f * (3. - 2. * f);
  return mix(mix(h21(i), h21(i + vec2f(1., 0.)), w.x), mix(h21(i + vec2f(0., 1.)), h21(i + vec2f(1., 1.)), w.x), w.y);
}
fn n3(p: vec3f) -> f32 {
  let i = floor(p); let f = fract(p); let w = f * f * (3. - 2. * f);
  return mix(mix(mix(h31(i), h31(i + vec3f(1., 0., 0.)), w.x), mix(h31(i + vec3f(0., 1., 0.)), h31(i + vec3f(1., 1., 0.)), w.x), w.y),
             mix(mix(h31(i + vec3f(0., 0., 1.)), h31(i + vec3f(1., 0., 1.)), w.x), mix(h31(i + vec3f(0., 1., 1.)), h31(i + vec3f(1., 1., 1.)), w.x), w.y), w.z);
}
fn fb2(p: vec2f, o: i32) -> f32 { var a = .5; var s = 0.; var q = p; for (var i = 0; i < o; i++) { s += a * n2(q); q = q * 2.07 + 17.3; a *= .5; } return s / (1. - 2. * a); }
fn fb3(p: vec3f, o: i32) -> f32 { var a = .5; var s = 0.; var q = p; for (var i = 0; i < o; i++) { s += a * n3(q); q = q * 2.07 + 17.3; a *= .5; } return s / (1. - 2. * a); }

// sun shadow: 3x3 PCF (k = 1) or a single tap (k = 0)
fn shadowAt(w: vec3f, n: vec3f, k: i32) -> f32 {
  let p = u.svp * vec4f(w + n * .015 + u.sun.xyz * .008, 1.);
  let uv = p.xy * vec2f(.5, -.5) + .5;
  if (any(uv < vec2f(0.)) || any(uv > vec2f(1.)) || p.z > 1.) { return 1.; }
  let ts = 1.6 / f32(textureDimensions(tSh).x);
  var s = 0.;
  for (var y = -k; y <= k; y++) { for (var x = -k; x <= k; x++) {
    s += textureSampleCompareLevel(tSh, sCmp, uv + vec2f(f32(x), f32(y)) * ts, p.z - .0008);
  } }
  let c = f32(2 * k + 1);
  return s / (c * c);
}
// soft window falloff for the lamps
fn latt(d2: f32, r: f32) -> f32 { let x = d2 / (r * r); let f = sat(1. - x * x); return f * f / (d2 + .08); }
// the room as seen in a reflection: dark wood below, bright front windows
fn env(r: vec3f, rough: f32) -> vec3f {
  var c = mix(vec3f(.045, .028, .018), vec3f(.11, .085, .06), ss(-.6, .8, r.y));
  let win = ss(.3, .7, r.z) * ss(-.3, .0, r.y) * (1. - ss(.35, .75, r.y));
  c += vec3f(2.4, 2.0, 1.55) * win * mix(1., .18, rough);
  return c;
}
fn hemi(n: vec3f) -> vec3f { return mix(vec3f(.42, .28, .18), vec3f(.30, .29, .29), ss(-.7, .9, n.y)) * u.misc.z; }
fn ssao(fc: vec2f) -> f32 { if (u.sun.w < .5) { return 1.; } return textureLoad(tAO, vec2i(fc * .5), 0).r; }

fn ggx(n: vec3f, v: vec3f, l: vec3f, rough: f32, f0: vec3f) -> vec3f {
  let h = normalize(v + l); let ndh = max(dot(n, h), 0.); let ndv = max(dot(n, v), 1e-3); let ndl = max(dot(n, l), 0.);
  let a = rough * rough; let a2 = a * a; let d = ndh * ndh * (a2 - 1.) + 1.;
  let D = a2 / (PI * d * d);
  let k = a * .5; let V = .25 / ((ndl * (1. - k) + k) * (ndv * (1. - k) + k));
  let F = f0 + (1. - f0) * pow(1. - max(dot(v, h), 0.), 5.);
  return D * V * F;
}
// full surface shading: sun + lamps + ambient + reflections
fn shadeSurf(w: vec3f, n: vec3f, v: vec3f, alb: vec3f, rough: f32, f0: vec3f, ao: f32, trans: f32) -> vec3f {
  let L = u.sun.xyz; let ndl = dot(n, L);
  var c = vec3f(0.);
  if (ndl > 0. || trans > 0.) {
    let sh = shadowAt(w, n * sign(ndl + 1e-4), 1);
    c += (alb / PI * max(ndl, 0.) + ggx(n, v, L, rough, f0) * max(ndl, 0.)) * u.sunc.rgb * sh;
    c += alb * trans * max(-ndl, 0.) * u.sunc.rgb * sh * vec3f(.5, .6, .2);
  }
  for (var i = 0; i < 8; i++) {
    let lp = u.L[i * 2]; let lc = u.L[i * 2 + 1];
    let d = lp.xyz - w; let d2 = dot(d, d); let l = d * inverseSqrt(d2);
    let nl = max(dot(n, l), 0.); let at = latt(d2, lp.w);
    c += alb / PI * nl * at * lc.rgb;
    if (lc.w < .5) { c += ggx(n, v, l, max(rough, .15), f0) * nl * at * lc.rgb; }
  }
  c += alb * hemi(n) * ao;
  let ndv = max(dot(n, v), 0.);
  let fr = f0 + (max(vec3f(1. - rough), f0) - f0) * pow(1. - ndv, 5.);
  c += env(reflect(-v, n), rough) * fr * ao * (1. - rough * .7);
  return c;
}
`;

// ---------------------------------------------------------------- the room, furniture and props
const W_WORLD = W_COMMON + /*wgsl*/`
struct VI { @location(0) p: vec3f, @location(1) n: vec4f, @location(2) c: vec4f, @location(3) uv: vec2f };
struct VO { @builtin(position) pos: vec4f, @location(0) w: vec3f, @location(1) n: vec3f, @location(2) c: vec4f, @location(3) uv: vec2f, @location(4) o: vec3f };
@vertex fn vs(v: VI, @builtin(instance_index) ii: u32) -> VO {
  let M = MD[ii];
  let w = (M * vec4f(v.p, 1.)).xyz;
  var o: VO;
  o.pos = u.vp * vec4f(w, 1.); o.w = w; o.n = (M * vec4f(v.n.xyz, 0.)).xyz; o.c = v.c; o.uv = v.uv;
  o.o = select(w, v.p, ii > 0u);
  return o;
}
@vertex fn vsD(v: VI, @builtin(instance_index) ii: u32) -> @builtin(position) vec4f { return u.vp * MD[ii] * vec4f(v.p, 1.); }

// the view out of the windows: a sunny street with trees, overexposed like a real interior photo
fn outdoor(d: vec3f) -> vec3f {
  let y = d.y;
  var c = mix(vec3f(1.25, 1.0, .72), vec3f(.42, .62, 1.0), ss(.0, .55, y)) * 3.2;
  let s = max(dot(d, u.sun.xyz), 0.);
  c += u.sunc.rgb * (.06 * pow(s, 6.) + 3. * pow(s, 600.));
  let az = atan2(d.x, d.z);
  // tree canopies across the street, lit from behind, with bright gaps
  let tn = fb2(vec2f(az * 7., y * 9.), 4);
  let top = .2 + .18 * fb2(vec2f(az * 3., 1.7), 3);
  let tree = ss(top, top - .05, y + (tn - .5) * .12) * ss(-.12, -.02, y);
  let leafc = mix(vec3f(.10, .19, .05), vec3f(.55, .62, .2), ss(.55, .8, tn)) * 2.2;
  c = mix(c, leafc, tree * ss(.35, .5, tn));
  // street and sidewalk below
  let g = ss(-.02, -.1, y);
  let st = mix(vec3f(1.35, 1.2, 1.0), vec3f(.55, .5, .45), ss(-.25, -.35, y)) * (.85 + .3 * n2(vec2f(az * 30., y * 40.)));
  c = mix(c, st * 1.6, g);
  return c;
}

fn grainUV(o: vec3f, n: vec3f) -> vec2f { // wood grain runs along the longest flat direction of each face
  let a = abs(n);
  if (a.y > a.x && a.y > a.z) { return o.xz; }
  if (a.x > a.z) { return vec2f(o.y, o.z).yx; }
  return vec2f(o.x, o.y);
}

@fragment fn fs(i: VO, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  let duvx = dpdx(i.uv); let duvy = dpdy(i.uv);
  let fw = length(fwidth(i.w));
  let mid = u32(i.c.a * 255. + .5);
  var n = normalize(i.n); if (!ff) { n = -n; }
  let w = i.w; let o = i.o;
  var alb = srgb(i.c.rgb); var rough = .6; var f0 = vec3f(.04); var em = vec3f(0.); var ao = 1.; var trans = 0.;
  switch mid {
    case 0u: { // floor: oak planks, 14 cm wide, staggered
      let pw = .14; let pl = 1.15;
      let row = floor(w.z / pw); let off = h21(vec2f(row, 3.)) * pl; let col = floor((w.x + off) / pl);
      let r = h21(vec2f(row, col)); let r2 = h21(vec2f(col, row + 9.));
      let lx = fract((w.x + off) / pl) * pl; let lz = fract(w.z / pw) * pw;
      let g = fb2(vec2f(w.x * 2.5 + r * 30., w.z * 70. + r * 9.), 4);
      let ring = .5 + .5 * sin((w.z * 120. + g * 9. + r * 40.));
      alb = mix(vec3f(.30, .155, .07), vec3f(.46, .26, .12), r * .55 + g * .35 + ring * .1) * (.8 + .4 * r2);
      let gap = min(min(lz, pw - lz), min(lx, pl - lx) * 2.);
      let gw = .0018 + fw * .7;
      let gm = ss(gw * .4, gw, gap);
      alb *= mix(.25, 1., gm); ao = mix(.5, 1., gm);
      rough = .32 + .25 * g + .15 * r2;
      f0 = vec3f(.045);
      // a worn path in the middle of the room
      rough += .12 * ss(3.5, 1., length(w.xz - vec2f(0., .5)));
    }
    case 1u: { // plaster
      let g = fb3(w * 6., 3);
      alb *= .93 + .12 * g; rough = .92;
    }
    case 2u: { // exposed brick: 22 x 7 cm with 1.1 cm mortar
      var bp = vec2f(w.x, w.y); if (abs(n.x) > .5) { bp = vec2f(w.z, w.y); }
      let row = floor(bp.y / .076); let bx = bp.x / .225 + select(0., .5, (i32(row) & 1) == 1);
      let id = vec2f(floor(bx), row); let r = h21(id); let r2 = h21(id + 7.);
      let lx = fract(bx) * .225; let ly = fract(bp.y / .076) * .076;
      let e = min(min(lx, .225 - lx), min(ly, .076 - ly));
      let g = fb2(bp * 40., 4);
      let brick = mix(vec3f(.36, .12, .06), vec3f(.55, .25, .13), r) * (.75 + .5 * g) * mix(1., .6, r2 * r2);
      let mortar = vec3f(.42, .37, .31) * (.8 + .3 * g);
      let mm = ss(.004, .0075 + fw * .5, e + (g - .5) * .004);
      alb = mix(mortar, brick, mm); ao = mix(.55, 1., mm); rough = mix(.95, .8, mm);
      if (mm < .99) { n = normalize(n + vec3f(0., select(-.4, .4, ly < .038), 0.) * (1. - mm) * .5); }
    }
    case 3u: { // varnished wood
      let gu = grainUV(o, n);
      let g = fb2(vec2f(gu.x * 3., gu.y * 55.), 4);
      let ring = .5 + .5 * sin(gu.y * 90. + g * 12.);
      alb *= .72 + .38 * g + .12 * ring; rough = .38 + .2 * g;
    }
    case 4u: { // fabric / velvet
      let g = fb3(o * 60., 2);
      alb *= .88 + .2 * g; rough = .9;
      let v = normalize(u.cam.xyz - w);
      em = alb * pow(1. - max(dot(n, v), 0.), 3.) * .25 * u.misc.z;
    }
    case 5u: { // sisal rope wound around a post
      let t = fract(w.y * 160. + fb3(w * 30., 2) * 1.5);
      let g = fb3(w * vec3f(80., 8., 80.), 3);
      alb *= (.55 + .55 * ss(0., .5, t) * ss(1., .5, t)) * (.8 + .4 * g); rough = .97; ao = .75 + .25 * t;
    }
    case 6u: { // plush carpet
      let g = fb3(o * 90., 3);
      alb *= .75 + .4 * g; rough = 1.;
    }
    case 7u: { rough = .1; f0 = vec3f(.05); } // glazed ceramic
    case 8u: { // brass / metal: colour is the reflectance
      f0 = alb; alb = alb * .05; rough = .28 + .1 * fb3(o * 20., 2);
    }
    case 9u: { em = alb * 9.; alb = vec3f(0.); }
    case 10u: { // leaves: a vein down the middle, light shining through from the back
      let vein = ss(.04, .0, abs(i.uv.y - .5) - .002) * ss(1., .7, i.uv.x);
      alb *= (.8 + .3 * n2(i.uv * vec2f(30., 8.))) * (1. + .5 * vein); rough = .45; trans = 1.4;
    }
    case 11u: { // rug: a border, bands and a field of diamonds
      let q = abs(i.uv - .5) * 2.;
      let b = max(q.x, q.y);
      let dm = abs(fract((i.uv.x + i.uv.y) * 7.) - .5) + abs(fract((i.uv.x - i.uv.y) * 7.) - .5);
      var c = vec3f(.55, .18, .08);
      c = mix(c, vec3f(.8, .65, .45), ss(.42, .45, dm) * ss(.78, .76, b));
      c = mix(c, vec3f(.08, .12, .22), ss(.78, .8, b) * ss(.88, .86, b));
      c = mix(c, vec3f(.85, .72, .5), ss(.9, .92, b));
      alb = srgb(c) * (.8 + .35 * fb2(i.uv * 200., 2)); rough = 1.;
    }
    case 12u: { return vec4f(outdoor(normalize(w - u.cam.xyz)), 1.); }
    case 13u: { // marble
      let g = fb3(w * 3., 5);
      let vein = ss(.06, .0, abs(sin((w.x * 2. + w.z * 1.3 + g * 6.) * 2.))) ;
      alb = mix(vec3f(.78, .76, .72), vec3f(.35, .33, .32), vein * .7) * (.95 + .1 * g); rough = .12 + .1 * vein; f0 = vec3f(.05);
    }
    case 14u: { // canvas art (neon sign, chalkboard, paintings)
      let layer = i32(i.c.r * 255. + .5);
      let t = textureSampleGrad(tArt, sRep, vec2f(i.uv.x, 1. - i.uv.y), layer, duvx * vec2f(1., -1.), duvy * vec2f(1., -1.));
      if (i.c.g > .5) { // neon: only the glowing tubes are drawn
        if (t.a < .45) { discard; }
        return vec4f(srgb(t.rgb) * 14., 1.);
      }
      alb = srgb(t.rgb); rough = select(.55, .95, layer == 1);
    }
    case 15u: { // glass bottles and jars
      alb *= .35; rough = .06; f0 = vec3f(.08); em = srgb(i.c.rgb) * .08 * u.misc.z;
    }
    case 16u: { // yarn: strands wound around the ball in a few directions
      let d1 = sin(dot(o, vec3f(.8, .5, .3)) * 900.); let d2 = sin(dot(o, vec3f(-.3, .7, .64)) * 900.);
      let m = select(d1, d2, n3(o * 30.) > .5);
      alb *= .62 + .38 * ss(-1., 1., m); rough = .95; ao = .8 + .2 * ss(-1., 1., m);
    }
    case 18u: { alb *= .8 + .35 * fb3(o * 25., 3); rough = .9; } // terracotta
    case 19u: { alb *= .95 + .08 * fb3(o * 12., 2); rough = .32; } // painted wood
    case 20u: { alb *= .95 + .08 * fb3(w * 4., 3); rough = 1.; } // ceiling
    default: { rough = .55; }
  }
  let v = normalize(u.cam.xyz - w);
  let c = shadeSurf(w, n, v, alb, rough, f0, ao * ssao(i.pos.xy), trans) + em;
  return vec4f(c, 1.);
}
`;

// ---------------------------------------------------------------- cats: fur drawn as stacked shells
// Every cat is the same skinned mesh in a rest pose (+x forward, metres). Each shell instance pushes the surface out
// along the normal and combs it backwards and down; the fragment shader cuts the shell into strands that get
// thinner towards the tips. The coat pattern is a function of the rest position, so it moves with the body.
const W_COAT = /*wgsl*/`
// coat colour at a rest-pose point. c0: base + pattern, c1: second colour + white amount, c4: third colour
fn coat(p: vec3f, n: vec3f, P: CatP, seed: f32) -> vec3f {
  let typ = u32(P.c0.w + .5); let base = P.c0.rgb; let sec = P.c1.rgb; let white = P.c1.w;
  let nz = fb3(p * 18. + seed, 3);
  var col = base * (.9 + .2 * nz);
  let head = ss(.16, .2, p.x) * ss(.22, .25, p.y);
  let legs = ss(.12, .07, p.y);
  let tail = ss(-.22, -.26, p.x);
  let body = (1. - head) * (1. - legs) * (1. - tail);
  if (typ == 1u) { // mackerel tabby: rings around the body, legs and tail, an "M" on the forehead
    let wob = fb3(p * 9. + seed, 2) * 3.5;
    var s = sin(p.x * 78. + abs(p.z) * 22. + wob) * body;
    s += sin(p.y * 105. + wob) * legs * (1. - tail);
    s += sin(p.x * 70. + wob * .5) * tail;
    s += 1.5 * sin(p.z * 160. + wob * .6 + (p.y - .3) * 40.) * head * ss(.3, .335, p.y) * ss(.295, .262, p.x);
    s += 1.2 * sin(p.y * 170. + p.x * 40. + wob) * head * ss(.31, .29, p.y) * ss(.23, .255, p.x) * ss(.012, .03, abs(p.z));
    s += .5 * sin(p.x * 190. + wob * 2.) * body;
    let dorsal = ss(.24, .28, p.y) * ss(.6, .95, n.y) * body;
    let dark = max(ss(.2, .65, s + (nz - .5) * .7), dorsal * .75) * (1. - ss(.25, .27, p.x) * .7);
    col = mix(col, sec * (.85 + .3 * nz), dark * .9);
    col = mix(col, sec, ss(-.42, -.47, p.x)); // dark tail tip
  } else if (typ == 2u || typ == 5u) { // calico / tortoiseshell patches (finer and more mixed for tortie)
    let fq = select(9., 22., typ == 5u);
    let pn = fb3(p * fq + seed * 3., 4);
    let third = P.c4.rgb;
    col = mix(base, third, ss(.47, .53, pn));
    if (typ == 5u) { col = mix(col, mix(base, third, .5), ss(.35, .5, fb3(p * 40. + seed, 2)) * .4); }
    col *= .9 + .2 * nz;
  } else if (typ == 3u) { // colourpoint: dark mask, ears, legs and tail
    let e = max(max(ss(.235, .275, p.x) * ss(.23, .26, p.y), ss(.33, .35, p.y)), max(ss(.1, .045, p.y), ss(-.24, -.32, p.x)));
    let face = ss(.04, .0, length((p.xy - vec2f(.29, .295)) * vec2f(1., 1.3))) ;
    col = mix(col, sec * (.85 + .3 * nz), max(e, face));
  } else if (typ == 4u) { // spotted: dark rosettes
    let q = p * 34. + seed; let ci = floor(q); var dm = 9.;
    for (var x = -1; x <= 1; x++) { for (var y = -1; y <= 1; y++) { for (var z = -1; z <= 1; z++) {
      let o = vec3f(f32(x), f32(y), f32(z)); let r = o + h33(ci + o) - fract(q); dm = min(dm, dot(r, r));
    } } }
    let spot = ss(.28, .12, dm) * (1. - head * .5);
    col = mix(col, sec, spot * .9 * (1. - ss(.0, .3, -n.y)));
    col = mix(col, mix(base, vec3f(.95, .9, .8), .5), ss(.0, -.6, n.y) * body); // pale belly
  }
  // darker rims around the eyes
  col *= mix(.5, 1., ss(.0155, .021, length(vec3f(p.x - .254, p.y - .318, abs(p.z) - .027))));
  // white: belly, chest, muzzle and paws first, then more and more of the body
  if (white > 0.) {
    var wp = max(ss(.15, .1, p.y + nz * .02) * (1. - tail), ss(.005, -.02, p.y) * 1.2);
    wp = max(wp, ss(.06, .16, p.x) * ss(.24, .17, p.y) * ss(.6, -.2, n.y) * (1. - legs * .3));
    wp = max(wp, ss(.25, .275, p.x) * ss(.305, .285, p.y));
    wp = max(wp, ss(.0, -.6, n.y) * body);
    wp += (fb3(p * 7. + seed * 5., 3) - .5) * .5 - ss(.3, .36, p.y) * .4;
    let t = 1. - white;
    col = mix(col, vec3f(.86, .84, .8) * (.93 + .1 * nz), ss(t - .04, t + .04, wp));
  }
  return col;
}

`;
const W_CAT = (A2C) => W_COMMON + W_COAT + /*wgsl*/`
const DENS = 640.;
struct CI { @location(0) p: vec3f, @location(1) n: vec4f, @location(2) b: vec4u, @location(3) wt: vec4f };
struct CO {
  @builtin(position) pos: vec4f, @location(0) rp: vec3f, @location(1) rn: vec3f, @location(2) @interpolate(flat) ci: vec2u,
  @location(3) lit: vec3f, @location(4) sp: vec3f, @location(5) h: f32, @location(6) fur: f32,
};
fn skinM(c: u32, b: vec4u, wt: vec4f) -> mat4x4f {
  let o = c * 22u;
  return BN[o + b.x] * wt.x + BN[o + b.y] * wt.y + BN[o + b.z] * wt.z + BN[o + b.w] * wt.w;
}
fn wrapL(x: f32) -> f32 { return sat((x + .45) / 1.45); }
@vertex fn vs(v: CI, @builtin(instance_index) ii: u32) -> CO {
  let c = ii / 64u; let s = ii % 64u; let P = CP[c];
  let h = f32(s) / max(P.c3.x, 1.);
  let M = skinM(c, v.b, v.wt);
  let w0 = (M * vec4f(v.p, 1.)).xyz;
  let n = normalize((M * vec4f(v.n.xyz, 0.)).xyz);
  let fl = P.c2.w * v.n.w;
  let fd = vec3f(-1., -.55, 0.);
  let fr = fd - v.n.xyz * dot(v.n.xyz, fd);
  let flow = normalize((M * vec4f(fr, 0.)).xyz + n * 1e-3);
  let w = w0 + n * fl * h + (flow * .7 + vec3f(0., -.25, 0.)) * fl * h * h;
  // lighting per vertex: wrapped diffuse for the sun and the lamps, Kajiya-Kay highlight along the strands
  let vdir = normalize(u.cam.xyz - w);
  let L = u.sun.xyz;
  let sh = shadowAt(w, n, 0);
  var lit = u.sunc.rgb * sh * wrapL(dot(n, L));
  let T = normalize(n + flow * .9);
  let hv = normalize(L + vdir); let th = dot(T, hv);
  var sp = u.sunc.rgb * sh * pow(sqrt(max(1. - th * th, 0.)), 70.) * .05 * sat(dot(n, L) + .3);
  for (var i = 0; i < 8; i++) {
    let lp = u.L[i * 2]; let lc = u.L[i * 2 + 1];
    let d = lp.xyz - w; let d2 = dot(d, d); let l = d * inverseSqrt(d2); let at = latt(d2, lp.w);
    lit += lc.rgb * at * wrapL(dot(n, l));
    let h2 = normalize(l + vdir); let t2 = dot(T, h2);
    sp += lc.rgb * at * pow(sqrt(max(1. - t2 * t2, 0.)), 60.) * .04 * (1. - lc.w);
  }
  lit = lit / PI + hemi(n) * (.65 + .35 * sat(n.y + .5));
  var o: CO;
  o.pos = u.vp * vec4f(w, 1.); o.rp = v.p; o.rn = v.n.xyz; o.ci = vec2u(c, s); o.lit = lit; o.sp = sp; o.h = h; o.fur = v.n.w;
  return o;
}
@vertex fn vsD(v: CI, @builtin(instance_index) ii: u32) -> @builtin(position) vec4f {
  let M = skinM(ii / 64u, v.b, v.wt);
  return u.vp * vec4f((M * vec4f(v.p, 1.)).xyz, 1.);
}

@fragment fn fs(i: CO, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  let fq = length(fwidth(i.rp)) * DENS;
  let P = CP[i.ci.x]; let h = i.h; let seed = P.c3.z;
  var a = 1.;
  var rn = normalize(i.rn);
  // nose leather and inner ears have (almost) no fur
  let nose = ss(.009, .006, length((i.rp - vec3f(.294, .295, 0.)) * vec3f(1.2, 1.6, .85))) * ss(.0, .004, (i.rp.y - .29) + (.012 - abs(i.rp.z)) * .4);
  let earIn = ss(.335, .35, i.rp.y) * ss(.2, .55, rn.x) * ss(.0045, .007, abs(abs(i.rp.z) - .045) + .002) ;
  var str = 1.;
  if (i.ci.y > 0u) {
    if (i.fur < .02) { discard; }
    let q = i.rp * DENS + seed;
    let cell = floor(q);
    let r3 = h33(cell);
    let rq = fract(q) - (.2 + .6 * r3);
    let dd = length(rq - rn * dot(rq, rn));
    let len = mix(.55, 1., r3.z) * (1. - earIn * .7);
    let rad = .52 * pow(max(1. - h / len, 0.), .7);
    a = ss(rad + fq * .5 + .02, rad - fq * .5 - .02, dd) * step(h, len);
    // far away the strands are smaller than a pixel: use the average coverage instead
    let cov = sat(3.14 * rad * rad * (1. - h)) * 1.2;
    a = mix(a, cov, ss(.35, 1.1, fq));
    str = .85 + .3 * r3.x;
    ${A2C ? '' : 'if (a < .5) { discard; }'}
    if (a < .01) { discard; }
  }
  var col = coat(i.rp, rn, P, seed) * str;
  col = mix(col, vec3f(.6, .33, .32) * P.c4.w + vec3f(.06, .04, .04) * (1. - P.c4.w), nose);
  // philtrum and mouth: a thin dark line under the nose that splits into a soft "w"
  let mz = abs(i.rp.z); let my = i.rp.y;
  let mouth = max(ss(.0016, .0006, mz) * ss(.276, .279, my) * ss(.29, .287, my), ss(.0018, .0006, abs(my - (.2775 + mz * .35 - mz * mz * 30.))) * ss(.016, .01, mz)) * ss(.282, .286, i.rp.x);
  col = mix(col, vec3f(.05, .03, .03), mouth * .85);
  col = mix(col, vec3f(.9, .6, .55), earIn * .6);
  col *= mix(.42, 1.06, pow(h, .8)); // depth of the coat: roots are in shadow
  let ao = ssao(i.pos.xy);
  let c = col * i.lit * mix(.7, 1., ao) + i.sp * (.4 + h);
  return vec4f(c, ${A2C ? 'a' : '1.'});
}
`;

// ---------------------------------------------------------------- eyes, whiskers, dust and hearts
const W_EYE = W_COMMON + W_COAT + /*wgsl*/`
struct VI { @location(0) p: vec3f, @location(1) n: vec4f, @location(2) c: vec4f, @location(3) uv: vec2f };
struct VO { @builtin(position) pos: vec4f, @location(0) w: vec3f, @location(1) n: vec3f, @location(2) lp: vec3f, @location(3) @interpolate(flat) c: u32 };
@vertex fn vs(v: VI, @builtin(instance_index) ii: u32) -> VO {
  let c = ii / 2u; let s = select(-1., 1., (ii & 1u) == 0u);
  let f = normalize(vec3f(1., .06, s * .36)); let r = normalize(cross(f, vec3f(0., 1., 0.))); let up = cross(r, f);
  let R = .0148;
  let rest = vec3f(.259, .318, s * .0285) + (f * v.p.x + up * v.p.y + r * v.p.z) * R;
  let M = BN[c * 22u + 3u];
  var o: VO;
  o.w = (M * vec4f(rest, 1.)).xyz; o.n = normalize((M * vec4f(f * v.p.x + up * v.p.y + r * v.p.z, 0.)).xyz);
  o.pos = u.vp * vec4f(o.w, 1.); o.lp = v.p; o.c = c;
  return o;
}
@fragment fn fs(i: VO) -> @location(0) vec4f {
  let P = CP[i.c]; let p = normalize(i.lp);
  let n = normalize(i.n); let v = normalize(u.cam.xyz - i.w);
  let lid = P.c3.y;
  let top = mix(.62, -.12, lid) - .3 * p.z * p.z; let bot = mix(-.6, -.16, lid) + .28 * p.z * p.z; // almond-shaped opening
  // iris with fine radial fibres and a darker rim, slit pupil
  let ang = atan2(p.y, p.z);
  let fib = .75 + .5 * n2(vec2f(ang * 18., p.x * 4.));
  var iris = srgb(P.c2.rgb) * fib * mix(1.25, .7, ss(.55, .4, p.x));
  iris = mix(iris, iris * .25, ss(.45, .36, p.x));
  let pw = .34;
  let pupil = ss(1.05, .9, length(vec2f(p.z / pw, p.y / .78))) * step(0., p.x);
  var alb = mix(iris, vec3f(.003), pupil);
  alb = mix(vec3f(.05, .035, .03), alb, ss(.28, .34, p.x));
  let lidm = max(ss(top - .04, top + .02, p.y), ss(bot + .04, bot - .02, p.y));
  let skin = coat(vec3f(.27, .32, 0.), vec3f(1., 0., 0.), P, P.c3.z) * .5;
  alb = mix(alb, mix(vec3f(.02), skin, ss(.05, .2, max(p.y - top, bot - p.y))), lidm);
  // glossy cornea
  var c = alb * (hemi(n) + u.sunc.rgb * max(dot(n, u.sun.xyz), 0.) * .3) * .9;
  for (var k = 0; k < 8; k++) {
    let lp = u.L[k * 2]; let lc = u.L[k * 2 + 1]; let d = lp.xyz - i.w; let d2 = dot(d, d); let l = d * inverseSqrt(d2);
    c += (alb / PI * max(dot(n, l), 0.) + ggx(n, v, l, .06, vec3f(.04)) * max(dot(n, l), 0.) * (1. - lidm)) * latt(d2, lp.w) * lc.rgb * (1. - lc.w * .5);
  }
  let fr = .04 + .96 * pow(1. - max(dot(n, v), 0.), 5.);
  c += env(reflect(-v, n), .02) * fr * 1.6 * (1. - lidm);
  c += ggx(n, v, u.sun.xyz, .05, vec3f(.04)) * max(dot(n, u.sun.xyz), 0.) * u.sunc.rgb * (1. - lidm) * shadowAt(i.w, n, 0);
  return vec4f(c, 1.);
}
`;

const W_WHISK = W_COMMON + /*wgsl*/`
struct VO { @builtin(position) pos: vec4f, @location(0) a: f32, @location(1) @interpolate(flat) c: u32 };
@vertex fn vs(@location(0) p: vec4f, @builtin(instance_index) c: u32) -> VO {
  let M = BN[c * 22u + 3u];
  var o: VO; o.pos = u.vp * vec4f((M * vec4f(p.xyz, 1.)).xyz, 1.); o.a = p.w; o.c = c;
  return o;
}
@fragment fn fs(i: VO) -> @location(0) vec4f {
  let P = CP[i.c];
  let col = mix(vec3f(.85, .82, .78), vec3f(.05), P.c3.w) * (hemi(vec3f(0., 1., 0.)) * 1.3 + u.sunc.rgb * .05);
  return vec4f(col * i.a * .6, i.a * .6);
}
`;

const W_PART = W_COMMON + /*wgsl*/`
const ND = ${NDUST}u;
struct VO { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) col: vec4f, @location(2) @interpolate(flat) k: u32 };
@vertex fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VO {
  var cr = array<vec2f, 6>(vec2f(-1., -1.), vec2f(1., -1.), vec2f(1., 1.), vec2f(-1., -1.), vec2f(1., 1.), vec2f(-1., 1.));
  let q = cr[vi];
  var o: VO; o.uv = q;
  var p: vec3f; var sz: f32;
  let t = u.cam.w;
  if (ii < ND) { // dust: drifts slowly, only visible where the sun shines through it
    let h = h33(vec3f(f32(ii) * 1.37, 4.1, 9.7));
    p = vec3f(-6. + 12. * h.x, 3. * fract(h.y - t * .004 * (h.z + .3)), -4.5 + 9. * h.z);
    p += vec3f(sin(t * .13 + h.y * 40.), sin(t * .17 + h.x * 30.) * .5, sin(t * .11 + h.z * 50.)) * .12;
    let vis = shadowAt(p, vec3f(0.), 0);
    sz = .0018 + .0018 * h.x;
    let dc = length(p - u.cam.xyz);
    let px = sz / (dc * .0012 + 1e-4); // grow tiny far motes to a pixel and fade them instead
    let grow = max(1., .9 / max(px, 1e-3));
    sz *= grow;
    let fw = max(dot(normalize(p - u.cam.xyz), u.sun.xyz) * -1., 0.);
    o.col = vec4f(u.sunc.rgb * (vis * (.06 + .5 * pow(fw, 6.)) + .002) / (grow * grow) * 6., 0.);
    o.k = 0u;
  } else { // hearts rising from a petted cat
    let d = PT[ii - ND];
    let a = d.w;
    p = d.xyz + vec3f(sin(a * 5. + f32(ii)) * .03, a * .35, 0.);
    sz = .035 * ss(0., .15, a) * (1. + a * .3);
    o.col = vec4f(vec3f(1.6, .35, .6) * 2.2, 1.) * ss(1.6, 1.1, a) * step(.001, a);
    o.k = 1u;
  }
  o.pos = u.vp * vec4f(p + (u.cr.xyz * q.x + u.cu.xyz * q.y) * sz, 1.);
  return o;
}
@fragment fn fs(i: VO) -> @location(0) vec4f {
  if (i.k == 0u) { let a = ss(1., .1, length(i.uv)); return vec4f(i.col.rgb * a, 0.); }
  var p = i.uv * 1.25 + vec2f(0., .55); p.x = abs(p.x); p.y = 1.1 - p.y;
  var d: f32;
  if (p.y + p.x > 1.) { d = length(p - vec2f(.25, .75)) - .3536; }
  else { d = sqrt(min(dot(p - vec2f(0., 1.), p - vec2f(0., 1.)), dot(p - .5 * max(p.x + p.y, 0.), p - .5 * max(p.x + p.y, 0.)))) * sign(p.x - p.y); }
  let a = ss(.04, -.04, d) * i.col.a;
  let c = i.col.rgb * (1. - .4 * ss(-.4, .0, d));
  return vec4f(c * a, a);
}
`;

// ---------------------------------------------------------------- screen passes
const W_FS = /*wgsl*/`
@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u)); return vec4f(p * 2. - 1., 0., 1.);
}
`;
const W_POST = W_COMMON + W_FS + /*wgsl*/`
@group(1) @binding(0) var tD: texture_depth_2d;
@group(1) @binding(1) var tA: texture_2d<f32>;
@group(1) @binding(2) var tB: texture_2d<f32>;
fn wpos(px: vec2f, d: f32) -> vec3f {
  let ndc = vec2f(px.x * u.scr.z * 2. - 1., 1. - px.y * u.scr.w * 2.);
  let p = u.ivp * vec4f(ndc, d, 1.); return p.xyz / p.w;
}
fn ign(p: vec2f) -> f32 { return fract(52.9829189 * fract(dot(p, vec2f(.06711056, .00583715)))); }

// ambient occlusion at half resolution from the depth pre-pass
@fragment fn fsAO(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let ip = vec2i(fc.xy * 2.);
  let sz = vec2i(textureDimensions(tD));
  let d = textureLoad(tD, ip, 0);
  if (d >= 1.) { return vec4f(1.); }
  let p = wpos(vec2f(ip) + .5, d);
  let px = wpos(vec2f(ip + vec2i(2, 0)) + .5, textureLoad(tD, min(ip + vec2i(2, 0), sz - 1), 0));
  let nx = wpos(vec2f(ip - vec2i(2, 0)) + .5, textureLoad(tD, max(ip - vec2i(2, 0), vec2i(0)), 0));
  let py = wpos(vec2f(ip + vec2i(0, 2)) + .5, textureLoad(tD, min(ip + vec2i(0, 2), sz - 1), 0));
  let ny = wpos(vec2f(ip - vec2i(0, 2)) + .5, textureLoad(tD, max(ip - vec2i(0, 2), vec2i(0)), 0));
  let dx = select(p - nx, px - p, length(px - p) < length(p - nx));
  let dy = select(p - ny, py - p, length(py - p) < length(p - ny));
  var n = normalize(cross(dx, dy));
  let vd = u.cam.xyz - p;
  if (dot(n, vd) < 0.) { n = -n; }
  let t = select(vec3f(1., 0., 0.), vec3f(0., 1., 0.), abs(n.x) > .7);
  let b1 = normalize(cross(n, t)); let b2 = cross(n, b1);
  let rot = ign(fc.xy) * 6.283; let dist = length(vd);
  var occ = 0.;
  let R = .32;
  for (var k = 0; k < 12; k++) {
    let fk = f32(k);
    let a = rot + fk * 2.39996;
    let z = sqrt(1. - (fk + .5) / 12.);
    let rr = sqrt(1. - z * z);
    let dir = b1 * cos(a) * rr + b2 * sin(a) * rr + n * (z * .9 + .1);
    let s = p + dir * R * (.2 + .8 * fract(fk * .618 + ign(fc.yx)));
    let cp = u.vp * vec4f(s, 1.);
    let suv = (cp.xy / cp.w) * vec2f(.5, -.5) + .5;
    if (any(suv < vec2f(0.)) || any(suv > vec2f(1.))) { continue; }
    let sp = vec2i(suv * vec2f(sz));
    let sd = textureLoad(tD, sp, 0);
    let q = wpos(vec2f(sp) + .5, sd);
    let ds = length(s - u.cam.xyz) - length(q - u.cam.xyz);
    occ += ss(.015, .05, ds) * ss(R * 2.5, R, ds);
  }
  return vec4f(1. - occ / 12. * .9);
}
@fragment fn fsBlur(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let ip = vec2i(fc.xy); let sz = vec2i(textureDimensions(tA));
  let d0 = textureLoad(tD, min(ip * 2, vec2i(textureDimensions(tD)) - 1), 0);
  let z0 = 1. / max(1. - d0, 1e-6);
  var s = 0.; var wsum = 0.;
  for (var y = -2; y <= 2; y++) { for (var x = -2; x <= 2; x++) {
    let q = clamp(ip + vec2i(x, y), vec2i(0), sz - 1);
    let dd = textureLoad(tD, min(q * 2, vec2i(textureDimensions(tD)) - 1), 0);
    let z = 1. / max(1. - dd, 1e-6);
    let wt = 1. / (1. + abs(z - z0) / z0 * 60.);
    s += textureLoad(tA, q, 0).r * wt; wsum += wt;
  } }
  return vec4f(s / wsum);
}

// bloom: a downsample chain, then additive tent upsampling
@fragment fn fsDown(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let ts = 1. / vec2f(textureDimensions(tA)); let uv = fc.xy * 2. * ts;
  var c = vec3f(0.); var w = 0.;
  for (var k = 0; k < 4; k++) {
    let o = vec2f(f32(k & 1), f32(k >> 1u)) * 2. - 1.;
    let s = textureSampleLevel(tA, sCl, uv + o * ts, 0.).rgb;
    let kw = 1. / (1. + max(s.r, max(s.g, s.b)) * .25);
    c += s * kw; w += kw;
  }
  return vec4f(c / w, 1.);
}
@fragment fn fsUp(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let ts = 1. / vec2f(textureDimensions(tA)); let uv = fc.xy / vec2f(textureDimensions(tA) * 2u);
  var c = vec3f(0.);
  for (var y = -1; y <= 1; y++) { for (var x = -1; x <= 1; x++) {
    let wt = f32((2 - abs(x)) * (2 - abs(y))) / 16.;
    c += textureSampleLevel(tA, sCl, uv + vec2f(f32(x), f32(y)) * ts, 0.).rgb * wt;
  } }
  return vec4f(c * .9, 1.);
}

// final: light shafts, bloom, tone mapping, vignette, grain
fn aces(x: vec3f) -> vec3f {
  let a = mat3x3f(.59719, .07600, .02840, .35458, .90834, .13383, .04823, .01566, .83777);
  let b = mat3x3f(1.60475, -.10208, -.00327, -.53108, 1.10813, -.07276, -.07367, -.00605, 1.07602);
  let v = a * x; let r = (v * (v + .0245786) - .000090537) / (v * (.983729 * v + .4329510) + .238081);
  return clamp(b * r, vec3f(0.), vec3f(1.));
}
@fragment fn fsComp(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let uv = fc.xy * u.scr.zw;
  var c = textureSampleLevel(tA, sCl, uv, 0.).rgb;
  let bl = textureSampleLevel(tB, sCl, uv, 0.).rgb;
  if (u.misc.w > .5) { // debug views
    let dd = textureLoad(tD, vec2i(fc.xy), 0);
    if (u.misc.w < 1.5) { return vec4f(c * .3, 1.); }
    if (u.misc.w < 2.5) { return vec4f(vec3f(fract(length(wpos(fc.xy, dd) - u.cam.xyz))), 1.); }
    return vec4f(vec3f(textureLoad(tAO, vec2i(fc.xy * .5), 0).r), 1.);
  }
  c = mix(c, bl, .055);
  // light shafts: march from the eye to the first surface through the sun shadow map
  let d = textureLoad(tD, vec2i(fc.xy), 0);
  let wp = wpos(fc.xy, d);
  let rd0 = wp - u.cam.xyz;
  let len = min(length(rd0), 14.);
  let rd = normalize(rd0);
  let N = ${VOLN};
  let j = fract(ign(fc.xy) + u.misc.y * .618);
  var acc = 0.;
  for (var k = 0; k < N; k++) {
    let t = (f32(k) + j) / f32(N) * len;
    let p = u.cam.xyz + rd * t;
    let sp = u.svp * vec4f(p, 1.);
    let suv = sp.xy * vec2f(.5, -.5) + .5;
    var vis = 1.;
    if (all(suv > vec2f(0.)) && all(suv < vec2f(1.))) { vis = textureSampleCompareLevel(tSh, sCmp, suv, sp.z - .001); }
    let inside = ss(4.9, 4.4, p.z) * ss(3.2, 2.9, p.y);
    acc += vis * mix(.15, 1., inside);
  }
  let cs = dot(rd, u.sun.xyz);
  let ph = .25 + 1.6 * pow(max(cs, 0.), 6.) + .1 * (1. - cs * cs);
  c += u.sunc.rgb * acc / f32(N) * len * u.sunc.w * ph;
  c *= u.misc.x;
  c = aces(c);
  // warm grade, vignette and a little grain
  c = pow(c, vec3f(1.02, 1., .98));
  let q = uv - .5;
  c *= 1. - .35 * dot(q, q) * 1.8;
  c += (ign(fc.xy + u.misc.y * 7.) - .5) * .012;
  c = select(1.055 * pow(c, vec3f(1. / 2.4)) - .055, c * 12.92, c < vec3f(.0031308));
  return vec4f(c, 1.);
}
`;
