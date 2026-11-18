// ============================================================================
// renderer, camera, input, petting and the frame loop
// ============================================================================
const $ = (id) => document.getElementById(id);
const canvas = $('c'), info = $('i'), body = document.body;
// English page text when the browser is not Italian (the page itself is written in Italian)
if (!IT) {
  document.documentElement.lang = 'en';
  const T = { tip: 'Tap a cat to go and pet it · tap the floor to walk there · drag to look around · joystick bottom-left', gAgain: 'Try again', s: 'Opening the café…', d: 'Enter', tagline: 'cat café', shopL: 'Shop (B)', shT: '🛒 Shop', packOk: 'Great!', h: 'Drag on the left to walk · on the right to look · hold the paw button to pet',
    tabToys: 'Toys', tabCare: 'Food & care', tabWear: 'Clothes', tabPacks: 'Cards', tabAlbum: 'Collection' };
  for (const k in T) { const e = document.getElementById(k); if (e) e.textContent = T[k]; }
  const q = document.querySelectorAll('#q span, #q button'); ['Detail', 'Low', 'Medium', 'High'].forEach((t, i) => q[i] && (q[i].textContent = t));
  document.getElementById('k').innerHTML = '<p><i><b>W</b><b>A</b><b>S</b><b>D</b></i>Walk<i><b>Mouse</b></i>Look around<i><b>Click</b></i>Hold: pet a cat<i><b>Shift</b></i>Faster</p><p><i><b>B</b></i>Shop<i><b>C</b></i>Crouch<i><b>Esc</b></i>Menu<i><b>M</b></i>Sound</p>';
}
if (mob) document.getElementById('shopL').textContent = IT ? 'Negozio' : 'Shop';
const SHOT = /[?&]shot/.test(location.search), DBG = +(location.search.match(/dbg=(\d)/) || [0, 0])[1]; // fixed size, no adaptation: for screenshots
let loaded = 0, dead;
const say = (m, to, ms) => {
  if (!dead) $('s').textContent = m;
  if (SHOT) console.log('say ' + m + ' ' + performance.now().toFixed(0));
  const a = $('b').animate({ transform: [`scaleX(${loaded})`, `scaleX(${to})`] }, { duration: ms, fill: 'forwards', easing: 'cubic-bezier(.3,.5,.5,1)' });
  loaded = to;
  return new Promise((r) => { a.ready.then(() => setTimeout(r)); setTimeout(r, document.hidden ? 0 : 1e3); });
};
const fail = (m) => { throw new Error(m, { cause: 1 }); };
if (!navigator.gpu) fail(L_('Il Cat Bar ha bisogno di WebGPU. Prova con una versione recente di Chrome o Edge.', 'Cat Bar needs WebGPU. Try a recent version of Chrome or Edge.'));
const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
if (!adapter) fail(L_('Nessun adattatore WebGPU trovato.', 'No WebGPU adapter found.'));
const device = await adapter.requestDevice();
device.addEventListener('uncapturederror', (e) => console.error('GPU: ' + e.error.message));
device.lost.then((l) => {
  console.error('device lost: ' + l.reason + ' ' + l.message);
  if (l.reason === 'destroyed' || SHOT) return;
  if (LV < 2) { keep('catbar', LV + 1); location.reload(); }
  dead = body.className = 'l e'; $('s').textContent = L_('La scheda grafica si è fermata. Ricarica la pagina per riprovare.', 'The graphics device stopped. Reload the page to try again.');
});
// ?shot renders off-screen and copies frames into a 2D canvas on request (headless browsers cannot present WebGPU)
const ctx = SHOT ? null : canvas.getContext('webgpu'), FMT = SHOT ? 'rgba8unorm' : navigator.gpu.getPreferredCanvasFormat();
if (ctx) ctx.configure({ device, format: FMT, alphaMode: 'opaque' });
const Q = device.queue, HDR = 'rgba16float', DEPTH = 'depth32float';
const TU = GPUTextureUsage, BU = GPUBufferUsage, SS = GPUShaderStage;
const buf = (data, usage) => { const b = device.createBuffer({ size: (data.byteLength + 3) & ~3, usage: usage | BU.COPY_DST }); Q.writeBuffer(b, 0, data.buffer || data, data.byteOffset || 0, data.byteLength); return b; };
const tex = (w, h, format, usage, o = {}) => device.createTexture({ size: [w, h, o.layers || 1], format, usage, mipLevelCount: o.mips || 1, sampleCount: o.samples || 1 });
keep('catbarLoad', 1);

// ---------------------------------------------------------------- build the café
await say(L_('Sistemiamo i tavolini…', 'Setting out the tables…'), 0.2, 600);
const gW = W.pack(), gS = SKYM.pack(), gP = PROPS.pack();
await say(L_('Spazzoliamo i gatti…', 'Brushing the cats…'), 0.55, 1400);
const gC = buildCatMesh();
const WH = buildWhiskers();
const EM = new Mesh(); sphere(EM, M4(), 1, [1, 1, 1], 0, 20); const gE = EM.pack();
await say(L_('Accendiamo le luci…', 'Switching on the lights…'), 0.8, 600);

const mkVB = (g) => ({ vb: buf(new Uint8Array(g.vb), BU.VERTEX), ib: buf(g.ib, BU.INDEX), n: g.count });
const VW = mkVB(gW), VS = mkVB(gS), VP = mkVB(gP), VC = mkVB(gC), VE = mkVB(gE), VWH = buf(WH, BU.VERTEX);
const NWH = WH.length / 4;

