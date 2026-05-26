'use strict';

const logger = require('../../utils/logger');

// ─── GAP SEVERITY LEVELS ──────────────────────────────────────────────────────
const SEVERITY = {
  CRITICAL: 'critical',
  MODERATE: 'moderate',
  MINOR:    'minor'
};

// ─── GAP TYPE DEFINITIONS ─────────────────────────────────────────────────────
const GAP_TYPES = {
  ABSENT:              'absent',
  RECOGNITION_THIN:    'recognition_thin',
  COMMUNITY_INVISIBLE: 'community_invisible',
  SENTIMENT_SPLIT:     'sentiment_split',
  DEPTH_LOW:           'depth_low',
  INFORMAL_WEAK:       'informal_weak',
  FORMAL_WEAK:         'formal_weak',
  RECOMMENDATION_GAP:  'recommendation_gap',
  VIRAL_INVISIBLE:     'viral_invisible',
  CONSISTENCY_LOW:     'consistency_low',
  ACCURACY_LOW:        'accuracy_low',
  COMPETITIVE_CONTEXT: 'competitive_context',
  AUDIENCE_UNKNOWN:    'audience_unknown',
  CATEGORY_CONFUSION:  'category_confusion',
  NARRATIVE_STALE:     'narrative_stale',
  SOCIAL_FOOTPRINT_LOW:'social_footprint_low'
};

// ─── BRAND COMMUNICATES TEMPLATES ─────────────────────────────────────────────
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
    'The brand is growing and evolving — recent developments are publicly documented and indexed',
  [GAP_TYPES.SOCIAL_FOOTPRINT_LOW]:
    'The brand has meaningful presence across social platforms, forums, and creator content'
};

// ─── AI PRODUCES TEMPLATES ────────────────────────────────────────────────────
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
    'AI knowledge of this brand appears to lag behind its current state — recent developments, products, or milestones are not reflected in AI responses',
  [GAP_TYPES.SOCIAL_FOOTPRINT_LOW]:
    'Weak or absent social media and creator-driven knowledge about this brand'
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function buildGap(gapType, severity, overrideBrandCommunicates, overrideAiProduces) {
  return {
    severity,
    brandCommunicates: overrideBrandCommunicates || BRAND_TEMPLATES[gapType] || 'Brand has a clear identity',
    aiProduces:        overrideAiProduces        || AI_TEMPLATES[gapType]    || 'AI has limited knowledge',
    gapType
  };
}

