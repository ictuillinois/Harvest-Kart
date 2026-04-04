import { PLATES_TO_FILL_BAR, TOTAL_LAMP_POSTS } from '../utils/constants.js';
import { gameRoot } from '../utils/base.js';

const SP_SEGS = 20;   // speedometer LED segments
const EN_SEGS = 16;   // energy bar LED segments

export class HUD {
  constructor(onHome, onPause) {
    this._charge = 0;
    this._lamps  = 0;

    // ── Speedometer segments ──
    const spHTML = Array.from({ length: SP_SEGS }, (_, i) =>
      `<div class="sp-seg" data-i="${i}"></div>`).join('');

    // ── Energy bar segments (rendered bottom-to-top via flex-direction:column-reverse) ──
    const enHTML = Array.from({ length: EN_SEGS }, (_, i) =>
      `<div class="en-seg" data-i="${i}"></div>`).join('');

    // ── Minimap lamp post markers ──
    const lampHTML = Array.from({ length: TOTAL_LAMP_POSTS }, (_, i) => {
      const pct = ((i + 1) / TOTAL_LAMP_POSTS) * 92 + 4; // 4%..96% within road strip
      return `<div class="mm-lamp" data-lamp="${i}" style="bottom:${pct.toFixed(1)}%"></div>`;
    }).join('');

    // ── Main HUD element ──
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.innerHTML = `
      <!-- Top-left: HOME + minimap -->
      <div class="hud-tl">
        <button class="hud-btn" id="hud-home" aria-label="Home">&#9664; HOME</button>
        <div class="hud-panel mm-panel">
          <div class="mm-label">MAP</div>
          <div class="mm-road">
            <div class="mm-stripe"></div>
            ${lampHTML}
            <div class="mm-player" id="mm-player"></div>
          </div>
        </div>
      </div>

      <!-- Top-center: score + combo -->
      <div class="hud-tc">
        <div class="hud-score" id="hud-score">0</div>
        <div class="hud-combo" id="hud-combo"></div>
      </div>

      <!-- Top-right: PAUSE + speedometer -->
      <div class="hud-tr">
        <button class="hud-btn" id="hud-pause" aria-label="Pause">&#9646;&#9646; PAUSE</button>
        <div class="hud-panel sp-panel">
          <div class="sp-bar" id="sp-bar">${spHTML}</div>
          <div class="sp-readout">
            <span class="sp-num" id="sp-num">20</span>
            <span class="sp-unit">MPH</span>
            <span class="sp-time" id="sp-time">00'00"00</span>
          </div>
        </div>
      </div>

      <!-- Right edge: energy bar -->
      <div class="hud-re">
        <div class="hud-panel en-panel">
          <div class="en-label-top">E</div>
          <div class="en-bar" id="en-bar">${enHTML}</div>
          <div class="en-label-bot">0</div>
          <div class="en-lamps">
            <span class="en-lamp-icon">&#128161;</span>
            <span class="en-lamp-count" id="en-lamp-count">0/${TOTAL_LAMP_POSTS}</span>
          </div>
        </div>
      </div>
    `;

    // ── Pause overlay ──
    this.pauseOverlay = document.createElement('div');
    this.pauseOverlay.id = 'pause-overlay';
    this.pauseOverlay.innerHTML = `
      <div class="pause-card">
        <h2 class="pause-title">PAUSED</h2>
        <button class="pause-btn pause-resume" id="pause-resume">&#9654; RESUME</button>
        <button class="pause-btn pause-quit"   id="pause-quit">&#9664; QUIT</button>
      </div>
    `;

    // ── Styles ──
    const style = document.createElement('style');
    style.textContent = `
      /* ══════════════════════════════════════════
         ROOT CONTAINER
         ══════════════════════════════════════════ */
      #hud {
        position: fixed; inset: 0; z-index: 50;
        display: none;
        pointer-events: none;
        font-family: 'Press Start 2P', 'VT323', monospace;
      }
      #hud * { box-sizing: border-box; }
      #hud button { pointer-events: all; cursor: pointer; }

      /* ── Shared dark panel ── */
      .hud-panel {
        background: rgba(0,0,0,0.82);
        border: 1px solid #3a3a3a;
        border-radius: 5px;
      }

      /* ── Shared small button ── */
      .hud-btn {
        font-family: 'Press Start 2P', monospace;
        font-size: 7px;
        color: rgba(255,255,255,0.65);
        background: rgba(0,0,0,0.78);
        border: 1px solid #3a3a3a;
        border-radius: 4px;
        padding: 7px 10px;
        letter-spacing: 1px;
        transition: background 0.15s, color 0.15s;
        white-space: nowrap;
      }
      .hud-btn:hover  { background: rgba(255,255,255,0.1); color: #fff; }
      .hud-btn:active { transform: scale(0.93); }

      /* ══════════════════════════════════════════
         TOP-LEFT  —  HOME button + minimap
         ══════════════════════════════════════════ */
      .hud-tl {
        position: absolute;
        top: 12px; left: 12px;
        display: flex; flex-direction: column;
        align-items: flex-start; gap: 8px;
      }

      /* Minimap panel */
      .mm-panel { padding: 7px 8px 8px; width: 80px; }
      .mm-label {
        font-size: 6px; color: rgba(255,255,255,0.35);
        letter-spacing: 3px; text-align: center;
        margin-bottom: 6px;
      }

      /* Road strip */
      .mm-road {
        position: relative;
        width: 24px; height: 100px;
        margin: 0 auto;
        background: rgba(50,50,50,0.9);
        border: 1px solid #3a3a3a;
        border-radius: 3px;
        overflow: hidden;
      }
      .mm-stripe {
        position: absolute; left: 50%; top: 0; bottom: 0; width: 1px;
        background: repeating-linear-gradient(
          to bottom,
          rgba(255,255,255,0.35) 0, rgba(255,255,255,0.35) 4px,
          transparent 4px, transparent 8px
        );
        transform: translateX(-50%);
      }

      /* Lamp post dots on minimap */
      .mm-lamp {
        position: absolute; left: 50%;
        width: 7px; height: 7px; border-radius: 50%;
        border: 1.5px solid rgba(255,190,0,0.45);
        background: transparent;
        transform: translate(-50%, 50%);
        transition: background 0.35s, border-color 0.35s, box-shadow 0.35s;
      }
      .mm-lamp.lit {
        background: #ffcc00;
        border-color: #ffcc00;
        box-shadow: 0 0 5px 2px rgba(255,200,0,0.75);
      }

      /* Player dot */
      .mm-player {
        position: absolute; left: 50%; bottom: 4%;
        width: 8px; height: 8px; border-radius: 50%;
        background: #39ff14;
        box-shadow: 0 0 5px 2px rgba(57,255,20,0.85);
        transform: translate(-50%, 50%);
        transition: bottom 0.28s ease-out;
      }

      /* ══════════════════════════════════════════
         TOP-CENTER  —  score + combo
         ══════════════════════════════════════════ */
      .hud-tc {
        position: absolute;
        top: 12px; left: 50%; transform: translateX(-50%);
        display: flex; flex-direction: column; align-items: center; gap: 5px;
        pointer-events: none;
      }
      .hud-score {
        font-size: 10px; color: rgba(255,255,255,0.7);
        text-shadow: 0 0 5px rgba(255,255,255,0.25);
        letter-spacing: 2px;
      }
      .hud-combo {
        font-size: 9px; color: #ffaa00;
        text-shadow: 0 0 6px #ffaa00, 0 0 14px rgba(255,170,0,0.45);
        letter-spacing: 1px;
        transition: transform 0.12s;
        min-height: 14px;
      }
      .hud-combo.pop { transform: scale(1.4); }

      /* ── Floating score popup ── */
      .hud-float-score {
        position: fixed; z-index: 55;
        font-family: 'Press Start 2P', monospace;
        font-size: 11px; color: #39ff14;
        text-shadow: 0 0 6px #39ff14, 0 0 14px rgba(57,255,20,0.5);
        pointer-events: none;
        animation: floatUp 0.9s ease-out forwards;
      }
      @keyframes floatUp {
        0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-50px); }
      }

      /* ══════════════════════════════════════════
         TOP-RIGHT  —  PAUSE button + speedometer
         ══════════════════════════════════════════ */
      .hud-tr {
        position: absolute;
        top: 12px; right: 12px;
        display: flex; flex-direction: column;
        align-items: flex-end; gap: 8px;
      }

      /* Speedometer panel */
      .sp-panel { padding: 8px 10px; width: 220px; }

      /* LED segment bar */
      .sp-bar {
        display: flex; gap: 2px;
        margin-bottom: 7px;
      }
      .sp-seg {
        flex: 1; height: 16px;
        border-radius: 2px;
        background: #0e0e0e;
        border: 1px solid #2a2a2a;
        transition: background 0.06s, box-shadow 0.06s;
      }
      .sp-seg.on-g { background:#00cc22; border-color:#00cc22; box-shadow:0 0 4px #00cc22; }
      .sp-seg.on-y { background:#ccbb00; border-color:#ccbb00; box-shadow:0 0 4px #ccbb00; }
      .sp-seg.on-o { background:#ff7700; border-color:#ff7700; box-shadow:0 0 4px #ff7700; }
      .sp-seg.on-r { background:#ff1a1a; border-color:#ff1a1a; box-shadow:0 0 4px #ff1a1a; }

      /* Speed number + unit + time on one row */
      .sp-readout {
        display: flex; align-items: baseline; gap: 5px;
      }
      .sp-num {
        font-size: 26px; color: #ff3333; line-height: 1;
        text-shadow: 0 0 8px #ff3333, 0 0 18px rgba(255,50,50,0.4);
        min-width: 48px; text-align: right;
        transition: color 0.2s, text-shadow 0.2s;
      }
      .sp-unit {
        font-size: 6px; color: rgba(255,255,255,0.35);
        letter-spacing: 1px; padding-bottom: 3px;
      }
      .sp-time {
        font-size: 8px; color: #ffaa00;
        text-shadow: 0 0 6px #ffaa00, 0 0 14px rgba(255,170,0,0.4);
        margin-left: auto;
        letter-spacing: 0.5px;
      }

      /* ══════════════════════════════════════════
         RIGHT EDGE  —  vertical energy bar
         ══════════════════════════════════════════ */
      .hud-re {
        position: absolute;
        right: 12px; top: 50%; transform: translateY(-50%);
      }
      .en-panel {
        display: flex; flex-direction: column;
        align-items: center; gap: 4px;
        padding: 8px 7px;
        width: 38px;
      }
      .en-label-top, .en-label-bot {
        font-size: 7px; color: rgba(255,255,255,0.35);
        letter-spacing: 1px;
      }

      /* Vertical LED bar — flex column-reverse so data-i=0 sits at bottom */
      .en-bar {
        display: flex; flex-direction: column-reverse; gap: 2px;
      }
      .en-seg {
        width: 20px; height: 8px; border-radius: 2px;
        background: #0e0e0e; border: 1px solid #2a2a2a;
        transition: background 0.1s, box-shadow 0.1s;
      }
      .en-seg.on-r { background:#ff1a1a; border-color:#ff1a1a; box-shadow:0 0 3px #ff1a1a; }
      .en-seg.on-o { background:#ff7700; border-color:#ff7700; box-shadow:0 0 3px #ff7700; }
      .en-seg.on-y { background:#ccbb00; border-color:#ccbb00; box-shadow:0 0 3px #ccbb00; }
      .en-seg.on-g { background:#00cc22; border-color:#00cc22; box-shadow:0 0 3px #00cc22; }

      .en-seg.flash { animation: segFlash 0.3s ease-out; }
      @keyframes segFlash {
        0%   { filter: brightness(1);   }
        40%  { filter: brightness(2.8); }
        100% { filter: brightness(1);   }
      }

      /* Lamp counter below the bar */
      .en-lamps {
        display: flex; flex-direction: column;
        align-items: center; gap: 3px;
        margin-top: 3px;
      }
      .en-lamp-icon { font-size: 13px; }
      .en-lamp-count {
        font-size: 6px; color: #ffcc00;
        text-shadow: 0 0 5px rgba(255,200,0,0.7);
        text-align: center; letter-spacing: 0;
      }

      /* ══════════════════════════════════════════
         PAUSE OVERLAY
         ══════════════════════════════════════════ */
      #pause-overlay {
        position: fixed; inset: 0; z-index: 200;
        display: none; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.78); backdrop-filter: blur(6px);
      }
      .pause-card {
        text-align: center;
        background: rgba(0,0,0,0.55);
        border: 2px solid #3a3a3a;
        border-radius: 6px;
        padding: 36px 44px;
        min-width: 250px;
      }
      .pause-title {
        font-family: 'Press Start 2P', monospace;
        font-size: 18px; color: #fff; letter-spacing: 4px;
        margin-bottom: 30px;
        text-shadow: 0 0 10px rgba(255,255,255,0.3);
      }
      .pause-btn {
        display: block; width: 100%;
        font-family: 'Press Start 2P', monospace;
        font-size: 9px; letter-spacing: 2px;
        text-transform: uppercase;
        padding: 14px 0; margin-bottom: 12px;
        border: none; border-radius: 4px;
        pointer-events: all;
        transition: transform 0.12s, box-shadow 0.12s;
      }
      .pause-btn:last-child { margin-bottom: 0; }
      .pause-btn:active { transform: scale(0.95); }
      .pause-resume {
        background: linear-gradient(135deg, #39ff14, #7fff00);
        color: #061206;
        box-shadow: 0 0 14px rgba(57,255,20,0.35);
      }
      .pause-resume:hover { box-shadow: 0 0 24px rgba(57,255,20,0.6); }
      .pause-quit {
        background: rgba(255,255,255,0.07);
        color: rgba(255,255,255,0.55);
        border: 1px solid #3a3a3a;
      }
      .pause-quit:hover { background: rgba(255,255,255,0.13); }

      /* ── Toast notification ── */
      .hud-toast {
        position: fixed; z-index: 120;
        left: 50%; top: 38%;
        transform: translate(-50%, -50%);
        font-family: 'Press Start 2P', monospace;
        font-size: clamp(12px, 2.5vw, 18px);
        color: #fff;
        text-shadow: 0 0 12px rgba(255,255,255,0.6), 0 0 24px rgba(255,255,255,0.3);
        letter-spacing: 3px;
        text-align: center;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .hud-toast.visible { opacity: 1; }
    `;
    document.head.appendChild(style);

    gameRoot().appendChild(this.el);
    gameRoot().appendChild(this.pauseOverlay);

    // ── Wire up buttons ──
    this.el.querySelector('#hud-home').addEventListener('click', () => onHome());
    this.el.querySelector('#hud-pause').addEventListener('click', () => onPause());
    this.pauseOverlay.querySelector('#pause-resume').addEventListener('click', () => onPause());
    this.pauseOverlay.querySelector('#pause-quit').addEventListener('click', () => onHome());

    // ── Cache DOM refs ──
    this.spSegs      = [...this.el.querySelectorAll('.sp-seg')];
    this.enSegs      = [...this.el.querySelectorAll('.en-seg')];
    this.mmLamps     = [...this.el.querySelectorAll('.mm-lamp')];
    this.mmPlayer    = this.el.querySelector('#mm-player');
    this.spNum       = this.el.querySelector('#sp-num');
    this.spTime      = this.el.querySelector('#sp-time');
    this.enLampCount = this.el.querySelector('#en-lamp-count');
    this.scoreEl     = this.el.querySelector('#hud-score');
    this.comboEl     = this.el.querySelector('#hud-combo');
  }

