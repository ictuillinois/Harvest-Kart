import { Tween, Easing } from '@tweenjs/tween.js';
import { tweenGroup } from '../utils/tweenGroup.js';

/**
 * Cinematic game completion sequence.
 *
 * Timeline:
 *   T+0.0  Lock controls, auto-drive at max speed, flash lamps to tier 4.
 *   T+0.5  Stop plate spawning.
 *   T+1.0  Camera pulls back + up over 3s.
 *   T+2.0  "ENERGY HARVESTED" rolls up from bottom.
 *   T+5.0  Text fades out. Car keeps driving (no deceleration).
 *   T+6.0  Fade to black overlay (car still moving behind it).
 *   T+7.5  Black opaque → transition to win screen.
 */
export class CompletionSequence {
  constructor(opts) {
    this._opts = opts;
    this._timers = [];
    this._overlay = null;
    this._textEl = null;
  }

  start() {
    const {
      camera, controls, hud, normalCam,
      lampPosts, plates, gameState,
      playFinalPowerOn, stopEngine, onComplete,
    } = this._opts;

    // ── T+0: lock controls, auto-drive, tier 4 flash ──
    controls.lock();
    lampPosts.setTier(4, true);
    lampPosts.flash();
    playFinalPowerOn();

    // Auto-drive at max speed — car keeps going throughout the sequence
    gameState.speed = 100;

    // ── T+0.5: stop spawning plates ──
    this._at(500, () => {
      plates.setSpawnRate(999);
    });

    // ── T+1.0: camera pullback ──
    this._at(1000, () => {
      new Tween(camera.position, tweenGroup)
        .to({ y: normalCam.y + 5, z: normalCam.z + 8 }, 3000)
        .easing(Easing.Quadratic.InOut)
        .start();
    });

    // ── T+2.0: "ENERGY HARVESTED" roll-up ──
    this._at(2000, () => {
      this._showMissionText();
    });

    // ── T+5.0: fade text — car keeps driving (NO deceleration) ──
    this._at(5000, () => {
      if (this._textEl) this._textEl.classList.add('fade');
    });

    // ── T+5.5: remove text ──
    this._at(5500, () => {
      if (this._textEl) { this._textEl.remove(); this._textEl = null; }
    });

    // ── T+6.0: fade to black (car still moving behind overlay) ──
    this._at(6000, () => {
      this._overlay = document.createElement('div');
      Object.assign(this._overlay.style, {
        position: 'fixed', inset: '0',
        background: '#000', zIndex: '200',
        opacity: '0',
        transition: 'opacity 1.2s ease',
      });
      document.body.appendChild(this._overlay);
      void this._overlay.offsetWidth;
      this._overlay.style.opacity = '1';

      // Stop engine audio during fade
      stopEngine();
    });

    // ── T+7.5: transition to win screen ──
    this._at(7500, () => {
      gameState.speed = 0;
      onComplete();
      this._at(300, () => {
        if (this._overlay) { this._overlay.remove(); this._overlay = null; }
      });
    });
  }

  _at(ms, fn) {
    this._timers.push(setTimeout(fn, ms));
  }

  _showMissionText() {
    if (!document.getElementById('completion-styles')) {
      const style = document.createElement('style');
      style.id = 'completion-styles';
      style.textContent = `
        #mission-text {
          position: fixed; inset: 0; z-index: 160;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 8px;
          pointer-events: none;
        }
        .mission-line {
          font-family: 'Orbitron', 'Impact', sans-serif;
          color: #FFD700;
          letter-spacing: 0.12em;
          -webkit-text-stroke: 2px rgba(0,0,0,0.5);
          text-shadow:
            0 0 30px #FFD700,
            0 0 60px #FFA500,
            0 0 100px rgba(255,165,0,0.3);
          animation: missionPop 0.7s ease-out both;
        }
        .mission-w1 {
          font-size: clamp(50px, 10vw, 120px);
          animation-delay: 0s;
        }
        .mission-w2 {
          font-size: clamp(36px, 7vw, 90px);
          animation-delay: 0.2s;
        }
        @keyframes missionPop {
          0%   { transform: translateY(60px); opacity: 0; }
          65%  { transform: translateY(-4px); opacity: 1; }
          100% { transform: translateY(0);    opacity: 1; }
        }
        #mission-text.fade .mission-line {
          transition: opacity 0.5s ease;
          opacity: 0;
        }
      `;
      document.head.appendChild(style);
    }

    this._textEl = document.createElement('div');
    this._textEl.id = 'mission-text';
    this._textEl.innerHTML = `
      <div class="mission-line mission-w1">ENERGY</div>
      <div class="mission-line mission-w2">HARVESTED</div>
    `;
    document.body.appendChild(this._textEl);
  }

  cancel() {
    this._timers.forEach(clearTimeout);
    this._timers = [];
    if (this._overlay) { this._overlay.remove(); this._overlay = null; }
    if (this._textEl)  { this._textEl.remove(); this._textEl = null; }
  }
}
