'use strict';

const logger = require('../../utils/logger');

// ─── SCORING WEIGHTS ──────────────────────────────────────────────────────────
// The four dimensions and how much each contributes to the overall score.
// Recognition is weighted highest because a brand that is not recognised
// cannot be accurately described regardless of other dimensions.
const DIMENSION_WEIGHTS = {
  recognition: 0.28,
  depth:       0.25,
  accuracy:    0.27,
  confidence:  0.20
};

// ─── LINGUISTIC SIGNAL LIBRARIES ─────────────────────────────────────────────

/**
 * Phrases that strongly indicate the model DOES recognise the brand.
 * Presence of any of these in the response boosts recognition score.
 */
const RECOGNITION_POSITIVE_SIGNALS = [
  'is a company',
  'is a platform',
  'is a service',
  'is a product',
  'is a brand',
  'is a startup',
  'is a website',
  'is a tool',
  'is a software',
  'is an organisation',
  'is an organization',
  'is an app',
  'is a fintech',
  'is a saas',
  'is a marketplace',
  'is a network',
  'is a solution',
  'known for',
  'well-known',
  'widely used',
  'popular',
  'founded in',
  'headquartered in',
  'based in',
  'specialises in',
  'specializes in',
  'provides',
  'offers',
  'enables',
  'operates in',
  'serves',
  'focuses on',
  'was launched',
  'was founded',
  'was established',
  'is used by',
  'trusted by',
  'recognised for',
  'recognized for'
];

/**
 * Phrases that strongly indicate the model does NOT recognise the brand,
 * or has very low confidence in its knowledge.
 */
const RECOGNITION_NEGATIVE_SIGNALS = [
  "i don't have",
  "i do not have",
  "i don't know",
  "i do not know",
  'no information',
  'no data',
  'not aware',
  'unaware',
  'unable to find',
  'cannot find',
  'could not find',
  'no knowledge',
  'not familiar',
  'unfamiliar',
  'never heard',
  'not in my',
  'outside my knowledge',
  'beyond my knowledge',
  'my training data does not',
  'my training does not',
  'not in my training',
  'no results',
  'no records',
  'not recognise',
  'not recognize',
  'cannot identify',
  'i cannot confirm',
  'i am unable',
  'could not locate',
  'appears to be unknown',
  'does not appear',
  'likely not well-known'
];

/**
 * Phrases that indicate partial or uncertain recognition.
 */
const RECOGNITION_PARTIAL_SIGNALS = [
  'i believe',
  'i think',
  'i assume',
  'might be',
  'could be',
  'possibly',
  'perhaps',
  'it seems',
  'appears to be',
  'likely',
  'probably',
  'if i recall',
  'if i remember',
  'to my knowledge',
  'as far as i know',
  'not entirely sure',
  'limited information',
  'limited knowledge',
  'partial information',
  'some information',
  'some knowledge'
];

/**
 * Specific factual detail types whose presence indicates deep knowledge.
 * Each pattern matched adds depth bonus points.
 */
const DEPTH_DETAIL_PATTERNS = [
  { pattern: /founded\s+in\s+\d{4}/i,                  label: 'founding year',       bonus: 8 },
  { pattern: /\b(19|20)\d{2}\b/,                        label: 'year reference',      bonus: 4 },
  { pattern: /headquartered\s+in|based\s+in|located\s+in/i, label: 'location',        bonus: 6 },
  { pattern: /\$[\d.,]+\s*(million|billion|M|B)\b/i,    label: 'financial figure',    bonus: 10 },
  { pattern: /\b[\d.,]+\s*(million|billion)\s+users?\b/i, label: 'user count',        bonus: 9 },
  { pattern: /CEO|CTO|CFO|founder|co-founder/i,         label: 'executive reference', bonus: 7 },
  { pattern: /series\s+[A-Z]|ipo|vc\s+funding|venture/i, label: 'funding reference', bonus: 8 },
  { pattern: /revenue|profit|valuation|market\s+cap/i,  label: 'financial metrics',   bonus: 9 },
  { pattern: /acquired\s+by|acquisition|merger/i,       label: 'M&A reference',       bonus: 7 },
  { pattern: /publicly\s+traded|nasdaq|nyse|stock/i,    label: 'public company ref',  bonus: 8 },
  { pattern: /api|sdk|platform|infrastructure/i,        label: 'technical detail',    bonus: 4 },
  { pattern: /\d+\s+employees?|staff\s+of\s+\d+/i,     label: 'employee count',      bonus: 7 },
  { pattern: /award|recognised|recognized|ranking/i,    label: 'recognition signal',  bonus: 4 },
  { pattern: /partnership|partner\s+with|integration/i, label: 'partnership detail',  bonus: 5 },
  { pattern: /launched|released|announced|introduced/i, label: 'milestone reference', bonus: 3 }
];

