
const Clip = require('../models/Clip');
const path = require('path');
const mongoose = require('mongoose');
const fs = require('fs/promises');
const {
  generateDeleteToken,
  hashDeleteToken,
  isValidDeleteToken,
  getDeleteTokenFromRequest,
  isDeleteTokenMatch,
} = require('../utils/tokenUtils');

function ensureDatabaseReady(res) {
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  res.status(503).json({
    success: false,
    message: 'Database is temporarily unavailable. Please try again shortly.',
    data: {},
  });
  return false;
}

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

function buildClipDownloadUrl(storedFileName) {
  return `/api/clip/download/${encodeURIComponent(storedFileName)}`;
}

async function cleanupClipFiles(files) {
  const uploadsDir = path.join(__dirname, '..', 'uploads');

  await Promise.all(
    (files || []).map(async (file) => {
      if (!file || typeof file.fileUrl !== 'string') {
        return;
      }

      const fileName = getStoredFileNameFromUrl(file.fileUrl);
      if (!fileName) {
        return;
      }

      const filePath = path.join(uploadsDir, fileName);

      try {
        await fs.unlink(filePath);
      } catch (err) {
        if (err && err.code !== 'ENOENT') {
          console.warn(`⚠️  Could not remove uploaded file ${fileName}: ${err.message}`);
        }
      }
    })
  );
}

/**
 * Generate a unique 6-digit numeric code.
 * Uses atomic MongoDB insert with duplicate key error handling.
 */
async function generateUniqueCode() {
  const MAX_ATTEMPTS = 20;
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS) {
    const code = String(Math.floor(100000 + Math.random() * 900000)); // 100000–999999
    
    try {
      // Attempt to find an existing code (quick check before insert)
      const existing = await Clip.findOne({ code });
      if (!existing) {
        // Code doesn't exist, return it (will be used for insert in createClip)
        return code;
      }
    } catch (err) {
      console.error(`[generateUniqueCode] Error checking code: ${err.message}`);
      throw err;
    }
    
    attempts++;
  }

  throw new Error('Unable to generate a unique code after multiple attempts. Please try again.');
}

/**
 * Map human-readable expiry labels to milliseconds.
 */
function parseExpiry(expiry) {
  const map = {
    '5m':  5 * 60 * 1000,
    '1h':  60 * 60 * 1000,
    '1d':  24 * 60 * 60 * 1000,
    '2d':  2 * 24 * 60 * 60 * 1000,
  };
  return map[expiry] || map['1h']; // default 1 hour
}

function isValidClipExpiryChoice(expiry) {
  if (!expiry) {
    return true;
  }

  return ['5m', '1h', '1d', '2d'].includes(expiry);
}

function isClipExpired(expiresAt) {
  if (!expiresAt) {
    return true;
  }

  const expiryTime = new Date(expiresAt).getTime();
  if (Number.isNaN(expiryTime)) {
    return true;
  }

  return Date.now() >= expiryTime;
}

/**
 * POST /api/clip/create
 *
 * Body  (multipart/form-data):
 *   - text   : string  (snippet text)
 *   - expiry : string  ("5m" | "1h" | "1d" | "2d")
 *   - file   : binary  (optional file upload)
 */
