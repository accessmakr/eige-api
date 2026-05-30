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
      if (wordsA.some(w => wordsB.includes(w))) {
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
 * Check whether a topic is substantively discussed in a primary text response.
 *
 * This is the core fix for A2/A12 (false positive conflicts) AND the new
 * issue identified in testing (BBC agreed topics returning empty).
 *
 * PROBLEM IT SOLVES — TWO MANIFESTATIONS:
 *
 * 1. False positive conflicts (A2/A12):
 *    A model lists a topic in topicsUnknown but its primary text discusses it.
 *    Without this check, the conflict is falsely flagged.
 *    Solution: before flagging a conflict, verify primary text.
 *
 * 2. Empty agreed topics (BBC issue):
 *    Two engines both know BBC extensively but use different vocabulary in
 *    their verification block. Meta AI lists "culture, technology" while
 *    Mistral lists "news, education, founding". Neither maps to the other
 *    through topicsKnown comparison alone, so agreed topics returns empty
 *    despite both engines having rich, overlapping knowledge.
 *    Solution: before excluding a topic from agreed, check if the other
 *    engine's primary text discusses it regardless of what it listed.
 *
 * Uses four matching layers, from strict to generous:
 *   1. Direct substring match
 *   2. Full word-level AND match (all significant words present)
 *   3. Curated alias map — covers the most common vocabulary divergences
 *      observed across multiple real scans
 *   4. Partial word-level OR match (at least 60% of significant words)
 *
 * @param {string} primaryText
 * @param {string} topic - normalised topic string
 * @returns {boolean}
 */
function isTopicDiscussedInText(primaryText, topic) {
  if (!primaryText || !topic) return false;

  const text = primaryText.toLowerCase();
  const norm = normaliseTopic(topic);

  if (!norm || norm.length < 2) return false;

  // Layer 1: direct substring
  if (text.includes(norm)) return true;

  // Layer 2: all significant words present
  const words = norm.split(' ').filter(w => w.length > 3);
  if (words.length === 0) return false;
  if (words.every(w => text.includes(w))) return true;

  // Layer 3: curated alias map
  // Covers vocabulary divergences observed across real scans including
  // BBC (culture/technology/news/education), CNN (founding/politics),
  // Amazon (cloud computing/AI/marketplace), L'Oréal (history/sustainability)
  const TOPIC_ALIASES = {
    'cloud computing':       ['aws', 'cloud', 'azure', 'google cloud', 'cloud services', 'infrastructure', 'cloud platform'],
    'ai':                    ['artificial intelligence', 'machine learning', 'alexa', 'ai services', 'deep learning', 'neural'],
    'history':               ['founded', 'founding', 'established', 'started in', 'origins', 'began in', 'created in', 'since 19', 'since 20'],
    'recent developments':   ['recently', 'latest', 'new launch', 'announced', 'unveiled', 'released'],
    'funding':               ['series', 'raised', 'investment', 'investors', 'venture', 'funding round', 'ipo'],
    'leadership':            ['ceo', 'cto', 'founder', 'executive', 'management', 'president', 'director'],
    'financials':            ['revenue', 'profit', 'valuation', 'market cap', 'earnings', 'billion', 'million', 'trillion'],
    'competitors':           ['competition', 'competitor', 'rival', 'alternative', 'versus', 'compared to', 'against'],
    'social media':          ['twitter', 'instagram', 'facebook', 'tiktok', 'linkedin', 'reddit', 'social platform'],
    'products':              ['product', 'service', 'offering', 'feature', 'tool', 'platform', 'solution', 'programme'],
    'industry':              ['sector', 'market', 'space', 'vertical', 'domain', 'category', 'field', 'niche'],
    'reputation':            ['known for', 'regarded', 'recognised', 'recognized', 'trusted', 'respected', 'praised'],
    'online presence':       ['website', 'web', 'online', 'internet', 'digital', 'platform', 'site'],
    'advertising':           ['advertising', 'marketing', 'ads', 'campaigns', 'promotion', 'commercials'],
    'sustainability':        ['sustainability', 'environment', 'green', 'carbon', 'esg', 'climate', 'responsible'],
    'demographics':          ['demographic', 'audience', 'users', 'customers', 'consumers', 'target market', 'who uses'],
    'digital streaming':     ['streaming', 'video', 'prime video', 'music', 'content', 'media', 'iplayer', 'on demand'],
    'business model':        ['revenue model', 'subscription', 'marketplace', 'freemium', 'pricing', 'monetis'],
    'user experience':       ['user experience', 'ux', 'interface', 'design', 'usability', 'ease of use'],
    'services':              ['service', 'offering', 'product', 'solution', 'tool', 'platform', 'programme'],
    'culture':               ['cultural', 'arts', 'entertainment', 'music', 'film', 'television', 'programme', 'documentary', 'content'],
    'technology':            ['tech', 'digital', 'online', 'streaming', 'iplayer', 'app', 'platform', 'software', 'innovation'],
    'news':                  ['news', 'journalism', 'reporting', 'broadcast', 'coverage', 'journalist', 'editorial'],
    'education':             ['educational', 'education', 'learning', 'school', 'academic', 'documentary', 'inform'],
    'recommendations':       ['recommend', 'suggestion', 'advise', 'endorse', 'popular', 'trusted', 'go-to'],
    'comparisons':           ['compared', 'versus', 'alternative', 'competitor', 'similar to', 'unlike', 'better than'],
    'founding':              ['founded', 'founding', 'established', 'started', 'created', 'launched', 'origin', '19', '20'],
    'location':              ['headquartered', 'based in', 'located', 'uk', 'united kingdom', 'british', 'american', 'french', 'us-based'],
    'founders':              ['founder', 'founded by', 'created by', 'established by', 'ted turner', 'jeff bezos', 'ceo', 'created'],
    'size':                  ['employees', 'staff', 'workforce', 'large', 'giant', 'massive', 'billion', 'million users', 'global'],
    'sentiment':             ['tone', 'perception', 'opinion', 'views', 'feelings', 'polarized', 'positive', 'negative', 'mixed'],
    'online marketplace':    ['marketplace', 'platform', 'sellers', 'third-party', 'vendors', 'e-commerce', 'online store'],
    'tax avoidance':         ['tax', 'taxes', 'controversial', 'criticism', 'scrutiny', 'regulatory'],
    'labor disputes':        ['labor', 'labour', 'workers', 'employees', 'warehouse', 'working conditions', 'unions'],
    'acquisitions':          ['acquired', 'acquisition', 'bought', 'purchased', 'merger', 'whole foods', 'mgm', 'twitch'],
    'brand category':        ['category', 'industry', 'sector', 'beauty', 'cosmetics', 'personal care', 'luxury'],
    'target audience':       ['target', 'audience', 'demographic', 'consumers', 'customers', 'women', 'men', 'age'],
    'sustainability initiatives': ['sustainability', 'environment', 'carbon', 'green', 'responsible', 'ethical', 'eco'],
    'community engagement':  ['community', 'engagement', 'social', 'cause', 'charity', 'sponsorship', 'initiative'],
    'controversies':         ['controversy', 'controversial', 'criticism', 'scandal', 'issue', 'problem', 'accused'],
    'viral':                 ['viral', 'trending', 'went viral', 'popular', 'widely shared', 'social media'],
    'active recommendation': ['recommend', 'suggested', 'popular', 'go-to', 'trusted source', 'widely used']
  };

  const aliases = TOPIC_ALIASES[norm] || [];
  if (aliases.some(alias => text.includes(alias))) return true;

  // Layer 4: partial word-level OR match — 60% threshold
  const presentWords = words.filter(w => text.includes(w));
  return words.length > 0 && (presentWords.length / words.length) >= 0.6;
}

// ─── EXPAND TOPICS WITH PRIMARY TEXT ─────────────────────────────────────────
/**
 * Expand a topicsKnown list by adding topics from another engine's list
 * that are actually discussed in this engine's primary text — even if
 * this engine did not explicitly list them in its own verification block.
 *
 * This is the fix for the BBC empty-agreed-topics issue.
 *
 * When Meta AI lists "culture, technology" and Mistral lists "news, education",
 * standard topicsKnown comparison finds no overlap. But:
 *   - isTopicDiscussedInText(MetaAI_primaryText, "news") → true
 *   - isTopicDiscussedInText(Mistral_primaryText, "culture") → true
 *
 * So we expand Meta AI's list to include "news, education" (topics from Mistral
 * that Meta AI's text actually discusses), and vice versa. The expanded lists
 * then show genuine overlap that the topicsKnown arrays missed.
 *
 * @param {string[]} ownTopics      - this engine's topicsKnown
 * @param {string[]} otherTopics    - the other engine's topicsKnown
 * @param {string}   ownPrimaryText - this engine's primary text
 * @returns {string[]} expanded topic list
 */
function expandTopicsWithPrimaryText(ownTopics, otherTopics, ownPrimaryText) {
  const own   = (ownTopics   || []).map(normaliseTopic).filter(t => t.length > 1);
  const other = (otherTopics || []).map(normaliseTopic).filter(t => t.length > 1);

  const expanded = new Set(own);

  for (const otherTopic of other) {
    // Already in own list — skip
    if (own.some(t => t === otherTopic || t.includes(otherTopic) || otherTopic.includes(t))) {
      expanded.add(otherTopic);
      continue;
    }
    // Check if this engine's primary text discusses the other engine's topic
    if (isTopicDiscussedInText(ownPrimaryText, otherTopic)) {
      expanded.add(otherTopic);
      logger.info(
        `Topic expansion: "${otherTopic}" added — discussed in primary text ` +
        `but not listed in topicsKnown`
      );
    }
  }

  return [...expanded];
}

// ─── AGREED TOPICS BUILDER ────────────────────────────────────────────────────
/**
 * Find topics that multiple engines genuinely agree on.
 *
 * FIX FOR BBC EMPTY AGREED TOPICS:
 * The previous implementation only compared topicsKnown arrays from the
 * verification block. Engines describing the same brand often list different
 * vocabulary for the same topics — "culture" vs "entertainment", "news" vs
 * "journalism", "technology" vs "digital". This caused zero agreed topics
 * even when both engines had rich, overlapping knowledge.
 *
 * The fix uses a TWO-PASS APPROACH:
 *
 * Pass 1 (Structured): Compare topicsKnown arrays as before — finds topics
 *   both engines explicitly listed with the same or similar vocabulary.
 *
 * Pass 2 (Text-verified): For each topic in ANY engine's topicsKnown, check
 *   whether OTHER engines' primary texts discuss it — even if those engines
 *   used different vocabulary in their own topicsKnown list. If the primary
 *   text discusses it, that engine implicitly knows it.
 *
 * Topics are included in agreed only when confirmed by BOTH passes OR when
 * Pass 2 provides strong text evidence from multiple engines.
 *
 * @param {Object} engineDataMap
 * @returns {string[]}
 */
function buildAgreedTopics(engineDataMap) {
  const engineList = Object.values(engineDataMap).filter(e => !e.failed);

  if (engineList.length < 2) {
    const topics = engineList[0]?.topicsKnown || [];
    return topics
      .map(t => capitaliseFirst(normaliseTopic(t)))
      .filter(t => t.length > 1)
      .slice(0, 6);
  }

  // ── Pass 1: structured topicsKnown comparison ──
  // Count how many engines listed each topic (with vocabulary normalisation)
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
        if (
          norm === existingKey ||
          norm.includes(existingKey) ||
          existingKey.includes(norm)
        ) {
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

  // Topics agreed through structured comparison
  const structuredAgreed = new Set(
    Object.entries(topicCounts)
      .filter(([, count]) => count >= threshold)
      .map(([key]) => key)
  );

  // ── Pass 2: text-verified agreement ──
  // For each topic in ANY engine's topicsKnown, check how many engines
  // actually discuss it (in primary text) regardless of vocabulary used.
  // This is the fix for BBC — topics that are genuinely known but listed
  // with different vocabulary in the verification block.
  const textVerifiedCounts = {};
  const textVerifiedOriginal = {};

  // Collect all unique topics from all engines
  const allTopics = new Map(); // norm → original
  for (const engineData of engineList) {
    for (const rawTopic of (engineData.topicsKnown || [])) {
      const norm = normaliseTopic(rawTopic);
      if (norm.length > 1 && !allTopics.has(norm)) {
        allTopics.set(norm, rawTopic);
      }
    }
  }

  // For each topic, count how many engines discuss it in their primary text
  for (const [norm, rawTopic] of allTopics.entries()) {
    let discussedCount = 0;

    for (const engineData of engineList) {
      // Already in this engine's topicsKnown — counts as discussed
      const inKnown = (engineData.topicsKnown || []).some(t => {
        const tn = normaliseTopic(t);
        return tn === norm || tn.includes(norm) || norm.includes(tn);
      });

      if (inKnown) {
        discussedCount++;
        continue;
      }

      // Check primary text as fallback
      if (isTopicDiscussedInText(engineData.primaryText || '', norm)) {
        discussedCount++;
      }
    }

    textVerifiedCounts[norm]   = discussedCount;
    textVerifiedOriginal[norm] = rawTopic;
  }

  const textVerifiedAgreed = new Set(
    Object.entries(textVerifiedCounts)
      .filter(([, count]) => count >= threshold)
      .map(([key]) => key)
  );

  // ── Merge both passes ──
  // A topic is agreed if it passes EITHER structured OR text-verified,
  // but we de-duplicate and prefer the structured form for display
  const agreedKeys = new Set([...structuredAgreed, ...textVerifiedAgreed]);

  // Build display list — prefer original form from structured, fall back to text-verified
  const displayTopics = [...agreedKeys]
    .sort((a, b) => {
      // Sort by total count descending — most-agreed topics first
      const countA = Math.max(topicCounts[a] || 0, textVerifiedCounts[a] || 0);
      const countB = Math.max(topicCounts[b] || 0, textVerifiedCounts[b] || 0);
      return countB - countA;
    })
    .map(key => {
      const original = topicOriginal[key] || textVerifiedOriginal[key] || key;
      return capitaliseFirst(original);
    })
    .filter(t => t.length > 1)
    .slice(0, 8);

  logger.info(
    `Agreed topics: ${displayTopics.length} found | ` +
    `structured: ${structuredAgreed.size} | text-verified: ${textVerifiedAgreed.size}`
  );

  return displayTopics;
}

// ─── CONFLICTED TOPICS BUILDER ────────────────────────────────────────────────
/**
 * Identify genuine conflicts between engines.
 *
 * FIX FOR A2/A12: Cross-references topicsUnknown claims against primary text
 * before flagging. Only topics where the model genuinely does not discuss
 * the subject in its primary response are flagged as conflicts.
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

  const recValues  = recommendations.map(r => r.recommended).filter(r => r !== 'unclear');
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

  // ── Topic-level conflicts — WITH PRIMARY TEXT CROSS-REFERENCE ──
  // Core fix for A2/A12: only flag a conflict when:
  //   1. Engine A lists topic in topicsKnown
  //   2. Engine B lists topic in topicsUnknown
  //   3. Engine B's primary text does NOT discuss the topic
  // All three conditions required simultaneously.
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

      for (const topicA of knownA) {
        if (topicA.length < 2) continue;

        const inBUnknown = unknownB.some(u =>
          u === topicA || u.includes(topicA) || topicA.includes(u)
        );
        if (!inBUnknown) continue;

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

      for (const topicB of knownB) {
        if (topicB.length < 2) continue;

        const inAUnknown = unknownA.some(u =>
          u === topicB || u.includes(topicB) || topicB.includes(u)
        );
        if (!inAUnknown) continue;

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
 * Find topics only ONE engine mentions.
 *
 * FIX FOR A2/A12: Before marking a topic exclusive, verify other engines
 * do not discuss it in their primary text. Prevents false exclusives where
 * the same topic appears in multiple primary texts but with different labels.
 */
function buildExclusiveTopics(engineDataMap) {
  const engineEntries = Object.entries(engineDataMap).filter(([, e]) => !e.failed);
  if (engineEntries.length < 2) return [];

  const exclusives   = [];
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

    // Verify OTHER engines do not actually discuss this topic in primary text
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
 * FIXES APPLIED:
 *
 * A2/A12 — False positive conflicts and exclusives:
 *   buildConflictedTopics() and buildExclusiveTopics() now cross-reference
 *   topicsUnknown claims against primary text before flagging anything.
 *   Only genuine conflicts — where primary text confirms absence of knowledge —
 *   are reported.
 *
 * BBC EMPTY AGREED TOPICS:
 *   buildAgreedTopics() now uses a two-pass approach. Pass 1 compares
 *   topicsKnown arrays (existing). Pass 2 cross-references each topic
 *   against all engines' primary texts to find vocabulary-divergent
 *   agreement. Both passes are merged for the final agreed list.
 *
 * TOPIC OVERLAP SCORE — TEXT-EXPANDED JACCARD:
 *   The topicOverlap dimension score now uses text-expanded topic lists.
 *   For each engine pair, topics from one engine's list that are discussed
 *   in the other engine's primary text are added before computing Jaccard.
 *   This gives a more accurate overlap score for well-known brands where
 *   engines agree substantively but use different vocabulary.
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

  // ── Dimension 1: Topic Overlap — TEXT-EXPANDED JACCARD ──
  // For each engine pair, expand each engine's topic list with topics from
  // the other engine that are discussed in this engine's primary text.
  // This gives an accurate overlap score even when engines use different
  // vocabulary for the same topics.
  const pairwiseJaccards = [];

  for (let i = 0; i < activeEngines.length; i++) {
    for (let j = i + 1; j < activeEngines.length; j++) {
      const [, dataI] = activeEngines[i];
      const [, dataJ] = activeEngines[j];

      const rawTopicsI = (dataI.topicsKnown || []).map(normaliseTopic).filter(t => t.length > 1);
      const rawTopicsJ = (dataJ.topicsKnown || []).map(normaliseTopic).filter(t => t.length > 1);

      if (rawTopicsI.length === 0 && rawTopicsJ.length === 0) {
        pairwiseJaccards.push(0.5);
        continue;
      }

      if (rawTopicsI.length === 0 || rawTopicsJ.length === 0) {
        pairwiseJaccards.push(0.2);
        continue;
      }

      // Expand each engine's list with the other's topics found in primary text
      const expandedI = expandTopicsWithPrimaryText(
        rawTopicsI, rawTopicsJ, dataI.primaryText || ''
      );
      const expandedJ = expandTopicsWithPrimaryText(
        rawTopicsJ, rawTopicsI, dataJ.primaryText || ''
      );

      // Compute Jaccard on the expanded lists
      const { matched } = findTopicOverlap(expandedI, expandedJ);
      const unionSize   = new Set([
        ...expandedI.map(normaliseTopic),
        ...expandedJ.map(normaliseTopic)
      ]).size;

      const jaccard = unionSize > 0 ? matched.length / unionSize : 0;
      pairwiseJaccards.push(jaccard);

      logger.info(
        `Topic overlap [pair ${i}-${j}]: ` +
        `raw I=${rawTopicsI.length} expanded I=${expandedI.length} | ` +
        `raw J=${rawTopicsJ.length} expanded J=${expandedJ.length} | ` +
        `matched=${matched.length} union=${unionSize} jaccard=${jaccard.toFixed(3)}`
      );
    }
  }

  const meanJaccard      = pairwiseJaccards.reduce((a, b) => a + b, 0) / pairwiseJaccards.length;
  const topicOverlapScore = clamp(meanJaccard * 100);

  logger.info(`Consistency D1 — topic overlap: ${topicOverlapScore} (mean jaccard: ${meanJaccard.toFixed(3)})`);

  // ── Dimension 2: Sentiment Alignment ──
  const sentiments          = activeEngines.map(([, d]) => d.sentiment || 'unknown');
  const sentimentCompat     = meanPairwiseCompatibility(sentiments, SENTIMENT_COMPATIBILITY);
  const sentimentAlignScore = clamp(sentimentCompat * 100);

  logger.info(`Consistency D2 — sentiment alignment: ${sentimentAlignScore} (sentiments: [${sentiments.join(', ')}])`);

  // ── Dimension 3: Informal Alignment ──
  const informalScores     = activeEngines.map(([, d]) => d.informalScore || 5);
  const informalAlign      = informalScoreAlignment(informalScores);
  const informalAlignScore = clamp(informalAlign * 100);

  logger.info(`Consistency D3 — informal alignment: ${informalAlignScore} (scores: [${informalScores.join(', ')}])`);

  // ── Dimension 4: Recommendation Alignment ──
  const recommendations = activeEngines.map(([, d]) => d.recommended || 'unclear');
  const recCompat       = meanPairwiseCompatibility(recommendations, RECOMMENDATION_COMPATIBILITY);
  const recAlignScore   = clamp(recCompat * 100);

  logger.info(`Consistency D4 — recommendation alignment: ${recAlignScore} (recs: [${recommendations.join(', ')}])`);

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

  // ── Build agreed / conflicted / exclusive ──
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
  expandTopicsWithPrimaryText,
  isTopicDiscussedInText,
  jaccardSimilarity,
  informalScoreAlignment,
  normaliseTopic,
  consistencyLabel
};
