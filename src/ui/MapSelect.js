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

const MAP_ICONS = {
  peru:   '&#129433;',  // llama
  usa:    '&#127751;',  // cityscape
  brazil: '&#127796;',  // palm tree
};

export class MapSelect {
  constructor(onSelect, onBack) {
    this.el = document.createElement('div');
    this.el.id = 'map-select';

    const accents = { brazil: '#ffaa44', usa: '#7788ff', peru: '#55cc66' };

    const cards = DISPLAY_ORDER.map((themeIdx, cardIdx) => {
      const m = MAP_THEMES[themeIdx];
      const img = MAP_IMAGES[m.id];
      const icon = MAP_ICONS[m.id];
      return `
        <div class="ms-card" data-index="${themeIdx}" style="--accent:${accents[m.id]}; --delay:${cardIdx * 0.08}s">
          <div class="ms-card-inner">
            <div class="ms-glow"></div>
            <div class="ms-img-wrap">
              <img class="ms-img" src="${asset(img)}" alt="${m.name}" draggable="false" />
              <div class="ms-img-overlay"></div>
              <div class="ms-sweep"></div>
              <div class="ms-badge">${icon}</div>
            </div>
            <div class="ms-info">
              <div class="ms-flag-block">
                <img class="ms-flag" src="${m.flag}" alt="" draggable="false" />
                <span class="ms-country">${m.name}</span>
              </div>
              <div class="ms-city-block">
                <span class="ms-city">${m.subtitle.replace('\n', '<br>')}</span>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.el.innerHTML = `
      <div class="ms-bg">
        <div class="ms-grid-lines"></div>
      </div>
      <button class="nav-back" id="ms-back" aria-label="Back">&#9664; BACK</button>
      <div class="ms-content">
        <div class="ms-header">
          <div class="ms-stripe ms-stripe-l"></div>
          <h2 class="ms-title">SELECT A MAP</h2>
          <div class="ms-stripe ms-stripe-r"></div>
        </div>
        <div class="ms-cards">${cards}</div>
        <div class="ms-hint">
          <span class="ms-hint-key">&#9664; &#9654;</span> Navigate
          <span class="ms-hint-sep">|</span>
          <span class="ms-hint-key">ENTER</span> Select
        </div>
      </div>
    `;

    gameRoot().appendChild(this.el);

    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&display=swap');

      #map-select {
        position: fixed; inset: 0; z-index: 100;
        display: none; flex-direction: column;
        align-items: center; justify-content: center;
        font-family: 'Segoe UI', Tahoma, sans-serif;
      }

      /* ── Background ── */
      .ms-bg {
        position: absolute; inset: 0;
        background: radial-gradient(ellipse at 50% 45%, #0c1420 0%, #060a10 55%, #000 100%);
        overflow: hidden;
      }
      .ms-grid-lines {
        position: absolute; inset: 0;
        background:
          linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
        background-size: 80px 80px;
        mask-image: radial-gradient(ellipse at 50% 50%, black 25%, transparent 65%);
        -webkit-mask-image: radial-gradient(ellipse at 50% 50%, black 25%, transparent 65%);
      }

      #ms-back {
        position: absolute; top: clamp(12px, 2vh, 28px); left: clamp(12px, 1.5vw, 28px); z-index: 10;
      }

      .ms-content {
        position: relative; z-index: 1;
        text-align: center;
        padding: clamp(10px, 1.5vh, 24px) clamp(14px, 2vw, 36px);
        width: 100%;
        max-width: clamp(700px, 85vw, 1600px);
      }

      /* ── Header with stripes ── */
      .ms-header {
        display: flex; align-items: center; justify-content: center;
        gap: clamp(10px, 1.5vw, 24px);
        margin-bottom: clamp(14px, 2.5vh, 36px);
      }
      .ms-stripe {
        flex: 0 1 clamp(40px, 8vw, 140px);
        height: 2px;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2));
        position: relative;
      }
      .ms-stripe-r { background: linear-gradient(90deg, rgba(255,255,255,0.2), transparent); }
      .ms-stripe::after {
        content: ''; position: absolute; top: -3px;
        width: 8px; height: 8px; border-radius: 50%;
        background: rgba(255,255,255,0.4);
        box-shadow: 0 0 6px rgba(255,255,255,0.3);
      }
      .ms-stripe-l::after { right: 0; }
      .ms-stripe-r::after { left: 0; }

      .ms-title {
        font-family: 'Orbitron', 'Impact', sans-serif;
        font-size: clamp(18px, 2.8vw, 50px);
        font-weight: 900;
        color: #fff;
        letter-spacing: clamp(3px, 0.5vw, 10px);
        text-shadow: 0 0 20px rgba(255,255,255,0.12), 0 2px 6px rgba(0,0,0,0.8);
        white-space: nowrap;
      }

      .ms-cards {
        display: flex; justify-content: center;
        gap: clamp(10px, 1.2vw, 28px);
        align-items: stretch;
      }

      /* ── Card ── */
      .ms-card {
        cursor: pointer; user-select: none;
        width: clamp(180px, 22vw, 440px);
        animation: msCardEnter 0.5s ease-out calc(var(--delay)) both;
      }
      @keyframes msCardEnter {
        0%   { transform: translateY(24px); opacity: 0; }
        100% { transform: translateY(0); opacity: 1; }
      }

      .ms-card-inner {
        position: relative;
        display: flex; flex-direction: column;
        border-radius: clamp(8px, 0.8vw, 18px);
        background: rgba(8,10,18,0.9);
        border: 2px solid rgba(255,255,255,0.07);
        overflow: hidden;
        transition: transform 0.3s ease, border-color 0.3s, box-shadow 0.3s;
        height: 100%;
      }

      .ms-glow {
        position: absolute; inset: -25%; z-index: 0;
        border-radius: 50%;
        background: radial-gradient(ellipse, var(--accent) 0%, transparent 70%);
        opacity: 0; transition: opacity 0.4s;
        filter: blur(24px); pointer-events: none;
      }

      /* Keyboard/gamepad focus highlight */
      .ms-card.focused .ms-card-inner {
        border-color: #22ffaa;
        border-width: 3px;
        transform: translateY(-5px);
        box-shadow:
          0 0 22px rgba(34,255,170,0.35),
          0 0 0 4px rgba(34,255,170,0.12),
          0 8px 24px rgba(0,0,0,0.5);
      }
      .ms-card.focused .ms-glow { opacity: 0.10; }
      .ms-card.focused .ms-card-inner::after {
        content: '';
        position: absolute; inset: -5px; z-index: 10;
        border-radius: clamp(10px, 1vw, 22px);
        border: 2.5px solid rgba(34,255,170,0.35);
        animation: msFocusPulse 1.2s ease-in-out infinite;
        pointer-events: none;
      }
      @keyframes msFocusPulse {
        0%, 100% { border-color: rgba(34,255,170,0.35); box-shadow: 0 0 10px rgba(34,255,170,0.15); }
        50%      { border-color: rgba(34,255,170,0.75); box-shadow: 0 0 22px rgba(34,255,170,0.35); }
      }
      .ms-card.focused::after {
        content: '▲';
        display: block;
        text-align: center;
        color: #22ffaa;
        font-size: clamp(10px, 1vw, 16px);
        margin-top: clamp(4px, 0.5vh, 8px);
        text-shadow: 0 0 8px rgba(34,255,170,0.5);
        animation: msFocusPulse 1.2s ease-in-out infinite;
      }

      .ms-card.active .ms-card-inner {
        border-color: var(--accent);
        transform: translateY(-8px) scale(1.03);
        box-shadow:
          0 0 28px color-mix(in srgb, var(--accent) 35%, transparent),
          0 10px 32px rgba(0,0,0,0.5);
      }
      .ms-card.active .ms-glow { opacity: 0.12; }

      .ms-card.dimmed .ms-card-inner {
        opacity: 0.12;
        filter: grayscale(1) brightness(0.3);
        transform: scale(0.93);
      }

      @media (hover: hover) {
        .ms-card:not(.active):not(.dimmed):hover .ms-card-inner {
          border-color: rgba(255,255,255,0.18);
          transform: translateY(-4px);
          box-shadow: 0 4px 18px rgba(0,0,0,0.4);
        }
        .ms-card:not(.active):not(.dimmed):hover .ms-glow { opacity: 0.06; }
        .ms-card:not(.active):not(.dimmed):hover .ms-sweep {
          animation: msSweep 0.7s ease forwards;
        }
      }

      /* ── Image ── */
      .ms-img-wrap {
        position: relative; z-index: 1;
        width: 100%; aspect-ratio: 4 / 3;
        overflow: hidden;
      }
      .ms-img {
        width: 100%; height: 100%; object-fit: cover; display: block;
        transition: transform 0.4s ease;
      }
      .ms-card.active .ms-img { transform: scale(1.06); }
      .ms-img-overlay {
        position: absolute; inset: 0;
        background: linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.55) 100%);
        pointer-events: none;
      }

      /* Light sweep */
      .ms-sweep {
        position: absolute; inset: 0; z-index: 2;
        background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.07) 45%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.07) 55%, transparent 60%);
        transform: translateX(-120%); pointer-events: none;
      }
      @keyframes msSweep { to { transform: translateX(120%); } }
      .ms-card.active .ms-sweep { animation: msSweep 0.8s ease 0.1s forwards; }

      /* Badge icon */
      .ms-badge {
        position: absolute; top: clamp(6px, 0.8vh, 12px); right: clamp(6px, 0.6vw, 12px);
        z-index: 3;
        font-size: clamp(16px, 2vw, 32px);
        background: rgba(0,0,0,0.5);
        border-radius: 50%;
        width: clamp(28px, 3vw, 48px); height: clamp(28px, 3vw, 48px);
        display: flex; align-items: center; justify-content: center;
        border: 1px solid rgba(255,255,255,0.1);
        backdrop-filter: blur(4px);
      }

      /* ── Info block ── */
      .ms-info {
        position: relative; z-index: 1;
        padding: clamp(8px, 1.2vh, 18px) clamp(10px, 1vw, 22px);
        display: flex; align-items: center;
        gap: clamp(8px, 1vw, 18px);
        background: linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%);
        min-height: clamp(50px, 7vh, 90px);
      }

      .ms-flag-block {
        display: flex; flex-direction: column; align-items: center;
        gap: clamp(2px, 0.3vh, 5px);
      }
      .ms-flag {
        width: clamp(28px, 3.5vw, 56px); height: auto;
        border-radius: clamp(2px, 0.3vw, 6px);
        border: 1px solid rgba(255,255,255,0.15);
        box-shadow: 0 2px 6px rgba(0,0,0,0.5);
      }
      .ms-country {
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(6px, 0.7vw, 12px);
        font-weight: 500;
        color: rgba(255,255,255,0.4);
        letter-spacing: clamp(1px, 0.2vw, 4px);
        text-transform: uppercase;
      }

      .ms-city-block {
        flex: 1;
        display: flex; align-items: center; justify-content: center;
      }
      .ms-city {
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(10px, 1.2vw, 22px);
        font-weight: 700;
        color: #fff;
        letter-spacing: clamp(1px, 0.15vw, 3px);
        text-shadow: 0 1px 4px rgba(0,0,0,0.6);
        text-align: center;
        line-height: 1.3;
        transition: color 0.3s;
      }
      .ms-card.active .ms-city { color: var(--accent); }

      /* ── Input hint bar ── */
      .ms-hint {
        margin-top: clamp(12px, 1.8vh, 26px);
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(7px, 0.8vw, 13px);
        font-weight: 500;
        color: rgba(255,255,255,0.25);
        letter-spacing: 1.5px;
        display: flex; align-items: center; justify-content: center;
        gap: clamp(6px, 0.6vw, 12px);
      }
      .ms-hint-key {
        color: rgba(34,255,170,0.5);
        font-weight: 700;
      }
      .ms-hint-sep {
        color: rgba(255,255,255,0.1);
      }

      /* ── Responsive ── */
      @media (max-width: 600px) {
        .ms-cards { flex-direction: column; align-items: center; }
        .ms-card { width: clamp(240px, 70vw, 400px); }
        .ms-stripe { display: none; }
        .ms-hint { display: none; }
      }
    `;
    document.head.appendChild(style);

    this._onBack = onBack;
    this.el.querySelector('#ms-back').addEventListener('click', () => onBack());

    this._cardEls = [...this.el.querySelectorAll('.ms-card')];
    this._focusIdx = 0;
    this._selected = false;
    this._inputGate = true;

    const selectCard = (card, idx) => {
      if (this._selected) return;
      this._selected = true;
      this._cardEls.forEach((c) => {
        c.classList.remove('active', 'dimmed', 'focused');
        if (c !== card) c.classList.add('dimmed');
      });
      card.classList.add('active');
      setTimeout(() => onSelect(idx), 350);
    };

    this._cardEls.forEach((card) => {
      const idx = parseInt(card.dataset.index);
      card.addEventListener('click', () => selectCard(card, idx));
      card.addEventListener('mouseenter', () => {
        if (!this._selected) this._setFocus(this._cardEls.indexOf(card));
      });
    });

    // Gate: require keyup before accepting new keypresses
    this._keyUpHandler = () => { this._inputGate = false; };
    window.addEventListener('keyup', this._keyUpHandler);

    // Keyboard navigation
    this._keyHandler = (e) => {
      if (this.el.style.display === 'none' || this._selected || this._inputGate) return;
      let idx = this._focusIdx;
      if (e.key === 'ArrowRight') idx = Math.min(idx + 1, this._cardEls.length - 1);
      else if (e.key === 'ArrowLeft') idx = Math.max(idx - 1, 0);
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const card = this._cardEls[this._focusIdx];
        selectCard(card, parseInt(card.dataset.index));
        return;
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        onBack(); return;
      } else return;
      e.preventDefault();
      this._setFocus(idx);
    };
    window.addEventListener('keydown', this._keyHandler);

    // Gamepad
    this._gamepadPoll = null;
    this._gpCooldown = 0;
    this._selectCard = selectCard;
  }

  _setFocus(idx) {
    this._focusIdx = idx;
    this._cardEls.forEach((c, i) => c.classList.toggle('focused', i === idx));
  }

  _startGamepad() {
    if (this._gamepadPoll) return;
    const poll = () => {
      this._gamepadPoll = requestAnimationFrame(poll);
      if (this._selected || this.el.style.display === 'none') return;
      if (this._gpCooldown > 0) { this._gpCooldown--; return; }
      const gps = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const gp of gps) {
        if (!gp) continue;
        const ax = gp.axes[0] || 0;
        let idx = this._focusIdx;
        // Analog stick OR D-pad for navigation
        if (ax > 0.5 || gp.buttons[15]?.pressed) idx = Math.min(idx + 1, this._cardEls.length - 1);
        else if (ax < -0.5 || gp.buttons[14]?.pressed) idx = Math.max(idx - 1, 0);
        if (idx !== this._focusIdx) { this._setFocus(idx); this._gpCooldown = 12; return; }
        // A button = confirm
        if (gp.buttons[0]?.pressed) {
          this._gpCooldown = 30;
          const card = this._cardEls[this._focusIdx];
          this._selectCard(card, parseInt(card.dataset.index));
          return;
        }
        // B button = back
        if (gp.buttons[1]?.pressed) {
          this._gpCooldown = 30;
          this._onBack();
          return;
        }
      }
    };
    poll();
  }

  show() {
    this._selected = false;
    this._inputGate = true;
    this._cardEls.forEach(c => c.classList.remove('active', 'dimmed', 'focused'));
    this._setFocus(0);
    fadeIn(this.el);
    this._startGamepad();
  }

  hide() {
    fadeOut(this.el);
    if (this._gamepadPoll) { cancelAnimationFrame(this._gamepadPoll); this._gamepadPoll = null; }
  }
}
