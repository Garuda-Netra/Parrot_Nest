import { apiDelete, apiPost } from './api';
import { showToast } from './toast';
import { confirmDialog } from './confirmDialog';
import { escapeHtml } from '../utils/escapeHtml';
import { clearRetrieveResult } from './tabs';

type HistoryItemType = 'clip' | 'url';

interface BaseHistoryItem {
  type: HistoryItemType;
  createdAt: string;
  deleteToken: string;
}

interface ClipHistoryItem extends BaseHistoryItem {
  type: 'clip';
  code: string;
  mode: 'snippet' | 'file' | 'folder';
  expiresAt: string;
  contentPreview: string;
  fileCount: number;
}

interface UrlHistoryItem extends BaseHistoryItem {
  type: 'url';
  shortId: string;
  shortUrl: string;
  originalUrl: string;
  expiresAt?: string;
}

type HistoryItem = ClipHistoryItem | UrlHistoryItem;

const HISTORY_STORAGE_KEY = 'parrot.secret.history.v1';

function readHistory(): HistoryItem[] {
  const raw = sessionStorage.getItem(HISTORY_STORAGE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(items: HistoryItem[]) {
  sessionStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items));
}

function upsertHistoryItem(item: HistoryItem) {
  const current = readHistory();
  const key = item.type === 'clip' ? `clip:${item.code}` : `url:${item.shortId}`;

  const next = [
    item,
    ...current.filter((entry) => {
      const entryKey = entry.type === 'clip' ? `clip:${entry.code}` : `url:${entry.shortId}`;
      return entryKey !== key;
    }),
  ];

  writeHistory(next);
}

