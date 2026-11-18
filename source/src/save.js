// ============================================================================
// the save: where you were, what time it was, plus export / import / start over from the menu
// ============================================================================
// Everything else (coins, items, cats, love, furniture...) is already kept in localStorage.catbarCoins / catbarItems.
var SAVE_KEYS = ['catbarCoins', 'catbarItems', 'catbarState'];
// back to where you left: time of day, weather, your position
try {
  const st = JSON.parse(localStorage.catbarState || 'null');
  if (st) {
    if (isFinite(st.hour)) SKY.hour = st.hour;
    if (st.kind) { SKY.kind = st.kind; SKY.rain = st.kind === 'rain' ? 1 : 0; SKY.snow = st.kind === 'snow' ? 1 : 0; SKY.next = st.next || 2; }
    if (isFinite(st.x) && isFinite(st.z)) { PL.x = clamp(st.x, -RX + 0.4, RX - 0.4); PL.z = clamp(st.z, -RZ + 0.4, RZ - 0.4); PL.yaw = st.yaw || 0; }
  }
} catch {}
function saveState() { keep('catbarState', JSON.stringify({ hour: +SKY.hour.toFixed(3), kind: SKY.kind, next: +SKY.next.toFixed(2), x: +PL.x.toFixed(2), z: +PL.z.toFixed(2), yaw: +PL.yaw.toFixed(2) })); }
setInterval(() => { if (inGame()) saveState(); }, 5000);
addEventListener('pagehide', saveState);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveState(); });

// a code you can copy to another device: every save key, JSON, base64
function exportCode() {
  saveState(); saveItems();
  const o = {}; for (const k of SAVE_KEYS) { try { if (localStorage[k] != null) o[k] = localStorage[k]; } catch {} }
  return 'CATBAR1:' + btoa(unescape(encodeURIComponent(JSON.stringify(o))));
}
function importCode(code) {
  const m = /CATBAR1:([A-Za-z0-9+/=\s]+)/.exec(code || ''); if (!m) return false;
  let o; try { o = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/\s/g, ''))))); } catch { return false; }
  if (!o || typeof o !== 'object' || !SAVE_KEYS.some((k) => k in o)) return false;
  try { for (const k of SAVE_KEYS) { if (k in o) localStorage[k] = String(o[k]); else localStorage.removeItem(k); } } catch { return false; }
  return true;
}
function svOpen(mode) {
  const box = $('svBox'), ta = $('svText'); box.hidden = false; box.dataset.mode = mode; $('svMsg').textContent = '';
  if (mode === 'exp') {
    $('svT').textContent = L_('Il tuo salvataggio', 'Your save');
    $('svP').textContent = L_('Copia questo codice e incollalo con “Importa” su un altro dispositivo (o tienilo da parte come copia di sicurezza).', 'Copy this code and paste it with “Import” on another device (or keep it as a backup).');
    ta.value = exportCode(); ta.readOnly = true; $('svGo').textContent = L_('Copia', 'Copy');
  } else if (mode === 'imp') {
    $('svT').textContent = L_('Importa un salvataggio', 'Import a save');
    $('svP').textContent = L_('Incolla qui il codice che inizia con CATBAR1. Il salvataggio di questo dispositivo verrà sostituito.', 'Paste the code that starts with CATBAR1. This device’s save will be replaced.');
    ta.value = ''; ta.readOnly = false; $('svGo').textContent = L_('Carica', 'Load');
  } else {
    $('svT').textContent = L_('Ricominciare da zero?', 'Start over?');
    $('svP').textContent = L_('Perderai monete, livello, gatti speciali, vestiti, mobili e amicizie. Non si può annullare (a meno che tu non abbia esportato il salvataggio).', 'You will lose coins, level, special cats, clothes, furniture and friendships. This cannot be undone (unless you exported your save).');
    ta.value = ''; $('svGo').textContent = L_('Sì, ricomincia', 'Yes, start over');
  }
  ta.hidden = mode === 'reset';
  if (mode === 'exp') { ta.focus(); ta.select(); }
}
$('svExp').onclick = () => svOpen('exp');
$('svImp').onclick = () => svOpen('imp');
$('svReset').onclick = () => svOpen('reset');
$('svNo').onclick = () => { $('svBox').hidden = true; };
$('svGo').onclick = () => {
  const mode = $('svBox').dataset.mode, ta = $('svText');
  if (mode === 'exp') {
    const done = () => { $('svMsg').textContent = L_('Copiato!', 'Copied!'); };
    try { navigator.clipboard.writeText(ta.value).then(done, () => { ta.select(); $('svMsg').textContent = L_('Seleziona il testo e copialo a mano.', 'Select the text and copy it by hand.'); }); }
    catch { ta.select(); }
  } else if (mode === 'imp') {
    if (importCode(ta.value)) { window.__wiped = true; $('svMsg').textContent = L_('Fatto! Ricarico…', 'Done! Reloading…'); setTimeout(() => location.reload(), 600); }
    else $('svMsg').textContent = L_('Questo codice non sembra un salvataggio del Cat Bar.', 'This code does not look like a Cat Bar save.');
  } else {
    // stop the timers from writing the old save back, then wipe and reload
    try { for (const k of SAVE_KEYS) localStorage.removeItem(k); } catch {}
    window.__wiped = true;
    location.reload();
  }
};
