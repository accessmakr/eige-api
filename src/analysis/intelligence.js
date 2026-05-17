'use strict';

const logger = require('../utils/logger');

// ─── ARCHITECTURE CLASSIFICATION ─────────────────────────────────────────────

const ARCHITECTURE_RULES = [
  {
    id: 'jamstack_ssr',
    name: 'JAMstack SSR',
    description: 'Server-side rendered JAMstack with edge delivery',
    match: (techs) => {
      const names = techs.map(t => t.name);
      return (
        (names.includes('Next.js') || names.includes('Nuxt.js') || names.includes('Remix')) &&
        (names.includes('Vercel') || names.includes('Netlify') || names.includes('Cloudflare'))
      );
    },
    priority: 10
  },
  {
    id: 'jamstack_static',
    name: 'JAMstack Static',
    description: 'Statically generated JAMstack with CDN delivery',
    match: (techs) => {
      const names = techs.map(t => t.name);
      return (
        names.includes('Astro') ||
        (
          (names.includes('React') || names.includes('Vue.js') || names.includes('Svelte')) &&
          (names.includes('Netlify') || names.includes('Vercel') || names.includes('GitHub Pages')) &&
          !names.includes('Next.js') &&
          !names.includes('Nuxt.js')
        )
      );
    },
    priority: 9
  },
  {
    id: 'headless_commerce',
    name: 'Headless Commerce',
    description: 'Decoupled frontend with headless commerce backend',
    match: (techs) => {
      const names = techs.map(t => t.name);
      return (
        (names.includes('React') || names.includes('Vue.js')) &&
        (names.includes('Shopify') || names.includes('BigCommerce') || names.includes('Magento')) &&
        (names.includes('Next.js') || names.includes('Nuxt.js'))
      );
    },
    priority: 10
  },
  {
    id: 'shopify_commerce',
    name: 'Shopify Commerce',
    description: 'Shopify-powered e-commerce platform',
    match: (techs) => techs.map(t => t.name).includes('Shopify'),
    priority: 9
  },
  {
    id: 'wordpress_ecommerce',
    name: 'WordPress E-Commerce',
    description: 'WordPress with WooCommerce e-commerce layer',
    match: (techs) => {
      const names = techs.map(t => t.name);
      return names.includes('WordPress') && names.includes('WooCommerce');
    },
    priority: 9
  },
  {
    id: 'wordpress_cms',
    name: 'WordPress CMS',
    description: 'Standard WordPress content management system',
    match: (techs) => techs.map(t => t.name).includes('WordPress'),
    priority: 8
  },
  {
    id: 'enterprise_cms',
    name: 'Enterprise CMS',
    description: 'Enterprise-grade CMS platform',
    match: (techs) => {
      const names = techs.map(t => t.name);
      return names.includes('Drupal') || names.includes('Joomla') || names.includes('Sitecore');
    },
    priority: 8
  },
  {
    id: 'spa',
    name: 'Single Page Application',
    description: 'Client-side rendered single page application',
    match: (techs) => {
      const names = techs.map(t => t.name);
      return (
        (names.includes('React') || names.includes('Angular') || names.includes('Vue.js') || names.includes('Svelte')) &&
        !names.includes('Next.js') &&
        !names.includes('Nuxt.js') &&
        !names.includes('Remix') &&
        !names.includes('Astro')
      );
    },
    priority: 7
  },
  {
    id: 'laravel_mvc',
    name: 'Laravel MVC',
    description: 'Server-rendered Laravel PHP application',
    match: (techs) => techs.map(t => t.name).includes('Laravel'),
    priority: 8
  },
  {
    id: 'rails_mvc',
    name: 'Ruby on Rails MVC',
    description: 'Server-rendered Ruby on Rails application',
    match: (techs) => techs.map(t => t.name).includes('Ruby on Rails'),
    priority: 8
  },
  {
    id: 'django_mvc',
    name: 'Django MVC',
    description: 'Server-rendered Django Python application',
    match: (techs) => techs.map(t => t.name).includes('Django'),
    priority: 8
  },
  {
    id: 'webflow_site',
    name: 'Webflow Visual Platform',
    description: 'Visually built site on Webflow platform',
    match: (techs) => techs.map(t => t.name).includes('Webflow'),
    priority: 9
  },
  {
    id: 'squarespace_site',
    name: 'Squarespace Platform',
    description: 'All-in-one Squarespace website',
    match: (techs) => techs.map(t => t.name).includes('Squarespace'),
    priority: 9
  },
  {
    id: 'wix_site',
    name: 'Wix Platform',
    description: 'Drag-and-drop Wix website',
    match: (techs) => techs.map(t => t.name).includes('Wix'),
    priority: 9
  },
  {
    id: 'php_traditional',
    name: 'Traditional PHP',
    description: 'Traditional server-rendered PHP application',
    match: (techs) => {
      const names = techs.map(t => t.name);
      return names.includes('PHP') && !names.includes('WordPress') && !names.includes('Laravel');
    },
    priority: 6
  },
  {
    id: 'static_site',
    name: 'Static Site',
    description: 'Pure static HTML/CSS/JS website',
    match: (techs) => {
      const names = techs.map(t => t.name);
      const hasFramework = names.some(n => [
        'React', 'Vue.js', 'Angular', 'Svelte', 'Next.js',
        'Nuxt.js', 'WordPress', 'Drupal', 'Shopify', 'Laravel',
        'Django', 'Ruby on Rails', 'Webflow', 'Squarespace', 'Wix'
      ].includes(n));
      return !hasFramework;
    },
    priority: 1
  }
];

