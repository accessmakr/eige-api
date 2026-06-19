'use strict';

const logger = require('../../utils/logger');

// ─── DIMENSION WEIGHTS ────────────────────────────────────────────────────────
const DIMENSION_WEIGHTS = {
  recognition: 0.30,
  depth:       0.25,
  accuracy:    0.25,
  confidence:  0.20
};

// ─── SOCIAL FOOTPRINT SCALE ───────────────────────────────────────────────────
const SOCIAL_FOOTPRINT_RECOGNITION_BONUS = {
  strong:   15,
  moderate:  8,
  weak:      3,
  none:      0,
  unknown:   0
};

const SOCIAL_FOOTPRINT_DEPTH_BONUS = {
  strong:   10,
  moderate:  6,
  weak:      2,
  none:      0,
  unknown:   0
};

// ─── NEGATIVE RECOGNITION SIGNALS ────────────────────────────────────────────
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
  'likely not well-known',
  'no specific information',
  'not a well-known',
  'not widely known',
  'little known'
];

// ─── PARTIAL / HEDGING SIGNALS ────────────────────────────────────────────────
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
  'to my knowledge',
  'as far as i know',
  'not entirely sure',
  'limited information',
  'limited knowledge',
  'some knowledge'
];

// ─── INFORMAL RECOGNITION TEXT SIGNALS ───────────────────────────────────────
const INFORMAL_RECOGNITION_SIGNALS = [
  'is a', 'is an', 'is the', 'is a popular', 'is widely used',
  'is a leading', 'is a tool', 'is a platform', 'is a service',
  'is a product', 'is a company', 'is a brand', 'is a website',
  'is an app', 'is a software', 'is a saas', 'used for', 'used by',
  'helps users', 'helps people', 'helps businesses', 'allows users',
  'enables', 'provides', 'offers', 'specialises in', 'specializes in',
  'focuses on', 'designed for', 'built for', 'known for', 'popular for',
  'popular among', 'commonly used', 'widely adopted', 'recommended',
  'well-received', 'highly rated', 'trusted', 'praised', 'noted for',
  'regarded as', 'seen as', 'known as', 'operates in', 'industry',
  'competes with', 'alternative to', 'similar to'
];

// ─── HIGH / LOW CONFIDENCE LANGUAGE ──────────────────────────────────────────
const HIGH_CONFIDENCE_LANGUAGE = [
  'is known', 'is a leading', 'is one of the', 'is widely',
  'is recognised', 'is recognized', 'has been', 'operates as',
  'serves', 'specifically', 'notably', 'in particular',
  'is used by', 'is popular', 'is trusted', 'is recommended'
];

const LOW_CONFIDENCE_LANGUAGE = [
  'i think', 'i believe', 'i assume', 'if i recall', 'not entirely',
  'might be', 'could be', 'possibly', 'perhaps', 'uncertain',
  'unsure', 'unclear', 'limited information', 'may have changed',
  'not fully', 'approximate'
];

// ─── INFORMAL DEPTH TEXT PATTERNS ────────────────────────────────────────────
const INFORMAL_DEPTH_PATTERNS = [
  { pattern: /use\s*case|use\s*cases/i,                     bonus: 5 },
  { pattern: /workflow|process|pipeline/i,                  bonus: 4 },
  { pattern: /integrat(e|es|ion|ions)\s+with/i,             bonus: 5 },
  { pattern: /free\s+plan|free\s+tier|freemium|pricing/i,   bonus: 4 },
  { pattern: /community|forum|subreddit|discord/i,          bonus: 5 },
  { pattern: /alternative|competitor|versus|vs\./i,         bonus: 5 },
  { pattern: /mobile\s+app|ios|android|desktop|web\s+app/i, bonus: 4 },
  { pattern: /popular\s+among|used\s+by\s+millions|widely/i,bonus: 6 },
  { pattern: /review|rating|testimonial/i,                  bonus: 3 },
  { pattern: /problem|solution|challenge|pain\s*point/i,    bonus: 4 },
  { pattern: /trend|growing|growth|emerging/i,              bonus: 3 },
  { pattern: /recommend|suggest|worth trying/i,             bonus: 7 },
  { pattern: /customer|client|user\s+base|audience/i,       bonus: 3 },
  { pattern: /viral|meme|trending|went viral/i,             bonus: 6 },
  { pattern: /tiktok|twitter|reddit|youtube|instagram/i,    bonus: 5 }
];

