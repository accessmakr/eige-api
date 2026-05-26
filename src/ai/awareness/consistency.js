'use strict';

const logger = require('../../utils/logger');

// ─── CONSISTENCY WEIGHT DISTRIBUTION ──────────────────────────────────────────
const CONSISTENCY_WEIGHTS = {
  topicOverlap:        0.35,
  sentimentAlignment:  0.25,
  informalAlignment:   0.25,
  recommendationAlign: 0.15
};

// ─── SENTIMENT COMPATIBILITY MATRIX ──────────────────────────────────────────
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

function clamp(value, min = 0, max = 100) {
  return Math.round(Math.min(Math.max(value, min), max));
}

function normaliseTopic(topic) {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function findTopicOverlap(topicsA, topicsB) {
  const normA = (topicsA || []).map(normaliseTopic).filter(t => t.length > 1);
  const normB = (topicsB || []).map(normaliseTopic).filter(t => t.length > 1);

  const matched = [];
  const matchedBIndices = new Set();

  for (const ta of normA) {
    let found = false;
    for (let i = 0; i < normB.length; i++) {
      if (matchedBIndices.has(i)) continue;
      const tb = normB[i];
      if (ta === tb || ta.includes(tb) || tb.includes(ta)) {
        matched.push(ta);
        matchedBIndices.add(i);
        found = true;
        break;
      }
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

function pairCompatibility(matrix, valA, valB) {
  const a = (valA || 'unknown').toLowerCase();
  const b = (valB || 'unknown').toLowerCase();
  return (matrix[a] && matrix[a][b] !== undefined) ? matrix[a][b] : 0.5;
}

function meanPairwiseCompatibility(values, matrix) {
  if (!values || values.length < 2) return 0.7;
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

function informalScoreAlignment(informalScores) {
  const valid = (informalScores || []).filter(s => typeof s === 'number' && s >= 1 && s <= 10);
  if (valid.length < 2) return 0.7;
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  if (mean === 0) return 0;
  const variance = valid.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / valid.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;
  return Math.max(0.1, 1.0 - cv);
}

function capitaliseFirst(str) {
  if (!str || str.length === 0) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ─── TOPIC TEXT PRESENCE CHECK ────────────────────────────────────────────────
/**
 * Check whether a topic is actually discussed in a primary text response.
 *
 * This is the core fix for A2 and A12 — the false positive conflict problem.
 *
 * The verification block's self-reported topicsUnknown list frequently
 * contradicts what the model actually said in its primary response.
 * A model that discussed AWS and cloud computing in detail then lists
 * "cloud computing" as topicsUnknown in the structured extraction turn.
 * This is a known LLM self-assessment limitation.
 *
 * Before flagging any topic as a conflict or exclusive, we cross-reference
 * the topicsUnknown claim against the actual primary text. If the primary
 * text contains meaningful discussion of the topic, the unknown claim
 * is overridden — the model DOES know it regardless of what it said
 * in the structured extraction.
 *
 * @param {string}   primaryText  - the model's full primary response
 * @param {string}   topic        - normalised topic string to check
 * @returns {boolean} true if the topic is substantively discussed in primaryText
 */
function isTopicDiscussedInText(primaryText, topic) {
  if (!primaryText || !topic) return false;

  const text  = primaryText.toLowerCase();
  const norm  = normaliseTopic(topic);

  if (!norm || norm.length < 2) return false;

  // Direct substring match
  if (text.includes(norm)) return true;

  // Word-level match — any significant word from the topic appears in text
  const words = norm.split(' ').filter(w => w.length > 3);
  if (words.length === 0) return false;

  // All significant words must be present (AND match, not OR)
  // This prevents "cloud" matching "cloud" in an unrelated sentence
  const allPresent = words.every(w => text.includes(w));
  if (allPresent) return true;

  // Synonym / alias mapping for common topic mis-labels
  // These cover the most frequent false positives observed in real scans
  const TOPIC_ALIASES = {
    'cloud computing':    ['aws', 'cloud', 'azure', 'google cloud', 'cloud services', 'cloud platform', 'infrastructure'],
    'ai':                 ['artificial intelligence', 'machine learning', 'alexa', 'ai services', 'ml', 'deep learning'],
    'history':            ['founded', 'founding', 'established', 'started in', 'origins', 'began in', 'created in'],
    'recent developments':['recently', 'latest', 'new launch', 'announced', 'unveiled', 'released'],
    'funding':            ['series', 'raised', 'investment', 'investors', 'venture', 'funding round'],
    'leadership':         ['ceo', 'cto', 'founder', 'executive', 'management', 'president'],
    'financials':         ['revenue', 'profit', 'valuation', 'market cap', 'earnings', 'billion', 'million'],
    'competitors':        ['competition', 'competitor', 'rival', 'alternative', 'versus', 'compared to'],
    'social media':       ['twitter', 'instagram', 'facebook', 'tiktok', 'linkedin', 'reddit', 'social'],
    'products':           ['product', 'service', 'offering', 'feature', 'tool', 'platform', 'solution'],
    'industry':           ['sector', 'market', 'space', 'vertical', 'domain', 'category', 'field'],
    'reputation':         ['reputation', 'perception', 'known for', 'regarded', 'recognised', 'recognized'],
    'online presence':    ['website', 'web', 'online', 'internet', 'digital', 'platform'],
    'advertising':        ['advertising', 'marketing', 'ads', 'campaigns', 'promotion'],
    'sustainability':     ['sustainability', 'environment', 'green', 'carbon', 'esg', 'climate'],
    'demographics':       ['demographic', 'audience', 'users', 'customers', 'consumers', 'target'],
    'digital streaming':  ['streaming', 'video', 'prime video', 'music', 'content', 'media'],
    'business model':     ['revenue model', 'business', 'subscription', 'marketplace', 'platform'],
    'user experience':    ['user experience', 'ux', 'interface', 'design', 'usability', 'experience'],
    'services':           ['service', 'offering', 'product', 'solution', 'tool', 'platform']
  };

  const aliases = TOPIC_ALIASES[norm] || [];
  if (aliases.some(alias => text.includes(alias))) return true;

  // Partial word-level OR match as final fallback
  // At least half the significant words must be present
  const presentWords = words.filter(w => text.includes(w));
  return words.length > 0 && (presentWords.length / words.length) >= 0.6;
}

// ─── AGREED TOPICS BUILDER ────────────────────────────────────────────────────

function buildAgreedTopics(engineDataMap) {
  const engineList = Object.values(engineDataMap).filter(e => !e.failed);
  if (engineList.length < 2) {
    const topics = engineList[0]?.topicsKnown || [];
    return topics
      .map(t => capitaliseFirst(normaliseTopic(t)))
      .filter(t => t.length > 1)
      .slice(0, 6);
  }

  const topicCounts  = {};
  const topicOriginal = {};

  for (const engineData of engineList) {
    const topics = engineData.topicsKnown || [];
    const seen   = new Set();

    for (const rawTopic of topics) {
      const norm = normaliseTopic(rawTopic);
      if (!norm || norm.length < 2) continue;

      let matchedKey = null;
      for (const existingKey of Object.keys(topicCounts)) {
        if (norm === existingKey || norm.includes(existingKey) || existingKey.includes(norm)) {
          matchedKey = existingKey;
          break;
        }
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

      topicCounts[key]   = (topicCounts[key] || 0) + 1;
      topicOriginal[key] = topicOriginal[key] || rawTopic;
    }
  }

  const threshold = engineList.length === 2 ? 2 : Math.max(2, Math.ceil(engineList.length * 0.5));

  return Object.entries(topicCounts)
    .filter(([, count]) => count >= threshold)
    .sort(([, a], [, b]) => b - a)
    .map(([key]) => capitaliseFirst(topicOriginal[key] || key))
    .slice(0, 8);
}

// ─── CONFLICTED TOPICS BUILDER ────────────────────────────────────────────────
/**
 * Identify genuine conflicts between engines.
 *
 * FIX FOR A2 + A12:
 * Before flagging a topic as conflicted, we now cross-reference
 * the topicsUnknown claim against the engine's actual primary text
 * using isTopicDiscussedInText(). If the primary text substantively
 * discusses a topic that the engine listed as topicsUnknown, the
 * conflict is suppressed — the engine DOES know that topic regardless
 * of what it said in the structured extraction turn.
 *
 * This eliminates false positives like:
 *   - Amazon "Cloud computing" flagged as Meta-exclusive when
 *     Meta's text explicitly mentions AWS
 *   - L'Oréal "History" flagged as Mistral-unknown when
 *     Mistral's text explicitly states the 1909 founding year
 *
 * Only conflicts where the primary text genuinely does NOT discuss
 * the topic are flagged.
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

  const recValues    = recommendations.map(r => r.recommended).filter(r => r !== 'unclear');
  const uniqueRecs   = new Set(recValues);

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

  // ── Topic-level conflicts — WITH PRIMARY TEXT CROSS-REFERENCE ──
  // This is the core fix for A2 and A12.
  // We only flag a topic as conflicted when:
  //   1. Engine A lists the topic in topicsKnown
  //   2. Engine B lists the topic in topicsUnknown
  //   3. AND Engine B's primary text does NOT substantively discuss the topic
  //
  // Condition 3 is the new gate. Without it, responsible LLM self-assessment
  // in the structured extraction turn generates false conflict signals.
  for (let i = 0; i < engineEntries.length; i++) {
    for (let j = i + 1; j < engineEntries.length; j++) {
      const [engA, dataA] = engineEntries[i];
      const [engB, dataB] = engineEntries[j];

      const knownA   = (dataA.topicsKnown   || []).map(normaliseTopic);
      const unknownB = (dataB.topicsUnknown || []).map(normaliseTopic);
      const knownB   = (dataB.topicsKnown   || []).map(normaliseTopic);
      const unknownA = (dataA.topicsUnknown || []).map(normaliseTopic);

      const primaryTextA = dataA.primaryText || '';
      const primaryTextB = dataB.primaryText || '';

      // Topics that A knows, B says it doesn't know,
      // AND B's primary text does NOT discuss the topic
      for (const topicA of knownA) {
        if (topicA.length < 2) continue;

        const inBUnknown = unknownB.some(u =>
          u === topicA || u.includes(topicA) || topicA.includes(u)
        );

        if (!inBUnknown) continue;

        // KEY FIX: cross-reference against B's actual primary text
        // If B's text discusses the topic, suppress the conflict
        const bActuallyKnows = isTopicDiscussedInText(primaryTextB, topicA);

        if (bActuallyKnows) {
          logger.info(
            `Conflict suppressed: "${topicA}" listed as unknown by ${engB} ` +
            `but IS discussed in ${engB} primary text — false positive eliminated`
          );
          continue;
        }

        conflicts.push(
          `${capitaliseFirst(topicA)}: ${engA} has knowledge — ${engB} genuinely does not`
        );
        if (conflicts.length >= 6) break;
      }

      // Symmetric: topics B knows, A says it doesn't know,
      // AND A's primary text does NOT discuss the topic
      for (const topicB of knownB) {
        if (topicB.length < 2) continue;

        const inAUnknown = unknownA.some(u =>
          u === topicB || u.includes(topicB) || topicB.includes(u)
        );

        if (!inAUnknown) continue;

        // KEY FIX: cross-reference against A's actual primary text
        const aActuallyKnows = isTopicDiscussedInText(primaryTextA, topicB);

        if (aActuallyKnows) {
          logger.info(
            `Conflict suppressed: "${topicB}" listed as unknown by ${engA} ` +
            `but IS discussed in ${engA} primary text — false positive eliminated`
          );
          continue;
        }

        conflicts.push(
          `${capitaliseFirst(topicB)}: ${engB} has knowledge — ${engA} genuinely does not`
        );
        if (conflicts.length >= 6) break;
      }

      if (conflicts.length >= 6) break;
    }
    if (conflicts.length >= 6) break;
  }

  return conflicts.slice(0, 6);
}

// ─── ENGINE-EXCLUSIVE TOPICS BUILDER ─────────────────────────────────────────
/**
 * Find topics that only ONE engine mentions.
 *
 * FIX FOR A2 + A12 — also applied here:
 * Before marking a topic as exclusive to one engine, we verify that
 * the OTHER engines do not actually discuss it in their primary text.
 * If engine B has "cloud computing" as exclusive but engine A's text
 * says "AWS" — that is not exclusive, that is a topic labelling difference.
 */
function buildExclusiveTopics(engineDataMap) {
  const engineEntries = Object.entries(engineDataMap).filter(([, e]) => !e.failed);
  if (engineEntries.length < 2) return [];

  const exclusives = [];

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

  const usedTopicKeys = new Set();

  for (const [topic, engines] of Object.entries(allNormTopics)) {
    if (engines.length !== 1) continue;

    let alreadyCovered = false;
    for (const used of usedTopicKeys) {
      if (used.includes(topic) || topic.includes(used)) {
        alreadyCovered = true;
        break;
      }
    }
    if (alreadyCovered) continue;

    // KEY FIX: verify the OTHER engines do not actually discuss
    // this topic in their primary text before marking it exclusive
    const claimingEngine = engines[0];
    const otherEngines   = engineEntries.filter(([e]) => e !== claimingEngine);

    const isGenuinelyExclusive = otherEngines.every(([, otherData]) => {
      return !isTopicDiscussedInText(otherData.primaryText || '', topic);
    });

    if (!isGenuinelyExclusive) {
      logger.info(
        `Exclusive suppressed: "${topic}" claimed exclusive to ${claimingEngine} ` +
        `but other engines discuss it in primary text — false exclusive eliminated`
      );
      continue;
    }

    usedTopicKeys.add(topic);
    exclusives.push({
      engine: claimingEngine,
      topic:  capitaliseFirst(topic)
    });

    if (exclusives.length >= 8) break;
  }

  // ── Signal-level exclusives ──
  const communityEngines = engineEntries
    .filter(([, d]) => d.communityPresent === true)
    .map(([e]) => e);

  if (communityEngines.length === 1) {
    exclusives.push({
      engine: communityEngines[0],
      topic:  'Community and social knowledge (only this engine)'
    });
  }

  const viralityEngines = engineEntries
    .filter(([, d]) => d.viralitySignal === true)
    .map(([e]) => e);

  if (viralityEngines.length === 1) {
    exclusives.push({
      engine: viralityEngines[0],
      topic:  'Viral or cultural moment awareness (only this engine)'
    });
  }

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

function consistencyLabel(score) {
  if (score >= 86) return 'VERY HIGH CONSISTENCY';
  if (score >= 71) return 'HIGH CONSISTENCY';
  if (score >= 51) return 'MODERATE CONSISTENCY';
  if (score >= 31) return 'LOW CONSISTENCY';
  return 'VERY LOW CONSISTENCY';
}

// ─── MAIN EXPORT: analyseConsistency ─────────────────────────────────────────
/**
 * Analyse cross-engine consistency from scored engine results.
 *
 * All fixes for A2 and A12 are applied through isTopicDiscussedInText()
 * in buildConflictedTopics() and buildExclusiveTopics(). Topic-level
 * conflicts and exclusives are now cross-referenced against primary
 * text before being reported — eliminating false positives from
 * LLM self-assessment misalignment in the verification turn.
 *
 * @param {Object} scoredEngines
 * @returns {{
 *   score: number,
 *   label: string,
 *   agreed: string[],
 *   conflicted: string[],
 *   exclusive: Array<{engine: string, topic: string}>,
 *   engineCount: number,
 *   dimensionScores: object
 * }}
 */
function analyseConsistency(scoredEngines) {
  const activeEngines = Object.entries(scoredEngines).filter(([, e]) => !e.failed);
  const engineCount   = activeEngines.length;

  logger.info(`Consistency analysis — ${engineCount} active engine(s)`);

  if (engineCount < 2) {
    const singleData   = activeEngines[0]?.[1] || {};
    const singleTopics = (singleData.topicsKnown || [])
      .map(t => capitaliseFirst(normaliseTopic(t)))
      .filter(t => t.length > 1)
      .slice(0, 6);

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

  // ── Dimension 1: Topic Overlap ──
  const pairwiseJaccards = [];

  for (let i = 0; i < activeEngines.length; i++) {
    for (let j = i + 1; j < activeEngines.length; j++) {
      const topicsA = (activeEngines[i][1].topicsKnown || [])
        .map(normaliseTopic).filter(t => t.length > 1);
      const topicsB = (activeEngines[j][1].topicsKnown || [])
        .map(normaliseTopic).filter(t => t.length > 1);

      if (topicsA.length === 0 && topicsB.length === 0) {
        pairwiseJaccards.push(0.5);
        continue;
      }
      if (topicsA.length === 0 || topicsB.length === 0) {
        pairwiseJaccards.push(0.2);
        continue;
      }

      const { matched } = findTopicOverlap(topicsA, topicsB);
      const unionSize   = new Set([...topicsA, ...topicsB]).size;
      const jaccard     = unionSize > 0 ? matched.length / unionSize : 0;
      pairwiseJaccards.push(jaccard);
    }
  }

  const meanJaccard      = pairwiseJaccards.reduce((a, b) => a + b, 0) / pairwiseJaccards.length;
  const topicOverlapScore = clamp(meanJaccard * 100);

  logger.info(`Consistency D1 — topic overlap: ${topicOverlapScore}`);

  // ── Dimension 2: Sentiment Alignment ──
  const sentiments         = activeEngines.map(([, d]) => d.sentiment || 'unknown');
  const sentimentCompat    = meanPairwiseCompatibility(sentiments, SENTIMENT_COMPATIBILITY);
  const sentimentAlignScore = clamp(sentimentCompat * 100);

  logger.info(`Consistency D2 — sentiment alignment: ${sentimentAlignScore}`);

  // ── Dimension 3: Informal Alignment ──
  const informalScores     = activeEngines.map(([, d]) => d.informalScore || 5);
  const informalAlign      = informalScoreAlignment(informalScores);
  const informalAlignScore = clamp(informalAlign * 100);

  logger.info(`Consistency D3 — informal alignment: ${informalAlignScore}`);

  // ── Dimension 4: Recommendation Alignment ──
  const recommendations  = activeEngines.map(([, d]) => d.recommended || 'unclear');
  const recCompat        = meanPairwiseCompatibility(recommendations, RECOMMENDATION_COMPATIBILITY);
  const recAlignScore    = clamp(recCompat * 100);

  logger.info(`Consistency D4 — recommendation alignment: ${recAlignScore}`);

  // ── Composite score ──
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

  // ── Build agreed / conflicted / exclusive lists ──
  const agreed    = buildAgreedTopics(scoredEngines);
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
  buildAgreedTopics,
  buildConflictedTopics,
  buildExclusiveTopics,
  findTopicOverlap,
  isTopicDiscussedInText,
  jaccardSimilarity,
  informalScoreAlignment,
  normaliseTopic,
  consistencyLabel
};
