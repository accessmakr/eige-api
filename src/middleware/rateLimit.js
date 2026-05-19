'use strict';

const logger = require('../utils/logger');

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
// Rate limit configuration is read from environment variables so it can
// be adjusted without code changes. Defaults are conservative — 10 requests
// per 60 seconds per IP for scan requests, higher for lightweight requests
// like health checks and telemetry which are cheap to serve.

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000;
const MAX_SCAN_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX) || 10;
const MAX_LIGHT_REQUESTS = MAX_SCAN_REQUESTS * 3;

// ─── BLOCK DURATION ───────────────────────────────────────────────────────────
// When an IP exceeds the rate limit it is blocked for BLOCK_DURATION_MS.
// Blocking for longer than the rate limit window discourages automated
// tools from simply waiting out the window and retrying.
// Default: 5 minutes (300,000ms)

const BLOCK_DURATION_MS = parseInt(process.env.RATE_LIMIT_BLOCK_MS) || 300000;

// ─── PROGRESSIVE PENALTY ──────────────────────────────────────────────────────
// Repeated violations within a session result in progressively longer blocks.
// First violation: BLOCK_DURATION_MS
// Second violation: BLOCK_DURATION_MS * 2
// Third+ violation: BLOCK_DURATION_MS * 4
// This exponential backoff discourages persistent automated abuse.

const PROGRESSIVE_MULTIPLIERS = [1, 2, 4, 8];

// ─── IN-MEMORY STORES ─────────────────────────────────────────────────────────
// ipData stores rate limit counters and window state per IP.
// blockedIPs stores block expiry times and violation counts per IP.
// Both are in-memory — they reset on server restart.
// For multi-instance deployments a Redis-backed store would be needed
// but for single-instance deployments on Render this is correct and efficient.

const ipData = new Map();
const blockedIPs = new Map();

// ─── LIGHTWEIGHT PATHS ────────────────────────────────────────────────────────
// These paths receive a higher rate limit because they are cheap to serve.
// Health checks are called every 30 seconds by the frontend status indicator.
// Applying strict scan limits to health checks would cause the status
// indicator to appear offline for legitimate users who have exhausted
// their scan quota.

const LIGHT_REQUEST_PATHS = new Set([
  '/health',
  '/status',
  '/robots.txt'
]);

// ─── LIGHT MODES ─────────────────────────────────────────────────────────────
// Telemetry and graph modes are read-only database queries — significantly
// cheaper than scan requests which fetch external websites.
// They receive the higher light request limit.

const LIGHT_MODES = new Set(['telemetry', 'graph']);

// ─── CLEANUP INTERVAL ─────────────────────────────────────────────────────────
// Periodically remove expired entries from both maps to prevent
// memory growth over long server uptime periods.
// Runs every 5 minutes — aggressive enough to prevent unbounded growth
// without adding noticeable CPU overhead.

setInterval(() => {
  const now = Date.now();
  let ipDataCleaned = 0;
  let blockedCleaned = 0;

  for (const [ip, data] of ipData.entries()) {
    if (now - data.windowStart > WINDOW_MS * 2) {
      ipData.delete(ip);
      ipDataCleaned++;
    }
  }

  for (const [ip, blockData] of blockedIPs.entries()) {
    if (now > blockData.expiresAt) {
      blockedIPs.delete(ip);
      blockedCleaned++;
    }
  }

  if (ipDataCleaned > 0 || blockedCleaned > 0) {
    logger.info(
      `Rate limit cleanup — removed ${ipDataCleaned} expired windows, ${blockedCleaned} expired blocks`
    );
  }
}, 300000);

// ─── IP EXTRACTION ────────────────────────────────────────────────────────────
// Extract the real client IP from the request.
// Behind Cloudflare the real IP is in CF-Connecting-IP.
// Behind other proxies (Render, load balancers) it is in X-Forwarded-For.
// The X-Forwarded-For header may contain multiple IPs — the first one
// is the original client IP (subsequent ones are proxy IPs).
// Falls back to the socket remote address for direct connections.

