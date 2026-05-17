'use strict';

const supabase = require('./supabase');
const logger = require('../utils/logger');

let cachedTechIntelligence = null;
let cachedArchitecturePatterns = null;
let cachedIndustryBenchmarks = null;
let techIntelligenceCacheTime = null;
let architecturePatternsCacheTime = null;
let industryBenchmarksCacheTime = null;
const INTELLIGENCE_CACHE_MS = 3600000;

async function getTechIntelligence(techName) {
  try {
    const now = Date.now();

    if (!cachedTechIntelligence || !techIntelligenceCacheTime || (now - techIntelligenceCacheTime) > INTELLIGENCE_CACHE_MS) {
      logger.info('Loading tech intelligence from Supabase');

      const { data, error } = await supabase
        .from('tech_intelligence')
        .select('*');

      if (error) throw new Error(error.message);

      cachedTechIntelligence = {};
      if (data) {
        for (const row of data) {
          cachedTechIntelligence[row.name] = row;
        }
      }

      techIntelligenceCacheTime = now;
      logger.info(`Loaded ${Object.keys(cachedTechIntelligence).length} tech intelligence profiles`);
    }

    if (techName) {
      return cachedTechIntelligence[techName] || null;
    }

    return cachedTechIntelligence;

  } catch (err) {
    logger.warn(`Tech intelligence load error: ${err.message}`);
    return techName ? null : {};
  }
}

async function getArchitecturePatterns() {
  try {
    const now = Date.now();

    if (!cachedArchitecturePatterns || !architecturePatternsCacheTime || (now - architecturePatternsCacheTime) > INTELLIGENCE_CACHE_MS) {
      logger.info('Loading architecture patterns from Supabase');

      const { data, error } = await supabase
        .from('architecture_patterns')
        .select('*');

      if (error) throw new Error(error.message);

      cachedArchitecturePatterns = data || [];
      architecturePatternsCacheTime = now;
      logger.info(`Loaded ${cachedArchitecturePatterns.length} architecture patterns`);
    }

    return cachedArchitecturePatterns;

  } catch (err) {
    logger.warn(`Architecture patterns load error: ${err.message}`);
    return [];
  }
}

async function getIndustryBenchmarks() {
  try {
    const now = Date.now();

    if (!cachedIndustryBenchmarks || !industryBenchmarksCacheTime || (now - industryBenchmarksCacheTime) > INTELLIGENCE_CACHE_MS) {
      logger.info('Loading industry benchmarks from Supabase');

      const { data, error } = await supabase
        .from('industry_benchmarks')
        .select('*');

      if (error) throw new Error(error.message);

      cachedIndustryBenchmarks = {};
      if (data) {
        for (const row of data) {
          cachedIndustryBenchmarks[row.industry] = row;
        }
      }

      industryBenchmarksCacheTime = now;
      logger.info(`Loaded ${Object.keys(cachedIndustryBenchmarks).length} industry benchmarks`);
    }

    return cachedIndustryBenchmarks;

  } catch (err) {
    logger.warn(`Industry benchmarks load error: ${err.message}`);
    return {};
  }
}

async function findBestArchitecturePattern(technologies) {
  try {
    const patterns = await getArchitecturePatterns();
    if (!patterns || patterns.length === 0) return null;

    const techNames = new Set(technologies.map(t => t.name));
    const scores = [];

    for (const pattern of patterns) {
      const patternTechs = pattern.technologies || [];
      if (patternTechs.length === 0) continue;

      const matches = patternTechs.filter(t => techNames.has(t)).length;
      const minMatch = pattern.min_match || 2;

      if (matches < minMatch) continue;

      const score = matches / patternTechs.length;
      scores.push({ pattern, score, matches });
    }

    if (scores.length === 0) return null;

    scores.sort((a, b) => b.score - a.score);
    return scores[0].pattern;

  } catch (err) {
    logger.warn(`Architecture pattern match error: ${err.message}`);
    return null;
  }
}

async function findIndustryBenchmark(clusterName) {
  try {
    const benchmarks = await getIndustryBenchmarks();
    if (!benchmarks || Object.keys(benchmarks).length === 0) return null;

    const clusterToIndustry = {
      'JAMstack React': 'SaaS',
      'JAMstack Vue': 'SaaS',
      'JAMstack Astro': 'Media',
      'Modern SPA': 'SaaS',
      'WordPress Standard': 'SMB',
      'WordPress E-Commerce': 'E-Commerce',
      'Shopify Commerce': 'E-Commerce',
      'Headless Commerce': 'E-Commerce',
      'Enterprise SaaS': 'Enterprise',
      'Enterprise Commerce': 'Enterprise',
      'Traditional CMS': 'Government',
      'Headless CMS': 'Media',
      'Static Site': 'Personal',
      'Webflow Site': 'Agency',
      'Squarespace Site': 'SMB',
      'Wix Site': 'SMB',
      'Ruby on Rails': 'SaaS',
      'Django Python': 'SaaS',
      'Laravel PHP': 'Agency',
      'Node.js Express': 'SaaS'
    };

    const industry = clusterToIndustry[clusterName] || null;
    if (!industry) return null;

    return benchmarks[industry] || null;

  } catch (err) {
    logger.warn(`Industry benchmark lookup error: ${err.message}`);
    return null;
  }
}

async function updateTechIntelligenceFromScan(technologies) {
  try {
    if (!technologies || technologies.length === 0) return;

    for (const tech of technologies) {
      const existing = await supabase
        .from('tech_intelligence')
        .select('id, common_companions, maturity_signal')
        .eq('name', tech.name)
        .single();

      if (!existing.data) continue;

      const companions = technologies
        .filter(t => t.name !== tech.name)
        .map(t => t.name);

      const existingCompanions = existing.data.common_companions || [];
      const updatedCompanions = [...new Set([...existingCompanions, ...companions])].slice(0, 20);

      const newMaturitySignal = parseFloat(
        ((existing.data.maturity_signal * 0.95) + (tech.confidence * 0.05)).toFixed(4)
      );

      await supabase
        .from('tech_intelligence')
        .update({
          common_companions: updatedCompanions,
          maturity_signal: newMaturitySignal,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.data.id);
    }

    cachedTechIntelligence = null;
    techIntelligenceCacheTime = null;

  } catch (err) {
    logger.warn(`Tech intelligence update error: ${err.message}`);
  }
}

module.exports = {
  getTechIntelligence,
  getArchitecturePatterns,
  getIndustryBenchmarks,
  findBestArchitecturePattern,
  findIndustryBenchmark,
  updateTechIntelligenceFromScan
};
