'use strict';

const { getAllClusters } = require('../db/clusters');
const logger = require('../utils/logger');

const BUILT_IN_CLUSTERS = [
  {
    cluster_id: 'jamstack_react',
    name: 'JAMstack React',
    description: 'A modern JAMstack architecture built on React with static site generation or server-side rendering. Typically deployed on edge hosting platforms like Vercel or Netlify with CDN delivery. Emphasises performance, developer experience, and scalability.',
    feature_vector: {
      'React': 0.95,
      'Next.js': 0.90,
      'Vercel': 0.80,
      'Netlify': 0.60,
      'Tailwind CSS': 0.65,
      'Cloudflare': 0.55,
      'TypeScript': 0.60,
      'Google Analytics': 0.50,
      'Google Tag Manager': 0.45
    },
    adjacent_clusters: ['jamstack_vue', 'enterprise_saas', 'headless_commerce']
  },
  {
    cluster_id: 'jamstack_vue',
    name: 'JAMstack Vue',
    description: 'A modern JAMstack architecture built on Vue.js or Nuxt.js with static generation or SSR. Commonly deployed on Netlify or Vercel with strong emphasis on progressive enhancement and developer experience.',
    feature_vector: {
      'Vue.js': 0.95,
      'Nuxt.js': 0.85,
      'Netlify': 0.65,
      'Vercel': 0.55,
      'Tailwind CSS': 0.55,
      'Cloudflare': 0.50,
      'Google Analytics': 0.50
    },
    adjacent_clusters: ['jamstack_react', 'spa_modern', 'enterprise_saas']
  },
  {
    cluster_id: 'jamstack_astro',
    name: 'JAMstack Astro',
    description: 'A content-focused JAMstack architecture built with Astro. Prioritises minimal JavaScript delivery through island architecture. Excellent for blogs, documentation sites, and marketing pages requiring top Core Web Vitals scores.',
    feature_vector: {
      'Astro': 0.95,
      'Tailwind CSS': 0.70,
      'Netlify': 0.60,
      'Vercel': 0.55,
      'Cloudflare': 0.50,
      'React': 0.40,
      'Vue.js': 0.30
    },
    adjacent_clusters: ['jamstack_react', 'jamstack_vue', 'static_site']
  },
  {
    cluster_id: 'spa_modern',
    name: 'Modern SPA',
    description: 'A Single Page Application built with a modern JavaScript framework without server-side rendering. All rendering happens in the browser. Common in internal tools, dashboards, and complex interactive web applications.',
    feature_vector: {
      'React': 0.80,
      'Angular': 0.70,
      'Vue.js': 0.70,
      'Svelte': 0.60,
      'AWS': 0.50,
      'Google Cloud': 0.45,
      'Bootstrap': 0.40,
      'Material UI': 0.50,
      'Google Analytics': 0.45
    },
    adjacent_clusters: ['jamstack_react', 'enterprise_saas', 'jamstack_vue']
  },
  {
    cluster_id: 'wordpress_standard',
    name: 'WordPress Standard',
    description: 'A standard WordPress CMS installation with traditional server-side PHP rendering. The most common website architecture on the internet. Typically hosted on shared or managed WordPress hosting with optional CDN layer.',
    feature_vector: {
      'WordPress': 0.98,
      'PHP': 0.85,
      'jQuery': 0.80,
      'WooCommerce': 0.40,
      'Cloudflare': 0.55,
      'Bootstrap': 0.40,
      'Google Analytics': 0.65,
      'Google Tag Manager': 0.50,
      'Yoast SEO': 0.45
    },
    adjacent_clusters: ['wordpress_ecommerce', 'cms_traditional', 'headless_cms']
  },
  {
    cluster_id: 'wordpress_ecommerce',
    name: 'WordPress E-Commerce',
    description: 'A WordPress installation with WooCommerce powering an online store. The most widely used e-commerce stack in the world. Combines WordPress content management with WooCommerce product and order management.',
    feature_vector: {
      'WordPress': 0.98,
      'WooCommerce': 0.98,
      'PHP': 0.85,
      'jQuery': 0.80,
      'Cloudflare': 0.55,
      'Stripe': 0.60,
      'PayPal': 0.55,
      'Google Analytics': 0.65,
      'Google Tag Manager': 0.55
    },
    adjacent_clusters: ['shopify_standard', 'wordpress_standard', 'headless_commerce']
  },
  {
    cluster_id: 'shopify_standard',
    name: 'Shopify Commerce',
    description: 'A Shopify-powered e-commerce store using Shopify\'s hosted platform. Shopify handles hosting, security, and payments infrastructure. Popular with direct-to-consumer brands and growing e-commerce businesses.',
    feature_vector: {
      'Shopify': 0.98,
      'Cloudflare': 0.70,
      'Google Analytics': 0.70,
      'Google Tag Manager': 0.65,
      'Facebook Pixel': 0.60,
      'Hotjar': 0.45,
      'Klaviyo': 0.40,
      'Stripe': 0.50
    },
    adjacent_clusters: ['wordpress_ecommerce', 'headless_commerce', 'enterprise_commerce']
  },
  {
    cluster_id: 'headless_commerce',
    name: 'Headless Commerce',
    description: 'A modern e-commerce architecture that decouples the frontend presentation layer from the backend commerce engine. Uses a headless CMS or commerce API with a React or Vue frontend for maximum performance and flexibility.',
    feature_vector: {
      'React': 0.85,
      'Next.js': 0.80,
      'Shopify': 0.60,
      'Contentful': 0.55,
      'Sanity': 0.50,
      'Vercel': 0.70,
      'Cloudflare': 0.60,
      'Stripe': 0.65,
      'Algolia': 0.50
    },
    adjacent_clusters: ['shopify_standard', 'jamstack_react', 'enterprise_commerce']
  },
  {
    cluster_id: 'enterprise_saas',
    name: 'Enterprise SaaS',
    description: 'A sophisticated SaaS product architecture built for scale. Typically features React or Angular frontend with enterprise-grade analytics, customer support tooling, A/B testing, and robust monitoring. Deployed on major cloud infrastructure.',
    feature_vector: {
      'React': 0.80,
      'Angular': 0.60,
      'AWS': 0.70,
      'Google Cloud': 0.55,
      'Cloudflare': 0.65,
      'Segment': 0.70,
      'Intercom': 0.65,
      'Sentry': 0.70,
      'Datadog': 0.60,
      'Stripe': 0.65,
      'Google Tag Manager': 0.60,
      'Optimizely': 0.50,
      'HubSpot': 0.55
    },
    adjacent_clusters: ['jamstack_react', 'spa_modern', 'enterprise_commerce']
  },
  {
    cluster_id: 'enterprise_commerce',
    name: 'Enterprise Commerce',
    description: 'A large-scale enterprise e-commerce platform built on Magento, Salesforce Commerce Cloud, or a custom architecture. Handles high transaction volumes with sophisticated inventory, pricing, and personalisation engines.',
    feature_vector: {
      'Magento': 0.85,
      'BigCommerce': 0.70,
      'AWS': 0.75,
      'Azure': 0.60,
      'Akamai': 0.65,
      'Cloudflare': 0.55,
      'Elasticsearch': 0.60,
      'New Relic': 0.55,
      'Datadog': 0.55
    },
    adjacent_clusters: ['shopify_standard', 'headless_commerce', 'enterprise_saas']
  },
  {
    cluster_id: 'cms_traditional',
    name: 'Traditional CMS',
    description: 'A traditional server-rendered CMS architecture using Drupal, Joomla, or similar platforms. Renders HTML on the server for each request. Common in government, education, and established enterprise websites.',
    feature_vector: {
      'Drupal': 0.90,
      'Joomla': 0.85,
      'PHP': 0.90,
      'jQuery': 0.80,
      'Apache': 0.60,
      'Nginx': 0.55,
      'Bootstrap': 0.55,
      'Google Analytics': 0.60
    },
    adjacent_clusters: ['wordpress_standard', 'headless_cms', 'spa_modern']
  },
  {
    cluster_id: 'headless_cms',
    name: 'Headless CMS',
    description: 'A content-first architecture using a headless CMS like Contentful, Sanity, or Ghost to manage content, with a decoupled frontend consuming the content via API. Offers maximum flexibility in how content is presented.',
    feature_vector: {
      'Contentful': 0.85,
      'Sanity': 0.80,
      'Ghost': 0.70,
      'React': 0.75,
      'Next.js': 0.70,
      'Netlify': 0.60,
      'Vercel': 0.65,
      'Cloudflare': 0.50
    },
    adjacent_clusters: ['jamstack_react', 'cms_traditional', 'headless_commerce']
  },
  {
    cluster_id: 'static_site',
    name: 'Static Site',
    description: 'A purely static website with no server-side rendering or dynamic content generation. HTML, CSS, and JavaScript files are served directly. Extremely fast, secure, and cheap to host. Common for portfolios, documentation, and marketing pages.',
    feature_vector: {
      'Cloudflare': 0.60,
      'Netlify': 0.70,
      'GitHub Pages': 0.65,
      'Google Analytics': 0.50,
      'Bootstrap': 0.40,
      'Tailwind CSS': 0.40
    },
    adjacent_clusters: ['jamstack_astro', 'jamstack_react', 'cms_traditional']
  },
  {
    cluster_id: 'webflow_site',
    name: 'Webflow Site',
    description: 'A website built and hosted on Webflow\'s visual development platform. Combines design flexibility with CMS capabilities and reliable hosting. Popular with design agencies, startups, and marketing teams who need visual control without heavy engineering.',
    feature_vector: {
      'Webflow': 0.98,
      'Cloudflare': 0.65,
      'Google Analytics': 0.60,
      'Google Tag Manager': 0.55,
      'Hotjar': 0.40,
      'Intercom': 0.35
    },
    adjacent_clusters: ['static_site', 'cms_traditional', 'jamstack_react']
  },
  {
    cluster_id: 'squarespace_site',
    name: 'Squarespace Site',
    description: 'A website built on Squarespace\'s all-in-one platform. Combines hosting, design templates, and basic e-commerce. Common for small businesses, creatives, restaurants, and personal brands who need a polished online presence without technical complexity.',
    feature_vector: {
      'Squarespace': 0.98,
      'Google Analytics': 0.55,
      'Stripe': 0.45,
      'PayPal': 0.40
    },
    adjacent_clusters: ['wix_site', 'static_site', 'wordpress_standard']
  },
  {
    cluster_id: 'wix_site',
    name: 'Wix Site',
    description: 'A website built on the Wix drag-and-drop website builder platform. Wix hosts all sites on its own infrastructure with built-in CDN. Common for small businesses, events, and individuals who need a website without any coding.',
    feature_vector: {
      'Wix': 0.98,
      'Google Analytics': 0.50,
      'Google Tag Manager': 0.45
    },
    adjacent_clusters: ['squarespace_site', 'static_site', 'wordpress_standard']
  },
  {
    cluster_id: 'ruby_rails',
    name: 'Ruby on Rails',
    description: 'A server-rendered web application built with Ruby on Rails. Follows convention-over-configuration principles with strong MVC architecture. Common in startups and established products that were built in the Rails golden era.',
    feature_vector: {
      'Ruby on Rails': 0.95,
      'Heroku': 0.60,
      'AWS': 0.55,
      'Cloudflare': 0.50,
      'Bootstrap': 0.50,
      'Stripe': 0.55,
      'Google Analytics': 0.50,
      'Sentry': 0.50
    },
    adjacent_clusters: ['django_python', 'spa_modern', 'enterprise_saas']
  },
  {
    cluster_id: 'django_python',
    name: 'Django Python',
    description: 'A server-rendered web application built with Django. Python\'s most popular web framework with strong ORM, admin panel, and security features built in. Common in data-heavy applications, government sites, and scientific platforms.',
    feature_vector: {
      'Django': 0.95,
      'AWS': 0.60,
      'Google Cloud': 0.55,
      'Nginx': 0.65,
      'Cloudflare': 0.50,
      'Bootstrap': 0.45,
      'Google Analytics': 0.50,
      'Sentry': 0.50
    },
    adjacent_clusters: ['ruby_rails', 'laravel_php', 'enterprise_saas']
  },
  {
    cluster_id: 'laravel_php',
    name: 'Laravel PHP',
    description: 'A server-rendered web application built with the Laravel PHP framework. Modern PHP with elegant syntax, strong ORM, and a rich ecosystem. Common in agencies, startups, and established businesses built on PHP.',
    feature_vector: {
      'Laravel': 0.95,
      'PHP': 0.90,
      'Nginx': 0.60,
      'Apache': 0.55,
      'Bootstrap': 0.55,
      'Vue.js': 0.50,
      'AWS': 0.55,
      'Google Analytics': 0.50
    },
    adjacent_clusters: ['wordpress_standard', 'django_python', 'ruby_rails']
  }
];

