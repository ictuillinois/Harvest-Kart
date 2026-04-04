const DURATION = 380; // ms — fast enough to feel snappy, slow enough to read as smooth

/**
 * Fade an element in. Sets display, forces a reflow, then transitions opacity 0 → 1.
 * @param {HTMLElement} el
 * @param {string} [display='flex']
 */
export function fadeIn(el, display = 'flex') {
  el.style.transition = '';
  el.style.opacity = '0';
  el.style.display = display;
  void el.offsetWidth; // force reflow so the transition fires from 0
  el.style.transition = `opacity ${DURATION}ms ease`;
  el.style.opacity = '1';
}

/**
 * Fade an element out, then set display:none once the transition completes.
 * No-ops if the element is already hidden.
 * @param {HTMLElement} el
 */
export function fadeOut(el) {
  // If never explicitly shown or already hidden, just ensure it's gone.
  if (!el.style.display || el.style.display === 'none') {
    el.style.display = 'none';
    return;
  }
  el.style.pointerEvents = 'none';
  el.style.transition = `opacity ${DURATION}ms ease`;
  el.style.opacity = '0';
  setTimeout(() => {
    el.style.display = 'none';
    el.style.transition = '';
    el.style.opacity = '';
    el.style.pointerEvents = '';
  }, DURATION);
}
