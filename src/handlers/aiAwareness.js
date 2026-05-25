'use strict';

const logger                 = require('../utils/logger');
const { queryAllEngines }    = require('../ai/awareness/queryEngine');
const { scoreAllEngines }    = require('../ai/awareness/scorer');
const { analyseConsistency } = require('../ai/awareness/consistency');
const { identifyNarrativeGaps }      = require('../ai/awareness/gaps');
const { generateRecommendations }    = require('../ai/awareness/recommendations');
const {
  getCachedAwarenessScan,
  insertAwarenessScan
}                            = require('../db/awarenessScans');

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

// Valid engine keys the frontend can request.
// Any engine not in this list is silently dropped before querying.
const VALID_ENGINES = ['meta', 'google', 'mistral', 'chatgpt', 'claude'];

// Minimum engines required to run a scan.
const MIN_ENGINES = 1;

// Maximum engines per request — prevents abuse on the free tier.
const MAX_ENGINES = 5;

// ─── DOMAIN NORMALISER ────────────────────────────────────────────────────────
/**
 * Extract and normalise a domain string from any URL or domain input.
 * Strips protocol, www, trailing slashes, and query strings.
 * Lowercases the result.
 *
 * Examples:
 *   https://www.stripe.com/payments → stripe.com
 *   HTTP://Notion.so               → notion.so
 *   aicitationscan.com/            → aicitationscan.com
 *
 * @param {string} rawUrl
 * @returns {string} normalised domain e.g. "stripe.com"
 */
function normaliseDomain(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';

  let url = rawUrl.trim();

  // Add protocol if missing so URL parsing works correctly
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  try {
    const parsed = new URL(url);
    // Remove www. prefix — we want the root domain only
    return parsed.hostname
      .replace(/^www\./i, '')
      .toLowerCase()
      .trim();
  } catch {
    // URL parsing failed — fall back to manual stripping
    return rawUrl
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/.*$/, '')
      .toLowerCase()
      .trim();
  }
}

// ─── ENGINE MAP ───────────────────────────────────────────────────────────────
/**
 * Map engine keys to their display names.
 * Used in the response to give the frontend human-readable engine labels.
 */
const ENGINE_DISPLAY_NAMES = {
  meta:    'Meta AI',
  google:  'Google AI',
  mistral: 'Mistral',
  chatgpt: 'ChatGPT',
  claude:  'Claude'
};

// ─── RESPONSE SHAPE BUILDER ───────────────────────────────────────────────────
/**
 * Build the per-engine response object in the exact shape the frontend
 * renderResults() function expects.
 *
 * Frontend expects for each engine key (metaAI, googleAI, mistral, chatgpt, claude):
 * {
 *   score:              number,
 *   narrative:          string,
 *   recognition:        number,
 *   depth:              number,
 *   accuracy:           number,
 *   confidence:         number,
 *   accurateClaims:     number,
 *   conflictingClaims:  number,
 *   unverifiableClaims: number,
 *   topicsKnown:        string[],
 *   topicsUnknown:      string[],
 *   // Extended informal/social signals — used by enhanced frontend display
 *   sentiment:          string,
 *   communityPresent:   boolean,
 *   recommended:        string,
 *   socialFootprint:    string,
 *   viralitySignal:     boolean,
 *   informalScore:      number,
 *   formalScore:        number,
 *   failed:             boolean,
 *   error:              string|null
 * }
 *
 * The frontend uses engine keys: metaAI, googleAI, mistral, chatgpt, claude.
 * Our internal engine keys are: meta, google, mistral, chatgpt, claude.
 * This function handles the meta→metaAI and google→googleAI remapping.
 *
 * @param {string} engineKey      - internal key e.g. 'meta'
 * @param {object} scoredData     - from scoreAllEngines().scoredEngines[engineKey]
 * @returns {{ frontendKey: string, payload: object }}
 */
function buildEngineResponsePayload(engineKey, scoredData) {
  // Map internal key to frontend key
  const frontendKeyMap = {
    meta:    'metaAI',
    google:  'googleAI',
    mistral: 'mistral',
    chatgpt: 'chatgpt',
    claude:  'claude'
  };

  const frontendKey = frontendKeyMap[engineKey] || engineKey;

  const payload = {
    score:              scoredData.score              ?? 0,
    narrative:          scoredData.narrative          || 'No response available for this engine.',
    recognition:        scoredData.recognition        ?? 0,
    depth:              scoredData.depth              ?? 0,
    accuracy:           scoredData.accuracy           ?? 0,
    confidence:         scoredData.confidence         ?? 0,
    accurateClaims:     scoredData.accurateClaims     ?? 0,
    conflictingClaims:  scoredData.conflictingClaims  ?? 0,
    unverifiableClaims: scoredData.unverifiableClaims ?? 0,
    topicsKnown:        scoredData.topicsKnown        || [],
    topicsUnknown:      scoredData.topicsUnknown      || [],
    // Informal/social signals — new dimensions from Files 2–3
    sentiment:          scoredData.sentiment          || 'unknown',
    communityPresent:   scoredData.communityPresent   ?? false,
    recommended:        scoredData.recommended        || 'unclear',
    socialFootprint:    scoredData.socialFootprint    || 'unknown',
    viralitySignal:     scoredData.viralitySignal     ?? false,
    informalScore:      scoredData.informalScore      ?? 0,
    formalScore:        scoredData.formalScore        ?? 0,
    failed:             scoredData.failed             ?? false,
    error:              scoredData.error              || null
  };

  return { frontendKey, payload };
}

