/**
 * expiryCleanup.js
 *
 * Periodically scans for expired Clips and URLs, deletes them from MongoDB,
 * and removes any associated uploaded files from the filesystem.
 *
 * MongoDB's TTL index handles document expiration, but it does NOT clean up
 * uploaded files stored on disk. This job ensures full cleanup.
 */

const Clip = require('../models/Clip');
const Url = require('../models/Url');
const path = require('path');
const fs = require('fs/promises');
const mongoose = require('mongoose');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const CLEANUP_INTERVAL_MS = 60 * 1000; // Run every 60 seconds

let cleanupTimer = null;

/**
 * Extract the stored file name from a fileUrl path.
 */
function getStoredFileNameFromUrl(fileUrl) {
  if (typeof fileUrl !== 'string' || !fileUrl.trim()) {
    return '';
  }

  let decodedPath = fileUrl.trim();
  try {
    decodedPath = decodeURIComponent(decodedPath);
  } catch {
    decodedPath = fileUrl.trim();
  }

  const safeFileName = path.basename(decodedPath);
  return safeFileName && safeFileName !== '.' ? safeFileName : '';
}

/**
 * Delete uploaded files associated with a clip.
 */
async function cleanupClipFiles(files) {
  for (const file of files || []) {
    if (!file || typeof file.fileUrl !== 'string') {
      continue;
    }

    const fileName = getStoredFileNameFromUrl(file.fileUrl);
    if (!fileName) {
      continue;
    }

    const filePath = path.join(UPLOADS_DIR, fileName);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if (err && err.code !== 'ENOENT') {
        console.warn(`[cleanup] Could not remove file ${fileName}: ${err.message}`);
      }
    }
  }
}

/**
 * Core cleanup logic: find and purge all expired clips + URLs.
 */
async function runCleanup() {
  // Only run if DB is connected
  if (mongoose.connection.readyState !== 1) {
    return;
  }

  const now = new Date();

  try {
    // --- Expired Clips ---
    const expiredClips = await Clip.find({ expiresAt: { $lte: now } }).lean();

    if (expiredClips.length > 0) {
      // Clean up associated files first
      for (const clip of expiredClips) {
        await cleanupClipFiles(clip.files);
      }

      // Delete clip documents
      const clipResult = await Clip.deleteMany({ expiresAt: { $lte: now } });
      if (clipResult.deletedCount > 0) {
        console.log(`[cleanup] Purged ${clipResult.deletedCount} expired clip(s) and their files.`);
      }
    }

    // --- Expired URLs ---
    const urlResult = await Url.deleteMany({ expiresAt: { $lte: now } });
    if (urlResult.deletedCount > 0) {
      console.log(`[cleanup] Purged ${urlResult.deletedCount} expired URL(s).`);
    }
  } catch (err) {
    console.warn(`[cleanup] Error during cleanup cycle: ${err.message}`);
  }
}

/**
 * Start the periodic cleanup scheduler.
 */
function startCleanupScheduler() {
  // Run immediately on startup
  runCleanup();

  // Then schedule periodic runs
  cleanupTimer = setInterval(runCleanup, CLEANUP_INTERVAL_MS);

  // Prevent the timer from keeping the process alive if everything else shuts down
  if (cleanupTimer && typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
  }

  console.log(`🧹 Expiry cleanup scheduler started (every ${CLEANUP_INTERVAL_MS / 1000}s)`);
}

/**
 * Stop the periodic cleanup scheduler.
 */
function stopCleanupScheduler() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    console.log('🧹 Expiry cleanup scheduler stopped.');
  }
}

module.exports = { startCleanupScheduler, stopCleanupScheduler, runCleanup };
