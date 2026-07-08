'use strict';

const logger = require('../../utils/logger');

// ─── API ENDPOINTS ────────────────────────────────────────────────────────────

const GROQ_API_URL        = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODELS_URL     = 'https://api.groq.com/openai/v1/models';
const GEMINI_BASE_URL     = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODELS_URL   = `${GEMINI_BASE_URL}/models`;
const OPENAI_API_URL      = 'https://api.openai.com/v1/chat/completions';
const CEREBRAS_API_URL    = 'https://api.cerebras.ai/v1/chat/completions';
const ANTHROPIC_URL       = 'https://api.anthropic.com/v1/messages';

// ─── MODEL PREFERENCE LISTS ───────────────────────────────────────────────────
// Ordered best-first. Auto-detection picks the first entry that the provider
// actually has live. If none match, the last entry is used as a hard fallback.

const GROQ_META_PREFERENCE = [
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'llama3-70b-8192',
  'llama-3.1-8b-instant',
  'llama3-8b-8192'
];

const GROQ_MISTRAL_PREFERENCE = [
  'llama-3.1-8b-instant',
  'llama3-8b-8192',
  'mixtral-8x7b-32768'
];

// NEW: Gemma preference list — Google Gemma 2 9B via Groq
// gemma2-9b-it is the primary model for the Gemma engine slot.
// Provides a distinct third model identity from Meta AI and Mistral.
const GROQ_GEMMA_PREFERENCE = [
  'gemma2-9b-it',          // Google Gemma 2 9B — primary
  'gemma-7b-it',           // older Gemma variant — fallback
  'llama-3.1-8b-instant'   // last resort if no Gemma model available
];

// FIX: gemini-2.0-flash and gemini-2.0-flash-lite permanently
// removed — confirmed shut down June 1, 2026 per Google's own docs.
// They can still appear in the live /models catalog during Google's
// shutdown grace period (which is what caused this bug — the old
// list had 2.0-flash FIRST, and the resolver picks the first live
// catalog match regardless of whether the model still functions).
// Current lineup ordered by quality-per-free-request, confirmed
// against Google's July 2026 free-tier documentation. Legacy 1.5/1.0
// entries kept only as absolute last-resort fallbacks in case a
// future catalog change removes all 2.5/3.x Flash variants at once.
const GEMINI_PREFERENCE = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3-flash',
  'gemini-3.1-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.0-pro'
];

// FIX: defensive exclusion set — belt-and-suspenders alongside the
// reordered list above. Even if a future preference-list edit
// accidentally reintroduces a dead model ID, or Google's catalog
// briefly lists a model whose real quota has already gone to zero,
// this hard-blocks selection so a known-dead model is never chosen,
// only ever skipped in favor of the next live candidate.
const GEMINI_DEPRECATED_MODELS = new Set([
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite-001'
]);

// Cerebras preference list — llama-3.3-70b-versatile first since it's
// the same quality as Groq 70B but on completely separate infrastructure
// so Groq quota exhaustion and Cerebras quota exhaustion can't happen
// simultaneously. gpt-oss-120b confirmed live on free tier June 2026.
const CEREBRAS_PREFERENCE = [
  'llama-3.3-70b',        // Primary — same model family as Meta AI engine
  'llama3.3-70b',          // alternate casing some Cerebras docs use
  'llama-3.1-70b',        // Fallback
  'gpt-oss-120b'          // Cerebras own model — confirmed free tier June 2026
];

// Static models — user-supplied keys, no auto-detect needed
const STATIC_MODELS = {
  chatgpt: 'gpt-4o',
  claude:  'claude-3-5-sonnet-20241022'
};

// ─── MODEL RESOLUTION CACHE ───────────────────────────────────────────────────
// Resolved once per process lifetime. Null = not yet resolved.
// NEW: gemma slot added alongside meta, mistral, google.

const _resolvedModels = {
  meta:     null,
  mistral:  null,
  google:   null,
  gemma:    null,
  cerebras: null
};

// ─── GROQ MODEL RESOLVER ──────────────────────────────────────────────────────

