'use strict';

const logger = require('../../utils/logger');

// ─── CONSISTENCY WEIGHT DISTRIBUTION ──────────────────────────────────────────
// Consistency is measured across four independent dimensions.
// Informal alignment is weighted highest because for most brands —
// especially those known through social/community channels —
// agreement on what the brand DOES and HOW IT IS PERCEIVED matters
// far more than agreement on founding year or headquarters location.
const CONSISTENCY_WEIGHTS = {
  topicOverlap:         0.35,  // do engines agree on what topics they know about this brand
  sentimentAlignment:   0.25,  // do engines describe the brand with the same emotional tone
  informalAlignment:    0.25,  // do engines have similar depth of informal/social knowledge
  recommendationAlign:  0.15   // do engines agree on whether to recommend this brand
};

// ─── SENTIMENT COMPATIBILITY MATRIX ──────────────────────────────────────────
// How compatible are two sentiment values with each other.
// 1.0 = identical, 0.0 = completely opposed.
// This handles the nuance that positive/mixed is more consistent than
// positive/negative but less consistent than positive/positive.
const SENTIMENT_COMPATIBILITY = {
  positive: { positive: 1.0, mixed: 0.6, neutral: 0.5, negative: 0.0, unknown: 0.4 },
  negative: { positive: 0.0, mixed: 0.5, neutral: 0.5, negative: 1.0, unknown: 0.4 },
  mixed:    { positive: 0.6, mixed: 1.0, neutral: 0.6, negative: 0.5, unknown: 0.5 },
  neutral:  { positive: 0.5, mixed: 0.6, neutral: 1.0, negative: 0.5, unknown: 0.6 },
  unknown:  { positive: 0.4, mixed: 0.5, neutral: 0.6, negative: 0.4, unknown: 0.7 }
};

// ─── RECOMMENDATION COMPATIBILITY ────────────────────────────────────────────
const RECOMMENDATION_COMPATIBILITY = {
  yes:     { yes: 1.0, unclear: 0.5, no: 0.0 },
  no:      { yes: 0.0, unclear: 0.5, no: 1.0 },
  unclear: { yes: 0.5, unclear: 1.0, no: 0.5 }
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Clamp and round a number between min and max.
 */
function clamp(value, min = 0, max = 100) {
  return Math.round(Math.min(Math.max(value, min), max));
}

/**
 * Normalise a topic string for comparison.
 * Strips punctuation, lowercases, trims whitespace.
 * This ensures "SaaS platform" and "saas" are treated as the same topic.
 *
 * @param {string} topic
 * @returns {string}
 */
function normaliseTopic(topic) {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate Jaccard similarity between two sets.
 * Jaccard = |intersection| / |union|
 * Returns 0 if both sets are empty.
 *
 * @param {Set} setA
 * @param {Set} setB
 * @returns {number} 0.0–1.0
 */
function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Find the pairwise topic overlap between two topic arrays.
 * Uses normalised topic comparison with partial matching:
 * topics are considered matching if either normalised string
 * contains the other (handles "fintech payments" vs "payments").
 *
 * @param {string[]} topicsA
 * @param {string[]} topicsB
 * @returns {{ matched: string[], onlyA: string[], onlyB: string[] }}
 */
function findTopicOverlap(topicsA, topicsB) {
  const normA = (topicsA || []).map(normaliseTopic).filter(t => t.length > 1);
  const normB = (topicsB || []).map(normaliseTopic).filter(t => t.length > 1);

  const matched  = [];
  const matchedBIndices = new Set();

  for (const ta of normA) {
    let found = false;
    for (let i = 0; i < normB.length; i++) {
      if (matchedBIndices.has(i)) continue;
      const tb = normB[i];
      // Match if either contains the other, or they share a 4+ char substring
      if (ta === tb || ta.includes(tb) || tb.includes(ta)) {
        matched.push(ta);
        matchedBIndices.add(i);
        found = true;
        break;
      }
      // Word-level partial match — at least one significant word in common
      const wordsA = ta.split(' ').filter(w => w.length > 3);
      const wordsB = tb.split(' ').filter(w => w.length > 3);
      const sharedWords = wordsA.filter(w => wordsB.includes(w));
      if (sharedWords.length > 0) {
        matched.push(ta);
        matchedBIndices.add(i);
        found = true;
        break;
      }
    }
  }

  const onlyA = normA.filter(ta => !matched.includes(ta));
  const onlyB = normB.filter((_, i) => !matchedBIndices.has(i));

  return { matched, onlyA, onlyB };
}

/**
 * Compute pairwise compatibility score between two engines on one dimension.
 * Uses a compatibility matrix lookup with a default fallback of 0.5.
 *
 * @param {Object} matrix - compatibility matrix (e.g. SENTIMENT_COMPATIBILITY)
 * @param {string} valA
 * @param {string} valB
 * @returns {number} 0.0–1.0
 */
function pairCompatibility(matrix, valA, valB) {
  const a = (valA || 'unknown').toLowerCase();
  const b = (valB || 'unknown').toLowerCase();
  return (matrix[a] && matrix[a][b] !== undefined) ? matrix[a][b] : 0.5;
}

/**
 * Compute the mean of all pairwise compatibility scores across N engines.
 * For N engines there are N*(N-1)/2 unique pairs.
 *
 * @param {string[]} values - one value per engine
 * @param {Object}   matrix - compatibility matrix
 * @returns {number} 0.0–1.0
 */
function meanPairwiseCompatibility(values, matrix) {
  if (!values || values.length < 2) return 0.7; // default when only one engine
  const pairs = [];
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      pairs.push(pairCompatibility(matrix, values[i], values[j]));
    }
  }
  return pairs.length > 0
    ? pairs.reduce((a, b) => a + b, 0) / pairs.length
    : 0.7;
}