  // ── Internal helpers ──

  _spColor(segIndex) {
    const t = segIndex / SP_SEGS;
    if (t < 0.40) return 'on-g';
    if (t < 0.60) return 'on-y';
    if (t < 0.80) return 'on-o';
    return 'on-r';
  }

  _enColor(segIndex) {
    const t = segIndex / EN_SEGS;
    if (t < 0.20) return 'on-r';
    if (t < 0.40) return 'on-o';
    if (t < 0.65) return 'on-y';
    return 'on-g';
  }

  _updateMinimap() {
    const totalPlates = TOTAL_LAMP_POSTS * PLATES_TO_FILL_BAR;
    const progress = (this._lamps * PLATES_TO_FILL_BAR + this._charge) / totalPlates;
    // Keep dot 4%..96% inside the strip so it stays visible
    const pct = 4 + Math.min(92, progress * 92);
    this.mmPlayer.style.bottom = pct.toFixed(1) + '%';
  }

  // ── Public update methods ──

  updateSpeed(mph) {
    const display = Math.round(mph);
    this.spNum.textContent = display;

    const frac = Math.max(0, Math.min(1, (mph - 20) / 50));
    const lit  = Math.round(frac * SP_SEGS);
    this.spSegs.forEach((seg, i) => {
      seg.className = 'sp-seg' + (i < lit ? ' ' + this._spColor(i) : '');
    });

    // Speed-number color tracks the gauge
    const col = frac > 0.78 ? '#ff1a1a' : frac > 0.5 ? '#ff8800' : '#ff3333';
    this.spNum.style.color = col;
    this.spNum.style.textShadow = `0 0 8px ${col}, 0 0 18px ${col}60`;
  }

