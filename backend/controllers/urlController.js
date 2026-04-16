const Url = require('../models/Url');
const crypto = require('crypto');
const mongoose = require('mongoose');
const QRCode = require('qrcode');

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

const RESTRICTED_SLUGS = [
  'instagram', 'google', 'facebook',
  'admin', 'login', 'support',
  'api', 'uploads',                   // also reserve internal paths
];

/**
 * Validate URL format (must begin with http:// or https://).
 */
function isValidHttpUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validate slug characters (lowercase, digits, hyphen only).
 */
function isValidSlug(slug) {
  return /^[a-z0-9-]+$/.test(slug);
}

/**
 * Generate a short random ID (6 chars, URL-safe).
 */
function generateShortId() {
  return crypto.randomBytes(4).toString('base64url').slice(0, 6);
}

function parseUrlExpiry(expiry) {
  const map = {
    '5m': 5 * 60 * 1000,
    '20m': 20 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
  };

  return map[expiry] ?? map['1h'];
}

function isValidUrlExpiryChoice(expiry) {
  if (!expiry) {
    return true;
  }

  return ['5m', '20m', '1h', '1d'].includes(expiry);
}

function isUrlExpired(expiresAt) {
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
 * POST /api/url/shorten
 *
 * Body (JSON):
 *   - originalUrl : string  (required)
 *   - customSlug  : string  (optional)
 */
exports.shortenUrl = async (req, res, next) => {
  try {
    let { originalUrl, customSlug, expiry } = req.body;
    const normalizedExpiry = typeof expiry === 'string' ? expiry.trim() : '';

    // --- originalUrl validation ---
    if (!originalUrl || !isValidHttpUrl(originalUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid URL. Must start with http:// or https://.',
        data: {},
      });
    }

    if (!ensureDatabaseReady(res)) {
      return;
    }

    if (!isValidUrlExpiryChoice(normalizedExpiry)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid self-destruct mode. Allowed values are 5m, 20m, 1h, or 1d.',
        data: {},
      });
    }

    expiry = normalizedExpiry || '1h';

    // --- customSlug handling ---
    let shortId;

    if (customSlug) {
      customSlug = customSlug.trim().toLowerCase();

      if (!isValidSlug(customSlug)) {
        return res.status(400).json({
          success: false,
          message: 'Slug may only contain lowercase letters, numbers, and hyphens.',
          data: {},
        });
      }

      if (RESTRICTED_SLUGS.includes(customSlug)) {
        return res.status(400).json({
          success: false,
          message: 'This identifier is restricted to prevent misuse.',
          data: {},
        });
      }

      // Anti-misuse: slug looks like a brand name but destination doesn't match
      const brandDomains = {
        instagram: 'instagram.com',
        google: 'google.com',
        facebook: 'facebook.com',
      };
      for (const [brand, domain] of Object.entries(brandDomains)) {
        if (customSlug.includes(brand) && !originalUrl.includes(domain)) {
          return res.status(400).json({
            success: false,
            message: `This may be misleading. Slug contains "${brand}" but destination is not ${domain}. Please choose a different identifier.`,
            data: {},
          });
        }
      }

      const existing = await Url.findOne({ shortId: customSlug });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'URL already taken. Please choose a different slug.',
          data: {},
        });
      }

      shortId = customSlug;
    } else {
      // Generate random shortId, ensuring uniqueness
      let exists = true;
      let attempts = 0;
      while (exists && attempts < 20) {
        shortId = generateShortId();
        exists = await Url.findOne({ shortId });
        attempts++;
      }
      if (exists) {
        return res.status(500).json({
          success: false,
          message: 'Unable to generate a unique short ID. Try again.',
          data: {},
        });
      }
    }

    const expiryMs = parseUrlExpiry(expiry);
    const expiresAt = new Date(Date.now() + expiryMs);
    const deleteToken = generateDeleteToken();
    const url = await Url.create({
      originalUrl,
      shortId,
      deleteTokenHash: hashDeleteToken(deleteToken),
      expiresAt,
    });

    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    const shortUrl = `${baseUrl}/${url.shortId}`;
    let qrCodeDataUri = '';

    try {
      qrCodeDataUri = await QRCode.toDataURL(shortUrl, {
        errorCorrectionLevel: 'M',
        width: 220,
        margin: 1,
      });

    } catch (qrErr) {
      console.warn(`⚠️  QR generation failed for shortId=${url.shortId}: ${qrErr.message}`);
      qrCodeDataUri = '';
    }

    return res.status(201).json({
      success: true,
      message: 'URL shortened successfully.',
      data: {
        shortUrl,
        qrCodeDataUri,
        shortId: url.shortId,
        originalUrl: url.originalUrl,
        deleteToken,
        expiresAt: url.expiresAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /:shortId
 *
 * Redirects to the original URL.
 */
exports.redirectUrl = async (req, res, next) => {
  try {
    const { shortId } = req.params;

    if (!ensureDatabaseReady(res)) {
      return;
    }

    const url = await Url.findOne({ shortId });

    if (!url) {
      return res.status(404).json({
        success: false,
        message: 'Short URL not found.',
        data: {},
      });
    }

    if (isUrlExpired(url.expiresAt)) {
      await url.deleteOne();
      return res.status(404).json({
        success: false,
        message: 'Short URL has expired and self-destructed.',
        data: {},
      });
    }

    // Increment click counter (fire-and-forget)
    url.clicks += 1;
    url.save().catch((saveErr) => {
      console.warn(`⚠️  Failed to update click count for shortId=${shortId}: ${saveErr.message}`);
    });

    return res.redirect(url.originalUrl);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/url/:shortId
 *
 * Deletes a shortened URL entry when delete token matches.
 */
exports.deleteUrl = async (req, res, next) => {
  try {
    const { shortId } = req.params;

    if (!shortId || !isValidSlug(shortId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid short ID format.',
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

    const url = await Url.findOne({ shortId });
    if (!url) {
      return res.status(404).json({
        success: false,
        message: 'Short URL not found or already deleted.',
        data: {},
      });
    }

    if (!isDeleteTokenMatch(deleteToken, url.deleteTokenHash)) {
      return res.status(403).json({
        success: false,
        message: 'You are not allowed to delete this short URL.',
        data: {},
      });
    }

    await url.deleteOne();

    return res.status(200).json({
      success: true,
      message: 'Short URL deleted successfully.',
      data: {},
    });
  } catch (err) {
    next(err);
  }
};
