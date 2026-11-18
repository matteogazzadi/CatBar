// ============================================================================
// audio: a soft electric-piano tune, room tone, meows, purring and the coin chime, all synthesised (no files)
// ============================================================================
var AC, OUT, WET, muted = false, PURR, PURRF; // var: the frame loop starts before this line runs
const VOL = 0.8;
function startAudio() {
  if (AC) { AC.resume(); return; }
  try { AC = new AudioContext(); } catch { return; }
  const ac = AC, sr = ac.sampleRate;
  const N = (Cl, o, ...to) => { const n = new Cl(ac, o); for (const d of to) n.connect(d); if (n.start) n.start(); return n; };
  const G = (gain, ...to) => N(GainNode, { gain }, ...to);
  const noise = (secs, f) => { const n = (sr * secs) | 0, b = new AudioBuffer({ length: n, numberOfChannels: 2, sampleRate: sr }); f(b.getChannelData(0), n); f(b.getChannelData(1), n); return b; };
  const lim = N(DynamicsCompressorNode, { threshold: -8, knee: 6, ratio: 12, attack: 0.003, release: 0.25 }, ac.destination);
  OUT = G(0, lim);
  // a small warm room
  const ir = noise(1.6, (d, n) => { for (let i = 0, b = 0; i < n; i++) { const t = i / sr; b += (rnd() * 2 - 1 - b) * (0.08 + 0.6 * exp(-t * 4)); d[i] = b * (1 - exp(-t * 60)) * exp(-t * 3.2); } });
  WET = G(0.35, N(ConvolverNode, { buffer: ir }, OUT));
  // room tone: a little brown noise and vinyl crackle
  const brown = noise(6, (d, n) => { for (let i = 0, b = 0; i < n; i++) { b = (b + 0.02 * (rnd() * 2 - 1)) / 1.02; d[i] = b * 3; } });
  N(AudioBufferSourceNode, { buffer: brown, loop: true }, N(BiquadFilterNode, { type: 'lowpass', frequency: 400 }, G(0.05, OUT)));
  const crack = noise(4, (d, n) => { for (let i = 0; i < n; i++) d[i] = rnd() < 0.0004 ? (rnd() * 2 - 1) * rnd() : (rnd() * 2 - 1) * 0.004; });
  N(AudioBufferSourceNode, { buffer: crack, loop: true }, N(BiquadFilterNode, { type: 'bandpass', frequency: 3000, Q: 0.6 }, G(0.25, OUT)));
  // purring: low noise chopped at ~26 Hz, louder on the "in" and "out" breaths
  const purrSrc = N(AudioBufferSourceNode, { buffer: brown, loop: true, playbackRate: 0.7 });
  PURR = G(0, OUT, G(0.3, WET)); PURRF = N(BiquadFilterNode, { type: 'lowpass', frequency: 260, Q: 2 }, PURR);
  const chop = G(0, PURRF); purrSrc.connect(chop);
  const lfo = N(OscillatorNode, { type: 'sawtooth', frequency: 26 }); const sh = new WaveShaperNode(ac, { curve: new Float32Array(64).map((_, i) => max(0, 1 - i / 20)) });
  lfo.connect(sh); sh.connect(chop.gain);
  // electric piano: two-operator FM, voices taken from a pool
  const music = G(0.16, OUT, G(0.9, WET)), mlp = N(BiquadFilterNode, { type: 'lowpass', frequency: 2600 }, music);
  N(OscillatorNode, { frequency: 4.2 }, G(0.04, music.gain));
  const voices = Array.from({ length: 10 }, () => {
    const g = G(0, mlp), car = N(OscillatorNode, { frequency: 220 }, g), mg = G(0, car.frequency), modu = N(OscillatorNode, { frequency: 220 }, mg);
    return { g, car, modu, mg };
  });
  let vi = 0;
  const note = (t, midi, vol, dur) => {
    const v = voices[vi++ % voices.length], f = 440 * pow(2, (midi - 69) / 12);
    v.car.frequency.setValueAtTime(f, t); v.modu.frequency.setValueAtTime(f, t);
    v.mg.gain.cancelScheduledValues(t); v.mg.gain.setValueAtTime(f * 1.6, t); v.mg.gain.setTargetAtTime(f * 0.15, t, 0.25);
    v.g.gain.cancelScheduledValues(t); v.g.gain.setValueAtTime(0, t); v.g.gain.linearRampToValueAtTime(vol, t + 0.006); v.g.gain.setTargetAtTime(0, t + 0.01, dur);
  };
  // Fmaj9 - Em7 - Dm9 - Cmaj7, slow and lazy
  const CH = [[41, 57, 60, 64, 67], [40, 55, 59, 62, 67], [38, 57, 60, 64, 65], [36, 55, 59, 62, 64]];
  const SCALE = [72, 74, 76, 79, 81, 84, 86];
  let bar = 0, tn = ac.currentTime + 0.5;
  const BEAT = 60 / 72;
  setInterval(() => {
    while (tn < ac.currentTime + 0.4) {
      const ch = CH[bar % 4];
      ch.forEach((m, i) => note(tn + i * 0.03 + rnd() * 0.01, m, i ? 0.07 : 0.11, 1.4));
      note(tn + BEAT * 2.5, ch[0] + 12, 0.05, 0.6);
      for (let b = 0; b < 4; b++) if (rnd() < 0.45) note(tn + BEAT * (b + (rnd() < 0.5 ? 0.5 : 0)), pick(SCALE), rr(0.03, 0.06), 0.5);
      tn += BEAT * 4; bar++;
    }
  }, 150);
  OUT.gain.setTargetAtTime(VOL, ac.currentTime, 1);
}
function toggleMute() { muted = !muted; if (OUT) OUT.gain.setTargetAtTime(muted ? 0 : VOL, AC.currentTime, 0.1); }
// where a sound is, relative to the listener: [pan, gain]
function place3(x, z) {
  const dx = x - PL.x, dz = z - PL.z, d = hypot(dx, dz) || 1, rx_ = cos(PL.yaw), rz_ = sin(PL.yaw);
  return [clamp(((dx * rx_ + dz * rz_) / d) * 0.8, -1, 1), 1 / (1 + d * 0.55)];
}
// a meow: a buzzy source through two moving formants ("mi-a-ow"), pitch rising then falling
function meow(cat, vol = 1) {
  if (!AC || muted) return;
  const ac = AC, t = ac.currentTime + 0.02, small = cat.scale < 0.8;
  const f0 = (small ? 820 : 520 - (cat.scale - 1) * 300) * rr(0.9, 1.12), dur = (small ? 0.42 : 0.65) * rr(0.8, 1.3);
  const [pan, g0] = place3(cat.sp[2][0], cat.sp[2][2]);
  const p = new StereoPannerNode(ac, { pan }), g = new GainNode(ac, { gain: 0 });
  g.connect(p); p.connect(OUT); p.connect(WET);
  const o = new OscillatorNode(ac, { type: 'sawtooth', frequency: f0 * 0.85 }), vib = new OscillatorNode(ac, { frequency: 6 }), vg = new GainNode(ac, { gain: f0 * 0.015 });
  vib.connect(vg); vg.connect(o.frequency);
  o.frequency.setValueAtTime(f0 * 0.8, t); o.frequency.linearRampToValueAtTime(f0 * 1.18, t + dur * 0.35); o.frequency.exponentialRampToValueAtTime(f0 * 0.62, t + dur);
  const f1 = new BiquadFilterNode(ac, { type: 'bandpass', frequency: 450, Q: 4 }), f2 = new BiquadFilterNode(ac, { type: 'bandpass', frequency: 1700, Q: 6 }), f2g = new GainNode(ac, { gain: 0.7 });
  o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(f2g); f2g.connect(g);
  f1.frequency.setValueAtTime(420, t); f1.frequency.linearRampToValueAtTime(1100, t + dur * 0.4); f1.frequency.linearRampToValueAtTime(600, t + dur);
  f2.frequency.setValueAtTime(2200, t); f2.frequency.linearRampToValueAtTime(1750, t + dur * 0.4); f2.frequency.linearRampToValueAtTime(950, t + dur);
  const v = 0.55 * g0 * vol;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.05); g.gain.setValueAtTime(v, t + dur * 0.6); g.gain.linearRampToValueAtTime(0, t + dur);
  o.start(t); vib.start(t); o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
}
function setPurr(on, cat) {
  if (!PURR) return;
  const t = AC.currentTime;
  const breath = 0.65 + 0.35 * abs(sin(t * 1.9));
  PURR.gain.setTargetAtTime(on ? 0.9 * breath : 0, t, on ? 0.15 : 0.4);
  if (cat) PURRF.frequency.setTargetAtTime(cat.scale < 0.8 ? 380 : 240, t, 0.2);
}
function coinSound() {
  if (!AC || muted) return;
  const t = AC.currentTime + 0.01;
  [[1318.5, 0], [1975.5, 0.08], [2637, 0.16]].forEach(([f, d]) => {
    const o = new OscillatorNode(AC, { type: 'triangle', frequency: f }), g = new GainNode(AC, { gain: 0 });
    o.connect(g); g.connect(OUT); g.connect(WET);
    g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(0.18, t + d + 0.005); g.gain.exponentialRampToValueAtTime(0.0005, t + d + 0.6);
    o.start(t + d); o.stop(t + d + 0.65);
  });
}
