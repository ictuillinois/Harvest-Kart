import { KART_VARIANTS } from '../utils/constants.js';

export class CharacterSelect {
  constructor(onSelect) {
    this.el = document.createElement('div');
    this.el.id = 'character-select';

    const cards = KART_VARIANTS.map((v, i) => `
      <div class="kart-card" data-index="${i}">
        <div class="kart-preview" style="background: linear-gradient(135deg, #${v.body.toString(16).padStart(6,'0')}, #${v.accent.toString(16).padStart(6,'0')});">
          <div class="kart-icon">
            <div class="kart-body-icon" style="background: #${v.body.toString(16).padStart(6,'0')};"></div>
            <div class="kart-cockpit-icon" style="background: #${v.accent.toString(16).padStart(6,'0')};"></div>
            <div class="kart-wheels-icon">
              <span></span><span></span>
            </div>
          </div>
        </div>
        <p class="kart-name">${v.name}</p>
      </div>
    `).join('');

    this.el.innerHTML = `
      <div class="select-content">
        <h2 class="select-title">CHOOSE YOUR KART</h2>
        <div class="kart-cards">${cards}</div>
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
      .select-content { text-align: center; padding: 30px; }
      .select-title {
        font-size: 2.2rem; color: #fff; margin-bottom: 30px;
        text-shadow: 0 0 20px rgba(57,255,20,0.4);
        letter-spacing: 3px;
      }
      .kart-cards { display: flex; gap: 24px; justify-content: center; flex-wrap: wrap; }
      .kart-card {
        cursor: pointer; padding: 16px; border-radius: 16px;
        background: rgba(255,255,255,0.08); border: 2px solid rgba(255,255,255,0.15);
        transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
        width: 160px;
      }
      .kart-card:hover {
        transform: translateY(-6px) scale(1.03);
        border-color: #39ff14;
        box-shadow: 0 0 25px rgba(57,255,20,0.3);
      }
      .kart-preview {
        width: 120px; height: 100px; border-radius: 12px;
        margin: 0 auto 12px; display: flex; align-items: center; justify-content: center;
      }
      .kart-icon { position: relative; width: 70px; height: 45px; }
      .kart-body-icon {
        width: 70px; height: 25px; border-radius: 6px;
        position: absolute; bottom: 10px;
      }
      .kart-cockpit-icon {
        width: 40px; height: 18px; border-radius: 4px 4px 0 0;
        position: absolute; top: 0; left: 15px;
      }
      .kart-wheels-icon {
        position: absolute; bottom: 2px; width: 100%;
        display: flex; justify-content: space-between; padding: 0 5px;
      }
      .kart-wheels-icon span {
        width: 14px; height: 14px; background: #333;
        border-radius: 50%; border: 2px solid #555;
      }
      .kart-name {
        color: #fff; font-size: 1rem; font-weight: 600;
        margin-top: 4px;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.el);

    this.el.querySelectorAll('.kart-card').forEach(card => {
      card.addEventListener('click', () => {
        const index = parseInt(card.dataset.index);
        onSelect(index);
      });
    });
  }

  show() { this.el.style.display = 'flex'; }
  hide() { this.el.style.display = 'none'; }
}
