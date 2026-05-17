'use strict';

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ─── TECHNOLOGY INTELLIGENCE PROFILES ────────────────────────────────────────

const TECH_INTELLIGENCE = [
  {
    name: 'React',
    category: 'JavaScript Framework',
    performance_impact: 'React\'s virtual DOM diffing delivers efficient UI updates with minimal repaints. Bundle sizes range from 40KB (production minified) to 130KB with ReactDOM. Code splitting via React.lazy() and Suspense reduces initial load significantly. Without server-side rendering, initial page load shows blank content until JavaScript executes — a meaningful performance penalty on slow connections.',
    security_impact: 'React automatically escapes values rendered in JSX, preventing XSS injection by default. dangerouslySetInnerHTML bypasses this protection and must be used carefully. React DevTools exposes component state in development — ensure NODE_ENV=production in deployment. No built-in CSRF protection — depends on the backend implementation.',
    cost_profile: 'React itself is free and open source under MIT licence. Hosting costs depend entirely on deployment platform. A typical React SPA on Netlify or Vercel free tier costs nothing for low traffic. At scale, CDN bandwidth and serverless function invocations become the primary costs.',
    when_to_use: 'Complex interactive UIs requiring frequent state updates. Large engineering teams benefiting from component reusability. Applications requiring a rich ecosystem of third-party UI libraries. Long-term projects where the large talent pool reduces hiring risk.',
    when_not_to_use: 'Simple marketing sites or blogs where static HTML is faster and cheaper. SEO-critical sites without SSR — React SPAs rank poorly without server-side rendering. Small projects where the build tooling overhead outweighs the benefits.',
    common_alternatives: ['Vue.js', 'Angular', 'Svelte', 'SolidJS', 'Preact'],
    common_companions: ['Next.js', 'Tailwind CSS', 'TypeScript', 'Vercel', 'Cloudflare', 'Stripe', 'Sentry', 'Google Analytics'],
    maturity_signal: 0.92,
    known_weaknesses: [
      'Blank page on initial load without SSR — harmful for SEO and perceived performance',
      'Bundle size grows quickly as dependencies accumulate',
      'No official routing solution — requires React Router or framework-level routing',
      'Context API performance issues with frequent updates — requires careful architecture',
      'Breaking changes between major versions historically disruptive'
    ],
    real_world_users: ['Facebook', 'Instagram', 'Airbnb', 'Netflix', 'Dropbox', 'WhatsApp Web', 'Atlassian', 'Stripe']
  },
  {
    name: 'Next.js',
    category: 'JavaScript Framework',
    performance_impact: 'Next.js delivers some of the best performance characteristics available in web development. Static Site Generation (SSG) pre-renders pages at build time — TTFB under 50ms globally when served from a CDN. Server-Side Rendering (SSR) generates pages per request — TTFB typically 100-400ms depending on data fetching. Incremental Static Regeneration (ISR) combines both — static speed with fresh data. Automatic image optimisation via next/image reduces image payload by 40-80%. Automatic code splitting ensures users only download JavaScript needed for the current page.',
    security_impact: 'Next.js inherits React\'s XSS protections. Server Components introduced in Next.js 13+ keep sensitive logic and API keys server-side only — a significant security improvement. API routes provide a secure backend layer within the same codebase. Headers can be configured in next.config.js — including CSP, HSTS, and X-Frame-Options. Vercel deployment automatically enforces HTTPS.',
    cost_profile: 'Next.js is free and open source. Vercel (the creator) offers a generous free tier covering most personal and small commercial projects. Pro plan at $20/user/month adds team features and higher limits. Enterprise pricing for large organisations. Self-hosting on any Node.js server is free — AWS, Google Cloud, or a VPS.',
    when_to_use: 'Any React project where SEO matters. E-commerce sites requiring fast product pages. Marketing sites needing both performance and dynamic content. SaaS dashboards mixing static and dynamic pages. Projects where developer experience and deployment simplicity are priorities.',
    when_not_to_use: 'Purely static sites with no dynamic content — Astro delivers better performance. Internal tools with no SEO requirements — pure React SPA is simpler. Teams unfamiliar with the SSG/SSR/ISR distinction — the complexity can lead to poor architectural decisions.',
    common_alternatives: ['Nuxt.js', 'Remix', 'Astro', 'SvelteKit', 'Gatsby'],
    common_companions: ['React', 'Vercel', 'Tailwind CSS', 'Cloudflare', 'Stripe', 'Sentry', 'Supabase', 'Contentful'],
    maturity_signal: 0.94,
    known_weaknesses: [
      'Cold starts on Vercel serverless functions add latency to infrequently accessed routes',
      'App Router (introduced in Next.js 13) has a steep learning curve and partial documentation',
      'Build times grow significantly with large numbers of static pages',
      'Vendor lock-in to Vercel for optimal performance — self-hosting loses some features',
      'ISR cache invalidation complexity in multi-region deployments'
    ],
    real_world_users: ['Vercel', 'TikTok', 'Twitch', 'Hulu', 'Target', 'Nike', 'Linear', 'Loom']
  },
  {
    name: 'Vue.js',
    category: 'JavaScript Framework',
    performance_impact: 'Vue 3 with the Composition API delivers excellent runtime performance through a compiler-optimised virtual DOM. Bundle size is smaller than React — Vue 3 core is approximately 22KB gzipped. The reactivity system is granular and precise, avoiding unnecessary re-renders. Vue DevTools has minimal production overhead. Without SSR, Vue SPAs share the same blank-page initial load issue as React.',
    security_impact: 'Vue automatically escapes template expressions preventing XSS. The v-html directive bypasses escaping and must be used carefully with trusted content only. Vue Router provides client-side navigation without exposing server routes. No built-in authentication — requires implementation at the application level.',
    cost_profile: 'Vue.js is free and open source under MIT licence. Nuxt.js (the Vue meta-framework) is also free. Hosting options mirror React — Vercel, Netlify free tiers for low traffic, self-hosting for control.',
    when_to_use: 'Teams transitioning from jQuery or traditional HTML — Vue\'s template syntax is more familiar. Projects requiring a gentle learning curve with progressive adoption. Applications where the team values clear separation of template, logic, and styles in Single File Components. Asian market projects where Vue has particularly strong community support.',
    when_not_to_use: 'Large enterprise teams where Angular\'s strict structure and TypeScript-first approach reduces errors. Projects requiring the largest possible hiring pool — React has more developers globally. Applications needing the richest third-party component ecosystem.',
    common_alternatives: ['React', 'Angular', 'Svelte', 'SolidJS'],
    common_companions: ['Nuxt.js', 'Tailwind CSS', 'Vite', 'Pinia', 'Vue Router', 'Cloudflare'],
    maturity_signal: 0.88,
    known_weaknesses: [
      'Smaller ecosystem than React — fewer third-party component libraries',
      'Vue 2 to Vue 3 migration was disruptive — Composition API is a significant paradigm shift',
      'Less enterprise adoption than React or Angular reduces available senior talent',
      'Nuxt.js documentation historically inconsistent between versions'
    ],
    real_world_users: ['Alibaba', 'Xiaomi', 'Adobe', 'GitLab', 'Grammarly', 'Chess.com', 'Behance']
  },
  {
    name: 'Angular',
    category: 'JavaScript Framework',
    performance_impact: 'Angular\'s Ahead-of-Time (AOT) compilation reduces runtime overhead significantly compared to Just-in-Time compilation. Change detection with OnPush strategy and trackBy functions delivers near-React performance. Initial bundle sizes are historically larger than React or Vue — a full Angular application typically starts at 130-200KB gzipped. Angular 17+ with new control flow syntax and deferrable views improves this significantly. The built-in Angular CLI handles code splitting automatically.',
    security_impact: 'Angular has the strongest built-in security of the three major frameworks. Template injection is prevented by default through strict contextual escaping. Built-in HttpClient automatically sanitises inputs. DomSanitizer marks unsafe content explicitly. Angular\'s strict mode with TypeScript catches entire categories of runtime errors at compile time. Regular security audits by the Google team.',
    cost_profile: 'Angular is free and open source under MIT licence. Maintained by Google with long-term support commitments. Enterprise teams benefit from the predictable LTS release cycle — 18 months of active support per major version.',
    when_to_use: 'Large enterprise applications with multiple teams working on the same codebase. Projects where strict architecture and enforced patterns reduce bugs at scale. Applications heavily integrated with backend services via REST or GraphQL. Teams already using TypeScript extensively. Government and financial applications requiring predictable long-term support.',
    when_not_to_use: 'Small to medium projects where Angular\'s boilerplate adds unnecessary complexity. Teams new to TypeScript — the learning curve is steep. Marketing sites or content-focused applications where Astro or Next.js delivers better performance. Startups that need to iterate quickly — Angular\'s structure slows initial development.',
    common_alternatives: ['React', 'Vue.js', 'Svelte'],
    common_companions: ['TypeScript', 'RxJS', 'NgRx', 'AWS', 'Azure', 'Material UI', 'Google Analytics'],
    maturity_signal: 0.85,
    known_weaknesses: [
      'Steepest learning curve of the major frameworks — RxJS and dependency injection are complex',
      'Verbose boilerplate — simple features require more code than React or Vue equivalents',
      'Large initial bundle size without careful optimisation',
      'Breaking changes between major versions historically disruptive despite semantic versioning'
    ],
    real_world_users: ['Google', 'Microsoft', 'Deutsche Bank', 'Samsung', 'Forbes', 'UPS', 'Delta Airlines']
  },
  {
    name: 'Svelte',
    category: 'JavaScript Framework',
    performance_impact: 'Svelte is a compiler not a runtime framework. It compiles components to vanilla JavaScript at build time — zero framework overhead at runtime. Bundle sizes are typically 60-70% smaller than equivalent React applications. No virtual DOM diffing — direct DOM manipulation via compiled JavaScript. Svelte applications consistently score top marks in JavaScript framework benchmarks. The trade-off is longer build times as complexity grows.',
    security_impact: 'Svelte automatically escapes HTML in templates preventing XSS. The @html directive bypasses this — use only with trusted content. SvelteKit (the meta-framework) provides server-side rendering with secure server-only code isolation. No built-in authentication or CSRF protection.',
    cost_profile: 'Svelte and SvelteKit are free and open source under MIT licence. Vercel and Netlify both support SvelteKit with excellent free tiers. The smaller ecosystem means fewer paid component libraries — more custom development required.',
    when_to_use: 'Performance-critical applications where bundle size directly impacts conversion. Teams that want to write less code — Svelte requires significantly less boilerplate than React. Interactive data visualisations and animations where Svelte\'s reactivity model shines. Developers frustrated by React\'s hooks complexity.',
    when_not_to_use: 'Large teams where React\'s established patterns and larger talent pool reduce onboarding time. Enterprise applications requiring the mature ecosystem of Angular. Applications needing extensive third-party UI component libraries — React has far more options.',
    common_alternatives: ['React', 'Vue.js', 'SolidJS', 'Astro'],
    common_companions: ['SvelteKit', 'Tailwind CSS', 'Vercel', 'Netlify', 'TypeScript'],
    maturity_signal: 0.82,
    known_weaknesses: [
      'Smaller ecosystem than React or Vue — fewer third-party components and integrations',
      'Less available talent — harder to hire experienced Svelte developers',
      'SvelteKit still maturing — some rough edges compared to Next.js',
      'Build times increase significantly with large applications'
    ],
    real_world_users: ['Apple', 'Spotify', 'The New York Times', 'GoDaddy', '1Password', 'Razorpay']
  },
  {
    name: 'Astro',
    category: 'JavaScript Framework',
    performance_impact: 'Astro delivers the best possible performance for content-focused websites through its island architecture. By default Astro ships zero JavaScript to the browser — only interactive components hydrate client-side. This produces Core Web Vitals scores that are extremely difficult to match with other frameworks. Lighthouse scores of 95-100 are routine for well-built Astro sites. The trade-off is that highly interactive applications require careful architectural planning.',
    security_impact: 'Astro renders everything server-side by default — sensitive data never reaches the browser unless explicitly included. Component islands are isolated — a compromised third-party component cannot access other components\' data. Astro\'s content collections enforce frontmatter schemas reducing content injection risks.',
    cost_profile: 'Astro is free and open source under MIT licence. Deploys excellently to Netlify, Vercel, and Cloudflare Pages free tiers. Static output can be hosted on any CDN or object storage like AWS S3 for near-zero cost at any scale.',
    when_to_use: 'Marketing sites, blogs, documentation sites, and portfolios where content is the product. Any site where Core Web Vitals scores directly impact search ranking and conversion. Projects mixing multiple frameworks — Astro can use React, Vue, and Svelte components simultaneously. Teams migrating from Gatsby who want better performance and simpler mental models.',
    when_not_to_use: 'Highly interactive web applications like dashboards, editors, or real-time tools — React or Vue is more appropriate. Applications requiring complex client-side state management across many components. Teams that need a mature ecosystem with years of production battle-testing.',
    common_alternatives: ['Next.js', 'Nuxt.js', 'Gatsby', 'Eleventy', 'Hugo'],
    common_companions: ['Tailwind CSS', 'Cloudflare', 'Netlify', 'Vercel', 'Contentful', 'Sanity'],
    maturity_signal: 0.84,
    known_weaknesses: [
      'Island architecture adds complexity for highly interactive applications',
      'Younger ecosystem — fewer tutorials, Stack Overflow answers, and community resources than React',
      'Content collections require discipline to structure content correctly upfront',
      'Server-side rendering requires a Node.js host — pure static output loses some dynamic capabilities'
    ],
    real_world_users: ['Google', 'Microsoft', 'The Guardian', 'Porsche', 'Rolex', 'NordVPN']
  },
  {
    name: 'WordPress',
    category: 'CMS',
    performance_impact: 'WordPress performance varies enormously based on configuration. An uncached WordPress site on shared hosting can take 3-8 seconds to load — unacceptable for modern standards. A properly configured WordPress site with a full-page caching plugin (WP Rocket, W3 Total Cache), CDN, and optimised database queries can achieve 500ms load times. The plugin ecosystem is WordPress\'s greatest performance liability — each plugin adds database queries, JavaScript, and CSS. A site with 40+ plugins is almost always slow.',
    security_impact: 'WordPress powers 43% of all websites making it the most attacked CMS in existence. Core WordPress is regularly updated and generally secure. The risk comes from themes and plugins — outdated or poorly coded plugins are the primary attack vector. xmlrpc.php is a legacy endpoint frequently targeted for brute force attacks and should be disabled. Default admin URL /wp-admin is well-known — changing it reduces automated attacks. Regular database backups are essential as attacks can corrupt data.',
    cost_profile: 'WordPress software is free. Hosting ranges from $3-10/month on shared hosting to $25-100/month on managed WordPress hosting (WP Engine, Kinsta, Flywheel). Managed hosting handles security patches, backups, and performance optimisation automatically. Premium themes $30-100 one-time. Premium plugins $20-200/year each. Total cost of a production WordPress site: $500-2000/year for a serious commercial site.',
    when_to_use: 'Content-heavy sites requiring non-technical editors to manage content. Blogs, news sites, and media publications. Businesses needing a large library of pre-built functionality via plugins. Projects with limited development budget where plugin solutions replace custom development. E-commerce via WooCommerce for moderate-scale stores.',
    when_not_to_use: 'High-traffic sites requiring consistent performance without heavy infrastructure investment. Applications requiring complex custom functionality — technical debt accumulates quickly with WordPress. Security-critical applications where the large attack surface is unacceptable. Sites where a headless CMS would give content editors the same experience with better frontend performance.',
    common_alternatives: ['Ghost', 'Webflow', 'Squarespace', 'Contentful', 'Sanity', 'Drupal'],
    common_companions: ['PHP', 'jQuery', 'Cloudflare', 'Google Analytics', 'WooCommerce', 'Google Tag Manager'],
    maturity_signal: 0.65,
    known_weaknesses: [
      'Plugin conflicts are common and can break sites unexpectedly',
      'Database-heavy architecture struggles under high concurrent traffic without caching',
      'Default installation has multiple known attack vectors that require manual hardening',
      'Technical debt accumulates quickly — sites become difficult to maintain over time',
      'Theme and plugin updates can break custom modifications',
      'No built-in version control or staging environment in core'
    ],
    real_world_users: ['The New York Times (blogs)', 'BBC America', 'TechCrunch', 'The Walt Disney Company', 'Sony Music', 'Microsoft News']
  },
  {
    name: 'Shopify',
    category: 'E-Commerce',
    performance_impact: 'Shopify\'s infrastructure delivers reliable performance — global CDN, automatic image optimisation, and a 99.99% uptime SLA. Core Web Vitals vary significantly based on theme quality and installed apps. The Shopify App Store\'s greatest performance liability is app bloat — each installed app typically adds JavaScript and CSS. A store with 20+ apps frequently scores below 50 on Google PageSpeed. The Online Store 2.0 architecture with section-based themes and lazy-loaded app blocks significantly improves performance compared to legacy themes.',
    security_impact: 'Shopify handles PCI DSS compliance automatically — merchants never touch payment card data. SSL is automatic and enforced. Shopify\'s platform security team manages server-level security. The primary security risk is third-party apps with overly broad API permissions. Shopify\'s checkout is separate from the storefront — even a compromised storefront cannot intercept payment data.',
    cost_profile: 'Basic Shopify $39/month (2% transaction fee without Shopify Payments). Shopify $105/month (1% fee). Advanced Shopify $399/month (0.5% fee). Shopify Plus from $2000/month for enterprise. Apps average $15-50/month each — a fully-featured store with 10 apps adds $150-500/month. Shopify Payments eliminates transaction fees but is not available in all countries.',
    when_to_use: 'Direct-to-consumer product businesses that want to launch quickly. Brands scaling from 0 to several million in annual revenue. Merchants who want infrastructure managed for them. Businesses selling in multiple currencies and countries — Shopify Markets handles this well.',
    when_not_to_use: 'Businesses with very complex product configurations or custom workflows that Shopify\'s data model cannot accommodate. High-volume B2B with complex pricing tiers and account-based purchasing. Businesses where transaction fees at scale make Shopify economically unviable. Merchants needing deep customisation of the checkout — Shopify Plus required for checkout customisation.',
    common_alternatives: ['WooCommerce', 'BigCommerce', 'Magento', 'Squarespace Commerce', 'Wix eCommerce'],
    common_companions: ['Cloudflare', 'Google Analytics', 'Google Tag Manager', 'Facebook Pixel', 'Klaviyo', 'Stripe'],
    maturity_signal: 0.88,
    known_weaknesses: [
      'Transaction fees add significant cost for high-volume merchants not using Shopify Payments',
      'Limited checkout customisation without Shopify Plus',
      'App bloat is a major performance and cost issue at scale',
      'Shopify\'s Liquid templating language is proprietary — front-end developers prefer modern frameworks',
      'Complex B2B scenarios require expensive workarounds or Plus features',
      'Data portability is limited — migrating away from Shopify is painful'
    ],
    real_world_users: ['Gymshark', 'Allbirds', 'Kylie Cosmetics', 'Red Bull', 'Heinz', 'Staples', 'Tesla (merchandise)']
  },
  {
    name: 'Cloudflare',
    category: 'CDN',
    performance_impact: 'Cloudflare operates one of the largest networks in the world with 300+ data centres in 100+ countries. Every visitor is served from the nearest PoP reducing geographic latency dramatically. For static assets cached at the edge TTFB drops to under 10ms globally. Cloudflare\'s Argo Smart Routing finds the optimal path through the internet for uncached requests reducing latency by 30% on average. Image optimisation via Polish and Mirage reduces image payload automatically. HTTP/3 with QUIC protocol support improves performance on mobile networks.',
    security_impact: 'Cloudflare provides a full security stack at the edge. DDoS protection absorbs attacks up to 2.3 Tbps — the largest ever publicly disclosed. Web Application Firewall (WAF) filters OWASP Top 10 attacks before they reach the origin. Bot Management identifies and blocks automated threats. Rate limiting prevents credential stuffing and API abuse. SSL/TLS termination at the edge with automatic certificate renewal. DNS over HTTPS prevents DNS hijacking. Cloudflare Access provides zero-trust access control for internal applications.',
    cost_profile: 'Free tier covers most personal and small commercial sites — unlimited bandwidth, global CDN, DDoS protection, and SSL. Pro at $25/month adds WAF, advanced caching, and image optimisation. Business at $200/month adds custom WAF rules and 100% uptime SLA. Enterprise pricing for large organisations with custom contracts. Workers (serverless compute at the edge) free tier includes 100,000 requests/day.',
    when_to_use: 'Any public-facing website receiving traffic from multiple geographic regions. Sites that have experienced or are vulnerable to DDoS attacks. Applications requiring edge compute via Cloudflare Workers. Any site where SSL management is a burden. Sites with high static asset volumes benefiting from edge caching.',
    when_not_to_use: 'Internal applications not exposed to the internet — Cloudflare adds no value. Sites with very dynamic content that cannot be cached — full-page caching requires careful configuration. Applications using WebSockets extensively — Cloudflare\'s handling of WebSocket connections requires specific configuration.',
    common_alternatives: ['AWS CloudFront', 'Fastly', 'Akamai', 'BunnyCDN', 'KeyCDN'],
    common_companions: ['Vercel', 'Netlify', 'React', 'Next.js', 'WordPress', 'Shopify', 'Stripe'],
    maturity_signal: 0.95,
    known_weaknesses: [
      'Orange Cloud mode (proxied) can break certain DNS configurations and some APIs',
      'Cache purging at scale requires careful planning — stale content can persist',
      'Cloudflare outages (rare but documented) take down all proxied sites simultaneously',
      'WebSocket configuration requires specific rules and may add latency',
      'IP geolocation accuracy varies — some edge cases affect geo-targeted content'
    ],
    real_world_users: ['Discord', 'Shopify', 'Doordash', 'Garmin', 'OKCupid', 'Zendesk', 'Crunchyroll']
  },
  {
    name: 'Vercel',
    category: 'Hosting',
    performance_impact: 'Vercel\'s global edge network delivers Next.js applications with exceptional performance. Static assets are served from the closest of 70+ edge locations globally. Edge Functions execute at the edge reducing latency for personalised content. Automatic preview deployments for every Git push accelerate the development feedback loop. Image optimisation via the Vercel Image Optimisation API reduces image payload automatically. The Analytics product provides real-time Core Web Vitals monitoring per page.',
    security_impact: 'Vercel enforces HTTPS on all deployments automatically. Environment variables are encrypted at rest and never exposed to client-side code. Deployment previews are protected by Vercel Authentication or custom access controls. DDoS protection is provided at the infrastructure level. Vercel\'s infrastructure is SOC 2 Type 2 certified. Secure headers can be configured in vercel.json.',
    cost_profile: 'Hobby tier is free — personal projects, unlimited deployments, 100GB bandwidth/month. Pro at $20/user/month — commercial use, team collaboration, 1TB bandwidth. Enterprise with custom pricing for large organisations. Serverless function execution is metered — 100GB-hours free on Hobby, 1000GB-hours on Pro. Edge Function execution is metered separately.',
    when_to_use: 'Next.js applications — Vercel created Next.js and provides the best possible hosting for it. Teams wanting zero-configuration deployment from Git. Projects needing preview deployments for stakeholder review. Applications requiring edge compute without managing infrastructure.',
    when_not_to_use: 'Long-running server processes — Vercel\'s serverless architecture has a maximum execution time. Applications requiring persistent WebSocket connections. Projects with very high serverless function execution volumes where metered pricing becomes expensive. Teams with specific compliance requirements that Vercel\'s shared infrastructure cannot meet.',
    common_alternatives: ['Netlify', 'AWS', 'Google Cloud Run', 'Render', 'Railway'],
    common_companions: ['Next.js', 'React', 'Tailwind CSS', 'Cloudflare', 'Supabase', 'Stripe'],
    maturity_signal: 0.91,
    known_weaknesses: [
      'Serverless function cold starts add latency to infrequently accessed routes',
      'Vendor lock-in — some Next.js features only work optimally on Vercel',
      'Metered pricing for functions can produce unexpected bills at scale',
      'No persistent file system — stateful applications require external storage',
      'Maximum function execution time of 60 seconds on Pro (300 on Enterprise)'
    ],
    real_world_users: ['Washington Post', 'Tripadvisor', 'HashiCorp', 'Zapier', 'Loom', 'Linear', 'Sonos']
  },
  {
    name: 'Netlify',
    category: 'Hosting',
    performance_impact: 'Netlify\'s global ADN (Application Delivery Network) serves static assets from 100+ edge locations. Build times are competitive with automatic caching of unchanged build steps. Netlify Functions (AWS Lambda under the hood) execute serverless logic. Edge Functions (Deno runtime) execute at the edge for near-zero latency personalisation. Netlify\'s branch deploy and split testing features enable performance experiments without infrastructure changes.',
    security_impact: 'Netlify enforces HTTPS automatically with Let\'s Encrypt certificates. Netlify Identity provides authentication without custom backend code. Environment variables are encrypted and access-controlled per deploy context. DDoS protection at the infrastructure level. SOC 2 Type 2 certified. Custom headers including CSP can be configured in netlify.toml.',
    cost_profile: 'Free tier — personal projects, 100GB bandwidth/month, 300 build minutes/month, 125,000 serverless function invocations/month. Pro at $19/site/month — commercial use, 400GB bandwidth, 25,000 form submissions. Business at $99/site/month — SAML SSO, advanced security. Enterprise with custom pricing.',
    when_to_use: 'JAMstack sites and SPAs deployed from Git. Teams wanting a simpler alternative to Vercel not locked into Next.js. Projects using Gatsby, Hugo, Eleventy, or other static site generators. Applications using Netlify\'s built-in form handling or identity features.',
    when_not_to_use: 'Next.js applications where Vercel\'s tight integration provides better performance. Applications with very high function invocation volumes. Long-running processes — same serverless constraints as Vercel.',
    common_alternatives: ['Vercel', 'AWS', 'Cloudflare Pages', 'Render', 'GitHub Pages'],
    common_companions: ['React', 'Vue.js', 'Gatsby', 'Astro', 'Cloudflare', 'Contentful', 'Sanity'],
    maturity_signal: 0.88,
    known_weaknesses: [
      'Build minutes can be exhausted quickly on the free tier for large teams',
      'Netlify Functions have same cold start issues as all serverless platforms',
      'Form handling limited to 100 submissions/month on free tier',
      'Less optimised for Next.js than Vercel despite support'
    ],
    real_world_users: ['Figma docs', 'Smashing Magazine', 'Loblaw Digital', 'Peloton', 'Twilio docs', 'Vue.js docs']
  },
  {
    name: 'Stripe',
    category: 'Payment',
    performance_impact: 'Stripe.js loads asynchronously and does not block page rendering. The payment form iframe loads from Stripe\'s CDN — typically 200-400ms. Stripe Checkout (hosted payment page) redirects users off-site — the fastest integration for initial implementation. Payment Intents API with 3D Secure adds an authentication step that adds 2-10 seconds to checkout for some users. Stripe\'s global infrastructure handles millions of transactions per second with 99.999% uptime.',
    security_impact: 'Stripe is PCI DSS Level 1 certified — the highest level of payment card industry compliance. Card data never touches the merchant\'s servers — tokenised by Stripe.js before transmission. Stripe Radar uses machine learning to detect and block fraudulent transactions. Stripe handles 3D Secure authentication automatically. Webhook signatures must be verified to prevent replay attacks. API keys must be kept server-side — publishable key is safe for client-side use, secret key must never be exposed.',
    cost_profile: 'No monthly fees. 2.9% + 30¢ per successful card transaction in the US. International cards add 1.5%. Currency conversion adds 1%. Stripe Billing for subscriptions adds 0.5-0.8% on top. Radar (fraud protection) is included. Stripe Connect for marketplace payments has additional fees. At $1M annual revenue Stripe fees total approximately $30,000/year.',
    when_to_use: 'Any business accepting online payments that values developer experience and reliability. SaaS companies managing subscriptions via Stripe Billing. Marketplaces using Stripe Connect for split payments. Global businesses needing multi-currency support in 135+ currencies. Companies wanting best-in-class fraud protection without custom implementation.',
    when_not_to_use: 'Very high volume businesses where fee negotiation with Stripe\'s enterprise team or alternative processors provides better economics. Markets where Stripe is not available — Stripe operates in 46 countries as of 2024. Businesses where customers strongly prefer local payment methods that Stripe does not support.',
    common_alternatives: ['PayPal', 'Braintree', 'Adyen', 'Square', 'Paddle', 'Razorpay', 'Paystack'],
    common_companions: ['React', 'Next.js', 'Cloudflare', 'Intercom', 'Sentry', 'Google Analytics'],
    maturity_signal: 0.96,
    known_weaknesses: [
      'Transaction fees are higher than some alternatives for very high volumes',
      'Not available in all countries — coverage gaps in Africa, Southeast Asia, and parts of Latin America',
      '3D Secure authentication adds friction to checkout — some conversion rate impact',
      'Stripe Billing subscription management has complexity around proration and plan changes',
      'Webhook reliability requires careful retry logic and idempotency key handling'
    ],
    real_world_users: ['Amazon', 'Google', 'Microsoft', 'Shopify', 'Spotify', 'Lyft', 'Slack', 'Notion', 'Figma']
  },
  {
    name: 'Tailwind CSS',
    category: 'CSS Framework',
    performance_impact: 'Tailwind CSS production builds purge all unused utility classes — a typical production CSS file is 5-15KB gzipped compared to Bootstrap\'s 30KB. This directly improves page load times. The utility-first approach eliminates the CSS specificity battles that cause CSS file bloat over time. No JavaScript runtime — pure CSS. The trade-off is longer HTML class attributes that add slight HTML payload, negligible in practice.',
    security_impact: 'Tailwind CSS has no security implications — it is pure CSS. No JavaScript, no dynamic code execution. The PostCSS build pipeline should be kept updated to avoid build tool vulnerabilities, but these do not affect the runtime security of deployed sites.',
    cost_profile: 'Tailwind CSS is free and open source under MIT licence. Tailwind UI (official component library) is $299 one-time for personal licence, $799 for team licence. Headless UI (accessible components) is free. The Tailwind Play CDN allows prototyping without a build step.',
    when_to_use: 'Projects where rapid UI development with design consistency is a priority. Teams that want to avoid writing custom CSS. Applications where CSS bundle size impacts performance. Projects using a design system where Tailwind\'s configuration maps directly to design tokens.',
    when_not_to_use: 'Teams that strongly prefer semantic CSS class names for readability. Projects with an existing CSS architecture that would require complete rewrite. Designers who prefer working in CSS directly rather than utility classes. Simple sites where a pre-built Bootstrap template is faster to implement.',
    common_alternatives: ['Bootstrap', 'Material UI', 'Chakra UI', 'Bulma', 'Foundation'],
    common_companions: ['React', 'Next.js', 'Vue.js', 'Astro', 'Headless UI', 'Radix UI'],
    maturity_signal: 0.91,
    known_weaknesses: [
      'Long class attribute strings reduce HTML readability significantly',
      'Requires a build step — cannot be used purely from CDN in production',
      'Custom design systems require careful Tailwind configuration to avoid conflicts',
      'Developers without CSS fundamentals can produce poor layouts despite using Tailwind correctly'
    ],
    real_world_users: ['GitHub', 'Shopify', 'Netflix', 'NASA', 'Stripe docs', 'Tailwind Labs', 'Vercel docs', 'Laravel']
  },
  {
    name: 'Google Analytics',
    category: 'Analytics',
    performance_impact: 'Google Analytics 4 (GA4) adds approximately 50-80KB of JavaScript to the page. Loading via Google Tag Manager adds another layer. The analytics.js script for Universal Analytics was 27KB — GA4 with gtag.js is heavier. Loading asynchronously prevents render blocking but the script evaluation still uses main thread time. Google recommends loading GA via the gtag.js snippet which is non-blocking. Cumulative Layout Shift (CLS) can be affected by analytics-triggered popups or overlays.',
    security_impact: 'Google Analytics collects user behaviour data and sends it to Google\'s servers — a privacy consideration under GDPR, CCPA, and similar regulations. IP anonymisation should be enabled in GA4 settings. Cookie consent must be obtained before setting analytics cookies in EU and UK jurisdictions. GA4 data is stored in Google\'s infrastructure — subject to Google\'s privacy policy and potential government data requests.',
    cost_profile: 'Google Analytics 4 is free for most businesses — up to 10 million events per month. Google Analytics 360 (enterprise) starts at $150,000/year — provides higher limits, SLAs, and BigQuery export. The primary cost of Google Analytics is not monetary but data privacy compliance — legal and consent management infrastructure.',
    when_to_use: 'Any business website needing basic traffic analytics, conversion tracking, and user behaviour insights. E-commerce sites tracking product and purchase funnels. Marketing teams running Google Ads campaigns — GA4 integration provides attribution. Businesses that need to share analytics access with multiple stakeholders.',
    when_not_to_use: 'Privacy-focused applications where user data sharing with Google is unacceptable. Businesses in industries with strict data sovereignty requirements. Sites targeting users who frequently block Google Analytics via browser extensions. Teams that want simpler analytics without GA4\'s complexity.',
    common_alternatives: ['Plausible', 'Fathom Analytics', 'Mixpanel', 'Amplitude', 'PostHog', 'Matomo'],
    common_companions: ['Google Tag Manager', 'Facebook Pixel', 'Cloudflare', 'HubSpot', 'Hotjar'],
    maturity_signal: 0.80,
    known_weaknesses: [
      'GA4\'s interface is significantly more complex than Universal Analytics — steep learning curve',
      'High ad blocker penetration rate means 20-40% of traffic may go untracked',
      'GDPR compliance requires cookie consent management adding implementation complexity',
      'Data sampling applies to high-traffic properties on the free tier',
      'Universal Analytics sunset in July 2023 forced all users to migrate — GA4 is not backwards compatible',
      'Data is shared with Google — a privacy concern for sensitive industries'
    ],
    real_world_users: 'Used by approximately 56% of all websites globally according to W3Techs — the most widely deployed analytics platform in existence'
  },
  {
    name: 'Sentry',
    category: 'Monitoring',
    performance_impact: 'Sentry\'s browser SDK adds approximately 60-80KB gzipped to the JavaScript bundle. Error capturing is asynchronous and does not block the main thread. Performance monitoring via Sentry\'s tracing SDK adds distributed tracing to all network requests — a small overhead per request (1-2ms) but comprehensive visibility into application performance. Session replay records user interactions — privacy implications require careful configuration of what data is captured.',
    security_impact: 'Sentry captures stack traces, request data, and user context when errors occur. This can inadvertently capture sensitive data — passwords in form submissions, authentication tokens in headers, or PII in URL parameters. Sentry provides data scrubbing rules and PII scrubbing configuration to prevent this. Error data is stored in Sentry\'s cloud — data residency options available for EU compliance.',
    cost_profile: 'Free tier — 5,000 errors/month, 10,000 performance transactions/month, 1 user. Team at $26/month — 50,000 errors, 100,000 transactions, unlimited users. Business at $80/month — advanced features, SLA. Enterprise with custom pricing. Self-hosted Sentry is free but requires significant infrastructure to maintain.',
    when_to_use: 'Any production application where errors affect user experience. Teams that want to know about bugs before users report them. Applications with complex async operations where stack traces are hard to debug without a tool. Multi-service architectures where distributed tracing reveals performance bottlenecks.',
    when_not_to_use: 'Simple static sites with no JavaScript logic to error. Applications with strict data residency requirements that Sentry\'s cloud cannot meet. Development environments where error logging to console is sufficient.',
    common_alternatives: ['Datadog', 'New Relic', 'LogRocket', 'Bugsnag', 'Rollbar', 'Honeybadger'],
    common_companions: ['React', 'Next.js', 'Cloudflare', 'Stripe', 'AWS', 'Google Cloud'],
    maturity_signal: 0.90,
    known_weaknesses: [
      'Can accidentally capture PII and sensitive data without careful configuration',
      'Error volume can spike unexpectedly — quota exhaustion leaves monitoring gaps',
      'Session replay has significant privacy implications requiring explicit consent',
      'Performance monitoring overhead adds latency to all instrumented requests',
      'Alert fatigue is common without careful noise filtering configuration'
    ],
    real_world_users: ['Microsoft', 'Cloudflare', 'GitHub', 'Notion', 'Figma', 'Disney', 'Robinhood', 'Peloton']
  },
  {
    name: 'Intercom',
    category: 'Customer Support',
    performance_impact: 'Intercom\'s messenger widget adds 200-300KB of JavaScript and makes multiple API calls on page load. This is one of the heavier customer support tools in terms of page weight. Intercom recommends loading the widget only after the page has fully loaded to avoid impacting Core Web Vitals. The widget is rendered in an iframe isolating it from the main page. Lazy loading the Intercom snippet reduces impact on initial page load significantly.',
    security_impact: 'Intercom stores conversation data on Intercom\'s servers. User identity verification using a cryptographic hash prevents users from impersonating each other in conversations. GDPR compliance requires a Data Processing Agreement with Intercom. Conversation data is stored in the US by default — EU data residency available on higher plans.',
    cost_profile: 'Starter plan at $74/month for startups. Pro plan pricing based on number of seats and usage — typically $400-1500/month for growing businesses. Enterprise pricing for large organisations. Intercom\'s pricing is one of the most expensive in the customer support category — frequently cited as a reason companies switch alternatives as they scale.',
    when_to_use: 'SaaS products where in-app messaging drives activation and retention. Companies with product-led growth models where support and sales conversations happen in-product. Teams wanting a unified platform for support, marketing automation, and customer success.',
    when_not_to_use: 'Price-sensitive companies where Crisp, Tawk.to, or Zendesk provide sufficient functionality at lower cost. High-traffic consumer applications where the widget\'s performance impact affects Core Web Vitals. Companies that separate support, marketing, and sales tooling by preference.',
    common_alternatives: ['Zendesk', 'Crisp', 'Drift', 'HubSpot Chat', 'Freshdesk', 'Tawk.to'],
    common_companions: ['Stripe', 'Segment', 'React', 'Cloudflare', 'Google Analytics', 'Sentry'],
    maturity_signal: 0.87,
    known_weaknesses: [
      'One of the most expensive customer support platforms — pricing increases significantly at scale',
      'Heavy page weight impacts Core Web Vitals scores',
      'Pricing model changed significantly in 2023 — many customers experienced large cost increases',
      'Feature complexity can be overwhelming for small teams',
      'Data portability and migration away from Intercom is difficult'
    ],
    real_world_users: ['Atlassian', 'Shopify', 'New Relic', 'Amplitude', 'Airtable', 'Notion', 'Figma', 'Linear']
  },
  {
    name: 'HubSpot',
    category: 'Marketing',
    performance_impact: 'HubSpot\'s tracking code adds approximately 50-80KB of JavaScript loaded asynchronously. The HubSpot CMS (if used for hosting) delivers pages from HubSpot\'s CDN. HubSpot forms and chat widgets add additional payload. Total HubSpot-related JavaScript on a heavily integrated site can reach 300-500KB. Cookie consent banners required for GDPR compliance add visible page elements that affect perceived load time.',
    security_impact: 'HubSpot stores CRM data, form submissions, and contact records on HubSpot\'s servers. SOC 2 Type 2 certified. GDPR-compliant with Data Processing Agreement available. Cookie consent management is built into HubSpot\'s CMS. API keys must be secured server-side — private app tokens replace legacy API keys in modern HubSpot integrations.',
    cost_profile: 'Marketing Hub Starter $20/month. Professional $890/month. Enterprise $3600/month. Sales, Service, CMS, and Operations Hubs have separate pricing tiers. HubSpot\'s full suite at Professional level typically runs $1500-3000/month for a growing business. The free CRM is genuinely free with unlimited users — the cost comes when adding Marketing, Sales, or Service Hub features.',
    when_to_use: 'B2B companies running inbound marketing with blog, SEO, and lead capture. Teams wanting a unified CRM, marketing automation, and sales platform. Companies with marketing teams that need to create landing pages and emails without developer support. Businesses tracking the full customer journey from first visit to closed deal.',
    when_not_to_use: 'E-commerce businesses where Klaviyo or Mailchimp provides better product-focused email automation. Very early stage companies where HubSpot\'s cost is disproportionate to its value. Companies that already have a strong CRM like Salesforce and do not need to switch.',
    common_alternatives: ['Salesforce', 'Marketo', 'ActiveCampaign', 'Mailchimp', 'Klaviyo', 'ConvertKit'],
    common_companions: ['Google Analytics', 'Google Tag Manager', 'Cloudflare', 'React', 'Stripe', 'Facebook Pixel'],
    maturity_signal: 0.85,
    known_weaknesses: [
      'Pricing escalates sharply at Professional and Enterprise tiers',
      'Contact-based pricing means costs scale with list growth — can become expensive',
      'HubSpot CMS is proprietary — migrating content away is difficult',
      'Email deliverability from HubSpot\'s shared sending infrastructure can be lower than dedicated ESPs',
      'Reporting has limitations compared to dedicated BI tools'
    ],
    real_world_users: ['Shopify', 'SurveyMonkey', 'TrustPilot', 'GoFundMe', 'ClassPass', 'DoorDash']
  },
  {
    name: 'Segment',
    category: 'Analytics',
    performance_impact: 'Segment\'s analytics.js library is approximately 60-80KB gzipped. It loads asynchronously and does not block page rendering. The primary performance benefit of Segment is that it replaces multiple individual analytics scripts — instead of loading Google Analytics, Mixpanel, and Amplitude separately (180KB+ combined) Segment loads once and forwards events to all destinations server-side or via cloud-mode (no additional client-side code for each destination).',
    security_impact: 'Segment acts as a data pipeline — all user event data passes through Segment\'s servers before reaching downstream destinations. This centralises data governance — PII scrubbing, data filtering, and consent management can be applied once in Segment rather than separately in each analytics tool. Segment is SOC 2 Type 2 certified. GDPR consent management integrates with Segment\'s consent tools.',
    cost_profile: 'Free tier — 1,000 monthly tracked users. Team at $120/month — 10,000 MTUs. Business with custom pricing — unlimited MTUs, advanced features, SLA. Twilio acquired Segment in 2020 — pricing and product direction has been stable since acquisition.',
    when_to_use: 'Companies using three or more analytics and marketing tools that need consistent data across all of them. Data-driven teams that want a single source of truth for user behaviour. Companies with privacy compliance requirements that benefit from centralised PII management. Engineering teams that want to avoid implementing multiple analytics SDKs.',
    when_not_to_use: 'Simple sites needing only Google Analytics — Segment adds complexity without proportional benefit. Very early stage companies where the cost is unjustified. Applications with very high event volumes where Segment\'s MTU-based pricing becomes expensive.',
    common_alternatives: ['Rudderstack', 'Amplitude', 'mParticle', 'Snowplow'],
    common_companions: ['React', 'Intercom', 'Mixpanel', 'Amplitude', 'Stripe', 'Cloudflare', 'Sentry'],
    maturity_signal: 0.91,
    known_weaknesses: [
      'MTU-based pricing can produce unexpected bills as the user base grows',
      'Implementation complexity — requires careful event taxonomy planning upfront',
      'Data latency in cloud-mode destinations can be 1-5 minutes — not suitable for real-time use cases',
      'Twilio acquisition has introduced product uncertainty for some customers'
    ],
    real_world_users: ['Atlassian', 'Intuit', 'Levi\'s', 'Gap', 'IBM', 'Instacart', 'Bonobos', 'Wayfair']
  },
  {
    name: 'Firebase',
    category: 'Database',
    performance_impact: 'Firebase Realtime Database and Firestore deliver real-time data synchronisation — ideal for collaborative applications, chat, and live dashboards. Firestore\'s offline persistence enables applications to function without internet connectivity. Cold start times for Cloud Functions can be 1-5 seconds for infrequently invoked functions. Firebase Hosting delivers static assets from Google\'s CDN globally. The Firebase JavaScript SDK adds 80-200KB depending on which services are initialised.',
    security_impact: 'Firebase Security Rules are the critical security layer — poorly written rules can expose all data publicly. Firestore rules must be thoroughly tested before deployment. Firebase Authentication handles user identity securely. App Check prevents abuse by non-genuine app clients. Firebase\'s infrastructure is hosted on Google Cloud — inheriting Google\'s security certifications.',
    cost_profile: 'Spark plan (free) — 1GB Firestore storage, 50,000 reads/day, 20,000 writes/day, 1GB Realtime Database, 10GB hosting bandwidth. Blaze plan (pay as you go) — $0.06/100,000 reads, $0.18/100,000 writes, $0.02/GB storage. Cloud Functions require the Blaze plan. Most small to medium applications stay within free tier limits.',
    when_to_use: 'Real-time applications — chat, collaborative editing, live dashboards. Mobile applications (iOS and Android) where Firebase\'s SDKs reduce backend development. Rapid prototyping where Firebase eliminates backend infrastructure setup. Applications where offline functionality is required.',
    when_not_to_use: 'Applications requiring complex relational queries — Firestore\'s NoSQL model struggles with joins. High-write-volume applications where Firestore costs escalate quickly. Applications requiring SQL compliance or complex transactions. Teams with existing relational database expertise where Supabase or PlanetScale is a better fit.',
    common_alternatives: ['Supabase', 'PlanetScale', 'AWS DynamoDB', 'MongoDB Atlas', 'Neon'],
    common_companions: ['React', 'Vue.js', 'Google Analytics', 'Google Cloud', 'Stripe'],
    maturity_signal: 0.83,
    known_weaknesses: [
      'Security Rules complexity — many Firebase breaches result from misconfigured rules',
      'Vendor lock-in — Firebase\'s proprietary APIs make migration extremely difficult',
      'NoSQL data model struggles with relational data and complex queries',
      'Cloud Function cold starts add significant latency for infrequently called endpoints',
      'Firestore costs can escalate unexpectedly with high read volumes'
    ],
    real_world_users: ['Duolingo', 'Alibaba', 'The New York Times', 'Lyft', 'Accenture', 'Halfbrick (Fruit Ninja)', 'Shazam']
  },
  {
    name: 'Supabase',
    category: 'Database',
    performance_impact: 'Supabase is built on PostgreSQL — queries can be as performant as any relational database with proper indexing. The auto-generated REST API via PostgREST is optimised for common query patterns. Supabase Realtime provides WebSocket-based data subscriptions for live updates. Connection pooling via PgBouncer handles high concurrent connection counts. Edge Functions (Deno runtime) execute close to users globally.',
    security_impact: 'Supabase\'s Row Level Security (RLS) policies enforce data access at the database level — even if application code has bugs, RLS prevents unauthorised data access. JWT-based authentication integrates with RLS policies. The service_role key bypasses RLS and must be kept exclusively server-side. API keys are exposed in client-side code — the anon key should have minimal permissions enforced via RLS.',
    cost_profile: 'Free tier — 500MB database, 1GB file storage, 50,000 monthly active users, 500MB bandwidth. Pro at $25/project/month — 8GB database, 100GB storage, 100,000 MAU. Team at $599/month — multiple projects, priority support. Enterprise with custom pricing. The free tier is genuinely generous for development and small production applications.',
    when_to_use: 'Applications requiring a relational database with modern developer experience. Teams familiar with SQL who want Postgres without database administration overhead. Applications needing authentication, storage, and real-time subscriptions in one platform. Projects migrating from Firebase that need relational data structures.',
    when_not_to_use: 'Applications with primarily non-relational data structures where Firebase or MongoDB is more natural. Very high-scale applications where a dedicated managed PostgreSQL service provides more control. Teams that need Oracle or SQL Server compatibility.',
    common_alternatives: ['Firebase', 'PlanetScale', 'Neon', 'AWS RDS', 'MongoDB Atlas'],
    common_companions: ['Next.js', 'React', 'Tailwind CSS', 'Vercel', 'Stripe'],
    maturity_signal: 0.86,
    known_weaknesses: [
      'Relatively young platform — some enterprise features still maturing',
      'Free tier projects pause after 1 week of inactivity — disruptive for intermittently used projects',
      'RLS policies add complexity — incorrectly written policies can either block legitimate access or allow unauthorised access',
      'Self-hosting Supabase is complex — the managed platform is strongly recommended'
    ],
    real_world_users: ['Mozilla', 'PwC', 'Goodreads', 'Chatbase', 'Mobbin', 'Peerlist', 'Anonfiles']
  },
  {
    name: 'Algolia',
    category: 'Search',
    performance_impact: 'Algolia delivers search results in under 10ms globally through distributed search indices replicated across multiple data centres. InstantSearch.js provides real-time search-as-you-type with no additional round trips. The search index is updated asynchronously — typically 1-5 seconds after content changes in the source system. Algolia\'s CDN serves the search API from the closest location to the user.',
    security_impact: 'Algolia uses separate API keys for search and administration — the search-only API key is safe to expose client-side. The admin API key must be kept server-side only. Search indices can be configured to exclude sensitive fields. Access-controlled indices require user-specific secured API keys generated server-side.',
    cost_profile: 'Free tier — 10,000 searches/month, 10,000 records. Grow plan from $50/month — 100,000 searches, 100,000 records. Premium with custom pricing for higher volumes. Algolia\'s pricing is based on search operations and record count — both can grow unexpectedly with high-traffic applications. E-commerce sites with large catalogues need careful cost estimation.',
    when_to_use: 'E-commerce sites where search quality directly impacts conversion — Algolia\'s relevance tuning and typo tolerance significantly outperform basic database search. Documentation sites and knowledge bases. Applications where users expect instant, typo-tolerant search results. Multi-language applications where Algolia\'s language-aware search adds value.',
    when_not_to_use: 'Applications with very simple search requirements where database full-text search is sufficient. Very high-volume applications where Algolia\'s per-search pricing becomes expensive. Applications with strict data residency requirements — Algolia\'s index replication crosses jurisdictions.',
    common_alternatives: ['Elasticsearch', 'Typesense', 'Meilisearch', 'AWS CloudSearch', 'Postgres full-text search'],
    common_companions: ['React', 'Next.js', 'Shopify', 'Contentful', 'Cloudflare'],
    maturity_signal: 0.90,
    known_weaknesses: [
      'Pricing can escalate quickly with high search volumes or large record counts',
      'Index synchronisation adds latency between content updates and search results',
      'Limited complex query support compared to Elasticsearch',
      'Data lives in Algolia\'s infrastructure — data portability requires re-indexing on migration'
    ],
    real_world_users: ['Stripe docs', 'Twitch', 'Medium', 'Lacoste', 'Decathlon', 'Under Armour', 'Gymshark', 'Doctolib']
  },
  {
    name: 'Hotjar',
    category: 'Analytics',
    performance_impact: 'Hotjar adds approximately 50-70KB of JavaScript loaded asynchronously. Session recording captures all user interactions — no additional network requests per interaction, data is batched and sent periodically. Heatmaps are generated server-side from recorded sessions — no real-time processing on the client. The recording script\'s memory usage increases with page complexity — very long pages with many elements can cause performance issues in the recording.',
    security_impact: 'Hotjar automatically masks password fields and payment card inputs. Sensitive data masking can be configured for any element via CSS classes. Session recordings store user interaction data on Hotjar\'s servers in the EU. GDPR compliance requires cookie consent before Hotjar initialises. Users can opt out via the Hotjar opt-out page.',
    cost_profile: 'Free tier — 35 sessions/day recorded. Plus at $39/month — 100 sessions/day. Business at $99/month — 500 sessions/day, advanced features. Scale with custom pricing. Heatmaps are included in all plans.',
    when_to_use: 'UX teams investigating why users are not converting or completing key flows. Product teams identifying confusion points in new features. Conversion rate optimisation requiring visual evidence of user behaviour. Customer support teams understanding user-reported issues through session replay.',
    when_not_to_use: 'Applications where user privacy is paramount — session recording is inherently invasive. Banking, healthcare, and legal applications where recording user interactions creates compliance risk. Sites with very complex JavaScript UIs where Hotjar\'s recording accuracy degrades.',
    common_alternatives: ['FullStory', 'LogRocket', 'Microsoft Clarity (free)', 'Mouseflow', 'Crazy Egg'],
    common_companions: ['Google Analytics', 'Google Tag Manager', 'WordPress', 'Shopify', 'React'],
    maturity_signal: 0.80,
    known_weaknesses: [
      'Session recording is inherently privacy-invasive — requires clear user consent',
      'Recording accuracy degrades on highly dynamic JavaScript applications',
      'Daily session limits on lower tiers mean sampling is required for high-traffic sites',
      'Heatmap data requires significant traffic to be statistically meaningful'
    ],
    real_world_users: ['Shopify', 'Unbounce', 'Typeform', 'Buffer', 'Trustpilot', 'Invoice Ninja']
  },
  {
    name: 'Paystack',
    category: 'Payment',
    performance_impact: 'Paystack\'s checkout script loads from Paystack\'s CDN asynchronously. The payment modal opens in an iframe — no page navigation required for the payment flow. API response times are typically 200-500ms for transaction processing. Paystack\'s infrastructure is optimised for African banking networks which have higher latency characteristics than US or European networks.',
    security_impact: 'Paystack is PCI DSS compliant. Card data is tokenised — never stored on merchant servers. 3D Secure authentication is supported and increasingly required by Nigerian banks. Webhook signatures should be verified using Paystack\'s HMAC-SHA512 verification. Paystack\'s infrastructure is hosted in AWS with data centres in Africa.',
    cost_profile: 'No monthly fees. 1.5% per transaction for Nigerian cards (capped at ₦2,000 per transaction). 3.9% + ₦100 for international cards. No setup fees. Paystack Business accounts require CAC registration. Paystack is free to integrate — costs only apply on successful transactions.',
    when_to_use: 'Nigerian, Ghanaian, South African, Kenyan businesses accepting local card payments. E-commerce and SaaS businesses in African markets. Businesses needing to accept mobile money alongside card payments. Platforms requiring split payments via Paystack\'s subaccounts feature.',
    when_not_to_use: 'Businesses operating exclusively in markets outside Paystack\'s supported countries. Businesses requiring multi-currency settlement in non-African currencies without conversion. High-volume international businesses where Stripe\'s broader coverage is more appropriate.',
    common_alternatives: ['Flutterwave', 'Stripe', 'Interswitch', 'Monnify', 'Squad by GTCo'],
    common_companions: ['React', 'WordPress', 'WooCommerce', 'Google Analytics', 'Cloudflare'],
    maturity_signal: 0.82,
    known_weaknesses: [
      'Limited to African markets — not suitable for global payment processing',
      'Bank verification requirements add friction for some merchant onboarding scenarios',
      'Dispute resolution process can be slow compared to Stripe',
      'International card acceptance fees are higher than domestic',
      'API reliability has historically had occasional downtime during high-traffic periods'
    ],
    real_world_users: ['Piggyvest', 'Cowrywise', 'Flutterwave', 'Printivo', 'Hotels.ng', 'BuyCoins', 'Mono']
  },
  {
    name: 'Flutterwave',
    category: 'Payment',
    performance_impact: 'Flutterwave\'s checkout loads from their CDN with typical response times of 300-600ms for African networks. The FlutterwaveCheckout function renders a modal payment UI without page navigation. Rave.js (the older SDK) has been largely superseded by the v3 inline checkout which is lighter and faster.',
    security_impact: 'Flutterwave is PCI DSS Level 1 compliant. Card data is tokenised and never stored on merchant servers. Transaction verification via Flutterwave\'s verify endpoint should always be performed server-side before fulfilling orders. Webhook payload verification using Flutterwave\'s secret hash prevents replay attacks.',
    cost_profile: 'No monthly fees. 1.4% per transaction for local cards in Nigeria. 3.8% for international Visa and Mastercard. Mobile money fees vary by market. No setup fees. Enterprise pricing available for high-volume merchants.',
    when_to_use: 'Businesses operating across multiple African markets — Flutterwave supports more African countries than Paystack. Platforms needing mobile money support across East and West Africa. Businesses accepting payments from African diaspora internationally. E-commerce platforms needing the widest African payment method coverage.',
    when_not_to_use: 'Businesses operating exclusively in Nigeria where Paystack\'s local optimisation provides advantages. Global businesses where Stripe or Adyen provides better coverage. Businesses requiring real-time payment confirmation — some Flutterwave payment methods have delayed confirmation.',
    common_alternatives: ['Paystack', 'Stripe', 'Interswitch', 'Cellulant', 'DPO Group'],
    common_companions: ['React', 'Google Analytics', 'Cloudflare', 'WordPress', 'WooCommerce'],
    maturity_signal: 0.80,
    known_weaknesses: [
      'Fraud incidents in 2022 raised questions about internal controls — since addressed but trust was affected',
      'Customer support quality inconsistent compared to Stripe',
      'Documentation quality varies across payment methods and markets',
      'Settlement timing varies significantly by country and payment method',
      'Chargeback handling process less sophisticated than international peers'
    ],
    real_world_users: ['Uber Africa', 'Booking.com Africa', 'Flutterwave Store merchants', 'SendStack', 'Mono']
  },
  {
    name: 'Drupal',
    category: 'CMS',
    performance_impact: 'Drupal 9 and 10 with BigPipe technology deliver progressive page rendering — the browser renders the page frame immediately while dynamic content loads. With a full-page caching layer (Varnish or Cloudflare) Drupal can deliver pages in under 100ms. The Views module generates complex database queries that require careful optimisation for performance. Drupal\'s theme layer and render pipeline adds PHP processing overhead compared to static site generators.',
    security_impact: 'Drupal has a dedicated security team that publishes advisories and patches promptly. Drupalgeddon (CVE-2018-7600) demonstrated the severity of Drupal vulnerabilities — a critical RCE vulnerability that required immediate patching. The core update cycle is well-managed. Contributed module quality varies significantly — popular modules are generally safe, obscure modules carry higher risk. Drupal\'s granular permission system enables fine-grained access control.',
    cost_profile: 'Drupal software is free. Hosting on a dedicated server or managed Drupal hosting (Acquia, Pantheon) costs $500-5000/month for enterprise deployments. Acquia Cloud (the enterprise Drupal hosting platform) starts at $1000/month. Development and maintenance costs are typically high — Drupal requires experienced developers for proper implementation.',
    when_to_use: 'Government, education, and non-profit organisations needing WCAG accessibility compliance. Large enterprises managing thousands of pages in multiple languages. Organisations requiring fine-grained content permissions and editorial workflows. Applications where the site is actually a complex web application masquerading as a CMS.',
    when_not_to_use: 'Marketing sites and blogs where WordPress or a headless CMS is simpler. Small businesses without Drupal development expertise. Applications requiring rapid development velocity — Drupal\'s complexity slows development. Projects where the content editing experience is a priority — Drupal\'s default editorial UI is dated.',
    common_alternatives: ['WordPress', 'Contentful', 'Sitecore', 'Adobe Experience Manager', 'Optimizely CMS'],
    common_companions: ['PHP', 'Nginx', 'Apache', 'Cloudflare', 'Google Analytics', 'jQuery'],
    maturity_signal: 0.75,
    known_weaknesses: [
      'Very steep learning curve — Drupal developers are scarce and expensive',
      'Default UI is dated — requires significant theming investment for modern design',
      'Module dependency conflicts during major version upgrades are complex',
      'Performance requires expert configuration — default installation is slow',
      'Drupalgeddon-class vulnerabilities demonstrate the severity of CMS-level security issues'
    ],
    real_world_users: ['White House (whitehouse.gov)', 'NASA', 'Australian Government', 'Harvard University', 'MIT', 'Twitter (former corporate site)', 'NBC Sports']
  },
  {
    name: 'Bootstrap',
    category: 'CSS Framework',
    performance_impact: 'Bootstrap 5 CSS is approximately 30KB gzipped — significantly larger than Tailwind CSS\'s purged production build. Bootstrap\'s JavaScript bundle adds 16KB. Modern Bootstrap with custom builds that include only required components reduces this significantly. Bootstrap\'s grid system uses flexbox in v4 and v5 — performant and well-supported. The pre-built components reduce custom CSS development but contribute to visual homogeneity across Bootstrap sites.',
    security_impact: 'Bootstrap itself has no security implications — it is CSS and minimal JavaScript. Bootstrap\'s JavaScript components use data attributes for configuration — no eval() or dynamic code execution. Dependencies like Popper.js must be kept updated. Bootstrap\'s CDN delivery is reliable but introduces a third-party dependency.',
    cost_profile: 'Bootstrap is free and open source under MIT licence. Bootstrap Icons are free. Bootstrap Themes (official) range from free to $49. Third-party Bootstrap themes from ThemeForest range from $15-50. Bootstrap Studio (visual builder) at $29/year.',
    when_to_use: 'Rapid prototyping where pre-built components accelerate development. Backend developers building admin interfaces without a dedicated frontend developer. Projects where the team is already familiar with Bootstrap\'s conventions. Internal tools where visual uniqueness is not a priority.',
    when_not_to_use: 'Consumer-facing products where Bootstrap\'s recognisable default appearance undermines brand differentiation. Performance-critical applications where the CSS payload matters. Projects using React or Vue where component libraries like Material UI or Chakra UI provide better integration.',
    common_alternatives: ['Tailwind CSS', 'Material UI', 'Bulma', 'Foundation', 'Chakra UI'],
    common_companions: ['jQuery', 'WordPress', 'PHP', 'Google Analytics', 'Font Awesome'],
    maturity_signal: 0.70,
    known_weaknesses: [
      'Sites built with default Bootstrap are visually recognisable — difficult to create unique designs',
      'Larger CSS payload than utility-first alternatives with purging',
      'jQuery dependency in older versions (v3 and below) adds significant JavaScript weight',
      'Increasingly considered legacy in React/Vue ecosystems where component libraries are preferred',
      'Bootstrap\'s JavaScript components require careful accessibility testing'
    ],
    real_world_users: 'Bootstrap is used by approximately 22% of all websites according to W3Techs — the most widely used CSS framework despite declining market share vs Tailwind'
  }
];

