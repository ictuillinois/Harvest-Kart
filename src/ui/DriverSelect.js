import { DRIVER_TYPES } from '../utils/constants.js';
import { gameRoot } from '../utils/base.js';
import { fadeIn, fadeOut } from '../utils/transition.js';

function statBar(label, filled, total = 5) {
  const pips = Array.from({ length: total }, (_, i) =>
    `<div class="ds-pip ${i < filled ? 'on' : ''}"></div>`
  ).join('');
  return `<div class="ds-stat"><span class="ds-stat-lbl">${label}</span><div class="ds-pips">${pips}</div></div>`;
}

export class DriverSelect {
  constructor(onSelect, onBack) {
    this.el = document.createElement('div');
    this.el.id = 'driver-select';

    const cards = DRIVER_TYPES.map((d, i) => {
      const isElite = d.name === 'Al-Qadi';
      return `
      <div class="ds-card" data-index="${i}" style="--accent:${d.accentColor}; --delay:${i * 0.06}s">
        <div class="ds-card-inner">
          <div class="ds-glow"></div>
          ${isElite ? '<div class="ds-medal"><svg viewBox="0 0 24 24"><circle cx="12" cy="10" r="7" fill="url(#ds-gold)"/><circle cx="12" cy="10" r="5.2" fill="none" stroke="rgba(255,255,255,0.5)" stroke-width="0.5"/><text x="12" y="12.5" text-anchor="middle" font-size="7" font-weight="900" fill="#7a5c00" font-family="serif">&#9733;</text><path d="M8 16.5L7 22l5-2.5L17 22l-1-5.5" fill="url(#ds-gold)" stroke="#b8860b" stroke-width="0.3"/><defs><linearGradient id="ds-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffe066"/><stop offset="50%" stop-color="#ffd700"/><stop offset="100%" stop-color="#b8860b"/></linearGradient></defs></svg></div>' : ''}
          <div class="ds-img-wrap">
            <img class="ds-img" src="${d.avatar}" alt="${d.name}" draggable="false" />
            <div class="ds-sweep"></div>
          </div>
          <div class="ds-stats-bar">
            ${statBar('SPD', d.stats.topSpeed)}
            ${statBar('ACC', d.stats.acceleration)}
            ${statBar('EFF', d.stats.efficiency)}
          </div>
        </div>
      </div>
    `}).join('');

    this.el.innerHTML = `
      <div class="ds-bg">
        <div class="ds-grid-lines"></div>
        <div class="ds-radial"></div>
      </div>
      <button class="nav-back" id="ds-back" aria-label="Back">&#9664; BACK</button>
      <div class="ds-content">
        <div class="ds-header">
          <div class="ds-stripe ds-stripe-l"></div>
          <h2 class="ds-title">CHOOSE YOUR DRIVER</h2>
          <div class="ds-stripe ds-stripe-r"></div>
        </div>
        <div class="ds-roster">${cards}</div>
        <div class="ds-hint">
          <span class="ds-hint-key">&#9664; &#9654;</span> Navigate
          <span class="ds-hint-sep">|</span>
          <span class="ds-hint-key">ENTER</span> Select
        </div>
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
      }

      /* ── Atmospheric background ── */
      .ds-bg {
        position: absolute; inset: 0;
        background: radial-gradient(ellipse at 50% 45%, #0c1828 0%, #060c14 55%, #000 100%);
        overflow: hidden;
      }
      .ds-grid-lines {
        position: absolute; inset: 0;
        background:
          linear-gradient(rgba(34,255,170,0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(34,255,170,0.02) 1px, transparent 1px);
        background-size: 60px 60px;
        mask-image: radial-gradient(ellipse at 50% 50%, black 30%, transparent 70%);
        -webkit-mask-image: radial-gradient(ellipse at 50% 50%, black 30%, transparent 70%);
      }
      .ds-radial {
        position: absolute; inset: 0;
        background: radial-gradient(ellipse at 50% 100%, rgba(34,255,170,0.06) 0%, transparent 50%);
      }

      #ds-back {
        position: absolute; top: clamp(12px, 2vh, 28px); left: clamp(12px, 1.5vw, 28px); z-index: 10;
      }

      .ds-content {
        position: relative; z-index: 1;
        text-align: center;
        padding: clamp(6px, 0.8vh, 12px) clamp(12px, 1.2vw, 24px);
        width: 100%;
        max-width: 92vw;
      }

      /* ── Header with racing stripes ── */
      .ds-header {
        display: flex; align-items: center;
        gap: clamp(10px, 1.5vw, 24px);
        margin-bottom: clamp(6px, 1vh, 16px);
        justify-content: center;
      }
      .ds-stripe {
        flex: 0 1 clamp(40px, 8vw, 140px);
        height: 2px;
        background: linear-gradient(90deg, transparent, rgba(34,255,170,0.4));
        position: relative;
      }
      .ds-stripe-r { background: linear-gradient(90deg, rgba(34,255,170,0.4), transparent); }
      .ds-stripe::after {
        content: '';
        position: absolute; top: -3px;
        width: 8px; height: 8px; border-radius: 50%;
        background: #22ffaa;
        box-shadow: 0 0 8px #22ffaa;
      }
      .ds-stripe-l::after { right: 0; }
      .ds-stripe-r::after { left: 0; }

      .ds-title {
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(14px, 2.2vw, 40px);
        font-weight: 900;
        color: #fff;
        letter-spacing: clamp(2px, 0.5vw, 10px);
        text-shadow: 0 0 24px rgba(34,255,170,0.2), 0 2px 6px rgba(0,0,0,0.8);
        white-space: nowrap;
      }

      /* ── Card grid: 2 rows × 6 cols ── */
      .ds-roster {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: clamp(6px, 0.8vw, 14px);
      }

      /* ── Card ── */
      .ds-card {
        cursor: pointer;
        user-select: none;
        animation: dsCardEnter 0.5s ease-out calc(var(--delay)) both;
      }
      @keyframes dsCardEnter {
        0%   { transform: translateY(20px); opacity: 0; }
        100% { transform: translateY(0); opacity: 1; }
      }

      /* ── Gold medal badge ── */
      .ds-medal {
        position: absolute; top: 4px; left: 4px; z-index: 5;
        width: clamp(44px, 5vw, 80px); height: clamp(44px, 5vw, 80px);
        filter: drop-shadow(0 1px 3px rgba(0,0,0,0.6)) drop-shadow(0 0 6px rgba(255,215,0,0.4));
        pointer-events: none;
        animation: dsMedalShine 3s ease-in-out infinite;
      }
      .ds-medal svg { width: 100%; height: 100%; }
      @keyframes dsMedalShine {
        0%, 100% { filter: drop-shadow(0 1px 3px rgba(0,0,0,0.6)) drop-shadow(0 0 6px rgba(255,215,0,0.4)); }
        50% { filter: drop-shadow(0 1px 3px rgba(0,0,0,0.6)) drop-shadow(0 0 12px rgba(255,215,0,0.7)); }
      }

      .ds-card-inner {
        position: relative;
        border-radius: clamp(5px, 0.6vw, 12px);
        overflow: hidden;
        background: rgba(8,12,20,0.9);
        border: 1.5px solid rgba(255,255,255,0.06);
        transition: transform 0.3s ease, border-color 0.3s, box-shadow 0.3s;
      }

      /* Glow backdrop behind card */
      .ds-glow {
        position: absolute; inset: -20%; z-index: 0;
        border-radius: 50%;
        background: radial-gradient(ellipse, var(--accent) 0%, transparent 70%);
        opacity: 0;
        transition: opacity 0.4s;
        filter: blur(20px);
        pointer-events: none;
      }

      /* Keyboard/gamepad focus highlight */
      .ds-card.focused .ds-card-inner {
        border-color: #22ffaa;
        border-width: 3px;
        transform: translateY(-5px);
        box-shadow:
          0 0 20px rgba(34,255,170,0.35),
          0 0 0 4px rgba(34,255,170,0.12),
          0 8px 24px rgba(0,0,0,0.5);
      }
      .ds-card.focused .ds-glow { opacity: 0.12; }
      .ds-card.focused .ds-card-inner::after {
        content: '';
        position: absolute; inset: -5px; z-index: 10;
        border-radius: clamp(8px, 0.9vw, 16px);
        border: 2.5px solid rgba(34,255,170,0.35);
        animation: dsFocusPulse 1.2s ease-in-out infinite;
        pointer-events: none;
      }
      @keyframes dsFocusPulse {
        0%, 100% { border-color: rgba(34,255,170,0.35); box-shadow: 0 0 10px rgba(34,255,170,0.15); }
        50%      { border-color: rgba(34,255,170,0.75); box-shadow: 0 0 22px rgba(34,255,170,0.35); }
      }
      /* Focus indicator arrow below card */
      .ds-card.focused::after {
        content: '▲';
        display: block;
        text-align: center;
        color: #22ffaa;
        font-size: clamp(8px, 0.9vw, 14px);
        margin-top: clamp(3px, 0.4vh, 6px);
        text-shadow: 0 0 8px rgba(34,255,170,0.5);
        animation: dsFocusPulse 1.2s ease-in-out infinite;
      }

      .ds-card.active .ds-card-inner {
        border-color: var(--accent);
        transform: translateY(-6px) scale(1.03);
        box-shadow:
          0 0 20px color-mix(in srgb, var(--accent) 35%, transparent),
          0 8px 28px rgba(0,0,0,0.5);
      }
      .ds-card.active .ds-glow { opacity: 0.15; }

      .ds-card.dimmed .ds-card-inner {
        opacity: 0.12;
        filter: grayscale(1) brightness(0.3);
        transform: scale(0.93);
      }

      @media (hover: hover) {
        .ds-card:not(.active):not(.dimmed):hover .ds-card-inner {
          border-color: rgba(255,255,255,0.15);
          transform: translateY(-3px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        }
        .ds-card:not(.active):not(.dimmed):hover .ds-glow { opacity: 0.08; }
        .ds-card:not(.active):not(.dimmed):hover .ds-sweep {
          animation: dsSweep 0.6s ease forwards;
        }
      }

      /* ── Character image ── */
      .ds-img-wrap {
        position: relative; z-index: 1;
        width: 100%;
        overflow: hidden;
      }
      .ds-img {
        width: 100%; height: auto;
        display: block;
        transition: transform 0.35s ease;
      }
      .ds-card.active .ds-img { transform: scale(1.04); }

      /* Light sweep on hover */
      .ds-sweep {
        position: absolute; inset: 0; z-index: 2;
        background: linear-gradient(
          105deg,
          transparent 40%,
          rgba(255,255,255,0.08) 45%,
          rgba(255,255,255,0.15) 50%,
          rgba(255,255,255,0.08) 55%,
          transparent 60%
        );
        transform: translateX(-120%);
        pointer-events: none;
      }
      @keyframes dsSweep {
        to { transform: translateX(120%); }
      }
      .ds-card.active .ds-sweep {
        animation: dsSweep 0.7s ease 0.1s forwards;
      }

      /* ── Stats bar ── */
      .ds-stats-bar {
        position: relative; z-index: 1;
        display: flex; flex-direction: column;
        gap: clamp(2px, 0.25vh, 4px);
        padding: clamp(3px, 0.35vh, 7px) clamp(4px, 0.4vw, 10px);
        background: linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.6) 100%);
        border-top: 1px solid rgba(255,255,255,0.04);
      }
      .ds-stat {
        display: flex; align-items: center; justify-content: space-between;
        gap: clamp(3px, 0.3vw, 8px);
      }
      .ds-stat-lbl {
        font-family: 'Orbitron', monospace;
        font-size: clamp(5px, 0.5vw, 10px);
        font-weight: 700;
        color: rgba(255,255,255,0.3);
        letter-spacing: 1px;
        min-width: clamp(16px, 2vw, 32px);
        text-align: left;
      }
      .ds-pips {
        display: flex; gap: clamp(2px, 0.2vw, 4px);
        flex: 1; justify-content: flex-end;
      }
      .ds-pip {
        width: clamp(10px, 1.2vw, 22px);
        height: clamp(4px, 0.4vh, 7px);
        border-radius: 2px;
        background: rgba(255,255,255,0.08);
        transition: background 0.3s, box-shadow 0.3s;
      }
      .ds-pip.on {
        background: linear-gradient(90deg, #22ffaa, #44ffcc);
        box-shadow: 0 0 4px rgba(34,255,170,0.4);
      }
      .ds-card.active .ds-pip.on {
        background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #fff));
        box-shadow: 0 0 6px color-mix(in srgb, var(--accent) 50%, transparent);
      }

      /* ── Input hint bar ── */
      .ds-hint {
        margin-top: clamp(6px, 0.8vh, 14px);
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(7px, 0.7vw, 12px);
        font-weight: 500;
        color: rgba(255,255,255,0.25);
        letter-spacing: 1.5px;
        display: flex; align-items: center; justify-content: center;
        gap: clamp(6px, 0.6vw, 12px);
      }
      .ds-hint-key {
        color: rgba(34,255,170,0.5);
        font-weight: 700;
      }
      .ds-hint-sep {
        color: rgba(255,255,255,0.1);
      }

      /* ── Responsive ── */
      @media (max-width: 500px) {
        .ds-roster { gap: 3px; }
        .ds-stats-bar { padding: 2px 3px; }
        .ds-stat-lbl { display: none; }
        .ds-header { margin-bottom: 6px; }
        .ds-stripe { display: none; }
        .ds-hint { display: none; }
      }
    `;
    document.head.appendChild(style);

    this._onBack = onBack;
    this.el.querySelector('#ds-back').addEventListener('click', () => onBack());

    this._cardEls = [...this.el.querySelectorAll('.ds-card')];
    this._focusIdx = 0;
    this._selected = false;
    this._inputGate = true; // Block input until first keyup (prevents held-key bleed from previous screen)

    const selectCard = (card, idx) => {
      if (this._selected) return;
      this._selected = true;
      this._cardEls.forEach((c) => {
        c.classList.remove('active', 'dimmed', 'focused');
        if (c !== card) c.classList.add('dimmed');
      });
      card.classList.add('active');
      setTimeout(() => onSelect(idx), 450);
    };

    this._cardEls.forEach((card) => {
      const idx = parseInt(card.dataset.index);
      card.addEventListener('click', () => selectCard(card, idx));
      card.addEventListener('mouseenter', () => {
        if (!this._selected) this._setFocus(idx);
      });
    });

    // Gate: require keyup before accepting new keypresses (prevents held-key bleed)
    this._keyUpHandler = () => { this._inputGate = false; };
    window.addEventListener('keyup', this._keyUpHandler);

    // Keyboard navigation
    this._keyHandler = (e) => {
      if (this.el.style.display === 'none' || this._selected || this._inputGate) return;
      const cols = 6;
      let idx = this._focusIdx;
      if (e.key === 'ArrowRight') idx = Math.min(idx + 1, this._cardEls.length - 1);
      else if (e.key === 'ArrowLeft') idx = Math.max(idx - 1, 0);
      else if (e.key === 'ArrowDown') idx = Math.min(idx + cols, this._cardEls.length - 1);
      else if (e.key === 'ArrowUp') idx = Math.max(idx - cols, 0);
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectCard(this._cardEls[this._focusIdx], parseInt(this._cardEls[this._focusIdx].dataset.index));
        return;
      } else if (e.key === 'Escape' || e.key === 'Backspace') {
        onBack(); return;
      } else return;
      e.preventDefault();
      this._setFocus(idx);
    };
    window.addEventListener('keydown', this._keyHandler);

    // Gamepad polling
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
    const cols = 4;
    const poll = () => {
      this._gamepadPoll = requestAnimationFrame(poll);
      if (this._selected || this.el.style.display === 'none') return;
      if (this._gpCooldown > 0) { this._gpCooldown--; return; }
      const gps = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const gp of gps) {
        if (!gp) continue;
        const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
        let idx = this._focusIdx;
        // Analog stick OR D-pad for navigation
        if (ax > 0.5 || gp.buttons[15]?.pressed) idx = Math.min(idx + 1, this._cardEls.length - 1);
        else if (ax < -0.5 || gp.buttons[14]?.pressed) idx = Math.max(idx - 1, 0);
        else if (ay > 0.5 || gp.buttons[13]?.pressed) idx = Math.min(idx + cols, this._cardEls.length - 1);
        else if (ay < -0.5 || gp.buttons[12]?.pressed) idx = Math.max(idx - cols, 0);
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
    this._inputGate = true; // Block until keyup
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
