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

// Pre-cached 0-padded digit strings — avoids String()+padStart() allocations
const _pad2 = [];
for (let i = 0; i < 100; i++) _pad2[i] = String(i).padStart(2, '0');

function describeArc(cx, cy, r, startDeg, sweepDeg) {
  const s = polarToXY(cx, cy, r, startDeg);
  const e = polarToXY(cx, cy, r, startDeg + sweepDeg);
  const large = sweepDeg > 180 ? 1 : 0;
  return `M ${s.x},${s.y} A ${r},${r} 0 ${large},1 ${e.x},${e.y}`;
}

const ARC_D = describeArc(ARC_CX, ARC_CY, ARC_R, ARC_START_DEG, ARC_SWEEP_DEG);

// ── Build minor tick marks (every 10 MPH, skip major ticks at 20) ──
function buildMinorTicks() {
  const ticks = [];
  for (let mph = 0; mph <= 100; mph += 10) {
    if (mph % 20 === 0) continue;
    const frac = mph / 100;
    const deg = ARC_START_DEG + frac * ARC_SWEEP_DEG;
    const inner = polarToXY(ARC_CX, ARC_CY, ARC_R - 10, deg);
    const outer = polarToXY(ARC_CX, ARC_CY, ARC_R - 5, deg);
    ticks.push(`<line x1="${inner.x}" y1="${inner.y}" x2="${outer.x}" y2="${outer.y}" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-linecap="round"/>`);
  }
  return ticks.join('');
}

// ── Build major tick marks (every 20 MPH: 0,20,40,60,80,100) ──
function buildTicks() {
  const ticks = [];
  for (let mph = 0; mph <= 100; mph += 20) {
    const frac = mph / 100;
    const deg = ARC_START_DEG + frac * ARC_SWEEP_DEG;
    const inner = polarToXY(ARC_CX, ARC_CY, ARC_R - 14, deg);
    const outer = polarToXY(ARC_CX, ARC_CY, ARC_R - 4, deg);
    const label = polarToXY(ARC_CX, ARC_CY, ARC_R - 22, deg);
    ticks.push(`<line x1="${inner.x}" y1="${inner.y}" x2="${outer.x}" y2="${outer.y}" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" stroke-linecap="round"/>`);
    ticks.push(`<text x="${label.x}" y="${label.y}" text-anchor="middle" dominant-baseline="central" fill="rgba(255,255,255,0.3)" font-family="var(--hud-font)" font-size="7">${mph}</text>`);
  }
  return ticks.join('');
}

// ── Tachometer arc (same geometry as speedometer for visual symmetry) ──
const TACHO_ARC_D = ARC_D; // reuse same arc path

// RPM range: 0-8000, but we display 1-8 (in thousands)
function buildTachoMinorTicks() {
  const ticks = [];
  for (let rpm = 500; rpm <= 8000; rpm += 500) {
    if (rpm % 1000 === 0) continue;
    const frac = rpm / 8000;
    const deg = ARC_START_DEG + frac * ARC_SWEEP_DEG;
    const inner = polarToXY(ARC_CX, ARC_CY, ARC_R - 8, deg);
    const outer = polarToXY(ARC_CX, ARC_CY, ARC_R - 4, deg);
    ticks.push(`<line x1="${inner.x}" y1="${inner.y}" x2="${outer.x}" y2="${outer.y}" stroke="rgba(255,255,255,0.12)" stroke-width="0.8" stroke-linecap="round"/>`);
  }
  return ticks.join('');
}

