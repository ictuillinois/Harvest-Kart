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
const ENG_MAX_VOL  = 0.24;   // master gain at max rev
const ENG_FILT_LO  = 250;    // lowpass cutoff at idle (darker than V10)
const ENG_FILT_HI  = 2200;   // cutoff at max (muscle = less bright)
const ENG_SMOOTH   = 0.08;   // param smoothing time-constant (s)
const ENG_FREQ_MUL = 2.2;    // frequency range: 1× → 3.2× (V8 doesn't rev as high)

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
 * @param {number} speed  0.0 (stopped) → 1.0 (max speed)
 */
export function updateEngine(speed) {
  if (!_eRunning) return;
  const c = getCtx();
  const t = c.currentTime;
  const s = Math.max(0, Math.min(1, speed));

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
