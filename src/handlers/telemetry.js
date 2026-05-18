'use strict';

// ─── DEPENDENCIES ─────────────────────────────────────────────────────────────

const { getCacheStats } = require('../db/cache');
const { getScanCount, getUniqueDomainCount } = require('../db/scans');
const { getPatternCount } = require('../db/patterns');
const { getCoOccurrenceStats } = require('../db/cooccurrence');
const { getClusterCount } = require('../db/clusters');
const { getLearningJobStatus } = require('../jobs/learning');
const logger = require('../utils/logger');

// ─── SERVER START TIME ────────────────────────────────────────────────────────
// Captured at module load time so uptime is calculated from when the
// telemetry module was first required — which is effectively server start.
// This is consistent across all requests to the telemetry endpoint.

const MODULE_LOAD_TIME = Date.now();

// ─── MEMORY TREND TRACKING ────────────────────────────────────────────────────
// Track memory usage over time to detect memory leaks.
// A growing heap that never decreases is a strong signal of a memory leak.
// We store the last 24 readings (one per hour if telemetry is called hourly)
// and calculate the trend — positive trend means memory is growing.

const MEMORY_READINGS = [];
const MAX_MEMORY_READINGS = 24;

function recordMemoryReading() {
  const memory = process.memoryUsage();
  const reading = {
    timestamp: Date.now(),
    heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
    rssMB: Math.round(memory.rss / 1024 / 1024),
    externalMB: Math.round(memory.external / 1024 / 1024)
  };

  MEMORY_READINGS.push(reading);

  if (MEMORY_READINGS.length > MAX_MEMORY_READINGS) {
    MEMORY_READINGS.shift();
  }

  return reading;
}

function calculateMemoryTrend() {
  if (MEMORY_READINGS.length < 3) {
    return {
      trend: 'insufficient_data',
      trendLabel: 'Collecting data',
      readingCount: MEMORY_READINGS.length,
      readings: MEMORY_READINGS
    };
  }

  const firstThird = MEMORY_READINGS.slice(0, Math.floor(MEMORY_READINGS.length / 3));
  const lastThird = MEMORY_READINGS.slice(-Math.floor(MEMORY_READINGS.length / 3));

  const avgFirst = firstThird.reduce((sum, r) => sum + r.heapUsedMB, 0) / firstThird.length;
  const avgLast = lastThird.reduce((sum, r) => sum + r.heapUsedMB, 0) / lastThird.length;

  const changePercent = ((avgLast - avgFirst) / avgFirst) * 100;

  let trend;
  let trendLabel;

  if (changePercent > 20) {
    trend = 'growing_fast';
    trendLabel = `Memory growing rapidly (+${changePercent.toFixed(1)}%) — possible memory leak`;
  } else if (changePercent > 10) {
    trend = 'growing';
    trendLabel = `Memory growing moderately (+${changePercent.toFixed(1)}%)`;
  } else if (changePercent < -10) {
    trend = 'shrinking';
    trendLabel = `Memory shrinking (${changePercent.toFixed(1)}%) — garbage collection active`;
  } else {
    trend = 'stable';
    trendLabel = `Memory stable (${changePercent.toFixed(1)}% change)`;
  }

  return {
    trend,
    trendLabel,
    changePercent: parseFloat(changePercent.toFixed(2)),
    averageFirstThirdMB: Math.round(avgFirst),
    averageLastThirdMB: Math.round(avgLast),
    readingCount: MEMORY_READINGS.length,
    readings: MEMORY_READINGS.slice(-5)
  };
}

// ─── REQUEST RATE TRACKING ────────────────────────────────────────────────────
// Track API request rates over time to understand usage patterns
// and detect unusual traffic spikes.

const REQUEST_HISTORY = [];
const MAX_REQUEST_HISTORY = 60;
let totalRequestCount = 0;

function recordRequest() {
  totalRequestCount++;
  const now = Date.now();
  REQUEST_HISTORY.push(now);

  const oneMinuteAgo = now - 60000;
  while (REQUEST_HISTORY.length > 0 && REQUEST_HISTORY[0] < oneMinuteAgo) {
    REQUEST_HISTORY.shift();
  }

  if (REQUEST_HISTORY.length > MAX_REQUEST_HISTORY) {
    REQUEST_HISTORY.splice(0, REQUEST_HISTORY.length - MAX_REQUEST_HISTORY);
  }
}

