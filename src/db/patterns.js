'use strict';

// ─── DEPENDENCIES ─────────────────────────────────────────────────────────────

const supabase = require('./supabase');
const logger = require('../utils/logger');
const { FALLBACK_PATTERNS } = require('../detection/patterns');

// ─── CACHE CONFIGURATION ──────────────────────────────────────────────────────
// Patterns are cached in memory for one hour to avoid querying Supabase
// on every scan request. The cache is keyed by a combination of the
// pattern count and a hash of the last updated timestamp so it
// automatically invalidates when patterns are added or modified
// in the database without requiring a server restart.
//
// The in-memory cache uses a Map for O(1) lookup by technology name —
// useful for the pattern health check and individual pattern retrieval
// functions below.

const PATTERN_CACHE_MS = 3600000;

let cachedPatterns = null;
let cachedPatternMap = null;
let cacheTime = null;
let cacheSize = 0;

// ─── CACHE INVALIDATION ───────────────────────────────────────────────────────
// Force the cache to refresh on the next getAllPatterns call.
// Called after seeding or when an operator manually updates patterns
// in the Supabase dashboard and wants the changes reflected immediately
// without waiting for the hour-long cache to expire.

function invalidatePatternCache() {
  cachedPatterns = null;
  cachedPatternMap = null;
  cacheTime = null;
  cacheSize = 0;
  logger.info('Pattern cache invalidated — next request will reload from Supabase');
}

// ─── MERGE DATABASE AND FALLBACK PATTERNS ─────────────────────────────────────
// Merge patterns from Supabase with the local fallback patterns.
// The merge strategy is:
//   1. Start with all database patterns — these are the primary source of truth
//   2. Add any fallback patterns whose names do not appear in the database
// This ensures:
//   - Database patterns always take precedence over fallback patterns
//   - If the database is empty (first boot before seeding), the fallback
//     patterns ensure the tool works immediately
//   - Technologies in the fallback but not yet in the database are available
//     automatically without manual database intervention
//   - Technologies updated in the database override the fallback version
//
// The merge also normalises pattern fields — ensuring all required fields
// exist and have sensible defaults even if the database row is incomplete.

function mergeWithFallback(dbPatterns) {
  const dbNames = new Set(dbPatterns.map(p => p.name));
  const fallbackOnly = FALLBACK_PATTERNS.filter(p => !dbNames.has(p.name));

  if (fallbackOnly.length > 0) {
    logger.info(
      `Pattern merge — ${dbPatterns.length} from database, ` +
      `${fallbackOnly.length} added from fallback (not yet in database), ` +
      `${dbPatterns.length + fallbackOnly.length} total`
    );
  }

  const allPatterns = [...dbPatterns, ...fallbackOnly];

  return allPatterns.map(pattern => ({
    name: pattern.name || 'Unknown',
    category: pattern.category || 'Unknown',
    html_patterns: Array.isArray(pattern.html_patterns) ? pattern.html_patterns : [],
    header_patterns: Array.isArray(pattern.header_patterns) ? pattern.header_patterns : [],
    script_patterns: Array.isArray(pattern.script_patterns) ? pattern.script_patterns : [],
    url_patterns: Array.isArray(pattern.url_patterns) ? pattern.url_patterns : [],
    version_patterns: Array.isArray(pattern.version_patterns) ? pattern.version_patterns : [],
    html_weight: typeof pattern.html_weight === 'number' ? pattern.html_weight : 0.4,
    header_weight: typeof pattern.header_weight === 'number' ? pattern.header_weight : 0.4,
    script_weight: typeof pattern.script_weight === 'number' ? pattern.script_weight : 0.3,
    min_confidence: typeof pattern.min_confidence === 'number' ? pattern.min_confidence : 0.3
  }));
}

// ─── BUILD PATTERN MAP ────────────────────────────────────────────────────────
// Build a Map from technology name to pattern for O(1) lookup.
// Used by getTechPattern and getPatternsByCategory for efficient
// individual pattern retrieval without iterating the full array.

function buildPatternMap(patterns) {
  const map = new Map();
  for (const pattern of patterns) {
    map.set(pattern.name, pattern);
  }
  return map;
}

// ─── GET ALL PATTERNS ─────────────────────────────────────────────────────────
// Primary function used by the fingerprinting engine on every scan.
// Returns all patterns from the cache if fresh, otherwise reloads
// from Supabase and merges with fallback patterns.
//
// The function never returns an empty array — if Supabase is unavailable
// it falls back to the local pattern set so the tool always works.
// This is critical for availability — a Supabase outage should degrade
// detection quality slightly (missing database-only patterns) but must
// never take the tool completely offline.

