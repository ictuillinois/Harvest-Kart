import { asset, gameRoot } from '../utils/base.js';

export class WinScreen {
  constructor(onPlayAgain) {
    this.el = document.createElement('div');
    this.el.id = 'win-screen';
    this.el.innerHTML = `
      <div class="win-bg"></div>
      <div class="win-particles" id="win-particles"></div>
      <div class="win-content">

        <!-- EOH branding — top of screen, prominent -->
        <div class="win-eoh-block">
          <img class="win-eoh-logo" src="${asset('eoh.svg')}" alt="Engineering Open House" draggable="false"/>
          <div class="win-eoh-text">
            <div class="win-eoh-tagline">FORGING THE FUTURE</div>
            <div class="win-eoh-dates">April 10th &amp; April 11th, 2026</div>
          </div>
        </div>

        <div class="win-divider"></div>

        <h1 class="win-heading" id="win-heading">HIGHWAY POWERED</h1>

        <!-- Driver portrait (left) + Stats grid (right) -->
        <div class="win-main-row">
          <div class="win-driver-side">
            <div class="win-driver-frame">
              <img class="win-driver-img" id="win-driver-img" src="" alt="" draggable="false"/>
            </div>
          </div>

          <div class="win-stats-side">
            <div class="win-stats-grid">
              <div class="win-metric win-metric-highlight">
                <div class="win-metric-icon">&#9733;</div>
                <div class="win-metric-val" id="win-score">0</div>
                <div class="win-metric-lbl">TOTAL SCORE</div>
              </div>
              <div class="win-metric">
                <div class="win-metric-icon">&#9889;</div>
                <div class="win-metric-val" id="win-plates">0</div>
                <div class="win-metric-lbl">PLATES HIT</div>
              </div>
              <div class="win-metric">
                <div class="win-metric-icon">&#215;</div>
                <div class="win-metric-val" id="win-combo">x0</div>
                <div class="win-metric-lbl">BEST COMBO</div>
              </div>
              <div class="win-metric">
                <div class="win-metric-icon">&#9201;</div>
                <div class="win-metric-val" id="win-time">0:00</div>
                <div class="win-metric-lbl">FINISH TIME</div>
              </div>
            </div>
            <button class="win-btn" id="win-btn">
              <span class="win-btn-text">CONTINUE</span>
              <span class="win-btn-arrow">&#8594;</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.el.style.cssText = `
      position: fixed; inset: 0; z-index: 100;
      display: none; align-items: center; justify-content: center;
    `;

    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&display=swap');

      .win-bg {
        position: absolute; inset: 0;
        background: radial-gradient(ellipse at 50% 20%, #0a2a1a 0%, #040e08 55%, #000000 100%);
      }
      .win-particles {
        position: absolute; inset: 0; overflow: hidden; pointer-events: none;
      }
      .win-particle {
        position: absolute; width: 3px; height: 3px;
        background: #22ffaa; border-radius: 50%; opacity: 0;
        animation: winFloat 4s ease-in-out infinite;
      }
      @keyframes winFloat {
        0%   { transform: translateY(0); opacity: 0; }
        20%  { opacity: 0.6; }
        80%  { opacity: 0.3; }
        100% { transform: translateY(-120vh); opacity: 0; }
      }

      .win-content {
        position: relative; z-index: 1;
        display: flex; flex-direction: column; align-items: center;
        justify-content: center;
        padding: clamp(8px, 1.2vh, 18px) clamp(16px, 3vw, 50px);
        max-width: clamp(700px, 92vw, 1600px);
        width: 100%;
        height: 100%;
        animation: winReveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      @keyframes winReveal {
        0%   { transform: translateY(40px) scale(0.95); opacity: 0; }
        100% { transform: translateY(0) scale(1); opacity: 1; }
      }
      @keyframes winFadeUp {
        0%   { transform: translateY(16px); opacity: 0; }
        100% { transform: translateY(0); opacity: 1; }
      }

      /* ── EOH branding — large, top of screen ── */
      .win-eoh-block {
        display: flex; align-items: center;
        gap: clamp(14px, 2.5vw, 40px);
        animation: winFadeUp 0.6s ease-out 0.1s both;
        margin-bottom: clamp(8px, 1.2vh, 18px);
      }
      .win-eoh-logo {
        width: clamp(120px, 18vw, 300px);
        height: auto;
        filter: drop-shadow(0 0 16px rgba(123,47,242,0.35));
      }
      .win-eoh-text {
        display: flex; flex-direction: column;
        gap: clamp(2px, 0.4vh, 6px);
      }
      .win-eoh-tagline {
        font-family: 'Press Start 2P', 'Impact', sans-serif;
        font-size: clamp(12px, 2vw, 32px);
        white-space: nowrap;
        font-weight: 900;
        letter-spacing: clamp(3px, 0.5vw, 10px);
        text-transform: uppercase;
        color: #7b2ff2;
        -webkit-text-stroke: 1px rgba(255,255,255,0.75);
        text-shadow:
          0 0 12px rgba(123,47,242,0.6),
          0 0 30px rgba(123,47,242,0.25);
      }
      .win-eoh-dates {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: clamp(9px, 1.2vw, 20px);
        font-weight: 300;
        letter-spacing: clamp(2px, 0.3vw, 6px);
        color: rgba(255,255,255,0.55);
      }

      .win-divider {
        width: clamp(80px, 18vw, 300px);
        height: 2px;
        background: linear-gradient(90deg, transparent, rgba(34,255,170,0.4), transparent);
        margin-bottom: clamp(8px, 1vh, 16px);
        animation: winFadeUp 0.6s ease-out 0.2s both;
      }

      /* ── Heading ── */
      .win-heading {
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(24px, 5vw, 76px);
        font-weight: 900;
        color: #fff;
        letter-spacing: clamp(4px, 0.8vw, 14px);
        text-align: center;
        margin: 0 0 clamp(10px, 1.5vh, 20px);
        white-space: nowrap;
        background: linear-gradient(180deg, #ffffff 20%, #22ffaa 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        animation: winFadeUp 0.6s ease-out 0.25s both;
      }
      .win-heading.new-best {
        background: linear-gradient(180deg, #ffffff 20%, #ffaa00 100%);
        -webkit-background-clip: text; background-clip: text;
      }

      /* ── Main row: driver left, stats right ── */
      .win-main-row {
        display: flex;
        align-items: center;
        gap: clamp(20px, 3.5vw, 56px);
        width: 100%;
        animation: winFadeUp 0.7s ease-out 0.35s both;
      }

      /* Driver side */
      .win-driver-side {
        flex: 0 0 auto;
        display: flex; align-items: center;
      }
      .win-driver-frame {
        width: clamp(160px, 22vw, 360px);
        border-radius: clamp(8px, 1vw, 16px);
        overflow: hidden;
        border: 2.5px solid rgba(34,255,170,0.3);
        box-shadow:
          0 4px 24px rgba(0,0,0,0.6),
          0 0 24px rgba(34,255,170,0.1),
          inset 0 0 20px rgba(0,0,0,0.3);
      }
      .win-driver-img {
        display: block; width: 100%; height: auto;
        object-fit: contain; pointer-events: none;
      }

      /* Stats side */
      .win-stats-side {
        flex: 1;
        display: flex; flex-direction: column;
        justify-content: center;
        gap: clamp(12px, 2vh, 28px);
      }

      /* 2×2 stats grid */
      .win-stats-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: clamp(10px, 1.4vw, 22px);
      }
      .win-metric {
        display: flex; flex-direction: column; align-items: center;
        gap: clamp(3px, 0.4vh, 7px);
        padding: clamp(14px, 2vh, 30px) clamp(14px, 1.8vw, 32px);
        background: rgba(255,255,255,0.025);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: clamp(8px, 1vw, 16px);
        position: relative;
        overflow: hidden;
      }
      .win-metric::before {
        content: '';
        position: absolute; inset: 0;
        background: radial-gradient(ellipse at 50% 0%, rgba(34,255,170,0.04) 0%, transparent 70%);
        pointer-events: none;
      }
      .win-metric-highlight {
        background: rgba(34,255,170,0.05);
        border-color: rgba(34,255,170,0.18);
      }
      .win-metric-highlight::before {
        background: radial-gradient(ellipse at 50% 0%, rgba(34,255,170,0.1) 0%, transparent 70%);
      }
      .win-metric-icon {
        font-size: clamp(22px, 3vw, 42px);
        filter: drop-shadow(0 0 4px rgba(34,255,170,0.3));
      }
      .win-metric-highlight .win-metric-icon { color: #22ffaa; }
      .win-metric-val {
        font-family: 'Orbitron', monospace;
        font-size: clamp(24px, 4vw, 60px);
        font-weight: 900; color: #fff; line-height: 1;
      }
      .win-metric-highlight .win-metric-val {
        color: #22ffaa;
        text-shadow: 0 0 12px rgba(34,255,170,0.5);
      }
      .win-metric-lbl {
        font-family: 'Orbitron', monospace;
        font-size: clamp(6px, 0.8vw, 13px);
        font-weight: 500;
        color: rgba(255,255,255,0.3);
        letter-spacing: 2px;
      }

      /* Button */
      .win-btn {
        display: flex; align-items: center; justify-content: center;
        gap: clamp(8px, 1vw, 16px);
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(12px, 1.4vw, 22px);
        font-weight: 700;
        padding: clamp(10px, 1.4vh, 20px) clamp(24px, 3vw, 48px);
        background: transparent;
        color: #22ffaa; border: 2px solid #22ffaa;
        border-radius: 60px; cursor: pointer;
        letter-spacing: clamp(2px, 0.4vw, 6px);
        transition: all 0.3s ease;
      }
      .win-btn:hover {
        background: #22ffaa; color: #0a1a10;
        box-shadow: 0 0 30px rgba(34,255,170,0.4);
        transform: translateY(-2px);
      }
      .win-btn:active { transform: scale(0.97); }
      .win-btn-arrow { font-size: 1.2em; transition: transform 0.3s; }
      .win-btn:hover .win-btn-arrow { transform: translateX(4px); }

      /* Responsive */
      @media (max-width: 800px) {
        .win-main-row { flex-direction: column; align-items: center; }
        .win-driver-frame { width: clamp(120px, 35vw, 200px); }
        .win-stats-grid { width: 100%; }
        .win-eoh-block { flex-direction: column; text-align: center; }
        .win-heading { white-space: normal; font-size: clamp(18px, 6vw, 36px); }
      }
    `;
    document.head.appendChild(style);
    gameRoot().appendChild(this.el);

    this._onContinue = onPlayAgain;
    this._continued = false;
    this.el.querySelector('#win-btn').addEventListener('click', () => this._triggerContinue());
  }

