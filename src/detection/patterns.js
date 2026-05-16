'use strict';

// This file is a local fallback pattern set used only if the database
// has not been seeded yet. The primary patterns come from the
// tech_patterns table in Supabase via src/db/patterns.js
// This ensures the tool works even on first boot before seeding.

const FALLBACK_PATTERNS = [
  // ─── JAVASCRIPT FRAMEWORKS ───────────────────────────────────────────
  {
    name: 'React',
    category: 'JavaScript Framework',
    html_patterns: [
      '__NEXT_DATA__',
      'data-reactroot',
      'data-reactid',
      'react-root',
      '_reactFiber',
      'ReactDOM',
      '__react_',
      'react-app'
    ],
    header_patterns: [
      'x-powered-by: react',
      'x-nextjs'
    ],
    script_patterns: [
      'react\\.min\\.js',
      'react\\.production\\.min\\.js',
      'react-dom',
      '\\/react@',
      'unpkg\\.com/react',
      'cdn\\.jsdelivr\\.net/npm/react'
    ],
    url_patterns: [],
    version_patterns: [
      'react@([\\d.]+)',
      '"react":"([\\d.]+)"',
      'react\\/([\\d.]+)\\/react'
    ],
    html_weight: 0.4,
    header_weight: 0.4,
    script_weight: 0.35,
    min_confidence: 0.40
  },
  {
    name: 'Next.js',
    category: 'JavaScript Framework',
    html_patterns: [
      '__NEXT_DATA__',
      '__NEXT_LOADED_PAGES__',
      '_next/static',
      '_next/chunks',
      '__nextjs',
      'next/dist',
      '__NEXT_P'
    ],
    header_patterns: [
      'x-powered-by: next\\.js',
      'x-nextjs-cache',
      'x-nextjs-page',
      'x-next-cache'
    ],
    script_patterns: [
      '_next/static/chunks',
      '_next/static/runtime',
      'next/dist/client'
    ],
    url_patterns: [],
    version_patterns: [
      '"next":"([\\d.]+)"',
      'next\\/([\\d.]+)\\/'
    ],
    html_weight: 0.45,
    header_weight: 0.45,
    script_weight: 0.40,
    min_confidence: 0.45
  },
  {
    name: 'Vue.js',
    category: 'JavaScript Framework',
    html_patterns: [
      'data-v-',
      '__vue__',
      'vue-router',
      '__VUE__',
      'v-cloak',
      'nuxt-link',
      '__NUXT__',
      'vue\\.runtime'
    ],
    header_patterns: [
      'x-powered-by: nuxt'
    ],
    script_patterns: [
      'vue\\.min\\.js',
      'vue\\.runtime\\.min\\.js',
      '\\/vue@',
      'cdn\\.jsdelivr\\.net/npm/vue',
      'unpkg\\.com/vue'
    ],
    url_patterns: [],
    version_patterns: [
      'vue@([\\d.]+)',
      '"vue":"([\\d.]+)"',
      'Vue\\.version="([\\d.]+)"'
    ],
    html_weight: 0.40,
    header_weight: 0.30,
    script_weight: 0.35,
    min_confidence: 0.38
  },
  {
    name: 'Angular',
    category: 'JavaScript Framework',
    html_patterns: [
      'ng-version',
      'ng-app',
      'ng-controller',
      'ng-model',
      'ng-repeat',
      '_nghost',
      '_ngcontent',
      'ng-if',
      'ng-class',
      'angular\\.js',
      'angular\\.min\\.js'
    ],
    header_patterns: [],
    script_patterns: [
      'angular\\.min\\.js',
      'angular\\.js',
      '\\/angular@',
      'zone\\.js'
    ],
    url_patterns: [],
    version_patterns: [
      'ng-version="([\\d.]+)"',
      'angular@([\\d.]+)',
      '"@angular/core":"([\\d.]+)"'
    ],
    html_weight: 0.45,
    header_weight: 0.20,
    script_weight: 0.35,
    min_confidence: 0.40
  },
  {
    name: 'Svelte',
    category: 'JavaScript Framework',
    html_patterns: [
      'svelte-',
      '__svelte',
      'svelte/internal',
      'SvelteComponent',
      'svelte-kit'
    ],
    header_patterns: [],
    script_patterns: [
      'svelte\\.js',
      'svelte/internal',
      '\\/svelte@',
      '_app/immutable'
    ],
    url_patterns: [
      '_app/immutable'
    ],
    version_patterns: [
      'svelte@([\\d.]+)',
      '"svelte":"([\\d.]+)"'
    ],
    html_weight: 0.40,
    header_weight: 0.20,
    script_weight: 0.35,
    min_confidence: 0.38
  },
  {
    name: 'Nuxt.js',
    category: 'JavaScript Framework',
    html_patterns: [
      '__NUXT__',
      'nuxt-link',
      'nuxtjs',
      '_nuxt/',
      'nuxt/dist',
      '__nuxt'
    ],
    header_patterns: [
      'x-powered-by: nuxt'
    ],
    script_patterns: [
      '_nuxt/runtime',
      '_nuxt/entry',
      'nuxt/dist/app'
    ],
    url_patterns: [
      '_nuxt/'
    ],
    version_patterns: [
      '"nuxt":"([\\d.]+)"',
      'nuxt@([\\d.]+)'
    ],
    html_weight: 0.45,
    header_weight: 0.35,
    script_weight: 0.40,
    min_confidence: 0.42
  },
  {
    name: 'Remix',
    category: 'JavaScript Framework',
    html_patterns: [
      '__remixContext',
      '__remixRouteModules',
      '__remixManifest',
      'data-remix-',
      'remix-island'
    ],
    header_patterns: [],
    script_patterns: [
      '\\/build\\/root-',
      'entry\\.client',
      '@remix-run'
    ],
    url_patterns: [],
    version_patterns: [
      '"@remix-run/react":"([\\d.]+)"'
    ],
    html_weight: 0.50,
    header_weight: 0.20,
    script_weight: 0.35,
    min_confidence: 0.42
  },
  {
    name: 'Astro',
    category: 'JavaScript Framework',
    html_patterns: [
      'astro-island',
      'astro-slot',
      'data-astro-',
      'astro:load',
      'astro:idle',
      'astro:visible'
    ],
    header_patterns: [
      'x-powered-by: astro'
    ],
    script_patterns: [
      '\\/astro\\/',
      'astro/client'
    ],
    url_patterns: [],
    version_patterns: [
      '"astro":"([\\d.]+)"'
    ],
    html_weight: 0.50,
    header_weight: 0.30,
    script_weight: 0.30,
    min_confidence: 0.40
  },
  {
    name: 'Ember.js',
    category: 'JavaScript Framework',
    html_patterns: [
      'ember-application',
      'ember-view',
      '__ember',
      'data-ember-action',
      'ember-cli'
    ],
    header_patterns: [],
    script_patterns: [
      'ember\\.min\\.js',
      'ember\\.debug\\.js',
      '\\/ember@',
      'ember-cli-build'
    ],
    url_patterns: [],
    version_patterns: [
      'Ember\\.VERSION="([\\d.]+)"',
      'ember@([\\d.]+)'
    ],
    html_weight: 0.45,
    header_weight: 0.15,
    script_weight: 0.40,
    min_confidence: 0.40
  },
  {
    name: 'Backbone.js',
    category: 'JavaScript Framework',
    html_patterns: [
      'backbone',
      'Backbone\\.View',
      'Backbone\\.Model'
    ],
    header_patterns: [],
    script_patterns: [
      'backbone\\.js',
      'backbone\\.min\\.js',
      '\\/backbone@'
    ],
    url_patterns: [],
    version_patterns: [
      'Backbone\\.VERSION="([\\d.]+)"'
    ],
    html_weight: 0.35,
    header_weight: 0.10,
    script_weight: 0.40,
    min_confidence: 0.35
  },

  // ─── CMS ──────────────────────────────────────────────────────────────
  {
    name: 'WordPress',
    category: 'CMS',
    html_patterns: [
      'wp-content',
      'wp-includes',
      'wp-json',
      'wp-block',
      'wordpress',
      'wp-embed',
      'wp-emoji',
      'xmlrpc\\.php',
      'wp-login\\.php',
      'woocommerce'
    ],
    header_patterns: [
      'x-powered-by: wp',
      'x-pingback',
      'link:.*wp-json'
    ],
    script_patterns: [
      'wp-includes/js',
      'wp-content/themes',
      'wp-content/plugins'
    ],
    url_patterns: [
      'wp-admin',
      'wp-login'
    ],
    version_patterns: [
      'WordPress ([\\d.]+)',
      '"version":"([\\d.]+)","name":"WordPress"'
    ],
    html_weight: 0.50,
    header_weight: 0.35,
    script_weight: 0.40,
    min_confidence: 0.40
  },
  {
    name: 'Drupal',
    category: 'CMS',
    html_patterns: [
      'Drupal\\.settings',
      'drupal\\.js',
      'drupal-',
      'data-drupal-',
      '/sites/default/files',
      'drupal/core',
      'Drupal\\.behaviors'
    ],
    header_patterns: [
      'x-drupal-cache',
      'x-generator: drupal',
      'x-drupal-dynamic-cache'
    ],
    script_patterns: [
      '/core/misc/drupal',
      'drupal\\.min\\.js',
      '/sites/all/modules'
    ],
    url_patterns: [
      '/node/',
      '/sites/default'
    ],
    version_patterns: [
      'Drupal ([\\d.]+)',
      '"Drupal":"([\\d.]+)"'
    ],
    html_weight: 0.45,
    header_weight: 0.40,
    script_weight: 0.35,
    min_confidence: 0.38
  },
  {
    name: 'Joomla',
    category: 'CMS',
    html_patterns: [
      '/media/jui/',
      'joomla',
      '/media/system/js/',
      'joomla\\.javascript',
      '/components/com_'
    ],
    header_patterns: [
      'x-content-encoded-by: joomla'
    ],
    script_patterns: [
      '/media/jui/js',
      '/media/system/js/core',
      'joomla\\.min\\.js'
    ],
    url_patterns: [
      'option=com_',
      'Itemid='
    ],
    version_patterns: [
      'Joomla! ([\\d.]+)',
      '"joomla":"([\\d.]+)"'
    ],
    html_weight: 0.45,
    header_weight: 0.35,
    script_weight: 0.35,
    min_confidence: 0.38
  },
  {
    name: 'Ghost',
    category: 'CMS',
    html_patterns: [
      'ghost-url',
      'ghost/core',
      'content="Ghost',
      'ghost-theme',
      'ghost-editor',
      '@tryghost'
    ],
    header_patterns: [
      'x-powered-by: ghost'
    ],
    script_patterns: [
      'ghost/assets',
      'ghost-sdk',
      '@tryghost/content-api'
    ],
    url_patterns: [],
    version_patterns: [
      'Ghost ([\\d.]+)',
      '"ghost":"([\\d.]+)"'
    ],
    html_weight: 0.45,
    header_weight: 0.40,
    script_weight: 0.35,
    min_confidence: 0.38
  },
  {
    name: 'Contentful',
    category: 'CMS',
    html_patterns: [
      'contentful',
      'ctfl-',
      'data-contentful'
    ],
    header_patterns: [],
    script_patterns: [
      'contentful\\.com/apps',
      '@contentful/rich-text',
      'cdn\\.contentful\\.com'
    ],
    url_patterns: [],
    version_patterns: [
      '"contentful":"([\\d.]+)"'
    ],
    html_weight: 0.35,
    header_weight: 0.20,
    script_weight: 0.40,
    min_confidence: 0.35
  },
  {
    name: 'Sanity',
    category: 'CMS',
    html_patterns: [
      'sanity-studio',
      '__sanity',
      'sanity\\.io'
    ],
    header_patterns: [],
    script_patterns: [
      'sanity\\.io/static',
      '@sanity/client',
      'sanity-studio'
    ],
    url_patterns: [
      'sanity\\.studio'
    ],
    version_patterns: [
      '"sanity":"([\\d.]+)"'
    ],
    html_weight: 0.35,
    header_weight: 0.15,
    script_weight: 0.40,
    min_confidence: 0.35
  },
  {
    name: 'Webflow',
    category: 'CMS',
    html_patterns: [
      'data-wf-',
      'webflow',
      'w-webflow-badge',
      'wf-form-',
      'data-w-id'
    ],
    header_patterns: [
      'x-powered-by: webflow'
    ],
    script_patterns: [
      'assets\\.website-files\\.com',
      'webflow\\.js',
      'd3e54v103j8qbb\\.cloudfront\\.net'
    ],
    url_patterns: [
      '\\.webflow\\.io'
    ],
    version_patterns: [],
    html_weight: 0.50,
    header_weight: 0.35,
    script_weight: 0.40,
    min_confidence: 0.40
  },
  {
    name: 'Squarespace',
    category: 'CMS',
    html_patterns: [
      'squarespace',
      'data-squarespace-',
      'Static\\.SQUARESPACE_CONTEXT',
      'squarespace-cdn'
    ],
    header_patterns: [
      'x-served-by: squarespace'
    ],
    script_patterns: [
      'squarespace\\.com/universal/scripts',
      'static1\\.squarespace\\.com'
    ],
    url_patterns: [
      '\\.squarespace\\.com'
    ],
    version_patterns: [],
    html_weight: 0.50,
    header_weight: 0.35,
    script_weight: 0.35,
    min_confidence: 0.40
  },
  {
    name: 'Wix',
    category: 'CMS',
    html_patterns: [
      'wix-code',
      '_wix_',
      'X-Wix-',
      'wixstatic\\.com',
      'parastorage\\.com'
    ],
    header_patterns: [
      'x-wix-request-id',
      'x-wix-published-version'
    ],
    script_patterns: [
      'static\\.parastorage\\.com',
      'static\\.wixstatic\\.com'
    ],
    url_patterns: [
      '\\.wix\\.com',
      '\\.wixsite\\.com'
    ],
    version_patterns: [],
    html_weight: 0.45,
    header_weight: 0.40,
    script_weight: 0.35,
    min_confidence: 0.40
  },

  // ─── E-COMMERCE ───────────────────────────────────────────────────────
  {
    name: 'Shopify',
    category: 'E-Commerce',
    html_patterns: [
      'Shopify\\.theme',
      'cdn\\.shopify\\.com',
      'myshopify\\.com',
      'shopify-section',
      'shopify_analytics',
      'Shopify\\.shop',
      'shopify\\.com/s/files'
    ],
    header_patterns: [
      'x-shopify-stage',
      'x-shopid',
      'x-shardid'
    ],
    script_patterns: [
      'cdn\\.shopify\\.com/s/files',
      'shopify\\.com/s/trekkie'
    ],
    url_patterns: [
      '\\.myshopify\\.com'
    ],
    version_patterns: [],
    html_weight: 0.50,
    header_weight: 0.45,
    script_weight: 0.40,
    min_confidence: 0.42
  },
  {
    name: 'WooCommerce',
    category: 'E-Commerce',
    html_patterns: [
      'woocommerce',
      'wc-',
      'data-product_id',
      'wc_add_to_cart',
      'is-woocommerce',
      'woocommerce-cart',
      'woocommerce-checkout'
    ],
    header_patterns: [],
    script_patterns: [
      'woocommerce/assets',
      'wc-add-to-cart',
      'woocommerce\\.min\\.js'
    ],
    url_patterns: [
      '/shop/',
      '/cart/',
      '/checkout/',
      '/product/'
    ],
    version_patterns: [
      'WooCommerce ([\\d.]+)'
    ],
    html_weight: 0.50,
    header_weight: 0.15,
    script_weight: 0.40,
    min_confidence: 0.42
  },
  {
    name: 'Magento',
    category: 'E-Commerce',
    html_patterns: [
      'Magento_',
      'mage/',
      'mage/cookies',
      'Mage\\.Cookies',
      'magento',
      'varien/',
      'data-mage-'
    ],
    header_patterns: [
      'x-magento-cache-control',
      'x-magento-tags',
      'x-magento-vary'
    ],
    script_patterns: [
      'mage/requirejs',
      'Magento_Ui',
      'mage/bootstrap'
    ],
    url_patterns: [
      '/catalog/product',
      '/checkout/cart'
    ],
    version_patterns: [
      'Magento\\/([\\d.]+)'
    ],
    html_weight: 0.45,
    header_weight: 0.40,
    script_weight: 0.35,
    min_confidence: 0.40
  },
  {
    name: 'BigCommerce',
    category: 'E-Commerce',
    html_patterns: [
      'bigcommerce',
      'BCData',
      'bigcommerce-checkout',
      'bc-sf-filter'
    ],
    header_patterns: [
      'x-bc-merchant-id',
      'bc-merchant'
    ],
    script_patterns: [
      'bigcommerce\\.com/assets',
      'cdn11\\.bigcommerce\\.com'
    ],
    url_patterns: [
      '\\.bigcommerce\\.com',
      '\\.mybigcommerce\\.com'
    ],
    version_patterns: [],
    html_weight: 0.45,
    header_weight: 0.40,
    script_weight: 0.35,
    min_confidence: 0.40
  },
  {
    name: 'PrestaShop',
    category: 'E-Commerce',
    html_patterns: [
      'prestashop',
      'PrestaShop',
      'id_product',
      'add-to-cart'
    ],
    header_patterns: [
      'x-powered-by: prestashop'
    ],
    script_patterns: [
      'prestashop\\.js',
      '/modules/ps_',
      '/themes/classic'
    ],
    url_patterns: [
      'index\\.php\\?id_product'
    ],
    version_patterns: [
      'PrestaShop ([\\d.]+)'
    ],
    html_weight: 0.45,
    header_weight: 0.35,
    script_weight: 0.35,
    min_confidence: 0.38
  },

  // ─── CDN ──────────────────────────────────────────────────────────────
  {
    name: 'Cloudflare',
    category: 'CDN',
    html_patterns: [
      'cloudflare',
      '__cf_bm',
      'cf-challenge',
      'cloudflare-static',
      'cf_clearance'
    ],
    header_patterns: [
      'cf-ray',
      'cf-cache-status',
      'server: cloudflare',
      'cf-request-id',
      'cf-apo-via',
      'cf-edge-cache'
    ],
    script_patterns: [
      'cloudflare\\.com/cdn-cgi',
      'static\\.cloudflareinsights\\.com',
      'cdn-cgi/scripts'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.35,
    header_weight: 0.55,
    script_weight: 0.30,
    min_confidence: 0.35
  },
  {
    name: 'AWS CloudFront',
    category: 'CDN',
    html_patterns: [],
    header_patterns: [
      'x-amz-cf-id',
      'x-amz-cf-pop',
      'via:.*cloudfront',
      'x-cache:.*cloudfront'
    ],
    script_patterns: [
      'cloudfront\\.net'
    ],
    url_patterns: [
      '\\.cloudfront\\.net'
    ],
    version_patterns: [],
    html_weight: 0.10,
    header_weight: 0.60,
    script_weight: 0.25,
    min_confidence: 0.35
  },
  {
    name: 'Fastly',
    category: 'CDN',
    html_patterns: [],
    header_patterns: [
      'x-fastly-request-id',
      'x-served-by:.*cache-',
      'fastly-restarts',
      'x-cache:.*HIT',
      'x-timer:.*S',
      'via:.*varnish'
    ],
    script_patterns: [],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.10,
    header_weight: 0.65,
    script_weight: 0.10,
    min_confidence: 0.35
  },
  {
    name: 'Akamai',
    category: 'CDN',
    html_patterns: [],
    header_patterns: [
      'x-akamai-request-id',
      'akamai-cache-status',
      'x-check-cacheable',
      'x-akamai-ssl-client-sid',
      'server: akamainetstorage',
      'x-cache-key:.*akamai'
    ],
    script_patterns: [],
    url_patterns: [
      '\\.akamaized\\.net',
      '\\.akamaihd\\.net'
    ],
    version_patterns: [],
    html_weight: 0.10,
    header_weight: 0.65,
    script_weight: 0.10,
    min_confidence: 0.35
  },
  {
    name: 'BunnyCDN',
    category: 'CDN',
    html_patterns: [],
    header_patterns: [
      'cdn-pullzone',
      'cdn-uid',
      'cdn-requestid',
      'server: bunnycdn'
    ],
    script_patterns: [
      '\\.b-cdn\\.net',
      'bunnycdn\\.com'
    ],
    url_patterns: [
      '\\.b-cdn\\.net'
    ],
    version_patterns: [],
    html_weight: 0.10,
    header_weight: 0.60,
    script_weight: 0.30,
    min_confidence: 0.33
  },

  // ─── HOSTING ──────────────────────────────────────────────────────────
  {
    name: 'Vercel',
    category: 'Hosting',
    html_patterns: [
      '__NEXT_DATA__',
      'vercel\\.app'
    ],
    header_patterns: [
      'x-vercel-id',
      'x-vercel-cache',
      'server: vercel',
      'x-vercel-deployment-url'
    ],
    script_patterns: [],
    url_patterns: [
      '\\.vercel\\.app'
    ],
    version_patterns: [],
    html_weight: 0.20,
    header_weight: 0.65,
    script_weight: 0.10,
    min_confidence: 0.33
  },
  {
    name: 'Netlify',
    category: 'Hosting',
    html_patterns: [
      'netlify',
      'data-netlify'
    ],
    header_patterns: [
      'x-nf-request-id',
      'server: netlify',
      'x-netlify-cache',
      'netlify-cdn-cache-control'
    ],
    script_patterns: [],
    url_patterns: [
      '\\.netlify\\.app',
      '\\.netlify\\.com'
    ],
    version_patterns: [],
    html_weight: 0.20,
    header_weight: 0.65,
    script_weight: 0.10,
    min_confidence: 0.33
  },
  {
    name: 'AWS',
    category: 'Hosting',
    html_patterns: [],
    header_patterns: [
      'x-amzn-requestid',
      'x-amz-request-id',
      'server: awselb',
      'x-amzn-trace-id',
      'x-amz-apigw-id'
    ],
    script_patterns: [
      's3\\.amazonaws\\.com',
      '\\.s3\\.amazonaws\\.com'
    ],
    url_patterns: [
      '\\.amazonaws\\.com',
      '\\.aws\\.com'
    ],
    version_patterns: [],
    html_weight: 0.10,
    header_weight: 0.60,
    script_weight: 0.25,
    min_confidence: 0.33
  },
  {
    name: 'Google Cloud',
    category: 'Hosting',
    html_patterns: [],
    header_patterns: [
      'server: gws',
      'x-goog-request-id',
      'x-google-cache',
      'via:.*google',
      'x-gfe-request-id'
    ],
    script_patterns: [
      'storage\\.googleapis\\.com',
      'googleusercontent\\.com'
    ],
    url_patterns: [
      '\\.run\\.app',
      '\\.appspot\\.com',
      '\\.cloudfunctions\\.net'
    ],
    version_patterns: [],
    html_weight: 0.10,
    header_weight: 0.60,
    script_weight: 0.25,
    min_confidence: 0.33
  },
  {
    name: 'Azure',
    category: 'Hosting',
    html_patterns: [],
    header_patterns: [
      'x-ms-request-id',
      'x-azure-ref',
      'server: microsoft-iis',
      'x-msedge-ref',
      'x-ms-routing-name'
    ],
    script_patterns: [
      'azureedge\\.net',
      'blob\\.core\\.windows\\.net'
    ],
    url_patterns: [
      '\\.azurewebsites\\.net',
      '\\.azureedge\\.net',
      '\\.azure\\.com'
    ],
    version_patterns: [],
    html_weight: 0.10,
    header_weight: 0.60,
    script_weight: 0.25,
    min_confidence: 0.33
  },
  {
    name: 'Heroku',
    category: 'Hosting',
    html_patterns: [],
    header_patterns: [
      'x-request-id',
      'x-runtime',
      'server: heroku',
      'heroku-'
    ],
    script_patterns: [],
    url_patterns: [
      '\\.herokuapp\\.com'
    ],
    version_patterns: [],
    html_weight: 0.10,
    header_weight: 0.55,
    script_weight: 0.10,
    min_confidence: 0.30
  },
  {
    name: 'Render',
    category: 'Hosting',
    html_patterns: [],
    header_patterns: [
      'server: render',
      'x-render-origin-server',
      'rndr-id'
    ],
    script_patterns: [],
    url_patterns: [
      '\\.onrender\\.com'
    ],
    version_patterns: [],
    html_weight: 0.10,
    header_weight: 0.60,
    script_weight: 0.10,
    min_confidence: 0.30
  },

  // ─── CSS FRAMEWORKS ───────────────────────────────────────────────────
  {
    name: 'Tailwind CSS',
    category: 'CSS Framework',
    html_patterns: [
      'class="[^"]*\\b(?:flex|grid|px-|py-|mx-|my-|text-|bg-|border-|rounded|shadow|hover:|focus:|sm:|md:|lg:|xl:)[^"]*"',
      'tailwindcss',
      'tw-',
      'tailwind\\.config'
    ],
    header_patterns: [],
    script_patterns: [
      'tailwindcss',
      'cdn\\.tailwindcss\\.com'
    ],
    url_patterns: [],
    version_patterns: [
      'tailwindcss@([\\d.]+)',
      '"tailwindcss":"([\\d.]+)"'
    ],
    html_weight: 0.45,
    header_weight: 0.10,
    script_weight: 0.35,
    min_confidence: 0.35
  },
  {
    name: 'Bootstrap',
    category: 'CSS Framework',
    html_patterns: [
      'class="[^"]*\\b(?:container|row|col-|btn|navbar|modal|carousel|dropdown)[^"]*"',
      'bootstrap',
      'data-bs-',
      'data-toggle=',
      'data-dismiss='
    ],
    header_patterns: [],
    script_patterns: [
      'bootstrap\\.min\\.js',
      'bootstrap\\.bundle\\.min\\.js',
      'getbootstrap\\.com',
      'cdn\\.jsdelivr\\.net/npm/bootstrap'
    ],
    url_patterns: [],
    version_patterns: [
      'bootstrap@([\\d.]+)',
      '"bootstrap":"([\\d.]+)"',
      'Bootstrap v([\\d.]+)'
    ],
    html_weight: 0.40,
    header_weight: 0.10,
    script_weight: 0.40,
    min_confidence: 0.35
  },
  {
    name: 'Material UI',
    category: 'CSS Framework',
    html_patterns: [
      'MuiButton',
      'MuiTypography',
      'MuiBox',
      'MuiGrid',
      'MuiContainer',
      'makeStyles',
      'jss-insertion-point',
      'mui-'
    ],
    header_patterns: [],
    script_patterns: [
      '@mui/material',
      '@material-ui/core',
      'material-ui'
    ],
    url_patterns: [],
    version_patterns: [
      '"@mui/material":"([\\d.]+)"',
      '"@material-ui/core":"([\\d.]+)"'
    ],
    html_weight: 0.50,
    header_weight: 0.10,
    script_weight: 0.35,
    min_confidence: 0.38
  },
  {
    name: 'Chakra UI',
    category: 'CSS Framework',
    html_patterns: [
      'chakra-',
      'css-chakra',
      'data-theme="chakra"',
      'chakra-ui'
    ],
    header_patterns: [],
    script_patterns: [
      '@chakra-ui/react',
      'chakra-ui'
    ],
    url_patterns: [],
    version_patterns: [
      '"@chakra-ui/react":"([\\d.]+)"'
    ],
    html_weight: 0.50,
    header_weight: 0.10,
    script_weight: 0.35,
    min_confidence: 0.38
  },

  // ─── ANALYTICS ────────────────────────────────────────────────────────
  {
    name: 'Google Analytics',
    category: 'Analytics',
    html_patterns: [
      'google-analytics\\.com/analytics\\.js',
      'GoogleAnalyticsObject',
      'ga\\(\'create\'',
      'gtag\\(',
      'UA-[0-9]+-[0-9]+',
      'G-[A-Z0-9]+',
      'AW-[0-9]+'
    ],
    header_patterns: [],
    script_patterns: [
      'google-analytics\\.com/analytics\\.js',
      'googletagmanager\\.com/gtag/js',
      'google-analytics\\.com/ga\\.js'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50,
    header_weight: 0.10,
    script_weight: 0.45,
    min_confidence: 0.38
  },
  {
    name: 'Google Tag Manager',
    category: 'Tag Manager',
    html_patterns: [
      'GTM-[A-Z0-9]+',
      'googletagmanager\\.com',
      'dataLayer\\.push',
      'dataLayer = \\[\\]'
    ],
    header_patterns: [],
    script_patterns: [
      'googletagmanager\\.com/gtm\\.js',
      'googletagmanager\\.com/ns\\.html'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50,
    header_weight: 0.10,
    script_weight: 0.45,
    min_confidence: 0.38
  },
  {
    name: 'Mixpanel',
    category: 'Analytics',
    html_patterns: [
      'mixpanel\\.track',
      'mixpanel\\.identify',
      'mixpanel\\.init'
    ],
    header_patterns: [],
    script_patterns: [
      'cdn\\.mxpnl\\.com',
      'cdn\\.mixpanel\\.com'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45,
    header_weight: 0.10,
    script_weight: 0.45,
    min_confidence: 0.38
  },
  {
    name: 'Hotjar',
    category: 'Analytics',
    html_patterns: [
      'hotjar',
      'hjSetting',
      '_hjSettings',
      'hj\\(',
      'hjid:'
    ],
    header_patterns: [],
    script_patterns: [
      'static\\.hotjar\\.com',
      'script\\.hotjar\\.com'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50,
    header_weight: 0.10,
    script_weight: 0.45,
    min_confidence: 0.38
  },
  {
    name: 'Segment',
    category: 'Analytics',
    html_patterns: [
      'analytics\\.load\\(',
      'analytics\\.page\\(',
      'analytics\\.track\\(',
      'analytics\\.identify\\(',
      'cdn\\.segment\\.com'
    ],
    header_patterns: [],
    script_patterns: [
      'cdn\\.segment\\.com/analytics\\.js',
      'cdn\\.segment\\.io'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50,
    header_weight: 0.10,
    script_weight: 0.45,
    min_confidence: 0.38
  },
  {
    name: 'Plausible',
    category: 'Analytics',
    html_patterns: [
      'plausible\\(',
      'data-domain'
    ],
    header_patterns: [],
    script_patterns: [
      'plausible\\.io/js/plausible',
      'plausible\\.io/js/script'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.35,
    header_weight: 0.10,
    script_weight: 0.50,
    min_confidence: 0.35
  },
  {
    name: 'Fathom Analytics',
    category: 'Analytics',
    html_patterns: [
      'fathom\\.trackGoal',
      'fathom\\.trackPageview'
    ],
    header_patterns: [],
    script_patterns: [
      'cdn\\.usefathom\\.com',
      'fathom\\.js'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.40,
    header_weight: 0.10,
    script_weight: 0.50,
    min_confidence: 0.35
  },

  // ─── PAYMENT ──────────────────────────────────────────────────────────
  {
    name: 'Stripe',
    category: 'Payment',
    html_patterns: [
      'stripe\\.createToken',
      'stripe\\.redirectToCheckout',
      'data-stripe',
      'StripeElement',
      'stripe-js'
    ],
    header_patterns: [],
    script_patterns: [
      'js\\.stripe\\.com/v3',
      'js\\.stripe\\.com/v2',
      'stripe\\.com/docs'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45,
    header_weight: 0.10,
    script_weight: 0.50,
    min_confidence: 0.42
  },
  {
    name: 'PayPal',
    category: 'Payment',
    html_patterns: [
      'paypal\\.Buttons',
      'paypal-button',
      'paypal\\.com/sdk'
    ],
    header_patterns: [],
    script_patterns: [
      'paypal\\.com/sdk/js',
      'paypalobjects\\.com'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45,
    header_weight: 0.10,
    script_weight: 0.50,
    min_confidence: 0.42
  },
  {
    name: 'Paddle',
    category: 'Payment',
    html_patterns: [
      'Paddle\\.Setup',
      'Paddle\\.Checkout',
      'paddle_js'
    ],
    header_patterns: [],
    script_patterns: [
      'cdn\\.paddle\\.com/paddle/paddle\\.js'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45,
    header_weight: 0.10,
    script_weight: 0.50,
    min_confidence: 0.42
  },
  {
    name: 'Braintree',
    category: 'Payment',
    html_patterns: [
      'braintree\\.setup',
      'braintree\\.client\\.create',
      'data-braintree'
    ],
    header_patterns: [],
    script_patterns: [
      'js\\.braintreegateway\\.com',
      'braintree-web'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45,
    header_weight: 0.10,
    script_weight: 0.50,
    min_confidence: 0.42
  },
  {
    name: 'Square',
    category: 'Payment',
    html_patterns: [
      'Square\\.payments',
      'squareup\\.com'
    ],
    header_patterns: [],
    script_patterns: [
      'js\\.squareup\\.com',
      'sandbox\\.web\\.squarecdn\\.com',
      'web\\.squarecdn\\.com'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.40,
    header_weight: 0.10,
    script_weight: 0.50,
    min_confidence: 0.42
  },

  // ─── CUSTOMER SUPPORT ─────────────────────────────────────────────────
  {
    name: 'Intercom',
    category: 'Customer Support',
    html_patterns: [
      'intercomSettings',
      'Intercom\\(',
      'intercom-container',
      'intercom-launcher',
      'widget\\.intercom\\.io'
    ],
    header_patterns: [],
    script_patterns: [
      'widget\\.intercom\\.io/widget',
      'js\\.intercomcdn\\.com'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50,
    header_weight: 0.10,
    script_weight: 0.45,
    min_confidence: 0.38
  },
  {
    name: 'Zendesk',
    category: 'Customer Support',
    html_patterns: [
      'zE\\(',
      'zEmbed',
      'zendesk',
      'zd-',
      'zdSettings'
    ],
    header_patterns: [],
    script_patterns: [
      'static\\.zdassets\\.com',
      'ekr\\.zdassets\\.com',
      'v2\\.zopim\\.com'
    ],
    url_patterns: [
      '\\.zendesk\\.com'
    ],
    version_patterns: [],
    html_weight: 0.45,
    header_weight: 0.10,
    script_weight: 0.45,
    min_confidence: 0.38
  },
  {
    name: 'Crisp',
    category: 'Customer Support',
    html_patterns: [
      'CRISP_WEBSITE_ID',
      'crisp\\.chat',
      '$crisp'
    ],
    header_patterns: [],
    script_patterns: [
      'client\\.crisp\\.chat',
      'crisp\\.chat/g\\.js'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50,
    header_weight: 0.10,
    script_weight: 0.45,
    min_confidence: 0.38
  },
  {
    name: 'Drift',
    category: 'Customer Support',
    html_patterns: [
      'drift\\.identify',
      'drift\\.page',
      'drift\\.load',
      'driftt\\.com'
    ],
    header_patterns: [],
    script_patterns: [
      'js\\.driftt\\.com',
      'drift\\.com/include'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50,
    header_weight: 0.10,
    script_weight: 0.45,
    min_confidence: 0.38
  },
  {
    name: 'Tawk.to',
    category: 'Customer Support',
    html_patterns: [
      'Tawk_API',
      'tawk\\.to'
    ],
    header_patterns: [],
    script_patterns: [
      'embed\\.tawk\\.to',
      'tawk\\.to/s1/'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50,
    header_weight: 0.10,
    script_weight: 0.45,
    min_confidence: 0.35
  },

  // ─── MARKETING ────────────────────────────────────────────────────────
  {
    name: 'HubSpot',
    category: 'Marketing',
    html_patterns: [
      'hubspot',
      'hs-script-loader',
      'hbspt\\.forms\\.create',
      '_hsq\\.push',
      'leadin'
    ],
    header_patterns: [
      'x-hs-cf-stack'
    ],
    script_patterns: [
      'js\\.hs-scripts\\.com',
      'js\\.hsforms\\.net',
      'js\\.hubspot\\.com'
    ],
    url_patterns: [
      '\\.hubspot\\.com',
      '\\.hs-sites\\.com'
    ],
    version_patterns: [],
    html_weight: 0.45,
    header_weight: 0.30,
    script_weight: 0.45,
    min_confidence: 0.38
  },
  {
    name: 'Mailchimp',
    category: 'Marketing',
    html_patterns: [
      'mailchimp',
      'mc-embedded-subscribe',
      'list-manage\\.com',
      'chimpstatic\\.com'
    ],
    header_patterns: [],
    script_patterns: [
      'chimpstatic\\.com',
      's3\\.amazonaws\\.com/downloads\\.mailchimp\\.com'
    ],
    url_patterns: [
      'list-manage\\.com'
    ],
    version_patterns: [],
    html_weight: 0.50,
    header_weight: 0.10,
    script_weight: 0.40,
    min_confidence: 0.35
  },

  // ─── SECURITY ─────────────────────────────────────────────────────────
  {
    name: 'reCAPTCHA',
    category: 'Security',
    html_patterns: [
      'g-recaptcha',
      'recaptcha',
      'grecaptcha',
      'data-sitekey'
    ],
    header_patterns: [],
    script_patterns: [
      'google\\.com/recaptcha/api\\.js',
      'www\\.google\\.com/recaptcha'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50,
    header_weight: 0.10,
    script_weight: 0.45,
    min_confidence: 0.38
  },
  {
    name: 'hCaptcha',
    category: 'Security',
    html_patterns: [
      'h-captcha',
      'hcaptcha',
      'data-hcaptcha'
    ],
    header_patterns: [],
    script_patterns: [
      'hcaptcha\\.com/1/api\\.js',
      'js\\.hcaptcha\\.com'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50,
    header_weight: 0.10,
    script_weight: 0.45,
    min_confidence: 0.38
  },

  // ─── MONITORING ───────────────────────────────────────────────────────
  {
    name: 'Sentry',
    category: 'Monitoring',
    html_patterns: [
      'Sentry\\.init',
      'sentry\\.io',
      '__sentry',
      'sentry-trace'
    ],
    header_patterns: [
      'sentry-trace',
      'baggage:.*sentry'
    ],
    script_patterns: [
      'browser\\.sentry-cdn\\.com',
      'js\\.sentry-cdn\\.com',
      '@sentry/browser'
    ],
    url_patterns: [],
    version_patterns: [
      '"@sentry/browser":"([\\d.]+)"'
    ],
    html_weight: 0.45,
    header_weight: 0.30,
    script_weight: 0.45,
    min_confidence: 0.38
  },
  {
    name: 'Datadog',
    category: 'Monitoring',
    html_patterns: [
      'DD_RUM',
      'datadoghq\\.com',
      'datadog-rum'
    ],
    header_patterns: [],
    script_patterns: [
      'www\\.datadoghq-browser-agent\\.com',
      'static\\.datadoghq\\.com'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45,
    header_weight: 0.10,
    script_weight: 0.45,
    min_confidence: 0.38
  },
  {
    name: 'New Relic',
    category: 'Monitoring',
    html_patterns: [
      'NREUM',
      'newrelic',
      'nr-data\\.net'
    ],
    header_patterns: [],
    script_patterns: [
      'js-agent\\.newrelic\\.com',
      'bam\\.nr-data\\.net'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50,
    header_weight: 0.10,
    script_weight: 0.45,
    min_confidence: 0.38
  },

  // ─── SEARCH ───────────────────────────────────────────────────────────
  {
    name: 'Algolia',
    category: 'Search',
    html_patterns: [
      'algolia',
      'ais-',
      'InstantSearch',
      'algoliasearch'
    ],
    header_patterns: [],
    script_patterns: [
      'cdn\\.jsdelivr\\.net/npm/algoliasearch',
      'cdn\\.jsdelivr\\.net/npm/instantsearch',
      'algoliasearch\\.min\\.js'
    ],
    url_patterns: [],
    version_patterns: [
      '"algoliasearch":"([\\d.]+)"'
    ],
    html_weight: 0.45,
    header_weight: 0.10,
    script_weight: 0.45,
    min_confidence: 0.38
  },
  {
    name: 'Elasticsearch',
    category: 'Search',
    html_patterns: [
      'elasticsearch',
      'elastic\\.co'
    ],
    header_patterns: [
      'x-elastic-product'
    ],
    script_patterns: [
      '@elastic/elasticsearch',
      'elastic\\.co/guide'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.35,
    header_weight: 0.45,
    script_weight: 0.30,
    min_confidence: 0.35
  },

  // ─── DATABASE / BACKEND ───────────────────────────────────────────────
  {
    name: 'Firebase',
    category: 'Database',
    html_patterns: [
      'firebase',
      '__FIREBASE_DEFAULTS__',
      'firebaseapp\\.com'
    ],
    header_patterns: [],
    script_patterns: [
      'firebase\\.googleapis\\.com',
      'firebasestorage\\.googleapis\\.com',
      'www\\.gstatic\\.com/firebasejs'
    ],
    url_patterns: [
      '\\.firebaseapp\\.com',
      '\\.web\\.app'
    ],
    version_patterns: [
      '"firebase":"([\\d.]+)"'
    ],
    html_weight: 0.40,
    header_weight: 0.10,
    script_weight: 0.50,
    min_confidence: 0.38
  },
  {
    name: 'Supabase',
    category: 'Database',
    html_patterns: [
      'supabase',
      'supabase\\.co'
    ],
    header_patterns: [],
    script_patterns: [
      '@supabase/supabase-js',
      'supabase\\.co/storage'
    ],
    url_patterns: [
      '\\.supabase\\.co'
    ],
    version_patterns: [
      '"@supabase/supabase-js":"([\\d.]+)"'
    ],
    html_weight: 0.35,
    header_weight: 0.10,
    script_weight: 0.50,
    min_confidence: 0.35
  },

  // ─── FONTS ────────────────────────────────────────────────────────────
  {
    name: 'Google Fonts',
    category: 'Font',
    html_patterns: [
      'fonts\\.googleapis\\.com',
      'fonts\\.gstatic\\.com'
    ],
    header_patterns: [],
    script_patterns: [],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.60,
    header_weight: 0.10,
    script_weight: 0.10,
    min_confidence: 0.30
  },
  {
    name: 'Adobe Fonts',
    category: 'Font',
    html_patterns: [
      'use\\.typekit\\.net',
      'typekit',
      'adobe\\.com/fonts'
    ],
    header_patterns: [],
    script_patterns: [
      'use\\.typekit\\.net'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.55,
    header_weight: 0.10,
    script_weight: 0.35,
    min_confidence: 0.30
  },

  // ─── MAPS ─────────────────────────────────────────────────────────────
  {
    name: 'Google Maps',
    category: 'Map',
    html_patterns: [
      'maps\\.googleapis\\.com',
      'google-map',
      'gm-style',
      'GoogleMap'
    ],
    header_patterns: [],
    script_patterns: [
      'maps\\.googleapis\\.com/maps/api',
      'maps\\.google\\.com/maps'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50,
    header_weight: 0.10,
    script_weight: 0.45,
    min_confidence: 0.35
  },
  {
    name: 'Mapbox',
    category: 'Map',
    html_patterns: [
      'mapboxgl',
      'mapbox-gl',
      'mapbox\\.com'
    ],
    header_patterns: [],
    script_patterns: [
      'api\\.mapbox\\.com',
      'mapbox-gl\\.js'
    ],
    url_patterns: [],
    version_patterns: [
      '"mapbox-gl":"([\\d.]+)"'
    ],
    html_weight: 0.50,
    header_weight: 0.10,
    script_weight: 0.45,
    min_confidence: 0.35
  },

  // ─── VIDEO ────────────────────────────────────────────────────────────
  {
    name: 'YouTube',
    category: 'Video',
    html_patterns: [
      'youtube\\.com/embed',
      'youtu\\.be',
      'ytInitialData',
      'yt-player'
    ],
    header_patterns: [],
    script_patterns: [
      'youtube\\.com/iframe_api',
      'www\\.youtube\\.com/s/player'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.55,
    header_weight: 0.10,
    script_weight: 0.35,
    min_confidence: 0.30
  },
  {
    name: 'Vimeo',
    category: 'Video',
    html_patterns: [
      'player\\.vimeo\\.com',
      'vimeo-player',
      'vimeocdn\\.com'
    ],
    header_patterns: [],
    script_patterns: [
      'player\\.vimeo\\.com/api/player',
      'f\\.vimeocdn\\.com'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.55,
    header_weight: 0.10,
    script_weight: 0.35,
    min_confidence: 0.30
  },

  // ─── A/B TESTING ──────────────────────────────────────────────────────
  {
    name: 'Optimizely',
    category: 'A/B Testing',
    html_patterns: [
      'optimizely',
      'optly',
      'optimizelyEndUserId'
    ],
    header_patterns: [],
    script_patterns: [
      'cdn\\.optimizely\\.com',
      'optimizely\\.com/js'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50,
    header_weight: 0.10,
    script_weight: 0.45,
    min_confidence: 0.38
  },
  {
    name: 'VWO',
    category: 'A/B Testing',
    html_patterns: [
      'vwo_',
      '_vwo_code',
      'visualWebsiteOptimizer'
    ],
    header_patterns: [],
    script_patterns: [
      'dev\\.visualwebsiteoptimizer\\.com',
      'cdn\\.vwo\\.com'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50,
    header_weight: 0.10,
    script_weight: 0.45,
    min_confidence: 0.38
  },

  // ─── SERVER TECHNOLOGY ────────────────────────────────────────────────
  {
    name: 'Nginx',
    category: 'Web Server',
    html_patterns: [],
    header_patterns: [
      'server: nginx',
      'server: openresty'
    ],
    script_patterns: [],
    url_patterns: [],
    version_patterns: [
      'server: nginx\\/([\\d.]+)'
    ],
    html_weight: 0.10,
    header_weight: 0.70,
    script_weight: 0.10,
    min_confidence: 0.35
  },
  {
    name: 'Apache',
    category: 'Web Server',
    html_patterns: [],
    header_patterns: [
      'server: apache',
      'server: apache2',
      'x-powered-by: php'
    ],
    script_patterns: [],
    url_patterns: [],
    version_patterns: [
      'server: apache\\/([\\d.]+)'
    ],
    html_weight: 0.10,
    header_weight: 0.70,
    script_weight: 0.10,
    min_confidence: 0.35
  },
  {
    name: 'PHP',
    category: 'Programming Language',
    html_patterns: [],
    header_patterns: [
      'x-powered-by: php',
      'set-cookie:.*phpsessid'
    ],
    script_patterns: [],
    url_patterns: [
      '\\.php'
    ],
    version_patterns: [
      'x-powered-by: php\\/([\\d.]+)'
    ],
    html_weight: 0.10,
    header_weight: 0.60,
    script_weight: 0.10,
    min_confidence: 0.33
  },
  {
    name: 'Ruby on Rails',
    category: 'Programming Language',
    html_patterns: [
      'csrf-param',
      'csrf-token',
      'authenticity_token',
      'data-turbo-'
    ],
    header_patterns: [
      'x-powered-by: phusion passenger',
      'x-runtime',
      'x-request-id',
      'set-cookie:.*_session'
    ],
    script_patterns: [
      'rails-ujs',
      'turbolinks',
      'turbo\\.js'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.40,
    header_weight: 0.40,
    script_weight: 0.35,
    min_confidence: 0.35
  },
  {
    name: 'Django',
    category: 'Programming Language',
    html_patterns: [
      'csrfmiddlewaretoken',
      'django',
      '__admin_media_prefix__'
    ],
    header_patterns: [
      'x-frame-options: sameorigin',
      'set-cookie:.*csrftoken',
      'set-cookie:.*sessionid'
    ],
    script_patterns: [],
    url_patterns: [
      '/admin/',
      '/static/'
    ],
    version_patterns: [],
    html_weight: 0.45,
    header_weight: 0.40,
    script_weight: 0.10,
    min_confidence: 0.35
  },
  {
    name: 'Laravel',
    category: 'Programming Language',
    html_patterns: [
      'laravel',
      'csrf-token',
      'laravel_session'
    ],
    header_patterns: [
      'set-cookie:.*laravel_session',
      'set-cookie:.*xsrf-token',
      'x-powered-by: php'
    ],
    script_patterns: [
      'laravel\\.js',
      'app\\.js'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.40,
    header_weight: 0.40,
    script_weight: 0.20,
    min_confidence: 0.35
  }
];

module.exports = { FALLBACK_PATTERNS };