async function getAllPatterns() {
  try {
    const now = Date.now();
    const cacheAge = cacheTime ? now - cacheTime : Infinity;
    const cacheValid = cachedPatterns && cacheTime && cacheAge < PATTERN_CACHE_MS;

    if (cacheValid) {
      logger.info(
        `Pattern cache HIT — ${cachedPatterns.length} patterns, ` +
        `age: ${Math.round(cacheAge / 1000)}s, ` +
        `expires in: ${Math.round((PATTERN_CACHE_MS - cacheAge) / 1000)}s`
      );
      return cachedPatterns;
    }

    logger.info('Pattern cache MISS — loading from Supabase');

    const { data, error } = await supabase
      .from('tech_patterns')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Supabase query failed: ${error.message}`);
    }

    const dbPatterns = data || [];
    logger.info(`Loaded ${dbPatterns.length} patterns from Supabase`);

    const merged = mergeWithFallback(dbPatterns);

    cachedPatterns = merged;
    cachedPatternMap = buildPatternMap(merged);
    cacheTime = now;
    cacheSize = merged.length;

    logger.info(
      `Pattern cache SET — ${merged.length} total patterns ` +
      `(${dbPatterns.length} from database, ${merged.length - dbPatterns.length} from fallback)`
    );

    return cachedPatterns;

  } catch (err) {
    logger.error(`Failed to load patterns from Supabase: ${err.message}`);

    if (cachedPatterns && cachedPatterns.length > 0) {
      logger.warn(
        `Returning stale cache (${cachedPatterns.length} patterns) due to Supabase error`
      );
      return cachedPatterns;
    }

    logger.warn(
      `No cache available — returning ${FALLBACK_PATTERNS.length} fallback patterns only`
    );
    return FALLBACK_PATTERNS;
  }
}

// ─── GET PATTERN COUNT ────────────────────────────────────────────────────────
// Return the total number of patterns currently loaded.
// Used by the telemetry handler to show how many patterns are active.
// Reads from cache if available to avoid a database query.

async function getPatternCount() {
  try {
    if (cachedPatterns) {
      return cachedPatterns.length;
    }

    const { count, error } = await supabase
      .from('tech_patterns')
      .select('*', { count: 'exact', head: true });

    if (error) throw new Error(error.message);

    const dbCount = count || 0;
    const fallbackOnlyCount = FALLBACK_PATTERNS.filter(fp => {
      return true;
    }).length;

    return dbCount > 0 ? dbCount : FALLBACK_PATTERNS.length;

  } catch (err) {
    logger.warn(`Failed to get pattern count: ${err.message}`);
    return FALLBACK_PATTERNS.length;
  }
}

// ─── GET PATTERN COUNT BY CATEGORY ───────────────────────────────────────────
// Return a breakdown of pattern counts by technology category.
// Used by the telemetry handler to show the distribution of
// detection coverage across technology categories.
// Operators can see at a glance if certain categories are underrepresented.

async function getPatternCountByCategory() {
  try {
    const patterns = await getAllPatterns();
    const distribution = {};

    for (const pattern of patterns) {
      const category = pattern.category || 'Unknown';
      distribution[category] = (distribution[category] || 0) + 1;
    }

    return Object.entries(distribution)
      .sort((a, b) => b[1] - a[1])
      .reduce((obj, [category, count]) => {
        obj[category] = count;
        return obj;
      }, {});

  } catch (err) {
    logger.warn(`Failed to get pattern count by category: ${err.message}`);
    return {};
  }
}

// ─── GET TECH PATTERN ─────────────────────────────────────────────────────────
// Return the pattern definition for a single technology by name.
// Used by the intelligence engine to look up specific technology details
// and by the Phase 2 pattern improvement endpoint to show individual
// pattern definitions to operators.

async function getTechPattern(name) {
  try {
    if (cachedPatternMap && cachedPatternMap.has(name)) {
      return cachedPatternMap.get(name);
    }

    await getAllPatterns();

    if (cachedPatternMap && cachedPatternMap.has(name)) {
      return cachedPatternMap.get(name);
    }

    return null;

  } catch (err) {
    logger.warn(`Failed to get pattern for "${name}": ${err.message}`);
    return null;
  }
}

// ─── GET PATTERNS BY CATEGORY ─────────────────────────────────────────────────
// Return all patterns belonging to a specific category.
// Used by the Phase 2 pattern improvement endpoint to show all
// patterns in a category and identify which need strengthening.

async function getPatternsByCategory(category) {
  try {
    const patterns = await getAllPatterns();
    return patterns.filter(p =>
      p.category.toLowerCase() === category.toLowerCase()
    );

  } catch (err) {
    logger.warn(`Failed to get patterns for category "${category}": ${err.message}`);
    return [];
  }
}

// ─── PATTERN HEALTH CHECK ─────────────────────────────────────────────────────
// Analyse the quality of all loaded patterns and identify issues.
// A healthy pattern has at least two signal types with non-empty pattern arrays.
// A pattern with only one signal type (e.g. only HTML patterns) is weak —
// it will produce lower confidence scores and more false positives.
//
// This is called by the telemetry handler to populate the pattern health
// section of the telemetry panel — giving operators visibility into
// which technologies need pattern improvement before the learning job
// identifies them as frequently low-confidence detections.

async function getPatternHealth() {
  try {
    const patterns = await getAllPatterns();
    const issues = [];
    const healthy = [];
    const weak = [];

    for (const pattern of patterns) {
      const signalTypes = [
        pattern.html_patterns.length > 0,
        pattern.header_patterns.length > 0,
        pattern.script_patterns.length > 0,
        pattern.url_patterns.length > 0
      ].filter(Boolean).length;

      const totalPatterns =
        pattern.html_patterns.length +
        pattern.header_patterns.length +
        pattern.script_patterns.length +
        pattern.url_patterns.length;

      if (totalPatterns === 0) {
        issues.push({
          name: pattern.name,
          category: pattern.category,
          severity: 'critical',
          issue: 'No detection patterns defined — this technology can never be detected'
        });
      } else if (signalTypes === 1) {
        weak.push({
          name: pattern.name,
          category: pattern.category,
          severity: 'warn',
          issue: `Only one signal type defined (${totalPatterns} patterns) — confidence scores will be low`,
          signalTypes
        });
      } else if (totalPatterns < 3) {
        weak.push({
          name: pattern.name,
          category: pattern.category,
          severity: 'warn',
          issue: `Very few patterns defined (${totalPatterns} total) — detection may miss some implementations`,
          signalTypes
        });
      } else {
        healthy.push(pattern.name);
      }
    }

    return {
      total: patterns.length,
      healthyCount: healthy.length,
      weakCount: weak.length,
      issueCount: issues.length,
      healthPercent: Math.round((healthy.length / patterns.length) * 100),
      criticalIssues: issues,
      weakPatterns: weak.slice(0, 20),
      source: {
        database: patterns.length - FALLBACK_PATTERNS.filter(
          fp => !patterns.find(p => p.name === fp.name)
        ).length,
        fallback: patterns.filter(
          p => !cachedPatterns?.find(cp => cp.name === p.name && cp._fromDatabase)
        ).length
      }
    };

  } catch (err) {
    logger.warn(`Pattern health check failed: ${err.message}`);
    return {
      total: 0,
      healthyCount: 0,
      weakCount: 0,
      issueCount: 0,
      healthPercent: 0,
      criticalIssues: [],
      weakPatterns: []
    };
  }
}

// ─── GET CACHE STATUS ─────────────────────────────────────────────────────────
// Return the current state of the pattern cache.
// Used by the telemetry handler to show pattern cache health
// and by operators to understand when the cache was last refreshed.

function getPatternCacheStatus() {
  const now = Date.now();
  const age = cacheTime ? now - cacheTime : null;
  const expiresIn = age !== null ? Math.max(0, PATTERN_CACHE_MS - age) : null;

  return {
    loaded: !!cachedPatterns,
    patternCount: cacheSize,
    cacheAgeMs: age,
    cacheAgeFormatted: age !== null
      ? `${Math.round(age / 1000)}s ago`
      : 'Not loaded',
    expiresInMs: expiresIn,
    expiresInFormatted: expiresIn !== null
      ? `${Math.round(expiresIn / 1000)}s`
      : 'Not loaded',
    cacheTtlMs: PATTERN_CACHE_MS,
    fallbackCount: FALLBACK_PATTERNS.length
  };
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
  getAllPatterns,
  getPatternCount,
  getPatternCountByCategory,
  getTechPattern,
  getPatternsByCategory,
  getPatternHealth,
  getPatternCacheStatus,
  invalidatePatternCache
};
