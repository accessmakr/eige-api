'use strict';

const HTML_WEIGHT = 0.35;
const HEADER_WEIGHT = 0.40;
const SCRIPT_WEIGHT = 0.30;
const URL_WEIGHT = 0.25;

const SIGNAL_BONUS = {
  multiple_html: 0.05,
  multiple_headers: 0.08,
  multiple_scripts: 0.06,
  has_version: 0.07,
  cross_signal: 0.10
};

const CATEGORY_MINIMUMS = {
  'JavaScript Framework': 0.45,
  'CMS': 0.40,
  'CDN': 0.35,
  'Analytics': 0.35,
  'E-Commerce': 0.40,
  'CSS Framework': 0.35,
  'Payment': 0.45,
  'Security': 0.35,
  'Hosting': 0.30,
  'Database': 0.40,
  'Tag Manager': 0.40,
  'Marketing': 0.35,
  'Customer Support': 0.35,
  'A/B Testing': 0.35,
  'Search': 0.35,
  'Video': 0.30,
  'Font': 0.25,
  'Map': 0.30,
  'Monitoring': 0.35,
  'DevOps': 0.35,
  'default': 0.30
};

function calculateConfidence(signals, pattern, hasVersion) {
  const htmlCount = signals.html.count || 0;
  const headerCount = signals.headers.count || 0;
  const scriptCount = signals.scripts.count || 0;
  const urlCount = signals.url.count || 0;

  const htmlWeight = pattern.html_weight || HTML_WEIGHT;
  const headerWeight = pattern.header_weight || HEADER_WEIGHT;
  const scriptWeight = pattern.script_weight || SCRIPT_WEIGHT;

  let base = 0;

  if (htmlCount > 0) base += Math.min(htmlCount, 5) * htmlWeight * 0.2;
  if (headerCount > 0) base += Math.min(headerCount, 3) * headerWeight * 0.35;
  if (scriptCount > 0) base += Math.min(scriptCount, 4) * scriptWeight * 0.25;
  if (urlCount > 0) base += Math.min(urlCount, 2) * URL_WEIGHT * 0.2;

  let bonus = 0;

  if (htmlCount > 1) bonus += SIGNAL_BONUS.multiple_html;
  if (headerCount > 1) bonus += SIGNAL_BONUS.multiple_headers;
  if (scriptCount > 1) bonus += SIGNAL_BONUS.multiple_scripts;
  if (hasVersion) bonus += SIGNAL_BONUS.has_version;

  const signalTypes = [htmlCount, headerCount, scriptCount, urlCount].filter(c => c > 0).length;
  if (signalTypes >= 2) bonus += SIGNAL_BONUS.cross_signal;
  if (signalTypes >= 3) bonus += SIGNAL_BONUS.cross_signal * 0.5;

  let confidence = Math.min(base + bonus, 1.0);

  const minConfidence = CATEGORY_MINIMUMS[pattern.category] || CATEGORY_MINIMUMS['default'];
  const patternMin = pattern.min_confidence || minConfidence;

  if (confidence > 0 && confidence < patternMin) {
    confidence = patternMin;
  }

  return parseFloat(confidence.toFixed(4));
}

function meetsThreshold(confidence, pattern) {
  const minConfidence = CATEGORY_MINIMUMS[pattern.category] || CATEGORY_MINIMUMS['default'];
  const threshold = pattern.min_confidence || minConfidence;
  return confidence >= threshold;
}

function rankTechnologies(technologies) {
  return technologies.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.name.localeCompare(b.name);
  });
}

module.exports = {
  calculateConfidence,
  meetsThreshold,
  rankTechnologies
};
