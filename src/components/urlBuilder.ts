import { isValidUrl, evaluateSlugState } from './validation';
import { showToast } from './toast';
import { apiPost, apiDelete } from './api';
import { recordUrlHistory, removeUrlHistoryByContext } from './history';

export function initUrlBuilder() {
  const destInput = document.getElementById('url-dest-input') as HTMLInputElement | null;
  const destMsg = document.getElementById('url-dest-msg') as HTMLParagraphElement | null;
  const destIcon = document.getElementById('url-dest-icon') as HTMLDivElement | null;

  const slugInput = document.getElementById('url-slug-input') as HTMLInputElement | null;
  const slugMsg = document.getElementById('url-slug-msg') as HTMLParagraphElement | null;
  const slugIndicator = document.getElementById('slug-indicator') as HTMLSpanElement | null;

  const previewPanel = document.getElementById('preview-panel') as HTMLDivElement | null;
  const previewShortUrl = document.getElementById('preview-short-url') as HTMLParagraphElement | null;
  const previewLongUrl = document.getElementById('preview-long-url') as HTMLParagraphElement | null;
  const expiryButtons = document.querySelectorAll('#url-expiry-options .url-liquid-btn') as NodeListOf<HTMLButtonElement>;

  const btnShorten = document.getElementById('btn-shorten') as HTMLButtonElement | null;
  const btnShortenText = document.getElementById('btn-shorten-text') as HTMLSpanElement | null;
  const btnShortenIcon = document.getElementById('btn-shorten-icon') as unknown as SVGSVGElement | null;
  const btnOpenLatestResult = document.getElementById('btn-open-latest-result') as HTMLButtonElement | null;

  const resultSection = document.getElementById('url-result-section') as HTMLDivElement | null;
  const formSection = document.getElementById('url-form-section') as HTMLDivElement | null;
  const urlShortenerUI = document.getElementById('urlshortener-ui') as HTMLDivElement | null;
  const resultShortUrl = document.getElementById('result-short-url') as HTMLSpanElement | null;
  const resultQrWrap = document.getElementById('result-qr-wrap') as HTMLDivElement | null;
  const resultQrCode = document.getElementById('result-qr-code') as HTMLImageElement | null;
  const btnCopy = document.getElementById('btn-copy') as HTMLButtonElement | null;
  const btnUrlVanishNow = document.getElementById('btn-url-vanish-now') as HTMLButtonElement | null;
  const btnBackToUrlForm = document.getElementById('btn-back-to-url-form') as HTMLButtonElement | null;
  const btnShortenAnother = document.getElementById('btn-shorten-another') as HTMLButtonElement | null;

  if (!destInput || !slugInput || !btnShorten) return;

  let selectedExpiry = '5m';
  let latestUrlDeletionContext: { shortId: string; deleteToken: string } | null = null;
  const urlExpiryMessages: Record<string, string> = {
    '5m': '🔥 Quick Burn ignited. Link vaporizes in 5 minutes.',
    '20m': '🌊 Heatwave surge detected. 20-minute exposure window.',
    '1h': '👻 Phantom Hour cloaked. Link vanishes in 60 minutes.',
    '1d': '🌅 Sunset Vault sealed. 24-hour secure enclosure.',
  };
  expiryButtons.forEach((button) => {
    if (button.classList.contains('active')) {
      selectedExpiry = button.dataset.urlExpiry || selectedExpiry;
    }

    button.addEventListener('click', () => {
      expiryButtons.forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');
      selectedExpiry = button.dataset.urlExpiry || '5m';
      const message = urlExpiryMessages[selectedExpiry] || 'Self-destruct armed.';
      showToast(message, 'success');
    });
  });

  function showUrlResult() {
    urlShortenerUI?.scrollTo({ top: 0, behavior: 'auto' });
    urlShortenerUI?.classList.remove('overflow-y-auto');
    urlShortenerUI?.classList.add('overflow-hidden');
    formSection?.classList.add('invisible');
    resultSection?.classList.remove('hidden');
    resultSection?.classList.add('flex');
  }

  function showUrlForm(resetFields: boolean) {
    resultSection?.classList.remove('flex');
    resultSection?.classList.add('hidden');
    formSection?.classList.remove('invisible');
    urlShortenerUI?.classList.remove('overflow-hidden');
    urlShortenerUI?.classList.add('overflow-y-auto');
    urlShortenerUI?.scrollTo({ top: 0, behavior: 'auto' });

    if (!resetFields) {
      return;
    }

    destInput!.value = '';
    slugInput!.value = '';

    // Dispatch events manually to trigger reset
    destInput!.dispatchEvent(new Event('input'));
    slugInput!.dispatchEvent(new Event('input'));
    if (resultShortUrl) {
      resultShortUrl.textContent = '';
    }
    if (resultQrCode) {
      resultQrCode.removeAttribute('src');
    }
    resultQrWrap?.classList.add('hidden');
    latestUrlDeletionContext = null;
    btnOpenLatestResult?.classList.add('hidden');
    btnOpenLatestResult?.classList.remove('flex');
  }

  function updatePreview() {
    const isDestValid = isValidUrl(destInput!.value);
    
    if (isDestValid) {
      previewPanel!.classList.remove('hidden');
      previewLongUrl!.textContent = `Redirects to: ${destInput!.value}`;
      previewShortUrl!.textContent = `parrotclip.com/${slugInput!.value.trim() ? slugInput!.value.trim() : '[random]'}`;
    } else {
      previewPanel!.classList.add('hidden');
    }
  }

  // Handle Destination URL live changes
  destInput.addEventListener('input', () => {
    const val = destInput.value.trim();
    if (!val) {
      // Reset
      destInput.classList.remove('glow-success', 'glow-error');
      destMsg!.style.opacity = '0';
      destIcon!.style.opacity = '0';
      updatePreview();
      return;
    }

    if (isValidUrl(val)) {
      destInput.classList.remove('glow-error', 'shake');
      destInput.classList.add('glow-success');
      
      destMsg!.textContent = val.startsWith('https') ? "Secure connection (HTTPS) detected" : "Valid domain detected";
      destMsg!.classList.replace('text-red-400', 'text-green-400');
      destMsg!.style.opacity = '1';

      destIcon!.innerHTML = `<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
      destIcon!.style.opacity = '1';
    } else {
      destInput.classList.remove('glow-success');
      destInput.classList.add('glow-error');
      
      destMsg!.textContent = "Invalid URL format. Must start with http:// or https://";
      destMsg!.classList.replace('text-green-400', 'text-red-400');
      destMsg!.style.opacity = '1';

      destIcon!.innerHTML = `<svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
      destIcon!.style.opacity = '1';
    }

    updatePreview();
  });

  // Handle Slug Changes
  slugInput.addEventListener('input', () => {
    const state = evaluateSlugState(slugInput.value.trim());

    slugIndicator!.style.opacity = '1';
    slugInput.classList.remove('glow-success', 'glow-error', 'shake');
    slugMsg!.style.opacity = '0';

    switch (state) {
      case 'empty':
        slugIndicator!.style.opacity = '0';
        break;
      case 'available':
        slugIndicator!.textContent = 'Available';
        slugIndicator!.className = `text-[10px] font-semibold px-2 py-0.5 rounded-full opacity-100 transition-opacity bg-green-500/20 text-green-300 border border-green-500/30`;
        slugInput.classList.add('glow-success');
        break;
      case 'invalid':
        slugIndicator!.textContent = 'Invalid Format';
        slugIndicator!.className = `text-[10px] font-semibold px-2 py-0.5 rounded-full opacity-100 transition-opacity bg-red-500/20 text-red-300 border border-red-500/30`;
        slugInput.classList.add('glow-error');
        slugMsg!.textContent = "Only lowercase letters, numbers, and hyphens allowed.";
        slugMsg!.style.opacity = '1';
        break;
      case 'restricted':
        slugIndicator!.textContent = 'Restricted';
        slugIndicator!.className = `text-[10px] font-semibold px-2 py-0.5 rounded-full opacity-100 transition-opacity bg-yellow-500/20 text-yellow-300 border border-yellow-500/30`;
        slugInput.classList.add('glow-error');
        slugMsg!.textContent = "This identifier is restricted to prevent misuse.";
        slugMsg!.style.opacity = '1';
        break;
      case 'taken':
        slugIndicator!.textContent = 'Already Taken';
        slugIndicator!.className = `text-[10px] font-semibold px-2 py-0.5 rounded-full opacity-100 transition-opacity bg-red-500/20 text-red-300 border border-red-500/30`;
        slugInput.classList.add('glow-error');
        break;
    }

    updatePreview();
  });

  // Form Submission
  btnShorten.addEventListener('click', async () => {
    const destVal = destInput.value.trim();
    const slugVal = slugInput.value.trim();

    // Forced validations
    if (!isValidUrl(destVal)) {
      destInput.classList.add('shake');
      setTimeout(() => destInput.classList.remove('shake'), 400);
      showToast('Please enter a valid Destination URL.', 'error');
      return;
    }

    const state = evaluateSlugState(slugVal);
    if (state === 'invalid' || state === 'taken' || state === 'restricted') {
      slugInput.classList.add('shake');
      setTimeout(() => slugInput.classList.remove('shake'), 400);
      showToast('Please resolve issues with your custom slug.', 'error');
      return;
    }

    // Loading State
    btnShorten.classList.add('pointer-events-none');
    btnShortenText!.textContent = 'Securing Link...';
    btnShortenIcon!.style.display = 'none';
    
    const spinner = document.createElement('div');
    spinner.className = 'spinner ml-2';
    btnShorten.appendChild(spinner);

    try {
      const payload: any = { originalUrl: destVal, expiry: selectedExpiry };
      if (slugVal) payload.customSlug = slugVal;

      const res = await apiPost('/api/url/shorten', payload);

      // Reset button
      btnShorten.classList.remove('pointer-events-none');
      btnShortenText!.textContent = 'Shorten URL';
      btnShortenIcon!.style.display = 'block';
      spinner.remove();

      if (res.success) {
        // Show Result
        resultShortUrl!.textContent = res.data.shortUrl;
        if (typeof res.data?.qrCodeDataUri === 'string' && res.data.qrCodeDataUri) {
          resultQrCode?.setAttribute('src', res.data.qrCodeDataUri);
          resultQrWrap?.classList.remove('hidden');
        } else {
          resultQrCode?.removeAttribute('src');
          resultQrWrap?.classList.add('hidden');
        }
        showUrlResult();
        btnOpenLatestResult?.classList.remove('hidden');
        btnOpenLatestResult?.classList.add('flex');
        latestUrlDeletionContext = {
          shortId: res.data.shortId,
          deleteToken: res.data.deleteToken,
        };

        recordUrlHistory({
          shortId: res.data.shortId,
          shortUrl: res.data.shortUrl,
          originalUrl: res.data.originalUrl,
          deleteToken: res.data.deleteToken,
          expiresAt: res.data.expiresAt,
        });

        showToast('URL shortened successfully!', 'success');
      } else {
        // Server-side validation error (slug taken, restricted, etc.)
        showToast(res.message || 'Failed to shorten URL.', 'error');

        if (res.message?.includes('taken') || res.message?.includes('already')) {
          slugInput.classList.add('shake');
          setTimeout(() => slugInput.classList.remove('shake'), 400);
        }
      }
    } catch (err) {
      btnShorten.classList.remove('pointer-events-none');
      btnShortenText!.textContent = 'Shorten URL';
      btnShortenIcon!.style.display = 'block';
      spinner.remove();
      showToast('Network error. Is the backend running?', 'error');
    }
  });

  // Copy Action
  if (btnCopy) {
    btnCopy.addEventListener('click', () => {
      navigator.clipboard.writeText(resultShortUrl!.textContent || '');
      btnCopy.innerHTML = `<svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
      showToast('Copied to clipboard!', 'success');

      setTimeout(() => {
        btnCopy.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>`;
      }, 2000);
    });
  }

  if (btnUrlVanishNow) {
    btnUrlVanishNow.addEventListener('click', async () => {
      if (!latestUrlDeletionContext) {
        showToast('No compacted link found to vanish.', 'error');
        return;
      }

      const shouldDelete = window.confirm('Execute vanish protocol now? This compacted URL will be permanently erased.');
      if (!shouldDelete) {
        return;
      }

      btnUrlVanishNow.disabled = true;
      btnUrlVanishNow.classList.add('opacity-60', 'pointer-events-none');

      try {
        const response = await apiDelete(`/api/url/${latestUrlDeletionContext.shortId}`, latestUrlDeletionContext.deleteToken);
        if (!response.success) {
          if (/not found|already deleted|self-destructed/i.test(response.message || '')) {
            removeUrlHistoryByContext({
              shortId: latestUrlDeletionContext.shortId,
              deleteToken: latestUrlDeletionContext.deleteToken,
              shortUrl: resultShortUrl?.textContent || '',
            });
            latestUrlDeletionContext = null;
            showUrlForm(true);
            showToast('Link was already removed. History has been cleaned up.', 'success');

            setTimeout(() => {
              window.location.reload();
            }, 1200);
            return;
          }

          showToast(response.message || 'Vanish protocol failed.', 'error');
          btnUrlVanishNow.disabled = false;
          btnUrlVanishNow.classList.remove('opacity-60', 'pointer-events-none');
          return;
        }

        removeUrlHistoryByContext({
          shortId: latestUrlDeletionContext.shortId,
          deleteToken: latestUrlDeletionContext.deleteToken,
          shortUrl: resultShortUrl?.textContent || '',
        });
        latestUrlDeletionContext = null;
        showUrlForm(true);
        showToast('Vanish protocol complete. Link erased from the vault.', 'success');

        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } catch {
        showToast('Network error while executing vanish protocol.', 'error');
        btnUrlVanishNow.disabled = false;
        btnUrlVanishNow.classList.remove('opacity-60', 'pointer-events-none');
      }
    });
  }

  if (btnOpenLatestResult) {
    btnOpenLatestResult.addEventListener('click', () => {
      if (!resultShortUrl?.textContent?.trim()) {
        showToast('No compacted link available yet. Create one first.', 'error');
        return;
      }

      showUrlResult();
      showToast('Compacted link panel reopened.', 'success');
    });
  }

  if (btnBackToUrlForm) {
    btnBackToUrlForm.addEventListener('click', () => {
      showUrlForm(false);
    });
  }

  // Reset State
  if (btnShortenAnother) {
    btnShortenAnother.addEventListener('click', () => {
      showUrlForm(true);
    });
  }
}