async function resolveGroqModel(preferenceList, groqKey, slotLabel) {
  try {
    const response = await fetch(GROQ_MODELS_URL, {
      method:  'GET',
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type':  'application/json'
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      logger.warn(`[ModelResolver/${slotLabel}] Models endpoint returned ${response.status} — using first preference`);
      return preferenceList[0];
    }

    const data = await response.json().catch(() => null);
    const liveIds = new Set(
      (data?.data || []).map(m => (m.id || '').toLowerCase())
    );

    logger.info(`[ModelResolver/${slotLabel}] ${liveIds.size} live Groq models found`);

    for (const candidate of preferenceList) {
      if (liveIds.has(candidate.toLowerCase())) {
        logger.info(`[ModelResolver/${slotLabel}] Selected: ${candidate}`);
        return candidate;
      }
    }

    logger.warn(
      `[ModelResolver/${slotLabel}] No preference matched live models. ` +
      `Falling back to: ${preferenceList[0]}. ` +
      `Live models: ${[...liveIds].slice(0, 10).join(', ')}`
    );
    return preferenceList[0];

  } catch (err) {
    logger.warn(`[ModelResolver/${slotLabel}] Resolution failed (${err.message}) — using: ${preferenceList[0]}`);
    return preferenceList[0];
  }
}

// ─── GEMINI MODEL RESOLVER ────────────────────────────────────────────────────

async function resolveGeminiModel(geminiKey) {
  try {
    const response = await fetch(`${GEMINI_MODELS_URL}?key=${geminiKey}`, {
      method:  'GET',
      headers: { 'Content-Type': 'application/json' },
      signal:  AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      logger.warn(`[ModelResolver/Google] Models endpoint returned ${response.status} — using first preference`);
      return GEMINI_PREFERENCE[0];
    }

    const data = await response.json().catch(() => null);

    // FIX: deprecated models filtered out of the live-catalog set
    // itself, not just skipped in the preference list — this is the
    // actual fix for the bug (Google's /models endpoint was still
    // listing gemini-2.0-flash as "live" during its shutdown grace
    // period, which is exactly why the old resolver kept selecting
    // a model that returned limit: 0 on every real request).
    const liveGenerateModels = new Set(
      (data?.models || [])
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => (m.name || '').replace('models/', '').toLowerCase())
        .filter(name => !GEMINI_DEPRECATED_MODELS.has(name))
    );

    logger.info(`[ModelResolver/Google] ${liveGenerateModels.size} Gemini generateContent models found`);

    for (const candidate of GEMINI_PREFERENCE) {
      if (liveGenerateModels.has(candidate.toLowerCase())) {
        logger.info(`[ModelResolver/Google] Selected: ${candidate}`);
        return candidate;
      }
    }

    logger.warn(
      `[ModelResolver/Google] No preference matched. Falling back to: ${GEMINI_PREFERENCE[0]}. ` +
      `Live: ${[...liveGenerateModels].slice(0, 8).join(', ')}`
    );
    return GEMINI_PREFERENCE[0];

  } catch (err) {
    logger.warn(`[ModelResolver/Google] Resolution failed (${err.message}) — using: ${GEMINI_PREFERENCE[0]}`);
    return GEMINI_PREFERENCE[0];
  }
}

// ─── LAZY RESOLVERS ───────────────────────────────────────────────────────────
// Called once before the first real query. Subsequent calls return cached value.

async function getMetaModel() {
  if (!_resolvedModels.meta) {
    const key = process.env.GROQ_API_KEY;
    _resolvedModels.meta = key
      ? await resolveGroqModel(GROQ_META_PREFERENCE, key, 'Meta AI')
      : GROQ_META_PREFERENCE[0];
  }
  return _resolvedModels.meta;
}

async function getMistralModel() {
  if (!_resolvedModels.mistral) {
    const key = process.env.GROQ_API_KEY;
    _resolvedModels.mistral = key
      ? await resolveGroqModel(GROQ_MISTRAL_PREFERENCE, key, 'Mistral')
      : GROQ_MISTRAL_PREFERENCE[0];
  }
  return _resolvedModels.mistral;
}

async function getGeminiModel() {
  if (!_resolvedModels.google) {
    const key = process.env.GEMINI_API_KEY;
    _resolvedModels.google = key
      ? await resolveGeminiModel(key)
      : GEMINI_PREFERENCE[0];
  }
  return _resolvedModels.google;
}

// NEW: Gemma lazy resolver
// Uses GROQ_GEMMA_PREFERENCE — gemma2-9b-it is the primary target.
// Resolution uses the server Groq key or user-supplied key if provided.
async function getGemmaModel(userGroqKey) {
  if (!_resolvedModels.gemma) {
    const key = userGroqKey || process.env.GROQ_API_KEY;
    _resolvedModels.gemma = key
      ? await resolveGroqModel(GROQ_GEMMA_PREFERENCE, key, 'Gemma')
      : GROQ_GEMMA_PREFERENCE[0];
  }
  return _resolvedModels.gemma;
}

// ─── CEREBRAS MODEL RESOLVER ──────────────────────────────────────────────────

async function resolveCerebrasModel(cerebrasKey) {
  try {
    const response = await fetch('https://api.cerebras.ai/v1/models', {
      method:  'GET',
      headers: {
        'Authorization': `Bearer ${cerebrasKey}`,
        'Content-Type':  'application/json'
      },
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      logger.warn(`[ModelResolver/Cerebras] Models endpoint returned ${response.status} — using first preference`);
      return CEREBRAS_PREFERENCE[0];
    }

    const data = await response.json().catch(() => null);
    const liveIds = new Set(
      (data?.data || []).map(m => (m.id || '').toLowerCase())
    );

    logger.info(`[ModelResolver/Cerebras] ${liveIds.size} Cerebras models found`);

    for (const candidate of CEREBRAS_PREFERENCE) {
      if (liveIds.has(candidate.toLowerCase())) {
        logger.info(`[ModelResolver/Cerebras] Selected: ${candidate}`);
        return candidate;
      }
    }

    logger.warn(
      `[ModelResolver/Cerebras] No preference matched. Falling back to: ${CEREBRAS_PREFERENCE[0]}. ` +
      `Live: ${[...liveIds].slice(0, 8).join(', ')}`
    );
    return CEREBRAS_PREFERENCE[0];

  } catch (err) {
    logger.warn(`[ModelResolver/Cerebras] Resolution failed (${err.message}) — using: ${CEREBRAS_PREFERENCE[0]}`);
    return CEREBRAS_PREFERENCE[0];
  }
}

async function getCerebrasModel() {
  if (!_resolvedModels.cerebras) {
    const key = process.env.CEREBRAS_API_KEY;
    _resolvedModels.cerebras = key
      ? await resolveCerebrasModel(key)
      : CEREBRAS_PREFERENCE[0];
  }
  return _resolvedModels.cerebras;
}

// ─── CEREBRAS ENGINE ──────────────────────────────────────────────────────────
/**
 * Query Cerebras AI.
 *
 * Cerebras uses the OpenAI-compatible chat completions format so
 * the request shape is identical to Groq. The key difference is
 * infrastructure — Cerebras runs on wafer-scale silicon with
 * extremely fast inference, and its quota pool is independent from
 * Groq's, so a Groq rate-limit event cannot cascade to Cerebras.
 *
 * @param {string} domain
 */
async function queryCerebras(domain) {
  const cerebrasKey = process.env.CEREBRAS_API_KEY;

  if (!cerebrasKey) {
    logger.error('CEREBRAS_API_KEY not set — cannot query Cerebras');
    return { primaryText: '', verificationText: '', error: 'CEREBRAS_API_KEY not configured' };
  }

  const model = await getCerebrasModel();
  logger.info(`[Cerebras] Using model: ${model}`);

  const headers = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${cerebrasKey}`
  };

  logger.info(`[Cerebras] Sending awareness probe — domain: ${domain}`);

  const primaryPayload = {
    model,
    messages:    [{ role: 'user', content: buildAwarenessPrompt(domain) }],
    max_tokens:  MAX_TOKENS,
    temperature: TEMPERATURE,
    top_p:       0.92,
    stream:      false
  };

  const primaryResult = await safeFetch(
    CEREBRAS_API_URL,
    { method: 'POST', headers, body: JSON.stringify(primaryPayload) },
    'Cerebras'
  );

  if (!primaryResult.ok) {
    if (primaryResult.error && /decommission|deprecated|no longer supported|model not found/i.test(primaryResult.error)) {
      logger.warn('[Cerebras] Model appears unavailable — clearing cache for re-resolution');
      _resolvedModels.cerebras = null;
    }
    return { primaryText: '', verificationText: '', error: primaryResult.error };
  }

  const primaryText = (primaryResult.data?.choices?.[0]?.message?.content || '').trim();

  if (!primaryText) {
    logger.warn('[Cerebras] Empty primary response');
    return { primaryText: '', verificationText: '', error: 'Empty response from Cerebras' };
  }

  logger.info(`[Cerebras] Primary response: ${primaryText.length} chars`);

  const verificationPayload = {
    model,
    messages: [
      { role: 'user',      content: buildAwarenessPrompt(domain) },
      { role: 'assistant', content: primaryText },
      { role: 'user',      content: buildVerificationPrompt(primaryText) }
    ],
    // FIX: raised from 400 to 1200. Confirmed root cause via live
    // diagnostic log — gpt-oss-120b (a reasoning-style model) can
    // consume its entire token budget on internal reasoning before
    // producing any visible output, returning empty content on a
    // tight budget. 1200 leaves room for both reasoning and the
    // actual structured answer.
    max_tokens:  1200,
    temperature: 0.05,
    stream:      false
  };

  const verificationResult = await safeFetch(
    CEREBRAS_API_URL,
    { method: 'POST', headers, body: JSON.stringify(verificationPayload) },
    'Cerebras'
  );

  const verificationText = verificationResult.ok
    ? (verificationResult.data?.choices?.[0]?.message?.content || '').trim()
    : '';

  logger.info(`[Cerebras] Verification: ${verificationText.length} chars`);

  // FIX: permanent lightweight safeguard (replaces the temporary full-text
  // diagnostic). If verification ever comes back empty again — a different
  // model rotation, a future Cerebras catalog change, etc. — this logs the
  // finish_reason so the cause (token budget vs. content filter vs. error)
  // is immediately visible without needing another temporary diagnostic
  // deploy. Does not dump full raw text into production logs on every scan.
  if (!verificationText) {
    const finishReason = verificationResult.data?.choices?.[0]?.finish_reason || 'unknown';
    logger.warn(
      `[Cerebras] Verification returned EMPTY content — model: ${model} | ` +
      `finish_reason: ${finishReason}. Falling back to default scoring signals ` +
      `for this engine on this scan.`
    );
  }

  return { primaryText, verificationText, error: null };
}

// ─── REQUEST PARAMETERS ───────────────────────────────────────────────────────

const TIMEOUT_MS  = 35000;
// FIX: raised from 1200 to 2000. Confirmed live that Google AI's
// primary response was truncated mid-sentence at the old ceiling —
// this constant is shared across every engine's primary probe, so
// raising it gives uniform extra headroom to all six engines equally.
const MAX_TOKENS  = 2000;
const TEMPERATURE = 0.4;

// ─── PRIMARY AWARENESS PROBE ──────────────────────────────────────────────────
/**
 * Open-ended awareness prompt designed to elicit BOTH formal and informal
 * knowledge. Does NOT use rigid numbered structure — numbered lists push
 * models into Wikipedia mode. Free-form prose activates the full training
 * signal including Reddit, Twitter, YouTube, community discussion, reviews.
 */
function buildAwarenessPrompt(domain) {
  return `Tell me everything you know about the brand, product, company, or website at: ${domain}

Write freely and naturally — do not worry about whether your knowledge is formal or informal. Both count equally. If you know this brand from seeing it discussed on Reddit, Twitter, YouTube, TikTok, Hacker News, review sites, or anywhere else online — that knowledge is valuable and I want to hear it.

Cover as many of these as you genuinely have knowledge on. You do not need to cover all of them — only write about what you actually know:

— What this brand is, what it does, and what category or industry it belongs to
— Who typically uses it and why — their demographic, job role, or situation
— How people generally talk about it online — the tone, sentiment, and general reputation in communities
— Whether it gets recommended — in forums, communities, social media, or by influencers or creators
— How it compares to alternatives or competitors that people discuss it alongside
— Any notable moments, controversies, launches, viral events, or cultural references associated with it
— What people typically say they love about it or dislike about it
— Any factual details you happen to know — founding, location, founders, funding, size — but only if you genuinely know them, not guessed
— Your honest assessment of how well-known this brand is across the internet and AI ecosystem

If you have strong knowledge, write several paragraphs. If your knowledge is thin or uncertain, say so clearly and say what you do and do not know. Do not fabricate or speculate — but do not suppress real knowledge just because it came from informal sources.

Write in plain prose only — no markdown formatting, no headers, no bold text, no bullet points, no numbered lists. Just natural paragraphs of running text. This keeps your full token budget available for actual content rather than formatting.

Be honest about your confidence at the end: how certain are you about what you wrote, on a scale of 1 to 10?`;
}

// ─── STRUCTURED SIGNAL EXTRACTION PROMPT ──────────────────────────────────────

function buildVerificationPrompt(primaryResponse) {
  return `Based on what you just wrote, now provide a structured signal extraction. Use exactly this format — one value per line, nothing else:

RECOGNITION: [yes / no / partial] — do you recognise this brand at all
ACCURATE_CLAIMS: [number] — factual statements you are highly confident are correct
CONFLICTING_CLAIMS: [number] — statements you hedged or that may contradict known facts
UNVERIFIABLE_CLAIMS: [number] — statements you included but cannot verify
TOPICS_KNOWN: [comma-separated list, up to 8] — topic areas you have solid knowledge on for this brand
TOPICS_UNKNOWN: [comma-separated list, up to 6] — topic areas you have little or no knowledge on
SENTIMENT: [positive / negative / mixed / neutral / unknown] — overall sentiment in what you wrote
COMMUNITY_PRESENT: [yes / no] — do you have any community, forum, or social knowledge about this brand
RECOMMENDED: [yes / no / unclear] — does your knowledge include people recommending this brand
SOCIAL_FOOTPRINT: [strong / moderate / weak / none] — how strong is the social or creator-driven knowledge
VIRALITY_SIGNAL: [yes / no] — do you know of any viral moments, memes, or cultural events for this brand
INFORMAL_SCORE: [1-10] — how rich is your informal, social, and community knowledge of this brand
FORMAL_SCORE: [1-10] — how rich is your formal, factual, encyclopaedic knowledge of this brand
CONFIDENCE: [1-10] — overall confidence in the accuracy of what you wrote

Reply with only these 14 lines. No other text.`;
}

// ─── FETCH WRAPPER ────────────────────────────────────────────────────────────

async function safeFetch(url, options, engineName) {
  const controller    = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const msg = (data?.error?.message) ||
                  (data?.message) ||
                  `HTTP ${response.status}`;
      logger.warn(`[${engineName}] API error: ${msg}`);
      return { ok: false, status: response.status, data: null, error: msg };
    }

    return { ok: true, status: response.status, data, error: null };

  } catch (err) {
    if (err.name === 'AbortError') {
      logger.warn(`[${engineName}] Timed out after ${TIMEOUT_MS}ms`);
      return { ok: false, status: 0, data: null, error: `Request timed out after ${TIMEOUT_MS}ms` };
    }
    logger.warn(`[${engineName}] Fetch error: ${err.message}`);
    return { ok: false, status: 0, data: null, error: err.message };

  } finally {
    clearTimeout(timeoutHandle);
  }
}

// ─── GROQ ENGINE ─────────────────────────────────────────────────────────────
/**
 * Query Groq API.
 *
 * FIX A9 / C3: Now accepts optional userGroqKey parameter.
 * If provided, uses the user's own Groq API key for the query.
 * Falls back to the server GROQ_API_KEY environment variable.
 * This allows users who add their own Groq key in Settings to use
 * their own quota rather than the server's shared quota.
 *
 * @param {string}   domain
 * @param {Function} modelResolver  - lazy resolver function (getMetaModel, etc.)
 * @param {string}   engineLabel
 * @param {string}   [userGroqKey]  - optional user-supplied Groq API key
 */
async function queryGroq(domain, modelResolver, engineLabel, userGroqKey) {
  // Use user key if provided, fall back to server key
  const groqKey = (userGroqKey && userGroqKey.trim().length > 10)
    ? userGroqKey.trim()
    : process.env.GROQ_API_KEY;

  if (!groqKey) {
    logger.error(`GROQ_API_KEY not set — cannot query ${engineLabel}`);
    return { primaryText: '', verificationText: '', error: 'GROQ_API_KEY not configured' };
  }

  const model = await modelResolver(userGroqKey);
  logger.info(`[${engineLabel}] Using model: ${model}`);

  const headers = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${groqKey}`
  };

  logger.info(`[${engineLabel}] Sending awareness probe — domain: ${domain}`);

  const primaryPayload = {
    model,
    messages:    [{ role: 'user', content: buildAwarenessPrompt(domain) }],
    max_tokens:  MAX_TOKENS,
    temperature: TEMPERATURE,
    top_p:       0.92,
    stream:      false
  };

  const primaryResult = await safeFetch(
    GROQ_API_URL,
    { method: 'POST', headers, body: JSON.stringify(primaryPayload) },
    engineLabel
  );

  if (!primaryResult.ok) {
    if (primaryResult.error && /decommission|deprecated|no longer supported/i.test(primaryResult.error)) {
      logger.warn(`[${engineLabel}] Model ${model} appears decommissioned — clearing cache for re-resolution`);
      if (engineLabel === 'Meta AI') _resolvedModels.meta    = null;
      if (engineLabel === 'Mistral') _resolvedModels.mistral = null;
      if (engineLabel === 'Gemma')   _resolvedModels.gemma   = null;
    }
    return { primaryText: '', verificationText: '', error: primaryResult.error };
  }

  const primaryText = (primaryResult.data?.choices?.[0]?.message?.content || '').trim();

  if (!primaryText) {
    logger.warn(`[${engineLabel}] Empty primary response`);
    return { primaryText: '', verificationText: '', error: 'Empty response from model' };
  }

  // FIX: truncation detection on a NON-empty primary response — this
  // is the exact failure mode that hit Google AI (finishReason:
  // MAX_TOKENS, but the model still returned partial visible text
  // that read as a normal answer until it silently stopped mid-
  // sentence). Previously this was invisible in logs since the
  // response wasn't empty. Now flagged clearly so a low Depth score
  // caused by truncation is distinguishable from genuinely thin
  // model knowledge.
  const primaryFinishReason = primaryResult.data?.choices?.[0]?.finish_reason;
  if (primaryFinishReason === 'length') {
    logger.warn(
      `[${engineLabel}] Primary response TRUNCATED at token limit ` +
      `(${primaryText.length} chars delivered before cutoff). ` +
      `Scoring will proceed on the partial text.`
    );
  }

  logger.info(`[${engineLabel}] Primary response: ${primaryText.length} chars`);

  const verificationPayload = {
    model,
    messages: [
      { role: 'user',      content: buildAwarenessPrompt(domain) },
      { role: 'assistant', content: primaryText },
      { role: 'user',      content: buildVerificationPrompt(primaryText) }
    ],
    // FIX: raised from 400 to 1200, matching the fix already proven
    // necessary for Cerebras — proactively closing the same bug
    // class here rather than waiting for it to strike Meta AI or
    // Mistral in production.
    max_tokens:  1200,
    temperature: 0.05,
    stream:      false
  };

  const verificationResult = await safeFetch(
    GROQ_API_URL,
    { method: 'POST', headers, body: JSON.stringify(verificationPayload) },
    engineLabel
  );

  const verificationText = verificationResult.ok
    ? (verificationResult.data?.choices?.[0]?.message?.content || '').trim()
    : '';

  logger.info(`[${engineLabel}] Verification: ${verificationText.length} chars`);

  return { primaryText, verificationText, error: null };
}

// ─── GEMINI ENGINE ────────────────────────────────────────────────────────────
/**
 * Query Gemini.
 *
 * FIX A8 / C2: Now accepts optional userGeminiKey parameter.
 * If provided, uses the user's own Gemini API key for the query.
 * Falls back to server GEMINI_API_KEY.
 * Allows users who add their own Gemini key in Settings to restore
 * Google AI engine when the server key quota is exhausted.
 *
 * @param {string} domain
 * @param {string} [userGeminiKey] - optional user-supplied Gemini API key
 */
async function queryGemini(domain, userGeminiKey) {
  // Use user key if provided, fall back to server key
  const geminiKey = (userGeminiKey && userGeminiKey.trim().length > 10)
    ? userGeminiKey.trim()
    : process.env.GEMINI_API_KEY;

  if (!geminiKey) {
    logger.error('GEMINI_API_KEY not set — cannot query Google AI');
    return { primaryText: '', verificationText: '', error: 'GEMINI_API_KEY not configured' };
  }

  const model = await getGeminiModel();
  const generateUrl = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${geminiKey}`;

  logger.info(`[Google AI] Using model: ${model}`);
  logger.info(`[Google AI] Sending awareness probe — domain: ${domain}`);

  const headers = { 'Content-Type': 'application/json' };

  const generationConfig = {
    temperature:     TEMPERATURE,
    topP:            0.92,
    maxOutputTokens: MAX_TOKENS
  };

  const primaryPayload = {
    contents: [{
      role:  'user',
      parts: [{ text: buildAwarenessPrompt(domain) }]
    }],
    generationConfig
  };

  const primaryResult = await safeFetch(
    generateUrl,
    { method: 'POST', headers, body: JSON.stringify(primaryPayload) },
    'Google AI'
  );

  if (!primaryResult.ok) {
    if (primaryResult.error && /not found|deprecated|not supported/i.test(primaryResult.error)) {
      logger.warn(`[Google AI] Model ${model} appears unavailable — clearing cache for re-resolution`);
      _resolvedModels.google = null;
    }
    return { primaryText: '', verificationText: '', error: primaryResult.error };
  }

  const primaryText = (
    primaryResult.data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  ).trim();

  if (!primaryText) {
    const finishReason = primaryResult.data?.candidates?.[0]?.finishReason;
    logger.warn(`[Google AI] Empty response. Finish reason: ${finishReason}`);
    return {
      primaryText:      '',
      verificationText: '',
      error: `Empty response from Gemini (${finishReason || 'unknown reason'})`
    };
  }

  // FIX: CONFIRMED ROOT CAUSE via live scan — Google AI's primary
  // response was cut off mid-sentence ("Who typically uses it and
  // why" then nothing) while finishReason was MAX_TOKENS, but the
  // response was NOT empty so the check above never caught it.
  // Gemini 2.5's "thinking" models are documented to sometimes
  // consume output-token budget on internal reasoning before
  // finishing the visible answer, producing exactly this partial-
  // cutoff pattern. Now flagged explicitly rather than silently
  // scored as if it were a complete, deliberately thin answer.
  const primaryFinishReason = primaryResult.data?.candidates?.[0]?.finishReason;
  if (primaryFinishReason === 'MAX_TOKENS') {
    logger.warn(
      `[Google AI] Primary response TRUNCATED at token limit ` +
      `(${primaryText.length} chars delivered before cutoff). ` +
      `Scoring will proceed on the partial text.`
    );
  }

  logger.info(`[Google AI] Primary response: ${primaryText.length} chars`);

  const verificationPayload = {
    contents: [
      { role: 'user',  parts: [{ text: buildAwarenessPrompt(domain) }] },
      { role: 'model', parts: [{ text: primaryText }] },
      { role: 'user',  parts: [{ text: buildVerificationPrompt(primaryText) }] }
    ],
    // FIX: raised from 400 to 1200 — the same thinking-token-budget
    // issue that truncates the primary response can just as easily
    // empty out the shorter, tighter-budget verification call.
    generationConfig: { ...generationConfig, temperature: 0.05, maxOutputTokens: 1200 }
  };

  const verificationResult = await safeFetch(
    generateUrl,
    { method: 'POST', headers, body: JSON.stringify(verificationPayload) },
    'Google AI'
  );

  const verificationText = verificationResult.ok
    ? (verificationResult.data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim()
    : '';

  logger.info(`[Google AI] Verification: ${verificationText.length} chars`);

  return { primaryText, verificationText, error: null };
}

// ─── OPENAI ENGINE (user key) ─────────────────────────────────────────────────

async function queryOpenAI(domain, userOpenAIKey) {
  if (!userOpenAIKey || typeof userOpenAIKey !== 'string' || userOpenAIKey.trim().length < 20) {
    return { primaryText: '', verificationText: '', error: 'Invalid or missing OpenAI API key' };
  }

  const headers = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${userOpenAIKey.trim()}`
  };

  logger.info(`[ChatGPT] Sending awareness probe — domain: ${domain}`);

  const primaryPayload = {
    model:       STATIC_MODELS.chatgpt,
    messages:    [{ role: 'user', content: buildAwarenessPrompt(domain) }],
    max_tokens:  MAX_TOKENS,
    temperature: TEMPERATURE
  };

  const primaryResult = await safeFetch(
    OPENAI_API_URL,
    { method: 'POST', headers, body: JSON.stringify(primaryPayload) },
    'ChatGPT'
  );

  if (!primaryResult.ok) {
    if (primaryResult.status === 401) {
      return { primaryText: '', verificationText: '', error: 'OpenAI API key is invalid or expired' };
    }
    if (primaryResult.status === 429) {
      return { primaryText: '', verificationText: '', error: 'OpenAI rate limit or quota exceeded on your key' };
    }
    return { primaryText: '', verificationText: '', error: primaryResult.error };
  }

  const primaryText = (primaryResult.data?.choices?.[0]?.message?.content || '').trim();
  if (!primaryText) {
    return { primaryText: '', verificationText: '', error: 'Empty response from GPT-4o' };
  }

  // FIX: same truncation-detection pattern applied for parity with
  // the free engines, now that this bug class is confirmed real.
  const primaryFinishReason = primaryResult.data?.choices?.[0]?.finish_reason;
  if (primaryFinishReason === 'length') {
    logger.warn(
      `[ChatGPT] Primary response TRUNCATED at token limit ` +
      `(${primaryText.length} chars delivered before cutoff). ` +
      `Scoring will proceed on the partial text.`
    );
  }

  logger.info(`[ChatGPT] Primary response: ${primaryText.length} chars`);

  const verificationPayload = {
    model:       STATIC_MODELS.chatgpt,
    messages:    [
      { role: 'user',      content: buildAwarenessPrompt(domain) },
      { role: 'assistant', content: primaryText },
      { role: 'user',      content: buildVerificationPrompt(primaryText) }
    ],
    // FIX: raised from 400 to 1200 for consistency with every other
    // engine's verification call, closing the same bug class here too.
    max_tokens:  1200,
    temperature: 0.05
  };

  const verificationResult = await safeFetch(
    OPENAI_API_URL,
    { method: 'POST', headers, body: JSON.stringify(verificationPayload) },
    'ChatGPT'
  );

  const verificationText = verificationResult.ok
    ? (verificationResult.data?.choices?.[0]?.message?.content || '').trim()
    : '';

  return { primaryText, verificationText, error: null };
}

