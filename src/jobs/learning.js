'use strict';

const supabase = require('../db/supabase');
const logger = require('../utils/logger');

const LEARNING_INTERVAL_MS = 86400000;
let learningJobRunning = false;
let lastRunTime = null;

// ─── VOLUME THRESHOLDS ────────────────────────────────────────────────────────
const THRESHOLDS = {
  techIntelligence: 50,
  architecturePatterns: 100,
  industryBenchmarks: 200,
  coOccurrence: 25
};

// ─── QUALITY SCORE PASS MARK ─────────────────────────────────────────────────
// Reduced from 60 to 25 — major production websites (CNN, BBC, Meta) score
// 30-40 due to aggressive bot protection stripping headers and minimal
// meta tags on enterprise sites. 25 captures real-world production data
// while still filtering out test domains, parked pages, and error pages.
const QUALITY_PASS_MARK = 25;

// ─── OUTLIER DETECTION SENSITIVITY ───────────────────────────────────────────
const OUTLIER_STD_DEVIATIONS = 1.5;

// ─── DOMAIN BLOCKLIST PATTERNS ───────────────────────────────────────────────
const BLOCKED_DOMAIN_PATTERNS = [
  /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^localhost/,
  /\.local$/,
  /\.test$/,
  /\.internal$/,
  /\.invalid$/,
  /\.example$/,
  /\.staging\./,
  /\.dev\./,
  /staging\./,
  /sandbox\./,
  /^test\d*/,
  /^demo\d*/,
  /^dev\./,
  /^qa\./,
  /^uat\./,
  /^preprod\./,
  /^preview\./,
  /ngrok\.io$/,
  /\.local\.run$/,
  /vercel\.app$/,
  /netlify\.app$/,
  /herokuapp\.com$/,
  /onrender\.com$/,
  /pages\.dev$/,
  /web\.app$/,
  /firebaseapp\.com$/
];

const KNOWN_TEST_KEYWORDS = [
  'test', 'demo', 'staging', 'sandbox', 'preview',
  'dev', 'qa', 'uat', 'preprod', 'localhost',
  'example', 'sample', 'placeholder', 'temp', 'tmp'
];

// ─── GATE 1 — DOMAIN BLOCKLIST ────────────────────────────────────────────────

function passesGate1DomainBlocklist(domain) {
  if (!domain || typeof domain !== 'string') return false;

  const lower = domain.toLowerCase().trim();

  if (lower.length < 4) {
    logger.info(`Gate 1 REJECT — domain too short: ${domain}`);
    return false;
  }

  const subdomainCount = (lower.match(/\./g) || []).length;
  if (subdomainCount > 5) {
    logger.info(`Gate 1 REJECT — too many subdomains: ${domain}`);
    return false;
  }

  for (const pattern of BLOCKED_DOMAIN_PATTERNS) {
    if (pattern.test(lower)) {
      logger.info(`Gate 1 REJECT — blocked domain pattern: ${domain}`);
      return false;
    }
  }

  const domainParts = lower.split('.');
  const mainDomain = domainParts[domainParts.length - 2] || '';
  for (const keyword of KNOWN_TEST_KEYWORDS) {
    if (mainDomain.includes(keyword)) {
      logger.info(`Gate 1 REJECT — test keyword in domain: ${domain}`);
      return false;
    }
  }

  return true;
}

// ─── GATE 2 — MINIMUM CONTENT CHECK ──────────────────────────────────────────

function passesGate2MinimumContent(scan) {
  const technologies = scan.technologies || [];
  const seo = scan.seo || {};
  const performance = scan.performance || {};

  const hasTitle = seo.title && seo.title.status !== 'missing';
  const hasDescription = seo.description && seo.description.status !== 'missing';
  const hasLinks = seo.links && (seo.links.internal + seo.links.external) > 5;
  const hasFastResponse = performance.fetchMs && performance.fetchMs < 8000;
  const hasTechnologies = technologies.length > 0;

  const contentSignals = [hasTitle, hasDescription, hasLinks, hasFastResponse, hasTechnologies]
    .filter(Boolean).length;

  if (contentSignals < 2) {
    logger.info(`Gate 2 REJECT — insufficient content signals (${contentSignals}/5): ${scan.domain}`);
    return false;
  }

  return true;
}

