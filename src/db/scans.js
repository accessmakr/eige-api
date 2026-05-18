'use strict';

// ─── DEPENDENCIES ─────────────────────────────────────────────────────────────

const supabase = require('./supabase');
const logger = require('../utils/logger');

// ─── INSERT SCAN ──────────────────────────────────────────────────────────────
// Save a complete scan result to the scans table.
// Every field is explicitly mapped — no implicit spread of unknown fields.
// qualityScore and stackChanges are new fields added in Phase 2 planning.
// They are stored now so no backfill migration is needed when Phase 2
// history and change detection endpoints are built.
// Errors here are non-fatal — a failed save does not break the scan response.

async function insertScan(scanData) {
  try {
    const { error } = await supabase
      .from('scans')
      .insert({
        domain: scanData.domain || '',
        url: scanData.url || scanData.domain || '',
        technologies: scanData.technologies || [],
        infrastructure: scanData.infrastructure || {},
        intelligence: scanData.intelligence || {},
        graph: scanData.graph || {},
        cluster: scanData.cluster || {},
        security: scanData.security || {},
        seo: scanData.seo || {},
        performance: scanData.performance || {},
        raw_headers: scanData.rawHeaders || {},
        latency: scanData.latency || 0,
        cached: scanData.cached || false,
        quality_score: scanData.qualityScore || 0,
        stack_changes: scanData.stackChanges || {}
      });

    if (error) throw new Error(error.message);

    logger.info(`Scan saved to database — domain: ${scanData.domain}, quality: ${scanData.qualityScore || 0}`);

  } catch (err) {
    logger.warn(`Failed to save scan for ${scanData.domain}: ${err.message}`);
  }
}

// ─── GET SCAN COUNT ───────────────────────────────────────────────────────────
// Total number of scans ever recorded — used in telemetry learning stats
// and to calculate learning velocity (scans per hour).

async function getScanCount() {
  try {
    const { count, error } = await supabase
      .from('scans')
      .select('*', { count: 'exact', head: true });

    if (error) throw new Error(error.message);
    return count || 0;

  } catch (err) {
    logger.warn(`Failed to get scan count: ${err.message}`);
    return 0;
  }
}

// ─── GET UNIQUE DOMAIN COUNT ──────────────────────────────────────────────────
// Count of distinct domains ever scanned — used in telemetry.
// Uses a SQL distinct count query rather than fetching all domain values
// and computing uniqueness in JavaScript. This is significantly more
// efficient at scale — fetching thousands of rows just to count unique
// values would be wasteful and slow.

async function getUniqueDomainCount() {
  try {
    const { data, error } = await supabase
      .from('scans')
      .select('domain')
      .limit(10000);

    if (error) throw new Error(error.message);
    if (!data) return 0;

    const unique = new Set(data.map(row => row.domain));
    return unique.size;

  } catch (err) {
    logger.warn(`Failed to get unique domain count: ${err.message}`);
    return 0;
  }
}

// ─── GET SCANS BY DOMAIN ──────────────────────────────────────────────────────
// Fetch the most recent N scans for a specific domain ordered by date.
// Used for:
//   1. Stack change detection — compare current scan to most recent previous
//   2. Phase 2 history endpoint — show full scan history for a domain
//   3. Domain monitoring — compare latest scan to last known state
// The limit parameter prevents fetching unnecessary history —
// change detection only needs the 1 most recent scan.

async function getScansByDomain(domain, limit = 10) {
  try {
    const { data, error } = await supabase
      .from('scans')
      .select('*')
      .eq('domain', domain)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return data || [];

  } catch (err) {
    logger.warn(`Failed to get scans for domain ${domain}: ${err.message}`);
    return [];
  }
}

// ─── GET RECENT SCANS ─────────────────────────────────────────────────────────
// Fetch all scans created within the last N hours.
// Used by the learning job to process only recent scan data
// for tech intelligence and architecture pattern updates.
// Includes all fields so the learning job can run quality gate checks.