// ─── ANTHROPIC ENGINE (user key) ──────────────────────────────────────────────

async function queryAnthropic(domain, userAnthropicKey) {
  if (!userAnthropicKey || typeof userAnthropicKey !== 'string' || userAnthropicKey.trim().length < 20) {
    return { primaryText: '', verificationText: '', error: 'Invalid or missing Anthropic API key' };
  }

  const headers = {
    'Content-Type':      'application/json',
    'x-api-key':         userAnthropicKey.trim(),
    'anthropic-version': '2023-06-01'
  };

  logger.info(`[Claude] Sending awareness probe — domain: ${domain}`);

  const primaryPayload = {
    model:       STATIC_MODELS.claude,
    max_tokens:  MAX_TOKENS,
    temperature: TEMPERATURE,
    messages:    [{ role: 'user', content: buildAwarenessPrompt(domain) }]
  };

  const primaryResult = await safeFetch(
    ANTHROPIC_URL,
    { method: 'POST', headers, body: JSON.stringify(primaryPayload) },
    'Claude'
  );

  if (!primaryResult.ok) {
    if (primaryResult.status === 401) {
      return { primaryText: '', verificationText: '', error: 'Anthropic API key is invalid or expired' };
    }
    if (primaryResult.status === 429) {
      return { primaryText: '', verificationText: '', error: 'Anthropic rate limit exceeded on your key' };
    }
    return { primaryText: '', verificationText: '', error: primaryResult.error };
  }

  const primaryText = (primaryResult.data?.content?.[0]?.text || '').trim();
  if (!primaryText) {
    return { primaryText: '', verificationText: '', error: 'Empty response from Claude' };
  }

  // FIX: same truncation-detection pattern, adapted for Anthropic's
  // stop_reason field (values: end_turn, max_tokens, stop_sequence),
  // which differs from the finish_reason/finishReason naming used
  // by the OpenAI-compatible and Gemini APIs.
  const primaryStopReason = primaryResult.data?.stop_reason;
  if (primaryStopReason === 'max_tokens') {
    logger.warn(
      `[Claude] Primary response TRUNCATED at token limit ` +
      `(${primaryText.length} chars delivered before cutoff). ` +
      `Scoring will proceed on the partial text.`
    );
  }

  logger.info(`[Claude] Primary response: ${primaryText.length} chars`);

  const verificationPayload = {
    model:       STATIC_MODELS.claude,
    // FIX: raised from 400 to 1200 for consistency with every other
    // engine's verification call.
    max_tokens:  1200,
    temperature: 0.05,
    messages:    [
      { role: 'user',      content: buildAwarenessPrompt(domain) },
      { role: 'assistant', content: primaryText },
      { role: 'user',      content: buildVerificationPrompt(primaryText) }
    ]
  };

  const verificationResult = await safeFetch(
    ANTHROPIC_URL,
    { method: 'POST', headers, body: JSON.stringify(verificationPayload) },
    'Claude'
  );

  const verificationText = verificationResult.ok
    ? (verificationResult.data?.content?.[0]?.text || '').trim()
    : '';

  return { primaryText, verificationText, error: null };
}

