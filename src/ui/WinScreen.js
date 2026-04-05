import { gameRoot } from '../utils/base.js';

export class WinScreen {
  constructor(onPlayAgain) {
    this.el = document.createElement('div');
    this.el.id = 'win-screen';
    this.el.innerHTML = `
      <div class="win-bg"></div>
      <div class="win-particles" id="win-particles"></div>
      <div class="win-content">
        <div class="win-badge">
          <div class="win-badge-ring"></div>
          <div class="win-badge-icon">&#9889;</div>
        </div>
        <h1 class="win-heading" id="win-heading">HIGHWAY POWERED</h1>
        <p class="win-sub">All sectors energized. The highway is alive.</p>
        <div class="win-divider"></div>
        <div class="win-stats">
          <div class="win-stat">
            <div class="win-stat-val" id="win-plates">0</div>
            <div class="win-stat-lbl">PLATES HIT</div>
          </div>
          <div class="win-stat win-stat-main">
            <div class="win-stat-val" id="win-score">0</div>
            <div class="win-stat-lbl">TOTAL SCORE</div>
          </div>
          <div class="win-stat">
            <div class="win-stat-val" id="win-combo">x0</div>
            <div class="win-stat-lbl">BEST COMBO</div>
          </div>
        </div>
        <button class="win-btn" id="win-btn">
          <span class="win-btn-text">PLAY AGAIN</span>
          <span class="win-btn-arrow">&#8594;</span>
        </button>
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
        background: radial-gradient(ellipse at 50% 40%, #0a2a1a 0%, #040e08 60%, #000000 100%);
      }

      /* Floating particles */
      .win-particles {
        position: absolute; inset: 0; overflow: hidden; pointer-events: none;
      }
      .win-particle {
        position: absolute;
        width: 3px; height: 3px;
        background: #22ffaa;
        border-radius: 50%;
        opacity: 0;
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
        display: flex; flex-direction: column;
        align-items: center;
        padding: clamp(24px, 4vh, 60px) clamp(20px, 4vw, 80px);
        max-width: clamp(320px, 50vw, 800px);
        animation: winReveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
      }
      @keyframes winReveal {
        0%   { transform: translateY(40px) scale(0.95); opacity: 0; }
        100% { transform: translateY(0) scale(1); opacity: 1; }
      }

      /* Badge */
      .win-badge {
        position: relative;
        width: clamp(70px, 10vw, 130px);
        height: clamp(70px, 10vw, 130px);
        margin-bottom: clamp(12px, 2vh, 28px);
      }
      .win-badge-ring {
        position: absolute; inset: 0;
        border: 3px solid #22ffaa;
        border-radius: 50%;
        animation: winPulseRing 2s ease-in-out infinite;
        box-shadow: 0 0 20px rgba(34,255,170,0.3), inset 0 0 20px rgba(34,255,170,0.1);
      }
      @keyframes winPulseRing {
        0%, 100% { transform: scale(1); opacity: 1; }
        50%      { transform: scale(1.08); opacity: 0.7; }
      }
      .win-badge-icon {
        position: absolute; inset: 0;
        display: flex; align-items: center; justify-content: center;
        font-size: clamp(32px, 5vw, 60px);
        filter: drop-shadow(0 0 12px rgba(34,255,170,0.8));
        animation: winBadgePop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both;
      }
      @keyframes winBadgePop {
        0%   { transform: scale(0); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
      }

      /* Heading */
      .win-heading {
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(24px, 4.5vw, 72px);
        font-weight: 900;
        color: #fff;
        letter-spacing: clamp(3px, 0.5vw, 10px);
        text-align: center;
        margin: 0 0 clamp(4px, 0.8vh, 12px);
        background: linear-gradient(180deg, #ffffff 20%, #22ffaa 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        animation: winHeadingIn 0.7s ease-out 0.2s both;
      }
      @keyframes winHeadingIn {
        0%   { transform: translateY(20px); opacity: 0; }
        100% { transform: translateY(0); opacity: 1; }
      }
      .win-heading.new-best {
        background: linear-gradient(180deg, #ffffff 20%, #ffaa00 100%);
        -webkit-background-clip: text;
        background-clip: text;
      }

      .win-sub {
        font-family: 'Segoe UI', sans-serif;
        font-size: clamp(11px, 1.3vw, 20px);
        color: rgba(255,255,255,0.45);
        margin: 0 0 clamp(12px, 2vh, 28px);
        letter-spacing: 1px;
        animation: winHeadingIn 0.7s ease-out 0.35s both;
      }

      .win-divider {
        width: clamp(60px, 12vw, 200px);
        height: 2px;
        background: linear-gradient(90deg, transparent, #22ffaa, transparent);
        margin-bottom: clamp(16px, 2.5vh, 36px);
        animation: winHeadingIn 0.7s ease-out 0.4s both;
      }

      /* Stats */
      .win-stats {
        display: flex; gap: clamp(8px, 1.5vw, 28px);
        margin-bottom: clamp(20px, 3vh, 44px);
        animation: winHeadingIn 0.7s ease-out 0.5s both;
      }
      .win-stat {
        display: flex; flex-direction: column; align-items: center;
        padding: clamp(10px, 1.5vh, 20px) clamp(14px, 2vw, 32px);
        background: rgba(34,255,170,0.04);
        border: 1px solid rgba(34,255,170,0.12);
        border-radius: clamp(8px, 1vw, 16px);
      }
      .win-stat-main {
        border-color: rgba(34,255,170,0.3);
        background: rgba(34,255,170,0.08);
      }
      .win-stat-val {
        font-family: 'Orbitron', monospace;
        font-size: clamp(18px, 3vw, 48px);
        font-weight: 900;
        color: #fff;
        line-height: 1;
      }
      .win-stat-main .win-stat-val {
        color: #22ffaa;
        text-shadow: 0 0 12px rgba(34,255,170,0.5);
      }
      .win-stat-lbl {
        font-family: 'Orbitron', monospace;
        font-size: clamp(7px, 0.7vw, 12px);
        font-weight: 500;
        color: rgba(255,255,255,0.35);
        letter-spacing: 2px;
        margin-top: clamp(4px, 0.5vh, 8px);
      }

      /* Button */
      .win-btn {
        display: flex; align-items: center; gap: clamp(8px, 1vw, 16px);
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(12px, 1.4vw, 22px);
        font-weight: 700;
        padding: clamp(12px, 1.8vh, 22px) clamp(28px, 4vw, 56px);
        background: transparent;
        color: #22ffaa;
        border: 2px solid #22ffaa;
        border-radius: 60px;
        cursor: pointer;
        letter-spacing: clamp(2px, 0.3vw, 5px);
        transition: all 0.3s ease;
        animation: winHeadingIn 0.7s ease-out 0.65s both;
      }
      .win-btn:hover {
        background: #22ffaa;
        color: #0a1a10;
        box-shadow: 0 0 30px rgba(34,255,170,0.4);
        transform: translateY(-2px);
      }
      .win-btn:active { transform: scale(0.97); }
      .win-btn-arrow {
        font-size: 1.2em;
        transition: transform 0.3s;
      }
      .win-btn:hover .win-btn-arrow { transform: translateX(4px); }
    `;
    document.head.appendChild(style);
    gameRoot().appendChild(this.el);

    this.el.querySelector('#win-btn').addEventListener('click', () => onPlayAgain());
  }

  show(platesHit, score = 0, maxCombo = 0) {
    this.el.querySelector('#win-plates').textContent = platesHit;
    this.el.querySelector('#win-score').textContent = score.toLocaleString();
    this.el.querySelector('#win-combo').textContent = 'x' + maxCombo;

    const heading = this.el.querySelector('#win-heading');

    // High score check
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

    // Spawn floating particles
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
  }

  hide() {
    this.el.style.display = 'none';
    // Reset timer color
    const timerEl = document.getElementById('hud-time');
    if (timerEl) timerEl.style.color = '';
  }
}
