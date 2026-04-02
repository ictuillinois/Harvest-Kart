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
            <span class="win-stat-label">Plates Hit</span>
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
        padding: clamp(24px, 5vw, 44px);
        background: rgba(0,0,0,0.25);
        border-radius: 20px;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        max-width: clamp(300px, 80vw, 480px);
        animation: fadeIn 0.5s ease-out;
      }
      .win-title {
        font-family: Impact, 'Arial Black', sans-serif;
        font-size: clamp(1.8rem, 6vw, 3rem);
        font-weight: 900;
        color: #39ff14;
        text-shadow: 0 0 40px rgba(57,255,20,0.7), 0 0 80px rgba(57,255,20,0.3);
        margin-bottom: 10px;
        letter-spacing: 3px;
      }
      .win-subtitle {
        color: rgba(255,255,255,0.8);
        font-size: clamp(0.85rem, 2.5vw, 1.1rem);
        margin-bottom: clamp(18px, 3vh, 30px);
        line-height: 1.5;
      }
      .win-stats {
        display: flex; justify-content: center; gap: 20px;
        margin-bottom: clamp(18px, 3vh, 30px);
      }
      .win-stat {
        display: flex; flex-direction: column; align-items: center;
        background: rgba(255,255,255,0.06);
        padding: clamp(10px, 2vw, 16px) clamp(16px, 3vw, 24px);
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.1);
      }
      .win-stat-icon { font-size: 1.8rem; margin-bottom: 4px; }
      .win-stat-value {
        font-family: 'Courier New', monospace;
        font-size: clamp(1.6rem, 5vw, 2.4rem);
        font-weight: 900; color: #fff;
      }
      .win-stat-label {
        font-size: 0.78rem; color: rgba(255,255,255,0.5);
        text-transform: uppercase; letter-spacing: 1px;
      }
      .win-btn {
        font-family: Impact, 'Arial Black', sans-serif;
        padding: clamp(12px, 2vh, 16px) clamp(32px, 6vw, 48px);
        font-size: clamp(1rem, 2.5vw, 1.3rem);
        font-weight: 700;
        background: linear-gradient(135deg, #39ff14, #7fff00);
        color: #1a2e18; border: none; border-radius: 50px;
        cursor: pointer; text-transform: uppercase; letter-spacing: 3px;
        box-shadow: 0 0 20px rgba(57,255,20,0.4);
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .win-btn:hover {
        transform: scale(1.06);
        box-shadow: 0 0 30px rgba(57,255,20,0.7);
      }
      .win-btn:active { transform: scale(0.97); }

      @media (max-width: 500px) {
        .win-content { border-radius: 14px; }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.el);

    this.el.querySelector('#win-btn').addEventListener('click', () => onPlayAgain());
  }

  show(platesHit) {
    this.el.querySelector('#win-plates').textContent = platesHit;
    this.el.style.display = 'flex';
  }

  hide() { this.el.style.display = 'none'; }
}