function calculateRequestRate() {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  const fiveMinutesAgo = now - 300000;

  const requestsLastMinute = REQUEST_HISTORY.filter(t => t > oneMinuteAgo).length;
  const requestsLastFiveMinutes = REQUEST_HISTORY.filter(t => t > fiveMinutesAgo).length;

  return {
    totalLifetime: totalRequestCount,
    lastMinute: requestsLastMinute,
    lastFiveMinutes: requestsLastFiveMinutes,
    perMinuteAverage: parseFloat((requestsLastFiveMinutes / 5).toFixed(1))
  };
}

// ─── HEALTH SCORING ───────────────────────────────────────────────────────────
// Calculate an overall system health score from 0 to 100.
// This gives operators a single at-a-glance indicator of system health
// without needing to interpret all individual metrics.
// The score degrades automatically as problems accumulate.

function calculateHealthScore(metrics) {
  let score = 100;
  const issues = [];

  if (metrics.memory.heapUsedMB > 400) {
    score -= 20;
    issues.push(`High memory usage: ${metrics.memory.heapUsedMB}MB heap`);
  } else if (metrics.memory.heapUsedMB > 250) {
    score -= 10;
    issues.push(`Elevated memory usage: ${metrics.memory.heapUsedMB}MB heap`);
  }

  if (metrics.memoryTrend.trend === 'growing_fast') {
    score -= 25;
    issues.push('Memory growing rapidly — possible leak');
  } else if (metrics.memoryTrend.trend === 'growing') {
    score -= 10;
    issues.push('Memory growing moderately');
  }

  if (metrics.cache.entries === 0 && metrics.learning.totalRecords > 10) {
    score -= 10;
    issues.push('Cache is empty despite scan history — cache may have been cleared or is misconfigured');
  }

  if (metrics.learning.activePatterns === 0) {
    score -= 20;
    issues.push('No tech patterns in database — seed_patterns.js has not been run');
  } else if (metrics.learning.activePatterns < 50) {
    score -= 10;
    issues.push(`Only ${metrics.learning.activePatterns} patterns loaded — seed_patterns.js may be incomplete`);
  }

  if (metrics.graph.activeClusters === 0) {
    score -= 15;
    issues.push('No clusters in database — seed_clusters.js has not been run');
  }

  if (metrics.learningJob.running) {
    issues.push('Learning job is currently running — this is normal if it just started');
  }

  const uptimeHours = metrics.runtime.uptimeMs / 3600000;
  if (uptimeHours < 0.1) {
    issues.push('Server recently restarted — metrics may not yet be representative');
  }

  const healthScore = Math.max(0, Math.min(100, score));
  let healthLabel;
  let healthStatus;

  if (healthScore >= 90) {
    healthStatus = 'excellent';
    healthLabel = 'All systems operating optimally';
  } else if (healthScore >= 75) {
    healthStatus = 'good';
    healthLabel = 'Systems operating well with minor observations';
  } else if (healthScore >= 55) {
    healthStatus = 'degraded';
    healthLabel = 'System performance degraded — review issues';
  } else if (healthScore >= 30) {
    healthStatus = 'poor';
    healthLabel = 'System health poor — immediate attention recommended';
  } else {
    healthStatus = 'critical';
    healthLabel = 'Critical system issues detected — intervention required';
  }

  return {
    score: healthScore,
    status: healthStatus,
    label: healthLabel,
    issues
  };
}

// ─── DATABASE HEALTH CHECKS ───────────────────────────────────────────────────
// Verify that each database table is accessible and returning data.
// These checks run in parallel to minimise telemetry response time.
// Each check has a timeout so a slow table does not block the entire response.

async function checkDatabaseHealth() {
  const checks = {};

  const runCheck = async (name, fn) => {
    try {
      const start = Date.now();
      const result = await Promise.race([
        fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout after 5000ms')), 5000)
        )
      ]);
      checks[name] = {
        status: 'ok',
        latencyMs: Date.now() - start,
        value: result
      };
    } catch (err) {
      checks[name] = {
        status: 'error',
        error: err.message,
        latencyMs: null
      };
    }
  };

  await Promise.all([
    runCheck('cache', getCacheStats),
    runCheck('scans_count', getScanCount),
    runCheck('unique_domains', getUniqueDomainCount),
    runCheck('patterns', getPatternCount),
    runCheck('cooccurrence', getCoOccurrenceStats),
    runCheck('clusters', getClusterCount)
  ]);

  const allHealthy = Object.values(checks).every(c => c.status === 'ok');
  const errorCount = Object.values(checks).filter(c => c.status === 'error').length;

  return {
    allHealthy,
    errorCount,
    checks
  };
}

// ─── UPTIME FORMATTING ────────────────────────────────────────────────────────
// Human-readable uptime string that updates its unit based on duration.
// Makes the telemetry panel immediately readable without mental arithmetic.

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