  _triggerContinue() {
    if (this._continued) return;
    this._continued = true;
    this._removeInputListeners();
    this._onContinue();
  }

  _addInputListeners() {
    this._keyH = (e) => {
      if (this.el.style.display === 'none' || this._continued) return;
      this._triggerContinue();
    };
    this._ptrH = () => {
      if (this.el.style.display === 'none' || this._continued) return;
      this._triggerContinue();
    };
    window.addEventListener('keydown', this._keyH);
    // Use pointerup (not pointerdown) so a tap doesn't accidentally fire during the reveal animation
    window.addEventListener('pointerup', this._ptrH);
    // Gamepad / racing wheel — poll for any newly pressed button
    this._gpPrevBtn = new Map();
    const pollGP = () => {
      if (this._continued || this.el.style.display === 'none') { this._gpPoll = null; return; }
      this._gpPoll = requestAnimationFrame(pollGP);
      const gps = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const gp of gps) {
        if (!gp) continue;
        for (let i = 0; i < gp.buttons.length; i++) {
          const key = gp.index + ':' + i;
          const was = this._gpPrevBtn.get(key) || false;
          const now = gp.buttons[i].pressed;
          this._gpPrevBtn.set(key, now);
          if (now && !was) { this._triggerContinue(); return; }
        }
      }
    };
    this._gpPoll = requestAnimationFrame(pollGP);
  }

  _removeInputListeners() {
    if (this._keyH) { window.removeEventListener('keydown', this._keyH); this._keyH = null; }
    if (this._ptrH) { window.removeEventListener('pointerup', this._ptrH); this._ptrH = null; }
    if (this._gpPoll) { cancelAnimationFrame(this._gpPoll); this._gpPoll = null; }
  }

  show(platesHit, score = 0, maxCombo = 0, elapsed = 0, driver = null) {
    this.el.querySelector('#win-plates').textContent = platesHit;
    this.el.querySelector('#win-score').textContent = score.toLocaleString();
    this.el.querySelector('#win-combo').textContent = 'x' + maxCombo;

    const m = Math.floor(elapsed / 60);
    const s = Math.floor(elapsed % 60);
    this.el.querySelector('#win-time').textContent = m + ':' + String(s).padStart(2, '0');

    if (driver) {
      this.el.querySelector('#win-driver-img').src = driver.avatar;
      this.el.querySelector('#win-driver-img').alt = driver.name;
      this.el.querySelector('.win-driver-frame').style.borderColor = driver.accentColor;
    }

    const heading = this.el.querySelector('#win-heading');
    const prevBest = parseInt(localStorage.getItem('harvestKart_highScore') || '0');
    if (score > prevBest) {
      localStorage.setItem('harvestKart_highScore', score.toString());
      heading.textContent = 'NEW HIGH SCORE!';
      heading.classList.add('new-best');
      setTimeout(() => {
        heading.textContent = 'HIGHWAY POWERED';
        heading.classList.remove('new-best');
      }, 2500);
    } else {
      heading.textContent = 'HIGHWAY POWERED';
      heading.classList.remove('new-best');
    }

    const particlesEl = this.el.querySelector('#win-particles');
    particlesEl.innerHTML = '';
    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div');
      p.className = 'win-particle';
      p.style.left = Math.random() * 100 + '%';
      p.style.top = (60 + Math.random() * 50) + '%';
      p.style.animationDelay = (Math.random() * 4) + 's';
      p.style.animationDuration = (3 + Math.random() * 3) + 's';
      p.style.width = p.style.height = (2 + Math.random() * 3) + 'px';
      particlesEl.appendChild(p);
    }

    this.el.style.display = 'flex';
    this._continued = false;
    // Delay input listeners so the reveal animation doesn't get skipped by a stray input
    setTimeout(() => this._addInputListeners(), 1200);
  }

  hide() {
    this._removeInputListeners();
    this.el.style.display = 'none';
    const timerEl = document.getElementById('hud-time');
    if (timerEl) timerEl.style.color = '';
  }
}