function classifyArchitecture(technologies) {
  const sorted = [...ARCHITECTURE_RULES].sort((a, b) => b.priority - a.priority);
  for (const rule of sorted) {
    if (rule.match(technologies)) {
      return { id: rule.id, name: rule.name, description: rule.description };
    }
  }
  return { id: 'unknown', name: 'Unknown Architecture', description: 'Could not determine architecture from detected signals' };
}

// ─── STRENGTHS ENGINE ────────────────────────────────────────────────────────

function generateStrengths(technologies, security, performance, seo, infrastructure) {
  const strengths = [];
  const names = technologies.map(t => t.name);
  const cats = technologies.map(t => t.category);

  // CDN & Performance
  if (names.includes('Cloudflare')) {
    strengths.push('Cloudflare CDN provides global edge caching, DDoS protection, and automatic HTTPS — a best-in-class choice for performance and security');
  }
  if (names.includes('AWS CloudFront')) {
    strengths.push('AWS CloudFront delivers content from 400+ edge locations worldwide, ensuring low latency for a global audience');
  }
  if (names.includes('Fastly')) {
    strengths.push('Fastly edge cloud provides ultra-low latency delivery with instant cache purging capabilities — enterprise-grade CDN performance');
  }
  if (names.includes('Akamai')) {
    strengths.push('Akamai Intelligent Edge Platform is the most battle-tested CDN in existence, trusted by the world\'s largest enterprises for reliability at scale');
  }
  if (names.includes('BunnyCDN')) {
    strengths.push('BunnyCDN offers cost-effective global content delivery with strong performance metrics at a fraction of enterprise CDN costs');
  }

  // Hosting
  if (names.includes('Vercel')) {
    strengths.push('Vercel hosting provides automatic preview deployments, edge functions, and zero-configuration deployment — optimal for Next.js applications');
  }
  if (names.includes('Netlify')) {
    strengths.push('Netlify\'s global edge network, instant rollbacks, and built-in CI/CD pipeline make it an excellent choice for JAMstack deployments');
  }

  // Modern Frameworks
  if (names.includes('Next.js')) {
    strengths.push('Next.js enables hybrid rendering — combining static generation, server-side rendering, and incremental static regeneration for optimal performance and SEO');
  }
  if (names.includes('Nuxt.js')) {
    strengths.push('Nuxt.js provides automatic code splitting, server-side rendering, and a powerful module ecosystem built on Vue.js');
  }
  if (names.includes('Remix')) {
    strengths.push('Remix focuses on web fundamentals and nested routing, delivering exceptional performance through intelligent data loading and progressive enhancement');
  }
  if (names.includes('Astro')) {
    strengths.push('Astro\'s island architecture ships zero JavaScript by default, resulting in exceptionally fast page loads and strong Core Web Vitals scores');
  }
  if (names.includes('React')) {
    strengths.push('React\'s component-based architecture enables highly maintainable, reusable UI code with a vast ecosystem of libraries and strong community support');
  }
  if (names.includes('Vue.js')) {
    strengths.push('Vue.js offers an approachable learning curve with excellent performance, a progressive adoption model, and a well-structured component system');
  }
  if (names.includes('Svelte')) {
    strengths.push('Svelte compiles away the framework at build time, shipping minimal JavaScript to the browser — resulting in outstanding runtime performance');
  }
  if (names.includes('Angular')) {
    strengths.push('Angular provides a complete, opinionated framework with built-in TypeScript support, dependency injection, and enterprise-grade structure for large team development');
  }

  // Security
  if (security && security.riskScore !== undefined) {
    if (security.riskScore <= 0.15) {
      strengths.push('Excellent security header configuration — CSP, HSTS, and all major security headers are properly implemented, demonstrating strong security hygiene');
    } else if (security.riskScore <= 0.35) {
      strengths.push('Good security posture with most critical security headers in place — site demonstrates awareness of browser-level security best practices');
    }
  }
  if (security && security.headers && security.headers.hsts && security.headers.hsts.status === 'present') {
    strengths.push('HSTS enforced — all connections are forced to HTTPS, preventing protocol downgrade attacks and cookie hijacking');
  }
  if (security && security.wafDetected) {
    strengths.push(`${security.wafDetected} provides active web application firewall protection, filtering malicious traffic before it reaches the origin server`);
  }
  if (security && security.botProtection) {
    strengths.push(`${security.botProtection} bot protection is active, helping prevent automated abuse, credential stuffing, and scraping attacks`);
  }

  // Performance
  if (performance && performance.fetchMs <= 300) {
    strengths.push(`Exceptional server response time of ${performance.fetchMs}ms — well under the 300ms threshold for a fast TTFB (Time to First Byte)`);
  } else if (performance && performance.fetchMs <= 800) {
    strengths.push(`Good server response time of ${performance.fetchMs}ms — users will experience a responsive and snappy page load`);
  }
  if (performance && performance.compression && performance.compression.type === 'Brotli') {
    strengths.push('Brotli compression is enabled — Brotli achieves 15-25% better compression than Gzip, significantly reducing transfer sizes and improving load times');
  } else if (performance && performance.compression && performance.compression.type === 'Gzip') {
    strengths.push('Gzip compression is active — reducing HTML, CSS, and JavaScript transfer sizes for faster page loads');
  }
  if (performance && performance.https && performance.https.https) {
    strengths.push('Full HTTPS encryption is active across all content — essential for user trust, SEO ranking signals, and browser security indicators');
  }
  if (performance && performance.caching && performance.caching.status === 'good') {
    strengths.push('Aggressive caching strategy detected — long cache lifetimes reduce repeat visitor load times and reduce server load significantly');
  }

  // SEO
  if (seo && seo.seoScore >= 80) {
    strengths.push(`Strong SEO implementation with a score of ${seo.seoScore}/100 — page title, description, canonical URL, Open Graph, and structured data are all properly configured`);
  }
  if (seo && seo.structured && seo.structured.length > 0) {
    strengths.push(`${seo.structured.length} structured data block${seo.structured.length > 1 ? 's' : ''} detected — rich snippets and enhanced search result appearance are enabled via schema.org markup`);
  }
  if (seo && seo.og && Object.keys(seo.og).length >= 4) {
    strengths.push('Comprehensive Open Graph tags implemented — content will appear rich and well-formatted when shared on Facebook, LinkedIn, and messaging platforms');
  }
  if (seo && seo.twitter && Object.keys(seo.twitter).length >= 3) {
    strengths.push('Twitter Card metadata fully configured — shared links will display rich previews with image, title, and description on Twitter and X');
  }

  // Analytics & Monitoring
  if (names.includes('Segment')) {
    strengths.push('Segment customer data platform centralises all analytics and data routing — a sophisticated data architecture that enables consistent tracking across all tools');
  }
  if (names.includes('Sentry')) {
    strengths.push('Sentry error monitoring provides real-time exception tracking and performance monitoring — essential for maintaining production application health');
  }
  if (names.includes('Datadog')) {
    strengths.push('Datadog full-stack observability provides infrastructure metrics, APM, and log management — enterprise-grade monitoring and alerting');
  }
  if (names.includes('New Relic')) {
    strengths.push('New Relic APM provides deep application performance monitoring with transaction tracing and anomaly detection');
  }

  // Payment
  if (names.includes('Stripe')) {
    strengths.push('Stripe payments integration provides best-in-class payment processing with PCI compliance handled automatically and a developer-friendly API');
  }
  if (names.includes('Paddle')) {
    strengths.push('Paddle handles global payments, tax, and compliance as the merchant of record — reducing regulatory burden significantly for SaaS businesses');
  }

  // E-Commerce
  if (names.includes('Algolia')) {
    strengths.push('Algolia search delivers sub-10ms search results with typo tolerance and relevance tuning — significantly enhancing product discovery and user experience');
  }

  // CSS
  if (names.includes('Tailwind CSS')) {
    strengths.push('Tailwind CSS utility-first approach enables rapid UI development with consistent design tokens and minimal CSS bundle sizes through PurgeCSS');
  }

  // Infrastructure
  if (infrastructure && infrastructure.ips && infrastructure.ips.length > 1) {
    strengths.push(`Multiple IP addresses detected (${infrastructure.ips.join(', ')}) — suggests load balancing or anycast routing for improved availability and redundancy`);
  }

  // Diversity
  const uniqueCategories = new Set(cats);
  if (uniqueCategories.size >= 6) {
    strengths.push(`Mature technology ecosystem with ${technologies.length} detected technologies across ${uniqueCategories.size} categories — indicates a well-rounded, production-grade stack`);
  }

  return strengths.slice(0, 12);
}

