import { gameRoot } from '../utils/base.js';

export class WinScreen {
  constructor(onPlayAgain) {
    this.el = document.createElement('div');
    this.el.id = 'win-screen';
    this.el.innerHTML = `
      <div class="win-backdrop"></div>
      <div class="win-content">
        <h1 class="win-title">HIGHWAY POWERED!</h1>
        <p class="win-subtitle">You harvested enough energy to light up the highway!</p>
        <div class="win-stats">
          <div class="win-stat">
            <span class="win-stat-icon">&#9889;</span>
            <span class="win-stat-value" id="win-plates">0</span>
            <span class="win-stat-label">Plates</span>
          </div>
          <div class="win-stat">
            <span class="win-stat-icon">&#9733;</span>
            <span class="win-stat-value" id="win-score">0</span>
            <span class="win-stat-label">Score</span>
          </div>
          <div class="win-stat">
            <span class="win-stat-icon">&#128293;</span>
            <span class="win-stat-value" id="win-combo">0</span>
            <span class="win-stat-label">Best Combo</span>
          </div>
        </div>
        <button class="win-btn" id="win-btn">PLAY AGAIN</button>
      </div>
    `;

    this.el.style.cssText = `
      position: fixed; inset: 0; z-index: 100;
      display: none; align-items: center; justify-content: center;
    `;

    const style = document.createElement('style');
    style.textContent = `
      .win-backdrop {
        position: absolute; inset: 0;
        background: linear-gradient(180deg, #2a6a90 0%, #5a8a50 35%, #3a5a30 60%, #1e2e18 100%);
        opacity: 0.95;
      }
      .win-content {
        position: relative; z-index: 1;
        text-align: center;
        padding: clamp(20px, 3vw, 60px);
        background: rgba(0,0,0,0.25);
        border-radius: clamp(14px, 1.5vw, 28px);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        max-width: clamp(280px, 40vw, 700px);
        animation: fadeIn 0.5s ease-out;
      }
      .win-title {
        font-family: Impact, 'Arial Black', sans-serif;
        font-size: clamp(1.6rem, 3.5vw, 5rem);
        font-weight: 900;
        color: #39ff14;
        text-shadow: 0 0 40px rgba(57,255,20,0.7), 0 0 80px rgba(57,255,20,0.3);
        margin-bottom: clamp(6px, 1vh, 16px);
        letter-spacing: clamp(2px, 0.3vw, 6px);
      }
      .win-subtitle {
        color: rgba(255,255,255,0.8);
        font-size: clamp(0.8rem, 1.4vw, 1.6rem);
        margin-bottom: clamp(14px, 2.5vh, 36px);
        line-height: 1.5;
      }
      .win-stats {
        display: flex; justify-content: center; gap: clamp(12px, 1.5vw, 32px);
        margin-bottom: clamp(14px, 2.5vh, 36px);
      }
      .win-stat {
        display: flex; flex-direction: column; align-items: center;
        background: rgba(255,255,255,0.06);
        padding: clamp(8px, 1.2vw, 22px) clamp(12px, 2vw, 36px);
        border-radius: clamp(8px, 0.8vw, 18px);
        border: 1px solid rgba(255,255,255,0.1);
      }
      .win-stat-icon { font-size: clamp(1.4rem, 2.2vw, 3rem); margin-bottom: clamp(2px, 0.3vh, 8px); }
      .win-stat-value {
        font-family: 'Courier New', monospace;
        font-size: clamp(1.4rem, 3vw, 4rem);
        font-weight: 900; color: #fff;
      }
      .win-stat-label {
        font-size: clamp(0.6rem, 0.8vw, 1.2rem); color: rgba(255,255,255,0.5);
        text-transform: uppercase; letter-spacing: 1px;
      }
      .win-btn {
        font-family: Impact, 'Arial Black', sans-serif;
        padding: clamp(10px, 1.5vh, 24px) clamp(24px, 4vw, 64px);
        font-size: clamp(0.9rem, 1.5vw, 2rem);
        font-weight: 700;
        background: linear-gradient(135deg, #39ff14, #7fff00);
        color: #1a2e18; border: none; border-radius: 50px;
        cursor: pointer; text-transform: uppercase; letter-spacing: clamp(2px, 0.3vw, 6px);
        box-shadow: 0 0 20px rgba(57,255,20,0.4);
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .win-btn:hover {
        transform: scale(1.06);
        box-shadow: 0 0 30px rgba(57,255,20,0.7);
      }
      .win-btn:active { transform: scale(0.97); }
    `;
    document.head.appendChild(style);
    gameRoot().appendChild(this.el);

    this.el.querySelector('#win-btn').addEventListener('click', () => onPlayAgain());
  }

  show(platesHit, score = 0, maxCombo = 0) {
    this.el.querySelector('#win-plates').textContent = platesHit;
    this.el.querySelector('#win-score').textContent = score.toLocaleString();
    this.el.querySelector('#win-combo').textContent = 'x' + maxCombo;

    // High score persistence
    const prevBest = parseInt(localStorage.getItem('harvestKart_highScore') || '0');
    if (score > prevBest) {
      localStorage.setItem('harvestKart_highScore', score.toString());
      // Show "NEW BEST!" indicator
      const title = this.el.querySelector('.win-title');
      title.textContent = 'NEW BEST!';
      title.style.color = '#ffaa00';
      setTimeout(() => {
        title.textContent = 'HIGHWAY POWERED!';
        title.style.color = '#39ff14';
      }, 2000);
    }

    this.el.style.display = 'flex';
  }

  hide() { this.el.style.display = 'none'; }
}