// ─── ARCHITECTURE PATTERN PROFILES ───────────────────────────────────────────

const ARCHITECTURE_PATTERNS = [
  {
    pattern_id: 'nextjs_vercel_cloudflare',
    technologies: ['Next.js', 'React', 'Vercel', 'Cloudflare', 'Tailwind CSS'],
    min_match: 3,
    summary: 'This is a production-grade JAMstack SSR stack combining Next.js on Vercel with Cloudflare at the edge. This specific combination is the gold standard for modern React applications requiring both performance and SEO. Static pages are served from Vercel\'s edge network in under 50ms globally, with Cloudflare providing DDoS protection, WAF, and additional caching. Used by companies like Linear, Loom, and Vercel itself — this architecture handles millions of users with minimal infrastructure management.',
    strengths: [
      'Sub-50ms TTFB globally for static pages — industry-leading performance',
      'Automatic preview deployments for every Git branch accelerate team review cycles',
      'Next.js ISR enables content freshness without full rebuilds',
      'Cloudflare WAF filters OWASP Top 10 attacks before they reach the origin',
      'Zero-configuration deployment from Git — no DevOps overhead',
      'Vercel Analytics provides real-time Core Web Vitals per page in production'
    ],
    weaknesses: [
      'Vercel serverless function cold starts add 200-1000ms latency to infrequently accessed dynamic routes',
      'Vendor lock-in to Vercel for optimal Next.js performance — some features degrade on self-hosting',
      'Metered Vercel function pricing can produce unexpected bills at scale',
      'Cloudflare and Vercel caching layers require careful coordination to avoid stale content'
    ],
    maturity_score: 94,
    architecture_type: 'JAMstack SSR',
    real_world_examples: ['Linear', 'Loom', 'Vercel', 'Sonos', 'Tripadvisor'],
    performance_profile: 'Excellent — sub-50ms TTFB for static, 100-400ms for dynamic routes',
    cost_profile: 'Low to medium — Vercel free tier covers small projects, scales to $20-200/month for production',
    scalability_profile: 'Excellent — scales to millions of users without infrastructure changes',
    typical_team_size: '2-50 engineers',
    typical_company_stage: 'Seed to Series C'
  },
  {
    pattern_id: 'react_aws_enterprise',
    technologies: ['React', 'AWS', 'AWS CloudFront', 'Sentry', 'Datadog', 'Segment'],
    min_match: 3,
    summary: 'An enterprise-grade React application deployed on AWS infrastructure with comprehensive observability and analytics. This pattern is characteristic of mature technology organisations managing mission-critical applications. AWS provides infrastructure flexibility and compliance certifications. The combination of Sentry for error tracking, Datadog for infrastructure monitoring, and Segment for analytics reflects a sophisticated engineering culture with full observability across the application and infrastructure stack.',
    strengths: [
      'AWS\'s comprehensive compliance certifications (SOC 2, ISO 27001, HIPAA BAA) satisfy enterprise procurement requirements',
      'CloudFront global CDN with 400+ edge locations delivers excellent performance for international users',
      'Datadog provides unified infrastructure metrics, APM traces, and logs in a single platform',
      'Segment centralises all analytics and data routing — consistent user data across every downstream tool',
      'Full infrastructure control enables custom security configurations impossible on managed platforms'
    ],
    weaknesses: [
      'AWS complexity requires dedicated DevOps or SRE engineers to manage effectively',
      'Infrastructure costs at scale are significantly higher than Vercel or Netlify for equivalent traffic',
      'No zero-configuration deployment — CI/CD pipeline requires custom implementation',
      'Observability stack (Sentry + Datadog + Segment) costs $500-2000/month for a mid-size team'
    ],
    maturity_score: 91,
    architecture_type: 'Enterprise SPA',
    real_world_examples: ['Airbnb', 'Dropbox', 'Twilio', 'Stripe (backend)', 'Atlassian'],
    performance_profile: 'Good to excellent — depends heavily on CloudFront configuration and origin performance',
    cost_profile: 'High — AWS + observability stack typically $2000-10000/month at scale',
    scalability_profile: 'Excellent — AWS scales to any load with proper architecture',
    typical_team_size: '20-500 engineers',
    typical_company_stage: 'Series B to Public'
  },
  {
    pattern_id: 'wordpress_cloudflare_woocommerce',
    technologies: ['WordPress', 'WooCommerce', 'Cloudflare', 'Stripe', 'Google Analytics'],
    min_match: 3,
    summary: 'The most widely deployed e-commerce stack in the world — WordPress with WooCommerce, protected and accelerated by Cloudflare. This combination powers millions of online stores from small boutiques to established brands. Cloudflare is essential in this stack — it compensates for WordPress\'s performance limitations through full-page caching at the edge and protects the wp-admin and xmlrpc.php endpoints from brute force attacks. Stripe provides best-in-class payment processing. The stack\'s primary challenges are performance optimisation and plugin management.',
    strengths: [
      'The largest ecosystem of themes, plugins, and developers in existence — any feature is available',
      'Cloudflare caches WordPress pages at the edge — dramatically improving performance of an inherently slow CMS',
      'WooCommerce\'s flexibility accommodates complex product types, subscriptions, and custom workflows',
      'Low initial cost — WordPress + WooCommerce + Cloudflare free tier costs under $50/month to start',
      'Non-technical users can manage content, products, and orders without developer involvement'
    ],
    weaknesses: [
      'Plugin bloat is the primary performance killer — each plugin adds database queries and JavaScript',
      'WordPress\'s large attack surface requires continuous security maintenance — plugin updates are critical',
      'Database-driven page rendering struggles under high concurrent traffic without aggressive caching',
      'WooCommerce\'s default checkout is slower than Shopify\'s optimised checkout — conversion impact',
      'Scaling beyond moderate traffic requires significant infrastructure investment'
    ],
    maturity_score: 68,
    architecture_type: 'WordPress E-Commerce',
    real_world_examples: ['Numerous SMB e-commerce stores — WooCommerce powers 23% of all online stores'],
    performance_profile: 'Variable — poor without caching, acceptable with Cloudflare full-page caching, good with additional optimisation',
    cost_profile: 'Low to medium — $50-500/month for hosting, plugins, and maintenance',
    scalability_profile: 'Moderate — requires dedicated hosting and caching infrastructure at scale',
    typical_team_size: '1-10 people',
    typical_company_stage: 'Early stage to established SMB'
  },
  {
    pattern_id: 'shopify_klaviyo_facebook',
    technologies: ['Shopify', 'Klaviyo', 'Facebook Pixel', 'Google Analytics', 'Google Tag Manager'],
    min_match: 3,
    summary: 'A Shopify store with a complete direct-to-consumer marketing stack — Klaviyo for email and SMS automation, Facebook Pixel for paid social attribution, and Google Analytics for overall traffic analysis. This is the playbook stack for modern DTC brands. Klaviyo\'s Shopify integration enables purchase-triggered email flows, abandoned cart sequences, and post-purchase automation. The Facebook Pixel feeds the data that optimises Meta advertising campaigns. This combination is responsible for growth at brands like Gymshark, Allbirds, and thousands of DTC success stories.',
    strengths: [
      'Klaviyo\'s Shopify integration is best-in-class — real-time product data enables highly personalised email sequences',
      'Facebook Pixel + Conversions API combination maximises Meta advertising attribution accuracy',
      'Shopify\'s reliable infrastructure handles traffic spikes from marketing campaigns without configuration',
      'Google Tag Manager enables the marketing team to add tracking without engineering support',
      'Complete customer data loop — purchase data flows from Shopify to Klaviyo to Meta automatically'
    ],
    weaknesses: [
      'Klaviyo cost scales with list size — large email lists make Klaviyo expensive relative to alternatives',
      'Facebook Pixel data accuracy has degraded significantly since iOS 14 privacy changes',
      'Multiple tracking scripts add page weight — Google Tag Manager helps but bloat accumulates',
      'Shopify transaction fees apply unless using Shopify Payments (not available in all markets)',
      'Heavy dependence on Meta advertising creates business risk from platform policy changes'
    ],
    maturity_score: 78,
    architecture_type: 'Shopify Commerce',
    real_world_examples: ['Gymshark', 'Allbirds', 'Kylie Cosmetics', 'Fashion Nova', 'MVMT Watches'],
    performance_profile: 'Good — Shopify\'s infrastructure is reliable but app bloat from tracking scripts can impact Core Web Vitals',
    cost_profile: 'Medium to high — Shopify fees + Klaviyo + Meta advertising budget typically $1000-10000/month',
    scalability_profile: 'Good — Shopify handles scale well but checkout customisation requires Shopify Plus at high volumes',
    typical_team_size: '2-20 people',
    typical_company_stage: 'Early stage to growth-stage DTC'
  },
  {
    pattern_id: 'nuxt_netlify_cloudflare',
    technologies: ['Vue.js', 'Nuxt.js', 'Netlify', 'Cloudflare', 'Tailwind CSS'],
    min_match: 3,
    summary: 'A Vue.js JAMstack application built with Nuxt.js and deployed to Netlify with Cloudflare at the edge. The Vue ecosystem\'s answer to the Next.js + Vercel combination. Nuxt 3 with Nitro engine delivers competitive performance characteristics to Next.js with a gentler learning curve. Netlify provides generous build minutes and excellent branch preview deployments. This stack is particularly popular in European development communities and organisations that prefer Vue\'s template-based component model.',
    strengths: [
      'Nuxt 3\'s Nitro engine delivers excellent SSR and static generation performance',
      'Vue\'s template syntax reduces learning curve compared to React\'s JSX',
      'Netlify\'s branch previews and form handling simplify common development needs',
      'Tailwind CSS production builds are tiny — excellent Core Web Vitals scores achievable',
      'Strong TypeScript support in Nuxt 3 improves code quality and developer experience'
    ],
    weaknesses: [
      'Smaller ecosystem than Next.js + React — fewer third-party component libraries',
      'Nuxt 2 to Nuxt 3 migration was disruptive — some teams are still on legacy versions',
      'Less optimised for Netlify than Next.js is for Vercel — some edge features require workarounds',
      'Hiring Vue developers is harder than React developers in most markets'
    ],
    maturity_score: 86,
    architecture_type: 'JAMstack SSR',
    real_world_examples: ['GitLab (marketing)', 'Chess.com', 'Xiaomi', 'Codepen'],
    performance_profile: 'Excellent — comparable to Next.js with proper configuration',
    cost_profile: 'Low — Netlify free tier covers most projects, scales affordably',
    scalability_profile: 'Good — Netlify and Cloudflare scale automatically',
    typical_team_size: '2-30 engineers',
    typical_company_stage: 'Seed to Series B'
  },
  {
    pattern_id: 'django_aws_nginx',
    technologies: ['Django', 'AWS', 'Nginx', 'Cloudflare', 'Sentry'],
    min_match: 3,
    summary: 'A server-rendered Django application deployed on AWS with Nginx as the web server and Cloudflare providing CDN and security. Django\'s batteries-included philosophy — built-in ORM, admin panel, authentication, and form validation — makes it one of the most productive frameworks for data-heavy applications. AWS provides the infrastructure flexibility needed for Django\'s long-running server processes, which are incompatible with serverless platforms. This combination is proven at scale across thousands of production applications.',
    strengths: [
      'Django\'s built-in admin interface provides instant data management without custom development',
      'PostgreSQL on AWS RDS with Django ORM handles complex relational data elegantly',
      'Django\'s security defaults prevent common web vulnerabilities — CSRF, XSS, SQL injection protections are built in',
      'Nginx\'s performance as a reverse proxy and static file server is proven at massive scale',
      'Sentry\'s Django SDK provides deep framework integration for error tracking'
    ],
    weaknesses: [
      'Server-rendered Django pages are slower than statically generated alternatives for content that changes infrequently',
      'Django\'s ORM can generate inefficient queries for complex data relationships without careful optimisation',
      'Python\'s GIL limits concurrency — async views in Django 4+ help but fundamental constraints remain',
      'Deployment complexity is higher than PaaS alternatives like Render or Railway',
      'Django Template Language is less powerful than modern JavaScript frameworks for complex UI interactions'
    ],
    maturity_score: 82,
    architecture_type: 'Django MVC',
    real_world_examples: ['Instagram (original architecture)', 'Disqus', 'Pinterest', 'Mozilla', 'Bitbucket', 'National Geographic'],
    performance_profile: 'Good — with caching and query optimisation; moderate without',
    cost_profile: 'Medium — AWS EC2 or ECS plus RDS typically $200-2000/month depending on scale',
    scalability_profile: 'Good — horizontal scaling via load balancers and read replicas handles significant traffic',
    typical_team_size: '3-50 engineers',
    typical_company_stage: 'Seed to growth stage'
  },
  {
    pattern_id: 'laravel_vue_cloudflare',
    technologies: ['Laravel', 'Vue.js', 'PHP', 'Cloudflare', 'Nginx'],
    min_match: 3,
    summary: 'Laravel with Vue.js frontend and Cloudflare CDN — the full-stack PHP developer\'s modern architecture. Laravel\'s Blade templating handles server-rendered pages while Vue.js components handle interactive UI elements. Laravel Sanctum or Passport manages API authentication for the Vue frontend. This stack is extremely popular in agency and freelance development communities where PHP expertise is abundant and Laravel\'s elegant syntax accelerates development. Cloudflare handles SSL, CDN, and basic DDoS protection.',
    strengths: [
      'Laravel\'s expressive syntax and comprehensive built-in features — queues, events, Eloquent ORM — accelerate development significantly',
      'Inertia.js enables Vue.js components within Laravel without building a separate API — reduces architecture complexity',
      'Large PHP developer talent pool globally — easier and cheaper to hire than for React or Angular',
      'Laravel Forge and Envoyer simplify server management and deployment automation',
      'Cloudflare provides free CDN and SSL reducing infrastructure management overhead'
    ],
    weaknesses: [
      'PHP\'s synchronous execution model handles concurrent connections less efficiently than Node.js or Go',
      'Laravel\'s Eloquent ORM can generate inefficient queries for complex relationships — N+1 query problems are common',
      'Mix (webpack wrapper) is being replaced by Vite — teams on older Laravel versions face migration',
      'Vue.js within Laravel creates an architectural hybrid that can confuse developers unfamiliar with both'
    ],
    maturity_score: 78,
    architecture_type: 'Laravel MVC',
    real_world_examples: ['Laracasts', 'Invoice Ninja', 'Asgard CMS', 'Attendize'],
    performance_profile: 'Good with caching — Laravel\'s response caching and ORM query caching are well-implemented',
    cost_profile: 'Low to medium — shared or VPS hosting $20-200/month, Laravel Forge $19/month',
    scalability_profile: 'Moderate — horizontal scaling requires careful session and cache configuration',
    typical_team_size: '1-20 engineers',
    typical_company_stage: 'Agency projects to established SMBs'
  },
  {
    pattern_id: 'wordpress_standard_cloudflare',
    technologies: ['WordPress', 'PHP', 'jQuery', 'Cloudflare', 'Google Analytics'],
    min_match: 3,
    summary: 'A standard WordPress installation with Cloudflare CDN and Google Analytics — the most common website stack on the internet. This pattern powers 43% of all websites globally. The addition of Cloudflare transforms WordPress\'s typically poor performance into an acceptable user experience by caching full pages at the edge and handling DDoS protection. Google Analytics provides traffic insights without additional cost. This is the go-to stack for small businesses, bloggers, and organisations that need a content-managed website without significant technical investment.',
    strengths: [
      'The most documented, supported, and understood web technology stack in existence',
      'Cloudflare\'s full-page caching delivers fast page loads despite WordPress\'s database-intensive rendering',
      'Thousands of plugins cover virtually any functionality requirement without custom development',
      'Non-technical users can manage all content without developer involvement',
      'Lowest barrier to entry — hosting + domain + WordPress + Cloudflare free tier = live website in hours'
    ],
    weaknesses: [
      'Security maintenance burden is significant — WordPress is the most attacked CMS by volume',
      'Plugin updates can break site functionality — testing is essential before updating production',
      'Database queries multiply with each plugin — performance degrades predictably with plugin count',
      'WordPress\'s architecture is fundamentally not designed for high concurrent traffic',
      'Technical debt accumulates quickly — sites become difficult to maintain without discipline'
    ],
    maturity_score: 58,
    architecture_type: 'WordPress CMS',
    real_world_examples: ['TechCrunch', 'BBC America', 'The Walt Disney Company (blogs)', 'Sony Music'],
    performance_profile: 'Variable — poor without Cloudflare caching, acceptable with it, good with additional optimisation',
    cost_profile: 'Very low — $10-50/month for basic hosting and domain',
    scalability_profile: 'Limited — requires managed WordPress hosting and significant caching infrastructure at scale',
    typical_team_size: '1-5 people',
    typical_company_stage: 'Individual to small business'
  },
  {
    pattern_id: 'astro_cloudflare_tailwind',
    technologies: ['Astro', 'Cloudflare', 'Tailwind CSS', 'Google Analytics'],
    min_match: 2,
    summary: 'An Astro site deployed to Cloudflare Pages with Tailwind CSS — the highest-performance content site architecture currently available. Astro ships zero JavaScript by default, Cloudflare Pages serves from 300+ global edge locations, and Tailwind\'s purged CSS is typically under 10KB. This combination achieves perfect or near-perfect Lighthouse scores routinely. Used by forward-thinking engineering teams at major companies for documentation sites, marketing pages, and developer blogs where Core Web Vitals directly impact search ranking and developer trust.',
    strengths: [
      'Zero JavaScript by default — fastest possible page loads for content-focused sites',
      'Cloudflare Pages free tier provides enterprise-grade global CDN at no cost',
      'Tailwind\'s purged CSS is typically 5-15KB — negligible CSS payload',
      'Astro\'s island architecture allows selective hydration of interactive components',
      'Lighthouse scores of 95-100 are routine — significant SEO and UX benefit'
    ],
    weaknesses: [
      'Not appropriate for highly interactive applications — React or Vue is more suitable',
      'Astro ecosystem is younger than Next.js — fewer tutorials and community resources',
      'Content Collections require upfront content structure planning',
      'Limited server-side logic without Astro SSR configuration'
    ],
    maturity_score: 88,
    architecture_type: 'JAMstack Static',
    real_world_examples: ['Google (several docs sites)', 'Microsoft (some docs)', 'Rolex', 'Porsche', 'NordVPN marketing'],
    performance_profile: 'Best in class — Lighthouse 95-100 routinely achievable',
    cost_profile: 'Very low — Cloudflare Pages free tier covers almost all use cases',
    scalability_profile: 'Excellent — static files scale infinitely on CDN',
    typical_team_size: '1-20 engineers',
    typical_company_stage: 'Any stage — content and marketing sites'
  },
  {
    pattern_id: 'react_firebase_stripe',
    technologies: ['React', 'Firebase', 'Stripe', 'Google Analytics'],
    min_match: 3,
    summary: 'A React SPA with Firebase backend and Stripe payments — the classic startup stack for rapidly building and launching a SaaS product. Firebase eliminates backend infrastructure — authentication, database, file storage, and real-time subscriptions are available without managing servers. Stripe handles payment processing. This combination enables a solo developer or small team to launch a monetised product in days rather than months. The trade-offs are Firebase vendor lock-in, NoSQL data model limitations, and Stripe transaction fees.',
    strengths: [
      'Firebase eliminates backend server management entirely — database, auth, and storage in one SDK',
      'Real-time data synchronisation via Firestore enables collaborative features without custom WebSocket code',
      'Stripe Billing handles subscription management, invoicing, and dunning automatically',
      'Firebase free tier plus Stripe zero-monthly-fee model means zero fixed cost for pre-revenue products',
      'Time to launch is dramatically faster than architectures requiring custom backend development'
    ],
    weaknesses: [
      'Firebase vendor lock-in is severe — migrating the data model to another database is extremely painful',
      'Firestore NoSQL model struggles with relational data — complex queries require denormalisation',
      'Firebase Security Rules bugs can expose all user data publicly — a critical security risk',
      'Cloud Function cold starts add significant latency for payment webhook handling',
      'Firebase costs can increase unexpectedly as Firestore read volumes grow'
    ],
    maturity_score: 74,
    architecture_type: 'SPA Firebase',
    real_world_examples: ['Numerous early-stage SaaS products — Firebase is particularly popular for MVPs'],
    performance_profile: 'Variable — React SPA has initial load penalty, Firebase queries are fast for simple access patterns',
    cost_profile: 'Low initially — Firebase free tier + Stripe no monthly fee, scales with usage',
    scalability_profile: 'Good for reads, expensive for high write volumes on Firestore',
    typical_team_size: '1-5 engineers',
    typical_company_stage: 'Idea to early revenue'
  }
];

