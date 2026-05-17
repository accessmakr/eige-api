'use strict';

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ─── CLUSTER DEFINITIONS ─────────────────────────────────────────────────────

const CLUSTERS = [
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
      'Google Tag Manager': 0.45,
      'Sentry': 0.45
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
      'Google Analytics': 0.50,
      'Sentry': 0.40
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
      'Vue.js': 0.30,
      'Google Analytics': 0.45
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
      'Google Analytics': 0.45,
      'Firebase': 0.45
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
      'Cloudflare': 0.55,
      'Bootstrap': 0.40,
      'Google Analytics': 0.65,
      'Google Tag Manager': 0.50,
      'Apache': 0.50,
      'Nginx': 0.45
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
      'Google Tag Manager': 0.55,
      'Facebook Pixel': 0.55
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
      'Stripe': 0.50,
      'PayPal': 0.45
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
      'Algolia': 0.50,
      'Tailwind CSS': 0.55
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
      'HubSpot': 0.55,
      'Hotjar': 0.50
    },
    adjacent_clusters: ['jamstack_react', 'spa_modern', 'enterprise_commerce']
  },
  {
    cluster_id: 'enterprise_commerce',
    name: 'Enterprise Commerce',
    description: 'A large-scale enterprise e-commerce platform built on Magento, BigCommerce, or a custom architecture. Handles high transaction volumes with sophisticated inventory, pricing, and personalisation engines.',
    feature_vector: {
      'Magento': 0.85,
      'BigCommerce': 0.70,
      'AWS': 0.75,
      'Azure': 0.60,
      'Akamai': 0.65,
      'Cloudflare': 0.55,
      'Elasticsearch': 0.60,
      'New Relic': 0.55,
      'Datadog': 0.55,
      'Google Tag Manager': 0.60
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
      'Google Analytics': 0.60,
      'Cloudflare': 0.45
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
      'Cloudflare': 0.50,
      'Tailwind CSS': 0.50
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
      'Tailwind CSS': 0.40,
      'Google Fonts': 0.55
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
      'Intercom': 0.35,
      'HubSpot': 0.35
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
      'PayPal': 0.40,
      'Google Fonts': 0.50
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
      'Google Tag Manager': 0.45,
      'Google Fonts': 0.45
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
      'Sentry': 0.50,
      'Hotjar': 0.40
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
      'Sentry': 0.50,
      'New Relic': 0.40
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
      'Google Analytics': 0.50,
      'Cloudflare': 0.50
    },
    adjacent_clusters: ['wordpress_standard', 'django_python', 'ruby_rails']
  },
  {
    cluster_id: 'node_express',
    name: 'Node.js Express',
    description: 'A server-side JavaScript application built with Node.js and Express. Lightweight and flexible with a vast npm ecosystem. Common for REST APIs, real-time applications, and microservices.',
    feature_vector: {
      'Node.js': 0.95,
      'AWS': 0.60,
      'Google Cloud': 0.55,
      'Heroku': 0.55,
      'Render': 0.50,
      'Cloudflare': 0.50,
      'React': 0.55,
      'Vue.js': 0.45,
      'Sentry': 0.45
    },
    adjacent_clusters: ['jamstack_react', 'enterprise_saas', 'spa_modern']
  }
];

// ─── CO-OCCURRENCE SEED DATA ──────────────────────────────────────────────────
// Pre-populate the global graph with known real-world technology relationships
// so the Graph mode works beautifully from day one before any scans are done