  updateTime(elapsed) {
    const mm = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const ss = Math.floor(elapsed % 60).toString().padStart(2, '0');
    const cs = Math.floor((elapsed % 1) * 100).toString().padStart(2, '0');
    this.spTime.textContent = `${mm}'${ss}"${cs}`;
  }

  updateCharge(charge) {
    this._charge = charge;
    const lit = Math.round((charge / PLATES_TO_FILL_BAR) * EN_SEGS);
    this.enSegs.forEach((seg, i) => {
      seg.className = 'en-seg' + (i < lit ? ' ' + this._enColor(i) : '');
    });
    this._updateMinimap();
  }

  celebrateCharge() {
    // All segments light up bright green, then flash 3×
    this.enSegs.forEach((seg, i) => {
      seg.className = 'en-seg on-g flash';
      // Stagger removal so the flash cascades slightly
      setTimeout(() => seg.classList.remove('flash'), 320 + i * 8);
    });
  }

  updateLamps(lit) {
    this._lamps = lit;
    this.enLampCount.textContent = `${lit}/${TOTAL_LAMP_POSTS}`;
    this.mmLamps.forEach((el, i) => el.classList.toggle('lit', i < lit));
    this._updateMinimap();
  }

  updateScore(score) {
    this.scoreEl.textContent = score.toLocaleString();
  }

