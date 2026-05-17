'use strict';

const scanHandler = require('./scan');
const { getCached, setCached } = require('../db/cache');
const logger = require('../utils/logger');

function normaliseDomain(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
    .trim();
}

function computeJaccardSimilarity(techsA, techsB) {
  const setA = new Set(techsA.map(t => t.name));
  const setB = new Set(techsB.map(t => t.name));

  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  if (union.size === 0) return 0;
  return parseFloat((intersection.size / union.size).toFixed(4));
}

function computeOverlap(techsA, techsB) {
  const setB = new Set(techsB.map(t => t.name));
  return techsA
    .filter(t => setB.has(t.name))
    .map(t => ({
      name: t.name,
      category: t.category,
      confidenceA: t.confidence,
      confidenceB: techsB.find(tb => tb.name === t.name)?.confidence || 0
    }));
}

function computeDivergence(techsA, techsB, domainA, domainB) {
  const setA = new Set(techsA.map(t => t.name));
  const setB = new Set(techsB.map(t => t.name));

  const uniqueToA = techsA
    .filter(t => !setB.has(t.name))
    .map(t => ({ name: t.name, category: t.category, confidence: t.confidence }));

  const uniqueToB = techsB
    .filter(t => !setA.has(t.name))
    .map(t => ({ name: t.name, category: t.category, confidence: t.confidence }));

  return {
    [domainA]: uniqueToA,
    [domainB]: uniqueToB
  };
}

function computeCategoryComparison(techsA, techsB) {
  const categoriesA = {};
  const categoriesB = {};

  for (const tech of techsA) {
    if (!categoriesA[tech.category]) categoriesA[tech.category] = [];
    categoriesA[tech.category].push(tech.name);
  }

  for (const tech of techsB) {
    if (!categoriesB[tech.category]) categoriesB[tech.category] = [];
    categoriesB[tech.category].push(tech.name);
  }

  const allCategories = new Set([
    ...Object.keys(categoriesA),
    ...Object.keys(categoriesB)
  ]);

  const comparison = {};
  for (const category of allCategories) {
    comparison[category] = {
      a: categoriesA[category] || [],
      b: categoriesB[category] || []
    };
  }

  return comparison;
}

function generateComparisonInsights(domainA, domainB, techsA, techsB, similarity, overlap, divergence) {
  const insights = [];
  const namesA = techsA.map(t => t.name);
  const namesB = techsB.map(t => t.name);

  if (similarity >= 0.80) {
    insights.push(`${domainA} and ${domainB} run nearly identical technology stacks with ${Math.round(similarity * 100)}% similarity — they are direct technical competitors using the same tools`);
  } else if (similarity >= 0.60) {
    insights.push(`${domainA} and ${domainB} share significant technical overlap at ${Math.round(similarity * 100)}% similarity — similar architectural approach with some differentiation`);
  } else if (similarity >= 0.40) {
    insights.push(`${domainA} and ${domainB} have moderate stack similarity at ${Math.round(similarity * 100)}% — same broad category of tools but different specific choices`);
  } else if (similarity >= 0.20) {
    insights.push(`${domainA} and ${domainB} have low stack similarity at ${Math.round(similarity * 100)}% — meaningfully different technical approaches`);
  } else {
    insights.push(`${domainA} and ${domainB} have very little technical overlap at ${Math.round(similarity * 100)}% similarity — fundamentally different technology stacks`);
  }

  if (overlap.length > 0) {
    const sharedNames = overlap.slice(0, 5).map(o => o.name).join(', ');
    insights.push(`Both sites share: ${sharedNames}${overlap.length > 5 ? ` and ${overlap.length - 5} more` : ''}`);
  }

  if (namesA.includes('Next.js') && !namesB.includes('Next.js') && !namesB.includes('Nuxt.js')) {
    insights.push(`${domainA} uses Next.js for server-side rendering — ${domainB} does not, which may give ${domainA} an SEO and performance advantage`);
  }

  if (namesB.includes('Next.js') && !namesA.includes('Next.js') && !namesA.includes('Nuxt.js')) {
    insights.push(`${domainB} uses Next.js for server-side rendering — ${domainA} does not, which may give ${domainB} an SEO and performance advantage`);
  }

  if (namesA.includes('Cloudflare') && !namesB.includes('Cloudflare')) {
    insights.push(`${domainA} is protected by Cloudflare — ${domainB} lacks this layer of CDN and security protection`);
  }

  if (namesB.includes('Cloudflare') && !namesA.includes('Cloudflare')) {
    insights.push(`${domainB} is protected by Cloudflare — ${domainA} lacks this layer of CDN and security protection`);
  }

  if (namesA.includes('Stripe') && namesB.includes('Stripe')) {
    insights.push('Both sites use Stripe for payment processing — identical payment infrastructure');
  }

  if (namesA.includes('Segment') && !namesB.includes('Segment')) {
    insights.push(`${domainA} uses Segment for centralised analytics — a more sophisticated data architecture than ${domainB}`);
  }

  if (namesB.includes('Segment') && !namesA.includes('Segment')) {
    insights.push(`${domainB} uses Segment for centralised analytics — a more sophisticated data architecture than ${domainA}`);
  }

  const techCountDiff = techsA.length - techsB.length;
  if (Math.abs(techCountDiff) >= 5) {
    const richer = techCountDiff > 0 ? domainA : domainB;
    const leaner = techCountDiff > 0 ? domainB : domainA;
    insights.push(`${richer} has a significantly larger technology footprint — ${Math.abs(techCountDiff)} more technologies detected than ${leaner}`);
  }

  return insights;
}

