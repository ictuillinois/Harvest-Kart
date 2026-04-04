// Procedural audio using Web Audio API — no files needed.
let ctx = null;
let masterGain = null;
let noiseBuffer = null; // reused across all crackle sounds

// --- Background music ---
let musicEl = null;  // current <audio> element
let _cancelPendingRetry = null; // cancels a blocked-autoplay retry

const MUSIC_TRACKS = {
  menu:      'title.mp3',
  brazil:    'bordeaux.mp3',
  usa:       'las-vegas.mp3',
  peru:      'frankfurt.mp3',
  qualified: 'qualified.mp3',
};

/** Play a background music track by key. */
export function playMusic(key) {
  const file = MUSIC_TRACKS[key];
  if (!file) return;

  // Cancel any stale retry from a previous blocked playback attempt.
  // Without this, a retry closure pointing at a dead element fires later
  // and either plays nothing or races against the current track.
  if (_cancelPendingRetry) {
    _cancelPendingRetry();
    _cancelPendingRetry = null;
  }

  // Already playing the same track? Do nothing.
  if (musicEl && !musicEl.paused && musicEl._trackKey === key) return;

  _stopMusic();

  const el = new Audio();
  el._trackKey = key;
  el.src = (import.meta.env.BASE_URL || '/') + 'audio/' + file;
  el.loop = true;
  el.volume = 0.45;
  musicEl = el;

  el.play().catch(() => {
    // Autoplay blocked by browser policy — retry via a full playMusic() call
    // (not el.play()) so the retry always uses the live element and key.
    const retry = () => { playMusic(key); };
    window.addEventListener('pointerdown', retry, { once: true });
    window.addEventListener('keydown',     retry, { once: true });
    _cancelPendingRetry = () => {
      window.removeEventListener('pointerdown', retry);
      window.removeEventListener('keydown',     retry);
    };
  });
}

/** Stop background music. */
export function stopMusic() {
  _stopMusic();
}

function _stopMusic() {
  if (musicEl) {
    musicEl.pause();
    musicEl.src = '';
    musicEl = null;
  }
}

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(ctx.destination);
  }
  return ctx;
}

function getMaster() {
  getCtx();
  return masterGain;
}

// Pre-create reusable noise buffer (Task 45 — fix memory leak)
function getNoiseBuffer() {
  const c = getCtx();
  if (!noiseBuffer) {
    const bufSize = c.sampleRate * 0.1;
    noiseBuffer = c.createBuffer(1, bufSize, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
  }
  return noiseBuffer;
}

// Resume on first user interaction (browser autoplay policy)
function ensureResumed() {
  const c = getCtx();
  if (c.state === 'suspended') c.resume();
}
window.addEventListener('pointerdown', ensureResumed, { once: true });
window.addEventListener('keydown', ensureResumed, { once: true });

/** Master volume (0-1) */
export function setVolume(v) {
  getMaster().gain.value = Math.max(0, Math.min(1, v));
}

/** Plate hit — bright ping + reused noise crackle */
export function playPlateHit() {
  const c = getCtx();
  const t = c.currentTime;
  const out = getMaster();

  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.exponentialRampToValueAtTime(1760, t + 0.05);
  osc.frequency.exponentialRampToValueAtTime(440, t + 0.15);
  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + 0.2);

  // Reused noise buffer (no allocation per hit)
  const noise = c.createBufferSource();
  const nGain = c.createGain();
  noise.buffer = getNoiseBuffer();
  nGain.gain.setValueAtTime(0.08, t);
  nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  noise.connect(nGain).connect(out);
  noise.start(t);
}

/** Lamp light-up — ascending chord sting */
export function playLampLit() {
  const c = getCtx();
  const t = c.currentTime;
  const out = getMaster();

  for (const [freq, delay] of [[523, 0], [659, 0.08], [784, 0.16], [1047, 0.24]]) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t + delay);
    gain.gain.linearRampToValueAtTime(0.12, t + delay + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.5);
    osc.connect(gain).connect(out);
    osc.start(t + delay);
    osc.stop(t + delay + 0.5);
  }
}

