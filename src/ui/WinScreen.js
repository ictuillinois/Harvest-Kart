export class WinScreen {
  constructor(onPlayAgain) {
    this.el = document.createElement('div');
    this.el.id = 'win-screen';
    this.el.innerHTML = `
      <div class="win-content">
        <h1 class="win-title">HIGHWAY POWERED!</h1>
        <p class="win-subtitle">You've harvested enough energy to light up the highway!</p>
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
      background: rgba(26,5,51,0.95);
      font-family: 'Segoe UI', Tahoma, sans-serif;
      animation: fadeIn 0.5s ease-out;
    `;

    const style = document.createElement('style');
    style.textContent = `
      .win-content {
        text-align: center; padding: 40px;
        background: rgba(0,0,0,0.3); border-radius: 20px;
        backdrop-filter: blur(10px); max-width: 480px;
      }
      .win-title {
        font-size: 3rem; font-weight: 900; color: #39ff14;
        text-shadow: 0 0 40px rgba(57,255,20,0.7), 0 0 80px rgba(57,255,20,0.3);
        margin-bottom: 12px; letter-spacing: 3px;
      }
      .win-subtitle {
        color: rgba(255,255,255,0.85); font-size: 1.1rem;
        margin-bottom: 30px; line-height: 1.5;
      }
      .win-stats {
        display: flex; justify-content: center; gap: 30px;
        margin-bottom: 32px;
      }
      .win-stat {
        display: flex; flex-direction: column; align-items: center;
        background: rgba(255,255,255,0.08); padding: 16px 24px;
        border-radius: 12px;
      }
      .win-stat-icon { font-size: 2rem; margin-bottom: 4px; }
      .win-stat-value { font-size: 2.4rem; font-weight: 900; color: #fff; }
      .win-stat-label { font-size: 0.85rem; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 1px; }
      .win-btn {
        padding: 16px 48px; font-size: 1.3rem; font-weight: 700;
        background: linear-gradient(135deg, #39ff14, #7fff00);
        color: #1a0533; border: none; border-radius: 50px;
        cursor: pointer; text-transform: uppercase; letter-spacing: 3px;
        box-shadow: 0 0 20px rgba(57,255,20,0.4);
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .win-btn:hover {
        transform: scale(1.08);
        box-shadow: 0 0 30px rgba(57,255,20,0.7);
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.el);

    this.el.querySelector('#win-btn').addEventListener('click', () => {
      onPlayAgain();
    });
  }

  show(platesHit) {
    this.el.querySelector('#win-plates').textContent = platesHit;
    this.el.style.display = 'flex';
  }

  hide() { this.el.style.display = 'none'; }
}
