'use strict';

const supabase = require('./supabase');
const logger = require('../utils/logger');

const CACHE_TTL_MS = parseInt(process.env.CACHE_TTL_MS) || 300000;

async function getCached(cacheKey) {
  try {
    const { data, error } = await supabase
      .from('cache')
      .select('response')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) return null;

    logger.info(`Cache HIT for key: ${cacheKey}`);
    return data.response;

  } catch (err) {
    logger.warn(`Cache read error: ${err.message}`);
    return null;
  }
}

async function setCached(cacheKey, response) {
  try {
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();

    const { error } = await supabase
      .from('cache')
      .upsert({
        cache_key: cacheKey,
        response,
        created_at: new Date().toISOString(),
        expires_at: expiresAt
      });

    if (error) throw new Error(error.message);

    logger.info(`Cache SET for key: ${cacheKey}`);

  } catch (err) {
    logger.warn(`Cache write error: ${err.message}`);
  }
}

async function getCacheStats() {
  try {
    const { count } = await supabase
      .from('cache')
      .select('*', { count: 'exact', head: true })
      .gt('expires_at', new Date().toISOString());

    return {
      entries: count || 0,
      maxEntries: 500,
      ttlMs: CACHE_TTL_MS,
    };

  } catch (err) {
    logger.warn(`Cache stats error: ${err.message}`);
    return { entries: 0, maxEntries: 500, ttlMs: CACHE_TTL_MS };
  }
}

module.exports = { getCached, setCached, getCacheStats };
