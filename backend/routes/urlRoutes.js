const express = require('express');
const urlController = require('../controllers/urlController');

const router = express.Router();

/**
 * POST /api/url/shorten
 * Accepts JSON: { originalUrl, customSlug? }
 */
router.post('/shorten', urlController.shortenUrl);

/**
 * DELETE /api/url/:shortId
 * Deletes a shortened URL entry
 */
router.delete('/:shortId', urlController.deleteUrl);

module.exports = router;
