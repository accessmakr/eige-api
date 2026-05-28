'use strict';

// ─── STARTUP AUTO-SEED ────────────────────────────────────────────────────────
// Runs once during server startup. Checks every seeded table and seeds
// it if empty. Safe to run on every boot — if tables have data it skips
// silently with zero overhead.
//
// Tables seeded by this module:
//   tech_patterns        — 47 technology fingerprint patterns
//   clusters             — 16 ecosystem archetypes
//   co_occurrence        — 50 technology co-occurrence pairs
//   tech_intelligence    — 25 technology knowledge base profiles
//   architecture_patterns — 10 architecture combination profiles
//   industry_benchmarks  — 11 industry benchmark profiles

const supabase = require('../db/supabase');
const logger = require('../utils/logger');

// ─── TECH PATTERNS ───────────────────────────────────────────────────────────

const PATTERNS = [
  {
    name: 'React',
    category: 'JavaScript Framework',
    html_patterns: ['__NEXT_DATA__','data-reactroot','data-reactid','react-root','_reactFiber','ReactDOM','__react_','react-app','__REACT_DEVTOOLS_GLOBAL_HOOK__','react-dom'],
    header_patterns: ['x-powered-by: react','x-nextjs'],
    script_patterns: ['react\\.min\\.js','react\\.production\\.min\\.js','react-dom','\\/react@','unpkg\\.com/react','cdn\\.jsdelivr\\.net/npm/react','react\\.development\\.js'],
    url_patterns: [],
    version_patterns: ['react@([\\d.]+)','\"react\":\"([\\d.]+)\"','react\\/([\\d.]+)\\/react'],
    html_weight: 0.4, header_weight: 0.4, script_weight: 0.35, min_confidence: 0.40
  },
  {
    name: 'Next.js',
    category: 'JavaScript Framework',
    html_patterns: ['__NEXT_DATA__','__NEXT_LOADED_PAGES__','_next/static','_next/chunks','__nextjs','next/dist','__NEXT_P','next-route-announcer','__NEXT_ROUTER_BASEPATH'],
    header_patterns: ['x-powered-by: next\\.js','x-nextjs-cache','x-nextjs-page','x-next-cache'],
    script_patterns: ['_next/static/chunks','_next/static/runtime','next/dist/client'],
    url_patterns: [],
    version_patterns: ['\"next\":\"([\\d.]+)\"','next\\/([\\d.]+)\\/'],
    html_weight: 0.45, header_weight: 0.45, script_weight: 0.40, min_confidence: 0.45
  },
  {
    name: 'Vue.js',
    category: 'JavaScript Framework',
    html_patterns: ['data-v-','__vue__','vue-router','__VUE__','v-cloak','nuxt-link','__NUXT__','vue\\.runtime','__VUE_OPTIONS_API__','__VUE_PROD_DEVTOOLS__'],
    header_patterns: ['x-powered-by: nuxt'],
    script_patterns: ['vue\\.min\\.js','vue\\.runtime\\.min\\.js','\\/vue@','cdn\\.jsdelivr\\.net/npm/vue','unpkg\\.com/vue','vue\\.global\\.prod\\.js'],
    url_patterns: [],
    version_patterns: ['vue@([\\d.]+)','\"vue\":\"([\\d.]+)\"','Vue\\.version=\"([\\d.]+)\"'],
    html_weight: 0.40, header_weight: 0.30, script_weight: 0.35, min_confidence: 0.38
  },
  {
    name: 'Angular',
    category: 'JavaScript Framework',
    html_patterns: ['ng-version','ng-app','ng-controller','ng-model','ng-repeat','_nghost','_ngcontent','ng-if','ng-class','angular\\.js','angular\\.min\\.js','ng-reflect-','ng-star-inserted'],
    header_patterns: [],
    script_patterns: ['angular\\.min\\.js','angular\\.js','\\/angular@','zone\\.js','main\\.js','polyfills\\.js','runtime\\.js'],
    url_patterns: [],
    version_patterns: ['ng-version=\"([\\d.]+)\"','angular@([\\d.]+)','\"@angular/core\":\"([\\d.]+)\"'],
    html_weight: 0.45, header_weight: 0.20, script_weight: 0.35, min_confidence: 0.40
  },
  {
    name: 'Svelte',
    category: 'JavaScript Framework',
    html_patterns: ['svelte-','__svelte','svelte/internal','SvelteComponent','svelte-kit','data-svelte-h','svelte-announcer'],
    header_patterns: [],
    script_patterns: ['svelte\\.js','svelte/internal','\\/svelte@','_app/immutable','svelte-kit'],
    url_patterns: ['_app/immutable'],
    version_patterns: ['svelte@([\\d.]+)','\"svelte\":\"([\\d.]+)\"'],
    html_weight: 0.40, header_weight: 0.20, script_weight: 0.35, min_confidence: 0.38
  },
  {
    name: 'Nuxt.js',
    category: 'JavaScript Framework',
    html_patterns: ['__NUXT__','nuxt-link','nuxtjs','_nuxt/','nuxt/dist','__nuxt','nuxt-island','__NUXT_DATA__'],
    header_patterns: ['x-powered-by: nuxt'],
    script_patterns: ['_nuxt/runtime','_nuxt/entry','nuxt/dist/app','_nuxt/builds'],
    url_patterns: ['_nuxt/'],
    version_patterns: ['\"nuxt\":\"([\\d.]+)\"','nuxt@([\\d.]+)'],
    html_weight: 0.45, header_weight: 0.35, script_weight: 0.40, min_confidence: 0.42
  },
  {
    name: 'Astro',
    category: 'JavaScript Framework',
    html_patterns: ['astro-island','astro-slot','data-astro-','astro:load','astro:idle','astro:visible','astro:only','astro:media'],
    header_patterns: ['x-powered-by: astro'],
    script_patterns: ['\\/astro\\/','astro/client','@astrojs'],
    url_patterns: [],
    version_patterns: ['\"astro\":\"([\\d.]+)\"'],
    html_weight: 0.50, header_weight: 0.30, script_weight: 0.30, min_confidence: 0.40
  },
  {
    name: 'Remix',
    category: 'JavaScript Framework',
    html_patterns: ['__remixContext','__remixRouteModules','__remixManifest','data-remix-','remix-island','__remix_island'],
    header_patterns: [],
    script_patterns: ['\\/build\\/root-','entry\\.client','@remix-run','remix\\.config'],
    url_patterns: [],
    version_patterns: ['\"@remix-run/react\":\"([\\d.]+)\"'],
    html_weight: 0.50, header_weight: 0.20, script_weight: 0.35, min_confidence: 0.42
  },
  {
    name: 'jQuery',
    category: 'JavaScript Library',
    html_patterns: ['jquery','\\$\\.fn\\.jquery','jQuery\\.fn\\.jquery','jQuery\\(','\\$(document)\\.ready'],
    header_patterns: [],
    script_patterns: ['jquery\\.min\\.js','jquery\\.js','jquery-[\\d.]+\\.min\\.js','code\\.jquery\\.com','ajax\\.googleapis\\.com/ajax/libs/jquery'],
    url_patterns: [],
    version_patterns: ['jQuery v([\\d.]+)','jquery@([\\d.]+)','jquery\\/([\\d.]+)\\/'],
    html_weight: 0.40, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.35
  },
  {
    name: 'Alpine.js',
    category: 'JavaScript Framework',
    html_patterns: ['x-data','x-bind','x-on:','x-show','x-if','x-for','x-model','x-text','x-html','x-ref','x-cloak','alpine'],
    header_patterns: [],
    script_patterns: ['alpinejs','alpine\\.js','cdn\\.jsdelivr\\.net/npm/alpinejs','unpkg\\.com/alpinejs'],
    url_patterns: [],
    version_patterns: ['alpinejs@([\\d.]+)','\"alpinejs\":\"([\\d.]+)\"'],
    html_weight: 0.55, header_weight: 0.10, script_weight: 0.40, min_confidence: 0.40
  },
  {
    name: 'WordPress',
    category: 'CMS',
    html_patterns: ['wp-content','wp-includes','wp-json','wp-block','wordpress','wp-embed','wp-emoji','xmlrpc\\.php','wp-login\\.php','woocommerce','wp-settings','wp-admin'],
    header_patterns: ['x-powered-by: wp','x-pingback','link:.*wp-json'],
    script_patterns: ['wp-includes/js','wp-content/themes','wp-content/plugins','wp-emoji-release\\.min\\.js'],
    url_patterns: ['wp-admin','wp-login'],
    version_patterns: ['WordPress ([\\d.]+)','\"version\":\"([\\d.]+)\",\"name\":\"WordPress\"'],
    html_weight: 0.50, header_weight: 0.35, script_weight: 0.40, min_confidence: 0.40
  },
  {
    name: 'Shopify',
    category: 'E-Commerce',
    html_patterns: ['Shopify\\.theme','cdn\\.shopify\\.com','myshopify\\.com','shopify-section','shopify_analytics','Shopify\\.shop','shopify\\.com/s/files','ShopifyAnalytics','Shopify\\.currency'],
    header_patterns: ['x-shopify-stage','x-shopid','x-shardid'],
    script_patterns: ['cdn\\.shopify\\.com/s/files','shopify\\.com/s/trekkie'],
    url_patterns: ['\\.myshopify\\.com'],
    version_patterns: [],
    html_weight: 0.50, header_weight: 0.45, script_weight: 0.40, min_confidence: 0.42
  },
  {
    name: 'WooCommerce',
    category: 'E-Commerce',
    html_patterns: ['woocommerce','wc-','data-product_id','wc_add_to_cart','is-woocommerce','woocommerce-cart','woocommerce-checkout','woocommerce-page','wc_cart_fragments_params'],
    header_patterns: [],
    script_patterns: ['woocommerce/assets','wc-add-to-cart','woocommerce\\.min\\.js','wc-cart-fragments'],
    url_patterns: ['/shop/','/cart/','/checkout/','/product/'],
    version_patterns: ['WooCommerce ([\\d.]+)'],
    html_weight: 0.50, header_weight: 0.15, script_weight: 0.40, min_confidence: 0.42
  },
  {
    name: 'Cloudflare',
    category: 'CDN',
    html_patterns: ['cloudflare','__cf_bm','cf-challenge','cloudflare-static','cf_clearance','cloudflare-turnstile'],
    header_patterns: ['cf-ray','cf-cache-status','server: cloudflare','cf-request-id','cf-apo-via','cf-edge-cache'],
    script_patterns: ['cloudflare\\.com/cdn-cgi','static\\.cloudflareinsights\\.com','cdn-cgi/scripts','challenges\\.cloudflare\\.com'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.35, header_weight: 0.55, script_weight: 0.30, min_confidence: 0.35
  },
  {
    name: 'AWS CloudFront',
    category: 'CDN',
    html_patterns: [],
    header_patterns: ['x-amz-cf-id','x-amz-cf-pop','via:.*cloudfront','x-cache:.*cloudfront'],
    script_patterns: ['cloudfront\\.net'],
    url_patterns: ['\\.cloudfront\\.net'],
    version_patterns: [],
    html_weight: 0.10, header_weight: 0.60, script_weight: 0.25, min_confidence: 0.35
  },
  {
    name: 'Vercel',
    category: 'Hosting',
    html_patterns: ['vercel\\.app','vercel\\.com'],
    header_patterns: ['x-vercel-id','x-vercel-cache','server: vercel','x-vercel-deployment-url','x-vercel-ip-country'],
    script_patterns: [],
    url_patterns: ['\\.vercel\\.app'],
    version_patterns: [],
    html_weight: 0.20, header_weight: 0.65, script_weight: 0.10, min_confidence: 0.33
  },
  {
    name: 'Netlify',
    category: 'Hosting',
    html_patterns: ['netlify','data-netlify','netlify-identity'],
    header_patterns: ['x-nf-request-id','server: netlify','x-netlify-cache','netlify-cdn-cache-control','netlify-vary'],
    script_patterns: ['netlify-identity-widget'],
    url_patterns: ['\\.netlify\\.app','\\.netlify\\.com'],
    version_patterns: [],
    html_weight: 0.20, header_weight: 0.65, script_weight: 0.10, min_confidence: 0.33
  },
  {
    name: 'Tailwind CSS',
    category: 'CSS Framework',
    html_patterns: ['tailwindcss','tw-','tailwind\\.config'],
    header_patterns: [],
    script_patterns: ['tailwindcss','cdn\\.tailwindcss\\.com'],
    url_patterns: [],
    version_patterns: ['tailwindcss@([\\d.]+)','\"tailwindcss\":\"([\\d.]+)\"'],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.35, min_confidence: 0.35
  },
  {
    name: 'Bootstrap',
    category: 'CSS Framework',
    html_patterns: ['bootstrap','data-bs-','data-toggle=','data-dismiss='],
    header_patterns: [],
    script_patterns: ['bootstrap\\.min\\.js','bootstrap\\.bundle\\.min\\.js','getbootstrap\\.com','cdn\\.jsdelivr\\.net/npm/bootstrap'],
    url_patterns: [],
    version_patterns: ['bootstrap@([\\d.]+)','\"bootstrap\":\"([\\d.]+)\"','Bootstrap v([\\d.]+)'],
    html_weight: 0.40, header_weight: 0.10, script_weight: 0.40, min_confidence: 0.35
  },
  {
    name: 'Google Analytics',
    category: 'Analytics',
    html_patterns: ['google-analytics\\.com/analytics\\.js','GoogleAnalyticsObject','gtag\\(','UA-[0-9]+-[0-9]+','G-[A-Z0-9]+'],
    header_patterns: [],
    script_patterns: ['google-analytics\\.com/analytics\\.js','googletagmanager\\.com/gtag/js','google-analytics\\.com/ga\\.js'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.38
  },
  {
    name: 'Google Tag Manager',
    category: 'Tag Manager',
    html_patterns: ['GTM-[A-Z0-9]+','googletagmanager\\.com','dataLayer\\.push','gtm\\.js'],
    header_patterns: [],
    script_patterns: ['googletagmanager\\.com/gtm\\.js','googletagmanager\\.com/ns\\.html'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.38
  },
  {
    name: 'Stripe',
    category: 'Payment',
    html_patterns: ['stripe\\.createToken','stripe\\.redirectToCheckout','data-stripe','StripeElement','stripe-js','__stripe_mid','__stripe_sid'],
    header_patterns: [],
    script_patterns: ['js\\.stripe\\.com/v3','js\\.stripe\\.com/v2'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.50, min_confidence: 0.42
  },
  {
    name: 'Sentry',
    category: 'Monitoring',
    html_patterns: ['Sentry\\.init','sentry\\.io','__sentry','sentry-trace'],
    header_patterns: ['sentry-trace','baggage:.*sentry'],
    script_patterns: ['browser\\.sentry-cdn\\.com','js\\.sentry-cdn\\.com','@sentry/browser'],
    url_patterns: [],
    version_patterns: ['\"@sentry/browser\":\"([\\d.]+)\"'],
    html_weight: 0.45, header_weight: 0.30, script_weight: 0.45, min_confidence: 0.38
  },
  {
    name: 'Intercom',
    category: 'Customer Support',
    html_patterns: ['intercomSettings','Intercom\\(','intercom-container','intercom-launcher','widget\\.intercom\\.io'],
    header_patterns: [],
    script_patterns: ['widget\\.intercom\\.io/widget','js\\.intercomcdn\\.com'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.38
  },
  {
    name: 'HubSpot',
    category: 'Marketing',
    html_patterns: ['hubspot','hs-script-loader','hbspt\\.forms\\.create','_hsq\\.push','leadin','hs-form'],
    header_patterns: ['x-hs-cf-stack'],
    script_patterns: ['js\\.hs-scripts\\.com','js\\.hsforms\\.net','js\\.hubspot\\.com'],
    url_patterns: ['\\.hubspot\\.com','\\.hs-sites\\.com'],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.30, script_weight: 0.45, min_confidence: 0.38
  },
  {
    name: 'Hotjar',
    category: 'Analytics',
    html_patterns: ['hotjar','hjSetting','_hjSettings','hj\\(','hjid:','_hjTLDTest'],
    header_patterns: [],
    script_patterns: ['static\\.hotjar\\.com','script\\.hotjar\\.com'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.38
  },
  {
    name: 'Firebase',
    category: 'Database',
    html_patterns: ['firebase','__FIREBASE_DEFAULTS__','firebaseapp\\.com'],
    header_patterns: [],
    script_patterns: ['firebase\\.googleapis\\.com','firebasestorage\\.googleapis\\.com','www\\.gstatic\\.com/firebasejs'],
    url_patterns: ['\\.firebaseapp\\.com','\\.web\\.app'],
    version_patterns: ['\"firebase\":\"([\\d.]+)\"'],
    html_weight: 0.40, header_weight: 0.10, script_weight: 0.50, min_confidence: 0.38
  },
  {
    name: 'Supabase',
    category: 'Database',
    html_patterns: ['supabase','supabase\\.co'],
    header_patterns: [],
    script_patterns: ['@supabase/supabase-js','supabase\\.co/storage'],
    url_patterns: ['\\.supabase\\.co'],
    version_patterns: ['\"@supabase/supabase-js\":\"([\\d.]+)\"'],
    html_weight: 0.35, header_weight: 0.10, script_weight: 0.50, min_confidence: 0.35
  },
  {
    name: 'Paystack',
    category: 'Payment',
    html_patterns: ['PaystackPop','paystack','paystack-button'],
    header_patterns: [],
    script_patterns: ['js\\.paystack\\.co','checkout\\.paystack\\.com'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.50, min_confidence: 0.40
  },
  {
    name: 'Flutterwave',
    category: 'Payment',
    html_patterns: ['FlutterwaveCheckout','flutterwave','rave-payment-button'],
    header_patterns: [],
    script_patterns: ['checkout\\.flutterwave\\.com','ravepay\\.co'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.50, min_confidence: 0.40
  },
  {
    name: 'Google Fonts',
    category: 'Font',
    html_patterns: ['fonts\\.googleapis\\.com','fonts\\.gstatic\\.com'],
    header_patterns: [],
    script_patterns: [],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.60, header_weight: 0.10, script_weight: 0.10, min_confidence: 0.30
  },
  {
    name: 'reCAPTCHA',
    category: 'Security',
    html_patterns: ['g-recaptcha','recaptcha','grecaptcha','data-sitekey'],
    header_patterns: [],
    script_patterns: ['google\\.com/recaptcha/api\\.js','www\\.google\\.com/recaptcha'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.38
  },
  {
    name: 'Nginx',
    category: 'Web Server',
    html_patterns: [],
    header_patterns: ['server: nginx','server: openresty'],
    script_patterns: [],
    url_patterns: [],
    version_patterns: ['server: nginx\\/([\\d.]+)'],
    html_weight: 0.10, header_weight: 0.70, script_weight: 0.10, min_confidence: 0.35
  },
  {
    name: 'PHP',
    category: 'Programming Language',
    html_patterns: [],
    header_patterns: ['x-powered-by: php','set-cookie:.*phpsessid'],
    script_patterns: [],
    url_patterns: ['\\.php'],
    version_patterns: ['x-powered-by: php\\/([\\d.]+)'],
    html_weight: 0.10, header_weight: 0.60, script_weight: 0.10, min_confidence: 0.33
  },
  {
    name: 'Django',
    category: 'Programming Language',
    html_patterns: ['csrfmiddlewaretoken','django','__admin_media_prefix__'],
    header_patterns: ['set-cookie:.*csrftoken','set-cookie:.*sessionid'],
    script_patterns: [],
    url_patterns: ['/admin/','/static/'],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.40, script_weight: 0.10, min_confidence: 0.35
  },
  {
    name: 'Laravel',
    category: 'Programming Language',
    html_patterns: ['laravel','csrf-token','laravel_session'],
    header_patterns: ['set-cookie:.*laravel_session','set-cookie:.*xsrf-token'],
    script_patterns: ['laravel\\.js','app\\.js'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.40, header_weight: 0.40, script_weight: 0.20, min_confidence: 0.35
  },
  {
    name: 'Facebook Pixel',
    category: 'Marketing',
    html_patterns: ['fbq\\(','facebook-jssdk','connect\\.facebook\\.net','_fbq','fbevents\\.js'],
    header_patterns: [],
    script_patterns: ['connect\\.facebook\\.net/en_US/fbevents','connect\\.facebook\\.net/signals'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.55, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.40
  },
  {
    name: 'AWS',
    category: 'Hosting',
    html_patterns: [],
    header_patterns: ['x-amzn-requestid','x-amz-request-id','server: awselb','x-amzn-trace-id'],
    script_patterns: ['s3\\.amazonaws\\.com','\\.s3\\.amazonaws\\.com'],
    url_patterns: ['\\.amazonaws\\.com'],
    version_patterns: [],
    html_weight: 0.10, header_weight: 0.60, script_weight: 0.25, min_confidence: 0.33
  },
  {
    name: 'Google Maps',
    category: 'Map',
    html_patterns: ['maps\\.googleapis\\.com','google-map','gm-style','GoogleMap'],
    header_patterns: [],
    script_patterns: ['maps\\.googleapis\\.com/maps/api','maps\\.google\\.com/maps'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.35
  },
  {
    name: 'YouTube',
    category: 'Video',
    html_patterns: ['youtube\\.com/embed','youtu\\.be','ytInitialData','yt-player'],
    header_patterns: [],
    script_patterns: ['youtube\\.com/iframe_api','www\\.youtube\\.com/s/player'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.55, header_weight: 0.10, script_weight: 0.35, min_confidence: 0.30
  },
  {
    name: 'Algolia',
    category: 'Search',
    html_patterns: ['algolia','ais-','InstantSearch','algoliasearch'],
    header_patterns: [],
    script_patterns: ['cdn\\.jsdelivr\\.net/npm/algoliasearch','cdn\\.jsdelivr\\.net/npm/instantsearch','algoliasearch\\.min\\.js'],
    url_patterns: [],
    version_patterns: ['\"algoliasearch\":\"([\\d.]+)\"'],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.38
  },
  {
    name: 'Webflow',
    category: 'CMS',
    html_patterns: ['data-wf-','webflow','w-webflow-badge','wf-form-','data-w-id','webflow-badge','wf-'],
    header_patterns: ['x-powered-by: webflow'],
    script_patterns: ['assets\\.website-files\\.com','webflow\\.js','d3e54v103j8qbb\\.cloudfront\\.net'],
    url_patterns: ['\\.webflow\\.io'],
    version_patterns: [],
    html_weight: 0.50, header_weight: 0.35, script_weight: 0.40, min_confidence: 0.40
  },
  {
    name: 'Segment',
    category: 'Analytics',
    html_patterns: ['analytics\\.load\\(','analytics\\.page\\(','analytics\\.track\\(','analytics\\.identify\\(','cdn\\.segment\\.com'],
    header_patterns: [],
    script_patterns: ['cdn\\.segment\\.com/analytics\\.js','cdn\\.segment\\.io'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.38
  },
  {
    name: 'Drupal',
    category: 'CMS',
    html_patterns: ['Drupal\\.settings','drupal\\.js','drupal-','data-drupal-','/sites/default/files','drupal/core','Drupal\\.behaviors','drupalSettings','data-drupal-link'],
    header_patterns: ['x-drupal-cache','x-generator: drupal','x-drupal-dynamic-cache'],
    script_patterns: ['/core/misc/drupal','drupal\\.min\\.js','/sites/all/modules','/core/assets/vendor'],
    url_patterns: ['/node/','/sites/default'],
    version_patterns: ['Drupal ([\\d.]+)','\"Drupal\":\"([\\d.]+)\"'],
    html_weight: 0.45, header_weight: 0.40, script_weight: 0.35, min_confidence: 0.38
  },
  {
    name: 'Fastly',
    category: 'CDN',
    html_patterns: [],
    header_patterns: ['x-fastly-request-id','x-served-by:.*cache-','fastly-restarts','x-cache:.*HIT','x-timer:.*S','via:.*varnish'],
    script_patterns: [],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.10, header_weight: 0.65, script_weight: 0.10, min_confidence: 0.35
  },
  {
    name: 'PayPal',
    category: 'Payment',
    html_patterns: ['paypal\\.Buttons','paypal-button','paypal\\.com/sdk'],
    header_patterns: [],
    script_patterns: ['paypal\\.com/sdk/js','paypalobjects\\.com'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.50, min_confidence: 0.42
  },
  {
    name: 'Zendesk',
    category: 'Customer Support',
    html_patterns: ['zE\\(','zEmbed','zendesk','zd-','zdSettings'],
    header_patterns: [],
    script_patterns: ['static\\.zdassets\\.com','ekr\\.zdassets\\.com','v2\\.zopim\\.com'],
    url_patterns: ['\\.zendesk\\.com'],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.38
  }
];

// ─── CLUSTERS ─────────────────────────────────────────────────────────────────

const CLUSTERS = [
  { cluster_id: 'jamstack_react', name: 'JAMstack React', description: 'A modern JAMstack architecture built on React with static site generation or server-side rendering. Typically deployed on edge hosting platforms like Vercel or Netlify with CDN delivery.', feature_vector: { 'React': 0.95, 'Next.js': 0.90, 'Vercel': 0.80, 'Netlify': 0.60, 'Tailwind CSS': 0.65, 'Cloudflare': 0.55, 'Google Analytics': 0.50, 'Sentry': 0.45 }, adjacent_clusters: ['jamstack_vue', 'enterprise_saas', 'headless_commerce'] },
  { cluster_id: 'jamstack_vue', name: 'JAMstack Vue', description: 'A modern JAMstack architecture built on Vue.js or Nuxt.js with static generation or SSR.', feature_vector: { 'Vue.js': 0.95, 'Nuxt.js': 0.85, 'Netlify': 0.65, 'Vercel': 0.55, 'Tailwind CSS': 0.55, 'Cloudflare': 0.50, 'Google Analytics': 0.50 }, adjacent_clusters: ['jamstack_react', 'spa_modern', 'enterprise_saas'] },
  { cluster_id: 'jamstack_astro', name: 'JAMstack Astro', description: 'A content-focused JAMstack architecture built with Astro. Prioritises minimal JavaScript delivery through island architecture.', feature_vector: { 'Astro': 0.95, 'Tailwind CSS': 0.70, 'Netlify': 0.60, 'Vercel': 0.55, 'Cloudflare': 0.50, 'React': 0.40 }, adjacent_clusters: ['jamstack_react', 'jamstack_vue', 'static_site'] },
  { cluster_id: 'spa_modern', name: 'Modern SPA', description: 'A Single Page Application built with a modern JavaScript framework without server-side rendering.', feature_vector: { 'React': 0.80, 'Angular': 0.70, 'Vue.js': 0.70, 'Svelte': 0.60, 'AWS': 0.50, 'Bootstrap': 0.40, 'Google Analytics': 0.45 }, adjacent_clusters: ['jamstack_react', 'enterprise_saas', 'jamstack_vue'] },
  { cluster_id: 'wordpress_standard', name: 'WordPress Standard', description: 'A standard WordPress CMS installation with traditional server-side PHP rendering.', feature_vector: { 'WordPress': 0.98, 'PHP': 0.85, 'jQuery': 0.80, 'Cloudflare': 0.55, 'Bootstrap': 0.40, 'Google Analytics': 0.65, 'Google Tag Manager': 0.50 }, adjacent_clusters: ['wordpress_ecommerce', 'cms_traditional', 'headless_cms'] },
  { cluster_id: 'wordpress_ecommerce', name: 'WordPress E-Commerce', description: 'A WordPress installation with WooCommerce powering an online store.', feature_vector: { 'WordPress': 0.98, 'WooCommerce': 0.98, 'PHP': 0.85, 'jQuery': 0.80, 'Cloudflare': 0.55, 'Stripe': 0.60, 'PayPal': 0.55, 'Google Analytics': 0.65 }, adjacent_clusters: ['shopify_standard', 'wordpress_standard', 'headless_commerce'] },
  { cluster_id: 'shopify_standard', name: 'Shopify Commerce', description: 'A Shopify-powered e-commerce store using Shopify\'s hosted platform.', feature_vector: { 'Shopify': 0.98, 'Cloudflare': 0.70, 'Google Analytics': 0.70, 'Google Tag Manager': 0.65, 'Facebook Pixel': 0.60, 'Stripe': 0.50 }, adjacent_clusters: ['wordpress_ecommerce', 'headless_commerce', 'enterprise_commerce'] },
  { cluster_id: 'headless_commerce', name: 'Headless Commerce', description: 'A modern e-commerce architecture that decouples the frontend from the backend commerce engine.', feature_vector: { 'React': 0.85, 'Next.js': 0.80, 'Shopify': 0.60, 'Vercel': 0.70, 'Cloudflare': 0.60, 'Stripe': 0.65, 'Algolia': 0.50 }, adjacent_clusters: ['shopify_standard', 'jamstack_react', 'enterprise_commerce'] },
  { cluster_id: 'enterprise_saas', name: 'Enterprise SaaS', description: 'A sophisticated SaaS product architecture built for scale with enterprise-grade tooling.', feature_vector: { 'React': 0.80, 'AWS': 0.70, 'Cloudflare': 0.65, 'Segment': 0.70, 'Intercom': 0.65, 'Sentry': 0.70, 'Stripe': 0.65, 'HubSpot': 0.55 }, adjacent_clusters: ['jamstack_react', 'spa_modern', 'enterprise_commerce'] },
  { cluster_id: 'enterprise_commerce', name: 'Enterprise Commerce', description: 'A large-scale enterprise e-commerce platform handling high transaction volumes.', feature_vector: { 'AWS': 0.75, 'Cloudflare': 0.55, 'Algolia': 0.60 }, adjacent_clusters: ['shopify_standard', 'headless_commerce', 'enterprise_saas'] },
  { cluster_id: 'cms_traditional', name: 'Traditional CMS', description: 'A traditional server-rendered CMS architecture using Drupal or similar platforms.', feature_vector: { 'Drupal': 0.90, 'PHP': 0.90, 'jQuery': 0.80, 'Bootstrap': 0.55, 'Google Analytics': 0.60 }, adjacent_clusters: ['wordpress_standard', 'headless_cms', 'spa_modern'] },
  { cluster_id: 'headless_cms', name: 'Headless CMS', description: 'A content-first architecture using a headless CMS with a decoupled frontend.', feature_vector: { 'React': 0.75, 'Next.js': 0.70, 'Netlify': 0.60, 'Vercel': 0.65, 'Cloudflare': 0.50 }, adjacent_clusters: ['jamstack_react', 'cms_traditional', 'headless_commerce'] },
  { cluster_id: 'static_site', name: 'Static Site', description: 'A purely static website with HTML, CSS, and JavaScript files served directly from a CDN.', feature_vector: { 'Cloudflare': 0.60, 'Netlify': 0.70, 'Google Analytics': 0.50, 'Bootstrap': 0.40, 'Tailwind CSS': 0.40, 'Google Fonts': 0.55 }, adjacent_clusters: ['jamstack_astro', 'jamstack_react', 'cms_traditional'] },
  { cluster_id: 'webflow_site', name: 'Webflow Site', description: 'A website built and hosted on Webflow\'s visual development platform.', feature_vector: { 'Webflow': 0.98, 'Cloudflare': 0.65, 'Google Analytics': 0.60, 'Google Tag Manager': 0.55 }, adjacent_clusters: ['static_site', 'cms_traditional', 'jamstack_react'] },
  { cluster_id: 'django_python', name: 'Django Python', description: 'A server-rendered web application built with Django.', feature_vector: { 'Django': 0.95, 'AWS': 0.60, 'Nginx': 0.65, 'Cloudflare': 0.50, 'Bootstrap': 0.45, 'Google Analytics': 0.50 }, adjacent_clusters: ['laravel_php', 'enterprise_saas'] },
  { cluster_id: 'laravel_php', name: 'Laravel PHP', description: 'A server-rendered web application built with the Laravel PHP framework.', feature_vector: { 'Laravel': 0.95, 'PHP': 0.90, 'Nginx': 0.60, 'Bootstrap': 0.55, 'Vue.js': 0.50, 'Cloudflare': 0.50 }, adjacent_clusters: ['wordpress_standard', 'django_python'] }
];

// ─── CO-OCCURRENCE SEED DATA ──────────────────────────────────────────────────

const CO_OCCURRENCES = [
  { tech_a: 'Next.js', tech_b: 'React', category_a: 'JavaScript Framework', category_b: 'JavaScript Framework', count: 950, weight: 1.00 },
  { tech_a: 'React', tech_b: 'Tailwind CSS', category_a: 'JavaScript Framework', category_b: 'CSS Framework', count: 820, weight: 0.86 },
  { tech_a: 'Next.js', tech_b: 'Vercel', category_a: 'JavaScript Framework', category_b: 'Hosting', count: 780, weight: 0.82 },
  { tech_a: 'React', tech_b: 'Google Analytics', category_a: 'JavaScript Framework', category_b: 'Analytics', count: 750, weight: 0.79 },
  { tech_a: 'Next.js', tech_b: 'Cloudflare', category_a: 'JavaScript Framework', category_b: 'CDN', count: 720, weight: 0.76 },
  { tech_a: 'React', tech_b: 'Google Tag Manager', category_a: 'JavaScript Framework', category_b: 'Tag Manager', count: 690, weight: 0.73 },
  { tech_a: 'React', tech_b: 'Stripe', category_a: 'JavaScript Framework', category_b: 'Payment', count: 640, weight: 0.67 },
  { tech_a: 'React', tech_b: 'Sentry', category_a: 'JavaScript Framework', category_b: 'Monitoring', count: 620, weight: 0.65 },
  { tech_a: 'React', tech_b: 'Intercom', category_a: 'JavaScript Framework', category_b: 'Customer Support', count: 580, weight: 0.61 },
  { tech_a: 'React', tech_b: 'Cloudflare', category_a: 'JavaScript Framework', category_b: 'CDN', count: 700, weight: 0.74 },
  { tech_a: 'Nuxt.js', tech_b: 'Vue.js', category_a: 'JavaScript Framework', category_b: 'JavaScript Framework', count: 880, weight: 0.93 },
  { tech_a: 'Vue.js', tech_b: 'Tailwind CSS', category_a: 'JavaScript Framework', category_b: 'CSS Framework', count: 640, weight: 0.67 },
  { tech_a: 'WordPress', tech_b: 'jQuery', category_a: 'CMS', category_b: 'JavaScript Library', count: 920, weight: 0.97 },
  { tech_a: 'WordPress', tech_b: 'PHP', category_a: 'CMS', category_b: 'Programming Language', count: 900, weight: 0.95 },
  { tech_a: 'WordPress', tech_b: 'Cloudflare', category_a: 'CMS', category_b: 'CDN', count: 780, weight: 0.82 },
  { tech_a: 'WordPress', tech_b: 'Google Analytics', category_a: 'CMS', category_b: 'Analytics', count: 820, weight: 0.86 },
  { tech_a: 'WordPress', tech_b: 'WooCommerce', category_a: 'CMS', category_b: 'E-Commerce', count: 680, weight: 0.72 },
  { tech_a: 'WooCommerce', tech_b: 'Stripe', category_a: 'E-Commerce', category_b: 'Payment', count: 620, weight: 0.65 },
  { tech_a: 'Shopify', tech_b: 'Cloudflare', category_a: 'E-Commerce', category_b: 'CDN', count: 820, weight: 0.86 },
  { tech_a: 'Shopify', tech_b: 'Google Analytics', category_a: 'E-Commerce', category_b: 'Analytics', count: 800, weight: 0.84 },
  { tech_a: 'Shopify', tech_b: 'Facebook Pixel', category_a: 'E-Commerce', category_b: 'Marketing', count: 740, weight: 0.78 },
  { tech_a: 'Cloudflare', tech_b: 'Google Analytics', category_a: 'CDN', category_b: 'Analytics', count: 880, weight: 0.93 },
  { tech_a: 'Cloudflare', tech_b: 'Google Tag Manager', category_a: 'CDN', category_b: 'Tag Manager', count: 820, weight: 0.86 },
  { tech_a: 'Cloudflare', tech_b: 'Stripe', category_a: 'CDN', category_b: 'Payment', count: 680, weight: 0.72 },
  { tech_a: 'Google Analytics', tech_b: 'Google Tag Manager', category_a: 'Analytics', category_b: 'Tag Manager', count: 880, weight: 0.93 },
  { tech_a: 'Google Analytics', tech_b: 'Facebook Pixel', category_a: 'Analytics', category_b: 'Marketing', count: 760, weight: 0.80 },
  { tech_a: 'Google Analytics', tech_b: 'Hotjar', category_a: 'Analytics', category_b: 'Analytics', count: 680, weight: 0.72 },
  { tech_a: 'Stripe', tech_b: 'Intercom', category_a: 'Payment', category_b: 'Customer Support', count: 620, weight: 0.65 },
  { tech_a: 'Stripe', tech_b: 'Sentry', category_a: 'Payment', category_b: 'Monitoring', count: 560, weight: 0.59 },
  { tech_a: 'Google Fonts', tech_b: 'Google Analytics', category_a: 'Font', category_b: 'Analytics', count: 760, weight: 0.80 },
  { tech_a: 'Google Fonts', tech_b: 'WordPress', category_a: 'Font', category_b: 'CMS', count: 720, weight: 0.76 },
  { tech_a: 'Facebook Pixel', tech_b: 'Google Tag Manager', category_a: 'Marketing', category_b: 'Tag Manager', count: 720, weight: 0.76 },
  { tech_a: 'HubSpot', tech_b: 'Google Analytics', category_a: 'Marketing', category_b: 'Analytics', count: 660, weight: 0.69 },
  { tech_a: 'Sentry', tech_b: 'Google Analytics', category_a: 'Monitoring', category_b: 'Analytics', count: 500, weight: 0.53 },
  { tech_a: 'Firebase', tech_b: 'React', category_a: 'Database', category_b: 'JavaScript Framework', count: 580, weight: 0.61 },
  { tech_a: 'Supabase', tech_b: 'Next.js', category_a: 'Database', category_b: 'JavaScript Framework', count: 460, weight: 0.48 },
  { tech_a: 'Paystack', tech_b: 'Google Analytics', category_a: 'Payment', category_b: 'Analytics', count: 420, weight: 0.44 },
  { tech_a: 'Flutterwave', tech_b: 'React', category_a: 'Payment', category_b: 'JavaScript Framework', count: 380, weight: 0.40 },
  { tech_a: 'YouTube', tech_b: 'WordPress', category_a: 'Video', category_b: 'CMS', count: 620, weight: 0.65 },
  { tech_a: 'reCAPTCHA', tech_b: 'WordPress', category_a: 'Security', category_b: 'CMS', count: 540, weight: 0.57 },
  { tech_a: 'Algolia', tech_b: 'React', category_a: 'Search', category_b: 'JavaScript Framework', count: 560, weight: 0.59 },
  { tech_a: 'Webflow', tech_b: 'Cloudflare', category_a: 'CMS', category_b: 'CDN', count: 680, weight: 0.72 },
  { tech_a: 'Django', tech_b: 'AWS', category_a: 'Programming Language', category_b: 'Hosting', count: 560, weight: 0.59 },
  { tech_a: 'Laravel', tech_b: 'PHP', category_a: 'Programming Language', category_b: 'Programming Language', count: 880, weight: 0.93 },
  { tech_a: 'Segment', tech_b: 'Intercom', category_a: 'Analytics', category_b: 'Customer Support', count: 480, weight: 0.51 },
  { tech_a: 'HubSpot', tech_b: 'Facebook Pixel', category_a: 'Marketing', category_b: 'Marketing', count: 560, weight: 0.59 },
  { tech_a: 'Next.js', tech_b: 'Sentry', category_a: 'JavaScript Framework', category_b: 'Monitoring', count: 540, weight: 0.57 },
  { tech_a: 'React', tech_b: 'HubSpot', category_a: 'JavaScript Framework', category_b: 'Marketing', count: 520, weight: 0.55 },
  { tech_a: 'Shopify', tech_b: 'Google Tag Manager', category_a: 'E-Commerce', category_b: 'Tag Manager', count: 760, weight: 0.80 },
  { tech_a: 'Bootstrap', tech_b: 'jQuery', category_a: 'CSS Framework', category_b: 'JavaScript Library', count: 720, weight: 0.76 }
];

// ─── TECH INTELLIGENCE KNOWLEDGE BASE ────────────────────────────────────────

const TECH_INTELLIGENCE = [
  {
    name: 'React',
    category: 'JavaScript Framework',
    performance_impact: 'React\'s virtual DOM diffing delivers efficient UI updates. Production bundle starts at 40KB minified. Code splitting via React.lazy() reduces initial load. Without SSR, initial page shows blank content until JavaScript executes — a meaningful penalty on slow connections.',
    security_impact: 'React automatically escapes JSX values preventing XSS. dangerouslySetInnerHTML bypasses this and must be used carefully. Ensure NODE_ENV=production in deployment. No built-in CSRF protection.',
    cost_profile: 'React is free MIT licence. Hosting costs depend on platform. A typical React SPA on Netlify or Vercel free tier costs nothing for low traffic.',
    when_to_use: 'Complex interactive UIs requiring frequent state updates. Large teams benefiting from component reusability. Long-term projects where the talent pool reduces hiring risk.',
    when_not_to_use: 'Simple marketing sites where static HTML is faster. SEO-critical sites without SSR. Small projects where build tooling overhead outweighs benefits.',
    common_alternatives: ['Vue.js', 'Angular', 'Svelte', 'SolidJS', 'Preact'],
    common_companions: ['Next.js', 'Tailwind CSS', 'TypeScript', 'Vercel', 'Cloudflare', 'Stripe', 'Sentry', 'Google Analytics'],
    maturity_signal: 0.92,
    known_weaknesses: ['Blank page on initial load without SSR — harmful for SEO and perceived performance', 'Bundle size grows quickly as dependencies accumulate', 'No official routing solution — requires React Router or framework-level routing', 'Context API performance issues with frequent updates'],
    real_world_users: ['Facebook', 'Instagram', 'Airbnb', 'Netflix', 'Dropbox', 'WhatsApp Web', 'Atlassian', 'Stripe']
  },
  {
    name: 'Next.js',
    category: 'JavaScript Framework',
    performance_impact: 'Static Site Generation pre-renders pages at build time — TTFB under 50ms globally when served from a CDN. Server-Side Rendering generates pages per request — TTFB typically 100-400ms. Incremental Static Regeneration combines both. Automatic image optimisation via next/image reduces image payload by 40-80%.',
    security_impact: 'Inherits React\'s XSS protections. Server Components keep sensitive logic server-side. API routes provide a secure backend layer. Headers configurable in next.config.js.',
    cost_profile: 'Free and open source. Vercel free tier covers most personal and small commercial projects. Pro at $20/user/month. Self-hosting on any Node.js server is free.',
    when_to_use: 'Any React project where SEO matters. E-commerce sites requiring fast product pages. Marketing sites needing both performance and dynamic content.',
    when_not_to_use: 'Purely static sites with no dynamic content — Astro delivers better performance. Internal tools with no SEO requirements.',
    common_alternatives: ['Nuxt.js', 'Remix', 'Astro', 'SvelteKit', 'Gatsby'],
    common_companions: ['React', 'Vercel', 'Tailwind CSS', 'Cloudflare', 'Stripe', 'Sentry', 'Supabase'],
    maturity_signal: 0.94,
    known_weaknesses: ['Cold starts on Vercel serverless functions add latency to infrequently accessed routes', 'App Router has a steep learning curve', 'Build times grow with large numbers of static pages', 'Vendor lock-in to Vercel for optimal performance'],
    real_world_users: ['Vercel', 'TikTok', 'Twitch', 'Hulu', 'Target', 'Nike', 'Linear', 'Loom']
  },
  {
    name: 'Vue.js',
    category: 'JavaScript Framework',
    performance_impact: 'Vue 3 with the Composition API delivers excellent runtime performance. Bundle size is smaller than React — Vue 3 core is approximately 22KB gzipped. The reactivity system is granular and precise, avoiding unnecessary re-renders.',
    security_impact: 'Vue automatically escapes template expressions preventing XSS. The v-html directive bypasses escaping. No built-in authentication.',
    cost_profile: 'Free and open source under MIT licence.',
    when_to_use: 'Teams transitioning from jQuery or traditional HTML. Projects requiring a gentle learning curve. Asian market projects where Vue has particularly strong community support.',
    when_not_to_use: 'Large enterprise teams where Angular\'s structure reduces errors. Projects requiring the largest possible hiring pool.',
    common_alternatives: ['React', 'Angular', 'Svelte', 'SolidJS'],
    common_companions: ['Nuxt.js', 'Tailwind CSS', 'Vite', 'Pinia', 'Vue Router', 'Cloudflare'],
    maturity_signal: 0.88,
    known_weaknesses: ['Smaller ecosystem than React — fewer third-party component libraries', 'Vue 2 to Vue 3 migration was disruptive', 'Less enterprise adoption than React or Angular'],
    real_world_users: ['Alibaba', 'Xiaomi', 'Adobe', 'GitLab', 'Grammarly', 'Chess.com']
  },
  {
    name: 'WordPress',
    category: 'CMS',
    performance_impact: 'WordPress performance varies enormously. An uncached site on shared hosting can take 3-8 seconds. A properly configured site with a full-page caching plugin, CDN, and optimised database queries can achieve 500ms. The plugin ecosystem is the primary performance liability.',
    security_impact: 'WordPress powers 43% of all websites making it the most attacked CMS in existence. Core is regularly updated but plugins are the primary attack vector. xmlrpc.php is frequently targeted for brute force attacks and should be disabled.',
    cost_profile: 'Software is free. Hosting ranges from $3-10/month on shared hosting to $25-100/month on managed WordPress hosting. Total cost of a production site: $500-2000/year.',
    when_to_use: 'Content-heavy sites requiring non-technical editors. Blogs, news sites, and media publications. Businesses needing a large library of pre-built functionality via plugins.',
    when_not_to_use: 'High-traffic sites requiring consistent performance. Applications requiring complex custom functionality. Security-critical applications.',
    common_alternatives: ['Ghost', 'Webflow', 'Squarespace', 'Contentful', 'Sanity', 'Drupal'],
    common_companions: ['PHP', 'jQuery', 'Cloudflare', 'Google Analytics', 'WooCommerce', 'Google Tag Manager'],
    maturity_signal: 0.65,
    known_weaknesses: ['Plugin conflicts can break sites unexpectedly', 'Database-heavy architecture struggles under high concurrent traffic', 'Default installation has multiple known attack vectors requiring manual hardening', 'Technical debt accumulates quickly'],
    real_world_users: ['The New York Times (blogs)', 'BBC America', 'TechCrunch', 'Sony Music', 'Microsoft News']
  },
  {
    name: 'Shopify',
    category: 'E-Commerce',
    performance_impact: 'Shopify\'s infrastructure delivers reliable performance — global CDN, automatic image optimisation, and 99.99% uptime SLA. Core Web Vitals vary significantly based on theme quality and installed apps. Each app typically adds JavaScript and CSS.',
    security_impact: 'Shopify handles PCI DSS compliance automatically. SSL is automatic and enforced. The primary security risk is third-party apps with overly broad API permissions.',
    cost_profile: 'Basic Shopify $39/month. Shopify $105/month. Advanced $399/month. Apps average $15-50/month each.',
    when_to_use: 'Direct-to-consumer product businesses that want to launch quickly. Brands scaling from 0 to several million in annual revenue.',
    when_not_to_use: 'Businesses with very complex product configurations. High-volume B2B with complex pricing tiers. Businesses where transaction fees make Shopify economically unviable.',
    common_alternatives: ['WooCommerce', 'BigCommerce', 'Magento', 'Squarespace Commerce'],
    common_companions: ['Cloudflare', 'Google Analytics', 'Google Tag Manager', 'Facebook Pixel', 'Klaviyo', 'Stripe'],
    maturity_signal: 0.88,
    known_weaknesses: ['Transaction fees add cost for high-volume merchants not using Shopify Payments', 'Limited checkout customisation without Shopify Plus', 'App bloat is a major performance and cost issue', 'Shopify\'s Liquid templating language is proprietary'],
    real_world_users: ['Gymshark', 'Allbirds', 'Kylie Cosmetics', 'Red Bull', 'Heinz', 'Staples']
  },
  {
    name: 'Cloudflare',
    category: 'CDN',
    performance_impact: 'Cloudflare operates 300+ data centres in 100+ countries. Every visitor is served from the nearest PoP reducing geographic latency dramatically. For static assets cached at the edge TTFB drops to under 10ms globally.',
    security_impact: 'DDoS protection absorbs attacks up to 2.3 Tbps. Web Application Firewall filters OWASP Top 10 attacks before they reach the origin. Bot Management identifies and blocks automated threats.',
    cost_profile: 'Free tier covers most personal and small commercial sites. Pro at $25/month. Business at $200/month. Enterprise pricing for large organisations.',
    when_to_use: 'Any public-facing website receiving traffic from multiple geographic regions. Sites that have experienced DDoS attacks. Applications requiring edge compute.',
    when_not_to_use: 'Internal applications not exposed to the internet. Sites with very dynamic content that cannot be cached.',
    common_alternatives: ['AWS CloudFront', 'Fastly', 'Akamai', 'BunnyCDN'],
    common_companions: ['Vercel', 'Netlify', 'React', 'Next.js', 'WordPress', 'Shopify', 'Stripe'],
    maturity_signal: 0.95,
    known_weaknesses: ['Orange Cloud mode can break certain DNS configurations', 'Cache purging at scale requires careful planning', 'Cloudflare outages take down all proxied sites simultaneously', 'WebSocket configuration requires specific rules'],
    real_world_users: ['Discord', 'Shopify', 'Doordash', 'Garmin', 'Zendesk', 'Crunchyroll']
  },
  {
    name: 'Vercel',
    category: 'Hosting',
    performance_impact: 'Vercel\'s global edge network delivers Next.js applications with exceptional performance. Static assets served from the closest of 70+ edge locations. Edge Functions execute at the edge reducing latency for personalised content.',
    security_impact: 'Vercel enforces HTTPS on all deployments automatically. Environment variables are encrypted at rest. SOC 2 Type 2 certified.',
    cost_profile: 'Hobby tier is free. Pro at $20/user/month. Enterprise with custom pricing.',
    when_to_use: 'Next.js applications. Teams wanting zero-configuration deployment from Git. Projects needing preview deployments.',
    when_not_to_use: 'Long-running server processes. Applications requiring persistent WebSocket connections.',
    common_alternatives: ['Netlify', 'AWS', 'Google Cloud Run', 'Render', 'Railway'],
    common_companions: ['Next.js', 'React', 'Tailwind CSS', 'Cloudflare', 'Supabase', 'Stripe'],
    maturity_signal: 0.91,
    known_weaknesses: ['Serverless function cold starts add latency', 'Vendor lock-in — some Next.js features only work optimally on Vercel', 'Metered pricing for functions can produce unexpected bills', 'No persistent file system'],
    real_world_users: ['Washington Post', 'Tripadvisor', 'HashiCorp', 'Zapier', 'Loom', 'Linear', 'Sonos']
  },
  {
    name: 'Netlify',
    category: 'Hosting',
    performance_impact: 'Netlify\'s global ADN serves static assets from 100+ edge locations. Build times are competitive with automatic caching of unchanged build steps. Edge Functions execute at the edge for near-zero latency personalisation.',
    security_impact: 'Netlify enforces HTTPS automatically. Netlify Identity provides authentication. SOC 2 Type 2 certified.',
    cost_profile: 'Free tier. Pro at $19/site/month. Business at $99/site/month.',
    when_to_use: 'JAMstack sites and SPAs deployed from Git. Teams wanting a simpler alternative to Vercel. Projects using Gatsby, Hugo, Eleventy, or other static site generators.',
    when_not_to_use: 'Next.js applications where Vercel\'s tight integration provides better performance.',
    common_alternatives: ['Vercel', 'AWS', 'Cloudflare Pages', 'Render'],
    common_companions: ['React', 'Vue.js', 'Gatsby', 'Astro', 'Cloudflare', 'Contentful'],
    maturity_signal: 0.88,
    known_weaknesses: ['Build minutes can be exhausted quickly on the free tier', 'Netlify Functions have same cold start issues as all serverless platforms', 'Form handling limited to 100 submissions/month on free tier'],
    real_world_users: ['Figma docs', 'Smashing Magazine', 'Peloton', 'Twilio docs', 'Vue.js docs']
  },
  {
    name: 'Stripe',
    category: 'Payment',
    performance_impact: 'Stripe.js loads asynchronously and does not block page rendering. The payment form iframe loads from Stripe\'s CDN typically in 200-400ms. Payment Intents with 3D Secure adds 2-10 seconds to checkout for some users.',
    security_impact: 'Stripe is PCI DSS Level 1 certified. Card data never touches the merchant\'s servers. Stripe Radar uses machine learning to detect fraudulent transactions. Webhook signatures must be verified.',
    cost_profile: 'No monthly fees. 2.9% + 30¢ per successful card transaction in the US. International cards add 1.5%.',
    when_to_use: 'Any business accepting online payments that values developer experience. SaaS companies managing subscriptions. Marketplaces using Stripe Connect. Global businesses needing multi-currency support.',
    when_not_to_use: 'Very high volume businesses where fee negotiation provides better economics. Markets where Stripe is not available.',
    common_alternatives: ['PayPal', 'Braintree', 'Adyen', 'Square', 'Paddle', 'Razorpay', 'Paystack'],
    common_companions: ['React', 'Next.js', 'Cloudflare', 'Intercom', 'Sentry', 'Google Analytics'],
    maturity_signal: 0.96,
    known_weaknesses: ['Transaction fees are higher than some alternatives for very high volumes', 'Not available in all countries', '3D Secure authentication adds friction to checkout', 'Webhook reliability requires careful retry logic'],
    real_world_users: ['Amazon', 'Google', 'Microsoft', 'Shopify', 'Spotify', 'Lyft', 'Slack', 'Notion', 'Figma']
  },
  {
    name: 'Tailwind CSS',
    category: 'CSS Framework',
    performance_impact: 'Tailwind CSS production builds purge all unused utility classes — a typical production CSS file is 5-15KB gzipped compared to Bootstrap\'s 30KB. No JavaScript runtime.',
    security_impact: 'No security implications — it is pure CSS.',
    cost_profile: 'Free and open source under MIT licence. Tailwind UI $299 one-time for personal licence.',
    when_to_use: 'Projects where rapid UI development with design consistency is a priority. Teams that want to avoid writing custom CSS.',
    when_not_to_use: 'Teams that strongly prefer semantic CSS class names for readability.',
    common_alternatives: ['Bootstrap', 'Material UI', 'Chakra UI', 'Bulma'],
    common_companions: ['React', 'Next.js', 'Vue.js', 'Astro', 'Headless UI', 'Radix UI'],
    maturity_signal: 0.91,
    known_weaknesses: ['Long class attribute strings reduce HTML readability', 'Requires a build step', 'Developers without CSS fundamentals can produce poor layouts'],
    real_world_users: ['GitHub', 'Shopify', 'Netflix', 'NASA', 'Stripe docs', 'Vercel docs', 'Laravel']
  },
  {
    name: 'Google Analytics',
    category: 'Analytics',
    performance_impact: 'Google Analytics 4 adds approximately 50-80KB of JavaScript. Loading asynchronously prevents render blocking but script evaluation uses main thread time.',
    security_impact: 'Collects user behaviour data and sends to Google\'s servers — a privacy consideration under GDPR. IP anonymisation should be enabled. Cookie consent must be obtained in EU and UK jurisdictions.',
    cost_profile: 'GA4 is free for most businesses — up to 10 million events per month. Google Analytics 360 starts at $150,000/year.',
    when_to_use: 'Any business website needing basic traffic analytics and conversion tracking. E-commerce sites tracking product funnels.',
    when_not_to_use: 'Privacy-focused applications. Businesses in industries with strict data sovereignty requirements.',
    common_alternatives: ['Plausible', 'Fathom Analytics', 'Mixpanel', 'Amplitude', 'PostHog', 'Matomo'],
    common_companions: ['Google Tag Manager', 'Facebook Pixel', 'Cloudflare', 'HubSpot', 'Hotjar'],
    maturity_signal: 0.80,
    known_weaknesses: ['GA4\'s interface is more complex than Universal Analytics', 'High ad blocker penetration means 20-40% of traffic may go untracked', 'GDPR compliance requires cookie consent management', 'Data is shared with Google'],
    real_world_users: 'Used by approximately 56% of all websites globally according to W3Techs'
  },
  {
    name: 'Sentry',
    category: 'Monitoring',
    performance_impact: 'Sentry\'s browser SDK adds approximately 60-80KB gzipped. Error capturing is asynchronous. Performance monitoring adds distributed tracing to all network requests — a small overhead per request.',
    security_impact: 'Sentry can inadvertently capture sensitive data in stack traces. Data scrubbing rules and PII scrubbing configuration must be configured. Error data is stored in Sentry\'s cloud.',
    cost_profile: 'Free tier — 5,000 errors/month. Team at $26/month. Business at $80/month.',
    when_to_use: 'Any production application where errors affect user experience. Multi-service architectures where distributed tracing reveals bottlenecks.',
    when_not_to_use: 'Simple static sites with no JavaScript logic. Development environments.',
    common_alternatives: ['Datadog', 'New Relic', 'LogRocket', 'Bugsnag', 'Rollbar'],
    common_companions: ['React', 'Next.js', 'Cloudflare', 'Stripe', 'AWS', 'Google Cloud'],
    maturity_signal: 0.90,
    known_weaknesses: ['Can accidentally capture PII and sensitive data without careful configuration', 'Error volume can spike unexpectedly', 'Session replay has significant privacy implications', 'Alert fatigue is common without careful noise filtering'],
    real_world_users: ['Microsoft', 'Cloudflare', 'GitHub', 'Notion', 'Figma', 'Disney', 'Robinhood']
  },
  {
    name: 'Intercom',
    category: 'Customer Support',
    performance_impact: 'Intercom\'s messenger widget adds 200-300KB of JavaScript. Intercom recommends loading the widget only after the page has fully loaded.',
    security_impact: 'Intercom stores conversation data on their servers. User identity verification using a cryptographic hash prevents impersonation. GDPR compliance requires a Data Processing Agreement.',
    cost_profile: 'Starter plan at $74/month. Pro typically $400-1500/month. Enterprise pricing for large organisations.',
    when_to_use: 'SaaS products where in-app messaging drives activation and retention. Companies with product-led growth models.',
    when_not_to_use: 'Price-sensitive companies where Crisp or Tawk.to provide sufficient functionality at lower cost.',
    common_alternatives: ['Zendesk', 'Crisp', 'Drift', 'HubSpot Chat', 'Freshdesk', 'Tawk.to'],
    common_companions: ['Stripe', 'Segment', 'React', 'Cloudflare', 'Google Analytics', 'Sentry'],
    maturity_signal: 0.87,
    known_weaknesses: ['One of the most expensive customer support platforms', 'Heavy page weight impacts Core Web Vitals', 'Pricing model changed significantly in 2023', 'Data portability and migration away is difficult'],
    real_world_users: ['Atlassian', 'Shopify', 'New Relic', 'Amplitude', 'Airtable', 'Notion', 'Linear']
  },
  {
    name: 'HubSpot',
    category: 'Marketing',
    performance_impact: 'HubSpot\'s tracking code adds approximately 50-80KB of JavaScript loaded asynchronously. Total HubSpot-related JavaScript on a heavily integrated site can reach 300-500KB.',
    security_impact: 'HubSpot stores CRM data and form submissions on their servers. SOC 2 Type 2 certified. GDPR-compliant with Data Processing Agreement available.',
    cost_profile: 'Marketing Hub Starter $20/month. Professional $890/month. Enterprise $3600/month.',
    when_to_use: 'B2B companies running inbound marketing. Teams wanting a unified CRM, marketing automation, and sales platform.',
    when_not_to_use: 'E-commerce businesses where Klaviyo provides better product-focused automation. Very early stage companies.',
    common_alternatives: ['Salesforce', 'Marketo', 'ActiveCampaign', 'Mailchimp', 'Klaviyo'],
    common_companions: ['Google Analytics', 'Google Tag Manager', 'Cloudflare', 'React', 'Stripe', 'Facebook Pixel'],
    maturity_signal: 0.85,
    known_weaknesses: ['Pricing escalates sharply at Professional and Enterprise tiers', 'Contact-based pricing means costs scale with list growth', 'HubSpot CMS is proprietary — migrating content away is difficult'],
    real_world_users: ['Shopify', 'SurveyMonkey', 'TrustPilot', 'GoFundMe', 'ClassPass', 'DoorDash']
  },
  {
    name: 'Segment',
    category: 'Analytics',
    performance_impact: 'Segment\'s analytics.js library is approximately 60-80KB gzipped. The primary performance benefit is replacing multiple individual analytics scripts — instead of loading Google Analytics, Mixpanel, and Amplitude separately, Segment loads once.',
    security_impact: 'Segment acts as a data pipeline — all user event data passes through their servers. This centralises data governance. SOC 2 Type 2 certified.',
    cost_profile: 'Free tier — 1,000 monthly tracked users. Team at $120/month. Business with custom pricing.',
    when_to_use: 'Companies using three or more analytics and marketing tools that need consistent data. Data-driven teams that want a single source of truth.',
    when_not_to_use: 'Simple sites needing only Google Analytics. Very early stage companies.',
    common_alternatives: ['Rudderstack', 'Amplitude', 'mParticle', 'Snowplow'],
    common_companions: ['React', 'Intercom', 'Mixpanel', 'Amplitude', 'Stripe', 'Cloudflare', 'Sentry'],
    maturity_signal: 0.91,
    known_weaknesses: ['MTU-based pricing can produce unexpected bills', 'Implementation complexity requires careful event taxonomy planning', 'Data latency in cloud-mode destinations can be 1-5 minutes'],
    real_world_users: ['Atlassian', 'Intuit', 'Levi\'s', 'Gap', 'IBM', 'Instacart', 'Wayfair']
  },
  {
    name: 'Firebase',
    category: 'Database',
    performance_impact: 'Firebase Realtime Database and Firestore deliver real-time data synchronisation. Firestore offline persistence enables applications to function without internet connectivity. Cold start times for Cloud Functions can be 1-5 seconds.',
    security_impact: 'Firebase Security Rules are the critical security layer — poorly written rules can expose all data publicly. App Check prevents abuse by non-genuine app clients.',
    cost_profile: 'Spark plan (free) — 1GB Firestore storage, 50,000 reads/day. Blaze plan (pay as you go) — $0.06/100,000 reads.',
    when_to_use: 'Real-time applications — chat, collaborative editing, live dashboards. Mobile applications. Rapid prototyping.',
    when_not_to_use: 'Applications requiring complex relational queries. High-write-volume applications.',
    common_alternatives: ['Supabase', 'PlanetScale', 'AWS DynamoDB', 'MongoDB Atlas'],
    common_companions: ['React', 'Vue.js', 'Google Analytics', 'Google Cloud', 'Stripe'],
    maturity_signal: 0.83,
    known_weaknesses: ['Security Rules complexity — many Firebase breaches result from misconfigured rules', 'Vendor lock-in is severe', 'NoSQL data model struggles with relational data', 'Cloud Function cold starts add significant latency'],
    real_world_users: ['Duolingo', 'Alibaba', 'The New York Times', 'Lyft', 'Shazam']
  },
  {
    name: 'Supabase',
    category: 'Database',
    performance_impact: 'Supabase is built on PostgreSQL — queries can be as performant as any relational database with proper indexing. The auto-generated REST API via PostgREST is optimised for common query patterns.',
    security_impact: 'Row Level Security policies enforce data access at the database level. The service_role key bypasses RLS and must be kept exclusively server-side.',
    cost_profile: 'Free tier — 500MB database, 1GB file storage. Pro at $25/project/month.',
    when_to_use: 'Applications requiring a relational database with modern developer experience. Teams familiar with SQL. Projects migrating from Firebase that need relational data structures.',
    when_not_to_use: 'Applications with primarily non-relational data structures. Very high-scale applications requiring more control.',
    common_alternatives: ['Firebase', 'PlanetScale', 'Neon', 'AWS RDS', 'MongoDB Atlas'],
    common_companions: ['Next.js', 'React', 'Tailwind CSS', 'Vercel', 'Stripe'],
    maturity_signal: 0.86,
    known_weaknesses: ['Relatively young platform — some enterprise features still maturing', 'Free tier projects pause after 1 week of inactivity', 'RLS policies add complexity'],
    real_world_users: ['Mozilla', 'PwC', 'Chatbase', 'Mobbin', 'Peerlist']
  },
  {
    name: 'Algolia',
    category: 'Search',
    performance_impact: 'Algolia delivers search results in under 10ms globally through distributed search indices. InstantSearch.js provides real-time search-as-you-type with no additional round trips.',
    security_impact: 'Algolia uses separate API keys for search and administration — the search-only API key is safe to expose client-side. The admin API key must be kept server-side only.',
    cost_profile: 'Free tier — 10,000 searches/month, 10,000 records. Grow plan from $50/month.',
    when_to_use: 'E-commerce sites where search quality directly impacts conversion. Documentation sites and knowledge bases.',
    when_not_to_use: 'Applications with very simple search requirements where database full-text search is sufficient.',
    common_alternatives: ['Elasticsearch', 'Typesense', 'Meilisearch', 'AWS CloudSearch'],
    common_companions: ['React', 'Next.js', 'Shopify', 'Contentful', 'Cloudflare'],
    maturity_signal: 0.90,
    known_weaknesses: ['Pricing can escalate quickly with high search volumes', 'Index synchronisation adds latency between content updates and search results', 'Limited complex query support compared to Elasticsearch'],
    real_world_users: ['Stripe docs', 'Twitch', 'Medium', 'Lacoste', 'Decathlon', 'Gymshark', 'Doctolib']
  },
  {
    name: 'Hotjar',
    category: 'Analytics',
    performance_impact: 'Hotjar adds approximately 50-70KB of JavaScript loaded asynchronously. Session recording captures all user interactions with data batched and sent periodically.',
    security_impact: 'Hotjar automatically masks password fields and payment card inputs. Session recordings store user interaction data on Hotjar\'s servers in the EU. GDPR compliance requires cookie consent.',
    cost_profile: 'Free tier — 35 sessions/day recorded. Plus at $39/month. Business at $99/month.',
    when_to_use: 'UX teams investigating why users are not converting. Product teams identifying confusion points in new features.',
    when_not_to_use: 'Applications where user privacy is paramount. Banking, healthcare, and legal applications.',
    common_alternatives: ['FullStory', 'LogRocket', 'Microsoft Clarity (free)', 'Mouseflow', 'Crazy Egg'],
    common_companions: ['Google Analytics', 'Google Tag Manager', 'WordPress', 'Shopify', 'React'],
    maturity_signal: 0.80,
    known_weaknesses: ['Session recording is inherently privacy-invasive', 'Recording accuracy degrades on highly dynamic JavaScript applications', 'Daily session limits on lower tiers require sampling'],
    real_world_users: ['Shopify', 'Unbounce', 'Typeform', 'Buffer', 'Trustpilot']
  },
  {
    name: 'Paystack',
    category: 'Payment',
    performance_impact: 'Paystack\'s checkout script loads from their CDN asynchronously. The payment modal opens in an iframe — no page navigation required.',
    security_impact: 'Paystack is PCI DSS compliant. Card data is tokenised. 3D Secure authentication is supported. Webhook signatures should be verified using HMAC-SHA512.',
    cost_profile: 'No monthly fees. 1.5% per transaction for Nigerian cards. 3.9% + ₦100 for international cards.',
    when_to_use: 'Nigerian, Ghanaian, South African, Kenyan businesses accepting local card payments. E-commerce in African markets.',
    when_not_to_use: 'Businesses operating exclusively in markets outside Paystack\'s supported countries.',
    common_alternatives: ['Flutterwave', 'Stripe', 'Interswitch', 'Monnify'],
    common_companions: ['React', 'WordPress', 'WooCommerce', 'Google Analytics', 'Cloudflare'],
    maturity_signal: 0.82,
    known_weaknesses: ['Limited to African markets', 'Bank verification requirements add friction', 'International card acceptance fees are higher than domestic'],
    real_world_users: ['Piggyvest', 'Cowrywise', 'Printivo', 'Hotels.ng', 'Mono']
  },
  {
    name: 'Flutterwave',
    category: 'Payment',
    performance_impact: 'Flutterwave\'s checkout loads from their CDN. The FlutterwaveCheckout function renders a modal payment UI without page navigation.',
    security_impact: 'Flutterwave is PCI DSS Level 1 compliant. Card data is tokenised. Transaction verification via verify endpoint should always be performed server-side.',
    cost_profile: 'No monthly fees. 1.4% per transaction for local cards in Nigeria. 3.8% for international Visa and Mastercard.',
    when_to_use: 'Businesses operating across multiple African markets. Platforms needing mobile money support across East and West Africa.',
    when_not_to_use: 'Businesses operating exclusively in Nigeria where Paystack\'s local optimisation provides advantages.',
    common_alternatives: ['Paystack', 'Stripe', 'Interswitch', 'Cellulant', 'DPO Group'],
    common_companions: ['React', 'Google Analytics', 'Cloudflare', 'WordPress', 'WooCommerce'],
    maturity_signal: 0.80,
    known_weaknesses: ['Fraud incidents in 2022 raised questions about internal controls', 'Customer support quality inconsistent', 'Settlement timing varies by country and payment method'],
    real_world_users: ['Uber Africa', 'Booking.com Africa', 'Mono']
  },
  {
    name: 'Drupal',
    category: 'CMS',
    performance_impact: 'Drupal 10 with BigPipe technology delivers progressive page rendering. With a full-page caching layer (Varnish or Cloudflare) Drupal can deliver pages in under 100ms.',
    security_impact: 'Drupal has a dedicated security team. Drupalgeddon (CVE-2018-7600) demonstrated the severity of Drupal vulnerabilities. Contributed module quality varies.',
    cost_profile: 'Software is free. Hosting on managed Drupal hosting (Acquia, Pantheon) costs $500-5000/month for enterprise.',
    when_to_use: 'Government, education, and non-profit organisations needing WCAG accessibility compliance. Large enterprises managing thousands of pages in multiple languages.',
    when_not_to_use: 'Marketing sites and blogs where WordPress or a headless CMS is simpler.',
    common_alternatives: ['WordPress', 'Contentful', 'Sitecore', 'Adobe Experience Manager'],
    common_companions: ['PHP', 'Nginx', 'Apache', 'Cloudflare', 'Google Analytics', 'jQuery'],
    maturity_signal: 0.75,
    known_weaknesses: ['Very steep learning curve', 'Default UI is dated', 'Module dependency conflicts during major version upgrades', 'Performance requires expert configuration'],
    real_world_users: ['White House (whitehouse.gov)', 'NASA', 'Australian Government', 'Harvard University', 'MIT']
  },
  {
    name: 'Bootstrap',
    category: 'CSS Framework',
    performance_impact: 'Bootstrap 5 CSS is approximately 30KB gzipped — significantly larger than Tailwind CSS\'s purged production build. Custom builds reduce this significantly.',
    security_impact: 'Bootstrap itself has no security implications. Dependencies like Popper.js must be kept updated.',
    cost_profile: 'Bootstrap is free and open source under MIT licence.',
    when_to_use: 'Rapid prototyping. Backend developers building admin interfaces. Projects where the team is already familiar with Bootstrap\'s conventions.',
    when_not_to_use: 'Consumer-facing products where Bootstrap\'s recognisable appearance undermines brand differentiation. Performance-critical applications.',
    common_alternatives: ['Tailwind CSS', 'Material UI', 'Bulma', 'Foundation', 'Chakra UI'],
    common_companions: ['jQuery', 'WordPress', 'PHP', 'Google Analytics', 'Font Awesome'],
    maturity_signal: 0.70,
    known_weaknesses: ['Sites built with default Bootstrap are visually recognisable', 'Larger CSS payload than utility-first alternatives', 'jQuery dependency in older versions adds significant JavaScript weight', 'Increasingly considered legacy in React/Vue ecosystems'],
    real_world_users: 'Bootstrap is used by approximately 22% of all websites according to W3Techs'
  }
];

// ─── ARCHITECTURE PATTERNS ────────────────────────────────────────────────────

const ARCHITECTURE_PATTERNS = [
  {
    pattern_id: 'nextjs_vercel_cloudflare',
    technologies: ['Next.js', 'React', 'Vercel', 'Cloudflare', 'Tailwind CSS'],
    min_match: 3,
    summary: 'This is a production-grade JAMstack SSR stack combining Next.js on Vercel with Cloudflare at the edge. This specific combination is the gold standard for modern React applications requiring both performance and SEO. Static pages are served from Vercel\'s edge network in under 50ms globally, with Cloudflare providing DDoS protection, WAF, and additional caching. Used by companies like Linear, Loom, and Vercel itself — this architecture handles millions of users with minimal infrastructure management.',
    strengths: ['Sub-50ms TTFB globally for static pages — industry-leading performance', 'Automatic preview deployments for every Git branch accelerate team review cycles', 'Next.js ISR enables content freshness without full rebuilds', 'Cloudflare WAF filters OWASP Top 10 attacks before they reach the origin', 'Zero-configuration deployment from Git — no DevOps overhead'],
    weaknesses: ['Vercel serverless function cold starts add 200-1000ms latency to infrequently accessed dynamic routes', 'Vendor lock-in to Vercel for optimal Next.js performance', 'Metered Vercel function pricing can produce unexpected bills at scale'],
    maturity_score: 94,
    architecture_type: 'JAMstack SSR',
    real_world_examples: ['Linear', 'Loom', 'Vercel', 'Sonos', 'Tripadvisor'],
    performance_profile: 'Excellent — sub-50ms TTFB for static, 100-400ms for dynamic routes',
    cost_profile: 'Low to medium — Vercel free tier covers small projects',
    scalability_profile: 'Excellent — scales to millions of users without infrastructure changes',
    typical_team_size: '2-50 engineers',
    typical_company_stage: 'Seed to Series C'
  },
  {
    pattern_id: 'react_aws_enterprise',
    technologies: ['React', 'AWS', 'AWS CloudFront', 'Sentry', 'Segment'],
    min_match: 3,
    summary: 'An enterprise-grade React application deployed on AWS infrastructure with comprehensive observability and analytics. This pattern is characteristic of mature technology organisations managing mission-critical applications. AWS provides infrastructure flexibility and compliance certifications.',
    strengths: ['AWS\'s comprehensive compliance certifications satisfy enterprise procurement requirements', 'CloudFront global CDN with 400+ edge locations delivers excellent performance', 'Full infrastructure control enables custom security configurations'],
    weaknesses: ['AWS complexity requires dedicated DevOps engineers', 'Infrastructure costs at scale are significantly higher than Vercel or Netlify', 'No zero-configuration deployment'],
    maturity_score: 91,
    architecture_type: 'Enterprise SPA',
    real_world_examples: ['Airbnb', 'Dropbox', 'Twilio', 'Atlassian'],
    performance_profile: 'Good to excellent — depends on CloudFront configuration',
    cost_profile: 'High — AWS + observability stack typically $2000-10000/month at scale',
    scalability_profile: 'Excellent — AWS scales to any load',
    typical_team_size: '20-500 engineers',
    typical_company_stage: 'Series B to Public'
  },
  {
    pattern_id: 'wordpress_cloudflare_woocommerce',
    technologies: ['WordPress', 'WooCommerce', 'Cloudflare', 'Stripe', 'Google Analytics'],
    min_match: 3,
    summary: 'The most widely deployed e-commerce stack in the world — WordPress with WooCommerce, protected and accelerated by Cloudflare. This combination powers millions of online stores from small boutiques to established brands. Cloudflare compensates for WordPress\'s performance limitations through full-page caching at the edge and protects wp-admin endpoints from brute force attacks.',
    strengths: ['The largest ecosystem of themes, plugins, and developers in existence', 'Cloudflare caches WordPress pages at the edge', 'Low initial cost', 'Non-technical users can manage content without developer involvement'],
    weaknesses: ['Plugin bloat is the primary performance killer', 'WordPress\'s large attack surface requires continuous security maintenance', 'Database-driven page rendering struggles under high concurrent traffic'],
    maturity_score: 68,
    architecture_type: 'WordPress E-Commerce',
    real_world_examples: ['Numerous SMB e-commerce stores — WooCommerce powers 23% of all online stores'],
    performance_profile: 'Variable — poor without caching, acceptable with Cloudflare',
    cost_profile: 'Low to medium — $50-500/month',
    scalability_profile: 'Moderate — requires dedicated hosting at scale',
    typical_team_size: '1-10 people',
    typical_company_stage: 'Early stage to established SMB'
  },
  {
    pattern_id: 'shopify_klaviyo_facebook',
    technologies: ['Shopify', 'Facebook Pixel', 'Google Analytics', 'Google Tag Manager'],
    min_match: 3,
    summary: 'A Shopify store with a complete direct-to-consumer marketing stack. This is the playbook stack for modern DTC brands. The Facebook Pixel feeds data that optimises Meta advertising campaigns. This combination is responsible for growth at brands like Gymshark, Allbirds, and thousands of DTC success stories.',
    strengths: ['Shopify\'s reliable infrastructure handles traffic spikes from marketing campaigns', 'Google Tag Manager enables the marketing team to add tracking without engineering support', 'Complete customer data loop — purchase data flows from Shopify automatically'],
    weaknesses: ['Facebook Pixel data accuracy has degraded significantly since iOS 14 privacy changes', 'Multiple tracking scripts add page weight', 'Heavy dependence on Meta advertising creates business risk from platform policy changes'],
    maturity_score: 78,
    architecture_type: 'Shopify Commerce',
    real_world_examples: ['Gymshark', 'Allbirds', 'Kylie Cosmetics', 'Fashion Nova'],
    performance_profile: 'Good — Shopify\'s infrastructure is reliable but app bloat can impact Core Web Vitals',
    cost_profile: 'Medium to high — Shopify fees + Meta advertising budget',
    scalability_profile: 'Good — Shopify handles scale well',
    typical_team_size: '2-20 people',
    typical_company_stage: 'Early stage to growth-stage DTC'
  },
  {
    pattern_id: 'nuxt_netlify_cloudflare',
    technologies: ['Vue.js', 'Nuxt.js', 'Netlify', 'Cloudflare', 'Tailwind CSS'],
    min_match: 3,
    summary: 'A Vue.js JAMstack application built with Nuxt.js and deployed to Netlify with Cloudflare at the edge. The Vue ecosystem\'s answer to the Next.js + Vercel combination. This stack is particularly popular in European development communities.',
    strengths: ['Nuxt 3\'s Nitro engine delivers excellent SSR and static generation performance', 'Vue\'s template syntax reduces learning curve compared to React\'s JSX', 'Strong TypeScript support in Nuxt 3'],
    weaknesses: ['Smaller ecosystem than Next.js + React', 'Nuxt 2 to Nuxt 3 migration was disruptive', 'Hiring Vue developers is harder than React developers in most markets'],
    maturity_score: 86,
    architecture_type: 'JAMstack SSR',
    real_world_examples: ['GitLab (marketing)', 'Chess.com', 'Xiaomi'],
    performance_profile: 'Excellent — comparable to Next.js with proper configuration',
    cost_profile: 'Low — Netlify free tier covers most projects',
    scalability_profile: 'Good — Netlify and Cloudflare scale automatically',
    typical_team_size: '2-30 engineers',
    typical_company_stage: 'Seed to Series B'
  },
  {
    pattern_id: 'django_aws_nginx',
    technologies: ['Django', 'AWS', 'Nginx', 'Cloudflare', 'Sentry'],
    min_match: 3,
    summary: 'A server-rendered Django application deployed on AWS with Nginx as the web server and Cloudflare providing CDN and security. Django\'s batteries-included philosophy makes it one of the most productive frameworks for data-heavy applications.',
    strengths: ['Django\'s built-in admin interface provides instant data management', 'PostgreSQL on AWS RDS with Django ORM handles complex relational data', 'Django\'s security defaults prevent common web vulnerabilities'],
    weaknesses: ['Server-rendered Django pages are slower than statically generated alternatives', 'Django\'s ORM can generate inefficient queries for complex relationships', 'Deployment complexity is higher than PaaS alternatives'],
    maturity_score: 82,
    architecture_type: 'Django MVC',
    real_world_examples: ['Instagram (original architecture)', 'Disqus', 'Pinterest', 'Mozilla'],
    performance_profile: 'Good — with caching and query optimisation',
    cost_profile: 'Medium — AWS EC2 plus RDS typically $200-2000/month',
    scalability_profile: 'Good — horizontal scaling handles significant traffic',
    typical_team_size: '3-50 engineers',
    typical_company_stage: 'Seed to growth stage'
  },
  {
    pattern_id: 'laravel_vue_cloudflare',
    technologies: ['Laravel', 'Vue.js', 'PHP', 'Cloudflare', 'Nginx'],
    min_match: 3,
    summary: 'Laravel with Vue.js frontend and Cloudflare CDN. Laravel\'s elegant syntax accelerates development. This stack is extremely popular in agency and freelance development communities where PHP expertise is abundant.',
    strengths: ['Laravel\'s expressive syntax and comprehensive built-in features accelerate development', 'Large PHP developer talent pool globally — easier and cheaper to hire', 'Cloudflare provides free CDN and SSL'],
    weaknesses: ['PHP\'s synchronous execution model handles concurrent connections less efficiently', 'Laravel\'s Eloquent ORM can generate inefficient queries', 'Vue.js within Laravel creates an architectural hybrid that can confuse developers'],
    maturity_score: 78,
    architecture_type: 'Laravel MVC',
    real_world_examples: ['Laracasts', 'Invoice Ninja'],
    performance_profile: 'Good with caching',
    cost_profile: 'Low to medium — shared or VPS hosting $20-200/month',
    scalability_profile: 'Moderate — horizontal scaling requires careful configuration',
    typical_team_size: '1-20 engineers',
    typical_company_stage: 'Agency projects to established SMBs'
  },
  {
    pattern_id: 'wordpress_standard_cloudflare',
    technologies: ['WordPress', 'PHP', 'jQuery', 'Cloudflare', 'Google Analytics'],
    min_match: 3,
    summary: 'A standard WordPress installation with Cloudflare CDN and Google Analytics — the most common website stack on the internet. This pattern powers 43% of all websites globally. The addition of Cloudflare transforms WordPress\'s typically poor performance into an acceptable user experience.',
    strengths: ['The most documented and understood web technology stack in existence', 'Cloudflare\'s full-page caching delivers fast page loads despite WordPress\'s database-intensive rendering', 'Non-technical users can manage all content without developer involvement'],
    weaknesses: ['Security maintenance burden is significant', 'Plugin updates can break site functionality', 'Database queries multiply with each plugin'],
    maturity_score: 58,
    architecture_type: 'WordPress CMS',
    real_world_examples: ['TechCrunch', 'BBC America', 'Sony Music'],
    performance_profile: 'Variable — poor without Cloudflare caching, acceptable with it',
    cost_profile: 'Very low — $10-50/month',
    scalability_profile: 'Limited — requires managed WordPress hosting at scale',
    typical_team_size: '1-5 people',
    typical_company_stage: 'Individual to small business'
  },
  {
    pattern_id: 'astro_cloudflare_tailwind',
    technologies: ['Astro', 'Cloudflare', 'Tailwind CSS', 'Google Analytics'],
    min_match: 2,
    summary: 'An Astro site deployed to Cloudflare Pages with Tailwind CSS — the highest-performance content site architecture currently available. Astro ships zero JavaScript by default, Cloudflare Pages serves from 300+ global edge locations, and Tailwind\'s purged CSS is typically under 10KB.',
    strengths: ['Zero JavaScript by default — fastest possible page loads for content-focused sites', 'Cloudflare Pages free tier provides enterprise-grade global CDN at no cost', 'Lighthouse scores of 95-100 are routine'],
    weaknesses: ['Not appropriate for highly interactive applications', 'Astro ecosystem is younger than Next.js', 'Content Collections require upfront content structure planning'],
    maturity_score: 88,
    architecture_type: 'JAMstack Static',
    real_world_examples: ['Google (several docs sites)', 'Rolex', 'Porsche', 'NordVPN marketing'],
    performance_profile: 'Best in class — Lighthouse 95-100 routinely achievable',
    cost_profile: 'Very low — Cloudflare Pages free tier',
    scalability_profile: 'Excellent — static files scale infinitely on CDN',
    typical_team_size: '1-20 engineers',
    typical_company_stage: 'Any stage — content and marketing sites'
  },
  {
    pattern_id: 'react_firebase_stripe',
    technologies: ['React', 'Firebase', 'Stripe', 'Google Analytics'],
    min_match: 3,
    summary: 'A React SPA with Firebase backend and Stripe payments — the classic startup stack for rapidly building and launching a SaaS product. Firebase eliminates backend infrastructure — authentication, database, file storage, and real-time subscriptions are available without managing servers.',
    strengths: ['Firebase eliminates backend server management entirely', 'Real-time data synchronisation via Firestore', 'Stripe Billing handles subscription management, invoicing, and dunning automatically', 'Firebase free tier plus Stripe zero-monthly-fee model means zero fixed cost for pre-revenue products'],
    weaknesses: ['Firebase vendor lock-in is severe', 'Firestore NoSQL model struggles with relational data', 'Firebase Security Rules bugs can expose all user data publicly', 'Cloud Function cold starts add latency for payment webhook handling'],
    maturity_score: 74,
    architecture_type: 'SPA Firebase',
    real_world_examples: ['Numerous early-stage SaaS products'],
    performance_profile: 'Variable — React SPA has initial load penalty',
    cost_profile: 'Low initially — Firebase free tier + Stripe no monthly fee',
    scalability_profile: 'Good for reads, expensive for high write volumes',
    typical_team_size: '1-5 engineers',
    typical_company_stage: 'Idea to early revenue'
  }
];

// ─── INDUSTRY BENCHMARKS ─────────────────────────────────────────────────────

const INDUSTRY_BENCHMARKS = [
  {
    industry: 'SaaS',
    top_technologies: [{ name: 'React', frequency: 0.78 }, { name: 'Cloudflare', frequency: 0.72 }, { name: 'Google Analytics', frequency: 0.68 }, { name: 'Stripe', frequency: 0.65 }, { name: 'Intercom', frequency: 0.58 }, { name: 'Sentry', frequency: 0.62 }, { name: 'Google Tag Manager', frequency: 0.60 }, { name: 'Next.js', frequency: 0.55 }, { name: 'Segment', frequency: 0.45 }, { name: 'HubSpot', frequency: 0.42 }],
    average_maturity_score: 78,
    common_weaknesses: ['Content Security Policy absent in 58% of SaaS products analysed', 'Referrer-Policy header missing in 64% of SaaS products', 'No structured data markup found in 71% of SaaS marketing pages', 'Permissions-Policy header absent in 78% of SaaS products'],
    rising_technologies: ['Astro', 'Supabase', 'PostHog', 'Vercel', 'Tailwind CSS'],
    declining_technologies: ['jQuery', 'Bootstrap', 'Heroku', 'Angular', 'Google Universal Analytics'],
    typical_stack: ['React', 'Next.js', 'Tailwind CSS', 'Vercel', 'Cloudflare', 'Stripe', 'Sentry', 'Intercom'],
    security_baseline: 'SaaS products average a risk score of 0.35 — better than most industries but significant security header gaps remain',
    performance_baseline: 'Average TTFB of 380ms — SaaS products prioritise feature velocity over performance in early stages',
    seo_baseline: 'Marketing pages average SEO score of 62/100 — strong on basics but weak on structured data',
    notable_companies: ['Stripe', 'Notion', 'Linear', 'Figma', 'Airtable', 'Slack', 'Intercom', 'HubSpot']
  },
  {
    industry: 'E-Commerce',
    top_technologies: [{ name: 'Shopify', frequency: 0.45 }, { name: 'Cloudflare', frequency: 0.82 }, { name: 'Google Analytics', frequency: 0.88 }, { name: 'Google Tag Manager', frequency: 0.80 }, { name: 'Facebook Pixel', frequency: 0.74 }, { name: 'WooCommerce', frequency: 0.30 }, { name: 'Stripe', frequency: 0.60 }, { name: 'Hotjar', frequency: 0.38 }, { name: 'PayPal', frequency: 0.55 }],
    average_maturity_score: 65,
    common_weaknesses: ['Content Security Policy absent in 72% of e-commerce sites — particularly risky for payment page security', 'No structured data product markup in 45% of product pages — missing rich snippets in Google Shopping', 'Images missing alt text in 68% of product catalogues'],
    rising_technologies: ['Shopify', 'Klaviyo', 'Algolia', 'TikTok Pixel'],
    declining_technologies: ['Magento 1', 'OpenCart', 'osCommerce', 'Universal Analytics'],
    typical_stack: ['Shopify', 'Cloudflare', 'Google Analytics', 'Google Tag Manager', 'Facebook Pixel', 'Stripe'],
    security_baseline: 'E-commerce sites average a risk score of 0.42 — checkout pages often lack CSP making them targets for card skimming',
    performance_baseline: 'Average TTFB of 620ms — product image weight and app bloat are the primary bottlenecks',
    seo_baseline: 'Product pages average SEO score of 58/100 — strong on titles, weak on structured data',
    notable_companies: ['Gymshark', 'Allbirds', 'Kylie Cosmetics', 'Heinz', 'Staples']
  },
  {
    industry: 'Enterprise',
    top_technologies: [{ name: 'React', frequency: 0.65 }, { name: 'Angular', frequency: 0.48 }, { name: 'AWS', frequency: 0.72 }, { name: 'Azure', frequency: 0.55 }, { name: 'Cloudflare', frequency: 0.60 }, { name: 'Google Analytics', frequency: 0.70 }, { name: 'Sentry', frequency: 0.52 }],
    average_maturity_score: 85,
    common_weaknesses: ['Legacy JavaScript libraries present in 38% of enterprise sites alongside modern frameworks', 'Inconsistent security header implementation across different product areas in 52% of enterprises', 'Missing Permissions-Policy header in 70% of enterprise applications'],
    rising_technologies: ['React', 'Next.js', 'Kubernetes', 'Cloudflare', 'Segment', 'Datadog'],
    declining_technologies: ['Angular.js (v1)', 'jQuery', 'Internet Explorer compatibility layers'],
    typical_stack: ['React', 'AWS', 'Cloudflare', 'Sentry', 'Segment', 'Google Tag Manager'],
    security_baseline: 'Enterprise applications average a risk score of 0.22 — significantly better than other industries',
    performance_baseline: 'Average TTFB of 450ms — enterprise infrastructure is reliable but legacy backends add latency',
    seo_baseline: 'Enterprise marketing sites average SEO score of 74/100 — dedicated SEO teams produce consistently strong implementation',
    notable_companies: ['Microsoft', 'IBM', 'Salesforce', 'Oracle', 'SAP', 'Workday']
  },
  {
    industry: 'Media',
    top_technologies: [{ name: 'WordPress', frequency: 0.55 }, { name: 'React', frequency: 0.40 }, { name: 'Cloudflare', frequency: 0.78 }, { name: 'Google Analytics', frequency: 0.90 }, { name: 'Google Tag Manager', frequency: 0.85 }, { name: 'Facebook Pixel', frequency: 0.68 }, { name: 'YouTube', frequency: 0.72 }],
    average_maturity_score: 62,
    common_weaknesses: ['Content Security Policy absent in 80% of media sites — high risk given third-party advertising scripts', 'Third-party advertising and analytics scripts dramatically increase page weight — average page load 4-8 seconds', 'Missing structured data article markup in 48% of media articles'],
    rising_technologies: ['Astro', 'Next.js', 'Cloudflare', 'Consent management platforms'],
    declining_technologies: ['Flash video', 'Silverlight', 'Windows Media Player embeds'],
    typical_stack: ['WordPress', 'Cloudflare', 'Google Analytics', 'Google Tag Manager', 'YouTube', 'Facebook Pixel'],
    security_baseline: 'Media sites average a risk score of 0.55 — one of the worst performing industries due to third-party script proliferation',
    performance_baseline: 'Average TTFB of 850ms — advertising scripts and analytics tags dramatically inflate page weight',
    seo_baseline: 'News sites average SEO score of 68/100 — strong on title and description, weak on structured article markup',
    notable_companies: ['The Guardian', 'BBC', 'CNN', 'The New York Times', 'BuzzFeed']
  },
  {
    industry: 'Agency',
    top_technologies: [{ name: 'WordPress', frequency: 0.62 }, { name: 'Webflow', frequency: 0.28 }, { name: 'Cloudflare', frequency: 0.65 }, { name: 'Google Analytics', frequency: 0.82 }, { name: 'Google Tag Manager', frequency: 0.75 }, { name: 'Bootstrap', frequency: 0.45 }, { name: 'jQuery', frequency: 0.55 }, { name: 'Laravel', frequency: 0.22 }],
    average_maturity_score: 58,
    common_weaknesses: ['Security headers absent on 75% of agency-built sites', 'No structured data on 68% of agency sites', 'Performance optimisation missing from 60% of agency deliverables'],
    rising_technologies: ['Webflow', 'Astro', 'Tailwind CSS', 'Cloudflare', 'Framer'],
    declining_technologies: ['Flash', 'jQuery UI', 'Bootstrap 3', 'PHP 5'],
    typical_stack: ['WordPress', 'Cloudflare', 'Google Analytics', 'Google Tag Manager', 'Bootstrap', 'jQuery'],
    security_baseline: 'Agency sites average a risk score of 0.62 — security is rarely included in standard agency deliverables',
    performance_baseline: 'Average TTFB of 920ms — agency sites often on shared hosting without performance optimisation',
    seo_baseline: 'Agency sites average SEO score of 54/100',
    notable_companies: 'Agency sites are typically built for SMB clients'
  },
  {
    industry: 'SMB',
    top_technologies: [{ name: 'WordPress', frequency: 0.55 }, { name: 'Cloudflare', frequency: 0.50 }, { name: 'Google Analytics', frequency: 0.72 }, { name: 'Google Fonts', frequency: 0.68 }, { name: 'jQuery', frequency: 0.58 }, { name: 'Bootstrap', frequency: 0.42 }, { name: 'Google Maps', frequency: 0.48 }],
    average_maturity_score: 48,
    common_weaknesses: ['Security headers absent on 85% of SMB sites', 'No HTTPS on 12% of SMB sites', 'No mobile viewport meta tag on 22% of SMB sites', 'Images not optimised for web on 65% of SMB sites'],
    rising_technologies: ['Squarespace', 'Wix', 'Webflow', 'Cloudflare'],
    declining_technologies: ['Flash', 'Table-based layouts', 'Macromedia Dreamweaver output'],
    typical_stack: ['WordPress', 'Cloudflare', 'Google Analytics', 'Google Fonts', 'jQuery', 'Bootstrap'],
    security_baseline: 'SMB sites average a risk score of 0.72 — lowest security implementation of all industries',
    performance_baseline: 'Average TTFB of 1200ms — shared hosting without caching',
    seo_baseline: 'SMB sites average SEO score of 42/100',
    notable_companies: 'SMB segment covers millions of local businesses'
  },
  {
    industry: 'Fintech',
    top_technologies: [{ name: 'React', frequency: 0.75 }, { name: 'AWS', frequency: 0.78 }, { name: 'Cloudflare', frequency: 0.68 }, { name: 'Stripe', frequency: 0.55 }, { name: 'Sentry', frequency: 0.65 }, { name: 'Segment', frequency: 0.48 }, { name: 'Google Analytics', frequency: 0.60 }, { name: 'Intercom', frequency: 0.45 }],
    average_maturity_score: 88,
    common_weaknesses: ['Content Security Policy present but weakened by unsafe-inline in 45% of fintech sites', 'Missing Permissions-Policy header in 65% of fintech applications', 'Third-party analytics scripts create GDPR compliance complexity in 55% of fintech products'],
    rising_technologies: ['Plaid', 'Stripe', 'React', 'Next.js', 'Cloudflare Workers', 'Supabase'],
    declining_technologies: ['Flash-based trading platforms', 'Java applets', 'Legacy payment gateways'],
    typical_stack: ['React', 'AWS', 'Cloudflare', 'Stripe', 'Sentry'],
    security_baseline: 'Fintech sites average a risk score of 0.18 — second only to Enterprise',
    performance_baseline: 'Average TTFB of 320ms — fintech products prioritise reliability and performance',
    seo_baseline: 'Fintech marketing sites average SEO score of 72/100',
    notable_companies: ['Stripe', 'Wise', 'Monzo', 'Revolut', 'Robinhood', 'Coinbase', 'Plaid']
  },
  {
    industry: 'Government',
    top_technologies: [{ name: 'Drupal', frequency: 0.42 }, { name: 'WordPress', frequency: 0.38 }, { name: 'jQuery', frequency: 0.72 }, { name: 'Bootstrap', frequency: 0.58 }, { name: 'Google Analytics', frequency: 0.65 }, { name: 'Cloudflare', frequency: 0.45 }],
    average_maturity_score: 55,
    common_weaknesses: ['Outdated jQuery versions on 48% of government sites', 'No structured data on 82% of government sites', 'Missing HSTS header on 42% of government sites', 'Accessibility compliance issues on 65% of government sites'],
    rising_technologies: ['Drupal 10', 'Cloudflare', 'Accessibility testing tools'],
    declining_technologies: ['Internet Explorer compatibility layers', 'Flash', 'Table-based layouts'],
    typical_stack: ['Drupal', 'Apache', 'jQuery', 'Bootstrap', 'Google Analytics', 'Cloudflare'],
    security_baseline: 'Government sites average a risk score of 0.45',
    performance_baseline: 'Average TTFB of 1100ms — legacy infrastructure causes slow response times',
    seo_baseline: 'Government sites average SEO score of 48/100',
    notable_companies: ['USA.gov', 'GOV.UK', 'Australia.gov.au', 'Canada.ca', 'NASA.gov', 'CDC.gov']
  },
  {
    industry: 'Healthcare',
    top_technologies: [{ name: 'React', frequency: 0.55 }, { name: 'WordPress', frequency: 0.40 }, { name: 'AWS', frequency: 0.65 }, { name: 'Cloudflare', frequency: 0.58 }, { name: 'Google Analytics', frequency: 0.62 }, { name: 'HubSpot', frequency: 0.38 }],
    average_maturity_score: 72,
    common_weaknesses: ['Google Analytics usage on 62% of healthcare sites creates HIPAA compliance complexity', 'Missing Content Security Policy on 68% of healthcare sites', 'Third-party scripts on patient portal pages create BAA compliance requirements often overlooked'],
    rising_technologies: ['React', 'Cloudflare', 'Privacy-focused analytics (Plausible, Fathom)'],
    declining_technologies: ['Flash-based medical viewers', 'Legacy EHR web portals'],
    typical_stack: ['React', 'AWS', 'Cloudflare', 'Google Analytics', 'HubSpot'],
    security_baseline: 'Healthcare sites average a risk score of 0.28 — HIPAA compliance drives stronger security',
    performance_baseline: 'Average TTFB of 480ms',
    seo_baseline: 'Healthcare sites average SEO score of 65/100',
    notable_companies: ['Mayo Clinic', 'WebMD', 'Healthline', 'ZocDoc', 'Oscar Health']
  },
  {
    industry: 'Education',
    top_technologies: [{ name: 'WordPress', frequency: 0.48 }, { name: 'React', frequency: 0.42 }, { name: 'Cloudflare', frequency: 0.55 }, { name: 'Google Analytics', frequency: 0.75 }, { name: 'YouTube', frequency: 0.78 }, { name: 'Google Fonts', frequency: 0.68 }],
    average_maturity_score: 62,
    common_weaknesses: ['WCAG accessibility compliance issues on 58% of educational sites', 'No structured data course markup on 72% of online learning platforms', 'Cookie consent absent on 42% of education sites collecting student data'],
    rising_technologies: ['React', 'Cloudflare', 'Accessibility tools', 'LMS integrations'],
    declining_technologies: ['Flash course players', 'Java applet simulations'],
    typical_stack: ['WordPress', 'Cloudflare', 'Google Analytics', 'YouTube', 'Google Fonts'],
    security_baseline: 'Education sites average a risk score of 0.45',
    performance_baseline: 'Average TTFB of 720ms — educational institutions often on legacy infrastructure',
    seo_baseline: 'Education sites average SEO score of 58/100',
    notable_companies: ['Coursera', 'Udemy', 'Khan Academy', 'edX', 'Duolingo']
  },
  {
    industry: 'Personal',
    top_technologies: [{ name: 'Cloudflare', frequency: 0.45 }, { name: 'Google Analytics', frequency: 0.55 }, { name: 'Google Fonts', frequency: 0.72 }, { name: 'Tailwind CSS', frequency: 0.38 }, { name: 'Bootstrap', frequency: 0.40 }, { name: 'Netlify', frequency: 0.32 }],
    average_maturity_score: 45,
    common_weaknesses: ['No meta description on 52% of personal sites', 'No Open Graph tags on 68% of personal sites', 'No HTTPS on 18% of personal sites', 'Missing structured data on 88% of personal sites'],
    rising_technologies: ['Astro', 'Tailwind CSS', 'Netlify', 'Cloudflare Pages'],
    declining_technologies: ['Adobe Dreamweaver output', 'Table-based layouts', 'GeoCities-era design patterns'],
    typical_stack: ['Netlify', 'Cloudflare', 'Google Analytics', 'Google Fonts', 'Tailwind'],
    security_baseline: 'Personal sites average a risk score of 0.65',
    performance_baseline: 'Average TTFB of 580ms',
    seo_baseline: 'Personal sites average SEO score of 38/100',
    notable_companies: 'Personal sites — developer portfolios, personal blogs, hobby projects'
  }
];

// ─── CHECK TABLE IS EMPTY ─────────────────────────────────────────────────────

async function isTableEmpty(tableName) {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    if (error) {
      logger.warn(`Auto-seed: could not check table ${tableName}: ${error.message}`);
      return false;
    }

    return (count || 0) === 0;

  } catch (err) {
    logger.warn(`Auto-seed: error checking table ${tableName}: ${err.message}`);
    return false;
  }
}

// ─── SEED TECH PATTERNS ───────────────────────────────────────────────────────

async function seedTechPatterns() {
  logger.info('Auto-seed: seeding tech_patterns table');
  let success = 0;
  let failed = 0;

  for (const pattern of PATTERNS) {
    try {
      const { error } = await supabase
        .from('tech_patterns')
        .upsert(pattern, { onConflict: 'name' });

      if (error) throw new Error(error.message);
      success++;
    } catch (err) {
      logger.warn(`Auto-seed: failed to seed pattern "${pattern.name}": ${err.message}`);
      failed++;
    }
  }

  logger.info(`Auto-seed: tech_patterns complete — ${success} seeded, ${failed} failed`);
}

// ─── SEED CLUSTERS ────────────────────────────────────────────────────────────

async function seedClusters() {
  logger.info('Auto-seed: seeding clusters table');
  let success = 0;
  let failed = 0;

  for (const cluster of CLUSTERS) {
    try {
      const { error } = await supabase
        .from('clusters')
        .upsert(cluster, { onConflict: 'cluster_id' });

      if (error) throw new Error(error.message);
      success++;
    } catch (err) {
      logger.warn(`Auto-seed: failed to seed cluster "${cluster.name}": ${err.message}`);
      failed++;
    }
  }

  logger.info(`Auto-seed: clusters complete — ${success} seeded, ${failed} failed`);
}

// ─── SEED CO-OCCURRENCES ──────────────────────────────────────────────────────

async function seedCoOccurrences() {
  logger.info('Auto-seed: seeding co_occurrence table');
  let success = 0;
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

      if (error) throw new Error(error.message);
      success++;
    } catch (err) {
      logger.warn(`Auto-seed: failed to seed co-occurrence pair: ${err.message}`);
      failed++;
    }
  }

  logger.info(`Auto-seed: co_occurrence complete — ${success} seeded, ${failed} failed`);
}

// ─── SEED TECH INTELLIGENCE ───────────────────────────────────────────────────

async function seedTechIntelligence() {
  logger.info('Auto-seed: seeding tech_intelligence table');
  let success = 0;
  let failed = 0;

  for (const profile of TECH_INTELLIGENCE) {
    try {
      const { error } = await supabase
        .from('tech_intelligence')
        .upsert(profile, { onConflict: 'name' });

      if (error) throw new Error(error.message);
      success++;
    } catch (err) {
      logger.warn(`Auto-seed: failed to seed tech intelligence "${profile.name}": ${err.message}`);
      failed++;
    }
  }

  logger.info(`Auto-seed: tech_intelligence complete — ${success} seeded, ${failed} failed`);
}

// ─── SEED ARCHITECTURE PATTERNS ──────────────────────────────────────────────

async function seedArchitecturePatterns() {
  logger.info('Auto-seed: seeding architecture_patterns table');
  let success = 0;
  let failed = 0;

  for (const pattern of ARCHITECTURE_PATTERNS) {
    try {
      const { error } = await supabase
        .from('architecture_patterns')
        .upsert(pattern, { onConflict: 'pattern_id' });

      if (error) throw new Error(error.message);
      success++;
    } catch (err) {
      logger.warn(`Auto-seed: failed to seed architecture pattern "${pattern.pattern_id}": ${err.message}`);
      failed++;
    }
  }

  logger.info(`Auto-seed: architecture_patterns complete — ${success} seeded, ${failed} failed`);
}

// ─── SEED INDUSTRY BENCHMARKS ─────────────────────────────────────────────────

async function seedIndustryBenchmarks() {
  logger.info('Auto-seed: seeding industry_benchmarks table');
  let success = 0;
  let failed = 0;

  for (const benchmark of INDUSTRY_BENCHMARKS) {
    try {
      const { error } = await supabase
        .from('industry_benchmarks')
        .upsert(benchmark, { onConflict: 'industry' });

      if (error) throw new Error(error.message);
      success++;
    } catch (err) {
      logger.warn(`Auto-seed: failed to seed industry benchmark "${benchmark.industry}": ${err.message}`);
      failed++;
    }
  }

  logger.info(`Auto-seed: industry_benchmarks complete — ${success} seeded, ${failed} failed`);
}

// ─── MASTER AUTO-SEED ─────────────────────────────────────────────────────────

async function runAutoSeed() {
  try {
    logger.info('Auto-seed: checking if database needs seeding');

    const [
      patternsEmpty,
      clustersEmpty,
      coOccurrenceEmpty,
      techIntelligenceEmpty,
      architecturePatternsEmpty,
      industryBenchmarksEmpty
    ] = await Promise.all([
      isTableEmpty('tech_patterns'),
      isTableEmpty('clusters'),
      isTableEmpty('co_occurrence'),
      isTableEmpty('tech_intelligence'),
      isTableEmpty('architecture_patterns'),
      isTableEmpty('industry_benchmarks')
    ]);

    const needsSeeding =
      patternsEmpty ||
      clustersEmpty ||
      coOccurrenceEmpty ||
      techIntelligenceEmpty ||
      architecturePatternsEmpty ||
      industryBenchmarksEmpty;

    if (!needsSeeding) {
      logger.info('Auto-seed: all tables have data — skipping seed');
      return;
    }

    logger.info('Auto-seed: empty tables detected — starting seed process');
    logger.info(`Auto-seed: tech_patterns empty: ${patternsEmpty}, clusters empty: ${clustersEmpty}, co_occurrence empty: ${coOccurrenceEmpty}, tech_intelligence empty: ${techIntelligenceEmpty}, architecture_patterns empty: ${architecturePatternsEmpty}, industry_benchmarks empty: ${industryBenchmarksEmpty}`);

    if (patternsEmpty) await seedTechPatterns();
    if (clustersEmpty) await seedClusters();
    if (coOccurrenceEmpty) await seedCoOccurrences();
    if (techIntelligenceEmpty) await seedTechIntelligence();
    if (architecturePatternsEmpty) await seedArchitecturePatterns();
    if (industryBenchmarksEmpty) await seedIndustryBenchmarks();

    logger.info('Auto-seed: database seeding complete — EIGE v10 intelligence engine is fully loaded');

  } catch (err) {
    logger.error(`Auto-seed: seeding failed: ${err.message}`);
    logger.error('Auto-seed: the tool will still start but intelligence quality may be limited until seed data is loaded');
  }
}

module.exports = { runAutoSeed };
