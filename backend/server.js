const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({
  path: path.join(__dirname, '.env'),
});

const connectDB = require('./config/db');
const clipRoutes = require('./routes/clipRoutes');
const urlRoutes = require('./routes/urlRoutes');
const urlController = require('./controllers/urlController');
const errorHandler = require('./middlewares/errorHandler');

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseCorsOrigins(rawOrigins) {
  if (!rawOrigins || rawOrigins.trim() === '*') {
    return '*';
  }

  const origins = rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : '*';
}

function validateRequiredEnv() {
  const requiredKeys = ['MONGO_URI', 'BASE_URL'];
  const missing = requiredKeys.filter((key) => !process.env[key] || !process.env[key].trim());

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

function looksPlaceholderValue(value) {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return [
    'your-backend-name.onrender.com',
    'your-frontend-name.vercel.app',
    'example.com',
    'replace-me',
    'changeme',
  ].some((needle) => normalized.includes(needle));
}

function warnPlaceholderLikeEnvValues() {
  const checks = [
    {
      key: 'BASE_URL',
      values: [process.env.BASE_URL],
    },
    {
      key: 'PUBLIC_LINK_BASE_URL',
      values: [process.env.PUBLIC_LINK_BASE_URL],
    },
    {
      key: 'CORS_ORIGINS',
      values: (process.env.CORS_ORIGINS || '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    },
  ];

  for (const check of checks) {
    for (const value of check.values) {
      if (!looksPlaceholderValue(value)) {
        continue;
      }

      console.warn(
        `[config warning] ${check.key} appears to use a placeholder value: ${value}. Update deployment environment values before production use.`,
      );
    }
  }
}

const app = express();

// Render/Vercel run behind reverse proxies, so trust forwarded headers.
// This prevents express-rate-limit from misreading client IP information.
app.set('trust proxy', 1);

// ── Global Middleware ───────────────────────────────────────
app.use(helmet());                       // security headers
app.use(cors({
  origin: parseCorsOrigins(process.env.CORS_ORIGINS),
}));                                     // enable CORS for frontend
app.use(morgan('dev'));                   // request logging
app.use(express.json({ limit: '1mb' }));                 // parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '1mb' })); // parse form bodies

// ── Rate Limiter ────────────────────────────────────────────
const rateLimitWindowSeconds = parsePositiveInt(process.env.RATE_LIMIT_WINDOW_SECONDS, 15 * 60);
const rateLimitRequests = parsePositiveInt(process.env.RATE_LIMIT_REQUESTS, 100);

const apiLimiter = rateLimit({
  windowMs: rateLimitWindowSeconds * 1000,
  max: rateLimitRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
    data: {},
  },
});
app.use('/api/', apiLimiter);

// ── API Routes ──────────────────────────────────────────────
app.use('/api/clip', clipRoutes);
app.use('/api/url', urlRoutes);

// ── Short URL redirect (must be after /api) ─────────────────
app.get('/:shortId', urlController.redirectUrl);

// ── Health Check ────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'ParrotShare API is running.',
    data: { version: '1.0.0' },
  });
});

// ── Centralised Error Handler ───────────────────────────────
app.use(errorHandler);

// ── Start Server ────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    warnPlaceholderLikeEnvValues();
    validateRequiredEnv();
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error(`❌ Startup aborted: ${err.message}`);
    process.exit(1);
  }
}

startServer();
