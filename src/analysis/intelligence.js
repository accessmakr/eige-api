'use strict';

const {
  getTechIntelligence,
  findBestArchitecturePattern,
  findIndustryBenchmark,
  updateTechIntelligenceFromScan
} = require('../db/intelligence');
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
      return names.includes('Drupal') || names.includes('Joomla');
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
        (names.includes('React') || names.includes('Angular') ||
          names.includes('Vue.js') || names.includes('Svelte')) &&
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
      return names.includes('PHP') &&
        !names.includes('WordPress') &&
        !names.includes('Laravel');
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
  return {
    id: 'unknown',
    name: 'Unknown Architecture',
    description: 'Could not determine architecture from detected signals'
  };
}

// ─── KNOWLEDGE BASE STRENGTHS ─────────────────────────────────────────────────

async function generateStrengthsFromKnowledgeBase(technologies, security, performance, seo, infrastructure) {
  const strengths = [];
  const names = technologies.map(t => t.name);

  const allIntelligence = await getTechIntelligence(null);

  for (const tech of technologies) {
    const intel = allIntelligence[tech.name];
    if (!intel) continue;

    if (security && intel.security_impact && tech.confidence >= 0.7) {
      const securityPositive = extractPositiveFromText(intel.security_impact);
      if (securityPositive) strengths.push(securityPositive);
    }

    if (performance && intel.performance_impact && tech.confidence >= 0.65) {
      const perfPositive = extractPositiveFromText(intel.performance_impact);
      if (perfPositive) strengths.push(perfPositive);
    }
  }

  if (security && security.riskScore !== undefined) {
    if (security.riskScore <= 0.15) {
      strengths.push('Excellent security header configuration — CSP, HSTS, and all major security headers are properly implemented, demonstrating strong security hygiene across the stack');
    } else if (security.riskScore <= 0.30) {
      strengths.push('Good security posture with most critical security headers in place — the team demonstrates awareness of browser-level security best practices');
    }
  }

  if (security && security.wafDetected) {
    strengths.push(`${security.wafDetected} provides active web application firewall protection — malicious requests, SQL injection attempts, and common attack patterns are filtered at the edge before reaching the origin server`);
  }

  if (security && security.botProtection) {
    strengths.push(`${security.botProtection} bot protection is active — automated abuse, credential stuffing, and scraping attacks are actively mitigated`);
  }

  if (performance && performance.fetchMs <= 300) {
    strengths.push(`Exceptional server response time of ${performance.fetchMs}ms — well under the 300ms threshold Google uses to classify TTFB as fast, providing an excellent foundation for Core Web Vitals`);
  } else if (performance && performance.fetchMs <= 600) {
    strengths.push(`Strong server response time of ${performance.fetchMs}ms — users will experience a responsive page load and Core Web Vitals scores will not be penalised by server latency`);
  }

  if (performance && performance.compression && performance.compression.type === 'Brotli') {
    strengths.push('Brotli compression is active — Brotli achieves 15-25% better compression ratios than Gzip, meaningfully reducing transfer sizes for HTML, CSS, and JavaScript on every page load');
  } else if (performance && performance.compression && performance.compression.type === 'Gzip') {
    strengths.push('Gzip compression is active — compressing text assets by 60-80% before transfer, significantly reducing page weight for users on slower connections');
  }

  if (performance && performance.https && performance.https.https && performance.https.hsts) {
    strengths.push('HTTPS with HSTS enforcement — all connections are encrypted and HTTP connections are automatically upgraded, preventing protocol downgrade attacks and ensuring data integrity');
  } else if (performance && performance.https && performance.https.https) {
    strengths.push('HTTPS encryption is active — user data is protected in transit and browsers display the security indicator that builds user trust');
  }

  if (performance && performance.caching && performance.caching.status === 'good') {
    strengths.push(`Effective caching strategy detected — ${performance.caching.detail}. Repeat visitors benefit from dramatically faster load times and server load is reduced significantly`);
  }

  if (seo && seo.seoScore >= 85) {
    strengths.push(`Outstanding SEO implementation with a score of ${seo.seoScore}/100 — page title, meta description, canonical URL, Open Graph, Twitter Card, and structured data are all comprehensively implemented`);
  } else if (seo && seo.seoScore >= 70) {
    strengths.push(`Strong SEO implementation with a score of ${seo.seoScore}/100 — core on-page SEO signals are properly configured, providing a solid foundation for organic search performance`);
  }

  if (seo && seo.structured && seo.structured.length > 0) {
    strengths.push(`${seo.structured.length} structured data block${seo.structured.length > 1 ? 's' : ''} detected — rich snippets and enhanced search result appearance are enabled via schema.org markup, improving click-through rates from Google`);
  }

  if (seo && seo.og && Object.keys(seo.og).length >= 4) {
    strengths.push('Comprehensive Open Graph implementation — content appears rich and well-formatted when shared on Facebook, LinkedIn, WhatsApp, and messaging platforms, improving social media engagement');
  }

  if (seo && seo.twitter && Object.keys(seo.twitter).length >= 3) {
    strengths.push('Twitter Card metadata fully implemented — shared links display rich media previews on Twitter and X, with title, description, and image, improving click-through rates from social sharing');
  }

  if (infrastructure && infrastructure.ips && infrastructure.ips.length > 1) {
    strengths.push(`Multiple IP addresses detected (${infrastructure.ips.join(', ')}) — indicates load balancing or anycast routing, improving availability and distributing traffic across multiple origin servers`);
  }

  const uniqueCategories = new Set(technologies.map(t => t.category));
  if (uniqueCategories.size >= 7) {
    strengths.push(`Mature and comprehensive technology ecosystem — ${technologies.length} technologies detected across ${uniqueCategories.size} categories, indicating a well-rounded production-grade stack with tooling for analytics, monitoring, security, and performance`);
  }

  const monitoringTools = names.filter(n => ['Sentry', 'Datadog', 'New Relic', 'LogRocket', 'FullStory'].includes(n));
  if (monitoringTools.length >= 2) {
    strengths.push(`Comprehensive observability with ${monitoringTools.join(' and ')} — the engineering team has full visibility into errors, performance, and user experience in production`);
  } else if (monitoringTools.length === 1) {
    strengths.push(`${monitoringTools[0]} provides production error monitoring and performance visibility — issues are caught proactively before users report them`);
  }

  const analyticsTools = names.filter(n => ['Segment', 'Mixpanel', 'Amplitude', 'PostHog'].includes(n));
  if (analyticsTools.length >= 1) {
    strengths.push(`${analyticsTools.join(' and ')} provides sophisticated product analytics — the team has deep visibility into user behaviour, funnel performance, and feature adoption beyond basic page view tracking`);
  }

  return [...new Set(strengths)].slice(0, 12);
}