// ─── GATE 3 — TECHNOLOGY DIVERSITY CHECK ─────────────────────────────────────

function passesGate3TechnologyDiversity(scan) {
  const technologies = scan.technologies || [];

  if (technologies.length < 3) {
    logger.info(`Gate 3 REJECT — insufficient technology diversity (${technologies.length} techs): ${scan.domain}`);
    return false;
  }

  const categories = new Set(technologies.map(t => t.category));
  if (categories.size < 2) {
    logger.info(`Gate 3 REJECT — all technologies in same category: ${scan.domain}`);
    return false;
  }

  return true;
}

// ─── GATE 4 — CONFIDENCE FLOOR CHECK ─────────────────────────────────────────

function passesGate4ConfidenceFloor(scan) {
  const technologies = scan.technologies || [];
  if (technologies.length === 0) return false;

  const avgConfidence = technologies.reduce((sum, t) => sum + (t.confidence || 0), 0) / technologies.length;

  if (avgConfidence < 0.45) {
    logger.info(`Gate 4 REJECT — low average confidence (${avgConfidence.toFixed(2)}): ${scan.domain}`);
    return false;
  }

  const maxConfidence = Math.max(...technologies.map(t => t.confidence || 0));
  if (maxConfidence < 0.55) {
    logger.info(`Gate 4 REJECT — no technology detected with confidence above 0.55: ${scan.domain}`);
    return false;
  }

  return true;
}

// ─── GATE 5 — QUALITY SCORE CALCULATION ──────────────────────────────────────

function calculateQualityScore(scan) {
  let score = 0;
  const technologies = scan.technologies || [];
  const seo = scan.seo || {};
  const security = scan.security || {};
  const performance = scan.performance || {};

  // SEO signals
  if (seo.title && seo.title.status === 'ok') score += 10;
  else if (seo.title && seo.title.status === 'warn') score += 5;

  if (seo.description && seo.description.status === 'ok') score += 10;
  else if (seo.description && seo.description.status === 'warn') score += 5;

  if (seo.canonical && seo.canonical.status === 'ok') score += 5;

  if (seo.viewport && seo.viewport.status === 'ok') score += 5;

  if (seo.og && Object.keys(seo.og).length >= 3) score += 5;

  if (seo.structured && seo.structured.length > 0) score += 10;

  if (seo.links && (seo.links.internal + seo.links.external) > 5) score += 5;

  // Technology signals
  if (technologies.length > 5) score += 15;
  else if (technologies.length >= 3) score += 8;

  const hasAnalytics = technologies.some(t =>
    ['Google Analytics', 'Segment', 'Plausible', 'Fathom Analytics',
      'Mixpanel', 'Amplitude', 'PostHog'].includes(t.name)
  );
  if (hasAnalytics) score += 10;

  const primaryTech = technologies[0];
  if (primaryTech && primaryTech.confidence >= 0.6) score += 10;

  // Security signals
  const securityHeaders = security.headers || {};
  const presentHeaders = Object.values(securityHeaders)
    .filter(h => h && h.status === 'present').length;

  if (presentHeaders >= 4) score += 10;
  else if (presentHeaders >= 2) score += 5;

  // Performance signals
  if (performance.https && performance.https.https) score += 10;

  if (performance.fetchMs && performance.fetchMs < 800) score += 5;
  else if (performance.fetchMs && performance.fetchMs < 2000) score += 2;

  return Math.min(score, 100);
}

function passesGate5QualityScore(scan) {
  const score = calculateQualityScore(scan);
  scan._qualityScore = score;

  if (score < QUALITY_PASS_MARK) {
    logger.info(`Gate 5 REJECT — quality score too low (${score}/${QUALITY_PASS_MARK}): ${scan.domain}`);
    return false;
  }

  logger.info(`Gate 5 PASS — quality score ${score}/100: ${scan.domain}`);
  return true;
}

// ─── GATE 6 — OUTLIER DETECTION ──────────────────────────────────────────────