/** Combo break — low thud */
export function playComboBreak() {
  const c = getCtx();
  const t = c.currentTime;
  const out = getMaster();

  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(200, t);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.15);
  gain.gain.setValueAtTime(0.15, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + 0.2);
}

/** Win fanfare — major arpeggio */
export function playWinFanfare() {
  const c = getCtx();
  const t = c.currentTime;
  const out = getMaster();

  const notes = [523, 659, 784, 1047, 784, 1047, 1319];
  notes.forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    const start = t + i * 0.12;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.08, start + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
    osc.connect(gain).connect(out);
    osc.start(start);
    osc.stop(start + 0.4);
  });
}

/** Lane switch — quick whoosh */
export function playLaneSwitch() {
  const c = getCtx();
  const t = c.currentTime;
  const out = getMaster();

  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, t);
  osc.frequency.exponentialRampToValueAtTime(600, t + 0.06);
  osc.frequency.exponentialRampToValueAtTime(200, t + 0.1);
  gain.gain.setValueAtTime(0.04, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc.connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + 0.1);
}

/** Start button press — bright ascending chime */
export function playStartPress() {
  const c = getCtx();
  const t = c.currentTime;
  const out = getMaster();

  const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6 — major chord arpeggio
  notes.forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t + i * 0.06);
    gain.gain.linearRampToValueAtTime(0.12, t + i * 0.06 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.25);
    osc.connect(gain).connect(out);
    osc.start(t + i * 0.06);
    osc.stop(t + i * 0.06 + 0.25);
  });
}

/** Driver selected — confident confirmation tone */
export function playDriverSelect() {
  const c = getCtx();
  const t = c.currentTime;
  const out = getMaster();

  // Two-note "lock in" — low then high
  const osc1 = c.createOscillator();
  const g1 = c.createGain();
  osc1.type = 'triangle';
  osc1.frequency.value = 440; // A4
  g1.gain.setValueAtTime(0.12, t);
  g1.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  osc1.connect(g1).connect(out);
  osc1.start(t);
  osc1.stop(t + 0.15);

  const osc2 = c.createOscillator();
  const g2 = c.createGain();
  osc2.type = 'triangle';
  osc2.frequency.value = 660; // E5
  g2.gain.setValueAtTime(0.14, t + 0.08);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  osc2.connect(g2).connect(out);
  osc2.start(t + 0.08);
  osc2.stop(t + 0.28);

  // Subtle noise punch for tactile feel
  const noise = c.createBufferSource();
  noise.buffer = getNoiseBuffer();
  const nf = c.createBiquadFilter();
  nf.type = 'bandpass'; nf.frequency.value = 2000; nf.Q.value = 1;
  const ng = c.createGain();
  ng.gain.setValueAtTime(0.06, t + 0.07);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  noise.connect(nf).connect(ng).connect(out);
  noise.start(t + 0.07);
}

/** Map selected — deeper, more resonant confirmation */
export function playMapSelect() {
  const c = getCtx();
  const t = c.currentTime;
  const out = getMaster();

  // Power-up sweep: low to high
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(880, t + 0.2);
  const filt = c.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(600, t);
  filt.frequency.exponentialRampToValueAtTime(3000, t + 0.15);
  gain.gain.setValueAtTime(0.08, t);
  gain.gain.setValueAtTime(0.08, t + 0.15);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  osc.connect(filt).connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + 0.35);

  // Bright confirmation ping on top
  const ping = c.createOscillator();
  const pg = c.createGain();
  ping.type = 'sine';
  ping.frequency.value = 1047; // C6
  pg.gain.setValueAtTime(0.10, t + 0.12);
  pg.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  ping.connect(pg).connect(out);
  ping.start(t + 0.12);
  ping.stop(t + 0.4);
}