function buildTachoMajorTicks() {
  const ticks = [];
  for (let rpm = 0; rpm <= 8000; rpm += 1000) {
    const frac = rpm / 8000;
    const deg = ARC_START_DEG + frac * ARC_SWEEP_DEG;
    const inner = polarToXY(ARC_CX, ARC_CY, ARC_R - 14, deg);
    const outer = polarToXY(ARC_CX, ARC_CY, ARC_R - 4, deg);
    const label = polarToXY(ARC_CX, ARC_CY, ARC_R - 22, deg);
    const isRedline = rpm >= 7000;
    const strokeColor = isRedline ? 'rgba(255,50,50,0.6)' : 'rgba(255,255,255,0.3)';
    ticks.push(`<line x1="${inner.x}" y1="${inner.y}" x2="${outer.x}" y2="${outer.y}" stroke="${strokeColor}" stroke-width="1.5" stroke-linecap="round"/>`);
    ticks.push(`<text x="${label.x}" y="${label.y}" text-anchor="middle" dominant-baseline="central" fill="${isRedline ? 'rgba(255,50,50,0.5)' : 'rgba(255,255,255,0.25)'}" font-family="var(--hud-font)" font-size="7">${rpm / 1000}</text>`);
  }
  return ticks.join('');
}

// Redline arc segment (7000-8000 RPM = 87.5% to 100% of arc)
const REDLINE_START_FRAC = 7000 / 8000;
const REDLINE_ARC = describeArc(ARC_CX, ARC_CY, ARC_R, ARC_START_DEG + REDLINE_START_FRAC * ARC_SWEEP_DEG, (1 - REDLINE_START_FRAC) * ARC_SWEEP_DEG);

