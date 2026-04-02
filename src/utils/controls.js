export function setupControls(onSwitch) {
  let switching = false;
  let cooldown = 250; // ms

  function triggerSwitch(direction) {
    if (switching) return;
    switching = true;
    onSwitch(direction);
    setTimeout(() => { switching = false; }, cooldown);
  }

  // Keyboard
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') triggerSwitch('left');
    else if (e.key === 'ArrowRight') triggerSwitch('right');
  });

  // Touch / Pointer swipe
  let pointerStartX = 0;
  let pointerStartTime = 0;
  const SWIPE_THRESHOLD = 30;

  window.addEventListener('pointerdown', (e) => {
    pointerStartX = e.clientX;
    pointerStartTime = Date.now();
  });

  window.addEventListener('pointerup', (e) => {
    const dx = e.clientX - pointerStartX;
    const dt = Date.now() - pointerStartTime;
    if (dt < 500 && Math.abs(dx) > SWIPE_THRESHOLD) {
      triggerSwitch(dx < 0 ? 'left' : 'right');
    }
  });
}
