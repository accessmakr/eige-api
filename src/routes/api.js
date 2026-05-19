'use strict';

// ─── DEPENDENCIES ─────────────────────────────────────────────────────────────

const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate');
const scanHandler = require('../handlers/scan');
const compareHandler = require('../handlers/compare');
const clusterHandler = require('../handlers/cluster');
const telemetryHandler = require('../handlers/telemetry');
const graphHandler = require('../handlers/graph');
const logger = require('../utils/logger');

// ─── REQUEST ID GENERATOR ─────────────────────────────────────────────────────
// Generate a unique request ID for every API request.
// This ID is attached to every log entry produced during request processing
// so the complete lifecycle of any request can be traced through the logs
// by filtering on this ID. Essential for debugging issues in production
// where multiple requests are processed concurrently and their log entries
// are interleaved.

function generateRequestId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `req_${timestamp}_${random}`;
}

// ─── MODE TIMING LABELS ───────────────────────────────────────────────────────
// Human-readable labels for each mode used in performance logging.
// Timing data per mode helps identify which operations are slow
// and whether performance degrades over time as the database grows.

const MODE_LABELS = {
  scan: 'Website Stack Scan',
  compare: 'Domain Comparison',
  cluster: 'Cluster Classification',
  telemetry: 'System Telemetry',
  graph: 'Global Graph'
};

// ─── PERFORMANCE THRESHOLDS ───────────────────────────────────────────────────
// Define what constitutes a slow response for each mode.
// Scan and compare are inherently slower because they fetch external websites.
// Telemetry and graph read only from the local database and should be fast.
// Requests exceeding these thresholds are logged as warnings so performance
// regressions are immediately visible in the server logs.

const SLOW_THRESHOLD_MS = {
  scan: 8000,
  compare: 15000,
  cluster: 8000,
  telemetry: 2000,
  graph: 3000,
  default: 5000
};

// ─── MODE HANDLER REGISTRY ────────────────────────────────────────────────────
// Central registry mapping mode names to their handler functions.
// Adding a new mode in Phase 2 requires only:
//   1. Creating the handler file in src/handlers/
//   2. Importing it here
//   3. Adding it to this registry
//   4. Adding it to the VALID_MODES list in validate.js
// No other files need to change. This is the extensibility hook
// we designed for Phase 2 features — history, trends, monitor,
// competitive, and patterns modes will all register here.

const MODE_HANDLERS = {
  scan: scanHandler,
  compare: compareHandler,
  cluster: clusterHandler,
  telemetry: telemetryHandler,
  graph: graphHandler

  // ── Phase 2 handlers — registered here when built ──────────────────────
  // history: historyHandler,
  // trends: trendsHandler,
  // monitor: monitorHandler,
  // competitive: competitiveHandler,
  // patterns: patternsHandler
};

// ─── PRE-FLIGHT CHECKS ────────────────────────────────────────────────────────
// Verify that every registered mode has a corresponding handler.
// This runs once at module load time — if a handler is missing the
// server logs a clear warning immediately on startup rather than
// failing silently when that mode is first requested.

for (const [mode, handler] of Object.entries(MODE_HANDLERS)) {
  if (typeof handler !== 'function') {
    logger.warn(`API router — handler for mode "${mode}" is not a function. Requests to this mode will fail.`);
  }
}

logger.info(`API router initialised — ${Object.keys(MODE_HANDLERS).length} mode handlers registered: ${Object.keys(MODE_HANDLERS).join(', ')}`);

// ─── RESPONSE ENRICHMENT ──────────────────────────────────────────────────────
// Intercept the res.json method to automatically add metadata to every
// API response before it is sent. This ensures every response includes
// requestId, apiVersion, and any validation warnings regardless of
// which handler produced it. Handlers do not need to know about these
// fields — the router adds them transparently.
//
// This is implemented as a response wrapper rather than middleware
// because we need access to the response body after the handler
// produces it, which standard middleware cannot do cleanly.