// ---------------------------------------------------------------- textures and buffers
const sRep = device.createSampler({ addressModeU: 'repeat', addressModeV: 'repeat', magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', maxAnisotropy: 8 });
const sClamp = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
const sCmp = device.createSampler({ compare: 'less-equal', magFilter: 'linear', minFilter: 'linear' });
const tShadowS = tex(SHADOW, SHADOW, DEPTH, TU.RENDER_ATTACHMENT | TU.COPY_SRC);
const tShadow = tex(SHADOW, SHADOW, DEPTH, TU.RENDER_ATTACHMENT | TU.TEXTURE_BINDING | TU.COPY_DST);
const tDummyD = tex(1, 1, DEPTH, TU.RENDER_ATTACHMENT | TU.TEXTURE_BINDING);
const tDummy = tex(1, 1, 'rgba8unorm', TU.TEXTURE_BINDING | TU.COPY_DST);
Q.writeTexture({ texture: tDummy }, new Uint8Array([255, 255, 255, 255]), { bytesPerRow: 4 }, [1, 1]);
// canvas art, with mip levels drawn by the browser's own scaler
const NL = ARTS.length, ARTW = 1024, ARTH = 512, ARTM = 10;
const tArt = tex(ARTW, ARTH, 'rgba8unorm', TU.TEXTURE_BINDING | TU.COPY_DST | TU.RENDER_ATTACHMENT, { layers: NL, mips: ARTM });
ARTS.forEach((cv, l) => {
  for (let m = 0; m < ARTM; m++) {
    const w = max(1, ARTW >> m), h = max(1, ARTH >> m), c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(cv, 0, 0, w, h);
    Q.copyExternalImageToTexture({ source: c }, { texture: tArt, mipLevel: m, origin: [0, 0, l] }, [w, h]);
  }
});

const NU = 192, UB = new Float32Array(NU), UBS = new Float32Array(NU);
const ubo = device.createBuffer({ size: NU * 4, usage: BU.UNIFORM | BU.COPY_DST }), uboS = device.createBuffer({ size: NU * 4, usage: BU.UNIFORM | BU.COPY_DST });
const NMD = 256, MDD = new Float32Array(NMD * 16); ident(MDD.subarray(0, 16)); // prop matrices: 0 = the room
const DL = []; // props to draw this frame: [mesh name, matrix slot]
const mdBuf = device.createBuffer({ size: MDD.byteLength, usage: BU.STORAGE | BU.COPY_DST });
const bnBuf = device.createBuffer({ size: BND.byteLength, usage: BU.STORAGE | BU.COPY_DST });
const cpBuf = device.createBuffer({ size: CPD.byteLength, usage: BU.STORAGE | BU.COPY_DST });
const NH = 48, PTD = new Float32Array(NH * 4);
const ptBuf = device.createBuffer({ size: PTD.byteLength, usage: BU.STORAGE | BU.COPY_DST });
Q.writeBuffer(mdBuf, 0, MDD);

const VF = SS.VERTEX | SS.FRAGMENT;
const bgl0 = device.createBindGroupLayout({ entries: [
  { binding: 0, visibility: VF, buffer: {} },
  { binding: 1, visibility: VF, sampler: {} }, { binding: 2, visibility: VF, sampler: {} }, { binding: 3, visibility: VF, sampler: { type: 'comparison' } },
  { binding: 4, visibility: VF, texture: { sampleType: 'depth' } }, { binding: 5, visibility: VF, texture: {} },
  { binding: 6, visibility: VF, texture: { viewDimension: '2d-array' } },
  ...[7, 8, 9, 10].map((binding) => ({ binding, visibility: VF, buffer: { type: 'read-only-storage' } }))] });
const mkBG0 = (u, sh, ao) => device.createBindGroup({ layout: bgl0, entries: [
  { binding: 0, resource: { buffer: u } }, { binding: 1, resource: sRep }, { binding: 2, resource: sClamp }, { binding: 3, resource: sCmp },
  { binding: 4, resource: sh.createView() }, { binding: 5, resource: ao.createView() }, { binding: 6, resource: tArt.createView({ dimension: '2d-array' }) },
  { binding: 7, resource: { buffer: mdBuf } }, { binding: 8, resource: { buffer: bnBuf } }, { binding: 9, resource: { buffer: cpBuf } }, { binding: 10, resource: { buffer: ptBuf } }] });
const bgShadow = mkBG0(uboS, tDummyD, tDummy), bgPre = mkBG0(ubo, tDummyD, tDummy);
const bglPost = device.createBindGroupLayout({ entries: [
  { binding: 0, visibility: SS.FRAGMENT, texture: { sampleType: 'depth' } },
  { binding: 1, visibility: SS.FRAGMENT, texture: {} }, { binding: 2, visibility: SS.FRAGMENT, texture: {} }] });
const pl0 = device.createPipelineLayout({ bindGroupLayouts: [bgl0] });
const plPost = device.createPipelineLayout({ bindGroupLayouts: [bgl0, bglPost] });

// ---------------------------------------------------------------- pipelines
const mod = (code) => device.createShaderModule({ code });
const A = (shaderLocation, offset, format) => ({ shaderLocation, offset, format });
const vbW = { arrayStride: 24, attributes: [A(0, 0, 'float32x3'), A(1, 12, 'snorm8x4'), A(2, 16, 'unorm8x4'), A(3, 20, 'unorm16x2')] };
const vbC = { arrayStride: 24, attributes: [A(0, 0, 'float32x3'), A(1, 12, 'snorm8x4'), A(2, 16, 'uint8x4'), A(3, 20, 'unorm8x4')] };
const mW = mod(W_WORLD), mC = mod(W_CAT(AA > 1)), mE = mod(W_EYE), mWh = mod(W_WHISK), mPt = mod(W_PART), mPost = mod(W_POST);
const DS = (write = true, bias) => ({ format: DEPTH, depthWriteEnabled: write, depthCompare: 'less', ...(bias ? { depthBias: 2, depthBiasSlopeScale: 2.5 } : {}) });
const PREM = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } };
const ADD = { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } };
const depthPipe = (m, vb, bias) => device.createRenderPipeline({ layout: pl0, vertex: { module: m, entryPoint: 'vsD', buffers: [vb] },
  primitive: { cullMode: bias ? 'none' : 'back' }, depthStencil: DS(true, bias) });
const pWShadow = depthPipe(mW, vbW, 1), pWPre = depthPipe(mW, vbW, 0), pCShadow = depthPipe(mC, vbC, 1), pCPre = depthPipe(mC, vbC, 0);
const mainPipe = (m, vb, o = {}) => device.createRenderPipeline({ layout: pl0,
  vertex: { module: m, entryPoint: 'vs', buffers: vb ? [vb] : [] },
  fragment: { module: m, entryPoint: 'fs', targets: [{ format: HDR, blend: o.blend }] },
  primitive: { cullMode: o.cull || 'back', topology: o.topo || 'triangle-list' },
  depthStencil: DS(!o.blend), multisample: { count: AA, alphaToCoverageEnabled: !!o.a2c } });
const pW = mainPipe(mW, vbW), pC = mainPipe(mC, vbC, { a2c: AA > 1 }), pE = mainPipe(mE, vbW);
const pWh = mainPipe(mWh, { arrayStride: 16, attributes: [A(0, 0, 'float32x4')] }, { blend: PREM, topo: 'line-list', cull: 'none' });
const pPt = mainPipe(mPt, null, { blend: PREM, cull: 'none' });
const postPipe = (entry, format, blend) => device.createRenderPipeline({ layout: plPost, vertex: { module: mPost, entryPoint: 'vs' },
  fragment: { module: mPost, entryPoint: entry, targets: [{ format, blend }] } });
const pAO = postPipe('fsAO', 'r8unorm'), pBlur = postPipe('fsBlur', 'r8unorm'), pDown = postPipe('fsDown', HDR), pUp = postPipe('fsUp', HDR, ADD), pComp = postPipe('fsComp', FMT), pTAA = postPipe('fsTAA', HDR);