function extractPositiveFromText(text) {
  if (!text) return null;

  const sentences = text.split(/\.\s+/);
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    const isPositive = (
      lower.includes('deliver') ||
      lower.includes('provide') ||
      lower.includes('enable') ||
      lower.includes('ensure') ||
      lower.includes('excellent') ||
      lower.includes('best') ||
      lower.includes('strong') ||
      lower.includes('comprehensive') ||
      lower.includes('automatic') ||
      lower.includes('prevent') ||
      lower.includes('protect')
    );

    const isNegative = (
      lower.includes('trade-off') ||
      lower.includes('however') ||
      lower.includes('struggle') ||
      lower.includes('vulnerable') ||
      lower.includes('risk') ||
      lower.includes('must be') ||
      lower.includes('requires') ||
      lower.includes('limitation')
    );

    if (isPositive && !isNegative && sentence.length > 40 && sentence.length < 250) {
      return sentence.trim() + (sentence.endsWith('.') ? '' : '.');
    }
  }

  return null;
}

// ─── KNOWLEDGE BASE WEAKNESSES ────────────────────────────────────────────────

async function generateWeaknessesFromKnowledgeBase(technologies, security, performance, seo, industryBenchmark) {
  const weaknesses = [];
  const names = technologies.map(t => t.name);

  const allIntelligence = await getTechIntelligence(null);
  for (const tech of technologies) {
    const intel = allIntelligence[tech.name];
    if (!intel || !intel.known_weaknesses) continue;

    const relevantWeaknesses = intel.known_weaknesses.slice(0, 2);
    for (const weakness of relevantWeaknesses) {
      if (weakness && weakness.length > 20) {
        weaknesses.push(`${tech.name}: ${weakness}`);
      }
    }
  }

  if (security) {
    const headers = security.headers || {};

    if (headers.csp && headers.csp.status === 'missing') {
      weaknesses.push('Content Security Policy (CSP) header is absent — without CSP, cross-site scripting (XSS) attacks can inject malicious scripts that steal user credentials, session tokens, and sensitive data. CSP is one of the most effective browser-level defences available');
    } else if (headers.csp && headers.csp.status === 'warn') {
      weaknesses.push(`CSP is present but weakened — ${headers.csp.detail}. An unsafe-inline or unsafe-eval directive in CSP defeats much of its protective value against XSS attacks`);
    }

    if (headers.hsts && headers.hsts.status === 'missing') {
      weaknesses.push('HSTS (HTTP Strict Transport Security) is not configured — browsers may accept HTTP connections, leaving users vulnerable to SSL stripping attacks where an attacker downgrades the connection to unencrypted HTTP');
    }

    if (headers.xFrameOptions && headers.xFrameOptions.status === 'missing') {
      weaknesses.push('X-Frame-Options header is absent — the site can be embedded in a hidden iframe on a malicious page, enabling clickjacking attacks where users unknowingly interact with the site while their clicks are captured by the attacker');
    }

    if (headers.referrerPolicy && headers.referrerPolicy.status === 'missing') {
      weaknesses.push('Referrer-Policy is not configured — the full page URL, including any query parameters containing user identifiers, session tokens, or search terms, may be leaked to third-party domains when users click external links');
    }

    if (headers.permissionsPolicy && headers.permissionsPolicy.status === 'missing') {
      weaknesses.push('Permissions-Policy header is absent — browser features including camera, microphone, geolocation, payment, and USB access are not explicitly restricted, unnecessarily expanding the attack surface if any embedded script is compromised');
    }

    if (security.riskScore >= 0.60) {
      weaknesses.push(`High overall security risk score of ${Math.round(security.riskScore * 100)}% — multiple critical security headers are missing. This site would fail a basic web security audit and is significantly more vulnerable to common browser-level attacks than industry peers`);
    }

    if (!security.wafDetected) {
      weaknesses.push('No Web Application Firewall detected — malicious requests, SQL injection payloads, XSS attempts, and common attack patterns reach the origin server unfiltered. Adding Cloudflare WAF or equivalent protection at the edge significantly reduces risk');
    }
  }

  if (performance) {
    if (performance.fetchMs > 1500) {
      weaknesses.push(`Slow server response time of ${performance.fetchMs}ms — Google classifies TTFB above 800ms as needing improvement. This adds directly to Largest Contentful Paint (LCP), harming Core Web Vitals scores and search ranking`);
    } else if (performance.fetchMs > 800) {
      weaknesses.push(`Server response time of ${performance.fetchMs}ms is above Google\'s recommended 800ms threshold — optimising server response time through caching or CDN deployment would improve Core Web Vitals scores`);
    }

    if (performance.compression && performance.compression.type === 'None') {
      weaknesses.push('No compression detected on server responses — enabling Brotli or Gzip compression would reduce HTML, CSS, and JavaScript transfer sizes by 60-80%. At typical page sizes this saves 200-500KB per page load, with significant impact on users on slower connections');
    }

    if (performance.caching && performance.caching.status === 'missing') {
      weaknesses.push('No effective HTTP caching strategy detected — every visitor loads all assets from the origin server on every visit. Proper cache headers for static assets would allow returning visitors to load pages significantly faster while reducing server load and bandwidth costs');
    }

    if (performance.https && !performance.https.https) {
      weaknesses.push('Site is serving content over HTTP without encryption — Chrome and Firefox display "Not Secure" warnings, user data is transmitted in plain text, and Google applies a ranking penalty to non-HTTPS sites in search results');
    }
  }

  if (seo) {
    if (seo.title && seo.title.status === 'missing') {
      weaknesses.push('No page title tag found — the title tag is the single most important on-page SEO element. Its absence means search engines have no primary signal for the page\'s topic, severely limiting organic search visibility');
    } else if (seo.title && seo.title.status === 'warn') {
      weaknesses.push(`Page title issue detected: ${seo.title.detail} — title length and relevance directly affect how search engines display the page in results and how users decide whether to click`);
    }

    if (seo.description && seo.description.status === 'missing') {
      weaknesses.push('Meta description is absent — search engines auto-generate snippets when descriptions are missing, often pulling irrelevant text. Well-crafted meta descriptions improve click-through rates from search results by 5-15%');
    }

    if (seo.canonical && seo.canonical.status === 'missing') {
      weaknesses.push('No canonical URL specified — without a canonical tag, search engines may index multiple URL variations (HTTP vs HTTPS, www vs non-www, trailing slash variations) as duplicate content, diluting page authority across multiple URLs');
    }

    if (seo.og && Object.keys(seo.og).length === 0) {
      weaknesses.push('Open Graph tags are completely absent — when this site is shared on Facebook, LinkedIn, WhatsApp, and iMessage, links display as plain text without images, titles, or formatted previews. This significantly reduces click-through rates from social sharing');
    }

    if (seo.structured && seo.structured.length === 0) {
      weaknesses.push('No structured data (JSON-LD schema.org markup) detected — the site is missing eligibility for Google rich results including star ratings, FAQs, breadcrumbs, product information, and article dates. Rich results typically have 20-30% higher click-through rates than standard results');
    }

    if (seo.headings && seo.headings.h1 && seo.headings.h1.length === 0) {
      weaknesses.push('No H1 heading found on this page — the H1 is a primary SEO signal that communicates the page\'s main topic to search engines. Every page should have exactly one H1 that contains the primary target keyword');
    }

    if (seo.headings && seo.headings.h1 && seo.headings.h1.length > 1) {
      weaknesses.push(`${seo.headings.h1.length} H1 headings detected — multiple H1 tags dilute the primary topic signal for search engines. Each page should have exactly one H1 with remaining headings using H2 and H3 tags`);
    }

    if (seo.images && seo.images.withoutAlt > 0) {
      weaknesses.push(`${seo.images.withoutAlt} image${seo.images.withoutAlt > 1 ? 's are' : ' is'} missing alt text — images without alt attributes are invisible to screen readers (accessibility failure) and represent missed keyword opportunities for image search. WCAG 2.1 requires alt text on all informational images`);
    }

    if (seo.seoScore < 40) {
      weaknesses.push(`Low overall SEO score of ${seo.seoScore}/100 — significant on-page SEO improvements are needed across multiple dimensions. Sites in this score range typically struggle to rank competitively in organic search without substantial SEO investment`);
    }
  }

  if (industryBenchmark) {
    for (const industryWeakness of (industryBenchmark.common_weaknesses || []).slice(0, 2)) {
      weaknesses.push(`Industry pattern: ${industryWeakness}`);
    }
  }

  if (names.includes('WordPress') && !names.includes('Cloudflare') && !names.includes('Fastly') && !names.includes('Akamai')) {
    weaknesses.push('WordPress without a CDN — WordPress\'s database-driven rendering is significantly slower than static alternatives. A CDN layer (Cloudflare free tier) would cache full pages at the edge, reducing server load dramatically and improving performance for international visitors');
  }

  if (names.includes('jQuery') && !names.includes('React') && !names.includes('Vue.js') && !names.includes('Angular') && !names.includes('Svelte')) {
    weaknesses.push('jQuery without a modern framework suggests an older front-end architecture. jQuery sites frequently accumulate plugin dependencies with security vulnerabilities, and the development patterns make performance optimisation and code organisation increasingly difficult over time');
  }

  return [...new Set(weaknesses)].slice(0, 12);
}

