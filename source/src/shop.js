// ============================================================================
// shop: toys for the cats, card packs with special cats, and the collection
// ============================================================================
// Coins come from petting (main.js). Everything bought is remembered in localStorage.catbarItems.
// `var` on purpose: the frame loop is already running when this file's lines execute.
var SHOPOPEN = false;
var SAVE = { yarn: 0, mouse: 0, box: 0, nip: 0, laser: false, cats: [], snack: 0, brush: false, food: 0.6, water: 0.7, acc: [], wear: {} };
try { Object.assign(SAVE, JSON.parse(localStorage.catbarItems || '{}')); } catch {}
var saveItems = () => keep('catbarItems', JSON.stringify(SAVE));
var CARE = [
  { id: 'kibble', price: 5, icon: '🥣', it: ['Crocchette', 'Riempie la ciotola del cibo.'], en: ['Kibble', 'Fills up the food bowl.'] },
  { id: 'water', price: 2, icon: '💧', it: ['Acqua fresca', 'Riempie la ciotola dell\'acqua.'], en: ['Fresh water', 'Fills up the water bowl.'] },
  { id: 'snack', price: 6, icon: '🐟', it: ['Snack al tonno ×3', 'Tasto F guardando un gatto: tanta felicità.'], en: ['Tuna treats ×3', 'Press F looking at a cat: pure joy.'] },
  { id: 'brush', price: 30, icon: '🪮', once: true, it: ['Spazzola', 'Le coccole rendono felici il doppio più in fretta.'], en: ['Brush', 'Petting makes cats happy twice as fast.'] },
];
var ITEMS = [
  { id: 'yarn', price: 8, icon: '🧶', it: ['Gomitolo', 'Rotola, rimbalza, si insegue.'], en: ['Ball of yarn', 'It rolls, bounces and gets chased.'] },
  { id: 'mouse', price: 15, icon: '🐭', it: ['Topolino a carica', 'Scappa da solo a zig-zag.'], en: ['Wind-up mouse', 'Scurries off on its own.'] },
  { id: 'box', price: 20, icon: '📦', it: ['Scatola di cartone', 'Il posto preferito di ogni gatto.'], en: ['Cardboard box', "Every cat's favourite spot."] },
  { id: 'nip', price: 25, icon: '🌿', it: ["Cuscino all'erba gatta", 'Rotolate a pancia in su e corse pazze.'], en: ['Catnip cushion', 'Belly-up rolling, then zoomies.'] },
  { id: 'laser', price: 40, icon: '🔴', once: true, it: ['Puntatore laser', 'Tasto L: i gatti inseguono il puntino.'], en: ['Laser pointer', 'Press L: the cats chase the dot.'] },
];
var PACKS = [
  { id: 'classic', price: 25, odds: [55, 30, 12, 3], tag: null, it: ['Pacchetto Classico', '3 carte · tutti i gatti speciali'], en: ['Classic Pack', '3 cards · every special cat'] },
  { id: 'xmas', price: 45, odds: [0, 62, 30, 8], tag: 'xmas', it: ['Pacchetto di Natale', '3 carte · solo gatti natalizi, almeno Rari'], en: ['Christmas Pack', '3 cards · festive cats only, Rare or better'] },
];
var REFUND = [3, 6, 12, 25];
var ACC_ICON = { santa: '🎅', elf: '🧝', witch: '🧙', crown: '👑', halo: '😇', antlers: '🦌', scarf: '🧣', bow: '🎀', bell: '🔔' };
var shopTab = 'toys';
// things to wear: [id, slot, price (0 = only from mini-games), icon, it, en]
var WEAR = [
  ['beanie', 'head', 12, '🧢', 'Berretto di lana', 'Wool beanie'], ['tophat', 'head', 18, '🎩', 'Cilindro', 'Top hat'],
  ['earbow', 'head', 8, '🎀', "Fiocco sull'orecchio", 'Ear bow'], ['flowers', 'head', 15, '🌸', 'Coroncina di fiori', 'Flower crown'],
  ['santa', 'head', 20, '🎅', 'Cappello di Natale', 'Santa hat'], ['elf', 'head', 16, '🧝', 'Cappello da elfo', 'Elf hat'],
  ['witch', 'head', 16, '🧙', 'Cappello da strega', 'Witch hat'], ['antlers', 'head', 22, '🦌', 'Corna da renna', 'Reindeer antlers'],
  ['crown', 'head', 60, '👑', 'Corona', 'Crown'], ['sunglasses', 'face', 0, '🕶', 'Occhiali da sole', 'Sunglasses'],
  ['halo', 'head', 0, '😇', 'Aureola', 'Halo'],
  ['bell', 'neck', 6, '🔔', 'Campanellino', 'Little bell'], ['bow', 'neck', 6, '🎀', 'Papillon', 'Bow tie'],
  ['bandana', 'neck', 8, '🟥', 'Bandana', 'Bandana'], ['heart', 'neck', 14, '💛', 'Medaglietta a cuore', 'Heart tag'],
  ['pearls', 'neck', 20, '📿', 'Collana di perle', 'Pearl necklace'], ['scarf', 'neck', 12, '🧣', 'Sciarpa', 'Scarf'],
  ['sweater', 'body', 25, '🧶', 'Maglioncino', 'Sweater'], ['cape', 'body', 30, '🦸', 'Mantello da supereroe', 'Superhero cape'],
  ['tutu', 'body', 20, '🩰', 'Tutù', 'Tutu'],
];
var wearCat = null; // the cat being dressed in the wardrobe
var slotOf = (id) => (WEAR.find((w) => w[0] === id) || [0, 'head'])[1];
// what a cat wears: its own accessories (special cats), with the clothes you put on it taking their slots
function refreshAcc(c) {
  const worn = SAVE.wear[c.name] || [], base = (c.special ? c.special[17] : []).filter((a) => !worn.some((w) => slotOf(w) === slotOf(a)));
  c.acc = [...base, ...worn];
}

