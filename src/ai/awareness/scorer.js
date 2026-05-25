'use strict';

const logger = require('../../utils/logger');

// ─── SCORING WEIGHTS ──────────────────────────────────────────────────────────
// Recognition is the foundation — if the AI does not know the brand exists,
// nothing else matters. Accuracy and depth share almost equal weight.
// Confidence is a supporting signal, not a primary driver.
const DIMENSION_WEIGHTS = {
  recognition: 0.30,
  depth:       0.25,
  accuracy:    0.25,
  confidence:  0.20
};

// ─── INFORMAL RECOGNITION SIGNALS ────────────────────────────────────────────
// These are phrases that indicate the AI knows the brand in a practical,
// experiential sense — even if it cannot cite founding year or CEO name.
// This is the most important signal set in the entire scorer.
const INFORMAL_RECOGNITION_SIGNALS = [
  // Categorical awareness
  'is a',
  'is an',
  'is the',
  'is a popular',
  'is a well-known',
  'is a widely used',
  'is a leading',
  'is a major',
  'is a common',
  'is a well-regarded',
  'is a trusted',
  'is a free',
  'is a paid',
  'is a subscription',
  'is a tool',
  'is a platform',
  'is a service',
  'is a product',
  'is a company',
  'is a startup',
  'is a brand',
  'is a website',
  'is a web',
  'is an app',
  'is an application',
  'is an online',
  'is a software',
  'is a saas',
  'is a marketplace',
  'is a network',
  'is a community',
  // Functional awareness — the AI knows what it does
  'used for',
  'used by',
  'helps users',
  'helps people',
  'helps businesses',
  'allows users',
  'allows people',
  'allows businesses',
  'enables users',
  'enables businesses',
  'provides',
  'offers',
  'specialises in',
  'specializes in',
  'focuses on',
  'designed for',
  'built for',
  'created for',
  'intended for',
  'aimed at',
  'targeted at',
  'designed to',
  'built to',
  'known for',
  'popular for',
  'popular among',
  'commonly used',
  'frequently used',
  'widely adopted',
  'widely used',
  'widely popular',
  'primarily used',
  'mainly used',
  'mostly used',
  // Audience awareness — the AI knows who uses it
  'developers',
  'designers',
  'marketers',
  'businesses',
  'companies',
  'individuals',
  'professionals',
  'students',
  'creators',
  'teams',
  'enterprises',
  'small businesses',
  'freelancers',
  'startups',
  'consumers',
  'users',
  // Reputation and perception signals
  'well-received',
  'well received',
  'highly rated',
  'highly regarded',
  'well regarded',
  'respected',
  'reputable',
  'reliable',
  'trusted',
  'recommended',
  'praised',
  'recognised for',
  'recognized for',
  'noted for',
  'celebrated for',
  'considered',
  'regarded as',
  'seen as',
  'known as',
  // Industry/category placement
  'operates in',
  'operates within',
  'industry',
  'sector',
  'market',
  'space',
  'niche',
  'category',
  'vertical',
  'segment',
  'field',
  'domain',
  // Competitive awareness
  'competes with',
  'competitor',
  'alternative to',
  'similar to',
  'compared to',
  'alongside',
  'like',
  'such as'
];

// ─── FORMAL RECOGNITION SIGNALS ───────────────────────────────────────────────
// These are signals that the AI has deeper, encyclopaedic knowledge.
// Important but NOT required for high scores — these are bonus signals only.
const FORMAL_RECOGNITION_SIGNALS = [
  'founded in',
  'founded by',
  'established in',
  'launched in',
  'headquartered in',
  'based in',
  'located in',
  'incorporated in',
  'ceo',
  'cto',
  'cfo',
  'founder',
  'co-founder',
  'president',
  'executive',
  '\$',
  'revenue',
  'valuation',
  'funding',
  'series',
  'investors',
  'venture',
  'ipo',
  'publicly traded',
  'employees',
  'staff',
  'team of',
  'acquired',
  'acquisition',
  'merger',
  'partnership',
  'nasdaq',
  'nyse'
];

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
  'obscure',
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