function calculateStdDeviation(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
  return Math.sqrt(avgSquaredDiff);
}

function passesGate6OutlierDetection(scan, allQualifiedScans) {
  const clusterName = scan.cluster?.name;
  if (!clusterName) return true;

  const clusterScans = allQualifiedScans.filter(s => s.cluster?.name === clusterName);
  if (clusterScans.length < 5) return true;

  const maturityScores = clusterScans
    .map(s => s.intelligence?.maturityScore)
    .filter(s => s !== undefined && s !== null);

  if (maturityScores.length < 5) return true;

  const mean = maturityScores.reduce((a, b) => a + b, 0) / maturityScores.length;
  const stdDev = calculateStdDeviation(maturityScores);
  const scanMaturity = scan.intelligence?.maturityScore;

  if (scanMaturity === undefined || scanMaturity === null) return true;

  const deviations = Math.abs(scanMaturity - mean) / (stdDev || 1);

  if (deviations > OUTLIER_STD_DEVIATIONS) {
    logger.info(`Gate 6 REJECT — outlier detected (${deviations.toFixed(2)} std devs from mean of ${mean.toFixed(0)}): ${scan.domain}`);
    return false;
  }

  return true;
}

// ─── GATE 7 — VOLUME THRESHOLD CHECK ─────────────────────────────────────────

function checkVolumeThreshold(count, threshold, label) {
  if (count < threshold) {
    logger.info(`Gate 7 SKIP — insufficient volume for ${label} (${count}/${threshold} required)`);
    return false;
  }
  return true;
}

// ─── MASTER QUALITY FILTER ────────────────────────────────────────────────────

function filterQualityScans(scans) {
  logger.info(`Quality filter starting — evaluating ${scans.length} scans`);

  const results = {
    total: scans.length,
    gate1Rejected: 0,
    gate2Rejected: 0,
    gate3Rejected: 0,
    gate4Rejected: 0,
    gate5Rejected: 0,
    gate6Rejected: 0,
    qualified: []
  };

  const postGate5 = [];

  for (const scan of scans) {
    if (!passesGate1DomainBlocklist(scan.domain)) { results.gate1Rejected++; continue; }
    if (!passesGate2MinimumContent(scan)) { results.gate2Rejected++; continue; }
    if (!passesGate3TechnologyDiversity(scan)) { results.gate3Rejected++; continue; }
    if (!passesGate4ConfidenceFloor(scan)) { results.gate4Rejected++; continue; }
    if (!passesGate5QualityScore(scan)) { results.gate5Rejected++; continue; }
    postGate5.push(scan);
  }

  for (const scan of postGate5) {
    if (!passesGate6OutlierDetection(scan, postGate5)) {
      results.gate6Rejected++;
      continue;
    }
    results.qualified.push(scan);
  }

  logger.info(`Quality filter complete:`);
  logger.info(`  Total evaluated: ${results.total}`);
  logger.info(`  Gate 1 rejected (domain): ${results.gate1Rejected}`);
  logger.info(`  Gate 2 rejected (content): ${results.gate2Rejected}`);
  logger.info(`  Gate 3 rejected (diversity): ${results.gate3Rejected}`);
  logger.info(`  Gate 4 rejected (confidence): ${results.gate4Rejected}`);
  logger.info(`  Gate 5 rejected (quality score): ${results.gate5Rejected}`);
  logger.info(`  Gate 6 rejected (outlier): ${results.gate6Rejected}`);
  logger.info(`  Qualified for learning: ${results.qualified.length}`);

  return results;
}

// ─── LEARNING FUNCTIONS ───────────────────────────────────────────────────────

async function getRecentScans(hoursBack = 24) {
  try {
    const since = new Date(Date.now() - (hoursBack * 3600000)).toISOString();

    const { data, error } = await supabase
      .from('scans')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];

  } catch (err) {
    logger.error(`Failed to fetch recent scans: ${err.message}`);
    return [];
  }
}

