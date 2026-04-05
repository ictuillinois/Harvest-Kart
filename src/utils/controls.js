export function setupControls(onSwitch, onRelease) {
  let switching = false;
  const cooldown = 220;
  let _pedalDown = false;
  let _locked = false;
  let _leftHeld = false;
  let _rightHeld = false;

  function triggerSwitch(direction) {
    if (_locked) return;
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
        <svg viewBox="0 0 24 24" width="50%" height="50%" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <button class="ctrl-btn ctrl-arrow" id="ctrl-right" aria-label="Move right">
        <svg viewBox="0 0 24 24" width="50%" height="50%" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 6 15 12 9 18"/>
        </svg>
      </button>
    </div>
    <div class="ctrl-group ctrl-pedal-wrap">
      <button class="ctrl-btn ctrl-pedal" id="ctrl-pedal" aria-label="Accelerate">
        <svg class="pedal-icon" viewBox="0 0 24 24" width="40%" height="40%" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 15 12 9 18 15"/>
        </svg>
        <span class="pedal-label">GAS</span>
      </button>
    </div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    #game-controls {
      position: fixed;
      bottom: clamp(10px, 1.5vh, 28px);
      left: 50%;
      transform: translateX(-50%);
      width: clamp(280px, 45vw, 700px);
      z-index: 60;
      display: none;
      justify-content: space-between;
      align-items: flex-end;
      pointer-events: none;
    }

    .ctrl-group { display: flex; gap: clamp(8px, 1vw, 20px); pointer-events: none; }

    /* ── shared button base ── */
    .ctrl-btn {
      pointer-events: auto;
      border: 1.5px solid var(--hud-border, rgba(0,255,136,0.2));
      border-radius: clamp(12px, 1.5vw, 20px);
      background: var(--hud-bg, rgba(10,10,15,0.6));
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      color: rgba(255,255,255,0.85);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      touch-action: manipulation;
      transition: background 0.12s, border-color 0.12s, transform 0.12s, box-shadow 0.12s;
      outline: none;
      padding: 0;
      box-shadow: 0 0 8px rgba(0,255,136,0.08);
    }

    .ctrl-arrow {
      width: clamp(52px, 7vw, 100px);
      height: clamp(52px, 7vw, 100px);
    }

    /* ── active state ── */
    .ctrl-btn.active,
    .ctrl-btn:active {
      background: rgba(0,255,136,0.15);
      border-color: var(--hud-accent, #00ff88);
      color: #fff;
      transform: scale(0.92);
      box-shadow: 0 0 18px rgba(0,255,136,0.4), inset 0 0 10px rgba(0,255,136,0.1);
    }

    /* ── pedal button ── */
    .ctrl-pedal {
      width: clamp(60px, 9vw, 116px);
      height: clamp(60px, 9vw, 116px);
      border-radius: 50%;
      border-color: rgba(0,255,136,0.3);
      background: radial-gradient(circle at center, rgba(0,255,136,0.15) 0%, rgba(10,10,15,0.7) 70%);
    }
    .ctrl-pedal:not(.active):not(.touched) {
      animation: pedalGlow 2s ease-in-out infinite;
    }
    @keyframes pedalGlow {
      0%, 100% { border-color: rgba(0,255,136,0.2); box-shadow: 0 0 8px rgba(0,255,136,0.08); }
      50%      { border-color: rgba(0,255,136,0.5); box-shadow: 0 0 18px rgba(0,255,136,0.25); }
    }
    .ctrl-pedal.active,
    .ctrl-pedal:active {
      background: radial-gradient(circle at center, rgba(0,255,136,0.35) 0%, rgba(10,10,15,0.7) 70%);
      border-color: var(--hud-accent, #00ff88) !important;
      box-shadow: 0 0 24px rgba(0,255,136,0.5), inset 0 0 16px rgba(0,255,136,0.15) !important;
      transform: scale(0.9);
      animation: none;
    }
    .pedal-label {
      font-family: 'Orbitron', 'Courier New', monospace;
      font-size: clamp(5px, 0.5vw, 9px);
      font-weight: 700;
      letter-spacing: 2px;
      color: rgba(0,255,136,0.6);
      margin-top: 2px;
    }

    /* ── focus accessibility ── */
    .ctrl-btn:focus-visible {
      outline: 2px solid var(--hud-accent, #00ff88);
      outline-offset: 4px;
    }

    /* ── hover on desktop ── */
    @media (hover: hover) {
      .ctrl-btn:hover:not(.active):not(:active) {
        background: rgba(255,255,255,0.06);
        border-color: rgba(0,255,136,0.35);
      }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(container);

  const leftBtn = container.querySelector('#ctrl-left');
  const rightBtn = container.querySelector('#ctrl-right');
  const pedalBtn = container.querySelector('#ctrl-pedal');

  // =================================================================
  //  Pointer events — lane switches (arrows)
  // =================================================================
  leftBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    leftBtn.classList.add('active');
    _leftHeld = true;
    triggerSwitch('left');
  });
  leftBtn.addEventListener('pointerup', () => {
    leftBtn.classList.remove('active');
    _leftHeld = false;
    if (onRelease) onRelease();
  });
  leftBtn.addEventListener('pointerleave', () => {
    leftBtn.classList.remove('active');
    _leftHeld = false;
    if (onRelease) onRelease();
  });

  rightBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    rightBtn.classList.add('active');
    _rightHeld = true;
    triggerSwitch('right');
  });
  rightBtn.addEventListener('pointerup', () => {
    rightBtn.classList.remove('active');
    _rightHeld = false;
    if (onRelease) onRelease();
  });
  rightBtn.addEventListener('pointerleave', () => {
    rightBtn.classList.remove('active');
    _rightHeld = false;
    if (onRelease) onRelease();
  });

  // =================================================================
  //  Pointer events — pedal (hold to accelerate)
  // =================================================================
  const pedalPointers = new Set();

  function pedalStart(e) {
    e.preventDefault();
    pedalPointers.add(e.pointerId);
    _pedalDown = true;
    pedalBtn.classList.add('active', 'touched');
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

  // =================================================================
  //  Keyboard input (desktop fallback)
  // =================================================================
  const keysDown = new Set();

  window.addEventListener('keydown', (e) => {
    if (_locked) return;
    if (keysDown.has(e.key)) return;
    keysDown.add(e.key);

    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      leftBtn.classList.add('active');
      _leftHeld = true;
      triggerSwitch('left');
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      rightBtn.classList.add('active');
      _rightHeld = true;
      triggerSwitch('right');
    }
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
      _pedalDown = true;
      pedalBtn.classList.add('active');
    }
  });

  window.addEventListener('keyup', (e) => {
    keysDown.delete(e.key);

    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      leftBtn.classList.remove('active');
      _leftHeld = false;
      if (onRelease) onRelease();
    }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      rightBtn.classList.remove('active');
      _rightHeld = false;
      if (onRelease) onRelease();
    }
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') {
      if (!keysDown.has('ArrowUp') && !keysDown.has('w') && !keysDown.has('W') && !keysDown.has(' ')) {
        _pedalDown = false;
        pedalBtn.classList.remove('active');
      }
    }
  });

  // =================================================================
  //  Swipe fallback — anywhere on screen (except buttons)
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
      const btn = dir === 'left' ? leftBtn : rightBtn;
      btn.classList.add('active');
      triggerSwitch(dir);
      setTimeout(() => btn.classList.remove('active'), 150);
    }
  });

  // =================================================================
  //  Prevent long-press context menu on buttons
  // =================================================================
  container.addEventListener('contextmenu', (e) => e.preventDefault());

  // =================================================================
  //  Public API
  // =================================================================
  return {
    showButtons() {
      container.style.display = 'flex';
      pedalBtn.classList.remove('touched');
    },
    hideButtons() { container.style.display = 'none'; },
    isPedalDown() { return !_locked && _pedalDown; },
    isLeftHeld()  { return !_locked && _leftHeld; },
    isRightHeld() { return !_locked && _rightHeld; },
    lock()   { _locked = true; },
    unlock() { _locked = false; },
  };
}