// ─── INFORMAL DEPTH SIGNALS ───────────────────────────────────────────────────
// These reflect broad knowledge breadth — use cases, workflows, integrations,
// comparisons, community, pricing model. None of these are intrinsic facts.
const INFORMAL_DEPTH_PATTERNS = [
  { pattern: /use\s*case|use\s*cases/i,                    label: 'use cases mentioned',        bonus: 6 },
  { pattern: /workflow|process|pipeline/i,                 label: 'workflow context',           bonus: 5 },
  { pattern: /integrat(e|es|ion|ions)\s+with/i,            label: 'integrations mentioned',     bonus: 6 },
  { pattern: /free\s+plan|free\s+tier|freemium|pricing/i,  label: 'pricing model known',        bonus: 5 },
  { pattern: /community|forum|subreddit|discord/i,         label: 'community awareness',        bonus: 4 },
  { pattern: /alternative|competitor|versus|vs\./i,        label: 'competitive awareness',      bonus: 6 },
  { pattern: /mobile\s+app|ios|android|desktop|web\s+app/i, label: 'platform awareness',       bonus: 5 },
  { pattern: /api|sdk|developer|open\s*source/i,           label: 'technical category known',   bonus: 4 },
  { pattern: /popular\s+among|used\s+by\s+millions|widely/i, label: 'scale awareness',          bonus: 7 },
  { pattern: /review|rating|testimonial|feedback/i,        label: 'reputation awareness',       bonus: 4 },
  { pattern: /industry|sector|market|space|niche/i,        label: 'industry placement',         bonus: 5 },
  { pattern: /problem|solution|challenge|pain\s*point/i,   label: 'problem-solution framing',   bonus: 5 },
  { pattern: /trend|growing|growth|emerging|rising/i,      label: 'growth trajectory known',    bonus: 4 },
  { pattern: /recommend|suggest|worth trying|worth using/i, label: 'recommendation signal',     bonus: 8 },
  { pattern: /customer|client|user\s+base|audience/i,      label: 'audience awareness',         bonus: 4 }
];

// ─── FORMAL DEPTH PATTERNS ────────────────────────────────────────────────────
// Intrinsic factual details — contribute bonus points to depth but are
// NOT required for a high score. These are cherry-on-top signals.
const FORMAL_DEPTH_PATTERNS = [
  { pattern: /founded\s+in\s+\d{4}/i,                      label: 'founding year',              bonus: 7 },
  { pattern: /\b(19|20)\d{2}\b/,                            label: 'year reference',             bonus: 3 },
  { pattern: /headquartered\s+in|based\s+in|located\s+in/i, label: 'location',                  bonus: 5 },
  { pattern: /\$[\d.,]+\s*(million|billion|M|B)\b/i,        label: 'financial figure',           bonus: 8 },
  { pattern: /\b[\d.,]+\s*(million|billion)\s+users?\b/i,   label: 'user count',                 bonus: 8 },
  { pattern: /CEO|CTO|CFO|founder|co-founder/i,             label: 'executive reference',        bonus: 6 },
  { pattern: /series\s+[A-Z]|ipo|vc\s+funding|venture/i,   label: 'funding reference',          bonus: 7 },
  { pattern: /revenue|profit|valuation|market\s+cap/i,      label: 'financial metrics',          bonus: 8 },
  { pattern: /acquired\s+by|acquisition|merger/i,           label: 'M&A reference',              bonus: 6 },
  { pattern: /publicly\s+traded|nasdaq|nyse|stock/i,        label: 'public company reference',   bonus: 7 },
  { pattern: /\d+\s+employees?|staff\s+of\s+\d+/i,         label: 'employee count',             bonus: 6 },
  { pattern: /award|accolade|ranking|recognised as/i,       label: 'award reference',            bonus: 4 },
  { pattern: /partnership|partner\s+with/i,                 label: 'partnership detail',         bonus: 4 }
];