// ─── FORMAL DEPTH TEXT PATTERNS ───────────────────────────────────────────────
const FORMAL_DEPTH_PATTERNS = [
  { pattern: /founded\s+in\s+\d{4}/i,                      bonus: 6 },
  { pattern: /\b(19|20)\d{2}\b/,                           bonus: 3 },
  { pattern: /headquartered\s+in|based\s+in|located\s+in/i,bonus: 5 },
  { pattern: /\$[\d.,]+\s*(million|billion|M|B)\b/i,       bonus: 7 },
  { pattern: /\b[\d.,]+\s*(million|billion)\s+users?\b/i,  bonus: 7 },
  { pattern: /CEO|CTO|CFO|founder|co-founder/i,            bonus: 5 },
  { pattern: /series\s+[A-Z]|ipo|vc\s+funding/i,          bonus: 6 },
  { pattern: /revenue|profit|valuation/i,                  bonus: 6 },
  { pattern: /acquired\s+by|acquisition|merger/i,          bonus: 5 },
  { pattern: /\d+\s+employees?|staff\s+of\s+\d+/i,        bonus: 5 }
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function clamp(value, min = 0, max = 100) {
  return Math.round(Math.min(Math.max(value, min), max));
}

function countSignals(text, signals) {
  if (!text) return 0;
  const lower = text.toLowerCase();
  return signals.reduce((n, s) => lower.includes(s.toLowerCase()) ? n + 1 : n, 0);
}

function countMeaningfulWords(text) {
  if (!text) return 0;
  const STOP = new Set([
    'the','a','an','and','or','but','in','on','at','to','for','of','with',
    'by','from','is','it','as','be','was','are','were','been','have','has',
    'had','do','does','did','will','would','could','should','may','might',
    'this','that','these','those','i','you','he','she','we','they','me',
    'him','her','us','them','my','your','his','its','our','their','what',
    'which','who','when','where','how','if','then','than','so','not','no',
    'about','after','also','any','both','each','few','more','most','other',
    'some','very','just','into','through','before','between','up','down'
  ]);
  return text.toLowerCase().split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w)).length;
}

// ─── RECOGNITION SCORER ───────────────────────────────────────────────────────
/**
 * Score RECOGNITION (0–100).
 *
 * Inputs in priority order:
 * 1. verificationRecognition — model's direct yes/no/partial statement
 * 2. communityPresent — community knowledge IS informal recognition
 * 3. recommended — cannot recommend what you do not know
 * 4. socialFootprint — strong social footprint = brand is known
 * 5. viralitySignal — viral awareness = unambiguous recognition
 * 6. Text-level signals — calibration and fallback
 */
function scoreRecognition(
  primaryText,
  verificationRecognition,
  communityPresent,
  recommended,
  socialFootprint,
  viralitySignal
) {
  if (!primaryText || primaryText.trim().length < 10) return 0;

  const text = primaryText.toLowerCase();

  // Hard cap: explicit NO from verification block
  if (verificationRecognition === 'no') {
    let rescueScore = 5;
    if (communityPresent)             rescueScore += 15;
    if (recommended === 'yes')        rescueScore += 12;
    if (socialFootprint === 'strong') rescueScore += 10;
    if (viralitySignal)               rescueScore += 8;
    return clamp(rescueScore, 0, 35);
  }

  const negativeCount = countSignals(text, RECOGNITION_NEGATIVE_SIGNALS);
  if (negativeCount >= 3 && verificationRecognition !== 'yes') {
    let floorScore = 5 + negativeCount;
    if (communityPresent)      floorScore += 15;
    if (recommended === 'yes') floorScore += 12;
    return clamp(floorScore, 0, 30);
  }

  let score = 40;

  if (verificationRecognition === 'yes')     score += 25;
  else if (verificationRecognition === 'partial') score += 8;

  if (communityPresent) score += 10;

  if (recommended === 'yes')      score += 12;
  else if (recommended === 'unclear') score += 3;

  score += (SOCIAL_FOOTPRINT_RECOGNITION_BONUS[socialFootprint] || 0);

  if (viralitySignal) score += 8;

  const informalTextCount = countSignals(text, INFORMAL_RECOGNITION_SIGNALS);
  score += Math.min(informalTextCount * 1.2, 20);

  const partialCount = countSignals(text, RECOGNITION_PARTIAL_SIGNALS);
  score -= Math.min(partialCount * 2, 12);

  score -= negativeCount * 8;

  if (verificationRecognition === 'partial') score = Math.min(score, 68);

  if ((communityPresent || recommended === 'yes') && score < 30) score = 30;

  return clamp(score);
}

