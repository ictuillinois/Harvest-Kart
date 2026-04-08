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

/**
 * Pre-warm audio node types used by playPlateHit (oscillator, buffer, filter).
 * Creates one of each and immediately stops them — warms the audio thread's
 * internal allocators so the first real playPlateHit doesn't stall.
 */
export function preWarmPlateAudio() {
  const c = getCtx();
  const t = c.currentTime;
  const dummy = c.createGain();
  dummy.gain.value = 0; // silent
  dummy.connect(c.destination);
  // Warm oscillator + filter + buffer source (the 3 node types playPlateHit uses)
  const osc = c.createOscillator(); osc.connect(dummy); osc.start(t); osc.stop(t + 0.01);
  const filt = c.createBiquadFilter(); filt.connect(dummy);
  const buf = c.createBufferSource(); buf.buffer = getNoiseBuffer(); buf.connect(dummy); buf.start(t); buf.stop(t + 0.01);
  setTimeout(() => dummy.disconnect(), 100);
}

/** Plate hit — piezoelectric spring compression + metallic sproing + electric zaps */
export function playPlateHit() {
  const c = getCtx();
  const t = c.currentTime;
  const out = getMaster();

  // Impact thud — tire hitting the plate
  const thud = c.createOscillator();
  const thudG = c.createGain();
  thud.type = 'sine';
  thud.frequency.setValueAtTime(90, t);
  thud.frequency.exponentialRampToValueAtTime(40, t + 0.08);
  thudG.gain.setValueAtTime(0.18, t);
  thudG.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  thud.connect(thudG).connect(out);
  thud.start(t);
  thud.stop(t + 0.1);

  // Spring compression — descending metallic tone
  const springDown = c.createOscillator();
  const sdG = c.createGain();
  springDown.type = 'triangle';
  springDown.frequency.setValueAtTime(800, t + 0.02);
  springDown.frequency.exponentialRampToValueAtTime(200, t + 0.08);
  sdG.gain.setValueAtTime(0.10, t + 0.02);
  sdG.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
  springDown.connect(sdG).connect(out);
  springDown.start(t + 0.02);
  springDown.stop(t + 0.1);

  // Spring release — ascending "sproing"
  const springUp = c.createOscillator();
  const suG = c.createGain();
  const suF = c.createBiquadFilter();
  springUp.type = 'square';
  springUp.frequency.setValueAtTime(250, t + 0.08);
  springUp.frequency.exponentialRampToValueAtTime(1200, t + 0.18);
  springUp.frequency.exponentialRampToValueAtTime(600, t + 0.35);
  suG.gain.setValueAtTime(0.06, t + 0.08);
  suG.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  suF.type = 'bandpass';
  suF.frequency.value = 800;
  suF.Q.value = 3;
  springUp.connect(suF).connect(suG).connect(out);
  springUp.start(t + 0.08);
  springUp.stop(t + 0.4);

  // Metallic ring — high harmonic resonance
  const ring = c.createOscillator();
  const rG = c.createGain();
  ring.type = 'sine';
  ring.frequency.setValueAtTime(2400, t + 0.06);
  ring.frequency.exponentialRampToValueAtTime(1800, t + 0.5);
  rG.gain.setValueAtTime(0.03, t + 0.06);
  rG.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  ring.connect(rG).connect(out);
  ring.start(t + 0.06);
  ring.stop(t + 0.5);

  // Electric zap — piezo charge crackle
  const noise = c.createBufferSource();
  const nG = c.createGain();
  const nF = c.createBiquadFilter();
  noise.buffer = getNoiseBuffer();
  nF.type = 'highpass';
  nF.frequency.value = 3000;
  nG.gain.setValueAtTime(0.06, t + 0.1);
  nG.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  noise.connect(nF).connect(nG).connect(out);
  noise.start(t + 0.1);
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
const ENG_IDLE_VOL = 0.07;   // master gain at idle — audible presence without overpowering music
const ENG_MAX_VOL  = 0.28;   // master gain at max rev — punchy at speed (~44% of music volume)
const ENG_FILT_LO  = 220;    // lowpass cutoff at idle (dark muffled rumble)
const ENG_FILT_HI  = 3400;   // cutoff at max (bright snarl, more aggression)
const ENG_SMOOTH   = 0.035;  // param smoothing time-constant (s) — snappier for gear shifts
const ENG_FREQ_MUL = 3.0;    // frequency range: 1× → 4.0× (wider for dramatic gear drops)

// Oscillator bank: [waveform, harmonic, gain@idle, gain@max]
const OSC_DEFS = [
  { type: 'sawtooth', h: 1, gIdle: 0.30, gMax: 0.44 },  // fundamental rumble — wider dynamic swing
  { type: 'square',   h: 2, gIdle: 0.18, gMax: 0.35 },  // exhaust body — swells into growl
  { type: 'sawtooth', h: 4, gIdle: 0.04, gMax: 0.24 },  // firing-frequency chug — barely there at idle
  { type: 'sine',     h: 3, gIdle: 0.03, gMax: 0.14 },  // midrange growl — more body at speed
  { type: 'triangle', h: 6, gIdle: 0.00, gMax: 0.08 },  // high-harmonic snarl (rasp near redline)
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

/**
 * Pre-create engine audio nodes during loading (keeps engine muted).
 * Eliminates the 10-30ms node-creation stall that would otherwise hit
 * during the countdown overlay fade at T+500ms.
 */
export function preWarmEngine() {
  startEngineIdle();
  // Immediately mute — override the fade-in ramp
  if (_eMaster) {
    const c = getCtx();
    const t = c.currentTime;
    _eMaster.gain.cancelScheduledValues(t);
    _eMaster.gain.setValueAtTime(0, t);
  }
}

/** Start the V8 muscle engine at idle. Sustains until stopEngine(). */
export function startEngineIdle() {
  // If already pre-warmed, just fade in (skip expensive node creation)
  if (_eRunning && _eMaster) {
    const c = getCtx();
    const t = c.currentTime;
    _eMaster.gain.cancelScheduledValues(t);
    _eMaster.gain.setValueAtTime(_eMaster.gain.value, t);
    _eMaster.gain.linearRampToValueAtTime(ENG_IDLE_VOL, t + 0.5);
    return;
  }

  const c = getCtx();
  const t = c.currentTime;
  const out = getMaster();

  stopEngine();

  // Waveshaper — aggressive saturation for raw exhaust rasp
  _eDistort = c.createWaveShaper();
  _eDistort.curve = _makeDistortionCurve(4.5);
  _eDistort.oversample = '2x';

  // Lowpass — darker at idle, opens at speed
  _eFilter = c.createBiquadFilter();
  _eFilter.type = 'lowpass';
  _eFilter.frequency.setValueAtTime(ENG_FILT_LO, t);
  _eFilter.Q.setValueAtTime(1.4, t);

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
  _eLope.frequency.setValueAtTime(1.5, t);
  _eLopeGain = c.createGain();
  // At idle the lope swings master gain ±30% (0.07 * 0.30 = ±0.021)
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
  _eLope.frequency.setTargetAtTime(1.5 + s * 3.3, t, ENG_SMOOTH);
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
    // ── 1. Engine dip on shift — deeper cut, punchier re-engagement ──
    const prevGain = _eMaster.gain.value;
    _eMaster.gain.cancelScheduledValues(t);
    _eMaster.gain.setValueAtTime(prevGain, t);
    _eMaster.gain.linearRampToValueAtTime(prevGain * 0.40, t + 0.018);
    // Aggressive bounce — gear slams into engagement
    _eMaster.gain.linearRampToValueAtTime(prevGain * 1.30, t + 0.06);
    _eMaster.gain.setTargetAtTime(prevGain, t + 0.10, 0.05);

    // ── 2. Mechanical clunk — punchier, richer ──
    const clunkBuf = c.createBuffer(1, c.sampleRate * 0.04, c.sampleRate);
    const clunkData = clunkBuf.getChannelData(0);
    for (let i = 0; i < clunkData.length; i++) clunkData[i] = (Math.random() * 2 - 1);
    const clunk = c.createBufferSource();
    clunk.buffer = clunkBuf;
    const clunkBP = c.createBiquadFilter();
    clunkBP.type = 'bandpass';
    clunkBP.frequency.value = 500 + gearFrac * 500; // 500-1000Hz, wider low end
    clunkBP.Q.value = 2.5;
    const clunkGain = c.createGain();
    clunkGain.gain.setValueAtTime(0.16 + gearFrac * 0.06, t + 0.008);
    clunkGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    clunk.connect(clunkBP).connect(clunkGain).connect(out);
    clunk.start(t + 0.008);

    // ── 3. Turbo whoosh / air release — louder, more presence ──
    const whoosh = c.createBufferSource();
    const whooshLen = 0.10 + gearFrac * 0.08; // longer whoosh in higher gears
    const whooshBuf = c.createBuffer(1, c.sampleRate * whooshLen, c.sampleRate);
    const whooshData = whooshBuf.getChannelData(0);
    for (let i = 0; i < whooshData.length; i++) whooshData[i] = (Math.random() * 2 - 1) * 0.5;
    whoosh.buffer = whooshBuf;
    const whooshHP = c.createBiquadFilter();
    whooshHP.type = 'highpass';
    whooshHP.frequency.value = 1800 + gearFrac * 2200; // wider range, more audible in low gears
    whooshHP.Q.value = 0.7;
    const whooshGain = c.createGain();
    whooshGain.gain.setValueAtTime(0.08 + gearFrac * 0.06, t + 0.015);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, t + 0.015 + whooshLen);
    whoosh.connect(whooshHP).connect(whooshGain).connect(out);
    whoosh.start(t + 0.015);

    // ── 4. Thump — visceral low-end punch on engagement ──
    const thump = c.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(55 + gear * 12, t + 0.008);
    thump.frequency.exponentialRampToValueAtTime(30, t + 0.07);
    const thumpGain = c.createGain();
    thumpGain.gain.setValueAtTime(0.12, t + 0.008);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    thump.connect(thumpGain).connect(out);
    thump.start(t + 0.008);
    thump.stop(t + 0.10);

  } else {
    // ── DOWNSHIFT: aggressive rev-match blip + exhaust crackle ──

    // 1. RPM spikes up hard (rev-match blip)
    const prevGain = _eMaster.gain.value;
    _eMaster.gain.cancelScheduledValues(t);
    _eMaster.gain.setValueAtTime(prevGain, t);
    _eMaster.gain.linearRampToValueAtTime(prevGain * 1.45, t + 0.025);
    _eMaster.gain.setTargetAtTime(prevGain, t + 0.08, 0.04);

    for (const e of _eOscs) {
      const curr = e.osc.frequency.value;
      e.osc.frequency.cancelScheduledValues(t);
      e.osc.frequency.setValueAtTime(curr, t);
      e.osc.frequency.linearRampToValueAtTime(curr * 1.50, t + 0.025);
      e.osc.frequency.setTargetAtTime(curr, t + 0.06, 0.04);
    }

    // 2. Filter spike — brighter, more aggressive exhaust bark
    const prevCut = _eFilter.frequency.value;
    _eFilter.frequency.cancelScheduledValues(t);
    _eFilter.frequency.setValueAtTime(prevCut, t);
    _eFilter.frequency.linearRampToValueAtTime(Math.min(prevCut * 2.0, 3800), t + 0.025);
    _eFilter.frequency.setTargetAtTime(prevCut, t + 0.08, 0.05);

    // 3. Exhaust crackle — louder, more pops
    for (let p = 0; p < 4; p++) {
      const popDelay = 0.025 + p * 0.03 + Math.random() * 0.015;
      const pop = c.createBufferSource();
      const popBuf = c.createBuffer(1, c.sampleRate * 0.022, c.sampleRate);
      const popData = popBuf.getChannelData(0);
      for (let i = 0; i < popData.length; i++) popData[i] = (Math.random() * 2 - 1);
      pop.buffer = popBuf;
      const popBP = c.createBiquadFilter();
      popBP.type = 'bandpass';
      popBP.frequency.value = 350 + Math.random() * 650;
      popBP.Q.value = 2.5 + Math.random();
      const popGain = c.createGain();
      popGain.gain.setValueAtTime(0.10 + Math.random() * 0.06, t + popDelay);
      popGain.gain.exponentialRampToValueAtTime(0.001, t + popDelay + 0.025);
      pop.connect(popBP).connect(popGain).connect(out);
      pop.start(t + popDelay);
    }

    // 4. Exhaust bark — low-mid thud on downshift
    const bark = c.createOscillator();
    bark.type = 'sawtooth';
    bark.frequency.setValueAtTime(120, t + 0.02);
    bark.frequency.exponentialRampToValueAtTime(60, t + 0.06);
    const barkDist = c.createWaveShaper();
    barkDist.curve = _makeDistortionCurve(8);
    const barkGain = c.createGain();
    barkGain.gain.setValueAtTime(0.10, t + 0.02);
    barkGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    bark.connect(barkDist).connect(barkGain).connect(out);
    bark.start(t + 0.02);
    bark.stop(t + 0.10);
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

/** Turbo boost — dramatic whoosh + turbo whistle + power surge */
export function playTurboBoost() {
  const c = getCtx();
  const t = c.currentTime;
  const out = getMaster();

  // 1. Whoosh — filtered noise burst rising in pitch
  const noise = c.createBufferSource();
  noise.buffer = getNoiseBuffer();
  noise.loop = true;
  const whooshBP = c.createBiquadFilter();
  whooshBP.type = 'bandpass';
  whooshBP.frequency.setValueAtTime(400, t);
  whooshBP.frequency.exponentialRampToValueAtTime(3000, t + 0.3);
  whooshBP.frequency.exponentialRampToValueAtTime(1500, t + 0.8);
  whooshBP.Q.value = 1.5;
  const whooshG = c.createGain();
  whooshG.gain.setValueAtTime(0, t);
  whooshG.gain.linearRampToValueAtTime(0.15, t + 0.08);
  whooshG.gain.setValueAtTime(0.15, t + 0.25);
  whooshG.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
  noise.connect(whooshBP).connect(whooshG).connect(out);
  noise.start(t);
  noise.stop(t + 0.9);

  // 2. Turbo whistle — rising sine tone
  const whistle = c.createOscillator();
  whistle.type = 'sine';
  whistle.frequency.setValueAtTime(600, t);
  whistle.frequency.exponentialRampToValueAtTime(2200, t + 0.4);
  whistle.frequency.exponentialRampToValueAtTime(1800, t + 1.0);
  const whistleG = c.createGain();
  whistleG.gain.setValueAtTime(0, t);
  whistleG.gain.linearRampToValueAtTime(0.08, t + 0.1);
  whistleG.gain.setValueAtTime(0.08, t + 0.4);
  whistleG.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
  whistle.connect(whistleG).connect(out);
  whistle.start(t);
  whistle.stop(t + 1.3);

  // 3. Power thump — deep bass hit
  const thump = c.createOscillator();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(80, t);
  thump.frequency.exponentialRampToValueAtTime(30, t + 0.2);
  const thumpG = c.createGain();
  thumpG.gain.setValueAtTime(0.20, t);
  thumpG.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  thump.connect(thumpG).connect(out);
  thump.start(t);
  thump.stop(t + 0.35);

  // 4. Turbo flutter — rapid pulsing at tail end
  const flutter = c.createOscillator();
  flutter.type = 'sawtooth';
  flutter.frequency.setValueAtTime(1200, t + 0.3);
  flutter.frequency.exponentialRampToValueAtTime(400, t + 0.8);
  const flutterG = c.createGain();
  flutterG.gain.setValueAtTime(0, t + 0.3);
  flutterG.gain.linearRampToValueAtTime(0.05, t + 0.35);
  flutterG.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
  const flutterLFO = c.createOscillator();
  flutterLFO.frequency.value = 25;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 0.05;
  flutterLFO.connect(lfoGain).connect(flutterG.gain);
  flutter.connect(flutterG).connect(out);
  flutterLFO.start(t + 0.3);
  flutterLFO.stop(t + 1.0);
  flutter.start(t + 0.3);
  flutter.stop(t + 1.0);
}

/** Exhaust overrun pop — crackle during deceleration / engine braking */
export function playOverrunPop() {
  const c = getCtx();
  const t = c.currentTime;
  const out = getMaster();

  // 1-3 staggered pops with random timing
  const count = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const delay = i * (0.04 + Math.random() * 0.06);
    const pop = c.createBufferSource();
    const popBuf = c.createBuffer(1, c.sampleRate * 0.025, c.sampleRate);
    const data = popBuf.getChannelData(0);
    for (let j = 0; j < data.length; j++) data[j] = (Math.random() * 2 - 1);
    pop.buffer = popBuf;

    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 250 + Math.random() * 500;
    bp.Q.value = 2 + Math.random() * 2;

    const g = c.createGain();
    g.gain.setValueAtTime(0.08 + Math.random() * 0.06, t + delay);
    g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.035);

    pop.connect(bp).connect(g).connect(out);
    pop.start(t + delay);
  }
}