// ─── MATURITY SCORE ───────────────────────────────────────────────────────────

function calculateMaturityScore(technologies, security, performance, seo, infrastructure) {
  let score = 0;
  const names = technologies.map(t => t.name);

  const modernFrameworks = ['Next.js', 'Nuxt.js', 'Remix', 'Astro', 'SvelteKit'];
  const decentFrameworks = ['React', 'Vue.js', 'Angular', 'Svelte', 'Ember.js'];
  if (modernFrameworks.some(f => names.includes(f))) score += 15;
  else if (decentFrameworks.some(f => names.includes(f))) score += 10;
  else if (names.includes('jQuery')) score += 2;

  const enterpriseCDNs = ['Cloudflare', 'Akamai', 'Fastly', 'AWS CloudFront'];
  const standardCDNs = ['BunnyCDN', 'KeyCDN'];
  if (enterpriseCDNs.some(c => names.includes(c))) score += 10;
  else if (standardCDNs.some(c => names.includes(c))) score += 6;

  if (security) {
    if (security.riskScore <= 0.10) score += 15;
    else if (security.riskScore <= 0.20) score += 11;
    else if (security.riskScore <= 0.35) score += 7;
    else if (security.riskScore <= 0.50) score += 3;
  }

  if (security && security.wafDetected) score += 5;

  if (performance) {
    if (performance.https && performance.https.https) score += 5;
    if (performance.https && performance.https.hsts) score += 3;

    if (performance.fetchMs <= 300) score += 10;
    else if (performance.fetchMs <= 600) score += 7;
    else if (performance.fetchMs <= 1000) score += 4;
    else if (performance.fetchMs <= 2000) score += 2;

    if (performance.compression && performance.compression.type === 'Brotli') score += 4;
    else if (performance.compression && performance.compression.type === 'Gzip') score += 2;

    if (performance.caching && performance.caching.status === 'good') score += 4;
    else if (performance.caching && performance.caching.status === 'warn') score += 2;
  }

  if (seo) {
    if (seo.seoScore >= 85) score += 10;
    else if (seo.seoScore >= 70) score += 7;
    else if (seo.seoScore >= 50) score += 4;
    else score += 1;
  }

  const analyticsTools = ['Google Analytics', 'Segment', 'Mixpanel', 'Plausible', 'Fathom Analytics', 'Amplitude', 'PostHog'];
  if (analyticsTools.some(a => names.includes(a))) score += 5;

  const monitoringTools = ['Sentry', 'Datadog', 'New Relic', 'LogRocket', 'FullStory'];
  if (monitoringTools.filter(m => names.includes(m)).length >= 2) score += 6;
  else if (monitoringTools.some(m => names.includes(m))) score += 4;

  if (names.includes('Stripe') || names.includes('Paddle')) score += 5;
  else if (names.includes('PayPal') || names.includes('Square') ||
    names.includes('Paystack') || names.includes('Flutterwave')) score += 3;

  if (seo && seo.structured && seo.structured.length > 0) score += 4;

  const uniqueCategories = new Set(technologies.map(t => t.category));
  if (uniqueCategories.size >= 8) score += 4;
  else if (uniqueCategories.size >= 5) score += 2;

  return Math.min(Math.round(score), 100);
}