// ─── REQUEST VALIDATOR ────────────────────────────────────────────────────────
/**
 * Validate the incoming request body for the /api/ai-awareness route.
 * Returns { valid: true, ... } on success or { valid: false, error: string }.
 *
 * Expected body shape:
 * {
 *   url:     string,                          // required
 *   engines: string[],                        // required, 1–5 items
 *   keys:    { openai?: string, anthropic?: string }  // optional
 * }
 *
 * @param {object} body - req.body
 * @returns {{ valid: boolean, error?: string, domain?: string, engines?: string[], keys?: object }}
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

  // Filter to valid engines only — silently drop invalid ones
  const validRequested = engines
    .filter(e => typeof e === 'string')
    .map(e => e.toLowerCase().trim())
    .filter(e => VALID_ENGINES.includes(e));

  // Remove duplicates
  const uniqueEngines = [...new Set(validRequested)];

  if (uniqueEngines.length < MIN_ENGINES) {
    return {
      valid: false,
      error: `At least ${MIN_ENGINES} valid engine must be specified. Valid options: ${VALID_ENGINES.join(', ')}`
    };
  }

  if (uniqueEngines.length > MAX_ENGINES) {
    return {
      valid: false,
      error: `Maximum ${MAX_ENGINES} engines per request`
    };
  }

  // ── keys ──
  // Keys are optional — only required if chatgpt or claude are in engines
  const sanitisedKeys = {
    openai:    (keys?.openai    && typeof keys.openai    === 'string') ? keys.openai.trim()    : null,
    anthropic: (keys?.anthropic && typeof keys.anthropic === 'string') ? keys.anthropic.trim() : null
  };

  // If chatgpt requested but no openai key — remove chatgpt from engines
  // rather than failing the entire request. Log a warning.
  const finalEngines = uniqueEngines.filter(engine => {
    if (engine === 'chatgpt' && !sanitisedKeys.openai) {
      logger.warn('ChatGPT engine requested but no OpenAI key provided — skipping ChatGPT');
      return false;
    }
    if (engine === 'claude' && !sanitisedKeys.anthropic) {
      logger.warn('Claude engine requested but no Anthropic key provided — skipping Claude');
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

  return {
    valid: true,
    domain,
    engines: finalEngines,
    keys: sanitisedKeys
  };
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
/**
 * Handle POST /api/ai-awareness
 *
 * Full pipeline:
 *   1. Validate request
 *   2. Normalise domain
 *   3. Check awareness scan cache (1-hour TTL)
 *   4. Query all requested AI engines in parallel
 *   5. Score all engine results across all dimensions
 *   6. Analyse cross-engine consistency
 *   7. Identify narrative gaps
 *   8. Generate prioritised recommendations
 *   9. Assemble complete response in frontend-expected shape
 *  10. Persist result to Supabase awareness_scans table
 *  11. Return response
 *
 * On any unhandled error the handler returns a 500 with a structured
 * error response rather than crashing — the frontend showApiError()
 * function handles this gracefully.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 */
