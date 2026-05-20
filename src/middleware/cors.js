'use strict';

const cors = require('cors');
const logger = require('../utils/logger');

// ─── ALLOWED ORIGINS ──────────────────────────────────────────────────────────
// Parse the ALLOWED_ORIGINS environment variable into an array of allowed origins.
// Supports three modes:
//   1. Wildcard '*' — allow ALL origins (useful during development and testing)
//   2. Comma-separated list — allow specific origins only
//   3. Empty string — fall back to wildcard (permissive default)
//
// In production set ALLOWED_ORIGINS to your exact frontend URL:
//   ALLOWED_ORIGINS=https://aicitationscan.com
// Or multiple origins:
//   ALLOWED_ORIGINS=https://aicitationscan.com,https://www.aicitationscan.com
// Or wildcard for open access:
//   ALLOWED_ORIGINS=*

const rawOrigins = (process.env.ALLOWED_ORIGINS || '*').trim();
const isWildcard = rawOrigins === '*' || rawOrigins === '';
const allowedOrigins = isWildcard
  ? []
  : rawOrigins.split(',').map(o => o.trim()).filter(Boolean);

if (isWildcard) {
  logger.info('CORS: wildcard mode — all origins permitted');
} else {
  logger.info(`CORS: restricted mode — ${allowedOrigins.length} allowed origins: ${allowedOrigins.join(', ')}`);
}

// ─── CORS OPTIONS ─────────────────────────────────────────────────────────────

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin — curl, Postman, server-to-server, mobile apps
    if (!origin) {
      return callback(null, true);
    }

    // Wildcard mode — allow everything
    if (isWildcard) {
      return callback(null, true);
    }

    // Exact match check
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Prefix match — allows subdomains when configured
    // e.g. ALLOWED_ORIGINS=https://aicitationscan.com also allows
    // https://www.aicitationscan.com and https://app.aicitationscan.com
    const prefixMatch = allowedOrigins.some(allowed => {
      try {
        const allowedHost = new URL(allowed).hostname;
        const requestHost = new URL(origin).hostname;
        return requestHost === allowedHost || requestHost.endsWith('.' + allowedHost);
      } catch {
        return false;
      }
    });

    if (prefixMatch) {
      return callback(null, true);
    }

    logger.warn(`CORS blocked for origin: ${origin}`);
    callback(new Error(`CORS policy does not allow access from origin: ${origin}`));
  },

  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-RateLimit-Window',
    'X-EIGE-Version',
    'Retry-After'
  ],
  credentials: false,
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

const corsMiddleware = cors(corsOptions);

module.exports = corsMiddleware;
