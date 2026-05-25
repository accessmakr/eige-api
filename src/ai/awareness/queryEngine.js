'use strict';

const logger = require('../../utils/logger');

// ─── API ENDPOINTS ────────────────────────────────────────────────────────────
const GROQ_API_URL    = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_API_URL  = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
const OPENAI_API_URL  = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_URL   = 'https://api.anthropic.com/v1/messages';

// ─── MODEL IDENTIFIERS ────────────────────────────────────────────────────────
const MODELS = {
  meta:    'llama-3.1-70b-versatile',   // Groq-hosted Llama 3.1 70B → represents Meta AI
  mistral: 'mixtral-8x7b-32768',        // Groq-hosted Mixtral 8x7B  → represents Mistral
  google:  'gemini-1.5-flash',          // Gemini 1.5 Flash           → represents Google AI
  chatgpt: 'gpt-4o',                    // OpenAI GPT-4o              → represents ChatGPT
  claude:  'claude-3-5-sonnet-20241022' // Anthropic Claude 3.5 Sonnet → represents Claude
};

// ─── REQUEST LIMITS ───────────────────────────────────────────────────────────
const TIMEOUT_MS      = 30000;  // 30 seconds per engine request
const MAX_TOKENS      = 1024;   // enough for a thorough brand narrative
const TEMPERATURE     = 0.3;    // low temperature = more factual, less creative

// ─── PROMPT CONSTRUCTION ─────────────────────────────────────────────────────
/**
 * Build the primary brand awareness probe prompt.
 * This prompt is deliberately structured to elicit five measurable dimensions:
 *   1. Recognition  — does the model know the brand exists
 *   2. Description  — what the brand does
 *   3. Reputation   — how it is perceived
 *   4. Details      — factual specifics (founding, products, team, location)
 *   5. Limitations  — honest acknowledgement of uncertainty
 *
 * The prompt is sent as the USER message. No system role manipulation is applied
 * because different model families handle system prompts differently and we want
 * consistent, comparable outputs across all five engines.
 *
 * @param {string} domain - The full normalised domain string e.g. "stripe.com"
 * @returns {string}
 */
function buildAwarenessPrompt(domain) {
  return `I want to understand what you know about the brand or organisation behind the domain: ${domain}

Please answer the following questions in sequence, clearly numbered:

1. RECOGNITION: Do you know this brand or website? State clearly: yes, no, or partially.

2. DESCRIPTION: In 2–3 sentences, describe what this brand does, what industry it operates in, and who its primary audience is.

3. REPUTATION: How is this brand generally perceived? Mention any notable achievements, controversies, partnerships, or public recognition if you are aware of them.

4. DETAILS: List any specific factual details you know — such as founding year, headquarters location, key products or services, notable founders or executives, funding or revenue figures, or major milestones.

5. CONFIDENCE: On a scale of 1–10, how confident are you in the accuracy of what you have written above? Explain briefly why.

6. GAPS: What do you NOT know about this brand that a well-informed person would expect you to know?

Be factual and honest. If you have no information about this domain, say so clearly rather than speculating or fabricating details.`;
}

/**
 * Build a secondary verification prompt used after the primary response
 * to extract structured claim counts for scoring.
 * This is sent as a follow-up in the same conversation to leverage context.
 *
 * @param {string} primaryResponse - The model's answer to the primary prompt
 * @returns {string}
 */
function buildVerificationPrompt(primaryResponse) {
  return `Based on your answer above, please now provide a structured summary in this exact format — do not deviate from it:

ACCURATE_CLAIMS: [number] — count of factual statements you are highly confident are correct
CONFLICTING_CLAIMS: [number] — count of statements that may contradict known facts or that you hedged
UNVERIFIABLE_CLAIMS: [number] — count of statements you cannot verify but included anyway
TOPICS_KNOWN: [comma-separated list of up to 6 topic areas you have solid knowledge on for this brand]
TOPICS_UNKNOWN: [comma-separated list of up to 6 topic areas you have little or no knowledge on for this brand]

Reply with only this structured block. Nothing else.`;
}