async function aiAwarenessHandler(req, res) {
  const requestStart = Date.now();

  logger.info(`[aiAwareness] Incoming request from ${req.ip || 'unknown'}`);

  // ── Step 1: Validate ──
  const validation = validateRequest(req.body);

  if (!validation.valid) {
    logger.warn(`[aiAwareness] Validation failed: ${validation.error}`);
    return res.status(400).json({
      error:   validation.error,
      success: false
    });
  }

  const { domain, engines, keys } = validation;

  logger.info(
    `[aiAwareness] Scan start — domain: ${domain} | ` +
    `engines: [${engines.join(', ')}]`
  );

  try {

    // ── Step 2: Check cache ──
    // If a fresh result exists for this domain (within 1 hour), return it
    // immediately without querying any AI engines.
    const cached = await getCachedAwarenessScan(domain);

    if (cached) {
      logger.info(`[aiAwareness] Cache HIT for domain: ${domain} — returning cached result`);

      // Save a record that this was a cached replay
      await insertAwarenessScan(
        domain,
        engines,
        cached.overallScore || 0,
        cached,
        true // cached = true
      );

      return res.status(200).json({
        ...cached,
        cached: true,
        domain,
        scanDurationMs: Date.now() - requestStart
      });
    }

    logger.info(`[aiAwareness] Cache MISS for domain: ${domain} — running full scan`);

    // ── Step 3: Query all engines in parallel ──
    const engineResults = await queryAllEngines(domain, engines, keys);

    const queriedCount = Object.keys(engineResults).length;
    logger.info(
      `[aiAwareness] Engine queries complete — ${queriedCount} results received`
    );

    if (queriedCount === 0) {
      logger.error('[aiAwareness] All engines failed to return results');
      return res.status(502).json({
        error:   'All AI engines failed to respond. Please try again shortly.',
        success: false
      });
    }

    // ── Step 4: Score all engine results ──
    const {
      scoredEngines,
      overallScore,
      tier,
      tierClass,
      tierDescription
    } = scoreAllEngines(engineResults);

    logger.info(
      `[aiAwareness] Scoring complete — overall: ${overallScore} | tier: ${tier}`
    );

    // ── Step 5: Analyse cross-engine consistency ──
    const consistencyResult = analyseConsistency(scoredEngines);

    logger.info(
      `[aiAwareness] Consistency: ${consistencyResult.score} | ${consistencyResult.label}`
    );

    // ── Step 6: Identify narrative gaps ──
    const narrativeGaps = identifyNarrativeGaps(
      scoredEngines,
      consistencyResult,
      overallScore
    );

    logger.info(
      `[aiAwareness] Gaps identified: ${narrativeGaps.length} ` +
      `(${narrativeGaps.filter(g => g.severity === 'critical').length} critical)`
    );

    // ── Step 7: Generate recommendations ──
    const recommendations = generateRecommendations(
      scoredEngines,
      consistencyResult,
      narrativeGaps,
      overallScore,
      tier,
      domain
    );

    logger.info(
      `[aiAwareness] Recommendations generated: ${recommendations.length}`
    );

    // ── Step 8: Assemble engine response payloads ──
    // Map internal engine keys to frontend keys and build per-engine objects.
    // Engines not requested are not included in the response at all —
    // the frontend handles missing engine keys gracefully.
    const enginePayloads = {};

    for (const [engineKey, scoredData] of Object.entries(scoredEngines)) {
      const { frontendKey, payload } = buildEngineResponsePayload(engineKey, scoredData);
      enginePayloads[frontendKey] = payload;
    }

    // ── Step 9: Assemble the complete response ──
    // This shape must exactly match what the frontend renderResults() expects.
    const scanDurationMs = Date.now() - requestStart;

    const responseBody = {
      success:     true,
      cached:      false,
      domain,
      engines:     engines.map(e => ({
        key:         e,
        displayName: ENGINE_DISPLAY_NAMES[e] || e,
        queried:     true,
        failed:      scoredEngines[e]?.failed ?? false
      })),
      overallScore,
      tier,
      tierClass,
      tierDescription,

      // ── Per-engine results ──
      // Only include engines that were actually queried.
      // Frontend checks for key existence before rendering.
      ...enginePayloads,

      // ── Cross-engine analysis ──
      consistency: {
        score:          consistencyResult.score,
        label:          consistencyResult.label,
        agreed:         consistencyResult.agreed,
        conflicted:     consistencyResult.conflicted,
        exclusive:      consistencyResult.exclusive,
        engineCount:    consistencyResult.engineCount,
        dimensionScores: consistencyResult.dimensionScores
      },

      // ── Narrative gaps ──
      narrativeGaps,

      // ── Recommendations ──
      recommendations,

      // ── Metadata ──
      scanDurationMs,
      scannedAt: new Date().toISOString()
    };

    // ── Step 10: Persist to database ──
    // Fire-and-forget — a failed DB write must never delay or break the response.
    // insertAwarenessScan catches its own errors internally.
    insertAwarenessScan(
      domain,
      engines,
      overallScore,
      responseBody,
      false
    ).catch(err => {
      logger.warn(`[aiAwareness] Background DB insert failed: ${err.message}`);
    });

    // ── Step 11: Return response ──
    logger.info(
      `[aiAwareness] Scan complete — domain: ${domain} | ` +
      `score: ${overallScore} | tier: ${tier} | ` +
      `duration: ${scanDurationMs}ms`
    );

    return res.status(200).json(responseBody);

  } catch (err) {
    const scanDurationMs = Date.now() - requestStart;

    logger.error(
      `[aiAwareness] Unhandled error for domain ${domain}: ` +
      `${err.message} | stack: ${err.stack}`
    );

    return res.status(500).json({
      success:        false,
      error:          'An internal error occurred while processing the awareness scan. Please try again.',
      domain,
      scanDurationMs,
      // Include partial data if available — helps frontend degrade gracefully
      overallScore:   0,
      narrativeGaps:  [],
      recommendations: [],
      consistency: {
        score:       0,
        label:       'ANALYSIS FAILED',
        agreed:      [],
        conflicted:  [],
        exclusive:   []
      }
    });
  }
}

module.exports = aiAwarenessHandler;
