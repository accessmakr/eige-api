'use strict';

// ─── DEPENDENCIES ─────────────────────────────────────────────────────────────

const supabase = require('./supabase');
const logger = require('../utils/logger');

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
// These thresholds mirror the learning job quality gates exactly.
// The co-occurrence table must only be updated from high-quality scan data
// to prevent low-quality domains from corrupting the global technology
// relationship graph. A technology pair must appear in at least
// MIN_PAIR_COUNT qualifying scans before its weight is considered stable.

const MIN_QUALITY_SCORE_FOR_UPDATE = 60;
const MIN_PAIR_COUNT_FOR_STABLE_WEIGHT = 25;
const MAX_WEIGHT = 1.0;
const MIN_WEIGHT = 0.01;

// ─── NORMALISE PAIR ───────────────────────────────────────────────────────────
// Ensure technology pairs are always stored in alphabetical order.
// This prevents duplicate rows — React+Cloudflare and Cloudflare+React
// must always map to the same row. Alphabetical ordering is a simple
// deterministic sort that works for any technology name.

function normalisePair(nameA, nameB) {
  if (nameA < nameB) {
    return { techA: nameA, techB: nameB };
  }
  return { techA: nameB, techB: nameA };
}

// ─── BUILD PAIRS FROM TECHNOLOGIES ───────────────────────────────────────────
// Generate all unique pairs from a list of detected technologies.
// For N technologies there are N*(N-1)/2 unique pairs.
// Each pair carries the category of both technologies for the graph
// colour coding and category-based edge rendering in the frontend.

function buildPairsFromTechnologies(technologies) {
  const pairs = [];

  for (let i = 0; i < technologies.length; i++) {
    for (let j = i + 1; j < technologies.length; j++) {
      const { techA, techB } = normalisePair(
        technologies[i].name,
        technologies[j].name
      );

      const categoryA = technologies[i].name <= technologies[j].name
        ? technologies[i].category
        : technologies[j].category;

      const categoryB = technologies[i].name <= technologies[j].name
        ? technologies[j].category
        : technologies[i].category;

      pairs.push({ techA, techB, categoryA, categoryB });
    }
  }

  return pairs;
}

// ─── INCREMENT CO-OCCURRENCE ──────────────────────────────────────────────────
// Update co-occurrence counts for all technology pairs in a scan.
// Quality gated — only called from scan results that pass the quality
// pre-score threshold of 60. This ensures the global graph learns only
// from real production websites not test or spam domains.
//
// Uses upsert for efficiency — a single database operation per pair
// handles both the insert (new pair) and update (existing pair) cases.
// The normaliseWeights function is NOT called here on every scan —
// normalisation runs in the learning job every 24 hours to avoid
// expensive full-table scans on every individual scan request.