// ─── WEAKNESSES ENGINE ───────────────────────────────────────────────────────

function generateWeaknesses(technologies, security, performance, seo) {
  const weaknesses = [];
  const names = technologies.map(t => t.name);

  // Security weaknesses
  if (security) {
    if (security.headers && security.headers.csp && security.headers.csp.status === 'missing') {
      weaknesses.push('Content Security Policy (CSP) header is absent — the site is vulnerable to cross-site scripting (XSS) attacks which can allow attackers to inject malicious scripts');
    } else if (security.headers && security.headers.csp && security.headers.csp.status === 'warn') {
      weaknesses.push(`CSP is present but weakened — ${security.headers.csp.detail}. A strict CSP is one of the most effective defences against XSS attacks`);
    }

    if (security.headers && security.headers.hsts && security.headers.hsts.status === 'missing') {
      weaknesses.push('HSTS (HTTP Strict Transport Security) is not configured — browsers may allow HTTP connections, leaving users vulnerable to downgrade attacks and session hijacking');
    }

    if (security.headers && security.headers.xFrameOptions && security.headers.xFrameOptions.status === 'missing') {
      weaknesses.push('X-Frame-Options header is absent — the site may be vulnerable to clickjacking attacks where attackers embed the page in a hidden iframe to steal clicks');
    }

    if (security.headers && security.headers.referrerPolicy && security.headers.referrerPolicy.status === 'missing') {
      weaknesses.push('Referrer-Policy header is not set — the full page URL including query parameters may be leaked to third-party domains when users click external links');
    }

    if (security.headers && security.headers.permissionsPolicy && security.headers.permissionsPolicy.status === 'missing') {
      weaknesses.push('Permissions-Policy header is absent — browser features like camera, microphone, and geolocation are not explicitly restricted, expanding the potential attack surface');
    }

    if (security.riskScore >= 0.65) {
      weaknesses.push(`High security risk score of ${Math.round(security.riskScore * 100)}% — multiple critical security headers are missing, leaving the site significantly exposed to common browser-level attacks`);
    }

    if (!security.wafDetected) {
      weaknesses.push('No Web Application Firewall detected — malicious requests, SQL injection attempts, and common attack patterns are not being filtered at the edge before reaching the origin server');
    }
  }

  // Performance weaknesses
  if (performance) {
    if (performance.fetchMs > 1500) {
      weaknesses.push(`Slow server response time of ${performance.fetchMs}ms — anything above 800ms significantly impacts user experience, bounce rates, and Core Web Vitals scores`);
    }

    if (performance.compression && performance.compression.type === 'None') {
      weaknesses.push('No compression detected on responses — enabling Brotli or Gzip compression would reduce transfer sizes by 60-80%, dramatically improving load times for users on slower connections');
    }

    if (performance.caching && (performance.caching.status === 'missing' || performance.caching.status === 'nocache')) {
      weaknesses.push('No effective caching strategy detected — every visitor request hits the origin server fresh, increasing latency, server load, and hosting costs unnecessarily');
    }

    if (performance.https && !performance.https.https) {
      weaknesses.push('Site is serving content over HTTP without encryption — this exposes user data to interception, causes Chrome to display "Not Secure" warnings, and is penalised by Google in search rankings');
    }
  }

  // SEO weaknesses
  if (seo) {
    if (seo.title && seo.title.status === 'missing') {
      weaknesses.push('No page title tag found — this is the single most important on-page SEO element and its absence will severely harm search engine visibility and click-through rates');
    } else if (seo.title && seo.title.status === 'warn') {
      weaknesses.push(`Page title issue: ${seo.title.detail} — title length directly affects how search engines display and rank the page in results`);
    }

    if (seo.description && seo.description.status === 'missing') {
      weaknesses.push('Meta description is absent — while not a direct ranking factor, missing descriptions result in search engines auto-generating snippets that are often irrelevant and reduce click-through rates');
    } else if (seo.description && seo.description.status === 'warn') {
      weaknesses.push(`Meta description issue: ${seo.description.detail}`);
    }

    if (seo.canonical && seo.canonical.status === 'missing') {
      weaknesses.push('No canonical URL tag — without a canonical tag, search engines may index multiple versions of the same page (http vs https, www vs non-www) causing duplicate content penalties');
    }

    if (seo.og && Object.keys(seo.og).length === 0) {
      weaknesses.push('Open Graph tags are missing — shared links on Facebook, LinkedIn, and messaging apps will display as plain text without images or formatted previews, significantly reducing engagement');
    }

    if (seo.twitter && Object.keys(seo.twitter).length === 0) {
      weaknesses.push('Twitter Card tags are absent — shared links on Twitter and X will not display rich media previews, reducing social media click-through rates');
    }

    if (seo.structured && seo.structured.length === 0) {
      weaknesses.push('No structured data (JSON-LD / schema.org) detected — the site is missing out on rich snippets in Google search results such as star ratings, FAQs, breadcrumbs, and product information');
    }

    if (seo.headings && seo.headings.h1 && seo.headings.h1.length === 0) {
      weaknesses.push('No H1 heading found — the primary heading is a critical SEO signal that tells search engines what the page is about. Every page should have exactly one H1');
    }

    if (seo.headings && seo.headings.h1 && seo.headings.h1.length > 1) {
      weaknesses.push(`Multiple H1 headings detected (${seo.headings.h1.length}) — having more than one H1 dilutes the primary topic signal and can confuse search engine crawlers`);
    }

    if (seo.images && seo.images.withoutAlt > 0) {
      weaknesses.push(`${seo.images.withoutAlt} image${seo.images.withoutAlt > 1 ? 's are' : ' is'} missing alt text — images without alt attributes harm accessibility for screen reader users and miss keyword opportunities for image search`);
    }

    if (seo.viewport && seo.viewport.status === 'missing') {
      weaknesses.push('Viewport meta tag is absent — the site may not render correctly on mobile devices, harming the mobile user experience and Google\'s mobile-first indexing');
    }

    if (seo.seoScore < 40) {
      weaknesses.push(`Low SEO score of ${seo.seoScore}/100 — significant on-page SEO improvements are needed across multiple dimensions to compete effectively in organic search`);
    }
  }

  // Technology-specific weaknesses
  if (names.includes('WordPress') && !names.includes('Cloudflare') && !names.includes('Fastly') && !names.includes('Akamai')) {
    weaknesses.push('WordPress installation without a CDN detected — WordPress sites without a CDN are vulnerable to traffic spikes, slower for international visitors, and less protected against DDoS attacks');
  }

  if (names.includes('jQuery') && !names.includes('React') && !names.includes('Vue.js') && !names.includes('Angular')) {
    weaknesses.push('jQuery without a modern framework suggests an older architecture that may carry technical debt, security vulnerabilities from outdated plugins, and maintenance challenges');
  }

  if (names.includes('Wix') || names.includes('Squarespace')) {
    const platform = names.includes('Wix') ? 'Wix' : 'Squarespace';
    weaknesses.push(`${platform} platform limits technical customisation, SEO control, and performance optimisation compared to custom-built alternatives — migration to a more flexible platform may be necessary as the business scales`);
  }

  return weaknesses.slice(0, 12);
}

