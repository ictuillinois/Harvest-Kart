import { PLATES_TO_FILL_BAR, TOTAL_LAMP_POSTS } from '../utils/constants.js';

export class HUD {
  constructor(onHome, onPause) {
    // ── Top bar: charge + lamps + score + pause ──
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.innerHTML = `
      <button class="nav-back hud-home" id="hud-home" aria-label="Home">&#9664; HOME</button>
      <div class="hud-left">
        <div class="hud-bar-container">
          <span class="hud-energy-icon">&#9889;</span>
          <div class="hud-bar">
            <div class="hud-bar-fill" id="hud-bar-fill"></div>
            ${Array.from({ length: PLATES_TO_FILL_BAR }, (_, i) =>
              `<div class="hud-tick" style="left:${((i + 1) / PLATES_TO_FILL_BAR) * 100}%"></div>`
            ).join('')}
          </div>
          <span class="hud-charge-text" id="hud-charge-text" aria-live="polite">0/${PLATES_TO_FILL_BAR}</span>
        </div>
        <div class="hud-lamps">
          <span class="hud-lamp-icon">&#128161;</span>
          <span class="hud-lamp-count" id="hud-lamp-count" aria-live="polite">0 / ${TOTAL_LAMP_POSTS}</span>
        </div>
        <div class="hud-score-row">
          <span class="hud-score" id="hud-score">0</span>
          <span class="hud-combo" id="hud-combo"></span>
        </div>
      </div>
      <div class="hud-right">
        <button class="hud-pause-btn" id="hud-pause" aria-label="Pause">&#9646;&#9646;</button>
      </div>
    `;

    // ── Bottom-center dashboard panel ──
    this.dashboard = document.createElement('div');
    this.dashboard.id = 'dashboard';
    this.dashboard.innerHTML = `
      <svg class="dash-arc" viewBox="0 0 200 110" xmlns="http://www.w3.org/2000/svg">
        <!-- Background arc -->
        <path class="dash-arc-bg" d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="8" stroke-linecap="round"/>
        <!-- Tick marks -->
        ${Array.from({length: 11}, (_, i) => {
          const angle = Math.PI + (i / 10) * Math.PI;
          const cx = 100, cy = 100, r1 = 76, r2 = 84;
          const x1 = cx + r1 * Math.cos(angle), y1 = cy + r1 * Math.sin(angle);
          const x2 = cx + r2 * Math.cos(angle), y2 = cy + r2 * Math.sin(angle);
          const major = i % 5 === 0;
          return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="rgba(255,255,255,${major ? 0.6 : 0.25})" stroke-width="${major ? 1.5 : 0.8}"/>`;
        }).join('')}
        <!-- Speed arc (filled portion) -->
        <path id="dash-arc-fill" d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#arcGrad)" stroke-width="8" stroke-linecap="round" stroke-dasharray="251.3" stroke-dashoffset="251.3"/>
        <!-- Gradient -->
        <defs>
          <linearGradient id="arcGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#44ff44"/>
            <stop offset="50%" stop-color="#ffaa00"/>
            <stop offset="100%" stop-color="#ff3333"/>
          </linearGradient>
        </defs>
        <!-- Speed labels at ends -->
        <text x="16" y="96" class="dash-label">20</text>
        <text x="176" y="96" class="dash-label">70</text>
      </svg>
      <div class="dash-center">
        <span class="dash-speed" id="dash-speed">20</span>
        <span class="dash-unit">MPH</span>
      </div>
      <div class="dash-gear" id="dash-gear">1</div>
    `;

    // ── Pause overlay ──
    this.pauseOverlay = document.createElement('div');
    this.pauseOverlay.id = 'pause-overlay';
    this.pauseOverlay.innerHTML = `
      <div class="pause-card">
        <h2 class="pause-title">PAUSED</h2>
        <button class="pause-btn pause-resume" id="pause-resume">RESUME</button>
        <button class="pause-btn pause-quit" id="pause-quit">QUIT</button>
      </div>
    `;

    this.el.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 50;
      display: none; justify-content: space-between; align-items: flex-start;
      padding: 12px 16px;
      background: linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 100%);
    `;

    const style = document.createElement('style');
    style.textContent = `
      /* ── Top bar ── */
      .hud-left { display: flex; flex-direction: column; gap: 6px; }
      .hud-bar-container { display: flex; align-items: center; gap: 8px; }
      .hud-energy-icon { font-size: 1.4rem; }
      .hud-bar {
        position: relative;
        width: clamp(110px, 22vw, 180px); height: 16px;
        background: rgba(255,255,255,0.12);
        border: 1px solid rgba(255,255,255,0.25);
        border-radius: 8px; overflow: hidden;
      }
      .hud-bar-fill {
        position: absolute; top: 0; left: 0; bottom: 0;
        width: 0%; border-radius: 8px;
        background: linear-gradient(90deg, #39ff14, #7fff00);
        box-shadow: 0 0 10px rgba(57,255,20,0.5);
        transition: width 0.3s ease-out;
      }
      .hud-bar-fill.celebrate {
        animation: barCelebrate 0.5s ease-out;
      }
      @keyframes barCelebrate {
        0%   { box-shadow: 0 0 10px rgba(57,255,20,0.5); }
        50%  { box-shadow: 0 0 30px rgba(57,255,20,1), 0 0 60px rgba(57,255,20,0.5); }
        100% { box-shadow: 0 0 10px rgba(57,255,20,0.5); }
      }
      .hud-tick { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(0,0,0,0.3); }
      .hud-charge-text { color: rgba(255,255,255,0.7); font-size: 0.8rem; font-weight: 600; min-width: 32px; }
      .hud-lamps { display: flex; align-items: center; gap: 6px; color: #fff; font-size: 0.9rem; font-weight: 600; text-shadow: 0 1px 3px rgba(0,0,0,0.5); }
      .hud-lamp-icon { font-size: 1.1rem; }
      .hud-score-row { display: flex; align-items: center; gap: 10px; margin-top: 2px; }
      .hud-score { font-family: 'Courier New', monospace; font-size: 0.9rem; font-weight: 900; color: rgba(255,255,255,0.8); letter-spacing: 1px; }
      .hud-combo { font-family: Impact, 'Arial Black', sans-serif; font-size: 0.85rem; font-weight: 700; color: #ffaa00; text-shadow: 0 0 6px rgba(255,170,0,0.5); letter-spacing: 1px; transition: transform 0.15s; }
      .hud-combo.pop { transform: scale(1.4); }

      .hud-right { display: flex; align-items: flex-start; gap: 10px; }
      .hud-pause-btn {
        background: rgba(0,0,0,0.4); border: 1.5px solid rgba(255,255,255,0.25);
        border-radius: 8px; color: rgba(255,255,255,0.8); font-size: 0.9rem;
        padding: 6px 10px; cursor: pointer; backdrop-filter: blur(4px);
        transition: background 0.15s; letter-spacing: 2px;
      }
      .hud-pause-btn:hover { background: rgba(255,255,255,0.12); }
      .hud-pause-btn:active { transform: scale(0.95); }
      .hud-home { position: fixed; z-index: 55; }

      /* ══════════════════════════════════════
         DASHBOARD PANEL (bottom center)
         ══════════════════════════════════════ */
      #dashboard {
        position: fixed;
        bottom: clamp(8px, 2vh, 20px);
        left: 50%; transform: translateX(-50%);
        z-index: 58;
        display: none;
        width: clamp(140px, 22vw, 200px);
        pointer-events: none;
      }

      /* SVG arc gauge */
      .dash-arc {
        width: 100%;
        filter: drop-shadow(0 2px 8px rgba(0,0,0,0.5));
      }
      .dash-label {
        font-size: 8px; fill: rgba(255,255,255,0.4);
        font-family: 'Courier New', monospace; font-weight: 600;
        text-anchor: middle;
      }

      /* Center speed readout (overlaid on the arc) */
      .dash-center {
        position: absolute;
        bottom: clamp(8px, 1.5vh, 16px);
        left: 50%; transform: translateX(-50%);
        display: flex; flex-direction: column; align-items: center;
        line-height: 1;
      }
      .dash-speed {
        font-family: 'Courier New', monospace;
        font-size: clamp(1.6rem, 4vw, 2.4rem);
        font-weight: 900; color: #fff;
        text-shadow: 0 0 10px rgba(255,255,255,0.3), 0 2px 4px rgba(0,0,0,0.5);
        letter-spacing: -1px;
      }
      .dash-unit {
        font-size: 0.55rem; font-weight: 700;
        color: rgba(255,255,255,0.5);
        letter-spacing: 2px;
      }

      /* Gear indicator */
      .dash-gear {
        position: absolute;
        top: clamp(6px, 1vh, 12px);
        right: clamp(10px, 2vw, 22px);
        font-family: Impact, 'Arial Black', sans-serif;
        font-size: clamp(1.1rem, 2.5vw, 1.6rem);
        font-weight: 900; color: #39ff14;
        text-shadow: 0 0 8px rgba(57,255,20,0.4);
        line-height: 1;
      }

      /* ── Responsive ── */
      @media (max-width: 500px) {
        #dashboard { width: 120px; }
        .hud-bar { width: 100px; height: 12px; }
        .hud-lamps { font-size: 0.8rem; }
      }

      /* ── Pause overlay ── */
      #pause-overlay {
        position: fixed; inset: 0; z-index: 200;
        display: none; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.7); backdrop-filter: blur(6px);
        animation: fadeIn 0.2s ease-out;
      }
      .pause-card {
        text-align: center; background: rgba(0,0,0,0.4);
        border: 2px solid rgba(255,255,255,0.15); border-radius: 20px;
        padding: clamp(24px, 4vw, 40px); min-width: 220px;
      }
      .pause-title {
        font-family: Impact, 'Arial Black', sans-serif;
        font-size: clamp(1.8rem, 5vw, 2.5rem); color: #fff;
        letter-spacing: 6px; margin-bottom: 24px;
        text-shadow: 0 2px 4px rgba(0,0,0,0.5);
      }
      .pause-btn {
        display: block; width: 100%;
        font-family: Impact, 'Arial Black', sans-serif;
        font-size: 1.1rem; font-weight: 700; letter-spacing: 3px;
        text-transform: uppercase; padding: 12px 0; margin-bottom: 10px;
        border: none; border-radius: 10px; cursor: pointer;
        transition: transform 0.15s, box-shadow 0.15s;
      }
      .pause-btn:active { transform: scale(0.96); }
      .pause-resume {
        background: linear-gradient(135deg, #39ff14, #7fff00);
        color: #1a2e18; box-shadow: 0 0 15px rgba(57,255,20,0.3);
      }
      .pause-resume:hover { box-shadow: 0 0 25px rgba(57,255,20,0.5); }
      .pause-quit {
        background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7);
        border: 1px solid rgba(255,255,255,0.2);
      }
      .pause-quit:hover { background: rgba(255,255,255,0.15); }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.el);
    document.body.appendChild(this.dashboard);
    document.body.appendChild(this.pauseOverlay);

    this.el.querySelector('#hud-home').addEventListener('click', () => onHome());
    this.el.querySelector('#hud-pause').addEventListener('click', () => onPause());
    this.pauseOverlay.querySelector('#pause-resume').addEventListener('click', () => onPause());
    this.pauseOverlay.querySelector('#pause-quit').addEventListener('click', () => onHome());

    this.barFill = this.el.querySelector('#hud-bar-fill');
    this.chargeText = this.el.querySelector('#hud-charge-text');
    this.lampCount = this.el.querySelector('#hud-lamp-count');
    this.scoreEl = this.el.querySelector('#hud-score');
    this.comboEl = this.el.querySelector('#hud-combo');
    this.dashSpeed = this.dashboard.querySelector('#dash-speed');
    this.dashArcFill = this.dashboard.querySelector('#dash-arc-fill');
    this.dashGear = this.dashboard.querySelector('#dash-gear');

    // Arc total length (semicircle with r=80): π * 80 ≈ 251.3
    this.arcTotal = 251.3;
  }

  updateCharge(charge) {
    const pct = (charge / PLATES_TO_FILL_BAR) * 100;
    this.barFill.style.width = pct + '%';
    this.chargeText.textContent = `${charge}/${PLATES_TO_FILL_BAR}`;
  }

  celebrateCharge() {
    this.barFill.classList.add('celebrate');
    setTimeout(() => this.barFill.classList.remove('celebrate'), 500);
  }

  updateLamps(lit) {
    this.lampCount.textContent = `${lit} / ${TOTAL_LAMP_POSTS}`;
  }

  updateScore(score) {
    this.scoreEl.textContent = score.toLocaleString();
  }

  updateCombo(combo) {
    if (combo >= 2) {
      this.comboEl.textContent = `x${combo}`;
      this.comboEl.classList.add('pop');
      setTimeout(() => this.comboEl.classList.remove('pop'), 150);
    } else {
      this.comboEl.textContent = '';
    }
  }

  updateSpeed(mph) {
    const display = Math.round(mph);
    this.dashSpeed.textContent = display;

    // Arc fill: 0% at 20mph, 100% at 70mph
    const pct = Math.max(0, Math.min(1, (mph - 20) / 50));
    const offset = this.arcTotal * (1 - pct);
    this.dashArcFill.setAttribute('stroke-dashoffset', offset.toFixed(1));

    // Color the speed number
    if (display >= 55) {
      this.dashSpeed.style.color = '#ff4444';
    } else if (display >= 40) {
      this.dashSpeed.style.color = '#ffaa00';
    } else {
      this.dashSpeed.style.color = '#fff';
    }

    // Gear indicator based on speed zones
    const gear = display < 30 ? 1 : display < 42 ? 2 : display < 54 ? 3 : display < 64 ? 4 : 5;
    this.dashGear.textContent = gear;
  }

  showPause() { this.pauseOverlay.style.display = 'flex'; }
  hidePause() { this.pauseOverlay.style.display = 'none'; }

  reset() {
    this.updateCharge(0);
    this.updateLamps(0);
    this.updateSpeed(20);
    this.updateScore(0);
    this.updateCombo(0);
    this.hidePause();
  }

  show() {
    this.el.style.display = 'flex';
    this.dashboard.style.display = 'block';
  }

  hide() {
    this.el.style.display = 'none';
    this.dashboard.style.display = 'none';
    this.hidePause();
  }
}
