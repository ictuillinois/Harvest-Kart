import { PLATES_TO_FILL_BAR, TOTAL_LAMP_POSTS } from '../utils/constants.js';

const EN_SEGS = 12;  // energy gauge segments

// ── SVG arc helpers ──
const ARC_CX = 100, ARC_CY = 100, ARC_R = 78;
const ARC_START_DEG = 160, ARC_SWEEP_DEG = 220;
const ARC_LENGTH = (ARC_SWEEP_DEG / 360) * 2 * Math.PI * ARC_R; // ≈ 299.4

function polarToXY(cx, cy, r, deg) {
  const rad = (deg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startDeg, sweepDeg) {
  const s = polarToXY(cx, cy, r, startDeg);
  const e = polarToXY(cx, cy, r, startDeg + sweepDeg);
  const large = sweepDeg > 180 ? 1 : 0;
  return `M ${s.x},${s.y} A ${r},${r} 0 ${large},1 ${e.x},${e.y}`;
}

const ARC_D = describeArc(ARC_CX, ARC_CY, ARC_R, ARC_START_DEG, ARC_SWEEP_DEG);

// ── Build minor tick marks (every 5 MPH) ──
function buildMinorTicks() {
  const ticks = [];
  for (let mph = 20; mph <= 70; mph += 5) {
    if (mph % 10 === 0) continue; // skip major ticks
    const frac = (mph - 20) / 50;
    const deg = ARC_START_DEG + frac * ARC_SWEEP_DEG;
    const inner = polarToXY(ARC_CX, ARC_CY, ARC_R - 10, deg);
    const outer = polarToXY(ARC_CX, ARC_CY, ARC_R - 5, deg);
    ticks.push(`<line x1="${inner.x}" y1="${inner.y}" x2="${outer.x}" y2="${outer.y}" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-linecap="round"/>`);
  }
  return ticks.join('');
}

// ── Build major tick marks (every 10 MPH) ──
function buildTicks() {
  const ticks = [];
  for (let mph = 20; mph <= 70; mph += 10) {
    const frac = (mph - 20) / 50;
    const deg = ARC_START_DEG + frac * ARC_SWEEP_DEG;
    const inner = polarToXY(ARC_CX, ARC_CY, ARC_R - 14, deg);
    const outer = polarToXY(ARC_CX, ARC_CY, ARC_R - 4, deg);
    const label = polarToXY(ARC_CX, ARC_CY, ARC_R - 22, deg);
    ticks.push(`<line x1="${inner.x}" y1="${inner.y}" x2="${outer.x}" y2="${outer.y}" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" stroke-linecap="round"/>`);
    ticks.push(`<text x="${label.x}" y="${label.y}" text-anchor="middle" dominant-baseline="central" fill="rgba(255,255,255,0.3)" font-family="var(--hud-font)" font-size="7">${mph}</text>`);
  }
  return ticks.join('');
}

export class HUD {
  constructor(onHome, onPause) {
    this._charge = 0;
    this._lamps  = 0;
    this._prevLit = 0;

    // ── Energy segments HTML ──
    const enHTML = Array.from({ length: EN_SEGS }, (_, i) =>
      `<div class="en-seg" data-i="${i}"></div>`).join('');

    // ── Minimap lamp markers ──
    const lampHTML = Array.from({ length: TOTAL_LAMP_POSTS }, (_, i) => {
      const pct = ((i + 1) / TOTAL_LAMP_POSTS) * 92 + 4;
      return `<div class="mm-lamp" data-lamp="${i}" style="bottom:${pct.toFixed(1)}%"></div>`;
    }).join('');

    // ── Needle initial angle ──
    const needleEnd = polarToXY(ARC_CX, ARC_CY, ARC_R - 18, ARC_START_DEG);

    // ── Main HUD element ──
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.innerHTML = `
      <!-- Top-left: HOME + minimap -->
      <div class="hud-tl">
        <button class="hud-btn hud-glass" id="hud-home" aria-label="Home">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          HOME
        </button>
        <div class="hud-glass mm-panel">
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

      <!-- Top-right: Timer + Pause -->
      <div class="hud-tr">
        <div class="hud-timer-panel hud-glass">
          <svg class="timer-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--hud-warning)" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5"/><path d="M9 2h6"/><path d="M12 2v2"/>
          </svg>
          <span class="hud-timer" id="sp-time">00'00"00</span>
        </div>
        <button class="hud-btn hud-glass hud-pause-btn" id="hud-pause" aria-label="Pause">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
        </button>
      </div>

      <!-- Right edge: energy gauge -->
      <div class="hud-re">
        <div class="hud-glass en-panel">
          <svg class="en-bolt" viewBox="0 0 24 24" fill="var(--hud-accent)" width="16" height="16"><path d="M13 2L3 14h9l-1 10 10-12h-9l1-10z"/></svg>
          <div class="en-bar" id="en-bar">${enHTML}</div>
          <div class="en-label">ENERGY</div>
          <div class="en-lamps">
            <span class="en-lamp-count" id="en-lamp-count">0/${TOTAL_LAMP_POSTS}</span>
          </div>
        </div>
      </div>

      <!-- Bottom-right: Speedometer -->
      <div class="hud-br">
        <div class="speedo-wrap">
          <svg class="speedo-svg" viewBox="0 0 200 140">
            <defs>
              <linearGradient id="speedo-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#00ff88"/>
                <stop offset="45%" stop-color="#ffdd00"/>
                <stop offset="100%" stop-color="#ff3333"/>
              </linearGradient>
              <filter id="speedo-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="needle-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <radialGradient id="speedo-bg-grad" cx="50%" cy="70%" r="55%">
                <stop offset="0%" stop-color="rgba(0,255,136,0.04)"/>
                <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
              </radialGradient>
            </defs>
            <!-- Subtle background radial glow -->
            <circle cx="${ARC_CX}" cy="${ARC_CY}" r="90" fill="url(#speedo-bg-grad)"/>
            <!-- Outer decorative ring -->
            <path d="${describeArc(ARC_CX, ARC_CY, ARC_R + 6, ARC_START_DEG, ARC_SWEEP_DEG)}" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1.5" stroke-linecap="round"/>
            <!-- Arc track (thicker) -->
            <path d="${ARC_D}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="14" stroke-linecap="round"/>
            <!-- Arc fill (animated, thicker) -->
            <path id="speedo-fill" d="${ARC_D}" fill="none" stroke="url(#speedo-grad)" stroke-width="14" stroke-linecap="round"
                  stroke-dasharray="${ARC_LENGTH}" stroke-dashoffset="${ARC_LENGTH}" filter="url(#speedo-glow)"
                  style="transition: stroke-dashoffset 150ms ease-out;"/>
            <!-- Minor tick marks -->
            ${buildMinorTicks()}
            <!-- Major tick marks + labels -->
            ${buildTicks()}
            <!-- Needle with glow -->
            <line id="speedo-needle" x1="${ARC_CX}" y1="${ARC_CY}" x2="${needleEnd.x}" y2="${needleEnd.y}"
                  stroke="#fff" stroke-width="2.5" stroke-linecap="round" filter="url(#needle-glow)"/>
            <!-- Center cap (layered rings) -->
            <circle cx="${ARC_CX}" cy="${ARC_CY}" r="8" fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
            <circle cx="${ARC_CX}" cy="${ARC_CY}" r="4.5" fill="var(--hud-accent)" opacity="0.9"/>
            <!-- Speed number -->
            <text id="speedo-num" x="${ARC_CX}" y="${ARC_CY - 12}" text-anchor="middle" dominant-baseline="central"
                  fill="#fff" font-family="var(--hud-font)" font-size="36" font-weight="900">20</text>
            <!-- MPH label -->
            <text x="${ARC_CX}" y="${ARC_CY + 10}" text-anchor="middle" dominant-baseline="central"
                  fill="rgba(255,255,255,0.35)" font-family="var(--hud-font)" font-size="10" font-weight="700" letter-spacing="3">MPH</text>
          </svg>
        </div>
      </div>
    `;

    // ── Pause overlay ──
    this.pauseOverlay = document.createElement('div');
    this.pauseOverlay.id = 'pause-overlay';
    this.pauseOverlay.innerHTML = `
      <div class="pause-card hud-glass">
        <h2 class="pause-title">PAUSED</h2>
        <button class="pause-btn pause-resume" id="pause-resume">&#9654; RESUME</button>
        <button class="pause-btn pause-quit"   id="pause-quit">&#9664; QUIT</button>
      </div>
    `;

    // ── Styles ──
    const style = document.createElement('style');
    style.textContent = `
      /* ══════════════════════════════════════════
         DESIGN TOKENS
         ══════════════════════════════════════════ */
      :root {
        --hud-bg: rgba(10, 10, 15, 0.6);
        --hud-border: rgba(0, 255, 136, 0.2);
        --hud-accent: #00ff88;
        --hud-accent-glow: rgba(0, 255, 136, 0.35);
        --hud-warning: #ffdd00;
        --hud-danger: #ff3333;
        --hud-text: #ffffff;
        --hud-text-muted: rgba(255, 255, 255, 0.45);
        --hud-segment-empty: #1a1a2e;
        --hud-blur: blur(8px);
        --hud-font: 'Orbitron', 'Courier New', monospace;
        --hud-transition: 150ms ease-out;
        --hud-radius: 12px;
        --hud-radius-sm: 8px;
      }

      /* ══════════════════════════════════════════
         ROOT + SHARED
         ══════════════════════════════════════════ */
      #hud {
        position: fixed; inset: 0; z-index: 50;
        display: none;
        pointer-events: none;
        font-family: var(--hud-font);
      }
      #hud * { box-sizing: border-box; }
      #hud button { pointer-events: all; cursor: pointer; }

      .hud-glass {
        background: var(--hud-bg);
        backdrop-filter: var(--hud-blur);
        -webkit-backdrop-filter: var(--hud-blur);
        border: 1px solid var(--hud-border);
        border-radius: var(--hud-radius);
      }

      /* ══════════════════════════════════════════
         BUTTONS (HOME, PAUSE)
         ══════════════════════════════════════════ */
      .hud-btn {
        font-family: var(--hud-font);
        font-size: clamp(6px, 0.7vw, 12px);
        font-weight: 700;
        color: var(--hud-text-muted);
        padding: clamp(5px, 0.6vh, 10px) clamp(8px, 0.8vw, 14px);
        letter-spacing: 1px;
        display: flex; align-items: center; gap: clamp(4px, 0.4vw, 8px);
        border: none;
        transition: background var(--hud-transition), color var(--hud-transition);
        white-space: nowrap;
      }
      .hud-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
      .hud-btn:active { transform: scale(0.93); }

      .hud-pause-btn {
        width: clamp(32px, 3.5vw, 52px);
        height: clamp(32px, 3.5vw, 52px);
        border-radius: 50%;
        padding: 0;
        justify-content: center;
      }

      /* ══════════════════════════════════════════
         TOP-LEFT — HOME + MINIMAP
         ══════════════════════════════════════════ */
      .hud-tl {
        position: absolute;
        top: clamp(8px, 1.5vh, 20px); left: clamp(8px, 1vw, 20px);
        display: flex; flex-direction: column;
        align-items: flex-start; gap: clamp(6px, 0.8vh, 12px);
      }

      .mm-panel {
        padding: clamp(8px, 1vh, 18px) clamp(8px, 0.9vw, 18px);
        width: clamp(90px, 10vw, 210px);
      }
      .mm-label {
        font-size: clamp(6px, 0.7vw, 13px);
        font-weight: 700;
        color: var(--hud-text-muted);
        letter-spacing: 3px;
        text-align: center;
        margin-bottom: clamp(4px, 0.5vh, 8px);
      }
      .mm-road {
        position: relative;
        width: clamp(28px, 3.5vw, 54px);
        height: clamp(100px, 20vh, 240px);
        margin: 0 auto;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 4px;
        overflow: hidden;
      }
      .mm-stripe {
        position: absolute; left: 50%; top: 0; bottom: 0; width: 1px;
        background: repeating-linear-gradient(to bottom, rgba(255,255,255,0.2) 0, rgba(255,255,255,0.2) 4px, transparent 4px, transparent 8px);
        transform: translateX(-50%);
      }
      .mm-lamp {
        position: absolute; left: 50%;
        width: clamp(7px, 0.7vw, 14px); height: clamp(7px, 0.7vw, 14px); border-radius: 50%;
        background: var(--hud-segment-empty);
        border: 1.5px solid rgba(255,190,0,0.3);
        transform: translate(-50%, 50%);
        transition: background 0.4s, border-color 0.4s, box-shadow 0.4s;
      }
      .mm-lamp.lit {
        background: var(--hud-warning);
        border-color: var(--hud-warning);
        box-shadow: 0 0 6px 2px rgba(255,220,0,0.7);
      }
      .mm-player {
        position: absolute; left: 50%; bottom: 4%;
        width: clamp(8px, 0.9vw, 18px); height: clamp(8px, 0.9vw, 18px); border-radius: 50%;
        background: var(--hud-accent);
        box-shadow: 0 0 6px 3px var(--hud-accent-glow);
        transform: translate(-50%, 50%);
        transition: bottom 0.28s ease-out;
        animation: dotPulse 1.5s ease-in-out infinite;
      }
      @keyframes dotPulse {
        0%, 100% { transform: translate(-50%, 50%) scale(1); box-shadow: 0 0 6px 3px var(--hud-accent-glow); }
        50% { transform: translate(-50%, 50%) scale(1.25); box-shadow: 0 0 10px 5px var(--hud-accent-glow); }
      }

      /* ══════════════════════════════════════════
         TOP-CENTER — SCORE + COMBO
         ══════════════════════════════════════════ */
      .hud-tc {
        position: absolute;
        top: clamp(8px, 1.5vh, 20px); left: 50%; transform: translateX(-50%);
        display: flex; flex-direction: column; align-items: center; gap: clamp(2px, 0.4vh, 6px);
        pointer-events: none;
      }
      .hud-score {
        font-size: clamp(16px, 2vw, 40px);
        font-weight: 700;
        color: var(--hud-text);
        text-shadow: 0 0 12px var(--hud-accent-glow);
        letter-spacing: 3px;
      }
      .hud-combo {
        font-size: clamp(14px, 1.6vw, 32px);
        font-weight: 900;
        color: var(--hud-accent);
        text-shadow:
          0 0 12px var(--hud-accent-glow),
          0 0 28px rgba(0,255,136,0.2);
        letter-spacing: 2px;
        transition: transform 0.12s;
        min-height: clamp(16px, 2vh, 36px);
      }
      .hud-combo.pop { transform: scale(1.5); }

      /* ── Floating score popup ── */
      .hud-float-score {
        position: fixed; z-index: 55;
        font-family: var(--hud-font);
        font-size: clamp(14px, 1.6vw, 30px);
        font-weight: 900;
        color: var(--hud-accent);
        text-shadow: 0 0 10px var(--hud-accent-glow), 0 0 24px rgba(0,255,136,0.2);
        pointer-events: none;
        animation: floatUp 0.9s ease-out forwards;
      }
      @keyframes floatUp {
        0%   { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-30px); }
      }

      /* ══════════════════════════════════════════
         TOP-RIGHT — TIMER + PAUSE
         ══════════════════════════════════════════ */
      .hud-tr {
        position: absolute;
        top: clamp(8px, 1.5vh, 20px); right: clamp(8px, 1vw, 20px);
        display: flex; align-items: center; gap: clamp(6px, 0.6vw, 12px);
      }
      .hud-timer-panel {
        display: flex; align-items: center; gap: clamp(5px, 0.5vw, 10px);
        padding: clamp(5px, 0.6vh, 10px) clamp(8px, 0.8vw, 16px);
        border-color: rgba(255,221,0,0.2);
      }
      .timer-icon {
        width: clamp(14px, 1.3vw, 24px); height: clamp(14px, 1.3vw, 24px);
        opacity: 0.7;
        filter: drop-shadow(0 0 3px rgba(255,221,0,0.4));
      }
      .hud-timer {
        font-family: var(--hud-font);
        font-variant-numeric: tabular-nums;
        font-size: clamp(14px, 1.5vw, 30px);
        font-weight: 700;
        color: var(--hud-warning);
        text-shadow:
          0 0 10px rgba(255,221,0,0.4),
          0 0 24px rgba(255,221,0,0.15);
        letter-spacing: 1px;
      }

      /* ══════════════════════════════════════════
         RIGHT EDGE — ENERGY GAUGE
         ══════════════════════════════════════════ */
      .hud-re {
        position: absolute;
        right: clamp(8px, 1vw, 20px); top: 50%; transform: translateY(-50%);
      }
      .en-panel {
        display: flex; flex-direction: column;
        align-items: center; gap: clamp(4px, 0.6vh, 9px);
        padding: clamp(8px, 1vh, 18px) clamp(7px, 0.7vw, 15px);
        width: clamp(48px, 5vw, 84px);
      }
      .en-bolt {
        opacity: 0.4;
        transition: opacity 0.3s, filter 0.3s;
        width: clamp(16px, 1.8vw, 30px); height: clamp(16px, 1.8vw, 30px);
      }
      .en-bolt.charged {
        opacity: 1;
        filter: drop-shadow(0 0 4px var(--hud-accent));
      }
      .en-bar {
        display: flex; flex-direction: column-reverse; gap: clamp(2px, 0.25vh, 3px);
      }
      .en-seg {
        width: clamp(26px, 3vw, 48px); height: clamp(8px, 1.3vh, 18px);
        border-radius: 3px;
        background: var(--hud-segment-empty);
        border: 1px solid rgba(255,255,255,0.05);
        transition: background 0.15s, box-shadow 0.15s;
      }
      .en-seg.on-r { background: var(--hud-danger); box-shadow: 0 0 4px rgba(255,51,51,0.5); animation: segPulse 2s ease-in-out infinite; }
      .en-seg.on-o { background: #ff8800; box-shadow: 0 0 4px rgba(255,136,0,0.5); animation: segPulse 2s ease-in-out infinite; }
      .en-seg.on-y { background: var(--hud-warning); box-shadow: 0 0 4px rgba(255,221,0,0.5); animation: segPulse 2s ease-in-out infinite; }
      .en-seg.on-g { background: var(--hud-accent); box-shadow: 0 0 4px var(--hud-accent-glow); animation: segPulse 2s ease-in-out infinite; }

      @keyframes segPulse {
        0%, 100% { opacity: 0.8; }
        50% { opacity: 1; }
      }
      .en-seg.seg-flash {
        background: #fff !important;
        box-shadow: 0 0 10px rgba(255,255,255,0.8) !important;
        animation: none !important;
      }
      .en-seg.flash { animation: segCelebrate 0.3s ease-out !important; }
      @keyframes segCelebrate {
        0%   { filter: brightness(1); }
        40%  { filter: brightness(2.8); }
        100% { filter: brightness(1); }
      }

      .en-label {
        font-size: clamp(5px, 0.6vw, 10px);
        font-weight: 700;
        color: var(--hud-text-muted);
        letter-spacing: 2px;
      }
      .en-lamps {
        display: flex; flex-direction: column;
        align-items: center; gap: 2px;
      }
      .en-lamp-count {
        font-size: clamp(7px, 0.7vw, 13px);
        font-weight: 700;
        color: var(--hud-warning);
        text-shadow: 0 0 5px rgba(255,200,0,0.5);
      }

      /* ══════════════════════════════════════════
         BOTTOM-RIGHT — SPEEDOMETER
         ══════════════════════════════════════════ */
      .hud-br {
        position: absolute;
        bottom: clamp(8px, 1.5vh, 20px); right: clamp(8px, 1.5vw, 24px);
      }
      .speedo-wrap {
        width: clamp(200px, 28vw, 520px);
        position: relative;
      }
      .speedo-svg {
        width: 100%; height: auto;
        filter: drop-shadow(0 4px 16px rgba(0,0,0,0.5));
      }
      #speedo-needle {
        transform-origin: ${ARC_CX}px ${ARC_CY}px;
        transition: transform 150ms cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      #speedo-fill {
        transition: stroke-dashoffset 150ms ease-out;
      }

      /* ══════════════════════════════════════════
         PAUSE OVERLAY
         ══════════════════════════════════════════ */
      #pause-overlay {
        position: fixed; inset: 0; z-index: 200;
        display: none; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.7);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }
      .pause-card {
        text-align: center;
        padding: clamp(28px, 4vh, 52px) clamp(36px, 4vw, 64px);
        min-width: clamp(220px, 22vw, 400px);
      }
      .pause-title {
        font-family: var(--hud-font);
        font-size: clamp(18px, 2vw, 36px);
        font-weight: 900;
        color: var(--hud-text);
        letter-spacing: 4px;
        margin-bottom: clamp(20px, 3vh, 40px);
        text-shadow: 0 0 20px rgba(255,255,255,0.2);
      }
      .pause-btn {
        display: block; width: 100%;
        font-family: var(--hud-font);
        font-size: clamp(8px, 0.9vw, 16px);
        font-weight: 700;
        letter-spacing: 2px;
        text-transform: uppercase;
        padding: clamp(12px, 1.5vh, 22px) 0;
        margin-bottom: clamp(8px, 1vh, 16px);
        border: none; border-radius: var(--hud-radius-sm);
        pointer-events: all; cursor: pointer;
        transition: transform 0.12s, box-shadow 0.12s;
      }
      .pause-btn:last-child { margin-bottom: 0; }
      .pause-btn:active { transform: scale(0.95); }
      .pause-resume {
        background: linear-gradient(135deg, var(--hud-accent), #7fff00);
        color: #0a1a0e;
        box-shadow: 0 0 18px var(--hud-accent-glow);
      }
      .pause-resume:hover { box-shadow: 0 0 28px var(--hud-accent-glow); }
      .pause-quit {
        background: rgba(255,255,255,0.06);
        color: var(--hud-text-muted);
        border: 1px solid rgba(255,255,255,0.1);
      }
      .pause-quit:hover { background: rgba(255,255,255,0.12); }

      /* ══════════════════════════════════════════
         TOAST
         ══════════════════════════════════════════ */
      .hud-toast {
        position: fixed; z-index: 120;
        left: 50%; top: 38%;
        transform: translate(-50%, -50%);
        font-family: var(--hud-font);
        font-size: clamp(14px, 1.6vw, 28px);
        font-weight: 700;
        color: var(--hud-text);
        text-shadow: 0 0 16px var(--hud-accent-glow);
        letter-spacing: 3px;
        text-align: center;
        pointer-events: none;
        padding: clamp(8px, 1vh, 16px) clamp(16px, 2vw, 32px);
        background: var(--hud-bg);
        backdrop-filter: var(--hud-blur);
        -webkit-backdrop-filter: var(--hud-blur);
        border: 1px solid var(--hud-border);
        border-radius: 100px;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .hud-toast.visible { opacity: 1; }

      /* ══════════════════════════════════════════
         COMPACT VIEWPORT
         ══════════════════════════════════════════ */
      @media (max-height: 380px) {
        .mm-panel { display: none; }
        .en-panel { padding: 4px; }
        .hud-tl, .hud-tr { gap: 4px; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(this.el);
    document.body.appendChild(this.pauseOverlay);

    // ── Wire up buttons ──
    this.el.querySelector('#hud-home').addEventListener('click', () => onHome());
    this.el.querySelector('#hud-pause').addEventListener('click', () => onPause());
    this.pauseOverlay.querySelector('#pause-resume').addEventListener('click', () => onPause());
    this.pauseOverlay.querySelector('#pause-quit').addEventListener('click', () => onHome());

    // ── Cache DOM refs ──
    this.enSegs      = [...this.el.querySelectorAll('.en-seg')];
    this.mmLamps     = [...this.el.querySelectorAll('.mm-lamp')];
    this.mmPlayer    = this.el.querySelector('#mm-player');
    this.spTime      = this.el.querySelector('#sp-time');
    this.enLampCount = this.el.querySelector('#en-lamp-count');
    this.scoreEl     = this.el.querySelector('#hud-score');
    this.comboEl     = this.el.querySelector('#hud-combo');
    this.enBolt      = this.el.querySelector('.en-bolt');

    // Speedometer refs
    this._arcFill   = this.el.querySelector('#speedo-fill');
    this._needle    = this.el.querySelector('#speedo-needle');
    this._speedText = this.el.querySelector('#speedo-num');
    this._arcLength = ARC_LENGTH;
  }

  // ── Internal helpers ──

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
    const pct = 4 + Math.min(92, progress * 92);
    this.mmPlayer.style.bottom = pct.toFixed(1) + '%';
  }

  // ── Public API ──

  updateSpeed(mph) {
    const frac = Math.max(0, Math.min(1, (mph - 20) / 50));

    // Arc fill
    this._arcFill.style.strokeDashoffset = String(this._arcLength * (1 - frac));

    // Needle rotation: 160° (min) → 380° (max, wraps to 20°)
    const angle = ARC_START_DEG + frac * ARC_SWEEP_DEG;
    const nEnd = polarToXY(ARC_CX, ARC_CY, ARC_R - 18, angle);
    this._needle.setAttribute('x2', nEnd.x);
    this._needle.setAttribute('y2', nEnd.y);

    // Speed number
    this._speedText.textContent = Math.round(mph);

    // Color the number based on speed
    let col = 'var(--hud-accent)';
    if (frac > 0.8) col = 'var(--hud-danger)';
    else if (frac > 0.5) col = 'var(--hud-warning)';
    this._speedText.setAttribute('fill', col);
  }

  updateTime(elapsed) {
    const m = Math.floor(elapsed / 60);
    const s = Math.floor(elapsed % 60);
    const cs = Math.floor((elapsed * 100) % 100);
    this.spTime.textContent =
      String(m).padStart(2, '0') + "'" +
      String(s).padStart(2, '0') + '"' +
      String(cs).padStart(2, '0');
  }

  updateCharge(charge) {
    this._charge = charge;
    const lit = Math.round((charge / PLATES_TO_FILL_BAR) * EN_SEGS);

    this.enSegs.forEach((seg, i) => {
      seg.classList.remove('on-r', 'on-o', 'on-y', 'on-g', 'seg-flash');
      if (i < lit) {
        seg.classList.add(this._enColor(i));
        // Flash newly filled segments
        if (i >= this._prevLit) {
          seg.classList.add('seg-flash');
          setTimeout(() => seg.classList.remove('seg-flash'), 200);
        }
      }
    });

    // Bolt glow when > 60%
    this.enBolt.classList.toggle('charged', lit / EN_SEGS > 0.6);

    this._prevLit = lit;
    this._updateMinimap();
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

  // Kept for backwards-compatibility
  updateStage() {}

  celebrateCharge() {
    this.enSegs.forEach((seg, i) => {
      seg.classList.remove('on-r', 'on-o', 'on-y', 'seg-flash');
      seg.classList.add('on-g', 'flash');
      setTimeout(() => seg.classList.remove('flash'), 320 + i * 8);
    });
  }

  showFloatingScore(points) {
    const el = document.createElement('div');
    el.className = 'hud-float-score';
    el.textContent = `+${points}`;
    el.style.left = '50%';
    el.style.top  = '42%';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  showToast(text) {
    const el = document.createElement('div');
    el.className = 'hud-toast';
    el.textContent = text;
    document.body.appendChild(el);
    void el.offsetWidth;
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), 1200);
    setTimeout(() => el.remove(), 1500);
  }

  showPause() { this.pauseOverlay.style.display = 'flex'; }
  hidePause() { this.pauseOverlay.style.display = 'none'; }

  reset() {
    this._charge = 0;
    this._lamps  = 0;
    this._prevLit = 0;
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
    this.el.style.display = 'block';
    this.el.style.opacity = '0';
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
