'use strict';

const logger                 = require('../utils/logger');
const { queryAllEngines }    = require('../ai/awareness/queryEngine');
const { scoreAllEngines }    = require('../ai/awareness/scorer');
const { analyseConsistency } = require('../ai/awareness/consistency');
const { identifyNarrativeGaps }   = require('../ai/awareness/gaps');
const { generateRecommendations } = require('../ai/awareness/recommendations');
const {
  getCachedAwarenessScan,
  insertAwarenessScan
}                            = require('../db/awarenessScans');

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const VALID_ENGINES = ['meta', 'google', 'mistral', 'chatgpt', 'claude', 'gemma'];
const MIN_ENGINES   = 1;
const MAX_ENGINES   = 6;

// ─── ENGINE DISPLAY NAMES ─────────────────────────────────────────────────────
const ENGINE_DISPLAY_NAMES = {
  meta:    'Meta AI',
  google:  'Google AI',
  mistral: 'Mistral',
  chatgpt: 'ChatGPT',
  claude:  'Claude',
  gemma:   'Gemma'
};

// ─── FRONTEND KEY MAP ─────────────────────────────────────────────────────────
// Maps internal engine keys to the keys the frontend renderResults() expects.
const FRONTEND_KEY_MAP = {
  meta:    'metaAI',
  google:  'googleAI',
  mistral: 'mistral',
  chatgpt: 'chatgpt',
  claude:  'claude',
  gemma:   'gemma'
};

// ─── ERROR SANITISER ──────────────────────────────────────────────────────────
/**
 * Sanitise a raw API error message into a clean, user-facing string.
 *
 * FIX FOR A1 + B1:
 * Raw API error strings from Google, Groq, OpenAI, and Anthropic contain
 * internal metric names, quota URLs, retry timers, and technical strings
 * that must never be shown to end users. This function detects the error
 * type and returns a clean, actionable message instead.
 *
 * Called on every engine result before the response leaves the handler.
 * Applied to both the error field and the narrative field when the
 * narrative contains a raw error string.
 *
 * @param {string} rawError - the raw error string from the API
 * @param {string} engineLabel - human-readable engine name for context
 * @returns {string} clean user-facing error message
 */
function sanitiseErrorMessage(rawError, engineLabel) {
  if (!rawError || typeof rawError !== 'string') {
    return `${engineLabel} is temporarily unavailable`;
  }

  const err = rawError.toLowerCase();

  // ── Google / Gemini quota errors ──
  if (
    err.includes('quota exceeded') ||
    err.includes('free_tier') ||
    err.includes('generativelanguage.googleapis.com') ||
    err.includes('rate-limits') ||
    err.includes('generate_content') ||
    err.includes('billing') ||
    err.includes('plan and billing')
  ) {
    return `${engineLabel} is temporarily unavailable — usage limit reached. Results from other engines are unaffected.`;
  }

  // ── Groq rate limit / quota ──
  if (
    err.includes('rate_limit_exceeded') ||
    err.includes('rate limit') ||
    err.includes('too many requests') ||
    err.includes('x-ratelimit')
  ) {
    return `${engineLabel} is temporarily rate-limited. Results from other engines are unaffected.`;
  }

  // ── Authentication errors ──
  if (
    err.includes('invalid api key') ||
    err.includes('invalid_api_key') ||
    err.includes('unauthorized') ||
    err.includes('401') ||
    err.includes('authentication') ||
    err.includes('api key') ||
    err.includes('expired')
  ) {
    return `${engineLabel} API key is invalid or expired. Please check your key in Settings.`;
  }

  // ── Model not found / deprecated ──
  if (
    err.includes('model not found') ||
    err.includes('model_not_found') ||
    err.includes('no such model') ||
    err.includes('deprecated') ||
    err.includes('decommissioned') ||
    err.includes('does not exist')
  ) {
    return `${engineLabel} model is currently unavailable. The system will automatically retry with an alternative model.`;
  }

  // ── Timeout ──
  if (
    err.includes('timeout') ||
    err.includes('timed out') ||
    err.includes('aborted') ||
    err.includes('abort')
  ) {
    return `${engineLabel} took too long to respond. Results from other engines are unaffected.`;
  }

  // ── Network / connection errors ──
  if (
    err.includes('fetch') ||
    err.includes('network') ||
    err.includes('econnrefused') ||
    err.includes('enotfound') ||
    err.includes('socket') ||
    err.includes('connect')
  ) {
    return `${engineLabel} could not be reached due to a network issue. Results from other engines are unaffected.`;
  }

  // ── OpenAI-specific ──
  if (
    err.includes('insufficient_quota') ||
    err.includes('billing_hard_limit') ||
    err.includes('openai')
  ) {
    return `${engineLabel} quota exceeded on your API key. Check your OpenAI billing dashboard.`;
  }

  // ── Anthropic-specific ──
  if (
    err.includes('anthropic') ||
    err.includes('overloaded') ||
    err.includes('529')
  ) {
    return `${engineLabel} is currently overloaded. Results from other engines are unaffected.`;
  }

  // ── Generic fallback — never expose raw error ──
  // Log the raw error server-side for debugging but return clean message
  logger.warn(`[sanitiseError] Unclassified error for ${engineLabel}: ${rawError.slice(0, 200)}`);
  return `${engineLabel} is temporarily unavailable. Results from other engines are unaffected.`;
}