/**
 * Compute informal score alignment across engines.
 * Measures how similar the informalScore values are across all engines.
 * Uses coefficient of variation (lower variation = higher alignment).
 *
 * @param {number[]} informalScores - array of 1–10 scores
 * @returns {number} 0.0–1.0
 */
function informalScoreAlignment(informalScores) {
  const valid = (informalScores || []).filter(s => typeof s === 'number' && s >= 1 && s <= 10);
  if (valid.length < 2) return 0.7; // single engine, neutral alignment

  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  if (mean === 0) return 0;

  const variance = valid.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / valid.length;
  const stdDev   = Math.sqrt(variance);
  const cv       = stdDev / mean; // coefficient of variation: 0 = identical, 1+ = very spread

  // Map CV to alignment score: CV=0→1.0, CV=0.3→0.7, CV=0.6→0.4, CV>=1.0→0.1
  return Math.max(0.1, 1.0 - cv);
}

// ─── AGREED TOPICS BUILDER ────────────────────────────────────────────────────
/**
 * Find topics that appear across ALL (or most) engines.
 * "Agreed" means at least 2 engines (or all engines for 2-engine scans)
 * have this topic in their topicsKnown list.
 *
 * Returns display-ready strings, de-duplicated and capitalised.
 *
 * @param {Object} engineDataMap - keyed by engine, values have topicsKnown[]
 * @returns {string[]}
 */
