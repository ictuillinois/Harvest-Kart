import { asset, gameRoot } from '../utils/base.js';
import { fadeIn, fadeOut } from '../utils/transition.js';

export class StartScreen {
  constructor(onStart) {
    this.el = document.createElement('div');
    this.el.id = 'start-screen';
    this.el.innerHTML = `
      <div class="ss-title-area">
        <!-- Outer frame -->
        <div class="ss-frame">
          <div class="ss-frame-corner ss-fc-tl"></div>
          <div class="ss-frame-corner ss-fc-tr"></div>
          <div class="ss-frame-corner ss-fc-bl"></div>
          <div class="ss-frame-corner ss-fc-br"></div>
          <div class="ss-frame-edge ss-fe-top"></div>
          <div class="ss-frame-edge ss-fe-bottom"></div>
          <div class="ss-frame-edge ss-fe-left"></div>
          <div class="ss-frame-edge ss-fe-right"></div>

          <!-- Inner glow backdrop -->
          <div class="ss-frame-glow"></div>

          <!-- Top accent bar -->
          <div class="ss-top-bar">
            <span class="ss-bar-line"></span>
            <span class="ss-bar-diamond">&#9670;</span>
            <span class="ss-bar-text">ILLINOIS CENTER FOR TRANSPORTATION PRESENTS</span>
            <span class="ss-bar-diamond">&#9670;</span>
            <span class="ss-bar-line"></span>
          </div>

          <!-- Main title -->
          <div class="ss-title-wrap">
            <div class="ss-speed-line ss-sl-left"></div>
            <div class="ss-title-block">
              <h1 class="ss-title">
                <span class="ss-title-top">AL-QADI</span>
                <span class="ss-title-mid">TEAM RACING</span>
              </h1>
            </div>
            <div class="ss-speed-line ss-sl-right"></div>
          </div>

          <!-- Subtitle -->
          <div class="ss-subtitle-wrap">
            <span class="ss-sub-wing ss-sw-left"></span>
            <h2 class="ss-subtitle">ENERGY HARVESTING EDITION</h2>
            <span class="ss-sub-wing ss-sw-right"></span>
          </div>

          <!-- Bottom accent bar -->
          <div class="ss-bottom-bar">
            <span class="ss-bar-line"></span>
            <span class="ss-bar-diamond">&#9670;</span>
            <span class="ss-bar-line"></span>
          </div>
        </div>
      </div>
      <img class="ss-ict-logo" src="${asset('ICT-Logo.png')}" alt="ICT" draggable="false"/>
      <img class="ss-eoh-logo" src="${asset('eoh.svg')}" alt="Engineering Open House" draggable="false"/>
      <div class="ss-bottom">
        <div class="ss-prompt">PRESS ANY BUTTON TO START</div>
        <div class="ss-credits">
          <span class="ss-license">Licensed by the Illinois Center for Transportation</span>
          <span class="ss-copyright">&copy; 2026, Powered by the Computational Mechanics Group</span>
        </div>
      </div>
    `;

    gameRoot().appendChild(this.el);
    this.el.style.display = 'none'; // hidden until show() — prevents flash before IntroScreen

    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&display=swap');

      /* ═══ CONTAINER ═══ */
      #start-screen {
        position: fixed; inset: 0; z-index: 100;
        display: flex; flex-direction: column;
        align-items: center; justify-content: space-between;
        cursor: pointer;
        background:
          url('${asset('Start_Screen.webp')}') center center / cover no-repeat,
          radial-gradient(ellipse at center 60%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.5) 100%),
          linear-gradient(180deg, #0a0a1a 0%, #1a1a2a 50%, #0a0a0a 100%);
      }

