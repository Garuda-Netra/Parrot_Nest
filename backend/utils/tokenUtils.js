const crypto = require('crypto');

/**
 * Generate a cryptographically secure delete token (48 hex characters).
 */
function generateDeleteToken() {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Hash a delete token using SHA256.
 */
function hashDeleteToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Validate that a delete token is a non-empty string.
 */
function isValidDeleteToken(token) {
  return typeof token === 'string' && token.trim().length > 0;
}

/**
 * Extract delete token from request headers or body.
 * Checks 'x-delete-token' header first, then req.body.deleteToken.
 */
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

/**
 * Timing-safe comparison of a plain token against its SHA256 hash.
 */
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

module.exports = {
  generateDeleteToken,
  hashDeleteToken,
  isValidDeleteToken,
  getDeleteTokenFromRequest,
  isDeleteTokenMatch,
};
