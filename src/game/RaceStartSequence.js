import { Tween, Easing } from '@tweenjs/tween.js';
import { tweenGroup } from '../utils/tweenGroup.js';

/**
 * Top Gear SNES-inspired race start countdown.
 *
 * Timeline:
 *   T+0.0  Black overlay. Music starts.
 *   T+0.5  Black begins fading out (1.5s).
 *   T+2.0  Scene fully visible. Camera in high position.
 *   T+2.5  Camera tweens down. "3" appears.
 *   T+3.5  "2"
 *   T+4.5  "1"
 *   T+5.5  "GO!" — controls unlock, HUD fades in, onComplete fires.
 *   T+6.5  "GO!" fades out. Normal gameplay.
 */
export class RaceStartSequence {
  /**
   * @param {object} opts
   * @param {THREE.Camera}     opts.camera
   * @param {object}           opts.controls   — return value of setupControls()
   * @param {import('../ui/HUD.js').HUD} opts.hud
   * @param {{ y: number, z: number }} opts.normalCam — resting camera pos
   * @param {() => void}       opts.playMusic  — call to start theme music
   * @param {(step: number) => void} opts.playCountdownTone
   * @param {(intensity: number) => void} opts.playCountdownRev
   * @param {() => void}       opts.startEngine — start idle engine sound
   * @param {() => void}       opts.onComplete — called when player gains control
   */
  constructor(opts) {
    this._opts = opts;
    this._timers = [];
    this._overlay = null;
    this._countdownEl = null;
  }

  start() {
    const {
      camera, controls, hud, normalCam,
      playMusic, playCountdownTone, playCountdownRev,
      startEngine, onComplete,
    } = this._opts;

    // Lock controls during countdown
    controls.lock();

    // Pre-race camera: higher + further back
    camera.position.y = normalCam.y + 3;
    camera.position.z = normalCam.z + 2;

    // ── Black overlay ──
    this._overlay = document.createElement('div');
    this._overlay.id = 'race-start-overlay';
    Object.assign(this._overlay.style, {
      position: 'fixed', inset: '0',
      background: '#000', zIndex: '200',
      opacity: '1',
      transition: 'none',
    });
    document.body.appendChild(this._overlay);

    // ── Countdown container ──
    this._countdownEl = document.createElement('div');
    this._countdownEl.id = 'countdown-display';
    document.body.appendChild(this._countdownEl);

    // Inject styles once
    if (!document.getElementById('race-start-styles')) {
      const style = document.createElement('style');
      style.id = 'race-start-styles';
      style.textContent = `
        #countdown-display {
          position: fixed; inset: 0; z-index: 150;
          display: flex; align-items: center; justify-content: center;
          pointer-events: none;
        }
        .cd-num {
          font-family: 'Press Start 2P', monospace;
          font-size: clamp(80px, 15vw, 160px);
          color: #fff;
          -webkit-text-stroke: 3px #000;
          text-shadow: 0 0 20px rgba(255,255,255,0.5),
                       0 0 40px rgba(255,255,255,0.25);
          animation: cdPopIn 1.0s ease-out forwards;
        }
        .cd-go {
          font-family: 'Press Start 2P', monospace;
          font-size: clamp(100px, 20vw, 200px);
          color: #00FF66;
          -webkit-text-stroke: 3px #000;
          text-shadow: 0 0 30px #00FF66, 0 0 60px rgba(0,255,102,0.4);
          animation: cdGoIn 0.15s ease-out forwards;
        }
        .cd-go.fade {
          transition: opacity 0.5s ease;
          opacity: 0;
        }
        @keyframes cdPopIn {
          0%   { transform: scale(2.0); opacity: 0; }
          15%  { transform: scale(1.0); opacity: 1; }
          75%  { transform: scale(1.0); opacity: 1; }
          100% { transform: scale(1.3); opacity: 0; }
        }
        @keyframes cdGoIn {
          0%   { transform: scale(2.0); opacity: 0; }
          100% { transform: scale(1.0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    // HUD hidden during countdown
    hud.el.style.opacity = '0';
    hud.el.style.pointerEvents = 'none';

    // ── T+0.0: start music ──
    playMusic();

    // ── T+0.5: begin fade out of black overlay ──
    this._at(500, () => {
      this._overlay.style.transition = 'opacity 1.5s ease-in-out';
      this._overlay.style.opacity = '0';
      startEngine();
    });

    // ── T+2.0: remove overlay from DOM ──
    this._at(2000, () => {
      this._overlay.remove();
      this._overlay = null;
    });

    // ── T+2.5: camera tween + countdown "3" ──
    this._at(2500, () => {
      new Tween(camera.position, tweenGroup)
        .to({ y: normalCam.y, z: normalCam.z }, 1500)
        .easing(Easing.Quadratic.InOut)
        .start();

      this._showNumber('3');
      playCountdownTone(3);
      playCountdownRev(0.3);
    });

    // ── T+3.5: "2" ──
    this._at(3500, () => {
      this._showNumber('2');
      playCountdownTone(2);
      playCountdownRev(0.5);
    });

    // ── T+4.5: "1" ──
    this._at(4500, () => {
      this._showNumber('1');
      playCountdownTone(1);
      playCountdownRev(0.7);
    });

    // ── T+5.5: "GO!" — unlock controls, show HUD ──
    this._at(5500, () => {
      this._showGo();
      playCountdownTone(0);
      playCountdownRev(1.0);

      controls.unlock();
      controls.showButtons();

      // Fade HUD in
      hud.el.style.transition = 'opacity 0.4s ease';
      hud.el.style.opacity = '1';
      hud.el.style.pointerEvents = '';

      onComplete();
    });

    // ── T+6.0: fade GO ──
    this._at(6000, () => {
      const goEl = this._countdownEl.querySelector('.cd-go');
      if (goEl) goEl.classList.add('fade');
    });

    // ── T+6.5: cleanup ──
    this._at(6500, () => {
      if (this._countdownEl) {
        this._countdownEl.remove();
        this._countdownEl = null;
      }
    });
  }

  /** Schedule a callback at ms after start. */
  _at(ms, fn) {
    this._timers.push(setTimeout(fn, ms));
  }

  _showNumber(text) {
    if (!this._countdownEl) return;
    this._countdownEl.innerHTML = `<span class="cd-num">${text}</span>`;
  }

  _showGo() {
    if (!this._countdownEl) return;
    this._countdownEl.innerHTML = `<span class="cd-go">GO!</span>`;
  }

  /** Cancel the sequence early (e.g., user quits during countdown). */
  cancel() {
    this._timers.forEach(clearTimeout);
    this._timers = [];
    if (this._overlay) { this._overlay.remove(); this._overlay = null; }
    if (this._countdownEl) { this._countdownEl.remove(); this._countdownEl = null; }
  }
}
