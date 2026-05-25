'use strict';

const logger = require('../../utils/logger');

// ─── DIMENSION WEIGHTS ────────────────────────────────────────────────────────
// Recognition is the foundation. Depth and accuracy share equal weight.
// Confidence is a supporting signal.
const DIMENSION_WEIGHTS = {
  recognition: 0.30,
  depth:       0.25,
  accuracy:    0.25,
  confidence:  0.20
};

// ─── SOCIAL FOOTPRINT SCALE ───────────────────────────────────────────────────
// Maps the string value from verification block to numeric bonus points.
// Used in both recognition and depth scoring.
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
// Text-level signals that the model has no knowledge of this brand.
// Used as a safety check alongside the structured verification fields.
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
// Text-level fallback signals for informal awareness.
// Used when verification fields are absent or incomplete.
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
// Text-level fallback for depth — used alongside informalScore.
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
 * Inputs used — in priority order:
 *
 * 1. verificationRecognition ('yes'/'no'/'partial') — the model's own direct
 *    statement of whether it recognises the brand. This is the strongest
 *    single signal and overrides or heavily weights everything else.
 *
 * 2. communityPresent (bool) — if the model has community/social knowledge
 *    it cannot not recognise the brand. Community knowledge IS recognition.
 *
 * 3. recommended (yes/no/unclear) — you cannot recommend what you do not
 *    know. A recommendation signal is a strong recognition signal.
 *
 * 4. socialFootprint (strong/moderate/weak/none) — strong social footprint
 *    in the model's training means the brand is known.
 *
 * 5. viralitySignal (bool) — viral awareness is unambiguous recognition.
 *
 * 6. Text-level signals — used as calibration when structured fields
 *    are weak or ambiguous.
 *
 * @param {string}  primaryText
 * @param {string}  verificationRecognition - 'yes' | 'no' | 'partial' | 'unknown'
 * @param {boolean} communityPresent
 * @param {string}  recommended             - 'yes' | 'no' | 'unclear'
 * @param {string}  socialFootprint         - 'strong' | 'moderate' | 'weak' | 'none' | 'unknown'
 * @param {boolean} viralitySignal
 * @returns {number} 0–100
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

  // ── Hard cap: explicit NO from verification block ──
  if (verificationRecognition === 'no') {
    // Even if it said no, community/social signals can partially override
    // because the model may have informal knowledge it doesn't classify
    // as "recognition" in its structured response
    let rescueScore = 5;
    if (communityPresent)              rescueScore += 15;
    if (recommended === 'yes')         rescueScore += 12;
    if (socialFootprint === 'strong')  rescueScore += 10;
    if (viralitySignal)                rescueScore += 8;
    return clamp(rescueScore, 0, 35);
  }

  // ── Text-level negative signals ──
  const negativeCount = countSignals(text, RECOGNITION_NEGATIVE_SIGNALS);
  if (negativeCount >= 3 && verificationRecognition !== 'yes') {
    let floorScore = 5 + negativeCount;
    if (communityPresent)  floorScore += 15;
    if (recommended === 'yes') floorScore += 12;
    return clamp(floorScore, 0, 30);
  }

  let score = 40; // neutral base

  // ── Structured verification: direct YES is a massive positive signal ──
  if (verificationRecognition === 'yes')     score += 25;
  else if (verificationRecognition === 'partial') score += 8;

  // ── Community knowledge = the model knows this brand informally ──
  // This is independent of whether it can state formal facts.
  // Community presence is one of the strongest informal recognition signals.
  if (communityPresent) score += 10;

  // ── Recommendation signal ──
  // You cannot recommend something you do not recognise.
  if (recommended === 'yes')     score += 12;
  else if (recommended === 'unclear') score += 3;

  // ── Social footprint ──
  score += (SOCIAL_FOOTPRINT_RECOGNITION_BONUS[socialFootprint] || 0);

  // ── Virality = unambiguous cultural awareness ──
  if (viralitySignal) score += 8;

  // ── Text-level informal signals (calibration / fallback) ──
  const informalTextCount = countSignals(text, INFORMAL_RECOGNITION_SIGNALS);
  score += Math.min(informalTextCount * 1.2, 20);

  // ── Text-level hedging penalty ──
  const partialCount = countSignals(text, RECOGNITION_PARTIAL_SIGNALS);
  score -= Math.min(partialCount * 2, 12);

  // ── Text-level negative signal penalty ──
  score -= negativeCount * 8;

  // ── Verification partial cap ──
  if (verificationRecognition === 'partial') {
    score = Math.min(score, 68);
  }

  // ── Floor: if community or recommendation signals exist,
  //    score cannot be below 30 regardless of text signals ──
  if ((communityPresent || recommended === 'yes') && score < 30) {
    score = 30;
  }

  return clamp(score);
}