  updateCombo(combo) {
    if (combo >= 2) {
      this.comboEl.textContent = `x${combo} COMBO`;
      this.comboEl.classList.add('pop');
      setTimeout(() => this.comboEl.classList.remove('pop'), 150);
    } else {
      this.comboEl.textContent = '';
    }
  }

  // Kept for backwards-compatibility — lamp count covers this now
  updateStage() {}

  showFloatingScore(points) {
    const el = document.createElement('div');
    el.className = 'hud-float-score';
    el.textContent = `+${points}`;
    el.style.left = '50%';
    el.style.top  = '42%';
    gameRoot().appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  /** Show a center-screen toast that fades in, holds, then fades out. */
  showToast(text) {
    const el = document.createElement('div');
    el.className = 'hud-toast';
    el.textContent = text;
    gameRoot().appendChild(el);

    // fade-in
    void el.offsetWidth;
    el.classList.add('visible');

    // hold 1s, then fade-out
    setTimeout(() => el.classList.remove('visible'), 1200);
    setTimeout(() => el.remove(), 1500);
  }

  showPause() { this.pauseOverlay.style.display = 'flex'; }
  hidePause() { this.pauseOverlay.style.display = 'none'; }

  reset() {
    this._charge = 0;
    this._lamps  = 0;
    this.updateCharge(0);
    this.updateLamps(0);
    this.updateSpeed(20);
    this.updateTime(0);
    this.updateScore(0);
    this.updateCombo(0);
    this.hidePause();
  }

  show() {
    clearTimeout(this._hideTimer);
    this.el.style.opacity = '0';
    this.el.style.display = 'block';
    void this.el.offsetWidth;
    this.el.style.transition = 'opacity 0.4s ease';
    this.el.style.opacity = '1';
  }

  hide() {
    clearTimeout(this._hideTimer);
    this.el.style.transition = 'opacity 0.25s ease';
    this.el.style.opacity = '0';
    this._hideTimer = setTimeout(() => {
      this.el.style.display = 'none';
      this.el.style.transition = '';
    }, 260);
    this.hidePause();
  }
}