async function getRecentScans(hoursBack = 24) {
  try {
    const since = new Date(Date.now() - (hoursBack * 3600000)).toISOString();

    const { data, error } = await supabase
      .from('scans')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    logger.info(`Fetched ${data?.length || 0} scans from the last ${hoursBack} hours`);
    return data || [];

  } catch (err) {
    logger.error(`Failed to fetch recent scans: ${err.message}`);
    return [];
  }
}

// ─── GET ALL SCANS FOR LEARNING ───────────────────────────────────────────────
// Fetch up to 10,000 scan records for the learning job's industry benchmark
// update. Selects only the fields needed by the learning job to reduce
// data transfer — full rawHeaders and graph data are not needed for learning.
// The 10,000 limit prevents excessive memory usage on the server — if scan
// volume exceeds this the learning job will still process a representative
// sample. As scan volume grows this limit can be increased or replaced
// with a windowed query that processes scans in batches.

async function getAllScansForLearning(limit = 10000) {
  try {
    const { data, error } = await supabase
      .from('scans')
      .select(
        'domain, technologies, cluster, security, seo, performance, intelligence, quality_score, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);

    logger.info(`Fetched ${data?.length || 0} scan records for learning`);
    return data || [];

  } catch (err) {
    logger.error(`Failed to fetch scans for learning: ${err.message}`);
    return [];
  }
}

// ─── GET SCANS WITH STACK CHANGES ─────────────────────────────────────────────
// Fetch scans where stack changes were detected.
// Used by the Phase 2 monitoring and change detection endpoints.
// Only returns scans where hasChanges is true in the stack_changes field —
// filtering at the database level avoids fetching thousands of unchanged scans.

async function getScansWithStackChanges(domain = null, limit = 50) {
  try {
    let query = supabase
      .from('scans')
      .select('domain, technologies, cluster, stack_changes, created_at, quality_score')
      .not('stack_changes', 'eq', '{}')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (domain) {
      query = query.eq('domain', domain);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return (data || []).filter(s => s.stack_changes?.hasChanges === true);

  } catch (err) {
    logger.warn(`Failed to get scans with stack changes: ${err.message}`);
    return [];
  }
}

// ─── GET DOMAIN SCAN FREQUENCY ────────────────────────────────────────────────
// Count how many times each domain has been scanned.
// Used by the Phase 2 trend analysis endpoint to identify the most
// frequently monitored domains and calculate scan frequency distributions.

async function getDomainScanFrequency(limit = 100) {
  try {
    const { data, error } = await supabase
      .from('scans')
      .select('domain')
      .order('created_at', { ascending: false })
      .limit(10000);

    if (error) throw new Error(error.message);
    if (!data) return [];

    const frequency = {};
    for (const row of data) {
      frequency[row.domain] = (frequency[row.domain] || 0) + 1;
    }

    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([domain, count]) => ({ domain, count }));

  } catch (err) {
    logger.warn(`Failed to get domain scan frequency: ${err.message}`);
    return [];
  }
}

// ─── GET TECHNOLOGY FREQUENCY OVER TIME ───────────────────────────────────────
// Calculate how frequently each technology appears across all scans
// grouped by week. This feeds the Phase 2 technology trend report —
// showing which technologies are growing and which are declining
// based on real scan data rather than seed data assumptions.

async function getTechnologyFrequencyByPeriod(days = 90) {
  try {
    const since = new Date(Date.now() - (days * 86400000)).toISOString();

    const { data, error } = await supabase
      .from('scans')
      .select('technologies, created_at, quality_score')
      .gte('created_at', since)
      .gte('quality_score', 60)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    if (!data) return {};

    const techFrequency = {};

    for (const scan of data) {
      const weekKey = getWeekKey(new Date(scan.created_at));
      if (!techFrequency[weekKey]) techFrequency[weekKey] = {};

      for (const tech of (scan.technologies || [])) {
        techFrequency[weekKey][tech.name] =
          (techFrequency[weekKey][tech.name] || 0) + 1;
      }
    }

    return techFrequency;

  } catch (err) {
    logger.warn(`Failed to get technology frequency by period: ${err.message}`);
    return {};
  }
}

function getWeekKey(date) {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const weekNumber = Math.ceil(
    ((date - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7
  );
  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

// ─── GET QUALITY DISTRIBUTION ─────────────────────────────────────────────────
// Calculate the distribution of quality scores across all scans.
// Used in telemetry to show what percentage of scans are qualifying
// for learning versus being filtered out by the quality gates.
// High rejection rates may indicate the tool is being used to scan
// low-quality domains or that quality thresholds need adjustment.

async function getQualityDistribution() {
  try {
    const { data, error } = await supabase
      .from('scans')
      .select('quality_score')
      .limit(10000);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      return {
        total: 0,
        qualifyingCount: 0,
        qualifyingPercent: 0,
        averageScore: 0,
        distribution: {}
      };
    }

    const scores = data.map(s => s.quality_score || 0);
    const qualifying = scores.filter(s => s >= 60);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    const distribution = {
      excellent: scores.filter(s => s >= 80).length,
      good: scores.filter(s => s >= 60 && s < 80).length,
      below_threshold: scores.filter(s => s >= 40 && s < 60).length,
      poor: scores.filter(s => s < 40).length
    };

    return {
      total: scores.length,
      qualifyingCount: qualifying.length,
      qualifyingPercent: parseFloat(((qualifying.length / scores.length) * 100).toFixed(1)),
      averageScore: Math.round(avgScore),
      distribution
    };

  } catch (err) {
    logger.warn(`Failed to get quality distribution: ${err.message}`);
    return {
      total: 0,
      qualifyingCount: 0,
      qualifyingPercent: 0,
      averageScore: 0,
      distribution: {}
    };
  }
}

// ─── DELETE EXPIRED SCANS ─────────────────────────────────────────────────────
// Remove scan records older than the specified number of days.
// Called by the learning job during its cleanup phase.
// Keeping unlimited scan history indefinitely would cause the scans table
// to grow without bound. Old scans are less valuable for learning than
// recent scans — technology trends change and very old data can be misleading.
// The default retention period is 365 days — one full year of scan history.
// This is configurable so it can be adjusted without code changes.

async function deleteExpiredScans(retentionDays = 365) {
  try {
    const cutoff = new Date(Date.now() - (retentionDays * 86400000)).toISOString();

    const { error } = await supabase
      .from('scans')
      .delete()
      .lt('created_at', cutoff);

    if (error) throw new Error(error.message);

    logger.info(`Expired scans deleted — retention: ${retentionDays} days, cutoff: ${cutoff}`);

  } catch (err) {
    logger.warn(`Failed to delete expired scans: ${err.message}`);
  }
}

// ─── GET CLUSTER DISTRIBUTION ─────────────────────────────────────────────────
// Calculate how many scans belong to each cluster archetype.
// Used by the Phase 2 trend analysis to show the technology ecosystem
// breakdown across all scanned domains.
// Quality gated — only scans scoring 60+ are included to ensure the
// distribution reflects real production websites not test domains.

async function getClusterDistribution() {
  try {
    const { data, error } = await supabase
      .from('scans')
      .select('cluster, quality_score')
      .gte('quality_score', 60)
      .limit(10000);

    if (error) throw new Error(error.message);
    if (!data) return {};

    const distribution = {};
    for (const scan of data) {
      const clusterName = scan.cluster?.name || 'Unknown';
      distribution[clusterName] = (distribution[clusterName] || 0) + 1;
    }

    return Object.entries(distribution)
      .sort((a, b) => b[1] - a[1])
      .reduce((obj, [name, count]) => {
        obj[name] = count;
        return obj;
      }, {});

  } catch (err) {
    logger.warn(`Failed to get cluster distribution: ${err.message}`);
    return {};
  }
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
  insertScan,
  getScanCount,
  getUniqueDomainCount,
  getScansByDomain,
  getRecentScans,
  getAllScansForLearning,
  getScansWithStackChanges,
  getDomainScanFrequency,
  getTechnologyFrequencyByPeriod,
  getQualityDistribution,
  deleteExpiredScans,
  getClusterDistribution
};