// ─── SUMMARY GENERATOR ───────────────────────────────────────────────────────

async function generateSummary(technologies, architecture, cluster, security, performance, seo, architecturePattern, industryBenchmark) {
  const names = technologies.map(t => t.name);
  const categories = [...new Set(technologies.map(t => t.category))];

  if (architecturePattern && architecturePattern.summary) {
    let summary = architecturePattern.summary;

    if (architecturePattern.real_world_examples && architecturePattern.real_world_examples.length > 0) {
      const examples = architecturePattern.real_world_examples.slice(0, 3).join(', ');
      summary += ` Companies using this exact combination include ${examples}.`;
    }

    if (performance && performance.fetchMs) {
      if (performance.fetchMs <= 300) {
        summary += ` Server response time of ${performance.fetchMs}ms is exceptional.`;
      } else if (performance.fetchMs > 1500) {
        summary += ` Server response time of ${performance.fetchMs}ms is above recommended thresholds and warrants investigation.`;
      }
    }

    if (security && security.riskScore !== undefined) {
      if (security.riskScore <= 0.20) {
        summary += ' Security header configuration is strong.';
      } else if (security.riskScore >= 0.60) {
        summary += ' Security header implementation needs significant improvement.';
      }
    }

    if (industryBenchmark) {
      const maturityScore = calculateMaturityScore(technologies, security, performance, seo, null);
      const diff = maturityScore - industryBenchmark.average_maturity_score;
      if (diff >= 15) {
        summary += ` This stack scores ${diff} points above the ${industryBenchmark.industry} industry average maturity score of ${industryBenchmark.average_maturity_score} — placing it in the top tier of its peer group.`;
      } else if (diff <= -15) {
        summary += ` This stack scores ${Math.abs(diff)} points below the ${industryBenchmark.industry} industry average maturity score of ${industryBenchmark.average_maturity_score} — indicating room for improvement relative to peers.`;
      } else {
        summary += ` Maturity is broadly in line with the ${industryBenchmark.industry} industry average of ${industryBenchmark.average_maturity_score}.`;
      }
    }

    summary += ` ${technologies.length} technolog${technologies.length === 1 ? 'y was' : 'ies were'} detected across ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}.`;

    return summary;
  }

  let summary = `This website runs a ${architecture.name} architecture`;

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

  if (names.includes('Cloudflare') && names.includes('Vercel')) {
    summary += ', deployed on Vercel with Cloudflare providing edge security and global CDN.';
  } else if (names.includes('Cloudflare') && names.includes('Netlify')) {
    summary += ', deployed on Netlify with Cloudflare CDN and DDoS protection at the edge.';
  } else if (names.includes('Vercel')) {
    summary += ', deployed on Vercel\'s global edge network.';
  } else if (names.includes('Netlify')) {
    summary += ', deployed on Netlify\'s global CDN.';
  } else if (names.includes('Cloudflare')) {
    summary += ', protected and accelerated by Cloudflare\'s global network of 300+ edge locations.';
  } else if (names.includes('AWS')) {
    summary += ', hosted on Amazon Web Services infrastructure.';
  } else if (names.includes('Google Cloud')) {
    summary += ', hosted on Google Cloud Platform.';
  } else if (names.includes('Azure')) {
    summary += ', hosted on Microsoft Azure.';
  } else {
    summary += '.';
  }

  if (names.includes('Tailwind CSS')) {
    summary += ' The UI is built with Tailwind CSS utility classes for consistent, performance-optimised styling.';
  } else if (names.includes('Bootstrap')) {
    summary += ' The UI uses Bootstrap for responsive layout and pre-built component patterns.';
  } else if (names.includes('Material UI')) {
    summary += ' The UI is built with Material UI\'s React component library following Google\'s Material Design system.';
  }

  const analyticsNames = names.filter(n =>
    ['Google Analytics', 'Segment', 'Mixpanel', 'Amplitude', 'PostHog', 'Plausible'].includes(n)
  );
  if (analyticsNames.length >= 2) {
    summary += ` A sophisticated analytics stack with ${analyticsNames.join(' and ')} provides comprehensive user behaviour tracking and data routing.`;
  } else if (analyticsNames.length === 1) {
    summary += ` ${analyticsNames[0]} provides visitor analytics and behaviour tracking.`;
  }

  if (names.includes('Stripe')) {
    summary += ' Stripe powers payment processing with PCI-compliant card tokenisation.';
  } else if (names.includes('Paddle')) {
    summary += ' Paddle handles payments and subscription management as merchant of record.';
  } else if (names.includes('Paystack')) {
    summary += ' Paystack provides African market payment processing.';
  } else if (names.includes('Flutterwave')) {
    summary += ' Flutterwave enables payments across African markets.';
  }

  if (names.includes('Intercom')) {
    summary += ' Intercom powers in-product customer messaging and support.';
  } else if (names.includes('Zendesk')) {
    summary += ' Zendesk handles customer support operations and ticketing.';
  } else if (names.includes('Crisp')) {
    summary += ' Crisp provides live chat and customer support.';
  }

  if (names.includes('Sentry')) {
    summary += ' Sentry monitors production errors and performance in real time.';
  }

  if (security && security.riskScore <= 0.20) {
    summary += ' Security headers are comprehensively implemented.';
  } else if (security && security.riskScore >= 0.60) {
    summary += ' Security header configuration requires significant improvement.';
  }

  if (industryBenchmark) {
    const maturityScore = calculateMaturityScore(technologies, security, performance, seo, null);
    const diff = maturityScore - industryBenchmark.average_maturity_score;
    if (diff >= 15) {
      summary += ` Engineering maturity is ${diff} points above the ${industryBenchmark.industry} industry average.`;
    } else if (diff <= -10) {
      summary += ` Engineering maturity is below the ${industryBenchmark.industry} industry average of ${industryBenchmark.average_maturity_score}.`;
    }
  }

  summary += ` In total ${technologies.length} technolog${technologies.length === 1 ? 'y was' : 'ies were'} detected across ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}.`;

  return summary;
}

