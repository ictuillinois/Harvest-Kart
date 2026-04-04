import { DRIVER_TYPES } from '../utils/constants.js';
import { gameRoot } from '../utils/base.js';
import { fadeIn, fadeOut } from '../utils/transition.js';

function starRow(label, filled, total = 5) {
  const stars = Array.from({ length: total }, (_, i) =>
    `<span class="ds-star ${i < filled ? 'filled' : ''}">${i < filled ? '★' : '☆'}</span>`
  ).join('');
  return `<div class="ds-stat"><span class="ds-stat-label">${label}</span><span class="ds-stat-stars">${stars}</span></div>`;
}

export class DriverSelect {
  constructor(onSelect, onBack) {
    this.el = document.createElement('div');
    this.el.id = 'driver-select';

    const cards = DRIVER_TYPES.map((d, i) => `
      <div class="ds-card" data-index="${i}" style="--accent:${d.accentColor}">
        <div class="ds-img-wrap">
          <img class="ds-img" src="${d.avatar}" alt="${d.name}" draggable="false" />
        </div>
        <div class="ds-info">
          <div class="ds-desc">${d.description}</div>
          <div class="ds-stats">
            ${starRow('SPD', d.stats.topSpeed)}
            ${starRow('ACC', d.stats.acceleration)}
            ${starRow('EFF', d.stats.efficiency)}
          </div>
        </div>
      </div>
    `).join('');

    this.el.innerHTML = `
      <div class="ds-bg"></div>
      <button class="nav-back" id="ds-back" aria-label="Back">&#9664; BACK</button>
      <div class="ds-content">
        <h2 class="ds-title">CHOOSE YOUR DRIVER</h2>
        <div class="ds-cards">${cards}</div>
      </div>
    `;

    gameRoot().appendChild(this.el);

    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&display=swap');

      #driver-select {
        position: fixed; inset: 0; z-index: 100;
        display: none; flex-direction: column;
        align-items: center; justify-content: center;
        font-family: 'Segoe UI', Tahoma, sans-serif;
      }

      .ds-bg {
        position: absolute; inset: 0;
        background:
          linear-gradient(rgba(0,0,0,0.72), rgba(0,0,0,0.78)),
          url('${DRIVER_TYPES[0].avatar}') center / cover no-repeat;
        filter: blur(20px) saturate(0.5);
      }

      #ds-back {
        position: absolute; top: 20px; left: 20px; z-index: 10;
      }

      .ds-content {
        position: relative; z-index: 1;
        text-align: center;
        padding: 12px 16px;
        width: 100%;
        max-width: 1000px;
      }

      .ds-title {
        font-family: 'Orbitron', 'Impact', sans-serif;
        font-size: 26px;
        font-weight: 900;
        color: #fff;
        letter-spacing: 4px;
        margin-bottom: 20px;
        text-shadow: 0 0 20px rgba(255,255,255,0.15), 0 2px 6px rgba(0,0,0,0.8);
      }

      .ds-cards {
        display: flex; justify-content: center;
        gap: 16px;
        align-items: stretch;
      }

      /* ── Card ── */
      .ds-card {
        display: flex; flex-direction: column;
        cursor: pointer;
        border-radius: 10px;
        background: rgba(10,10,15,0.85);
        border: 2px solid rgba(255,255,255,0.08);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        transition: transform 0.3s ease, border-color 0.3s, box-shadow 0.3s,
                    opacity 0.3s, filter 0.3s;
        width: 210px;
        overflow: hidden;
        user-select: none;
      }
      .ds-card.dimmed {
        opacity: 0.2;
        filter: grayscale(0.8) brightness(0.4);
        transform: scale(0.90);
      }
      .ds-card.active {
        border-color: var(--accent, #fff);
        transform: translateY(-8px) scale(1.05);
        box-shadow:
          0 0 28px color-mix(in srgb, var(--accent, #fff) 45%, transparent),
          0 12px 36px rgba(0,0,0,0.6);
      }
      @media (hover: hover) {
        .ds-card:hover:not(.active):not(.dimmed) {
          border-color: rgba(255,255,255,0.25);
          transform: translateY(-4px);
        }
      }

      /* ── Image ── */
      .ds-img-wrap {
        width: 100%;
        aspect-ratio: 1;
        overflow: hidden;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .ds-img {
        width: 100%; height: 100%;
        object-fit: cover;
        display: block;
        transition: transform 0.35s ease;
      }
      .ds-card:hover .ds-img,
      .ds-card.active .ds-img {
        transform: scale(1.06);
      }

      /* ── Info ── */
      .ds-info {
        padding: 10px 12px 12px;
        display: flex; flex-direction: column;
        align-items: center; gap: 4px;
      }
      .ds-desc {
        margin-top: 2px;
        font-size: 10px;
        color: rgba(255,255,255,0.4);
        font-style: italic;
        margin-bottom: 6px;
      }

      /* ── Stats ── */
      .ds-stats {
        width: 100%;
        display: flex; flex-direction: column; gap: 3px;
      }
      .ds-stat {
        display: flex; align-items: center;
        justify-content: space-between;
        gap: 6px;
      }
      .ds-stat-label {
        font-family: 'Orbitron', monospace;
        font-size: 8px;
        font-weight: 500;
        color: rgba(255,255,255,0.35);
        letter-spacing: 1px;
        min-width: 28px;
        text-align: left;
      }
      .ds-stat-stars {
        display: flex; gap: 1px;
      }
      .ds-star {
        font-size: 11px;
        color: rgba(255,255,255,0.15);
        transition: color 0.3s;
      }
      .ds-star.filled {
        color: #ffcc00;
        text-shadow: 0 0 4px rgba(255,200,0,0.4);
      }
      .ds-card.active .ds-star.filled {
        color: var(--accent, #ffcc00);
        text-shadow: 0 0 6px color-mix(in srgb, var(--accent, #ffcc00) 60%, transparent);
      }
    `;
    document.head.appendChild(style);

    this.el.querySelector('#ds-back').addEventListener('click', () => onBack());

    const cardEls = this.el.querySelectorAll('.ds-card');
    cardEls.forEach((card) => {
      const idx = parseInt(card.dataset.index);
      card.addEventListener('click', () => {
        cardEls.forEach((c) => {
          c.classList.remove('active', 'dimmed');
          if (c !== card) c.classList.add('dimmed');
        });
        card.classList.add('active');
        setTimeout(() => onSelect(idx), 400);
      });
    });
  }

  show() {
    this.el.querySelectorAll('.ds-card').forEach(c => c.classList.remove('active', 'dimmed'));
    fadeIn(this.el);
  }

  hide() { fadeOut(this.el); }
}