async function compareHandler(req, res) {
  const {
    domains,
    withGraph = true,
    withAI = true,
    withInfra = true,
    withSecurity = true,
    rawEvidence = false,
    cacheBypass = false
  } = req.body;

  const domainA = normaliseDomain(domains[0]);
  const domainB = normaliseDomain(domains[1]);
  const t0 = Date.now();

  logger.info(`Compare started: ${domainA} vs ${domainB}`);

  try {
    const cacheKey = `compare:${[domainA, domainB].sort().join(':')}`;

    if (!cacheBypass) {
      const cached = await getCached(cacheKey);
      if (cached) {
        logger.info(`Cache HIT for compare: ${domainA} vs ${domainB}`);
        return res.status(200).json({
          ...cached,
          cached: true,
          latency: Date.now() - t0
        });
      }
    }

    const [resultA, resultB] = await Promise.all([
      new Promise((resolve) => {
        const fakeReq = {
          body: {
            mode: 'scan',
            url: domainA,
            withGraph,
            withAI,
            withInfra,
            withSecurity,
            rawEvidence,
            cacheBypass
          }
        };
        const fakeRes = {
          status: () => ({
            json: (data) => resolve(data)
          })
        };
        scanHandler(fakeReq, fakeRes);
      }),
      new Promise((resolve) => {
        const fakeReq = {
          body: {
            mode: 'scan',
            url: domainB,
            withGraph,
            withAI,
            withInfra,
            withSecurity,
            rawEvidence,
            cacheBypass
          }
        };
        const fakeRes = {
          status: () => ({
            json: (data) => resolve(data)
          })
        };
        scanHandler(fakeReq, fakeRes);
      })
    ]);

    const techsA = resultA.technologies || [];
    const techsB = resultB.technologies || [];

    const similarity = computeJaccardSimilarity(techsA, techsB);
    const overlap = computeOverlap(techsA, techsB);
    const divergence = computeDivergence(techsA, techsB, domainA, domainB);
    const categoryComparison = computeCategoryComparison(techsA, techsB);
    const insights = generateComparisonInsights(
      domainA,
      domainB,
      techsA,
      techsB,
      similarity,
      overlap,
      divergence
    );

    const latency = Date.now() - t0;
    const timestamp = Date.now();

    const response = {
      mode: 'compare',
      domains: [domainA, domainB],
      latency,
      cached: false,
      timestamp,
      similarity,
      overlap,
      divergence,
      categoryComparison,
      insights,
      ecosystem: {
        [domainA]: {
          technologies: techsA,
          infrastructure: resultA.infrastructure,
          intelligence: resultA.intelligence,
          cluster: resultA.cluster,
          security: resultA.security,
          seo: resultA.seo,
          performance: resultA.performance
        },
        [domainB]: {
          technologies: techsB,
          infrastructure: resultB.infrastructure,
          intelligence: resultB.intelligence,
          cluster: resultB.cluster,
          security: resultB.security,
          seo: resultB.seo,
          performance: resultB.performance
        }
      }
    };

    setCached(cacheKey, response).catch(err => {
      logger.warn(`Compare cache save error: ${err.message}`);
    });

    logger.info(`Compare complete: ${domainA} vs ${domainB} — similarity: ${similarity}, ${latency}ms`);

    return res.status(200).json(response);

  } catch (err) {
    logger.error(`Compare handler error: ${err.message}`);
    return res.status(500).json({
      error: `Comparison failed — ${err.message}`
    });
  }
}

module.exports = compareHandler;
