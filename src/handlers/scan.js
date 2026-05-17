'use strict';

const { fetchUrl } = require('../utils/fetch');
const { fingerprintTechnologies } = require('../detection/fingerprint');
const { analyseInfrastructure } = require('../analysis/infrastructure');
const { analyseSecurity } = require('../analysis/security');
const { analyseSeo } = require('../analysis/seo');
const { analysePerformance } = require('../analysis/performance');
const { classifyCluster } = require('../analysis/cluster');
const { buildPerScanGraph, enrichGraphWithClusters } = require('../analysis/graph');
const { generateIntelligence } = require('../analysis/intelligence');
const { incrementCoOccurrence } = require('../db/cooccurrence');
const { insertScan } = require('../db/scans');
const { getCached, setCached } = require('../db/cache');
const logger = require('../utils/logger');

function normaliseDomain(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
    .trim();
}

function buildCacheKey(domain, options) {
  const flags = [
    options.withGraph ? 'g' : '',
    options.withAI ? 'a' : '',
    options.withInfra ? 'i' : '',
    options.withSecurity ? 's' : '',
    options.rawEvidence ? 'r' : ''
  ].filter(Boolean).join('');
  return `scan:${domain}:${flags}`;
}

async function scanHandler(req, res) {
  const {
    url,
    withGraph = true,
    withAI = true,
    withInfra = true,
    withSecurity = true,
    rawEvidence = false,
    cacheBypass = false
  } = req.body;

  const domain = normaliseDomain(url);
  const t0 = Date.now();

  logger.info(`Scan started for domain: ${domain}`);

  try {
    // ── Step 1: Check server-side cache ──────────────────────────────────
    if (!cacheBypass) {
      const cacheKey = buildCacheKey(domain, { withGraph, withAI, withInfra, withSecurity, rawEvidence });
      const cached = await getCached(cacheKey);

      if (cached) {
        logger.info(`Cache HIT for ${domain} — returning cached result`);
        return res.status(200).json({
          ...cached,
          cached: true,
          latency: Date.now() - t0
        });
      }
    }

    // ── Step 2: Fetch the target website ─────────────────────────────────
    let fetchResult;
    try {
      fetchResult = await fetchUrl(domain);
    } catch (fetchErr) {
      logger.error(`Fetch failed for ${domain}: ${fetchErr.message}`);
      return res.status(502).json({
        error: `Could not reach ${domain} — ${fetchErr.message}`
      });
    }

    const { html, rawHeaders, finalUrl, fetchMs } = fetchResult;

    // ── Step 3: Fingerprint technologies ─────────────────────────────────
    const technologies = await fingerprintTechnologies(
      html,
      rawHeaders,
      finalUrl,
      { rawEvidence }
    );

    // ── Step 4: Run all analyses in parallel ──────────────────────────────
    const [
      infrastructure,
      security,
      seo,
      performance,
      cluster
    ] = await Promise.all([
      withInfra
        ? analyseInfrastructure(domain, rawHeaders)
        : Promise.resolve(null),
      withSecurity
        ? analyseSecurity(rawHeaders, html)
        : Promise.resolve(null),
      analyseSeo(html, finalUrl),
      analysePerformance(rawHeaders, finalUrl, fetchMs),
      classifyCluster(technologies)
    ]);

    // ── Step 5: Build graph ───────────────────────────────────────────────
    let graph = null;
    if (withGraph) {
      const rawGraph = buildPerScanGraph(technologies);
      graph = enrichGraphWithClusters(rawGraph, cluster);
    }

    // ── Step 6: Generate intelligence ─────────────────────────────────────
    const intelligence = withAI
      ? generateIntelligence(technologies, security, performance, seo, infrastructure, cluster)
      : null;

    // ── Step 7: Build response ────────────────────────────────────────────
    const latency = Date.now() - t0;
    const timestamp = Date.now();

    const response = {
      mode: 'scan',
      url: domain,
      finalUrl,
      latency,
      cached: false,
      timestamp,
      technologies,
      infrastructure,
      intelligence,
      graph,
      cluster,
      security,
      seo,
      performance,
      rawHeaders
    };

    // ── Step 8: Save to cache and database (non-blocking) ─────────────────
    const cacheKey = buildCacheKey(domain, { withGraph, withAI, withInfra, withSecurity, rawEvidence });

    Promise.all([
      setCached(cacheKey, response),
      insertScan({
        domain,
        url: finalUrl || domain,
        technologies,
        infrastructure: infrastructure || {},
        intelligence: intelligence || {},
        graph: graph || {},
        cluster: cluster || {},
        security: security || {},
        seo: seo || {},
        performance: performance || {},
        rawHeaders: rawHeaders || {},
        latency,
        cached: false
      }),
      technologies.length >= 2
        ? incrementCoOccurrence(technologies)
        : Promise.resolve()
    ]).catch(err => {
      logger.warn(`Background save error: ${err.message}`);
    });

    logger.info(`Scan complete for ${domain} — ${technologies.length} technologies, ${latency}ms`);

    return res.status(200).json(response);

  } catch (err) {
    logger.error(`Scan handler error for ${domain}: ${err.message}`);
    return res.status(500).json({
      error: `Scan failed for ${domain} — ${err.message}`
    });
  }
}

module.exports = scanHandler;