/**
 * Check whether a narrative string contains a raw API error message.
 * Used to detect when an error slipped through into the narrative field.
 *
 * @param {string} narrative
 * @returns {boolean}
 */
function narrativeContainsRawError(narrative) {
  if (!narrative) return false;
  const n = narrative.toLowerCase();
  return (
    n.includes('generativelanguage.googleapis.com') ||
    n.includes('quota exceeded for metric') ||
    n.includes('generate_content_free_tier') ||
    n.includes('please retry in') ||
    n.includes('x-ratelimit') ||
    n.includes('insufficient_quota') ||
    n.includes('billing_hard_limit') ||
    n.includes('https://ai.google.dev') ||
    n.includes('https://ai.dev/rate-limit')
  );
}

// ─── DOMAIN NORMALISER ────────────────────────────────────────────────────────

function normaliseDomain(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';

  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, '').toLowerCase().trim();
  } catch {
    return rawUrl
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/.*$/, '')
      .toLowerCase()
      .trim();
  }
}

// ─── REQUEST VALIDATOR ────────────────────────────────────────────────────────
/**
 * Validate and sanitise the incoming request body.
 *
 * FIX FOR A8 + A9:
 * Now extracts keys.gemini and keys.groq from the payload in addition
 * to keys.openai and keys.anthropic. All four user-supplied keys are
 * sanitised and passed through to queryAllEngines().
 *
 * @param {object} body
 * @returns {{ valid: boolean, error?: string, domain?: string,
 *             engines?: string[], keys?: object }}
 */
function validateRequest(body) {
  const { url, engines, keys } = body || {};

  // ── url ──
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    return { valid: false, error: 'url is required and must be a non-empty string' };
  }

  const domain = normaliseDomain(url);
  if (!domain || domain.length < 3 || !domain.includes('.')) {
    return { valid: false, error: `Could not extract a valid domain from: ${url}` };
  }

  // ── engines ──
  if (!engines || !Array.isArray(engines) || engines.length === 0) {
    return { valid: false, error: 'engines must be a non-empty array' };
  }

  const validRequested = engines
    .filter(e => typeof e === 'string')
    .map(e => e.toLowerCase().trim())
    .filter(e => VALID_ENGINES.includes(e));

  const uniqueEngines = [...new Set(validRequested)];

  if (uniqueEngines.length < MIN_ENGINES) {
    return {
      valid: false,
      error: `At least ${MIN_ENGINES} valid engine must be specified. Valid options: ${VALID_ENGINES.join(', ')}`
    };
  }

  if (uniqueEngines.length > MAX_ENGINES) {
    return { valid: false, error: `Maximum ${MAX_ENGINES} engines per request` };
  }

  // ── keys — ALL FOUR USER-SUPPLIED KEY TYPES ──
  // A8 fix: extract keys.gemini
  // A9 fix: extract keys.groq
  const sanitisedKeys = {
    openai:    (keys?.openai    && typeof keys.openai    === 'string' && keys.openai.trim().length > 10)
                 ? keys.openai.trim()    : null,
    anthropic: (keys?.anthropic && typeof keys.anthropic === 'string' && keys.anthropic.trim().length > 10)
                 ? keys.anthropic.trim() : null,
    gemini:    (keys?.gemini    && typeof keys.gemini    === 'string' && keys.gemini.trim().length > 10)
                 ? keys.gemini.trim()    : null,
    groq:      (keys?.groq      && typeof keys.groq      === 'string' && keys.groq.trim().length > 10)
                 ? keys.groq.trim()      : null
  };

  // ── Drop paid/key-required engines if no key provided ──
  const finalEngines = uniqueEngines.filter(engine => {
    if (engine === 'chatgpt' && !sanitisedKeys.openai) {
      logger.warn('ChatGPT engine requested but no OpenAI key provided — skipping');
      return false;
    }
    if (engine === 'claude' && !sanitisedKeys.anthropic) {
      logger.warn('Claude engine requested but no Anthropic key provided — skipping');
      return false;
    }
    return true;
  });

  if (finalEngines.length < MIN_ENGINES) {
    return {
      valid: false,
      error: 'No engines could be queried — paid engines require API keys and no free engines were selected'
    };
  }

  return { valid: true, domain, engines: finalEngines, keys: sanitisedKeys };
}