async function incrementCoOccurrence(technologies) {
  try {
    if (!technologies || technologies.length < 2) {
      logger.info('Co-occurrence update skipped — fewer than 2 technologies detected');
      return;
    }

    const pairs = buildPairsFromTechnologies(technologies);

    if (pairs.length === 0) {
      logger.info('Co-occurrence update skipped — no valid pairs generated');
      return;
    }

    logger.info(`Updating co-occurrence for ${pairs.length} technology pairs`);

    let updated = 0;
    let inserted = 0;
    let failed = 0;

    for (const pair of pairs) {
      try {
        const { data: existing, error: selectError } = await supabase
          .from('co_occurrence')
          .select('id, count, weight')
          .eq('tech_a', pair.techA)
          .eq('tech_b', pair.techB)
          .single();

        if (selectError && selectError.code !== 'PGRST116') {
          throw new Error(selectError.message);
        }

        if (existing) {
          const newCount = existing.count + 1;

          const { error: updateError } = await supabase
            .from('co_occurrence')
            .update({
              count: newCount,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);

          if (updateError) throw new Error(updateError.message);
          updated++;

        } else {
          const { error: insertError } = await supabase
            .from('co_occurrence')
            .insert({
              tech_a: pair.techA,
              tech_b: pair.techB,
              category_a: pair.categoryA,
              category_b: pair.categoryB,
              count: 1,
              weight: MIN_WEIGHT,
              updated_at: new Date().toISOString()
            });

          if (insertError) throw new Error(insertError.message);
          inserted++;
        }

      } catch (pairErr) {
        logger.warn(`Failed to update pair ${pair.techA}+${pair.techB}: ${pairErr.message}`);
        failed++;
      }
    }

    logger.info(
      `Co-occurrence update complete — updated: ${updated}, inserted: ${inserted}, failed: ${failed}, total pairs: ${pairs.length}`
    );

  } catch (err) {
    logger.error(`Co-occurrence increment error: ${err.message}`);
  }
}

// ─── NORMALISE WEIGHTS ────────────────────────────────────────────────────────
// Recalculate all co-occurrence weights as a fraction of the maximum count.
// Called by the learning job every 24 hours — not on every scan.
// This is an expensive operation that touches every row in the table.
// Running it infrequently keeps individual scan requests fast while
// ensuring the global graph weights stay accurate over time.
//
// Weight formula: weight = count / max_count across all pairs
// This produces weights between MIN_WEIGHT and MAX_WEIGHT (0.01 to 1.0)
// where 1.0 is the most commonly co-occurring pair and all others are
// expressed as a fraction of that maximum.
//
// Only pairs with count >= MIN_PAIR_COUNT_FOR_STABLE_WEIGHT get their
// weights updated. New pairs with low counts keep MIN_WEIGHT until
// they have been observed enough times to be considered reliable.

async function normaliseWeights() {
  try {
    logger.info('Starting co-occurrence weight normalisation');

    const { data: allPairs, error: fetchError } = await supabase
      .from('co_occurrence')
      .select('id, count, weight');

    if (fetchError) throw new Error(fetchError.message);
    if (!allPairs || allPairs.length === 0) {
      logger.info('Co-occurrence weight normalisation skipped — table is empty');
      return;
    }

    const stablePairs = allPairs.filter(p => p.count >= MIN_PAIR_COUNT_FOR_STABLE_WEIGHT);
    const unstablePairs = allPairs.filter(p => p.count < MIN_PAIR_COUNT_FOR_STABLE_WEIGHT);

    if (stablePairs.length === 0) {
      logger.info(`Co-occurrence normalisation skipped — no pairs meet the minimum count threshold of ${MIN_PAIR_COUNT_FOR_STABLE_WEIGHT}`);
      return;
    }

    const maxCount = Math.max(...stablePairs.map(p => p.count));
    if (maxCount === 0) {
      logger.warn('Co-occurrence normalisation skipped — max count is zero');
      return;
    }

    let normalised = 0;
    let unchanged = 0;
    let errors = 0;

    for (const pair of stablePairs) {
      try {
        const newWeight = parseFloat(
          Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, pair.count / maxCount)).toFixed(4)
        );

        if (Math.abs(newWeight - pair.weight) < 0.0001) {
          unchanged++;
          continue;
        }

        const { error: updateError } = await supabase
          .from('co_occurrence')
          .update({
            weight: newWeight,
            updated_at: new Date().toISOString()
          })
          .eq('id', pair.id);

        if (updateError) throw new Error(updateError.message);
        normalised++;

      } catch (pairErr) {
        logger.warn(`Failed to normalise weight for pair ID ${pair.id}: ${pairErr.message}`);
        errors++;
      }
    }

    logger.info(
      `Co-occurrence normalisation complete — normalised: ${normalised}, unchanged: ${unchanged}, stable pairs: ${stablePairs.length}, unstable (below threshold): ${unstablePairs.length}, errors: ${errors}, max count: ${maxCount}`
    );

  } catch (err) {
    logger.error(`Co-occurrence normalisation error: ${err.message}`);
  }
}

// ─── GET ALL CO-OCCURRENCES ───────────────────────────────────────────────────
// Fetch all co-occurrence pairs ordered by weight descending.
// Used by the graph handler to build the global technology relationship graph.
// The ORDER BY weight DESC means the most significant relationships
// are processed first — if the result set is truncated by a limit
// the most important edges are always included.

async function getAllCoOccurrences() {
  try {
    const { data, error } = await supabase
      .from('co_occurrence')
      .select('*')
      .order('weight', { ascending: false });

    if (error) throw new Error(error.message);

    logger.info(`Fetched ${data?.length || 0} co-occurrence pairs for global graph`);
    return data || [];

  } catch (err) {
    logger.warn(`Failed to fetch co-occurrences: ${err.message}`);
    return [];
  }
}

// ─── GET CO-OCCURRENCE STATS ──────────────────────────────────────────────────
// Return summary statistics about the co-occurrence table.
// Used by the telemetry handler to populate the graph stats section
// of the telemetry panel — total nodes, total edges, stable edges,
// and average weight across all pairs.

