'use strict';

const logger = require('../../utils/logger');

// ─── GAP SEVERITY LEVELS ──────────────────────────────────────────────────────
// Every gap is classified into one of three severity tiers.
// These match exactly what the frontend renders in the narrative gaps section.
const SEVERITY = {
  CRITICAL: 'critical',  // brand is misrepresented or completely absent
  MODERATE: 'moderate',  // brand is present but a key dimension is missing or wrong
  MINOR:    'minor'      // a specific signal could be strengthened
};

// ─── GAP TYPE DEFINITIONS ─────────────────────────────────────────────────────
// Each gap type maps to a specific failure mode in how AI systems
// understand and represent a brand. These are the categories rendered
// in the frontend gap cards.
const GAP_TYPES = {
  ABSENT:              'absent',               // brand not in training data at all
  RECOGNITION_THIN:    'recognition_thin',     // AI barely recognises the brand
  COMMUNITY_INVISIBLE: 'community_invisible',  // no social/community signal in AI
  SENTIMENT_SPLIT:     'sentiment_split',      // engines disagree on brand sentiment
  DEPTH_LOW:           'depth_low',            // AI awareness exists but is shallow
  INFORMAL_WEAK:       'informal_weak',        // formal facts only, no cultural/social layer
  FORMAL_WEAK:         'formal_weak',          // community-known but no factual anchoring
  RECOMMENDATION_GAP:  'recommendation_gap',   // AI does not recommend despite brand quality
  VIRAL_INVISIBLE:     'viral_invisible',      // brand has viral moments not reflected in AI
  CONSISTENCY_LOW:     'consistency_low',      // engines give contradictory pictures
  ACCURACY_LOW:        'accuracy_low',         // AI information appears unreliable
  COMPETITIVE_CONTEXT: 'competitive_context',  // AI cannot place brand in competitive landscape
  AUDIENCE_UNKNOWN:    'audience_unknown',     // AI does not know who uses this brand
  CATEGORY_CONFUSION:  'category_confusion',   // AI misclassifies the brand's category
  NARRATIVE_STALE:     'narrative_stale',      // AI knowledge appears outdated
  SOCIAL_FOOTPRINT_LOW:'social_footprint_low'  // minimal social media signal in AI
};

// ─── BRAND COMMUNICATES TEMPLATES ─────────────────────────────────────────────
// These describe what a brand SHOULD be communicating about itself.
// They are used to fill the "brandCommunicates" field in each gap object —
// the frontend renders this as what the brand says vs what AI produces.
const BRAND_TEMPLATES = {
  [GAP_TYPES.ABSENT]:
    'The brand exists and has an active web presence, products or services, and real users',
  [GAP_TYPES.RECOGNITION_THIN]:
    'The brand is an established entity with a clear identity, purpose, and user base',
  [GAP_TYPES.COMMUNITY_INVISIBLE]:
    'The brand has an active community, engaged users, and social media presence',
  [GAP_TYPES.SENTIMENT_SPLIT]:
    'The brand has a consistent, positive identity and clear value proposition',
  [GAP_TYPES.DEPTH_LOW]:
    'The brand has a rich story — products, use cases, team, milestones, and differentiation',
  [GAP_TYPES.INFORMAL_WEAK]:
    'The brand is discussed, recommended, and referenced across communities and social media',
  [GAP_TYPES.FORMAL_WEAK]:
    'The brand has verifiable facts — founding, team, location, products, or milestones',
  [GAP_TYPES.RECOMMENDATION_GAP]:
    'The brand is recommended by users, creators, and communities as a go-to solution',
  [GAP_TYPES.VIRAL_INVISIBLE]:
    'The brand has had notable viral moments, launches, or cultural references online',
  [GAP_TYPES.CONSISTENCY_LOW]:
    'The brand presents a consistent identity and message across all channels',
  [GAP_TYPES.ACCURACY_LOW]:
    'Accurate, verifiable information about the brand is publicly available',
  [GAP_TYPES.COMPETITIVE_CONTEXT]:
    'The brand occupies a clear position in its competitive landscape',
  [GAP_TYPES.AUDIENCE_UNKNOWN]:
    'The brand serves a specific, identifiable audience with clear needs',
  [GAP_TYPES.CATEGORY_CONFUSION]:
    'The brand belongs to a well-defined category or industry vertical',
  [GAP_TYPES.NARRATIVE_STALE]:
    'The brand has recent, updated information, launches, and milestones publicly documented',
  [GAP_TYPES.SOCIAL_FOOTPRINT_LOW]:
    'The brand has meaningful presence across social platforms, forums, and creator content'
};