async function getAllScans() {
  try {
    const { data, error } = await supabase
      .from('scans')
      .select('technologies, cluster, security, seo, performance, intelligence, domain, created_at')
      .order('created_at', { ascending: false })
      .limit(10000);

    if (error) throw new Error(error.message);
    return data || [];

  } catch (err) {
    logger.error(`Failed to fetch all scans: ${err.message}`);
    return [];
  }
}

async function updateCoOccurrenceWeights(qualifiedScans) {
  try {
    logger.info('Learning job — updating co-occurrence weights');

    const pairCounts = {};

    for (const scan of qualifiedScans) {
      const technologies = scan.technologies || [];
      for (let i = 0; i < technologies.length; i++) {
        for (let j = i + 1; j < technologies.length; j++) {
          const techA = technologies[i].name < technologies[j].name
            ? technologies[i].name : technologies[j].name;
          const techB = technologies[i].name < technologies[j].name
            ? technologies[j].name : technologies[i].name;
          const key = `${techA}|||${techB}`;
          pairCounts[key] = (pairCounts[key] || 0) + 1;
        }
      }
    }

    for (const [key, newCount] of Object.entries(pairCounts)) {
      if (newCount < THRESHOLDS.coOccurrence) {
        if (!checkVolumeThreshold(newCount, THRESHOLDS.coOccurrence, `co-occurrence pair ${key}`)) continue;
      }

      const [techA, techB] = key.split('|||');

      const { data: existing } = await supabase
        .from('co_occurrence')
        .select('id, count')
        .eq('tech_a', techA)
        .eq('tech_b', techB)
        .single();

      if (existing) {
        await supabase
          .from('co_occurrence')
          .update({
            count: existing.count + newCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);
      }
    }

    const { data: allPairs } = await supabase
      .from('co_occurrence')
      .select('id, count');

    if (allPairs && allPairs.length > 0) {
      const maxCount = Math.max(...allPairs.map(p => p.count));
      if (maxCount > 0) {
        for (const pair of allPairs) {
          const weight = parseFloat((pair.count / maxCount).toFixed(4));
          await supabase
            .from('co_occurrence')
            .update({ weight, updated_at: new Date().toISOString() })
            .eq('id', pair.id);
        }
      }
    }

    logger.info('Co-occurrence weights updated and normalised from qualified scans');

  } catch (err) {
    logger.error(`Co-occurrence update error: ${err.message}`);
  }
}

async function updateTechIntelligenceProfiles(qualifiedScans) {
  try {
    logger.info('Learning job — updating tech intelligence profiles');

    const techStats = {};

    for (const scan of qualifiedScans) {
      const technologies = scan.technologies || [];
      for (const tech of technologies) {
        if (!techStats[tech.name]) {
          techStats[tech.name] = {
            name: tech.name,
            category: tech.category,
            totalConfidence: 0,
            scanCount: 0,
            companions: {}
          };
        }
        techStats[tech.name].totalConfidence += tech.confidence || 0;
        techStats[tech.name].scanCount++;

        const companions = technologies.filter(t => t.name !== tech.name);
        for (const companion of companions) {
          techStats[tech.name].companions[companion.name] =
            (techStats[tech.name].companions[companion.name] || 0) + 1;
        }
      }
    }

    for (const [name, stats] of Object.entries(techStats)) {
      if (!checkVolumeThreshold(stats.scanCount, THRESHOLDS.techIntelligence, `tech ${name}`)) continue;

      try {
        const avgConfidence = stats.totalConfidence / stats.scanCount;

        const topCompanions = Object.entries(stats.companions)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15)
          .map(([companionName]) => companionName);

        const { data: existing } = await supabase
          .from('tech_intelligence')
          .select('id, maturity_signal, common_companions')
          .eq('name', name)
          .single();

        if (existing) {
          const blendedMaturity = parseFloat(
            ((existing.maturity_signal * 0.75) + (avgConfidence * 0.25)).toFixed(4)
          );

          const existingCompanions = existing.common_companions || [];
          const mergedCompanions = [...new Set([...topCompanions, ...existingCompanions])].slice(0, 20);

          await supabase
            .from('tech_intelligence')
            .update({
              maturity_signal: blendedMaturity,
              common_companions: mergedCompanions,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);

          logger.info(`Tech intelligence updated: ${name} — maturity: ${blendedMaturity}, companions: ${mergedCompanions.length}`);
        }

      } catch (techErr) {
        logger.warn(`Failed to update tech intelligence for ${name}: ${techErr.message}`);
      }
    }

  } catch (err) {
    logger.error(`Tech intelligence update error: ${err.message}`);
  }
}

async function updateArchitecturePatterns(qualifiedScans) {
  try {
    logger.info('Learning job — updating architecture patterns');

    const clusterStats = {};

    for (const scan of qualifiedScans) {
      const clusterName = scan.cluster?.name;
      if (!clusterName) continue;

      if (!clusterStats[clusterName]) {
        clusterStats[clusterName] = {
          totalMaturity: 0,
          scanCount: 0,
          securityWeaknesses: {},
          seoWeaknesses: {},
          performanceWeaknesses: {},
          qualityScores: []
        };
      }

      const stats = clusterStats[clusterName];
      stats.scanCount++;
      stats.qualityScores.push(scan._qualityScore || 0);

      const intelligence = scan.intelligence || {};
      if (intelligence.maturityScore) {
        stats.totalMaturity += intelligence.maturityScore;
      }

      const security = scan.security || {};
      if (security.headers) {
        for (const [header, result] of Object.entries(security.headers)) {
          if (result && result.status === 'missing') {
            const key = `Missing ${header} security header`;
            stats.securityWeaknesses[key] = (stats.securityWeaknesses[key] || 0) + 1;
          }
        }
      }

      const seo = scan.seo || {};
      if (seo.title?.status === 'missing') stats.seoWeaknesses['Missing page title'] = (stats.seoWeaknesses['Missing page title'] || 0) + 1;
      if (seo.description?.status === 'missing') stats.seoWeaknesses['Missing meta description'] = (stats.seoWeaknesses['Missing meta description'] || 0) + 1;
      if (seo.structured?.length === 0) stats.seoWeaknesses['No structured data markup'] = (stats.seoWeaknesses['No structured data markup'] || 0) + 1;
      if (seo.og && Object.keys(seo.og).length === 0) stats.seoWeaknesses['Missing Open Graph tags'] = (stats.seoWeaknesses['Missing Open Graph tags'] || 0) + 1;
      if (seo.canonical?.status === 'missing') stats.seoWeaknesses['Missing canonical URL'] = (stats.seoWeaknesses['Missing canonical URL'] || 0) + 1;

      const performance = scan.performance || {};
      if (performance.compression?.type === 'None') stats.performanceWeaknesses['No response compression'] = (stats.performanceWeaknesses['No response compression'] || 0) + 1;
      if (performance.caching?.status === 'missing') stats.performanceWeaknesses['No caching strategy'] = (stats.performanceWeaknesses['No caching strategy'] || 0) + 1;
      if (performance.fetchMs > 1500) stats.performanceWeaknesses['Slow server response time'] = (stats.performanceWeaknesses['Slow server response time'] || 0) + 1;
    }

    for (const [clusterName, stats] of Object.entries(clusterStats)) {
      if (!checkVolumeThreshold(stats.scanCount, THRESHOLDS.architecturePatterns, `cluster ${clusterName}`)) continue;

      try {
        const avgMaturity = Math.round(stats.totalMaturity / stats.scanCount);
        const avgQuality = Math.round(stats.qualityScores.reduce((a, b) => a + b, 0) / stats.qualityScores.length);

        const topWeaknesses = [
          ...Object.entries(stats.securityWeaknesses),
          ...Object.entries(stats.seoWeaknesses),
          ...Object.entries(stats.performanceWeaknesses)
        ]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([weakness, count]) => {
            const percentage = Math.round((count / stats.scanCount) * 100);
            return `${weakness} — found in ${percentage}% of ${clusterName} sites analysed`;
          });

        const patternId = clusterName.toLowerCase().replace(/ /g, '_');

        const { data: existing } = await supabase
          .from('architecture_patterns')
          .select('id, maturity_score')
          .eq('pattern_id', patternId)
          .single();

        if (existing) {
          const blendedMaturity = Math.round(
            (existing.maturity_score * 0.75) + (avgMaturity * 0.25)
          );

          await supabase
            .from('architecture_patterns')
            .update({
              maturity_score: blendedMaturity,
              weaknesses: topWeaknesses,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);

          logger.info(`Architecture pattern updated: ${clusterName} — maturity: ${blendedMaturity}, avg quality score: ${avgQuality}, from ${stats.scanCount} qualified scans`);
        }

      } catch (patternErr) {
        logger.warn(`Failed to update pattern for ${clusterName}: ${patternErr.message}`);
      }
    }

  } catch (err) {
    logger.error(`Architecture pattern update error: ${err.message}`);
  }
}

async function updateIndustryBenchmarks(qualifiedScans) {
  try {
    logger.info('Learning job — updating industry benchmarks');

    const industryMap = {
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

    const industryStats = {};

    for (const scan of qualifiedScans) {
      const clusterName = scan.cluster?.name;
      if (!clusterName) continue;

      const industry = industryMap[clusterName];
      if (!industry) continue;

      if (!industryStats[industry]) {
        industryStats[industry] = {
          totalMaturity: 0,
          scanCount: 0,
          techCounts: {},
          recentTechCounts: {},
          oldTechCounts: {}
        };
      }

      const stats = industryStats[industry];
      stats.scanCount++;

      const intelligence = scan.intelligence || {};
      if (intelligence.maturityScore) {
        stats.totalMaturity += intelligence.maturityScore;
      }

      const technologies = scan.technologies || [];
      const isRecent = new Date(scan.created_at) > new Date(Date.now() - 30 * 86400000);
      const isOld = new Date(scan.created_at) < new Date(Date.now() - 90 * 86400000);

      for (const tech of technologies) {
        stats.techCounts[tech.name] = (stats.techCounts[tech.name] || 0) + 1;
        if (isRecent) stats.recentTechCounts[tech.name] = (stats.recentTechCounts[tech.name] || 0) + 1;
        if (isOld) stats.oldTechCounts[tech.name] = (stats.oldTechCounts[tech.name] || 0) + 1;
      }
    }

    for (const [industry, stats] of Object.entries(industryStats)) {
      if (!checkVolumeThreshold(stats.scanCount, THRESHOLDS.industryBenchmarks, `industry ${industry}`)) continue;

      try {
        const avgMaturity = Math.round(stats.totalMaturity / stats.scanCount);

        const topTechnologies = Object.entries(stats.techCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15)
          .map(([name, count]) => ({
            name,
            frequency: parseFloat((count / stats.scanCount).toFixed(2))
          }));

        const risingTechnologies = Object.entries(stats.recentTechCounts)
          .filter(([name, recentCount]) => {
            const oldCount = stats.oldTechCounts[name] || 0;
            const recentRate = recentCount / Math.max(stats.scanCount * 0.3, 1);
            const oldRate = oldCount / Math.max(stats.scanCount * 0.3, 1);
            return recentRate > oldRate * 1.4;
          })
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name]) => name);

        const decliningTechnologies = Object.entries(stats.oldTechCounts)
          .filter(([name, oldCount]) => {
            const recentCount = stats.recentTechCounts[name] || 0;
            const recentRate = recentCount / Math.max(stats.scanCount * 0.3, 1);
            const oldRate = oldCount / Math.max(stats.scanCount * 0.3, 1);
            return oldRate > recentRate * 1.4;
          })
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name]) => name);

        const { data: existing } = await supabase
          .from('industry_benchmarks')
          .select('id, average_maturity_score')
          .eq('industry', industry)
          .single();

        if (existing) {
          const blendedMaturity = Math.round(
            (existing.average_maturity_score * 0.75) + (avgMaturity * 0.25)
          );

          await supabase
            .from('industry_benchmarks')
            .update({
              average_maturity_score: blendedMaturity,
              top_technologies: topTechnologies,
              rising_technologies: risingTechnologies,
              declining_technologies: decliningTechnologies,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);

          logger.info(`Industry benchmark updated: ${industry} — maturity: ${blendedMaturity}, from ${stats.scanCount} qualified scans`);
        }

      } catch (industryErr) {
        logger.warn(`Failed to update benchmark for ${industry}: ${industryErr.message}`);
      }
    }

  } catch (err) {
    logger.error(`Industry benchmark update error: ${err.message}`);
  }
}

