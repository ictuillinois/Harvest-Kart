import { DRIVER_TYPES } from '../utils/constants.js';

export class DriverSelect {
  constructor(onSelect) {
    this.el = document.createElement('div');
    this.el.id = 'driver-select';

    const cards = DRIVER_TYPES.map((d, i) => {
      const bodyColor = '#' + d.kartBody.toString(16).padStart(6, '0');
      const shirtColor = '#' + d.shirtColor.toString(16).padStart(6, '0');
      const skinColor = '#' + d.skinColor.toString(16).padStart(6, '0');
      const hairColor = '#' + d.hairColor.toString(16).padStart(6, '0');
      const pantsColor = '#' + d.pantsColor.toString(16).padStart(6, '0');

      let characterIcon = '';
      if (d.type === 'professor') {
        characterIcon = `
          <div class="driver-avatar">
            <div class="driver-hair" style="background:${hairColor};width:36px;height:10px;border-radius:6px 6px 0 0;"></div>
            <div class="driver-head" style="background:${skinColor};">
              <div class="driver-glasses">
                <span class="lens"></span><span class="bridge"></span><span class="lens"></span>
              </div>
              <div class="driver-mustache" style="background:${hairColor};"></div>
            </div>
            <div class="driver-body" style="background:${shirtColor};">
              <div class="driver-collar"></div>
            </div>
            <div class="driver-legs" style="background:${pantsColor};"></div>
          </div>`;
      } else if (d.type === 'kid') {
        characterIcon = `
          <div class="driver-avatar kid-avatar">
            <div class="driver-cap" style="background:#ff4444;">
              <div class="cap-brim"></div>
            </div>
            <div class="driver-head" style="background:${skinColor};">
              <div class="driver-freckles">
                <span></span><span></span><span></span>
              </div>
            </div>
            <div class="driver-body" style="background:${shirtColor};"></div>
            <div class="driver-legs" style="background:${pantsColor};"></div>
            <div class="driver-backpack"></div>
          </div>`;
      } else {
        characterIcon = `
          <div class="driver-avatar">
            <div class="driver-hair-long" style="background:${hairColor};"></div>
            <div class="driver-head" style="background:${skinColor};">
              <div class="driver-earrings"><span></span><span></span></div>
              <div class="driver-lips"></div>
            </div>
            <div class="driver-body" style="background:${shirtColor};"></div>
            <div class="driver-legs" style="background:${pantsColor};"></div>
          </div>`;
      }

      return `
        <div class="driver-card" data-index="${i}">
          <div class="driver-preview" style="background: linear-gradient(135deg, ${bodyColor}44, ${shirtColor}66);">
            ${characterIcon}
          </div>
          <p class="driver-name">${d.name}</p>
          <p class="driver-desc">${d.description}</p>
        </div>`;
    }).join('');

    this.el.innerHTML = `
      <div class="dselect-content">
        <h2 class="dselect-title">CHOOSE YOUR DRIVER</h2>
        <div class="driver-cards">${cards}</div>
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
      .dselect-content { text-align: center; padding: 24px; max-width: 700px; }
      .dselect-title {
        font-size: 2.2rem; color: #fff; margin-bottom: 28px;
        text-shadow: 0 0 20px rgba(57,255,20,0.4); letter-spacing: 3px;
      }
      .driver-cards { display: flex; gap: 20px; justify-content: center; flex-wrap: wrap; }
      .driver-card {
        cursor: pointer; padding: 16px; border-radius: 16px;
        background: rgba(255,255,255,0.06); border: 2px solid rgba(255,255,255,0.12);
        transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
        width: 170px;
      }
      .driver-card:hover {
        transform: translateY(-6px) scale(1.04);
        border-color: #39ff14;
        box-shadow: 0 0 25px rgba(57,255,20,0.3);
      }
      .driver-preview {
        width: 130px; height: 140px; border-radius: 12px;
        margin: 0 auto 12px; display: flex; align-items: center; justify-content: center;
        position: relative; overflow: hidden;
      }
      .driver-name { color: #fff; font-size: 1.05rem; font-weight: 700; margin: 4px 0 2px; }
      .driver-desc { color: rgba(255,255,255,0.55); font-size: 0.82rem; }

      /* Driver avatar shared */
      .driver-avatar { display: flex; flex-direction: column; align-items: center; position: relative; }
      .kid-avatar { transform: scale(0.85); }
      .driver-head {
        width: 36px; height: 36px; border-radius: 50%;
        position: relative; z-index: 2;
        display: flex; align-items: center; justify-content: center; flex-direction: column;
      }
      .driver-body {
        width: 40px; height: 30px; border-radius: 4px 4px 0 0;
        margin-top: -4px; z-index: 1;
      }
      .driver-legs {
        width: 36px; height: 16px; border-radius: 0 0 4px 4px;
        display: flex; gap: 4px; justify-content: center;
      }

      /* Professor */
      .driver-glasses { display: flex; align-items: center; gap: 2px; margin-top: 2px; }
      .driver-glasses .lens {
        width: 10px; height: 10px; border: 1.5px solid #444;
        border-radius: 50%; background: rgba(136,204,255,0.3);
      }
      .driver-glasses .bridge { width: 4px; height: 1.5px; background: #444; }
      .driver-mustache { width: 16px; height: 4px; border-radius: 2px; margin-top: 1px; }
      .driver-collar { width: 44px; height: 6px; background: #f0f0f0; border-radius: 3px; margin: -2px auto 0; }

      /* Kid */
      .driver-cap { width: 38px; height: 16px; border-radius: 16px 16px 0 0; position: relative; z-index: 3; }
      .cap-brim { width: 28px; height: 5px; background: inherit; position: absolute; bottom: -2px; left: -4px; border-radius: 2px; filter: brightness(0.85); }
      .driver-freckles { display: flex; gap: 3px; margin-top: 6px; }
      .driver-freckles span { width: 3px; height: 3px; background: #bb8855; border-radius: 50%; }
      .driver-backpack {
        width: 22px; height: 26px; background: #2980b9; border-radius: 4px;
        position: absolute; right: 14px; top: 34px; z-index: 0;
      }

      /* Woman */
      .driver-hair-long {
        width: 42px; height: 20px; border-radius: 20px 20px 4px 4px;
        margin-bottom: -10px; z-index: 3;
      }
      .driver-earrings { display: flex; justify-content: space-between; width: 40px; position: absolute; top: 16px; }
      .driver-earrings span { width: 5px; height: 5px; background: #ffd700; border-radius: 50%; }
      .driver-lips { width: 8px; height: 3px; background: #cc4455; border-radius: 2px; margin-top: 4px; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.el);

    this.el.querySelectorAll('.driver-card').forEach(card => {
      card.addEventListener('click', () => onSelect(parseInt(card.dataset.index)));
    });
  }

  show() { this.el.style.display = 'flex'; }
  hide() { this.el.style.display = 'none'; }
}