// ─── MATURITY SCORE ENGINE ───────────────────────────────────────────────────

function calculateMaturityScore(technologies, security, performance, seo, infrastructure) {
  let score = 0;
  const names = technologies.map(t => t.name);

  // Modern framework (max 15)
  const modernFrameworks = ['Next.js', 'Nuxt.js', 'Remix', 'Astro', 'SvelteKit'];
  const decentFrameworks = ['React', 'Vue.js', 'Angular', 'Svelte', 'Ember.js'];
  if (modernFrameworks.some(f => names.includes(f))) score += 15;
  else if (decentFrameworks.some(f => names.includes(f))) score += 10;
  else if (names.includes('jQuery')) score += 3;

  // CDN (max 10)
  const enterpriseCDNs = ['Cloudflare', 'Akamai', 'Fastly', 'AWS CloudFront'];
  const standardCDNs = ['BunnyCDN', 'KeyCDN'];
  if (enterpriseCDNs.some(c => names.includes(c))) score += 10;
  else if (standardCDNs.some(c => names.includes(c))) score += 6;

  // Security headers (max 15)
  if (security) {
    if (security.riskScore <= 0.10) score += 15;
    else if (security.riskScore <= 0.25) score += 10;
    else if (security.riskScore <= 0.50) score += 5;
    else score += 0;
  }

  // WAF (max 5)
  if (security && security.wafDetected) score += 5;

  // HTTPS (max 5)
  if (performance && performance.https && performance.https.https) score += 5;
  if (performance && performance.https && performance.https.hsts) score += 2;

  // Performance (max 10)
  if (performance) {
    if (performance.fetchMs <= 300) score += 10;
    else if (performance.fetchMs <= 600) score += 7;
    else if (performance.fetchMs <= 1000) score += 4;
    else if (performance.fetchMs <= 2000) score += 2;

    if (performance.compression && performance.compression.type === 'Brotli') score += 3;
    else if (performance.compression && performance.compression.type === 'Gzip') score += 2;

    if (performance.caching && performance.caching.status === 'good') score += 3;
  }

  // SEO (max 10)
  if (seo) {
    if (seo.seoScore >= 80) score += 10;
    else if (seo.seoScore >= 60) score += 7;
    else if (seo.seoScore >= 40) score += 4;
    else score += 1;
  }

  // Analytics (max 5)
  const analyticsTools = ['Google Analytics', 'Segment', 'Mixpanel', 'Plausible', 'Fathom Analytics'];
  if (analyticsTools.some(a => names.includes(a))) score += 5;

  // Error monitoring (max 5)
  const monitoringTools = ['Sentry', 'Datadog', 'New Relic'];
  if (monitoringTools.some(m => names.includes(m))) score += 5;

  // Payment sophistication (max 5)
  if (names.includes('Stripe') || names.includes('Paddle')) score += 5;
  else if (names.includes('PayPal') || names.includes('Square')) score += 3;

  // Structured data (max 5)
  if (seo && seo.structured && seo.structured.length > 0) score += 5;

  // Technology breadth (max 5)
  const uniqueCategories = new Set(technologies.map(t => t.category));
  if (uniqueCategories.size >= 8) score += 5;
  else if (uniqueCategories.size >= 5) score += 3;
  else if (uniqueCategories.size >= 3) score += 1;

  return Math.min(Math.round(score), 100);
}