/**
 * Linguistic confidence markers — phrases that indicate the model is
 * stating facts with high certainty vs hedging.
 */
const HIGH_CONFIDENCE_LANGUAGE = [
  'is known',
  'is a leading',
  'is the largest',
  'is one of the',
  'is widely',
  'is recognised',
  'is recognized',
  'has been',
  'operates as',
  'serves over',
  'processes over',
  'reported that',
  'according to',
  'specifically',
  'notably',
  'in particular'
];

const LOW_CONFIDENCE_LANGUAGE = [
  'i think',
  'i believe',
  'i assume',
  'if i recall',
  'not entirely',
  'not completely',
  'might be',
  'could be',
  'possibly',
  'perhaps',
  'uncertain',
  'unsure',
  'vague',
  'unclear',
  'limited information',
  'may have changed',
  'not fully',
  'approximate',
  'rough estimate'
];

// ─── HELPER FUNCTIONS ─────────────────────────────────────────────────────────

/**
 * Clamp a number between min and max, then round to nearest integer.
 */
function clamp(value, min = 0, max = 100) {
  return Math.round(Math.min(Math.max(value, min), max));
}

/**
 * Count how many items from a signals array appear in the text.
 * Case-insensitive substring matching.
 *
 * @param {string} text
 * @param {string[]} signals
 * @returns {number}
 */
function countSignals(text, signals) {
  if (!text) return 0;
  const lower = text.toLowerCase();
  return signals.reduce((count, signal) => {
    return lower.includes(signal.toLowerCase()) ? count + 1 : count;
  }, 0);
}

/**
 * Count regex pattern matches against the text.
 * Returns total match count across all patterns.
 *
 * @param {string} text
 * @param {Array<{pattern: RegExp}>} patternList
 * @returns {number}
 */
function countPatternMatches(text, patternList) {
  if (!text) return 0;
  return patternList.reduce((count, item) => {
    return item.pattern.test(text) ? count + 1 : count;
  }, 0);
}

/**
 * Count the number of meaningful words in a string.
 * Filters out common stop words to get a more accurate signal of informational density.
 *
 * @param {string} text
 * @returns {number}
 */
function countMeaningfulWords(text) {
  if (!text) return 0;
  const STOP_WORDS = new Set([
    'the','a','an','and','or','but','in','on','at','to','for','of','with',
    'by','from','is','it','as','be','was','are','were','been','have','has',
    'had','do','does','did','will','would','could','should','may','might',
    'shall','can','this','that','these','those','i','you','he','she','we',
    'they','me','him','her','us','them','my','your','his','its','our','their',
    'what','which','who','when','where','how','if','then','than','so','yet',
    'not','no','nor','about','above','after','also','any','both','each',
    'few','more','most','other','some','such','very','just','into','through',
    'during','before','after','between','up','down','out','off','over','under'
  ]);
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w))
    .length;
}

// ─── DIMENSION SCORERS ────────────────────────────────────────────────────────

/**
 * Score the RECOGNITION dimension (0–100).
 *
 * Recognition measures how clearly and definitively the AI engine
 * acknowledges that it knows the brand. A high score means the model
 * states unambiguously that it recognises the brand and can describe it.
 * A low score means the model explicitly stated it does not know the brand.
 *
 * Scoring breakdown:
 *   Base: 50 points (neutral start)
 *   Positive signals detected: +3 per signal, up to +35
 *   Partial/hedging signals:   -4 per signal, up to -20
 *   Negative signals:          -15 per signal, up to -50 (floor at 5)
 *   Section 1 explicit "YES":  +15 bonus
 *   Section 1 explicit "NO":   hard cap at 10
 *
 * @param {string} primaryText
 * @returns {number} 0–100
 */
