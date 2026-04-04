import { MAP_THEMES } from '../utils/constants.js';
import { gameRoot, asset } from '../utils/base.js';
import { fadeIn, fadeOut } from '../utils/transition.js';

// Display order: Peru, USA, Brazil  (theme indices 2, 1, 0)
const DISPLAY_ORDER = [2, 1, 0];

const MAP_IMAGES = {
  peru:   'maps/peru.webp',
  usa:    'maps/chicago.webp',
  brazil: 'maps/rio-de-janeiro.webp',
};

export class MapSelect {
  constructor(onSelect, onBack) {
    this.el = document.createElement('div');
    this.el.id = 'map-select';

    const accents = { brazil: '#ffaa44', usa: '#7788ff', peru: '#55cc66' };

    const cards = DISPLAY_ORDER.map((themeIdx) => {
      const m = MAP_THEMES[themeIdx];
      const img = MAP_IMAGES[m.id];
      return `
        <div class="ms-card" data-index="${themeIdx}" style="--accent:${accents[m.id]}">
          <div class="ms-img-wrap">
            <img class="ms-img" src="${asset(img)}" alt="${m.name} map preview" draggable="false" />
          </div>
          <div class="ms-info">
            <div class="ms-flag-row">
              <img class="ms-flag" src="${m.flag}" alt="${m.name} flag" draggable="false" />
              <span class="ms-country">${m.name}</span>
            </div>
            <div class="ms-subtitle">${m.subtitle}</div>
          </div>
        </div>
      `;
    }).join('');

    this.el.innerHTML = `
      <div class="ms-bg"></div>
      <button class="nav-back" id="ms-back" aria-label="Back">&#9664; BACK</button>
      <div class="ms-content">
        <h2 class="ms-title">SELECT A MAP</h2>
        <div class="ms-cards">${cards}</div>
      </div>
    `;

    gameRoot().appendChild(this.el);

    const style = document.createElement('style');
    style.textContent = `
      #map-select {
        position: fixed; inset: 0; z-index: 100;
        display: none; flex-direction: column;
        align-items: center; justify-content: center;
        font-family: 'Segoe UI', Tahoma, sans-serif;
      }

      .ms-bg {
        position: absolute; inset: 0;
        background:
          linear-gradient(rgba(0,0,0,0.68), rgba(0,0,0,0.72)),
          url('${asset('Start_Screen.png')}') center / cover no-repeat;
      }
      .ms-bg::after {
        content: '';
        position: absolute; inset: 0;
        background: linear-gradient(
          180deg,
          rgba(0,0,0,0.15) 0%,
          transparent 40%,
          rgba(0,0,0,0.35) 100%
        );
      }

      #ms-back {
        position: absolute; top: clamp(12px, 2vh, 28px); left: clamp(12px, 1.5vw, 28px);
        z-index: 10;
      }

      .ms-content {
        position: relative; z-index: 1;
        text-align: center;
        padding: clamp(10px, 1.5vh, 24px) clamp(14px, 2vw, 36px);
        width: 100%;
        max-width: clamp(700px, 80vw, 1600px);
      }

      .ms-title {
        font-family: Impact, 'Arial Black', sans-serif;
        font-size: clamp(20px, 2.8vw, 54px);
        color: #fff;
        letter-spacing: clamp(3px, 0.5vw, 10px);
        margin-bottom: clamp(14px, 2.5vh, 36px);
        text-shadow:
          0 0 24px rgba(255,255,255,0.18),
          0 2px 6px rgba(0,0,0,0.8);
      }

      .ms-cards {
        display: flex; justify-content: center;
        gap: clamp(12px, 1.5vw, 32px);
        align-items: stretch;
      }

      /* ── Card ── */
      .ms-card {
        display: flex; flex-direction: column;
        cursor: pointer;
        border-radius: clamp(8px, 0.8vw, 18px);
        background: rgba(0,0,0,0.5);
        border: 2px solid rgba(255,255,255,0.1);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        transition: transform 0.3s ease, border-color 0.3s, background 0.3s,
                    box-shadow 0.3s, opacity 0.3s, filter 0.3s;
        width: clamp(180px, 22vw, 440px);
        overflow: hidden;
        user-select: none;
      }
      .ms-card.dimmed {
        opacity: 0.25;
        filter: grayscale(0.7) brightness(0.5);
        transform: scale(0.92);
      }
      .ms-card.active {
        background: rgba(0,0,0,0.65);
        border-color: var(--accent, #fff);
        transform: translateY(-8px) scale(1.04);
        box-shadow:
          0 0 32px color-mix(in srgb, var(--accent, #fff) 40%, transparent),
          0 14px 40px rgba(0,0,0,0.6);
      }
      @media (hover: hover) {
        .ms-card:hover:not(.active):not(.dimmed) {
          border-color: rgba(255,255,255,0.3);
          background: rgba(0,0,0,0.6);
          transform: translateY(-4px);
        }
      }

      /* ── Image ── */
      .ms-img-wrap {
        width: 100%;
        aspect-ratio: 4 / 3;
        overflow: hidden;
        position: relative;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .ms-img {
        width: 100%; height: 100%;
        object-fit: cover;
        display: block;
        transition: transform 0.4s ease;
      }
      .ms-card:hover .ms-img,
      .ms-card.active .ms-img {
        transform: scale(1.05);
      }
      .ms-img-wrap::after {
        content: '';
        position: absolute; inset: 0;
        background: linear-gradient(
          180deg,
          transparent 60%,
          rgba(0,0,0,0.4) 100%
        );
        pointer-events: none;
      }

      /* ── Info block ── */
      .ms-info {
        padding: clamp(8px, 1vh, 20px) clamp(10px, 1vw, 24px) clamp(10px, 1.2vh, 24px);
        display: flex; flex-direction: column;
        align-items: center; gap: clamp(3px, 0.4vh, 8px);
      }

      .ms-flag-row {
        display: flex; align-items: center; gap: clamp(6px, 0.6vw, 14px);
      }
      .ms-flag {
        width: clamp(20px, 2.5vw, 48px); height: auto;
        border-radius: clamp(2px, 0.2vw, 5px);
        border: 1px solid rgba(255,255,255,0.2);
        box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      }
      .ms-country {
        font-family: Impact, 'Arial Black', sans-serif;
        font-size: clamp(14px, 1.8vw, 36px);
        color: #fff; letter-spacing: clamp(1px, 0.2vw, 4px);
        text-shadow: 0 1px 4px rgba(0,0,0,0.6);
        transition: color 0.3s;
      }
      .ms-card.active .ms-country { color: var(--accent, #fff); }

      .ms-subtitle {
        font-size: clamp(9px, 1vw, 20px);
        color: rgba(255,255,255,0.4);
        font-style: italic;
        transition: color 0.3s;
      }
      .ms-card.active .ms-subtitle { color: rgba(255,255,255,0.7); }
    `;
    document.head.appendChild(style);

    this.el.querySelector('#ms-back').addEventListener('click', () => onBack());

    const cardEls = this.el.querySelectorAll('.ms-card');
    cardEls.forEach((card) => {
      const idx = parseInt(card.dataset.index);
      card.addEventListener('click', () => {
        cardEls.forEach((c, i) => {
          c.classList.remove('active', 'dimmed');
          if (c !== card) c.classList.add('dimmed');
        });
        card.classList.add('active');
        setTimeout(() => onSelect(idx), 350);
      });
    });
  }

  show() {
    this.el.querySelectorAll('.ms-card').forEach(c => c.classList.remove('active', 'dimmed'));
    fadeIn(this.el);
  }

  hide() { fadeOut(this.el); }
}