export class HUD {
  constructor(onHome, onPause) {
    this._charge = 0;
    this._lamps  = 0;
    this._prevLit = 0;

    // ── Energy segments HTML ──
    const enHTML = Array.from({ length: EN_SEGS }, (_, i) =>
      `<div class="en-seg" data-i="${i}"></div>`).join('');

    // ── Tachometer needle start ──
    const tachoNeedleStart = polarToXY(ARC_CX, ARC_CY, ARC_R - 18, ARC_START_DEG);

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
      <!-- Top-left: HOME + minimap + driver avatar -->
      <div class="hud-tl">
        <button class="hud-btn hud-glass" id="hud-home" aria-label="Home">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          HOME
        </button>
        <div class="hud-glass mm-panel">
          <div class="mm-header">
            <div class="mm-dot"></div>
            <div class="mm-label">ROUTE</div>
            <div class="mm-dot"></div>
          </div>
          <div class="mm-track">
            <div class="mm-terrain mm-terrain-l"></div>
            <div class="mm-road">
              <div class="mm-edge mm-edge-l"></div>
              <div class="mm-edge mm-edge-r"></div>
              <div class="mm-stripe mm-stripe-l"></div>
              <div class="mm-stripe mm-stripe-r"></div>
              <div class="mm-finish"></div>
              <div class="mm-start"></div>
              ${lampHTML}
              <div class="mm-player" id="mm-player">
                <svg class="mm-kart-icon" viewBox="0 0 10 14" fill="none">
                  <path d="M5 0L9 5V12C9 13 8 14 7 14H3C2 14 1 13 1 12V5L5 0Z" fill="currentColor"/>
                  <rect x="0" y="4" width="2" height="4" rx="0.5" fill="currentColor" opacity="0.5"/>
                  <rect x="8" y="4" width="2" height="4" rx="0.5" fill="currentColor" opacity="0.5"/>
                </svg>
              </div>
            </div>
            <div class="mm-terrain mm-terrain-r"></div>
          </div>
          <div class="mm-footer">
            <div class="mm-dist-bar"><div class="mm-dist-fill" id="mm-dist-fill"></div></div>
          </div>
        </div>
        <div class="hud-avatar-frame">
          <img class="hud-avatar" id="hud-avatar" src="" alt="" draggable="false"/>
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

      <!-- Bottom-left: Tachometer -->
      <div class="hud-bl">
        <div class="tacho-wrap">
          <svg class="tacho-svg" viewBox="0 0 200 140">
            <defs>
              <linearGradient id="tacho-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#00ff88"/>
                <stop offset="55%" stop-color="#ffdd00"/>
                <stop offset="82%" stop-color="#ff8800"/>
                <stop offset="100%" stop-color="#ff2233"/>
              </linearGradient>
              <filter id="tacho-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="tacho-needle-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <radialGradient id="tacho-bg-grad" cx="50%" cy="70%" r="55%">
                <stop offset="0%" stop-color="rgba(255,50,50,0.03)"/>
                <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
              </radialGradient>
            </defs>
            <!-- Background glow -->
            <circle cx="${ARC_CX}" cy="${ARC_CY}" r="90" fill="url(#tacho-bg-grad)"/>
            <!-- Outer decorative ring -->
            <path d="${describeArc(ARC_CX, ARC_CY, ARC_R + 6, ARC_START_DEG, ARC_SWEEP_DEG)}" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1.5" stroke-linecap="round"/>
            <!-- Arc track -->
            <path d="${TACHO_ARC_D}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="14" stroke-linecap="round"/>
            <!-- Redline zone background (always visible, subtle) -->
            <path d="${REDLINE_ARC}" fill="none" stroke="rgba(255,30,30,0.12)" stroke-width="14" stroke-linecap="round"/>
            <!-- Arc fill (animated) -->
            <path id="tacho-fill" d="${TACHO_ARC_D}" fill="none" stroke="url(#tacho-grad)" stroke-width="14" stroke-linecap="round"
                  stroke-dasharray="${ARC_LENGTH}" stroke-dashoffset="${ARC_LENGTH}" filter="url(#tacho-glow)"
                  style="transition: stroke-dashoffset 80ms ease-out;"/>
            <!-- Minor ticks -->
            ${buildTachoMinorTicks()}
            <!-- Major ticks + labels -->
            ${buildTachoMajorTicks()}
            <!-- Needle -->
            <line id="tacho-needle" x1="${ARC_CX}" y1="${ARC_CY}" x2="${tachoNeedleStart.x}" y2="${tachoNeedleStart.y}"
                  stroke="#fff" stroke-width="2.5" stroke-linecap="round" filter="url(#tacho-needle-glow)"/>
            <!-- Center cap -->
            <circle cx="${ARC_CX}" cy="${ARC_CY}" r="8" fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
            <circle cx="${ARC_CX}" cy="${ARC_CY}" r="4.5" fill="var(--hud-danger)" opacity="0.8"/>
            <!-- Gear number (large, center) -->
            <text id="tacho-gear" x="${ARC_CX}" y="${ARC_CY - 14}" text-anchor="middle" dominant-baseline="central"
                  fill="#fff" font-family="var(--hud-font)" font-size="40" font-weight="900">1</text>
            <!-- "GEAR" label -->
            <text x="${ARC_CX}" y="${ARC_CY + 8}" text-anchor="middle" dominant-baseline="central"
                  fill="rgba(255,255,255,0.3)" font-family="var(--hud-font)" font-size="8" font-weight="700" letter-spacing="3">GEAR</text>
            <!-- RPM x1000 label at bottom -->
            <text x="${ARC_CX}" y="132" text-anchor="middle" dominant-baseline="central"
                  fill="rgba(255,255,255,0.2)" font-family="var(--hud-font)" font-size="6" letter-spacing="1">RPM x1000</text>
          </svg>
        </div>
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
                  fill="#fff" font-family="var(--hud-font)" font-size="36" font-weight="900">0</text>
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
        padding: clamp(8px, 1.2vh, 20px) clamp(8px, 1vw, 20px);
        width: clamp(135px, 15vw, 315px);
      }

      /* Header bar */
      .mm-header {
        display: flex; align-items: center; justify-content: center;
        gap: clamp(4px, 0.4vw, 8px);
        margin-bottom: clamp(4px, 0.5vh, 8px);
      }
      .mm-label {
        font-size: clamp(7px, 0.9vw, 16px);
        font-weight: 700;
        color: var(--hud-text-muted);
        letter-spacing: 3px;
      }
      .mm-dot {
        width: 4px; height: 4px; border-radius: 50%;
        background: var(--hud-accent);
        box-shadow: 0 0 4px var(--hud-accent-glow);
      }