// ─── DEPTH SCORER ────────────────────────────────────────────────────────────
/**
 * Score DEPTH (0–100).
 *
 * Informal depth is the PRIMARY driver (0–40 pts from informalScore).
 * Formal depth is SECONDARY / bonus only (0–20 pts from formalScore).
 * A brand can score maximum depth on informal knowledge alone.
 */
function scoreDepth(
  primaryText,
  informalScore,
  formalScore,
  communityPresent,
  socialFootprint,
  viralitySignal,
  accurateClaims,
  conflictingClaims,
  unverifiableClaims,
  topicsKnown
) {
  if (!primaryText || primaryText.trim().length < 10) return 0;

  let score = 0;

  // Informal score: PRIMARY depth driver (0–40)
  const informalContribution = ((informalScore - 1) / 9) * 40;
  score += Math.max(informalContribution, 0);

  // Formal score: SECONDARY bonus (0–20)
  const formalContribution = ((formalScore - 1) / 9) * 20;
  score += Math.max(formalContribution, 0);

  // Structured social confirmations
  if (communityPresent) score += 6;
  if (viralitySignal)   score += 5;
  score += (SOCIAL_FOOTPRINT_DEPTH_BONUS[socialFootprint] || 0);

  // Topics known breadth
  const topicCount = Array.isArray(topicsKnown) ? topicsKnown.length : 0;
  score += Math.min(topicCount * 2.5, 15);

  // Informal text patterns — calibration (reduced weight to avoid double-count)
  let informalTextBonus = 0;
  for (const item of INFORMAL_DEPTH_PATTERNS) {
    if (item.pattern.test(primaryText)) informalTextBonus += item.bonus;
  }
  score += Math.min(informalTextBonus * 0.4, 12);

  // Formal text patterns — bonus
  let formalTextBonus = 0;
  for (const item of FORMAL_DEPTH_PATTERNS) {
    if (item.pattern.test(primaryText)) formalTextBonus += item.bonus;
  }
  score += Math.min(formalTextBonus * 0.4, 8);

  // Word count
  const wordCount = countMeaningfulWords(primaryText);
  score += Math.min((wordCount / 400) * 14, 14);

  // Total claims bonus
  const totalClaims = (accurateClaims || 0) + (conflictingClaims || 0) + (unverifiableClaims || 0);
  score += Math.min((totalClaims / 12) * 5, 5);

  return clamp(score);
}

// ─── ACCURACY SCORER ──────────────────────────────────────────────────────────
/**
 * Score ACCURACY (0–100).
 *
 * FIX FOR A10 — recalibrated penalty weights:
 *
 * The previous formula was too aggressive for real-world responses.
 * With 10 accurate and 2 conflicting claims, Amazon Meta AI scored 52%
 * which is too low for a response that is largely correct about one of
 * the world's most documented brands.
 *
 * The core problem was two compounding penalties:
 *   - Conflicting claims were penalised at ×2 weight (double penalty)
 *   - Unverifiable claims were penalised significantly despite being
 *     merely uncertain, not wrong
 *
 * Changes made:
 *   1. Conflicting claim penalty reduced from ×2.0 to ×1.3
 *      Conflicting claims are still penalised more than accurate claims
 *      are rewarded, but not so aggressively that 2 out of 15 claims
 *      drags the score below 50%.
 *
 *   2. Unverifiable claim penalty reduced significantly.
 *      Unverifiable claims are statements the model included with lower
 *      certainty — they are not wrong. They represent honest epistemic
 *      hedging. The old denominator (totalClaims * 2 + 1) was creating
 *      a meaningful drag even for small numbers of unverifiable claims.
 *      New denominator is (totalClaims * 4 + 1) — much lighter touch.
 *
 *   3. No-verification baseline raised from 20 to 25.
 *      When the verification turn returns no claim data (common for
 *      brands the model describes informally without making discrete
 *      verifiable claims), a neutral baseline of 25 is more appropriate.
 *
 *   4. Recommendation signal increased from +8 to +10.
 *      Recommending a brand requires confidence in its quality and
 *      accuracy — it is a stronger accuracy signal than previously weighted.
 *
 * With these changes:
 *   Amazon Meta AI (10 acc, 2 conf, 5 unverif) → ~64% (was 52%) ✓
 *   L'Oréal Meta AI (10 acc, 2 conf, 3 unverif) → ~66% (was 56%) ✓
 *   Amazon Mistral (7 acc, 0 conf, 2 unverif)   → ~74% (was 66%) ✓
 *   Unknown brand (0 acc, 3 conf, 5 unverif)    → ~25% (unchanged) ✓
 */
