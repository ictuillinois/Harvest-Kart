export class StartScreen {
  constructor(onStart) {
    this.el = document.createElement('div');
    this.el.id = 'start-screen';
    this.el.innerHTML = `
      <div class="start-content">
        <h1 class="start-title">HARVEST KART</h1>
        <p class="start-subtitle">Drive over piezoelectric plates to harvest energy and power the highway lights!</p>
        <button class="start-btn" id="start-btn">START</button>
      </div>
    `;
    this.el.style.cssText = `
      position: fixed; inset: 0; z-index: 100;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, rgba(26,5,51,0.92) 0%, rgba(255,107,53,0.85) 50%, rgba(255,20,147,0.9) 100%);
      font-family: 'Segoe UI', Tahoma, sans-serif;
      animation: fadeIn 0.5s ease-out;
    `;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
      .start-content {
        text-align: center; padding: 40px;
        background: rgba(0,0,0,0.3); border-radius: 20px;
        backdrop-filter: blur(10px); max-width: 500px;
      }
      .start-title {
        font-size: 4rem; font-weight: 900; color: #fff;
        text-shadow: 0 0 30px rgba(57,255,20,0.6), 0 4px 8px rgba(0,0,0,0.5);
        margin-bottom: 16px; letter-spacing: 4px;
      }
      .start-subtitle {
        color: rgba(255,255,255,0.85); font-size: 1.1rem;
        margin-bottom: 32px; line-height: 1.6;
      }
      .start-btn {
        padding: 16px 48px; font-size: 1.4rem; font-weight: 700;
        background: linear-gradient(135deg, #39ff14, #7fff00);
        color: #1a0533; border: none; border-radius: 50px;
        cursor: pointer; text-transform: uppercase; letter-spacing: 3px;
        box-shadow: 0 0 20px rgba(57,255,20,0.4), 0 4px 15px rgba(0,0,0,0.3);
        transition: transform 0.2s, box-shadow 0.2s;
        animation: pulse 2s infinite;
      }
      .start-btn:hover {
        transform: scale(1.08);
        box-shadow: 0 0 30px rgba(57,255,20,0.7), 0 6px 20px rgba(0,0,0,0.4);
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.el);

    this.el.querySelector('#start-btn').addEventListener('click', () => {
      onStart();
    });
  }

  show() { this.el.style.display = 'flex'; }
  hide() { this.el.style.display = 'none'; }
}