// ─── AI PRODUCES TEMPLATES ────────────────────────────────────────────────────
// What AI systems are actually producing for each gap type.
// These fill the "aiProduces" field — the contrast with brandCommunicates
// is what makes each gap card informative to the user.
const AI_TEMPLATES = {
  [GAP_TYPES.ABSENT]:
    'No meaningful information — brand not found in AI training data',
  [GAP_TYPES.RECOGNITION_THIN]:
    'Minimal or uncertain recognition — AI hedges or barely acknowledges brand existence',
  [GAP_TYPES.COMMUNITY_INVISIBLE]:
    'No community, social, or conversational knowledge about this brand',
  [GAP_TYPES.SENTIMENT_SPLIT]:
    'Contradictory sentiment — different AI engines describe brand tone differently',
  [GAP_TYPES.DEPTH_LOW]:
    'Surface-level awareness only — AI cannot go beyond basic category description',
  [GAP_TYPES.INFORMAL_WEAK]:
    'Formal facts only — no community discussion, social signal, or recommendation context',
  [GAP_TYPES.FORMAL_WEAK]:
    'Community awareness without factual anchoring — AI cannot verify basic brand facts',
  [GAP_TYPES.RECOMMENDATION_GAP]:
    'AI does not include this brand when recommending solutions in its category',
  [GAP_TYPES.VIRAL_INVISIBLE]:
    'No awareness of viral moments, launches, or cultural events associated with this brand',
  [GAP_TYPES.CONSISTENCY_LOW]:
    'Inconsistent picture — AI engines give contradictory descriptions of this brand',
  [GAP_TYPES.ACCURACY_LOW]:
    'Information appears unreliable — high rate of conflicting or unverifiable claims',
  [GAP_TYPES.COMPETITIVE_CONTEXT]:
    'AI cannot name competitors or place brand in its competitive landscape',
  [GAP_TYPES.AUDIENCE_UNKNOWN]:
    'AI does not know who uses this brand or what problem it solves for them',
  [GAP_TYPES.CATEGORY_CONFUSION]:
    'AI is uncertain or incorrect about what category or industry this brand belongs to',
  [GAP_TYPES.NARRATIVE_STALE]:
    'AI knowledge appears outdated — references old information or lacks recent developments',
  [GAP_TYPES.SOCIAL_FOOTPRINT_LOW]:
    'Weak or absent social media and creator-driven knowledge about this brand'
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Build a gap object in the exact shape the frontend expects.
 *
 * @param {string} gapType    - one of GAP_TYPES values
 * @param {string} severity   - one of SEVERITY values
 * @param {string} [overrideBrandCommunicates] - optional custom brand message
 * @param {string} [overrideAiProduces]        - optional custom AI description
 * @returns {{ severity: string, brandCommunicates: string, aiProduces: string, gapType: string }}
 */
function buildGap(gapType, severity, overrideBrandCommunicates, overrideAiProduces) {
  return {
    severity,
    brandCommunicates: overrideBrandCommunicates || BRAND_TEMPLATES[gapType] || 'Brand has a clear identity',
    aiProduces:        overrideAiProduces        || AI_TEMPLATES[gapType]    || 'AI has limited knowledge',
    gapType
  };
}

/**
 * Mean of an array of numbers. Returns defaultVal if array is empty.
 *
 * @param {number[]} arr
 * @param {number}   defaultVal
 * @returns {number}
 */
function mean(arr, defaultVal = 0) {
  const valid = (arr || []).filter(n => typeof n === 'number' && !isNaN(n));
  if (valid.length === 0) return defaultVal;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/**
 * Get the dominant sentiment across all engines.
 * Returns the most common non-unknown sentiment value.
 *
 * @param {Object} scoredEngines
 * @returns {string}
 */
function getDominantSentiment(scoredEngines) {
  const counts = {};
  for (const data of Object.values(scoredEngines)) {
    if (data.failed) continue;
    const s = data.sentiment || 'unknown';
    if (s !== 'unknown') counts[s] = (counts[s] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
  return sorted.length > 0 ? sorted[0][0] : 'unknown';
}

// ─── MAIN EXPORT: identifyNarrativeGaps ──────────────────────────────────────
/**
 * Identify narrative gaps between what the brand communicates and what
 * AI systems actually produce about it.
 *
 * Each gap is evidence of a specific failure in AI brand representation.
 * Gaps are ordered by severity — critical first, then moderate, then minor.
 *
 * This function uses ALL dimensions from Files 2 and 3:
 *
 * From scored engines (File 3 output):
 *   score, recognition, depth, accuracy, confidence
 *   informalScore, formalScore, communityPresent, recommended,
 *   socialFootprint, viralitySignal, sentiment, topicsKnown, topicsUnknown
 *
 * From consistency analysis (File 4 output):
 *   score, conflicted[], dimensionScores.sentimentAlignment,
 *   dimensionScores.informalAlignment
 *
 * From overall scoring:
 *   overallScore
 *
 * Design principle: informal and social knowledge gaps are treated as
 * first-class gaps — not secondary considerations. A brand that is
 * well-known in communities but invisible in AI community knowledge
 * is a critical gap regardless of how many formal facts AI knows.
 *
 * @param {Object} scoredEngines      - from scoreAllEngines().scoredEngines
 * @param {Object} consistencyResult  - from analyseConsistency()
 * @param {number} overallScore       - 0–100
 * @returns {Array<{severity, brandCommunicates, aiProduces, gapType}>}
 */
function identifyNarrativeGaps(scoredEngines, consistencyResult, overallScore) {
  const gaps = [];

  // Filter to active (non-failed) engines for analysis
  const activeEntries = Object.entries(scoredEngines).filter(([, e]) => !e.failed);
  const activeCount   = activeEntries.length;

  if (activeCount === 0) {
    logger.warn('Gap analysis: no active engines — returning single absent gap');
    return [buildGap(GAP_TYPES.ABSENT, SEVERITY.CRITICAL)];
  }

  // ── Aggregate dimension scores across all active engines ──
  const avgRecognition  = mean(activeEntries.map(([, d]) => d.recognition));
  const avgDepth        = mean(activeEntries.map(([, d]) => d.depth));
  const avgAccuracy     = mean(activeEntries.map(([, d]) => d.accuracy));
  const avgConfidence   = mean(activeEntries.map(([, d]) => d.confidence));
  const avgInformal     = mean(activeEntries.map(([, d]) => d.informalScore || 5));
  const avgFormal       = mean(activeEntries.map(([, d]) => d.formalScore   || 5));

  // ── Community and social signals ──
  const communityPresentCount = activeEntries.filter(([, d]) => d.communityPresent).length;
  const viralCount            = activeEntries.filter(([, d]) => d.viralitySignal).length;
  const recommendedCount      = activeEntries.filter(([, d]) => d.recommended === 'yes').length;
  const communityRatio        = communityPresentCount / activeCount;
  const viralRatio            = viralCount / activeCount;
  const recommendedRatio      = recommendedCount / activeCount;

  // ── Social footprint distribution ──
  const footprints = activeEntries.map(([, d]) => d.socialFootprint || 'unknown');
  const strongFootprintCount  = footprints.filter(f => f === 'strong').length;
  const weakOrNoneFootprint   = footprints.filter(f => f === 'weak' || f === 'none').length;

  // ── Consistency signals ──
  const consistencyScore      = consistencyResult?.score ?? 100;
  const sentimentAlignScore   = consistencyResult?.dimensionScores?.sentimentAlignment ?? 100;
  const informalAlignScore    = consistencyResult?.dimensionScores?.informalAlignment  ?? 100;
  const conflictedCount       = (consistencyResult?.conflicted || []).length;

  // ── Dominant sentiment ──
  const dominantSentiment = getDominantSentiment(scoredEngines);

  logger.info(
    `Gap analysis — overall: ${overallScore} | ` +
    `recognition: ${avgRecognition.toFixed(1)} | depth: ${avgDepth.toFixed(1)} | ` +
    `informal: ${avgInformal.toFixed(1)} | formal: ${avgFormal.toFixed(1)} | ` +
    `community: ${communityRatio.toFixed(2)} | recommended: ${recommendedRatio.toFixed(2)} | ` +
    `consistency: ${consistencyScore}`
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // CRITICAL GAPS — brand is absent, misrepresented, or severely under-known
  // ═══════════════════════════════════════════════════════════════════════════

  // ── GAP: Brand completely absent from AI training data ──
  if (overallScore < 15 || avgRecognition < 12) {
    gaps.push(buildGap(
      GAP_TYPES.ABSENT,
      SEVERITY.CRITICAL,
      'The brand exists and is active — it has a product, users, and online presence',
      'AI systems have no meaningful knowledge of this brand — it does not exist in their training data'
    ));
  }

  // ── GAP: Recognition so thin it is functionally absent ──
  else if (avgRecognition < 28 && overallScore < 35) {
    gaps.push(buildGap(
      GAP_TYPES.RECOGNITION_THIN,
      SEVERITY.CRITICAL,
      'The brand is established with a real product, real users, and a functioning web presence',
      `AI systems barely acknowledge this brand exists — average recognition score ${Math.round(avgRecognition)}/100`
    ));
  }

  // ── GAP: Completely invisible in community/social layer of AI knowledge ──
  if (communityRatio === 0 && avgInformal < 3) {
    gaps.push(buildGap(
      GAP_TYPES.COMMUNITY_INVISIBLE,
      SEVERITY.CRITICAL,
      'The brand has real users who discuss it in communities, social media, and forums',
      'Zero community or social knowledge detected — AI has no informal signal about this brand whatsoever'
    ));
  }

  // ── GAP: Severe accuracy problems ──
  if (avgAccuracy < 25 && overallScore > 10) {
    gaps.push(buildGap(
      GAP_TYPES.ACCURACY_LOW,
      SEVERITY.CRITICAL,
      'Accurate, verifiable information about this brand is publicly documented',
      `AI information about this brand appears unreliable — accuracy score ${Math.round(avgAccuracy)}/100 with high conflicting claim rate`
    ));
  }

  // ── GAP: Severe consistency failure ──
  if (consistencyScore < 30 && activeCount >= 2) {
    gaps.push(buildGap(
      GAP_TYPES.CONSISTENCY_LOW,
      SEVERITY.CRITICAL,
      'The brand has a single, consistent identity across all channels and communications',
      `AI engines give severely contradictory pictures of this brand — consistency score ${consistencyScore}/100`
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MODERATE GAPS — brand is present but important dimensions are weak
  // ═══════════════════════════════════════════════════════════════════════════

  // ── GAP: Informal knowledge weak (community/social layer missing) ──
  // This is a moderate gap when community ratio is low but not zero
  if (avgInformal < 5 && communityRatio < 0.5 && overallScore >= 15) {
    gaps.push(buildGap(
      GAP_TYPES.INFORMAL_WEAK,
      SEVERITY.MODERATE,
      'The brand is actively discussed in online communities, social media, and creator content',
      `AI knowledge of this brand is primarily formal/encyclopaedic — informal and social awareness is weak (avg informal score: ${avgInformal.toFixed(1)}/10)`
    ));
  }

  // ── GAP: Formal knowledge weak (no factual anchoring) ──
  // Community-known brands with no formal facts are vulnerable to drift
  if (avgFormal < 3.5 && avgInformal >= 5 && overallScore >= 25) {
    gaps.push(buildGap(
      GAP_TYPES.FORMAL_WEAK,
      SEVERITY.MODERATE,
      'The brand has verifiable facts — founding year, team, location, or documented milestones',
      `AI has community awareness of this brand but lacks factual anchoring — formal knowledge score: ${avgFormal.toFixed(1)}/10`
    ));
  }

  // ── GAP: Low depth overall ──
  if (avgDepth < 35 && overallScore >= 20) {
    gaps.push(buildGap(
      GAP_TYPES.DEPTH_LOW,
      SEVERITY.MODERATE,
      'The brand has a detailed public story — products, use cases, audience, milestones, and differentiation',
      `AI awareness is shallow — engines cannot go beyond basic surface description (depth score: ${Math.round(avgDepth)}/100)`
    ));
  }

  // ── GAP: AI does not recommend the brand ──
  if (recommendedRatio === 0 && overallScore >= 25) {
    gaps.push(buildGap(
      GAP_TYPES.RECOMMENDATION_GAP,
      SEVERITY.MODERATE,
      'The brand is a leading or highly regarded solution in its category and gets recommended by communities',
      'AI engines do not include this brand when recommending solutions — it is absent from recommendation consideration sets'
    ));
  } else if (recommendedRatio < 0.4 && overallScore >= 35 && activeCount >= 2) {
    gaps.push(buildGap(
      GAP_TYPES.RECOMMENDATION_GAP,
      SEVERITY.MODERATE,
      'The brand is consistently recommended as a go-to solution in its category',
      `Only ${recommendedCount} of ${activeCount} AI engines include this brand in recommendations`
    ));
  }

  // ── GAP: Sentiment split across engines ──
  if (sentimentAlignScore < 50 && activeCount >= 2 && conflictedCount > 0) {
    gaps.push(buildGap(
      GAP_TYPES.SENTIMENT_SPLIT,
      SEVERITY.MODERATE,
      'The brand projects a clear, consistent, positive identity across all its communications',
      `AI engines disagree on brand sentiment — sentiment alignment score: ${Math.round(sentimentAlignScore)}/100`
    ));
  }

  // ── GAP: Social footprint weak ──
  if (weakOrNoneFootprint >= Math.ceil(activeCount * 0.6) && overallScore >= 20) {
    gaps.push(buildGap(
      GAP_TYPES.SOCIAL_FOOTPRINT_LOW,
      SEVERITY.MODERATE,
      'The brand has meaningful presence and discussion across social platforms and creator communities',
      `AI has weak social footprint signal for this brand — ${weakOrNoneFootprint} of ${activeCount} engines report weak or no social knowledge`
    ));
  }

  // ── GAP: AI does not know the brand's audience ──
  // Detected by checking topicsUnknown across engines for audience-related terms
  const audienceUnknownEngines = activeEntries.filter(([, d]) => {
    const unknownTopics = (d.topicsUnknown || []).map(t => t.toLowerCase());
    return unknownTopics.some(t =>
      t.includes('audience') || t.includes('users') || t.includes('customers') ||
      t.includes('who uses') || t.includes('demographic') || t.includes('target')
    );
  });

  if (audienceUnknownEngines.length >= Math.ceil(activeCount * 0.5)) {
    gaps.push(buildGap(
      GAP_TYPES.AUDIENCE_UNKNOWN,
      SEVERITY.MODERATE,
      'The brand serves a specific, well-defined audience with clear documented needs and use cases',
      `${audienceUnknownEngines.length} of ${activeCount} AI engines cannot identify who uses this brand`
    ));
  }

  // ── GAP: Consistency moderately low ──
  if (consistencyScore >= 30 && consistencyScore < 55 && activeCount >= 2) {
    gaps.push(buildGap(
      GAP_TYPES.CONSISTENCY_LOW,
      SEVERITY.MODERATE,
      'The brand has a single, coherent identity across all public channels',
      `AI engines give inconsistent pictures of this brand across key dimensions — consistency score: ${consistencyScore}/100`
    ));
  }

  // ── GAP: Accuracy moderately low ──
  if (avgAccuracy >= 25 && avgAccuracy < 45 && overallScore >= 20) {
    gaps.push(buildGap(
      GAP_TYPES.ACCURACY_LOW,
      SEVERITY.MODERATE,
      'Accurate, verifiable information about this brand is widely available and cited',
      `AI accuracy for this brand is below threshold — engines produce a meaningful rate of conflicting or unverifiable claims (accuracy: ${Math.round(avgAccuracy)}/100)`
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MINOR GAPS — specific signals that could be strengthened
  // ═══════════════════════════════════════════════════════════════════════════

  // ── GAP: Viral moments not reflected in AI ──
  if (viralRatio === 0 && overallScore >= 35) {
    gaps.push(buildGap(
      GAP_TYPES.VIRAL_INVISIBLE,
      SEVERITY.MINOR,
      'The brand has had notable product launches, viral moments, or cultural events that generated significant online discussion',
      'AI has no awareness of any viral moments, notable launches, or cultural events associated with this brand'
    ));
  }

  // ── GAP: Competitive context missing ──
  const competitiveUnknownEngines = activeEntries.filter(([, d]) => {
    const unknownTopics = (d.topicsUnknown || []).map(t => t.toLowerCase());
    const primaryText   = (d.primaryText || '').toLowerCase();
    const hasCompetitorMention = /competitor|alternative|versus|vs\.|competes with/i.test(primaryText);
    const mentionsUnknown = unknownTopics.some(t =>
      t.includes('competitor') || t.includes('alternative') ||
      t.includes('competitive') || t.includes('market position')
    );
    return !hasCompetitorMention || mentionsUnknown;
  });

  if (competitiveUnknownEngines.length >= Math.ceil(activeCount * 0.6) && overallScore >= 30) {
    gaps.push(buildGap(
      GAP_TYPES.COMPETITIVE_CONTEXT,
      SEVERITY.MINOR,
      'The brand occupies a clear, documented position in its competitive landscape with well-known alternatives',
      'AI cannot reliably place this brand in its competitive context or name relevant alternatives it is compared against'
    ));
  }

  // ── GAP: Informal alignment low (engines disagree on social signal) ──
  if (informalAlignScore < 45 && activeCount >= 2) {
    gaps.push(buildGap(
      GAP_TYPES.INFORMAL_WEAK,
      SEVERITY.MINOR,
      'The brand has a consistent, recognisable presence across social channels and communities',
      `AI engines have widely different levels of informal/social knowledge about this brand — informal alignment: ${Math.round(informalAlignScore)}/100`
    ));
  }

  // ── GAP: Formal knowledge very thin despite community awareness ──
  if (avgFormal < 2.5 && avgInformal >= 6 && overallScore >= 40) {
    gaps.push(buildGap(
      GAP_TYPES.FORMAL_WEAK,
      SEVERITY.MINOR,
      'Key factual details about the brand — founding, team, or milestones — are publicly documented',
      `Brand is community-known but AI has almost no formal factual knowledge to anchor descriptions (formal score: ${avgFormal.toFixed(1)}/10)`
    ));
  }

  // ── GAP: Narrative appears stale ──
  // Detected by checking if topicsUnknown mentions recent/current/news terms
  const staleEngines = activeEntries.filter(([, d]) => {
    const unknownTopics  = (d.topicsUnknown || []).map(t => t.toLowerCase());
    const primaryText    = (d.primaryText || '').toLowerCase();
    const stalenessSignals = [
      'recent', 'latest', 'current', 'new', 'update', 'news', '2024', '2025',
      'recent developments', 'recent news', 'latest updates'
    ];
    const mentionsStale = stalenessSignals.some(s =>
      unknownTopics.some(t => t.includes(s)) || primaryText.includes('may have changed') ||
      primaryText.includes('as of my') || primaryText.includes('my knowledge cutoff') ||
      primaryText.includes('may not be current') || primaryText.includes('may be outdated')
    );
    return mentionsStale;
  });

  if (staleEngines.length >= Math.ceil(activeCount * 0.5)) {
    gaps.push(buildGap(
      GAP_TYPES.NARRATIVE_STALE,
      SEVERITY.MINOR,
      'The brand regularly publishes news, updates, and developments that are publicly documented',
      `${staleEngines.length} of ${activeCount} AI engines indicate their knowledge of this brand may be outdated or stale`
    ));
  }

  // ── GAP: Category confusion ──
  // If topicsUnknown across multiple engines includes category/industry terms,
  // or if primary text shows uncertainty about what the brand does
  const categoryUnclearEngines = activeEntries.filter(([, d]) => {
    const unknownTopics = (d.topicsUnknown || []).map(t => t.toLowerCase());
    const primaryText   = (d.primaryText || '').toLowerCase();
    return unknownTopics.some(t =>
      t.includes('category') || t.includes('industry') ||
      t.includes('what it does') || t.includes('sector')
    ) || (
      /unclear what|not sure what|uncertain (about|what)|unsure (about|what)/i.test(primaryText) &&
      /does|offers|provides|category/i.test(primaryText)
    );
  });

  if (categoryUnclearEngines.length >= Math.ceil(activeCount * 0.5)) {
    gaps.push(buildGap(
      GAP_TYPES.CATEGORY_CONFUSION,
      SEVERITY.MINOR,
      'The brand belongs to a clearly defined category with well-documented products and services',
      `${categoryUnclearEngines.length} of ${activeCount} AI engines are uncertain about what category or industry this brand belongs to`
    ));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SORT: critical first, then moderate, then minor
  // Deduplicate by gapType to prevent the same gap appearing twice
  // (e.g. RECOMMENDATION_GAP appearing once from ratio=0 and again from ratio<0.4)
  // ─────────────────────────────────────────────────────────────────────────
  const severityOrder  = { critical: 0, moderate: 1, minor: 2 };
  const seenGapTypes   = new Set();
  const uniqueGaps     = [];

  // First pass: add all unique gap types, sorted by severity
  const sorted = [...gaps].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  for (const gap of sorted) {
    if (!seenGapTypes.has(gap.gapType)) {
      seenGapTypes.add(gap.gapType);
      uniqueGaps.push(gap);
    }
  }

  // Cap at 8 gaps for display — too many gaps overwhelms the frontend
  const finalGaps = uniqueGaps.slice(0, 8);

  logger.info(
    `Gap analysis complete — ${finalGaps.length} gaps identified | ` +
    `critical: ${finalGaps.filter(g => g.severity === SEVERITY.CRITICAL).length} | ` +
    `moderate: ${finalGaps.filter(g => g.severity === SEVERITY.MODERATE).length} | ` +
    `minor: ${finalGaps.filter(g => g.severity === SEVERITY.MINOR).length}`
  );

  return finalGaps;
}

module.exports = {
  identifyNarrativeGaps,
  // Exported for unit testing
  buildGap,
  getDominantSentiment,
  SEVERITY,
  GAP_TYPES
};
