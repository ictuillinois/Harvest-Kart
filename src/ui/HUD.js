import { PLATES_TO_FILL_BAR, TOTAL_LAMP_POSTS } from '../utils/constants.js';

export class HUD {
  constructor(onHome, onPause) {
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
        <div class="hud-speedo">
          <div class="speedo-gauge">
            <div class="speedo-gauge-fill" id="speedo-fill"></div>
            <div class="speedo-gauge-marks">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
            <div class="speedo-labels">
              <span class="speedo-max">70</span>
              <span class="speedo-min">20</span>
            </div>
          </div>
          <div class="speedo-digital">
            <span class="speedo-value" id="speedo-value">20</span>
            <span class="speedo-unit">MPH</span>
          </div>
        </div>
      </div>
    `;

    // --- Pause overlay (hidden by default) ---
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
      /* ── Left side ── */
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
      .hud-tick {
        position: absolute; top: 0; bottom: 0; width: 1px;
        background: rgba(0,0,0,0.3);
      }
      .hud-charge-text {
        color: rgba(255,255,255,0.7); font-size: 0.8rem; font-weight: 600;
        min-width: 32px;
      }
      .hud-lamps {
        display: flex; align-items: center; gap: 6px;
        color: #fff; font-size: 0.9rem; font-weight: 600;
        text-shadow: 0 1px 3px rgba(0,0,0,0.5);
      }
      .hud-lamp-icon { font-size: 1.1rem; }

      /* Score + combo */
      .hud-score-row {
        display: flex; align-items: center; gap: 10px;
        margin-top: 2px;
      }
      .hud-score {
        font-family: 'Courier New', monospace;
        font-size: 0.9rem; font-weight: 900;
        color: rgba(255,255,255,0.8);
        letter-spacing: 1px;
      }
      .hud-combo {
        font-family: Impact, 'Arial Black', sans-serif;
        font-size: 0.85rem; font-weight: 700;
        color: #ffaa00;
        text-shadow: 0 0 6px rgba(255,170,0,0.5);
        letter-spacing: 1px;
        transition: transform 0.15s, opacity 0.15s;
      }
      .hud-combo.pop {
        transform: scale(1.4);
      }

      /* ── Right side ── */
      .hud-right { display: flex; align-items: flex-start; gap: 10px; }

      /* Pause button */
      .hud-pause-btn {
        background: rgba(0,0,0,0.4);
        border: 1.5px solid rgba(255,255,255,0.25);
        border-radius: 8px;
        color: rgba(255,255,255,0.8);
        font-size: 0.9rem;
        padding: 6px 10px;
        cursor: pointer;
        backdrop-filter: blur(4px);
        transition: background 0.15s, border-color 0.15s;
        letter-spacing: 2px;
      }
      .hud-pause-btn:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.5); }
      .hud-pause-btn:active { transform: scale(0.95); }

      /* ── Speedometer ── */
      .hud-speedo { display: flex; align-items: stretch; gap: 8px; }
      .speedo-gauge {
        position: relative;
        width: 18px; height: 80px;
        background: rgba(0,0,0,0.5);
        border: 1.5px solid rgba(255,255,255,0.3);
        border-radius: 4px; overflow: hidden;
        display: flex; flex-direction: column; justify-content: flex-end;
      }
      .speedo-gauge-fill {
        width: 100%; height: 0%;
        border-radius: 0 0 3px 3px;
        background: linear-gradient(0deg, #ff3300 0%, #ffaa00 40%, #44ff44 100%);
        transition: height 0.15s ease-out;
      }
      .speedo-gauge-marks {
        position: absolute; inset: 0;
        display: flex; flex-direction: column; justify-content: space-between;
        padding: 2px 0; pointer-events: none;
      }
      .speedo-gauge-marks span {
        display: block; width: 100%; height: 1px;
        background: rgba(255,255,255,0.2);
      }
      .speedo-labels {
        position: absolute; right: -22px; top: 0; bottom: 0;
        display: flex; flex-direction: column; justify-content: space-between;
        pointer-events: none;
      }
      .speedo-labels span {
        font-size: 0.65rem; color: rgba(255,255,255,0.5);
        font-weight: 600; line-height: 1;
      }
      .speedo-digital {
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.6);
        border: 1.5px solid rgba(255,255,255,0.25);
        border-radius: 6px; padding: 6px 10px; min-width: 56px;
      }
      .speedo-value {
        font-family: 'Courier New', monospace;
        font-size: 1.6rem; font-weight: 900;
        color: #44ff44; text-shadow: 0 0 8px rgba(68,255,68,0.5);
        line-height: 1; letter-spacing: -1px;
      }
      .speedo-unit {
        font-size: 0.6rem; font-weight: 700;
        color: rgba(255,255,255,0.6); letter-spacing: 2px; margin-top: 2px;
      }

      .hud-home { position: fixed; z-index: 55; }

      /* ── Pause overlay ── */
      #pause-overlay {
        position: fixed; inset: 0; z-index: 200;
        display: none; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.7);
        backdrop-filter: blur(6px);
        animation: fadeIn 0.2s ease-out;
      }
      .pause-card {
        text-align: center;
        background: rgba(0,0,0,0.4);
        border: 2px solid rgba(255,255,255,0.15);
        border-radius: 20px;
        padding: clamp(24px, 4vw, 40px);
        min-width: 220px;
      }
      .pause-title {
        font-family: Impact, 'Arial Black', sans-serif;
        font-size: clamp(1.8rem, 5vw, 2.5rem);
        color: #fff; letter-spacing: 6px;
        margin-bottom: 24px;
        text-shadow: 0 2px 4px rgba(0,0,0,0.5);
      }
      .pause-btn {
        display: block; width: 100%;
        font-family: Impact, 'Arial Black', sans-serif;
        font-size: 1.1rem; font-weight: 700;
        letter-spacing: 3px; text-transform: uppercase;
        padding: 12px 0; margin-bottom: 10px;
        border: none; border-radius: 10px;
        cursor: pointer;
        transition: transform 0.15s, box-shadow 0.15s;
      }
      .pause-btn:active { transform: scale(0.96); }
      .pause-resume {
        background: linear-gradient(135deg, #39ff14, #7fff00);
        color: #1a2e18;
        box-shadow: 0 0 15px rgba(57,255,20,0.3);
      }
      .pause-resume:hover { box-shadow: 0 0 25px rgba(57,255,20,0.5); }
      .pause-quit {
        background: rgba(255,255,255,0.1);
        color: rgba(255,255,255,0.7);
        border: 1px solid rgba(255,255,255,0.2);
      }
      .pause-quit:hover { background: rgba(255,255,255,0.15); }

      /* ── Responsive ── */
      @media (max-width: 500px) {
        .hud-bar { width: 100px; height: 12px; }
        .speedo-gauge { height: 60px; width: 14px; }
        .speedo-digital { padding: 4px 8px; min-width: 46px; }
        .speedo-value { font-size: 1.2rem; }
        .hud-lamps { font-size: 0.8rem; }
        .hud-pause-btn { padding: 5px 8px; font-size: 0.8rem; }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.el);
    document.body.appendChild(this.pauseOverlay);

    this.el.querySelector('#hud-home').addEventListener('click', () => onHome());
    this.el.querySelector('#hud-pause').addEventListener('click', () => onPause());
    this.pauseOverlay.querySelector('#pause-resume').addEventListener('click', () => onPause());
    this.pauseOverlay.querySelector('#pause-quit').addEventListener('click', () => onHome());

    this.barFill = this.el.querySelector('#hud-bar-fill');
    this.chargeText = this.el.querySelector('#hud-charge-text');
    this.lampCount = this.el.querySelector('#hud-lamp-count');
    this.speedoValue = this.el.querySelector('#speedo-value');
    this.speedoFill = this.el.querySelector('#speedo-fill');
    this.scoreEl = this.el.querySelector('#hud-score');
    this.comboEl = this.el.querySelector('#hud-combo');
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

  updateSpeed(mph) {
    const display = Math.round(mph);
    this.speedoValue.textContent = display;
    const pct = Math.max(0, Math.min(100, ((mph - 20) / 50) * 100));
    this.speedoFill.style.height = pct + '%';

    if (display >= 55) {
      this.speedoValue.style.color = '#ff4444';
      this.speedoValue.style.textShadow = '0 0 8px rgba(255,68,68,0.5)';
    } else if (display >= 40) {
      this.speedoValue.style.color = '#ffaa00';
      this.speedoValue.style.textShadow = '0 0 8px rgba(255,170,0,0.5)';
    } else {
      this.speedoValue.style.color = '#44ff44';
      this.speedoValue.style.textShadow = '0 0 8px rgba(68,255,68,0.5)';
    }
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

  show() { this.el.style.display = 'flex'; }
  hide() { this.el.style.display = 'none'; this.hidePause(); }
}