function scoreRecognition(primaryText) {
  if (!primaryText || primaryText.trim().length < 10) return 0;

  const text = primaryText.toLowerCase();

  // Check for explicit NO in section 1
  const section1Match = primaryText.match(/1[\.\)]\s*RECOGNITION[:\s]+(.*?)(?=2[\.\)]|\n\n|$)/is);
  const section1Text = section1Match ? section1Match[1].toLowerCase() : text.slice(0, 300);

  // Hard negative: explicit statement of no knowledge
  const negativeCount = countSignals(text, RECOGNITION_NEGATIVE_SIGNALS);
  if (negativeCount >= 3) return clamp(5 + (10 - negativeCount * 2), 0, 15);
  if (negativeCount >= 2) return clamp(15, 0, 20);

  let score = 50;

  // Positive signals
  const positiveCount = countSignals(text, RECOGNITION_POSITIVE_SIGNALS);
  score += Math.min(positiveCount * 3, 35);

  // Partial/hedging signals reduce score
  const partialCount = countSignals(text, RECOGNITION_PARTIAL_SIGNALS);
  score -= Math.min(partialCount * 4, 20);

  // Negative signals reduce score
  score -= Math.min(negativeCount * 15, 50);

  // Explicit YES in recognition section is a strong positive signal
  if (/\byes\b/i.test(section1Text) && !/\bno\b/i.test(section1Text.slice(0, 10))) {
    score += 15;
  }

  // Explicit PARTIALLY in recognition section
  if (/\bpartially\b/i.test(section1Text)) {
    score = Math.min(score, 65);
  }

  // Explicit NO in recognition section — hard cap
  if (/\bno\b/i.test(section1Text.slice(0, 30)) || /does not recognise|does not recognize|not recognise/i.test(section1Text)) {
    return clamp(Math.min(score, 12), 0, 15);
  }

  // Minimum floor: if any positive signals were found, score cannot be below 20
  if (positiveCount > 0 && score < 20) score = 20;

  return clamp(score);
}

/**
 * Score the DEPTH dimension (0–100).
 *
 * Depth measures how much detailed, specific information the AI engine
 * provides about the brand. A high depth score means the engine knows
 * founding details, financial metrics, key people, products, and milestones.
 * A low depth score means the response is vague, brief, or generic.
 *
 * Scoring breakdown:
 *   Word count contribution:     0–30 points (scaled from meaningful word count)
 *   Topics known:                up to 20 points (3 per topic, max 8 topics)
 *   Factual detail patterns:     sum of bonus points from DEPTH_DETAIL_PATTERNS
 *   Claim count contribution:    up to 15 points
 *   Response length bonus:       up to 5 points
 *
 * @param {string} primaryText
 * @param {number} accurateClaims
 * @param {number} conflictingClaims
 * @param {number} unverifiableClaims
 * @param {string[]} topicsKnown
 * @returns {number} 0–100
 */
function scoreDepth(primaryText, accurateClaims, conflictingClaims, unverifiableClaims, topicsKnown) {
  if (!primaryText || primaryText.trim().length < 10) return 0;

  let score = 0;

  // ── Word count contribution ──
  const wordCount = countMeaningfulWords(primaryText);
  // Scale: 0 words = 0, 50 words = 10, 150 words = 25, 300+ words = 30
  const wordScore = Math.min((wordCount / 300) * 30, 30);
  score += wordScore;

  // ── Topics known contribution ──
  const topicCount = Array.isArray(topicsKnown) ? topicsKnown.length : 0;
  score += Math.min(topicCount * 3, 20);

  // ── Factual detail pattern matching ──
  let detailBonus = 0;
  for (const item of DEPTH_DETAIL_PATTERNS) {
    if (item.pattern.test(primaryText)) {
      detailBonus += item.bonus;
    }
  }
  score += Math.min(detailBonus, 35);

  // ── Total claim count contribution ──
  const totalClaims = (accurateClaims || 0) + (conflictingClaims || 0) + (unverifiableClaims || 0);
  // Scale: 0 claims = 0, 5 claims = 5, 10 claims = 10, 15+ claims = 15
  score += Math.min((totalClaims / 15) * 15, 15);

  // ── Response sections completeness ──
  // Check all 6 sections were answered
  const sectionCount = (primaryText.match(/[1-6][\.\)]\s*(RECOGNITION|DESCRIPTION|REPUTATION|DETAILS|CONFIDENCE|GAPS)/gi) || []).length;
  if (sectionCount >= 5) score += 5;
  else if (sectionCount >= 3) score += 2;

  return clamp(score);
}

