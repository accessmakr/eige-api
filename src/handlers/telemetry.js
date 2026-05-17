'use strict';

const { getCacheStats } = require('../db/cache');
const { getScanCount, getUniqueDomainCount } = require('../db/scans');
const { getPatternCount } = require('../db/patterns');
const { getCoOccurrenceStats } = require('../db/cooccurrence');
const { getClusterCount } = require('../db/clusters');
const logger = require('../utils/logger');

const startTime = Date.now();

function getUptimeMs() {
  return Date.now() - startTime;
}

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function getMemoryUsage() {
  const mem = process.memoryUsage();
  return {
    heapUsedMB: parseFloat((mem.heapUsed / 1024 / 1024).toFixed(2)),
    heapTotalMB: parseFloat((mem.heapTotal / 1024 / 1024).toFixed(2)),
    rssMB: parseFloat((mem.rss / 1024 / 1024).toFixed(2)),
    externalMB: parseFloat((mem.external / 1024 / 1024).toFixed(2))
  };
}

function getRateLimitStats(req) {
  try {
    const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000;
    const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX) || 10;

    return {
      windowMs: WINDOW_MS,
      maxRequests: MAX_REQUESTS,
      windowSeconds: Math.round(WINDOW_MS / 1000)
    };
  } catch (err) {
    return {
      windowMs: 60000,
      maxRequests: 10,
      windowSeconds: 60
    };
  }
}

async function telemetryHandler(req, res) {
  const t0 = Date.now();

  logger.info('Telemetry request received');

  try {
    const [
      cacheStats,
      scanCount,
      uniqueDomains,
      patternCount,
      coOccurrenceStats,
      clusterCount
    ] = await Promise.all([
      getCacheStats(),
      getScanCount(),
      getUniqueDomainCount(),
      getPatternCount(),
      getCoOccurrenceStats(),
      getClusterCount()
    ]);

    const uptimeMs = getUptimeMs();
    const memory = getMemoryUsage();
    const rateLimitStats = getRateLimitStats(req);

    const response = {
      mode: 'telemetry',
      latency: Date.now() - t0,
      cached: false,
      timestamp: Date.now(),

      cache: {
        entries: cacheStats.entries,
        maxEntries: cacheStats.maxEntries,
        ttlMs: cacheStats.ttlMs,
        ttlMinutes: Math.round(cacheStats.ttlMs / 60000)
      },

      learning: {
        domainsTracked: uniqueDomains,
        totalRecords: scanCount,
        activePatterns: patternCount,
        coOccurrencePairs: coOccurrenceStats.totalEdges
      },

      graph: {
        totalNodes: coOccurrenceStats.totalNodes,
        totalEdges: coOccurrenceStats.totalEdges,
        activeClusters: clusterCount
      },

      rateLimit: {
        windowMs: rateLimitStats.windowMs,
        windowSeconds: rateLimitStats.windowSeconds,
        maxRequests: rateLimitStats.maxRequests
      },

      runtime: {
        uptimeMs,
        uptimeFormatted: formatUptime(uptimeMs),
        nodeVersion: process.version,
        platform: process.platform,
        memoryMB: memory.heapUsedMB,
        heapTotalMB: memory.heapTotalMB,
        rssMB: memory.rssMB,
        adapter: 'supabase',
        environment: process.env.NODE_ENV || 'production'
      }
    };

    logger.info(`Telemetry served — ${scanCount} total scans, ${uniqueDomains} unique domains, uptime: ${formatUptime(uptimeMs)}`);

    return res.status(200).json(response);

  } catch (err) {
    logger.error(`Telemetry handler error: ${err.message}`);
    return res.status(500).json({
      error: `Telemetry failed — ${err.message}`
    });
  }
}

module.exports = telemetryHandler;
