'use strict';

const supabase = require('./supabase');
const logger = require('../utils/logger');

async function insertScan(scanData) {
  try {
    const { error } = await supabase
      .from('scans')
      .insert({
        domain: scanData.domain,
        url: scanData.url,
        technologies: scanData.technologies || [],
        infrastructure: scanData.infrastructure || {},
        intelligence: scanData.intelligence || {},
        graph: scanData.graph || {},
        cluster: scanData.cluster || {},
        security: scanData.security || {},
        seo: scanData.seo || {},
        performance: scanData.performance || {},
        raw_headers: scanData.rawHeaders || {},
        latency: scanData.latency || 0,
        cached: scanData.cached || false
      });

    if (error) throw new Error(error.message);
    logger.info(`Scan saved to database for domain: ${scanData.domain}`);

  } catch (err) {
    logger.warn(`Failed to save scan: ${err.message}`);
  }
}

async function getScanCount() {
  try {
    const { count } = await supabase
      .from('scans')
      .select('*', { count: 'exact', head: true });

    return count || 0;

  } catch (err) {
    logger.warn(`Failed to get scan count: ${err.message}`);
    return 0;
  }
}

async function getUniqueDomainCount() {
  try {
    const { data, error } = await supabase
      .from('scans')
      .select('domain');

    if (error || !data) return 0;

    const unique = new Set(data.map(row => row.domain));
    return unique.size;

  } catch (err) {
    logger.warn(`Failed to get unique domain count: ${err.message}`);
    return 0;
  }
}

module.exports = { insertScan, getScanCount, getUniqueDomainCount };