/**
 * Score the ACCURACY dimension (0–100).
 *
 * Accuracy measures how factually reliable the AI engine's response appears
 * to be. Since we cannot independently verify every claim against ground truth,
 * accuracy is inferred from three sources:
 *   1. The ratio of accurate to conflicting/unverifiable claims (from verification turn)
 *   2. The linguistic confidence of the language used
 *   3. The model's own self-assessment from section 5
 *
 * Scoring breakdown:
 *   Claim ratio:            0–50 points
 *   Linguistic confidence:  0–25 points
 *   Self-reported score:    0–25 points
 *
 * @param {string} primaryText
 * @param {number} accurateClaims
 * @param {number} conflictingClaims
 * @param {number} unverifiableClaims
 * @param {number} rawConfidenceScore - model's self-reported 1–10 score
 * @returns {number} 0–100
 */
function scoreAccuracy(primaryText, accurateClaims, conflictingClaims, unverifiableClaims, rawConfidenceScore) {
  if (!primaryText || primaryText.trim().length < 10) return 0;

  let score = 0;

  // ── Claim ratio component ──
  const totalClaims = (accurateClaims || 0) + (conflictingClaims || 0) + (unverifiableClaims || 0);

  if (totalClaims > 0) {
    // Accurate claims contribute positively; conflicting claims heavily penalise
    const positiveWeight = (accurateClaims || 0) / totalClaims;
    const conflictPenalty = ((conflictingClaims || 0) * 2) / (totalClaims + 1);
    const unverifiablePenalty = (unverifiableClaims || 0) / (totalClaims * 2 + 1);
    const claimRatio = Math.max(0, positiveWeight - conflictPenalty - unverifiablePenalty);
    score += claimRatio * 50;
  } else {
    // No verification data — apply a neutral baseline
    score += 20;
  }

  // ── Linguistic confidence component ──
  const highConfidenceCount = countSignals(primaryText, HIGH_CONFIDENCE_LANGUAGE);
  const lowConfidenceCount  = countSignals(primaryText, LOW_CONFIDENCE_LANGUAGE);
  const linguisticNet = Math.min(highConfidenceCount * 3, 15) - Math.min(lowConfidenceCount * 2, 10);
  score += Math.min(Math.max(linguisticNet + 10, 0), 25); // base 10, adjusted by net

  // ── Self-reported confidence component ──
  // Model reports 1–10; map to 0–25
  const selfScore = rawConfidenceScore || 5;
  score += ((selfScore - 1) / 9) * 25;

  // ── Penalty: if model said it does not know the brand, accuracy is capped ──
  const negativeCount = countSignals(primaryText.toLowerCase(), RECOGNITION_NEGATIVE_SIGNALS);
  if (negativeCount >= 2) {
    score = Math.min(score, 20);
  }

  return clamp(score);
}

/**
 * Score the CONFIDENCE dimension (0–100).
 *
 * Confidence measures how certain and assertive the AI engine is in its
 * statements about the brand. This is distinct from accuracy — an engine
 * can be confidently wrong, or accurately hedging. High confidence means
 * the engine speaks about the brand in declarative, authoritative sentences.
 *
 * Scoring breakdown:
 *   Self-reported confidence (1–10 → 0–60):  0–60 points
 *   Linguistic confidence markers:            0–25 points
 *   Absence of negative recognition:          0–15 points bonus
 *
 * @param {string} primaryText
 * @param {number} rawConfidenceScore - model's self-reported 1–10 score
 * @returns {number} 0–100
 */