// ─── MASTER INTELLIGENCE FUNCTION ────────────────────────────────────────────

async function generateIntelligence(technologies, security, performance, seo, infrastructure, cluster) {
  try {
    logger.info('Generating intelligence analysis from knowledge base');

    if (!technologies || technologies.length === 0) {
      return {
        architecture: { id: 'unknown', name: 'Unknown', description: 'No technologies detected' },
        summary: 'Insufficient data to generate an intelligence report. No technologies were detected — the site may be behind authentication, bot protection, or returning an error page.',
        strengths: [],
        weaknesses: ['No technologies could be detected — the site may be behind a login wall, presenting a bot challenge page, or returning an error'],
        maturityScore: 0,
        industryComparison: null
      };
    }

    const architecture = classifyArchitecture(technologies);

    const [
      architecturePattern,
      industryBenchmark,
      strengths,
      weaknesses
    ] = await Promise.all([
      findBestArchitecturePattern(technologies),
      findIndustryBenchmark(cluster?.name || ''),
      generateStrengthsFromKnowledgeBase(technologies, security, performance, seo, infrastructure),
      generateWeaknessesFromKnowledgeBase(technologies, security, performance, seo,
        await findIndustryBenchmark(cluster?.name || ''))
    ]);

    const maturityScore = calculateMaturityScore(
      technologies, security, performance, seo, infrastructure
    );

    const summary = await generateSummary(
      technologies, architecture, cluster,
      security, performance, seo,
      architecturePattern, industryBenchmark
    );

    let industryComparison = null;
    if (industryBenchmark) {
      const diff = maturityScore - industryBenchmark.average_maturity_score;
      industryComparison = {
        industry: industryBenchmark.industry,
        industryAverage: industryBenchmark.average_maturity_score,
        thisScore: maturityScore,
        difference: diff,
        position: diff >= 15 ? 'above_average' : diff <= -15 ? 'below_average' : 'average',
        risingTechnologies: industryBenchmark.rising_technologies || [],
        decliningTechnologies: industryBenchmark.declining_technologies || [],
        notableCompanies: industryBenchmark.notable_companies || []
      };
    }

    updateTechIntelligenceFromScan(technologies).catch(err => {
      logger.warn(`Background tech intelligence update error: ${err.message}`);
    });

    logger.info(`Intelligence generated — Architecture: ${architecture.name}, Maturity: ${maturityScore}, Strengths: ${strengths.length}, Weaknesses: ${weaknesses.length}, Pattern: ${architecturePattern?.pattern_id || 'none'}, Industry: ${industryBenchmark?.industry || 'none'}`);

    return {
      architecture,
      summary,
      strengths,
      weaknesses,
      maturityScore,
      architecturePattern: architecturePattern ? {
        id: architecturePattern.pattern_id,
        name: architecturePattern.architecture_type,
        realWorldExamples: architecturePattern.real_world_examples || [],
        performanceProfile: architecturePattern.performance_profile,
        costProfile: architecturePattern.cost_profile,
        scalabilityProfile: architecturePattern.scalability_profile,
        typicalTeamSize: architecturePattern.typical_team_size,
        typicalCompanyStage: architecturePattern.typical_company_stage
      } : null,
      industryComparison
    };

  } catch (err) {
    logger.error(`Intelligence generation failed: ${err.message}`);
    return {
      architecture: { id: 'error', name: 'Error', description: 'Intelligence generation failed' },
      summary: 'An error occurred while generating the intelligence report.',
      strengths: [],
      weaknesses: [],
      maturityScore: 0,
      industryComparison: null
    };
  }
}

module.exports = { generateIntelligence };