// a free spot on the floor in front of the player (or anywhere, when loading a save)
function spotAhead(dist) {
  for (let k = 0; k < 30; k++) {
    const a = PL.yaw + rr(-0.5, 0.5) * (k / 10), d = dist + rr(0, 0.4) * (k / 10);
    const x = PL.x + sin(a) * d, z = PL.z - cos(a) * d;
    if (freeAt(x, z, 0.25)) return [x, z];
  }
  return randFree(0.3);
}
function placeItem(id, x, z) {
  if (x === undefined) [x, z] = spotAhead(0.9);
  if (id === 'yarn') addToy('yarn', x, z, 'yarn' + ((rnd() * YARNC.length) | 0));
  else if (id === 'mouse') addToy('mouse', x, z).wind = 4;
  else if (id === 'box') { const b = { x, z, yaw: rr(0, TAU) }; BOXES.push(b); COL.push({ x, z, r: 0.26, cat: false }); }
  else if (id === 'nip') {
    NIPS.push({ x, z, yaw: rr(0, TAU) });
    for (const c of CATS) if (!c.perch && c.st !== 'sleep' && c.pet <= 0 && hypot(c.x - x, c.z - z) < 4) { c.st = 'walk'; c.goal = [x, z]; c.next = 'nip'; c.pose = STAND; c.tm = 25; }
  }
}
function spawnSpecial(id, entrance) {
  const c = addSpecial(id); if (!c) return null;
  if (entrance) { c.x = RX - 0.6; c.z = 3.1; c.yaw = PI; c.st = 'walk'; c.goal = [RX - 2.2, 2.6]; c.next = null; c.tm = 20; c.mood = 1; c.pose = STAND; }
  else { const [x, z] = randFree(0.4); c.x = x; c.z = z; decide(c); }
  c.pw.fill(0); c.pw[c.pose] = 1; pose(c, 0);
  return c;
}
// what was bought on earlier visits
BOWL.food = clamp(+SAVE.food || 0, 0, 1); BOWL.water = clamp(+SAVE.water || 0, 0, 1);
setInterval(() => { SAVE.food = +BOWL.food.toFixed(3); SAVE.water = +BOWL.water.toFixed(3); saveItems(); }, 5000);
for (const id of ['yarn', 'mouse', 'box', 'nip']) for (let k = 0; k < min(SAVE[id] || 0, 12); k++) { const [x, z] = randFree(0.35); placeItem(id, x, z); }
for (const id of SAVE.cats) spawnSpecial(id, false);
for (const c of CATS) refreshAcc(c);

