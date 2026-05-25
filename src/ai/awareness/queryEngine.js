'use strict';

const logger = require('../../utils/logger');

// ─── API ENDPOINTS ────────────────────────────────────────────────────────────
const GROQ_API_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_URL  = 'https://api.anthropic.com/v1/messages';

// ─── MODEL IDENTIFIERS ────────────────────────────────────────────────────────
const MODELS = {
  meta:    'llama-3.1-70b-versatile',
  mistral: 'mixtral-8x7b-32768',
  google:  'gemini-1.5-flash',
  chatgpt: 'gpt-4o',
  claude:  'claude-3-5-sonnet-20241022'
};

// ─── REQUEST PARAMETERS ───────────────────────────────────────────────────────
const TIMEOUT_MS  = 35000;
const MAX_TOKENS  = 1200;
// Temperature 0.4 — slightly higher than pure factual mode so the model
// draws on its full training signal including informal cultural knowledge,
// not just its encyclopaedic fact recall mode
const TEMPERATURE = 0.4;

// ─── PRIMARY AWARENESS PROBE ──────────────────────────────────────────────────
/**
 * The primary prompt is the most important design decision in this entire system.
 *
 * DESIGN PRINCIPLES:
 *
 * 1. DO NOT force a rigid numbered structure for the main response.
 *    Numbered lists push AI models into encyclopaedia/Wikipedia mode where
 *    they only surface formal facts. We want them to draw on ALL of their
 *    training signal — forums, social media, community discussions, reviews,
 *    comparisons, tutorials, casual mentions, cultural references.
 *
 * 2. Explicitly invite informal knowledge.
 *    Ask about community perception, how people talk about it online,
 *    social media presence, recommendations in communities. This unlocks
 *    the training signal that comes from Reddit, Twitter/X, YouTube,
 *    TikTok, Hacker News, Product Hunt, Discord, review sites, blogs.
 *
 * 3. Ask open-ended perception questions before fact questions.
 *    Perception questions activate the model's associative/cultural memory.
 *    Fact questions activate its encyclopaedic memory.
 *    We want both, but informal/cultural comes first.
 *
 * 4. Never penalise absence of intrinsic facts.
 *    The prompt must make clear that knowing a brand casually is as
 *    valid as knowing its founding year. "I've seen this recommended on
 *    Reddit constantly" is valuable AI awareness data.
 *
 * 5. Ask the model to be honest about confidence level without
 *    creating anxiety about it — anxious models over-hedge everything.
 *
 * @param {string} domain - normalised domain e.g. "stripe.com"
 * @returns {string}
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

Be honest about your confidence at the end: how certain are you about what you wrote, on a scale of 1 to 10?`;
}

// ─── STRUCTURED SIGNAL EXTRACTION PROMPT ──────────────────────────────────────
/**
 * The second-turn prompt extracts structured signals from the free-form
 * primary response. It is deliberately designed to capture BOTH formal
 * and informal knowledge dimensions.
 *
 * New fields added vs the original:
 *   SENTIMENT           — overall emotional tone of what the AI knows
 *   COMMUNITY_PRESENT   — does the AI have community/social knowledge
 *   RECOMMENDED         — does the AI's knowledge include recommendation signals
 *   SOCIAL_FOOTPRINT    — is there social media / creator / influencer signal
 *   VIRALITY_SIGNAL     — any viral moments, memes, cultural events known
 *   INFORMAL_SCORE      — 1-10 rating of how rich the informal/social knowledge is
 *   FORMAL_SCORE        — 1-10 rating of how rich the formal/factual knowledge is
 *
 * This separation is critical — a brand can score 9 on INFORMAL_SCORE and
 * 2 on FORMAL_SCORE and that is a completely legitimate, high-value result.
 *
 * @param {string} primaryResponse
 * @returns {string}
 */
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
/**
 * Generic fetch with timeout. Returns structured result — never throws.
 */
