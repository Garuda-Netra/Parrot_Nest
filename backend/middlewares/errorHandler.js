/**
 * Centralised error-handling middleware.
 * Catches any error thrown or passed via next(err) in controllers.
 */
function isDatabaseUnavailableError(err) {
  if (!err) {
    return false;
  }

  const name = err.name || '';
  const message = err.message || '';

  return (
    name === 'MongoServerSelectionError' ||
    name === 'MongooseServerSelectionError' ||
    message.includes('buffering timed out after') ||
    message.includes('Server selection timed out')
  );
}

function errorHandler(err, _req, res, _next) {
  console.error('⚠️  Error:', err.message || err);

  if (isDatabaseUnavailableError(err)) {
    return res.status(503).json({
      success: false,
      message: 'Database is temporarily unavailable. Please try again shortly.',
      data: {},
    });
  }

  // Multer-specific errors (e.g. file too large)
  if (err.code === 'LIMIT_FILE_SIZE') {
    console.warn(`⚠️  Multer error: File size exceeds limit (${err.limit} bytes)`);
    return res.status(413).json({
      success: false,
      message: '❌ File exceeds the maximum allowed size of 10 MB per file. Please select smaller files.',
      data: {},
    });
  }

  // Multer field size limit error
  if (err.code === 'LIMIT_PART_COUNT') {
    console.warn(`⚠️  Multer error: Too many file parts`);
    return res.status(413).json({
      success: false,
      message: '❌ Too many files uploaded. Please upload fewer files.',
      data: {},
    });
  }

  // Multer unexpected file error
  if (err.code === 'UNEXPECTED_FILE') {
    console.warn(`⚠️  Multer error: Unexpected file in field "${err.field}"`);
    return res.status(400).json({
      success: false,
      message: '❌ Unexpected file field. Please upload files in the correct format.',
      data: {},
    });
  }

  // Mongoose validation / duplicate-key errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: err.message,
      data: {},
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'Duplicate entry detected. Please try a different value.',
      data: {},
    });
  }

  // Generic fallback
  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error.',
    data: {},
  });
}

module.exports = errorHandler;
