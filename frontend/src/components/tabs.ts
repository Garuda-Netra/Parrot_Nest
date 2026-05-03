import { apiPost, apiGet, apiDelete, buildApiUrl } from './api';
import { showToast } from './toast';
import { recordClipHistory, removeClipHistoryByCode } from './history';
import { confirmDialog } from './confirmDialog';

/**
 * Clears the retrieve result panel completely.
 * Called after deletions / vanish / purge so stale content doesn't linger.
 */
export function clearRetrieveResult() {
  const retrieveResult = document.getElementById('retrieve-result') as HTMLDivElement | null;
  const retrieveContent = document.getElementById('retrieve-result-content') as HTMLPreElement | null;
  const btnCopyRetrieved = document.getElementById('btn-copy-retrieved') as HTMLButtonElement | null;
  const retrieveFilesContainer = document.getElementById('retrieve-result-files') as HTMLDivElement | null;
  const downloadAllBtn = document.getElementById('btn-download-all') as HTMLButtonElement | null;

  if (retrieveResult) retrieveResult.classList.add('hidden');
  if (retrieveContent) {
    retrieveContent.textContent = '';
    retrieveContent.classList.add('hidden');
  }
  if (btnCopyRetrieved) {
    btnCopyRetrieved.classList.add('hidden');
    btnCopyRetrieved.classList.remove('flex');
  }
  if (retrieveFilesContainer) retrieveFilesContainer.innerHTML = '';
  if (downloadAllBtn) downloadAllBtn.classList.add('hidden');
}