// ─── SUMMARY GENERATOR ───────────────────────────────────────────────────────

function generateSummary(technologies, architecture, cluster, security, performance, seo) {
  const names = technologies.map(t => t.name);
  const categories = [...new Set(technologies.map(t => t.category))];

  let summary = '';

  // Opening — architecture and primary stack
  summary += `This website runs a ${architecture.name} architecture`;

  if (names.includes('Next.js')) summary += ' built on Next.js with React';
  else if (names.includes('Nuxt.js')) summary += ' built on Nuxt.js with Vue.js';
  else if (names.includes('Remix')) summary += ' built on Remix with React';
  else if (names.includes('Astro')) summary += ' built with Astro\'s island architecture';
  else if (names.includes('React')) summary += ' built with React';
  else if (names.includes('Vue.js')) summary += ' built with Vue.js';
  else if (names.includes('Angular')) summary += ' built with Angular';
  else if (names.includes('Svelte')) summary += ' built with Svelte';
  else if (names.includes('WordPress')) summary += ' powered by WordPress';
  else if (names.includes('Shopify')) summary += ' powered by Shopify';
  else if (names.includes('Drupal')) summary += ' powered by Drupal';
  else if (names.includes('Django')) summary += ' built with Django';
  else if (names.includes('Laravel')) summary += ' built with Laravel';
  else if (names.includes('Ruby on Rails')) summary += ' built with Ruby on Rails';
  else if (names.includes('Webflow')) summary += ' built on the Webflow platform';
  else if (names.includes('Squarespace')) summary += ' built on Squarespace';
  else if (names.includes('Wix')) summary += ' built on Wix';

  // CDN / Hosting
  if (names.includes('Cloudflare') && names.includes('Vercel')) {
    summary += ', deployed on Vercel with Cloudflare providing edge security and CDN.';
  } else if (names.includes('Cloudflare') && names.includes('Netlify')) {
    summary += ', deployed on Netlify with Cloudflare CDN and security at the edge.';
  } else if (names.includes('Vercel')) {
    summary += ', deployed on Vercel\'s global edge network.';
  } else if (names.includes('Netlify')) {
    summary += ', deployed on Netlify\'s global CDN.';
  } else if (names.includes('Cloudflare')) {
    summary += ', protected and accelerated by Cloudflare\'s global network.';
  } else if (names.includes('AWS')) {
    summary += ', hosted on Amazon Web Services infrastructure.';
  } else if (names.includes('Google Cloud')) {
    summary += ', hosted on Google Cloud Platform.';
  } else if (names.includes('Azure')) {
    summary += ', hosted on Microsoft Azure.';
  } else {
    summary += '.';
  }

  // Styling
  if (names.includes('Tailwind CSS')) {
    summary += ' The UI is built with Tailwind CSS utility classes.';
  } else if (names.includes('Bootstrap')) {
    summary += ' The UI uses Bootstrap for responsive layout and components.';
  } else if (names.includes('Material UI')) {
    summary += ' The UI is built with Material UI component library.';
  }

  // Analytics & Business Tools
  const analyticsCount = names.filter(n => ['Google Analytics', 'Segment', 'Mixpanel', 'Hotjar', 'Plausible'].includes(n)).length;
  if (analyticsCount >= 2) {
    summary += ` A sophisticated analytics stack with ${analyticsCount} tools provides comprehensive user behaviour insights.`;
  } else if (names.includes('Google Analytics')) {
    summary += ' Google Analytics tracks visitor behaviour and conversions.';
  } else if (names.includes('Segment')) {
    summary += ' Segment provides centralised customer data routing and analytics.';
  }

  // Support
  if (names.includes('Intercom')) {
    summary += ' Intercom powers customer messaging and support.';
  } else if (names.includes('Zendesk')) {
    summary += ' Zendesk handles customer support operations.';
  } else if (names.includes('Crisp')) {
    summary += ' Crisp live chat provides real-time customer support.';
  }

  // Payment
  if (names.includes('Stripe')) {
    summary += ' Stripe powers payment processing.';
  } else if (names.includes('Paddle')) {
    summary += ' Paddle handles payments and subscription management.';
  } else if (names.includes('PayPal')) {
    summary += ' PayPal provides payment options.';
  }

  // Security & Monitoring
  if (names.includes('Sentry')) {
    summary += ' Sentry provides real-time error monitoring.';
  }
  if (security && security.riskScore <= 0.20) {
    summary += ' Security headers are well configured.';
  } else if (security && security.riskScore >= 0.65) {
    summary += ' Security header configuration needs significant improvement.';
  }

  // SEO
  if (seo && seo.seoScore >= 80) {
    summary += ' On-page SEO is comprehensively implemented.';
  } else if (seo && seo.seoScore < 40) {
    summary += ' On-page SEO requires attention.';
  }

  // Technology count
  summary += ` In total, ${technologies.length} technolog${technologies.length === 1 ? 'y was' : 'ies were'} detected across ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}.`;

  return summary;
}

