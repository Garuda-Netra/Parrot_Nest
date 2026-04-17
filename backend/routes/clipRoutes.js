const express = require('express');
const multer = require('multer');
const path = require('path');
const clipController = require('../controllers/clipController');

const router = express.Router();

// --- Multer configuration ---
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const ALLOWED_EXTENSIONS = new Set([
  '.txt', '.md', '.pdf', '.csv', '.json', '.xml', '.yml', '.yaml', '.log',
  '.properties', '.gradle', '.java', '.js', '.ts', '.jsx', '.tsx', '.py', '.rs',
  '.c', '.cpp', '.h', '.hpp', '.go', '.php', '.rb', '.kt', '.kts', '.swift', '.sh',
  '.bash', '.zsh', '.sql', '.css',
  '.jpg', '.jpeg', '.png', '.mp4', '.mp3',
]);

const ALLOWED_MIME_TYPES = new Set([
  'text/plain', 'text/markdown', 'text/csv', 'text/xml',
  'application/json', 'application/xml', 'application/pdf',
  'text/javascript', 'application/javascript', 'application/x-javascript',
  'text/x-java-source', 'text/x-python', 'text/x-rustsrc',
  'text/x-c', 'text/x-c++src', 'text/x-php', 'text/x-ruby',
  'text/x-kotlin', 'text/x-shellscript', 'application/x-sh',
  'text/x-sql', 'text/css', 'application/octet-stream',
  'image/jpeg', 'image/png', 'video/mp4', 'audio/mpeg',
]);

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const mimeType = (file.mimetype || '').toLowerCase();
    const extensionAllowed = ALLOWED_EXTENSIONS.has(extension);
    const mimeAllowed = ALLOWED_MIME_TYPES.has(mimeType);
    const mimeMissing = mimeType === '';

    if (!extensionAllowed || (!mimeAllowed && !mimeMissing)) {
      const error = new Error('File type not allowed. Upload text, docs, source-code, image (JPG/PNG), audio (MP3), and MP4 files only.');
      error.statusCode = 400;
      cb(error);
      return;
    }

    cb(null, true);
  },
});

/**
 * POST /api/clip/create
 * Accepts multipart/form-data with optional files array "files"
 * 
 * Multer errors (e.g., LIMIT_FILE_SIZE) will be caught by the error handler middleware
 */
router.post('/create', (req, res, next) => {
  upload.array('files', 50)(req, res, (err) => {
    if (err) {
      // Pass multer errors to the error handler
      return next(err);
    }
    // Proceed to controller if no multer errors
    clipController.createClip(req, res, next);
  });
});

/**
 * GET /api/clip/download/:fileName
 * Forces file download as attachment
 */
router.get('/download/:fileName', clipController.downloadClipFile);

/**
 * POST /api/clip/bulk-delete
 * Bulk-deletes multiple clips and/or URLs
 */
router.post('/bulk-delete', clipController.bulkDeleteItems);

/**
 * GET /api/clip/:code
 * Retrieves a clip by its 4-digit code
 */
router.get('/:code', clipController.getClip);

/**
 * DELETE /api/clip/:code
 * Deletes a clip and associated uploaded files
 */
router.delete('/:code', clipController.deleteClip);

module.exports = router;
