'use strict';

const supabase = require('./supabase');
const logger = require('../utils/logger');

let cachedPatterns = null;
let cacheTime = null;
const PATTERN_CACHE_MS = 3600000;

async function getAllPatterns() {
  try {
    const now = Date.now();
    if (cachedPatterns && cacheTime && (now - cacheTime) < PATTERN_CACHE_MS) {
      logger.info('Returning patterns from memory cache');
      return cachedPatterns;
    }

    logger.info('Loading tech patterns from Supabase');

    const { data, error } = await supabase
      .from('tech_patterns')
      .select('*');

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      logger.warn('No tech patterns found in database');
      return [];
    }

    cachedPatterns = data;
    cacheTime = now;

    logger.info(`Loaded ${data.length} tech patterns`);
    return data;

  } catch (err) {
    logger.error(`Failed to load tech patterns: ${err.message}`);
    return [];
  }
}

async function getPatternCount() {
  try {
    const { count } = await supabase
      .from('tech_patterns')
      .select('*', { count: 'exact', head: true });

    return count || 0;

  } catch (err) {
    logger.warn(`Failed to get pattern count: ${err.message}`);
    return 0;
  }
}

module.exports = { getAllPatterns, getPatternCount };
