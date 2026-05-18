'use strict';

const logger = require('../utils/logger');

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const VALID_MODES = ['scan', 'compare', 'cluster', 'telemetry', 'graph'];
const CURRENT_CLIENT_VERSION = 'v10';
const ACCEPTED_CLIENT_VERSIONS = ['v10'];

const MAX_URL_LENGTH = 253;
const MAX_DOMAIN_LABEL_LENGTH = 63;
const MIN_DOMAIN_LENGTH = 4;

// ─── BLOCKED DOMAIN PATTERNS ──────────────────────────────────────────────────
// These patterns are checked during request validation — before any
// database or network operations begin. Blocking them here is more
// efficient than letting them pass through the full scan pipeline
// only to be rejected by the learning job quality gates later.
// This is a defence-in-depth approach — both the validator and the
// quality gates independently reject these domains.

const BLOCKED_DOMAIN_PATTERNS = [
  /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^localhost/i,
  /\.local$/i,
  /\.test$/i,
  /\.internal$/i,
  /\.invalid$/i,
  /\.example$/i,
  /\.localhost$/i,
  /^127\./,
  /^192\.168\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^0\.0\.0\.0/,
  /^::1$/,
  /^fe80:/i
];

const BLOCKED_KEYWORDS = [
  'localhost', 'staging', 'sandbox', 'internal',
  'admin', 'backend', 'api-internal', 'private'
];

// ─── URL SANITISATION ─────────────────────────────────────────────────────────
// Extract and sanitise a domain from any URL format the user might provide.
// Returns null if the URL cannot be reduced to a valid domain.
// This runs before the domain blocklist check so we always work
// with a clean domain regardless of what format was submitted.

function sanitiseDomain(raw) {
  if (!raw || typeof raw !== 'string') return null;

  let domain = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/\?.*$/, '')
    .replace(/#.*$/, '')
    .replace(/:\d+$/, '')
    .trim();

  if (!domain) return null;
  if (domain.length > MAX_URL_LENGTH) return null;
  if (domain.length < MIN_DOMAIN_LENGTH) return null;

  const labels = domain.split('.');
  for (const label of labels) {
    if (label.length === 0) return null;
    if (label.length > MAX_DOMAIN_LABEL_LENGTH) return null;
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(label)) return null;
  }

  if (labels.length < 2) return null;

  const tld = labels[labels.length - 1];
  if (tld.length < 2) return null;
  if (!/^[a-z]+$/i.test(tld)) return null;

  return domain;
}

// ─── DOMAIN VALIDATION ────────────────────────────────────────────────────────
// Check the sanitised domain against the blocklist patterns and keywords.
// Returns an object with valid boolean and optional reason string.

function validateDomain(domain) {
  if (!domain) {
    return { valid: false, reason: 'Domain could not be extracted from the provided URL' };
  }

  for (const pattern of BLOCKED_DOMAIN_PATTERNS) {
    if (pattern.test(domain)) {
      return {
        valid: false,
        reason: `Domain "${domain}" is a private, local, or reserved address and cannot be scanned`
      };
    }
  }

  const domainLower = domain.toLowerCase();
  for (const keyword of BLOCKED_KEYWORDS) {
    if (domainLower.includes(keyword)) {
      return {
        valid: false,
        reason: `Domain "${domain}" appears to be an internal or development domain and cannot be scanned`
      };
    }
  }

  return { valid: true };
}

// ─── OPTION COERCION ──────────────────────────────────────────────────────────
// Coerce option values to booleans safely.
// The frontend sends these as true/false booleans but defensive coercion
// prevents type errors if a non-standard client sends strings or integers.

function coerceBoolean(value, defaultValue = false) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  return defaultValue;
}

// ─── SCAN MODE VALIDATION ─────────────────────────────────────────────────────

function validateScanMode(body, warnings) {
  const domain = sanitiseDomain(body.url);
  const domainCheck = validateDomain(domain);

  if (!domainCheck.valid) {
    return {
      valid: false,
      error: domainCheck.reason,
      code: 'ERR_INVALID_DOMAIN'
    };
  }

  body.url = domain;
  body.withGraph = coerceBoolean(body.withGraph, true);
  body.withAI = coerceBoolean(body.withAI, true);
  body.withInfra = coerceBoolean(body.withInfra, true);
  body.withSecurity = coerceBoolean(body.withSecurity, true);
  body.rawEvidence = coerceBoolean(body.rawEvidence, false);
  body.cacheBypass = coerceBoolean(body.cacheBypass, false);

  return { valid: true };
}

// ─── COMPARE MODE VALIDATION ──────────────────────────────────────────────────