function enrichResponse(req, res, requestId) {
  const originalJson = res.json.bind(res);

  res.json = function (body) {
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      if (!body.error) {
        body.requestId = body.requestId || requestId;
        body.apiVersion = 'v10';

        const warnings = res.locals.validationWarnings;
        if (warnings && warnings.length > 0) {
          body.warnings = warnings;
        }
      }
    }
    return originalJson(body);
  };
}

// ─── API ROUTE ────────────────────────────────────────────────────────────────
// Single POST endpoint that handles all API requests.
// The mode field in the request body determines which handler runs.
// validate middleware runs first — invalid requests never reach handlers.
// All timing, logging, and error handling is centralised here
// so individual handlers stay focused on their domain logic.

router.post('/', validate, async (req, res) => {
  const requestId = generateRequestId();
  const { mode } = req.body;
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const t0 = Date.now();

  enrichResponse(req, res, requestId);

  const modeLabel = MODE_LABELS[mode] || mode;
  const slowThreshold = SLOW_THRESHOLD_MS[mode] || SLOW_THRESHOLD_MS.default;

  logger.info(
    `[${requestId}] API request — mode: ${mode} (${modeLabel}), IP: ${ip}`
  );

  try {
    const handler = MODE_HANDLERS[mode];

    if (!handler || typeof handler !== 'function') {
      logger.error(`[${requestId}] No handler registered for mode: ${mode}`);
      return res.status(501).json({
        error: `Mode "${mode}" is recognised but has no handler registered — this is a server configuration issue`,
        code: 'ERR_NO_HANDLER',
        mode,
        requestId,
        timestamp: Date.now()
      });
    }

    await handler(req, res);

    const duration = Date.now() - t0;

    if (duration > slowThreshold) {
      logger.warn(
        `[${requestId}] SLOW REQUEST — mode: ${mode}, duration: ${duration}ms, threshold: ${slowThreshold}ms, IP: ${ip}`
      );
    } else {
      logger.info(
        `[${requestId}] Request complete — mode: ${mode}, duration: ${duration}ms, IP: ${ip}`
      );
    }

  } catch (err) {
    const duration = Date.now() - t0;

    logger.error(
      `[${requestId}] Unhandled handler error — mode: ${mode}, duration: ${duration}ms, IP: ${ip}: ${err.message}`
    );
    logger.error(`[${requestId}] Stack: ${err.stack}`);

    if (!res.headersSent) {
      return res.status(500).json({
        error: 'An unexpected error occurred while processing your request',
        code: 'ERR_HANDLER_EXCEPTION',
        mode,
        requestId,
        timestamp: Date.now()
      });
    }

    logger.error(`[${requestId}] Headers already sent — could not send error response`);
  }
});

// ─── OPTIONS PREFLIGHT ────────────────────────────────────────────────────────
// Handle CORS preflight requests explicitly on the API route.
// The CORS middleware handles OPTIONS globally but some clients send
// preflight requests specifically to /api rather than relying on
// the global handler. Responding explicitly here prevents preflight
// failures for strict CORS clients.

router.options('/', (req, res) => {
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(204).send();
});

// ─── METHOD NOT ALLOWED ───────────────────────────────────────────────────────
// Return 405 for any HTTP method other than POST and OPTIONS.
// Without this handler Express returns a generic 404 for GET /api
// which is misleading — the route exists, just the method is wrong.
// A clear 405 with the Allow header tells clients exactly what to do.

router.all('/', (req, res) => {
  if (req.method !== 'POST' && req.method !== 'OPTIONS') {
    logger.warn(`[api] Method not allowed: ${req.method} /api from IP: ${req.ip}`);
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({
      error: `Method ${req.method} is not allowed on this endpoint — use POST`,
      code: 'ERR_METHOD_NOT_ALLOWED',
      allowedMethods: ['POST', 'OPTIONS'],
      timestamp: Date.now()
    });
  }
});

module.exports = router;
