// Procedural audio using Web Audio API — no files needed.
let ctx = null;
let masterGain = null;
let noiseBuffer = null; // reused across all crackle sounds

// --- Background music ---
let musicEl = null;  // current <audio> element
let _cancelPendingRetry = null; // cancels a blocked-autoplay retry

// Legacy single-file tracks (menu + completion only)
const MUSIC_TRACKS = {
  menu:      'title.mp3',
  qualified: 'qualified.mp3',
};

// Per-map soundtrack pools — each entry: { file, title, artist, cover, startTime }
// Indexed by MAP_THEMES order: 0=brazil, 1=usa, 2=peru, 3=shanghai, 4=delhi, 5=momo
const MAP_SOUNDTRACK_POOLS = [
  // 0: Brazil (Rio de Janeiro)
  [
    { file: 'Fast-Furious_Tokyo-Drift.mp3', title: 'Tokyo Drift (Fast & Furious)', artist: 'Teriyaki Boyz', cover: 'Fast-Furious_Tokyo-Drift.webp', startTime: 0 },
    { file: 'Lady-Gaga_Bad-Romance.mp3', title: 'Bad Romance', artist: 'Lady Gaga', cover: 'Lady-Gaga_Bad-Romance.webp', startTime: 154 },
    { file: 'Six-Days.mp3', title: 'Six Days', artist: 'DJ Shadow', cover: 'Six-Days.webp', startTime: 22 },
    { file: 'New-Order_Blue-Monday.mp3', title: 'Blue Monday', artist: 'New Order', cover: 'New-Order_Blue-Monday.webp', startTime: 22 },
    { file: 'Zara-Larsson_Lush-Life.mp3', title: 'Lush Life', artist: 'Zara Larsson', cover: 'Zara-Larsson_Lush-Life.webp', startTime: 106 },
  ],
  // 1: USA (Chicago)
  [
    { file: 'Taylor-Swift_The-Fate-of-Ophelia.mp3', title: 'The Fate of Ophelia', artist: 'Taylor Swift', cover: 'Taylor-Swift_The-Fate-of-Ophelia.webp', startTime: 122 },
    { file: 'Benson-Boone_Mystical-Magical.mp3', title: 'Mystical Magical', artist: 'Benson Boone', cover: 'Benson-Boone_Mystical-Magical.webp', startTime: 103 },
    { file: 'Kanye-West_Cant-Tell-Me-Nothing.mp3', title: "Can't Tell Me Nothing", artist: 'Kanye West', cover: 'Kanye-West_Cant-Tell-Me-Nothing.webp', startTime: 0 },
    { file: 'Laura-Branigan_Self-Control.mp3', title: 'Self Control', artist: 'Laura Branigan', cover: 'Laura-Branigan_Self-Control.webp', startTime: 89 },
    { file: 'Olly-Alexander_Years-Years.mp3', title: 'Years & Years', artist: 'Olly Alexander', cover: 'Olly-Alexander_Years-Years.webp', startTime: 0 },
    { file: 'Rihann_Only-Girl.mp3', title: 'Only Girl (In the World)', artist: 'Rihanna', cover: 'Rihann_Only-Girl.webp', startTime: 0 },
    { file: 'Empire-of-the-Sun_We-Are-The-People.mp3', title: 'We Are the People', artist: 'Empire of the Sun', cover: 'Empire-of-the-Sun_We-Are-The-People.webp', startTime: 92 },
    { file: 'Zara-Larsson_Lush-Life.mp3', title: 'Lush Life', artist: 'Zara Larsson', cover: 'Zara-Larsson_Lush-Life.webp', startTime: 106 },
  ],
  // 2: Peru (Cuzco)
  [
    { file: 'Empire-of-the-Sun_We-Are-The-People.mp3', title: 'We Are the People', artist: 'Empire of the Sun', cover: 'Empire-of-the-Sun_We-Are-The-People.webp', startTime: 92 },
    { file: 'Tame-Impala_Borderline.mp3', title: 'Borderline', artist: 'Tame Impala', cover: 'Tame-Impala_Borderline.webp', startTime: 88 },
    { file: 'Tame-Impala-Dracula.mp3', title: 'Dracula', artist: 'Tame Impala', cover: 'Tame-Impala-Dracula.webp', startTime: 28 },
    { file: 'Laura-Branigan_Self-Control.mp3', title: 'Self Control', artist: 'Laura Branigan', cover: 'Laura-Branigan_Self-Control.webp', startTime: 89 },
  ],
  // 3: Shanghai (China)
  [
    { file: 'Kendrick-Lamar-SZA_luther.mp3', title: 'luther', artist: 'Kendrick Lamar, SZA', cover: 'Kendrick-Lamar-SZA_luther.webp', startTime: 33 },
    { file: 'Selena-Gomez_Love-You-Like-a-Love-Song.mp3', title: 'Love You Like a Love Song', artist: 'Selena Gomez', cover: 'Selena-Gomez_Love-You-Like-a-Love-Song.webp', startTime: 0 },
    { file: 'Tate-McRae_Its-ok-Im-ok.mp3', title: "It's OK I'm OK", artist: 'Tate McRae', cover: 'Tate-McRae_Its-ok-Im-ok.webp', startTime: 41 },
    { file: 'Tate-McRae_Just-Keep-Watching.mp3', title: 'Just Keep Watching', artist: 'Tate McRae', cover: 'Tate-McRae_Just-Keep-Watching.webp', startTime: 24 },
    { file: 'Zara-Larsson_Stateside.mp3', title: 'Stateside', artist: 'PinkPantheress, Zara Larsson', cover: 'Zara-Larsson_Stateside.webp', startTime: 135 },
  ],
  // 4: Delhi (India)
  [
    { file: 'Elvis-Presley_Burning-Love.mp3', title: 'Burning Love', artist: 'Elvis Presley', cover: 'Elvis-Presley_Burning-Love.webp', startTime: 0 },
    { file: 'Push-It-To-The-Limit.mp3', title: 'Push It to the Limit', artist: 'Paul Engemann', cover: 'Push-It-To-The-Limit.webp', startTime: 0 },
    { file: 'Laura-Branigan_Self-Control.mp3', title: 'Self Control', artist: 'Laura Branigan', cover: 'Laura-Branigan_Self-Control.webp', startTime: 89 },
  ],
  // 5: Momo's World
  [
    { file: 'APT.mp3', title: 'APT.', artist: 'ROSÉ & Bruno Mars', cover: 'APT-Rose.webp', startTime: 0 },
    { file: 'Gracie-Abrams_Thats-So-True.mp3', title: "That's So True", artist: 'Gracie Abrams', cover: 'Gracie-Abrams_Thats-So-True.webp', startTime: 71 },
    { file: 'Billie-Eilish_Birds-of-a-Feather.mp3', title: 'Birds of a Feather', artist: 'Billie Eilish', cover: 'Billie-Eilish_Birds-of-a-Feather.webp', startTime: 41 },
    { file: 'Dave-Raindance.mp3', title: 'Raindance', artist: 'Dave ft. Tems', cover: 'Dave-Raindance.webp', startTime: 144 },
    { file: 'Ravyn-Lenae_Love-Me-Not.mp3', title: 'Love Me Not', artist: 'Ravyn Lenae', cover: 'Ravyn-Lenae_Love-Me-Not.webp', startTime: 42 },
    { file: 'Taylor-Swift_The-Fate-of-Ophelia.mp3', title: 'The Fate of Ophelia', artist: 'Taylor Swift', cover: 'Taylor-Swift_The-Fate-of-Ophelia.webp', startTime: 122 },
  ],
];

