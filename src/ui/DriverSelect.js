import { DRIVER_TYPES } from '../utils/constants.js';

export class DriverSelect {
  constructor(onSelect) {
    this.el = document.createElement('div');
    this.el.id = 'driver-select';
    this.activeIndex = -1;

    const kartColor = (hex) => '#' + hex.toString(16).padStart(6, '0');

    const cards = DRIVER_TYPES.map((d, i) => `
      <div class="ds-card" data-index="${i}">
        <div class="ds-ring" style="--ring-color:${kartColor(d.kartBody)}">
          <img class="ds-avatar" src="${d.avatar}" alt="${d.name}" draggable="false" />
        </div>
        <div class="ds-info">
          <div class="ds-name">${d.name}</div>
          <div class="ds-tagline">${d.tagline}</div>
          <div class="ds-kart-color">
            <span class="ds-color-dot" style="background:${kartColor(d.kartBody)}"></span>
            <span class="ds-color-dot" style="background:${kartColor(d.kartAccent)}"></span>
            ${d.description}
          </div>
          <div class="ds-select-prompt">TAP TO SELECT</div>
        </div>
      </div>
    `).join('');

    this.el.innerHTML = `
      <div class="ds-backdrop"></div>
      <div class="ds-content">
        <h2 class="ds-title">CHOOSE YOUR DRIVER</h2>
        <div class="ds-cards">${cards}</div>
      </div>
    `;

    document.body.appendChild(this.el);

    const style = document.createElement('style');
    style.textContent = `
      /* ── Fullscreen overlay ── */
      #driver-select {
        position: fixed; inset: 0; z-index: 100;
        display: none; align-items: center; justify-content: center;
        font-family: 'Segoe UI', Tahoma, sans-serif;
      }

      /* ── Animated gradient backdrop ── */
      .ds-backdrop {
        position: absolute; inset: 0;
        background: linear-gradient(135deg, #0a0520 0%, #1a0a3a 40%, #0d1a2e 100%);
      }
      .ds-backdrop::before {
        content: ''; position: absolute; inset: 0;
        background:
          radial-gradient(ellipse at 20% 50%, rgba(57,255,20,0.06) 0%, transparent 60%),
          radial-gradient(ellipse at 80% 50%, rgba(100,80,255,0.06) 0%, transparent 60%),
          radial-gradient(ellipse at 50% 0%, rgba(255,180,0,0.05) 0%, transparent 50%);
        animation: dsGlow 6s ease-in-out infinite alternate;
      }
      @keyframes dsGlow {
        0%   { opacity: 0.6; }
        100% { opacity: 1; }
      }

      /* ── Content container ── */
      .ds-content {
        position: relative; z-index: 1;
        text-align: center;
        padding: 20px;
        width: 100%;
        max-width: 780px;
      }

      /* ── Title ── */
      .ds-title {
        font-family: Impact, 'Arial Black', sans-serif;
        font-size: clamp(1.6rem, 5vw, 2.5rem);
        color: #fff;
        letter-spacing: 4px;
        margin-bottom: clamp(20px, 4vh, 40px);
        text-shadow: 0 0 30px rgba(57,255,20,0.3), 0 2px 4px rgba(0,0,0,0.5);
      }

      /* ── Cards row ── */
      .ds-cards {
        display: flex;
        justify-content: center;
        gap: clamp(12px, 3vw, 28px);
        align-items: flex-start;
      }

      /* ── Individual card ── */
      .ds-card {
        display: flex; flex-direction: column; align-items: center;
        cursor: pointer;
        padding: 16px 14px 20px;
        border-radius: 20px;
        background: rgba(255,255,255,0.03);
        border: 2px solid rgba(255,255,255,0.08);
        transition: transform 0.3s ease, border-color 0.3s, background 0.3s, box-shadow 0.3s;
        width: clamp(140px, 26vw, 210px);
        user-select: none;
        -webkit-user-select: none;
      }

      /* ── Dimmed state (when another card is active) ── */
      .ds-card.dimmed {
        opacity: 0.4;
        filter: grayscale(0.6) brightness(0.7);
        transform: scale(0.92);
      }

      /* ── Active/highlighted state ── */
      .ds-card.active {
        background: rgba(255,255,255,0.08);
        border-color: var(--ring-color, #39ff14);
        transform: translateY(-12px) scale(1.06);
        box-shadow:
          0 0 30px color-mix(in srgb, var(--ring-color, #39ff14) 40%, transparent),
          0 12px 40px rgba(0,0,0,0.4);
      }

      /* ── Avatar ring ── */
      .ds-ring {
        --ring-color: #39ff14;
        width: clamp(100px, 18vw, 140px);
        height: clamp(100px, 18vw, 140px);
        border-radius: 50%;
        border: 3px solid rgba(255,255,255,0.15);
        background: rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
        overflow: hidden;
        transition: border-color 0.3s, box-shadow 0.3s, transform 0.3s;
        margin-bottom: 8px;
      }
      .ds-card.active .ds-ring {
        border-color: var(--ring-color);
        box-shadow: 0 0 20px color-mix(in srgb, var(--ring-color) 50%, transparent);
        transform: scale(1.05);
      }

      /* ── Avatar image ── */
      .ds-avatar {
        width: 88%; height: 88%;
        object-fit: contain;
        filter: drop-shadow(0 2px 6px rgba(0,0,0,0.3));
        transition: filter 0.3s, transform 0.3s;
      }
      .ds-card.active .ds-avatar {
        transform: scale(1.05);
        filter: drop-shadow(0 4px 12px rgba(0,0,0,0.4));
      }
      .ds-card.dimmed .ds-avatar {
        filter: grayscale(0.5) drop-shadow(0 2px 4px rgba(0,0,0,0.2));
      }

      /* ── Info panel (hidden by default, revealed on active) ── */
      .ds-info {
        max-height: 0;
        overflow: hidden;
        opacity: 0;
        transition: max-height 0.35s ease, opacity 0.3s ease, margin 0.3s;
        margin-top: 0;
      }
      .ds-card.active .ds-info {
        max-height: 120px;
        opacity: 1;
        margin-top: 8px;
      }

      .ds-name {
        font-family: Impact, 'Arial Black', sans-serif;
        font-size: clamp(1rem, 2.5vw, 1.25rem);
        color: #fff;
        letter-spacing: 1px;
        margin-bottom: 3px;
      }
      .ds-tagline {
        font-size: clamp(0.7rem, 1.5vw, 0.82rem);
        color: rgba(255,255,255,0.5);
        font-style: italic;
        margin-bottom: 6px;
        line-height: 1.3;
      }
      .ds-kart-color {
        display: flex; align-items: center; justify-content: center;
        gap: 5px;
        font-size: 0.72rem;
        color: rgba(255,255,255,0.4);
        margin-bottom: 8px;
      }
      .ds-color-dot {
        width: 10px; height: 10px; border-radius: 50%;
        border: 1px solid rgba(255,255,255,0.2);
      }

      .ds-select-prompt {
        font-family: Impact, 'Arial Black', sans-serif;
        font-size: 0.75rem;
        letter-spacing: 3px;
        color: #39ff14;
        text-shadow: 0 0 8px rgba(57,255,20,0.4);
        animation: dsPulse 1.5s ease-in-out infinite;
      }
      @keyframes dsPulse {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.4; }
      }

      /* ── Hover (desktop) ── */
      @media (hover: hover) {
        .ds-card:hover:not(.active):not(.dimmed) {
          border-color: rgba(255,255,255,0.25);
          background: rgba(255,255,255,0.05);
        }
      }

      /* ── Mobile: smaller cards ── */
      @media (max-width: 500px) {
        .ds-cards { gap: 8px; }
        .ds-card { padding: 12px 8px 16px; border-radius: 14px; }
        .ds-ring { border-width: 2px; }
      }
    `;
    document.head.appendChild(style);

    // --- Interaction ---
    const cardEls = this.el.querySelectorAll('.ds-card');

    const setActive = (index) => {
      this.activeIndex = index;
      cardEls.forEach((card, i) => {
        card.classList.remove('active', 'dimmed');
        // Pass the ring color as a CSS variable to the card
        const d = DRIVER_TYPES[i];
        card.style.setProperty('--ring-color', kartColor(d.kartBody));

        if (index === -1) return; // no selection
        if (i === index) {
          card.classList.add('active');
        } else {
          card.classList.add('dimmed');
        }
      });
    };

    cardEls.forEach((card) => {
      const idx = parseInt(card.dataset.index);

      card.addEventListener('click', () => {
        if (this.activeIndex === idx) {
          // Second click on active card → select
          onSelect(idx);
        } else {
          // First click → highlight
          setActive(idx);
        }
      });
    });
  }

  show() {
    this.activeIndex = -1;
    // Reset all cards to neutral
    this.el.querySelectorAll('.ds-card').forEach(c => {
      c.classList.remove('active', 'dimmed');
    });
    this.el.style.display = 'flex';
  }

  hide() { this.el.style.display = 'none'; }
}
