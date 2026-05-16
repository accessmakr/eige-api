'use strict';

const logger = require('../utils/logger');

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000;
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX) || 30;

const ipMap = new Map();

function cleanup() {
  const now = Date.now();
  for (const [ip, data] of ipMap.entries()) {
    if (now - data.windowStart > WINDOW_MS) {
      ipMap.delete(ip);
    }
  }
}

setInterval(cleanup, WINDOW_MS);

function rateLimitMiddleware(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  if (!ipMap.has(ip)) {
    ipMap.set(ip, { windowStart: now, count: 1 });
    return next();
  }

  const data = ipMap.get(ip);

  if (now - data.windowStart > WINDOW_MS) {
    data.windowStart = now;
    data.count = 1;
    return next();
  }

  if (data.count >= MAX_REQUESTS) {
    logger.warn(`Rate limit hit for IP: ${ip}`);
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait before scanning again.' });
  }

  data.count++;
  return next();
}

module.exports = rateLimitMiddleware;
