// ============================================================================
// running the café: its level, customers and the coffee machine, adoptions, furniture
// ============================================================================
// `var` and function declarations on purpose: the frame loop is already running when these lines execute.
var CAFE_READY = false;
SAVE.xp = SAVE.xp || 0; SAVE.furn = SAVE.furn || []; SAVE.furnInv = SAVE.furnInv || []; SAVE.adopted = SAVE.adopted || []; SAVE.strays = SAVE.strays || [];

// ---------------------------------------------------------------- level
var LEVELS = [0, 30, 80, 160, 280, 450, 700, 1000, 1400, 2000];
var UNLOCK = {
  2: ['Arredamento nel negozio', 'Furniture in the shop'], 3: ['Due clienti alla volta e le adozioni', 'Two customers at a time, and adoptions'],
  4: ['Mance più ricche', 'Bigger tips'], 5: ['Tre clienti alla volta', 'Three customers at a time'], 6: ['Mance ancora più ricche', 'Even bigger tips'],
};
function cafeLevel() { let l = 1; while (l < LEVELS.length && SAVE.xp >= LEVELS[l]) l++; return l; }
function addXP(n) {
  const a = cafeLevel(); SAVE.xp += n; saveItems(); const b = cafeLevel();
  if (b > a) { toast(L_(`⭐ Il Cat Bar è salito al livello ${b}!`, `⭐ Cat Bar reached level ${b}!`) + (UNLOCK[b] ? ' · ' + L_(UNLOCK[b][0], UNLOCK[b][1]) : '')); if (typeof coinSound === 'function') coinSound(); }
  showLevel();
}
function showLevel() {
  const l = cafeLevel(), lo = LEVELS[l - 1], hi = LEVELS[l] ?? lo + 1;
  $('lvl').textContent = '⭐' + l; $('lvl').style.setProperty('--p', l >= LEVELS.length ? 1 : (SAVE.xp - lo) / (hi - lo));
}
$('lvl').onclick = () => {
  const l = cafeLevel(), nx = LEVELS[l];
  toast(L_(`Livello ${l} del locale`, `Café level ${l}`) + (nx ? ` · ${SAVE.xp}/${nx} XP` : '') + (UNLOCK[l + 1] ? ' · ' + L_('prossimo: ', 'next: ') + L_(UNLOCK[l + 1][0], UNLOCK[l + 1][1]) : ''));
};