// ---------------------------------------------------------------- screen-sized targets
let RW = 0, RH_ = 0, TX = {}, bgMain, PG = {};
const NBL = 5;
const postBG = (a, b) => device.createBindGroup({ layout: bglPost, entries: [{ binding: 0, resource: TX.depth.createView() }, { binding: 1, resource: (a || tDummy).createView() }, { binding: 2, resource: (b || tDummy).createView() }] });
function resize(w, h) {
  w = max(16, w | 0); h = max(16, h | 0);
  if (w === RW && h === RH_) return;
  RW = w; RH_ = h; canvas.width = w; canvas.height = h; histOK = false;
  for (const k in TX) (Array.isArray(TX[k]) ? TX[k] : [TX[k]]).forEach((t) => t.destroy());
  const RA = TU.RENDER_ATTACHMENT, TB = TU.TEXTURE_BINDING;
  TX = {
    hdr: tex(w, h, HDR, RA | TB), depth: tex(w, h, DEPTH, RA | TB), hist: [tex(w, h, HDR, RA | TB), tex(w, h, HDR, RA | TB)],
    ao0: tex(w >> 1, h >> 1, 'r8unorm', RA | TB), ao: tex(w >> 1, h >> 1, 'r8unorm', RA | TB),
    bl: Array.from({ length: NBL }, (_, i) => tex(max(1, w >> (i + 1)), max(1, h >> (i + 1)), HDR, RA | TB)),
  };
  if (SHOT) TX.shot = tex(w, h, 'rgba8unorm', RA | TU.COPY_SRC);
  if (AA > 1) { TX.ms = tex(w, h, HDR, RA, { samples: AA }); TX.msd = tex(w, h, DEPTH, RA, { samples: AA }); }
  else TX.msd = tex(w, h, DEPTH, RA);
  bgMain = mkBG0(ubo, tShadow, SSAO ? TX.ao : tDummy);
  PG = {
    ao: postBG(), blur: postBG(TX.ao0), comp: [0, 1].map((k) => postBG(TX.hist[k], TX.bl[0])),
    taa: [0, 1].map((k) => postBG(TX.hdr, TX.hist[1 - k])), down0: [0, 1].map((k) => postBG(TX.hist[k])),
    down: TX.bl.map((t, i) => postBG(i ? TX.bl[i - 1] : TX.hdr)), up: TX.bl.map((t, i) => postBG(TX.bl[i])),
  };
}

// ---------------------------------------------------------------- sun
const SV = M4(), SP = M4(), SVP = M4();
{
  const cx = 0, cy = 1.5, cz = 0;
  lookAt(SV, cx + SUN[0] * 30, cy + SUN[1] * 30, cz + SUN[2] * 30, cx, cy, cz);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (const X of [-RX - 0.3, RX + 0.3]) for (const Y of [-0.1, RH + 0.2]) for (const Z of [-RZ - 0.3, RZ + 0.3]) {
    const x = SV[0] * X + SV[4] * Y + SV[8] * Z + SV[12], y = SV[1] * X + SV[5] * Y + SV[9] * Z + SV[13], z = SV[2] * X + SV[6] * Y + SV[10] * Z + SV[14];
    x0 = min(x0, x); x1 = max(x1, x); y0 = min(y0, y); y1 = max(y1, y); z0 = min(z0, z); z1 = max(z1, z);
  }
  ortho(SP, x0, x1, y0, y1, -z1 - 1, -z0 + 1); mul4(SVP, SP, SV);
}
const SUNC = [1.0 * 7.5, 0.76 * 7.5, 0.5 * 7.5];

// ---------------------------------------------------------------- the player
const PL = { x: 3.2, z: 2.2, yaw: -2.2, pitch: -0.12, eye: 1.6, crouch: 0, vx: 0, vz: 0, bob: 0 };
const KEY = {};
let coins = 30; try { if (localStorage.catbarCoins != null) coins = +localStorage.catbarCoins || 0; } catch {} // a little start-up money
$('n').textContent = coins;
function movePlayer(dt) {
  let f = (KEY.KeyW || KEY.ArrowUp ? 1 : 0) - (KEY.KeyS || KEY.ArrowDown ? 1 : 0) + TOUCH.f, s = (KEY.KeyD || KEY.ArrowRight ? 1 : 0) - (KEY.KeyA || KEY.ArrowLeft ? 1 : 0) + TOUCH.s;
  if (f || s) PL.goto = null;
  else if (PL.goto) { // walking on its own to a tapped spot or cat
    const g = PL.goto; if (g.cat) { g.x = g.cat.sp[1][0]; g.z = g.cat.sp[1][2]; }
    const dx = g.x - PL.x, dz = g.z - PL.z, d = hypot(dx, dz), stop = g.cat ? 0.95 : 0.2;
    g.t += dt;
    if (d < stop || g.t > 12) { PL.goto = null; if (g.cat && d < 1.5) tapCat(g.cat); }
    else {
      // steer around furniture on the way
      let ux = dx / d, uz = dz / d;
      for (const c of COL) {
        let vx, vz, e;
        if (c.r !== undefined) { vx = PL.x - c.x; vz = PL.z - c.z; e = hypot(vx, vz) - c.r - 0.3; }
        else { vx = PL.x - clamp(PL.x, c.x0, c.x1); vz = PL.z - clamp(PL.z, c.z0, c.z1); e = hypot(vx, vz) - 0.3; }
        const l = hypot(vx, vz) || 1;
        if (e < 0.45 && !(g.cat && hypot(c.x - g.x, c.z - g.z) < 0.1)) { const k = (0.45 - e) * 2.2; ux += (vx / l) * k - (vz / l) * k * 0.6; uz += (vz / l) * k + (vx / l) * k * 0.6; }
      }
      PL.yaw += wrapA(atan2(ux, -uz) - PL.yaw) * min(1, dt * 6);
      if (g.cat) PL.pitch = damp(PL.pitch, -0.45, 3, dt);
      f = clamp((d - stop) / 0.4, 0.3, 1);
      g.lx = g.lx ?? PL.x; g.lz = g.lz ?? PL.z;
      if (g.t > 1.5) { if (hypot(PL.x - g.lx, PL.z - g.lz) < 0.15) { PL.goto = null; if (g.cat && d < 1.8) tapCat(g.cat); } else { g.lx = PL.x; g.lz = PL.z; g.t = 0.01; } } // stuck against something
    }
  }
  const l = hypot(f, s); if (l > 1) { f /= l; s /= l; }
  const sp = (KEY.ShiftLeft || KEY.ShiftRight ? 2.6 : 1.5) * (PL.crouch > 0.5 ? 0.55 : 1);
  const fx = sin(PL.yaw), fz = -cos(PL.yaw), rx_ = cos(PL.yaw), rz_ = sin(PL.yaw);
  PL.vx = damp(PL.vx, (fx * f + rx_ * s) * sp, 10, dt); PL.vz = damp(PL.vz, (fz * f + rz_ * s) * sp, 10, dt);
  let x = PL.x + PL.vx * dt, z = PL.z + PL.vz * dt;
  const r = 0.28;
  for (let it = 0; it < 3; it++) {
    for (const c of COL) {
      if (c.r !== undefined) { const dx = x - c.x, dz = z - c.z, d = hypot(dx, dz), m = c.r + r * 0.6; if (d < m && d > 1e-5) { x = c.x + (dx / d) * m; z = c.z + (dz / d) * m; } }
      else { const px = clamp(x, c.x0, c.x1), pz = clamp(z, c.z0, c.z1), dx = x - px, dz = z - pz, d = hypot(dx, dz); if (d < r) { if (d > 1e-5) { x = px + (dx / d) * r; z = pz + (dz / d) * r; } else { x = c.x0 - r; } } }
    }
    for (const c of CATS) { if (c.perch) continue; const dx = x - c.x, dz = z - c.z, d = hypot(dx, dz), m = 0.32; if (d < m && d > 1e-5) { x = c.x + (dx / d) * m; z = c.z + (dz / d) * m; } }
    x = clamp(x, -RX + r, RX - r); z = clamp(z, -RZ + r, RZ - r);
  }
  const moved = hypot(x - PL.x, z - PL.z);
  PL.x = x; PL.z = z; PL.bob += moved * 7;
  const want = PET.on && PET.cat && PET.cat.y < 0.3 ? 1 : KEY.KeyC ? 1 : 0;
  PL.crouch = damp(PL.crouch, want, 5, dt);
  PL.eye = mix(1.6, 0.95, PL.crouch) + sin(PL.bob) * 0.012;
}

