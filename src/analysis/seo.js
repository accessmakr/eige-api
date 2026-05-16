'use strict';

const cheerio = require('cheerio');
const logger = require('../utils/logger');

function evaluateSeoStatus(value, type) {
  if (!value) return { status: 'missing', value: null };

  switch (type) {
    case 'title':
      if (value.length < 10) return { status: 'warn', value, detail: 'Title is too short — aim for 30 to 60 characters' };
      if (value.length > 70) return { status: 'warn', value, detail: 'Title is too long — over 70 characters may be truncated in search results' };
      return { status: 'ok', value, detail: `Good length at ${value.length} characters` };

    case 'description':
      if (value.length < 50) return { status: 'warn', value, detail: 'Description too short — aim for 120 to 160 characters' };
      if (value.length > 170) return { status: 'warn', value, detail: 'Description too long — may be truncated by search engines' };
      return { status: 'ok', value, detail: `Good length at ${value.length} characters` };

    case 'canonical':
      if (!value.startsWith('https://')) return { status: 'warn', value, detail: 'Canonical URL should use HTTPS' };
      return { status: 'ok', value, detail: 'Canonical URL correctly set' };

    case 'robots':
      const lower = value.toLowerCase();
      if (lower.includes('noindex')) return { status: 'warn', value, detail: 'Page is set to noindex — search engines will not index this page' };
      if (lower.includes('nofollow')) return { status: 'warn', value, detail: 'Page is set to nofollow — links will not be followed' };
      return { status: 'ok', value, detail: 'Page is indexable and followable' };

    default:
      return { status: 'ok', value };
  }
}

function extractOgTags($) {
  const og = {};
  $('meta[property^="og:"]').each((i, el) => {
    const property = $(el).attr('property').replace('og:', '');
    const content = $(el).attr('content');
    if (property && content) og[property] = content;
  });
  return og;
}

function extractTwitterTags($) {
  const twitter = {};
  $('meta[name^="twitter:"]').each((i, el) => {
    const name = $(el).attr('name').replace('twitter:', '');
    const content = $(el).attr('content');
    if (name && content) twitter[name] = content;
  });
  return twitter;
}

function extractStructuredData($) {
  const structured = [];
  $('script[type="application/ld+json"]').each((i, el) => {
    try {
      const text = $(el).html();
      if (text) {
        const parsed = JSON.parse(text);
        structured.push(parsed);
      }
    } catch (err) {
      // Invalid JSON in structured data block — skip it
    }
  });
  return structured;
}

function extractHeadings($) {
  const headings = { h1: [], h2: [], h3: [] };

  $('h1').each((i, el) => {
    const text = $(el).text().trim();
    if (text) headings.h1.push(text.substring(0, 100));
  });

  $('h2').each((i, el) => {
    const text = $(el).text().trim();
    if (text && headings.h2.length < 5) headings.h2.push(text.substring(0, 100));
  });

  $('h3').each((i, el) => {
    const text = $(el).text().trim();
    if (text && headings.h3.length < 5) headings.h3.push(text.substring(0, 100));
  });

  return headings;
}

function extractImages($) {
  let total = 0;
  let withAlt = 0;
  let withoutAlt = 0;

  $('img').each((i, el) => {
    total++;
    const alt = $(el).attr('alt');
    if (alt && alt.trim().length > 0) {
      withAlt++;
    } else {
      withoutAlt++;
    }
  });

  return { total, withAlt, withoutAlt };
}

function extractLinks($, baseUrl) {
  let internal = 0;
  let external = 0;

  $('a[href]').each((i, el) => {
    const href = $(el).attr('href') || '';
    if (
      href.startsWith('/') ||
      href.startsWith('#') ||
      href.includes(baseUrl)
    ) {
      internal++;
    } else if (href.startsWith('http')) {
      external++;
    }
  });

  return { internal, external };
}