// ─── ENGINE RESPONSE PAYLOAD BUILDER ─────────────────────────────────────────
/**
 * Build the per-engine response object in the exact shape
 * the frontend renderResults() function expects.
 *
 * Applies sanitiseErrorMessage() to both the error field and
 * the narrative field — ensuring raw API errors never reach
 * the frontend regardless of where they originated in the pipeline.
 *
 * @param {string} engineKey
 * @param {object} scoredData
 * @returns {{ frontendKey: string, payload: object }}
 */
function buildEngineResponsePayload(engineKey, scoredData) {
  const frontendKey  = FRONTEND_KEY_MAP[engineKey] || engineKey;
  const displayName  = ENGINE_DISPLAY_NAMES[engineKey] || engineKey;

  // ── Sanitise error field ──
  const cleanError = scoredData.error
    ? sanitiseErrorMessage(scoredData.error, displayName)
    : null;

  // ── Sanitise narrative field ──
  // If the narrative somehow contains a raw API error string,
  // replace it with the clean sanitised message
  let cleanNarrative = scoredData.narrative || 'No response available for this engine.';
  if (narrativeContainsRawError(cleanNarrative)) {
    cleanNarrative = cleanError ||
      `${displayName} is temporarily unavailable. Results from other engines are unaffected.`;
    logger.warn(
      `[buildPayload] Raw error detected in narrative field for ${engineKey} — sanitised`
    );
  }

  const payload = {
    score:              scoredData.score              ?? 0,
    narrative:          cleanNarrative,
    recognition:        scoredData.recognition        ?? 0,
    depth:              scoredData.depth              ?? 0,
    accuracy:           scoredData.accuracy           ?? 0,
    confidence:         scoredData.confidence         ?? 0,
    accurateClaims:     scoredData.accurateClaims     ?? 0,
    conflictingClaims:  scoredData.conflictingClaims  ?? 0,
    unverifiableClaims: scoredData.unverifiableClaims ?? 0,
    topicsKnown:        scoredData.topicsKnown        || [],
    topicsUnknown:      scoredData.topicsUnknown      || [],
    sentiment:          scoredData.sentiment          || 'unknown',
    communityPresent:   scoredData.communityPresent   ?? false,
    recommended:        scoredData.recommended        || 'unclear',
    socialFootprint:    scoredData.socialFootprint    || 'unknown',
    viralitySignal:     scoredData.viralitySignal     ?? false,
    informalScore:      scoredData.informalScore      ?? 0,
    formalScore:        scoredData.formalScore        ?? 0,
    failed:             scoredData.failed             ?? false,
    error:              cleanError
  };

  return { frontendKey, payload };
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
/**
 * Handle POST /api/ai-awareness
 *
 * Pipeline:
 *  1. Validate request
 *  2. Normalise domain
 *  3. Check cache
 *  4. Query all engines in parallel
 *  5. Score all results
 *  6. Analyse consistency
 *  7. Identify narrative gaps
 *  8. Generate recommendations
 *  9. Assemble response — with full error sanitisation
 * 10. Persist to Supabase (fire and forget)
 * 11. Return response
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function aiAwarenessHandler(req, res) {
  const requestStart = Date.now();

  logger.info(`[aiAwareness] Request from ${req.ip || 'unknown'}`);

  // ── Step 1: Validate ──
  const validation = validateRequest(req.body);

  if (!validation.valid) {
    logger.warn(`[aiAwareness] Validation failed: ${validation.error}`);
    return res.status(400).json({ error: validation.error, success: false });
  }

  const { domain, engines, keys } = validation;

  logger.info(
    `[aiAwareness] Scan start — domain: ${domain} | engines: [${engines.join(', ')}]`
  );

  try {

    // ── Step 2: Check cache ──
    const cached = await getCachedAwarenessScan(domain);

    if (cached) {
      logger.info(`[aiAwareness] Cache HIT — ${domain}`);

      await insertAwarenessScan(domain, engines, cached.overallScore || 0, cached, true)
        .catch(err => logger.warn(`[aiAwareness] Cache record insert failed: ${err.message}`));

      return res.status(200).json({
        ...cached,
        cached:         true,
        domain,
        scanDurationMs: Date.now() - requestStart
      });
    }

    logger.info(`[aiAwareness] Cache MISS — running full scan for ${domain}`);

    // ── Step 3: Query all engines in parallel ──
    const engineResults = await queryAllEngines(domain, engines, keys);
    const queriedCount  = Object.keys(engineResults).length;

    logger.info(`[aiAwareness] Engine queries complete — ${queriedCount} results`);

    if (queriedCount === 0) {
      logger.error('[aiAwareness] All engines failed to return results');
      return res.status(502).json({
        error:   'All AI engines failed to respond. Please try again shortly.',
        success: false
      });
    }

    // ── Step 4: Score ──
    const {
      scoredEngines,
      overallScore,
      tier,
      tierClass,
      tierDescription
    } = scoreAllEngines(engineResults);

    logger.info(`[aiAwareness] Scoring complete — overall: ${overallScore} | tier: ${tier}`);

    // ── Step 5: Consistency ──
    const consistencyResult = analyseConsistency(scoredEngines);

    logger.info(
      `[aiAwareness] Consistency: ${consistencyResult.score} | ${consistencyResult.label}`
    );

    // ── Step 6: Gaps ──
    const narrativeGaps = identifyNarrativeGaps(
      scoredEngines,
      consistencyResult,
      overallScore
    );

    logger.info(
      `[aiAwareness] Gaps: ${narrativeGaps.length} ` +
      `(${narrativeGaps.filter(g => g.severity === 'critical').length} critical)`
    );

    // ── Step 7: Recommendations ──
    const recommendations = generateRecommendations(
      scoredEngines,
      consistencyResult,
      narrativeGaps,
      overallScore,
      tier,
      domain
    );

    logger.info(`[aiAwareness] Recommendations: ${recommendations.length}`);

    // ── Step 8: Assemble engine payloads with full error sanitisation ──
    const enginePayloads = {};

    for (const [engineKey, scoredData] of Object.entries(scoredEngines)) {
      const { frontendKey, payload } = buildEngineResponsePayload(engineKey, scoredData);
      enginePayloads[frontendKey] = payload;
    }

    // ── Step 9: Assemble complete response ──
    const scanDurationMs = Date.now() - requestStart;

    const responseBody = {
      success:     true,
      cached:      false,
      domain,

      // Engine metadata array — used by frontend for dynamic rendering
      // and for pulling current model names from the backend
      engines: engines.map(e => ({
        key:         e,
        frontendKey: FRONTEND_KEY_MAP[e] || e,
        displayName: ENGINE_DISPLAY_NAMES[e] || e,
        queried:     true,
        failed:      scoredEngines[e]?.failed ?? false
      })),

      overallScore,
      tier,
      tierClass,
      tierDescription,

      // Per-engine results — keyed by frontend key (metaAI, googleAI, etc.)
      ...enginePayloads,

      // Cross-engine analysis
      consistency: {
        score:           consistencyResult.score,
        label:           consistencyResult.label,
        agreed:          consistencyResult.agreed,
        conflicted:      consistencyResult.conflicted,
        exclusive:       consistencyResult.exclusive,
        engineCount:     consistencyResult.engineCount,
        dimensionScores: consistencyResult.dimensionScores
      },

      narrativeGaps,
      recommendations,

      scanDurationMs,
      scannedAt: new Date().toISOString()
    };

    // ── Step 10: Persist — fire and forget ──
    insertAwarenessScan(
      domain,
      engines,
      overallScore,
      responseBody,
      false
    ).catch(err => {
      logger.warn(`[aiAwareness] Background DB insert failed: ${err.message}`);
    });

    // ── Step 11: Return ──
    logger.info(
      `[aiAwareness] Complete — domain: ${domain} | score: ${overallScore} | ` +
      `tier: ${tier} | duration: ${scanDurationMs}ms`
    );

    return res.status(200).json(responseBody);

  } catch (err) {
    const scanDurationMs = Date.now() - requestStart;

    logger.error(
      `[aiAwareness] Unhandled error for ${domain}: ${err.message} | stack: ${err.stack}`
    );

    return res.status(500).json({
      success:        false,
      error:          'An internal error occurred while processing the awareness scan. Please try again.',
      domain,
      scanDurationMs,
      overallScore:   0,
      narrativeGaps:  [],
      recommendations: [],
      consistency: {
        score:      0,
        label:      'ANALYSIS FAILED',
        agreed:     [],
        conflicted: [],
        exclusive:  []
      }
    });
  }
}

module.exports = aiAwarenessHandler;