// ─── DEPTH SCORER ────────────────────────────────────────────────────────────
/**
 * Score DEPTH (0–100).
 *
 * Depth measures the richness of the AI's knowledge about the brand.
 * This scorer treats informal and formal knowledge as two fully independent
 * contribution tracks. A brand can score maximum depth on informal knowledge
 * alone — no intrinsic facts required.
 *
 * Inputs used — contribution order:
 *
 * 1. informalScore (1–10) from File 2 verification block.
 *    This is the model's own self-assessed informal/social knowledge richness.
 *    Maps to 0–40 points. This is the PRIMARY depth driver.
 *
 * 2. formalScore (1–10) from File 2 verification block.
 *    Maps to 0–20 points. SECONDARY / bonus only.
 *
 * 3. communityPresent, socialFootprint, viralitySignal — structured signals
 *    that confirm informal depth beyond the self-reported score.
 *
 * 4. topicsKnown breadth — each topic the model explicitly claims
 *    to know about this brand is concrete depth evidence.
 *
 * 5. Text-level informal pattern matching — fallback calibration.
 *
 * 6. Text-level formal pattern matching — bonus.
 *
 * 7. Word count — more content = more coverage attempted.
 *
 * @param {string}   primaryText
 * @param {number}   informalScore    - 1–10 from verification block
 * @param {number}   formalScore      - 1–10 from verification block
 * @param {boolean}  communityPresent
 * @param {string}   socialFootprint
 * @param {boolean}  viralitySignal
 * @param {number}   accurateClaims
 * @param {number}   conflictingClaims
 * @param {number}   unverifiableClaims
 * @param {string[]} topicsKnown
 * @returns {number} 0–100
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

  // ── 1. Informal score: PRIMARY depth driver (0–40 points) ──
  // informalScore is 1–10. Map 1→2pts, 5→20pts, 10→40pts (linear)
  const informalContribution = ((informalScore - 1) / 9) * 40;
  score += Math.max(informalContribution, 0);

  // ── 2. Formal score: SECONDARY / bonus (0–20 points) ──
  const formalContribution = ((formalScore - 1) / 9) * 20;
  score += Math.max(formalContribution, 0);

  // ── 3. Structured social/community confirmations ──
  if (communityPresent) score += 6;
  if (viralitySignal)   score += 5;
  score += (SOCIAL_FOOTPRINT_DEPTH_BONUS[socialFootprint] || 0);

  // ── 4. Topics known breadth ──
  // Each topic explicitly claimed = concrete depth evidence
  const topicCount = Array.isArray(topicsKnown) ? topicsKnown.length : 0;
  score += Math.min(topicCount * 2.5, 15);

  // ── 5. Text-level informal patterns (calibration) ──
  let informalTextBonus = 0;
  for (const item of INFORMAL_DEPTH_PATTERNS) {
    if (item.pattern.test(primaryText)) informalTextBonus += item.bonus;
  }
  // Calibration: these confirm the informalScore, they do not replace it
  // Weight is reduced (×0.4) to prevent double-counting
  score += Math.min(informalTextBonus * 0.4, 12);

  // ── 6. Text-level formal patterns (bonus) ──
  let formalTextBonus = 0;
  for (const item of FORMAL_DEPTH_PATTERNS) {
    if (item.pattern.test(primaryText)) formalTextBonus += item.bonus;
  }
  score += Math.min(formalTextBonus * 0.4, 8);

  // ── 7. Word count ──
  const wordCount = countMeaningfulWords(primaryText);
  // 0→0, 100→5, 250→10, 400+→14
  score += Math.min((wordCount / 400) * 14, 14);

  // ── 8. Total claims bonus ──
  const totalClaims = (accurateClaims || 0) + (conflictingClaims || 0) + (unverifiableClaims || 0);
  score += Math.min((totalClaims / 12) * 5, 5);

  return clamp(score);
}

// ─── ACCURACY SCORER ──────────────────────────────────────────────────────────
/**
 * Score ACCURACY (0–100).
 *
 * Accuracy reflects how factually reliable the response appears.
 * It uses:
 *
 * 1. Claim ratio from verification block (accurate vs conflicting/unverifiable)
 * 2. Recommendation signal — you recommend things you know accurately
 * 3. Sentiment — positive community sentiment is a weak accuracy proxy
 *    (communities tend to describe accurately what they like)
 * 4. Model's self-reported confidence
 * 5. Linguistic confidence markers in text
 * 6. Penalty for strong negative recognition signals
 *
 * @param {string} primaryText
 * @param {number} accurateClaims
 * @param {number} conflictingClaims
 * @param {number} unverifiableClaims
 * @param {number} rawConfidenceScore  - model self-reported 1–10
 * @param {string} recommended         - 'yes' | 'no' | 'unclear'
 * @param {string} sentiment           - 'positive' | 'negative' | 'mixed' | 'neutral' | 'unknown'
 * @returns {number} 0–100
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

  // ── 1. Claim ratio (0–45 points) ──
  const totalClaims = (accurateClaims || 0) + (conflictingClaims || 0) + (unverifiableClaims || 0);

  if (totalClaims > 0) {
    const positiveWeight     = (accurateClaims || 0) / totalClaims;
    const conflictPenalty    = ((conflictingClaims || 0) * 2) / (totalClaims + 1);
    const unverifiablePenalty= (unverifiableClaims || 0) / (totalClaims * 2 + 1);
    const ratio = Math.max(0, positiveWeight - conflictPenalty - unverifiablePenalty);
    score += ratio * 45;
  } else {
    // No claim data — neutral baseline
    // Informal-only responses legitimately have no intrinsic claims to verify
    score += 20;
  }

  // ── 2. Recommendation signal ──
  // Recommending a brand implies accurate enough knowledge to endorse it
  if (recommended === 'yes')     score += 8;
  else if (recommended === 'unclear') score += 2;

  // ── 3. Sentiment modifier ──
  // Positive sentiment implies consistent, recognisable brand positioning
  // Negative is neutral (criticism can be accurate too)
  // Mixed is a mild accuracy signal (model has nuanced knowledge)
  if (sentiment === 'positive')  score += 5;
  else if (sentiment === 'mixed') score += 3;
  // negative and neutral get no modifier — not penalised

  // ── 4. Self-reported confidence (0–22 points) ──
  const selfScore = Math.min(Math.max(rawConfidenceScore || 5, 1), 10);
  score += ((selfScore - 1) / 9) * 22;

  // ── 5. Linguistic confidence markers (0–20 points) ──
  const highCount = countSignals(primaryText, HIGH_CONFIDENCE_LANGUAGE);
  const lowCount  = countSignals(primaryText, LOW_CONFIDENCE_LANGUAGE);
  const linguisticNet = Math.min(highCount * 3, 14) - Math.min(lowCount * 2, 10);
  score += Math.min(Math.max(linguisticNet + 8, 0), 20);

  // ── 6. Penalty: strong negative recognition signals ──
  const negativeCount = countSignals(primaryText.toLowerCase(), RECOGNITION_NEGATIVE_SIGNALS);
  if (negativeCount >= 2) score = Math.min(score, 20);

  return clamp(score);
}

// ─── CONFIDENCE SCORER ────────────────────────────────────────────────────────
/**
 * Score CONFIDENCE (0–100).
 *
 * Confidence measures how assertively the AI speaks about this brand.
 * It uses:
 *
 * 1. Self-reported confidence (1–10) — primary signal
 * 2. informalScore — a model with strong informal knowledge speaks confidently
 *    about what it knows from community/social context
 * 3. Recommendation signal — recommending something requires confidence
 * 4. Linguistic confidence markers in text
 * 5. Absence of negative recognition signals
 *
 * @param {string}  primaryText
 * @param {number}  rawConfidenceScore - 1–10
 * @param {number}  informalScore      - 1–10
 * @param {string}  recommended        - 'yes' | 'no' | 'unclear'
 * @returns {number} 0–100
 */
