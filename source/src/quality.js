// ============================================================================
// quality level, chosen before anything is built
// ============================================================================
// LV: 0 High, 1 Medium, 2 Low. localStorage.catbar = "level"; catbarLoad is set while the scene is built: still set
// on the next visit means that load crashed the tab, so this one runs a level lower.
const mob = matchMedia('(pointer:coarse)').matches, mem = navigator.deviceMemory;
const keep = (k, v) => { try { localStorage[k] = v; } catch {} };
let LV, bad;
try { LV = localStorage.catbar; bad = localStorage.catbarLoad; } catch {}
LV = LV != null && LV !== '' ? +LV : mob ? (mem > 7 ? 1 : 2) : mem && mem <= 4 ? 2 : 0;
if (bad && LV < 2) keep('catbar', ++LV);
{ const m = /[?&]lv=(\d)/.exec(location.search); if (m) LV = +m[1]; }
const AA = LV > 1 ? 1 : 4;               // MSAA samples (fur uses alpha-to-coverage with it)
const SHADOW = LV ? 2048 : 4096;         // sun shadow map
const MAXSH = [42, 24, 12][LV];          // most fur shells on a cat close to the camera
const VOLN = [32, 20, 10][LV];           // light shaft steps
const SSAO = LV < 2;
const NDUST = [1400, 900, 400][LV];
// language: Italian if the browser prefers it, English otherwise
const IT = /^it\b/i.test((navigator.languages && navigator.languages[0]) || navigator.language || '');
const L_ = (it, en) => (IT ? it : en);
