'use strict';

// ─── STARTUP AUTO-SEED ────────────────────────────────────────────────────────
// This module runs once during server startup.
// It checks each seeded table and runs the appropriate seed data
// if the table is empty. If tables already have data it skips
// silently — making it completely safe to run on every boot.
//
// This means:
//   - First deployment: seeds all tables automatically
//   - Subsequent deployments: skips seeding, zero overhead
//   - After a database reset: re-seeds automatically on next boot
//   - No manual seed commands ever needed in production

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
    html_patterns: ['tailwindcss','tw-','tailwind\\.config','class=\"[^\"]*flex[^\"]*\"','class=\"[^\"]*grid[^\"]*\"','class=\"[^\"]*px-[^\"]*\"','class=\"[^\"]*text-[^\"]*\"','class=\"[^\"]*bg-[^\"]*\"','class=\"[^\"]*rounded[^\"]*\"','class=\"[^\"]*hover:[^\"]*\"'],
    header_patterns: [],
    script_patterns: ['tailwindcss','cdn\\.tailwindcss\\.com'],
    url_patterns: [],
    version_patterns: ['tailwindcss@([\\d.]+)','\"tailwindcss\":\"([\\d.]+)\"'],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.35, min_confidence: 0.35
  },
  {
    name: 'Bootstrap',
    category: 'CSS Framework',
    html_patterns: ['bootstrap','data-bs-','data-toggle=','data-dismiss=','class=\"[^\"]*container[^\"]*\"','class=\"[^\"]*row[^\"]*\"','class=\"[^\"]*col-[^\"]*\"','class=\"[^\"]*btn[^\"]*\"','class=\"[^\"]*navbar[^\"]*\"','class=\"[^\"]*modal[^\"]*\"'],
    header_patterns: [],
    script_patterns: ['bootstrap\\.min\\.js','bootstrap\\.bundle\\.min\\.js','getbootstrap\\.com','cdn\\.jsdelivr\\.net/npm/bootstrap'],
    url_patterns: [],
    version_patterns: ['bootstrap@([\\d.]+)','\"bootstrap\":\"([\\d.]+)\"','Bootstrap v([\\d.]+)'],
    html_weight: 0.40, header_weight: 0.10, script_weight: 0.40, min_confidence: 0.35
  },
  {
    name: 'Google Analytics',
    category: 'Analytics',
    html_patterns: ['google-analytics\\.com/analytics\\.js','GoogleAnalyticsObject','ga\\(\'create\'','gtag\\(','UA-[0-9]+-[0-9]+','G-[A-Z0-9]+','AW-[0-9]+'],
    header_patterns: [],
    script_patterns: ['google-analytics\\.com/analytics\\.js','googletagmanager\\.com/gtag/js','google-analytics\\.com/ga\\.js'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.38
  },
  {
    name: 'Google Tag Manager',
    category: 'Tag Manager',
    html_patterns: ['GTM-[A-Z0-9]+','googletagmanager\\.com','dataLayer\\.push','dataLayer = \\[\\]','gtm\\.js'],
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
  {
    cluster_id: 'jamstack_react',
    name: 'JAMstack React',
    description: 'A modern JAMstack architecture built on React with static site generation or server-side rendering. Typically deployed on edge hosting platforms like Vercel or Netlify with CDN delivery.',
    feature_vector: { 'React': 0.95, 'Next.js': 0.90, 'Vercel': 0.80, 'Netlify': 0.60, 'Tailwind CSS': 0.65, 'Cloudflare': 0.55, 'Google Analytics': 0.50, 'Sentry': 0.45 },
    adjacent_clusters: ['jamstack_vue', 'enterprise_saas', 'headless_commerce']
  },
  {
    cluster_id: 'jamstack_vue',
    name: 'JAMstack Vue',
    description: 'A modern JAMstack architecture built on Vue.js or Nuxt.js with static generation or SSR.',
    feature_vector: { 'Vue.js': 0.95, 'Nuxt.js': 0.85, 'Netlify': 0.65, 'Vercel': 0.55, 'Tailwind CSS': 0.55, 'Cloudflare': 0.50, 'Google Analytics': 0.50 },
    adjacent_clusters: ['jamstack_react', 'spa_modern', 'enterprise_saas']
  },
  {
    cluster_id: 'jamstack_astro',
    name: 'JAMstack Astro',
    description: 'A content-focused JAMstack architecture built with Astro. Prioritises minimal JavaScript delivery through island architecture.',
    feature_vector: { 'Astro': 0.95, 'Tailwind CSS': 0.70, 'Netlify': 0.60, 'Vercel': 0.55, 'Cloudflare': 0.50, 'React': 0.40 },
    adjacent_clusters: ['jamstack_react', 'jamstack_vue', 'static_site']
  },
  {
    cluster_id: 'spa_modern',
    name: 'Modern SPA',
    description: 'A Single Page Application built with a modern JavaScript framework without server-side rendering.',
    feature_vector: { 'React': 0.80, 'Angular': 0.70, 'Vue.js': 0.70, 'Svelte': 0.60, 'AWS': 0.50, 'Bootstrap': 0.40, 'Google Analytics': 0.45 },
    adjacent_clusters: ['jamstack_react', 'enterprise_saas', 'jamstack_vue']
  },
  {
    cluster_id: 'wordpress_standard',
    name: 'WordPress Standard',
    description: 'A standard WordPress CMS installation with traditional server-side PHP rendering.',
    feature_vector: { 'WordPress': 0.98, 'PHP': 0.85, 'jQuery': 0.80, 'Cloudflare': 0.55, 'Bootstrap': 0.40, 'Google Analytics': 0.65, 'Google Tag Manager': 0.50 },
    adjacent_clusters: ['wordpress_ecommerce', 'cms_traditional', 'headless_cms']
  },
  {
    cluster_id: 'wordpress_ecommerce',
    name: 'WordPress E-Commerce',
    description: 'A WordPress installation with WooCommerce powering an online store.',
    feature_vector: { 'WordPress': 0.98, 'WooCommerce': 0.98, 'PHP': 0.85, 'jQuery': 0.80, 'Cloudflare': 0.55, 'Stripe': 0.60, 'PayPal': 0.55, 'Google Analytics': 0.65 },
    adjacent_clusters: ['shopify_standard', 'wordpress_standard', 'headless_commerce']
  },
  {
    cluster_id: 'shopify_standard',
    name: 'Shopify Commerce',
    description: 'A Shopify-powered e-commerce store using Shopify\'s hosted platform.',
    feature_vector: { 'Shopify': 0.98, 'Cloudflare': 0.70, 'Google Analytics': 0.70, 'Google Tag Manager': 0.65, 'Facebook Pixel': 0.60, 'Stripe': 0.50 },
    adjacent_clusters: ['wordpress_ecommerce', 'headless_commerce', 'enterprise_commerce']
  },
  {
    cluster_id: 'headless_commerce',
    name: 'Headless Commerce',
    description: 'A modern e-commerce architecture that decouples the frontend from the backend commerce engine.',
    feature_vector: { 'React': 0.85, 'Next.js': 0.80, 'Shopify': 0.60, 'Vercel': 0.70, 'Cloudflare': 0.60, 'Stripe': 0.65, 'Algolia': 0.50 },
    adjacent_clusters: ['shopify_standard', 'jamstack_react', 'enterprise_commerce']
  },
  {
    cluster_id: 'enterprise_saas',
    name: 'Enterprise SaaS',
    description: 'A sophisticated SaaS product architecture built for scale with enterprise-grade tooling.',
    feature_vector: { 'React': 0.80, 'AWS': 0.70, 'Cloudflare': 0.65, 'Segment': 0.70, 'Intercom': 0.65, 'Sentry': 0.70, 'Stripe': 0.65, 'HubSpot': 0.55 },
    adjacent_clusters: ['jamstack_react', 'spa_modern', 'enterprise_commerce']
  },
  {
    cluster_id: 'enterprise_commerce',
    name: 'Enterprise Commerce',
    description: 'A large-scale enterprise e-commerce platform handling high transaction volumes.',
    feature_vector: { 'AWS': 0.75, 'Cloudflare': 0.55, 'Algolia': 0.60 },
    adjacent_clusters: ['shopify_standard', 'headless_commerce', 'enterprise_saas']
  },
  {
    cluster_id: 'cms_traditional',
    name: 'Traditional CMS',
    description: 'A traditional server-rendered CMS architecture using Drupal or similar platforms.',
    feature_vector: { 'Drupal': 0.90, 'PHP': 0.90, 'jQuery': 0.80, 'Bootstrap': 0.55, 'Google Analytics': 0.60 },
    adjacent_clusters: ['wordpress_standard', 'headless_cms', 'spa_modern']
  },
  {
    cluster_id: 'headless_cms',
    name: 'Headless CMS',
    description: 'A content-first architecture using a headless CMS with a decoupled frontend.',
    feature_vector: { 'React': 0.75, 'Next.js': 0.70, 'Netlify': 0.60, 'Vercel': 0.65, 'Cloudflare': 0.50 },
    adjacent_clusters: ['jamstack_react', 'cms_traditional', 'headless_commerce']
  },
  {
    cluster_id: 'static_site',
    name: 'Static Site',
    description: 'A purely static website with HTML, CSS, and JavaScript files served directly from a CDN.',
    feature_vector: { 'Cloudflare': 0.60, 'Netlify': 0.70, 'Google Analytics': 0.50, 'Bootstrap': 0.40, 'Tailwind CSS': 0.40, 'Google Fonts': 0.55 },
    adjacent_clusters: ['jamstack_astro', 'jamstack_react', 'cms_traditional']
  },
  {
    cluster_id: 'webflow_site',
    name: 'Webflow Site',
    description: 'A website built and hosted on Webflow\'s visual development platform.',
    feature_vector: { 'Webflow': 0.98, 'Cloudflare': 0.65, 'Google Analytics': 0.60, 'Google Tag Manager': 0.55 },
    adjacent_clusters: ['static_site', 'cms_traditional', 'jamstack_react']
  },
  {
    cluster_id: 'django_python',
    name: 'Django Python',
    description: 'A server-rendered web application built with Django.',
    feature_vector: { 'Django': 0.95, 'AWS': 0.60, 'Nginx': 0.65, 'Cloudflare': 0.50, 'Bootstrap': 0.45, 'Google Analytics': 0.50 },
    adjacent_clusters: ['laravel_php', 'enterprise_saas']
  },
  {
    cluster_id: 'laravel_php',
    name: 'Laravel PHP',
    description: 'A server-rendered web application built with the Laravel PHP framework.',
    feature_vector: { 'Laravel': 0.95, 'PHP': 0.90, 'Nginx': 0.60, 'Bootstrap': 0.55, 'Vue.js': 0.50, 'Cloudflare': 0.50 },
    adjacent_clusters: ['wordpress_standard', 'django_python']
  }
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

// ─── MASTER AUTO-SEED ─────────────────────────────────────────────────────────

async function runAutoSeed() {
  try {
    logger.info('Auto-seed: checking if database needs seeding');

    const [
      patternsEmpty,
      clustersEmpty,
      coOccurrenceEmpty
    ] = await Promise.all([
      isTableEmpty('tech_patterns'),
      isTableEmpty('clusters'),
      isTableEmpty('co_occurrence')
    ]);

    const needsSeeding = patternsEmpty || clustersEmpty || coOccurrenceEmpty;

    if (!needsSeeding) {
      logger.info('Auto-seed: all tables have data — skipping seed');
      return;
    }

    logger.info('Auto-seed: empty tables detected — starting seed process');
    logger.info(`Auto-seed: tech_patterns empty: ${patternsEmpty}, clusters empty: ${clustersEmpty}, co_occurrence empty: ${coOccurrenceEmpty}`);

    if (patternsEmpty) await seedTechPatterns();
    if (clustersEmpty) await seedClusters();
    if (coOccurrenceEmpty) await seedCoOccurrences();

    logger.info('Auto-seed: database seeding complete — EIGE v10 is ready to scan');

  } catch (err) {
    logger.error(`Auto-seed: seeding failed: ${err.message}`);
    logger.error('Auto-seed: the tool will still start but detection may be limited until seed data is loaded');
  }
}

module.exports = { runAutoSeed };
