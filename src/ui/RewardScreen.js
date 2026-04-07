import { asset } from '../utils/base.js';

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

                <!-- Main roads (cross shape) -->
                <rect x="165" y="0" width="30" height="400" fill="url(#roadGrad)"/>
                <rect x="0" y="185" width="360" height="30" fill="url(#roadGrad)"/>
                <!-- Road center lines -->
                <line x1="180" y1="0" x2="180" y2="185" stroke="#2a4a38" stroke-width="1" stroke-dasharray="8,6"/>
                <line x1="180" y1="215" x2="180" y2="400" stroke="#2a4a38" stroke-width="1" stroke-dasharray="8,6"/>
                <line x1="0" y1="200" x2="165" y2="200" stroke="#2a4a38" stroke-width="1" stroke-dasharray="8,6"/>
                <line x1="195" y1="200" x2="360" y2="200" stroke="#2a4a38" stroke-width="1" stroke-dasharray="8,6"/>

                <!-- SECTOR 1: top-left -->
                <g class="rw-sector-group" data-sector="0">
                  <rect class="rw-sector" x="8" y="8" width="150" height="170" rx="6"/>
                  <!-- Buildings -->
                  <rect x="25" y="30" width="22" height="32" rx="2" class="rw-building"/>
                  <rect x="55" y="22" width="18" height="40" rx="2" class="rw-building"/>
                  <rect x="80" y="35" width="28" height="26" rx="2" class="rw-building"/>
                  <rect x="30" y="85" width="35" height="22" rx="2" class="rw-building"/>
                  <rect x="80" y="80" width="20" height="30" rx="2" class="rw-building"/>
                  <rect x="115" y="40" width="24" height="36" rx="2" class="rw-building"/>
                  <rect x="40" y="130" width="30" height="25" rx="2" class="rw-building"/>
                  <rect x="95" y="125" width="26" height="28" rx="2" class="rw-building"/>
                  <!-- Lamp posts -->
                  <circle cx="50" cy="65" r="3" class="rw-lamp"/>
                  <circle cx="110" cy="100" r="3" class="rw-lamp"/>
                  <circle cx="70" cy="155" r="3" class="rw-lamp"/>
                  <text x="83" y="100" class="rw-sector-num">1</text>
                </g>

                <!-- SECTOR 2: top-right -->
                <g class="rw-sector-group" data-sector="1">
                  <rect class="rw-sector" x="202" y="8" width="150" height="170" rx="6"/>
                  <rect x="220" y="25" width="26" height="35" rx="2" class="rw-building"/>
                  <rect x="260" y="30" width="20" height="28" rx="2" class="rw-building"/>
                  <rect x="295" y="20" width="30" height="42" rx="2" class="rw-building"/>
                  <rect x="215" y="82" width="32" height="24" rx="2" class="rw-building"/>
                  <rect x="260" y="78" width="22" height="32" rx="2" class="rw-building"/>
                  <rect x="300" y="85" width="28" height="25" rx="2" class="rw-building"/>
                  <rect x="225" y="128" width="28" height="30" rx="2" class="rw-building"/>
                  <rect x="280" y="130" width="34" height="24" rx="2" class="rw-building"/>
                  <circle cx="250" cy="60" r="3" class="rw-lamp"/>
                  <circle cx="310" cy="110" r="3" class="rw-lamp"/>
                  <circle cx="240" cy="148" r="3" class="rw-lamp"/>
                  <text x="277" y="100" class="rw-sector-num">2</text>
                </g>

                <!-- SECTOR 3: bottom-left -->
                <g class="rw-sector-group" data-sector="2">
                  <rect class="rw-sector" x="8" y="222" width="150" height="170" rx="6"/>
                  <rect x="22" y="240" width="24" height="30" rx="2" class="rw-building"/>
                  <rect x="58" y="235" width="20" height="38" rx="2" class="rw-building"/>
                  <rect x="90" y="242" width="30" height="26" rx="2" class="rw-building"/>
                  <rect x="25" y="295" width="34" height="22" rx="2" class="rw-building"/>
                  <rect x="72" y="290" width="22" height="30" rx="2" class="rw-building"/>
                  <rect x="110" y="288" width="26" height="28" rx="2" class="rw-building"/>
                  <rect x="35" y="342" width="28" height="32" rx="2" class="rw-building"/>
                  <rect x="85" y="345" width="32" height="26" rx="2" class="rw-building"/>
                  <circle cx="48" cy="275" r="3" class="rw-lamp"/>
                  <circle cx="105" cy="325" r="3" class="rw-lamp"/>
                  <circle cx="55" cy="370" r="3" class="rw-lamp"/>
                  <text x="83" y="320" class="rw-sector-num">3</text>
                </g>

                <!-- SECTOR 4: bottom-right -->
                <g class="rw-sector-group" data-sector="3">
                  <rect class="rw-sector" x="202" y="222" width="150" height="170" rx="6"/>
                  <rect x="218" y="238" width="28" height="34" rx="2" class="rw-building"/>
                  <rect x="260" y="240" width="22" height="28" rx="2" class="rw-building"/>
                  <rect x="298" y="235" width="26" height="36" rx="2" class="rw-building"/>
                  <rect x="215" y="296" width="30" height="24" rx="2" class="rw-building"/>
                  <rect x="258" y="292" width="24" height="30" rx="2" class="rw-building"/>
                  <rect x="300" y="295" width="28" height="26" rx="2" class="rw-building"/>
                  <rect x="222" y="348" width="32" height="28" rx="2" class="rw-building"/>
                  <rect x="275" y="342" width="28" height="32" rx="2" class="rw-building"/>
                  <circle cx="245" cy="270" r="3" class="rw-lamp"/>
                  <circle cx="315" cy="320" r="3" class="rw-lamp"/>
                  <circle cx="250" cy="365" r="3" class="rw-lamp"/>
                  <text x="277" y="320" class="rw-sector-num">4</text>
                </g>

                <!-- Center intersection lamp cluster -->
                <circle cx="180" cy="200" r="5" fill="#1a3a2a" stroke="#22ffaa" stroke-width="1.5"/>
                <circle cx="180" cy="200" r="2" fill="#22ffaa" opacity="0.6"/>
              </svg>
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
      @keyframes rwLampPulse {
        0%, 100% { r: 3; opacity: 0.7; }
        50%      { r: 5; opacity: 1; }
      }

      /* ═══ LAYOUT ═══ */
      .rw-content {
        position: relative; z-index: 1;
        display: flex; flex-direction: column; align-items: center;
        gap: clamp(16px, 2.5vh, 36px);
        padding: clamp(12px, 1.5vh, 24px) clamp(16px, 2.5vw, 40px);
        max-width: clamp(900px, 96vw, 1800px);
        width: 100%;
        height: 100%;
        justify-content: center;
        animation: rwPopIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      .rw-columns {
        display: flex;
        gap: clamp(24px, 4vw, 56px);
        width: 100%;
        flex: 1;
        align-items: center;
        justify-content: center;
      }

      /* ═══ LEFT: TOWN MAP ═══ */
      .rw-map-panel {
        flex: 1.3;
        max-width: 700px;
        display: flex; flex-direction: column; align-items: center;
        animation: rwSlideUp 0.55s ease-out 0.1s both;
      }
      .rw-map-heading {
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(16px, 2vw, 30px);
        font-weight: 700;
        color: #22ffaa;
        letter-spacing: clamp(4px, 0.6vw, 9px);
        margin: 0 0 clamp(12px, 2vh, 28px);
        text-shadow: 0 0 16px rgba(34,255,170,0.4);
      }
      .rw-map-frame {
        width: 100%;
        border-radius: clamp(14px, 1.8vw, 28px);
        border: 2.5px solid rgba(34,255,170,0.25);
        background: rgba(4,10,6,0.6);
        padding: clamp(10px, 1.2vw, 20px);
        animation: rwPulseGlow 3s ease-in-out infinite;
      }
      .rw-town { width: 100%; display: block; }

      /* Sector base */
      .rw-sector {
        fill: #0c1a14;
        stroke: #162a20;
        stroke-width: 1.2;
        cursor: pointer;
        transition: fill 0.5s, stroke 0.5s, filter 0.5s;
      }
      .rw-sector:hover { fill: #102a1c; stroke: #22ffaa; }

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

      /* Sector number */
      .rw-sector-num {
        font-family: 'Orbitron', sans-serif;
        font-size: 36px;
        font-weight: 900;
        fill: rgba(255,255,255,0.06);
        text-anchor: middle;
        dominant-baseline: central;
        pointer-events: none;
        transition: fill 0.5s;
      }

      /* ═══ RIGHT: CHARACTER ═══ */
      .rw-char-panel {
        flex: 0 0 auto;
        width: clamp(350px, 42vw, 600px);
        display: flex; flex-direction: column; align-items: center;
        animation: rwSlideUp 0.55s ease-out 0.25s both;
      }

      /* Dialog bubble */
      .rw-dialog {
        width: 100%;
        display: flex; flex-direction: column; align-items: center;
        margin-bottom: clamp(6px, 0.8vh, 12px);
      }
      .rw-dialog-bubble {
        position: relative;
        background: linear-gradient(145deg, rgba(10,35,22,0.92), rgba(6,20,14,0.95));
        border: 2.5px solid rgba(34,255,170,0.35);
        border-radius: clamp(18px, 2.5vw, 34px);
        padding: clamp(22px, 3vh, 40px) clamp(24px, 3vw, 44px);
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

      /* Portrait */
      .rw-portrait {
        position: relative;
        width: clamp(225px, 30vw, 425px);
        border-radius: clamp(14px, 1.8vw, 24px);
        overflow: hidden;
        margin-bottom: clamp(14px, 2vh, 24px);
        animation: rwSlideUp 0.55s ease-out 0.4s both;
      }
      .rw-portrait-img {
        width: 100%; height: auto;
        display: block;
      }
      .rw-portrait-border {
        position: absolute; inset: 0;
        border: 2.5px solid rgba(34,255,170,0.4);
        border-radius: inherit;
        pointer-events: none;
        box-shadow: inset 0 0 24px rgba(0,0,0,0.4), 0 8px 36px rgba(0,0,0,0.5);
      }

      /* Character info */
      .rw-char-info {
        display: flex; flex-direction: column; align-items: center;
        gap: clamp(3px, 0.5vh, 8px);
        animation: rwSlideUp 0.55s ease-out 0.5s both;
      }
      .rw-name {
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(18px, 2.2vw, 35px);
        font-weight: 900;
        color: #fff;
        letter-spacing: 2px;
        text-shadow: 0 0 12px rgba(34,255,170,0.25);
      }
      .rw-title {
        font-family: 'Segoe UI', Tahoma, sans-serif;
        font-size: clamp(12px, 1.5vw, 22px);
        color: rgba(255,255,255,0.45);
        text-align: center;
        line-height: 1.4;
        max-width: 90%;
      }

      /* ═══ HOME BUTTON ═══ */
      .rw-home-btn {
        display: flex; align-items: center;
        gap: clamp(12px, 1.5vw, 24px);
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(16px, 2.2vw, 34px);
        font-weight: 700;
        padding: clamp(16px, 2.5vh, 32px) clamp(44px, 6vw, 88px);
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
      .rw-home-btn:hover {
        background: #22ffaa; color: #0a1a10;
        box-shadow: 0 0 36px rgba(34,255,170,0.4);
        transform: translateY(-2px);
      }
      .rw-home-btn:active { transform: scale(0.97); }
      .rw-btn-arrow { font-size: 1.3em; transition: transform 0.3s; }
      .rw-home-btn:hover .rw-btn-arrow { transform: translateX(5px); }

      /* ═══ RESPONSIVE ═══ */
      @media (max-width: 950px) {
        .rw-columns { flex-direction: column-reverse; align-items: center; }
        .rw-char-panel { width: 95%; max-width: 500px; }
        .rw-map-panel { max-width: 98%; }
        .rw-portrait { width: clamp(180px, 45vw, 320px); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.el);

    // Sector click — toggle lit state on the group
    this.el.querySelectorAll('.rw-sector-group').forEach(group => {
      group.addEventListener('click', () => group.classList.toggle('lit'));
    });

    // Home button
    this.el.querySelector('#rw-home-btn').addEventListener('click', () => onHome());
  }

  show() {
    this.el.style.display = 'flex';

    // Reset sectors
    this.el.querySelectorAll('.rw-sector-group').forEach(g => g.classList.remove('lit'));

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
  }

  hide() {
    this.el.style.display = 'none';
  }
}
