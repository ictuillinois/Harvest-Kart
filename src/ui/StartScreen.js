import { asset, gameRoot } from '../utils/base.js';
import { fadeIn, fadeOut } from '../utils/transition.js';

export class StartScreen {
  constructor(onStart) {
    this.el = document.createElement('div');
    this.el.id = 'start-screen';
    this.el.innerHTML = `
      <div class="ss-bottom">
        <div class="ss-prompt">PRESS ANY BUTTON TO START</div>
        <div class="ss-credits">
          <span class="ss-license">Licensed by the Illinois Center for Transportation</span>
          <span class="ss-copyright">© 2026 JJC Inc.</span>
        </div>
      </div>
    `;

    gameRoot().appendChild(this.el);

    const style = document.createElement('style');
    style.textContent = `
      /* ── full-screen container ── */
      #start-screen {
        position: fixed; inset: 0; z-index: 100;
        display: flex; align-items: flex-end; justify-content: center;
        cursor: pointer;
        /* no fade-in — screen is solid from frame 0 */

        /*
         * Layer 1: the artwork — cover so it always fills the viewport
         * Layer 2: radial vignette for depth + text readability
         * Layer 3: fallback gradient matching image edges
         *          (sky blue top, wheat gold sides, dark road bottom)
         */
        background:
          url('${asset('Start_Screen.webp')}') center center / cover no-repeat,
          radial-gradient(
            ellipse at center 60%,
            rgba(0,0,0,0) 40%,
            rgba(0,0,0,0.4) 100%
          ),
          linear-gradient(
            180deg,
            #47b0e8  0%,
            #7cc4e0 20%,
            #c8a848 50%,
            #5a6a40 75%,
            #2a3020 100%
          );
      }

      /* start screen is always opaque — no fade that leaks the 3D scene */

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

      /* ── bottom block: prompt + credits ── */
      .ss-bottom {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: clamp(10px, 1.5vh, 24px);
        padding-bottom: clamp(24px, 4vh, 64px);
      }

      /* ── PRESS ANY BUTTON TO START ── */
      .ss-prompt {
        font-family: Impact, 'Arial Black', Tahoma, sans-serif;
        font-size: clamp(1.1rem, 2.4vw, 3.2rem);
        font-weight: 700;
        letter-spacing: clamp(3px, 0.5vw, 10px);
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

      /* ── credits ── */
      .ss-credits {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: clamp(3px, 0.4vh, 8px);
      }
      .ss-license {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: clamp(11px, 1vw, 22px);
        font-weight: 400;
        letter-spacing: clamp(0.5px, 0.1vw, 2px);
        color: rgba(255,255,255,0.75);
        text-shadow: 0 1px 4px rgba(0,0,0,0.8);
      }
      .ss-copyright {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: clamp(10px, 0.9vw, 20px);
        font-weight: 300;
        letter-spacing: 0.5px;
        color: rgba(255,255,255,0.5);
        text-shadow: 0 1px 4px rgba(0,0,0,0.8);
      }
    `;
    document.head.appendChild(style);

    // Universal input — any click, key, touch, or gamepad triggers start
    this._started = false;
    const triggerStart = () => {
      if (this._started || this.el.style.display === 'none') return;
      this._started = true;
      onStart();
    };

    this.el.addEventListener('click', triggerStart);
    this.el.addEventListener('touchstart', (e) => { e.preventDefault(); triggerStart(); });

    this._keyHandler = (e) => {
      if (this.el.style.display === 'none') return;
      triggerStart();
    };
    window.addEventListener('keydown', this._keyHandler);

    // Gamepad polling — check for any button press
    this._gamepadPoll = null;
    const pollGamepad = () => {
      if (this._started || this.el.style.display === 'none') {
        this._gamepadPoll = null;
        return;
      }
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const gp of gamepads) {
        if (!gp) continue;
        for (const btn of gp.buttons) {
          if (btn.pressed) { triggerStart(); return; }
        }
      }
      this._gamepadPoll = requestAnimationFrame(pollGamepad);
    };
    this._startGamepadPoll = () => {
      if (!this._gamepadPoll) pollGamepad();
    };
    window.addEventListener('gamepadconnected', this._startGamepadPoll);
  }

  show(longFade = false) {
    this._started = false;
    if (this._startGamepadPoll) this._startGamepadPoll();
    if (longFade) {
      // Slow fade used when transitioning from the intro screen (0.9s)
      this.el.style.transition = '';
      this.el.style.opacity = '0';
      this.el.style.display = 'flex';
      void this.el.offsetWidth;
      this.el.style.transition = 'opacity 0.9s ease';
      this.el.style.opacity = '1';
    } else {
      fadeIn(this.el);
    }
  }
  hide() { fadeOut(this.el); }
}