// ─── INDUSTRY BENCHMARKS ─────────────────────────────────────────────────────

const INDUSTRY_BENCHMARKS = [
  {
    industry: 'SaaS',
    top_technologies: [
      { name: 'React', frequency: 0.78 },
      { name: 'Cloudflare', frequency: 0.72 },
      { name: 'Google Analytics', frequency: 0.68 },
      { name: 'Stripe', frequency: 0.65 },
      { name: 'Intercom', frequency: 0.58 },
      { name: 'Sentry', frequency: 0.62 },
      { name: 'Google Tag Manager', frequency: 0.60 },
      { name: 'Next.js', frequency: 0.55 },
      { name: 'Segment', frequency: 0.45 },
      { name: 'HubSpot', frequency: 0.42 }
    ],
    average_maturity_score: 78,
    common_weaknesses: [
      'Content Security Policy absent in 58% of SaaS products analysed',
      'Referrer-Policy header missing in 64% of SaaS products',
      'No structured data markup found in 71% of SaaS marketing pages',
      'Permissions-Policy header absent in 78% of SaaS products'
    ],
    rising_technologies: ['Astro', 'Supabase', 'PostHog', 'Vercel', 'Tailwind CSS'],
    declining_technologies: ['jQuery', 'Bootstrap', 'Heroku', 'Angular', 'Google Universal Analytics'],
    typical_stack: ['React', 'Next.js', 'Tailwind CSS', 'Vercel', 'Cloudflare', 'Stripe', 'Sentry', 'Intercom'],
    security_baseline: 'SaaS products average a risk score of 0.35 — better than most industries but significant security header gaps remain common',
    performance_baseline: 'Average TTFB of 380ms — SaaS products prioritise feature velocity over performance optimisation in early stages',
    seo_baseline: 'Marketing pages average SEO score of 62/100 — strong on basics but weak on structured data and social sharing metadata',
    notable_companies: ['Stripe', 'Notion', 'Linear', 'Figma', 'Airtable', 'Slack', 'Intercom', 'HubSpot']
  },
  {
    industry: 'E-Commerce',
    top_technologies: [
      { name: 'Shopify', frequency: 0.45 },
      { name: 'Cloudflare', frequency: 0.82 },
      { name: 'Google Analytics', frequency: 0.88 },
      { name: 'Google Tag Manager', frequency: 0.80 },
      { name: 'Facebook Pixel', frequency: 0.74 },
      { name: 'WooCommerce', frequency: 0.30 },
      { name: 'Stripe', frequency: 0.60 },
      { name: 'Klaviyo', frequency: 0.42 },
      { name: 'Hotjar', frequency: 0.38 },
      { name: 'PayPal', frequency: 0.55 }
    ],
    average_maturity_score: 65,
    common_weaknesses: [
      'Content Security Policy absent in 72% of e-commerce sites — particularly risky for payment page security',
      'No structured data product markup in 45% of product pages — missing rich snippets in Google Shopping',
      'Images missing alt text in 68% of product catalogues — accessibility and SEO impact',
      'No Brotli or Gzip compression on 28% of e-commerce sites — slow product image loading'
    ],
    rising_technologies: ['Shopify', 'Klaviyo', 'Headless commerce patterns', 'Algolia', 'TikTok Pixel'],
    declining_technologies: ['Magento 1', 'OpenCart', 'osCommerce', 'Universal Analytics', 'Flash-based product viewers'],
    typical_stack: ['Shopify', 'Cloudflare', 'Google Analytics', 'Google Tag Manager', 'Facebook Pixel', 'Klaviyo', 'Stripe'],
    security_baseline: 'E-commerce sites average a risk score of 0.42 — checkout pages often lack CSP making them targets for card skimming malware',
    performance_baseline: 'Average TTFB of 620ms — product image weight and app bloat are the primary performance bottlenecks',
    seo_baseline: 'Product pages average SEO score of 58/100 — strong on titles and descriptions, weak on structured data and canonical URL management',
    notable_companies: ['Gymshark', 'Allbirds', 'Kylie Cosmetics', 'Heinz', 'Red Bull Shop', 'Staples']
  },
  {
    industry: 'Enterprise',
    top_technologies: [
      { name: 'React', frequency: 0.65 },
      { name: 'Angular', frequency: 0.48 },
      { name: 'AWS', frequency: 0.72 },
      { name: 'Azure', frequency: 0.55 },
      { name: 'Cloudflare', frequency: 0.60 },
      { name: 'Akamai', frequency: 0.35 },
      { name: 'Google Analytics', frequency: 0.70 },
      { name: 'Datadog', frequency: 0.45 },
      { name: 'New Relic', frequency: 0.38 },
      { name: 'Sentry', frequency: 0.52 }
    ],
    average_maturity_score: 85,
    common_weaknesses: [
      'Legacy JavaScript libraries (jQuery, Prototype) present in 38% of enterprise sites alongside modern frameworks',
      'Inconsistent security header implementation across different product areas in 52% of enterprises',
      'Missing Permissions-Policy header in 70% of enterprise applications',
      'Slow server response times (>800ms) on 32% of enterprise applications due to legacy backend systems'
    ],
    rising_technologies: ['React', 'Next.js', 'Kubernetes', 'Cloudflare', 'Segment', 'Datadog'],
    declining_technologies: ['Angular.js (v1)', 'jQuery', 'Internet Explorer compatibility layers', 'Flash', 'Silverlight'],
    typical_stack: ['React', 'AWS', 'Cloudflare', 'Datadog', 'Sentry', 'Segment', 'Google Tag Manager'],
    security_baseline: 'Enterprise applications average a risk score of 0.22 — significantly better than other industries, driven by dedicated security teams',
    performance_baseline: 'Average TTFB of 450ms — enterprise infrastructure is reliable but legacy backend systems add latency',
    seo_baseline: 'Enterprise marketing sites average SEO score of 74/100 — dedicated SEO teams produce consistently strong implementation',
    notable_companies: ['Microsoft', 'IBM', 'Salesforce', 'Oracle', 'SAP', 'Workday', 'ServiceNow']
  },
  {
    industry: 'Media',
    top_technologies: [
      { name: 'WordPress', frequency: 0.55 },
      { name: 'React', frequency: 0.40 },
      { name: 'Cloudflare', frequency: 0.78 },
      { name: 'Fastly', frequency: 0.22 },
      { name: 'Google Analytics', frequency: 0.90 },
      { name: 'Google Tag Manager', frequency: 0.85 },
      { name: 'Facebook Pixel', frequency: 0.68 },
      { name: 'YouTube', frequency: 0.72 },
      { name: 'Vimeo', frequency: 0.38 },
      { name: 'Hotjar', frequency: 0.42 }
    ],
    average_maturity_score: 62,
    common_weaknesses: [
      'Content Security Policy absent in 80% of media sites — high risk given third-party advertising scripts',
      'Third-party advertising and analytics scripts dramatically increase page weight — average page load 4-8 seconds',
      'Missing structured data article markup in 48% of media articles — missing Google News rich results',
      'No Brotli compression on 45% of media sites despite high page view volumes'
    ],
    rising_technologies: ['Astro', 'Next.js', 'Cloudflare', 'Consent management platforms'],
    declining_technologies: ['Flash video', 'Silverlight', 'Windows Media Player embeds', 'Adobe Animate'],
    typical_stack: ['WordPress', 'Cloudflare', 'Google Analytics', 'Google Tag Manager', 'YouTube', 'Facebook Pixel'],
    security_baseline: 'Media sites average a risk score of 0.55 — one of the worst performing industries due to third-party script proliferation',
    performance_baseline: 'Average TTFB of 850ms — advertising scripts and analytics tags dramatically inflate page weight',
    seo_baseline: 'News sites average SEO score of 68/100 — strong on title and description, weak on structured article markup',
    notable_companies: ['The Guardian', 'BBC', 'CNN', 'The New York Times', 'BuzzFeed', 'Vice', 'Vox']
  },
  {
    industry: 'Agency',
    top_technologies: [
      { name: 'WordPress', frequency: 0.62 },
      { name: 'Webflow', frequency: 0.28 },
      { name: 'Cloudflare', frequency: 0.65 },
      { name: 'Google Analytics', frequency: 0.82 },
      { name: 'Google Tag Manager', frequency: 0.75 },
      { name: 'Bootstrap', frequency: 0.45 },
      { name: 'jQuery', frequency: 0.55 },
      { name: 'Laravel', frequency: 0.22 },
      { name: 'HubSpot', frequency: 0.38 },
      { name: 'Hotjar', frequency: 0.40 }
    ],
    average_maturity_score: 58,
    common_weaknesses: [
      'Security headers absent on 75% of agency-built sites — not typically included in project scope',
      'No structured data on 68% of agency sites — SEO afterthought in most agency projects',
      'Performance optimisation missing from 60% of agency deliverables — launched but not optimised',
      'Multiple conflicting JavaScript libraries on 42% of agency sites — jQuery alongside React is common'
    ],
    rising_technologies: ['Webflow', 'Astro', 'Tailwind CSS', 'Cloudflare', 'Framer'],
    declining_technologies: ['Flash', 'jQuery UI', 'Bootstrap 3', 'PHP 5', 'MySQL without ORM'],
    typical_stack: ['WordPress', 'Cloudflare', 'Google Analytics', 'Google Tag Manager', 'Bootstrap', 'jQuery'],
    security_baseline: 'Agency sites average a risk score of 0.62 — security is rarely included in standard agency deliverables',
    performance_baseline: 'Average TTFB of 920ms — agency sites often on shared hosting without performance optimisation',
    seo_baseline: 'Agency sites average SEO score of 54/100 — basic SEO often included but structured data and technical SEO less common',
    notable_companies: 'Agency sites are typically built for SMB clients — notable agencies include AKQA, Huge, Razorfish'
  },
  {
    industry: 'SMB',
    top_technologies: [
      { name: 'WordPress', frequency: 0.55 },
      { name: 'Squarespace', frequency: 0.18 },
      { name: 'Wix', frequency: 0.15 },
      { name: 'Cloudflare', frequency: 0.50 },
      { name: 'Google Analytics', frequency: 0.72 },
      { name: 'Google Fonts', frequency: 0.68 },
      { name: 'jQuery', frequency: 0.58 },
      { name: 'Bootstrap', frequency: 0.42 },
      { name: 'Google Maps', frequency: 0.48 },
      { name: 'reCAPTCHA', frequency: 0.38 }
    ],
    average_maturity_score: 48,
    common_weaknesses: [
      'Security headers absent on 85% of SMB sites',
      'No HTTPS on 12% of SMB sites — decreasing but still significant',
      'No mobile viewport meta tag on 22% of SMB sites',
      'No meta description on 38% of SMB sites',
      'Images not optimised for web on 65% of SMB sites — significant performance impact'
    ],
    rising_technologies: ['Squarespace', 'Wix', 'Webflow', 'Cloudflare', 'Google Business Profile integration'],
    declining_technologies: ['Flash', 'Table-based layouts', 'iframe-embedded content', 'Macromedia Dreamweaver output'],
    typical_stack: ['WordPress', 'Cloudflare', 'Google Analytics', 'Google Fonts', 'jQuery', 'Bootstrap'],
    security_baseline: 'SMB sites average a risk score of 0.72 — lowest security implementation of all industries',
    performance_baseline: 'Average TTFB of 1200ms — shared hosting without caching is the primary cause',
    seo_baseline: 'SMB sites average SEO score of 42/100 — basic title and description implementation, weak on everything else',
    notable_companies: 'SMB segment covers millions of local businesses, restaurants, professional services, and retail shops'
  },
  {
    industry: 'Fintech',
    top_technologies: [
      { name: 'React', frequency: 0.75 },
      { name: 'AWS', frequency: 0.78 },
      { name: 'Cloudflare', frequency: 0.68 },
      { name: 'Stripe', frequency: 0.55 },
      { name: 'Sentry', frequency: 0.65 },
      { name: 'Datadog', frequency: 0.52 },
      { name: 'Segment', frequency: 0.48 },
      { name: 'reCAPTCHA', frequency: 0.58 },
      { name: 'Google Analytics', frequency: 0.60 },
      { name: 'Intercom', frequency: 0.45 }
    ],
    average_maturity_score: 88,
    common_weaknesses: [
      'Content Security Policy present but weakened by unsafe-inline in 45% of fintech sites',
      'Missing Permissions-Policy header in 65% of fintech applications',
      'Third-party analytics scripts create GDPR compliance complexity in 55% of fintech products',
      'Slow checkout flows (>3 clicks to complete) on 38% of payment products'
    ],
    rising_technologies: ['Plaid', 'Stripe', 'React', 'Next.js', 'Cloudflare Workers', 'Supabase'],
    declining_technologies: ['Flash-based trading platforms', 'Java applets', 'Silverlight', 'Legacy payment gateways'],
    typical_stack: ['React', 'AWS', 'Cloudflare', 'Stripe', 'Sentry', 'Datadog', 'reCAPTCHA'],
    security_baseline: 'Fintech sites average a risk score of 0.18 — second only to Enterprise in security header implementation',
    performance_baseline: 'Average TTFB of 320ms — fintech products prioritise reliability and performance',
    seo_baseline: 'Fintech marketing sites average SEO score of 72/100 — well-resourced marketing teams produce strong SEO',
    notable_companies: ['Stripe', 'Wise', 'Monzo', 'Revolut', 'Robinhood', 'Coinbase', 'Plaid', 'Square']
  },
  {
    industry: 'Government',
    top_technologies: [
      { name: 'Drupal', frequency: 0.42 },
      { name: 'WordPress', frequency: 0.38 },
      { name: 'jQuery', frequency: 0.72 },
      { name: 'Bootstrap', frequency: 0.58 },
      { name: 'Google Analytics', frequency: 0.65 },
      { name: 'Cloudflare', frequency: 0.45 },
      { name: 'Apache', frequency: 0.55 },
      { name: 'Nginx', frequency: 0.35 }
    ],
    average_maturity_score: 55,
    common_weaknesses: [
      'Outdated jQuery versions (1.x or 2.x) on 48% of government sites — security vulnerabilities',
      'No structured data on 82% of government sites — missing enhanced search results',
      'Missing HSTS header on 42% of government sites despite HTTPS being present',
      'Accessibility (WCAG) compliance issues on 65% of government sites despite legal requirements',
      'Very slow page loads (>3 seconds) on 38% of government sites — legacy infrastructure'
    ],
    rising_technologies: ['Drupal 10', 'Cloudflare', 'Accessibility testing tools', 'Design system frameworks'],
    declining_technologies: ['Internet Explorer compatibility layers', 'Flash', 'PHP 5', 'Table-based layouts', 'Outdated jQuery'],
    typical_stack: ['Drupal', 'Apache', 'jQuery', 'Bootstrap', 'Google Analytics', 'Cloudflare'],
    security_baseline: 'Government sites average a risk score of 0.45 — HSTS and XFO are common but CSP is frequently absent',
    performance_baseline: 'Average TTFB of 1100ms — legacy infrastructure and lack of CDN adoption causes slow response times',
    seo_baseline: 'Government sites average SEO score of 48/100 — basic meta tags present but structured data adoption is very low',
    notable_companies: ['USA.gov', 'GOV.UK', 'Australia.gov.au', 'Canada.ca', 'NASA.gov', 'CDC.gov']
  },
  {
    industry: 'Healthcare',
    top_technologies: [
      { name: 'React', frequency: 0.55 },
      { name: 'WordPress', frequency: 0.40 },
      { name: 'AWS', frequency: 0.65 },
      { name: 'Cloudflare', frequency: 0.58 },
      { name: 'Google Analytics', frequency: 0.62 },
      { name: 'reCAPTCHA', frequency: 0.52 },
      { name: 'Azure', frequency: 0.35 },
      { name: 'HubSpot', frequency: 0.38 }
    ],
    average_maturity_score: 72,
    common_weaknesses: [
      'Google Analytics usage on 62% of healthcare sites creates HIPAA compliance complexity',
      'Missing Content Security Policy on 68% of healthcare sites — high risk given patient data',
      'Third-party scripts on patient portal pages create BAA compliance requirements often overlooked',
      'No cookie consent management on 35% of healthcare sites — GDPR and CCPA risk'
    ],
    rising_technologies: ['React', 'FHIR-compatible APIs', 'Cloudflare', 'Privacy-focused analytics (Plausible, Fathom)'],
    declining_technologies: ['Flash-based medical viewers', 'Legacy EHR web portals', 'Internet Explorer requirement'],
    typical_stack: ['React', 'AWS', 'Cloudflare', 'Google Analytics', 'reCAPTCHA', 'HubSpot'],
    security_baseline: 'Healthcare sites average a risk score of 0.28 — HIPAA compliance drives stronger security implementation than average',
    performance_baseline: 'Average TTFB of 480ms — healthcare organisations invest in reliable infrastructure',
    seo_baseline: 'Healthcare sites average SEO score of 65/100 — medical content SEO is well-resourced but technical implementation varies',
    notable_companies: ['Mayo Clinic', 'WebMD', 'Healthline', 'ZocDoc', 'Oscar Health', 'Hims & Hers']
  },
  {
    industry: 'Education',
    top_technologies: [
      { name: 'WordPress', frequency: 0.48 },
      { name: 'React', frequency: 0.42 },
      { name: 'Cloudflare', frequency: 0.55 },
      { name: 'Google Analytics', frequency: 0.75 },
      { name: 'Google Tag Manager', frequency: 0.65 },
      { name: 'YouTube', frequency: 0.78 },
      { name: 'Google Fonts', frequency: 0.68 },
      { name: 'reCAPTCHA', frequency: 0.45 }
    ],
    average_maturity_score: 62,
    common_weaknesses: [
      'WCAG accessibility compliance issues on 58% of educational sites — legal and ethical requirement',
      'No structured data course markup on 72% of online learning platforms — missing rich snippets',
      'Missing video structured data on 65% of sites with YouTube content',
      'Cookie consent absent on 42% of education sites collecting student data'
    ],
    rising_technologies: ['React', 'Video learning platforms', 'Cloudflare', 'Accessibility tools', 'LMS integrations'],
    declining_technologies: ['Flash course players', 'Java applet simulations', 'Silverlight video'],
    typical_stack: ['WordPress', 'Cloudflare', 'Google Analytics', 'YouTube', 'Google Fonts', 'reCAPTCHA'],
    security_baseline: 'Education sites average a risk score of 0.45 — FERPA compliance drives some security implementation but gaps remain',
    performance_baseline: 'Average TTFB of 720ms — educational institutions often on legacy infrastructure',
    seo_baseline: 'Education sites average SEO score of 58/100 — course and program pages often lack structured data',
    notable_companies: ['Coursera', 'Udemy', 'Khan Academy', 'edX', 'Duolingo', 'Harvard Extension School']
  },
  {
    industry: 'Personal',
    top_technologies: [
      { name: 'GitHub Pages', frequency: 0.35 },
      { name: 'Netlify', frequency: 0.32 },
      { name: 'Cloudflare', frequency: 0.45 },
      { name: 'Google Analytics', frequency: 0.55 },
      { name: 'Google Fonts', frequency: 0.72 },
      { name: 'Tailwind CSS', frequency: 0.38 },
      { name: 'Bootstrap', frequency: 0.40 },
      { name: 'Astro', frequency: 0.18 }
    ],
    average_maturity_score: 45,
    common_weaknesses: [
      'No meta description on 52% of personal sites',
      'No Open Graph tags on 68% of personal sites',
      'No HTTPS on 18% of personal sites still on HTTP',
      'Missing structured data on 88% of personal sites'
    ],
    rising_technologies: ['Astro', 'Tailwind CSS', 'Netlify', 'GitHub Pages', 'Cloudflare Pages'],
    declining_technologies: ['Adobe Dreamweaver output', 'Table-based layouts', 'Comic Sans', 'GeoCities-era design patterns'],
    typical_stack: ['GitHub Pages or Netlify', 'Cloudflare', 'Google Analytics', 'Google Fonts', 'Bootstrap or Tailwind'],
    security_baseline: 'Personal sites average a risk score of 0.65 — security headers rarely implemented on personal projects',
    performance_baseline: 'Average TTFB of 580ms — free hosting tiers are reliable but not optimised',
    seo_baseline: 'Personal sites average SEO score of 38/100 — basic implementation only',
    notable_companies: 'Personal sites — developer portfolios, personal blogs, hobby projects'
  }
];

