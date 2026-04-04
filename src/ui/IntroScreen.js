import { asset, gameRoot } from '../utils/base.js';

export class IntroScreen {
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'intro-screen';

    // Phase 1: EOH, Phase 2: ICT
    this.el.innerHTML = `
      <div id="intro-phase1" class="intro-phase">
        <p id="intro-event-title">Engineering Open House</p>
        <img id="intro-eoh-logo" src="${asset('eoh.svg')}" alt="Engineering Open House" draggable="false" />
        <p id="intro-tagline">FORGING THE FUTURE</p>
        <p id="intro-dates">April 10th &amp; April 11th, 2026</p>
      </div>
      <div id="intro-phase2" class="intro-phase">
        <p id="intro-ict-title">In Association with</p>
        <img id="intro-logo" src="${asset('ICT-Logo.png')}" alt="ICT Logo" draggable="false" />
        <p id="intro-presents">PRESENTS</p>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #intro-screen {
        position: fixed; inset: 0; z-index: 500;
        background: #000;
        /* pointer-events left on so any touch during the intro counts as a
           user gesture, allowing the browser to unblock audio autoplay */
      }

      .intro-phase {
        position: absolute; inset: 0;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        opacity: 0;
        transition: opacity 0.9s ease;
      }

      /* ── Phase 1: EOH ── */
      #intro-phase1 { gap: clamp(2px, 0.4vh, 8px); }

      /* ── Phase 2: ICT Logo ── */
      #intro-phase2 { gap: clamp(16px, 3vh, 40px); }

      #intro-ict-title {
        margin: 0;
        opacity: 0;
        color: #fff;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: clamp(12px, 1.6vw, 32px);
        font-weight: 300;
        letter-spacing: clamp(3px, 0.5vw, 10px);
        text-transform: uppercase;
        transition: opacity 0.8s ease;
      }

      #intro-logo {
        width: clamp(100px, 14vw, 280px);
        opacity: 0;
        transition: opacity 1.1s ease;
        user-select: none;
        pointer-events: none;
      }

      #intro-presents {
        margin: 0;
        opacity: 0;
        color: #fff;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: clamp(14px, 1.8vw, 36px);
        font-weight: 300;
        letter-spacing: clamp(6px, 1vw, 16px);
        text-transform: uppercase;
        transition: opacity 0.7s ease;
      }

      #intro-event-title {
        margin: 0;
        opacity: 0;
        color: #fff;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: clamp(14px, 2vw, 40px);
        font-weight: 300;
        letter-spacing: clamp(4px, 0.6vw, 12px);
        text-transform: uppercase;
        transition: opacity 0.8s ease;
      }

      #intro-eoh-logo {
        width: clamp(200px, 32vw, 700px);
        max-height: 55vh;
        object-fit: contain;
        opacity: 0;
        transition: opacity 1s ease;
        user-select: none;
        pointer-events: none;
      }

      #intro-tagline {
        margin: clamp(2px, 0.4vh, 8px) 0 0;
        opacity: 0;
        font-family: 'Press Start 2P', 'Impact', sans-serif;
        font-size: clamp(14px, 2.5vw, 52px);
        font-weight: 900;
        letter-spacing: clamp(4px, 0.5vw, 12px);
        text-transform: uppercase;
        color: #7b2ff2;
        -webkit-text-stroke: 1.2px rgba(255, 255, 255, 0.85);
        text-shadow:
          0 0 12px rgba(123, 47, 242, 0.6),
          0 0 30px rgba(123, 47, 242, 0.3);
        transition: opacity 0.8s ease;
      }

      #intro-dates {
        margin: clamp(2px, 0.4vh, 8px) 0 0;
        opacity: 0;
        color: rgba(255, 255, 255, 0.8);
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: clamp(10px, 1.2vw, 26px);
        font-weight: 300;
        letter-spacing: clamp(3px, 0.4vw, 8px);
        transition: opacity 0.7s ease 0.2s;
      }
    `;
    document.head.appendChild(style);
    gameRoot().appendChild(this.el);
  }

  /** Plays the full intro sequence. Returns a Promise that resolves when done. */
  run() {
    return new Promise(resolve => {
      const phase1      = this.el.querySelector('#intro-phase1');
      const eventTitle  = this.el.querySelector('#intro-event-title');
      const eohLogo     = this.el.querySelector('#intro-eoh-logo');
      const tagline     = this.el.querySelector('#intro-tagline');
      const dates       = this.el.querySelector('#intro-dates');

      const phase2   = this.el.querySelector('#intro-phase2');
      const ictTitle = this.el.querySelector('#intro-ict-title');
      const logo     = this.el.querySelector('#intro-logo');
      const presents = this.el.querySelector('#intro-presents');

      // ── Phase 1: EOH ──

      // 0ms — show phase 1 container
      phase1.style.opacity = '1';

      // 1300ms — stagger EOH elements in
      setTimeout(() => { eohLogo.style.opacity = '1'; }, 1300);
      setTimeout(() => { eventTitle.style.opacity = '1'; }, 1500);
      setTimeout(() => { tagline.style.opacity = '1'; }, 2000);
      setTimeout(() => { dates.style.opacity = '1'; }, 2300);

      // 6000ms — phase 1 fades out
      setTimeout(() => { phase1.style.opacity = '0'; }, 6000);

      // ── Phase 2: ICT logo ──

      // 7000ms — show phase 2, stagger elements in
      setTimeout(() => { phase2.style.opacity = '1'; }, 7000);
      setTimeout(() => { ictTitle.style.opacity = '1'; }, 7300);
      setTimeout(() => { logo.style.opacity = '1'; }, 7500);
      setTimeout(() => { presents.style.opacity = '1'; }, 7500);

      // 11500ms — whole screen fades out
      setTimeout(() => {
        this.el.style.transition = 'opacity 0.9s ease';
        this.el.style.opacity = '0';
      }, 11500);

      // 12400ms — done; caller shows start screen
      setTimeout(() => {
        this.el.remove();
        resolve();
      }, 12400);
    });
  }
}
