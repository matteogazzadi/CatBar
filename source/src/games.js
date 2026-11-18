// ============================================================================
// mini-games: now and then a cat shows a 🎲 over its head and challenges you to tic-tac-toe or pong
// ============================================================================
// Win coins and the clothes the shop does not sell. `var` on purpose: the frame loop is already running.
var GAMEOPEN = false;
var OFFER = { cat: null, kind: null, life: 0, wait: rr(8, 15) };
var GAMES = { ttt: ['Tris', 'Tic-tac-toe'], pong: ['Pong col gomitolo', 'Yarn pong'] };
var gameState = null;

// the bubble over the challenging cat follows it on screen
var offerLast = performance.now();
function offerLoop(now) {
  requestAnimationFrame(offerLoop);
  const dt = min((now - offerLast) / 1000, 0.1); offerLast = now;
  const el = $('offer');
  if (!OFFER.cat) {
    OFFER.wait -= dt;
    if (OFFER.wait < 0 && inGame()) {
      const pool = CATS.filter((c) => c.st !== 'sleep' && hypot(c.x - PL.x, c.z - PL.z) < 8);
      if (pool.length) { OFFER.cat = pick(pool); OFFER.kind = pick(['ttt', 'pong']); OFFER.life = 50; OFFER.cat.meowT = 0.5; }
      else OFFER.wait = 5;
    }
    el.hidden = true; return;
  }
  OFFER.life -= dt;
  if (OFFER.life < 0) { OFFER.cat = null; OFFER.wait = rr(25, 50); el.hidden = true; return; }
  const c = OFFER.cat, x = c.sp[2][0], y = c.sp[2][1] + 0.16 * c.scale + sin(now / 300) * 0.015, z = c.sp[2][2], m = VPm;
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  if (w < 0.1 || !inGame() || SHOPOPEN) { el.hidden = true; return; }
  const sx = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / w) * 0.5 + 0.5, sy = 0.5 - ((m[1] * x + m[5] * y + m[9] * z + m[13]) / w) * 0.5;
  el.hidden = sx < -0.1 || sx > 1.1 || sy < -0.1 || sy > 1.1;
  el.style.transform = `translate(calc(${(sx * innerWidth).toFixed(1)}px - 50%), calc(${(sy * innerHeight).toFixed(1)}px - 100%)) scale(${clamp(3 / max(w, 0.5), 0.6, 1.4).toFixed(2)})`;
  $('offerT').textContent = (IT ? GAMES[OFFER.kind][0] : GAMES[OFFER.kind][1]) + (mob ? '' : ' · G');
}
requestAnimationFrame(offerLoop);

function openGame() {
  if (!OFFER.cat || !inGame() || SHOPOPEN) return;
  const c = OFFER.cat;
  GAMEOPEN = SHOPOPEN = true; try { document.exitPointerLock(); } catch {}
  body.className = 'g s'; PET.mouse = false;
  $('shop').classList.add('gm');
  $('game').hidden = false;
  $('gT').textContent = L_(`${c.name} ti sfida a ${GAMES[OFFER.kind][0]}!`, `${c.name} challenges you to ${GAMES[OFFER.kind][1]}!`);
  $('gR').textContent = ''; $('gAgain').hidden = true;
  (OFFER.kind === 'ttt' ? startTTT : startPong)();
}
function closeGame() {
  if (gameState && gameState.raf) cancelAnimationFrame(gameState.raf);
  gameState = null; GAMEOPEN = false; $('game').hidden = true; $('shop').classList.remove('gm');
  if (OFFER.done) { OFFER.cat = null; OFFER.done = false; OFFER.wait = rr(30, 60); }
  closeShop();
}
// win: coins, and sometimes a piece of clothing only games give
function finish(res) {
  const c = OFFER.cat, win = res === 'win';
  const coinsWon = win ? (OFFER.kind === 'pong' ? 20 : 15) : res === 'draw' ? 5 : 1;
  setCoins(coins + coinsWon); OFFER.done = true;
  let msg = res === 'win' ? L_('Hai vinto!', 'You won!') : res === 'draw' ? L_('Pareggio!', 'Draw!') : L_(`Ha vinto ${c.name}!`, `${c.name} won!`);
  msg += ` +${coinsWon} ` + L_('monete', 'coins');
  const rare = WEAR.filter((w) => !w[2] && !SAVE.acc.includes(w[0]));
  if (win && rare.length && rnd() < 0.45) { const w = pick(rare); SAVE.acc.push(w[0]); saveItems(); msg += ` · ${L_('Nuovo accessorio', 'New item')}: ${w[3]} ${IT ? w[4] : w[5]} (${L_('in Vestiti', 'in Clothes')})`; }
  if (c) { c.joy = min(1, c.joy + (win ? 0.15 : 0.3)); c.meowT = 0.3; }
  $('gR').textContent = msg; $('gAgain').hidden = win;
  if (typeof coinSound === 'function') coinSound();
}