// ─── CONFIDENCE LANGUAGE SIGNALS ─────────────────────────────────────────────
const HIGH_CONFIDENCE_LANGUAGE = [
  'is known',
  'is a leading',
  'is one of the',
  'is widely',
  'is recognised',
  'is recognized',
  'has been',
  'operates as',
  'serves',
  'reported',
  'according to',
  'specifically',
  'notably',
  'in particular',
  'is used by',
  'is popular',
  'is trusted',
  'is recommended'
];

const LOW_CONFIDENCE_LANGUAGE = [
  'i think',
  'i believe',
  'i assume',
  'if i recall',
  'not entirely',
  'might be',
  'could be',
  'possibly',
  'perhaps',
  'uncertain',
  'unsure',
  'unclear',
  'limited information',
  'may have changed',
  'not fully',
  'approximate'
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function clamp(value, min = 0, max = 100) {
  return Math.round(Math.min(Math.max(value, min), max));
}

function countSignals(text, signals) {
  if (!text) return 0;
  const lower = text.toLowerCase();
  return signals.reduce((count, signal) => {
    return lower.includes(signal.toLowerCase()) ? count + 1 : count;
  }, 0);
}

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

// ─── RECOGNITION SCORER ───────────────────────────────────────────────────────

/**
 * Score RECOGNITION (0–100).
 *
 * Recognition measures whether the AI knows the brand exists and has
 * any meaningful model of it. Both informal and formal knowledge count.
 *
 * A brand is well-recognised if the AI:
 *   — knows what category it belongs to (informal)
 *   — knows what it does at a functional level (informal)
 *   — knows who uses it (informal)
 *   — can state facts about it (formal — bonus only)
 *
 * A brand is NOT recognised if the AI explicitly states ignorance.
 *
 * Scoring:
 *   Base:                           40 points
 *   Informal recognition signals:   up to +45 points  (primary)
 *   Formal recognition signals:     up to +15 points  (bonus)
 *   Partial/hedging penalty:        up to -15 points
 *   Negative signals:               up to -50 points (or hard cap)
 *   Explicit YES in section 1:      +10 bonus
 *   Explicit PARTIALLY:             capped at 65
 *   Explicit NO:                    hard cap at 12
 */
function scoreRecognition(primaryText) {
  if (!primaryText || primaryText.trim().length < 10) return 0;

  const text = primaryText.toLowerCase();

  // Extract section 1 (RECOGNITION) if present
  const section1Match = primaryText.match(
    /1[\.\)]\s*RECOGNITION[:\s]+(.*?)(?=2[\.\)]|\n\n|$)/is
  );
  const section1Text = (section1Match ? section1Match[1] : primaryText.slice(0, 400)).toLowerCase();

  // Hard cap: explicit no-knowledge statement
  const negativeCount = countSignals(text, RECOGNITION_NEGATIVE_SIGNALS);
  if (negativeCount >= 3) return clamp(3 + negativeCount, 0, 12);
  if (negativeCount >= 2) return clamp(14, 0, 18);

  let score = 40;

  // Informal recognition is the primary positive driver
  const informalCount = countSignals(text, INFORMAL_RECOGNITION_SIGNALS);
  score += Math.min(informalCount * 1.5, 45);

  // Formal recognition is a bonus on top — not required
  const formalCount = countSignals(text, FORMAL_RECOGNITION_SIGNALS);
  score += Math.min(formalCount * 2, 15);

  // Hedging language reduces score — the AI is uncertain
  const partialCount = countSignals(text, RECOGNITION_PARTIAL_SIGNALS);
  score -= Math.min(partialCount * 3, 15);

  // Each negative signal reduces score
  score -= negativeCount * 12;

  // Section 1 explicit YES bonus
  if (/\byes\b/i.test(section1Text) && !/\bno\b/i.test(section1Text.slice(0, 15))) {
    score += 10;
  }

  // Section 1 explicit PARTIALLY — cap
  if (/\bpartially\b/i.test(section1Text)) {
    score = Math.min(score, 65);
  }

  // Section 1 explicit NO — hard cap
  if (
    /^\s*no[\s.,]/i.test(section1Text) ||
    /does not recognise|does not recognize|not recognise/i.test(section1Text)
  ) {
    return clamp(Math.min(score, 12), 0, 15);
  }

  // Floor: if any informal signals found, score cannot be below 25
  if (informalCount > 2 && score < 25) score = 25;

  return clamp(score);
}

