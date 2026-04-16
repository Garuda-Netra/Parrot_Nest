const Clip = require('../models/Clip');
const path = require('path');
const mongoose = require('mongoose');
const crypto = require('crypto');
const fs = require('fs/promises');

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

function generateDeleteToken() {
  return crypto.randomBytes(24).toString('hex');
}

function hashDeleteToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isValidDeleteToken(token) {
  return typeof token === 'string' && token.trim().length > 0;
}

function getDeleteTokenFromRequest(req) {
  const headerToken = req.headers['x-delete-token'];
  if (typeof headerToken === 'string' && headerToken.trim()) {
    return headerToken.trim();
  }

  if (req.body && typeof req.body.deleteToken === 'string' && req.body.deleteToken.trim()) {
    return req.body.deleteToken.trim();
  }

  return '';
}

function isDeleteTokenMatch(plainToken, storedHash) {
  if (!plainToken || !storedHash) {
    return false;
  }

  const calculated = hashDeleteToken(plainToken);
  const calculatedBuffer = Buffer.from(calculated, 'utf8');
  const storedBuffer = Buffer.from(storedHash, 'utf8');

  if (calculatedBuffer.length !== storedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(calculatedBuffer, storedBuffer);
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
 * Generate a unique 4-digit numeric code.
 * Retries if code already exists in the database.
 */
async function generateUniqueCode() {
  let code;
  let exists = true;
  let attempts = 0;

  while (exists && attempts < 20) {
    code = String(Math.floor(1000 + Math.random() * 9000)); // 1000–9999
    exists = await Clip.findOne({ code });
    attempts++;
  }

  if (exists) {
    throw new Error('Unable to generate a unique code. Please try again.');
  }

  return code;
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
 * Retrieves a clip by its 4-digit code.
 */
exports.getClip = async (req, res, next) => {
  try {
    const { code } = req.params;

    // Basic input sanitisation
    if (!/^\d{4}$/.test(code)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid code format. Must be exactly 4 digits.',
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

    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const filePath = path.join(uploadsDir, safeFileName);

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

    if (!/^\d{4}$/.test(code)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid code format. Must be exactly 4 digits.',
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
