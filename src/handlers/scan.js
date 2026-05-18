'use strict';

// ─── DEPENDENCIES ─────────────────────────────────────────────────────────────

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
const { insertScan, getScansByDomain } = require('../db/scans');
const { getCached, setCached } = require('../db/cache');
const { updateTechIntelligenceFromScan } = require('../db/intelligence');
const logger = require('../utils/logger');

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const SCAN_VERSION = 'v10.0.0';

// ─── URL NORMALISATION ────────────────────────────────────────────────────────
// Normalise any URL format the user might paste into a clean hostname.
// Handles: https://stripe.com/pricing → stripe.com
//          http://www.stripe.com → stripe.com
//          stripe.com/about → stripe.com
//          STRIPE.COM → stripe.com

function normaliseDomain(url) {
  if (!url || typeof url !== 'string') return null;

  return url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .replace(/\?.*$/, '')
    .replace(/#.*$/, '')
    .trim();
}

// ─── CACHE KEY BUILDER ────────────────────────────────────────────────────────
// Build a deterministic cache key from the domain and all option flags.
// Any change in options produces a different cache key so a cached result
// with withGraph=false is never served when withGraph=true is requested.

function buildCacheKey(domain, options) {
  const flags = [
    options.withGraph ? 'g' : '_',
    options.withAI ? 'a' : '_',
    options.withInfra ? 'i' : '_',
    options.withSecurity ? 's' : '_',
    options.rawEvidence ? 'r' : '_'
  ].join('');

  return `scan:${domain}:${flags}`;
}

// ─── REQUEST ID GENERATOR ─────────────────────────────────────────────────────
// Generate a unique ID for each scan request for distributed tracing.
// This ID appears in all log entries for the request so the full lifecycle
// of any scan can be traced through the logs by filtering on this ID.

function generateRequestId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `scan_${timestamp}_${random}`;
}

// ─── QUALITY PRE-SCORER ───────────────────────────────────────────────────────
// Calculate a preliminary quality score for the scan result before saving.
// This score is stored with the scan record so the learning job can filter
// efficiently without recalculating quality for every historical scan.
// This is a fast approximation — the learning job applies the full 7-gate
// quality system. The pre-score filters out obvious low-quality results early.

function calculateScanQualityPreScore(technologies, seo, performance, security) {
  let score = 0;

  if (seo) {
    if (seo.title?.status === 'ok') score += 10;
    else if (seo.title?.status === 'warn') score += 5;
    if (seo.description?.status === 'ok') score += 10;
    else if (seo.description?.status === 'warn') score += 5;
    if (seo.canonical?.status === 'ok') score += 5;
    if (seo.viewport?.status === 'ok') score += 5;
    if (seo.og && Object.keys(seo.og).length >= 3) score += 5;
    if (seo.structured?.length > 0) score += 10;
    if (seo.links && (seo.links.internal + seo.links.external) > 5) score += 5;
  }

  if (technologies.length > 5) score += 15;
  else if (technologies.length >= 3) score += 8;

  const hasAnalytics = technologies.some(t =>
    ['Google Analytics', 'Segment', 'Plausible', 'Fathom Analytics',
      'Mixpanel', 'Amplitude', 'PostHog'].includes(t.name)
  );
  if (hasAnalytics) score += 10;

  const primaryTech = technologies[0];
  if (primaryTech?.confidence >= 0.6) score += 10;

  if (security) {
    const headers = security.headers || {};
    const presentCount = Object.values(headers)
      .filter(h => h?.status === 'present').length;
    if (presentCount >= 4) score += 10;
    else if (presentCount >= 2) score += 5;
  }

  if (performance?.https?.https) score += 10;
  if (performance?.fetchMs < 800) score += 5;
  else if (performance?.fetchMs < 2000) score += 2;

  return Math.min(score, 100);
}