function extractClientIP(req) {
  const cfIP = req.headers['cf-connecting-ip'];
  if (cfIP && cfIP.trim()) return cfIP.trim();

  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const firstIP = forwardedFor.split(',')[0].trim();
    if (firstIP) return firstIP;
  }

  const realIP = req.headers['x-real-ip'];
  if (realIP && realIP.trim()) return realIP.trim();

  return req.socket?.remoteAddress || req.ip || 'unknown';
}

// ─── DETERMINE REQUEST WEIGHT ─────────────────────────────────────────────────
// Determine whether a request is a heavy scan request or a lightweight request.
// Heavy requests consume the stricter scan quota.
// Light requests consume the more generous light quota.
// This allows operators to keep checking health and telemetry
// even after exhausting their scan quota.

function isLightRequest(req) {
  if (LIGHT_REQUEST_PATHS.has(req.path)) return true;

  if (req.path === '/api' && req.body && LIGHT_MODES.has(req.body.mode)) {
    return true;
  }

  return false;
}

// ─── CALCULATE BLOCK DURATION ─────────────────────────────────────────────────
// Calculate the block duration for this violation using progressive penalties.
// First offence gets the base block duration.
// Repeat offenders get exponentially longer blocks.

function calculateBlockDuration(violationCount) {
  const multiplierIndex = Math.min(
    violationCount,
    PROGRESSIVE_MULTIPLIERS.length - 1
  );
  return BLOCK_DURATION_MS * PROGRESSIVE_MULTIPLIERS[multiplierIndex];
}

// ─── FORMAT DURATION ──────────────────────────────────────────────────────────
// Format a duration in milliseconds into a human-readable string
// for the error message returned to the client.

function formatDuration(ms) {
  if (ms < 60000) return `${Math.round(ms / 1000)} seconds`;
  if (ms < 3600000) return `${Math.round(ms / 60000)} minutes`;
  return `${Math.round(ms / 3600000)} hours`;
}

// ─── GET RATE LIMIT STATS ─────────────────────────────────────────────────────
// Return current rate limit state for the telemetry handler.
// Provides visibility into how many IPs are being tracked and blocked.

function getRateLimitStats() {
  const now = Date.now();
  const activeIPs = ipData.size;

  const activeBlocks = [];
  const expiredBlocks = [];

  for (const [ip, blockData] of blockedIPs.entries()) {
    if (now < blockData.expiresAt) {
      activeBlocks.push({
        ip: ip.substring(0, 8) + '...',
        expiresIn: Math.round((blockData.expiresAt - now) / 1000),
        violations: blockData.violationCount
      });
    } else {
      expiredBlocks.push(ip);
    }
  }

  return {
    activeIPs,
    blockedIPs: activeBlocks.length,
    totalViolations: [...blockedIPs.values()].reduce(
      (sum, b) => sum + b.violationCount, 0
    ),
    windowMs: WINDOW_MS,
    maxScanRequests: MAX_SCAN_REQUESTS,
    maxLightRequests: MAX_LIGHT_REQUESTS,
    blockDurationMs: BLOCK_DURATION_MS,
    topViolators: activeBlocks
      .sort((a, b) => b.violations - a.violations)
      .slice(0, 5)
  };
}

// ─── RATE LIMIT MIDDLEWARE ────────────────────────────────────────────────────