      /* Track container: terrain + road */
      .mm-track {
        display: flex;
        gap: 0;
        height: clamp(150px, 30vh, 360px);
      }
      .mm-terrain {
        flex: 0 0 clamp(9px, 1vw, 21px);
        border-radius: 2px;
      }
      .mm-terrain-l {
        background: linear-gradient(180deg,
          rgba(40,80,40,0.25) 0%, rgba(60,100,50,0.15) 30%,
          rgba(40,70,40,0.2) 60%, rgba(30,60,30,0.25) 100%);
        border-right: 1px solid rgba(255,255,255,0.04);
      }
      .mm-terrain-r {
        background: linear-gradient(180deg,
          rgba(40,80,40,0.25) 0%, rgba(50,90,45,0.15) 40%,
          rgba(40,70,40,0.2) 70%, rgba(30,60,30,0.25) 100%);
        border-left: 1px solid rgba(255,255,255,0.04);
      }

      /* Road surface */
      .mm-road {
        position: relative;
        flex: 1;
        background: linear-gradient(180deg, rgba(45,45,55,0.9) 0%, rgba(35,35,42,0.9) 100%);
        overflow: hidden;
      }

      /* Road edges (curb lines) */
      .mm-edge {
        position: absolute; top: 0; bottom: 0; width: 1.5px;
        background: rgba(255,255,255,0.12);
      }
      .mm-edge-l { left: 0; }
      .mm-edge-r { right: 0; }

      /* Dashed lane stripes (two lanes) */
      .mm-stripe {
        position: absolute; top: 0; bottom: 0; width: 1px;
        background: repeating-linear-gradient(
          to bottom,
          rgba(255,255,255,0.18) 0, rgba(255,255,255,0.18) 4px,
          transparent 4px, transparent 10px
        );
      }
      .mm-stripe-l { left: 33%; }
      .mm-stripe-r { left: 66%; }

      /* Finish line at top */
      .mm-finish {
        position: absolute; top: 2%; left: 8%; right: 8%; height: 3px;
        background: repeating-linear-gradient(
          90deg, #fff 0, #fff 3px, #222 3px, #222 6px
        );
        opacity: 0.4;
        border-radius: 1px;
      }
      /* Start line at bottom */
      .mm-start {
        position: absolute; bottom: 2%; left: 8%; right: 8%; height: 2px;
        background: rgba(34,255,170,0.3);
        border-radius: 1px;
      }

      /* Lamp markers */
      .mm-lamp {
        position: absolute; left: 50%;
        width: clamp(10px, 1vw, 20px); height: clamp(10px, 1vw, 20px);
        border-radius: 50%;
        background: var(--hud-segment-empty);
        border: 1.5px solid rgba(255,190,0,0.25);
        transform: translate(-50%, 50%);
        transition: background 0.4s, border-color 0.4s, box-shadow 0.4s;
      }
      .mm-lamp::after {
        content: '';
        position: absolute; inset: -3px;
        border-radius: 50%;
        border: 1px solid rgba(255,190,0,0.08);
      }
      .mm-lamp.lit {
        background: var(--hud-warning);
        border-color: var(--hud-warning);
        box-shadow: 0 0 6px 2px rgba(255,220,0,0.6);
      }
      .mm-lamp.lit::after {
        border-color: rgba(255,220,0,0.2);
      }