// ─── FETCH HELPERS ────────────────────────────────────────────────────────────

/**
 * Generic fetch wrapper with timeout and structured error handling.
 * Returns { ok, status, data } — never throws.
 *
 * @param {string} url
 * @param {object} options - fetch options
 * @param {string} engineName - for logging only
 * @returns {Promise<{ok: boolean, status: number, data: object|null, error: string|null}>}
 */
async function safeFetch(url, options, engineName) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const msg = (data && data.error && data.error.message) ||
                  (data && data.message) ||
                  `HTTP ${response.status}`;
      logger.warn(`[${engineName}] API error: ${msg}`);
      return { ok: false, status: response.status, data: null, error: msg };
    }

    return { ok: true, status: response.status, data, error: null };

  } catch (err) {
    if (err.name === 'AbortError') {
      logger.warn(`[${engineName}] Request timed out after ${TIMEOUT_MS}ms`);
      return { ok: false, status: 0, data: null, error: `Request timed out after ${TIMEOUT_MS}ms` };
    }
    logger.warn(`[${engineName}] Fetch error: ${err.message}`);
    return { ok: false, status: 0, data: null, error: err.message };

  } finally {
    clearTimeout(timeoutHandle);
  }
}

// ─── GROQ ENGINE (Meta AI via Llama 3.1 / Mistral via Mixtral) ───────────────

/**
 * Query the Groq API with a two-turn conversation:
 *   Turn 1: primary brand awareness probe
 *   Turn 2: structured claim verification
 *
 * @param {string} domain
 * @param {string} model - MODELS.meta or MODELS.mistral
 * @param {string} engineLabel - human-readable engine name for logging
 * @returns {Promise<{primaryText: string, verificationText: string, error: string|null}>}
 */
