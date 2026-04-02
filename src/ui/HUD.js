import { PLATES_TO_FILL_BAR, TOTAL_LAMP_POSTS } from '../utils/constants.js';

export class HUD {
  constructor(onHome) {
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.innerHTML = `
      <button class="hud-home-btn" id="hud-home" aria-label="Home">&#9664; HOME</button>
      <div class="hud-left">
        <div class="hud-bar-container">
          <span class="hud-energy-icon">&#9889;</span>
          <div class="hud-bar">
            <div class="hud-bar-fill" id="hud-bar-fill"></div>
            ${Array.from({ length: PLATES_TO_FILL_BAR }, (_, i) =>
              `<div class="hud-tick" style="left:${((i + 1) / PLATES_TO_FILL_BAR) * 100}%"></div>`
            ).join('')}
          </div>
          <span class="hud-charge-text" id="hud-charge-text">0/${PLATES_TO_FILL_BAR}</span>
        </div>
        <div class="hud-lamps">
          <span class="hud-lamp-icon">&#128161;</span>
          <span class="hud-lamp-count" id="hud-lamp-count">0 / ${TOTAL_LAMP_POSTS}</span>
        </div>
      </div>

      <div class="hud-right">
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

    this.el.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 50;
      display: none; justify-content: space-between; align-items: flex-start;
      padding: 12px 16px;
      background: linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 100%);
      font-family: 'Segoe UI', Tahoma, sans-serif;
    `;

    const style = document.createElement('style');
    style.textContent = `
      /* ── Left side: charge bar + lamp count ── */
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

      /* ── Right side: speedometer ── */
      .hud-right { display: flex; align-items: flex-start; }
      .hud-speedo {
        display: flex; align-items: stretch; gap: 8px;
      }

      /* Vertical gauge bar */
      .speedo-gauge {
        position: relative;
        width: 18px; height: 80px;
        background: rgba(0,0,0,0.5);
        border: 1.5px solid rgba(255,255,255,0.3);
        border-radius: 4px;
        overflow: hidden;
        display: flex; flex-direction: column; justify-content: flex-end;
      }
      .speedo-gauge-fill {
        width: 100%; height: 0%;
        border-radius: 0 0 3px 3px;
        background: linear-gradient(0deg, #ff3300 0%, #ffaa00 40%, #44ff44 100%);
        transition: height 0.15s ease-out;
      }
      .speedo-gauge-marks {
        position: absolute; top: 0; bottom: 0; left: 0; right: 0;
        display: flex; flex-direction: column; justify-content: space-between;
        padding: 2px 0;
        pointer-events: none;
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
        font-size: 0.55rem; color: rgba(255,255,255,0.5);
        font-weight: 600; line-height: 1;
      }

      /* Digital readout */
      .speedo-digital {
        display: flex; flex-direction: column; align-items: center;
        justify-content: center;
        background: rgba(0,0,0,0.6);
        border: 1.5px solid rgba(255,255,255,0.25);
        border-radius: 6px;
        padding: 6px 10px;
        min-width: 56px;
      }
      .speedo-value {
        font-family: 'Courier New', monospace;
        font-size: 1.6rem;
        font-weight: 900;
        color: #44ff44;
        text-shadow: 0 0 8px rgba(68,255,68,0.5);
        line-height: 1;
        letter-spacing: -1px;
      }
      .speedo-unit {
        font-family: 'Segoe UI', sans-serif;
        font-size: 0.6rem;
        font-weight: 700;
        color: rgba(255,255,255,0.6);
        letter-spacing: 2px;
        margin-top: 2px;
      }

      /* ── home button ── */
      .hud-home-btn {
        position: fixed; top: 14px; left: 14px; z-index: 55;
        background: rgba(0,0,0,0.45);
        border: 1.5px solid rgba(255,255,255,0.25);
        border-radius: 8px;
        color: rgba(255,255,255,0.8);
        font-family: 'Segoe UI', Tahoma, sans-serif;
        font-size: 0.72rem; font-weight: 600;
        letter-spacing: 1px;
        padding: 6px 12px;
        cursor: pointer;
        backdrop-filter: blur(4px);
        transition: background 0.15s, border-color 0.15s;
      }
      .hud-home-btn:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.5); }
      .hud-home-btn:active { transform: scale(0.95); }

      /* ── responsive ── */
      @media (max-width: 500px) {
        .hud-bar { width: 100px; height: 12px; }
        .speedo-gauge { height: 60px; width: 14px; }
        .speedo-digital { padding: 4px 8px; min-width: 46px; }
        .speedo-value { font-size: 1.2rem; }
        .hud-lamps { font-size: 0.8rem; }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.el);

    this.el.querySelector('#hud-home').addEventListener('click', () => onHome());

    this.barFill = this.el.querySelector('#hud-bar-fill');
    this.chargeText = this.el.querySelector('#hud-charge-text');
    this.lampCount = this.el.querySelector('#hud-lamp-count');
    this.speedoValue = this.el.querySelector('#speedo-value');
    this.speedoFill = this.el.querySelector('#speedo-fill');
  }

  updateCharge(charge) {
    const pct = (charge / PLATES_TO_FILL_BAR) * 100;
    this.barFill.style.width = pct + '%';
    this.chargeText.textContent = `${charge}/${PLATES_TO_FILL_BAR}`;
  }

  updateLamps(lit) {
    this.lampCount.textContent = `${lit} / ${TOTAL_LAMP_POSTS}`;
  }

  updateSpeed(mph) {
    const display = Math.round(mph);
    this.speedoValue.textContent = display;
    // Gauge fill: 0% at 20mph, 100% at 70mph
    const pct = Math.max(0, Math.min(100, ((mph - 20) / 50) * 100));
    this.speedoFill.style.height = pct + '%';

    // Color shift: green at low, yellow mid, red high
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

  reset() {
    this.updateCharge(0);
    this.updateLamps(0);
    this.updateSpeed(20);
  }

  show() { this.el.style.display = 'flex'; }
  hide() { this.el.style.display = 'none'; }
}
