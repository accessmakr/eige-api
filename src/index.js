'use strict';

// ─── ENVIRONMENT CONFIGURATION ────────────────────────────────────────────────
// Load environment variables before any other imports so all modules
// that read from process.env receive the correct values at initialisation time

require('dotenv').config();

// ─── CORE DEPENDENCIES ────────────────────────────────────────────────────────

const express = require('express');
const corsMiddleware = require('./middleware/cors');
const rateLimitMiddleware = require('./middleware/rateLimit');
const apiRouter = require('./routes/api');
const healthRouter = require('./routes/health');
const logger = require('./utils/logger');
const { startLearningSchedule, getLearningJobStatus } = require('./jobs/learning');

// ─── ENVIRONMENT VALIDATION ───────────────────────────────────────────────────
// Validate all required environment variables before the server starts.
// A missing variable causes silent failures deep in the application —
// failing loudly at startup is far safer and easier to debug.

const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_KEY'
];

const OPTIONAL_ENV_VARS_WITH_DEFAULTS = {
  PORT: '8080',
  NODE_ENV: 'production',
  ALLOWED_ORIGINS: '',
  RATE_LIMIT_WINDOW_MS: '60000',
  RATE_LIMIT_MAX: '10',
  CACHE_TTL_MS: '3600000'
};

function validateEnvironment() {
  const missing = [];
  const warnings = [];

  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  for (const [key, defaultValue] of Object.entries(OPTIONAL_ENV_VARS_WITH_DEFAULTS)) {
    if (!process.env[key]) {
      process.env[key] = defaultValue;
      warnings.push(`${key} not set — using default: ${defaultValue}`);
    }
  }

  if (missing.length > 0) {
    logger.error('═══════════════════════════════════════════════════════');
    logger.error('  FATAL — Missing required environment variables:');
    for (const key of missing) {
      logger.error(`  • ${key}`);
    }
    logger.error('  Add these variables to your .env file or deployment');
    logger.error('  environment and restart the server.');
    logger.error('═══════════════════════════════════════════════════════');
    process.exit(1);
  }

  for (const warning of warnings) {
    logger.warn(`Environment: ${warning}`);
  }

  logger.info('Environment validation passed — all required variables present');
}

// ─── APPLICATION CONSTANTS ────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT) || 8080;
const NODE_ENV = process.env.NODE_ENV || 'production';
const SERVER_START_TIME = Date.now();
const SERVER_VERSION = 'v10.0.0';

// ─── EXPRESS APPLICATION ──────────────────────────────────────────────────────

const app = express();

// ─── TRUST PROXY ─────────────────────────────────────────────────────────────
// Required for correct IP detection behind Cloudflare, Render, or any
// reverse proxy. Without this, req.ip returns the proxy IP not the client IP,
// breaking rate limiting per user. Only trust the first proxy in the chain.

app.set('trust proxy', 1);

// ─── SECURITY HARDENING ───────────────────────────────────────────────────────
// Remove the X-Powered-By header that Express adds by default.
// This header reveals the technology stack to potential attackers —
// removing it reduces information leakage at zero cost.

app.disable('x-powered-by');

// ─── GLOBAL MIDDLEWARE STACK ──────────────────────────────────────────────────
// Order matters — CORS must run before routes to handle OPTIONS preflight.
// Rate limiting runs after CORS so preflight requests are not rate-limited.
// JSON parsing runs after rate limiting to avoid parsing bodies that will
// be rejected anyway.

app.use(corsMiddleware);
app.use(rateLimitMiddleware);

app.use(express.json({
  limit: '1mb',
  strict: true,
  type: 'application/json'
}));

app.use(express.urlencoded({
  extended: false,
  limit: '1mb'
}));

// ─── REQUEST LOGGING MIDDLEWARE ───────────────────────────────────────────────
// Log every incoming request with method, path, IP, and user agent.
// This provides an audit trail for debugging and security analysis.
// Sensitive paths like /api are logged without body content to avoid
// logging user-submitted URLs or other potentially sensitive data.

app.use((req, res, next) => {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCategory = Math.floor(res.statusCode / 100);
    const statusLabel = statusCategory === 2 ? 'OK' :
      statusCategory === 4 ? 'CLIENT_ERROR' :
        statusCategory === 5 ? 'SERVER_ERROR' : 'REDIRECT';

    logger.info(
      `${req.method} ${req.path} → ${res.statusCode} ${statusLabel} ` +
      `[${duration}ms] IP:${ip} UA:${userAgent.substring(0, 60)}`
    );
  });

  next();
});

// ─── RESPONSE HEADERS MIDDLEWARE ─────────────────────────────────────────────
// Add security and identification headers to every response.
// These complement the security headers configured at the CDN/proxy level
// and ensure they are present even in direct-to-origin requests.

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-EIGE-Version', SERVER_VERSION);
  res.setHeader('X-EIGE-Node', `${process.env.NODE_ENV || 'production'}`);
  next();
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────

app.use('/health', healthRouter);
app.use('/api', apiRouter);

// ─── SERVER STATUS ENDPOINT ───────────────────────────────────────────────────
// Detailed server status for operators and monitoring tools.
// Returns more information than /health — including uptime, version,
// memory usage, and learning job status.
// This endpoint is intentionally more verbose than /health.

