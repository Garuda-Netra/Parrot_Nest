export function initRipple() {
  document.addEventListener('click', (e: Event) => {
    const target = e.target as HTMLElement;
    const btn = target.closest('.glass-btn, .glass-btn-primary') as HTMLElement;
    
    if (btn) {
      const mouseEvent = e as MouseEvent;
      const rect = btn.getBoundingClientRect();
      const x = mouseEvent.clientX - rect.left;
      const y = mouseEvent.clientY - rect.top;

      const ripple = document.createElement('span');
      ripple.classList.add('ripple');
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${x - size / 2}px`;
      ripple.style.top = `${y - size / 2}px`;

      btn.appendChild(ripple);

      setTimeout(() => {
        ripple.remove();
      }, 600);
    }
  });
}
