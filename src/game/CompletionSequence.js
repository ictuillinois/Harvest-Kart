import { Tween, Easing } from '@tweenjs/tween.js';
import { tweenGroup } from '../utils/tweenGroup.js';

/**
 * Cinematic game completion sequence.
 *
 * Timeline (from the moment the 40th plate fills the bar):
 *   T+0.0  Lock controls, auto-drive max speed, flash lamps to tier 4.
 *   T+0.5  Stop plate spawning.
 *   T+1.0  Camera pulls back + up over 3s.
 *   T+2.0  "MISSION ACCOMPLISHED" rolls up from bottom.
 *   T+5.0  Text fades out. Speed decelerates. Engine fades.
 *   T+6.0  Fade to black overlay.
 *   T+7.0  Black opaque → show win screen.
 */
export class CompletionSequence {
  /**
   * @param {object} opts
   * @param {THREE.Camera}     opts.camera
   * @param {object}           opts.controls
   * @param {import('../ui/HUD.js').HUD} opts.hud
   * @param {{ y: number, z: number }} opts.normalCam
   * @param {import('./LampPost.js').LampPost} opts.lampPosts
   * @param {import('./Plate.js').Plate}       opts.plates
   * @param {import('./GameState.js').GameState} opts.gameState
   * @param {() => void}       opts.playFinalPowerOn
   * @param {() => void}       opts.stopEngine
   * @param {() => void}       opts.onComplete  — show win screen
   */
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

    // Auto-drive at max speed — main.js game loop reads gameState.speed
    gameState.speed = 45; // MAX_SPEED

    // ── T+0.5: stop spawning plates ──
    this._at(500, () => {
      plates.setSpawnRate(999); // effectively stops spawning
    });

    // ── T+1.0: camera pullback ──
    this._at(1000, () => {
      new Tween(camera.position, tweenGroup)
        .to({ y: normalCam.y + 5, z: normalCam.z + 8 }, 3000)
        .easing(Easing.Quadratic.InOut)
        .start();
    });

    // ── T+2.0: "MISSION ACCOMPLISHED" roll-up ──
    this._at(2000, () => {
      this._showMissionText();
    });

    // ── T+5.0: fade text, begin deceleration ──
    this._at(5000, () => {
      if (this._textEl) this._textEl.classList.add('fade');

      // Decelerate to 0 over 1.5s
      new Tween(gameState, tweenGroup)
        .to({ speed: 0 }, 1500)
        .easing(Easing.Quadratic.Out)
        .start();

      // Fade engine
      stopEngine();
    });

    // ── T+5.5: remove text ──
    this._at(5500, () => {
      if (this._textEl) { this._textEl.remove(); this._textEl = null; }
    });

    // ── T+6.0: fade to black ──
    this._at(6000, () => {
      this._overlay = document.createElement('div');
      Object.assign(this._overlay.style, {
        position: 'fixed', inset: '0',
        background: '#000', zIndex: '200',
        opacity: '0',
        transition: 'opacity 1s ease',
      });
      document.body.appendChild(this._overlay);
      void this._overlay.offsetWidth;
      this._overlay.style.opacity = '1';
    });

    // ── T+7.0: transition to win screen ──
    this._at(7000, () => {
      onComplete();
      // Clean up overlay after win screen shows
      this._at(200, () => {
        if (this._overlay) { this._overlay.remove(); this._overlay = null; }
      });
    });
  }

  _at(ms, fn) {
    this._timers.push(setTimeout(fn, ms));
  }

  _showMissionText() {
    // Inject styles once
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
          font-family: 'Press Start 2P', monospace;
          color: #FFD700;
          letter-spacing: 0.12em;
          -webkit-text-stroke: 3px rgba(0,0,0,0.6);
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
      <div class="mission-line mission-w1">MISSION</div>
      <div class="mission-line mission-w2">ACCOMPLISHED</div>
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