// ─── SEED FUNCTIONS ───────────────────────────────────────────────────────────

async function seedTechIntelligence() {
  console.log(`\nSeeding ${TECH_INTELLIGENCE.length} technology intelligence profiles...`);

  let inserted = 0;
  let failed = 0;

  for (const profile of TECH_INTELLIGENCE) {
    try {
      const { error } = await supabase
        .from('tech_intelligence')
        .upsert(profile, { onConflict: 'name' });

      if (error) {
        console.error(`Failed to upsert tech intelligence for "${profile.name}": ${error.message}`);
        failed++;
      } else {
        console.log(`✓ Tech intelligence: ${profile.name} (${profile.category})`);
        inserted++;
      }
    } catch (err) {
      console.error(`Error processing "${profile.name}": ${err.message}`);
      failed++;
    }
  }

  console.log(`Tech intelligence complete — ✓ ${inserted} inserted, ✗ ${failed} failed`);
}

async function seedArchitecturePatterns() {
  console.log(`\nSeeding ${ARCHITECTURE_PATTERNS.length} architecture pattern profiles...`);

  let inserted = 0;
  let failed = 0;

  for (const pattern of ARCHITECTURE_PATTERNS) {
    try {
      const { error } = await supabase
        .from('architecture_patterns')
        .upsert(pattern, { onConflict: 'pattern_id' });

      if (error) {
        console.error(`Failed to upsert pattern "${pattern.pattern_id}": ${error.message}`);
        failed++;
      } else {
        console.log(`✓ Architecture pattern: ${pattern.pattern_id} (${pattern.architecture_type})`);
        inserted++;
      }
    } catch (err) {
      console.error(`Error processing pattern "${pattern.pattern_id}": ${err.message}`);
      failed++;
    }
  }

  console.log(`Architecture patterns complete — ✓ ${inserted} inserted, ✗ ${failed} failed`);
}

