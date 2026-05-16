'use strict';

const logger = require('../utils/logger');

function matchHtmlSignals(html, patterns) {
  if (!html || !patterns || patterns.length === 0) return { count: 0, evidence: [] };

  const evidence = [];
  let count = 0;

  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern, 'gi');
      const matches = html.match(regex);
      if (matches && matches.length > 0) {
        count++;
        evidence.push(pattern);
      }
    } catch (err) {
      logger.warn(`Invalid HTML pattern: ${pattern} — ${err.message}`);
    }
  }

  return { count, evidence };
}

function matchHeaderSignals(rawHeaders, patterns) {
  if (!rawHeaders || !patterns || patterns.length === 0) return { count: 0, evidence: [] };

  const evidence = [];
  let count = 0;

  const headerString = Object.entries(rawHeaders)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')
    .toLowerCase();

  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern, 'gi');
      const matches = headerString.match(regex);
      if (matches && matches.length > 0) {
        count++;
        evidence.push(pattern);
      }
    } catch (err) {
      logger.warn(`Invalid header pattern: ${pattern} — ${err.message}`);
    }
  }

  return { count, evidence };
}

function matchScriptSignals(html, patterns) {
  if (!html || !patterns || patterns.length === 0) return { count: 0, evidence: [] };

  const evidence = [];
  let count = 0;

  const scriptRegex = /<script[^>]*src=["']([^"']+)["'][^>]*>/gi;
  const scriptUrls = [];
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
    scriptUrls.push(match[1].toLowerCase());
  }

  const scriptString = scriptUrls.join('\n');

  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern, 'gi');
      const matches = scriptString.match(regex);
      if (matches && matches.length > 0) {
        count++;
        evidence.push(pattern);
      }
    } catch (err) {
      logger.warn(`Invalid script pattern: ${pattern} — ${err.message}`);
    }
  }

  return { count, evidence };
}

function matchUrlSignals(finalUrl, patterns) {
  if (!finalUrl || !patterns || patterns.length === 0) return { count: 0, evidence: [] };

  const evidence = [];
  let count = 0;
  const lowerUrl = finalUrl.toLowerCase();

  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern, 'gi');
      const matches = lowerUrl.match(regex);
      if (matches && matches.length > 0) {
        count++;
        evidence.push(pattern);
      }
    } catch (err) {
      logger.warn(`Invalid URL pattern: ${pattern} — ${err.message}`);
    }
  }

  return { count, evidence };
}

function extractVersion(html, rawHeaders, versionPatterns) {
  if (!versionPatterns || versionPatterns.length === 0) return null;

  const searchTargets = [
    html || '',
    Object.entries(rawHeaders || {}).map(([k, v]) => `${k}: ${v}`).join('\n')
  ].join('\n');

  for (const pattern of versionPatterns) {
    try {
      const regex = new RegExp(pattern, 'i');
      const match = searchTargets.match(regex);
      if (match && match[1]) {
        return match[1].trim();
      }
    } catch (err) {
      logger.warn(`Invalid version pattern: ${pattern} — ${err.message}`);
    }
  }

  return null;
}

module.exports = {
  matchHtmlSignals,
  matchHeaderSignals,
  matchScriptSignals,
  matchUrlSignals,
  extractVersion
};