function scoreAccuracy(
  primaryText,
  accurateClaims,
  conflictingClaims,
  unverifiableClaims,
  rawConfidenceScore,
  recommended,
  sentiment
) {
  if (!primaryText || primaryText.trim().length < 10) return 0;

  let score = 0;

  // ── 1. Claim ratio component (0–45 points) ──
  const totalClaims = (accurateClaims || 0) + (conflictingClaims || 0) + (unverifiableClaims || 0);

  if (totalClaims > 0) {
    const positiveWeight = (accurateClaims || 0) / totalClaims;

    // RECALIBRATED: conflicting penalty reduced from ×2.0 to ×1.3
    const conflictPenalty = ((conflictingClaims || 0) * 1.3) / (totalClaims + 1);

    // RECALIBRATED: unverifiable penalty significantly reduced
    // Denominator changed from (totalClaims * 2 + 1) to (totalClaims * 4 + 1)
    const unverifiablePenalty = (unverifiableClaims || 0) / (totalClaims * 4 + 1);

    const ratio = Math.max(0, positiveWeight - conflictPenalty - unverifiablePenalty);
    score += ratio * 45;
  } else {
    // RECALIBRATED: baseline raised from 20 to 25
    // Informal-only responses legitimately have no discrete verifiable claims
    score += 25;
  }

  // ── 2. Recommendation signal (0–10 points) ──
  // RECALIBRATED: increased from +8 to +10
  // Recommendation requires confident, accurate knowledge to endorse
  if (recommended === 'yes')      score += 10;
  else if (recommended === 'unclear') score += 2;

  // ── 3. Sentiment modifier ──
  // Positive community sentiment is a weak accuracy proxy
  // Mixed indicates nuanced knowledge — also a mild positive signal
  if (sentiment === 'positive')   score += 5;
  else if (sentiment === 'mixed') score += 3;

  // ── 4. Self-reported confidence (0–22 points) ──
  const selfScore = Math.min(Math.max(rawConfidenceScore || 5, 1), 10);
  score += ((selfScore - 1) / 9) * 22;

  // ── 5. Linguistic confidence markers (0–18 points) ──
  const highCount = countSignals(primaryText, HIGH_CONFIDENCE_LANGUAGE);
  const lowCount  = countSignals(primaryText, LOW_CONFIDENCE_LANGUAGE);
  const linguisticNet = Math.min(highCount * 3, 14) - Math.min(lowCount * 2, 10);
  score += Math.min(Math.max(linguisticNet + 8, 0), 18);

  // ── 6. Cap: strong negative recognition signals ──
  const negativeCount = countSignals(primaryText.toLowerCase(), RECOGNITION_NEGATIVE_SIGNALS);
  if (negativeCount >= 2) score = Math.min(score, 20);

  return clamp(score);
}

// ─── CONFIDENCE SCORER ────────────────────────────────────────────────────────
/**
 * Score CONFIDENCE (0–100).
 *
 * Self-reported confidence is primary.
 * informalScore contributes — high informal knowledge = confident assertions
 * about community perception even without formal facts.
 * Recommendation signal boosts confidence.
 */
