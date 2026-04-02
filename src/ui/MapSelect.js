import { MAP_THEMES } from '../utils/constants.js';

export class MapSelect {
  constructor(onSelect, onBack) {
    this.el = document.createElement('div');
    this.el.id = 'map-select';

    const iconMap = {
      brazil: { emoji: '&#127463;&#127479;', bg: 'linear-gradient(135deg, #1e90ff 0%, #ff9933 50%, #ffe4b5 100%)' },
      usa: { emoji: '&#127482;&#127480;', bg: 'linear-gradient(135deg, #0a0a2e 0%, #1a1a4e 50%, #2a1a3e 100%)' },
      peru: { emoji: '&#127477;&#127466;', bg: 'linear-gradient(135deg, #4488cc 0%, #88ccee 50%, #aaddaa 100%)' },
    };

    const sceneMap = {
      brazil: `
        <div class="map-scene brazil-scene">
          <div class="scene-sun"></div>
          <div class="scene-palm"></div>
          <div class="scene-palm palm2"></div>
          <div class="scene-wave"></div>
          <div class="scene-wave wave2"></div>
          <div class="scene-building b1"></div>
          <div class="scene-building b2"></div>
        </div>`,
      usa: `
        <div class="map-scene usa-scene">
          <div class="scene-skyscraper s1"></div>
          <div class="scene-skyscraper s2"></div>
          <div class="scene-skyscraper s3"></div>
          <div class="scene-skyscraper s4"></div>
          <div class="scene-window-grid"></div>
          <div class="scene-moon"></div>
        </div>`,
      peru: `
        <div class="map-scene peru-scene">
          <div class="scene-mountain m1"></div>
          <div class="scene-mountain m2"></div>
          <div class="scene-mountain m3"></div>
          <div class="scene-hill"></div>
          <div class="scene-hill h2"></div>
          <div class="scene-cloud"></div>
          <div class="scene-cloud c2"></div>
        </div>`,
    };

    const cards = MAP_THEMES.map((m, i) => `
      <div class="map-card" data-index="${i}">
        <div class="map-preview" style="background: ${iconMap[m.id].bg};">
          ${sceneMap[m.id]}
        </div>
        <div class="map-flag">${iconMap[m.id].emoji}</div>
        <p class="map-name">${m.name}</p>
        <p class="map-desc">${m.description}</p>
      </div>
    `).join('');

    this.el.innerHTML = `
      <div class="mselect-content">
        <button class="nav-back" id="ms-back" aria-label="Back">&#9664; BACK</button>
        <h2 class="mselect-title">SELECT A MAP</h2>
        <div class="map-cards">${cards}</div>
      </div>
    `;

    this.el.style.cssText = `
      position: fixed; inset: 0; z-index: 100;
      display: none; align-items: center; justify-content: center;
      background: rgba(26,5,51,0.95);
      font-family: 'Segoe UI', Tahoma, sans-serif;
    `;

    const style = document.createElement('style');
    style.textContent = `
      .mselect-content { text-align: center; padding: 24px; max-width: 720px; }
      .mselect-title {
        font-size: 2.2rem; color: #fff; margin-bottom: 28px;
        text-shadow: 0 0 20px rgba(57,255,20,0.4); letter-spacing: 3px;
      }
      .map-cards { display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; }
      .map-card {
        cursor: pointer; padding: 14px; border-radius: 16px;
        background: rgba(255,255,255,0.06); border: 2px solid rgba(255,255,255,0.12);
        transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
        width: 190px; position: relative;
      }
      .map-card:hover {
        transform: translateY(-6px) scale(1.04);
        border-color: #39ff14;
        box-shadow: 0 0 25px rgba(57,255,20,0.3);
      }
      .map-preview {
        width: 160px; height: 110px; border-radius: 12px;
        margin: 0 auto 10px; overflow: hidden; position: relative;
      }
      .map-flag { font-size: 1.6rem; margin-bottom: 4px; }
      .map-name { color: #fff; font-size: 1.1rem; font-weight: 700; margin: 2px 0; }
      .map-desc { color: rgba(255,255,255,0.55); font-size: 0.8rem; }

      /* Mini-scenes */
      .map-scene { position: absolute; inset: 0; overflow: hidden; }

      /* Brazil */
      .scene-sun {
        width: 30px; height: 30px; background: #ffcc33;
        border-radius: 50%; position: absolute; top: 10px; right: 15px;
        box-shadow: 0 0 15px #ffaa00;
      }
      .scene-palm {
        position: absolute; bottom: 20px; left: 15px;
        width: 4px; height: 35px; background: #8B6914;
      }
      .scene-palm::after {
        content: ''; position: absolute; top: -8px; left: -10px;
        width: 24px; height: 12px; background: #228B22;
        border-radius: 50% 50% 0 0;
      }
      .scene-palm.palm2 { left: 130px; height: 28px; }
      .scene-wave {
        position: absolute; bottom: 0; left: 0; right: 0;
        height: 18px; background: rgba(30,144,255,0.5);
        border-radius: 50% 50% 0 0;
      }
      .scene-wave.wave2 { height: 12px; bottom: 0; background: rgba(30,144,255,0.7); }
      .brazil-scene .scene-building {
        position: absolute; bottom: 14px; background: #ddd;
      }
      .brazil-scene .b1 { left: 45px; width: 20px; height: 30px; background: #ffccaa; }
      .brazil-scene .b2 { left: 72px; width: 18px; height: 22px; background: #ffddbb; }

      /* USA */
      .scene-skyscraper {
        position: absolute; bottom: 0; background: #2a2a4e;
      }
      .s1 { left: 10px; width: 22px; height: 80px; background: #1a1a3e; }
      .s2 { left: 38px; width: 28px; height: 95px; background: #222244; }
      .s3 { left: 72px; width: 20px; height: 70px; background: #1a1a3e; }
      .s4 { left: 98px; width: 32px; height: 88px; background: #252548; }
      .scene-skyscraper::after {
        content: ''; position: absolute; inset: 4px;
        background: repeating-linear-gradient(
          0deg, transparent, transparent 6px, rgba(255,204,100,0.3) 6px, rgba(255,204,100,0.3) 8px
        );
      }
      .scene-moon {
        width: 16px; height: 16px; background: #eee;
        border-radius: 50%; position: absolute; top: 8px; right: 20px;
        box-shadow: 0 0 10px rgba(255,255,255,0.4);
      }

      /* Peru */
      .scene-mountain {
        position: absolute; bottom: 0; width: 0; height: 0;
        border-left: 40px solid transparent; border-right: 40px solid transparent;
      }
      .m1 { left: 5px; border-bottom: 70px solid #556B2F; }
      .m2 { left: 50px; border-bottom: 90px solid #4a7a3a; }
      .m3 { left: 95px; border-bottom: 65px solid #6B8E23; }
      .scene-mountain.m2::after {
        content: ''; position: absolute; top: -10px; left: -15px;
        width: 0; height: 0;
        border-left: 15px solid transparent; border-right: 15px solid transparent;
        border-bottom: 14px solid #fff;
      }
      .scene-hill {
        position: absolute; bottom: 0; left: 0; right: 0;
        height: 20px; background: #5a8a3a; border-radius: 50% 50% 0 0;
      }
      .scene-hill.h2 { height: 12px; background: #4a7a2a; }
      .scene-cloud {
        position: absolute; top: 12px; left: 20px;
        width: 30px; height: 10px; background: rgba(255,255,255,0.7);
        border-radius: 10px;
      }
      .scene-cloud.c2 { top: 20px; left: 80px; width: 24px; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.el);

    this.el.querySelector('#ms-back').addEventListener('click', () => onBack());
    this.el.querySelectorAll('.map-card').forEach(card => {
      card.addEventListener('click', () => onSelect(parseInt(card.dataset.index)));
    });
  }

  show() { this.el.style.display = 'flex'; }
  hide() { this.el.style.display = 'none'; }
}