// ─── DEPTH SCORER ────────────────────────────────────────────────────────────

/**
 * Score DEPTH (0–100).
 *
 * Depth measures how much the AI knows about the brand — breadth of
 * knowledge across both informal dimensions (use cases, audience, workflows,
 * competitive landscape, community) AND formal dimensions (founding facts,
 * financial data, executives).
 *
 * CRITICAL DESIGN PRINCIPLE: informal depth and formal depth are treated
 * as two independent contributors. A brand can score very high on depth
 * through informal knowledge alone. Formal knowledge adds bonus points
 * on top — it does NOT penalise its absence.
 *
 * Scoring:
 *   Informal depth patterns:   up to 45 points  (primary)
 *   Word count (meaningful):   up to 20 points
 *   Topics known breadth:      up to 15 points
 *   Formal depth patterns:     up to 20 points  (bonus only)
 *   Section completeness:      up to 5 points
 *   Total claims bonus:        up to 5 points
 */
function scoreDepth(primaryText, accurateClaims, conflictingClaims, unverifiableClaims, topicsKnown) {
  if (!primaryText || primaryText.trim().length < 10) return 0;

  let score = 0;

  // ── Informal depth: use cases, audience, comparisons, recommendations ──
  // This is the PRIMARY depth driver — not intrinsic facts
  let informalBonus = 0;
  for (const item of INFORMAL_DEPTH_PATTERNS) {
    if (item.pattern.test(primaryText)) {
      informalBonus += item.bonus;
    }
  }
  score += Math.min(informalBonus, 45);

  // ── Word count: more meaningful content = more depth ──
  const wordCount = countMeaningfulWords(primaryText);
  // 0 words=0, 80 words=10, 200 words=18, 350+ words=20
  const wordScore = Math.min((wordCount / 350) * 20, 20);
  score += wordScore;

  // ── Topics known breadth ──
  // Each topic the model explicitly claims to know about is +3 points
  const topicCount = Array.isArray(topicsKnown) ? topicsKnown.length : 0;
  score += Math.min(topicCount * 3, 15);

  // ── Formal depth: intrinsic facts are a bonus — never penalised for absence ──
  let formalBonus = 0;
  for (const item of FORMAL_DEPTH_PATTERNS) {
    if (item.pattern.test(primaryText)) {
      formalBonus += item.bonus;
    }
  }
  score += Math.min(formalBonus, 20);

  // ── Section completeness ──
  const sectionCount = (primaryText.match(
    /[1-6][\.\)]\s*(RECOGNITION|DESCRIPTION|REPUTATION|DETAILS|CONFIDENCE|GAPS)/gi
  ) || []).length;
  if (sectionCount >= 5) score += 5;
  else if (sectionCount >= 3) score += 2;

  // ── Total claims bonus ──
  const totalClaims = (accurateClaims || 0) + (conflictingClaims || 0) + (unverifiableClaims || 0);
  score += Math.min((totalClaims / 12) * 5, 5);

  return clamp(score);
}

// ─── ACCURACY SCORER ──────────────────────────────────────────────────────────