function buildAgreedTopics(engineDataMap) {
  const engineList = Object.values(engineDataMap).filter(e => !e.failed);
  if (engineList.length < 2) {
    // Single engine — return its topics as "agreed" (nothing to compare against)
    const topics = engineList[0]?.topicsKnown || [];
    return topics
      .map(t => capitaliseFirst(normaliseTopic(t)))
      .filter(t => t.length > 1)
      .slice(0, 6);
  }

  // Count how many engines mention each normalised topic
  const topicCounts = {};
  const topicOriginal = {}; // preserve original casing for display

  for (const engineData of engineList) {
    const topics = engineData.topicsKnown || [];
    const seen = new Set(); // prevent double-counting within one engine

    for (const rawTopic of topics) {
      const norm = normaliseTopic(rawTopic);
      if (!norm || norm.length < 2) continue;

      // Check if this topic overlaps with any already-counted topic
      let matchedKey = null;
      for (const existingKey of Object.keys(topicCounts)) {
        if (
          norm === existingKey ||
          norm.includes(existingKey) ||
          existingKey.includes(norm)
        ) {
          matchedKey = existingKey;
          break;
        }
        // Word-level match
        const wordsNorm     = norm.split(' ').filter(w => w.length > 3);
        const wordsExisting = existingKey.split(' ').filter(w => w.length > 3);
        if (wordsNorm.some(w => wordsExisting.includes(w))) {
          matchedKey = existingKey;
          break;
        }
      }

      const key = matchedKey || norm;
      if (seen.has(key)) continue;
      seen.add(key);

      topicCounts[key]    = (topicCounts[key] || 0) + 1;
      topicOriginal[key]  = topicOriginal[key] || rawTopic;
    }
  }

  // Threshold: topic must appear in at least 2 engines, or all engines if only 2
  const threshold = engineList.length === 2 ? 2 : Math.max(2, Math.ceil(engineList.length * 0.5));

  return Object.entries(topicCounts)
    .filter(([, count]) => count >= threshold)
    .sort(([, a], [, b]) => b - a) // sort by how many engines agree
    .map(([key]) => capitaliseFirst(topicOriginal[key] || key))
    .slice(0, 8);
}

// ─── CONFLICTED TOPICS BUILDER ────────────────────────────────────────────────
/**
 * Identify areas where engines appear to conflict.
 * Conflicts arise from:
 *   1. Sentiment disagreement — engines describe the brand with different tones
 *   2. Recommendation disagreement — some recommend, some do not
 *   3. Significant informalScore divergence — engines have very different
 *      assessments of how well-known the brand is informally
 *   4. Topics that appear in one engine's topicsKnown but another's topicsUnknown
 *
 * Returns human-readable conflict descriptions.
 *
 * @param {Object} engineDataMap
 * @returns {string[]}
 */