export function initTabs() {
  function debounce<T extends (...args: any[]) => void>(fn: T, delayMs = 140) {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return (...args: Parameters<T>) => {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => fn(...args), delayMs);
    };
  }

  // --- 1. Share/Retrieve Tabs Logic ---
  const tabShare = document.getElementById('tab-share') as HTMLButtonElement | null;
  const tabRetrieve = document.getElementById('tab-retrieve') as HTMLButtonElement | null;
  const tabIndicator = document.getElementById('tab-indicator') as HTMLDivElement | null;
  
  const contentShare = document.getElementById('content-share') as HTMLDivElement | null;
  const contentRetrieve = document.getElementById('content-retrieve') as HTMLDivElement | null;

  if (!tabShare || !tabRetrieve || !tabIndicator || !contentShare || !contentRetrieve) return;

  function switchTab(tab: 'share' | 'retrieve') {
    if (tab === 'share') {
      tabIndicator!.style.transform = 'translateX(0)';
      tabShare!.classList.replace('text-gray-400', 'text-gold-glow');
      tabRetrieve!.classList.replace('text-gold-glow', 'text-gray-400');

      contentRetrieve!.classList.add('hidden');
      contentShare!.classList.remove('hidden');
    } else {
      tabIndicator!.style.transform = 'translateX(100%)';
      tabRetrieve!.classList.replace('text-gray-400', 'text-gold-glow');
      tabShare!.classList.replace('text-gold-glow', 'text-gray-400');

      contentShare!.classList.add('hidden');
      contentRetrieve!.classList.remove('hidden');
    }
  }

  tabShare.addEventListener('click', () => switchTab('share'));
  tabRetrieve.addEventListener('click', () => switchTab('retrieve'));

  // --- 2. Sub-Tabs Logic (Snippet/Drop File/Folder) ---
  const subtabSnippet = document.getElementById('subtab-snippet') as HTMLButtonElement | null;
  const subtabFile = document.getElementById('subtab-file') as HTMLButtonElement | null;
  const subtabFolder = document.getElementById('subtab-folder') as HTMLButtonElement | null;
  const modeSnippet = document.getElementById('mode-snippet') as HTMLDivElement | null;
  const modeFile = document.getElementById('mode-file') as HTMLDivElement | null;
  const modeFolder = document.getElementById('mode-folder') as HTMLDivElement | null;

  if (!subtabSnippet || !subtabFile || !subtabFolder || !modeSnippet || !modeFile || !modeFolder) return;

  let activeMode: 'snippet' | 'file' | 'folder' = 'snippet';
  let selectedFiles: File[] = [];

  function switchSubTab(mode: 'snippet' | 'file' | 'folder') {
    activeMode = mode;
    
    [subtabSnippet, subtabFile, subtabFolder].forEach(btn => {
        btn!.classList.remove('text-gold-muted', 'border-gold-muted');
        btn!.classList.add('text-gray-500', 'border-transparent');
    });
    
    [modeSnippet, modeFile, modeFolder].forEach(div => {
        div!.classList.add('hidden');
        div!.classList.remove('flex');
    });
    
    const activeSubtab = mode === 'snippet' ? subtabSnippet : mode === 'file' ? subtabFile : subtabFolder;
    activeSubtab!.classList.add('text-gold-muted', 'border-gold-muted');
    activeSubtab!.classList.remove('text-gray-500', 'border-transparent');
    
    const activeModeDiv = mode === 'snippet' ? modeSnippet : mode === 'file' ? modeFile : modeFolder;
    activeModeDiv!.classList.remove('hidden');
    activeModeDiv!.classList.add('flex');
    
    // reset selection
    selectedFiles = [];
    updateFileQueue();
  }

  subtabSnippet.addEventListener('click', () => switchSubTab('snippet'));
  subtabFile.addEventListener('click', () => switchSubTab('file'));
  subtabFolder.addEventListener('click', () => switchSubTab('folder'));

  // --- 3. Character Counter ---
  const snippetTextarea = document.getElementById('snippet-textarea') as HTMLTextAreaElement | null;
  const charCounter = document.getElementById('char-counter') as HTMLSpanElement | null;

  if (snippetTextarea && charCounter) {
    const updateCharCount = debounce(() => {
      charCounter.textContent = snippetTextarea.value.length.toString();
    });

    snippetTextarea.addEventListener('input', updateCharCount);
  }

  // --- 4. OTP Input Logic ---
  const otpInputs = document.querySelectorAll('.otp-input') as NodeListOf<HTMLInputElement>;
  
  otpInputs.forEach((input, index) => {
    input.addEventListener('input', (e: Event) => {
      const target = e.target as HTMLInputElement;
      
      target.value = target.value.replace(/[^0-9]/g, '');

      if (target.value && index < otpInputs.length - 1) {
        otpInputs[index + 1].focus();
      }
    });

    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Backspace' && !input.value && index > 0) {
        otpInputs[index - 1].focus();
        otpInputs[index - 1].value = '';
      }
    });
  });

  // --- 5. Self Destruct Buttons ---
  let selectedExpiry = '5m';
  const clipExpiryButtons = document.querySelectorAll('#clip-expiry-options .url-liquid-btn') as NodeListOf<HTMLButtonElement>;
  const expiryMessages: Record<string, string> = {
    '5m': '⚡ Rapid Lock armed. Clip will incinerate in 5 minutes.',
    '1h': '🔐 Secure Hour activated. Clip locked for 60 minutes.',
    '1d': '🏛️ Daily Vault engaged. Clip protected for 24 hours.',
    '2d': '🛡️ Extended Shield active. Clip guarded for 48 hours.',
  };
  clipExpiryButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      clipExpiryButtons.forEach(p => p.classList.remove('active'));
      const target = e.target as HTMLButtonElement;
      target.classList.add('active');
      selectedExpiry = target.dataset.expiry || '5m';
      const message = expiryMessages[selectedExpiry] || 'Self-destruct mode armed.';
      showToast(message, 'success');
    });
  });

  // --- 6. Drag and Drop Visuals & Handler ---
  const dtModeFile = document.getElementById('mode-file') as HTMLDivElement | null;
  const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
  const dtModeFolder = document.getElementById('mode-folder') as HTMLDivElement | null;
  const folderInput = document.getElementById('folder-input') as HTMLInputElement | null;
  let fileQueueRenderFrame = 0;

  function updateFileQueue() {
      if (fileQueueRenderFrame) {
        cancelAnimationFrame(fileQueueRenderFrame);
      }

      fileQueueRenderFrame = requestAnimationFrame(() => {
      const queueContainer = document.getElementById('file-list-queue');
        if (!queueContainer) {
          fileQueueRenderFrame = 0;
          return;
        }

      if (selectedFiles.length === 0) {
          queueContainer.classList.add('hidden');
          queueContainer.classList.remove('flex');
          queueContainer.innerHTML = '';
          return;
      }

      queueContainer.classList.remove('hidden');
      queueContainer.classList.add('flex');
      queueContainer.innerHTML = '';

      const fragment = document.createDocumentFragment();

      let totalSize = 0;
      const MAX_TOTAL_SIZE = 10 * 1024 * 1024;
      
      selectedFiles.forEach((f, idx) => {
          totalSize += f.size;
          const sizeStr = (f.size / 1024 / 1024).toFixed(2) + ' MB';
          const outer = document.createElement('div');
          outer.className = 'glass-input bg-white/5 border border-white/10 rounded flex items-center justify-between p-2 text-xs text-gray-300';

          const info = document.createElement('div');
          info.className = 'flex items-center gap-2 truncate pr-2';
          info.innerHTML = `
             <svg class="w-4 h-4 text-gold-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
             <span class="truncate" title="${f.webkitRelativePath || f.name}">${f.webkitRelativePath || f.name}</span>
             <span class="text-gray-500 shrink-0">(${sizeStr})</span>
          `;

          const delBtn = document.createElement('button');
          delBtn.className = 'text-red-400 hover:text-red-300 p-1 shrink-0 transition-colors';
          delBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
          delBtn.onclick = () => {
             selectedFiles.splice(idx, 1);
             updateFileQueue();
          };

          outer.appendChild(info);
          outer.appendChild(delBtn);
           fragment.appendChild(outer);
      });
      
      // Add total size indicator
      const totalSizeDiv = document.createElement('div');
      const totalMB = (totalSize / 1024 / 1024).toFixed(2);
      const isNearLimit = totalSize > (8 * 1024 * 1024); // Warn at 8MB
      const isAtLimit = totalSize > MAX_TOTAL_SIZE;
      
      totalSizeDiv.className = `text-xs mt-2 px-2 py-1 rounded ${isAtLimit ? 'bg-red-500/20 text-red-300 border border-red-500/50' : isNearLimit ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50' : 'bg-white/5 text-gray-300 border border-white/10'}`;
      totalSizeDiv.textContent = `Total: ${totalMB}MB / 10.00MB${isAtLimit ? ' ⚠️ LIMIT EXCEEDED' : ''}`;
      fragment.appendChild(totalSizeDiv);

      queueContainer.appendChild(fragment);
      fileQueueRenderFrame = 0;
    });
  }

  function handleFilesInput(files: FileList | null) {
      if (!files) return;
      
      const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
      let totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);
      const rejectedFiles: string[] = [];
      
      Array.from(files).forEach(f => {
          // Check individual file size
          if (f.size > MAX_FILE_SIZE) {
              rejectedFiles.push(`${f.name} (${(f.size / 1024 / 1024).toFixed(2)}MB exceeds limit)`);
              return;
          }
          
          // Check if adding this file would exceed total limit
          if (totalSize + f.size > MAX_FILE_SIZE) {
              rejectedFiles.push(`${f.name} would exceed total 10MB limit`);
              return;
          }
          
          selectedFiles.push(f);
          totalSize += f.size;
      });
      
      // Show rejection messages if any files were rejected
      if (rejectedFiles.length > 0) {
          rejectedFiles.forEach(msg => {
              showToast(`⚠️ Rejected: ${msg}`, 'error');
          });
      }
      
      updateFileQueue();
  }

  function setupUploadZone(dtMode: HTMLElement, inputMode: HTMLInputElement) {
      if(!dtMode || !inputMode) return;
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
          dtMode.addEventListener(eventName, (e: Event) => {
              e.preventDefault(); e.stopPropagation();
          }, false);
      });
      ['dragenter', 'dragover'].forEach(eventName => {
          dtMode.addEventListener(eventName, () => dtMode.classList.add('dropzone-active'));
      });
      ['dragleave', 'drop'].forEach(eventName => {
          dtMode.addEventListener(eventName, () => dtMode.classList.remove('dropzone-active'));
      });
      dtMode.addEventListener('drop', (e: DragEvent) => {
          if (e.dataTransfer?.files.length) {
              handleFilesInput(e.dataTransfer.files);
          }
      });
      inputMode.addEventListener('change', () => {
          if (inputMode.files?.length) {
              handleFilesInput(inputMode.files);
              // allow re-selecting same files
              inputMode.value = '';
          }
      });
  }

  if (dtModeFile && fileInput) setupUploadZone(dtModeFile, fileInput);
  if (dtModeFolder && folderInput) setupUploadZone(dtModeFolder, folderInput);

  // --- 7. Generate Secure Clip (POST /api/clip/create) ---
  const btnGenerate = document.getElementById('btn-generate-clip') as HTMLButtonElement | null;
  const btnGenerateText = document.getElementById('btn-generate-text') as HTMLSpanElement | null;
  const clipResult = document.getElementById('clip-result') as HTMLDivElement | null;
  const clipResultCode = document.getElementById('clip-result-code') as HTMLParagraphElement | null;
  const btnClipVanishNow = document.getElementById('btn-clip-vanish-now') as HTMLButtonElement | null;
  let latestClipDeletionContext: { code: string; deleteToken: string } | null = null;

  function resetLatestClipResult() {
    latestClipDeletionContext = null;
    clipResult?.classList.add('hidden');
    if (clipResultCode) {
      clipResultCode.textContent = '';
    }

    if (btnClipVanishNow) {
      btnClipVanishNow.disabled = false;
      btnClipVanishNow.classList.remove('opacity-60', 'pointer-events-none');
    }

    // Also clear the retrieve panel so stale content doesn't linger
    clearRetrieveResult();
  }

  if (btnGenerate && btnGenerateText) {
    btnGenerate.addEventListener('click', async () => {
      const formData = new FormData();
      formData.append('expiry', selectedExpiry);

      if (activeMode === 'snippet') {
        const text = snippetTextarea?.value.trim();
        if (!text) {
          showToast('Please enter some text to share.', 'error');
          return;
        }
        formData.append('text', text);
      } else {
        if (selectedFiles.length === 0) {
          showToast('Please select at least one file to upload.', 'error');
          return;
        }

        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
        const MAX_TOTAL_SIZE = 10 * 1024 * 1024;
        let totalSize = 0;
        let hasError = false;
        
        for (const file of selectedFiles) {
           // Final validation - should not happen if handleFilesInput works correctly
           if (file.size > MAX_FILE_SIZE) {
               showToast(`❌ File "${file.name}" (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds 10MB limit.`, 'error');
               hasError = true;
               break;
           }
           totalSize += file.size;
        }
        
        if (hasError) {
          return;
        }

        if (totalSize > MAX_TOTAL_SIZE) {
          showToast(`❌ Total file size (${(totalSize / 1024 / 1024).toFixed(2)}MB) exceeds 10MB limit.`, 'error');
          return;
        }
        
        // All validations passed, add files to form
        selectedFiles.forEach(file => {
          formData.append('files', file);
        });
      }

      // Loading state
      btnGenerate.classList.add('pointer-events-none');
      btnGenerateText.textContent = 'Encrypting...';
      const spinner = document.createElement('div');
      spinner.className = 'spinner ml-2';
      btnGenerate.appendChild(spinner);

      try {
        const res = await apiPost('/api/clip/create', formData, true);

        btnGenerate.classList.remove('pointer-events-none');
        btnGenerateText.textContent = 'Generate Secure Link';
        spinner.remove();

        if (res.success) {
          clipResult!.classList.remove('hidden');
          clipResultCode!.textContent = res.data.code;
          latestClipDeletionContext = {
            code: res.data.code,
            deleteToken: res.data.deleteToken,
          };

          if (btnClipVanishNow) {
            btnClipVanishNow.disabled = false;
            btnClipVanishNow.classList.remove('opacity-60', 'pointer-events-none');
          }

          recordClipHistory({
            code: res.data.code,
            deleteToken: res.data.deleteToken,
            expiresAt: res.data.expiresAt,
            mode: activeMode,
            contentPreview: activeMode === 'snippet' ? (snippetTextarea?.value.trim() || '') : '',
            fileCount: activeMode === 'snippet' ? 0 : selectedFiles.length,
          });

          showToast(`Clip created! Code: ${res.data.code}`, 'success');
        } else {
          showToast(res.message || 'Failed to create clip.', 'error');
        }
      } catch {
        btnGenerate.classList.remove('pointer-events-none');
        btnGenerateText.textContent = 'Generate Secure Link';
        spinner.remove();
        showToast('Network error. Is the backend running?', 'error');
      }
    });
  }

  if (btnClipVanishNow) {
    btnClipVanishNow.addEventListener('click', async () => {
      if (!latestClipDeletionContext) {
        showToast('No active clip found to vanish.', 'error');
        return;
      }

      const shouldDelete = await confirmDialog({
        title: 'Execute Vanish Protocol?',
        message: 'This clip will be permanently erased from the vault and cannot be recovered.',
        confirmLabel: 'Erase Clip',
        cancelLabel: 'Cancel',
        confirmVariant: 'danger',
      });
      if (!shouldDelete) {
        return;
      }

      btnClipVanishNow.disabled = true;
      btnClipVanishNow.classList.add('opacity-60', 'pointer-events-none');

      try {
        const response = await apiDelete(`/api/clip/${latestClipDeletionContext.code}`, latestClipDeletionContext.deleteToken);
        if (!response.success) {
          if (/not found|already deleted|expired/i.test(response.message || '')) {
            removeClipHistoryByCode(latestClipDeletionContext.code);
            resetLatestClipResult();
            showToast('Clip was already removed. History has been cleaned up.', 'success');
            return;
          }

          showToast(response.message || 'Vanish protocol failed.', 'error');
          btnClipVanishNow.disabled = false;
          btnClipVanishNow.classList.remove('opacity-60', 'pointer-events-none');
          return;
        }

        removeClipHistoryByCode(latestClipDeletionContext.code);
        resetLatestClipResult();
        showToast('Vanish protocol complete. Clip erased from the vault.', 'success');
      } catch {
        showToast('Network error while executing vanish protocol.', 'error');
        btnClipVanishNow.disabled = false;
        btnClipVanishNow.classList.remove('opacity-60', 'pointer-events-none');
      }
    });
  }

  // --- 8. Fetch Secure Clip (GET /api/clip/:code) ---
  const btnFetch = document.getElementById('btn-fetch-clip') as HTMLButtonElement | null;
  const btnFetchText = document.getElementById('btn-fetch-text') as HTMLSpanElement | null;
  const retrieveResult = document.getElementById('retrieve-result') as HTMLDivElement | null;
  const retrieveContent = document.getElementById('retrieve-result-content') as HTMLPreElement | null;

  if (btnFetch && btnFetchText) {
    btnFetch.addEventListener('click', async () => {
      const code = Array.from(otpInputs).map(i => i.value).join('');

      if (code.length !== 5 || !/^\d{5}$/.test(code)) {
        showToast('Please enter a valid 5-digit code.', 'error');
        otpInputs.forEach(i => {
          i.classList.add('glow-error');
          setTimeout(() => i.classList.remove('glow-error'), 800);
        });
        return;
      }

      // Loading state
      btnFetch.classList.add('pointer-events-none');
      btnFetchText.textContent = 'Decrypting...';
      const spinner = document.createElement('div');
      spinner.className = 'spinner ml-2';
      btnFetch.appendChild(spinner);

      try {
        const res = await apiGet(`/api/clip/${code}`);

        btnFetch.classList.remove('pointer-events-none');
        btnFetchText.textContent = 'Fetch Secure Clip';
        spinner.remove();

        if (res.success) {
          retrieveResult!.classList.remove('hidden');

          const btnCopyRetrieved = document.getElementById('btn-copy-retrieved') as HTMLButtonElement | null;
          const btnCopyRetrievedText = document.getElementById('btn-copy-retrieved-text') as HTMLSpanElement | null;

          if (res.data.content) {
            retrieveContent!.textContent = res.data.content;
            retrieveContent!.classList.remove('hidden');

            // Show the copy button for text content
            if (btnCopyRetrieved) {
              btnCopyRetrieved.classList.remove('hidden');
              btnCopyRetrieved.classList.add('flex');
              btnCopyRetrieved.onclick = () => {
                navigator.clipboard.writeText(res.data.content).then(() => {
                  if (btnCopyRetrievedText) {
                    btnCopyRetrievedText.textContent = '✓ Captured!';
                    btnCopyRetrieved.classList.remove('text-green-300', 'border-green-500/30');
                    btnCopyRetrieved.classList.add('text-emerald-300', 'border-emerald-400/40');
                  }
                  showToast('Content captured to clipboard.', 'success');
                  setTimeout(() => {
                    if (btnCopyRetrievedText) {
                      btnCopyRetrievedText.textContent = 'Capture to Clipboard';
                      btnCopyRetrieved.classList.remove('text-emerald-300', 'border-emerald-400/40');
                      btnCopyRetrieved.classList.add('text-green-300', 'border-green-500/30');
                    }
                  }, 2000);
                }).catch(() => {
                  showToast('Failed to copy. Please select and copy manually.', 'error');
                });
              };
            }
          } else {
            retrieveContent!.classList.add('hidden');
            if (btnCopyRetrieved) {
              btnCopyRetrieved.classList.add('hidden');
              btnCopyRetrieved.classList.remove('flex');
            }
          }

          const retrieveFilesContainer = document.getElementById('retrieve-result-files') as HTMLDivElement;
          const downloadAllBtn = document.getElementById('btn-download-all') as HTMLButtonElement;
          retrieveFilesContainer.innerHTML = '';
          downloadAllBtn.classList.add('hidden');

          if (res.data.files && res.data.files.length > 0) {
            res.data.files.forEach((file: any) => {
               const sizeStr = (file.fileSize / 1024 / 1024).toFixed(2) + ' MB';
               const outer = document.createElement('div');
               outer.className = 'glass-input bg-white/5 border border-white/10 rounded flex items-center justify-between p-2 text-xs text-gray-300';
               
               const info = document.createElement('div');
               info.className = 'flex items-center gap-2 truncate pr-2';
               info.innerHTML = `
                  <svg class="w-4 h-4 text-gold-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                  <span class="truncate" title="${file.fileName}">${file.fileName}</span>
                  <span class="text-gray-500 shrink-0">(${sizeStr})</span>
               `;
               
               const dlAnchor = document.createElement('a');
               dlAnchor.href = buildApiUrl(file.fileUrl);
               dlAnchor.download = file.fileName;
               dlAnchor.className = 'text-green-400 hover:text-green-300 p-1 shrink-0 transition-colors';
               dlAnchor.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>';
               
               outer.appendChild(info);
               outer.appendChild(dlAnchor);
               retrieveFilesContainer.appendChild(outer);
            });
            
            if (res.data.files.length > 1) {
               downloadAllBtn.classList.remove('hidden');
               downloadAllBtn.onclick = () => {
                   res.data.files.forEach((file: any) => {
                       const a = document.createElement('a');
                       a.href = buildApiUrl(file.fileUrl);
                       a.download = file.fileName;
                       document.body.appendChild(a);
                       a.click();
                       document.body.removeChild(a);
                   });
               };
            }
          }

          showToast('Clip retrieved successfully!', 'success');
        } else {
          // Clip not found / expired — clear any stale retrieved content
          clearRetrieveResult();
          showToast(res.message || 'Clip not found or expired.', 'error');
        }
      } catch {
        btnFetch.classList.remove('pointer-events-none');
        btnFetchText.textContent = 'Fetch Secure Clip';
        spinner.remove();
        showToast('Network error. Is the backend running?', 'error');
      }
    });
  }
}