function scoreConfidence(primaryText, rawConfidenceScore, informalScore, recommended) {
  if (!primaryText || primaryText.trim().length < 10) return 0;

  let score = 0;

  // ── 1. Self-reported confidence (1–10 → 0–45) ──
  const selfScore = Math.min(Math.max(rawConfidenceScore || 5, 1), 10);
  score += ((selfScore - 1) / 9) * 45;

  // ── 2. Informal score contributes to confidence ──
  // A model with strong informal knowledge (informalScore 8+) speaks
  // confidently about community perception even without formal facts
  const informalContrib = Math.min(Math.max(informalScore || 5, 1), 10);
  score += ((informalContrib - 1) / 9) * 20;

  // ── 3. Recommendation signal ──
  if (recommended === 'yes')     score += 8;
  else if (recommended === 'unclear') score += 2;

  // ── 4. Linguistic confidence markers (0–18 points) ──
  const highCount = countSignals(primaryText, HIGH_CONFIDENCE_LANGUAGE);
  const lowCount  = countSignals(primaryText, LOW_CONFIDENCE_LANGUAGE);
  const linguisticNet = Math.min(highCount * 3, 14) - Math.min(lowCount * 2, 12);
  score += Math.min(Math.max(linguisticNet + 9, 0), 18);

  // ── 5. No negative recognition signals = confidence bonus ──
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
 * Classify overall score into a named tier.
 * Tiers match exactly what the frontend renders.
 */
function classifyTier(score) {
  if (score >= 91) return {
    tier: 'WELL KNOWN',
    tierClass: 'tier-well-known',
    description: 'Strong, rich awareness across tested AI engines — formal and informal. The AI ecosystem has a detailed, confident, multi-dimensional model of this brand. Focus on maintaining currency.'
  };
  if (score >= 76) return {
    tier: 'KNOWN',
    tierClass: 'tier-known',
    description: 'Solid AI awareness with clear recognition and good depth. Some dimensions could be enriched — deeper community signals or more formal anchoring would push this higher.'
  };
  if (score >= 51) return {
    tier: 'PARTIALLY KNOWN',
    tierClass: 'tier-partial',
    description: 'Present but limited AI awareness. The brand registers but descriptions are thin or hedged. Targeted content work, community presence, and brand signal building is recommended.'
  };
  if (score >= 26) return {
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
 * Score every engine result using ALL signals from File 2 —
 * both the traditional text-level signals AND the new structured
 * informal/social/community dimensions extracted by queryEngine.js.
 *
 * Every new field from the verification block is explicitly wired into
 * the correct scorer. No field from File 2 is ignored.
 *
 * @param {Object} engineResults - output of queryAllEngines()
 * @returns {{
 *   scoredEngines: Object,
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

    // ── Failed engine: zero-scored entry ──
    if (result.error && (!result.primaryText || result.primaryText.trim().length < 20)) {
      scoredEngines[engine] = {
        score: 0, recognition: 0, depth: 0, accuracy: 0, confidence: 0,
        narrative: result.error
          ? `This engine could not be reached: ${result.error}`
          : 'No response received from this engine.',
        accurateClaims: 0, conflictingClaims: 0, unverifiableClaims: 0,
        topicsKnown: [], topicsUnknown: [],
        sentiment: 'unknown', communityPresent: false,
        recommended: 'unclear', socialFootprint: 'unknown',
        viralitySignal: false, informalScore: 0, formalScore: 0,
        primaryText: '', failed: true, error: result.error || 'No response'
      };
      logger.warn(`Scoring: engine ${engine} failed — ${result.error}`);
      continue;
    }

    // ── Extract ALL fields from File 2 output ──
    // These are the structured signals extracted by parseVerificationBlock()
    // and set on results[engine] in queryAllEngines().
    // NONE of these are optional — every one feeds a scorer.
    const informalScore      = result.informalScore      || 5;
    const formalScore        = result.formalScore        || 5;
    const communityPresent   = result.communityPresent   || false;
    const recommended        = result.recommended        || 'unclear';
    const socialFootprint    = result.socialFootprint    || 'unknown';
    const viralitySignal     = result.viralitySignal     || false;
    const sentiment          = result.sentiment          || 'unknown';
    // verificationRecognition: from the RECOGNITION field in verification block
    // This was parsed by parseVerificationBlock() as result.recognition
    // (stored under 'recognition' key in the verification parsed output)
    // queryEngine stores it directly on the result — map it here
    const verificationRecognition = result.verificationRecognition || 'unknown';

    // ── Score all four dimensions with ALL relevant fields ──
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
      // All new informal/social fields — passed through to handler
      // for inclusion in the final response to the frontend
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

  // ── Overall = mean of all successful engine scores ──
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