function removeHistoryItem(item: HistoryItem) {
  const current = readHistory();
  const next = current.filter((entry) => {
    if (entry.type !== item.type) {
      return true;
    }

    if (item.type === 'clip') {
      return entry.type !== 'clip' || entry.code !== item.code;
    }

    return entry.type !== 'url' || entry.shortId !== item.shortId;
  });

  writeHistory(next);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function getClipSubtitle(item: ClipHistoryItem) {
  if (item.mode === 'snippet') {
    const snippet = item.contentPreview || 'Text clip';
    return `Snippet: ${snippet}`;
  }

  if (item.mode === 'folder') {
    return `Folder upload (${item.fileCount} file${item.fileCount === 1 ? '' : 's'})`;
  }

  return `File upload (${item.fileCount} file${item.fileCount === 1 ? '' : 's'})`;
}

function renderHistoryItems(listEl: HTMLElement, emptyEl: HTMLElement) {
  const items = readHistory().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  const purgeBtn = document.getElementById('btn-purge-all-history') as HTMLButtonElement | null;

  if (items.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    if (purgeBtn) purgeBtn.classList.add('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  if (purgeBtn) {
    purgeBtn.classList.remove('hidden');
    purgeBtn.classList.add('flex');
  }

  listEl.innerHTML = items
    .map((item, index) => {
      if (item.type === 'clip') {
        const subtitle = getClipSubtitle(item);
        return `
          <div class="glass-input bg-white/5 border border-white/10 rounded-xl p-4 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-semibold text-parchment-light">Clip Code: ${escapeHtml(item.code)}</p>
              <p class="text-xs text-gray-400 mt-1 break-words">${escapeHtml(subtitle)}</p>
              <p class="text-[11px] text-gray-500 mt-2">Created: ${escapeHtml(formatDate(item.createdAt))}</p>
              <p class="text-[11px] text-gray-500">Expires: ${escapeHtml(formatDate(item.expiresAt))}</p>
            </div>
            <button data-history-index="${index}" class="history-delete-btn flex-shrink-0 whitespace-nowrap text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors">Delete</button>
          </div>
        `;
      }

      return `
        <div class="glass-input bg-white/5 border border-white/10 rounded-xl p-4 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-parchment-light">Short URL: ${escapeHtml(item.shortId)}</p>
            <p class="text-xs text-gray-400 mt-1 break-words">${escapeHtml(item.shortUrl)}</p>
            <p class="text-[11px] text-gray-500 mt-2 break-words">Target: ${escapeHtml(item.originalUrl)}</p>
            <p class="text-[11px] text-gray-500">Created: ${escapeHtml(formatDate(item.createdAt))}</p>
            ${item.expiresAt ? `<p class="text-[11px] text-gray-500">Self-destruct: ${escapeHtml(formatDate(item.expiresAt))}</p>` : ''}
          </div>
          <button data-history-index="${index}" class="history-delete-btn flex-shrink-0 whitespace-nowrap text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors">Delete</button>
        </div>
      `;
    })
    .join('');

  listEl.querySelectorAll<HTMLButtonElement>('.history-delete-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const index = Number.parseInt(button.dataset.historyIndex || '-1', 10);
      const item = items[index];
      if (!item) {
        return;
      }

      const label = item.type === 'clip' ? `clip ${item.code}` : `short URL ${item.shortId}`;
      const shouldDelete = await confirmDialog({
        title: 'Delete Secret Entry?',
        message: `Delete ${label}? This action cannot be undone.`,
        confirmLabel: 'Delete',
        cancelLabel: 'Cancel',
        confirmVariant: 'danger',
      });
      if (!shouldDelete) {
        return;
      }

      button.disabled = true;
      button.classList.add('opacity-60', 'pointer-events-none');

      try {
        const path = item.type === 'clip' ? `/api/clip/${item.code}` : `/api/url/${item.shortId}`;
        const response = await apiDelete(path, item.deleteToken);

        if (!response.success) {
          const isAlreadyGone = /not found|already deleted|self-destructed|expired/i.test(response.message || '');
          if (isAlreadyGone) {
            removeHistoryItem(item);
            renderHistoryItems(listEl, emptyEl);
            clearRetrieveResult();
            showToast('Entry was already removed. History cleaned up.', 'success');
            return;
          }

          showToast(response.message || 'Delete failed.', 'error');
          button.disabled = false;
          button.classList.remove('opacity-60', 'pointer-events-none');
          return;
        }

        removeHistoryItem(item);
        renderHistoryItems(listEl, emptyEl);
        clearRetrieveResult();
        showToast('Deleted successfully.', 'success');
      } catch {
        showToast('Network error while deleting entry.', 'error');
        button.disabled = false;
        button.classList.remove('opacity-60', 'pointer-events-none');
      }
    });
  });
}

export function recordClipHistory(entry: {
  code: string;
  deleteToken: string;
  expiresAt: string;
  mode: 'snippet' | 'file' | 'folder';
  contentPreview?: string;
  fileCount?: number;
}) {
  if (!entry.code || !entry.deleteToken) {
    return;
  }

  upsertHistoryItem({
    type: 'clip',
    code: entry.code,
    deleteToken: entry.deleteToken,
    createdAt: new Date().toISOString(),
    expiresAt: entry.expiresAt,
    mode: entry.mode,
    contentPreview: (entry.contentPreview || '').slice(0, 120),
    fileCount: entry.fileCount || 0,
  });
}

export function recordUrlHistory(entry: {
  shortId: string;
  shortUrl: string;
  originalUrl: string;
  deleteToken: string;
  expiresAt?: string;
}) {
  if (!entry.shortId || !entry.deleteToken) {
    return;
  }

  upsertHistoryItem({
    type: 'url',
    shortId: entry.shortId,
    shortUrl: entry.shortUrl,
    originalUrl: entry.originalUrl,
    expiresAt: entry.expiresAt,
    deleteToken: entry.deleteToken,
    createdAt: new Date().toISOString(),
  });
}

export function removeClipHistoryByCode(code: string) {
  if (!code) {
    return;
  }

  removeHistoryItem({
    type: 'clip',
    code,
    createdAt: '',
    deleteToken: '',
    mode: 'snippet',
    expiresAt: '',
    contentPreview: '',
    fileCount: 0,
  });
}

