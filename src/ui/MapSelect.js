import { MAP_THEMES } from '../utils/constants.js';
import { gameRoot } from '../utils/base.js';

export class MapSelect {
  constructor(onSelect, onBack) {
    this.el = document.createElement('div');
    this.el.id = 'map-select';

    const accents = { brazil: '#ffaa33', usa: '#6677ff', peru: '#44bb55' };

    const cards = MAP_THEMES.map((m, i) => `
      <div class="ms-card" data-index="${i}" style="--accent:${accents[m.id]}">
        <div class="ms-preview">
          <div class="ms-scene ms-scene-${m.id}"></div>
        </div>
        <div class="ms-flag-row">
          <img class="ms-flag" src="${m.flag}" alt="${m.name} flag" draggable="false" />
          <span class="ms-country">${m.name}</span>
        </div>
        <div class="ms-subtitle">${m.subtitle}</div>
      </div>
    `).join('');

    this.el.innerHTML = `
      <div class="ms-backdrop"></div>
      <div class="ms-content">
        <button class="nav-back" id="ms-back" aria-label="Back">&#9664; BACK</button>
        <h2 class="ms-title">SELECT A MAP</h2>
        <div class="ms-cards">${cards}</div>
      </div>
    `;

    gameRoot().appendChild(this.el);

    const style = document.createElement('style');
    style.textContent = `
      #map-select {
        position: fixed; inset: 0; z-index: 100;
        display: none; align-items: center; justify-content: center;
        font-family: 'Segoe UI', Tahoma, sans-serif;
      }

      .ms-backdrop {
        position: absolute; inset: 0;
        background: linear-gradient(180deg, #2a6a90 0%, #5a8a50 35%, #3a5a30 60%, #1e2e18 100%);
      }
      .ms-backdrop::before {
        content: ''; position: absolute; inset: 0;
        background:
          radial-gradient(ellipse at 30% 20%, rgba(71,176,232,0.12) 0%, transparent 50%),
          radial-gradient(ellipse at 70% 30%, rgba(200,168,72,0.10) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 80%, rgba(42,48,32,0.3) 0%, transparent 50%);
      }

      .ms-content {
        position: relative; z-index: 1;
        text-align: center; padding: 20px;
        width: 100%; max-width: 800px;
      }

      .ms-title {
        font-family: Impact, 'Arial Black', sans-serif;
        font-size: clamp(1.6rem, 5vw, 2.5rem);
        color: #fff; letter-spacing: 4px;
        margin-bottom: clamp(24px, 5vh, 48px);
        text-shadow: 0 0 30px rgba(57,255,20,0.3), 0 2px 4px rgba(0,0,0,0.5);
      }

      .ms-cards {
        display: flex; justify-content: center;
        gap: clamp(14px, 3vw, 28px);
        align-items: flex-start;
      }

      /* ── Card ── */
      .ms-card {
        display: flex; flex-direction: column; align-items: center;
        cursor: pointer;
        padding: 14px 12px 18px;
        border-radius: 18px;
        background: rgba(255,255,255,0.04);
        border: 2px solid rgba(255,255,255,0.1);
        transition: transform 0.3s ease, border-color 0.3s, background 0.3s, box-shadow 0.3s, opacity 0.3s, filter 0.3s;
        width: clamp(160px, 28vw, 230px);
        user-select: none;
      }
      .ms-card.dimmed {
        opacity: 0.3;
        filter: grayscale(0.5) brightness(0.7);
        transform: scale(0.93);
      }
      .ms-card.active {
        background: rgba(255,255,255,0.08);
        border-color: var(--accent, #39ff14);
        transform: translateY(-10px) scale(1.05);
        box-shadow:
          0 0 28px color-mix(in srgb, var(--accent, #39ff14) 35%, transparent),
          0 10px 35px rgba(0,0,0,0.4);
      }

      /* ── Preview (mini-scene) ── */
      .ms-preview {
        width: 100%;
        aspect-ratio: 16 / 10;
        border-radius: 12px;
        overflow: hidden;
        position: relative;
        margin-bottom: 12px;
        transition: box-shadow 0.3s;
      }
      .ms-card.active .ms-preview {
        box-shadow: inset 0 0 20px rgba(0,0,0,0.3);
      }

      /* ── Flag + name ── */
      .ms-flag-row {
        display: flex; align-items: center; gap: 8px;
        margin-bottom: 4px;
      }
      .ms-flag {
        width: 30px; height: auto;
        border-radius: 3px;
        border: 1px solid rgba(255,255,255,0.2);
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      }
      .ms-country {
        font-family: Impact, 'Arial Black', sans-serif;
        font-size: clamp(1rem, 2.2vw, 1.2rem);
        color: #fff; letter-spacing: 2px;
        transition: color 0.3s;
      }
      .ms-card.active .ms-country {
        color: var(--accent, #fff);
      }

      /* ── Subtitle ── */
      .ms-subtitle {
        font-size: clamp(0.7rem, 1.4vw, 0.82rem);
        color: rgba(255,255,255,0.4);
        font-style: italic;
        transition: color 0.3s;
      }
      .ms-card.active .ms-subtitle {
        color: rgba(255,255,255,0.7);
      }

      /* ══════════════════════════════════════
         MINI-SCENE CSS ART
         ══════════════════════════════════════ */
      .ms-scene { position: absolute; inset: 0; overflow: hidden; }

      /* Brazil */
      .ms-scene-brazil {
        background: linear-gradient(180deg, #1e90ff 0%, #ff9933 55%, #ffe4b5 80%, #f4d99a 100%);
      }
      .ms-scene-brazil::before {
        content: ''; position: absolute;
        width: 28px; height: 28px; background: #ffcc33;
        border-radius: 50%; top: 12%; right: 14%;
        box-shadow: 0 0 18px 6px rgba(255,204,50,0.5);
      }
      .ms-scene-brazil::after {
        content: ''; position: absolute;
        bottom: 0; left: 0; right: 0; height: 22%;
        background: linear-gradient(180deg, rgba(30,144,255,0.3) 0%, rgba(30,144,255,0.6) 100%);
        border-radius: 60% 60% 0 0 / 100% 100% 0 0;
      }

      /* USA */
      .ms-scene-usa {
        background: linear-gradient(180deg, #0a0a2e 0%, #1a1a4e 50%, #2a1a3e 85%, #1a1a1a 100%);
      }
      .ms-scene-usa::before {
        content: ''; position: absolute;
        width: 14px; height: 14px; background: #eeeeff;
        border-radius: 50%; top: 10%; right: 18%;
        box-shadow: 0 0 12px 4px rgba(200,200,255,0.3);
      }

      /* Peru */
      .ms-scene-peru {
        background: linear-gradient(180deg, #4488cc 0%, #88ccee 35%, #aaddaa 65%, #5a8a3a 100%);
      }

      @media (hover: hover) {
        .ms-card:hover:not(.active):not(.dimmed) {
          border-color: rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.06);
          transform: translateY(-3px);
        }
      }

      @media (max-width: 500px) {
        .ms-cards { gap: 6px; }
        .ms-card { padding: 10px 6px 14px; border-radius: 12px; }
        .ms-flag { width: 22px; }
      }
    `;
    document.head.appendChild(style);

    // Build mini-scene DOM elements
    const brazilScene = this.el.querySelector('.ms-scene-brazil');
    if (brazilScene) {
      brazilScene.innerHTML = `
        <div style="position:absolute;bottom:22%;left:10%;width:3px;height:38%;background:#8B6914"></div>
        <div style="position:absolute;bottom:22%;left:10%;top:auto;width:22px;height:10px;background:#228B22;border-radius:50% 50% 0 0;transform:translate(-9px,-38px)"></div>
        <div style="position:absolute;bottom:22%;right:8%;width:3px;height:30%;background:#8B6914"></div>
        <div style="position:absolute;bottom:20%;left:22%;width:14%;height:28%;background:#ffccaa;border-radius:2px 2px 0 0"></div>
        <div style="position:absolute;bottom:20%;left:40%;width:11%;height:20%;background:#ffddbb;border-radius:2px 2px 0 0"></div>
        <div style="position:absolute;bottom:20%;right:22%;width:14%;height:24%;background:#ff9966;border-radius:2px 2px 0 0"></div>
      `;
    }
    const usaScene = this.el.querySelector('.ms-scene-usa');
    if (usaScene) {
      const towerStyle = 'position:absolute;bottom:0;border-radius:2px 2px 0 0;background:repeating-linear-gradient(0deg,transparent,transparent 5px,rgba(255,204,100,0.25) 5px,rgba(255,204,100,0.25) 7px)';
      usaScene.innerHTML = `
        <div style="${towerStyle};left:6%;width:14%;height:72%;background-color:#1a1a3e"></div>
        <div style="${towerStyle};left:22%;width:18%;height:85%;background-color:#222244"></div>
        <div style="${towerStyle};left:42%;width:12%;height:62%;background-color:#1a1a3e"></div>
        <div style="${towerStyle};right:15%;width:20%;height:78%;background-color:#252548"></div>
        <div style="${towerStyle};right:4%;width:10%;height:50%;background-color:#2a2a55"></div>
        <div style="position:absolute;bottom:32%;left:8%;width:18%;height:3px;background:#ff00ff;border-radius:1px;box-shadow:0 0 6px #ff00ff"></div>
        <div style="position:absolute;bottom:45%;right:10%;width:14%;height:3px;background:#00ffff;border-radius:1px;box-shadow:0 0 6px #00ffff"></div>
        <div style="position:absolute;bottom:0;left:0;right:0;height:14%;background:#222"></div>
      `;
    }
    const peruScene = this.el.querySelector('.ms-scene-peru');
    if (peruScene) {
      peruScene.innerHTML = `
        <div style="position:absolute;top:14%;left:12%;width:22%;height:8px;background:rgba(255,255,255,0.7);border-radius:10px"></div>
        <div style="position:absolute;top:22%;right:10%;width:16%;height:8px;background:rgba(255,255,255,0.7);border-radius:10px"></div>
        <div style="position:absolute;bottom:25%;left:3%;border-left:28px solid transparent;border-right:28px solid transparent;border-bottom:55px solid #556B2F"></div>
        <div style="position:absolute;bottom:25%;left:25%;border-left:35px solid transparent;border-right:35px solid transparent;border-bottom:72px solid #4a7a3a"></div>
        <div style="position:absolute;bottom:25%;right:10%;border-left:30px solid transparent;border-right:30px solid transparent;border-bottom:50px solid #6B8E23"></div>
        <div style="position:absolute;bottom:0;left:0;right:0;height:28%;background:#5a8a3a;border-radius:50% 50% 0 0/80% 80% 0 0"></div>
        <div style="position:absolute;bottom:0;left:0;right:0;height:16%;background:#4a7a2a"></div>
      `;
    }

    // --- Events ---
    this.el.querySelector('#ms-back').addEventListener('click', () => onBack());

    const cardEls = this.el.querySelectorAll('.ms-card');
    cardEls.forEach((card) => {
      const idx = parseInt(card.dataset.index);
      card.addEventListener('click', () => {
        // Highlight + select in one click
        cardEls.forEach((c, i) => {
          c.classList.remove('active', 'dimmed');
          if (i !== idx) c.classList.add('dimmed');
        });
        card.classList.add('active');

        setTimeout(() => onSelect(idx), 350);
      });
    });
  }

  show() {
    this.el.querySelectorAll('.ms-card').forEach(c => c.classList.remove('active', 'dimmed'));
    this.el.style.display = 'flex';
  }

  hide() { this.el.style.display = 'none'; }
}