// ---------------------------------------------------------------- customers
var NAMES = ['Marta', 'Luca', 'Giulia', 'Paolo', 'Sofia', 'Marco', 'Elena', 'Andrea', 'Chiara', 'Davide', 'Anna', 'Matteo', 'Sara', 'Giorgio', 'Irene', 'Tommaso'];
var ORDERS = [ // name it/en, icon, price, steps
  ['Espresso', 'Espresso', '☕', 3, 2], ['Cappuccino', 'Cappuccino', '🥛', 4, 3], ['Tè', 'Tea', '🍵', 4, 2], ['Cioccolata', 'Hot chocolate', '🍫', 5, 3],
];
var STEPS = [['Macina il caffè', 'Grind the coffee'], ['Estrai', 'Pull the shot'], ['Monta il latte', 'Steam the milk']];
var DOOR = [RX - 0.5, 3.1], MACHINE = [-2.4, -3.6]; // the spot in front of the espresso machine, behind the counter
var CUST = [], spawnT = 20, HOLD = null;
function steerTo(o, gx, gz, dt, speed, stop) {
  const dx = gx - o.x, dz = gz - o.z, d = hypot(dx, dz);
  if (d < stop) return true;
  let ux = dx / d, uz = dz / d;
  for (const c of COL) {
    if (c === o.seatCol) continue;
    let vx, vz, e;
    if (d < 0.9) break; // the last steps go straight to the chair
    if (c.r !== undefined) { if (hypot(c.x - gx, c.z - gz) < c.r + 0.35) continue; vx = o.x - c.x; vz = o.z - c.z; e = hypot(vx, vz) - c.r - 0.25; }
    else { vx = o.x - clamp(o.x, c.x0, c.x1); vz = o.z - clamp(o.z, c.z0, c.z1); e = hypot(vx, vz) - 0.25; }
    const l = hypot(vx, vz) || 1;
    if (e < 0.4) { const k = (0.4 - e) * 2.5; ux += (vx / l) * k - (vz / l) * k * 0.7; uz += (vz / l) * k + (vx / l) * k * 0.7; }
  }
  const want = atan2(-uz, ux); o.yaw += clamp(wrapA(want - o.yaw), -4 * dt, 4 * dt);
  o.x += cos(o.yaw) * speed * dt; o.z -= sin(o.yaw) * speed * dt; o.x = clamp(o.x, -RX + 0.25, RX - 0.25); o.z = clamp(o.z, -RZ + 0.25, RZ - 0.25);
  o.walk += speed * dt * 6;
  return false;
}
function spawnCustomer() {
  const free = SEATS.filter((s) => !CUST.some((c) => c.seat === s));
  if (!free.length) return;
  const seat = pick(free), ord = pick(ORDERS);
  const c = { name: pick(NAMES), seat, ord, x: DOOR[0], z: DOOR[1], yaw: PI, st: 'enter', sit: 0, walk: 0, patience: 150, t: 0, skin: (rnd() * 4) | 0, shirt: (rnd() * 6) | 0, hair: (rnd() * 5) | 0, el: null, ask: null };
  c.el = document.createElement('button'); c.el.className = 'cust'; c.el.hidden = true; document.body.appendChild(c.el);
  c.el.onclick = () => interactCustomer(c);
  CUST.push(c);
}
function interactCustomer(c) {
  if (c.st === 'wait' && HOLD && HOLD.cust === c) return serve(c);
  if (c.st === 'wait' && !HOLD) return toast(L_(`${c.name} vorrebbe: ${c.ord[2]} ${c.ord[0]}. Preparalo alla macchina del caffè!`, `${c.name} would like: ${c.ord[2]} ${c.ord[1]}. Make it at the coffee machine!`));
  if (c.st === 'wait' && HOLD) return toast(L_(`Questo è per ${HOLD.cust.name}!`, `That one is for ${HOLD.cust.name}!`));
  if (c.ask) return askAdopt(c);
}
function serve(c) {
  const q = HOLD.q; HOLD = null; $('hold').hidden = true;
  const lv = cafeLevel(), joy = CATS.filter((k) => !k.gone).reduce((s, k) => s + k.joy, 0) / max(1, CATS.filter((k) => !k.gone).length);
  const pay = Math.round(c.ord[3] * (0.6 + 0.8 * q) * (1 + 0.1 * (lv - 1)) + joy * 3);
  setCoins(coins + pay); addXP(10 + (q > 0.8 ? 5 : 0));
  c.st = 'enjoy'; c.t = rr(22, 35); c.happy = q;
  toast(L_(`${c.name}: «${q > 0.8 ? 'Perfetto!' : q > 0.5 ? 'Buono, grazie!' : 'Mmh… grazie.'}» +${pay}`, `${c.name}: “${q > 0.8 ? 'Perfect!' : q > 0.5 ? 'Nice, thanks!' : 'Hmm… thanks.'}” +${pay}`));
  if (typeof coinSound === 'function') coinSound();
  // a happy customer may fall for one of the cats
  if (lv >= 3 && rnd() < 0.4) {
    const pool = CATS.filter((k) => !k.gone && !k.special && !k.perch && loveOf(k) >= 2 && k.joy > 0.6 && !CUST.some((o) => o.ask === k));
    if (pool.length) c.ask = pick(pool);
  }
}
function updateCafe(dt) {
  if (!CAFE_READY) return;
  const lv = cafeLevel(), open = SKY.hour > 7.5 && SKY.hour < 21, max_ = lv >= 5 ? 3 : lv >= 3 ? 2 : 1;
  spawnT -= dt;
  if (spawnT < 0 && inGame()) { spawnT = rr(45, 90); if (open && CUST.length < max_) spawnCustomer(); }
  for (const c of CUST) {
    c.t -= dt;
    if (c.st === 'enter') { if (steerTo(c, c.seat.x, c.seat.z, dt, 0.9, 0.12)) { c.st = 'sitdown'; c.x = c.seat.x; c.z = c.seat.z; } }
    else if (c.st === 'sitdown') { c.sit = min(1, c.sit + dt * 2); c.yaw += wrapA(c.seat.yaw - c.yaw) * min(1, dt * 6); if (c.sit >= 1) { c.st = 'wait'; c.meow = 0; } }
    else if (c.st === 'wait') { c.patience -= dt; if (c.patience < 0) { c.st = 'leave'; toast(L_(`${c.name} se n'è andato senza ordinare…`, `${c.name} left without being served…`)); if (HOLD && HOLD.cust === c) { HOLD = null; $('hold').hidden = true; } } }
    else if (c.st === 'enjoy') { if (c.t < 0 && !c.ask) c.st = 'leave'; if (c.t < -40) { c.ask = null; c.st = 'leave'; } }
    else if (c.st === 'leave') { c.sit = max(0, c.sit - dt * 2); if (c.sit <= 0 && steerTo(c, DOOR[0], DOOR[1], dt, 0.9, 0.25)) c.st = 'gone'; }
    // the adopted cat walks out with its new family
    if (c.cat) { const k = c.cat; k.st = 'adopted'; walkTo(k, c.x - cos(c.yaw) * 0.5, c.z + sin(c.yaw) * 0.5, dt, 1, 0.3); k.mood = 1; }
    bubble(c);
  }
  for (const c of CUST.filter((c) => c.st === 'gone')) {
    c.el.remove();
    if (c.cat) { c.cat.gone = true; letterLater(c, c.cat); }
  }
  CUST = CUST.filter((c) => c.st !== 'gone');
  // the coffee machine
  const nearM = hypot(PL.x - MACHINE[0], PL.z - MACHINE[1]) < 1.2, todo = CUST.find((c) => c.st === 'wait' && !(HOLD && HOLD.cust === c));
  $('brewBtn').hidden = !(nearM && todo && !HOLD && inGame() && !SHOPOPEN);
  // a ☕ over the machine while an order is waiting
  { const el = $('mTag'), x = -2.4, y = 1.62, z = -4.24, m = VPm, w = m[3] * x + m[7] * y + m[11] * z + m[15];
    const show = todo && !HOLD && !nearM && inGame() && !SHOPOPEN && !PHOTO.on && w > 0.2;
    el.hidden = !show;
    if (show) { const sx = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / w) * 0.5 + 0.5, sy = 0.5 - ((m[1] * x + m[5] * y + m[9] * z + m[13]) / w) * 0.5; el.style.transform = `translate(calc(${(sx * innerWidth).toFixed(1)}px - 50%), calc(${(sy * innerHeight).toFixed(1)}px - 100%))`; } }
  if (!$('brewBtn').hidden) $('brewBtn').textContent = `${todo.ord[2]} ${L_('Prepara', 'Make')} ${IT ? todo.ord[0] : todo.ord[1]}${mob ? '' : ' (R)'}`;
  $('cafeHint').hidden = !(CUST.some((c) => c.st === 'wait') && !HOLD && !nearM && inGame() && !SHOPOPEN && !PHOTO.on);
}
// a speech bubble over each customer: the order and their patience, a heart once served, a house for an adoption
function bubble(c) {
  const el = c.el, y = (c.sit ? 1.45 : 1.95), m = VPm, w = m[3] * c.x + m[7] * y + m[11] * c.z + m[15];
  const show = w > 0.2 && inGame() && !SHOPOPEN && !PHOTO.on && (c.st === 'wait' || c.ask || c.st === 'enjoy');
  el.hidden = !show; if (!show) return;
  const sx = ((m[0] * c.x + m[4] * y + m[8] * c.z + m[12]) / w) * 0.5 + 0.5, sy = 0.5 - ((m[1] * c.x + m[5] * y + m[9] * c.z + m[13]) / w) * 0.5;
  el.style.transform = `translate(calc(${(sx * innerWidth).toFixed(1)}px - 50%), calc(${(sy * innerHeight).toFixed(1)}px - 100%)) scale(${clamp(3.5 / max(w, 0.5), 0.6, 1.3).toFixed(2)})`;
  const html = c.ask ? `🏠 ${esc_(c.ask.name)}?` : c.st === 'wait' ? `${c.ord[2]}<i style="--p:${(c.patience / 150).toFixed(2)}"></i>` : '❤️';
  if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; }
  el.classList.toggle('mine', !!(HOLD && HOLD.cust === c));
}
// the people as props
var PM4 = M4(), PM5 = M4();
function layoutCafe(put) {
  if (!CAFE_READY) return;
  for (const c of CUST) {
    const s = c.sit, hipY = mix(0.92, 0.48, s), sw = s > 0.5 ? 0 : sin(c.walk) * 0.5;
    const root = (f) => { ident(PM4); tr(PM4, c.x, 0, c.z); ry(PM4, c.yaw); f(PM4); return PM4; };
    put('p_body' + c.shirt, root((m) => tr(m, -0.03 * s, hipY, 0)));
    put('p_head' + c.skin, root((m) => { tr(m, 0, hipY + 0.66, 0); rz(m, c.st === 'enjoy' ? sin(SKY.hour * 400) * 0.05 : 0); }));
    put('p_hair' + c.hair, root((m) => tr(m, 0, hipY + 0.66, 0)));
    for (const k of [-1, 1]) {
      put('p_arm' + c.shirt, root((m) => { tr(m, 0, hipY + 0.45, k * 0.21); rx(m, -k * 0.08); rz(m, s > 0.5 ? 0.9 * s : -sw * k * 0.7); }));
      const at = s > 0.5 ? (PI / 2) * s : sw * k, as = s > 0.5 ? 0 : min(0, sw * k) * 0.8;
      root((m) => { tr(m, 0.02 * s, hipY, k * 0.1); rz(m, at); }); PM5.set(PM4); put('p_thigh', PM4);
      tr(PM5, 0, -0.45, 0); rz(PM5, as - at); put('p_shin', PM5);
    }
    if (c.st === 'enjoy' || c.ask) { ident(PM4); tr(PM4, c.seat.x + cos(c.seat.yaw) * 0.32, 0.745, c.seat.z - sin(c.seat.yaw) * 0.32); put('p_cup', PM4); }
  }
  for (const f of SAVE.furn) { ident(PM4); tr(PM4, f.x, 0, f.z); ry(PM4, f.yaw); put(FURN.find((d) => d[0] === f.id)[1], PM4); }
  if (PLACE.on) { ident(PM4); tr(PM4, PLACE.x, 0, PLACE.z); ry(PM4, PLACE.yaw); put(PLACE.def[1], PM4); }
}
// the customer under the crosshair (desktop) or under a tap (phone)
function custAt(ox, oy, oz, dx, dy, dz) {
  let best = null, bt = 3;
  for (const c of CUST) {
    const y = c.sit ? 1.05 : 1.3, lx = c.x - ox, ly = y - oy, lz = c.z - oz, b = lx * dx + ly * dy + lz * dz, d2 = lx * lx + ly * ly + lz * lz - b * b;
    if (b > 0 && d2 < 0.5 * 0.5 && b < bt) { bt = b; best = c; }
  }
  return best;
}
function goMachine() { // walk behind the counter, in through its open right end
  const inside = PL.z < -3.05 && PL.z > -4.05;
  PL.goto = inside ? { x: MACHINE[0], z: MACHINE[1], cat: null, t: 0 } : { x: 0.15, z: -2.15, cat: null, t: 0, next: [[0.15, -3.55], MACHINE] };
}
function tapCafe(x, y) {
  if (PLACE.on) return true;
  const r = rayAt(x, y), c = custAt(PL.x, PL.eye, PL.z, r[0], r[1], r[2]);
  if (c) { interactCustomer(c); return true; }
  { // the espresso machine
    const lx = -2.4 - PL.x, ly = 1.2 - PL.eye, lz = -4.24 - PL.z, b = lx * r[0] + ly * r[1] + lz * r[2], d2 = lx * lx + ly * ly + lz * lz - b * b;
    if (b > 0 && d2 < 0.5 * 0.5) { if (hypot(PL.x - MACHINE[0], PL.z - MACHINE[1]) < 1.2) openBrew(); else goMachine(); return true; }
  }
  return false;
}

