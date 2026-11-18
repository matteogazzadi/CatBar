// ============================================================================
// life in the café: time of day and weather, friendship with the cats, photo mode, little messages
// ============================================================================
// `var` and function declarations on purpose: the frame loop is already running when these lines execute.
var DAYLEN = 12 * 60; // real seconds in one day at the café
var LIGHT0 = LIGHTS.map((l) => l.slice()); // the lights as authored
var MONTH = new Date().getMonth();

// ---------------------------------------------------------------- the sun, the moon and the weather
function updateDay(dt) {
  if (!LIGHT0) return; // this file has not run yet
  const S = SKY, hr = dt * 24 / DAYLEN;
  S.hour = (S.hour + hr) % 24;
  // weather: a new roll every 2-5 hours; snow mostly in winter
  S.next -= hr;
  if (S.next < 0) {
    S.next = rr(2, 5); const winter = MONTH === 11 || MONTH <= 1, r = rnd();
    S.kind = r < (winter ? 0.3 : 0.06) ? 'snow' : r < (winter ? 0.5 : 0.36) ? 'rain' : 'clear';
  }
  S.rain = damp(S.rain, S.kind === 'rain' ? 1 : 0, 0.25, dt); S.snow = damp(S.snow, S.kind === 'snow' ? 1 : 0, 0.25, dt);
  const h = S.hour, dayT = clamp((h - 6) / 14, 0, 1), daylight = sstep(5.5, 7.5, h) * (1 - sstep(19.5, 21, h)), cloud = max(S.rain * 0.85, S.snow * 0.65);
  S.day = daylight;
  // the sun crosses the front windows from right to left; at night the moon does the same, dimmer and blue
  const night = daylight < 0.5, nt = ((h + 4) % 24) / 10;
  const az = night ? mix(0.7, -0.7, clamp(nt, 0, 1)) : mix(0.85, -0.85, dayT), el = night ? 0.5 : 0.14 + 0.62 * sin(PI * dayT);
  const l = hypot(sin(az), el, cos(az)); SUN[0] = sin(az) / l; SUN[1] = el / l; SUN[2] = cos(az) / l;
  const warm = sstep(0.1, 0.5, el), k = night ? 1.2 * (1 - cloud) : 8 * (1 - cloud) * sstep(0.02, 0.15, el);
  const sc = night ? [0.24, 0.32, 0.55] : [1, mix(0.5, 0.82, warm), mix(0.25, 0.62, warm)];
  for (let i = 0; i < 3; i++) SUNC[i] = sc[i] * k * (night ? 1 - daylight * 2 : daylight);
  S.expo = mix(1.75, 1.45, daylight) + 0.15 * cloud * daylight;
  S.amb = mix(0.28, 0.8, daylight) * (1 + 0.25 * cloud * daylight);
  S.shaft = 0.016 * (night ? 0.6 : 1 + 0.8 * (1 - warm)) * (1 - cloud * 0.85);
  // lamps glow brighter at night, the bounce from the sun patches follows the sun
  const lamp = mix(2.1, 1, daylight), sunL = (SUNC[0] + SUNC[1] + SUNC[2]) / (3 * 6);
  LIGHT0.forEach((L, i) => {
    if (i >= 12) return;
    const o = i * 8;
    let f = 1, x = L[0], z = L[2];
    if (L[8] === 'lamp') f = lamp;
    else if (L[8] === 'bounce') { f = sunL * 1.6; const t = 1.6 / max(SUN[1], 0.1); x = clamp(L[9] - SUN[0] * t, -RX + 0.5, RX - 0.5); z = clamp(RZ - SUN[2] * t, -RZ + 0.5, RZ - 0.5); }
    else if (L[8] === 'sky') f = mix(0.12, 1, daylight) * (1 + 2.2 * cloud * daylight); // an overcast sky is a big soft light
    LT[o] = x; LT[o + 2] = z; LT[o + 4] = L[4] * f; LT[o + 5] = L[5] * f; LT[o + 6] = L[6] * f;
  });
  // redraw the room's shadows when the sun has moved enough
  S.shadowT -= dt;
  if (S.shadowT <= 0 && hypot(SUN[0] - S.sx, SUN[1] - S.sy, SUN[2] - S.sz) > 0.004) {
    S.shadowT = LITE ? 5 : 1.2; S.sx = SUN[0]; S.sy = SUN[1]; S.sz = SUN[2];
    computeSun(); drawStaticShadow();
  }
  if (typeof setRain === 'function') setRain(S.rain);
  // the clock next to the coins
  if (frame % 15 === 0) {
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    $('clk').textContent = `${S.kind === 'rain' ? '🌧' : S.kind === 'snow' ? '❄️' : daylight > 0.5 ? (h > 17.5 ? '🌇' : '☀️') : '🌙'} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
}

// ---------------------------------------------------------------- friendship: 0-5 hearts per cat
function loveOf(c) { return (SAVE && SAVE.love && SAVE.love[c.name]) || 0; }
function hearts(c) { const n = Math.floor(loveOf(c)); return '♥'.repeat(n) + '♡'.repeat(5 - n); }
var LOVE_MSG = [null, ['ti riconosce', 'knows you'], ['ti segue in giro', 'follows you around'], ['ti porta dei regali', 'brings you gifts'],
  ['ti dà una moneta in più', 'gives you an extra coin'], ['è il tuo migliore amico!', 'is your best friend!']];
function addLove(c, v) {
  if (!SAVE) return;
  SAVE.love = SAVE.love || {};
  const a = loveOf(c), b = min(5, a + v); SAVE.love[c.name] = b; saveItems();
  if (Math.floor(b) > Math.floor(a)) {
    const n = Math.floor(b);
    toast(`${c.name} ${'♥'.repeat(n)} · ${L_(LOVE_MSG[n][0], LOVE_MSG[n][1])}`);
    c.meowT = 0.2; c.joy = min(1, c.joy + 0.2);
  }
}
// cats who love you come over with a present now and then
var GIFT_T = rr(60, 120);
setInterval(() => {
  if (!inGame() || SHOPOPEN) return;
  GIFT_T -= 1;
  if (GIFT_T > 0) return;
  GIFT_T = rr(120, 220);
  const pool = CATS.filter((c) => !c.gone && !c.perch && c.st !== 'sleep' && loveOf(c) >= 3);
  if (pool.length) { const c = pick(pool); c.gift = true; c.st = 'beg'; c.goal = [PL.x, PL.z]; c.pose = STAND; c.tm = 25; c.mood = 1; }
}, 1000);
function giveGift(c) {
  c.gift = false;
  const n = 5 + ((rnd() * 11) | 0);
  setCoins(coins + n);
  toast(L_(`🎁 ${c.name} ti ha portato un regalo! +${n}`, `🎁 ${c.name} brought you a present! +${n}`));
  if (typeof coinSound === 'function') coinSound();
}

// ---------------------------------------------------------------- little messages
var toastT = 0;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.hidden = false; t.classList.remove('in'); void t.offsetWidth; t.classList.add('in');
  clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 4200);
}

// ---------------------------------------------------------------- photo mode
var FILTERS = [['Normale', 'Normal'], ['Caldo', 'Warm'], ['Bianco e nero', 'B&W'], ['Vintage', 'Vintage'], ['Sogno', 'Dreamy']];
function photoMode(on) {
  if (on && (!inGame() || SHOPOPEN)) return;
  PHOTO.on = on; body.classList.toggle('ph', on);
  if (on) { try { document.exitPointerLock(); } catch {} renderPhotoBar(); }
}
function renderPhotoBar() {
  $('phF').innerHTML = FILTERS.map((f, i) => `<button data-f=${i} class=${PHOTO.filter === i ? 'on' : ''}>${IT ? f[0] : f[1]}</button>`).join('');
}
// called by the frame loop right after a frame is drawn, while the canvas still holds it
function takePhoto() {
  PHOTO.req = false;
  canvas.toBlob((b) => {
    if (!b) return;
    const url = URL.createObjectURL(b);
    PHOTO.blob = b; PHOTO.name = `cat-bar-${Date.now()}.png`;
    $('phImg').src = url; const a = $('phSave'); a.href = url; a.download = PHOTO.name;
    $('phPrev').hidden = false;
    if (typeof coinSound === 'function') coinSound();
  }, 'image/png');
}
$('phF').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { PHOTO.filter = +b.dataset.f; renderPhotoBar(); } });
$('phShot').onclick = () => { $('flash').classList.remove('go'); void $('flash').offsetWidth; $('flash').classList.add('go'); PHOTO.req = true; };
$('phX').onclick = () => photoMode(false);
$('phClose').onclick = () => { $('phPrev').hidden = true; };
// inside claude.ai a page may not download on its own: there the viewer is asked to save through the platform
var DLS = null;
if (window.claude && window.claude.use) window.claude.use('downloads').then((d) => { DLS = d; }).catch(() => {});
$('phSave').addEventListener('click', (e) => {
  if (!DLS || !PHOTO.blob) return; // a plain link download everywhere else
  e.preventDefault();
  DLS.save({ filename: PHOTO.name, data: PHOTO.blob }).then(() => toast(L_('Foto salvata!', 'Photo saved!'))).catch((er) => { if (er && er.code !== 'declined') toast(L_('Qui non posso salvare: tieni premuta la foto per salvarla.', 'Saving is not available here: long-press the photo to save it.')); });
});
$('camBtn').onclick = () => photoMode(true);
addEventListener('keydown', (e) => {
  if (e.code === 'KeyP' && inGame() && !SHOPOPEN) photoMode(!PHOTO.on);
  if (e.code === 'Escape' && PHOTO.on) photoMode(false);
  if (e.code === 'Space' && PHOTO.on) $('phShot').click();
});
