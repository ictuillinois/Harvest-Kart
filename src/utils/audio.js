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

/** Haptic feedback (mobile vibration) */
export function haptic(ms = 15) {
  if (navigator.vibrate) navigator.vibrate(ms);
}