// ---------------------------------------------------------------- the coffee machine mini-game
var BREW = null;
function openBrew() {
  const c = CUST.find((c) => c.st === 'wait' && !(HOLD && HOLD.cust === c)); if (!c || HOLD) return;
  SHOPOPEN = true; try { document.exitPointerLock(); } catch {} body.className = 'g s';
  $('shop').classList.add('gm'); $('brew').hidden = false;
  BREW = { c, step: 0, q: [], x: 0, v: 0.9, zone: rr(0.25, 0.65), zw: 0.17, raf: 0, last: performance.now() };
  $('bT').textContent = `${c.ord[2]} ${IT ? c.ord[0] : c.ord[1]} ${L_('per', 'for')} ${c.name}`;
  $('bDone').hidden = true; $('bStop').hidden = false; brewStep();
  const frame = (now) => {
    if (!BREW) return; BREW.raf = requestAnimationFrame(frame);
    const dt = min((now - BREW.last) / 1000, 0.05); BREW.last = now;
    if (BREW.step < BREW.c.ord[4]) { BREW.x += BREW.v * dt; if (BREW.x > 1 || BREW.x < 0) { BREW.v = -BREW.v; BREW.x = clamp(BREW.x, 0, 1); } $('bMark').style.left = (BREW.x * 100).toFixed(1) + '%'; }
  };
  BREW.raf = requestAnimationFrame(frame);
}
function brewStep() {
  const B = BREW; $('bS').textContent = `${B.step + 1}/${B.c.ord[4]} · ${L_(STEPS[B.step][0], STEPS[B.step][1])}`;
  B.zone = rr(0.2, 0.7); B.zw = max(0.1, 0.2 - B.step * 0.03); B.v = (0.8 + B.step * 0.35) * (rnd() < 0.5 ? 1 : -1);
  $('bZone').style.left = (B.zone * 100) + '%'; $('bZone').style.width = (B.zw * 100) + '%';
}
function brewStop() {
  const B = BREW; if (!B || B.step >= B.c.ord[4]) return;
  const mid = B.zone + B.zw / 2, q = clamp(1 - abs(B.x - mid) / (B.zw / 2 + 0.25), 0, 1);
  B.q.push(abs(B.x - mid) <= B.zw / 2 ? max(q, 0.85) : q * 0.7);
  B.step++;
  if (B.step < B.c.ord[4]) brewStep();
  else {
    const qq = B.q.reduce((a, b) => a + b, 0) / B.q.length, st = qq > 0.85 ? 3 : qq > 0.55 ? 2 : 1;
    $('bS').textContent = '⭐'.repeat(st) + '☆'.repeat(3 - st) + ' · ' + L_(st === 3 ? 'Perfetto!' : st === 2 ? 'Buono' : 'Si può fare meglio', st === 3 ? 'Perfect!' : st === 2 ? 'Good' : 'Could be better');
    $('bStop').hidden = true; $('bDone').hidden = false; B.qq = qq;
  }
}
function closeBrew(serveIt) {
  if (!BREW) return;
  cancelAnimationFrame(BREW.raf);
  if (serveIt && BREW.qq !== undefined) { HOLD = { cust: BREW.c, q: BREW.qq }; $('hold').hidden = false; $('hold').textContent = `${BREW.c.ord[2]} → ${BREW.c.name}`; }
  BREW = null; $('brew').hidden = true; $('shop').classList.remove('gm'); closeShop();
}
$('brewBtn').onclick = openBrew;
$('mTag').onclick = goMachine;
$('bStop').onclick = brewStop;
$('bDone').onclick = () => closeBrew(true);
$('bX').onclick = () => closeBrew(false);