app.get('/status', (req, res) => {
  const uptimeMs = Date.now() - SERVER_START_TIME;
  const memory = process.memoryUsage();
  const learningStatus = getLearningJobStatus();

  res.status(200).json({
    status: 'operational',
    version: SERVER_VERSION,
    environment: NODE_ENV,
    timestamp: Date.now(),
    uptime: {
      ms: uptimeMs,
      seconds: Math.round(uptimeMs / 1000),
      minutes: Math.round(uptimeMs / 60000),
      hours: parseFloat((uptimeMs / 3600000).toFixed(2))
    },
    runtime: {
      node: process.version,
      platform: process.platform,
      arch: process.arch
    },
    memory: {
      heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
      rssMB: Math.round(memory.rss / 1024 / 1024),
      externalMB: Math.round(memory.external / 1024 / 1024)
    },
    learningJob: learningStatus,
    configuration: {
      port: PORT,
      rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS),
      rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX),
      cacheTtlMs: parseInt(process.env.CACHE_TTL_MS),
      allowedOriginsCount: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean).length
    }
  });
});

// ─── ROBOTS.TXT ───────────────────────────────────────────────────────────────
// Prevent search engines from indexing the API backend.
// The API is a service endpoint not a content site — indexing it serves
// no purpose and wastes crawl budget.

app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send('User-agent: *\nDisallow: /');
});

// ─── 404 HANDLER ─────────────────────────────────────────────────────────────
// Catch all unmatched routes. Returns a consistent JSON error response
// so API clients always receive JSON regardless of the path requested.
// Also logs the unmatched path for debugging and security analysis —
// repeated 404s on unusual paths can indicate probing or misconfiguration.

app.use((req, res) => {
  logger.warn(`404 — Route not found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
    method: req.method,
    timestamp: Date.now(),
    hint: 'Valid endpoints are POST /api and GET /health'
  });
});

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────────
// Catch any unhandled errors that propagate through the middleware chain.
// Express error handlers require exactly four parameters (err, req, res, next)
// even if next is not used — removing any parameter breaks error handling.
// Logs the full error stack for debugging while returning a safe message
// to the client without exposing internal implementation details.

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;

  logger.error(`Unhandled error on ${req.method} ${req.path}: ${err.message}`);
  logger.error(`Stack: ${err.stack}`);

  if (statusCode === 400 && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Invalid JSON in request body',
      timestamp: Date.now()
    });
  }

  if (statusCode === 413) {
    return res.status(413).json({
      error: 'Request body too large — maximum size is 1MB',
      timestamp: Date.now()
    });
  }

  res.status(statusCode).json({
    error: NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    timestamp: Date.now()
  });
});

// ─── GRACEFUL SHUTDOWN ────────────────────────────────────────────────────────
// Handle termination signals gracefully. When a process manager (like the one
// on Render or Cloud Run) sends SIGTERM to shut down the container, this gives
// in-flight requests time to complete before the process exits.
// Without graceful shutdown, active requests are cut off mid-response —
// leaving clients with incomplete or corrupted responses.
// The 10-second timeout ensures the server always exits even if a request hangs.

let httpServer = null;

function gracefulShutdown(signal) {
  logger.info(`${signal} received — starting graceful shutdown`);
  logger.info('Stopping new connections — allowing in-flight requests to complete');

  if (httpServer) {
    httpServer.close((err) => {
      if (err) {
        logger.error(`Error during graceful shutdown: ${err.message}`);
        process.exit(1);
      }

      logger.info('All connections closed — server shut down cleanly');
      process.exit(0);
    });

    setTimeout(() => {
      logger.warn('Graceful shutdown timeout exceeded (10s) — forcing exit');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ─── UNHANDLED REJECTION GUARD ────────────────────────────────────────────────
// Catch unhandled promise rejections and uncaught exceptions.
// Without these handlers Node.js exits silently on unhandled rejections
// in older versions, or prints a warning and continues in newer versions.
// In production it is better to log clearly and restart cleanly
// than to continue in a potentially corrupted state.

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Promise Rejection at: ${promise}`);
  logger.error(`Reason: ${reason}`);
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  logger.error(`Stack: ${err.stack}`);
  process.exit(1);
});

// ─── SERVER STARTUP ───────────────────────────────────────────────────────────
// Validate environment, start the HTTP server, then start the learning
// job scheduler. The learning job starts after the server is listening
// so the server is always available even if the learning job takes
// time to initialise its first run.

function startServer() {
  logger.info('═══════════════════════════════════════════════════════');
  logger.info(`  EIGE ${SERVER_VERSION} — Intelligence Engine Starting`);
  logger.info(`  Environment: ${NODE_ENV}`);
  logger.info(`  Node.js: ${process.version}`);
  logger.info('═══════════════════════════════════════════════════════');

  validateEnvironment();

  httpServer = app.listen(PORT, '0.0.0.0', () => {
    logger.info('═══════════════════════════════════════════════════════');
    logger.info(`  Server listening on port ${PORT}`);
    logger.info(`  Health check: GET /health`);
    logger.info(`  Status endpoint: GET /status`);
    logger.info(`  API endpoint: POST /api`);
    logger.info('═══════════════════════════════════════════════════════');

    startLearningSchedule();

    const { runAutoSeed } = require('./startup/seed');
    runAutoSeed().catch(err => {
      logger.warn(`Auto-seed error: ${err.message}`);
    });

    logger.info('EIGE v10 is fully operational');
  });

  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${PORT} is already in use — is another server instance running?`);
    } else {
      logger.error(`Server error: ${err.message}`);
    }
    process.exit(1);
  });

  httpServer.keepAliveTimeout = 65000;
  httpServer.headersTimeout = 66000;

  return httpServer;
}

startServer();

module.exports = app;
