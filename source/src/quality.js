// ============================================================================
// quality level, chosen before anything is built
// ============================================================================
// LV: 0 High, 1 Medium, 2 Low. localStorage.catbar = "level"; catbarLoad is set while the scene is built: still set
// on the next visit means that load crashed the tab, so this one runs a level lower.
const mob = matchMedia('(pointer:coarse)').matches, mem = navigator.deviceMemory;
const keep = (k, v) => { if (window.__wiped) return; try { localStorage[k] = v; } catch {} }; // __wiped: start over in progress
let LV, bad;
try { LV = localStorage.catbar; bad = localStorage.catbarLoad; } catch {}
LV = LV != null && LV !== '' ? +LV : mob ? 2 : mem && mem <= 4 ? 2 : 0; // phones start on Low
if (bad && LV < 2) keep('catbar', ++LV);
{ const m = /[?&]lv=(\d)/.exec(location.search); if (m) LV = +m[1]; }
const AA = LV > 1 ? 1 : 4;               // MSAA samples (fur uses alpha-to-coverage with it)
const SHADOW = LV ? 2048 : 4096;         // sun shadow map
const MAXSH = [42, 24, mob ? 8 : 12][LV];          // most fur shells on a cat close to the camera
const VOLN = [32, 20, 6][LV];           // light shaft steps
const SSAO = LV < 2;
const LITE = LV > 1;                    // Low: fewer lights, simpler shadows, no floor reflections, no depth pre-pass
const NLIT = LITE ? 8 : 12, PCF = LITE ? 0 : 1, SSRN = LITE ? 0 : 28;
const CATRES = LITE ? 0.0068 : 0.0046;  // grid step of the cat mesh (metres)
const NDUST = [1400, 900, 400][LV];
// language: Italian if the browser prefers it, English otherwise
const IT = /^it\b/i.test((navigator.languages && navigator.languages[0]) || navigator.language || '');
const L_ = (it, en) => (IT ? it : en);
// time of day, weather and photo mode (driven by life.js; here so the frame loop can read them from the first frame)
var SKY = { hour: 15.5, day: 1, rain: 0, snow: 0, want: 0, kind: 'clear', next: 3, expo: 1.45, amb: 0.8, shaft: 0.016, sx: 0, sy: 0, sz: 0, shadowT: 0 };
var PHOTO = { on: false, filter: 0, req: false };