// ---------------------------------------------------------------- tic-tac-toe: you are ✕, the cat plays 🐾
var LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
function tttWinner(b) { for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a]; return b.every((x) => x) ? 'draw' : null; }
function startTTT() {
  gameState = { b: Array(9).fill(''), busy: false, over: false };
  const G = $('gBody'); G.innerHTML = '<div class=ttt>' + Array.from({ length: 9 }, (_, i) => `<button data-c=${i}></button>`).join('') + '</div>';
  G.querySelectorAll('[data-c]').forEach((el) => (el.onclick = () => tttPlay(+el.dataset.c)));
}
function tttDraw() { $('gBody').querySelectorAll('[data-c]').forEach((el, i) => { el.textContent = gameState.b[i] === 'X' ? '✕' : gameState.b[i] === 'O' ? '🐾' : ''; el.className = gameState.b[i]; }); }
function tttEnd() { const w = tttWinner(gameState.b); if (!w) return false; gameState.over = true; finish(w === 'X' ? 'win' : w === 'O' ? 'lose' : 'draw'); return true; }
function tttPlay(i) {
  const s = gameState; if (!s || s.over || s.busy || s.b[i]) return;
  s.b[i] = 'X'; tttDraw(); if (tttEnd()) return;
  s.busy = true;
  setTimeout(() => { // the cat thinks a moment; it plays well, but cats get distracted
    if (!gameState || gameState !== s) return;
    const b = s.b, free = b.map((x, k) => (x ? -1 : k)).filter((k) => k >= 0);
    const find = (p) => { for (const L of LINES) { const v = L.map((k) => b[k]); if (v.filter((x) => x === p).length === 2 && v.includes('')) return L[v.indexOf('')]; } return -1; };
    let mv = rnd() < 0.85 ? find('O') : -1;
    if (mv < 0 && rnd() < 0.75) mv = find('X');
    if (mv < 0 && !b[4] && rnd() < 0.7) mv = 4;
    if (mv < 0) mv = pick(free);
    b[mv] = 'O'; s.busy = false; tttDraw(); tttEnd();
  }, 550);
}