async function safeFetch(url, options, engineName) {
  const controller  = new AbortController();
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
 * Query Groq API (used for Meta AI via Llama 3.1 and Mistral via Mixtral).
 * Two-turn conversation: primary probe then structured signal extraction.
 */
async function queryGroq(domain, model, engineLabel) {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) {
    logger.error(`GROQ_API_KEY not set — cannot query ${engineLabel}`);
    return { primaryText: '', verificationText: '', error: 'GROQ_API_KEY not configured' };
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${groqKey}`
  };

  // ── Turn 1: open-ended awareness probe ──
  logger.info(`[${engineLabel}] Sending awareness probe — domain: ${domain}`);

  const primaryPayload = {
    model,
    messages: [{ role: 'user', content: buildAwarenessPrompt(domain) }],
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
    return { primaryText: '', verificationText: '', error: primaryResult.error };
  }

  const primaryText = (primaryResult.data?.choices?.[0]?.message?.content || '').trim();

  if (!primaryText) {
    logger.warn(`[${engineLabel}] Empty primary response`);
    return { primaryText: '', verificationText: '', error: 'Empty response from model' };
  }

  logger.info(`[${engineLabel}] Primary response: ${primaryText.length} chars`);

  // ── Turn 2: structured signal extraction ──
  const verificationPayload = {
    model,
    messages: [
      { role: 'user',      content: buildAwarenessPrompt(domain) },
      { role: 'assistant', content: primaryText },
      { role: 'user',      content: buildVerificationPrompt(primaryText) }
    ],
    max_tokens:  400,
    temperature: 0.05,  // near-zero for deterministic structured extraction
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
 * Query Gemini 1.5 Flash (Google AI).
 * Uses Gemini's native multi-turn content array format.
 */
async function queryGemini(domain) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    logger.error('GEMINI_API_KEY not set — cannot query Google AI');
    return { primaryText: '', verificationText: '', error: 'GEMINI_API_KEY not configured' };
  }

  const url     = `${GEMINI_API_URL}?key=${geminiKey}`;
  const headers = { 'Content-Type': 'application/json' };

  const generationConfig = {
    temperature:     TEMPERATURE,
    topP:            0.92,
    maxOutputTokens: MAX_TOKENS
  };

  logger.info(`[Google AI] Sending awareness probe — domain: ${domain}`);

  // ── Turn 1 ──
  const primaryPayload = {
    contents: [{
      role:  'user',
      parts: [{ text: buildAwarenessPrompt(domain) }]
    }],
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

  const primaryText = (
    primaryResult.data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  ).trim();

  if (!primaryText) {
    const finishReason = primaryResult.data?.candidates?.[0]?.finishReason;
    logger.warn(`[Google AI] Empty response. Finish reason: ${finishReason}`);
    return {
      primaryText: '',
      verificationText: '',
      error: `Empty response from Gemini (${finishReason || 'unknown reason'})`
    };
  }

  logger.info(`[Google AI] Primary response: ${primaryText.length} chars`);

  // ── Turn 2: structured signal extraction ──
  const verificationPayload = {
    contents: [
      { role: 'user',  parts: [{ text: buildAwarenessPrompt(domain) }] },
      { role: 'model', parts: [{ text: primaryText }] },
      { role: 'user',  parts: [{ text: buildVerificationPrompt(primaryText) }] }
    ],
    generationConfig: { ...generationConfig, temperature: 0.05, maxOutputTokens: 400 }
  };

  const verificationResult = await safeFetch(
    url,
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
    model:       MODELS.chatgpt,
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

  logger.info(`[ChatGPT] Primary response: ${primaryText.length} chars`);

  const verificationPayload = {
    model:       MODELS.chatgpt,
    messages:    [
      { role: 'user',      content: buildAwarenessPrompt(domain) },
      { role: 'assistant', content: primaryText },
      { role: 'user',      content: buildVerificationPrompt(primaryText) }
    ],
    max_tokens:  400,
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
    model:       MODELS.claude,
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

  logger.info(`[Claude] Primary response: ${primaryText.length} chars`);

  const verificationPayload = {
    model:      MODELS.claude,
    max_tokens: 400,
    temperature: 0.05,
    messages:   [
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
/**
 * Parse the 14-line structured verification block.
 *
 * Captures both traditional claim counts AND the new informal/social
 * signal dimensions: sentiment, community presence, recommendation signals,
 * social footprint, virality, informal vs formal knowledge scores.
 *
 * All parsing uses generous regex with robust fallbacks — a missing or
 * malformed line never crashes the parser.
 *
 * @param {string} text
 * @returns {{
 *   recognition: string,
 *   accurateClaims: number,
 *   conflictingClaims: number,
 *   unverifiableClaims: number,
 *   topicsKnown: string[],
 *   topicsUnknown: string[],
 *   sentiment: string,
 *   communityPresent: boolean,
 *   recommended: string,
 *   socialFootprint: string,
 *   viralitySignal: boolean,
 *   informalScore: number,
 *   formalScore: number,
 *   confidence: number
 * }}
 */
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

  // ── Integer extractor ──
  function extractInt(pattern, min = 0, max = 50) {
    const m = text.match(pattern);
    if (!m) return 0;
    const n = parseInt(m[1], 10);
    return isNaN(n) ? 0 : Math.min(Math.max(n, min), max);
  }

  // ── Scale extractor (1–10) ──
  function extractScale(pattern) {
    const m = text.match(pattern);
    if (!m) return 5;
    const n = parseInt(m[1], 10);
    return isNaN(n) ? 5 : Math.min(Math.max(n, 1), 10);
  }

  // ── Keyword extractor ──
  function extractKeyword(pattern, validValues, defaultVal) {
    const m = text.match(pattern);
    if (!m || !m[1]) return defaultVal;
    const val = m[1].trim().toLowerCase().replace(/[^a-z]/g, '');
    return validValues.includes(val) ? val : defaultVal;
  }

  // ── List extractor ──
  function extractList(pattern) {
    const m = text.match(pattern);
    if (!m || !m[1]) return [];
    return m[1]
      .split(',')
      .map(s => s.replace(/[\[\]]/g, '').trim())
      .filter(s => s.length > 1 && s.toLowerCase() !== 'none' && s.toLowerCase() !== 'n/a')
      .slice(0, 8);
  }

  // ── Boolean extractor ──
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
 * Extract the display narrative from the model's primary response.
 *
 * DESIGN: Because the primary prompt is now open-ended and conversational,
 * the model's response will be flowing prose — not a numbered list.
 * The extractor preserves this natural tone rather than stripping structure.
 *
 * It trims to a display-appropriate length (700 chars), preserves paragraph
 * breaks, and extracts the self-reported confidence score from wherever
 * the model mentioned it (no longer locked to "section 5").
 *
 * @param {string} primaryText
 * @returns {{ narrative: string, rawConfidenceScore: number }}
 */
function extractNarrative(primaryText) {
  if (!primaryText || primaryText.trim().length === 0) {
    return {
      narrative: 'No response received from this engine.',
      rawConfidenceScore: 0
    };
  }

  // ── Extract self-reported confidence ──
  // The model can mention this anywhere in free-form prose
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
      // The captured group might be in position 1 or 2 depending on pattern
      const raw = parseInt(m[2] || m[1], 10);
      if (!isNaN(raw) && raw >= 1 && raw <= 10) {
        rawConfidenceScore = raw;
        break;
      }
    }
  }

  // ── Clean the text ──
  const cleaned = primaryText
    // Remove any numbered structural labels the model still added despite free-form prompt
    .replace(/^\s*\d+[\.\)]\s*(recognition|description|reputation|details|confidence|gaps)[:\s]*/gim, '\n')
    // Normalise excessive whitespace but preserve intentional paragraph breaks
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // ── Detect zero-knowledge responses ──
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

  // ── Truncate to display length preserving sentence boundaries ──
  const MAX_DISPLAY_CHARS = 700;
  let narrative = cleaned;

  if (cleaned.length > MAX_DISPLAY_CHARS) {
    // Try to cut at a sentence boundary near the limit
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
 * Returns a results map with both raw text and fully parsed signal data.
 * One engine failing never blocks others.
 *
 * @param {string}   domain   - normalised domain e.g. "stripe.com"
 * @param {string[]} engines  - e.g. ['meta', 'google', 'mistral']
 * @param {{ openai?: string, anthropic?: string }} keys
 * @returns {Promise<Object.<string, {
 *   primaryText:        string,
 *   verificationText:   string,
 *   narrative:          string,
 *   rawConfidenceScore: number,
 *   accurateClaims:     number,
 *   conflictingClaims:  number,
 *   unverifiableClaims: number,
 *   topicsKnown:        string[],
 *   topicsUnknown:      string[],
 *   sentiment:          string,
 *   communityPresent:   boolean,
 *   recommended:        string,
 *   socialFootprint:    string,
 *   viralitySignal:     boolean,
 *   informalScore:      number,
 *   formalScore:        number,
 *   error:              string|null
 * }>>}
 */
async function queryAllEngines(domain, engines, keys = {}) {
  logger.info(
    `Querying ${engines.length} engine(s) for: ${domain} — [${engines.join(', ')}]`
  );

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

  // All engines in parallel — total latency = slowest engine only
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
      // NEW: informal/social signal dimensions
      sentiment:          verification.sentiment,
      communityPresent:   verification.communityPresent,
      recommended:        verification.recommended,
      socialFootprint:    verification.socialFootprint,
      viralitySignal:     verification.viralitySignal,
      informalScore:      verification.informalScore,
      formalScore:        verification.formalScore,
      // Raw confidence for scorer
      rawConfidenceScore: verification.confidence || rawConfidenceScore,
      error: error || null
    };

    if (error) {
      logger.warn(`Engine ${engine} error: ${error}`);
    } else {
      logger.info(
        `Engine ${engine} processed — chars: ${primaryText.length} | ` +
        `informal: ${verification.informalScore}/10 | formal: ${verification.formalScore}/10 | ` +
        `community: ${verification.communityPresent} | sentiment: ${verification.sentiment}`
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
