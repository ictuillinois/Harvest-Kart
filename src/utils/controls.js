export function setupControls(onSwitch) {
  let switching = false;
  const cooldown = 220;

  function triggerSwitch(direction) {
    if (switching) return;
    switching = true;
    onSwitch(direction);
    setTimeout(() => { switching = false; }, cooldown);
  }

  // === ON-SCREEN ARROW BUTTONS ===
  const btnContainer = document.createElement('div');
  btnContainer.id = 'game-controls';
  btnContainer.innerHTML = `
    <button class="ctrl-btn" id="ctrl-left" aria-label="Move left">
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>
    <button class="ctrl-btn" id="ctrl-right" aria-label="Move right">
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="9 6 15 12 9 18"/>
      </svg>
    </button>
  `;

  const style = document.createElement('style');
  style.textContent = `
    /* ── container: centered at bottom ── */
    #game-controls {
      position: fixed;
      bottom: clamp(16px, 4vh, 36px);
      left: 50%; transform: translateX(-50%);
      z-index: 60;
      display: none;
      gap: 28px;
      pointer-events: none;
    }

    /* ── arrow buttons ── */
    .ctrl-btn {
      pointer-events: auto;
      width: 68px; height: 68px;
      border: 2.5px solid rgba(255,255,255,0.4);
      border-radius: 50%;
      background: rgba(0,0,0,0.4);
      color: rgba(255,255,255,0.9);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      touch-action: manipulation;
      transition: background 0.12s, border-color 0.12s, transform 0.1s, box-shadow 0.12s;
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      outline: none;
      padding: 0;
    }

    /* ── highlight state (press + keyboard) ── */
    .ctrl-btn.active,
    .ctrl-btn:active {
      background: rgba(57,255,20,0.35);
      border-color: #39ff14;
      color: #fff;
      transform: scale(0.9);
      box-shadow: 0 0 18px rgba(57,255,20,0.5), inset 0 0 12px rgba(57,255,20,0.15);
    }

    /* ── hover on desktop ── */
    @media (hover: hover) {
      .ctrl-btn:hover:not(.active):not(:active) {
        background: rgba(255,255,255,0.12);
        border-color: rgba(255,255,255,0.6);
      }
    }

    /* ── slightly larger on smaller screens ── */
    @media (max-width: 600px) {
      .ctrl-btn { width: 62px; height: 62px; }
      .ctrl-btn svg { width: 28px; height: 28px; }
      #game-controls { gap: 24px; }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(btnContainer);

  const leftBtn = btnContainer.querySelector('#ctrl-left');
  const rightBtn = btnContainer.querySelector('#ctrl-right');

  // --- Highlight helpers ---
  function flash(btn) {
    btn.classList.add('active');
    setTimeout(() => btn.classList.remove('active'), 150);
  }

  // --- Keyboard ---
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
      flash(leftBtn);
      triggerSwitch('left');
    } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
      flash(rightBtn);
      triggerSwitch('right');
    }
  });

  // --- Touch / Pointer on buttons ---
  leftBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    flash(leftBtn);
    triggerSwitch('left');
  });
  rightBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    flash(rightBtn);
    triggerSwitch('right');
  });

  // Prevent context menu on long press
  leftBtn.addEventListener('contextmenu', e => e.preventDefault());
  rightBtn.addEventListener('contextmenu', e => e.preventDefault());

  // --- Swipe fallback (anywhere on screen) ---
  let pointerStartX = 0;
  let pointerStartTime = 0;

  window.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.ctrl-btn')) return;
    pointerStartX = e.clientX;
    pointerStartTime = Date.now();
  });

  window.addEventListener('pointerup', (e) => {
    if (e.target.closest('.ctrl-btn')) return;
    const dx = e.clientX - pointerStartX;
    const dt = Date.now() - pointerStartTime;
    if (dt < 500 && Math.abs(dx) > 30) {
      const dir = dx < 0 ? 'left' : 'right';
      flash(dir === 'left' ? leftBtn : rightBtn);
      triggerSwitch(dir);
    }
  });

  return {
    showButtons() { btnContainer.style.display = 'flex'; },
    hideButtons() { btnContainer.style.display = 'none'; },
  };
}