async function queryGroq(domain, model, engineLabel) {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    logger.error(`GROQ_API_KEY is not set — cannot query ${engineLabel}`);
    return { primaryText: '', verificationText: '', error: 'GROQ_API_KEY not configured' };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${groqKey}`
  };

  // ── Turn 1: primary probe ──
  logger.info(`[${engineLabel}] Sending primary awareness probe for domain: ${domain}`);

  const primaryPayload = {
    model,
    messages: [
      { role: 'user', content: buildAwarenessPrompt(domain) }
    ],
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    top_p: 0.9,
    stream: false
  };

  const primaryResult = await safeFetch(
    GROQ_API_URL,
    { method: 'POST', headers, body: JSON.stringify(primaryPayload) },
    engineLabel
  );

  if (!primaryResult.ok) {
    return { primaryText: '', verificationText: '', error: primaryResult.error };
  }

  const primaryText = (
    primaryResult.data?.choices?.[0]?.message?.content || ''
  ).trim();

  if (!primaryText) {
    logger.warn(`[${engineLabel}] Empty primary response`);
    return { primaryText: '', verificationText: '', error: 'Empty response from model' };
  }

  logger.info(`[${engineLabel}] Primary response received — ${primaryText.length} chars`);

  // ── Turn 2: structured verification ──
  const verificationPayload = {
    model,
    messages: [
      { role: 'user',      content: buildAwarenessPrompt(domain) },
      { role: 'assistant', content: primaryText },
      { role: 'user',      content: buildVerificationPrompt(primaryText) }
    ],
    max_tokens: 300,
    temperature: 0.1,  // near-zero temperature for structured extraction
    stream: false
  };

  const verificationResult = await safeFetch(
    GROQ_API_URL,
    { method: 'POST', headers, body: JSON.stringify(verificationPayload) },
    engineLabel
  );

  const verificationText = verificationResult.ok
    ? (verificationResult.data?.choices?.[0]?.message?.content || '').trim()
    : '';

  logger.info(`[${engineLabel}] Verification response received — ${verificationText.length} chars`);

  return { primaryText, verificationText, error: null };
}

// ─── GEMINI ENGINE (Google AI) ────────────────────────────────────────────────

/**
 * Query the Gemini 1.5 Flash API.
 * Gemini uses a different request/response shape from OpenAI-compatible APIs.
 * We simulate a two-turn conversation using the `contents` array with roles.
 *
 * @param {string} domain
 * @returns {Promise<{primaryText: string, verificationText: string, error: string|null}>}
 */
async function queryGemini(domain) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    logger.error('GEMINI_API_KEY is not set — cannot query Google AI');
    return { primaryText: '', verificationText: '', error: 'GEMINI_API_KEY not configured' };
  }

  const url = `${GEMINI_API_URL}?key=${geminiKey}`;
  const headers = { 'Content-Type': 'application/json' };

  const generationConfig = {
    temperature: TEMPERATURE,
    topP: 0.9,
    maxOutputTokens: MAX_TOKENS
  };

  // ── Turn 1: primary probe ──
  logger.info(`[Google AI] Sending primary awareness probe for domain: ${domain}`);

  const primaryPayload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: buildAwarenessPrompt(domain) }]
      }
    ],
    generationConfig
  };

  const primaryResult = await safeFetch(
    url,
    { method: 'POST', headers, body: JSON.stringify(primaryPayload) },
    'Google AI'
  );

  if (!primaryResult.ok) {
    return { primaryText: '', verificationText: '', error: primaryResult.error };
  }

  // Gemini response structure: candidates[0].content.parts[0].text
  const primaryText = (
    primaryResult.data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  ).trim();

  if (!primaryText) {
    // Check for safety blocks
    const blockReason = primaryResult.data?.candidates?.[0]?.finishReason;
    const safetyRatings = primaryResult.data?.candidates?.[0]?.safetyRatings;
    logger.warn(`[Google AI] Empty response. Finish reason: ${blockReason}. Safety: ${JSON.stringify(safetyRatings)}`);
    return { primaryText: '', verificationText: '', error: `Model returned empty response (${blockReason || 'unknown reason'})` };
  }

  logger.info(`[Google AI] Primary response received — ${primaryText.length} chars`);

  // ── Turn 2: structured verification (multi-turn) ──
  const verificationPayload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: buildAwarenessPrompt(domain) }]
      },
      {
        role: 'model',
        parts: [{ text: primaryText }]
      },
      {
        role: 'user',
        parts: [{ text: buildVerificationPrompt(primaryText) }]
      }
    ],
    generationConfig: { ...generationConfig, temperature: 0.1, maxOutputTokens: 300 }
  };

  const verificationResult = await safeFetch(
    url,
    { method: 'POST', headers, body: JSON.stringify(verificationPayload) },
    'Google AI'
  );

  const verificationText = verificationResult.ok
    ? (verificationResult.data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim()
    : '';

  logger.info(`[Google AI] Verification response received — ${verificationText.length} chars`);

  return { primaryText, verificationText, error: null };
}

// ─── OPENAI ENGINE (ChatGPT — user-supplied key) ──────────────────────────────

/**
 * Query OpenAI GPT-4o using the user's own API key.
 * The key is never stored server-side — it comes from the request payload
 * and is used once for this request only.
 *
 * @param {string} domain
 * @param {string} userOpenAIKey - the key provided by the user in the frontend
 * @returns {Promise<{primaryText: string, verificationText: string, error: string|null}>}
 */
async function queryOpenAI(domain, userOpenAIKey) {
  if (!userOpenAIKey || typeof userOpenAIKey !== 'string' || userOpenAIKey.length < 20) {
    return { primaryText: '', verificationText: '', error: 'Invalid or missing OpenAI API key' };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userOpenAIKey.trim()}`
  };

  logger.info(`[ChatGPT] Sending primary awareness probe for domain: ${domain}`);

  // ── Turn 1 ──
  const primaryPayload = {
    model: MODELS.chatgpt,
    messages: [
      { role: 'user', content: buildAwarenessPrompt(domain) }
    ],
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE
  };

  const primaryResult = await safeFetch(
    OPENAI_API_URL,
    { method: 'POST', headers, body: JSON.stringify(primaryPayload) },
    'ChatGPT'
  );

  if (!primaryResult.ok) {
    // Differentiate auth errors from generic errors
    if (primaryResult.status === 401) {
      return { primaryText: '', verificationText: '', error: 'OpenAI API key is invalid or expired' };
    }
    if (primaryResult.status === 429) {
      return { primaryText: '', verificationText: '', error: 'OpenAI rate limit or quota exceeded on your key' };
    }
    return { primaryText: '', verificationText: '', error: primaryResult.error };
  }

  const primaryText = (
    primaryResult.data?.choices?.[0]?.message?.content || ''
  ).trim();

  if (!primaryText) {
    return { primaryText: '', verificationText: '', error: 'Empty response from GPT-4o' };
  }

  logger.info(`[ChatGPT] Primary response received — ${primaryText.length} chars`);

  // ── Turn 2 ──
  const verificationPayload = {
    model: MODELS.chatgpt,
    messages: [
      { role: 'user',      content: buildAwarenessPrompt(domain) },
      { role: 'assistant', content: primaryText },
      { role: 'user',      content: buildVerificationPrompt(primaryText) }
    ],
    max_tokens: 300,
    temperature: 0.1
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

// ─── ANTHROPIC ENGINE (Claude — user-supplied key) ────────────────────────────

/**
 * Query Anthropic Claude 3.5 Sonnet using the user's own API key.
 * Anthropic uses its own non-OpenAI-compatible API format.
 * Note: Anthropic requires the api-version header.
 *
 * @param {string} domain
 * @param {string} userAnthropicKey
 * @returns {Promise<{primaryText: string, verificationText: string, error: string|null}>}
 */
async function queryAnthropic(domain, userAnthropicKey) {
  if (!userAnthropicKey || typeof userAnthropicKey !== 'string' || userAnthropicKey.length < 20) {
    return { primaryText: '', verificationText: '', error: 'Invalid or missing Anthropic API key' };
  }

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': userAnthropicKey.trim(),
    'anthropic-version': '2023-06-01'
  };

  logger.info(`[Claude] Sending primary awareness probe for domain: ${domain}`);

  // ── Turn 1 ──
  const primaryPayload = {
    model: MODELS.claude,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    messages: [
      { role: 'user', content: buildAwarenessPrompt(domain) }
    ]
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

  // Anthropic response: content[0].text
  const primaryText = (
    primaryResult.data?.content?.[0]?.text || ''
  ).trim();

  if (!primaryText) {
    return { primaryText: '', verificationText: '', error: 'Empty response from Claude' };
  }

  logger.info(`[Claude] Primary response received — ${primaryText.length} chars`);

  // ── Turn 2 ──
  const verificationPayload = {
    model: MODELS.claude,
    max_tokens: 300,
    temperature: 0.1,
    messages: [
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

// ─── VERIFICATION TEXT PARSER ─────────────────────────────────────────────────

/**
 * Parse the structured verification block returned by the model's second turn.
 * The model is instructed to return a specific format — this function extracts
 * the values from that format using regex with generous fallback handling.
 *
 * Expected format example:
 *   ACCURATE_CLAIMS: 8
 *   CONFLICTING_CLAIMS: 1
 *   UNVERIFIABLE_CLAIMS: 2
 *   TOPICS_KNOWN: payments, SaaS, fintech, API infrastructure
 *   TOPICS_UNKNOWN: recent funding, executive changes, market share
 *
 * @param {string} text - The raw verification response text
 * @returns {{
 *   accurateClaims: number,
 *   conflictingClaims: number,
 *   unverifiableClaims: number,
 *   topicsKnown: string[],
 *   topicsUnknown: string[]
 * }}
 */
function parseVerificationBlock(text) {
  const defaults = {
    accurateClaims:     0,
    conflictingClaims:  0,
    unverifiableClaims: 0,
    topicsKnown:        [],
    topicsUnknown:      []
  };

  if (!text || text.trim().length === 0) return defaults;

  function extractInt(pattern) {
    const m = text.match(pattern);
    if (!m) return 0;
    const n = parseInt(m[1], 10);
    return isNaN(n) ? 0 : Math.min(Math.max(n, 0), 50); // clamp 0–50
  }

  function extractList(pattern) {
    const m = text.match(pattern);
    if (!m || !m[1]) return [];
    return m[1]
      .split(',')
      .map(s => s.replace(/[\[\]]/g, '').trim())
      .filter(s => s.length > 0 && s !== 'none' && s !== 'N/A')
      .slice(0, 8); // max 8 topics
  }

  return {
    accurateClaims:     extractInt(/ACCURATE_CLAIMS\s*[:：]\s*(\d+)/i),
    conflictingClaims:  extractInt(/CONFLICTING_CLAIMS\s*[:：]\s*(\d+)/i),
    unverifiableClaims: extractInt(/UNVERIFIABLE_CLAIMS\s*[:：]\s*(\d+)/i),
    topicsKnown:        extractList(/TOPICS_KNOWN\s*[:：]\s*(.+)/i),
    topicsUnknown:      extractList(/TOPICS_UNKNOWN\s*[:：]\s*(.+)/i)
  };
}

// ─── NARRATIVE EXTRACTOR ──────────────────────────────────────────────────────

/**
 * Extract the clean narrative portion from the model's primary response.
 * The model returns a structured numbered list. We extract sections 1–4
 * and combine them into a readable narrative paragraph.
 *
 * Also extracts the self-reported confidence score (1–10) from section 5.
 *
 * @param {string} primaryText - The model's full primary response
 * @returns {{ narrative: string, rawConfidenceScore: number }}
 */
function extractNarrative(primaryText) {
  if (!primaryText || primaryText.trim().length === 0) {
    return { narrative: 'No response received from this engine.', rawConfidenceScore: 0 };
  }

  // Extract self-reported confidence (1–10) from section 5
  let rawConfidenceScore = 5; // default to mid
  const confMatch = primaryText.match(
    /5[\.\)]\s*CONFIDENCE[:\s]+.*?(\b([1-9]|10)\b)/is
  );
  if (confMatch) {
    const n = parseInt(confMatch[2] || confMatch[1], 10);
    if (!isNaN(n) && n >= 1 && n <= 10) rawConfidenceScore = n;
  }

  // Build narrative from sections 1 (recognition), 2 (description), 3 (reputation), 4 (details)
  // Strip the numbered headings and join cleanly
  const cleaned = primaryText
    .replace(/^\s*\d+[\.\)]\s*(RECOGNITION|DESCRIPTION|REPUTATION|DETAILS|CONFIDENCE|GAPS)[:\s]*/gim, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // If the model said it doesn't know the brand, the narrative should reflect that clearly
  const doesNotKnow = /(?:i don.t|no information|not aware|unable to find|cannot find|unfamiliar|no knowledge)/i.test(cleaned);
  if (doesNotKnow && cleaned.length < 300) {
    return {
      narrative: cleaned.length > 20 ? cleaned : 'This AI engine has no knowledge of this brand.',
      rawConfidenceScore: 1
    };
  }

  // Truncate to a reasonable display length — 600 chars is ample for a narrative card
  const truncated = cleaned.length > 600
    ? cleaned.slice(0, 597) + '...'
    : cleaned;

  return { narrative: truncated, rawConfidenceScore };
}

// ─── MAIN EXPORT: queryAllEngines ────────────────────────────────────────────

/**
 * Query all requested AI engines in parallel.
 * Each engine is queried independently — one failure does not block others.
 * Returns a results map keyed by engine name with raw text and parsed data.
 *
 * @param {string} domain - normalised domain e.g. "stripe.com"
 * @param {string[]} engines - array from the frontend e.g. ['meta', 'google', 'mistral']
 * @param {{ openai: string|null, anthropic: string|null }} keys - user-supplied keys
 * @returns {Promise<Object.<string, {
 *   primaryText: string,
 *   verificationText: string,
 *   narrative: string,
 *   rawConfidenceScore: number,
 *   accurateClaims: number,
 *   conflictingClaims: number,
 *   unverifiableClaims: number,
 *   topicsKnown: string[],
 *   topicsUnknown: string[],
 *   error: string|null
 * }>>}
 */
async function queryAllEngines(domain, engines, keys = {}) {
  logger.info(`Querying ${engines.length} engine(s) for domain: ${domain} — [${engines.join(', ')}]`);

  // Build the list of query promises, one per requested engine
  const queryTasks = engines.map(engine => {
    let promise;

    switch (engine) {
      case 'meta':
        promise = queryGroq(domain, MODELS.meta, 'Meta AI');
        break;
      case 'mistral':
        promise = queryGroq(domain, MODELS.mistral, 'Mistral');
        break;
      case 'google':
        promise = queryGemini(domain);
        break;
      case 'chatgpt':
        promise = queryOpenAI(domain, keys.openai || '');
        break;
      case 'claude':
        promise = queryAnthropic(domain, keys.anthropic || '');
        break;
      default:
        logger.warn(`Unknown engine requested: ${engine} — skipping`);
        promise = Promise.resolve({ primaryText: '', verificationText: '', error: `Unknown engine: ${engine}` });
    }

    // Wrap each promise so a rejection never causes Promise.allSettled to fail
    return promise
      .then(result => ({ engine, ...result }))
      .catch(err => {
        logger.error(`Unhandled error in engine ${engine}: ${err.message}`);
        return { engine, primaryText: '', verificationText: '', error: err.message };
      });
  });

  // Run all engine queries in parallel — maximum concurrency, minimum total latency
  const settled = await Promise.allSettled(queryTasks);

  // Assemble the results map
  const results = {};

  for (const item of settled) {
    // Promise.allSettled wraps each in { status, value } — value always exists due to our catch above
    const res = item.status === 'fulfilled' ? item.value : {
      engine: 'unknown',
      primaryText: '',
      verificationText: '',
      error: item.reason?.message || 'Unknown error'
    };

    const { engine, primaryText, verificationText, error } = res;

    if (!engine || engine === 'unknown') continue;

    const { narrative, rawConfidenceScore } = extractNarrative(primaryText);
    const verification = parseVerificationBlock(verificationText);

    results[engine] = {
      primaryText,
      verificationText,
      narrative,
      rawConfidenceScore,
      accurateClaims:     verification.accurateClaims,
      conflictingClaims:  verification.conflictingClaims,
      unverifiableClaims: verification.unverifiableClaims,
      topicsKnown:        verification.topicsKnown,
      topicsUnknown:      verification.topicsUnknown,
      error: error || null
    };

    if (error) {
      logger.warn(`Engine ${engine} returned an error: ${error}`);
    } else {
      logger.info(`Engine ${engine} fully processed — narrative: ${narrative.length} chars | confidence: ${rawConfidenceScore}/10`);
    }
  }

  return results;
}

module.exports = {
  queryAllEngines,
  // Exported for unit testing
  buildAwarenessPrompt,
  buildVerificationPrompt,
  parseVerificationBlock,
  extractNarrative
};