function rateLimitMiddleware(req, res, next) {
  const now = Date.now();
  const ip = extractClientIP(req);
  const light = isLightRequest(req);
  const maxRequests = light ? MAX_LIGHT_REQUESTS : MAX_SCAN_REQUESTS;

  // ── Check if IP is currently blocked ──────────────────────────────────────
  // Blocked IPs are rejected immediately without incrementing any counter.
  // The block expiry is checked on every request — expired blocks are
  // cleared lazily here in addition to the periodic cleanup interval.

  if (blockedIPs.has(ip)) {
    const blockData = blockedIPs.get(ip);

    if (now < blockData.expiresAt) {
      const remainingMs = blockData.expiresAt - now;
      const remainingFormatted = formatDuration(remainingMs);

      logger.warn(
        `Rate limit — blocked IP: ${ip}, ` +
        `remaining: ${remainingFormatted}, ` +
        `violations: ${blockData.violationCount}`
      );

      res.setHeader('Retry-After', Math.ceil(remainingMs / 1000));
      res.setHeader('X-RateLimit-Blocked', 'true');
      res.setHeader('X-RateLimit-Reset', Math.ceil(blockData.expiresAt / 1000));

      return res.status(429).json({
        error: `Too many requests. Your IP has been temporarily blocked for ${remainingFormatted}. Please wait before trying again.`,
        code: 'ERR_RATE_LIMIT_BLOCKED',
        retryAfterMs: remainingMs,
        retryAfterFormatted: remainingFormatted,
        violationCount: blockData.violationCount,
        timestamp: Date.now()
      });

    } else {
      blockedIPs.delete(ip);
      logger.info(`Rate limit — block expired and cleared for IP: ${ip}`);
    }
  }

  // ── Check and update sliding window counter ────────────────────────────────
  // Each IP gets a sliding window of WINDOW_MS milliseconds.
  // The window resets when the first request in a new window arrives.
  // Requests within an active window increment the counter.
  // When the counter exceeds maxRequests the IP is blocked.

  if (!ipData.has(ip)) {
    ipData.set(ip, {
      windowStart: now,
      scanCount: 0,
      lightCount: 0,
      totalCount: 0
    });
  }

  const data = ipData.get(ip);

  if (now - data.windowStart > WINDOW_MS) {
    data.windowStart = now;
    data.scanCount = 0;
    data.lightCount = 0;
    data.totalCount = 0;
  }

  if (light) {
    data.lightCount++;
  } else {
    data.scanCount++;
  }
  data.totalCount++;

  const currentCount = light ? data.lightCount : data.scanCount;
  const remaining = Math.max(0, maxRequests - currentCount);
  const windowResetAt = data.windowStart + WINDOW_MS;

  res.setHeader('X-RateLimit-Limit', maxRequests);
  res.setHeader('X-RateLimit-Remaining', remaining);
  res.setHeader('X-RateLimit-Reset', Math.ceil(windowResetAt / 1000));
  res.setHeader('X-RateLimit-Window', WINDOW_MS);

  if (currentCount > maxRequests) {
    const existingBlock = blockedIPs.get(ip);
    const violationCount = existingBlock ? existingBlock.violationCount + 1 : 1;
    const blockDuration = calculateBlockDuration(violationCount - 1);
    const blockExpiresAt = now + blockDuration;
    const blockDurationFormatted = formatDuration(blockDuration);

    blockedIPs.set(ip, {
      violationCount,
      expiresAt: blockExpiresAt,
      firstViolation: existingBlock?.firstViolation || now,
      lastViolation: now
    });

    logger.warn(
      `Rate limit exceeded — IP: ${ip}, ` +
      `violation #${violationCount}, ` +
      `blocked for ${blockDurationFormatted}, ` +
      `window count: ${currentCount}/${maxRequests}, ` +
      `type: ${light ? 'light' : 'scan'}`
    );

    res.setHeader('Retry-After', Math.ceil(blockDuration / 1000));
    res.setHeader('X-RateLimit-Blocked', 'true');

    return res.status(429).json({
      error: `Rate limit exceeded. You have been blocked for ${blockDurationFormatted}. Please wait before scanning again.`,
      code: 'ERR_RATE_LIMIT_EXCEEDED',
      retryAfterMs: blockDuration,
      retryAfterFormatted: blockDurationFormatted,
      violationCount,
      limit: maxRequests,
      windowMs: WINDOW_MS,
      timestamp: Date.now()
    });
  }

  if (remaining <= 2 && remaining > 0) {
    logger.info(
      `Rate limit warning — IP: ${ip}, ` +
      `${remaining} ${light ? 'light' : 'scan'} request${remaining === 1 ? '' : 's'} remaining in window`
    );
  }

  next();
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = rateLimitMiddleware;
module.exports.getRateLimitStats = getRateLimitStats;