const CO_OCCURRENCES = [
  // React ecosystem
  { tech_a: 'Next.js', tech_b: 'React', category_a: 'JavaScript Framework', category_b: 'JavaScript Framework', count: 950, weight: 1.00 },
  { tech_a: 'React', tech_b: 'Tailwind CSS', category_a: 'JavaScript Framework', category_b: 'CSS Framework', count: 820, weight: 0.86 },
  { tech_a: 'Next.js', tech_b: 'Vercel', category_a: 'JavaScript Framework', category_b: 'Hosting', count: 780, weight: 0.82 },
  { tech_a: 'React', tech_b: 'Google Analytics', category_a: 'JavaScript Framework', category_b: 'Analytics', count: 750, weight: 0.79 },
  { tech_a: 'Next.js', tech_b: 'Cloudflare', category_a: 'JavaScript Framework', category_b: 'CDN', count: 720, weight: 0.76 },
  { tech_a: 'React', tech_b: 'Google Tag Manager', category_a: 'JavaScript Framework', category_b: 'Tag Manager', count: 690, weight: 0.73 },
  { tech_a: 'Next.js', tech_b: 'Tailwind CSS', category_a: 'JavaScript Framework', category_b: 'CSS Framework', count: 680, weight: 0.72 },
  { tech_a: 'React', tech_b: 'Stripe', category_a: 'JavaScript Framework', category_b: 'Payment', count: 640, weight: 0.67 },
  { tech_a: 'React', tech_b: 'Sentry', category_a: 'JavaScript Framework', category_b: 'Monitoring', count: 620, weight: 0.65 },
  { tech_a: 'React', tech_b: 'Intercom', category_a: 'JavaScript Framework', category_b: 'Customer Support', count: 580, weight: 0.61 },
  { tech_a: 'React', tech_b: 'Segment', category_a: 'JavaScript Framework', category_b: 'Analytics', count: 560, weight: 0.59 },
  { tech_a: 'Next.js', tech_b: 'Sentry', category_a: 'JavaScript Framework', category_b: 'Monitoring', count: 540, weight: 0.57 },
  { tech_a: 'React', tech_b: 'HubSpot', category_a: 'JavaScript Framework', category_b: 'Marketing', count: 520, weight: 0.55 },
  { tech_a: 'React', tech_b: 'Hotjar', category_a: 'JavaScript Framework', category_b: 'Analytics', count: 500, weight: 0.53 },
  { tech_a: 'Next.js', tech_b: 'Google Analytics', category_a: 'JavaScript Framework', category_b: 'Analytics', count: 680, weight: 0.72 },
  { tech_a: 'React', tech_b: 'Material UI', category_a: 'JavaScript Framework', category_b: 'CSS Framework', count: 480, weight: 0.51 },
  { tech_a: 'React', tech_b: 'Cloudflare', category_a: 'JavaScript Framework', category_b: 'CDN', count: 700, weight: 0.74 },
  { tech_a: 'Next.js', tech_b: 'Google Tag Manager', category_a: 'JavaScript Framework', category_b: 'Tag Manager', count: 640, weight: 0.67 },
  { tech_a: 'React', tech_b: 'AWS', category_a: 'JavaScript Framework', category_b: 'Hosting', count: 660, weight: 0.69 },
  { tech_a: 'Next.js', tech_b: 'AWS', category_a: 'JavaScript Framework', category_b: 'Hosting', count: 580, weight: 0.61 },

  // Vue ecosystem
  { tech_a: 'Nuxt.js', tech_b: 'Vue.js', category_a: 'JavaScript Framework', category_b: 'JavaScript Framework', count: 880, weight: 0.93 },
  { tech_a: 'Vue.js', tech_b: 'Tailwind CSS', category_a: 'JavaScript Framework', category_b: 'CSS Framework', count: 640, weight: 0.67 },
  { tech_a: 'Nuxt.js', tech_b: 'Cloudflare', category_a: 'JavaScript Framework', category_b: 'CDN', count: 580, weight: 0.61 },
  { tech_a: 'Vue.js', tech_b: 'Google Analytics', category_a: 'JavaScript Framework', category_b: 'Analytics', count: 620, weight: 0.65 },
  { tech_a: 'Vue.js', tech_b: 'Bootstrap', category_a: 'JavaScript Framework', category_b: 'CSS Framework', count: 540, weight: 0.57 },
  { tech_a: 'Nuxt.js', tech_b: 'Vercel', category_a: 'JavaScript Framework', category_b: 'Hosting', count: 520, weight: 0.55 },
  { tech_a: 'Vue.js', tech_b: 'Sentry', category_a: 'JavaScript Framework', category_b: 'Monitoring', count: 480, weight: 0.51 },
  { tech_a: 'Laravel', tech_b: 'Vue.js', category_a: 'Programming Language', category_b: 'JavaScript Framework', count: 560, weight: 0.59 },

  // WordPress ecosystem
  { tech_a: 'WordPress', tech_b: 'jQuery', category_a: 'CMS', category_b: 'JavaScript Library', count: 920, weight: 0.97 },
  { tech_a: 'WordPress', tech_b: 'PHP', category_a: 'CMS', category_b: 'Programming Language', count: 900, weight: 0.95 },
  { tech_a: 'WordPress', tech_b: 'Cloudflare', category_a: 'CMS', category_b: 'CDN', count: 780, weight: 0.82 },
  { tech_a: 'WordPress', tech_b: 'Google Analytics', category_a: 'CMS', category_b: 'Analytics', count: 820, weight: 0.86 },
  { tech_a: 'WordPress', tech_b: 'Google Tag Manager', category_a: 'CMS', category_b: 'Tag Manager', count: 720, weight: 0.76 },
  { tech_a: 'WordPress', tech_b: 'WooCommerce', category_a: 'CMS', category_b: 'E-Commerce', count: 680, weight: 0.72 },
  { tech_a: 'WooCommerce', tech_b: 'Stripe', category_a: 'E-Commerce', category_b: 'Payment', count: 620, weight: 0.65 },
  { tech_a: 'WooCommerce', tech_b: 'PayPal', category_a: 'E-Commerce', category_b: 'Payment', count: 600, weight: 0.63 },
  { tech_a: 'WordPress', tech_b: 'Bootstrap', category_a: 'CMS', category_b: 'CSS Framework', count: 580, weight: 0.61 },
  { tech_a: 'WordPress', tech_b: 'Facebook Pixel', category_a: 'CMS', category_b: 'Marketing', count: 560, weight: 0.59 },
  { tech_a: 'WordPress', tech_b: 'Hotjar', category_a: 'CMS', category_b: 'Analytics', count: 480, weight: 0.51 },
  { tech_a: 'PHP', tech_b: 'Apache', category_a: 'Programming Language', category_b: 'Web Server', count: 700, weight: 0.74 },
  { tech_a: 'PHP', tech_b: 'Nginx', category_a: 'Programming Language', category_b: 'Web Server', count: 640, weight: 0.67 },
  { tech_a: 'jQuery', tech_b: 'Bootstrap', category_a: 'JavaScript Library', category_b: 'CSS Framework', count: 720, weight: 0.76 },
  { tech_a: 'jQuery', tech_b: 'Google Analytics', category_a: 'JavaScript Library', category_b: 'Analytics', count: 680, weight: 0.72 },

  // Shopify ecosystem
  { tech_a: 'Shopify', tech_b: 'Cloudflare', category_a: 'E-Commerce', category_b: 'CDN', count: 820, weight: 0.86 },
  { tech_a: 'Shopify', tech_b: 'Google Analytics', category_a: 'E-Commerce', category_b: 'Analytics', count: 800, weight: 0.84 },
  { tech_a: 'Shopify', tech_b: 'Google Tag Manager', category_a: 'E-Commerce', category_b: 'Tag Manager', count: 760, weight: 0.80 },
  { tech_a: 'Shopify', tech_b: 'Facebook Pixel', category_a: 'E-Commerce', category_b: 'Marketing', count: 740, weight: 0.78 },
  { tech_a: 'Shopify', tech_b: 'Klaviyo', category_a: 'E-Commerce', category_b: 'Marketing', count: 560, weight: 0.59 },
  { tech_a: 'Shopify', tech_b: 'Hotjar', category_a: 'E-Commerce', category_b: 'Analytics', count: 520, weight: 0.55 },
  { tech_a: 'Shopify', tech_b: 'Stripe', category_a: 'E-Commerce', category_b: 'Payment', count: 580, weight: 0.61 },
  { tech_a: 'Shopify', tech_b: 'PayPal', category_a: 'E-Commerce', category_b: 'Payment', count: 540, weight: 0.57 },
  { tech_a: 'Shopify', tech_b: 'Intercom', category_a: 'E-Commerce', category_b: 'Customer Support', count: 420, weight: 0.44 },

  // CDN relationships
  { tech_a: 'Cloudflare', tech_b: 'Google Analytics', category_a: 'CDN', category_b: 'Analytics', count: 880, weight: 0.93 },
  { tech_a: 'Cloudflare', tech_b: 'Google Tag Manager', category_a: 'CDN', category_b: 'Tag Manager', count: 820, weight: 0.86 },
  { tech_a: 'Cloudflare', tech_b: 'Stripe', category_a: 'CDN', category_b: 'Payment', count: 680, weight: 0.72 },
  { tech_a: 'Cloudflare', tech_b: 'Intercom', category_a: 'CDN', category_b: 'Customer Support', count: 620, weight: 0.65 },
  { tech_a: 'Cloudflare', tech_b: 'Sentry', category_a: 'CDN', category_b: 'Monitoring', count: 580, weight: 0.61 },
  { tech_a: 'Cloudflare', tech_b: 'HubSpot', category_a: 'CDN', category_b: 'Marketing', count: 560, weight: 0.59 },
  { tech_a: 'Cloudflare', tech_b: 'Hotjar', category_a: 'CDN', category_b: 'Analytics', count: 540, weight: 0.57 },
  { tech_a: 'AWS', tech_b: 'AWS CloudFront', category_a: 'Hosting', category_b: 'CDN', count: 760, weight: 0.80 },
  { tech_a: 'AWS', tech_b: 'Google Analytics', category_a: 'Hosting', category_b: 'Analytics', count: 680, weight: 0.72 },
  { tech_a: 'Vercel', tech_b: 'Cloudflare', category_a: 'Hosting', category_b: 'CDN', count: 620, weight: 0.65 },
  { tech_a: 'Netlify', tech_b: 'Cloudflare', category_a: 'Hosting', category_b: 'CDN', count: 580, weight: 0.61 },

  // Analytics relationships
  { tech_a: 'Google Analytics', tech_b: 'Google Tag Manager', category_a: 'Analytics', category_b: 'Tag Manager', count: 880, weight: 0.93 },
  { tech_a: 'Google Analytics', tech_b: 'Facebook Pixel', category_a: 'Analytics', category_b: 'Marketing', count: 760, weight: 0.80 },
  { tech_a: 'Google Analytics', tech_b: 'Hotjar', category_a: 'Analytics', category_b: 'Analytics', count: 680, weight: 0.72 },
  { tech_a: 'Google Analytics', tech_b: 'HubSpot', category_a: 'Analytics', category_b: 'Marketing', count: 620, weight: 0.65 },
  { tech_a: 'Google Analytics', tech_b: 'Intercom', category_a: 'Analytics', category_b: 'Customer Support', count: 580, weight: 0.61 },
  { tech_a: 'Google Tag Manager', tech_b: 'Facebook Pixel', category_a: 'Tag Manager', category_b: 'Marketing', count: 720, weight: 0.76 },
  { tech_a: 'Google Tag Manager', tech_b: 'Hotjar', category_a: 'Tag Manager', category_b: 'Analytics', count: 640, weight: 0.67 },
  { tech_a: 'Segment', tech_b: 'Intercom', category_a: 'Analytics', category_b: 'Customer Support', count: 480, weight: 0.51 },
  { tech_a: 'Segment', tech_b: 'Mixpanel', category_a: 'Analytics', category_b: 'Analytics', count: 460, weight: 0.48 },
  { tech_a: 'Segment', tech_b: 'Google Analytics', category_a: 'Analytics', category_b: 'Analytics', count: 500, weight: 0.53 },

  // Enterprise SaaS relationships
  { tech_a: 'Stripe', tech_b: 'Intercom', category_a: 'Payment', category_b: 'Customer Support', count: 620, weight: 0.65 },
  { tech_a: 'Stripe', tech_b: 'Google Analytics', category_a: 'Payment', category_b: 'Analytics', count: 680, weight: 0.72 },
  { tech_a: 'Stripe', tech_b: 'Sentry', category_a: 'Payment', category_b: 'Monitoring', count: 560, weight: 0.59 },
  { tech_a: 'Stripe', tech_b: 'HubSpot', category_a: 'Payment', category_b: 'Marketing', count: 520, weight: 0.55 },
  { tech_a: 'Stripe', tech_b: 'Segment', category_a: 'Payment', category_b: 'Analytics', count: 500, weight: 0.53 },
  { tech_a: 'Intercom', tech_b: 'Sentry', category_a: 'Customer Support', category_b: 'Monitoring', count: 480, weight: 0.51 },
  { tech_a: 'Intercom', tech_b: 'HubSpot', category_a: 'Customer Support', category_b: 'Marketing', count: 460, weight: 0.48 },
  { tech_a: 'Sentry', tech_b: 'Datadog', category_a: 'Monitoring', category_b: 'Monitoring', count: 420, weight: 0.44 },
  { tech_a: 'Sentry', tech_b: 'Google Analytics', category_a: 'Monitoring', category_b: 'Analytics', count: 500, weight: 0.53 },
  { tech_a: 'HubSpot', tech_b: 'Google Analytics', category_a: 'Marketing', category_b: 'Analytics', count: 660, weight: 0.69 },
  { tech_a: 'HubSpot', tech_b: 'Google Tag Manager', category_a: 'Marketing', category_b: 'Tag Manager', count: 620, weight: 0.65 },
  { tech_a: 'HubSpot', tech_b: 'Facebook Pixel', category_a: 'Marketing', category_b: 'Marketing', count: 560, weight: 0.59 },

  // Webflow, Squarespace, Wix
  { tech_a: 'Webflow', tech_b: 'Cloudflare', category_a: 'CMS', category_b: 'CDN', count: 680, weight: 0.72 },
  { tech_a: 'Webflow', tech_b: 'Google Analytics', category_a: 'CMS', category_b: 'Analytics', count: 660, weight: 0.69 },
  { tech_a: 'Webflow', tech_b: 'Google Tag Manager', category_a: 'CMS', category_b: 'Tag Manager', count: 600, weight: 0.63 },
  { tech_a: 'Webflow', tech_b: 'Hotjar', category_a: 'CMS', category_b: 'Analytics', count: 480, weight: 0.51 },
  { tech_a: 'Squarespace', tech_b: 'Google Analytics', category_a: 'CMS', category_b: 'Analytics', count: 580, weight: 0.61 },
  { tech_a: 'Squarespace', tech_b: 'Google Fonts', category_a: 'CMS', category_b: 'Font', count: 620, weight: 0.65 },
  { tech_a: 'Wix', tech_b: 'Google Analytics', category_a: 'CMS', category_b: 'Analytics', count: 540, weight: 0.57 },
  { tech_a: 'Wix', tech_b: 'Google Fonts', category_a: 'CMS', category_b: 'Font', count: 560, weight: 0.59 },

  // Security relationships
  { tech_a: 'reCAPTCHA', tech_b: 'Google Analytics', category_a: 'Security', category_b: 'Analytics', count: 580, weight: 0.61 },
  { tech_a: 'reCAPTCHA', tech_b: 'WordPress', category_a: 'Security', category_b: 'CMS', count: 540, weight: 0.57 },
  { tech_a: 'reCAPTCHA', tech_b: 'Cloudflare', category_a: 'Security', category_b: 'CDN', count: 520, weight: 0.55 },
  { tech_a: 'hCaptcha', tech_b: 'Cloudflare', category_a: 'Security', category_b: 'CDN', count: 480, weight: 0.51 },

  // Font relationships
  { tech_a: 'Google Fonts', tech_b: 'Google Analytics', category_a: 'Font', category_b: 'Analytics', count: 760, weight: 0.80 },
  { tech_a: 'Google Fonts', tech_b: 'Bootstrap', category_a: 'Font', category_b: 'CSS Framework', count: 680, weight: 0.72 },
  { tech_a: 'Google Fonts', tech_b: 'WordPress', category_a: 'Font', category_b: 'CMS', count: 720, weight: 0.76 },
  { tech_a: 'Google Fonts', tech_b: 'jQuery', category_a: 'Font', category_b: 'JavaScript Library', count: 660, weight: 0.69 },
  { tech_a: 'Google Fonts', tech_b: 'Cloudflare', category_a: 'Font', category_b: 'CDN', count: 640, weight: 0.67 },
  { tech_a: 'Google Fonts', tech_b: 'Tailwind CSS', category_a: 'Font', category_b: 'CSS Framework', count: 580, weight: 0.61 },

  // Server technology relationships
  { tech_a: 'Nginx', tech_b: 'Cloudflare', category_a: 'Web Server', category_b: 'CDN', count: 680, weight: 0.72 },
  { tech_a: 'Nginx', tech_b: 'Google Analytics', category_a: 'Web Server', category_b: 'Analytics', count: 580, weight: 0.61 },
  { tech_a: 'Apache', tech_b: 'WordPress', category_a: 'Web Server', category_b: 'CMS', count: 720, weight: 0.76 },
  { tech_a: 'Apache', tech_b: 'PHP', category_a: 'Web Server', category_b: 'Programming Language', count: 760, weight: 0.80 },
  { tech_a: 'Django', tech_b: 'AWS', category_a: 'Programming Language', category_b: 'Hosting', count: 560, weight: 0.59 },
  { tech_a: 'Django', tech_b: 'Nginx', category_a: 'Programming Language', category_b: 'Web Server', count: 600, weight: 0.63 },
  { tech_a: 'Ruby on Rails', tech_b: 'Heroku', category_a: 'Programming Language', category_b: 'Hosting', count: 580, weight: 0.61 },
  { tech_a: 'Ruby on Rails', tech_b: 'AWS', category_a: 'Programming Language', category_b: 'Hosting', count: 540, weight: 0.57 },
  { tech_a: 'Laravel', tech_b: 'PHP', category_a: 'Programming Language', category_b: 'Programming Language', count: 880, weight: 0.93 },
  { tech_a: 'Laravel', tech_b: 'Nginx', category_a: 'Programming Language', category_b: 'Web Server', count: 620, weight: 0.65 },
  { tech_a: 'Node.js', tech_b: 'AWS', category_a: 'Programming Language', category_b: 'Hosting', count: 620, weight: 0.65 },
  { tech_a: 'Node.js', tech_b: 'Cloudflare', category_a: 'Programming Language', category_b: 'CDN', count: 560, weight: 0.59 },

  // Database relationships
  { tech_a: 'Firebase', tech_b: 'React', category_a: 'Database', category_b: 'JavaScript Framework', count: 580, weight: 0.61 },
  { tech_a: 'Firebase', tech_b: 'Vue.js', category_a: 'Database', category_b: 'JavaScript Framework', count: 480, weight: 0.51 },
  { tech_a: 'Firebase', tech_b: 'Google Analytics', category_a: 'Database', category_b: 'Analytics', count: 560, weight: 0.59 },
  { tech_a: 'Supabase', tech_b: 'React', category_a: 'Database', category_b: 'JavaScript Framework', count: 480, weight: 0.51 },
  { tech_a: 'Supabase', tech_b: 'Next.js', category_a: 'Database', category_b: 'JavaScript Framework', count: 460, weight: 0.48 },
  { tech_a: 'Supabase', tech_b: 'Tailwind CSS', category_a: 'Database', category_b: 'CSS Framework', count: 420, weight: 0.44 },

  // Map relationships
  { tech_a: 'Google Maps', tech_b: 'Google Analytics', category_a: 'Map', category_b: 'Analytics', count: 620, weight: 0.65 },
  { tech_a: 'Google Maps', tech_b: 'WordPress', category_a: 'Map', category_b: 'CMS', count: 560, weight: 0.59 },
  { tech_a: 'Google Maps', tech_b: 'jQuery', category_a: 'Map', category_b: 'JavaScript Library', count: 520, weight: 0.55 },
  { tech_a: 'Mapbox', tech_b: 'React', category_a: 'Map', category_b: 'JavaScript Framework', count: 480, weight: 0.51 },

  // Search relationships
  { tech_a: 'Algolia', tech_b: 'React', category_a: 'Search', category_b: 'JavaScript Framework', count: 560, weight: 0.59 },
  { tech_a: 'Algolia', tech_b: 'Next.js', category_a: 'Search', category_b: 'JavaScript Framework', count: 520, weight: 0.55 },
  { tech_a: 'Algolia', tech_b: 'Shopify', category_a: 'Search', category_b: 'E-Commerce', count: 480, weight: 0.51 },

  // African payment ecosystem
  { tech_a: 'Paystack', tech_b: 'Google Analytics', category_a: 'Payment', category_b: 'Analytics', count: 420, weight: 0.44 },
  { tech_a: 'Paystack', tech_b: 'WordPress', category_a: 'Payment', category_b: 'CMS', count: 380, weight: 0.40 },
  { tech_a: 'Flutterwave', tech_b: 'Google Analytics', category_a: 'Payment', category_b: 'Analytics', count: 400, weight: 0.42 },
  { tech_a: 'Flutterwave', tech_b: 'React', category_a: 'Payment', category_b: 'JavaScript Framework', count: 380, weight: 0.40 },
  { tech_a: 'Razorpay', tech_b: 'Google Analytics', category_a: 'Payment', category_b: 'Analytics', count: 400, weight: 0.42 },
  { tech_a: 'Razorpay', tech_b: 'React', category_a: 'Payment', category_b: 'JavaScript Framework', count: 380, weight: 0.40 },

  // Video relationships
  { tech_a: 'YouTube', tech_b: 'WordPress', category_a: 'Video', category_b: 'CMS', count: 620, weight: 0.65 },
  { tech_a: 'YouTube', tech_b: 'Google Analytics', category_a: 'Video', category_b: 'Analytics', count: 580, weight: 0.61 },
  { tech_a: 'Vimeo', tech_b: 'React', category_a: 'Video', category_b: 'JavaScript Framework', count: 440, weight: 0.46 },
  { tech_a: 'Vimeo', tech_b: 'Webflow', category_a: 'Video', category_b: 'CMS', count: 420, weight: 0.44 },

  // Marketing pixel relationships
  { tech_a: 'Facebook Pixel', tech_b: 'Google Analytics', category_a: 'Marketing', category_b: 'Analytics', count: 820, weight: 0.86 },
  { tech_a: 'Facebook Pixel', tech_b: 'Google Tag Manager', category_a: 'Marketing', category_b: 'Tag Manager', count: 760, weight: 0.80 },
  { tech_a: 'Facebook Pixel', tech_b: 'Cloudflare', category_a: 'Marketing', category_b: 'CDN', count: 680, weight: 0.72 },
  { tech_a: 'TikTok Pixel', tech_b: 'Facebook Pixel', category_a: 'Marketing', category_b: 'Marketing', count: 560, weight: 0.59 },
  { tech_a: 'TikTok Pixel', tech_b: 'Google Tag Manager', category_a: 'Marketing', category_b: 'Tag Manager', count: 520, weight: 0.55 },
  { tech_a: 'LinkedIn Insight', tech_b: 'Google Tag Manager', category_a: 'Marketing', category_b: 'Tag Manager', count: 480, weight: 0.51 },
  { tech_a: 'LinkedIn Insight', tech_b: 'HubSpot', category_a: 'Marketing', category_b: 'Marketing', count: 460, weight: 0.48 },

  // A/B Testing relationships
  { tech_a: 'Optimizely', tech_b: 'Google Analytics', category_a: 'A/B Testing', category_b: 'Analytics', count: 480, weight: 0.51 },
  { tech_a: 'Optimizely', tech_b: 'Segment', category_a: 'A/B Testing', category_b: 'Analytics', count: 440, weight: 0.46 },
  { tech_a: 'VWO', tech_b: 'Google Analytics', category_a: 'A/B Testing', category_b: 'Analytics', count: 460, weight: 0.48 },

  // Mailchimp / Klaviyo / Marketing
  { tech_a: 'Mailchimp', tech_b: 'WordPress', category_a: 'Marketing', category_b: 'CMS', count: 580, weight: 0.61 },
  { tech_a: 'Mailchimp', tech_b: 'Google Analytics', category_a: 'Marketing', category_b: 'Analytics', count: 540, weight: 0.57 },
  { tech_a: 'Klaviyo', tech_b: 'Google Analytics', category_a: 'Marketing', category_b: 'Analytics', count: 520, weight: 0.55 },
  { tech_a: 'Klaviyo', tech_b: 'Facebook Pixel', category_a: 'Marketing', category_b: 'Marketing', count: 500, weight: 0.53 }
];