// =================================================================
//  AMERICAN MUSCLE V8 ENGINE — multi-oscillator, speed-reactive
// =================================================================
//
//  Cross-plane V8: deep, throaty rumble with a loping idle burble.
//  4 layered oscillators model V8 exhaust harmonics:
//    1. Fundamental  (sawtooth 45Hz) — deep gut-punch rumble
//    2. 2nd harmonic (square   90Hz) — exhaust body/thump
//    3. 4th harmonic (sawtooth 180Hz) — firing-frequency chug
//    4. 3rd harmonic (sine     135Hz) — midrange growl fill
//
//  Signal path:
//    Oscs → GainNodes → WaveShaperNode (aggressive saturation)
//      → Lowpass filter → Idle-lope LFO (gain modulation)
//      → engineMasterGain → master
//
//  Two LFOs:
//    - Pitch vibrato (subtle wobble, all oscs)
//    - Idle lope (gain modulation — the "potato-potato" rhythm;
//      fades out at higher RPMs for a smooth cruise)
// =================================================================

const ENG_BASE     = 45;     // fundamental idle Hz (deep V8)
const ENG_IDLE_VOL = 0.08;   // master gain at idle (70% of previous)
const ENG_MAX_VOL  = 0.30;   // master gain at max rev (louder at high RPM)
const ENG_FILT_LO  = 250;    // lowpass cutoff at idle (dark rumble)
const ENG_FILT_HI  = 2800;   // cutoff at max (brighter, more aggressive)
const ENG_SMOOTH   = 0.04;   // param smoothing time-constant (s) — fast response for gear shifts
const ENG_FREQ_MUL = 2.8;    // frequency range: 1× → 3.8× (wider range for dramatic gear drops)

// Oscillator bank: [waveform, harmonic, gain@idle, gain@max]
const OSC_DEFS = [
  { type: 'sawtooth', h: 1, gIdle: 0.35, gMax: 0.38 },  // fundamental rumble
  { type: 'square',   h: 2, gIdle: 0.22, gMax: 0.28 },  // exhaust body
  { type: 'sawtooth', h: 4, gIdle: 0.07, gMax: 0.16 },  // firing-frequency chug
  { type: 'sine',     h: 3, gIdle: 0.04, gMax: 0.10 },  // midrange growl
];

let _eOscs = [];          // { osc, gain, lfoScale, def }
let _eFilter = null;
let _eMaster = null;
let _eDistort = null;
let _eLFO = null;         // pitch vibrato
let _eLFOGain = null;
let _eLope = null;         // idle-lope gain modulation
let _eLopeGain = null;
let _eLopeDepth = null;    // gain node between lope and master for depth control
let _eRunning = false;

function _makeDistortionCurve(k) {
  const n = 256, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = Math.tanh(x * k);
  }
  return curve;
}

/** Start the V8 muscle engine at idle. Sustains until stopEngine(). */
export function startEngineIdle() {
  const c = getCtx();
  const t = c.currentTime;
  const out = getMaster();

  stopEngine();

  // Waveshaper — aggressive saturation for raw exhaust rasp
  _eDistort = c.createWaveShaper();
  _eDistort.curve = _makeDistortionCurve(4.0);
  _eDistort.oversample = '2x';

  // Lowpass — darker at idle, opens at speed
  _eFilter = c.createBiquadFilter();
  _eFilter.type = 'lowpass';
  _eFilter.frequency.setValueAtTime(ENG_FILT_LO, t);
  _eFilter.Q.setValueAtTime(0.8, t);

  // Master engine gain — fades in from silence
  _eMaster = c.createGain();
  _eMaster.gain.setValueAtTime(0, t);
  _eMaster.gain.linearRampToValueAtTime(ENG_IDLE_VOL, t + 0.5);

  // ── LFO 1: pitch vibrato (subtle) ──
  _eLFO = c.createOscillator();
  _eLFO.type = 'sine';
  _eLFO.frequency.setValueAtTime(3, t);
  _eLFOGain = c.createGain();
  _eLFOGain.gain.setValueAtTime(1.2, t);   // ±1.2 Hz at idle
  _eLFO.connect(_eLFOGain);
  _eLFO.start(t);

  // ── LFO 2: idle lope ("potato-potato" V8 burble) ──
  // Modulates master gain at ~1.8 Hz creating rhythmic throb
  _eLope = c.createOscillator();
  _eLope.type = 'sine';
  _eLope.frequency.setValueAtTime(1.8, t);
  _eLopeGain = c.createGain();
  // At idle the lope swings master gain ±30% (0.08 * 0.30 = ±0.024)
  _eLopeGain.gain.setValueAtTime(ENG_IDLE_VOL * 0.30, t);
  _eLope.connect(_eLopeGain);
  _eLopeGain.connect(_eMaster.gain);  // additive modulation on gain AudioParam
  _eLope.start(t);

  // Build oscillator bank
  _eOscs = OSC_DEFS.map(def => {
    const osc = c.createOscillator();
    osc.type = def.type;
    const freq = ENG_BASE * def.h;
    osc.frequency.setValueAtTime(freq, t);

    // Pitch vibrato → osc frequency (scaled per harmonic)
    const lfoScale = c.createGain();
    lfoScale.gain.setValueAtTime(def.h, t);
    _eLFOGain.connect(lfoScale);
    lfoScale.connect(osc.frequency);

    const gain = c.createGain();
    gain.gain.setValueAtTime(def.gIdle, t);

    osc.connect(gain).connect(_eDistort);
    osc.start(t);

    return { osc, gain, lfoScale, def };
  });

  _eDistort.connect(_eFilter);
  _eFilter.connect(_eMaster);
  _eMaster.connect(out);
  _eRunning = true;
}