function generateSeoScore(data) {
  let score = 0;
  let maxScore = 0;

  const checks = [
    { condition: data.title.status === 'ok', points: 15 },
    { condition: data.description.status === 'ok', points: 15 },
    { condition: data.canonical.status === 'ok', points: 10 },
    { condition: data.robots.status === 'ok', points: 5 },
    { condition: Object.keys(data.og).length >= 4, points: 15 },
    { condition: Object.keys(data.twitter).length >= 3, points: 10 },
    { condition: data.structured.length > 0, points: 15 },
    { condition: data.headings.h1.length === 1, points: 10 },
    { condition: data.headings.h1.length > 0, points: 5 },
    { condition: data.images.total > 0 && data.images.withoutAlt === 0, points: 5 },
    { condition: data.title.status === 'warn', points: 5 },
    { condition: data.description.status === 'warn', points: 5 }
  ];

  for (const check of checks) {
    maxScore += check.points;
    if (check.condition) score += check.points;
  }

  return Math.round((score / maxScore) * 100);
}

function analyseSeo(html, finalUrl) {
  try {
    logger.info('Analysing SEO metadata');

    const $ = cheerio.load(html);

    const baseUrl = finalUrl
      ? new URL(finalUrl).hostname
      : '';

    const titleRaw = $('title').first().text().trim() || null;
    const descriptionRaw = $('meta[name="description"]').attr('content') || null;
    const canonicalRaw = $('link[rel="canonical"]').attr('href') || null;
    const robotsRaw = $('meta[name="robots"]').attr('content') || null;
    const viewportRaw = $('meta[name="viewport"]').attr('content') || null;
    const charsetRaw = $('meta[charset]').attr('charset') ||
      $('meta[http-equiv="Content-Type"]').attr('content') || null;
    const langRaw = $('html').attr('lang') || null;

    const og = extractOgTags($);
    const twitter = extractTwitterTags($);
    const structured = extractStructuredData($);
    const headings = extractHeadings($);
    const images = extractImages($);
    const links = extractLinks($, baseUrl);

    const data = {
      title: evaluateSeoStatus(titleRaw, 'title'),
      description: evaluateSeoStatus(descriptionRaw, 'description'),
      canonical: evaluateSeoStatus(canonicalRaw, 'canonical'),
      robots: robotsRaw
        ? evaluateSeoStatus(robotsRaw, 'robots')
        : { status: 'missing', value: null, detail: 'No robots meta tag found' },
      viewport: viewportRaw
        ? { status: 'ok', value: viewportRaw }
        : { status: 'missing', value: null, detail: 'No viewport meta tag — may affect mobile rendering' },
      charset: charsetRaw
        ? { status: 'ok', value: charsetRaw }
        : { status: 'warn', value: null, detail: 'No charset declaration found' },
      lang: langRaw
        ? { status: 'ok', value: langRaw }
        : { status: 'warn', value: null, detail: 'No language attribute on html element' },
      og,
      twitter,
      structured,
      headings,
      images,
      links
    };

    const seoScore = generateSeoScore(data);

    logger.info(`SEO analysis complete — Score: ${seoScore}, OG tags: ${Object.keys(og).length}, Structured data: ${structured.length}`);

    return { ...data, seoScore };

  } catch (err) {
    logger.error(`SEO analysis failed: ${err.message}`);
    return {
      title: { status: 'missing', value: null },
      description: { status: 'missing', value: null },
      canonical: { status: 'missing', value: null },
      robots: { status: 'missing', value: null },
      viewport: { status: 'missing', value: null },
      charset: { status: 'missing', value: null },
      lang: { status: 'missing', value: null },
      og: {},
      twitter: {},
      structured: [],
      headings: { h1: [], h2: [], h3: [] },
      images: { total: 0, withAlt: 0, withoutAlt: 0 },
      links: { internal: 0, external: 0 },
      seoScore: 0
    };
  }
}

module.exports = { analyseSeo };