// ─── VERIFICATION BLOCK PARSER ────────────────────────────────────────────────

function parseVerificationBlock(text) {
  const defaults = {
    recognition:        'unknown',
    accurateClaims:     0,
    conflictingClaims:  0,
    unverifiableClaims: 0,
    topicsKnown:        [],
    topicsUnknown:      [],
    sentiment:          'unknown',
    communityPresent:   false,
    recommended:        'unclear',
    socialFootprint:    'unknown',
    viralitySignal:     false,
    informalScore:      5,
    formalScore:        5,
    confidence:         5
  };

  if (!text || text.trim().length === 0) return defaults;

  function extractInt(pattern, min = 0, max = 50) {
    const m = text.match(pattern);
    if (!m) return 0;
    const n = parseInt(m[1], 10);
    return isNaN(n) ? 0 : Math.min(Math.max(n, min), max);
  }

  function extractScale(pattern) {
    const m = text.match(pattern);
    if (!m) return 5;
    const n = parseInt(m[1], 10);
    return isNaN(n) ? 5 : Math.min(Math.max(n, 1), 10);
  }

  function extractKeyword(pattern, validValues, defaultVal) {
    const m = text.match(pattern);
    if (!m || !m[1]) return defaultVal;
    const val = m[1].trim().toLowerCase().replace(/[^a-z]/g, '');
    return validValues.includes(val) ? val : defaultVal;
  }

  function extractList(pattern) {
    const m = text.match(pattern);
    if (!m || !m[1]) return [];
    return m[1]
      .split(',')
      .map(s => s.replace(/[\[\]]/g, '').trim())
      .filter(s => s.length > 1 && s.toLowerCase() !== 'none' && s.toLowerCase() !== 'n/a')
      .slice(0, 8);
  }

  function extractBool(pattern) {
    const m = text.match(pattern);
    if (!m || !m[1]) return false;
    return /yes|true|1/i.test(m[1].trim());
  }

  return {
    recognition:        extractKeyword(/RECOGNITION\s*[:：]\s*(\w+)/i,
                          ['yes', 'no', 'partial'], 'unknown'),
    accurateClaims:     extractInt(/ACCURATE_CLAIMS\s*[:：]\s*(\d+)/i),
    conflictingClaims:  extractInt(/CONFLICTING_CLAIMS\s*[:：]\s*(\d+)/i),
    unverifiableClaims: extractInt(/UNVERIFIABLE_CLAIMS\s*[:：]\s*(\d+)/i),
    topicsKnown:        extractList(/TOPICS_KNOWN\s*[:：]\s*(.+)/i),
    topicsUnknown:      extractList(/TOPICS_UNKNOWN\s*[:：]\s*(.+)/i),
    sentiment:          extractKeyword(/SENTIMENT\s*[:：]\s*(\w+)/i,
                          ['positive', 'negative', 'mixed', 'neutral', 'unknown'], 'unknown'),
    communityPresent:   extractBool(/COMMUNITY_PRESENT\s*[:：]\s*(\w+)/i),
    recommended:        extractKeyword(/RECOMMENDED\s*[:：]\s*(\w+)/i,
                          ['yes', 'no', 'unclear'], 'unclear'),
    socialFootprint:    extractKeyword(/SOCIAL_FOOTPRINT\s*[:：]\s*(\w+)/i,
                          ['strong', 'moderate', 'weak', 'none', 'unknown'], 'unknown'),
    viralitySignal:     extractBool(/VIRALITY_SIGNAL\s*[:：]\s*(\w+)/i),
    informalScore:      extractScale(/INFORMAL_SCORE\s*[:：]\s*(\d+)/i),
    formalScore:        extractScale(/FORMAL_SCORE\s*[:：]\s*(\d+)/i),
    confidence:         extractScale(/CONFIDENCE\s*[:：]\s*(\d+)/i)
  };
}