exports.createClip = async (req, res, next) => {
  try {
    const { text, expiry } = req.body;
    const files = req.files || [];
    const normalizedExpiry = typeof expiry === 'string' ? expiry.trim() : '';

    // At least one content type is required
    if (!text && files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either text content or files.',
        data: {},
      });
    }

    // Validate individual file sizes (failsafe for backend)
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB per file
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        console.warn(`⚠️  File upload rejected: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds 10MB limit`);
        return res.status(413).json({
          success: false,
          message: `❌ File "${file.originalname}" (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds the 10MB limit per file.`,
          data: {},
        });
      }
    }

    // Limit total combined payload size to 10MB
    const MAX_TOTAL_SIZE = 10 * 1024 * 1024;
    const totalSize = files.reduce((acc, file) => acc + file.size, 0);
    if (totalSize > MAX_TOTAL_SIZE) {
      const totalMB = (totalSize / 1024 / 1024).toFixed(2);
      console.warn(`⚠️  Upload rejected: Total file size (${totalMB}MB) exceeds 10MB limit`);
      return res.status(413).json({
        success: false,
        message: `❌ Total combined file size (${totalMB}MB) exceeds the 10MB limit. Please remove some files.`,
        data: {},
      });
    }

    if (!ensureDatabaseReady(res)) {
      return;
    }

    if (!isValidClipExpiryChoice(normalizedExpiry)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid self-destruct mode. Allowed values are 5m, 1h, 1d, or 2d.',
        data: {},
      });
    }

    const expiryChoice = normalizedExpiry || '1h';

    const code = await generateUniqueCode();
    const expiresAt = new Date(Date.now() + parseExpiry(expiryChoice));
    const deleteToken = generateDeleteToken();

    const mappedFiles = files.map(file => ({
      fileName: file.originalname,
      fileUrl: buildClipDownloadUrl(file.filename),
      fileSize: file.size,
    }));

    const clipData = {
      code,
      expiresAt,
      content: text ? text.trim() : null,
      files: mappedFiles,
      deleteTokenHash: hashDeleteToken(deleteToken),
    };

    const clip = await Clip.create(clipData);

    return res.status(201).json({
      success: true,
      message: 'Clip created successfully.',
      data: {
        code: clip.code,
        expiresAt: clip.expiresAt,
        deleteToken,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/clip/:code
 *
 * Retrieves a clip by its 6-digit code.
 */
exports.getClip = async (req, res, next) => {
  try {
    const { code } = req.params;

    // Basic input sanitisation
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid code format. Must be exactly 6 digits.',
        data: {},
      });
    }

    if (!ensureDatabaseReady(res)) {
      return;
    }

    const clip = await Clip.findOne({ code });

    if (!clip) {
      return res.status(404).json({
        success: false,
        message: 'Clip not found or has expired.',
        data: {},
      });
    }

    if (isClipExpired(clip.expiresAt)) {
      const filesToDelete = Array.isArray(clip.files) ? [...clip.files] : [];
      await clip.deleteOne();
      await cleanupClipFiles(filesToDelete);

      return res.status(404).json({
        success: false,
        message: 'Clip not found or has expired.',
        data: {},
      });
    }

    const normalizedFiles = (clip.files || []).map((file) => {
      const storedFileName = getStoredFileNameFromUrl(file.fileUrl);
      if (!storedFileName) {
        return null;
      }

      return {
        fileName: file.fileName || storedFileName,
        fileUrl: buildClipDownloadUrl(storedFileName),
        fileSize: typeof file.fileSize === 'number' ? file.fileSize : 0,
      };
    }).filter(Boolean);

    if (normalizedFiles.length === 0 && clip._doc && typeof clip._doc.fileUrl === 'string') {
      const storedFileName = getStoredFileNameFromUrl(clip._doc.fileUrl);
      if (storedFileName) {
        normalizedFiles.push({
          fileName: 'attachment',
          fileUrl: buildClipDownloadUrl(storedFileName),
          fileSize: 0,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Clip retrieved successfully.',
      data: {
        content: clip.content,
        files: normalizedFiles,
        expiresAt: clip.expiresAt,
        createdAt: clip.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/clip/download/:fileName
 *
 * Forces file download from uploads directory.
 */
exports.downloadClipFile = async (req, res, next) => {
  try {
    const { fileName } = req.params;

    if (!fileName) {
      return res.status(400).json({
        success: false,
        message: 'File name is required.',
        data: {},
      });
    }

    let decodedFileName = '';
    try {
      decodedFileName = decodeURIComponent(fileName);
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Invalid file name encoding.',
        data: {},
      });
    }

    const safeFileName = path.basename(decodedFileName);

    if (!safeFileName || safeFileName !== decodedFileName) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file name.',
        data: {},
      });
    }

    const uploadsDir = path.resolve(__dirname, '..', 'uploads');
    const filePath = path.resolve(uploadsDir, safeFileName);

    // Verify resolved path is within uploads directory (prevent directory traversal)
    if (!filePath.startsWith(uploadsDir + path.sep) && filePath !== uploadsDir) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file path.',
        data: {},
      });
    }

    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({
        success: false,
        message: 'File not found.',
        data: {},
      });
    }

    return res.download(filePath, safeFileName);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/clip/:code
 *
 * Deletes a clip and removes associated uploaded files.
 */
exports.deleteClip = async (req, res, next) => {
  try {
    const { code } = req.params;

    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid code format. Must be exactly 6 digits.',
        data: {},
      });
    }

    if (!ensureDatabaseReady(res)) {
      return;
    }

    const deleteToken = getDeleteTokenFromRequest(req);
    if (!isValidDeleteToken(deleteToken)) {
      return res.status(400).json({
        success: false,
        message: 'Delete token is required.',
        data: {},
      });
    }

    const clip = await Clip.findOne({ code });
    if (!clip) {
      return res.status(404).json({
        success: false,
        message: 'Clip not found or already deleted.',
        data: {},
      });
    }

    if (!isDeleteTokenMatch(deleteToken, clip.deleteTokenHash)) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to delete this clip.',
        data: {},
      });
    }

    const filesToDelete = Array.isArray(clip.files) ? [...clip.files] : [];
    await clip.deleteOne();
    await cleanupClipFiles(filesToDelete);

    return res.status(200).json({
      success: true,
      message: 'Clip deleted successfully.',
      data: {},
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/clip/bulk-delete
 *
 * Accepts JSON body:
 *   { items: [{ type: 'clip'|'url', identifier: string, deleteToken: string }] }
 *
 * Deletes each item from the database. Returns per-item results.
 */
exports.bulkDeleteItems = async (req, res, next) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Request body must contain a non-empty "items" array.',
        data: {},
      });
    }

    if (items.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete more than 100 items at once.',
        data: {},
      });
    }

    if (!ensureDatabaseReady(res)) {
      return;
    }

    const Url = require('../models/Url');
    let successCount = 0;
    let failCount = 0;

    for (const item of items) {
      try {
        const { type, identifier, deleteToken } = item;

        if (!identifier || !deleteToken) {
          failCount++;
          continue;
        }

        if (type === 'clip') {
          if (!/^\d{4}$/.test(identifier)) {
            failCount++;
            continue;
          }

          const clip = await Clip.findOne({ code: identifier });
          if (!clip) {
            // Already deleted — count as success for cleanup purposes
            successCount++;
            continue;
          }

          if (!isDeleteTokenMatch(deleteToken, clip.deleteTokenHash)) {
            failCount++;
            continue;
          }

          const filesToDelete = Array.isArray(clip.files) ? [...clip.files] : [];
          await clip.deleteOne();
          await cleanupClipFiles(filesToDelete);
          successCount++;
        } else if (type === 'url') {
          const url = await Url.findOne({ shortId: identifier });
          if (!url) {
            successCount++;
            continue;
          }

          if (!isDeleteTokenMatch(deleteToken, url.deleteTokenHash)) {
            failCount++;
            continue;
          }

          await url.deleteOne();
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    return res.status(200).json({
      success: true,
      message: `Purge complete. ${successCount} record${successCount === 1 ? '' : 's'} erased, ${failCount} failed.`,
      data: { successCount, failCount },
    });
  } catch (err) {
    next(err);
  }
};