// ─── SYSTEM CAPABILITY REPORT ─────────────────────────────────────────────────
// Report what the system is capable of based on current configuration.
// This helps operators quickly understand which features are active
// and which require additional setup.

function generateCapabilityReport(dbHealth, learningStatus) {
  const capabilities = [];
  const limitations = [];

  if (dbHealth.checks.patterns?.value > 100) {
    capabilities.push(`Technology fingerprinting active — ${dbHealth.checks.patterns.value} detection patterns loaded`);
  } else if (dbHealth.checks.patterns?.value > 0) {
    limitations.push(`Only ${dbHealth.checks.patterns?.value} patterns loaded — run seed_patterns.js for full detection capability`);
  } else {
    limitations.push('Technology fingerprinting unavailable — patterns database is empty');
  }

  if (dbHealth.checks.clusters?.value > 10) {
    capabilities.push(`Ecosystem cluster classification active — ${dbHealth.checks.clusters.value} archetypes defined`);
  } else {
    limitations.push('Cluster classification limited — run seed_clusters.js to populate cluster definitions');
  }

  if (dbHealth.checks.cooccurrence?.value?.totalEdges > 50) {
    capabilities.push(`Global relationship graph active — ${dbHealth.checks.cooccurrence.value.totalNodes} nodes, ${dbHealth.checks.cooccurrence.value.totalEdges} edges`);
  } else if (dbHealth.checks.cooccurrence?.value?.totalEdges > 0) {
    capabilities.push(`Global relationship graph building — ${dbHealth.checks.cooccurrence.value.totalEdges} edges so far`);
  } else {
    limitations.push('Global relationship graph empty — will populate automatically as scans accumulate');
  }

  if (dbHealth.checks.cache?.status === 'ok') {
    capabilities.push(`Response caching active — ${dbHealth.checks.cache.value.entries} entries, ${Math.round(dbHealth.checks.cache.value.ttlMs / 60000)} minute TTL`);
  } else {
    limitations.push('Cache table unavailable — every request hits the origin without caching');
  }

  if (dbHealth.checks.scans_count?.value > 0) {
    capabilities.push(`Adaptive learning active — ${dbHealth.checks.scans_count.value} scans stored for pattern improvement`);
  } else {
    capabilities.push('Adaptive learning ready — will activate after first successful scan');
  }

  if (!learningStatus.running && learningStatus.lastRunTime) {
    capabilities.push(`Intelligence learning job last completed: ${new Date(learningStatus.lastRunTime).toISOString()}`);
  } else if (learningStatus.running) {
    capabilities.push('Intelligence learning job currently running — database being updated');
  } else {
    capabilities.push(`Intelligence learning job scheduled — first run in approximately ${Math.round((60000 - (Date.now() % 60000)) / 1000)}s`);
  }

  return { capabilities, limitations };
}

// ─── TELEMETRY HANDLER ────────────────────────────────────────────────────────

