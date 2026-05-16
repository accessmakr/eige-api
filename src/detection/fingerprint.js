'use strict';

const { getAllPatterns } = require('../db/patterns');
const {
  matchHtmlSignals,
  matchHeaderSignals,
  matchScriptSignals,
  matchUrlSignals,
  extractVersion
} = require('./signals');
const { calculateConfidence, meetsThreshold, rankTechnologies } = require('./confidence');
const logger = require('../utils/logger');

async function fingerprintTechnologies(html, rawHeaders, finalUrl, options = {}) {
  try {
    const patterns = await getAllPatterns();

    if (!patterns || patterns.length === 0) {
      logger.warn('No patterns available for fingerprinting');
      return [];
    }

    logger.info(`Running fingerprint against ${patterns.length} technology patterns`);

    const detected = [];

    for (const pattern of patterns) {
      try {
        const htmlSignals = matchHtmlSignals(html, pattern.html_patterns || []);
        const headerSignals = matchHeaderSignals(rawHeaders, pattern.header_patterns || []);
        const scriptSignals = matchScriptSignals(html, pattern.script_patterns || []);
        const urlSignals = matchUrlSignals(finalUrl, pattern.url_patterns || []);

        const totalSignals = htmlSignals.count + headerSignals.count + scriptSignals.count + urlSignals.count;

        if (totalSignals === 0) continue;

        const version = extractVersion(html, rawHeaders, pattern.version_patterns || []);

        const signals = {
          html: htmlSignals,
          headers: headerSignals,
          scripts: scriptSignals,
          url: urlSignals
        };

        const confidence = calculateConfidence(signals, pattern, !!version);

        if (!meetsThreshold(confidence, pattern)) continue;

        const tech = {
          name: pattern.name,
          category: pattern.category,
          confidence,
          version: version || null,
          signals: {
            html: htmlSignals.count,
            headers: headerSignals.count,
            scripts: scriptSignals.count,
            url: urlSignals.count
          }
        };

        if (options.rawEvidence) {
          tech.evidence = {
            html: htmlSignals.evidence,
            headers: headerSignals.evidence,
            scripts: scriptSignals.evidence,
            url: urlSignals.evidence
          };
        }

        detected.push(tech);

      } catch (err) {
        logger.warn(`Error processing pattern ${pattern.name}: ${err.message}`);
        continue;
      }
    }

    const ranked = rankTechnologies(detected);
    logger.info(`Fingerprinting complete — ${ranked.length} technologies detected`);

    return ranked;

  } catch (err) {
    logger.error(`Fingerprinting failed: ${err.message}`);
    return [];
  }
}

module.exports = { fingerprintTechnologies };