// ─── CHANGE DETECTION ─────────────────────────────────────────────────────────
// Compare the current scan against the most recent previous scan of the
// same domain to detect stack changes. This powers the stack change
// detection feature — one of the five Phase 2 features planned.
// Running this comparison on every scan means the data is always ready
// when the history endpoint is implemented in Phase 2.

function detectStackChanges(currentTechs, previousScan) {
  if (!previousScan || !previousScan.technologies) {
    return null;
  }

  const currentNames = new Set(currentTechs.map(t => t.name));
  const previousNames = new Set(previousScan.technologies.map(t => t.name));

  const added = currentTechs
    .filter(t => !previousNames.has(t.name))
    .map(t => ({ name: t.name, category: t.category, confidence: t.confidence }));

  const removed = previousScan.technologies
    .filter(t => !currentNames.has(t.name))
    .map(t => ({ name: t.name, category: t.category, confidence: t.confidence }));

  const confidenceChanges = currentTechs
    .filter(t => previousNames.has(t.name))
    .map(t => {
      const prev = previousScan.technologies.find(p => p.name === t.name);
      if (!prev) return null;
      const delta = t.confidence - prev.confidence;
      if (Math.abs(delta) < 0.15) return null;
      return {
        name: t.name,
        category: t.category,
        previousConfidence: prev.confidence,
        currentConfidence: t.confidence,
        delta: parseFloat(delta.toFixed(3)),
        direction: delta > 0 ? 'increased' : 'decreased'
      };
    })
    .filter(Boolean);

  const hasChanges = added.length > 0 || removed.length > 0 || confidenceChanges.length > 0;

  if (!hasChanges) {
    return {
      hasChanges: false,
      previousScanDate: previousScan.created_at,
      daysSinceLastScan: Math.round(
        (Date.now() - new Date(previousScan.created_at).getTime()) / 86400000
      ),
      message: 'No stack changes detected since last scan'
    };
  }

  return {
    hasChanges: true,
    previousScanDate: previousScan.created_at,
    daysSinceLastScan: Math.round(
      (Date.now() - new Date(previousScan.created_at).getTime()) / 86400000
    ),
    added,
    removed,
    confidenceChanges,
    summary: `${added.length} added, ${removed.length} removed, ${confidenceChanges.length} confidence changes`
  };
}

// ─── SCAN HANDLER ─────────────────────────────────────────────────────────────

