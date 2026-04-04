import { DRIVER_TYPES } from '../utils/constants.js';
import { gameRoot } from '../utils/base.js';

export class DriverSelect {
  constructor(onSelect, onBack) {
    this.el = document.createElement('div');
    this.el.id = 'driver-select';

    const kartColor = (hex) => '#' + hex.toString(16).padStart(6, '0');

    const cards = DRIVER_TYPES.map((d, i) => `
      <div class="ds-card" data-index="${i}" style="--ring-color:${kartColor(d.kartBody)}">
        <div class="ds-ring">
          <img class="ds-avatar" src="${d.avatar}" alt="${d.name}" draggable="false" />
        </div>
        <div class="ds-name">${d.name}</div>
        <div class="ds-subtitle">${d.description}</div>
      </div>
    `).join('');

    this.el.innerHTML = `
      <div class="ds-backdrop"></div>
      <div class="ds-content">
        <button class="nav-back" id="ds-back" aria-label="Back">&#9664; BACK</button>
        <h2 class="ds-title">CHOOSE YOUR DRIVER</h2>
        <div class="ds-cards">${cards}</div>
      </div>
    `;

    gameRoot().appendChild(this.el);

    const style = document.createElement('style');
    style.textContent = `
      #driver-select {
        position: fixed; inset: 0; z-index: 100;
        display: none; align-items: center; justify-content: center;
        font-family: 'Segoe UI', Tahoma, sans-serif;
      }

      .ds-backdrop {
        position: absolute; inset: 0;
        background: linear-gradient(180deg, #2a6a90 0%, #5a8a50 35%, #3a5a30 60%, #1e2e18 100%);
      }
      .ds-backdrop::before {
        content: ''; position: absolute; inset: 0;
        background:
          radial-gradient(ellipse at 30% 20%, rgba(71,176,232,0.12) 0%, transparent 50%),
          radial-gradient(ellipse at 70% 30%, rgba(200,168,72,0.10) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 80%, rgba(42,48,32,0.3) 0%, transparent 50%);
        animation: dsGlow 6s ease-in-out infinite alternate;
      }
      @keyframes dsGlow { 0% { opacity: 0.7; } 100% { opacity: 1; } }

      .ds-content {
        position: relative; z-index: 1;
        text-align: center; padding: 20px;
        width: 100%; max-width: 780px;
      }

      .ds-title {
        font-family: Impact, 'Arial Black', sans-serif;
        font-size: clamp(1.6rem, 5vw, 2.5rem);
        color: #fff; letter-spacing: 4px;
        margin-bottom: clamp(24px, 5vh, 48px);
        text-shadow: 0 0 30px rgba(57,255,20,0.3), 0 2px 4px rgba(0,0,0,0.5);
      }

      .ds-cards {
        display: flex; justify-content: center;
        gap: clamp(16px, 3.5vw, 32px);
        align-items: flex-start;
      }

      /* ── Card ── */
      .ds-card {
        display: flex; flex-direction: column; align-items: center;
        cursor: pointer;
        padding: 20px 16px 18px;
        border-radius: 20px;
        background: rgba(255,255,255,0.04);
        border: 2px solid rgba(255,255,255,0.08);
        transition: transform 0.3s ease, border-color 0.3s, background 0.3s, box-shadow 0.3s, opacity 0.3s, filter 0.3s;
        width: clamp(150px, 26vw, 210px);
        user-select: none;
      }
      .ds-card.dimmed {
        opacity: 0.35;
        filter: grayscale(0.5) brightness(0.7);
        transform: scale(0.93);
      }
      .ds-card.active {
        background: rgba(255,255,255,0.08);
        border-color: var(--ring-color, #39ff14);
        transform: translateY(-10px) scale(1.06);
        box-shadow:
          0 0 30px color-mix(in srgb, var(--ring-color, #39ff14) 40%, transparent),
          0 10px 35px rgba(0,0,0,0.4);
      }

      /* ── Avatar ring ── */
      .ds-ring {
        width: clamp(110px, 20vw, 150px);
        height: clamp(110px, 20vw, 150px);
        border-radius: 50%;
        border: 3px solid rgba(255,255,255,0.15);
        background: rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
        overflow: hidden;
        transition: border-color 0.3s, box-shadow 0.3s, transform 0.3s;
        margin-bottom: 12px;
      }
      .ds-card.active .ds-ring {
        border-color: var(--ring-color);
        box-shadow: 0 0 22px color-mix(in srgb, var(--ring-color) 50%, transparent);
        transform: scale(1.05);
      }

      .ds-avatar {
        width: 90%; height: 90%;
        object-fit: contain;
        filter: drop-shadow(0 2px 6px rgba(0,0,0,0.3));
        transition: filter 0.3s, transform 0.3s;
      }
      .ds-card.active .ds-avatar {
        transform: scale(1.06);
        filter: drop-shadow(0 4px 12px rgba(0,0,0,0.4));
      }
      .ds-card.dimmed .ds-avatar {
        filter: grayscale(0.4) drop-shadow(0 2px 4px rgba(0,0,0,0.2));
      }

      /* ── Name + subtitle (always visible) ── */
      .ds-name {
        font-family: Impact, 'Arial Black', sans-serif;
        font-size: clamp(1rem, 2.5vw, 1.3rem);
        color: #fff;
        letter-spacing: 1px;
        margin-bottom: 2px;
        transition: color 0.3s;
      }
      .ds-card.active .ds-name {
        color: var(--ring-color, #fff);
      }
      .ds-subtitle {
        font-size: clamp(0.72rem, 1.5vw, 0.85rem);
        color: rgba(255,255,255,0.45);
        font-style: italic;
        transition: color 0.3s;
      }
      .ds-card.active .ds-subtitle {
        color: rgba(255,255,255,0.7);
      }

      @media (hover: hover) {
        .ds-card:hover:not(.active):not(.dimmed) {
          border-color: rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.05);
          transform: translateY(-3px);
        }
      }

      @media (max-width: 500px) {
        .ds-cards { gap: 8px; }
        .ds-card { padding: 14px 8px 14px; border-radius: 14px; }
        .ds-ring { border-width: 2px; }
      }
    `;
    document.head.appendChild(style);

    this.el.querySelector('#ds-back').addEventListener('click', () => onBack());

    const cardEls = this.el.querySelectorAll('.ds-card');

    cardEls.forEach((card) => {
      const idx = parseInt(card.dataset.index);
      card.addEventListener('click', () => {
        // Highlight + select in one click
        cardEls.forEach((c, i) => {
          c.classList.remove('active', 'dimmed');
          if (i !== idx) c.classList.add('dimmed');
        });
        card.classList.add('active');

        // Brief highlight then select
        setTimeout(() => onSelect(idx), 350);
      });
    });
  }

  show() {
    this.el.querySelectorAll('.ds-card').forEach(c => c.classList.remove('active', 'dimmed'));
    this.el.style.display = 'flex';
  }

  hide() { this.el.style.display = 'none'; }
}