// ─── NARRATIVE EXTRACTOR ──────────────────────────────────────────────────────
/**
 * Extract display narrative from the model's primary response.
 *
 * FIX A11: MAX_DISPLAY_CHARS increased from 700 to 1200.
 * For popular brands with rich AI knowledge, 700 chars was cutting off
 * the most valuable content. 1200 chars allows the full narrative to
 * surface while remaining appropriate for display in the narrative card.
 */
function extractNarrative(primaryText) {
  if (!primaryText || primaryText.trim().length === 0) {
    return {
      narrative:          'No response received from this engine.',
      rawConfidenceScore: 0
    };
  }

  let rawConfidenceScore = 5;
  const confPatterns = [
    /confidence[:\s]+(\b([1-9]|10)\b)/i,
    /(\b([1-9]|10)\b)\s*(?:out of|\/)\s*10/i,
    /rate\s+(?:my\s+)?(?:confidence|certainty)[:\s]+(\b([1-9]|10)\b)/i,
    /(?:i.d\s+say|i\s+(?:would\s+)?rate(?:\s+this)?)[:\s]+(\b([1-9]|10)\b)/i
  ];
  for (const pattern of confPatterns) {
    const m = primaryText.match(pattern);
    if (m) {
      const raw = parseInt(m[2] || m[1], 10);
      if (!isNaN(raw) && raw >= 1 && raw <= 10) {
        rawConfidenceScore = raw;
        break;
      }
    }
  }

  const cleaned = primaryText
    .replace(/^\s*\d+[\.\)]\s*(recognition|description|reputation|details|confidence|gaps)[:\s]*/gim, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const noKnowledgePatterns = [
    /(?:i don.t|i do not)\s+(?:have|know)/i,
    /no\s+(?:information|data|knowledge|records)/i,
    /(?:not\s+aware|unaware|unfamiliar|unable\s+to\s+find)/i,
    /(?:cannot|could not)\s+(?:find|locate|identify)/i,
    /(?:outside|beyond)\s+(?:my\s+)?(?:knowledge|training)/i
  ];
  const isNoKnowledge = noKnowledgePatterns.some(p => p.test(cleaned));
  if (isNoKnowledge && cleaned.length < 350) {
    return {
      narrative: cleaned.length > 20
        ? cleaned
        : 'This AI engine has no knowledge of this brand.',
      rawConfidenceScore: 1
    };
  }

  // FIX A11: increased from 700 to 1200
  const MAX_DISPLAY_CHARS = 1200;
  let narrative = cleaned;

  if (cleaned.length > MAX_DISPLAY_CHARS) {
    const cutPoint = cleaned.lastIndexOf('. ', MAX_DISPLAY_CHARS);
    if (cutPoint > MAX_DISPLAY_CHARS * 0.6) {
      narrative = cleaned.slice(0, cutPoint + 1);
    } else {
      narrative = cleaned.slice(0, MAX_DISPLAY_CHARS - 3) + '...';
    }
  }

  return { narrative, rawConfidenceScore };
}