      /* Top vignette for title readability */
      #start-screen::before {
        content: '';
        position: absolute; left: 0; right: 0; top: 0;
        height: 45%;
        background: linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 70%, transparent 100%);
        pointer-events: none; z-index: 1;
      }

      /* Bottom vignette — strong gradient for text readability + hides artifacts */
      #start-screen::after {
        content: '';
        position: absolute; left: 0; right: 0; bottom: 0;
        height: 50%;
        background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.92) 100%);
        pointer-events: none; z-index: 1;
      }

      /* ═══ TITLE AREA ═══ */
      .ss-title-area {
        position: relative; z-index: 2;
        display: flex; flex-direction: column; align-items: center;
        padding-top: clamp(16px, 3vh, 48px);
      }

      /* ═══ FRAME ═══ */
      .ss-frame {
        position: relative;
        display: flex; flex-direction: column; align-items: center;
        padding: clamp(14px, 2.5vh, 32px) clamp(24px, 5vw, 80px);
        gap: clamp(6px, 1vh, 14px);
        background: radial-gradient(ellipse at 50% 50%, rgba(0,20,10,0.7) 0%, rgba(0,0,0,0.5) 70%, transparent 100%);
        animation: ssFrameEnter 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
      }

      /* Frame corners (L-shaped brackets) */
      .ss-frame-corner {
        position: absolute;
        width: clamp(16px, 2.5vw, 36px); height: clamp(16px, 2.5vw, 36px);
        border-color: rgba(0,255,136,0.5);
        border-style: solid;
        border-width: 0;
      }
      .ss-fc-tl { top: 0; left: 0; border-top-width: 2px; border-left-width: 2px; }
      .ss-fc-tr { top: 0; right: 0; border-top-width: 2px; border-right-width: 2px; }
      .ss-fc-bl { bottom: 0; left: 0; border-bottom-width: 2px; border-left-width: 2px; }
      .ss-fc-br { bottom: 0; right: 0; border-bottom-width: 2px; border-right-width: 2px; }

      /* Frame edges (thin lines between corners) */
      .ss-frame-edge { position: absolute; background: rgba(0,255,136,0.15); }
      .ss-fe-top    { top: 0; left: clamp(16px, 2.5vw, 36px); right: clamp(16px, 2.5vw, 36px); height: 1px; }
      .ss-fe-bottom { bottom: 0; left: clamp(16px, 2.5vw, 36px); right: clamp(16px, 2.5vw, 36px); height: 1px; }
      .ss-fe-left   { left: 0; top: clamp(16px, 2.5vw, 36px); bottom: clamp(16px, 2.5vw, 36px); width: 1px; }
      .ss-fe-right  { right: 0; top: clamp(16px, 2.5vw, 36px); bottom: clamp(16px, 2.5vw, 36px); width: 1px; }

      /* Frame inner glow */
      .ss-frame-glow {
        position: absolute; inset: 2px;
        border-radius: 2px;
        box-shadow: inset 0 0 40px rgba(0,255,136,0.06), inset 0 0 80px rgba(0,255,136,0.03);
        pointer-events: none;
        animation: ssFrameGlow 4s ease-in-out infinite;
      }

      /* ═══ TOP ACCENT BAR ═══ */
      .ss-top-bar {
        display: flex; align-items: center; gap: clamp(6px, 1vw, 14px);
        animation: ssSubEnter 0.6s ease-out 0.3s both;
      }
      .ss-bar-line {
        flex: 1 1 clamp(16px, 4vw, 60px);
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(0,255,136,0.35), transparent);
      }
      .ss-bar-diamond {
        font-size: clamp(5px, 0.6vw, 9px);
        color: rgba(0,255,136,0.5);
      }
      .ss-bar-text {
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(5px, 0.65vw, 10px);
        font-weight: 500;
        color: rgba(255,255,255,0.35);
        letter-spacing: clamp(2px, 0.4vw, 6px);
        white-space: nowrap;
      }

      /* ═══ MAIN TITLE ═══ */
      .ss-title-wrap {
        display: flex; align-items: center; gap: 0;
        animation: ssTitleEnter 1.0s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both;
      }
      .ss-title-block {
        display: flex; align-items: center; gap: clamp(10px, 1.5vw, 24px);
      }
      .ss-title {
        display: flex; flex-direction: column; align-items: center;
        gap: clamp(0px, 0.3vh, 4px);
        margin: 0;
      }
      .ss-title-top {
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(32px, 7vw, 100px);
        font-weight: 900;
        letter-spacing: clamp(4px, 1vw, 18px);
        color: #fff;
        text-shadow:
          0 0 4px #fff,
          0 0 12px #fff,
          0 0 24px rgba(0,255,136,0.9),
          0 0 50px rgba(0,255,136,0.65),
          0 0 90px rgba(0,255,136,0.35),
          0 0 140px rgba(0,255,136,0.15),
          0 3px 0 rgba(0,0,0,0.9);
        line-height: 1;
        animation: ssNeonPulse 3s ease-in-out infinite;
      }
      .ss-title-mid {
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(18px, 3.8vw, 56px);
        font-weight: 700;
        letter-spacing: clamp(6px, 1.4vw, 24px);
        color: #fff;
        text-shadow:
          0 0 4px #fff,
          0 0 10px rgba(255,255,255,0.8),
          0 0 20px rgba(0,255,136,0.7),
          0 0 40px rgba(0,255,136,0.4),
          0 0 70px rgba(0,255,136,0.2),
          0 2px 0 rgba(0,0,0,0.9);
        line-height: 1;
        animation: ssNeonPulse 3s ease-in-out 0.5s infinite;
      }

      /* Lightning bolts */
      .ss-bolt {
        font-size: clamp(24px, 4.5vw, 64px);
        color: #00ff88;
        filter: drop-shadow(0 0 10px #00ff88) drop-shadow(0 0 24px rgba(0,255,136,0.5));
        animation: ssBoltPulse 2.5s ease-in-out infinite;
      }
      .ss-bolt-right { animation-delay: 0.3s; }

      /* Speed lines */
      .ss-speed-line {
        height: 2px;
        flex: 0 0 clamp(24px, 8vw, 120px);
        box-shadow: 0 0 8px rgba(0,255,136,0.4);
        animation: ssLineExtend 0.9s ease-out 0.6s both;
      }
      .ss-sl-left { background: linear-gradient(90deg, transparent, #00ff88); }
      .ss-sl-right { background: linear-gradient(90deg, #00ff88, transparent); }

      /* ═══ SUBTITLE ═══ */
      .ss-subtitle-wrap {
        display: flex; align-items: center;
        gap: clamp(8px, 1.2vw, 18px);
        animation: ssSubEnter 0.7s ease-out 0.5s both;
      }
      .ss-subtitle {
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(9px, 1.6vw, 24px);
        font-weight: 500;
        letter-spacing: clamp(3px, 0.9vw, 16px);
        margin: 0;
        color: rgba(0,255,136,0.9);
        text-shadow:
          0 0 6px rgba(0,255,136,0.6),
          0 0 18px rgba(0,255,136,0.3),
          0 1px 0 rgba(0,0,0,0.8);
        animation: ssSubGlow 3s ease-in-out 0.5s infinite;
      }
      .ss-sub-wing {
        display: block;
        width: clamp(20px, 5vw, 70px);
        height: 1px;
        position: relative;
      }
      .ss-sub-wing::before {
        content: '';
        position: absolute; inset: 0;
        background: linear-gradient(90deg, transparent, rgba(0,255,136,0.5));
      }
      .ss-sub-wing::after {
        content: '';
        position: absolute;
        top: -2px; height: 5px;
        width: 5px; border-radius: 50%;
        background: #00ff88;
        box-shadow: 0 0 6px #00ff88;
      }
      .ss-sw-left::before { background: linear-gradient(90deg, transparent, rgba(0,255,136,0.5)); }
      .ss-sw-left::after { right: 0; }
      .ss-sw-right::before { background: linear-gradient(90deg, rgba(0,255,136,0.5), transparent); }
      .ss-sw-right::after { left: 0; }

      /* ═══ BOTTOM ACCENT BAR ═══ */
      .ss-bottom-bar {
        display: flex; align-items: center; gap: clamp(6px, 0.8vw, 12px);
        width: clamp(60px, 16vw, 200px);
        animation: ssSubEnter 0.7s ease-out 0.7s both;
      }
      .ss-bottom-bar .ss-bar-line { flex: 1; }
      .ss-bottom-bar .ss-bar-diamond { font-size: clamp(4px, 0.5vw, 8px); }

      /* ═══ ANIMATIONS ═══ */
      @keyframes ssFrameEnter {
        0% { opacity: 0; transform: scale(0.92); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes ssFrameGlow {
        0%, 100% { box-shadow: inset 0 0 40px rgba(0,255,136,0.06), inset 0 0 80px rgba(0,255,136,0.03); }
        50%      { box-shadow: inset 0 0 50px rgba(0,255,136,0.10), inset 0 0 100px rgba(0,255,136,0.05); }
      }
      @keyframes ssTitleEnter {
        0% {
          transform: scale(0.6) translateY(-16px);
          opacity: 0;
          filter: brightness(3.5) blur(6px);
        }
        35% {
          filter: brightness(2.2) blur(1px);
          opacity: 1;
        }
        100% {
          transform: scale(1) translateY(0);
          filter: brightness(1) blur(0);
        }
      }
      @keyframes ssSubEnter {
        from { transform: translateY(12px); opacity: 0; }
        to   { transform: translateY(0); opacity: 1; }
      }
      @keyframes ssLineExtend {
        from { flex-basis: 0; opacity: 0; }
        to   { flex-basis: clamp(24px, 8vw, 120px); opacity: 1; }
      }
      @keyframes ssNeonPulse {
        0%, 100% {
          text-shadow:
            0 0 4px #fff, 0 0 12px #fff,
            0 0 24px rgba(0,255,136,0.9), 0 0 50px rgba(0,255,136,0.65),
            0 0 90px rgba(0,255,136,0.35), 0 0 140px rgba(0,255,136,0.15),
            0 3px 0 rgba(0,0,0,0.9);
        }
        50% {
          text-shadow:
            0 0 6px #fff, 0 0 16px #fff,
            0 0 32px rgba(0,255,136,1), 0 0 64px rgba(0,255,136,0.8),
            0 0 110px rgba(0,255,136,0.5), 0 0 160px rgba(0,255,136,0.2),
            0 3px 0 rgba(0,0,0,0.9);
        }
      }
      @keyframes ssSubGlow {
        0%, 100% { text-shadow: 0 0 6px rgba(0,255,136,0.6), 0 0 18px rgba(0,255,136,0.3); }
        50%      { text-shadow: 0 0 12px rgba(0,255,136,0.8), 0 0 28px rgba(0,255,136,0.45); }
      }
      @keyframes ssBoltPulse {
        0%, 100% {
          filter: drop-shadow(0 0 10px #00ff88) drop-shadow(0 0 24px rgba(0,255,136,0.5));
          transform: scale(1);
        }
        50% {
          filter: drop-shadow(0 0 16px #00ff88) drop-shadow(0 0 36px rgba(0,255,136,0.7));
          transform: scale(1.1);
        }
      }

      @keyframes ssFlash {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.25; }
      }

      /* ═══ ICT LOGO (bottom-right) ═══ */
      .ss-ict-logo {
        position: absolute; z-index: 2;
        right: clamp(12px, 2vw, 36px);
        bottom: clamp(12px, 2vh, 36px);
        width: clamp(50px, 7vw, 110px);
        height: auto;
        opacity: 0.85;
        filter: drop-shadow(0 2px 8px rgba(0,0,0,0.6));
        pointer-events: none;
      }

      /* ═══ EOH LOGO (bottom-left) ═══ */
      .ss-eoh-logo {
        position: absolute; z-index: 2;
        left: clamp(12px, 2vw, 36px);
        bottom: clamp(12px, 2vh, 36px);
        width: clamp(100px, 14vw, 220px);
        height: auto;
        opacity: 0.85;
        filter: drop-shadow(0 2px 8px rgba(0,0,0,0.6));
        pointer-events: none;
      }

      /* ═══ BOTTOM BLOCK ═══ */
      .ss-bottom {
        position: relative; z-index: 2;
        display: flex; flex-direction: column; align-items: center;
        gap: clamp(10px, 1.5vh, 24px);
        padding-bottom: clamp(24px, 4vh, 64px);
      }

      .ss-prompt {
        font-family: 'Orbitron', sans-serif;
        font-size: clamp(10px, 1.6vw, 24px);
        font-weight: 700;
        letter-spacing: clamp(3px, 0.6vw, 10px);
        color: #fff;
        text-shadow:
          0 0 8px rgba(255,255,255,0.5),
          0 0 20px rgba(0,255,136,0.3),
          0 1px 0 rgba(0,0,0,0.9),
          0 3px 6px rgba(0,0,0,0.7);
        animation: ssFlash 2s ease-in-out infinite;
      }

      .ss-credits {
        display: flex; flex-direction: column; align-items: center;
        gap: clamp(3px, 0.4vh, 8px);
      }
      .ss-license {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: clamp(10px, 0.9vw, 18px);
        font-weight: 400;
        letter-spacing: clamp(0.5px, 0.1vw, 2px);
        color: rgba(255,255,255,0.65);
        text-shadow: 0 1px 4px rgba(0,0,0,0.8);
      }
      .ss-copyright {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: clamp(9px, 0.8vw, 16px);
        font-weight: 300;
        letter-spacing: 0.5px;
        color: rgba(255,255,255,0.45);
        text-shadow: 0 1px 4px rgba(0,0,0,0.8);
      }

      /* ═══ RESPONSIVE ═══ */
      @media (max-width: 600px) {
        .ss-title-top { font-size: clamp(20px, 8vw, 40px); letter-spacing: 3px; }
        .ss-title-mid { font-size: clamp(12px, 5vw, 24px); letter-spacing: 4px; }
        .ss-subtitle { font-size: clamp(7px, 2.2vw, 14px); letter-spacing: 3px; }
        .ss-bolt { font-size: clamp(16px, 5vw, 32px); }
        .ss-speed-line { display: none; }
        .ss-top-bar { display: none; }
        .ss-frame { padding: clamp(12px, 2vh, 20px) clamp(16px, 4vw, 40px); }
      }
    `;
    document.head.appendChild(style);

    // Universal input — any click, key, touch, or gamepad triggers start
    this._started = false;
    this._inputLocked = true; // locked until 1s after show()
    this._promptEl = this.el.querySelector('.ss-prompt');
    this._promptEl.style.opacity = '0';
    this._promptEl.style.transition = 'opacity 0.5s ease';

    const triggerStart = () => {
      if (this._started || this._inputLocked || this.el.style.display === 'none') return;
      this._started = true;
      onStart();
    };

    this.el.addEventListener('click', triggerStart);
    this.el.addEventListener('touchstart', (e) => { e.preventDefault(); triggerStart(); });

    this._keyHandler = (e) => {
      if (this.el.style.display === 'none' || this._inputLocked) return;
      triggerStart();
    };
    window.addEventListener('keydown', this._keyHandler);

    // Gamepad polling — only respond to newly pressed buttons (edge detection)
    this._gamepadPoll = null;
    this._prevBtnState = new Map(); // track previous pressed state per button
    const pollGamepad = () => {
      if (this._started || this.el.style.display === 'none') {
        this._gamepadPoll = null;
        return;
      }
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const gp of gamepads) {
        if (!gp) continue;
        for (let i = 0; i < gp.buttons.length; i++) {
          const key = gp.index + ':' + i;
          const wasPressed = this._prevBtnState.get(key) || false;
          const isPressed = gp.buttons[i].pressed;
          this._prevBtnState.set(key, isPressed);
          // Only trigger on rising edge (newly pressed, not held)
          if (isPressed && !wasPressed) { triggerStart(); return; }
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
    this._inputLocked = true;
    this._prevBtnState.clear();
    this._promptEl.style.opacity = '0';

    // Unlock input and reveal prompt after 1 second
    clearTimeout(this._unlockTimer);
    this._unlockTimer = setTimeout(() => {
      this._inputLocked = false;
      this._promptEl.style.opacity = '1';
    }, 1000);

    if (this._startGamepadPoll) this._startGamepadPoll();
    if (longFade) {
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