// ---------------------------------------------------------------- adoptions
function askAdopt(c) {
  const k = c.ask;
  SHOPOPEN = true; try { document.exitPointerLock(); } catch {} body.className = 'g s';
  $('shop').classList.add('gm'); $('adopt').hidden = false;
  $('aT').textContent = L_(`${c.name} vorrebbe adottare ${k.name}`, `${c.name} would like to adopt ${k.name}`);
  $('aP').textContent = L_(`${k.name} è felice e ti vuole bene: avrà una casa tutta sua e tu riceverai 60 monete. Un nuovo gattino arriverà presto al Cat Bar.`, `${k.name} is happy and loves you: it will have a home of its own and you get 60 coins. A new kitten will soon come to the Cat Bar.`);
  $('aYes').onclick = () => {
    c.cat = k; c.ask = null; c.st = 'leave'; c.t = 0; k.perch = null; k.y = 0;
    SAVE.adopted.push(k.name); saveItems(); setCoins(coins + 60); addXP(25);
    if (typeof coinSound === 'function') coinSound(); closeAdopt();
    toast(L_(`${k.name} va a casa con ${c.name} 🏠`, `${k.name} goes home with ${c.name} 🏠`));
  };
  $('aNo').onclick = () => { c.ask = null; closeAdopt(); };
}
function closeAdopt() { $('adopt').hidden = true; $('shop').classList.remove('gm'); closeShop(); }
function letterLater(c, k) {
  setTimeout(() => {
    $('lT').textContent = L_(`📬 Una lettera da ${c.name}`, `📬 A letter from ${c.name}`);
    $('lP').textContent = L_(`Caro Cat Bar, ${k.name} sta benissimo! Dorme sul divano, ha già rotto due vasi e ci sveglia ogni mattina con una testata. Grazie di tutto. ❤️`, `Dear Cat Bar, ${k.name} is doing great! Sleeps on the sofa, has already broken two vases and wakes us every morning with a head-bump. Thank you for everything. ❤️`);
    $('letter').hidden = false;
  }, 60000);
  setTimeout(() => arriveStray(true), 90000);
}
$('lOk').onclick = () => { $('letter').hidden = true; };
// a stray kitten or cat comes in to take the free spot
var STRAY_NAMES = ['Ciuffo', 'Pallino', 'Gnocco', 'Trilli', 'Birba', 'Fagiolo', 'Peperone', 'Nuvoletta', 'Polvere', 'Liquirizia', 'Pistacchio', 'Tortellino'];
function makeStray() {
  const typ = pick([0, 1, 1, 2, 3, 5]), base = pick([0x9c8466, 0xe39445, 0x7c8088, 0x151313, 0xf2efe8, 0xc06a2a, 0xa8a8a8]);
  return { name: pick(STRAY_NAMES.filter((n) => !CATS.some((c) => c.name === n))) || 'Micio', typ, base, sec: pick([0x2a2016, 0xa8521c, 0x38383a, 0x4a3226]),
    white: pick([0, 0, 0.3, 0.5]), eye: pick([0xb8c040, 0xd09030, 0x6ab0d0, 0xe0c040]), fur: rr(0.009, 0.02), scale: rr(0.62, 1.05), third: 0x1a1412 };
}
function addStray(d, entrance) {
  const c = addCat(d.name, L_('Trovatello', 'Stray'), d.typ, d.base, d.sec, d.white, d.eye, d.fur, d.scale, d.third, 1, 0);
  if (!c) return;
  if (entrance) { c.x = DOOR[0]; c.z = DOOR[1]; c.yaw = PI; c.st = 'walk'; c.goal = randFree(0.4); c.tm = 20; c.pose = STAND; toast(L_(`🐾 È arrivato ${c.name}, un trovatello!`, `🐾 ${c.name}, a stray, has arrived!`)); }
  else { const [x, z] = randFree(0.4); c.x = x; c.z = z; decide(c); }
  c.pw.fill(0); c.pw[c.pose] = 1; pose(c, 0); refreshAcc(c);
}
function arriveStray(entrance) { const d = makeStray(); SAVE.strays.push(d); saveItems(); addStray(d, entrance); }