/**
 * Score ACCURACY (0–100).
 *
 * Accuracy reflects how factually reliable the response appears to be.
 * Since we cannot verify claims against ground truth, this is inferred from:
 *   1. The ratio of accurate to conflicting claims (from verification turn)
 *   2. The linguistic confidence of the language used
 *   3. The model's own self-reported confidence (section 5)
 *
 * A brand that the AI describes informally but correctly (right category,
 * right audience, right use case) scores high on accuracy even with zero
 * formal facts. Conversely, a response full of hedging and conflicting claims
 * scores low on accuracy regardless of how much it says.
 */
function scoreAccuracy(primaryText, accurateClaims, conflictingClaims, unverifiableClaims, rawConfidenceScore) {
  if (!primaryText || primaryText.trim().length < 10) return 0;

  let score = 0;

  // ── Claim ratio component (0–50 points) ──
  const totalClaims = (accurateClaims || 0) + (conflictingClaims || 0) + (unverifiableClaims || 0);

  if (totalClaims > 0) {
    const positiveWeight    = (accurateClaims || 0) / totalClaims;
    const conflictPenalty   = ((conflictingClaims || 0) * 2) / (totalClaims + 1);
    const unverifiablePenalty = (unverifiableClaims || 0) / (totalClaims * 2 + 1);
    const claimRatio = Math.max(0, positiveWeight - conflictPenalty - unverifiablePenalty);
    score += claimRatio * 50;
  } else {
    // No verification data returned — apply a neutral baseline
    // This is common for lesser-known brands where the model returns fewer claims
    score += 22;
  }

  // ── Linguistic confidence (0–25 points) ──
  const highCount = countSignals(primaryText, HIGH_CONFIDENCE_LANGUAGE);
  const lowCount  = countSignals(primaryText, LOW_CONFIDENCE_LANGUAGE);
  const linguisticNet = Math.min(highCount * 3, 15) - Math.min(lowCount * 2, 10);
  score += Math.min(Math.max(linguisticNet + 10, 0), 25);

  // ── Self-reported confidence (0–25 points) ──
  const selfScore = Math.min(Math.max(rawConfidenceScore || 5, 1), 10);
  score += ((selfScore - 1) / 9) * 25;

  // ── Cap if model expressed strong ignorance ──
  const negativeCount = countSignals(primaryText.toLowerCase(), RECOGNITION_NEGATIVE_SIGNALS);
  if (negativeCount >= 2) score = Math.min(score, 20);

  return clamp(score);
}

// ─── CONFIDENCE SCORER ────────────────────────────────────────────────────────

/**
 * Score CONFIDENCE (0–100).
 *
 * Confidence measures how assertively the AI speaks about the brand.
 * A highly confident response makes declarative statements without
 * constant hedging. A low-confidence response is full of "I think",
 * "possibly", "I'm not sure".
 *
 * Note: confidence is distinct from accuracy. An AI can be confidently
 * wrong (high confidence, low accuracy) or accurately uncertain
 * (low confidence, high accuracy). Both are valid and scored separately.
 */
function scoreConfidence(primaryText, rawConfidenceScore) {
  if (!primaryText || primaryText.trim().length < 10) return 0;

  let score = 0;

  // ── Self-reported confidence (1–10 → 0–55) ──
  const selfScore = Math.min(Math.max(rawConfidenceScore || 5, 1), 10);
  score += ((selfScore - 1) / 9) * 55;

  // ── Linguistic markers (0–30) ──
  const highCount = countSignals(primaryText, HIGH_CONFIDENCE_LANGUAGE);
  const lowCount  = countSignals(primaryText, LOW_CONFIDENCE_LANGUAGE);
  const linguisticScore = Math.min(highCount * 3, 20) - Math.min(lowCount * 2, 15);
  score += Math.min(Math.max(linguisticScore + 12, 0), 30);

  // ── No negative signals = confidence bonus (+15) ──
  const negativeCount = countSignals(primaryText.toLowerCase(), RECOGNITION_NEGATIVE_SIGNALS);
  if (negativeCount === 0)      score += 15;
  else if (negativeCount === 1) score += 5;
  else                          score -= negativeCount * 8;

  return clamp(score);
}

