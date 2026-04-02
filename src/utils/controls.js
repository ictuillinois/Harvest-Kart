export function setupControls(onSwitch) {
  let switching = false;
  const cooldown = 250;

  function triggerSwitch(direction) {
    if (switching) return;
    switching = true;
    onSwitch(direction);
    setTimeout(() => { switching = false; }, cooldown);
  }

  // Keyboard
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') triggerSwitch('left');
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') triggerSwitch('right');
  });

  // Touch / Pointer swipe
  let pointerStartX = 0;
  let pointerStartTime = 0;
  const SWIPE_THRESHOLD = 30;

  window.addEventListener('pointerdown', (e) => {
    // Ignore if tapping on-screen buttons
    if (e.target.closest('.ctrl-btn')) return;
    pointerStartX = e.clientX;
    pointerStartTime = Date.now();
  });

  window.addEventListener('pointerup', (e) => {
    if (e.target.closest('.ctrl-btn')) return;
    const dx = e.clientX - pointerStartX;
    const dt = Date.now() - pointerStartTime;
    if (dt < 500 && Math.abs(dx) > SWIPE_THRESHOLD) {
      triggerSwitch(dx < 0 ? 'left' : 'right');
    }
  });

  // === ON-SCREEN ARROW BUTTONS ===
  const btnContainer = document.createElement('div');
  btnContainer.id = 'mobile-controls';
  btnContainer.innerHTML = `
    <button class="ctrl-btn ctrl-left" id="ctrl-left">&#9664;</button>
    <button class="ctrl-btn ctrl-right" id="ctrl-right">&#9654;</button>
  `;
  btnContainer.style.cssText = `
    position: fixed; bottom: 24px; left: 0; right: 0; z-index: 60;
    display: none; justify-content: space-between; padding: 0 20px;
    pointer-events: none;
  `;

  const style = document.createElement('style');
  style.textContent = `
    .ctrl-btn {
      pointer-events: auto;
      width: 72px; height: 72px;
      border: 2px solid rgba(255,255,255,0.35);
      border-radius: 50%;
      background: rgba(0,0,0,0.35);
      color: rgba(255,255,255,0.85);
      font-size: 1.8rem;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      user-select: none;
      -webkit-user-select: none;
      touch-action: manipulation;
      transition: background 0.1s, transform 0.1s;
      backdrop-filter: blur(4px);
    }
    .ctrl-btn:active {
      background: rgba(57,255,20,0.3);
      border-color: #39ff14;
      transform: scale(0.92);
    }
    @media (min-width: 1024px) {
      #mobile-controls { display: none !important; }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(btnContainer);

  // Button press events — use pointerdown for instant response
  const leftBtn = btnContainer.querySelector('#ctrl-left');
  const rightBtn = btnContainer.querySelector('#ctrl-right');

  leftBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    triggerSwitch('left');
  });
  rightBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    triggerSwitch('right');
  });

  // Prevent context menu on long press
  leftBtn.addEventListener('contextmenu', e => e.preventDefault());
  rightBtn.addEventListener('contextmenu', e => e.preventDefault());

  return {
    showButtons() { btnContainer.style.display = 'flex'; },
    hideButtons() { btnContainer.style.display = 'none'; },
  };
}