      /* Progress bar at bottom */
      .mm-footer {
        margin-top: clamp(4px, 0.4vh, 6px);
      }
      .mm-dist-bar {
        height: clamp(2px, 0.3vh, 4px);
        background: rgba(255,255,255,0.06);
        border-radius: 2px;
        overflow: hidden;
      }
      .mm-dist-fill {
        height: 100%; width: 0%;
        background: linear-gradient(90deg, var(--hud-accent), #44ffcc);
        border-radius: 2px;
        transition: width 0.3s ease;
        box-shadow: 0 0 4px var(--hud-accent-glow);
      }

      /* ── Driver avatar ── */
      .hud-avatar-frame {
        width: clamp(135px, 15vw, 315px);
        border-radius: clamp(4px, 0.5vw, 8px);
        border: 2px solid rgba(255,255,255,0.15);
        overflow: hidden;
        background: rgba(0,0,0,0.4);
        box-shadow: 0 2px 8px rgba(0,0,0,0.5), inset 0 0 12px rgba(0,0,0,0.3);
      }
      .hud-avatar {
        display: block;
        width: 100%; height: auto;
        object-fit: contain;
        pointer-events: none;
        user-select: none;
        filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));
      }
      .mm-player {
        position: absolute; left: 50%; bottom: 4%;
        width: clamp(14px, 1.6vw, 28px); height: clamp(20px, 2.2vw, 40px);
        color: var(--hud-accent);
        filter: drop-shadow(0 0 4px var(--hud-accent-glow));
        transform: translate(-50%, 50%);
        transition: bottom 0.28s ease-out;
        animation: kartPulse 1.5s ease-in-out infinite;
      }
      .mm-kart-icon {
        width: 100%; height: 100%;
        display: block;
      }
      @keyframes kartPulse {
        0%, 100% { filter: drop-shadow(0 0 4px var(--hud-accent-glow)); }
        50%      { filter: drop-shadow(0 0 8px var(--hud-accent-glow)) brightness(1.3); }
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
        font-size: clamp(24px, 3vw, 60px);
        font-weight: 700;
        color: var(--hud-text);
        text-shadow: 0 0 12px var(--hud-accent-glow);
        letter-spacing: 3px;
      }
      .hud-combo {
        font-size: clamp(21px, 2.4vw, 48px);
        font-weight: 900;
        color: var(--hud-accent);
        text-shadow:
          0 0 12px var(--hud-accent-glow),
          0 0 28px rgba(0,255,136,0.2);
        letter-spacing: 2px;
        transition: transform 0.12s;
        min-height: clamp(24px, 3vh, 54px);
      }
      .hud-combo.pop { transform: scale(1.5); }

      /* ── Floating score popup ── */
      .hud-float-score {
        position: fixed; z-index: 55;
        font-family: var(--hud-font);
        font-size: clamp(21px, 2.4vw, 45px);
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
        display: flex; align-items: center; gap: clamp(7px, 0.75vw, 15px);
        padding: clamp(7px, 0.9vh, 15px) clamp(12px, 1.2vw, 24px);
        border-color: rgba(255,221,0,0.2);
      }
      .timer-icon {
        width: clamp(21px, 2vw, 36px); height: clamp(21px, 2vw, 36px);
        opacity: 0.7;
        filter: drop-shadow(0 0 3px rgba(255,221,0,0.4));
      }
      .hud-timer {
        font-family: var(--hud-font);
        font-variant-numeric: tabular-nums;
        font-size: clamp(21px, 2.25vw, 45px);
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
        padding: clamp(10px, 1.4vh, 24px) clamp(9px, 1vw, 20px);
        width: clamp(66px, 7vw, 120px);
      }
      .en-bolt {
        opacity: 0.4;
        transition: opacity 0.3s, filter 0.3s;
        width: clamp(22px, 2.5vw, 42px); height: clamp(22px, 2.5vw, 42px);
      }
      .en-bolt.charged {
        opacity: 1;
        filter: drop-shadow(0 0 4px var(--hud-accent));
      }
      .en-bar {
        display: flex; flex-direction: column-reverse; gap: clamp(2px, 0.25vh, 3px);
      }
      .en-seg {
        width: clamp(39px, 4.5vw, 72px); height: clamp(12px, 2vh, 27px);
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
         BOTTOM-LEFT — TACHOMETER (circular SVG dial)
         ══════════════════════════════════════════ */
      .hud-bl {
        position: absolute;
        bottom: clamp(8px, 1.5vh, 20px); left: clamp(8px, 1.5vw, 24px);
      }
      .tacho-wrap {
        width: clamp(200px, 28vw, 520px);
        position: relative;
      }
      .tacho-svg {
        width: 100%; height: auto;
        filter: drop-shadow(0 4px 16px rgba(0,0,0,0.5));
      }
      #tacho-needle {
        transform-origin: ${ARC_CX}px ${ARC_CY}px;
        transition: transform 80ms ease-out;
      }
      #tacho-fill {
        transition: stroke-dashoffset 80ms ease-out;
      }
      /* Redline pulse on the fill arc when in redline */
      .tacho-svg.redline #tacho-fill {
        animation: tachoRedlinePulse 0.35s ease-in-out infinite;
      }
      @keyframes tachoRedlinePulse {
        0%, 100% { opacity: 0.85; }
        50% { opacity: 1; }
      }
      /* Gear shift flash — brief white flash on the arc */
      .tacho-svg.shift-flash #tacho-fill {
        stroke: #fff !important;
        filter: drop-shadow(0 0 8px rgba(255,255,255,0.6)) !important;
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
        left: 50%; top: 35%;
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

      @keyframes hud-vibrate {
        0%, 100% { transform: translate(-50%, -50%) translateX(0); }
        10% { transform: translate(-50%, -50%) translateX(-3px); }
        20% { transform: translate(-50%, -50%) translateX(3px); }
        30% { transform: translate(-50%, -50%) translateX(-2px); }
        40% { transform: translate(-50%, -50%) translateX(2px); }
        50% { transform: translate(-50%, -50%) translateX(-1px); }
        60% { transform: translate(-50%, -50%) translateX(1px); }
        70% { transform: translate(-50%, -50%) translateX(-1px); }
        80% { transform: translate(-50%, -50%) translateX(0); }
      }
      @keyframes hud-timer-vibrate {
        0%, 100% { transform: translateX(0); }
        15% { transform: translateX(-2px); }
        30% { transform: translateX(2px); }
        45% { transform: translateX(-1px); }
        60% { transform: translateX(1px); }
        75% { transform: translateX(-1px); }
      }

      .hud-hurry {
        position: fixed; z-index: 119;
        left: 50%; top: 28%;
        transform: translate(-50%, -50%);
        font-family: var(--hud-font);
        font-size: clamp(16px, 2vw, 36px);
        font-weight: 900;
        color: #ff4444;
        text-shadow: 0 0 16px #ff2200, 0 0 30px #ff0000, 0 2px 4px rgba(0,0,0,0.9);
        letter-spacing: 4px;
        text-align: center;
        pointer-events: none;
        padding: clamp(8px, 1vh, 16px) clamp(16px, 2vw, 32px);
        background: linear-gradient(135deg, rgba(255,40,0,0.12), rgba(255,0,0,0.06));
        border: 2px solid rgba(255,60,0,0.4);
        border-radius: 100px;
        animation: hud-vibrate 0.4s ease-in-out infinite;
      }

      .hud-timer-panel.urgency {
        border-color: rgba(255,50,0,0.5) !important;
      }
      .hud-timer-panel.urgency .hud-timer {
        color: #ff4444 !important;
        text-shadow: 0 0 10px rgba(255,50,0,0.6), 0 0 24px rgba(255,0,0,0.3) !important;
        animation: hud-timer-vibrate 0.5s ease-in-out infinite;
      }

      .hud-turbo-toast {
        position: fixed; z-index: 121;
        left: 50%; top: 50%;
        transform: translate(-50%, -50%) scale(0.8);
        font-family: var(--hud-font);
        font-size: clamp(18px, 2.2vw, 40px);
        font-weight: 900;
        color: #ffaa00;
        text-shadow: 0 0 20px #ff6600, 0 0 40px #ff4400, 0 2px 4px rgba(0,0,0,0.8);
        letter-spacing: 5px;
        text-align: center;
        pointer-events: none;
        padding: clamp(10px, 1.2vh, 20px) clamp(20px, 2.5vw, 40px);
        background: linear-gradient(135deg, rgba(255,100,0,0.15), rgba(255,50,0,0.08));
        border: 2px solid rgba(255,150,0,0.4);
        border-radius: 100px;
        opacity: 0;
        transition: opacity 0.15s ease, transform 0.3s ease;
      }
      .hud-turbo-toast.visible {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1.0);
      }

      /* ══════════════════════════════════════════
         COMPACT VIEWPORT
         ══════════════════════════════════════════ */
      @media (max-height: 380px) {
        .mm-panel { display: none; }
        .hud-avatar-frame { display: none; }
        .hud-bl { display: none; }
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
    this._distFill   = this.el.querySelector('#mm-dist-fill');
    this.spTime      = this.el.querySelector('#sp-time');
    this.enLampCount = this.el.querySelector('#en-lamp-count');
    this.scoreEl     = this.el.querySelector('#hud-score');
    this.comboEl     = this.el.querySelector('#hud-combo');
    this.enBolt      = this.el.querySelector('.en-bolt');
    this._avatarImg  = this.el.querySelector('#hud-avatar');

    // Speedometer refs
    this._arcFill   = this.el.querySelector('#speedo-fill');
    this._needle    = this.el.querySelector('#speedo-needle');
    this._speedText = this.el.querySelector('#speedo-num');
    this._arcLength = ARC_LENGTH;

    // Tachometer refs (SVG dial)
    this._tachoFill   = this.el.querySelector('#tacho-fill');
    this._tachoNeedle = this.el.querySelector('#tacho-needle');
    this._tachoGear   = this.el.querySelector('#tacho-gear');
    this._tachoSvg    = this.el.querySelector('.tacho-svg');
    this._lastGear    = 1;
    this._tachoArcLen  = ARC_LENGTH;
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
    if (this._distFill) this._distFill.style.width = (progress * 100).toFixed(1) + '%';
  }

  // ── Public API ──

  setDriver(driver) {
    if (this._avatarImg && driver && driver.avatar) {
      this._avatarImg.src = driver.avatar;
      this._avatarImg.alt = driver.name;
      this._avatarImg.parentElement.style.borderColor = driver.accentColor || 'rgba(255,255,255,0.15)';
    }
  }

  updateSpeed(mph) {
    const rounded = Math.round(mph);
    if (rounded === this._lastSpeedVal) return;  // Skip if unchanged
    this._lastSpeedVal = rounded;

    const frac = Math.max(0, Math.min(1, mph / 100));

    // Arc fill
    this._arcFill.style.strokeDashoffset = String(this._arcLength * (1 - frac));

    // Needle rotation: 160° (min) → 380° (max, wraps to 20°)
    const angle = ARC_START_DEG + frac * ARC_SWEEP_DEG;
    const nRad = (angle - 90) * Math.PI / 180;
    this._needle.setAttribute('x2', ARC_CX + (ARC_R - 18) * Math.cos(nRad));
    this._needle.setAttribute('y2', ARC_CY + (ARC_R - 18) * Math.sin(nRad));

    // Speed number
    this._speedText.textContent = rounded;

    // Color the number based on speed
    let col = 'var(--hud-accent)';
    if (frac > 0.8) col = 'var(--hud-danger)';
    else if (frac > 0.5) col = 'var(--hud-warning)';
    this._speedText.setAttribute('fill', col);
  }

  updateTime(elapsed) {
    const cs = Math.floor((elapsed * 100) % 100);
    if (cs === this._lastTimeCs && Math.floor(elapsed) === this._lastTimeSec) return;
    this._lastTimeSec = Math.floor(elapsed);
    this._lastTimeCs = cs;

    const m = Math.floor(elapsed / 60);
    const s = Math.floor(elapsed % 60);
    this.spTime.textContent = _pad2[m] + "'" + _pad2[s] + '"' + _pad2[cs];
  }

  updateCharge(charge) {
    this._charge = charge;
    const lit = Math.round((charge / PLATES_TO_FILL_BAR) * EN_SEGS);
    if (lit === this._prevLit) return; // skip if no visual change

    for (let i = 0; i < EN_SEGS; i++) {
      const seg = this.enSegs[i];
      if (i < lit) {
        const target = this._enColor(i);
        if (!seg.classList.contains(target)) {
          seg.className = 'en-seg ' + target;
        }
        if (i >= this._prevLit) {
          seg.classList.add('seg-flash');
          setTimeout(() => seg.classList.remove('seg-flash'), 200);
        }
      } else if (seg.className !== 'en-seg') {
        seg.className = 'en-seg';
      }
    }

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

  updateTacho(rpm, gear) {
    const rpmRound = Math.round(rpm / 50) * 50;  // Quantize to 50 RPM steps
    if (rpmRound === this._lastRpmVal && gear === this._lastGear) return;
    this._lastRpmVal = rpmRound;

    const frac = Math.max(0, Math.min(1, rpm / 8000));

    // Arc fill
    this._tachoFill.style.strokeDashoffset = String(this._tachoArcLen * (1 - frac));

    // Needle
    const angle = ARC_START_DEG + frac * ARC_SWEEP_DEG;
    const nRad = (angle - 90) * Math.PI / 180;
    this._tachoNeedle.setAttribute('x2', ARC_CX + (ARC_R - 18) * Math.cos(nRad));
    this._tachoNeedle.setAttribute('y2', ARC_CY + (ARC_R - 18) * Math.sin(nRad));

    // Redline visual feedback
    this._tachoSvg.classList.toggle('redline', rpm > 7500);

    // Gear number
    if (this._lastGear !== gear) {
      const isUp = gear > this._lastGear;
      this._tachoGear.textContent = gear;
      // Brief color flash
      this._tachoGear.setAttribute('fill', isUp ? 'var(--hud-accent)' : '#ff8800');
      setTimeout(() => this._tachoGear.setAttribute('fill', '#fff'), 300);
      this._lastGear = gear;
    }
  }

  flashTacho() {
    this._tachoSvg.classList.add('shift-flash');
    setTimeout(() => this._tachoSvg.classList.remove('shift-flash'), 120);
  }

  celebrateCharge() {
    this.enSegs.forEach((seg, i) => {
      seg.classList.remove('on-r', 'on-o', 'on-y', 'seg-flash');
      seg.classList.add('on-g', 'flash');
      setTimeout(() => seg.classList.remove('flash'), 320 + i * 8);
    });
  }

  showFloatingScore(points) {
    // Reuse a pooled element instead of createElement each hit (avoids DOM append reflow)
    if (!this._floatEl) {
      this._floatEl = document.createElement('div');
      this._floatEl.className = 'hud-float-score';
      this._floatEl.style.left = '50%';
      this._floatEl.style.top = '42%';
      document.body.appendChild(this._floatEl);
    }
    const el = this._floatEl;
    el.textContent = `+${points}`;
    // Restart animation without forced reflow — split across frames
    el.classList.remove('hud-float-score');
    requestAnimationFrame(() => el.classList.add('hud-float-score'));
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

  showHurry() {
    if (this._hurryEl) return; // already showing
    const el = document.createElement('div');
    el.className = 'hud-hurry';
    el.textContent = 'HURRY UP!';
    document.body.appendChild(el);
    this._hurryEl = el;

    // Timer urgency
    const timerPanel = this.el.querySelector('.hud-timer-panel');
    if (timerPanel) timerPanel.classList.add('urgency');
  }

  hideHurry() {
    if (this._hurryEl) {
      this._hurryEl.remove();
      this._hurryEl = null;
    }
    const timerPanel = this.el.querySelector('.hud-timer-panel');
    if (timerPanel) timerPanel.classList.remove('urgency');
  }

  showTurboToast(text) {
    const el = document.createElement('div');
    el.className = 'hud-turbo-toast';
    el.textContent = text;
    document.body.appendChild(el);
    void el.offsetWidth;
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), 2000);
    setTimeout(() => el.remove(), 2300);
  }

  showPause() { this.pauseOverlay.style.display = 'flex'; }
  hidePause() { this.pauseOverlay.style.display = 'none'; }

  reset() {
    this._charge = 0;
    this._lamps  = 0;
    this._prevLit = 0;
    this.hideHurry();
    this.updateCharge(0);
    this.updateLamps(0);
    this.updateSpeed(0);
    this.updateTacho(1000, 1);
    this._lastGear = 1;
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