// ─── SEED FUNCTIONS ───────────────────────────────────────────────────────────

async function seedClusters() {
  console.log(`\nSeeding ${CLUSTERS.length} cluster definitions...`);

  let inserted = 0;
  let failed = 0;

  for (const cluster of CLUSTERS) {
    try {
      const { error } = await supabase
        .from('clusters')
        .upsert(cluster, { onConflict: 'cluster_id' });

      if (error) {
        console.error(`Failed to upsert cluster "${cluster.name}": ${error.message}`);
        failed++;
      } else {
        console.log(`✓ Cluster: ${cluster.name}`);
        inserted++;
      }
    } catch (err) {
      console.error(`Error processing cluster "${cluster.name}": ${err.message}`);
      failed++;
    }
  }

  console.log(`Clusters complete — ✓ ${inserted} inserted, ✗ ${failed} failed`);
}

async function seedCoOccurrences() {
  console.log(`\nSeeding ${CO_OCCURRENCES.length} co-occurrence pairs...`);

  let inserted = 0;
  let failed = 0;

  for (const pair of CO_OCCURRENCES) {
    try {
      const techA = pair.tech_a < pair.tech_b ? pair.tech_a : pair.tech_b;
      const techB = pair.tech_a < pair.tech_b ? pair.tech_b : pair.tech_a;
      const categoryA = pair.tech_a < pair.tech_b ? pair.category_a : pair.category_b;
      const categoryB = pair.tech_a < pair.tech_b ? pair.category_b : pair.category_a;

      const { error } = await supabase
        .from('co_occurrence')
        .upsert({
          tech_a: techA,
          tech_b: techB,
          category_a: categoryA,
          category_b: categoryB,
          count: pair.count,
          weight: pair.weight,
          updated_at: new Date().toISOString()
        }, { onConflict: 'tech_a,tech_b' });

      if (error) {
        console.error(`Failed to upsert pair "${techA} + ${techB}": ${error.message}`);
        failed++;
      } else {
        console.log(`✓ Co-occurrence: ${techA} ↔ ${techB} (weight: ${pair.weight})`);
        inserted++;
      }
    } catch (err) {
      console.error(`Error processing pair: ${err.message}`);
      failed++;
    }
  }

  console.log(`Co-occurrences complete — ✓ ${inserted} inserted, ✗ ${failed} failed`);
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  EIGE v10 — Database Seed Script');
  console.log('═══════════════════════════════════════════');

  await seedClusters();
  await seedCoOccurrences();

  console.log('\n═══════════════════════════════════════════');
  console.log('  Seed complete — EIGE v10 is ready');
  console.log('═══════════════════════════════════════════\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