function scoreConfidence(primaryText, rawConfidenceScore, informalScore, recommended) {
  if (!primaryText || primaryText.trim().length < 10) return 0;

  let score = 0;

  // Self-reported confidence (1–10 → 0–45)
  const selfScore = Math.min(Math.max(rawConfidenceScore || 5, 1), 10);
  score += ((selfScore - 1) / 9) * 45;

  // Informal score contributes to confidence
  const informalContrib = Math.min(Math.max(informalScore || 5, 1), 10);
  score += ((informalContrib - 1) / 9) * 20;

  // Recommendation signal
  if (recommended === 'yes')      score += 8;
  else if (recommended === 'unclear') score += 2;

  // Linguistic confidence markers (0–18)
  const highCount = countSignals(primaryText, HIGH_CONFIDENCE_LANGUAGE);
  const lowCount  = countSignals(primaryText, LOW_CONFIDENCE_LANGUAGE);
  const linguisticNet = Math.min(highCount * 3, 14) - Math.min(lowCount * 2, 12);
  score += Math.min(Math.max(linguisticNet + 9, 0), 18);

  // No negative signals = confidence bonus
  const negativeCount = countSignals(primaryText.toLowerCase(), RECOGNITION_NEGATIVE_SIGNALS);
  if (negativeCount === 0)      score += 9;
  else if (negativeCount === 1) score += 3;
  else                          score -= negativeCount * 7;

  return clamp(score);
}

// ─── OVERALL SCORE ────────────────────────────────────────────────────────────

function scoreOverall(recognition, depth, accuracy, confidence) {
  return clamp(
    (recognition * DIMENSION_WEIGHTS.recognition) +
    (depth       * DIMENSION_WEIGHTS.depth)       +
    (accuracy    * DIMENSION_WEIGHTS.accuracy)    +
    (confidence  * DIMENSION_WEIGHTS.confidence)
  );
}

// ─── TIER CLASSIFIER ─────────────────────────────────────────────────────────
/**
 * RECALIBRATED THRESHOLDS — confirmed against real scan data across
 * Apple, BBC, PayPal, Amazon, Walmart with Gemma excluded from the
 * default engine set (Gemma 2 9B was dragging well-known brand scores
 * down 30+ points vs the 70B-class engines, causing absurd
 * "PARTIALLY KNOWN" verdicts on globally famous brands).
 *
 * Old thresholds: 91 / 76 / 51 / 26
 * New thresholds: 80 / 65 / 45 / 25
 *
 * Verified against 2-engine (Meta AI + Mistral) averages with Gemma
 * deactivated by default:
 *   Apple   89.5 → WELL KNOWN ✓
 *   BBC     89   → WELL KNOWN ✓
 *   PayPal  86.5 → WELL KNOWN ✓
 *   Amazon  87.5 → WELL KNOWN ✓
 *   Walmart 82.5 → WELL KNOWN ✓
 */
function classifyTier(score) {
  if (score >= 80) return {
    tier: 'WELL KNOWN',
    tierClass: 'tier-well-known',
    description: 'Strong, rich awareness across tested AI engines — formal and informal. The AI ecosystem has a detailed, confident, multi-dimensional model of this brand. Focus on maintaining currency.'
  };
  if (score >= 65) return {
    tier: 'KNOWN',
    tierClass: 'tier-known',
    description: 'Solid AI awareness with clear recognition and good depth. Some dimensions could be enriched — deeper community signals or more formal anchoring would push this higher.'
  };
  if (score >= 45) return {
    tier: 'PARTIALLY KNOWN',
    tierClass: 'tier-partial',
    description: 'Present but limited AI awareness. The brand registers but descriptions are thin or hedged. Targeted content work, community presence, and brand signal building is recommended.'
  };
  if (score >= 25) return {
    tier: 'MINIMALLY KNOWN',
    tierClass: 'tier-partial',
    description: 'Fragile AI awareness. The brand barely surfaces. Foundational brand signal work across web, community, and content is needed before depth or consistency can improve.'
  };
  return {
    tier: 'NOT KNOWN',
    tierClass: 'tier-unknown',
    description: 'No meaningful AI awareness detected. The brand has no footprint in AI training data, or its footprint is too small to reliably surface. Immediate comprehensive brand signal work required.'
  };
}

// ─── MAIN EXPORT: scoreAllEngines ────────────────────────────────────────────
/**
 * Score every engine result using ALL signals from queryEngine.js.
 * Every field from the verification block is explicitly wired in.
 * No field from the pipeline is ignored.
 */