/** Stop and tear down the engine. */
export function stopEngine() {
  for (const e of _eOscs) {
    try { e.osc.stop(); } catch (_) {}
    e.osc.disconnect();
    e.gain.disconnect();
    e.lfoScale.disconnect();
  }
  _eOscs = [];
  if (_eLFO)      { try { _eLFO.stop(); } catch (_) {}  _eLFO.disconnect(); _eLFO = null; }
  if (_eLFOGain)  { _eLFOGain.disconnect(); _eLFOGain = null; }
  if (_eLope)     { try { _eLope.stop(); } catch (_) {}  _eLope.disconnect(); _eLope = null; }
  if (_eLopeGain) { _eLopeGain.disconnect(); _eLopeGain = null; }
  if (_eDistort)  { _eDistort.disconnect(); _eDistort = null; }
  if (_eFilter)   { _eFilter.disconnect(); _eFilter = null; }
  if (_eMaster)   { _eMaster.disconnect(); _eMaster = null; }
  _eRunning = false;
}

/**
 * Update engine sound every frame.
 * @param {number} rpm  RPM value (1000–8000)
 */
export function updateEngine(rpm) {
  if (!_eRunning) return;
  const c = getCtx();
  const t = c.currentTime;
  const s = Math.max(0, Math.min(1, (rpm - 1000) / 7000));

  // Frequency: 1× at idle → 3.2× at max (45 → 144 Hz fundamental)
  const fMul = 1 + s * ENG_FREQ_MUL;

  for (const e of _eOscs) {
    const tgtFreq = ENG_BASE * e.def.h * fMul;
    const tgtGain = e.def.gIdle + (e.def.gMax - e.def.gIdle) * s;
    e.osc.frequency.setTargetAtTime(tgtFreq, t, ENG_SMOOTH);
    e.gain.gain.setTargetAtTime(tgtGain, t, ENG_SMOOTH);
  }

  // Filter opens with speed
  const fCut = ENG_FILT_LO + (ENG_FILT_HI - ENG_FILT_LO) * s;
  _eFilter.frequency.setTargetAtTime(fCut, t, ENG_SMOOTH);

  // Master volume
  const vol = ENG_IDLE_VOL + (ENG_MAX_VOL - ENG_IDLE_VOL) * s;
  _eMaster.gain.setTargetAtTime(vol, t, ENG_SMOOTH);

  // Pitch vibrato: slightly faster at speed
  _eLFO.frequency.setTargetAtTime(3 + s * 4, t, ENG_SMOOTH);
  _eLFOGain.gain.setTargetAtTime(1.2 + s * 2, t, ENG_SMOOTH);

  // Idle lope: strong at idle, nearly gone at speed
  // Depth = ±30% of current master vol at idle → ±3% at max speed
  const lopeDepth = vol * (0.30 - s * 0.27);
  _eLopeGain.gain.setTargetAtTime(lopeDepth, t, ENG_SMOOTH);
  // Lope rate increases slightly (burble speeds up with RPM)
  _eLope.frequency.setTargetAtTime(1.8 + s * 3, t, ENG_SMOOTH);
}

