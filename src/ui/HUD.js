import { PLATES_TO_FILL_BAR, TOTAL_LAMP_POSTS } from '../utils/constants.js';

export class HUD {
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.innerHTML = `
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
      </div>
      <div class="hud-right">
        <div class="hud-lamps">
          <span class="hud-lamp-icon">&#128161;</span>
          <span class="hud-lamp-count" id="hud-lamp-count">0 / ${TOTAL_LAMP_POSTS} Powered</span>
        </div>
      </div>
    `;

    this.el.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 50;
      display: none; justify-content: space-between; align-items: center;
      padding: 14px 20px;
      background: linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 100%);
      font-family: 'Segoe UI', Tahoma, sans-serif;
    `;

    const style = document.createElement('style');
    style.textContent = `
      .hud-left, .hud-right { display: flex; align-items: center; }
      .hud-bar-container { display: flex; align-items: center; gap: 8px; }
      .hud-energy-icon { font-size: 1.5rem; }
      .hud-bar {
        position: relative;
        width: 180px; height: 18px;
        background: rgba(255,255,255,0.12);
        border: 1px solid rgba(255,255,255,0.25);
        border-radius: 9px; overflow: hidden;
      }
      .hud-bar-fill {
        position: absolute; top: 0; left: 0; bottom: 0;
        width: 0%; border-radius: 9px;
        background: linear-gradient(90deg, #39ff14, #7fff00);
        box-shadow: 0 0 10px rgba(57,255,20,0.5);
        transition: width 0.3s ease-out;
      }
      .hud-tick {
        position: absolute; top: 0; bottom: 0; width: 1px;
        background: rgba(0,0,0,0.3);
      }
      .hud-charge-text {
        color: rgba(255,255,255,0.7); font-size: 0.85rem; font-weight: 600;
        min-width: 36px;
      }
      .hud-lamps {
        display: flex; align-items: center; gap: 8px;
        color: #fff; font-size: 1.05rem; font-weight: 600;
        text-shadow: 0 1px 4px rgba(0,0,0,0.5);
      }
      .hud-lamp-icon { font-size: 1.3rem; }

      @media (max-width: 500px) {
        .hud-bar { width: 120px; height: 14px; }
        .hud-energy-icon { font-size: 1.2rem; }
        .hud-lamps { font-size: 0.9rem; }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.el);

    this.barFill = this.el.querySelector('#hud-bar-fill');
    this.chargeText = this.el.querySelector('#hud-charge-text');
    this.lampCount = this.el.querySelector('#hud-lamp-count');
  }

  updateCharge(charge) {
    const pct = (charge / PLATES_TO_FILL_BAR) * 100;
    this.barFill.style.width = pct + '%';
    this.chargeText.textContent = `${charge}/${PLATES_TO_FILL_BAR}`;
  }

  updateLamps(lit) {
    this.lampCount.textContent = `${lit} / ${TOTAL_LAMP_POSTS} Powered`;
  }

  reset() {
    this.updateCharge(0);
    this.updateLamps(0);
  }

  show() { this.el.style.display = 'flex'; }
  hide() { this.el.style.display = 'none'; }
}
