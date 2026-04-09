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
  shanghai:  null, // procedural — generated via Web Audio
  delhi:     null, // procedural — generated via Web Audio
  momo:      null, // procedural — generated via Web Audio
  qualified: 'qualified.mp3',
};

/** Play a background music track by key. */
export function playMusic(key) {
  if (!(key in MUSIC_TRACKS)) return;

  // Cancel any stale retry from a previous blocked playback attempt.
  if (_cancelPendingRetry) {
    _cancelPendingRetry();
    _cancelPendingRetry = null;
  }

  // Already playing the same track? Do nothing.
  if (musicEl && !musicEl.paused && musicEl._trackKey === key) return;
  if (_delhiSource && key === 'delhi') return;
  if (_shanghaiSource && key === 'shanghai') return;
  if (_momoSource && key === 'momo') return;

  _stopMusic();

  // Procedural tracks
  if (key === 'delhi') { _playDelhiMusic(); return; }
  if (key === 'shanghai') { _playShanghaiMusic(); return; }
  if (key === 'momo') { _playMomoMusic(); return; }

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
  _stopDelhiMusic();
  _stopShanghaiMusic();
  _stopMomoMusic();
}

// ═══════════════════════════════════════════════
//  DELHI — Procedural Rajasthani racing loop
//  5-second loop: electronic bass, drums, khartal clicks, flute motif
// ═══════════════════════════════════════════════
let _delhiSource = null;
let _delhiGain = null;
let _delhiBuffer = null;

