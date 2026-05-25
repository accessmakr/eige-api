'use strict';

const supabase = require('./supabase');
const logger = require('../utils/logger');

// Cache TTL for awareness scans: 1 hour
// A brand's AI visibility does not change minute to minute.
// Returning cached results saves API quota and speeds up repeat scans.
const AWARENESS_CACHE_TTL_MS = 3600000;

/**
 * Attempt to retrieve a cached awareness scan result for a given domain.
 * Only returns a result if it was created within the cache TTL window.
 *
 * @param {string} domain - The normalised domain string e.g. "stripe.com"
 * @returns {object|null} The cached result JSONB object, or null if none found
 */
async function getCachedAwarenessScan(domain) {
  try {
    const cutoff = new Date(Date.now() - AWARENESS_CACHE_TTL_MS).toISOString();

    const { data, error } = await supabase
      .from('awareness_scans')
      .select('result, created_at')
      .eq('domain', domain)
      .eq('cached', false)
      .gt('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;

    logger.info(`Awareness cache HIT for domain: ${domain}`);
    return data.result;

  } catch (err) {
    // PGRST116 = no rows found — this is a normal miss, not an error
    if (err.code === 'PGRST116') return null;
    logger.warn(`Awareness cache read error for ${domain}: ${err.message}`);
    return null;
  }
}

/**
 * Persist an awareness scan result to the database.
 * Errors are caught and logged — a failed save must never crash the scan.
 *
 * @param {string} domain - The normalised domain string
 * @param {string[]} engines - Array of engine keys used e.g. ['meta', 'google', 'mistral']
 * @param {number} overallScore - The computed overall awareness score 0–100
 * @param {object} result - The full result object as returned to the frontend
 * @param {boolean} cached - Whether this record is itself a cached replay
 */
async function insertAwarenessScan(domain, engines, overallScore, result, cached = false) {
  try {
    const { error } = await supabase
      .from('awareness_scans')
      .insert({
        domain,
        engines,
        overall_score: overallScore,
        result,
        cached,
        created_at: new Date().toISOString()
      });

    if (error) throw new Error(error.message);
    logger.info(`Awareness scan saved for domain: ${domain} | score: ${overallScore} | engines: ${engines.join(', ')}`);

  } catch (err) {
    logger.warn(`Failed to save awareness scan for ${domain}: ${err.message}`);
    // Intentional: do not re-throw. A failed DB write must not break the API response.
  }
}

/**
 * Return the total number of awareness scans ever stored.
 * Used by the telemetry handler to populate the stats panel.
 *
 * @returns {number}
 */
async function getAwarenessScanCount() {
  try {
    const { count, error } = await supabase
      .from('awareness_scans')
      .select('*', { count: 'exact', head: true });

    if (error) throw new Error(error.message);
    return count || 0;

  } catch (err) {
    logger.warn(`Failed to get awareness scan count: ${err.message}`);
    return 0;
  }
}

/**
 * Return the number of unique domains that have been awareness-scanned.
 * Supabase does not support COUNT(DISTINCT) directly via the client,
 * so we fetch domain column and deduplicate in memory.
 *
 * @returns {number}
 */
async function getAwarenessUniqueDomainCount() {
  try {
    const { data, error } = await supabase
      .from('awareness_scans')
      .select('domain');

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return 0;

    const unique = new Set(data.map(row => row.domain));
    return unique.size;

  } catch (err) {
    logger.warn(`Failed to get awareness unique domain count: ${err.message}`);
    return 0;
  }
}

/**
 * Return average overall_score across all awareness scans.
 * Useful for displaying global platform statistics.
 *
 * @returns {number}
 */
async function getAwarenessAverageScore() {
  try {
    const { data, error } = await supabase
      .from('awareness_scans')
      .select('overall_score');

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return 0;

    const total = data.reduce((sum, row) => sum + (row.overall_score || 0), 0);
    return Math.round(total / data.length);

  } catch (err) {
    logger.warn(`Failed to compute awareness average score: ${err.message}`);
    return 0;
  }
}

/**
 * Return the top N most-scanned domains by awareness scan frequency.
 * Used for future leaderboard or trending features.
 *
 * @param {number} limit - How many top domains to return
 * @returns {Array<{domain: string, count: number}>}
 */
async function getTopAwarenessDomains(limit = 10) {
  try {
    const { data, error } = await supabase
      .from('awareness_scans')
      .select('domain');

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) return [];

    // Count occurrences per domain
    const counts = {};
    data.forEach(row => {
      counts[row.domain] = (counts[row.domain] || 0) + 1;
    });

    // Sort by count descending, take top N
    return Object.entries(counts)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

  } catch (err) {
    logger.warn(`Failed to get top awareness domains: ${err.message}`);
    return [];
  }
}

module.exports = {
  getCachedAwarenessScan,
  insertAwarenessScan,
  getAwarenessScanCount,
  getAwarenessUniqueDomainCount,
  getAwarenessAverageScore,
  getTopAwarenessDomains
};
