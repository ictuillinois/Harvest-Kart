export class StartScreen {
  constructor(onStart) {
    this.el = document.createElement('div');
    this.el.id = 'start-screen';
    this.el.innerHTML = `
      <div class="ss-title-block">
        <div class="ss-star ss-star-l">&#9733;</div>
        <div class="ss-star ss-star-r">&#9733;</div>
        <div class="ss-title-harvest">HARVEST</div>
        <div class="ss-title-kart">KART</div>
      </div>
      <div class="ss-prompt">PRESS HERE TO BEGIN</div>
    `;

    this.el.style.cssText = `
      position: fixed; inset: 0; z-index: 100;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      cursor: pointer;
      font-family: 'Segoe UI', Impact, Tahoma, sans-serif;
      animation: ssIn 0.6s ease-out;
    `;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes ssIn {
        from { opacity: 0; transform: scale(1.05); }
        to   { opacity: 1; transform: scale(1); }
      }

      /* ── overlay: let 3D scene peek through ── */
      #start-screen::before {
        content: '';
        position: absolute; inset: 0;
        background: linear-gradient(
          180deg,
          rgba(30,140,255,0.15) 0%,
          rgba(0,0,0,0.10) 40%,
          rgba(0,0,0,0.45) 75%,
          rgba(0,0,0,0.70) 100%
        );
        pointer-events: none;
      }

      /* ── title container ── */
      .ss-title-block {
        position: relative;
        text-align: center;
        margin-bottom: 40px;
        z-index: 1;
      }

      /* ── HARVEST ── */
      .ss-title-harvest {
        font-family: Impact, 'Arial Black', sans-serif;
        font-size: clamp(3.5rem, 12vw, 7.5rem);
        font-weight: 900;
        line-height: 0.95;
        letter-spacing: 6px;
        color: #ff8c00;
        background: linear-gradient(
          180deg,
          #ffe04a 0%,
          #ffb300 30%,
          #ff6a00 70%,
          #d44000 100%
        );
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        filter: drop-shadow(0 2px 0 #7a2000)
                drop-shadow(0 4px 0 #5a1500)
                drop-shadow(0 6px 0 #3a0a00)
                drop-shadow(0 8px 12px rgba(0,0,0,0.5));
        paint-order: stroke fill;
        -webkit-text-stroke: 2px #7a2000;
      }

      /* ── KART ── */
      .ss-title-kart {
        font-family: Impact, 'Arial Black', sans-serif;
        font-size: clamp(3rem, 10vw, 6.5rem);
        font-weight: 900;
        line-height: 0.95;
        letter-spacing: 10px;
        color: #ff8c00;
        background: linear-gradient(
          180deg,
          #ffe04a 0%,
          #ffb300 30%,
          #ff6a00 70%,
          #d44000 100%
        );
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        filter: drop-shadow(0 2px 0 #7a2000)
                drop-shadow(0 4px 0 #5a1500)
                drop-shadow(0 6px 0 #3a0a00)
                drop-shadow(0 8px 12px rgba(0,0,0,0.5));
        paint-order: stroke fill;
        -webkit-text-stroke: 2px #7a2000;
        margin-top: -4px;
      }

      /* ── decorative stars ── */
      .ss-star {
        position: absolute;
        font-size: clamp(1.8rem, 4vw, 3rem);
        color: #ffe04a;
        filter: drop-shadow(0 0 6px rgba(255,200,0,0.8));
        z-index: 2;
        animation: ssSpin 4s linear infinite;
      }
      .ss-star-l { top: -10px; left: -10px; }
      .ss-star-r { top: -10px; right: -10px; animation-direction: reverse; }
      @keyframes ssSpin {
        0%   { transform: rotate(0deg)   scale(1);   }
        50%  { transform: rotate(180deg) scale(1.15); }
        100% { transform: rotate(360deg) scale(1);    }
      }

      /* ── PRESS HERE TO BEGIN ── */
      .ss-prompt {
        position: relative; z-index: 1;
        font-family: Impact, 'Arial Black', sans-serif;
        font-size: clamp(1.1rem, 3.5vw, 1.7rem);
        font-weight: 700;
        letter-spacing: 4px;
        color: #fff;
        text-shadow:
          0 0 10px rgba(255,255,255,0.5),
          0 2px 4px rgba(0,0,0,0.8);
        animation: ssFlash 1.6s ease-in-out infinite;
      }
      @keyframes ssFlash {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.35; }
      }

      /* ── responsive ── */
      @media (max-width: 500px) {
        .ss-title-block { margin-bottom: 28px; }
        .ss-title-harvest { letter-spacing: 3px; -webkit-text-stroke: 1.5px #7a2000; }
        .ss-title-kart    { letter-spacing: 5px; -webkit-text-stroke: 1.5px #7a2000; }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(this.el);

    // Clicking anywhere on the screen starts the game
    this.el.addEventListener('click', () => onStart());
  }

  show() { this.el.style.display = 'flex'; }
  hide() { this.el.style.display = 'none'; }
}