/**
 * Play a gear shift sound effect with layered audio feedback.
 * @param {boolean} isUpshift  true = upshift, false = downshift
 * @param {number}  gear       0-indexed new gear (0=1st, 4=5th) — higher gears get deeper sounds
 */
export function playGearShift(isUpshift, gear = 0) {
  if (!_eRunning) return;
  const c = getCtx();
  const t = c.currentTime;
  const out = getMaster();
  const gearFrac = Math.min(gear, 4) / 4; // 0.0 (1st) → 1.0 (5th)

  if (isUpshift) {
    // ── 1. Brief engine dip (NOT silence — just softer, 15ms) ──
    const prevGain = _eMaster.gain.value;
    _eMaster.gain.cancelScheduledValues(t);
    _eMaster.gain.setValueAtTime(prevGain, t);
    _eMaster.gain.linearRampToValueAtTime(prevGain * 0.55, t + 0.015);
    // Quick bounce back, slightly louder than before (gear engaged surge)
    _eMaster.gain.linearRampToValueAtTime(prevGain * 1.15, t + 0.06);
    _eMaster.gain.setTargetAtTime(prevGain, t + 0.12, 0.06);

    // ── 2. Mechanical clunk (deeper for higher gears) ──
    const clunkBuf = c.createBuffer(1, c.sampleRate * 0.035, c.sampleRate);
    const clunkData = clunkBuf.getChannelData(0);
    for (let i = 0; i < clunkData.length; i++) clunkData[i] = (Math.random() * 2 - 1);
    const clunk = c.createBufferSource();
    clunk.buffer = clunkBuf;
    const clunkBP = c.createBiquadFilter();
    clunkBP.type = 'bandpass';
    clunkBP.frequency.value = 600 + gearFrac * 400; // 600-1000Hz, higher gears = tighter
    clunkBP.Q.value = 2;
    const clunkGain = c.createGain();
    clunkGain.gain.setValueAtTime(0.10 + gearFrac * 0.04, t + 0.01);
    clunkGain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    clunk.connect(clunkBP).connect(clunkGain).connect(out);
    clunk.start(t + 0.01);

    // ── 3. Turbo whoosh / air release (rises with gear) ──
    const whoosh = c.createBufferSource();
    const whooshLen = 0.08 + gearFrac * 0.06; // longer whoosh in higher gears
    const whooshBuf = c.createBuffer(1, c.sampleRate * whooshLen, c.sampleRate);
    const whooshData = whooshBuf.getChannelData(0);
    for (let i = 0; i < whooshData.length; i++) whooshData[i] = (Math.random() * 2 - 1) * 0.5;
    whoosh.buffer = whooshBuf;
    const whooshHP = c.createBiquadFilter();
    whooshHP.type = 'highpass';
    whooshHP.frequency.value = 2000 + gearFrac * 2000; // higher gears = more sibilant
    whooshHP.Q.value = 0.5;
    const whooshGain = c.createGain();
    whooshGain.gain.setValueAtTime(0.04 + gearFrac * 0.03, t + 0.02);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, t + 0.02 + whooshLen);
    whoosh.connect(whooshHP).connect(whooshGain).connect(out);
    whoosh.start(t + 0.02);

    // ── 4. Subtle "thump" — low-end punch on engagement ──
    const thump = c.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(60 + gear * 15, t + 0.01); // deeper in higher gears
    const thumpGain = c.createGain();
    thumpGain.gain.setValueAtTime(0.06, t + 0.01);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    thump.connect(thumpGain).connect(out);
    thump.start(t + 0.01);
    thump.stop(t + 0.08);

  } else {
    // ── DOWNSHIFT: rev-match blip + exhaust crackle ──

    // 1. RPM spikes up briefly (engine braking blip)
    const prevGain = _eMaster.gain.value;
    _eMaster.gain.cancelScheduledValues(t);
    _eMaster.gain.setValueAtTime(prevGain, t);
    _eMaster.gain.linearRampToValueAtTime(prevGain * 1.3, t + 0.03);
    _eMaster.gain.setTargetAtTime(prevGain, t + 0.08, 0.04);

    for (const e of _eOscs) {
      const curr = e.osc.frequency.value;
      e.osc.frequency.cancelScheduledValues(t);
      e.osc.frequency.setValueAtTime(curr, t);
      e.osc.frequency.linearRampToValueAtTime(curr * 1.35, t + 0.03);
      e.osc.frequency.setTargetAtTime(curr, t + 0.06, 0.04);
    }

    // 2. Brief filter spike (brighter exhaust note)
    const prevCut = _eFilter.frequency.value;
    _eFilter.frequency.cancelScheduledValues(t);
    _eFilter.frequency.setValueAtTime(prevCut, t);
    _eFilter.frequency.linearRampToValueAtTime(Math.min(prevCut * 1.8, 3000), t + 0.03);
    _eFilter.frequency.setTargetAtTime(prevCut, t + 0.08, 0.05);

    // 3. Exhaust crackle — short burst of filtered noise pops
    for (let p = 0; p < 3; p++) {
      const popDelay = 0.03 + p * 0.025 + Math.random() * 0.01;
      const pop = c.createBufferSource();
      const popBuf = c.createBuffer(1, c.sampleRate * 0.012, c.sampleRate);
      const popData = popBuf.getChannelData(0);
      for (let i = 0; i < popData.length; i++) popData[i] = (Math.random() * 2 - 1);
      pop.buffer = popBuf;
      const popBP = c.createBiquadFilter();
      popBP.type = 'bandpass';
      popBP.frequency.value = 400 + Math.random() * 600;
      popBP.Q.value = 3;
      const popGain = c.createGain();
      popGain.gain.setValueAtTime(0.06 + Math.random() * 0.04, t + popDelay);
      popGain.gain.exponentialRampToValueAtTime(0.001, t + popDelay + 0.015);
      pop.connect(popBP).connect(popGain).connect(out);
      pop.start(t + popDelay);
    }
  }
}

