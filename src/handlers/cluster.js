'use strict';

const { fetchUrl } = require('../utils/fetch');
const { fingerprintTechnologies } = require('../detection/fingerprint');
const { classifyCluster } = require('../analysis/cluster');
const { buildPerScanGraph, enrichGraphWithClusters } = require('../analysis/graph');
const { analyseInfrastructure } = require('../analysis/infrastructure');
const { analyseSecurity } = require('../analysis/security');
const { analysePerformance } = require('../analysis/performance');
const { analyseSeo } = require('../analysis/seo');
const { generateIntelligence } = require('../analysis/intelligence');
const { getAllClusters } = require('../db/clusters');
const { getCached, setCached } = require('../db/cache');
const { insertScan } = require('../db/scans');
const { incrementCoOccurrence } = require('../db/cooccurrence');
const logger = require('../utils/logger');

function normaliseDomain(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
    .trim();
}

function computeAllClusterScores(technologies, clusters) {
  const scanVector = {};
  for (const tech of technologies) {
    scanVector[tech.name] = tech.confidence;
  }

  const scores = [];

  for (const cluster of clusters) {
    const featureVector = cluster.feature_vector || {};
    const allKeys = new Set([
      ...Object.keys(scanVector),
      ...Object.keys(featureVector)
    ]);

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (const key of allKeys) {
      const a = scanVector[key] || 0;
      const b = featureVector[key] || 0;
      dotProduct += a * b;
      magnitudeA += a * a;
      magnitudeB += b * b;
    }

    const similarity = (magnitudeA === 0 || magnitudeB === 0)
      ? 0
      : dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));

    scores.push({
      id: cluster.cluster_id,
      name: cluster.name,
      description: cluster.description,
      confidence: parseFloat(similarity.toFixed(4)),
      adjacentClusters: cluster.adjacent_clusters || [],
      featureVector: cluster.feature_vector || {}
    });
  }

  return scores.sort((a, b) => b.confidence - a.confidence);
}

function generateClusterInsights(primaryCluster, allScores, technologies) {
  const insights = [];
  const names = technologies.map(t => t.name);

  if (primaryCluster.confidence >= 0.85) {
    insights.push(`Very strong cluster match — this website is a textbook example of a ${primaryCluster.name} architecture with ${Math.round(primaryCluster.confidence * 100)}% confidence`);
  } else if (primaryCluster.confidence >= 0.65) {
    insights.push(`Strong cluster match — this website clearly belongs to the ${primaryCluster.name} ecosystem at ${Math.round(primaryCluster.confidence * 100)}% confidence`);
  } else if (primaryCluster.confidence >= 0.45) {
    insights.push(`Moderate cluster match — this website leans toward ${primaryCluster.name} at ${Math.round(primaryCluster.confidence * 100)}% confidence but shows characteristics of multiple archetypes`);
  } else if (primaryCluster.confidence >= 0.20) {
    insights.push(`Weak cluster match — this website has some characteristics of ${primaryCluster.name} but does not fit cleanly into any single archetype`);
  } else {
    insights.push('This website uses an unusual or unique technology combination that does not match any known ecosystem archetype closely');
  }

  if (allScores.length >= 2) {
    const second = allScores[1];
    if (second.confidence >= 0.30) {
      insights.push(`Secondary archetype influence: ${second.name} at ${Math.round(second.confidence * 100)}% — this site borrows characteristics from both ecosystems`);
    }
  }

  if (allScores.length >= 3) {
    const third = allScores[2];
    if (third.confidence >= 0.20) {
      insights.push(`Tertiary archetype influence: ${third.name} at ${Math.round(third.confidence * 100)}%`);
    }
  }

  const definedTechs = Object.keys(primaryCluster.featureVector || {});
  const matchedTechs = names.filter(n => definedTechs.includes(n));
  const missingTechs = definedTechs.filter(n => !names.includes(n));

  if (matchedTechs.length > 0) {
    insights.push(`Technologies matching this archetype: ${matchedTechs.slice(0, 6).join(', ')}`);
  }

  if (missingTechs.length > 0 && missingTechs.length <= 4) {
    insights.push(`Technologies typical of this archetype not detected: ${missingTechs.join(', ')} — these may be present but undetected or deliberately excluded`);
  }

  return insights;
}

async function clusterHandler(req, res) {
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

  logger.info(`Cluster analysis started for: ${domain}`);

  try {
    const cacheKey = `cluster:${domain}`;

    if (!cacheBypass) {
      const cached = await getCached(cacheKey);
      if (cached) {
        logger.info(`Cache HIT for cluster: ${domain}`);
        return res.status(200).json({
          ...cached,
          cached: true,
          latency: Date.now() - t0
        });
      }
    }

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

    const technologies = await fingerprintTechnologies(
      html,
      rawHeaders,
      finalUrl,
      { rawEvidence }
    );

    const [
      allClusters,
      infrastructure,
      security,
      seo,
      performance
    ] = await Promise.all([
      getAllClusters(),
      withInfra
        ? analyseInfrastructure(domain, rawHeaders)
        : Promise.resolve(null),
      withSecurity
        ? analyseSecurity(rawHeaders, html)
        : Promise.resolve(null),
      analyseSeo(html, finalUrl),
      analysePerformance(rawHeaders, finalUrl, fetchMs)
    ]);

    const allScores = computeAllClusterScores(technologies, allClusters);
    const primaryCluster = allScores[0] || {
      id: 'unknown',
      name: 'Unknown',
      confidence: 0,
      description: 'No matching cluster found',
      adjacentClusters: []
    };

    const clusterInsights = generateClusterInsights(
      primaryCluster,
      allScores,
      technologies
    );

    const cluster = {
      id: primaryCluster.id,
      name: primaryCluster.name,
      confidence: primaryCluster.confidence,
      description: primaryCluster.description,
      adjacentClusters: primaryCluster.adjacentClusters,
      insights: clusterInsights,
      allScores: allScores.slice(0, 8).map(s => ({
        id: s.id,
        name: s.name,
        confidence: s.confidence
      }))
    };

    let graph = null;
    if (withGraph) {
      const rawGraph = buildPerScanGraph(technologies);
      graph = enrichGraphWithClusters(rawGraph, cluster);
    }

    const intelligence = withAI
      ? generateIntelligence(technologies, security, performance, seo, infrastructure, cluster)
      : null;

    const latency = Date.now() - t0;
    const timestamp = Date.now();

    const response = {
      mode: 'cluster',
      url: domain,
      finalUrl,
      latency,
      cached: false,
      timestamp,
      technologies,
      cluster,
      graph,
      infrastructure,
      intelligence,
      security,
      seo,
      performance,
      rawHeaders
    };

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

    logger.info(`Cluster analysis complete for ${domain} — ${primaryCluster.name} at ${primaryCluster.confidence}, ${latency}ms`);

    return res.status(200).json(response);

  } catch (err) {
    logger.error(`Cluster handler error for ${domain}: ${err.message}`);
    return res.status(500).json({
      error: `Cluster analysis failed for ${domain} — ${err.message}`
    });
  }
}

module.exports = clusterHandler;