function scoreConfidence(primaryText, rawConfidenceScore) {
  if (!primaryText || primaryText.trim().length < 10) return 0;

  let score = 0;

  // ── Self-reported score (1–10) maps to 0–60 points ──
  const selfScore = Math.min(Math.max(rawConfidenceScore || 5, 1), 10);
  score += ((selfScore - 1) / 9) * 60;

  // ── Linguistic confidence markers ──
  const highCount = countSignals(primaryText, HIGH_CONFIDENCE_LANGUAGE);
  const lowCount  = countSignals(primaryText, LOW_CONFIDENCE_LANGUAGE);
  const linguisticScore = Math.min(highCount * 3, 20) - Math.min(lowCount * 2, 15);
  score += Math.min(Math.max(linguisticScore + 10, 0), 25);

  // ── Absence of strong negative recognition ──
  const negativeCount = countSignals(primaryText.toLowerCase(), RECOGNITION_NEGATIVE_SIGNALS);
  if (negativeCount === 0) {
    score += 15;
  } else if (negativeCount === 1) {
    score += 5;
  } else {
    score -= negativeCount * 8;
  }

  return clamp(score);
}

/**
 * Compute the overall awareness score from the four dimension scores.
 * Uses the DIMENSION_WEIGHTS defined at the top of this file.
 *
 * @param {number} recognition
 * @param {number} depth
 * @param {number} accuracy
 * @param {number} confidence
 * @returns {number} 0–100
 */
function scoreOverall(recognition, depth, accuracy, confidence) {
  const raw =
    (recognition * DIMENSION_WEIGHTS.recognition) +
    (depth       * DIMENSION_WEIGHTS.depth)       +
    (accuracy    * DIMENSION_WEIGHTS.accuracy)    +
    (confidence  * DIMENSION_WEIGHTS.confidence);

  return clamp(raw);
}

// ─── TIER CLASSIFIER ─────────────────────────────────────────────────────────

/**
 * Classify an overall score into a named tier.
 * Tiers match exactly what the frontend renders.
 *
 * @param {number} score
 * @returns {{ tier: string, tierClass: string, description: string }}
 */
function classifyTier(score) {
  if (score >= 91) return {
    tier: 'WELL KNOWN',
    tierClass: 'tier-well-known',
    description: 'This brand has strong, detailed, and consistent AI awareness across all tested engines. Minimal action required — focus on maintaining currency of information.'
  };
  if (score >= 76) return {
    tier: 'KNOWN',
    tierClass: 'tier-known',
    description: 'This brand is recognised and reasonably well described by AI systems. Some depth gaps or accuracy inconsistencies exist that could be improved.'
  };
  if (score >= 51) return {
    tier: 'PARTIALLY KNOWN',
    tierClass: 'tier-partial',
    description: 'This brand has limited but present AI awareness. Key facts are missing or inaccurate across one or more engines. Significant content and signal work is recommended.'
  };
  if (score >= 26) return {
    tier: 'MINIMALLY KNOWN',
    tierClass: 'tier-partial',
    description: 'This brand is barely recognised by AI systems. Awareness is fragile and easily displaced. Foundational AI visibility work is needed urgently.'
  };
  return {
    tier: 'NOT KNOWN',
    tierClass: 'tier-unknown',
    description: 'AI systems have no meaningful knowledge of this brand. The brand has no footprint in AI training data or its footprint is too small to surface. Immediate and comprehensive brand signal work is required.'
  };
}

// ─── MAIN EXPORT: scoreAllEngines ────────────────────────────────────────────

/**
 * Score all engine query results and produce the per-engine scored objects
 * plus the overall aggregated score.
 *
 * Input: the results map from queryAllEngines()
 * Output: the scored data structure ready for consistency, gap, and
 *         recommendation analysis, and ultimately for the frontend response.
 *
 * @param {Object.<string, {
 *   primaryText: string,
 *   narrative: string,
 *   rawConfidenceScore: number,
 *   accurateClaims: number,
 *   conflictingClaims: number,
 *   unverifiableClaims: number,
 *   topicsKnown: string[],
 *   topicsUnknown: string[],
 *   error: string|null
 * }>} engineResults - output from queryAllEngines()
 *
 * @returns {{
 *   scoredEngines: Object.<string, {
 *     score: number,
 *     recognition: number,
 *     depth: number,
 *     accuracy: number,
 *     confidence: number,
 *     narrative: string,
 *     accurateClaims: number,
 *     conflictingClaims: number,
 *     unverifiableClaims: number,
 *     topicsKnown: string[],
 *     topicsUnknown: string[],
 *     primaryText: string,
 *     failed: boolean,
 *     error: string|null
 *   }>,
 *   overallScore: number,
 *   tier: string,
 *   tierClass: string,
 *   tierDescription: string
 * }}
 */