function buildConflictedTopics(engineDataMap) {
  const engineEntries = Object.entries(engineDataMap).filter(([, e]) => !e.failed);
  if (engineEntries.length < 2) return [];

  const conflicts = [];

  // ── Sentiment conflict ──
  const sentiments = engineEntries.map(([engine, d]) => ({
    engine,
    sentiment: d.sentiment || 'unknown'
  }));

  const uniqueSentiments = new Set(
    sentiments.map(s => s.sentiment).filter(s => s !== 'unknown')
  );

  if (uniqueSentiments.size >= 2) {
    const hasPositive = sentiments.some(s => s.sentiment === 'positive');
    const hasNegative = sentiments.some(s => s.sentiment === 'negative');
    const hasMixed    = sentiments.some(s => s.sentiment === 'mixed');

    if (hasPositive && hasNegative) {
      const positiveEngines = sentiments.filter(s => s.sentiment === 'positive').map(s => s.engine);
      const negativeEngines = sentiments.filter(s => s.sentiment === 'negative').map(s => s.engine);
      conflicts.push(
        `Brand sentiment: ${positiveEngines.join(', ')} describe positively — ${negativeEngines.join(', ')} describe negatively`
      );
    } else if (hasPositive && hasMixed) {
      conflicts.push('Brand sentiment: engines disagree — positive vs mixed perception');
    } else if (hasNegative && hasMixed) {
      conflicts.push('Brand sentiment: engines disagree — negative vs mixed perception');
    }
  }

  // ── Recommendation conflict ──
  const recommendations = engineEntries.map(([engine, d]) => ({
    engine,
    recommended: d.recommended || 'unclear'
  }));

  const recValues = recommendations.map(r => r.recommended).filter(r => r !== 'unclear');
  const uniqueRecs = new Set(recValues);

  if (uniqueRecs.has('yes') && uniqueRecs.has('no')) {
    const yesEngines = recommendations.filter(r => r.recommended === 'yes').map(r => r.engine);
    const noEngines  = recommendations.filter(r => r.recommended === 'no').map(r => r.engine);
    conflicts.push(
      `Recommendation: ${yesEngines.join(', ')} recommend this brand — ${noEngines.join(', ')} do not`
    );
  }

  // ── Informal score divergence ──
  const informalScores = engineEntries.map(([engine, d]) => ({
    engine,
    score: d.informalScore || 5
  }));

  const maxInformal = Math.max(...informalScores.map(s => s.score));
  const minInformal = Math.min(...informalScores.map(s => s.score));

  if (maxInformal - minInformal >= 4) {
    const highEngine = informalScores.find(s => s.score === maxInformal);
    const lowEngine  = informalScores.find(s => s.score === minInformal);
    conflicts.push(
      `Informal knowledge depth: ${highEngine.engine} has significantly richer social/community knowledge than ${lowEngine.engine}`
    );
  }

  // ── Topics in one engine's "known" but another's "unknown" ──
  for (let i = 0; i < engineEntries.length; i++) {
    for (let j = i + 1; j < engineEntries.length; j++) {
      const [engA, dataA] = engineEntries[i];
      const [engB, dataB] = engineEntries[j];

      const knownA   = (dataA.topicsKnown   || []).map(normaliseTopic);
      const unknownA = (dataA.topicsUnknown || []).map(normaliseTopic);
      const knownB   = (dataB.topicsKnown   || []).map(normaliseTopic);
      const unknownB = (dataB.topicsUnknown || []).map(normaliseTopic);

      // Topics that A knows but B explicitly says it doesn't know
      for (const topicA of knownA) {
        if (topicA.length < 2) continue;
        const inBUnknown = unknownB.some(u =>
          u === topicA || u.includes(topicA) || topicA.includes(u)
        );
        if (inBUnknown) {
          conflicts.push(
            `${capitaliseFirst(topicA)}: ${engA} has knowledge — ${engB} explicitly does not`
          );
          if (conflicts.length >= 6) break; // cap at 6 conflicts for display
        }
      }

      // Symmetric: topics B knows but A explicitly doesn't
      for (const topicB of knownB) {
        if (topicB.length < 2) continue;
        const inAUnknown = unknownA.some(u =>
          u === topicB || u.includes(topicB) || topicB.includes(u)
        );
        if (inAUnknown) {
          conflicts.push(
            `${capitaliseFirst(topicB)}: ${engB} has knowledge — ${engA} explicitly does not`
          );
          if (conflicts.length >= 6) break;
        }
      }

      if (conflicts.length >= 6) break;
    }
    if (conflicts.length >= 6) break;
  }

  return conflicts.slice(0, 6);
}

// ─── ENGINE-EXCLUSIVE TOPICS BUILDER ─────────────────────────────────────────
/**
 * Find topics or knowledge that only ONE engine mentions.
 * These are engine-exclusive signals — potentially representing unique
 * training data that other engines do not have.
 *
 * Includes both topic-level exclusives AND notable signal-level exclusives
 * (e.g. only one engine detected community presence, or virality).
 *
 * Returns objects shaped as { engine, topic } for rich frontend display.
 *
 * @param {Object} engineDataMap
 * @returns {Array<{engine: string, topic: string}>}
 */