// Anti-repeat: track last-played file per map
const _lastPlayedPerMap = new Array(MAP_SOUNDTRACK_POOLS.length).fill(null);

function _pickRandomTrack(mapIndex) {
  const pool = MAP_SOUNDTRACK_POOLS[mapIndex];
  if (!pool || pool.length === 0) return null;
  if (pool.length === 1) return pool[0];
  const lastFile = _lastPlayedPerMap[mapIndex];
  const candidates = lastFile ? pool.filter(t => t.file !== lastFile) : pool;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  _lastPlayedPerMap[mapIndex] = pick.file;
  return pick;
}

// Volume fade-in helper
let _fadeInterval = null;

function _fadeInVolume(el, targetVol, durationMs) {
  if (_fadeInterval) clearInterval(_fadeInterval);
  const steps = 20;
  const stepMs = durationMs / steps;
  const stepVol = targetVol / steps;
  let currentVol = 0;
  el.volume = 0;
  _fadeInterval = setInterval(() => {
    currentVol = Math.min(currentVol + stepVol, targetVol);
    el.volume = currentVol;
    if (currentVol >= targetVol) {
      clearInterval(_fadeInterval);
      _fadeInterval = null;
    }
  }, stepMs);
}

/** Play a legacy background music track by key (menu/qualified only). */
export function playMusic(key) {
  if (!(key in MUSIC_TRACKS)) return;

  if (_cancelPendingRetry) {
    _cancelPendingRetry();
    _cancelPendingRetry = null;
  }

  if (musicEl && !musicEl.paused && musicEl._trackKey === key) return;

  _stopMusic();

  const file = MUSIC_TRACKS[key];
  if (!file) return;

  const el = new Audio();
  el._trackKey = key;
  el.src = (import.meta.env.BASE_URL || '/') + 'audio/' + file;
  el.loop = true;
  el.volume = 0.45;
  musicEl = el;

  el.play().catch(() => {
    const retry = () => { playMusic(key); };
    window.addEventListener('pointerdown', retry, { once: true });
    window.addEventListener('keydown',     retry, { once: true });
    _cancelPendingRetry = () => {
      window.removeEventListener('pointerdown', retry);
      window.removeEventListener('keydown',     retry);
    };
  });
}

