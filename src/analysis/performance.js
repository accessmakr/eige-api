'use strict';

const logger = require('../utils/logger');

const PERFORMANCE_THRESHOLDS = {
  fetchMs: {
    excellent: 300,
    good: 800,
    acceptable: 1500,
    poor: 3000
  }
};

function gradeFetchTime(fetchMs) {
  if (fetchMs <= PERFORMANCE_THRESHOLDS.fetchMs.excellent) {
    return {
      grade: 'Excellent',
      color: 'green',
      detail: `Server responded in ${fetchMs}ms — exceptionally fast`
    };
  }
  if (fetchMs <= PERFORMANCE_THRESHOLDS.fetchMs.good) {
    return {
      grade: 'Good',
      color: 'green',
      detail: `Server responded in ${fetchMs}ms — well within acceptable range`
    };
  }
  if (fetchMs <= PERFORMANCE_THRESHOLDS.fetchMs.acceptable) {
    return {
      grade: 'Acceptable',
      color: 'amber',
      detail: `Server responded in ${fetchMs}ms — slightly slow, consider CDN or caching improvements`
    };
  }
  if (fetchMs <= PERFORMANCE_THRESHOLDS.fetchMs.poor) {
    return {
      grade: 'Poor',
      color: 'red',
      detail: `Server responded in ${fetchMs}ms — slow response time detected, may indicate server-side bottlenecks`
    };
  }
  return {
    grade: 'Critical',
    color: 'red',
    detail: `Server responded in ${fetchMs}ms — critically slow, users likely experiencing poor experience`
  };
}

function detectCompressionFromHeaders(rawHeaders) {
  const encoding = rawHeaders['content-encoding'] || '';
  const lower = encoding.toLowerCase();

  if (lower.includes('br')) return { type: 'Brotli', status: 'excellent', detail: 'Brotli compression active — best available compression' };
  if (lower.includes('gzip')) return { type: 'Gzip', status: 'good', detail: 'Gzip compression active — good compression' };
  if (lower.includes('deflate')) return { type: 'Deflate', status: 'acceptable', detail: 'Deflate compression active' };
  return { type: 'None', status: 'missing', detail: 'No compression detected — enabling Gzip or Brotli would reduce transfer size' };
}

function detectCachingFromHeaders(rawHeaders) {
  const cacheControl = rawHeaders['cache-control'] || '';
  const etag = rawHeaders['etag'] || null;
  const lastModified = rawHeaders['last-modified'] || null;
  const expires = rawHeaders['expires'] || null;
  const age = rawHeaders['age'] || null;

  const lower = cacheControl.toLowerCase();
  const signals = [];
  let status = 'missing';

  if (lower.includes('no-store')) {
    return {
      status: 'nocache',
      detail: 'Cache explicitly disabled via no-store directive',
      directives: cacheControl,
      etag: !!etag,
      lastModified: !!lastModified
    };
  }

  if (lower.includes('max-age=')) {
    const match = lower.match(/max-age=(\d+)/);
    if (match) {
      const seconds = parseInt(match[1]);
      const hours = Math.round(seconds / 3600);
      signals.push(`max-age=${seconds}s (${hours} hours)`);
      status = seconds > 3600 ? 'good' : 'warn';
    }
  }

  if (lower.includes('s-maxage=')) {
    const match = lower.match(/s-maxage=(\d+)/);
    if (match) signals.push(`s-maxage=${match[1]}s`);
  }

  if (lower.includes('immutable')) signals.push('immutable');
  if (lower.includes('public')) signals.push('public');
  if (lower.includes('private')) signals.push('private');
  if (lower.includes('no-cache')) signals.push('no-cache (revalidates every request)');

  if (etag) signals.push('ETag validation enabled');
  if (lastModified) signals.push('Last-Modified validation enabled');
  if (age) signals.push(`Cached for ${age} seconds already`);
  if (expires) signals.push(`Expires: ${expires}`);

  if (signals.length === 0) {
    return {
      status: 'missing',
      detail: 'No caching headers detected — resources will be re-fetched on every visit',
      directives: null,
      etag: !!etag,
      lastModified: !!lastModified
    };
  }

  return {
    status,
    detail: signals.join(' · '),
    directives: cacheControl,
    etag: !!etag,
    lastModified: !!lastModified,
    expires: !!expires,
    age: age ? parseInt(age) : null
  };
}

function detectHTTPSFromHeaders(rawHeaders, finalUrl) {
  const isHttps = finalUrl && finalUrl.startsWith('https://');
  const hsts = rawHeaders['strict-transport-security'] || null;

  return {
    https: isHttps,
    hsts: !!hsts,
    detail: isHttps
      ? hsts
        ? 'HTTPS enforced with HSTS'
        : 'HTTPS active but HSTS not configured'
      : 'HTTP only — no encryption detected'
  };
}

function detectHTTP2(rawHeaders) {
  const via = rawHeaders['via'] || '';
  const protocol = rawHeaders[':status'] || '';

  if (via.includes('h2') || via.includes('HTTP/2')) {
    return { supported: true, detail: 'HTTP/2 detected via Via header' };
  }

  return {
    supported: false,
    detail: 'HTTP/2 not confirmed — may still be supported but not detectable from headers alone'
  };
}

function calculatePerformanceScore(fetchGrade, compression, caching, https) {
  let score = 0;

  if (fetchGrade.grade === 'Excellent') score += 30;
  else if (fetchGrade.grade === 'Good') score += 25;
  else if (fetchGrade.grade === 'Acceptable') score += 15;
  else if (fetchGrade.grade === 'Poor') score += 5;
  else score += 0;

  if (compression.type === 'Brotli') score += 25;
  else if (compression.type === 'Gzip') score += 20;
  else if (compression.type === 'Deflate') score += 10;
  else score += 0;

  if (caching.status === 'good') score += 25;
  else if (caching.status === 'warn') score += 15;
  else if (caching.status === 'nocache') score += 5;
  else score += 0;

  if (https.https && https.hsts) score += 20;
  else if (https.https) score += 12;
  else score += 0;

  return Math.min(score, 100);
}

function analysePerformance(rawHeaders, finalUrl, fetchMs) {
  try {
    logger.info(`Analysing performance — fetch time: ${fetchMs}ms`);

    const fetchGrade = gradeFetchTime(fetchMs);
    const compression = detectCompressionFromHeaders(rawHeaders);
    const caching = detectCachingFromHeaders(rawHeaders);
    const https = detectHTTPSFromHeaders(rawHeaders, finalUrl);
    const http2 = detectHTTP2(rawHeaders);

    const performanceScore = calculatePerformanceScore(
      fetchGrade,
      compression,
      caching,
      https
    );

    logger.info(`Performance analysis complete — Score: ${performanceScore}, Grade: ${fetchGrade.grade}, Compression: ${compression.type}`);

    return {
      fetchMs,
      fetchGrade,
      compression,
      caching,
      https,
      http2,
      performanceScore
    };

  } catch (err) {
    logger.error(`Performance analysis failed: ${err.message}`);
    return {
      fetchMs: fetchMs || 0,
      fetchGrade: { grade: 'Unknown', color: 'grey', detail: 'Could not analyse performance' },
      compression: { type: 'Unknown', status: 'missing' },
      caching: { status: 'missing', detail: 'Could not read caching headers' },
      https: { https: false, hsts: false },
      http2: { supported: false },
      performanceScore: 0
    };
  }
}

module.exports = { analysePerformance };
