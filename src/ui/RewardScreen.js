import { asset } from '../utils/base.js';

// Sector bounding boxes in SVG coords (for zoom viewBox)
const SECTOR_BOUNDS = [
  { x: 0, y: 0, w: 360, h: 185 },    // Sector 0: NORTH (top half)
  { x: 0, y: 214, w: 360, h: 186 },   // Sector 1: SOUTH (bottom half)
];

// Navigation grid: 1 col, 3 rows (North, South, HOME)
const NAV = {
  0: { down: 1 },
  1: { up: 0, down: 2 },
  2: { up: 1 }, // HOME
};

export class RewardScreen {
  constructor(onHome) {
    this.el = document.createElement('div');
    this.el.id = 'reward-screen';
    Object.assign(this.el.style, {
      position: 'fixed', inset: '0', zIndex: '100',
      display: 'none', alignItems: 'center', justifyContent: 'center',
    });

    this.el.innerHTML = `
      <div class="rw-bg"></div>
      <div class="rw-particles" id="rw-particles"></div>
      <div class="rw-content">

        <div class="rw-columns">
          <!-- LEFT: Town map -->
          <div class="rw-map-panel">
            <h3 class="rw-map-heading">LIGHT UP THE TOWN</h3>
            <div class="rw-map-frame">
              <svg class="rw-town" viewBox="0 0 360 400" xmlns="http://www.w3.org/2000/svg">
                <!-- Town background -->
                <defs>
                  <filter id="sectorGlow">
                    <feGaussianBlur stdDeviation="4" result="blur"/>
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                  <linearGradient id="roadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#1e2e28"/>
                    <stop offset="100%" stop-color="#141e1a"/>
                  </linearGradient>
                </defs>

                <!-- Base ground -->
                <rect width="360" height="400" fill="#080e0b" rx="10"/>

                <!-- Main road (horizontal divider) -->
                <rect x="0" y="185" width="360" height="30" fill="url(#roadGrad)"/>
                <!-- Road center line -->
                <line x1="0" y1="200" x2="360" y2="200" stroke="#2a4a38" stroke-width="1" stroke-dasharray="8,6"/>

                <!-- NORTH SECTOR -->
                <g class="rw-sector-group" data-sector="0">
                  <rect class="rw-sector" x="8" y="8" width="344" height="170" rx="6"/>
                  <rect x="25" y="30" width="22" height="32" rx="2" class="rw-building"/>
                  <rect x="55" y="22" width="18" height="40" rx="2" class="rw-building"/>
                  <rect x="80" y="35" width="28" height="26" rx="2" class="rw-building"/>
                  <rect x="130" y="28" width="24" height="36" rx="2" class="rw-building"/>
                  <rect x="30" y="85" width="35" height="22" rx="2" class="rw-building"/>
                  <rect x="80" y="80" width="20" height="30" rx="2" class="rw-building"/>
                  <rect x="115" y="90" width="24" height="24" rx="2" class="rw-building"/>
                  <rect x="40" y="130" width="30" height="25" rx="2" class="rw-building"/>
                  <rect x="95" y="125" width="26" height="28" rx="2" class="rw-building"/>
                  <rect x="220" y="25" width="26" height="35" rx="2" class="rw-building"/>
                  <rect x="260" y="30" width="20" height="28" rx="2" class="rw-building"/>
                  <rect x="295" y="20" width="30" height="42" rx="2" class="rw-building"/>
                  <rect x="215" y="82" width="32" height="24" rx="2" class="rw-building"/>
                  <rect x="260" y="78" width="22" height="32" rx="2" class="rw-building"/>
                  <rect x="300" y="85" width="28" height="25" rx="2" class="rw-building"/>
                  <rect x="225" y="128" width="28" height="30" rx="2" class="rw-building"/>
                  <rect x="280" y="130" width="34" height="24" rx="2" class="rw-building"/>
                  <circle cx="50" cy="65" r="3" class="rw-lamp"/>
                  <circle cx="110" cy="100" r="3" class="rw-lamp"/>
                  <circle cx="70" cy="155" r="3" class="rw-lamp"/>
                  <circle cx="250" cy="60" r="3" class="rw-lamp"/>
                  <circle cx="310" cy="110" r="3" class="rw-lamp"/>
                  <circle cx="240" cy="148" r="3" class="rw-lamp"/>
                  <text x="180" y="100" class="rw-sector-num">NORTH</text>
                </g>

                <!-- SOUTH SECTOR -->
                <g class="rw-sector-group" data-sector="1">
                  <rect class="rw-sector" x="8" y="222" width="344" height="170" rx="6"/>
                  <rect x="22" y="240" width="24" height="30" rx="2" class="rw-building"/>
                  <rect x="58" y="235" width="20" height="38" rx="2" class="rw-building"/>
                  <rect x="90" y="242" width="30" height="26" rx="2" class="rw-building"/>
                  <rect x="135" y="238" width="22" height="32" rx="2" class="rw-building"/>
                  <rect x="25" y="295" width="34" height="22" rx="2" class="rw-building"/>
                  <rect x="72" y="290" width="22" height="30" rx="2" class="rw-building"/>
                  <rect x="110" y="288" width="26" height="28" rx="2" class="rw-building"/>
                  <rect x="35" y="342" width="28" height="32" rx="2" class="rw-building"/>
                  <rect x="85" y="345" width="32" height="26" rx="2" class="rw-building"/>
                  <rect x="218" y="238" width="28" height="34" rx="2" class="rw-building"/>
                  <rect x="260" y="240" width="22" height="28" rx="2" class="rw-building"/>
                  <rect x="298" y="235" width="26" height="36" rx="2" class="rw-building"/>
                  <rect x="215" y="296" width="30" height="24" rx="2" class="rw-building"/>
                  <rect x="258" y="292" width="24" height="30" rx="2" class="rw-building"/>
                  <rect x="300" y="295" width="28" height="26" rx="2" class="rw-building"/>
                  <rect x="222" y="348" width="32" height="28" rx="2" class="rw-building"/>
                  <rect x="275" y="342" width="28" height="32" rx="2" class="rw-building"/>
                  <circle cx="48" cy="275" r="3" class="rw-lamp"/>
                  <circle cx="105" cy="325" r="3" class="rw-lamp"/>
                  <circle cx="55" cy="370" r="3" class="rw-lamp"/>
                  <circle cx="245" cy="270" r="3" class="rw-lamp"/>
                  <circle cx="315" cy="320" r="3" class="rw-lamp"/>
                  <circle cx="250" cy="365" r="3" class="rw-lamp"/>
                  <text x="180" y="320" class="rw-sector-num">SOUTH</text>
                </g>

                <!-- Center road lamp cluster -->
                <circle cx="180" cy="200" r="5" fill="#1a3a2a" stroke="#22ffaa" stroke-width="1.5"/>
                <circle cx="180" cy="200" r="2" fill="#22ffaa" opacity="0.6"/>
              </svg>
            </div>
            <div class="rw-hint">
              <span class="rw-hint-key">&#9664; &#9654; &#9650; &#9660;</span> Navigate
              <span class="rw-hint-sep">|</span>
              <span class="rw-hint-key">A / X / Y</span> Select
            </div>
          </div>

          <!-- RIGHT: Character panel -->
          <div class="rw-char-panel">
            <div class="rw-dialog">
              <div class="rw-dialog-bubble">
                <div class="rw-dialog-text">EXCELLENT! Now let's light up a sector of the town.</div>
              </div>
              <div class="rw-dialog-connector"></div>
            </div>
            <div class="rw-portrait">
              <img class="rw-portrait-img" src="${asset('Al-Qadi.webp')}" alt="Dr. Imad L. Al-Qadi" draggable="false"/>
              <div class="rw-portrait-border"></div>
            </div>
            <div class="rw-char-info">
              <span class="rw-name">Imad L. Al-Qadi</span>
              <span class="rw-title">Director, Illinois Center for Transportation</span>
            </div>
          </div>
        </div>

        <button class="rw-home-btn" id="rw-home-btn">
          <span>HOME</span>
          <span class="rw-btn-arrow">&#8594;</span>
        </button>
      </div>

      <!-- Sector zoom overlay -->
      <div class="rw-zoom-overlay" id="rw-zoom-overlay">
        <div class="rw-zoom-content">
          <div class="rw-zoom-frame" id="rw-zoom-frame"></div>
          <div class="rw-zoom-label">See the mini-scale map!</div>
          <div class="rw-zoom-prompt">PRESS ANY BUTTON</div>
        </div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&display=swap');

      /* ═══ BACKGROUND ═══ */
      .rw-bg {
        position: absolute; inset: 0;
        background: radial-gradient(ellipse at 50% 35%, #0a2a1a 0%, #040e08 55%, #000 100%);
      }
      .rw-particles { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
      .rw-particle {
        position: absolute; border-radius: 50%; background: #22ffaa; opacity: 0;
        animation: rwFloat 5s ease-in-out infinite;
      }
      @keyframes rwFloat {
        0%   { transform: translateY(0); opacity: 0; }
        15%  { opacity: 0.5; }
        85%  { opacity: 0.15; }
        100% { transform: translateY(-120vh); opacity: 0; }
      }

      /* ═══ ANIMATIONS ═══ */
      @keyframes rwSlideUp {
        from { transform: translateY(24px); opacity: 0; }
        to   { transform: translateY(0); opacity: 1; }
      }
      @keyframes rwPopIn {
        from { transform: scale(0.88); opacity: 0; }
        to   { transform: scale(1); opacity: 1; }
      }
      @keyframes rwBubblePop {
        0%   { transform: scale(0.7) translateY(8px); opacity: 0; }
        60%  { transform: scale(1.03) translateY(-2px); opacity: 1; }
        100% { transform: scale(1) translateY(0); opacity: 1; }
      }
      @keyframes rwPulseGlow {
        0%, 100% { box-shadow: 0 0 8px rgba(34,255,170,0.2), inset 0 0 8px rgba(34,255,170,0.05); }
        50%      { box-shadow: 0 0 20px rgba(34,255,170,0.45), inset 0 0 14px rgba(34,255,170,0.1); }
      }

      /* ═══ LAYOUT ═══ */
      .rw-content {
        position: relative; z-index: 1;
        display: flex; flex-direction: column; align-items: center;
        gap: clamp(10px, 1.5vh, 24px);
        padding: clamp(8px, 1vh, 16px) clamp(16px, 2.5vw, 40px);
        max-width: clamp(900px, 96vw, 1800px);
        width: 100%;
        height: 100%;
        max-height: 100vh;
        overflow: hidden;
        justify-content: center;
        animation: rwPopIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        box-sizing: border-box;
      }
      .rw-columns {
        display: flex;
        gap: clamp(24px, 4vw, 56px);
        width: 100%;
        flex: 1;
        min-height: 0;
        align-items: center;
        justify-content: center;
      }

      /* ═══ LEFT: TOWN MAP ═══ */
      .rw-map-panel {
        flex: 1.3;
        max-width: 700px;
        min-height: 0;
        display: flex; flex-direction: column; align-items: center;
        overflow: hidden;
        animation: rwSlideUp 0.55s ease-out 0.1s both;
      }
      .rw-map-heading {
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(14px, 1.8vw, 26px);
        font-weight: 700;
        color: #22ffaa;
        letter-spacing: clamp(4px, 0.6vw, 9px);
        margin: 0 0 clamp(6px, 1vh, 16px);
        text-shadow: 0 0 16px rgba(34,255,170,0.4);
        flex-shrink: 0;
      }
      .rw-map-frame {
        width: 100%;
        min-height: 0;
        flex: 1;
        border-radius: clamp(14px, 1.8vw, 28px);
        border: 2.5px solid rgba(34,255,170,0.25);
        background: rgba(4,10,6,0.6);
        padding: clamp(8px, 1vw, 16px);
        animation: rwPulseGlow 3s ease-in-out infinite;
        display: flex;
        align-items: center;
        overflow: hidden;
      }
      .rw-town { width: 100%; height: 100%; display: block; }

      /* Sector base */
      .rw-sector {
        fill: #0c1a14;
        stroke: #162a20;
        stroke-width: 1.2;
        cursor: pointer;
        transition: fill 0.5s, stroke 0.5s, filter 0.5s;
      }

      /* Sector focus highlight (keyboard/gamepad) */
      .rw-sector-group.focused .rw-sector {
        fill: #102a1c;
        stroke: #22ffaa;
        stroke-width: 2.5;
        filter: url(#sectorGlow);
      }

      /* Sector lit state */
      .rw-sector-group.lit .rw-sector {
        fill: #0e3020;
        stroke: #22ffaa;
        stroke-width: 2;
        filter: url(#sectorGlow);
      }
      .rw-sector-group.lit .rw-building {
        fill: #1a5535;
        stroke: #22ffaa;
        stroke-width: 0.5;
      }
      .rw-sector-group.lit .rw-lamp {
        fill: #22ffaa;
        r: 4;
        filter: url(#sectorGlow);
      }
      .rw-sector-group.lit .rw-sector-num {
        fill: #22ffaa;
        opacity: 1;
      }

      /* Buildings */
      .rw-building {
        fill: #14251c;
        stroke: #1a3528;
        stroke-width: 0.6;
        pointer-events: none;
        transition: fill 0.5s, stroke 0.5s;
      }

      /* Lamps */
      .rw-lamp {
        fill: #1a3a2a;
        pointer-events: none;
        transition: fill 0.5s, r 0.3s;
      }

      /* Sector label */
      .rw-sector-num {
        font-family: 'Orbitron', sans-serif;
        font-size: 22px;
        font-weight: 900;
        fill: rgba(255,255,255,0.06);
        text-anchor: middle;
        dominant-baseline: central;
        pointer-events: none;
        letter-spacing: 4px;
        transition: fill 0.5s;
      }

      /* ═══ HINT BAR ═══ */
      .rw-hint {
        margin-top: clamp(8px, 1vh, 14px);
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(7px, 0.7vw, 12px);
        font-weight: 500;
        color: rgba(255,255,255,0.25);
        letter-spacing: 1.5px;
        display: flex; align-items: center; justify-content: center;
        gap: clamp(6px, 0.6vw, 12px);
      }
      .rw-hint-key { color: rgba(34,255,170,0.5); font-weight: 700; }
      .rw-hint-sep { color: rgba(255,255,255,0.1); }

      /* ═══ RIGHT: CHARACTER ═══ */
      .rw-char-panel {
        flex: 0 1 auto;
        width: clamp(300px, 38vw, 550px);
        min-height: 0;
        display: flex; flex-direction: column; align-items: center;
        overflow: hidden;
        animation: rwSlideUp 0.55s ease-out 0.25s both;
      }

      .rw-dialog {
        width: 100%;
        display: flex; flex-direction: column; align-items: center;
        margin-bottom: clamp(6px, 0.8vh, 12px);
      }
      .rw-dialog-bubble {
        position: relative;
        background: linear-gradient(145deg, rgba(10,35,22,0.92), rgba(6,20,14,0.95));
        border: 2.5px solid rgba(34,255,170,0.35);
        border-radius: clamp(14px, 2vw, 28px);
        padding: clamp(14px, 2vh, 28px) clamp(18px, 2.5vw, 36px);
        backdrop-filter: blur(10px);
        box-shadow: 0 4px 28px rgba(0,0,0,0.4), 0 0 20px rgba(34,255,170,0.1);
        animation: rwBubblePop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.5s both;
      }
      .rw-dialog-text {
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(14px, 1.8vw, 28px);
        font-weight: 700;
        color: #fff;
        line-height: 1.6;
        text-align: center;
        letter-spacing: 0.5px;
        text-shadow: 0 0 10px rgba(34,255,170,0.2);
      }
      .rw-dialog-connector {
        width: 2px; height: clamp(14px, 2vh, 24px);
        background: linear-gradient(to bottom, rgba(34,255,170,0.4), transparent);
      }

      .rw-portrait {
        position: relative;
        width: clamp(180px, 24vw, 350px);
        border-radius: clamp(14px, 1.8vw, 24px);
        overflow: hidden;
        margin-bottom: clamp(8px, 1.2vh, 16px);
        flex-shrink: 1;
        animation: rwSlideUp 0.55s ease-out 0.4s both;
      }
      .rw-portrait-img { width: 100%; height: auto; display: block; }
      .rw-portrait-border {
        position: absolute; inset: 0;
        border: 2.5px solid rgba(34,255,170,0.4);
        border-radius: inherit;
        pointer-events: none;
        box-shadow: inset 0 0 24px rgba(0,0,0,0.4), 0 8px 36px rgba(0,0,0,0.5);
      }

      .rw-char-info {
        display: flex; flex-direction: column; align-items: center;
        gap: clamp(3px, 0.5vh, 8px);
        animation: rwSlideUp 0.55s ease-out 0.5s both;
      }
      .rw-name {
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(18px, 2.2vw, 35px);
        font-weight: 900; color: #fff;
        letter-spacing: 2px;
        text-shadow: 0 0 12px rgba(34,255,170,0.25);
      }
      .rw-title {
        font-family: 'Segoe UI', Tahoma, sans-serif;
        font-size: clamp(12px, 1.5vw, 22px);
        color: rgba(255,255,255,0.45);
        text-align: center; line-height: 1.4; max-width: 90%;
      }

      /* ═══ HOME BUTTON ═══ */
      .rw-home-btn {
        display: flex; align-items: center;
        gap: clamp(10px, 1.2vw, 20px);
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(14px, 2vw, 30px);
        font-weight: 700;
        padding: clamp(12px, 1.8vh, 24px) clamp(36px, 5vw, 72px);
        flex-shrink: 0;
        background: transparent;
        color: #22ffaa;
        border: 2.5px solid #22ffaa;
        border-radius: 60px;
        cursor: pointer;
        letter-spacing: clamp(3px, 0.4vw, 7px);
        transition: all 0.3s ease;
        animation: rwSlideUp 0.55s ease-out 0.65s both;
        outline: none;
      }
      .rw-home-btn:hover, .rw-home-btn.focused {
        background: rgba(34,255,170,0.15);
        box-shadow: 0 0 36px rgba(34,255,170,0.3);
        transform: translateY(-2px);
      }
      .rw-home-btn:active { transform: scale(0.97); }
      .rw-btn-arrow { font-size: 1.3em; transition: transform 0.3s; }
      .rw-home-btn:hover .rw-btn-arrow, .rw-home-btn.focused .rw-btn-arrow { transform: translateX(5px); }

      /* ═══ ZOOM OVERLAY ═══ */
      .rw-zoom-overlay {
        position: absolute; inset: 0; z-index: 10;
        display: none; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.85);
        backdrop-filter: blur(12px);
        animation: rwZoomIn 0.4s ease-out both;
      }
      @keyframes rwZoomIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      .rw-zoom-content {
        display: flex; flex-direction: column; align-items: center;
        gap: clamp(20px, 3vh, 40px);
        animation: rwPopIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
      }
      .rw-zoom-frame {
        width: clamp(300px, 45vw, 700px);
        border-radius: clamp(14px, 1.8vw, 28px);
        border: 2.5px solid rgba(34,255,170,0.4);
        background: rgba(4,10,6,0.8);
        padding: clamp(16px, 2vw, 32px);
        box-shadow: 0 0 40px rgba(34,255,170,0.15), 0 8px 40px rgba(0,0,0,0.6);
      }
      .rw-zoom-frame svg { width: 100%; display: block; }
      .rw-zoom-label {
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(18px, 2.8vw, 44px);
        font-weight: 900; color: #fff;
        letter-spacing: clamp(3px, 0.5vw, 8px);
        text-shadow: 0 0 20px rgba(34,255,170,0.3);
        text-align: center;
      }
      .rw-zoom-prompt {
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(10px, 1.4vw, 22px);
        font-weight: 700; color: rgba(255,255,255,0.6);
        letter-spacing: clamp(2px, 0.4vw, 6px);
        animation: rwFlash 2s ease-in-out infinite;
      }
      @keyframes rwFlash {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }

      /* ═══ RESPONSIVE ═══ */
      @media (max-width: 950px) {
        .rw-columns { flex-direction: column-reverse; align-items: center; }
        .rw-char-panel { width: 95%; max-width: 500px; }
        .rw-map-panel { max-width: 98%; flex: 1; }
        .rw-portrait { width: clamp(140px, 35vw, 260px); }
        .rw-hint { display: none; }
      }
      @media (max-height: 700px) {
        .rw-portrait { width: clamp(120px, 18vw, 240px); }
        .rw-dialog-bubble { padding: 10px 16px; }
        .rw-map-heading { margin: 0 0 4px; font-size: clamp(12px, 1.5vw, 20px); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.el);

    this._onHome = onHome;
    this._focusIdx = 0;
    this._mode = 'main'; // 'main' or 'zoom'
    this._sectorEls = [...this.el.querySelectorAll('.rw-sector-group')];
    this._homeBtn = this.el.querySelector('#rw-home-btn');
    this._zoomOverlay = this.el.querySelector('#rw-zoom-overlay');
    this._zoomFrame = this.el.querySelector('#rw-zoom-frame');
    this._gpCooldown = 0;
    this._gpPoll = null;

    // Click on sectors
    this._sectorEls.forEach((group, i) => {
      group.style.cursor = 'pointer';
      group.addEventListener('click', () => {
        if (this._mode !== 'main') return;
        this._selectSector(i);
      });
    });

    // Click HOME
    this._homeBtn.addEventListener('click', () => {
      if (this._mode === 'main') this._onHome();
    });
  }

  _setFocus(idx) {
    this._focusIdx = idx;
    this._sectorEls.forEach(g => g.classList.remove('focused'));
    this._homeBtn.classList.remove('focused');
    if (idx < 2) this._sectorEls[idx].classList.add('focused');
    else this._homeBtn.classList.add('focused');
  }

  _selectSector(idx) {
    // Light up the sector
    this._sectorEls[idx].classList.add('lit');
    // Show zoom overlay
    this._mode = 'zoom';
    const b = SECTOR_BOUNDS[idx];
    const pad = 10;
    const svgSrc = this.el.querySelector('.rw-town').outerHTML
      .replace('viewBox="0 0 360 400"', `viewBox="${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}"`);
    this._zoomFrame.innerHTML = svgSrc;
    this._zoomOverlay.style.display = 'flex';
    // Delay zoom input to prevent instant dismiss
    this._zoomInputReady = false;
    this._gpPrevZoom = new Map();
    setTimeout(() => { this._zoomInputReady = true; }, 800);
  }

  _closeZoom() {
    this._mode = 'main';
    this._zoomOverlay.style.display = 'none';
    this._zoomFrame.innerHTML = '';
  }

  _navigate(dir) {
    const next = NAV[this._focusIdx]?.[dir];
    if (next !== undefined) this._setFocus(next);
  }

  _confirm() {
    if (this._focusIdx < 2) {
      this._selectSector(this._focusIdx);
    } else {
      this._onHome();
    }
  }

  _startInput() {
    // Keyboard
    this._keyH = (e) => {
      if (this.el.style.display === 'none') return;
      if (this._mode === 'zoom') {
        if (this._zoomInputReady) this._closeZoom();
        return;
      }
      if (e.key === 'ArrowRight') this._navigate('right');
      else if (e.key === 'ArrowLeft') this._navigate('left');
      else if (e.key === 'ArrowDown') this._navigate('down');
      else if (e.key === 'ArrowUp') this._navigate('up');
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._confirm(); }
    };
    window.addEventListener('keydown', this._keyH);

    // Gamepad polling
    this._gpCooldown = 0;
    const poll = () => {
      this._gpPoll = requestAnimationFrame(poll);
      if (this.el.style.display === 'none') return;
      if (this._gpCooldown > 0) { this._gpCooldown--; return; }

      const gps = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const gp of gps) {
        if (!gp) continue;

        // In zoom mode: any button press returns to main
        if (this._mode === 'zoom') {
          if (!this._zoomInputReady) continue;
          for (let i = 0; i < gp.buttons.length; i++) {
            const key = gp.index + ':' + i;
            const was = this._gpPrevZoom.get(key) || false;
            const now = gp.buttons[i].pressed;
            this._gpPrevZoom.set(key, now);
            if (now && !was) { this._closeZoom(); this._gpCooldown = 15; return; }
          }
          // Hat switch in zoom mode
          const isHW = gp.axes.length >= 10;
          if (isHW) {
            const hat = gp.axes[9];
            const active = hat < 1.1;
            const wasHat = this._gpPrevZoom.get('hat') || false;
            this._gpPrevZoom.set('hat', active);
            if (active && !wasHat) { this._closeZoom(); this._gpCooldown = 15; return; }
          }
          continue;
        }

        // Main mode: navigation + confirm
        const isHatWheel = gp.axes.length >= 10;
        const ax = gp.axes[0] || 0;
        const ay = isHatWheel ? 0 : (gp.axes[1] || 0);

        let hatL = false, hatR = false, hatU = false, hatD = false;
        if (isHatWheel && gp.axes[9] < 1.1) {
          const hat = gp.axes[9];
          hatL = hat > 0.30 && hat < 1.05;
          hatR = hat > -0.80 && hat < -0.05;
          hatU = hat < -0.65 || hat > 0.90;
          hatD = hat > -0.20 && hat < 0.55;
        }

        let moved = false;
        if (ax > 0.5 || gp.buttons[15]?.pressed || hatR) { this._navigate('right'); moved = true; }
        else if (ax < -0.5 || gp.buttons[14]?.pressed || hatL) { this._navigate('left'); moved = true; }
        else if (ay > 0.5 || gp.buttons[13]?.pressed || hatD) { this._navigate('down'); moved = true; }
        else if (ay < -0.5 || gp.buttons[12]?.pressed || hatU) { this._navigate('up'); moved = true; }
        if (moved) { this._gpCooldown = 12; return; }

        // A (0), X (2), Y (3), Xbox/Menu (10) = confirm
        if (gp.buttons[0]?.pressed || gp.buttons[2]?.pressed || gp.buttons[3]?.pressed || gp.buttons[10]?.pressed) {
          this._gpCooldown = 30;
          this._confirm();
          return;
        }
      }
    };
    this._gpPoll = requestAnimationFrame(poll);
  }

  _stopInput() {
    if (this._keyH) { window.removeEventListener('keydown', this._keyH); this._keyH = null; }
    if (this._gpPoll) { cancelAnimationFrame(this._gpPoll); this._gpPoll = null; }
  }

  show() {
    this.el.style.display = 'flex';
    this._mode = 'main';
    this._zoomOverlay.style.display = 'none';

    // Reset sectors
    this._sectorEls.forEach(g => g.classList.remove('lit', 'focused'));
    this._homeBtn.classList.remove('focused');
    this._setFocus(0);

    // Spawn floating particles
    const container = this.el.querySelector('#rw-particles');
    container.innerHTML = '';
    for (let i = 0; i < 25; i++) {
      const p = document.createElement('div');
      p.className = 'rw-particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.bottom = -(Math.random() * 20) + '%';
      p.style.animationDelay = (Math.random() * 5) + 's';
      p.style.animationDuration = (4 + Math.random() * 4) + 's';
      const s = 2 + Math.random() * 3;
      p.style.width = s + 'px';
      p.style.height = s + 'px';
      container.appendChild(p);
    }

    // Delay input to prevent stray presses
    setTimeout(() => this._startInput(), 1200);
  }

  hide() {
    this._stopInput();
    this.el.style.display = 'none';
  }
}
