import { PLATES_TO_FILL_BAR, TOTAL_LAMP_POSTS } from '../utils/constants.js';

export class HUD {
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'hud';
    this.el.innerHTML = `
      <div class="hud-bar-container">
        <span class="hud-energy-icon">&#9889;</span>
        <div class="hud-bar">
          ${Array.from({ length: PLATES_TO_FILL_BAR }, (_, i) =>
            `<div class="hud-segment" data-index="${i}"></div>`
          ).join('')}
        </div>
      </div>
      <div class="hud-lamps">
        <span class="hud-lamp-icon">&#128161;</span>
        <span class="hud-lamp-count" id="hud-lamp-count">0 / ${TOTAL_LAMP_POSTS} Powered</span>
      </div>
    `;

    this.el.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; z-index: 50;
      display: none; justify-content: space-between; align-items: center;
      padding: 16px 24px;
      background: linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%);
      font-family: 'Segoe UI', Tahoma, sans-serif;
    `;

    const style = document.createElement('style');
    style.textContent = `
      .hud-bar-container {
        display: flex; align-items: center; gap: 10px;
      }
      .hud-energy-icon { font-size: 1.6rem; }
      .hud-bar {
        display: flex; gap: 4px;
      }
      .hud-segment {
        width: 36px; height: 16px; border-radius: 3px;
        background: rgba(255,255,255,0.15);
        border: 1px solid rgba(255,255,255,0.3);
        transition: background 0.3s, box-shadow 0.3s;
      }
      .hud-segment.filled {
        background: linear-gradient(135deg, #39ff14, #7fff00);
        box-shadow: 0 0 8px rgba(57,255,20,0.6);
      }
      .hud-lamps {
        display: flex; align-items: center; gap: 8px;
        color: #fff; font-size: 1.1rem; font-weight: 600;
        text-shadow: 0 1px 4px rgba(0,0,0,0.5);
      }
      .hud-lamp-icon { font-size: 1.4rem; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.el);

    this.segments = this.el.querySelectorAll('.hud-segment');
    this.lampCount = this.el.querySelector('#hud-lamp-count');
  }

  updateCharge(charge) {
    this.segments.forEach((seg, i) => {
      seg.classList.toggle('filled', i < charge);
    });
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