async function scanHandler(req, res) {
  const requestId = generateRequestId();
  const t0 = Date.now();

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

  if (!domain) {
    logger.warn(`[${requestId}] Invalid domain provided: ${url}`);
    return res.status(400).json({
      error: 'Invalid domain — could not extract a valid hostname from the provided URL',
      requestId,
      timestamp: Date.now()
    });
  }

  logger.info(`[${requestId}] Scan started — domain: ${domain}, options: graph=${withGraph} ai=${withAI} infra=${withInfra} security=${withSecurity} evidence=${rawEvidence} bypass=${cacheBypass}`);

  try {

    // ── STEP 1 — Server-side cache check ──────────────────────────────────────
    // Check the cache before doing any work. If a fresh cached result exists
    // and cacheBypass is not requested, return it immediately.
    // The cache key encodes all options so cached results are always option-specific.

    if (!cacheBypass) {
      const cacheKey = buildCacheKey(domain, {
        withGraph, withAI, withInfra, withSecurity, rawEvidence
      });

      const cached = await getCached(cacheKey);

      if (cached) {
        const cacheAge = Date.now() - (cached.timestamp || 0);
        logger.info(`[${requestId}] Cache HIT for ${domain} — age: ${Math.round(cacheAge / 1000)}s`);

        return res.status(200).json({
          ...cached,
          cached: true,
          cacheAge,
          latency: Date.now() - t0,
          requestId
        });
      }

      logger.info(`[${requestId}] Cache MISS for ${domain} — proceeding with full scan`);
    }

    // ── STEP 2 — Fetch previous scan for change detection ─────────────────────
    // Fetch the most recent previous scan of this domain before we start
    // the current scan. We do this early so it runs in parallel with the
    // website fetch in Step 3. Change detection is a Phase 2 feature but
    // collecting the data now means no backfill is needed when we build it.

    const previousScanPromise = getScansByDomain(domain, 1);

    // ── STEP 3 — Fetch the target website ─────────────────────────────────────
    // Make an HTTP GET to the target domain with browser-like headers.
    // A failed fetch returns a 502 error — the website is unreachable
    // and no analysis can proceed.

    let fetchResult;
    try {
      logger.info(`[${requestId}] Fetching ${domain}`);
      fetchResult = await fetchUrl(domain);
      logger.info(`[${requestId}] Fetch complete — ${fetchResult.fetchMs}ms, status ${fetchResult.status}, ${fetchResult.html.length} bytes`);
    } catch (fetchErr) {
      logger.error(`[${requestId}] Fetch failed for ${domain}: ${fetchErr.message}`);
      return res.status(502).json({
        error: `Could not reach ${domain} — ${fetchErr.message}`,
        requestId,
        timestamp: Date.now(),
        hints: [
          'Verify the domain is spelled correctly',
          'The site may be behind authentication or bot protection',
          'The site may be temporarily unavailable',
          'The site may be blocking automated requests'
        ]
      });
    }

    const { html, rawHeaders, finalUrl, fetchMs } = fetchResult;

    // ── STEP 4 — Technology fingerprinting ────────────────────────────────────
    // Run all technology patterns against the fetched HTML and headers.
    // This is the core detection step — every other analysis depends on
    // knowing what technologies are present.

    logger.info(`[${requestId}] Starting technology fingerprinting`);
    const technologies = await fingerprintTechnologies(
      html,
      rawHeaders,
      finalUrl,
      { rawEvidence }
    );
    logger.info(`[${requestId}] Fingerprinting complete — ${technologies.length} technologies detected`);

    // ── STEP 5 — Parallel analysis ────────────────────────────────────────────
    // Run all five analysis engines simultaneously using Promise.all.
    // Each engine is independent — there is no reason to run them sequentially.
    // Running in parallel reduces total analysis time significantly.
    // The previous scan fetch from Step 2 also resolves here.

    logger.info(`[${requestId}] Starting parallel analysis — infrastructure, security, SEO, performance, cluster, previous scan`);

    const [
      infrastructure,
      security,
      seo,
      performance,
      cluster,
      previousScans
    ] = await Promise.all([
      withInfra
        ? analyseInfrastructure(domain, rawHeaders)
        : Promise.resolve(null),
      withSecurity
        ? analyseSecurity(rawHeaders, html)
        : Promise.resolve(null),
      analyseSeo(html, finalUrl),
      analysePerformance(rawHeaders, finalUrl, fetchMs),
      classifyCluster(technologies),
      previousScanPromise
    ]);

    logger.info(`[${requestId}] Parallel analysis complete — cluster: ${cluster?.name}, security risk: ${security?.riskScore}`);

    // ── STEP 6 — Stack change detection ──────────────────────────────────────
    // Compare current scan against the most recent previous scan.
    // Returns null if this is the first scan of this domain.
    // Returns a detailed change object if technologies have changed.

    const previousScan = previousScans && previousScans.length > 0
      ? previousScans[0]
      : null;

    const stackChanges = detectStackChanges(technologies, previousScan);

    if (stackChanges?.hasChanges) {
      logger.info(`[${requestId}] Stack changes detected for ${domain} — ${stackChanges.summary}`);
    }

    // ── STEP 7 — Graph construction ───────────────────────────────────────────
    // Build the per-scan technology relationship graph.
    // Nodes are detected technologies sized by confidence.
    // Edges connect all technology pairs weighted by average confidence.
    // Cluster metadata is injected into all nodes for visual grouping.

    let graph = null;
    if (withGraph && technologies.length > 0) {
      logger.info(`[${requestId}] Building technology relationship graph`);
      const rawGraph = buildPerScanGraph(technologies);
      graph = enrichGraphWithClusters(rawGraph, cluster);
      logger.info(`[${requestId}] Graph built — ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
    }

    // ── STEP 8 — Intelligence generation ─────────────────────────────────────
    // Generate the AI intelligence report from the knowledge base.
    // This reads from tech_intelligence, architecture_patterns, and
    // industry_benchmarks to produce specific, evidence-based analysis.
    // Falls back to rule-based generation if the knowledge base is empty.

    let intelligence = null;
    if (withAI) {
      logger.info(`[${requestId}] Generating intelligence from knowledge base`);
      intelligence = await generateIntelligence(
        technologies,
        security,
        performance,
        seo,
        infrastructure,
        cluster
      );
      logger.info(`[${requestId}] Intelligence generated — maturity: ${intelligence?.maturityScore}, strengths: ${intelligence?.strengths?.length}, weaknesses: ${intelligence?.weaknesses?.length}`);
    }

    // ── STEP 9 — Quality pre-scoring ─────────────────────────────────────────
    // Calculate a preliminary quality score for this scan result.
    // Stored with the scan record so the learning job can filter efficiently.
    // High-quality scans (score >= 60) contribute to the learning database.
    // Low-quality scans are stored but excluded from intelligence updates.

    const qualityScore = calculateScanQualityPreScore(
      technologies, seo, performance, security
    );

    logger.info(`[${requestId}] Quality pre-score: ${qualityScore}/100 — ${qualityScore >= 60 ? 'qualifies for learning' : 'below learning threshold'}`);

    // ── STEP 10 — Assemble response ────────────────────────────────────────────
    // Build the complete response object from all analysis results.
    // Every field that the frontend expects must be present here.
    // Null values are acceptable for optional analyses that were not requested.

    const latency = Date.now() - t0;
    const timestamp = Date.now();

    const response = {
      mode: 'scan',
      requestId,
      scanVersion: SCAN_VERSION,
      url: domain,
      finalUrl: finalUrl || `https://${domain}`,
      latency,
      cached: false,
      timestamp,
      timestampFormatted: new Date(timestamp).toISOString(),
      qualityScore,
      technologies,
      infrastructure,
      intelligence,
      graph,
      cluster,
      security,
      seo,
      performance,
      stackChanges,
      rawHeaders
    };

    // ── STEP 11 — Background persistence ──────────────────────────────────────
    // Save to cache, database, and update learning tables in the background.
    // These operations happen AFTER the response is sent so the user never
    // waits for database writes. Errors here are logged but never affect
    // the response the user receives.
    // The co-occurrence table is only updated from quality-passing scans
    // to enforce the same quality standards as the learning job's Gate 5.

    const cacheKey = buildCacheKey(domain, {
      withGraph, withAI, withInfra, withSecurity, rawEvidence
    });

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
        cached: false,
        qualityScore,
        stackChanges: stackChanges || {}
      }),

      qualityScore >= 60 && technologies.length >= 2
        ? incrementCoOccurrence(technologies)
        : Promise.resolve(),

      qualityScore >= 60
        ? updateTechIntelligenceFromScan(technologies)
        : Promise.resolve()

    ]).catch(err => {
      logger.warn(`[${requestId}] Background persistence error: ${err.message}`);
    });

    logger.info(`[${requestId}] Scan complete — ${domain}, ${technologies.length} techs, quality: ${qualityScore}/100, ${latency}ms`);

    return res.status(200).json(response);

  } catch (err) {
    const latency = Date.now() - t0;
    logger.error(`[${requestId}] Scan handler error for ${domain}: ${err.message}`);
    logger.error(`[${requestId}] Stack: ${err.stack}`);

    return res.status(500).json({
      error: `Scan failed for ${domain} — ${err.message}`,
      requestId,
      timestamp: Date.now(),
      latency
    });
  }
}

module.exports = scanHandler;