function mean(arr, defaultVal = 0) {
  const valid = (arr || []).filter(n => typeof n === 'number' && !isNaN(n));
  if (valid.length === 0) return defaultVal;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

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

// ─── STALENESS DETECTION ──────────────────────────────────────────────────────
/**
 * Determine whether a narrative_stale gap is genuinely warranted.
 *
 * DESIGN: Standard LLM responses about any fast-moving company routinely
 * include hedging phrases like "as of my knowledge cutoff" or "this may
 * have changed" as responsible disclaimers. These phrases are NOT evidence
 * of AI awareness staleness — they are evidence of good epistemic hygiene.
 *
 * A staleness gap is only genuine when ALL THREE of these conditions are true:
 *
 * 1. SCORE GATE — The brand is not already well-known (overallScore < 65)
 *    AND informal knowledge is thin (avgInformal < 6).
 *    Mega-brands like Amazon, L'Oréal, Apple never receive staleness gaps
 *    from routine AI disclaimers. Their AI awareness is not stale — the
 *    models are correctly hedging on time-sensitive specifics only.
 *
 * 2. EXPLICIT TOPIC SIGNAL — The model's topicsUnknown list explicitly
 *    contains recent/current/news-related topics. This means the model
 *    actively told us it does not know the brand's recent developments —
 *    not just that it hedged on a specific data point.
 *
 * 3. THRESHOLD — At least 60% of active engines AND at least 2 engines
 *    show genuine staleness signals. A single engine out of two using
 *    a standard disclaimer is not a meaningful signal.
 *
 * All three conditions must be true simultaneously. Failing any one
 * condition suppresses the gap entirely.
 *
 * @param {Array}  activeEntries  - [engineKey, engineData] pairs, non-failed only
 * @param {number} overallScore
 * @param {number} avgInformal
 * @returns {boolean}
 */
function isGenuinelyStale(activeEntries, overallScore, avgInformal) {

  // ── Condition 1: Score gate ──
  // Well-known brands (high score OR high informal knowledge) never get
  // staleness gaps from routine LLM disclaimers.
  // overallScore >= 65 OR avgInformal >= 6 → suppress immediately
  if (overallScore >= 65 || avgInformal >= 6) {
    logger.info(
      `Staleness gate: suppressed — overallScore=${overallScore} avgInformal=${avgInformal.toFixed(1)} ` +
      `(threshold: score<65 AND informal<6 required)`
    );
    return false;
  }

  // ── Condition 2: Explicit topic signal ──
  // The model must have explicitly listed recent/current/news topics
  // in its topicsUnknown structured output — not just used a hedging phrase.
  const STALE_TOPIC_SIGNALS = [
    'recent', 'latest', 'current', 'news', 'update', 'updates',
    'new products', 'new features', 'recent launch', 'latest release',
    'recent developments', 'recent news', 'current events',
    'current status', 'recent funding', 'recent acquisition',
    '2024', '2025', '2026', 'this year', 'last year'
  ];

  // The model must also use hedging language in its primary text
  // (confirming it is flagging its own knowledge as potentially outdated)
  const HEDGING_PHRASES = [
    'may have changed',
    'as of my knowledge cutoff',
    'my knowledge cutoff',
    'may not be current',
    'may be outdated',
    'as of my last update',
    'as of my training',
    'my training data',
    'i don\'t have information after',
    'i don\'t have recent',
    'limited recent information',
    'not up to date'
  ];

  const enginesWithGenuineStaleness = activeEntries.filter(([, d]) => {
    const primaryText   = (d.primaryText    || '').toLowerCase();
    const unknownTopics = (d.topicsUnknown  || []).map(t => t.toLowerCase());

    // Must use a hedging phrase in primary text
    const hasHedgingPhrase = HEDGING_PHRASES.some(phrase =>
      primaryText.includes(phrase)
    );

    if (!hasHedgingPhrase) return false;

    // AND must have explicitly listed a stale-signal topic in topicsUnknown
    const hasExplicitTopicGap = unknownTopics.some(topic =>
      STALE_TOPIC_SIGNALS.some(signal => topic.includes(signal))
    );

    return hasExplicitTopicGap;
  });

  const genuineCount = enginesWithGenuineStaleness.length;

  if (genuineCount === 0) {
    logger.info(
      'Staleness gate: suppressed — no engines have both hedging phrase AND explicit topic gap in topicsUnknown'
    );
    return false;
  }

  // ── Condition 3: Threshold ──
  // Require at least 60% of active engines AND at least 2 engines
  // to show genuine staleness. Single engine out of two is not enough.
  const activeCount = activeEntries.length;
  const requiredCount = Math.max(2, Math.ceil(activeCount * 0.6));

  if (genuineCount < requiredCount) {
    logger.info(
      `Staleness gate: suppressed — ${genuineCount}/${activeCount} engines show genuine staleness ` +
      `(required: ${requiredCount})`
    );
    return false;
  }

  logger.info(
    `Staleness gate: CONFIRMED — ${genuineCount}/${activeCount} engines show genuine staleness ` +
    `| overallScore=${overallScore} avgInformal=${avgInformal.toFixed(1)}`
  );
  return true;
}

// ─── MAIN EXPORT: identifyNarrativeGaps ──────────────────────────────────────
/**
 * Identify narrative gaps between what the brand communicates
 * and what AI systems actually produce about it.
 *
 * @param {Object} scoredEngines
 * @param {Object} consistencyResult
 * @param {number} overallScore
 * @returns {Array<{severity, brandCommunicates, aiProduces, gapType}>}
 */
function identifyNarrativeGaps(scoredEngines, consistencyResult, overallScore) {
  const gaps = [];

  const activeEntries = Object.entries(scoredEngines).filter(([, e]) => !e.failed);
  const activeCount   = activeEntries.length;

  if (activeCount === 0) {
    logger.warn('Gap analysis: no active engines — returning single absent gap');
    return [buildGap(GAP_TYPES.ABSENT, SEVERITY.CRITICAL)];
  }

  // ── Aggregate dimension scores ──
  const avgRecognition  = mean(activeEntries.map(([, d]) => d.recognition));
  const avgDepth        = mean(activeEntries.map(([, d]) => d.depth));
  const avgAccuracy     = mean(activeEntries.map(([, d]) => d.accuracy));
  const avgInformal     = mean(activeEntries.map(([, d]) => d.informalScore || 5));
  const avgFormal       = mean(activeEntries.map(([, d]) => d.formalScore   || 5));

  // ── Social and community signals ──
  const communityPresentCount = activeEntries.filter(([, d]) => d.communityPresent).length;
  const viralCount            = activeEntries.filter(([, d]) => d.viralitySignal).length;
  const recommendedCount      = activeEntries.filter(([, d]) => d.recommended === 'yes').length;
  const communityRatio        = communityPresentCount / activeCount;
  const viralRatio            = viralCount            / activeCount;
  const recommendedRatio      = recommendedCount      / activeCount;

  const footprints           = activeEntries.map(([, d]) => d.socialFootprint || 'unknown');
  const weakOrNoneFootprint  = footprints.filter(f => f === 'weak' || f === 'none').length;

  // ── Sentiment ──
  const sentiments          = activeEntries.map(([, d]) => d.sentiment || 'unknown');
  const hasNegativeSentiment= sentiments.some(s => s === 'negative');
  const hasPositiveSentiment= sentiments.some(s => s === 'positive');

  // ── Consistency signals ──
  const consistencyScore    = consistencyResult?.score ?? 100;
  const sentimentAlignScore = consistencyResult?.dimensionScores?.sentimentAlignment ?? 100;
  const informalAlignScore  = consistencyResult?.dimensionScores?.informalAlignment  ?? 100;
  const conflictedCount     = (consistencyResult?.conflicted || []).length;

  logger.info(
    `Gap analysis — overall: ${overallScore} | ` +
    `recognition: ${avgRecognition.toFixed(1)} | depth: ${avgDepth.toFixed(1)} | ` +
    `informal: ${avgInformal.toFixed(1)} | formal: ${avgFormal.toFixed(1)} | ` +
    `community: ${communityRatio.toFixed(2)} | recommended: ${recommendedRatio.toFixed(2)} | ` +
    `consistency: ${consistencyScore}`
  );

  // ═══════════════════════════════════════════════════════════════════════
  // CRITICAL GAPS
  // ═══════════════════════════════════════════════════════════════════════

  // ── Brand completely absent ──
  if (overallScore < 15 || avgRecognition < 12) {
    gaps.push(buildGap(
      GAP_TYPES.ABSENT,
      SEVERITY.CRITICAL,
      'The brand exists and is active — it has a product, users, and online presence',
      'AI systems have no meaningful knowledge of this brand — it does not exist in their training data'
    ));
  }

  // ── Recognition critically thin ──
  else if (avgRecognition < 28 && overallScore < 35) {
    gaps.push(buildGap(
      GAP_TYPES.RECOGNITION_THIN,
      SEVERITY.CRITICAL,
      'The brand is established with a real product, real users, and a functioning web presence',
      `AI systems barely acknowledge this brand exists — average recognition score ${Math.round(avgRecognition)}/100`
    ));
  }

  // ── Community completely invisible ──
  if (communityRatio === 0 && avgInformal < 3) {
    gaps.push(buildGap(
      GAP_TYPES.COMMUNITY_INVISIBLE,
      SEVERITY.CRITICAL,
      'The brand has real users who discuss it in communities, social media, and forums',
      'Zero community or social knowledge detected — AI has no informal signal about this brand whatsoever'
    ));
  }

  // ── Severe accuracy problems ──
  if (avgAccuracy < 25 && overallScore > 10) {
    gaps.push(buildGap(
      GAP_TYPES.ACCURACY_LOW,
      SEVERITY.CRITICAL,
      'Accurate, verifiable information about this brand is publicly documented',
      `AI information about this brand appears unreliable — accuracy score ${Math.round(avgAccuracy)}/100 with high conflicting claim rate`
    ));
  }

  // ── Severe consistency failure ──
  if (consistencyScore < 30 && activeCount >= 2) {
    gaps.push(buildGap(
      GAP_TYPES.CONSISTENCY_LOW,
      SEVERITY.CRITICAL,
      'The brand has a single, consistent identity across all channels and communications',
      `AI engines give severely contradictory pictures of this brand — consistency score ${consistencyScore}/100`
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MODERATE GAPS
  // ═══════════════════════════════════════════════════════════════════════

  // ── Informal knowledge weak ──
  if (avgInformal < 5 && communityRatio < 0.5 && overallScore >= 15) {
    gaps.push(buildGap(
      GAP_TYPES.INFORMAL_WEAK,
      SEVERITY.MODERATE,
      'The brand is actively discussed in online communities, social media, and creator content',
      `AI knowledge of this brand is primarily formal/encyclopaedic — informal and social awareness is weak (avg informal score: ${avgInformal.toFixed(1)}/10)`
    ));
  }

  // ── Formal knowledge weak ──
  if (avgFormal < 3.5 && avgInformal >= 5 && overallScore >= 25) {
    gaps.push(buildGap(
      GAP_TYPES.FORMAL_WEAK,
      SEVERITY.MODERATE,
      'The brand has verifiable facts — founding year, team, location, or documented milestones',
      `AI has community awareness of this brand but lacks factual anchoring — formal knowledge score: ${avgFormal.toFixed(1)}/10`
    ));
  }

  // ── Low depth ──
  if (avgDepth < 35 && overallScore >= 20) {
    gaps.push(buildGap(
      GAP_TYPES.DEPTH_LOW,
      SEVERITY.MODERATE,
      'The brand has a detailed public story — products, use cases, audience, milestones, and differentiation',
      `AI awareness is shallow — engines cannot go beyond basic surface description (depth score: ${Math.round(avgDepth)}/100)`
    ));
  }

  // ── Not recommended ──
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

  // ── Sentiment split ──
  if (sentimentAlignScore < 50 && activeCount >= 2 && conflictedCount > 0) {
    gaps.push(buildGap(
      GAP_TYPES.SENTIMENT_SPLIT,
      SEVERITY.MODERATE,
      'The brand projects a clear, consistent, positive identity across all its communications',
      `AI engines disagree on brand sentiment — sentiment alignment score: ${Math.round(sentimentAlignScore)}/100`
    ));
  }

  // ── Social footprint weak ──
  if (weakOrNoneFootprint >= Math.ceil(activeCount * 0.6) && overallScore >= 20) {
    gaps.push(buildGap(
      GAP_TYPES.SOCIAL_FOOTPRINT_LOW,
      SEVERITY.MODERATE,
      'The brand has meaningful presence and discussion across social platforms and creator communities',
      `AI has weak social footprint signal for this brand — ${weakOrNoneFootprint} of ${activeCount} engines report weak or no social knowledge`
    ));
  }

  // ── Audience unknown ──
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

  // ── Consistency moderately low ──
  if (consistencyScore >= 30 && consistencyScore < 55 && activeCount >= 2) {
    gaps.push(buildGap(
      GAP_TYPES.CONSISTENCY_LOW,
      SEVERITY.MODERATE,
      'The brand has a single, coherent identity across all public channels',
      `AI engines give inconsistent pictures of this brand across key dimensions — consistency score: ${consistencyScore}/100`
    ));
  }

  // ── Accuracy moderately low ──
  if (avgAccuracy >= 25 && avgAccuracy < 45 && overallScore >= 20) {
    gaps.push(buildGap(
      GAP_TYPES.ACCURACY_LOW,
      SEVERITY.MODERATE,
      'Accurate, verifiable information about this brand is widely available and cited',
      `AI accuracy for this brand is below threshold — engines produce a meaningful rate of conflicting or unverifiable claims (accuracy: ${Math.round(avgAccuracy)}/100)`
    ));
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MINOR GAPS
  // ═══════════════════════════════════════════════════════════════════════

  // ── Viral moments not reflected ──
  if (viralRatio === 0 && overallScore >= 35) {
    gaps.push(buildGap(
      GAP_TYPES.VIRAL_INVISIBLE,
      SEVERITY.MINOR,
      'The brand has had notable product launches, viral moments, or cultural events that generated significant online discussion',
      'AI has no awareness of any viral moments, notable launches, or cultural events associated with this brand'
    ));
  }

  // ── Competitive context missing ──
  const competitiveUnknownEngines = activeEntries.filter(([, d]) => {
    const unknownTopics = (d.topicsUnknown || []).map(t => t.toLowerCase());
    const primaryText   = (d.primaryText   || '').toLowerCase();
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

  // ── Informal alignment low ──
  if (informalAlignScore < 45 && activeCount >= 2) {
    gaps.push(buildGap(
      GAP_TYPES.INFORMAL_WEAK,
      SEVERITY.MINOR,
      'The brand has a consistent, recognisable presence across social channels and communities',
      `AI engines have widely different levels of informal/social knowledge about this brand — informal alignment: ${Math.round(informalAlignScore)}/100`
    ));
  }

  // ── Formal knowledge very thin despite community awareness ──
  if (avgFormal < 2.5 && avgInformal >= 6 && overallScore >= 40) {
    gaps.push(buildGap(
      GAP_TYPES.FORMAL_WEAK,
      SEVERITY.MINOR,
      'Key factual details about the brand — founding, team, or milestones — are publicly documented',
      `Brand is community-known but AI has almost no formal factual knowledge to anchor descriptions (formal score: ${avgFormal.toFixed(1)}/10)`
    ));
  }

  // ── NARRATIVE STALE ─────────────────────────────────────────────────────
  // Uses the isGenuinelyStale() gate which enforces all three conditions:
  // score gate + explicit topic signal + threshold.
  // Standard LLM hedging disclaimers on high-scoring brands never trigger this.
  // ────────────────────────────────────────────────────────────────────────
  if (isGenuinelyStale(activeEntries, overallScore, avgInformal)) {
    const staleCount = activeEntries.filter(([, d]) => {
      const primaryText   = (d.primaryText   || '').toLowerCase();
      const unknownTopics = (d.topicsUnknown || []).map(t => t.toLowerCase());
      const HEDGING_PHRASES = [
        'may have changed', 'as of my knowledge cutoff', 'my knowledge cutoff',
        'may not be current', 'may be outdated', 'as of my last update',
        'as of my training', 'my training data', 'limited recent information'
      ];
      const STALE_TOPIC_SIGNALS = [
        'recent', 'latest', 'current', 'news', 'update', 'updates',
        '2024', '2025', '2026', 'this year', 'last year'
      ];
      return HEDGING_PHRASES.some(p => primaryText.includes(p)) &&
             unknownTopics.some(t => STALE_TOPIC_SIGNALS.some(s => t.includes(s)));
    }).length;

    gaps.push(buildGap(
      GAP_TYPES.NARRATIVE_STALE,
      SEVERITY.MINOR,
      'The brand regularly publishes news, updates, and developments that are publicly documented',
      `${staleCount} of ${activeCount} AI engines indicate their knowledge of this brand may lag behind its current state`
    ));
  }

  // ── Category confusion ──
  const categoryUnclearEngines = activeEntries.filter(([, d]) => {
    const unknownTopics = (d.topicsUnknown || []).map(t => t.toLowerCase());
    const primaryText   = (d.primaryText   || '').toLowerCase();
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

  // ─── SORT, DEDUPLICATE, CAP ───────────────────────────────────────────
  const severityOrder = { critical: 0, moderate: 1, minor: 2 };
  const seenGapTypes  = new Set();
  const uniqueGaps    = [];

  const sorted = [...gaps].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
  );

  for (const gap of sorted) {
    if (!seenGapTypes.has(gap.gapType)) {
      seenGapTypes.add(gap.gapType);
      uniqueGaps.push(gap);
    }
  }

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
  buildGap,
  getDominantSentiment,
  isGenuinelyStale,
  SEVERITY,
  GAP_TYPES
};