function validateCompareMode(body, warnings) {
  if (!body.domains) {
    return {
      valid: false,
      error: 'compare mode requires a domains array',
      code: 'ERR_MISSING_DOMAINS'
    };
  }

  if (!Array.isArray(body.domains)) {
    return {
      valid: false,
      error: 'domains must be an array',
      code: 'ERR_INVALID_DOMAINS_FORMAT'
    };
  }

  if (body.domains.length !== 2) {
    return {
      valid: false,
      error: `compare mode requires exactly 2 domains — ${body.domains.length} provided`,
      code: 'ERR_WRONG_DOMAIN_COUNT'
    };
  }

  const sanitisedDomains = [];
  for (let i = 0; i < body.domains.length; i++) {
    const domain = sanitiseDomain(body.domains[i]);
    const domainCheck = validateDomain(domain);

    if (!domainCheck.valid) {
      return {
        valid: false,
        error: `Domain ${i + 1} is invalid: ${domainCheck.reason}`,
        code: 'ERR_INVALID_DOMAIN'
      };
    }

    sanitisedDomains.push(domain);
  }

  if (sanitisedDomains[0] === sanitisedDomains[1]) {
    return {
      valid: false,
      error: 'The two domains to compare must be different',
      code: 'ERR_DUPLICATE_DOMAINS'
    };
  }

  body.domains = sanitisedDomains;
  body.withGraph = coerceBoolean(body.withGraph, true);
  body.withAI = coerceBoolean(body.withAI, true);
  body.withInfra = coerceBoolean(body.withInfra, true);
  body.withSecurity = coerceBoolean(body.withSecurity, true);
  body.rawEvidence = coerceBoolean(body.rawEvidence, false);
  body.cacheBypass = coerceBoolean(body.cacheBypass, false);

  return { valid: true };
}

// ─── CLUSTER MODE VALIDATION ──────────────────────────────────────────────────

function validateClusterMode(body, warnings) {
  return validateScanMode(body, warnings);
}

// ─── TELEMETRY MODE VALIDATION ────────────────────────────────────────────────

function validateTelemetryMode(body, warnings) {
  return { valid: true };
}

// ─── GRAPH MODE VALIDATION ────────────────────────────────────────────────────

function validateGraphMode(body, warnings) {
  return { valid: true };
}

// ─── MODE VALIDATORS MAP ──────────────────────────────────────────────────────

const MODE_VALIDATORS = {
  scan: validateScanMode,
  compare: validateCompareMode,
  cluster: validateClusterMode,
  telemetry: validateTelemetryMode,
  graph: validateGraphMode
};

// ─── VALIDATE MIDDLEWARE ──────────────────────────────────────────────────────

function validate(req, res, next) {
  const body = req.body;
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const warnings = [];

  if (!body || typeof body !== 'object') {
    logger.warn(`[validate] Empty or non-object body from IP: ${ip}`);
    return res.status(400).json({
      error: 'Request body must be a JSON object',
      code: 'ERR_INVALID_BODY',
      timestamp: Date.now()
    });
  }

  const { mode, clientVersion } = body;

  if (!mode) {
    logger.warn(`[validate] Missing mode field from IP: ${ip}`);
    return res.status(400).json({
      error: 'mode is required',
      code: 'ERR_MISSING_MODE',
      validModes: VALID_MODES,
      timestamp: Date.now()
    });
  }

  if (typeof mode !== 'string') {
    return res.status(400).json({
      error: 'mode must be a string',
      code: 'ERR_INVALID_MODE_TYPE',
      timestamp: Date.now()
    });
  }

  const normalisedMode = mode.toLowerCase().trim();

  if (!VALID_MODES.includes(normalisedMode)) {
    logger.warn(`[validate] Invalid mode "${mode}" from IP: ${ip}`);
    return res.status(400).json({
      error: `Invalid mode "${mode}" — must be one of: ${VALID_MODES.join(', ')}`,
      code: 'ERR_INVALID_MODE',
      validModes: VALID_MODES,
      timestamp: Date.now()
    });
  }

  body.mode = normalisedMode;

  if (clientVersion && !ACCEPTED_CLIENT_VERSIONS.includes(clientVersion)) {
    warnings.push(
      `Client version "${clientVersion}" is not the current version "${CURRENT_CLIENT_VERSION}" — some features may behave differently`
    );
    logger.warn(`[validate] Outdated client version "${clientVersion}" from IP: ${ip}`);
  }

  const modeValidator = MODE_VALIDATORS[normalisedMode];
  const modeValidation = modeValidator(body, warnings);

  if (!modeValidation.valid) {
    logger.warn(`[validate] Mode validation failed for "${normalisedMode}" from IP: ${ip} — ${modeValidation.error}`);
    return res.status(400).json({
      error: modeValidation.error,
      code: modeValidation.code || 'ERR_VALIDATION_FAILED',
      mode: normalisedMode,
      timestamp: Date.now()
    });
  }

  if (warnings.length > 0) {
    res.locals.validationWarnings = warnings;
  }

  logger.info(`[validate] Request validated — mode: ${normalisedMode}, IP: ${ip}${warnings.length > 0 ? `, warnings: ${warnings.length}` : ''}`);

  next();
}

module.exports = validate;