function _generateDelhiBuffer() {
  const c = getCtx();
  const BPM = 140;
  const beatSec = 60 / BPM;
  const beats = 12; // ~5.14 seconds
  const duration = beats * beatSec;
  const sr = c.sampleRate;
  const len = Math.ceil(duration * sr);
  const buf = c.createBuffer(2, len, sr);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);

  // Helpers
  const write = (ch, startSec, freq, durSec, vol, type, attack, decay) => {
    const s = Math.floor(startSec * sr);
    const e = Math.min(s + Math.floor(durSec * sr), len);
    const aLen = Math.floor(attack * sr);
    const dStart = e - Math.floor(decay * sr);
    for (let i = s; i < e; i++) {
      const t = (i - s) / sr;
      let sample;
      if (type === 'sin') sample = Math.sin(2 * Math.PI * freq * t);
      else if (type === 'saw') sample = 2 * ((freq * t) % 1) - 1;
      else if (type === 'sq') sample = Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1;
      else if (type === 'tri') sample = 2 * Math.abs(2 * ((freq * t) % 1) - 1) - 1;
      else if (type === 'noise') sample = Math.random() * 2 - 1;
      else sample = Math.sin(2 * Math.PI * freq * t);
      // Envelope
      let env = 1;
      if (i - s < aLen) env = (i - s) / aLen;
      if (i > dStart) env *= (e - i) / (e - dStart);
      sample *= vol * env;
      if (ch === 0 || ch === 2) L[i % len] += sample;
      if (ch === 1 || ch === 2) R[i % len] += sample;
    }
  };

  // ═══════════════════════════════════════
  //  PURE PUNJABI BHANGRA — heavy dhol, tumbi, chimta, bass drops
  // ═══════════════════════════════════════

  // ── DHOL — the backbone. Heavy bass side (Ghe) + treble side (Ke/Na) ──
  // Classic bhangra chaal pattern
  const dholGhe = [ // bass hits
    { b: 0, v: 0.6 },
    { b: 0.25, v: 0.3 },   // dha-ghe bounce
    { b: 1.5, v: 0.4 },
    { b: 2, v: 0.55 },
    { b: 2.25, v: 0.25 },
    { b: 3, v: 0.6 },
    { b: 3.25, v: 0.3 },
    { b: 4, v: 0.55 },
    { b: 4.5, v: 0.35 },
    { b: 5, v: 0.4 },
    { b: 6, v: 0.6 },
    { b: 6.25, v: 0.3 },
    { b: 7, v: 0.45 },
    { b: 7.5, v: 0.3 },
    { b: 8, v: 0.55 },
    { b: 8.25, v: 0.25 },
    { b: 9, v: 0.6 },
    { b: 9.25, v: 0.3 },
    { b: 10, v: 0.5 },
    // fill into loop
    { b: 10.5, v: 0.35 }, { b: 10.75, v: 0.4 },
    { b: 11, v: 0.45 }, { b: 11.25, v: 0.35 }, { b: 11.5, v: 0.5 }, { b: 11.75, v: 0.4 },
  ];
  for (const h of dholGhe) {
    const t = h.b * beatSec;
    write(2, t, 55, 0.16, h.v, 'sin', 0.002, 0.13);       // deep boom
    write(2, t, 110, 0.04, h.v * 0.5, 'sin', 0.001, 0.03); // punch
    write(2, t, 40, 0.08, h.v * 0.3, 'sin', 0.002, 0.06);  // sub rumble
  }

  const dholKe = [ // treble stick hits
    { b: 0.5, v: 0.3 }, { b: 1, v: 0.35 }, { b: 1.75, v: 0.2 },
    { b: 2.5, v: 0.3 }, { b: 3.5, v: 0.35 }, { b: 4.25, v: 0.25 },
    { b: 5, v: 0.35 }, { b: 5.5, v: 0.25 }, { b: 5.75, v: 0.2 },
    { b: 6.5, v: 0.3 }, { b: 7.25, v: 0.25 },
    { b: 8.5, v: 0.3 }, { b: 9.5, v: 0.35 }, { b: 9.75, v: 0.2 },
  ];
  for (const h of dholKe) {
    const t = h.b * beatSec;
    write(2, t, 300, 0.05, h.v, 'noise', 0.001, 0.04);     // sharp crack
    write(2, t, 500, 0.03, h.v * 0.5, 'tri', 0.001, 0.02); // ring
  }

  // ── TUMBI — the iconic Punjabi one-string (Mundian Tu Bach Ke vibe) ──
  const tumbiNotes = [
    { b: 0, note: 587.3 },     // D5
    { b: 0.75, note: 523.3 },  // C5
    { b: 1.5, note: 440 },     // A4
    { b: 2, note: 587.3 },     // D5
    { b: 3, note: 659.3 },     // E5
    { b: 3.5, note: 587.3 },   // D5
    { b: 4, note: 523.3 },     // C5
    { b: 4.75, note: 440 },    // A4
    { b: 5.5, note: 523.3 },   // C5
    { b: 6, note: 587.3 },     // D5
    { b: 6.75, note: 659.3 },  // E5
    { b: 7.5, note: 587.3 },   // D5
    { b: 8, note: 523.3 },     // C5
    { b: 8.5, note: 440 },     // A4
    { b: 9, note: 587.3 },     // D5
    { b: 9.75, note: 659.3 },  // E5
    { b: 10.5, note: 587.3 },  // D5
    { b: 11, note: 523.3 },    // C5
    { b: 11.5, note: 587.3 },  // D5 (pickup)
  ];
  for (const tn of tumbiNotes) {
    const t = tn.b * beatSec;
    write(2, t, tn.note, 0.14, 0.2, 'saw', 0.002, 0.12);         // bright twang
    write(2, t, tn.note * 2.01, 0.07, 0.08, 'sq', 0.002, 0.06);  // nasal harmonic
    write(2, t, tn.note * 0.998, 0.1, 0.05, 'sin', 0.003, 0.08); // buzz detune
    write(2, t, tn.note * 3, 0.04, 0.03, 'sin', 0.001, 0.03);    // high twang
  }

  // ── CHIMTA — fire tongs jingle (every upbeat + extra on fills) ──
  const chimtaBeats = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5,
                       10.75, 11.25, 11.75]; // extra on fill
  for (const b of chimtaBeats) {
    const t = b * beatSec;
    write(0, t, 7000, 0.04, 0.1, 'sq', 0.001, 0.035);
    write(1, t, 9000, 0.03, 0.07, 'sin', 0.001, 0.025);
    write(2, t, 5500, 0.05, 0.05, 'noise', 0.001, 0.04);
  }

  // ── ELECTRONIC BASS — 808-style sub bass on root notes ──
  const bassHits = [
    { b: 0, note: 73.4 },    // D2
    { b: 2, note: 73.4 },
    { b: 3, note: 65.4 },    // C2
    { b: 4, note: 73.4 },
    { b: 6, note: 82.4 },    // E2
    { b: 7, note: 73.4 },
    { b: 8, note: 73.4 },
    { b: 9, note: 65.4 },
    { b: 10, note: 73.4 },
    { b: 11, note: 82.4 },
  ];
  for (const bh of bassHits) {
    const t = bh.b * beatSec;
    write(2, t, bh.note, beatSec * 0.9, 0.3, 'sin', 0.005, 0.15);  // deep 808
    write(2, t, bh.note * 2, beatSec * 0.5, 0.12, 'saw', 0.005, 0.1); // grit
  }

  // ── CLAPS — crowd energy on 2 and 4 pattern ──
  for (const b of [2, 4, 6, 8, 10]) {
    const t = b * beatSec;
    write(2, t, 2000, 0.04, 0.22, 'noise', 0.001, 0.035);
    write(2, t + 0.008, 3000, 0.03, 0.12, 'noise', 0.001, 0.025);
  }

  // ── HI-HAT — 16th notes, accented for drive ──
  for (let b = 0; b < beats * 4; b++) {
    const t = b * beatSec / 4;
    const v = b % 4 === 0 ? 0.1 : b % 2 === 0 ? 0.06 : 0.04;
    write(2, t, 10000, 0.018, v, 'noise', 0.001, 0.014);
  }

  // ── SYNTH HORN STAB — bhangra brass hits for hype ──
  for (const b of [0, 4, 8]) {
    const t = b * beatSec;
    write(2, t, 293.7, 0.15, 0.18, 'saw', 0.005, 0.12);   // D4
    write(2, t, 440, 0.15, 0.12, 'saw', 0.005, 0.12);     // A4
    write(2, t, 587.3, 0.12, 0.08, 'saw', 0.005, 0.10);   // D5
    write(2, t, 293.7 * 1.005, 0.12, 0.06, 'sq', 0.005, 0.10); // detune width
  }

  // ── ALGOZA (double flute) — short melody between tumbi phrases ──
  const algoza = [
    { b: 1, note: 880, dur: 0.15 },     // A5
    { b: 1.25, note: 784, dur: 0.12 },  // G5
    { b: 5, note: 880, dur: 0.15 },
    { b: 5.25, note: 784, dur: 0.12 },
    { b: 7, note: 880, dur: 0.2 },
    { b: 7.5, note: 784, dur: 0.15 },
    { b: 7.75, note: 698.5, dur: 0.12 },// F5
    { b: 11, note: 880, dur: 0.15 },
    { b: 11.25, note: 784, dur: 0.12 },
  ];
  for (const a of algoza) {
    const t = a.b * beatSec;
    write(2, t, a.note, a.dur, 0.1, 'tri', 0.01, 0.06);
    write(2, t, a.note * 1.005, a.dur, 0.05, 'sin', 0.01, 0.05); // second pipe detune
  }

  // Normalize to prevent clipping
  let maxL = 0, maxR = 0;
  for (let i = 0; i < len; i++) {
    if (Math.abs(L[i]) > maxL) maxL = Math.abs(L[i]);
    if (Math.abs(R[i]) > maxR) maxR = Math.abs(R[i]);
  }
  const peak = Math.max(maxL, maxR, 0.01);
  const norm = 0.85 / peak;
  for (let i = 0; i < len; i++) { L[i] *= norm; R[i] *= norm; }

  return buf;
}