function scoreAllEngines(engineResults) {
  const scoredEngines = {};
  const engineScores  = [];

  for (const [engine, result] of Object.entries(engineResults)) {

    // Failed engine — zero-scored entry
    if (result.error && (!result.primaryText || result.primaryText.trim().length < 20)) {
      scoredEngines[engine] = {
        score: 0, recognition: 0, depth: 0, accuracy: 0, confidence: 0,
        narrative:          result.narrative || `Engine unavailable: ${result.error}`,
        accurateClaims:     0, conflictingClaims: 0, unverifiableClaims: 0,
        topicsKnown: [], topicsUnknown: [],
        sentiment: 'unknown', communityPresent: false,
        recommended: 'unclear', socialFootprint: 'unknown',
        viralitySignal: false, informalScore: 0, formalScore: 0,
        primaryText: '', failed: true,
        error: result.error || 'No response'
      };
      logger.warn(`Scoring: engine ${engine} failed — ${result.error}`);
      continue;
    }

    // Extract ALL fields from queryEngine output
    const informalScore           = result.informalScore           || 5;
    const formalScore             = result.formalScore             || 5;
    const communityPresent        = result.communityPresent        || false;
    const recommended             = result.recommended             || 'unclear';
    const socialFootprint         = result.socialFootprint         || 'unknown';
    const viralitySignal          = result.viralitySignal          || false;
    const sentiment               = result.sentiment               || 'unknown';
    const verificationRecognition = result.verificationRecognition || 'unknown';

    // Score all four dimensions
    const recognition = scoreRecognition(
      result.primaryText,
      verificationRecognition,
      communityPresent,
      recommended,
      socialFootprint,
      viralitySignal
    );

    const depth = scoreDepth(
      result.primaryText,
      informalScore,
      formalScore,
      communityPresent,
      socialFootprint,
      viralitySignal,
      result.accurateClaims     || 0,
      result.conflictingClaims  || 0,
      result.unverifiableClaims || 0,
      result.topicsKnown        || []
    );

    const accuracy = scoreAccuracy(
      result.primaryText,
      result.accurateClaims     || 0,
      result.conflictingClaims  || 0,
      result.unverifiableClaims || 0,
      result.rawConfidenceScore || 5,
      recommended,
      sentiment
    );

    const confidence = scoreConfidence(
      result.primaryText,
      result.rawConfidenceScore || 5,
      informalScore,
      recommended
    );

    const engineScore = scoreOverall(recognition, depth, accuracy, confidence);

    logger.info(
      `Scoring [${engine}]: ` +
      `informal=${informalScore} formal=${formalScore} ` +
      `community=${communityPresent} recommended=${recommended} ` +
      `social=${socialFootprint} viral=${viralitySignal} ` +
      `sentiment=${sentiment} | ` +
      `recognition=${recognition} depth=${depth} ` +
      `accuracy=${accuracy} confidence=${confidence} ` +
      `→ overall=${engineScore}`
    );

    scoredEngines[engine] = {
      score:              engineScore,
      recognition,
      depth,
      accuracy,
      confidence,
      narrative:          result.narrative          || 'No narrative available.',
      accurateClaims:     result.accurateClaims     || 0,
      conflictingClaims:  result.conflictingClaims  || 0,
      unverifiableClaims: result.unverifiableClaims || 0,
      topicsKnown:        result.topicsKnown        || [],
      topicsUnknown:      result.topicsUnknown      || [],
      sentiment,
      communityPresent,
      recommended,
      socialFootprint,
      viralitySignal,
      informalScore,
      formalScore,
      primaryText:        result.primaryText        || '',
      failed:             false,
      error:              result.error || null
    };

    if (!result.error) engineScores.push(engineScore);
  }

  // Overall = mean of all successful engine scores
  let overallScore = 0;
  if (engineScores.length > 0) {
    overallScore = clamp(
      Math.round(engineScores.reduce((a, b) => a + b, 0) / engineScores.length)
    );
  }

  const { tier, tierClass, description: tierDescription } = classifyTier(overallScore);

  logger.info(
    `Scoring complete — ${Object.keys(scoredEngines).length} engines | ` +
    `Overall: ${overallScore} | Tier: ${tier}`
  );

  return { scoredEngines, overallScore, tier, tierClass, tierDescription };
}

module.exports = {
  scoreAllEngines,
  scoreRecognition,
  scoreDepth,
  scoreAccuracy,
  scoreConfidence,
  scoreOverall,
  classifyTier,
  countSignals,
  countMeaningfulWords
};