// ---------------------------------------------------------------- furniture
var FURN = [ // id, mesh, price, icon, it, en, kind, radius, perch height
  ['bed', 'f_bed', 20, '🛏', 'Cuccia', 'Cat bed', 'bed', 0.3, 0], ['igloo', 'f_igloo', 35, '⛺', 'Cuccia igloo', 'Igloo bed', 'bed', 0.32, 0],
  ['tree', 'f_tree', 45, '🌲', 'Tiragraffi con cuccia', 'Cat tree', 'perch', 0.3, 0.7], ['arm', 'f_arm', 40, '🛋', 'Poltrona', 'Armchair', 'perch', 0.42, 0.5],
  ['plant', 'f_plant', 18, '🪴', 'Pianta grande', 'Big plant', 'decor', 0.22, 0], ['rug', 'f_rug', 22, '⭕', 'Tappeto tondo', 'Round rug', 'rug', 0, 0],
];
var PLACE = { on: false, def: null, idx: -1, x: 0, z: 0, yaw: 0 };
var FREF = { beds: [], perches: [], cols: [] };
function applyFurn() { // furniture adds beds, perches and colliders
  for (const b of FREF.beds) BEDS.splice(BEDS.indexOf(b), 1);
  for (const p of FREF.perches) { PERCH.splice(PERCH.indexOf(p), 1); for (const c of CATS) if (c.perch === p) { c.perch = null; c.y = 0; } }
  for (const c of FREF.cols) COL.splice(COL.indexOf(c), 1);
  FREF = { beds: [], perches: [], cols: [] };
  for (const f of SAVE.furn) {
    const d = FURN.find((x) => x[0] === f.id); if (!d) continue;
    if (d[6] === 'bed') { const b = { x: f.x, z: f.z }; BEDS.push(b); FREF.beds.push(b); }
    if (d[6] === 'perch') { const p = { x: f.x + (d[0] === 'arm' ? cos(f.yaw) * 0.05 : 0), y: d[8], z: f.z - (d[0] === 'arm' ? sin(f.yaw) * 0.05 : 0), yaw: f.yaw + PI / 2, sleep: 0.7, furn: true }; PERCH.push(p); FREF.perches.push(p); }
    if (d[6] !== 'rug' && d[6] !== 'bed') { const c = { x: f.x, z: f.z, r: d[7], cat: true }; COL.push(c); FREF.cols.push(c); }
  }
}
function startPlace(def, idx) {
  PLACE.on = true; PLACE.def = def; PLACE.idx = idx; PLACE.yaw = idx >= 0 ? SAVE.furn[idx].yaw : PL.yaw + PI / 2;
  if (idx >= 0) { SAVE.furn.splice(idx, 1); applyFurn(); }
  closeShop(); body.classList.add('pl'); $('plName').textContent = `${def[3]} ${IT ? def[4] : def[5]}`;
}
function updatePlace() {
  if (!PLACE.on) return;
  const cp = cos(PL.pitch), fy = sin(PL.pitch);
  if (fy < -0.05) { const t = min(4, -PL.eye / fy); PLACE.x = clamp(PL.x + sin(PL.yaw) * cp * t, -RX + 0.4, RX - 0.4); PLACE.z = clamp(PL.z - cos(PL.yaw) * cp * t, -RZ + 0.4, RZ - 0.4); }
  else { PLACE.x = clamp(PL.x + sin(PL.yaw) * 1.5, -RX + 0.4, RX - 0.4); PLACE.z = clamp(PL.z - cos(PL.yaw) * 1.5, -RZ + 0.4, RZ - 0.4); }
  PLACE.ok = PLACE.def[6] === 'rug' || freeAt(PLACE.x, PLACE.z, max(0.15, PLACE.def[7] * 0.8));
  $('plOk').disabled = !PLACE.ok;
}
function confirmPlace() {
  if (!PLACE.on || !PLACE.ok) return;
  SAVE.furn.push({ id: PLACE.def[0], x: +PLACE.x.toFixed(2), z: +PLACE.z.toFixed(2), yaw: +PLACE.yaw.toFixed(2) }); saveItems(); applyFurn();
  PLACE.on = false; body.classList.remove('pl'); addXP(3);
  toast(L_('Sistemato! I gatti lo noteranno presto.', 'Placed! The cats will notice soon.'));
}
function cancelPlace() {
  if (!PLACE.on) return;
  if (PLACE.idx >= 0) { SAVE.furn.push({ id: PLACE.def[0], x: PLACE.ox, z: PLACE.oz, yaw: PLACE.yaw }); applyFurn(); } // a move that was cancelled puts it back
  else { SAVE.furnInv = (SAVE.furnInv || []).concat(PLACE.def[0]); } // bought but not placed: keep it for later
  saveItems(); PLACE.on = false; body.classList.remove('pl');
}
$('plOk').onclick = confirmPlace; $('plRot').onclick = () => { PLACE.yaw += PI / 4; }; $('plX').onclick = cancelPlace;
function renderFurn(B) {
  const lv = cafeLevel();
  if (lv < 2) { B.innerHTML = `<p class=count>${L_("🔒 L'arredamento si sblocca al livello 2 del locale. Servi i clienti e accarezza i gatti per salire di livello!", '🔒 Furniture unlocks at café level 2. Serve customers and pet the cats to level up!')}</p>`; return; }
  const inv = SAVE.furnInv || [];
  B.innerHTML = `<p class=count>${L_('Compra un mobile e scegli dove metterlo guardando il pavimento. Le cucce e i tiragraffi piacciono tantissimo ai gatti.', 'Buy a piece and choose where it goes by looking at the floor. The cats love beds and cat trees.')}</p><div class=grid>` + FURN.map((d) => {
    const have = inv.includes(d[0]);
    return `<div class=item><span class=ico>${d[3]}</span><b>${esc_(IT ? d[4] : d[5])}</b><p>${L_({ bed: 'Cuccia per dormire', perch: 'Un posto in alto', decor: 'Decorazione', rug: 'Tappeto' }[d[6]], { bed: 'A bed to sleep in', perch: 'A high spot', decor: 'Decoration', rug: 'Rug' }[d[6]])}</p>${have ? `<button data-place=${d[0]}>${L_('Posiziona', 'Place')}</button>` : `<button data-furn=${d[0]} ${coins < d[2] ? 'disabled' : ''}><span class=coin></span> ${d[2]}</button>`}</div>`;
  }).join('') + '</div>' + (SAVE.furn.length ? `<p class=count style="margin-top:1em">${L_('Nel locale', 'In the café')}:</p><div class=grid>` + SAVE.furn.map((f, i) => { const d = FURN.find((x) => x[0] === f.id); return `<div class=item><span class=ico>${d[3]}</span><b>${esc_(IT ? d[4] : d[5])}</b><button data-move=${i}>${L_('Sposta', 'Move')}</button></div>`; }).join('') + '</div>' : '');
}
$('shBody').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.furn) { const d = FURN.find((x) => x[0] === b.dataset.furn); if (coins >= d[2]) { setCoins(coins - d[2]); if (typeof coinSound === 'function') coinSound(); startPlace(d, -1); } }
  if (b.dataset.place) { const d = FURN.find((x) => x[0] === b.dataset.place); SAVE.furnInv.splice(SAVE.furnInv.indexOf(d[0]), 1); startPlace(d, -1); }
  if (b.dataset.move) { const i = +b.dataset.move, f = SAVE.furn[i]; PLACE.ox = f.x; PLACE.oz = f.z; startPlace(FURN.find((x) => x[0] === f.id), i); }
});

