import { Tween, Easing } from '@tweenjs/tween.js';
import { tweenGroup } from '../utils/tweenGroup.js';

/**
 * Race start countdown with horizontal traffic light.
 *
 * Timeline:
 *   T+0.0  Black overlay. Music starts. Controls visible (locked).
 *   T+0.5  Black begins fading out (1.5s). HUD at 0.5 opacity.
 *   T+2.0  Scene fully visible. Camera in high position. Traffic light appears.
 *   T+2.5  Camera tweens down. RED light + "3".
 *   T+3.5  ORANGE light + "2".
 *   T+4.5  AMBER light + "1".
 *   T+5.5  GREEN light + "GO!" — controls unlock, HUD full opacity.
 *   T+6.5  Traffic light + GO fade out. Normal gameplay.
 */
export class RaceStartSequence {
  constructor(opts) {
    this._opts = opts;
    this._timers = [];
    this._overlay = null;
    this._countdownEl = null;
    this._trafficEl = null;
  }

  start() {
    const {
      camera, controls, hud, normalCam,
      playMusic, playCountdownTone, playCountdownRev,
      startEngine, onComplete, existingOverlay,
    } = this._opts;

    // Lock controls during countdown (inputs blocked, but buttons visible)
    controls.lock();
    controls.showButtons();

    // Pre-race camera: higher + further back
    camera.position.y = normalCam.y + 3;
    camera.position.z = normalCam.z + 2;

    // ── Reuse existing loading overlay if provided, otherwise create one ──
    if (existingOverlay) {
      this._overlay = existingOverlay;
      this._overlay.style.zIndex = '200';
      this._overlay.style.opacity = '1';
      this._overlay.style.transition = 'none';
      this._overlay.style.willChange = 'opacity';
      this._overlay.style.contain = 'strict';
      this._overlayReused = true;
    } else {
      this._overlay = document.createElement('div');
      this._overlay.id = 'race-start-overlay';
      Object.assign(this._overlay.style, {
        position: 'fixed', inset: '0',
        background: '#000', zIndex: '200',
        opacity: '1', transition: 'none',
      });
      document.body.appendChild(this._overlay);
      this._overlayReused = false;
    }

    // ── Countdown container (number below traffic light) ──
    this._countdownEl = document.createElement('div');
    this._countdownEl.id = 'countdown-display';
    document.body.appendChild(this._countdownEl);

    // ── Traffic light bar ──
    this._trafficEl = document.createElement('div');
    this._trafficEl.id = 'traffic-lights';
    this._trafficEl.innerHTML = `
      <div class="tl-housing">
        <div class="tl-light" data-color="red">
          <div class="tl-lens"></div>
        </div>
        <div class="tl-light" data-color="orange">
          <div class="tl-lens"></div>
        </div>
        <div class="tl-light" data-color="amber">
          <div class="tl-lens"></div>
        </div>
        <div class="tl-light" data-color="green">
          <div class="tl-lens"></div>
        </div>
      </div>
    `;
    document.body.appendChild(this._trafficEl);

    // ── Inject styles once ──
    if (!document.getElementById('race-start-styles')) {
      const style = document.createElement('style');
      style.id = 'race-start-styles';
      style.textContent = `
        /* ── Countdown number ── */
        #countdown-display {
          position: fixed; inset: 0; z-index: 150;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          pointer-events: none;
          padding-top: clamp(40px, 8vh, 80px);
        }
        .cd-num {
          font-family: 'Orbitron', 'Press Start 2P', monospace;
          font-size: clamp(70px, 14vw, 150px);
          font-weight: 900;
          color: #fff;
          text-shadow:
            0 0 30px rgba(255,255,255,0.6),
            0 0 60px rgba(255,255,255,0.2),
            0 4px 12px rgba(0,0,0,0.8);
          animation: cdPopIn 0.95s ease-out forwards;
        }
        .cd-go {
          font-family: 'Orbitron', 'Press Start 2P', monospace;
          font-size: clamp(80px, 18vw, 180px);
          font-weight: 900;
          color: #00ff88;
          text-shadow:
            0 0 40px #00ff88,
            0 0 80px rgba(0,255,136,0.4),
            0 4px 12px rgba(0,0,0,0.8);
          animation: cdGoIn 0.15s ease-out forwards;
        }
        .cd-go.fade {
          transition: opacity 0.5s ease;
          opacity: 0;
        }
        @keyframes cdPopIn {
          0%   { transform: scale(2.2); opacity: 0; }
          12%  { transform: scale(0.95); opacity: 1; }
          18%  { transform: scale(1.02); opacity: 1; }
          75%  { transform: scale(1.0); opacity: 1; }
          100% { transform: scale(1.2); opacity: 0; }
        }
        @keyframes cdGoIn {
          0%   { transform: scale(2.5); opacity: 0; }
          100% { transform: scale(1.0); opacity: 1; }
        }

        /* ── Traffic light bar ── */
        #traffic-lights {
          position: fixed;
          top: clamp(12%, 15vh, 22%);
          left: 50%; transform: translateX(-50%);
          z-index: 151;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.4s ease;
        }
        #traffic-lights.visible { opacity: 1; }
        #traffic-lights.fade-out {
          opacity: 0;
          transition: opacity 0.6s ease;
        }

        .tl-housing {
          display: flex;
          gap: clamp(6px, 1vw, 14px);
          padding: clamp(8px, 1.2vh, 16px) clamp(14px, 2vw, 28px);
          background: rgba(8, 8, 12, 0.85);
          border: 1.5px solid rgba(255,255,255,0.08);
          border-radius: clamp(10px, 1.5vw, 24px);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          box-shadow:
            0 4px 20px rgba(0,0,0,0.6),
            inset 0 1px 0 rgba(255,255,255,0.05);
        }

        .tl-light {
          position: relative;
          width: clamp(28px, 4.5vw, 56px);
          height: clamp(28px, 4.5vw, 56px);
          border-radius: 50%;
          background: #111118;
          border: 2px solid rgba(255,255,255,0.06);
          display: flex; align-items: center; justify-content: center;
          transition: border-color 0.2s;
        }

        .tl-lens {
          width: 72%;
          height: 72%;
          border-radius: 50%;
          background: rgba(255,255,255,0.03);
          transition: background 0.15s, box-shadow 0.15s;
        }

        /* ── Activated states ── */
        .tl-light[data-color="red"].on .tl-lens {
          background: radial-gradient(circle at 38% 38%, #ff6655 0%, #dd2211 50%, #991100 100%);
          box-shadow: 0 0 12px 4px rgba(255,30,10,0.5), 0 0 30px 8px rgba(255,30,10,0.2);
        }
        .tl-light[data-color="red"].on { border-color: rgba(255,30,10,0.3); }

        .tl-light[data-color="orange"].on .tl-lens {
          background: radial-gradient(circle at 38% 38%, #ffaa44 0%, #ee7711 50%, #cc5500 100%);
          box-shadow: 0 0 12px 4px rgba(255,136,0,0.5), 0 0 30px 8px rgba(255,136,0,0.2);
        }
        .tl-light[data-color="orange"].on { border-color: rgba(255,136,0,0.3); }

        .tl-light[data-color="amber"].on .tl-lens {
          background: radial-gradient(circle at 38% 38%, #ffee55 0%, #ffcc00 50%, #ddaa00 100%);
          box-shadow: 0 0 12px 4px rgba(255,204,0,0.5), 0 0 30px 8px rgba(255,204,0,0.2);
        }
        .tl-light[data-color="amber"].on { border-color: rgba(255,204,0,0.3); }

        .tl-light[data-color="green"].on .tl-lens {
          background: radial-gradient(circle at 38% 38%, #55ffaa 0%, #00ff88 50%, #00cc66 100%);
          box-shadow: 0 0 16px 6px rgba(0,255,136,0.6), 0 0 40px 12px rgba(0,255,136,0.25);
        }
        .tl-light[data-color="green"].on { border-color: rgba(0,255,136,0.35); }

        /* Dimmed state for lights that were previously on */
        .tl-light.dim .tl-lens {
          transition: background 0.4s, box-shadow 0.4s;
        }
        .tl-light[data-color="red"].dim .tl-lens {
          background: radial-gradient(circle at 38% 38%, #662222 0%, #441111 100%);
          box-shadow: 0 0 4px 1px rgba(255,30,10,0.15);
        }
        .tl-light[data-color="orange"].dim .tl-lens {
          background: radial-gradient(circle at 38% 38%, #664422 0%, #442200 100%);
          box-shadow: 0 0 4px 1px rgba(255,136,0,0.15);
        }
        .tl-light[data-color="amber"].dim .tl-lens {
          background: radial-gradient(circle at 38% 38%, #665522 0%, #443300 100%);
          box-shadow: 0 0 4px 1px rgba(255,204,0,0.15);
        }
      `;
      document.head.appendChild(style);
    }

    // HUD semi-transparent during countdown
    hud.el.style.transition = 'none';
    hud.el.style.opacity = '0.5';
    hud.el.style.pointerEvents = 'none';

    // ── Helper: activate a traffic light ──
    const lights = this._trafficEl.querySelectorAll('.tl-light');
    const activateLight = (color) => {
      lights.forEach(l => {
        if (l.classList.contains('on')) {
          l.classList.remove('on');
          l.classList.add('dim');
        }
        if (l.dataset.color === color) {
          l.classList.remove('dim');
          l.classList.add('on');
        }
      });
    };

    // ── T+0.0: start music (skip if already playing from loading screen) ──
    playMusic();

    // ── T+0.5: begin fade out of black overlay (fast fade reduces GPU compositing load) ──
    this._at(500, () => {
      this._overlay.style.transition = 'opacity 0.6s ease-out';
      this._overlay.style.opacity = '0';
      startEngine();
    });

    // ── T+1.2: hide overlay, show traffic light ──
    this._at(1200, () => {
      if (this._overlayReused) {
        this._overlay.style.display = 'none';
        this._overlay.style.pointerEvents = 'none';
      } else {
        this._overlay.remove();
      }
      this._overlay = null;
      this._trafficEl.classList.add('visible');
    });

    // ── T+2.5: camera tween + RED + "3" ──
    this._at(2500, () => {
      new Tween(camera.position, tweenGroup)
        .to({ y: normalCam.y, z: normalCam.z }, 1500)
        .easing(Easing.Quadratic.InOut)
        .start();

      activateLight('red');
      this._showNumber('3');
      playCountdownTone(3);
      playCountdownRev(0.3);
    });

    // ── T+3.5: ORANGE + "2" ──
    this._at(3500, () => {
      activateLight('orange');
      this._showNumber('2');
      playCountdownTone(2);
      playCountdownRev(0.5);
    });

    // ── T+4.5: AMBER + "1" ──
    this._at(4500, () => {
      activateLight('amber');
      this._showNumber('1');
      playCountdownTone(1);
      playCountdownRev(0.7);
    });

    // ── T+5.5: GREEN + "GO!" — unlock controls, HUD full ──
    this._at(5500, () => {
      // All previous lights off, green blazes
      lights.forEach(l => l.classList.remove('on', 'dim'));
      const greenLight = this._trafficEl.querySelector('[data-color="green"]');
      greenLight.classList.add('on');

      this._showGo();
      playCountdownTone(0);
      playCountdownRev(1.0);

      controls.unlock();

      // HUD from 0.5 to full opacity
      hud.el.style.transition = 'opacity 0.4s ease';
      hud.el.style.opacity = '1';
      hud.el.style.pointerEvents = '';

      onComplete();
    });

    // ── T+6.0: fade GO + traffic light ──
    this._at(6000, () => {
      const goEl = this._countdownEl.querySelector('.cd-go');
      if (goEl) goEl.classList.add('fade');
      this._trafficEl.classList.remove('visible');
      this._trafficEl.classList.add('fade-out');
    });

    // ── T+6.8: cleanup ──
    this._at(6800, () => {
      if (this._countdownEl) { this._countdownEl.remove(); this._countdownEl = null; }
      if (this._trafficEl) { this._trafficEl.remove(); this._trafficEl = null; }
    });
  }

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

  cancel() {
    this._timers.forEach(clearTimeout);
    this._timers = [];
    if (this._overlay) { this._overlay.remove(); this._overlay = null; }
    if (this._countdownEl) { this._countdownEl.remove(); this._countdownEl = null; }
    if (this._trafficEl) { this._trafficEl.remove(); this._trafficEl = null; }
  }
}