function cosineSimilarity(vectorA, vectorB) {
  const keysA = Object.keys(vectorA);
  const keysB = Object.keys(vectorB);
  const allKeys = new Set([...keysA, ...keysB]);

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (const key of allKeys) {
    const a = vectorA[key] || 0;
    const b = vectorB[key] || 0;
    dotProduct += a * b;
    magnitudeA += a * a;
    magnitudeB += b * b;
  }

  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

function buildScanVector(technologies) {
  const vector = {};
  for (const tech of technologies) {
    vector[tech.name] = tech.confidence;
  }
  return vector;
}

async function classifyCluster(technologies) {
  try {
    logger.info('Classifying ecosystem cluster');

    let clusters = await getAllClusters();

    if (!clusters || clusters.length === 0) {
      logger.warn('No clusters in database — using built-in cluster definitions');
      clusters = BUILT_IN_CLUSTERS;
    }

    if (!technologies || technologies.length === 0) {
      return {
        id: 'unknown',
        name: 'Unknown',
        confidence: 0,
        description: 'Insufficient technology signals to classify this website',
        adjacentClusters: []
      };
    }

    const scanVector = buildScanVector(technologies);
    const scores = [];

    for (const cluster of clusters) {
      const featureVector = cluster.feature_vector || {};
      const similarity = cosineSimilarity(scanVector, featureVector);

      scores.push({
        id: cluster.cluster_id,
        name: cluster.name,
        description: cluster.description,
        confidence: parseFloat(similarity.toFixed(4)),
        adjacentClusters: cluster.adjacent_clusters || []
      });
    }

    scores.sort((a, b) => b.confidence - a.confidence);

    const best = scores[0];

    if (!best || best.confidence < 0.05) {
      return {
        id: 'unclassified',
        name: 'Unclassified Stack',
        confidence: 0,
        description: 'This website uses a unique or uncommon technology combination that does not match any known ecosystem archetype.',
        adjacentClusters: scores.slice(1, 4).map(s => s.name)
      };
    }

    // FIX — LOW SIGNAL THRESHOLD: When the highest-confidence cluster match is
    // below 20%, the classification is too weak to be trustworthy. Below this
    // threshold the "best" match is often only marginally ahead of several
    // other clusters (e.g. PayPal matched "Webflow Site" at 13% — barely
    // above the next candidates). Confidently declaring a specific archetype
    // at this confidence level cascades into wrong architecture and industry
    // classifications downstream in intelligence.js. Instead, return a
    // "Low Signal" result that is honest about the uncertainty while still
    // surfacing the top candidates for reference.
    const LOW_SIGNAL_THRESHOLD = 0.20;

    if (best.confidence < LOW_SIGNAL_THRESHOLD) {
      logger.info(`Cluster confidence too low for commitment: ${best.name} at ${best.confidence} (threshold ${LOW_SIGNAL_THRESHOLD}) — returning Low Signal`);

      return {
        id: 'low_signal',
        name: 'Low Signal',
        confidence: best.confidence,
        description: `Detected technologies show some similarity to ${best.name} (${Math.round(best.confidence * 100)}% match) and other archetypes, but no single ecosystem pattern is a confident match. This usually means the site uses a custom or hybrid technology stack that does not closely follow common archetypes.`,
        adjacentClusters: scores.slice(0, 4).map(s => s.name),
        allScores: scores.slice(0, 5).map(s => ({
          id: s.id,
          name: s.name,
          confidence: s.confidence
        }))
      };
    }

    logger.info(`Cluster classified: ${best.name} — confidence: ${best.confidence}`);

    return {
      id: best.id,
      name: best.name,
      confidence: best.confidence,
      description: best.description,
      adjacentClusters: best.adjacentClusters,
      allScores: scores.slice(0, 5).map(s => ({
        id: s.id,
        name: s.name,
        confidence: s.confidence
      }))
    };

  } catch (err) {
    logger.error(`Cluster classification failed: ${err.message}`);
    return {
      id: 'error',
      name: 'Classification Error',
      confidence: 0,
      description: 'An error occurred during cluster classification',
      adjacentClusters: []
    };
  }
}

module.exports = { classifyCluster };
