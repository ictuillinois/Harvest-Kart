export function setupControls(onSwitch) {
  let switching = false;
  const cooldown = 220;
  let _pedalDown = false;

  function triggerSwitch(direction) {
    if (switching) return;
    switching = true;
    onSwitch(direction);
    setTimeout(() => { switching = false; }, cooldown);
  }

  // =================================================================
  //  DOM — arrows (left) + pedal (right)
  // =================================================================
  const container = document.createElement('div');
  container.id = 'game-controls';
  container.innerHTML = `
    <div class="ctrl-group ctrl-arrows">
      <button class="ctrl-btn ctrl-arrow" id="ctrl-left" aria-label="Move left">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <button class="ctrl-btn ctrl-arrow" id="ctrl-right" aria-label="Move right">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 6 15 12 9 18"/>
        </svg>
      </button>
    </div>
    <div class="ctrl-group ctrl-pedal-wrap">
      <button class="ctrl-btn ctrl-pedal" id="ctrl-pedal" aria-label="Accelerate">
        <span class="pedal-label">GAS</span>
      </button>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    #game-controls {
      position: fixed;
      bottom: clamp(14px, 3.5vh, 32px);
      left: 0; right: 0;
      z-index: 60;
      display: none;
      justify-content: space-between;
      align-items: flex-end;
      padding: 0 clamp(12px, 3vw, 28px);
      pointer-events: none;
    }

    .ctrl-group { display: flex; gap: 14px; pointer-events: none; }

    /* ── shared button base ── */
    .ctrl-btn {
      pointer-events: auto;
      border: 2.5px solid rgba(255,255,255,0.35);
      border-radius: 50%;
      background: rgba(0,0,0,0.4);
      color: rgba(255,255,255,0.9);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      touch-action: manipulation;
      transition: background 0.1s, border-color 0.1s, transform 0.1s, box-shadow 0.1s;
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      outline: none;
      padding: 0;
    }

    /* ── arrow buttons ── */
    .ctrl-arrow {
      width: 64px; height: 64px;
    }

    /* ── active state (touch + keyboard) ── */
    .ctrl-btn.active,
    .ctrl-btn:active {
      background: rgba(57,255,20,0.35);
      border-color: #39ff14;
      color: #fff;
      transform: scale(0.9);
      box-shadow: 0 0 18px rgba(57,255,20,0.5), inset 0 0 12px rgba(57,255,20,0.15);
    }

    /* ── pedal button ── */
    .ctrl-pedal {
      width: 72px; height: 72px;
      border-color: rgba(255,180,0,0.5);
      background: rgba(40,20,0,0.5);
    }
    .ctrl-pedal.active,
    .ctrl-pedal:active {
      background: rgba(255,160,0,0.45) !important;
      border-color: #ffaa00 !important;
      box-shadow: 0 0 22px rgba(255,160,0,0.6), inset 0 0 14px rgba(255,160,0,0.2) !important;
      transform: scale(0.88);
    }
    .pedal-label {
      font-family: Impact, 'Arial Black', sans-serif;
      font-size: 0.85rem;
      letter-spacing: 2px;
      font-weight: 700;
      color: rgba(255,220,100,0.95);
      text-shadow: 0 1px 3px rgba(0,0,0,0.5);
    }

    /* ── hover on desktop ── */
    @media (hover: hover) {
      .ctrl-btn:hover:not(.active):not(:active) {
        background: rgba(255,255,255,0.1);
        border-color: rgba(255,255,255,0.55);
      }
    }

    /* ── responsive ── */
    @media (max-width: 500px) {
      .ctrl-arrow { width: 56px; height: 56px; }
      .ctrl-arrow svg { width: 26px; height: 26px; }
      .ctrl-pedal { width: 64px; height: 64px; }
      .ctrl-group { gap: 10px; }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(container);

  const leftBtn = container.querySelector('#ctrl-left');
  const rightBtn = container.querySelector('#ctrl-right');
  const pedalBtn = container.querySelector('#ctrl-pedal');

  // --- Highlight helpers ---
  function flash(btn) {
    btn.classList.add('active');
    setTimeout(() => btn.classList.remove('active'), 150);
  }

  // =================================================================
  //  ARROW EVENTS — pointerdown for instant response
  // =================================================================
  leftBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    flash(leftBtn);
    triggerSwitch('left');
  });
  rightBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    flash(rightBtn);
    triggerSwitch('right');
  });

  // =================================================================
  //  PEDAL EVENTS — hold to accelerate
  // =================================================================
  // Track active pointers on the pedal for multi-touch
  const pedalPointers = new Set();

  function pedalStart(e) {
    e.preventDefault();
    pedalPointers.add(e.pointerId);
    _pedalDown = true;
    pedalBtn.classList.add('active');
    pedalBtn.setPointerCapture(e.pointerId);
  }

  function pedalEnd(e) {
    pedalPointers.delete(e.pointerId);
    if (pedalPointers.size === 0) {
      _pedalDown = false;
      pedalBtn.classList.remove('active');
    }
  }

  pedalBtn.addEventListener('pointerdown', pedalStart);
  pedalBtn.addEventListener('pointerup', pedalEnd);
  pedalBtn.addEventListener('pointercancel', pedalEnd);
  pedalBtn.addEventListener('lostpointercapture', pedalEnd);

  // Prevent context menus
  [leftBtn, rightBtn, pedalBtn].forEach(btn => {
    btn.addEventListener('contextmenu', e => e.preventDefault());
  });

  // =================================================================
  //  KEYBOARD
  // =================================================================
  const keysDown = new Set();

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keysDown.add(e.key);

    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      flash(leftBtn);
      triggerSwitch('left');
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      flash(rightBtn);
      triggerSwitch('right');
    } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
      _pedalDown = true;
      pedalBtn.classList.add('active');
    }
  });

  window.addEventListener('keyup', (e) => {
    keysDown.delete(e.key);
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
      // Only release if no other pedal key is still held
      const pedalKeys = ['ArrowUp', 'w', 'W', ' '];
      if (!pedalKeys.some(k => keysDown.has(k))) {
        _pedalDown = false;
        pedalBtn.classList.remove('active');
      }
    }
  });

  // =================================================================
  //  SWIPE fallback (anywhere on screen except buttons)
  // =================================================================
  let swipeStartX = 0;
  let swipeStartTime = 0;

  window.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.ctrl-btn')) return;
    swipeStartX = e.clientX;
    swipeStartTime = Date.now();
  });

  window.addEventListener('pointerup', (e) => {
    if (e.target.closest('.ctrl-btn')) return;
    const dx = e.clientX - swipeStartX;
    const dt = Date.now() - swipeStartTime;
    if (dt < 500 && Math.abs(dx) > 30) {
      const dir = dx < 0 ? 'left' : 'right';
      flash(dir === 'left' ? leftBtn : rightBtn);
      triggerSwitch(dir);
    }
  });

  // =================================================================
  //  PUBLIC API
  // =================================================================
  return {
    showButtons() { container.style.display = 'flex'; },
    hideButtons() { container.style.display = 'none'; },
    isPedalDown() { return _pedalDown; },
  };
}