/**
 * Play a countdown engine rev (spike and decay).
 * @param {number} intensity 0.0–1.0
 */
export function playCountdownRev(intensity) {
  if (!_eRunning) return;
  const c = getCtx();
  const t = c.currentTime;

  const fMul = 1 + intensity * ENG_FREQ_MUL;
  const peakVol = ENG_IDLE_VOL + intensity * (ENG_MAX_VOL - ENG_IDLE_VOL);
  const peakCut = ENG_FILT_LO + intensity * (ENG_FILT_HI - ENG_FILT_LO);

  // Spike every oscillator
  for (const e of _eOscs) {
    const peakFreq = ENG_BASE * e.def.h * fMul;
    const peakGain = e.def.gIdle + (e.def.gMax - e.def.gIdle) * intensity;

    e.osc.frequency.cancelScheduledValues(t);
    e.osc.frequency.setValueAtTime(e.osc.frequency.value, t);
    e.osc.frequency.linearRampToValueAtTime(peakFreq, t + 0.15);

    e.gain.gain.cancelScheduledValues(t);
    e.gain.gain.setValueAtTime(e.gain.gain.value, t);
    e.gain.gain.linearRampToValueAtTime(peakGain, t + 0.15);

    if (intensity < 1.0) {
      e.osc.frequency.setTargetAtTime(ENG_BASE * e.def.h, t + 0.35, 0.18);
      e.gain.gain.setTargetAtTime(e.def.gIdle, t + 0.35, 0.18);
    }
  }

  // Filter + master
  _eFilter.frequency.cancelScheduledValues(t);
  _eFilter.frequency.setValueAtTime(_eFilter.frequency.value, t);
  _eFilter.frequency.linearRampToValueAtTime(peakCut, t + 0.15);

  _eMaster.gain.cancelScheduledValues(t);
  _eMaster.gain.setValueAtTime(_eMaster.gain.value, t);
  _eMaster.gain.linearRampToValueAtTime(peakVol, t + 0.15);

  // Suppress lope during rev spike (smooth muscle roar)
  _eLopeGain.gain.cancelScheduledValues(t);
  _eLopeGain.gain.setValueAtTime(0, t);

  if (intensity < 1.0) {
    _eFilter.frequency.setTargetAtTime(ENG_FILT_LO, t + 0.35, 0.18);
    _eMaster.gain.setTargetAtTime(ENG_IDLE_VOL, t + 0.35, 0.18);
    // Restore lope after decay
    _eLopeGain.gain.setTargetAtTime(ENG_IDLE_VOL * 0.30, t + 0.55, 0.15);
  }
}

