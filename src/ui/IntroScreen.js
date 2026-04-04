import { asset, gameRoot } from '../utils/base.js';

export class IntroScreen {
  constructor() {
    this.el = document.createElement('div');
    this.el.id = 'intro-screen';
    this.el.innerHTML = `
      <img id="intro-logo" src="${asset('ICT-Logo.png')}" alt="ICT Logo" draggable="false" />
      <p id="intro-presents">PRESENTS</p>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #intro-screen {
        position: fixed; inset: 0; z-index: 500;
        background: #000;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        gap: 28px;
        /* pointer-events left on so any touch during the intro counts as a
           user gesture, allowing the browser to unblock audio autoplay */
      }

      #intro-logo {
        width: 140px;
        max-width: 27%;
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
        font-size: 18px;
        font-weight: 300;
        letter-spacing: 10px;
        text-transform: uppercase;
        transition: opacity 0.7s ease;
      }
    `;
    document.head.appendChild(style);
    gameRoot().appendChild(this.el);
  }

  /** Plays the full intro sequence. Returns a Promise that resolves when done. */
  run() {
    return new Promise(resolve => {
      const logo     = this.el.querySelector('#intro-logo');
      const presents = this.el.querySelector('#intro-presents');

      // 1400ms — logo and "PRESENTS" fade in together
      setTimeout(() => { logo.style.opacity = '1'; }, 1400);
      setTimeout(() => { presents.style.opacity = '1'; }, 1400);

      // 6000ms — intro screen fades out
      setTimeout(() => {
        this.el.style.transition = 'opacity 0.9s ease';
        this.el.style.opacity = '0';
      }, 6000);

      // 6900ms — done; caller shows start screen
      setTimeout(() => {
        this.el.remove();
        resolve();
      }, 6900);
    });
  }
}