// ─── MAIN EXPORT: queryAllEngines ────────────────────────────────────────────
/**
 * Query all requested engines in parallel.
 *
 * FIX A7 / C1: Gemma engine case added.
 * FIX A8 / C2: keys.gemini passed to queryGemini().
 * FIX A9 / C3: keys.groq passed to all queryGroq() calls.
 * FIX scorer wire: verificationRecognition now set on every result.
 *
 * @param {string}   domain
 * @param {string[]} engines
 * @param {{ openai?: string, anthropic?: string, gemini?: string, groq?: string }} keys
 */
async function queryAllEngines(domain, engines, keys = {}) {
  logger.info(
    `Querying ${engines.length} engine(s) for: ${domain} — [${engines.join(', ')}]`
  );

  const queryTasks = engines.map(engine => {
    let promise;

    switch (engine) {
      case 'meta':
        // Pass user Groq key if provided (A9/C3)
        promise = queryGroq(domain, getMetaModel, 'Meta AI', keys.groq || '');
        break;

      case 'mistral':
        promise = queryGroq(domain, getMistralModel, 'Mistral', keys.groq || '');
        break;

      case 'gemma':
        // NEW (A7/C1): Gemma engine using Groq-hosted gemma2-9b-it
        // Uses user Groq key if provided, falls back to server key
        promise = queryGroq(
          domain,
          (userKey) => getGemmaModel(userKey || keys.groq || ''),
          'Gemma',
          keys.groq || ''
        );
        break;

      case 'google':
        // Pass user Gemini key if provided (A8/C2)
        promise = queryGemini(domain, keys.gemini || '');
        break;

      case 'chatgpt':
        promise = queryOpenAI(domain, keys.openai || '');
        break;

      case 'claude':
        promise = queryAnthropic(domain, keys.anthropic || '');
        break;

      case 'cerebras':
        // Cerebras runs entirely on the server key — no user key
        // override here since Cerebras is a server-side fallback
        // engine, not a user-supplied key engine like ChatGPT/Claude
        promise = queryCerebras(domain);
        break;

      default:
        logger.warn(`Unknown engine: ${engine} — skipping`);
        promise = Promise.resolve({
          primaryText: '', verificationText: '',
          error: `Unknown engine: ${engine}`
        });
    }

    return promise
      .then(result => ({ engine, ...result }))
      .catch(err => {
        logger.error(`Unhandled error in engine ${engine}: ${err.message}`);
        return { engine, primaryText: '', verificationText: '', error: err.message };
      });
  });

  const settled = await Promise.allSettled(queryTasks);

  const results = {};

  for (const item of settled) {
    const res = item.status === 'fulfilled'
      ? item.value
      : { engine: 'unknown', primaryText: '', verificationText: '',
          error: item.reason?.message || 'Unknown error' };

    const { engine, primaryText, verificationText, error } = res;
    if (!engine || engine === 'unknown') continue;

    const { narrative, rawConfidenceScore } = extractNarrative(primaryText);
    const verification = parseVerificationBlock(verificationText);

    results[engine] = {
      primaryText,
      verificationText,
      narrative,
      rawConfidenceScore,
      // Standard claim counts
      accurateClaims:     verification.accurateClaims,
      conflictingClaims:  verification.conflictingClaims,
      unverifiableClaims: verification.unverifiableClaims,
      topicsKnown:        verification.topicsKnown,
      topicsUnknown:      verification.topicsUnknown,
      // Informal/social signal dimensions
      sentiment:          verification.sentiment,
      communityPresent:   verification.communityPresent,
      recommended:        verification.recommended,
      socialFootprint:    verification.socialFootprint,
      viralitySignal:     verification.viralitySignal,
      informalScore:      verification.informalScore,
      formalScore:        verification.formalScore,
      // Raw confidence for scorer
      rawConfidenceScore: verification.confidence || rawConfidenceScore,
      // SCORER WIRE FIX: verificationRecognition connects the RECOGNITION
      // field from the verification block directly to scoreRecognition()
      // in scorer.js. Without this field the scorer falls back to
      // 'unknown' for verificationRecognition on every engine.
      verificationRecognition: verification.recognition,
      error: error || null
    };

    if (error) {
      logger.warn(`Engine ${engine} error: ${error}`);
    } else {
      logger.info(
        `Engine ${engine} processed — chars: ${primaryText.length} | ` +
        `informal: ${verification.informalScore}/10 | formal: ${verification.formalScore}/10 | ` +
        `community: ${verification.communityPresent} | sentiment: ${verification.sentiment} | ` +
        `recognition: ${verification.recognition}`
      );
    }
  }

  return results;
}

module.exports = {
  queryAllEngines,
  buildAwarenessPrompt,
  buildVerificationPrompt,
  parseVerificationBlock,
  extractNarrative
};
