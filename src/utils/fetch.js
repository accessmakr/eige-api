'use strict';

const fetch = require('node-fetch');
const logger = require('./logger');

const DEFAULT_TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 3;

async function fetchUrl(url) {
  const normalised = url.startsWith('http') ? url : `https://${url}`;
  const t0 = Date.now();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    logger.info(`Fetching: ${normalised}`);

    const response = await fetch(normalised, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      follow: MAX_REDIRECTS,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      }
    });

    const html = await response.text();
    const fetchMs = Date.now() - t0;

    const rawHeaders = {};
    response.headers.forEach((value, key) => {
      rawHeaders[key.toLowerCase()] = value;
    });

    logger.info(`Fetched ${normalised} in ${fetchMs}ms — status ${response.status}`);

    return {
      html,
      rawHeaders,
      status: response.status,
      finalUrl: response.url,
      fetchMs
    };

  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Request to ${normalised} timed out after ${DEFAULT_TIMEOUT_MS}ms`);
    }
    throw new Error(`Failed to fetch ${normalised}: ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { fetchUrl };