/** Throttle pickup growl — intake rush + exhaust punch on throttle from coast */
export function playAccelSurge() {
  if (!_eRunning) return;
  const c = getCtx();
  const t = c.currentTime;
  const out = getMaster();

  // Intake rush — high-frequency noise swoosh
  const noise = c.createBufferSource();
  noise.buffer = getNoiseBuffer();
  const hp = c.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(1200, t);
  hp.frequency.exponentialRampToValueAtTime(3000, t + 0.08);
  const nG = c.createGain();
  nG.gain.setValueAtTime(0.06, t);
  nG.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  noise.connect(hp).connect(nG).connect(out);
  noise.start(t);

  // Low exhaust punch — distorted sawtooth bark
  const punch = c.createOscillator();
  punch.type = 'sawtooth';
  punch.frequency.setValueAtTime(70, t);
  punch.frequency.exponentialRampToValueAtTime(110, t + 0.06);
  const pDist = c.createWaveShaper();
  pDist.curve = _makeDistortionCurve(6);
  const pG = c.createGain();
  pG.gain.setValueAtTime(0.08, t);
  pG.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
  punch.connect(pDist).connect(pG).connect(out);
  punch.start(t);
  punch.stop(t + 0.12);
}

/** Haptic feedback (mobile vibration) */
export function haptic(ms = 15) {
  if (navigator.vibrate) navigator.vibrate(ms);
}