/**
 * Play a random soundtrack for the given map index.
 * Returns track metadata { title, artist, cover } for the "Now Playing" widget,
 * or null if no pool exists for this map.
 */
export function playMapMusic(mapIndex) {
  if (_cancelPendingRetry) {
    _cancelPendingRetry();
    _cancelPendingRetry = null;
  }

  _stopMusic();

  const track = _pickRandomTrack(mapIndex);
  if (!track) return null;

  _playTrackFile(track);

  return {
    title: track.title,
    artist: track.artist,
    cover: (import.meta.env.BASE_URL || '/') + 'soundtracks/' + track.cover,
  };
}

function _playTrackFile(track) {
  const el = new Audio();
  el._trackKey = 'map_track';
  el.src = (import.meta.env.BASE_URL || '/') + 'soundtracks/' + track.file;
  el.loop = true;
  el.volume = 0;
  if (track.startTime > 0) el.currentTime = track.startTime;
  musicEl = el;

  el.play().then(() => {
    _fadeInVolume(el, 0.7, 1500);
  }).catch(() => {
    const retry = () => {
      _stopMusic();
      _playTrackFile(track);
    };
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
  if (_fadeInterval) { clearInterval(_fadeInterval); _fadeInterval = null; }
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
const ENG_IDLE_VOL = 0.11;   // master gain at idle — strong rumble presence
const ENG_MAX_VOL  = 0.40;   // master gain at max rev — punchy, commanding at speed
const ENG_FILT_LO  = 240;    // lowpass cutoff at idle (dark muffled rumble)
const ENG_FILT_HI  = 4200;   // cutoff at max (bright aggressive snarl)
const ENG_SMOOTH   = 0.035;  // param smoothing time-constant (s) — snappier for gear shifts
const ENG_FREQ_MUL = 3.0;    // frequency range: 1× → 4.0× (wider for dramatic gear drops)

// Oscillator bank: [waveform, harmonic, gain@idle, gain@max]
const OSC_DEFS = [
  { type: 'sawtooth', h: 1, gIdle: 0.34, gMax: 0.50 },  // fundamental rumble — beefy presence
  { type: 'square',   h: 2, gIdle: 0.22, gMax: 0.40 },  // exhaust body — thick growl
  { type: 'sawtooth', h: 4, gIdle: 0.05, gMax: 0.28 },  // firing-frequency chug — punchy at speed
  { type: 'sine',     h: 3, gIdle: 0.04, gMax: 0.18 },  // midrange growl — fills the spectrum
  { type: 'triangle', h: 6, gIdle: 0.00, gMax: 0.10 },  // high-harmonic snarl (rasp near redline)
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
let _turboWhine = null;       // sustained turbo whine oscillator
let _turboWhineGain = null;
let _turboWhineFilter = null;
let _turboBoostActive = false;

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
  // Clean up turbo whine if running
  if (_turboWhine) { try { _turboWhine.stop(); } catch (_) {} _turboWhine.disconnect(); _turboWhine = null; }
  if (_turboWhineFilter) { _turboWhineFilter.disconnect(); _turboWhineFilter = null; }
  if (_turboWhineGain) { _turboWhineGain.disconnect(); _turboWhineGain = null; }
  _turboBoostActive = false;
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

  // Filter opens with speed (+ extra brightness during turbo)
  const turboFilterBoost = _turboBoostActive ? 800 : 0;
  const fCut = ENG_FILT_LO + (ENG_FILT_HI - ENG_FILT_LO) * s + turboFilterBoost;
  _eFilter.frequency.setTargetAtTime(fCut, t, ENG_SMOOTH);

  // Master volume (+ 25% boost during turbo)
  const turboGainMul = _turboBoostActive ? 1.25 : 1.0;
  const vol = (ENG_IDLE_VOL + (ENG_MAX_VOL - ENG_IDLE_VOL) * s) * turboGainMul;
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
    clunkGain.gain.setValueAtTime(0.22 + gearFrac * 0.08, t + 0.008);
    clunkGain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);
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
    whooshGain.gain.setValueAtTime(0.12 + gearFrac * 0.08, t + 0.015);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, t + 0.015 + whooshLen);
    whoosh.connect(whooshHP).connect(whooshGain).connect(out);
    whoosh.start(t + 0.015);

    // ── 4. Thump — visceral low-end punch on engagement ──
    const thump = c.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(55 + gear * 12, t + 0.008);
    thump.frequency.exponentialRampToValueAtTime(30, t + 0.07);
    const thumpGain = c.createGain();
    thumpGain.gain.setValueAtTime(0.18, t + 0.008);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
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
      popGain.gain.setValueAtTime(0.14 + Math.random() * 0.08, t + popDelay);
      popGain.gain.exponentialRampToValueAtTime(0.001, t + popDelay + 0.03);
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
    barkGain.gain.setValueAtTime(0.16, t + 0.02);
    barkGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
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
  whooshG.gain.linearRampToValueAtTime(0.20, t + 0.08);
  whooshG.gain.setValueAtTime(0.20, t + 0.25);
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
  whistleG.gain.linearRampToValueAtTime(0.12, t + 0.1);
  whistleG.gain.setValueAtTime(0.12, t + 0.4);
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

/** Start sustained turbo engine boost — whine + engine intensity for duration of turbo */
export function startTurboEngine() {
  if (!_eRunning) return;
  _turboBoostActive = true;
  const c = getCtx();
  const t = c.currentTime;
  const out = getMaster();

  // Sustained supercharger whine — rising pitch that settles
  _turboWhine = c.createOscillator();
  _turboWhine.type = 'sawtooth';
  _turboWhine.frequency.setValueAtTime(800, t);
  _turboWhine.frequency.linearRampToValueAtTime(1500, t + 0.6);
  _turboWhine.frequency.setTargetAtTime(1300, t + 0.6, 0.5);

  _turboWhineFilter = c.createBiquadFilter();
  _turboWhineFilter.type = 'bandpass';
  _turboWhineFilter.frequency.value = 1200;
  _turboWhineFilter.Q.value = 4;

  _turboWhineGain = c.createGain();
  _turboWhineGain.gain.setValueAtTime(0, t);
  _turboWhineGain.gain.linearRampToValueAtTime(0.045, t + 0.4);

  _turboWhine.connect(_turboWhineFilter).connect(_turboWhineGain).connect(out);
  _turboWhine.start(t);
}

/** Stop sustained turbo engine boost — fade out whine, restore normal engine */
export function stopTurboEngine() {
  _turboBoostActive = false;
  if (_turboWhine) {
    const c = getCtx();
    const t = c.currentTime;
    _turboWhineGain.gain.cancelScheduledValues(t);
    _turboWhineGain.gain.setValueAtTime(_turboWhineGain.gain.value, t);
    _turboWhineGain.gain.setTargetAtTime(0, t, 0.12);
    const whine = _turboWhine;
    const whineF = _turboWhineFilter;
    const whineG = _turboWhineGain;
    setTimeout(() => {
      try { whine.stop(); } catch (_) {}
      whine.disconnect(); whineF.disconnect(); whineG.disconnect();
    }, 600);
    _turboWhine = null;
    _turboWhineFilter = null;
    _turboWhineGain = null;
  }
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
    g.gain.setValueAtTime(0.14 + Math.random() * 0.10, t + delay);
    g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.04);

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
  nG.gain.setValueAtTime(0.11, t);
  nG.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
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
  pG.gain.setValueAtTime(0.14, t);
  pG.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  punch.connect(pDist).connect(pG).connect(out);
  punch.start(t);
  punch.stop(t + 0.14);
}

/** Haptic feedback (mobile vibration) */
export function haptic(ms = 15) {
  if (navigator.vibrate) navigator.vibrate(ms);
}