async function seedIndustryBenchmarks() {
  console.log(`\nSeeding ${INDUSTRY_BENCHMARKS.length} industry benchmark profiles...`);

  let inserted = 0;
  let failed = 0;

  for (const benchmark of INDUSTRY_BENCHMARKS) {
    try {
      const { error } = await supabase
        .from('industry_benchmarks')
        .upsert(benchmark, { onConflict: 'industry' });

      if (error) {
        console.error(`Failed to upsert benchmark for "${benchmark.industry}": ${error.message}`);
        failed++;
      } else {
        console.log(`✓ Industry benchmark: ${benchmark.industry} (avg maturity: ${benchmark.average_maturity_score})`);
        inserted++;
      }
    } catch (err) {
      console.error(`Error processing benchmark "${benchmark.industry}": ${err.message}`);
      failed++;
    }
  }

  console.log(`Industry benchmarks complete — ✓ ${inserted} inserted, ✗ ${failed} failed`);
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  EIGE v10 — Intelligence Knowledge Base Seed Script');
  console.log('═══════════════════════════════════════════════════════');

  await seedTechIntelligence();
  await seedArchitecturePatterns();
  await seedIndustryBenchmarks();

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Intelligence knowledge base seeded successfully');
  console.log('  EIGE v10 intelligence engine is ready');
  console.log('═══════════════════════════════════════════════════════\n');

  process.exit(0);
}

main().catch((err) => {
  console.error('Intelligence seed failed:', err.message);
  process.exit(1);
});
