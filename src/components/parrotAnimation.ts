/**
 * ParrotAnimation — brings the hero parrot to life with
 * subtle body sway and occasional feather adjustment.
 *
 * All animations use CSS custom properties and classes so the
 * visual details stay in the stylesheet.
 */

export function initParrotAnimation(): void {
  const parrotEl = document.getElementById('parrot-alive') as HTMLElement | null;
  if (!parrotEl) return;

  const bodyEl = parrotEl.querySelector('.parrot-body') as HTMLElement | null;

  // ── Subtle body sway (micro-rotation) ──────────────
  function scheduleBodyAdjust() {
    const next = 4000 + Math.random() * 6000; // 4–10s
    setTimeout(() => {
      if (bodyEl) {
        // Random micro-rotation between -2 and +2 degrees
        const angle = (Math.random() - 0.5) * 4; // ± 2°
        const shiftX = (Math.random() - 0.5) * 3; // ± 1.5px
        bodyEl.style.transform = `rotate(${angle}deg) translateX(${shiftX}px)`;

        // Return to neutral after 1.2s
        setTimeout(() => {
          bodyEl.style.transform = 'rotate(0deg) translateX(0px)';
        }, 1200);
      }
      scheduleBodyAdjust();
    }, next);
  }
  scheduleBodyAdjust();

  // ── Occasional highlight shimmer ───────────────────
  function scheduleShimmer() {
    const next = 6000 + Math.random() * 8000; // 6–14s
    setTimeout(() => {
      parrotEl!.classList.add('shimmer-active');
      setTimeout(() => parrotEl!.classList.remove('shimmer-active'), 1800);
      scheduleShimmer();
    }, next);
  }
  scheduleShimmer();
}
