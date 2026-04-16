import { escapeHtml } from '../utils/escapeHtml';

interface ConfirmDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'default' | 'danger';
}

let activeDialog: HTMLDivElement | null = null;
let activeDialogDismiss: ((value: boolean) => void) | null = null;

export function confirmDialog(options: ConfirmDialogOptions): Promise<boolean> {
  const {
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    confirmVariant = 'default',
  } = options;

  if (activeDialogDismiss) {
    activeDialogDismiss(false);
  }

  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    activeDialog = overlay;

    const confirmBtnClasses =
      confirmVariant === 'danger'
        ? 'glass-btn border-red-500/40 text-red-300 hover:text-red-200 hover:border-red-400/50'
        : 'glass-btn-primary';

    overlay.className = 'fixed inset-0 z-[1000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4';
    overlay.innerHTML = `
      <div class="glass-card w-full max-w-md border border-white/10 rounded-2xl p-5 md:p-6">
        <h3 class="text-xl font-bold text-white mb-2">${escapeHtml(title)}</h3>
        <p class="text-sm text-gray-300 leading-relaxed mb-5">${escapeHtml(message)}</p>
        <div class="flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
          <button id="confirm-dialog-cancel" type="button" class="glass-btn w-full sm:w-auto px-4 py-2.5 rounded-lg text-sm font-semibold">
            ${escapeHtml(cancelLabel)}
          </button>
          <button id="confirm-dialog-confirm" type="button" class="${confirmBtnClasses} w-full sm:w-auto px-4 py-2.5 rounded-lg text-sm font-semibold">
            ${escapeHtml(confirmLabel)}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const cancelButton = overlay.querySelector<HTMLButtonElement>('#confirm-dialog-cancel');
    const confirmButton = overlay.querySelector<HTMLButtonElement>('#confirm-dialog-confirm');

    let isSettled = false;

    const cleanup = (value: boolean) => {
      if (isSettled) {
        return;
      }
      isSettled = true;

      document.removeEventListener('keydown', onKeyDown);
      overlay.remove();

      if (activeDialog === overlay) {
        activeDialog = null;
        activeDialogDismiss = null;
      }

      resolve(value);
    };

    activeDialogDismiss = cleanup;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        cleanup(false);
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopImmediatePropagation();
        cleanup(true);
      }
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        cleanup(false);
      }
    });

    cancelButton?.addEventListener('click', () => cleanup(false));
    confirmButton?.addEventListener('click', () => cleanup(true));
    document.addEventListener('keydown', onKeyDown);

    requestAnimationFrame(() => {
      confirmButton?.focus();
    });
  });
}