function _playDelhiMusic() {
  _stopDelhiMusic();
  const c = getCtx();
  if (!_delhiBuffer) _delhiBuffer = _generateDelhiBuffer();
  _delhiGain = c.createGain();
  _delhiGain.gain.value = 0.45;
  _delhiGain.connect(c.destination);
  _delhiSource = c.createBufferSource();
  _delhiSource.buffer = _delhiBuffer;
  _delhiSource.loop = true;
  _delhiSource.connect(_delhiGain);
  _delhiSource.start();
}

function _stopDelhiMusic() {
  if (_delhiSource) {
    try { _delhiSource.stop(); } catch (_) {}
    _delhiSource.disconnect();
    _delhiSource = null;
  }
  if (_delhiGain) {
    _delhiGain.disconnect();
    _delhiGain = null;
  }
}

// ═══════════════════════════════════════════════
//  SHANGHAI — Chinese pentatonic racing loop
//  Erhu melody, guzheng plucks, electronic drums, pentatonic bass
// ═══════════════════════════════════════════════
let _shanghaiSource = null;
let _shanghaiGain = null;
let _shanghaiBuffer = null;

function _generateShanghaiBuffer() {
  const c = getCtx();
  const BPM = 138;
  const beatSec = 60 / BPM;
  const beats = 12;
  const duration = beats * beatSec;
  const sr = c.sampleRate;
  const len = Math.ceil(duration * sr);
  const buf = c.createBuffer(2, len, sr);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);

  const write = (ch, startSec, freq, durSec, vol, type, attack, decay) => {
    const s = Math.floor(startSec * sr);
    const e = Math.min(s + Math.floor(durSec * sr), len);
    const aLen = Math.floor(attack * sr);
    const dStart = e - Math.floor(decay * sr);
    for (let i = s; i < e; i++) {
      const t = (i - s) / sr;
      let sample;
      if (type === 'sin') sample = Math.sin(2 * Math.PI * freq * t);
      else if (type === 'saw') sample = 2 * ((freq * t) % 1) - 1;
      else if (type === 'sq') sample = Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1;
      else if (type === 'tri') sample = 2 * Math.abs(2 * ((freq * t) % 1) - 1) - 1;
      else if (type === 'noise') sample = Math.random() * 2 - 1;
      else sample = Math.sin(2 * Math.PI * freq * t);
      let env = 1;
      if (i - s < aLen) env = (i - s) / aLen;
      if (i > dStart) env *= (e - i) / (e - dStart);
      sample *= vol * env;
      if (ch === 0 || ch === 2) L[i % len] += sample;
      if (ch === 1 || ch === 2) R[i % len] += sample;
    }
  };

  // Chinese pentatonic scale: C D E G A (no F or B)
  // C4=261.6, D4=293.7, E4=329.6, G4=392, A4=440

  // ── KICK — punchy electronic ──
  const kickBeats = [0, 2, 3, 4, 6, 7, 8, 10, 11];
  for (const b of kickBeats) {
    const t = b * beatSec;
    write(2, t, 55, 0.14, 0.5, 'sin', 0.002, 0.11);
    write(2, t, 110, 0.03, 0.3, 'sin', 0.001, 0.025);
  }

  // ── HI-HAT — 16th notes ──
  for (let b = 0; b < beats * 4; b++) {
    const t = b * beatSec / 4;
    const v = b % 4 === 0 ? 0.1 : b % 2 === 0 ? 0.06 : 0.035;
    write(2, t, 10000, 0.018, v, 'noise', 0.001, 0.014);
  }

  // ── CLAP on 2 and 6 ──
  for (const b of [2, 6, 10]) {
    const t = b * beatSec;
    write(2, t, 2000, 0.04, 0.18, 'noise', 0.001, 0.035);
  }

  // ── BASS — pentatonic root pattern ──
  const bassNotes = [130.8, 130.8, 146.8, 130.8, 196, 196, 146.8, 130.8, 130.8, 196, 220, 196];
  for (let b = 0; b < beats; b++) {
    const t = b * beatSec;
    write(2, t, bassNotes[b], beatSec * 0.75, 0.28, 'saw', 0.008, 0.12);
    write(2, t, bassNotes[b] / 2, beatSec * 0.6, 0.2, 'sin', 0.008, 0.12);
  }

  // ── GUZHENG PLUCKS — fast pentatonic arpeggio (bright, metallic) ──
  const guzhengNotes = [
    { b: 0, note: 523.3 },     // C5
    { b: 0.5, note: 587.3 },   // D5
    { b: 1, note: 659.3 },     // E5
    { b: 1.75, note: 784 },    // G5
    { b: 2.5, note: 880 },     // A5
    { b: 3, note: 784 },       // G5
    { b: 3.5, note: 659.3 },   // E5
    { b: 4, note: 523.3 },     // C5
    { b: 4.75, note: 587.3 },  // D5
    { b: 5.5, note: 784 },     // G5
    { b: 6, note: 880 },       // A5
    { b: 6.5, note: 1046.5 },  // C6
    { b: 7, note: 880 },       // A5
    { b: 7.5, note: 784 },     // G5
    { b: 8, note: 659.3 },     // E5
    { b: 8.75, note: 523.3 },  // C5
    { b: 9.5, note: 587.3 },   // D5
    { b: 10, note: 784 },      // G5
    { b: 10.5, note: 880 },    // A5
    { b: 11, note: 784 },      // G5
    { b: 11.5, note: 659.3 },  // E5
  ];
  for (const gn of guzhengNotes) {
    const t = gn.b * beatSec;
    // Bright metallic pluck
    write(2, t, gn.note, 0.16, 0.16, 'tri', 0.002, 0.14);
    write(2, t, gn.note * 2, 0.08, 0.05, 'sin', 0.001, 0.07);
    // Sympathetic ring
    write(2, t, gn.note * 1.005, 0.1, 0.04, 'sin', 0.003, 0.08);
  }

  // ── ERHU — singing melody (long sustained notes with vibrato) ──
  const erhuNotes = [
    { b: 0, note: 523.3, dur: 0.5 },    // C5
    { b: 1, note: 659.3, dur: 0.4 },    // E5
    { b: 2, note: 784, dur: 0.6 },      // G5 (long)
    { b: 3.5, note: 880, dur: 0.4 },    // A5
    { b: 4.5, note: 784, dur: 0.5 },    // G5
    { b: 5.5, note: 659.3, dur: 0.35 }, // E5
    // Response
    { b: 6.5, note: 880, dur: 0.5 },    // A5
    { b: 7.5, note: 1046.5, dur: 0.4 }, // C6
    { b: 8.5, note: 880, dur: 0.55 },   // A5 (long)
    { b: 9.5, note: 784, dur: 0.35 },   // G5
    { b: 10.5, note: 659.3, dur: 0.4 }, // E5
    { b: 11.5, note: 523.3, dur: 0.35 },// C5 (pickup)
  ];
  for (const en of erhuNotes) {
    const t = en.b * beatSec;
    // Main tone (saw for nasal erhu quality)
    write(2, t, en.note, en.dur, 0.12, 'saw', 0.03, 0.08);
    // Vibrato (detuned wobble)
    write(2, t, en.note * 1.006, en.dur, 0.05, 'sin', 0.03, 0.08);
    // Soft octave below
    write(2, t, en.note * 0.5, en.dur * 0.5, 0.03, 'tri', 0.03, 0.06);
  }

  // ── GONG — on beat 0 (loop start marker) ──
  write(2, 0, 100, 0.8, 0.12, 'sin', 0.005, 0.7);
  write(2, 0, 200, 0.5, 0.06, 'sin', 0.005, 0.45);
  write(2, 0, 50, 0.6, 0.08, 'sin', 0.005, 0.5);

  // ── WOODBLOCK — rhythmic clicks (Chinese percussion) ──
  const woodBeats = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  for (const b of woodBeats) {
    const t = b * beatSec;
    write(2, t, 1200, 0.02, 0.1, 'sq', 0.001, 0.015);
    write(2, t + beatSec * 0.5, 1500, 0.015, 0.06, 'sq', 0.001, 0.012);
  }

  // ── CYMBALS — on beats 4 and 8 ──
  for (const b of [4, 8]) {
    const t = b * beatSec;
    write(2, t, 4000, 0.15, 0.06, 'noise', 0.001, 0.13);
    write(0, t, 6000, 0.1, 0.03, 'sin', 0.001, 0.08);
  }

  // Normalize
  let maxL = 0, maxR = 0;
  for (let i = 0; i < len; i++) {
    if (Math.abs(L[i]) > maxL) maxL = Math.abs(L[i]);
    if (Math.abs(R[i]) > maxR) maxR = Math.abs(R[i]);
  }
  const peak = Math.max(maxL, maxR, 0.01);
  const norm = 0.85 / peak;
  for (let i = 0; i < len; i++) { L[i] *= norm; R[i] *= norm; }

  return buf;
}