// ─── OVERALL SCORE ────────────────────────────────────────────────────────────

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
 * Classify an overall score into a named awareness tier.
 * Tiers match exactly what the frontend renders.
 * Each tier includes a plain-language description for display.
 */
function classifyTier(score) {
  if (score >= 91) return {
    tier: 'WELL KNOWN',
    tierClass: 'tier-well-known',
    description: 'Strong, detailed awareness across tested AI engines. The AI ecosystem has a rich, accurate model of this brand. Focus on maintaining currency rather than building.'
  };
  if (score >= 76) return {
    tier: 'KNOWN',
    tierClass: 'tier-known',
    description: 'Solid AI awareness with some depth or consistency gaps. The brand is clearly recognised and described but certain dimensions could be strengthened.'
  };
  if (score >= 51) return {
    tier: 'PARTIALLY KNOWN',
    tierClass: 'tier-partial',
    description: 'Present but limited AI awareness. The brand registers in AI systems but descriptions are thin, hedged, or inconsistent. Targeted content and signal work is recommended.'
  };
  if (score >= 26) return {
    tier: 'MINIMALLY KNOWN',
    tierClass: 'tier-partial',
    description: 'Fragile AI awareness. The brand barely surfaces in AI responses. Foundational brand signal work is needed before consistency or depth can be built.'
  };
  return {
    tier: 'NOT KNOWN',
    tierClass: 'tier-unknown',
    description: 'No meaningful AI awareness detected. The brand has no footprint in AI training data, or its footprint is too small to reliably surface. Immediate and comprehensive brand signal work is required.'
  };
}

// ─── MAIN EXPORT: scoreAllEngines ────────────────────────────────────────────

/**
 * Score every engine result and produce the complete scored output.
 * This is the only function called by the handler.
 */
function scoreAllEngines(engineResults) {
  const scoredEngines = {};
  const engineScores  = [];

  for (const [engine, result] of Object.entries(engineResults)) {

    // Engine failed — zero-scored failed entry
    if (result.error && (!result.primaryText || result.primaryText.trim().length < 20)) {
      scoredEngines[engine] = {
        score: 0, recognition: 0, depth: 0, accuracy: 0, confidence: 0,
        narrative: result.error
          ? `This engine could not be reached: ${result.error}`
          : 'No response received from this engine.',
        accurateClaims: 0, conflictingClaims: 0, unverifiableClaims: 0,
        topicsKnown: [], topicsUnknown: [],
        primaryText: '', failed: true, error: result.error || 'No response'
      };
      logger.warn(`Scoring: engine ${engine} marked as failed — ${result.error}`);
      continue;
    }

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
    const engineScore = scoreOverall(recognition, depth, accuracy, confidence);

    logger.info(
      `Scoring [${engine}]: recognition=${recognition} depth=${depth} ` +
      `accuracy=${accuracy} confidence=${confidence} → overall=${engineScore}`
    );

    scoredEngines[engine] = {
      score: engineScore,
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
      primaryText:        result.primaryText        || '',
      failed:             false,
      error:              result.error || null
    };

    if (!result.error) engineScores.push(engineScore);
  }

  // Overall = mean of all successful engine scores
  let overallScore = 0;
  if (engineScores.length > 0) {
    overallScore = clamp(Math.round(
      engineScores.reduce((a, b) => a + b, 0) / engineScores.length
    ));
  }

  const { tier, tierClass, description: tierDescription } = classifyTier(overallScore);

  logger.info(
    `Scoring complete — ${Object.keys(scoredEngines).length} engines scored. ` +
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