function buildExclusiveTopics(engineDataMap) {
  const engineEntries = Object.entries(engineDataMap).filter(([, e]) => !e.failed);
  if (engineEntries.length < 2) return [];

  const exclusives = [];

  // ── Topic-level exclusives ──
  // A topic is exclusive if it appears in exactly one engine's topicsKnown
  // AND does not appear in any other engine's topicsKnown
  const allNormTopics = {};

  for (const [engine, data] of engineEntries) {
    for (const rawTopic of (data.topicsKnown || [])) {
      const norm = normaliseTopic(rawTopic);
      if (norm.length < 2) continue;
      if (!allNormTopics[norm]) allNormTopics[norm] = [];
      if (!allNormTopics[norm].includes(engine)) {
        allNormTopics[norm].push(engine);
      }
    }
  }

  // Find topics mentioned by exactly one engine
  // (with overlap-aware grouping)
  const usedTopicKeys = new Set();

  for (const [topic, engines] of Object.entries(allNormTopics)) {
    if (engines.length !== 1) continue;

    // Check it is not already covered by a similar exclusive
    let alreadyCovered = false;
    for (const used of usedTopicKeys) {
      if (used.includes(topic) || topic.includes(used)) {
        alreadyCovered = true;
        break;
      }
    }
    if (alreadyCovered) continue;

    usedTopicKeys.add(topic);
    exclusives.push({
      engine: engines[0],
      topic:  capitaliseFirst(topic)
    });

    if (exclusives.length >= 8) break;
  }

  // ── Signal-level exclusives ──
  // Only one engine detected community presence
  const communityEngines = engineEntries
    .filter(([, d]) => d.communityPresent === true)
    .map(([e]) => e);

  if (communityEngines.length === 1) {
    exclusives.push({
      engine: communityEngines[0],
      topic:  'Community & social knowledge (only this engine)'
    });
  }

  // Only one engine detected virality
  const viralityEngines = engineEntries
    .filter(([, d]) => d.viralitySignal === true)
    .map(([e]) => e);

  if (viralityEngines.length === 1) {
    exclusives.push({
      engine: viralityEngines[0],
      topic:  'Viral or cultural moment awareness (only this engine)'
    });
  }

  // Only one engine recommends the brand
  const recommendingEngines = engineEntries
    .filter(([, d]) => d.recommended === 'yes')
    .map(([e]) => e);

  if (recommendingEngines.length === 1 && engineEntries.length >= 2) {
    exclusives.push({
      engine: recommendingEngines[0],
      topic:  'Active recommendation signal (only this engine)'
    });
  }

  return exclusives.slice(0, 8);
}

// ─── CONSISTENCY LABEL ────────────────────────────────────────────────────────
/**
 * Map a consistency score to a human-readable label.
 * Labels match what the frontend renders in the consistency section.
 *
 * @param {number} score - 0–100
 * @returns {string}
 */
function consistencyLabel(score) {
  if (score >= 86) return 'VERY HIGH CONSISTENCY';
  if (score >= 71) return 'HIGH CONSISTENCY';
  if (score >= 51) return 'MODERATE CONSISTENCY';
  if (score >= 31) return 'LOW CONSISTENCY';
  return 'VERY LOW CONSISTENCY';
}

