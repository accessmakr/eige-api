'use strict';

const supabase = require('./supabase');
const logger = require('../utils/logger');

let cachedClusters = null;
let cacheTime = null;
const CLUSTER_CACHE_MS = 3600000;

async function getAllClusters() {
  try {
    const now = Date.now();
    if (cachedClusters && cacheTime && (now - cacheTime) < CLUSTER_CACHE_MS) {
      logger.info('Returning clusters from memory cache');
      return cachedClusters;
    }

    logger.info('Loading clusters from Supabase');

    const { data, error } = await supabase
      .from('clusters')
      .select('*');

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      logger.warn('No clusters found in database');
      return [];
    }

    cachedClusters = data;
    cacheTime = now;

    logger.info(`Loaded ${data.length} clusters`);
    return data;

  } catch (err) {
    logger.error(`Failed to load clusters: ${err.message}`);
    return [];
  }
}

async function getClusterCount() {
  try {
    const { count } = await supabase
      .from('clusters')
      .select('*', { count: 'exact', head: true });

    return count || 0;

  } catch (err) {
    logger.warn(`Failed to get cluster count: ${err.message}`);
    return 0;
  }
}

module.exports = { getAllClusters, getClusterCount };