// ─── MASTER INTELLIGENCE FUNCTION ────────────────────────────────────────────

function generateIntelligence(technologies, security, performance, seo, infrastructure, cluster) {
  try {
    logger.info('Generating intelligence analysis');

    if (!technologies || technologies.length === 0) {
      return {
        architecture: { id: 'unknown', name: 'Unknown', description: 'No technologies detected' },
        summary: 'Insufficient data to generate an intelligence report. No technologies were detected on this website.',
        strengths: [],
        weaknesses: ['No technologies could be detected — the site may be behind a login wall, bot protection, or returning an error page'],
        maturityScore: 0
      };
    }

    const architecture = classifyArchitecture(technologies);
    const strengths = generateStrengths(technologies, security, performance, seo, infrastructure);
    const weaknesses = generateWeaknesses(technologies, security, performance, seo);
    const maturityScore = calculateMaturityScore(technologies, security, performance, seo, infrastructure);
    const summary = generateSummary(technologies, architecture, cluster, security, performance, seo);

    logger.info(`Intelligence generated — Architecture: ${architecture.name}, Maturity: ${maturityScore}, Strengths: ${strengths.length}, Weaknesses: ${weaknesses.length}`);

    return {
      architecture,
      summary,
      strengths,
      weaknesses,
      maturityScore
    };

  } catch (err) {
    logger.error(`Intelligence generation failed: ${err.message}`);
    return {
      architecture: { id: 'error', name: 'Error', description: 'Intelligence generation failed' },
      summary: 'An error occurred while generating the intelligence report.',
      strengths: [],
      weaknesses: [],
      maturityScore: 0
    };
  }
}

module.exports = { generateIntelligence };