// ---------------------------------------------------------------- input
addEventListener('keydown', (e) => {
  if (!inGame()) return;
  if (e.code === 'KeyR' && !SHOPOPEN) {
    if (!$('brewBtn').hidden) openBrew();
    else { const cp = cos(PL.pitch), c = custAt(PL.x, PL.eye, PL.z, sin(PL.yaw) * cp, sin(PL.pitch), -cos(PL.yaw) * cp) || CUST.find((c) => hypot(c.x - PL.x, c.z - PL.z) < 1.6 && (c.ask || (HOLD && HOLD.cust === c))); if (c) interactCustomer(c); }
  }
  if (BREW && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); if (!$('bStop').hidden) brewStop(); else closeBrew(true); }
  if (PLACE.on) { if (e.code === 'Enter') confirmPlace(); if (e.code === 'KeyQ') PLACE.yaw += PI / 4; if (e.code === 'Escape') cancelPlace(); }
  if (e.code === 'Escape' && BREW) closeBrew(false);
});
canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || !inGame() || SHOPOPEN) return;
  if (PLACE.on) { confirmPlace(); return; }
  const cp = cos(PL.pitch), c = custAt(PL.x, PL.eye, PL.z, sin(PL.yaw) * cp, sin(PL.pitch), -cos(PL.yaw) * cp);
  if (c) interactCustomer(c);
});

// ---------------------------------------------------------------- what earlier visits left behind
for (const n of SAVE.adopted) { const c = CATS.find((k) => k.name === n); if (c) { c.gone = true; c.perch = null; } }
for (const d of SAVE.strays) addStray(d, false);
applyFurn(); showLevel();
CAFE_READY = true;