function scoreAllEngines(engineResults) {
  const scoredEngines = {};
  const engineScores  = [];

  for (const [engine, result] of Object.entries(engineResults)) {

    // If the engine returned an error with no text, record a zero-scored failed entry
    if (result.error && (!result.primaryText || result.primaryText.trim().length < 20)) {
      scoredEngines[engine] = {
        score:              0,
        recognition:        0,
        depth:              0,
        accuracy:           0,
        confidence:         0,
        narrative:          result.error
                              ? `This engine could not be reached: ${result.error}`
                              : 'No response received from this engine.',
        accurateClaims:     0,
        conflictingClaims:  0,
        unverifiableClaims: 0,
        topicsKnown:        [],
        topicsUnknown:      [],
        primaryText:        '',
        failed:             true,
        error:              result.error || 'No response'
      };
      logger.warn(`Scoring: engine ${engine} marked as failed — ${result.error}`);
      continue;
    }

    // ── Compute four dimension scores ──
    const recognition = scoreRecognition(result.primaryText);
    const depth       = scoreDepth(
      result.primaryText,
      result.accurateClaims,
      result.conflictingClaims,
      result.unverifiableClaims,
      result.topicsKnown
    );
    const accuracy    = scoreAccuracy(
      result.primaryText,
      result.accurateClaims,
      result.conflictingClaims,
      result.unverifiableClaims,
      result.rawConfidenceScore
    );
    const confidence  = scoreConfidence(result.primaryText, result.rawConfidenceScore);

    // ── Compute weighted overall score for this engine ──
    const engineScore = scoreOverall(recognition, depth, accuracy, confidence);

    logger.info(
      `Scoring [${engine}]: recognition=${recognition} depth=${depth} ` +
      `accuracy=${accuracy} confidence=${confidence} → overall=${engineScore}`
    );

    scoredEngines[engine] = {
      score:              engineScore,
      recognition,
      depth,
      accuracy,
      confidence,
      narrative:          result.narrative || 'No narrative available.',
      accurateClaims:     result.accurateClaims     || 0,
      conflictingClaims:  result.conflictingClaims  || 0,
      unverifiableClaims: result.unverifiableClaims || 0,
      topicsKnown:        result.topicsKnown        || [],
      topicsUnknown:      result.topicsUnknown      || [],
      primaryText:        result.primaryText        || '',
      failed:             false,
      error:              result.error || null
    };

    // Collect successful engine scores for overall calculation
    // Failed / zero-score engines are excluded from the aggregate
    // so one bad engine doesn't drag down a legitimate overall score
    if (!result.error) {
      engineScores.push(engineScore);
    }
  }

  // ── Aggregate overall score ──
  // Use the mean of all successful engine scores.
  // If no engines succeeded, overall is 0.
  let overallScore = 0;
  if (engineScores.length > 0) {
    const sum = engineScores.reduce((a, b) => a + b, 0);
    overallScore = clamp(Math.round(sum / engineScores.length));
  }

  const { tier, tierClass, description: tierDescription } = classifyTier(overallScore);

  logger.info(
    `Scoring complete — ${Object.keys(scoredEngines).length} engines scored. ` +
    `Overall: ${overallScore} | Tier: ${tier}`
  );

  return {
    scoredEngines,
    overallScore,
    tier,
    tierClass,
    tierDescription
  };
}

module.exports = {
  scoreAllEngines,
  // Export individual scorers for unit testing
  scoreRecognition,
  scoreDepth,
  scoreAccuracy,
  scoreConfidence,
  scoreOverall,
  classifyTier,
  // Export helpers for unit testing
  countSignals,
  countPatternMatches,
  countMeaningfulWords
};