// ─── STRING HELPER ────────────────────────────────────────────────────────────
function capitaliseFirst(str) {
  if (!str || str.length === 0) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── MAIN EXPORT: analyseConsistency ─────────────────────────────────────────
/**
 * Analyse cross-engine consistency from the scored engine results.
 *
 * This function uses ALL fields from File 2 (queryEngine.js) and
 * File 3 (scorer.js) — not just topic lists. It treats informal
 * and social knowledge consistency with equal weight to formal
 * factual consistency, because for community-known brands the
 * informal consistency is the most meaningful signal.
 *
 * Consistency is computed across four dimensions:
 *
 * 1. topicOverlap (35%) — Jaccard similarity across topicsKnown arrays.
 *    Measures whether engines agree on WHAT they know about the brand.
 *    Uses partial matching so "fintech" and "payments fintech" agree.
 *
 * 2. sentimentAlignment (25%) — do engines agree on HOW the brand is
 *    perceived? Disagreement here means users get contradictory emotional
 *    impressions of the brand from different AI tools.
 *
 * 3. informalAlignment (25%) — do engines have similar depth of
 *    informal/social knowledge? Large divergence means some AI tools
 *    are far more informed about the brand's cultural footprint than others.
 *
 * 4. recommendationAlign (15%) — do engines agree on whether to
 *    recommend the brand? Disagreement is a brand trust risk signal.
 *
 * Returns the complete consistency object matching the frontend's
 * expected response shape exactly.
 *
 * @param {Object} scoredEngines - output of scoreAllEngines().scoredEngines
 * @returns {{
 *   score: number,
 *   label: string,
 *   agreed: string[],
 *   conflicted: string[],
 *   exclusive: Array<{engine: string, topic: string}>,
 *   engineCount: number,
 *   dimensionScores: {
 *     topicOverlap: number,
 *     sentimentAlignment: number,
 *     informalAlignment: number,
 *     recommendationAlign: number
 *   }
 * }}
 */
function analyseConsistency(scoredEngines) {
  const activeEngines = Object.entries(scoredEngines).filter(([, e]) => !e.failed);
  const engineCount   = activeEngines.length;

  logger.info(`Consistency analysis — ${engineCount} active engine(s)`);

  // ── Single engine: full consistency by definition ──
  if (engineCount < 2) {
    const singleData    = activeEngines[0]?.[1] || {};
    const singleTopics  = (singleData.topicsKnown || [])
      .map(t => capitaliseFirst(normaliseTopic(t)))
      .filter(t => t.length > 1)
      .slice(0, 6);

    logger.info('Consistency: single engine — returning self-consistent result');

    return {
      score:       100,
      label:       'SINGLE ENGINE — NO COMPARISON POSSIBLE',
      agreed:      singleTopics,
      conflicted:  [],
      exclusive:   [],
      engineCount: 1,
      dimensionScores: {
        topicOverlap:        100,
        sentimentAlignment:  100,
        informalAlignment:   100,
        recommendationAlign: 100
      }
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DIMENSION 1: Topic Overlap Score (0–100)
  // Compute mean pairwise Jaccard similarity across ALL engine pairs.
  // A pair with zero topics each gets a neutral 0.5 similarity.
  // ─────────────────────────────────────────────────────────────────────────
  const pairwiseJaccards = [];

  for (let i = 0; i < activeEngines.length; i++) {
    for (let j = i + 1; j < activeEngines.length; j++) {
      const topicsA = (activeEngines[i][1].topicsKnown || []).map(normaliseTopic).filter(t => t.length > 1);
      const topicsB = (activeEngines[j][1].topicsKnown || []).map(normaliseTopic).filter(t => t.length > 1);

      if (topicsA.length === 0 && topicsB.length === 0) {
        pairwiseJaccards.push(0.5); // both empty — neutral, not perfectly consistent
        continue;
      }

      if (topicsA.length === 0 || topicsB.length === 0) {
        pairwiseJaccards.push(0.2); // one is empty — low overlap
        continue;
      }

      // Use partial-match aware overlap rather than strict Jaccard
      // so "payments" and "fintech payments" register as overlapping
      const { matched } = findTopicOverlap(topicsA, topicsB);
      const unionSize   = new Set([...topicsA, ...topicsB]).size;
      const jaccard     = unionSize > 0 ? matched.length / unionSize : 0;
      pairwiseJaccards.push(jaccard);
    }
  }

  const meanJaccard     = pairwiseJaccards.reduce((a, b) => a + b, 0) / pairwiseJaccards.length;
  const topicOverlapScore = clamp(meanJaccard * 100);

  logger.info(`Consistency dimension 1 — topic overlap: ${topicOverlapScore} (mean jaccard: ${meanJaccard.toFixed(3)})`);

  // ─────────────────────────────────────────────────────────────────────────
  // DIMENSION 2: Sentiment Alignment Score (0–100)
  // Measures agreement on brand sentiment across engines.
  // Uses the SENTIMENT_COMPATIBILITY matrix for pairwise scoring.
  // ─────────────────────────────────────────────────────────────────────────
  const sentiments = activeEngines.map(([, d]) => d.sentiment || 'unknown');
  const sentimentCompat = meanPairwiseCompatibility(sentiments, SENTIMENT_COMPATIBILITY);
  const sentimentAlignScore = clamp(sentimentCompat * 100);

  logger.info(`Consistency dimension 2 — sentiment alignment: ${sentimentAlignScore} (sentiments: [${sentiments.join(', ')}])`);

  // ─────────────────────────────────────────────────────────────────────────
  // DIMENSION 3: Informal Knowledge Alignment Score (0–100)
  // Measures how similar the engines' informal/social knowledge depth is.
  // Large divergence = one engine has cultural signal the others lack.
  // ─────────────────────────────────────────────────────────────────────────
  const informalScores = activeEngines.map(([, d]) => d.informalScore || 5);
  const informalAlign   = informalScoreAlignment(informalScores);
  const informalAlignScore = clamp(informalAlign * 100);

  logger.info(`Consistency dimension 3 — informal alignment: ${informalAlignScore} (scores: [${informalScores.join(', ')}])`);

  // ─────────────────────────────────────────────────────────────────────────
  // DIMENSION 4: Recommendation Alignment Score (0–100)
  // Measures agreement on whether to recommend the brand.
  // ─────────────────────────────────────────────────────────────────────────
  const recommendations = activeEngines.map(([, d]) => d.recommended || 'unclear');
  const recCompat = meanPairwiseCompatibility(recommendations, RECOMMENDATION_COMPATIBILITY);
  const recAlignScore = clamp(recCompat * 100);

  logger.info(`Consistency dimension 4 — recommendation alignment: ${recAlignScore} (recs: [${recommendations.join(', ')}])`);

  // ─────────────────────────────────────────────────────────────────────────
  // COMPOSITE CONSISTENCY SCORE
  // Weighted combination of all four dimensions.
  // ─────────────────────────────────────────────────────────────────────────
  const consistencyScore = clamp(
    (topicOverlapScore    * CONSISTENCY_WEIGHTS.topicOverlap)       +
    (sentimentAlignScore  * CONSISTENCY_WEIGHTS.sentimentAlignment)  +
    (informalAlignScore   * CONSISTENCY_WEIGHTS.informalAlignment)   +
    (recAlignScore        * CONSISTENCY_WEIGHTS.recommendationAlign)
  );

  logger.info(
    `Consistency composite: ${consistencyScore} | ` +
    `topic=${topicOverlapScore} sentiment=${sentimentAlignScore} ` +
    `informal=${informalAlignScore} rec=${recAlignScore}`
  );

  // ─────────────────────────────────────────────────────────────────────────
  // BUILD AGREED / CONFLICTED / EXCLUSIVE LISTS
  // These populate the three columns in the frontend consistency section.
  // ─────────────────────────────────────────────────────────────────────────
  const agreed     = buildAgreedTopics(scoredEngines);
  const conflicted = buildConflictedTopics(scoredEngines);
  const exclusive  = buildExclusiveTopics(scoredEngines);

  logger.info(
    `Consistency lists — agreed: ${agreed.length} | ` +
    `conflicted: ${conflicted.length} | exclusive: ${exclusive.length}`
  );

  return {
    score:      consistencyScore,
    label:      consistencyLabel(consistencyScore),
    agreed,
    conflicted,
    exclusive,
    engineCount,
    dimensionScores: {
      topicOverlap:        topicOverlapScore,
      sentimentAlignment:  sentimentAlignScore,
      informalAlignment:   informalAlignScore,
      recommendationAlign: recAlignScore
    }
  };
}

module.exports = {
  analyseConsistency,
  // Exported for unit testing
  buildAgreedTopics,
  buildConflictedTopics,
  buildExclusiveTopics,
  findTopicOverlap,
  jaccardSimilarity,
  informalScoreAlignment,
  normaliseTopic,
  consistencyLabel
};
