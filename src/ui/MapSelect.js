import { MAP_THEMES } from '../utils/constants.js';

export class MapSelect {
  constructor(onSelect, onBack) {
    this.el = document.createElement('div');
    this.el.id = 'map-select';
    this.activeIndex = -1;

    // Theme-specific accent colors for the highlight ring
    const accents = {
      brazil: '#ffaa33',
      usa: '#6677ff',
      peru: '#44bb55',
    };

    const cards = MAP_THEMES.map((m, i) => `
      <div class="ms-card" data-index="${i}" style="--accent:${accents[m.id]}">
        <div class="ms-preview" data-theme="${m.id}">
          <div class="ms-scene ms-scene-${m.id}"></div>
        </div>
        <div class="ms-flag-row">
          <img class="ms-flag" src="${m.flag}" alt="${m.name} flag" draggable="false" />
          <span class="ms-country">${m.name}</span>
        </div>
        <div class="ms-info">
          <div class="ms-subtitle">${m.subtitle}</div>
          <div class="ms-desc">${m.description}</div>
          <ul class="ms-features">
            ${m.features.map(f => `<li>${f}</li>`).join('')}
          </ul>
          <div class="ms-go">TAP TO RACE</div>
        </div>
      </div>
    `).join('');

    this.el.innerHTML = `
      <div class="ms-backdrop"></div>
      <div class="ms-content">
        <button class="nav-back" id="ms-back" aria-label="Back">&#9664; BACK</button>
        <h2 class="ms-title">SELECT A MAP</h2>
        <div class="ms-cards">${cards}</div>
      </div>
    `;

    document.body.appendChild(this.el);

    const style = document.createElement('style');
    style.textContent = `
      /* ── Fullscreen overlay ── */
      #map-select {
        position: fixed; inset: 0; z-index: 100;
        display: none; align-items: center; justify-content: center;
        font-family: 'Segoe UI', Tahoma, sans-serif;
      }

      /* ── Backdrop ── */
      .ms-backdrop {
        position: absolute; inset: 0;
        background: linear-gradient(135deg, #0a0520 0%, #0d1a2e 50%, #1a0a3a 100%);
      }
      .ms-backdrop::before {
        content: ''; position: absolute; inset: 0;
        background:
          radial-gradient(ellipse at 30% 60%, rgba(255,170,50,0.05) 0%, transparent 50%),
          radial-gradient(ellipse at 70% 40%, rgba(100,120,255,0.05) 0%, transparent 50%);
      }

      /* ── Content ── */
      .ms-content {
        position: relative; z-index: 1;
        text-align: center; padding: 20px;
        width: 100%; max-width: 820px;
      }

      .ms-title {
        font-family: Impact, 'Arial Black', sans-serif;
        font-size: clamp(1.6rem, 5vw, 2.5rem);
        color: #fff; letter-spacing: 4px;
        margin-bottom: clamp(16px, 3vh, 32px);
        text-shadow: 0 0 30px rgba(57,255,20,0.3), 0 2px 4px rgba(0,0,0,0.5);
      }

      /* ── Cards row ── */
      .ms-cards {
        display: flex; justify-content: center;
        gap: clamp(10px, 2.5vw, 22px);
        align-items: flex-start;
      }

      /* ── Card ── */
      .ms-card {
        display: flex; flex-direction: column; align-items: center;
        cursor: pointer;
        padding: 12px 10px 16px;
        border-radius: 18px;
        background: rgba(255,255,255,0.04);
        border: 2px solid rgba(255,255,255,0.1);
        transition: transform 0.3s ease, border-color 0.3s, background 0.3s, box-shadow 0.3s, opacity 0.3s, filter 0.3s;
        width: clamp(150px, 28vw, 230px);
        user-select: none;
      }

      .ms-card.dimmed {
        opacity: 0.35;
        filter: grayscale(0.6) brightness(0.7);
        transform: scale(0.92);
      }

      .ms-card.active {
        background: rgba(255,255,255,0.08);
        border-color: var(--accent, #39ff14);
        transform: translateY(-10px) scale(1.05);
        box-shadow:
          0 0 28px color-mix(in srgb, var(--accent, #39ff14) 35%, transparent),
          0 10px 35px rgba(0,0,0,0.4);
      }

      /* ── Preview box (mini-scene) ── */
      .ms-preview {
        width: 100%;
        aspect-ratio: 16 / 10;
        border-radius: 12px;
        overflow: hidden;
        position: relative;
        margin-bottom: 10px;
        transition: box-shadow 0.3s;
      }
      .ms-card.active .ms-preview {
        box-shadow: inset 0 0 20px rgba(0,0,0,0.3);
      }

      /* ── Flag + country name row ── */
      .ms-flag-row {
        display: flex; align-items: center; gap: 8px;
        margin-bottom: 4px;
      }
      .ms-flag {
        width: 32px; height: auto;
        border-radius: 3px;
        border: 1px solid rgba(255,255,255,0.2);
        box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      }
      .ms-country {
        font-family: Impact, 'Arial Black', sans-serif;
        font-size: clamp(1rem, 2.2vw, 1.2rem);
        color: #fff; letter-spacing: 2px;
      }

      /* ── Info (hidden until active) ── */
      .ms-info {
        max-height: 0; overflow: hidden; opacity: 0;
        transition: max-height 0.35s ease, opacity 0.3s ease, margin 0.3s;
        margin-top: 0;
      }
      .ms-card.active .ms-info {
        max-height: 180px; opacity: 1; margin-top: 8px;
      }

      .ms-subtitle {
        font-size: clamp(0.75rem, 1.5vw, 0.88rem);
        color: var(--accent, #ffaa33);
        font-weight: 700; letter-spacing: 1px;
        margin-bottom: 4px;
      }
      .ms-desc {
        font-size: clamp(0.68rem, 1.3vw, 0.78rem);
        color: rgba(255,255,255,0.5);
        font-style: italic;
        margin-bottom: 8px;
      }
      .ms-features {
        list-style: none; padding: 0; margin: 0 0 10px;
        display: flex; flex-direction: column; gap: 3px;
      }
      .ms-features li {
        font-size: 0.7rem; color: rgba(255,255,255,0.6);
        display: flex; align-items: center; gap: 6px;
      }
      .ms-features li::before {
        content: '\\2022'; color: var(--accent, #39ff14);
        font-size: 0.9rem;
      }

      .ms-go {
        font-family: Impact, 'Arial Black', sans-serif;
        font-size: 0.75rem; letter-spacing: 3px;
        color: #39ff14;
        text-shadow: 0 0 8px rgba(57,255,20,0.4);
        animation: msPulse 1.5s ease-in-out infinite;
      }
      @keyframes msPulse {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.4; }
      }

      /* ══════════════════════════════════════════
         MINI-SCENE ILLUSTRATIONS (CSS art)
         ══════════════════════════════════════════ */
      .ms-scene { position: absolute; inset: 0; overflow: hidden; }

      /* ── BRAZIL ── */
      .ms-scene-brazil {
        background: linear-gradient(180deg, #1e90ff 0%, #ff9933 55%, #ffe4b5 80%, #f4d99a 100%);
      }
      .ms-scene-brazil::before {
        content: ''; position: absolute;
        width: 28px; height: 28px; background: #ffcc33;
        border-radius: 50%; top: 12%; right: 14%;
        box-shadow: 0 0 18px 6px rgba(255,204,50,0.5);
      }
      .ms-scene-brazil::after {
        content: ''; position: absolute;
        bottom: 0; left: 0; right: 0; height: 22%;
        background: linear-gradient(180deg, rgba(30,144,255,0.3) 0%, rgba(30,144,255,0.6) 100%);
        border-radius: 60% 60% 0 0 / 100% 100% 0 0;
      }
      .ms-scene-brazil .ms-palm {
        position: absolute; bottom: 22%; width: 3px; background: #8B6914;
      }
      .ms-scene-brazil .ms-palm::after {
        content: ''; position: absolute; top: -6px; left: -9px;
        width: 22px; height: 10px; background: #228B22;
        border-radius: 50% 50% 0 0;
      }
      .ms-scene-brazil .p1 { left: 10%; height: 38%; }
      .ms-scene-brazil .p2 { right: 8%; height: 30%; }
      .ms-scene-brazil .p3 { left: 42%; height: 26%; }
      .ms-scene-brazil .ms-bldg {
        position: absolute; bottom: 20%; border-radius: 2px 2px 0 0;
      }
      .ms-scene-brazil .b1 { left: 22%; width: 14%; height: 28%; background: #ffccaa; }
      .ms-scene-brazil .b2 { left: 38%; width: 12%; height: 20%; background: #ffddbb; }
      .ms-scene-brazil .b3 { right: 22%; width: 16%; height: 24%; background: #ff9966; }

      /* ── USA ── */
      .ms-scene-usa {
        background: linear-gradient(180deg, #0a0a2e 0%, #1a1a4e 50%, #2a1a3e 85%, #1a1a1a 100%);
      }
      .ms-scene-usa::before {
        content: ''; position: absolute;
        width: 14px; height: 14px; background: #eeeeff;
        border-radius: 50%; top: 10%; right: 18%;
        box-shadow: 0 0 12px 4px rgba(200,200,255,0.3);
      }
      .ms-scene-usa .ms-tower {
        position: absolute; bottom: 0; border-radius: 2px 2px 0 0;
        background: repeating-linear-gradient(
          0deg, transparent, transparent 5px,
          rgba(255,204,100,0.25) 5px, rgba(255,204,100,0.25) 7px
        );
      }
      .ms-scene-usa .t1 { left: 6%; width: 14%; height: 72%; background-color: #1a1a3e; }
      .ms-scene-usa .t2 { left: 22%; width: 18%; height: 85%; background-color: #222244; }
      .ms-scene-usa .t3 { left: 42%; width: 12%; height: 62%; background-color: #1a1a3e; }
      .ms-scene-usa .t4 { right: 15%; width: 20%; height: 78%; background-color: #252548; }
      .ms-scene-usa .t5 { right: 4%; width: 10%; height: 50%; background-color: #2a2a55; }
      .ms-scene-usa .ms-neon {
        position: absolute; height: 3px; border-radius: 1px;
      }
      .ms-scene-usa .n1 { bottom: 32%; left: 8%; width: 18%; background: #ff00ff; box-shadow: 0 0 6px #ff00ff; }
      .ms-scene-usa .n2 { bottom: 45%; right: 10%; width: 14%; background: #00ffff; box-shadow: 0 0 6px #00ffff; }
      .ms-scene-usa .ms-road {
        position: absolute; bottom: 0; left: 0; right: 0; height: 14%;
        background: #222;
      }
      .ms-scene-usa .ms-road::after {
        content: ''; position: absolute; top: 45%;
        left: 5%; right: 5%; height: 2px;
        background: repeating-linear-gradient(90deg, #ffcc44 0%, #ffcc44 12px, transparent 12px, transparent 24px);
      }

      /* ── PERU ── */
      .ms-scene-peru {
        background: linear-gradient(180deg, #4488cc 0%, #88ccee 35%, #aaddaa 65%, #5a8a3a 100%);
      }
      .ms-scene-peru .ms-mtn {
        position: absolute; bottom: 25%; width: 0; height: 0;
        border-left: solid transparent; border-right: solid transparent;
      }
      .ms-scene-peru .mt1 { left: 3%; border-width: 0 28px 55px; border-bottom-color: #556B2F; }
      .ms-scene-peru .mt2 { left: 25%; border-width: 0 35px 72px; border-bottom-color: #4a7a3a; }
      .ms-scene-peru .mt3 { right: 10%; border-width: 0 30px 50px; border-bottom-color: #6B8E23; }
      .ms-scene-peru .mt2::after {
        content: ''; position: absolute; top: -8px; left: -12px;
        border-left: 12px solid transparent; border-right: 12px solid transparent;
        border-bottom: 10px solid #fff;
      }
      .ms-scene-peru .ms-hill {
        position: absolute; bottom: 0; left: 0; right: 0;
        height: 28%; background: #5a8a3a;
        border-radius: 50% 50% 0 0 / 80% 80% 0 0;
      }
      .ms-scene-peru .ms-hill2 {
        position: absolute; bottom: 0; left: 0; right: 0;
        height: 16%; background: #4a7a2a;
      }
      .ms-scene-peru .ms-cloud {
        position: absolute; background: rgba(255,255,255,0.7);
        border-radius: 10px; height: 8px;
      }
      .ms-scene-peru .c1 { top: 14%; left: 12%; width: 22%; }
      .ms-scene-peru .c2 { top: 22%; right: 10%; width: 16%; }
      .ms-scene-peru .ms-terrace {
        position: absolute; bottom: 16%; right: 20%;
      }
      .ms-scene-peru .ms-terrace span {
        display: block; background: #8B7355; margin-bottom: 1px;
      }
      .ms-scene-peru .ms-terrace span:nth-child(1) { width: 20px; height: 4px; }
      .ms-scene-peru .ms-terrace span:nth-child(2) { width: 16px; height: 4px; }
      .ms-scene-peru .ms-terrace span:nth-child(3) { width: 12px; height: 4px; }

      /* ── Hover ── */
      @media (hover: hover) {
        .ms-card:hover:not(.active):not(.dimmed) {
          border-color: rgba(255,255,255,0.25);
          background: rgba(255,255,255,0.06);
        }
      }

      /* ── Responsive ── */
      @media (max-width: 500px) {
        .ms-cards { gap: 6px; }
        .ms-card { padding: 8px 6px 12px; border-radius: 12px; }
        .ms-flag { width: 24px; }
      }
    `;
    document.head.appendChild(style);

    // --- Build richer mini-scene DOM ---
    const brazilScene = this.el.querySelector('.ms-scene-brazil');
    if (brazilScene) {
      brazilScene.innerHTML = `
        <div class="ms-palm p1"></div>
        <div class="ms-palm p2"></div>
        <div class="ms-palm p3"></div>
        <div class="ms-bldg b1"></div>
        <div class="ms-bldg b2"></div>
        <div class="ms-bldg b3"></div>
      `;
    }

    const usaScene = this.el.querySelector('.ms-scene-usa');
    if (usaScene) {
      usaScene.innerHTML = `
        <div class="ms-tower t1"></div>
        <div class="ms-tower t2"></div>
        <div class="ms-tower t3"></div>
        <div class="ms-tower t4"></div>
        <div class="ms-tower t5"></div>
        <div class="ms-neon n1"></div>
        <div class="ms-neon n2"></div>
        <div class="ms-road"></div>
      `;
    }

    const peruScene = this.el.querySelector('.ms-scene-peru');
    if (peruScene) {
      peruScene.innerHTML = `
        <div class="ms-cloud c1"></div>
        <div class="ms-cloud c2"></div>
        <div class="ms-mtn mt1"></div>
        <div class="ms-mtn mt2"></div>
        <div class="ms-mtn mt3"></div>
        <div class="ms-hill"></div>
        <div class="ms-hill2"></div>
        <div class="ms-terrace"><span></span><span></span><span></span></div>
      `;
    }

    // --- Interaction: highlight → then select ---
    const cardEls = this.el.querySelectorAll('.ms-card');

    const setActive = (index) => {
      this.activeIndex = index;
      cardEls.forEach((card, i) => {
        card.classList.remove('active', 'dimmed');
        if (index === -1) return;
        if (i === index) card.classList.add('active');
        else card.classList.add('dimmed');
      });
    };

    cardEls.forEach((card) => {
      const idx = parseInt(card.dataset.index);
      card.addEventListener('click', () => {
        if (this.activeIndex === idx) {
          onSelect(idx);
        } else {
          setActive(idx);
        }
      });
    });

    this.el.querySelector('#ms-back').addEventListener('click', () => onBack());
  }

  show() {
    this.activeIndex = -1;
    this.el.querySelectorAll('.ms-card').forEach(c => c.classList.remove('active', 'dimmed'));
    this.el.style.display = 'flex';
  }

  hide() { this.el.style.display = 'none'; }
}