async function telemetryHandler(req, res) {
  const t0 = Date.now();

  logger.info('Telemetry request received — collecting system metrics');

  try {
    recordRequest();

    const currentMemory = recordMemoryReading();
    const memoryTrend = calculateMemoryTrend();
    const requestRate = calculateRequestRate();
    const learningStatus = getLearningJobStatus();
    const uptimeMs = Date.now() - MODULE_LOAD_TIME;

    const dbHealth = await checkDatabaseHealth();

    const cacheStats = dbHealth.checks.cache?.value || { entries: 0, maxEntries: 500, ttlMs: 0 };
    const scanCount = dbHealth.checks.scans_count?.value || 0;
    const uniqueDomainCount = dbHealth.checks.unique_domains?.value || 0;
    const patternCount = dbHealth.checks.patterns?.value || 0;
    const coOccurrenceStats = dbHealth.checks.cooccurrence?.value || { totalNodes: 0, totalEdges: 0 };
    const clusterCount = dbHealth.checks.clusters?.value || 0;

    const cacheHitRatio = scanCount > 0
      ? parseFloat(Math.min(cacheStats.entries / Math.max(scanCount, 1), 1.0).toFixed(4))
      : 0;

    const metrics = {
      memory: currentMemory,
      memoryTrend,
      cache: {
        entries: cacheStats.entries,
        maxEntries: cacheStats.maxEntries,
        ttlMs: cacheStats.ttlMs,
        ttlMinutes: Math.round(cacheStats.ttlMs / 60000),
        hitRatio: cacheHitRatio,
        hitRatioPercent: Math.round(cacheHitRatio * 100)
      },
      learning: {
        domainsTracked: uniqueDomainCount,
        totalRecords: scanCount,
        activePatterns: patternCount,
        learningVelocity: scanCount > 0
          ? parseFloat((scanCount / Math.max(uptimeMs / 3600000, 0.01)).toFixed(1))
          : 0
      },
      graph: {
        totalNodes: coOccurrenceStats.totalNodes,
        totalEdges: coOccurrenceStats.totalEdges,
        activeClusters: clusterCount,
        graphDensity: coOccurrenceStats.totalNodes > 1
          ? parseFloat((coOccurrenceStats.totalEdges /
            ((coOccurrenceStats.totalNodes * (coOccurrenceStats.totalNodes - 1)) / 2)).toFixed(4))
          : 0
      },
      runtime: {
        uptimeMs,
        uptimeFormatted: formatUptime(uptimeMs),
        uptimeHours: parseFloat((uptimeMs / 3600000).toFixed(2)),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memoryMB: currentMemory.heapUsedMB,
        memoryTotalMB: currentMemory.heapTotalMB,
        rssMB: currentMemory.rssMB,
        adapter: 'supabase',
        environment: process.env.NODE_ENV || 'production',
        serverVersion: 'v10.0.0'
      },
      learningJob: {
        running: learningStatus.running,
        lastRunTime: learningStatus.lastRunTime,
        lastRunFormatted: learningStatus.lastRunTime
          ? new Date(learningStatus.lastRunTime).toISOString()
          : 'Not yet run',
        nextRunTime: learningStatus.nextRunTime,
        intervalHours: learningStatus.intervalHours,
        qualityPassMark: learningStatus.qualityPassMark,
        outlierSensitivity: learningStatus.outlierSensitivity,
        volumeThresholds: learningStatus.volumeThresholds
      },
      requests: requestRate,
      database: {
        allHealthy: dbHealth.allHealthy,
        errorCount: dbHealth.errorCount,
        tableHealth: Object.fromEntries(
          Object.entries(dbHealth.checks).map(([table, check]) => [
            table,
            {
              status: check.status,
              latencyMs: check.latencyMs,
              error: check.error || null
            }
          ])
        )
      }
    };

    const health = calculateHealthScore(metrics);
    const capabilities = generateCapabilityReport(dbHealth, learningStatus);

    const latency = Date.now() - t0;
    const timestamp = Date.now();

    const response = {
      mode: 'telemetry',
      latency,
      cached: false,
      timestamp,
      timestampFormatted: new Date(timestamp).toISOString(),
      health,
      cache: metrics.cache,
      learning: metrics.learning,
      graph: metrics.graph,
      runtime: metrics.runtime,
      learningJob: metrics.learningJob,
      memory: {
        current: currentMemory,
        trend: memoryTrend
      },
      requests: requestRate,
      database: metrics.database,
      capabilities: capabilities.capabilities,
      limitations: capabilities.limitations,
      configuration: {
        rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
        rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 10,
        cacheTtlMs: parseInt(process.env.CACHE_TTL_MS) || 3600000,
        qualityGates: {
          passMarkScore: 60,
          minTechnologies: 3,
          minConfidenceFloor: 0.45,
          outlierStdDeviations: 1.5,
          volumeThresholdTechIntelligence: 50,
          volumeThresholdArchitecturePatterns: 100,
          volumeThresholdIndustryBenchmarks: 200,
          volumeThresholdCoOccurrence: 25
        }
      }
    };

    const healthEmoji = health.score >= 90 ? 'EXCELLENT' :
      health.score >= 75 ? 'GOOD' :
        health.score >= 55 ? 'DEGRADED' : 'POOR';

    logger.info(
      `Telemetry served — Health: ${health.score}/100 (${healthEmoji}), ` +
      `Uptime: ${formatUptime(uptimeMs)}, ` +
      `Memory: ${currentMemory.heapUsedMB}MB heap, ` +
      `Scans: ${scanCount}, ` +
      `Patterns: ${patternCount}, ` +
      `Graph: ${coOccurrenceStats.totalNodes} nodes / ${coOccurrenceStats.totalEdges} edges, ` +
      `DB healthy: ${dbHealth.allHealthy}, ` +
      `Response: ${latency}ms`
    );

    return res.status(200).json(response);

  } catch (err) {
    logger.error(`Telemetry handler error: ${err.message}`);
    logger.error(`Stack: ${err.stack}`);

    return res.status(500).json({
      error: 'Telemetry collection failed',
      detail: err.message,
      timestamp: Date.now(),
      mode: 'telemetry',
      latency: Date.now() - t0
    });
  }
}

module.exports = telemetryHandler;