// ---------------------------------------------------------------- pong: your hand at the bottom, the cat's paw at the top
function startPong() {
  const G = $('gBody'); G.innerHTML = '<canvas id=pongC></canvas><p class=gHelp></p>';
  G.querySelector('.gHelp').textContent = L_('Muovi il mouse o il dito (o A/D, frecce). Primo a 3!', 'Move the mouse or your finger (or A/D, arrows). First to 3!');
  const cv = $('pongC'), W = 300, H = 420; cv.width = W * 2; cv.height = H * 2;
  const g = cv.getContext('2d'); g.scale(2, 2);
  const s = gameState = { px: W / 2, cx: W / 2, bx: W / 2, by: H / 2, vx: 90, vy: 170, ps: 0, cs: 0, pause: 1, over: false, last: performance.now(), rot: 0 };
  const move = (e) => { const r = cv.getBoundingClientRect(); s.px = clamp(((e.clientX - r.left) / r.width) * W, 30, W - 30); };
  cv.onpointermove = move; cv.onpointerdown = move;
  const serve = (dir) => { s.bx = W / 2; s.by = H / 2; const a = rr(-0.6, 0.6); s.vx = sin(a) * 200; s.vy = dir * cos(a) * 200; s.pause = 0.8; };
  serve(rnd() < 0.5 ? 1 : -1);
  const frame = (now) => {
    if (gameState !== s) return;
    s.raf = requestAnimationFrame(frame);
    const dt = min((now - s.last) / 1000, 0.04); s.last = now;
    if (KEY.KeyA || KEY.ArrowLeft) s.px = max(30, s.px - 320 * dt);
    if (KEY.KeyD || KEY.ArrowRight) s.px = min(W - 30, s.px + 320 * dt);
    if (!s.over) {
      if (s.pause > 0) s.pause -= dt;
      else {
        s.bx += s.vx * dt; s.by += s.vy * dt; s.rot += (s.vx + s.vy) * dt * 0.05;
        if (s.bx < 10 || s.bx > W - 10) { s.vx = -s.vx; s.bx = clamp(s.bx, 10, W - 10); }
        // the cat's paw chases the ball, a little slower than it, and does not always react in time
        const tgt = s.vy < 0 ? s.bx + sin(now / 400) * 18 : W / 2;
        s.cx += clamp(tgt - s.cx, -190 * dt, 190 * dt);
        const hit = (x, py, dir) => { if (abs(s.bx - x) < 38 && abs(s.by - py) < 12 && sign(s.vy) === dir) { s.vy = -s.vy * 1.06; s.vx += (s.bx - x) * 4; s.vx = clamp(s.vx, -320, 320); } };
        hit(s.px, H - 26, 1); hit(s.cx, 26, -1);
        if (s.by > H + 12) { s.cs++; serve(1); if (OFFER.cat) OFFER.cat.meowT = 0.2; }
        if (s.by < -12) { s.ps++; serve(-1); }
        if (s.ps >= 3 || s.cs >= 3) { s.over = true; finish(s.ps >= 3 ? 'win' : 'lose'); }
      }
    }
    // draw: a wooden table, the score, the paw, the hand and the yarn ball
    g.fillStyle = '#7a4a2a'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 22) { g.fillStyle = y % 44 ? '#84522f' : '#6e4226'; g.fillRect(0, y, W, 21); }
    g.strokeStyle = '#ffffff33'; g.setLineDash([8, 8]); g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#ffffffcc'; g.font = 'bold 28px system-ui'; g.textAlign = 'center'; g.fillText(`${s.cs}`, W / 2, H / 2 - 16); g.fillText(`${s.ps}`, W / 2, H / 2 + 40);
    const col = OFFER.cat ? '#' + [0, 1, 2].map((k) => Math.round(pow(OFFER.cat.P[k], 1 / 2.2) * 255).toString(16).padStart(2, '0')).join('') : '#e0904a';
    g.fillStyle = col; g.beginPath(); g.ellipse(s.cx, 22, 34, 13, 0, 0, TAU); g.fill();
    g.fillStyle = '#f2a0a8'; for (const k of [-1, 0, 1]) { g.beginPath(); g.arc(s.cx + k * 13, 30, 5, 0, TAU); g.fill(); } g.beginPath(); g.ellipse(s.cx, 18, 9, 6, 0, 0, TAU); g.fill();
    g.fillStyle = '#e8b48e'; g.beginPath(); g.roundRect(s.px - 34, H - 34, 68, 18, 9); g.fill();
    g.save(); g.translate(s.bx, s.by); g.rotate(s.rot); g.fillStyle = '#c8304a'; g.beginPath(); g.arc(0, 0, 10, 0, TAU); g.fill();
    g.strokeStyle = '#8a1a2a'; g.lineWidth = 1.5; for (const a of [0, 1, 2]) { g.beginPath(); g.ellipse(0, 0, 10, 4, a, 0, TAU); g.stroke(); } g.restore();
  };
  s.raf = requestAnimationFrame(frame);
}

$('offer').onclick = openGame;
$('gX').onclick = closeGame;
$('gAgain').onclick = () => { $('gR').textContent = ''; $('gAgain').hidden = true; OFFER.done = false; (OFFER.kind === 'ttt' ? startTTT : startPong)(); };
addEventListener('keydown', (e) => {
  if (e.code === 'KeyG' && !SHOPOPEN && OFFER.cat && hypot(OFFER.cat.x - PL.x, OFFER.cat.z - PL.z) < 4) openGame();
  if (e.code === 'Escape' && GAMEOPEN) closeGame();
});