async function cleanExpiredCache() {
  try {
    logger.info('Learning job — cleaning expired cache entries');

    const { error } = await supabase
      .from('cache')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (error) throw new Error(error.message);
    logger.info('Cache cleanup complete');

  } catch (err) {
    logger.error(`Cache cleanup error: ${err.message}`);
  }
}

// ─── MASTER LEARNING JOB ──────────────────────────────────────────────────────

async function runLearningJob() {
  if (learningJobRunning) {
    logger.warn('Learning job already running — skipping this cycle');
    return;
  }

  learningJobRunning = true;
  const jobStart = Date.now();

  logger.info('═══════════════════════════════════════════');
  logger.info('  EIGE v10 — Learning Job Started');
  logger.info('═══════════════════════════════════════════');

  try {
    const recentScans = await getRecentScans(24);
    const allScans = await getAllScans();

    logger.info(`Raw scans fetched — recent: ${recentScans.length}, all time: ${allScans.length}`);

    const recentQualityResults = filterQualityScans(recentScans);
    const allQualityResults = filterQualityScans(allScans);

    const qualifiedRecentScans = recentQualityResults.qualified;
    const qualifiedAllScans = allQualityResults.qualified;

    logger.info(`Qualified scans — recent: ${qualifiedRecentScans.length}/${recentScans.length}, all time: ${qualifiedAllScans.length}/${allScans.length}`);

    if (qualifiedRecentScans.length === 0 && qualifiedAllScans.length === 0) {
      logger.warn('No qualified scans available for learning — job complete with no updates');
      return;
    }

    await updateCoOccurrenceWeights(qualifiedAllScans);
    await updateTechIntelligenceProfiles(qualifiedRecentScans);
    await updateArchitecturePatterns(qualifiedRecentScans);
    await updateIndustryBenchmarks(qualifiedAllScans);
    await cleanExpiredCache();

    lastRunTime = Date.now();
    const duration = Math.round((Date.now() - jobStart) / 1000);

    logger.info('═══════════════════════════════════════════');
    logger.info(`  EIGE v10 — Learning Job Complete (${duration}s)`);
    logger.info(`  Qualified recent: ${qualifiedRecentScans.length}/${recentScans.length}`);
    logger.info(`  Qualified all time: ${qualifiedAllScans.length}/${allScans.length}`);
    logger.info('═══════════════════════════════════════════');

  } catch (err) {
    logger.error(`Learning job failed: ${err.message}`);
  } finally {
    learningJobRunning = false;
  }
}

function startLearningSchedule() {
  logger.info(`Learning job scheduled — runs every ${LEARNING_INTERVAL_MS / 3600000} hours`);
  logger.info(`Quality pass mark: ${QUALITY_PASS_MARK}/100`);
  logger.info(`Volume thresholds — tech: ${THRESHOLDS.techIntelligence}, patterns: ${THRESHOLDS.architecturePatterns}, benchmarks: ${THRESHOLDS.industryBenchmarks}`);

  setTimeout(() => {
    runLearningJob();
    setInterval(runLearningJob, LEARNING_INTERVAL_MS);
  }, 60000);
}

function getLearningJobStatus() {
  return {
    running: learningJobRunning,
    lastRunTime,
    nextRunTime: lastRunTime
      ? new Date(lastRunTime + LEARNING_INTERVAL_MS).toISOString()
      : 'Not yet run',
    intervalHours: LEARNING_INTERVAL_MS / 3600000,
    qualityPassMark: QUALITY_PASS_MARK,
    outlierSensitivity: OUTLIER_STD_DEVIATIONS,
    volumeThresholds: THRESHOLDS
  };
}

module.exports = {
  runLearningJob,
  startLearningSchedule,
  getLearningJobStatus
};