/**
 * Play a countdown beep tone.
 * @param {number} step 3, 2, 1, or 0 (GO)
 */
export function playCountdownTone(step) {
  const c = getCtx();
  const t = c.currentTime;
  const out = getMaster();

  if (step > 0) {
    // "3", "2", "1": triangle beep at 440Hz, 150ms
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 440;
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.15);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + 0.15);
  } else {
    // "GO!": bright two-tone chord (880 + 1320Hz) + noise burst
    for (const freq of [880, 1320]) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.setValueAtTime(0.2, t + 0.2);
      gain.gain.linearRampToValueAtTime(0, t + 0.4);
      osc.connect(gain).connect(out);
      osc.start(t);
      osc.stop(t + 0.4);
    }

    // White noise burst, highpassed
    const noise = c.createBufferSource();
    noise.buffer = getNoiseBuffer();
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4000;
    const nGain = c.createGain();
    nGain.gain.setValueAtTime(0.06, t);
    nGain.gain.linearRampToValueAtTime(0, t + 0.08);
    noise.connect(hp).connect(nGain).connect(out);
    noise.start(t);
  }
}

/** Grand final power-on — played when all 4 tiers are complete. */
export function playFinalPowerOn() {
  const c = getCtx();
  const t = c.currentTime;
  const out = getMaster();

  // 1. Dual rising tones (fundamental + major 3rd, offset 200ms)
  for (const [lo, hi, delay] of [[300, 900, 0], [380, 1130, 0.2]]) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(lo, t + delay);
    osc.frequency.linearRampToValueAtTime(hi, t + delay + 1.0);
    gain.gain.setValueAtTime(0, t + delay);
    gain.gain.linearRampToValueAtTime(0.10, t + delay + 0.05);
    gain.gain.setValueAtTime(0.10, t + delay + 0.8);
    gain.gain.linearRampToValueAtTime(0, t + delay + 1.0);
    osc.connect(gain).connect(out);
    osc.start(t + delay);
    osc.stop(t + delay + 1.0);
  }

  // 2. Ascending arpeggio × 2 (6 pings)
  const pings = [800, 1000, 1200, 800, 1000, 1200];
  pings.forEach((freq, i) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const start = t + 0.3 + i * 0.07;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.08, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.05);
    osc.connect(gain).connect(out);
    osc.start(start);
    osc.stop(start + 0.05);
  });

  // 3. Warm pad (A3 220Hz + E4 330Hz, perfect fifth)
  for (const freq of [220, 330]) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.06, t + 0.5);
    gain.gain.setValueAtTime(0.06, t + 2.5);
    gain.gain.linearRampToValueAtTime(0, t + 3.5);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + 3.6);
  }

  // 4. White noise shimmer (highpass 5kHz)
  const noise = c.createBufferSource();
  // Create a longer noise buffer (2s)
  const bufSize = c.sampleRate * 2;
  const noiseBuf = c.createBuffer(1, bufSize, c.sampleRate);
  const data = noiseBuf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
  noise.buffer = noiseBuf;
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 5000;
  const nGain = c.createGain();
  nGain.gain.setValueAtTime(0.03, t);
  nGain.gain.setValueAtTime(0.03, t + 1.0);
  nGain.gain.linearRampToValueAtTime(0, t + 2.0);
  noise.connect(hp).connect(nGain).connect(out);
  noise.start(t);
}

/** Haptic feedback (mobile vibration) */
export function haptic(ms = 15) {
  if (navigator.vibrate) navigator.vibrate(ms);
}