export function removeUrlHistoryByContext(context: {
  shortId?: string;
  deleteToken?: string;
  shortUrl?: string;
}) {
  const normalizedShortId = (context.shortId || '').trim();
  const normalizedDeleteToken = (context.deleteToken || '').trim();
  const normalizedShortUrl = (context.shortUrl || '').trim();

  if (!normalizedShortId && !normalizedDeleteToken && !normalizedShortUrl) {
    return;
  }

  const current = readHistory();
  const next = current.filter((entry) => {
    if (entry.type !== 'url') {
      return true;
    }

    const shortIdMatch = normalizedShortId && entry.shortId === normalizedShortId;
    const deleteTokenMatch = normalizedDeleteToken && entry.deleteToken === normalizedDeleteToken;
    const shortUrlMatch = normalizedShortUrl && entry.shortUrl === normalizedShortUrl;

    return !(shortIdMatch || deleteTokenMatch || shortUrlMatch);
  });

  writeHistory(next);
}

export function initHistory() {
  const openBtn = document.getElementById('btn-view-history') as HTMLButtonElement | null;
  const modal = document.getElementById('history-modal') as HTMLDivElement | null;
  const closeBtn = document.getElementById('btn-close-history') as HTMLButtonElement | null;
  const listEl = document.getElementById('history-list') as HTMLDivElement | null;
  const emptyEl = document.getElementById('history-empty') as HTMLParagraphElement | null;
  const purgeBtn = document.getElementById('btn-purge-all-history') as HTMLButtonElement | null;

  if (!openBtn || !modal || !closeBtn || !listEl || !emptyEl) {
    return;
  }

  const openModal = () => {
    renderHistoryItems(listEl, emptyEl);
    modal.classList.remove('hidden');
  };

  const closeModal = () => {
    modal.classList.add('hidden');
  };

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);

  // ── Purge All Records ──────────────────────────────────────
  if (purgeBtn) {
    purgeBtn.addEventListener('click', async () => {
      const items = readHistory();
      if (items.length === 0) {
        showToast('No records to purge.', 'error');
        return;
      }

      const shouldPurge = await confirmDialog({
        title: 'Purge All Records?',
        message: `This will permanently erase ${items.length} record${items.length === 1 ? '' : 's'} from the vault and the backend database. This action cannot be undone.`,
        confirmLabel: 'Purge Everything',
        cancelLabel: 'Keep Records',
        confirmVariant: 'danger',
      });
      if (!shouldPurge) {
        return;
      }

      purgeBtn.disabled = true;
      purgeBtn.classList.add('opacity-60', 'pointer-events-none');

      // Build bulk payload
      const bulkItems = items.map((item) => {
        if (item.type === 'clip') {
          return { type: 'clip', identifier: item.code, deleteToken: item.deleteToken };
        }
        return { type: 'url', identifier: item.shortId, deleteToken: item.deleteToken };
      });

      try {
        const response = await apiPost('/api/clip/bulk-delete', { items: bulkItems });

        // Clear all local history regardless of partial failures
        writeHistory([]);
        renderHistoryItems(listEl, emptyEl);
        clearRetrieveResult();

        if (response.success) {
          const { successCount, failCount } = response.data as { successCount: number; failCount: number };
          if (failCount > 0) {
            showToast(`Purge complete: ${successCount} erased, ${failCount} could not be removed from server.`, 'success');
          } else {
            showToast(`All ${successCount} records have been permanently erased.`, 'success');
          }
        } else {
          showToast(response.message || 'Purge completed with errors.', 'error');
        }
      } catch {
        // Even on network failure, clear local history
        writeHistory([]);
        renderHistoryItems(listEl, emptyEl);
        clearRetrieveResult();
        showToast('Local records cleared. Some server records may persist due to a network error.', 'error');
      } finally {
        purgeBtn.disabled = false;
        purgeBtn.classList.remove('opacity-60', 'pointer-events-none');
      }
    });
  }

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });
}