function _playShanghaiMusic() {
  _stopShanghaiMusic();
  const c = getCtx();
  if (!_shanghaiBuffer) _shanghaiBuffer = _generateShanghaiBuffer();
  _shanghaiGain = c.createGain();
  _shanghaiGain.gain.value = 0.45;
  _shanghaiGain.connect(c.destination);
  _shanghaiSource = c.createBufferSource();
  _shanghaiSource.buffer = _shanghaiBuffer;
  _shanghaiSource.loop = true;
  _shanghaiSource.connect(_shanghaiGain);
  _shanghaiSource.start();
}

function _stopShanghaiMusic() {
  if (_shanghaiSource) {
    try { _shanghaiSource.stop(); } catch (_) {}
    _shanghaiSource.disconnect();
    _shanghaiSource = null;
  }
  if (_shanghaiGain) {
    _shanghaiGain.disconnect();
    _shanghaiGain = null;
  }
}

// ═══════════════════════════════════════════════
//  MOMO'S WORLD — Whimsical sunset lullaby racing loop
//  Celesta melody, music box plucks, soft pads, playful percussion
// ═══════════════════════════════════════════════
let _momoSource = null;
let _momoGain = null;
let _momoBuffer = null;

function _generateMomoBuffer() {
  const c = getCtx();
  const BPM = 128;
  const beatSec = 60 / BPM;
  const beats = 16;
  const duration = beats * beatSec;
  const sr = c.sampleRate;
  const len = Math.ceil(duration * sr);
  const buf = c.createBuffer(2, len, sr);
  const L = buf.getChannelData(0);
  const R = buf.getChannelData(1);

  const write = (ch, startSec, freq, durSec, vol, type, attack, decay) => {
    const s = Math.floor(startSec * sr);
    const e = Math.min(s + Math.floor(durSec * sr), len);
    const aLen = Math.floor(attack * sr);
    const dStart = e - Math.floor(decay * sr);
    for (let i = s; i < e; i++) {
      const t = (i - s) / sr;
      let sample;
      if (type === 'sin') sample = Math.sin(2 * Math.PI * freq * t);
      else if (type === 'saw') sample = 2 * ((freq * t) % 1) - 1;
      else if (type === 'sq') sample = Math.sin(2 * Math.PI * freq * t) > 0 ? 1 : -1;
      else if (type === 'tri') sample = 2 * Math.abs(2 * ((freq * t) % 1) - 1) - 1;
      else if (type === 'noise') sample = Math.random() * 2 - 1;
      else sample = Math.sin(2 * Math.PI * freq * t);
      let env = 1;
      if (i - s < aLen) env = (i - s) / aLen;
      if (i > dStart) env *= (e - i) / (e - dStart);
      sample *= vol * env;
      if (ch === 0 || ch === 2) L[i % len] += sample;
      if (ch === 1 || ch === 2) R[i % len] += sample;
    }
  };

  // F major / D minor pentatonic — warm, playful, sunset feel
  // F4=349.2, G4=392, A4=440, C5=523.3, D5=587.3, F5=698.5

  // ── KICK — soft, bouncy ──
  const kickBeats = [0, 2, 4, 6, 8, 10, 12, 14];
  for (const b of kickBeats) {
    const t = b * beatSec;
    write(2, t, 60, 0.12, 0.35, 'sin', 0.002, 0.10);
    write(2, t, 120, 0.025, 0.2, 'sin', 0.001, 0.02);
  }

  // ── HI-HAT — light taps, 8th notes ──
  for (let b = 0; b < beats * 2; b++) {
    const t = b * beatSec / 2;
    const v = b % 2 === 0 ? 0.06 : 0.035;
    write(2, t, 9000, 0.015, v, 'noise', 0.001, 0.012);
  }

  // ── CLAP — soft on 2 and 6 (playful) ──
  for (const b of [2, 6, 10, 14]) {
    const t = b * beatSec;
    write(2, t, 2500, 0.03, 0.12, 'noise', 0.001, 0.025);
  }

  // ── BASS — warm bouncy line ──
  //          F3    F3    A3    F3    C4    C4    A3    G3
  //          F3    F3    A3    G3    F3    A3    C4    G3
  const bassNotes = [
    174.6, 174.6, 220, 174.6, 261.6, 261.6, 220, 196,
    174.6, 174.6, 220, 196, 174.6, 220, 261.6, 196,
  ];
  for (let b = 0; b < beats; b++) {
    const t = b * beatSec;
    write(2, t, bassNotes[b], beatSec * 0.7, 0.22, 'tri', 0.008, 0.10);
    write(2, t, bassNotes[b] / 2, beatSec * 0.5, 0.15, 'sin', 0.008, 0.10);
  }

  // ── CELESTA / MUSIC BOX — bright, twinkling melody ──
  const celestaNotes = [
    { b: 0, note: 698.5 },     // F5
    { b: 0.5, note: 784 },     // G5
    { b: 1, note: 880 },       // A5
    { b: 1.75, note: 1046.5 }, // C6
    { b: 2.5, note: 880 },     // A5
    { b: 3, note: 784 },       // G5
    { b: 3.5, note: 698.5 },   // F5
    { b: 4, note: 1046.5 },    // C6
    { b: 4.5, note: 1174.7 },  // D6
    { b: 5, note: 1046.5 },    // C6
    { b: 5.75, note: 880 },    // A5
    { b: 6.5, note: 784 },     // G5
    { b: 7, note: 880 },       // A5
    { b: 7.5, note: 698.5 },   // F5
    // Second phrase (response — higher register)
    { b: 8, note: 880 },       // A5
    { b: 8.5, note: 1046.5 },  // C6
    { b: 9, note: 1174.7 },    // D6
    { b: 9.75, note: 1396.9 }, // F6
    { b: 10.5, note: 1174.7 }, // D6
    { b: 11, note: 1046.5 },   // C6
    { b: 11.5, note: 880 },    // A5
    { b: 12, note: 1046.5 },   // C6
    { b: 12.5, note: 880 },    // A5
    { b: 13, note: 784 },      // G5
    { b: 13.75, note: 698.5 }, // F5
    { b: 14.5, note: 784 },    // G5
    { b: 15, note: 880 },      // A5
    { b: 15.5, note: 698.5 },  // F5 (pickup)
  ];
  for (const cn of celestaNotes) {
    const t = cn.b * beatSec;
    // Bright bell-like tone (sin + octave harmonic)
    write(2, t, cn.note, 0.18, 0.14, 'sin', 0.002, 0.16);
    write(2, t, cn.note * 2, 0.10, 0.04, 'sin', 0.001, 0.09);
    // Soft shimmer (detuned)
    write(2, t, cn.note * 1.003, 0.12, 0.03, 'sin', 0.003, 0.10);
  }

  // ── PAD — warm sustained chord (F major → Dm) ──
  const padChords = [
    { b: 0, notes: [349.2, 440, 523.3], dur: 4 },   // F major
    { b: 4, notes: [261.6, 329.6, 392], dur: 4 },    // C major
    { b: 8, notes: [293.7, 349.2, 440], dur: 4 },    // Dm
    { b: 12, notes: [261.6, 329.6, 392], dur: 4 },   // C major
  ];
  for (const pc of padChords) {
    const t = pc.b * beatSec;
    for (const n of pc.notes) {
      write(2, t, n, pc.dur * beatSec, 0.06, 'sin', 0.15, 0.3);
      write(2, t, n * 0.998, pc.dur * beatSec, 0.03, 'sin', 0.15, 0.3);
    }
  }

  // ── XYLOPHONE ACCENTS — playful pings ──
  const xyloBeats = [1, 3, 5, 7, 9, 11, 13, 15];
  const xyloNotes = [880, 1046.5, 784, 698.5, 1174.7, 880, 1046.5, 698.5];
  for (let i = 0; i < xyloBeats.length; i++) {
    const t = (xyloBeats[i] + 0.5) * beatSec;
    write(i % 2 === 0 ? 0 : 1, t, xyloNotes[i], 0.08, 0.08, 'tri', 0.001, 0.07);
  }

  // ── CHIME — gentle wind chime on beats 0 and 8 ──
  for (const b of [0, 8]) {
    const t = b * beatSec;
    write(2, t, 2093, 0.3, 0.04, 'sin', 0.005, 0.28);
    write(2, t + 0.05, 2637, 0.25, 0.03, 'sin', 0.005, 0.23);
    write(2, t + 0.1, 3136, 0.2, 0.02, 'sin', 0.005, 0.18);
  }

  // ── BARK — tiny playful yelp on beat 4 and 12 ──
  for (const b of [4, 12]) {
    const t = b * beatSec;
    write(2, t, 800, 0.04, 0.08, 'sq', 0.002, 0.03);
    write(2, t + 0.04, 1000, 0.03, 0.06, 'sq', 0.002, 0.025);
  }

  // Normalize
  let maxL = 0, maxR = 0;
  for (let i = 0; i < len; i++) {
    if (Math.abs(L[i]) > maxL) maxL = Math.abs(L[i]);
    if (Math.abs(R[i]) > maxR) maxR = Math.abs(R[i]);
  }
  const peak = Math.max(maxL, maxR, 0.01);
  const norm = 0.85 / peak;
  for (let i = 0; i < len; i++) { L[i] *= norm; R[i] *= norm; }

  return buf;
}

function _playMomoMusic() {
  _stopMomoMusic();
  const c = getCtx();
  if (!_momoBuffer) _momoBuffer = _generateMomoBuffer();
  _momoGain = c.createGain();
  _momoGain.gain.value = 0.45;
  _momoGain.connect(c.destination);
  _momoSource = c.createBufferSource();
  _momoSource.buffer = _momoBuffer;
  _momoSource.loop = true;
  _momoSource.connect(_momoGain);
  _momoSource.start();
}

function _stopMomoMusic() {
  if (_momoSource) {
    try { _momoSource.stop(); } catch (_) {}
    _momoSource.disconnect();
    _momoSource = null;
  }
  if (_momoGain) {
    _momoGain.disconnect();
    _momoGain = null;
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
