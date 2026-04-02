export class StartScreen {
  constructor(onStart) {
    this.el = document.createElement('div');
    this.el.id = 'start-screen';
    this.el.innerHTML = `
      <div class="ss-prompt">PRESS HERE TO START</div>
    `;

    document.body.appendChild(this.el);

    const style = document.createElement('style');
    style.textContent = `
      /* ── full-screen container ── */
      #start-screen {
        position: fixed; inset: 0; z-index: 100;
        display: flex; align-items: flex-end; justify-content: center;
        cursor: pointer;
        animation: ssIn 0.8s ease-out;

        /*
         * Layer 1 (top): the artwork, centered, never cropped
         * Layer 2 (bottom): gradient that matches the image edges
         *   - top  = sky blue  sampled from the PNG top edge
         *   - bottom = dark asphalt sampled from the PNG bottom edge
         */
        background:
          url('/Start_Screen.png') center center / contain no-repeat,
          linear-gradient(
            180deg,
            #6ec1e8  0%,
            #6ec1e8 15%,
            #4a8ab5 35%,
            #3a3a3a 65%,
            #222222 85%,
            #1a1a1a 100%
          );
      }

      @keyframes ssIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }

      /*
       * Subtle darkening vignette at the very bottom so the
       * text always reads clearly, even over bright image areas.
       */
      #start-screen::after {
        content: '';
        position: absolute; left: 0; right: 0; bottom: 0;
        height: 30%;
        background: linear-gradient(
          180deg,
          rgba(0,0,0,0) 0%,
          rgba(0,0,0,0.55) 100%
        );
        pointer-events: none;
      }

      /* ── PRESS HERE TO START ── */
      .ss-prompt {
        position: relative;
        z-index: 2;
        padding-bottom: clamp(36px, 7vh, 72px);
        font-family: Impact, 'Arial Black', Tahoma, sans-serif;
        font-size: clamp(1.1rem, 3.8vw, 1.9rem);
        font-weight: 700;
        letter-spacing: 5px;
        color: #fff;
        text-shadow:
          0 0 12px rgba(255,255,255,0.45),
          0 1px 0  rgba(0,0,0,0.9),
          0 3px 6px rgba(0,0,0,0.7);
        animation: ssFlash 1.8s ease-in-out infinite;
      }

      @keyframes ssFlash {
        0%, 100% { opacity: 1;   }
        50%      { opacity: 0.3; }
      }
    `;
    document.head.appendChild(style);

    this.el.addEventListener('click', () => onStart());
  }

  show() { this.el.style.display = 'flex'; }
  hide() { this.el.style.display = 'none'; }
}