// ---------------------------------------------------------------- input
let locked = false;
const TOUCH = { f: 0, s: 0, look: null, move: null };
const inGame = () => body.classList.contains('g');
addEventListener('keydown', (e) => {
  KEY[e.code] = true;
  if (e.code === 'KeyH') info.hidden = !info.hidden;
  if (e.code === 'Escape' && !locked && inGame() && !SHOPOPEN) body.className = 'm';
  if (e.code === 'KeyM' && typeof toggleMute === 'function') toggleMute();
  if (e.code === 'KeyE' && inGame()) PET.key = true;
});
addEventListener('keyup', (e) => { KEY[e.code] = false; if (e.code === 'KeyE') PET.key = false; });
addEventListener('blur', () => { for (const k in KEY) KEY[k] = false; PET.mouse = PET.key = false; });
canvas.addEventListener('mousedown', (e) => {
  if (!inGame()) return;
  if (!locked && !mob) lockMouse();
  if (e.button === 0) PET.mouse = true;
});
addEventListener('mouseup', (e) => { if (e.button === 0) PET.mouse = false; });
// pointer lock where allowed; otherwise (some embedded pages) drag with the mouse to look around
const lockMouse = () => { try { const r = canvas.requestPointerLock?.(); if (r && r.catch) r.catch(() => {}); } catch {} };
addEventListener('mousemove', (e) => {
  if (!locked && !(inGame() && e.buttons)) return;
  PL.yaw += e.movementX * 0.0022; PL.pitch = clamp(PL.pitch - e.movementY * 0.0022, -1.45, 1.45);
});
document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (locked) body.className = 'g p';
  else if (inGame() && !SHOPOPEN) { body.className = 'm'; PET.mouse = false; }
});
function enter() {
  if (mob && !TIPPED) { TIPPED = true; const t = $('tip'); t.hidden = false; setTimeout(() => (t.hidden = true), 9000); }
  body.className = 'g'; $('d').textContent = L_('Torna dai gatti', 'Back to the cats');
  if (!mob) lockMouse();
  if (typeof startAudio === 'function') startAudio();
}
$('d').onclick = enter;
$('o').onclick = () => { body.className = 'm'; };
// quality buttons
[...$('q').querySelectorAll('button')].forEach((b, i) => {
  const lv = 2 - i; if (lv === LV) b.className = 'on';
  b.onclick = () => { keep('catbar', lv); location.reload(); };
});
// touch (pointer events, so it also works inside embedded pages):
//   tap a cat -> walk up to it and pet it   tap the floor -> walk there   drag -> look around
//   hold a finger on a cat -> keep petting   joystick in the bottom-left corner -> walk freely
let TIPPED = false;
const TP = new Map(); // active touch pointers
const joyBase = () => { const r = $('joyBase').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r.width / 2]; };
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' || !inGame()) return;
  e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch {}
  const [jx, jy, jr] = joyBase();
  const joy = jr > 0 && hypot(e.clientX - jx, e.clientY - jy) < jr * 1.6 && ![...TP.values()].some((p) => p.joy);
  const p = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, joy, drag: false, cat: null };
  TP.set(e.pointerId, p);
  if (joy) { PL.goto = null; return; }
  const c = pickAt(e.clientX, e.clientY, 0.09);
  if (c && hypot(c.sp[1][0] - PL.x, c.sp[1][2] - PL.z) < REACH) { p.cat = c; PET.force = c; PET.touch = true; }
}, { passive: false });
canvas.addEventListener('pointermove', (e) => {
  const p = TP.get(e.pointerId); if (!p) return;
  e.preventDefault();
  if (p.joy) {
    const [jx, jy, jr] = joyBase(), dx = clamp(e.clientX - jx, -jr, jr), dy = clamp(e.clientY - jy, -jr, jr);
    TOUCH.s = dx / jr; TOUCH.f = -dy / jr; $('joyBase').firstChild.style.transform = `translate(${dx}px, ${dy}px)`; return;
  }
  if (!p.drag && hypot(e.clientX - p.x0, e.clientY - p.y0) > 14) { p.drag = true; if (p.cat) { PET.touch = false; PET.force = null; p.cat = null; } }
  if (p.drag) { PL.yaw += (e.clientX - p.x) * 0.006; PL.pitch = clamp(PL.pitch - (e.clientY - p.y) * 0.006, -1.4, 1.4); if (PL.goto && !PL.goto.cat) PL.goto = null; }
  p.x = e.clientX; p.y = e.clientY;
}, { passive: false });
const pEnd = (e) => {
  const p = TP.get(e.pointerId); if (!p) return; TP.delete(e.pointerId);
  if (p.joy) { TOUCH.f = TOUCH.s = 0; $('joyBase').firstChild.style.transform = ''; return; }
  if (p.cat) { PET.touch = false; }
  if (p.drag || e.type === 'pointercancel') return;
  // a tap
  const c = p.cat || pickAt(p.x0, p.y0, 0.12, 15);
  if (c) tapCat(c);
  else { const hit = floorAt(p.x0, p.y0); if (hit) PL.goto = { x: hit[0], z: hit[1], cat: null, t: 0 }; }
};
canvas.addEventListener('pointerup', pEnd); canvas.addEventListener('pointercancel', pEnd);
// tapping a cat: close enough -> a petting session that runs on its own, otherwise walk to it first
function tapCat(c) {
  const d = hypot(c.sp[1][0] - PL.x, c.sp[1][2] - PL.z);
  if (d < 1.4) { PET.force = c; PET.auto = PET_TIME + 0.5; PL.goto = null; }
  else PL.goto = { cat: c, x: c.x, z: c.z, t: 0 };
}
$('snackBtn').onclick = () => giveSnack(PET.cat || lastTarget);
$('laserBtn').onclick = () => { if (SAVE.laser) LASER.on = !LASER.on; else openShop('toys'); };
$('wearBtn').onclick = () => { wearCat = PET.cat || lastTarget || wearCat; openShop('wear'); };
$('pet').addEventListener('pointerdown', (e) => { PET.mouse = true; e.preventDefault(); });
$('pet').addEventListener('pointerup', () => { PET.mouse = false; });
$('pet').addEventListener('pointerleave', () => { PET.mouse = false; });