// ---------------------------------------------------------------- the panel
var setCoins = (n) => { coins = n; keep('catbarCoins', coins); $('n').textContent = coins; $('shN').textContent = coins; };
function openShop(tab) {
  if (!inGame()) return;
  if (tab !== 'wear') wearCat = lastTarget || wearCat;
  SHOPOPEN = true; if (tab) shopTab = tab;
  try { document.exitPointerLock(); } catch {}
  body.className = 'g s'; PET.mouse = false; renderShop();
}
function closeShop() {
  SHOPOPEN = false; $('pack').hidden = true; body.className = 'g';
  if (!mob) lockMouse();
}
const esc_ = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// a portrait: a sitting cat silhouette filled with the coat
function portrait(d, known = true) {
  const [, , , , , typ, base, sec, white, eye] = d, h = (v) => '#' + v.toString(16).padStart(6, '0');
  let bg = `linear-gradient(160deg, ${h(base)} 45%, ${h(sec || base)})`;
  if (typ === 6) bg = `radial-gradient(circle at 30% 30%, #8a5aff, #1a0a40 45%, #050210), radial-gradient(#fff 1px, transparent 1.5px) 0 0/9px 9px`;
  if (typ === 7) bg = 'linear-gradient(135deg, #fff2b0, #f0b030 40%, #a06a10 70%, #ffe080)';
  if (typ === 8) bg = 'linear-gradient(160deg, #ff5a5a, #ffb03a, #fff04a, #5ae05a, #4ab0ff, #a05aff)';
  if (typ === 9) bg = `repeating-linear-gradient(135deg, ${h(base)} 0 9px, ${h(sec)} 9px 18px)`;
  if (typ === 10) bg = 'linear-gradient(160deg, #ffffff, #bfe4ff 60%, #7ac0ff)';
  if (typ === 11) bg = 'repeating-linear-gradient(90deg, #c04a08 0 8px, #ff8a20 8px 16px)';
  if (typ === 12) bg = 'repeating-linear-gradient(125deg, #08080f 0 10px, #30f0ff 10px 12px, #08080f 12px 22px, #ff40d0 22px 24px)';
  if (typ === 13) bg = 'linear-gradient(180deg, #111 0 22%, #f2efe8 22% 60%, #111 60%)';
  if (typ === 14) bg = 'radial-gradient(circle at 40% 60%, #ff7a20, #3a0a00 30%, #0c0808 60%)';
  if (white > 0.3 && typ < 6) bg = `linear-gradient(180deg, ${h(base)} 0 55%, #f2efe8 55%)`;
  if (!known) bg = '#4a3428';
  const acc = known ? d[17].map((a) => `<i class="acc ${a}">${ACC_ICON[a] || ''}</i>`).join('') : '<i class=q>?</i>';
  return `<div class=por><div class=sil style="background:${bg}"></div>${known ? `<b class=eyes style="--e:${h(eye)}"></b>` : ''}${acc}</div>`;
}
function renderShop() {
  $('shN').textContent = coins;
  document.querySelectorAll('#shop nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === shopTab));
  if (renderShop.tab !== shopTab) { $('shBody').scrollTop = 0; renderShop.tab = shopTab; }
  const L = (o) => (IT ? o.it : o.en), B = $('shBody');
  if (shopTab === 'toys') {
    B.innerHTML = '<div class=grid>' + ITEMS.map((it) => {
      const [nm, ds] = L(it), own = it.once && SAVE[it.id];
      const btn = own ? `<button data-laser>${LASER.on ? L_('Spegni (L)', 'Turn off (L)') : L_('Accendi (L)', 'Turn on (L)')}</button>`
        : `<button data-buy=${it.id} ${coins < it.price ? 'disabled' : ''}><span class=coin></span> ${it.price}</button>`;
      const cnt = !it.once && SAVE[it.id] ? `<small>${L_('nel locale', 'in the café')}: ${SAVE[it.id]}</small>` : '';
      return `<div class=item><span class=ico>${it.icon}</span><b>${esc_(nm)}</b><p>${esc_(ds)}</p>${cnt}${btn}</div>`;
    }).join('') + '</div>';
  } else if (shopTab === 'care') {
    const bar = (v) => `<span class=bar style="--v:${v.toFixed(2)}"></span>`;
    const hungry = CATS.filter((c) => c.hunger > 0.6).length, thirsty = CATS.filter((c) => c.thirst > 0.6).length;
    B.innerHTML = `<p class=count>${L_('Ciotola del cibo', 'Food bowl')} ${bar(BOWL.food)} · ${L_("Ciotola dell'acqua", 'Water bowl')} ${bar(BOWL.water)}<br>${L_('Gatti affamati', 'Hungry cats')}: <b>${hungry}</b> · ${L_('assetati', 'thirsty')}: <b>${thirsty}</b> · ${L_('snack', 'treats')}: <b>${SAVE.snack}</b></p><div class=grid>` + CARE.map((it) => {
      const [nm, ds] = L(it), own = it.once && SAVE[it.id];
      const full = (it.id === 'kibble' && BOWL.food > 0.97) || (it.id === 'water' && BOWL.water > 0.97);
      const btn = own ? `<button disabled>${L_('Già tua', 'Owned')}</button>` : `<button data-care=${it.id} ${coins < it.price || full ? 'disabled' : ''}>${full ? L_('Piena', 'Full') : `<span class=coin></span> ${it.price}`}</button>`;
      return `<div class=item><span class=ico>${it.icon}</span><b>${esc_(nm)}</b><p>${esc_(ds)}</p>${btn}</div>`;
    }).join('') + '</div>';
  } else if (shopTab === 'wear') {
    if (!wearCat) wearCat = PET.cat || lastTarget || CATS[0];
    const worn = SAVE.wear[wearCat.name] || [];
    const opts = CATS.map((c) => `<option value=${c.i} ${c === wearCat ? 'selected' : ''}>${esc_(c.name)} · ${esc_(c.breed)}</option>`).join('');
    B.innerHTML = `<p class=count><label>${L_('Chi vesti?', 'Who are you dressing?')} <select id=wearSel>${opts}</select></label> <small>${L_('Tocca un accessorio tuo per metterlo o toglierlo. Uno per testa, viso, collo e corpo.', 'Tap one of yours to put it on or take it off. One each for head, face, neck and body.')}</small></p><div class="grid wear">` + WEAR.map(([id, slot, price, icon, it, en]) => {
      const own = SAVE.acc.includes(id), on = worn.includes(id);
      const btn = own ? `<button data-wear=${id} class=${on ? 'on' : ''}>${on ? L_('Togli', 'Take off') : L_('Metti', 'Put on')}</button>`
        : price ? `<button data-buyacc=${id} ${coins < price ? 'disabled' : ''}><span class=coin></span> ${price}</button>` : `<button disabled>${L_('Vinci nei mini giochi', 'Win it in mini-games')}</button>`;
      return `<div class="item ${on ? 'worn' : ''}"><span class=ico>${icon}</span><b>${esc_(IT ? it : en)}</b><p>${L_({ head: 'Testa', face: 'Viso', neck: 'Collo', body: 'Corpo' }[slot], slot[0].toUpperCase() + slot.slice(1))}</p>${btn}</div>`;
    }).join('') + '</div>';
    $('wearSel').onchange = (e) => { wearCat = CATS[+e.target.value]; renderShop(); };
  } else if (shopTab === 'packs') {
    B.innerHTML = '<div class="grid packs">' + PACKS.map((pk) => {
      const [nm, ds] = L(pk);
      const odds = pk.odds.map((o, r) => (o ? `<span style="color:${RARITY[r][2]}">${L_(RARITY[r][0], RARITY[r][1])} ${o}%</span>` : '')).join(' ');
      return `<div class="item pk ${pk.id}"><span class=pack-art>${pk.tag ? '🎄' : '🐾'}</span><b>${esc_(nm)}</b><p>${esc_(ds)}</p><p class=odds>${odds}</p><button data-pack=${pk.id} ${coins < pk.price ? 'disabled' : ''}><span class=coin></span> ${pk.price}</button></div>`;
    }).join('') + '</div>';
  } else {
    const n = SPECIALS.filter((d) => SAVE.cats.includes(d[0])).length;
    B.innerHTML = `<p class=count>${L_('Gatti speciali trovati', 'Special cats found')}: <b>${n} / ${SPECIALS.length}</b></p><div class="grid album">` + SPECIALS.map((d) => {
      const own = SAVE.cats.includes(d[0]);
      return `<div class="card mini r${d[3]} ${own ? '' : 'locked'}">${portrait(d, own)}<b>${own ? esc_(IT ? d[1] : d[2]) : '???'}</b><span>${L_(RARITY[d[3]][0], RARITY[d[3]][1])}${d[4] === 'xmas' ? ' · ' + L_('Natale', 'Christmas') : d[4] === 'halloween' ? ' · Halloween' : ''}</span></div>`;
    }).join('') + '</div>';
  }
}
function buy(id) {
  const it = ITEMS.find((i) => i.id === id); if (!it || coins < it.price || (it.once && SAVE[id])) return;
  setCoins(coins - it.price);
  if (it.once) { SAVE[id] = true; LASER.on = true; } else { SAVE[id] = (SAVE[id] || 0) + 1; placeItem(id); }
  saveItems(); if (typeof coinSound === 'function') coinSound();
  if (!it.once) closeShop(); else renderShop();
}
function buyCare(id) {
  const it = CARE.find((i) => i.id === id); if (!it || coins < it.price || (it.once && SAVE[id])) return;
  setCoins(coins - it.price);
  if (id === 'kibble') BOWL.food = 1; else if (id === 'water') BOWL.water = 1; else if (id === 'snack') SAVE.snack += 3; else SAVE[id] = true;
  SAVE.food = BOWL.food; SAVE.water = BOWL.water; saveItems();
  if (typeof coinSound === 'function') coinSound();
  // hungry and thirsty cats hear the bowl being filled
  for (const c of CATS) if (c.pet <= 0 && c.st !== 'sleep' && ((id === 'kibble' && c.hunger > 0.4) || (id === 'water' && c.thirst > 0.4))) decide(c);
  renderShop();
}
function buyAcc(id) {
  const w = WEAR.find((x) => x[0] === id); if (!w || !w[2] || coins < w[2] || SAVE.acc.includes(id)) return;
  setCoins(coins - w[2]); SAVE.acc.push(id); saveItems(); if (typeof coinSound === 'function') coinSound();
  toggleWear(id);
}
function toggleWear(id) {
  if (!wearCat || !SAVE.acc.includes(id)) return;
  let worn = SAVE.wear[wearCat.name] || [];
  if (worn.includes(id)) worn = worn.filter((x) => x !== id);
  else { worn = worn.filter((x) => slotOf(x) !== slotOf(id)); worn.push(id); wearCat.joy = min(1, wearCat.joy + 0.1); wearCat.meowT = 0.3; }
  SAVE.wear[wearCat.name] = worn; saveItems(); refreshAcc(wearCat); renderShop();
}
function openPack(id) {
  const pk = PACKS.find((p) => p.id === id); if (!pk || coins < pk.price) return;
  setCoins(coins - pk.price);
  const cards = [];
  for (let k = 0; k < 3; k++) {
    let r = 0, x = rnd() * 100; while (r < 3 && x >= pk.odds[r]) { x -= pk.odds[r]; r++; }
    let pool = [];
    for (let rr_ = r; rr_ >= 0 && !pool.length; rr_--) pool = SPECIALS.filter((d) => d[3] === rr_ && (!pk.tag || d[4] === pk.tag));
    const d = pick(pool), dup = SAVE.cats.includes(d[0]) || cards.some((c) => c.d === d && !c.dup);
    if (!dup) { SAVE.cats.push(d[0]); refreshAcc(spawnSpecial(d[0], true)); } else setCoins(coins + REFUND[d[3]]);
    cards.push({ d, dup });
  }
  saveItems();
  $('cards').innerHTML = cards.map(({ d, dup }, k) => `<div class="card big r${d[3]}" style="--k:${k}"><div class=back><span>🐾</span></div><div class=front>${portrait(d)}<b>${esc_(IT ? d[1] : d[2])}</b><span>${L_(RARITY[d[3]][0], RARITY[d[3]][1])}</span><em>${dup ? L_('Doppione', 'Duplicate') + ` · +${REFUND[d[3]]} <span class=coin></span>` : L_('NUOVO! Ora è nel locale', 'NEW! Now in the café')}</em></div></div>`).join('');
  $('pack').hidden = false;
  $('cards').querySelectorAll('.card').forEach((el, k) => setTimeout(() => { el.classList.add('flip'); if (typeof coinSound === 'function' && el.classList.contains('r3')) coinSound(); }, 500 + k * 650));
  renderShop();
}
$('shopBtn').onclick = () => openShop();
$('shX').onclick = closeShop;
$('packOk').onclick = () => { $('pack').hidden = true; renderShop(); };
document.querySelectorAll('#shop nav button').forEach((b) => (b.onclick = () => { shopTab = b.dataset.tab; renderShop(); }));
$('shBody').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.buy) buy(b.dataset.buy);
  if (b.dataset.pack) openPack(b.dataset.pack);
  if (b.dataset.care) buyCare(b.dataset.care);
  if (b.dataset.buyacc) buyAcc(b.dataset.buyacc);
  if (b.dataset.wear) toggleWear(b.dataset.wear);
  if (b.hasAttribute('data-laser')) { LASER.on = !LASER.on; renderShop(); }
});
addEventListener('keydown', (e) => {
  if (e.code === 'KeyB') { if (SHOPOPEN) closeShop(); else openShop(); }
  if (e.code === 'KeyV' && !SHOPOPEN && inGame()) { wearCat = lastTarget || PET.cat || wearCat; openShop('wear'); }
  if (e.code === 'Escape' && SHOPOPEN) closeShop();
  if (e.code === 'KeyL' && SAVE.laser && inGame() && !SHOPOPEN) LASER.on = !LASER.on;
});
