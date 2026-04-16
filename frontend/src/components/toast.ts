let toastTimeout: ReturnType<typeof setTimeout> | null = null;
let activeToast: HTMLElement | null = null;

export function showToast(message: string, type: 'success' | 'error' = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  // Clear previous toast if it exists
  if (activeToast) {
    activeToast.remove();
    activeToast = null;
  }

  // Clear pending timeout
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  activeToast = toast;

  const icon = type === 'success' 
    ? `<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`
    : `<svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;

  toast.innerHTML = `
    ${icon}
    <p class="text-xs font-semibold tracking-wide">${message}</p>
  `;

  container.appendChild(toast);

  toastTimeout = setTimeout(() => {
    if (activeToast === toast) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease-out';
      setTimeout(() => {
        if (activeToast === toast) {
          toast.remove();
          activeToast = null;
        }
      }, 300);
    }
  }, 3500);
}