async function getCoOccurrenceStats() {
  try {
    const { count: totalEdges, error: countError } = await supabase
      .from('co_occurrence')
      .select('*', { count: 'exact', head: true });

    if (countError) throw new Error(countError.message);

    const { data: techData, error: techError } = await supabase
      .from('co_occurrence')
      .select('tech_a, tech_b, count, weight');

    if (techError) throw new Error(techError.message);

    const uniqueTechs = new Set();
    let totalWeight = 0;
    let stableEdges = 0;

    if (techData) {
      for (const row of techData) {
        uniqueTechs.add(row.tech_a);
        uniqueTechs.add(row.tech_b);
        totalWeight += row.weight || 0;
        if (row.count >= MIN_PAIR_COUNT_FOR_STABLE_WEIGHT) stableEdges++;
      }
    }

    const avgWeight = techData && techData.length > 0
      ? parseFloat((totalWeight / techData.length).toFixed(4))
      : 0;

    return {
      totalNodes: uniqueTechs.size,
      totalEdges: totalEdges || 0,
      stableEdges,
      unstableEdges: (totalEdges || 0) - stableEdges,
      averageWeight: avgWeight,
      minCountForStableWeight: MIN_PAIR_COUNT_FOR_STABLE_WEIGHT
    };

  } catch (err) {
    logger.warn(`Co-occurrence stats error: ${err.message}`);
    return {
      totalNodes: 0,
      totalEdges: 0,
      stableEdges: 0,
      unstableEdges: 0,
      averageWeight: 0,
      minCountForStableWeight: MIN_PAIR_COUNT_FOR_STABLE_WEIGHT
    };
  }
}

// ─── GET TOP PAIRS ────────────────────────────────────────────────────────────
// Return the N strongest technology pairs by weight.
// Used by the graph handler to include topConnections in the global graph
// response — showing which technology pairs most commonly appear together
// across all scanned websites. This is genuine learned intelligence
// that improves as more websites are scanned.

async function getTopPairs(limit = 20) {
  try {
    const { data, error } = await supabase
      .from('co_occurrence')
      .select('tech_a, tech_b, category_a, category_b, count, weight')
      .gte('count', MIN_PAIR_COUNT_FOR_STABLE_WEIGHT)
      .order('weight', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return data || [];

  } catch (err) {
    logger.warn(`Failed to get top co-occurrence pairs: ${err.message}`);
    return [];
  }
}

// ─── GET PAIRS FOR TECHNOLOGY ─────────────────────────────────────────────────
// Return all co-occurrence pairs involving a specific technology.
// Used by the Phase 2 tech intelligence endpoint to show which
// technologies most commonly appear alongside a given technology.
// This is what powers the "common companions" section of the
// tech intelligence profiles — updated by real scan data not assumptions.

async function getPairsForTechnology(techName, limit = 15) {
  try {
    const { data: pairsA, error: errorA } = await supabase
      .from('co_occurrence')
      .select('tech_a, tech_b, category_a, category_b, count, weight')
      .eq('tech_a', techName)
      .gte('count', 5)
      .order('weight', { ascending: false })
      .limit(limit);

    if (errorA) throw new Error(errorA.message);

    const { data: pairsB, error: errorB } = await supabase
      .from('co_occurrence')
      .select('tech_a, tech_b, category_a, category_b, count, weight')
      .eq('tech_b', techName)
      .gte('count', 5)
      .order('weight', { ascending: false })
      .limit(limit);

    if (errorB) throw new Error(errorB.message);

    const allPairs = [
      ...(pairsA || []).map(p => ({
        companion: p.tech_b,
        companionCategory: p.category_b,
        count: p.count,
        weight: p.weight
      })),
      ...(pairsB || []).map(p => ({
        companion: p.tech_a,
        companionCategory: p.category_a,
        count: p.count,
        weight: p.weight
      }))
    ];

    return allPairs
      .sort((a, b) => b.weight - a.weight)
      .slice(0, limit);

  } catch (err) {
    logger.warn(`Failed to get pairs for technology ${techName}: ${err.message}`);
    return [];
  }
}

// ─── DELETE WEAK PAIRS ────────────────────────────────────────────────────────
// Remove co-occurrence pairs with very low counts that have not been
// updated recently. These are likely from early scans of test domains
// before the quality gates were in place, or genuinely rare combinations
// that are not meaningful for the graph.
// Called by the learning job during its cleanup phase.
// Only removes pairs that have count of 1 and have not been updated
// in the last 30 days — conservative enough to avoid removing real data.

async function deleteWeakPairs(maxCount = 1, olderThanDays = 30) {
  try {
    const cutoff = new Date(Date.now() - (olderThanDays * 86400000)).toISOString();

    const { error } = await supabase
      .from('co_occurrence')
      .delete()
      .lte('count', maxCount)
      .lt('updated_at', cutoff);

    if (error) throw new Error(error.message);

    logger.info(`Weak co-occurrence pairs deleted — max count: ${maxCount}, older than: ${olderThanDays} days`);

  } catch (err) {
    logger.warn(`Failed to delete weak pairs: ${err.message}`);
  }
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
  incrementCoOccurrence,
  normaliseWeights,
  getAllCoOccurrences,
  getCoOccurrenceStats,
  getTopPairs,
  getPairsForTechnology,
  deleteWeakPairs
};