// ---------------------------------------------------------------- looking at and petting cats
const PET = { auto: 0, touch: false, force: null, on: false, cat: null, t: 0, mouse: false, key: false, heart: 0, hk: 0, lost: 0, stroke: 0 };
const PET_TIME = 1.6, COOLDOWN = 10, REACH = 2.5;
const ring = $('r'), xh = $('x'), tl = $('t');
let lastTarget = null;
function pickCat(ox, oy, oz, dx, dy, dz, extra = 0, far = REACH) {
  let best = null, bt = far;
  for (const c of CATS) {
    const rs = [0.11, 0.1, 0.085];
    for (let k = 0; k < 3; k++) {
      const s = c.sp[k], r = rs[k] * c.scale + 0.03 + extra, lx = s[0] - ox, ly = s[1] - oy, lz = s[2] - oz;
      const b = lx * dx + ly * dy + lz * dz, d2 = lx * lx + ly * ly + lz * lz - b * b;
      if (d2 > r * r) continue;
      const t = b - sqrt(r * r - d2);
      if (t > 0 && t < bt) { bt = t; best = c; }
    }
  }
  return best;
}
// the cat under a point of the screen (touch)
const PK0 = new Float32Array(4), PK1 = new Float32Array(4);
function pickAt(cx, cy, extra = 0, far = REACH) { const r = rayAt(cx, cy); return pickCat(PL.x, PL.eye, PL.z, r[0], r[1], r[2], extra, far); }
function floorAt(cx, cy) { const r = rayAt(cx, cy); if (r[1] > -0.02) return null; const t = -PL.eye / r[1]; return [clamp(PL.x + r[0] * t, -RX + 0.35, RX - 0.35), clamp(PL.z + r[2] * t, -RZ + 0.35, RZ - 0.35)]; }
function rayAt(cx, cy) {
  const nx = (cx / innerWidth) * 2 - 1, ny = 1 - (cy / innerHeight) * 2, m = IVP;
  for (const [o, z] of [[PK0, 0], [PK1, 1]]) for (let r = 0; r < 4; r++) o[r] = m[r] * nx + m[4 + r] * ny + m[8 + r] * z + m[12 + r];
  const ax = PK0[0] / PK0[3], ay = PK0[1] / PK0[3], az = PK0[2] / PK0[3], bx = PK1[0] / PK1[3] - ax, by = PK1[1] / PK1[3] - ay, bz = PK1[2] / PK1[3] - az, l = hypot(bx, by, bz);
  return [bx / l, by / l, bz / l];
}
function popCoin(n = 1) {
  coins += n; keep('catbarCoins', coins); $('n').textContent = coins;
  const c = $('coins'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
  const p = document.createElement('div'); p.className = 'plus'; p.innerHTML = `+${n} <span class=coin></span>`; body.appendChild(p); setTimeout(() => p.remove(), 1500);
  if (typeof coinSound === 'function') coinSound();
}
// a snack is put down in front of the cat you look at (F); it eats it on the spot
const SNACK = { t: 0, x: 0, z: 0, cat: null };
function giveSnack(c) {
  if (!c || !SAVE || !SAVE.snack) return false;
  SAVE.snack--; saveItems();
  SNACK.cat = c; SNACK.t = 2.5; SNACK.x = c.sp[2][0]; SNACK.z = c.sp[2][2];
  if (c.st !== 'sleep' || true) { c.st = 'snack'; c.pose = c.pose === STAND ? CROUCH : c.pose === SLEEP ? LOAF : c.pose; c.tm = 2.5; }
  c.hunger = max(0, c.hunger - 0.3); c.joy = min(1, c.joy + 0.25); c.meowT = 0.4;
  for (let k = 0; k < 4; k++) PTD.set([c.sp[2][0] + rr(-0.06, 0.06), c.sp[2][1] + 0.05 + k * 0.03, c.sp[2][2] + rr(-0.06, 0.06), 0.001 + k * 0.12], ((PET.hk++) % (NH - 1)) * 4);
  return true;
}
function updatePet(dt, fx, fy, fz) {
  const target = inGame() ? pickCat(PL.x, PL.eye, PL.z, fx, fy, fz) : null;
  if (SNACK.t > 0) SNACK.t -= dt;
  if (KEY.KeyF && !PET.fDown && target) giveSnack(target);
  PET.fDown = !!KEY.KeyF;
  if (PET.auto > 0) PET.auto -= dt;
  const holding = PET.mouse || PET.key || PET.touch || PET.auto > 0;
  if (holding) { // start on the cat under the crosshair, then stay on it while the button is held
    const start = target || PET.force;
    if (!PET.on && start) { if (start !== PET.cat) { PET.cat = start; PET.t = 0; } PET.on = true; }
  } else { PET.on = false; PET.force = null; }
  if (PET.on && PET.cat) { // keep it in view: the camera turns gently towards it (crouching moves the eye)
    const c = PET.cat, dx = c.sp[1][0] - PL.x, dz = c.sp[1][2] - PL.z, dy = c.sp[1][1] - PL.eye;
    const want = atan2(dy, hypot(dx, dz)) + 0.12;
    PL.pitch = damp(PL.pitch, clamp(want, -1.4, 1.4), 4, dt);
    PL.yaw += wrapA(atan2(dx, -dz) - PL.yaw) * min(1, dt * 2);
  }
  for (const c of CATS) c.pet = max(0, c.pet - dt);
  let purr = 0;
  if (PET.on && PET.cat) {
    const c = PET.cat;
    if (hypot(c.sp[1][0] - PL.x, c.sp[1][1] - PL.eye, c.sp[1][2] - PL.z) > REACH + 0.8) { PET.on = false; PET.t = 0; }
    c.pet = 0.4; purr = 1;
    PET.t += dt; PET.stroke += dt / 1.25;
    PET.heart -= dt;
    if (PET.heart < 0) { PET.heart = 0.32; const k = PET.hk++ % (NH - 1); PTD.set([c.sp[2][0] + rr(-0.05, 0.05), c.sp[2][1] + 0.07, c.sp[2][2] + rr(-0.05, 0.05), 0.001], k * 4); }
    if (PET.t >= PET_TIME) {
      PET.t = 0;
      if (c.coinT <= 0) { popCoin(c.joy > 0.6 ? 2 : 1); c.coinT = COOLDOWN; c.petTotal++; if (rnd() < 0.5) meow(c, 0.6); }
    }
  }
  for (const c of CATS) c.coinT -= dt;
  if (typeof setPurr === 'function') setPurr(purr, PET.cat);
  // HUD
  const show = PET.on ? PET.cat : target;
  xh.classList.toggle('on', !!show);
  ring.style.strokeDasharray = `${PET.on ? (PET.t / PET_TIME) * 100 : 0} 100`;
  if (show !== lastTarget || PET.on || (show && show.coinT > -1) || frame % 20 === 0) {
    lastTarget = show;
    tl.classList.toggle('on', !!show);
    if (show) {
      $('tn').textContent = show.name; $('tb').textContent = show.breed;
      for (const [id, v] of [['bh', 1 - show.hunger], ['bt', 1 - show.thirst], ['bj', show.joy]]) $(id).style.setProperty('--v', v.toFixed(2));
      const need = show.hunger > 0.6 ? L_('ha fame', 'is hungry') : show.thirst > 0.6 ? L_('ha sete', 'is thirsty') : '';
      $('ti').textContent = (need && !PET.on ? need + ' · ' : '') + (PET.on ? (show.coinT > 0 ? L_('fa le fusa… ♥', 'purring… ♥') : L_('coccole in corso… ♥', 'petting… ♥')) : show.coinT > 0 ? L_('ha appena avuto coccole', 'just had cuddles') + ` · ${Math.ceil(show.coinT)}s` : (mob ? L_('tocca il gatto: coccola', 'tap the cat: pet') : L_('tieni premuto il click: coccola', 'hold the click: pet')) + (show.joy > 0.6 ? ' → +2' : ' → +1') + (SAVE && SAVE.snack && !mob ? L_(' · F: snack', ' · F: treat') : '') + (typeof OFFER !== 'undefined' && OFFER && OFFER.cat === show && !mob ? L_(' · G: gioca!', ' · G: play!') : ''));
    }
  }
  for (let k = 0; k < NH; k++) if (PTD[k * 4 + 3] > 0) { PTD[k * 4 + 3] += dt; if (PTD[k * 4 + 3] > 1.6) PTD[k * 4 + 3] = 0; }
}

// ---------------------------------------------------------------- per-frame uniforms
const V = M4(), Pm = M4(), VPm = M4(), IVP = M4(), VP0 = M4(), PVP = M4();
let histOK = false, FOCUS = 2;
const LT = new Float32Array(96);
LIGHTS.slice(0, 12).forEach((l, i) => LT.set([l[0], l[1], l[2], l[3], l[4], l[5], l[6], l[7]], i * 8));
let frame = 0;
function uniforms(t, fx, fy, fz) {
  const ex = PL.x, ey = PL.eye, ez = PL.z;
  lookAt(V, ex, ey, ez, ex + fx, ey + fy, ez + fz);
  const asp = RW / RH_; // phones held upright keep a wide enough view
  persp(Pm, asp < 1 ? min(2 * Math.atan(tan((70 * PI) / 360) / asp), 1.9) : (68 * PI) / 180, asp, 0.02, 150);
  mul4(VP0, Pm, V); // unjittered, for reprojection next frame
  // temporal anti-aliasing: a different sub-pixel offset every frame (Halton 2,3)
  const hk = (frame % 8) + 1, hal = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
  const jx = (hal(hk, 2) - 0.5) * 2 / RW, jy = (hal(hk, 3) - 0.5) * 2 / RH_;
  Pm[8] += jx; Pm[9] += jy;
  mul4(VPm, Pm, V); inv4(IVP, VPm);
  UB.set(VPm, 0); UB.set(IVP, 16); UB.set(SVP, 32); UB.set(histOK ? PVP : VP0, 48);
  UB[64] = ex; UB[65] = ey; UB[66] = ez; UB[67] = t;
  UB[68] = SUN[0]; UB[69] = SUN[1]; UB[70] = SUN[2]; UB[71] = SSAO ? 1 : 0;
  UB[72] = SUNC[0]; UB[73] = SUNC[1]; UB[74] = SUNC[2]; UB[75] = 0.016;
  UB[76] = RW; UB[77] = RH_; UB[78] = 1 / RW; UB[79] = 1 / RH_;
  UB[80] = 1.45; UB[81] = frame % 64; UB[82] = 0.8; UB[83] = DBG;
  UB[84] = V[0]; UB[85] = V[4]; UB[86] = V[8]; UB[87] = 0; UB[88] = V[1]; UB[89] = V[5]; UB[90] = V[9]; UB[91] = 0;
  UB[92] = jx; UB[93] = jy; UB[94] = histOK ? 1 : 0; UB[95] = FOCUS;
  UB.set(LT, 96);
  PVP.set(VP0); histOK = true;
  UBS.set(UB); UBS.set(SVP, 0);
  Q.writeBuffer(ubo, 0, UB); Q.writeBuffer(uboS, 0, UBS);
}

// ---------------------------------------------------------------- drawing
const colorAtt = (view, clear, resolve) => ({ view, resolveTarget: resolve, loadOp: clear ? 'clear' : 'load', storeOp: 'store', clearValue: [0, 0, 0, 0] });
function drawStatic(p, depthOnly) {
  p.setVertexBuffer(0, VW.vb); p.setIndexBuffer(VW.ib, 'uint32'); p.drawIndexed(VW.n);
}
function drawProps(p, noHand) {
  p.setVertexBuffer(0, VP.vb); p.setIndexBuffer(VP.ib, 'uint32');
  for (const [name, slot] of DL) if (!(noHand && name === 'hand')) p.drawIndexed(PM[name][1], 1, PM[name][0], 0, slot);
}
// fill the prop matrices: toys, boxes, catnip, the cats' accessories and the petting hand
const HM = M4();
function layoutProps() {
  DL.length = 0; let slot = 1;
  const put = (name, m) => { if (slot >= NMD || !PM[name]) return; MDD.set(m, slot * 16); DL.push([name, slot++]); };
  for (const ty of TOYS) { HM.set(ty.R); HM[12] = ty.x; HM[13] = ty.kind === 'yarn' ? ty.r : 0; HM[14] = ty.z; put(ty.mesh, HM); }
  for (const b of BOXES) { ident(HM); tr(HM, b.x, 0, b.z); ry(HM, b.yaw); put('box', HM); }
  for (const n of NIPS) { ident(HM); tr(HM, n.x, 0, n.z); ry(HM, n.yaw); put('nip', HM); }
  if (BOWL.food > 0.01) { ident(HM); tr(HM, BOWL.fx, 0.012 + 0.012 * BOWL.food, BOWL.z); sc(HM, 0.6 + 0.4 * BOWL.food, BOWL.food, 0.6 + 0.4 * BOWL.food); put('kibble', HM); }
  if (BOWL.water > 0.01) { ident(HM); tr(HM, BOWL.wx, 0.03 + 0.03 * BOWL.water, BOWL.z); sc(HM, 0.85 + 0.25 * BOWL.water); put('water', HM); }
  if (SNACK.t > 0) { ident(HM); tr(HM, SNACK.x, 0.008, SNACK.z); put('snack', HM); }
  for (const c of CATS) for (const a of c.acc) { const b = ACC[a]; put('a_' + a, BND.subarray((c.i * NB + b) * 16, (c.i * NB + b + 1) * 16)); }
  // the hand strokes from behind the head down the back, then lifts and comes back
  if (PET.on && PET.cat) {
    const c = PET.cat, k = PET.stroke % 1, fwd = k < 0.7, s = fwd ? sstep(0, 1, k / 0.7) : 1 - sstep(0, 1, (k - 0.7) / 0.3);
    const a = c.sp[2], b = c.sp[0], m = c.sp[1];
    const st = (i) => mix(m[i], a[i], 0.3), en = (i) => mix(m[i], b[i], 0.95);
    const x = mix(st(0), en(0), s), z = mix(st(2), en(2), s);
    const y = mix(st(1), en(1), s) + 0.1 * c.scale + (fwd ? -0.008 * sin(PI * s) : sin(PI * (k - 0.7) / 0.3) * 0.07);
    ident(HM); tr(HM, x, y, z); ry(HM, atan2(-(b[2] - a[2]), b[0] - a[0])); rz(HM, fwd ? -0.12 : 0.15); put('hand', HM);
  }
  return slot;
}
function drawCats(p, shells) {
  p.setVertexBuffer(0, VC.vb); p.setIndexBuffer(VC.ib, 'uint32');
  for (const c of CATS) if (c.vis) p.drawIndexed(VC.n, shells ? c.shells + 1 : 1, 0, 0, c.i * 64);
}
// static shadows are drawn once and copied every frame; cats and toys are drawn on top
{
  const e = device.createCommandEncoder();
  const p = e.beginRenderPass({ colorAttachments: [], depthStencilAttachment: { view: tShadowS.createView(), depthLoadOp: 'clear', depthClearValue: 1, depthStoreOp: 'store' } });
  UBS.set(SVP, 0); Q.writeBuffer(uboS, 0, UBS);
  p.setPipeline(pWShadow); p.setBindGroup(0, bgShadow); drawStatic(p); p.end();
  Q.submit([e.finish()]);
}
const sphereVisible = (x, y, z, r) => { // against the view frustum (rows of VP)
  const m = VPm;
  for (let i = 0; i < 4; i++) {
    const s = i < 2 ? 0 : 1, sg = i & 1 ? -1 : 1;
    const a = m[3] + sg * m[s], b = m[7] + sg * m[4 + s], c = m[11] + sg * m[8 + s], d = m[15] + sg * m[12 + s];
    if (a * x + b * y + c * z + d < -r * hypot(a, b, c)) return false;
  }
  return true;
};
function render() {
  const e = device.createCommandEncoder();
  let p;
  if (!LITE || frame % 3 === 0) { // on Low the moving shadows are refreshed every third frame
    e.copyTextureToTexture({ texture: tShadowS }, { texture: tShadow }, [SHADOW, SHADOW]);
    p = e.beginRenderPass({ colorAttachments: [], depthStencilAttachment: { view: tShadow.createView(), depthLoadOp: 'load', depthStoreOp: 'store' } });
    p.setBindGroup(0, bgShadow);
    p.setPipeline(pCShadow); for (const c of CATS) { p.setVertexBuffer(0, VC.vb); p.setIndexBuffer(VC.ib, 'uint32'); p.drawIndexed(VC.n, 1, 0, 0, c.i * 64); }
    p.setPipeline(pWShadow); drawProps(p, true);
    p.end();
  }
  // depth pre-pass (for AO and light shafts); on Low without MSAA the main pass writes that depth itself
  const pre = !LITE;
  if (pre) {
  p = e.beginRenderPass({ colorAttachments: [], depthStencilAttachment: { view: TX.depth.createView(), depthLoadOp: 'clear', depthClearValue: 1, depthStoreOp: 'store' } });
  p.setBindGroup(0, bgPre);
  p.setPipeline(pWPre); drawStatic(p); drawProps(p);
  p.setVertexBuffer(0, VS.vb); p.setIndexBuffer(VS.ib, 'uint32'); p.drawIndexed(VS.n);
  p.setPipeline(pCPre); drawCats(p, false);
  p.end();
  }
  if (SSAO) {
    for (const [pipe, tgt, bg] of [[pAO, TX.ao0, PG.ao], [pBlur, TX.ao, PG.blur]]) {
      p = e.beginRenderPass({ colorAttachments: [colorAtt(tgt.createView(), true)] });
      p.setPipeline(pipe); p.setBindGroup(0, bgPre); p.setBindGroup(1, bg); p.draw(3); p.end();
    }
  }
  // main pass
  p = e.beginRenderPass({
    colorAttachments: [AA > 1 ? colorAtt(TX.ms.createView(), true, TX.hdr.createView()) : colorAtt(TX.hdr.createView(), true)],
    depthStencilAttachment: { view: (pre || AA > 1 ? TX.msd : TX.depth).createView(), depthLoadOp: 'clear', depthClearValue: 1, depthStoreOp: pre || AA > 1 ? 'discard' : 'store' },
  });
  p.setBindGroup(0, bgMain);
  p.setPipeline(pW); drawStatic(p); drawProps(p);
  p.setVertexBuffer(0, VS.vb); p.setIndexBuffer(VS.ib, 'uint32'); p.drawIndexed(VS.n);
  p.setPipeline(pC); drawCats(p, true);
  p.setPipeline(pE); p.setVertexBuffer(0, VE.vb); p.setIndexBuffer(VE.ib, 'uint32'); p.drawIndexed(VE.n, CATS.length * 2);
  p.setPipeline(pWh); p.setVertexBuffer(0, VWH); p.draw(NWH, CATS.length);
  p.setPipeline(pPt); p.draw(6, NDUST + NH);
  p.end();
  // temporal anti-aliasing into one of two history images
  const hk = frame & 1;
  p = e.beginRenderPass({ colorAttachments: [colorAtt(TX.hist[hk].createView(), true)] });
  p.setPipeline(pTAA); p.setBindGroup(0, bgPre); p.setBindGroup(1, PG.taa[hk]); p.draw(3); p.end();
  // bloom
  for (let i = 0; i < NBL; i++) {
    p = e.beginRenderPass({ colorAttachments: [colorAtt(TX.bl[i].createView(), true)] });
    p.setPipeline(pDown); p.setBindGroup(0, bgPre); p.setBindGroup(1, i ? PG.down[i] : PG.down0[hk]); p.draw(3); p.end();
  }
  for (let i = NBL - 1; i > 0; i--) {
    p = e.beginRenderPass({ colorAttachments: [colorAtt(TX.bl[i - 1].createView(), false)] });
    p.setPipeline(pUp); p.setBindGroup(0, bgPre); p.setBindGroup(1, PG.up[i]); p.draw(3); p.end();
  }
  p = e.beginRenderPass({ colorAttachments: [colorAtt((SHOT ? TX.shot : ctx.getCurrentTexture()).createView(), true)] });
  p.setPipeline(pComp); p.setBindGroup(0, bgMain); p.setBindGroup(1, PG.comp[hk]); p.draw(3); p.end();
  Q.submit([e.finish()]);
}

async function grab(n = 1) { // ?shot: draw n frames (so TAA settles) and copy the last into the canvas
  const cp = cos(PL.pitch); for (let i = 0; i < n; i++) draw(sin(PL.yaw) * cp, sin(PL.pitch), -cos(PL.yaw) * cp);
  const bpr = (RW * 4 + 255) & ~255, b = device.createBuffer({ size: bpr * RH_, usage: BU.COPY_DST | BU.MAP_READ });
  const e = device.createCommandEncoder(); e.copyTextureToBuffer({ texture: TX.shot }, { buffer: b, bytesPerRow: bpr }, [RW, RH_]); Q.submit([e.finish()]);
  await b.mapAsync(GPUMapMode.READ); const src = new Uint8Array(b.getMappedRange()), img = new ImageData(RW, RH_);
  for (let y = 0; y < RH_; y++) img.data.set(src.subarray(y * bpr, y * bpr + RW * 4), y * RW * 4);
  b.unmap(); b.destroy(); canvas.getContext('2d').putImageData(img, 0, 0);
}

// ---------------------------------------------------------------- frame loop
initCats();
let scale = mob ? 0.6 : [1, 0.85, 0.7][LV], last = performance.now(), simT = 0, ftAvg = 16, ftN = 0;
const DPR = min(devicePixelRatio || 1, mob ? 1.5 : 2);
const fitSize = () => { const s = SHOT ? 1 : DPR * scale; resize(canvas.clientWidth * s, canvas.clientHeight * s); };
if (SHOT) window.__cb = { VPm, get OFFER() { return OFFER; }, audio: () => { meow(CATS[0]); meow(CATS[10]); coinSound(); setPurr(1, CATS[0]); return !!AC + " " + AC.state; }, PET, grab, PL, CATS, UB, device, get TX() { return TX; }, get RW() { return RW; }, setCam: (x, z, yaw, pitch, eye) => { Object.assign(PL, { x, z, yaw, pitch }); if (eye) PL.eye = eye; PL.fixEye = eye; }, enter, step: (n, dt) => { for (let i = 0; i < n; i++) tick(dt); } };
function tick(dt) {
  simT += dt;
  if (inGame() && !(SHOT && window.__cb.frozen)) movePlayer(dt);
  if (PL.fixEye) PL.eye = PL.fixEye;
  const cp = cos(PL.pitch), fx = sin(PL.yaw) * cp, fy = sin(PL.pitch), fz = -cos(PL.yaw) * cp;
  for (const c of CATS) updateCat(c, dt, simT);
  updateToys(dt);
  updatePet(dt, fx, fy, fz);
  // focus for the depth of field: the cat you look at, otherwise where the view meets the floor
  { const tc = LV < 2 && (PET.on ? PET.cat : lastTarget); if (tc) { const want = hypot(tc.sp[1][0] - PL.x, tc.sp[1][1] - PL.eye, tc.sp[1][2] - PL.z); FOCUS = FOCUS > 0 ? damp(FOCUS, want, 4, dt) : want; } else FOCUS = 0; }
  // the laser dot lands where you look on the floor
  if (LASER.on && fy < -0.05) {
    const t = -PL.eye / fy; LASER.x = clamp(PL.x + fx * t, -RX + 0.2, RX - 0.2); LASER.z = clamp(PL.z + fz * t, -RZ + 0.2, RZ - 0.2);
    PTD.set([LASER.x, 0.004, LASER.z, -1], (NH - 1) * 4);
  } else { if (PTD[(NH - 1) * 4 + 3] < 0) PTD[(NH - 1) * 4 + 3] = 0; if (LASER.on && fy >= -0.05) { LASER.x = 99; } }
  return [fx, fy, fz];
}
function draw(fx, fy, fz) {
  fitSize();
  uniforms(simT, fx, fy, fz);
  // fur detail by distance, frustum culling
  for (const c of CATS) {
    const d = hypot(c.sp[1][0] - PL.x, c.sp[1][1] - PL.eye, c.sp[1][2] - PL.z); c.dcam = d;
    c.vis = sphereVisible(c.sp[1][0], c.sp[1][1], c.sp[1][2], 0.45 * c.scale);
    const k = min(1, (1.6 * c.scale) / max(d, 0.3)) * (c.fur > 0.02 ? 1.35 : 1);
    c.shells = clamp(round(MAXSH * k), LITE ? (d > 6 ? 2 : 4) : 6, 60); c.P[12] = c.shells;
  }
  Q.writeBuffer(bnBuf, 0, BND, 0, CATS.length * NB * 16); Q.writeBuffer(cpBuf, 0, CPD, 0, CATS.length * 24); Q.writeBuffer(ptBuf, 0, PTD);
  const ns = layoutProps();
  Q.writeBuffer(mdBuf, 0, MDD, 0, ns * 16);
  render();
  frame++;
}
function loop(now) {
  requestAnimationFrame(loop);
  const dt = clamp((now - last) / 1000, 0, 0.1); last = now;
  ftAvg += (dt * 1000 - ftAvg) * 0.05;
  if (++ftN > 40) { ftN = 0; scale = ftAvg > 19 ? max(0.35, scale - 0.1) : ftAvg < 13 && scale < 1 ? min(1, scale + 0.05) : scale; }
  const [fx, fy, fz] = tick(dt);
  if (SHOT) return; // ?shot draws only when grab() asks
  draw(fx, fy, fz);
  if (!info.hidden && frame % 15 === 0) info.textContent = `${(1000 / ftAvg).toFixed(0)} fps · ${RW}×${RH_} · ${CATS.filter((c) => c.vis).length} ${L_('gatti visibili', 'cats in view')}`;
}
info.hidden = true;
fitSize();
requestAnimationFrame(loop);
await say(L_('Pronto!', 'Ready!'), 1, 400);
try { localStorage.removeItem('catbarLoad'); } catch {}
body.className = 'm';
