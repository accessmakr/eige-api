'use strict';

// ─── FALLBACK PATTERN LIBRARY — EIGE v10 ─────────────────────────────────────
//
// This is the 100-technology fallback detection library used when the database
// is unavailable. It is identical in structure to the seeded tech_patterns table.
//
// PATTERN DESIGN PRINCIPLE — ALL HTML PATTERNS MUST BE TECHNICAL ARTIFACTS:
// Every html_pattern must match something that ONLY EXISTS when a technology
// is actually running — file paths, runtime globals, specific data attributes,
// cookie names, SDK initialisation calls, or unique string tokens injected
// by the technology into the DOM.
//
// NEVER use the technology's own name as a bare html_pattern.
// A page that TALKS ABOUT WordPress does not RUN WordPress.
// A page that MENTIONS Cloudflare is not BEHIND Cloudflare.
// A page built with Tailwind that says "Bootstrap is a CSS framework" does
// not run Bootstrap.
//
// Hosting and CDN detection must come from HTTP response headers only.
// Bare word html_patterns are the single largest source of false positives.

const FALLBACK_PATTERNS = [

  // ─── JAVASCRIPT FRAMEWORKS ─────────────────────────────────────────────────

  {
    name: 'React',
    category: 'JavaScript Framework',
    html_patterns: [
      '__NEXT_DATA__',        // Next.js SSR hydration script
      'data-reactroot',       // Root attribute injected by ReactDOM.render
      'data-reactid',         // Legacy element ID injected by React
      '_reactFiber',          // React Fiber internal reference
      'ReactDOM',             // ReactDOM global in inline scripts
      '__react_',             // React internal global prefix
      '__REACT_DEVTOOLS_GLOBAL_HOOK__', // DevTools hook, present in all React apps
      'react-dom'             // Script reference in inline code
    ],
    header_patterns: ['x-powered-by: react', 'x-nextjs'],
    script_patterns: [
      'react\\.min\\.js', 'react\\.production\\.min\\.js', 'react-dom',
      '\\/react@', 'unpkg\\.com/react', 'cdn\\.jsdelivr\\.net/npm/react',
      'react\\.development\\.js'
    ],
    url_patterns: [],
    version_patterns: [
      'react@([\\d.]+)', '"react":"([\\d.]+)"', 'react\\/([\\d.]+)\\/react'
    ],
    html_weight: 0.4, header_weight: 0.4, script_weight: 0.35, min_confidence: 0.40
  },

  {
    name: 'Next.js',
    category: 'JavaScript Framework',
    html_patterns: [
      '__NEXT_DATA__',             // Server-side data hydration script tag
      '__NEXT_LOADED_PAGES__',     // Page manifest global
      '_next/static',              // Build output directory path
      '_next/chunks',              // Code split chunk path
      '__nextjs',                  // Next.js internal global prefix
      'next/dist',                 // Next.js dist path in scripts
      '__NEXT_P',                  // Page preload global
      'next-route-announcer',      // Accessibility route announcer element
      '__NEXT_ROUTER_BASEPATH'     // Router configuration global
    ],
    header_patterns: [
      'x-powered-by: next\\.js', 'x-nextjs-cache',
      'x-nextjs-page', 'x-next-cache'
    ],
    script_patterns: [
      '_next/static/chunks', '_next/static/runtime', 'next/dist/client'
    ],
    url_patterns: [],
    version_patterns: ['"next":"([\\d.]+)"', 'next\\/([\\d.]+)\\/'],
    html_weight: 0.45, header_weight: 0.45, script_weight: 0.40, min_confidence: 0.45
  },

  {
    name: 'Vue.js',
    category: 'JavaScript Framework',
    html_patterns: [
      'data-v-',          // Scoped CSS attribute injected by Vue SFC compiler
      '__vue__',          // Vue 2 runtime instance global
      '__VUE__',          // Vue 3 runtime global
      'v-cloak',          // Directive that only appears in Vue templates
      '__NUXT__',         // Nuxt.js server-side data global (implies Vue)
      '__VUE_OPTIONS_API__',     // Vue 3 compilation flag
      '__VUE_PROD_DEVTOOLS__'    // Vue 3 compilation flag
    ],
    header_patterns: ['x-powered-by: nuxt'],
    script_patterns: [
      'vue\\.min\\.js', 'vue\\.runtime\\.min\\.js', '\\/vue@',
      'cdn\\.jsdelivr\\.net/npm/vue', 'unpkg\\.com/vue', 'vue\\.global\\.prod\\.js'
    ],
    url_patterns: [],
    version_patterns: [
      'vue@([\\d.]+)', '"vue":"([\\d.]+)"', 'Vue\\.version="([\\d.]+)"'
    ],
    html_weight: 0.40, header_weight: 0.30, script_weight: 0.35, min_confidence: 0.38
  },

  {
    name: 'Angular',
    category: 'JavaScript Framework',
    html_patterns: [
      'ng-version',          // Attribute Angular adds to root element
      '_nghost',             // View encapsulation host attribute
      '_ngcontent',          // View encapsulation content attribute
      'ng-reflect-',         // Debug binding attribute in development mode
      'ng-star-inserted'     // Added by structural directives ngIf/ngFor
    ],
    header_patterns: [],
    script_patterns: ['angular\\.min\\.js', 'angular\\.js', '\\/angular@', 'zone\\.js'],
    url_patterns: [],
    version_patterns: [
      'ng-version="([\\d.]+)"', 'angular@([\\d.]+)', '"@angular/core":"([\\d.]+)"'
    ],
    html_weight: 0.45, header_weight: 0.20, script_weight: 0.35, min_confidence: 0.40
  },

  {
    name: 'Svelte',
    category: 'JavaScript Framework',
    html_patterns: [
      'svelte-',       // Svelte component attribute prefix
      '__svelte',      // Svelte runtime global
      'svelte/internal',  // Svelte internal module path in scripts
      'SvelteComponent',  // Base class reference in scripts
      'svelte-kit',    // SvelteKit-specific marker
      'data-svelte-h', // Svelte hydration hash attribute
      'svelte-announcer'  // SvelteKit accessibility announcer
    ],
    header_patterns: [],
    script_patterns: [
      'svelte\\.js', 'svelte/internal', '\\/svelte@',
      '_app/immutable', 'svelte-kit'
    ],
    url_patterns: ['_app/immutable'],
    version_patterns: ['svelte@([\\d.]+)', '"svelte":"([\\d.]+)"'],
    html_weight: 0.40, header_weight: 0.20, script_weight: 0.35, min_confidence: 0.38
  },

  {
    name: 'Nuxt.js',
    category: 'JavaScript Framework',
    html_patterns: [
      '__NUXT__',      // Server-side data serialisation global
      'nuxt-link',     // Nuxt router component rendered attribute
      '_nuxt/',        // Build output directory path
      'nuxt/dist',     // Nuxt dist path in scripts
      '__nuxt',        // Nuxt app mount container ID
      'nuxt-island',   // Nuxt 3 island component marker
      '__NUXT_DATA__'  // Nuxt 3 deferred data global
      // REMOVED: bare 'nuxtjs' — any page mentioning Nuxt.js matches
    ],
    header_patterns: ['x-powered-by: nuxt'],
    script_patterns: [
      '_nuxt/runtime', '_nuxt/entry', 'nuxt/dist/app', '_nuxt/builds'
    ],
    url_patterns: ['_nuxt/'],
    version_patterns: ['"nuxt":"([\\d.]+)"', 'nuxt@([\\d.]+)'],
    html_weight: 0.45, header_weight: 0.35, script_weight: 0.40, min_confidence: 0.42
  },

  {
    name: 'Astro',
    category: 'JavaScript Framework',
    html_patterns: [
      'astro-island',   // Island architecture custom element
      'astro-slot',     // Slot element in island components
      'data-astro-',    // Astro component compiler attribute prefix
      'astro:load',     // Client directive
      'astro:idle',     // Client directive
      'astro:visible',  // Client directive
      'astro:only',     // Client directive
      'astro:media'     // Client directive
    ],
    header_patterns: ['x-powered-by: astro'],
    script_patterns: ['\\/astro\\/', 'astro/client', '@astrojs'],
    url_patterns: [],
    version_patterns: ['"astro":"([\\d.]+)"'],
    html_weight: 0.50, header_weight: 0.30, script_weight: 0.30, min_confidence: 0.40
  },

  {
    name: 'Remix',
    category: 'JavaScript Framework',
    html_patterns: [
      '__remixContext',       // Server-side data hydration global
      '__remixRouteModules',  // Route module registry
      '__remixManifest',      // Asset and route manifest
      'data-remix-',          // Remix-specific data attributes
      'remix-island',         // Remix island component
      '__remix_island'        // Remix island global
    ],
    header_patterns: [],
    script_patterns: ['\\/build\\/root-', 'entry\\.client', '@remix-run'],
    url_patterns: [],
    version_patterns: ['"@remix-run/react":"([\\d.]+)"'],
    html_weight: 0.50, header_weight: 0.20, script_weight: 0.35, min_confidence: 0.42
  },

  {
    name: 'Ember.js',
    category: 'JavaScript Framework',
    html_patterns: [
      'ember-application',   // Root element class
      'ember-view',          // Class added to all Ember view elements
      'Ember\\.Application', // Application initialisation in scripts
      '__ember',             // Ember internal global prefix
      'data-ember-action',   // Action binding attribute
      'ember-cli-build'      // Build config reference
    ],
    header_patterns: [],
    script_patterns: [
      'ember\\.min\\.js', 'ember\\.debug\\.js',
      'assets/vendor\\.js', '\\/ember@'
    ],
    url_patterns: [],
    version_patterns: ['ember@([\\d.]+)', 'Ember\\.VERSION="([\\d.]+)"'],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.40, min_confidence: 0.38
  },

  {
    name: 'Backbone.js',
    category: 'JavaScript Library',
    // REMOVED: bare 'backbone' — any page mentioning Backbone.js matches.
    html_patterns: [
      'Backbone\\.View',    // Backbone View class reference in scripts
      'Backbone\\.Model',   // Backbone Model class reference
      'Backbone\\.Router',  // Backbone Router class reference
      'Backbone\\.Events'   // Backbone Events mixin reference
    ],
    header_patterns: [],
    script_patterns: [
      'backbone\\.min\\.js', 'backbone\\.js', '\\/backbone@',
      'cdn\\.jsdelivr\\.net/npm/backbone'
    ],
    url_patterns: [],
    version_patterns: ['backbone@([\\d.]+)', 'Backbone\\.VERSION="([\\d.]+)"'],
    html_weight: 0.40, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.35
  },

  {
    name: 'jQuery',
    category: 'JavaScript Library',
    // REMOVED: bare 'jquery' — any page mentioning jQuery matches.
    html_patterns: [
      '\\$\\.fn\\.jquery',      // jQuery version property on prototype
      'jQuery\\.fn\\.jquery',   // Same via full name
      'jQuery\\(',              // jQuery() call in inline scripts
      '\\$(document)\\.ready'   // DOMReady pattern
    ],
    header_patterns: [],
    script_patterns: [
      'jquery\\.min\\.js', 'jquery\\.js', 'jquery-[\\d.]+\\.min\\.js',
      'code\\.jquery\\.com', 'ajax\\.googleapis\\.com/ajax/libs/jquery'
    ],
    url_patterns: [],
    version_patterns: [
      'jQuery v([\\d.]+)', 'jquery@([\\d.]+)', 'jquery\\/([\\d.]+)\\/'
    ],
    html_weight: 0.40, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.35
  },

  {
    name: 'Alpine.js',
    category: 'JavaScript Framework',
    // x-data, x-bind, x-on: etc. are Alpine directive attributes.
    // These only exist on pages that actually use Alpine.js.
    // REMOVED: bare 'alpine' — any page mentioning Alpine.js matches.
    html_patterns: [
      'x-data', 'x-bind', 'x-on:', 'x-show', 'x-if',
      'x-for', 'x-model', 'x-text', 'x-html', 'x-ref', 'x-cloak'
    ],
    header_patterns: [],
    script_patterns: [
      'alpinejs', 'alpine\\.js',
      'cdn\\.jsdelivr\\.net/npm/alpinejs', 'unpkg\\.com/alpinejs'
    ],
    url_patterns: [],
    version_patterns: ['alpinejs@([\\d.]+)', '"alpinejs":"([\\d.]+)"'],
    html_weight: 0.55, header_weight: 0.10, script_weight: 0.40, min_confidence: 0.40
  },

  {
    name: 'SolidJS',
    category: 'JavaScript Framework',
    html_patterns: [
      '_$owner',         // SolidJS reactivity owner tracking global
      'solid-js',        // SolidJS module path in scripts
      'data-hk',         // HydrationKey attribute SolidStart injects
      '__solid'          // SolidJS global prefix
    ],
    header_patterns: [],
    script_patterns: ['solid-js', '\\/solid@', 'solid-start'],
    url_patterns: [],
    version_patterns: ['"solid-js":"([\\d.]+)"'],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.40, min_confidence: 0.38
  },

  {
    name: 'Preact',
    category: 'JavaScript Framework',
    html_patterns: [
      '__preactSignalBase',  // Preact signals runtime global
      'preact/compat',       // Preact compat layer path in scripts
      'data-preact-'         // Preact-specific data attributes
    ],
    header_patterns: [],
    script_patterns: [
      'preact\\.min\\.js', '\\/preact@',
      'cdn\\.jsdelivr\\.net/npm/preact', 'unpkg\\.com/preact/compat'
    ],
    url_patterns: [],
    version_patterns: ['preact@([\\d.]+)', '"preact":"([\\d.]+)"'],
    html_weight: 0.40, header_weight: 0.10, script_weight: 0.40, min_confidence: 0.38
  },

  // ─── CMS PLATFORMS ─────────────────────────────────────────────────────────

  {
    name: 'WordPress',
    category: 'CMS',
    // All patterns are file paths or API endpoints unique to WordPress.
    // wp-content and wp-includes are the WordPress directory structure.
    // xmlrpc.php and wp-login.php are WordPress-specific endpoint files.
    // REMOVED: bare 'wordpress' — matches any page that mentions WordPress.
    html_patterns: [
      'wp-content',    // WordPress content directory path
      'wp-includes',   // WordPress core includes directory
      'wp-json',       // WordPress REST API base path
      'wp-block',      // Block editor block class prefix
      'wp-embed',      // WordPress oEmbed container
      'wp-emoji',      // WordPress emoji script
      'xmlrpc\\.php',  // WordPress XML-RPC endpoint
      'wp-login\\.php', // WordPress login page
      'wp-settings',   // WordPress settings script
      'wp-admin',      // WordPress admin path
      'woocommerce'    // WooCommerce plugin presence (implies WordPress)
    ],
    header_patterns: ['x-powered-by: wp', 'x-pingback', 'link:.*wp-json'],
    script_patterns: [
      'wp-includes/js', 'wp-content/themes',
      'wp-content/plugins', 'wp-emoji-release\\.min\\.js'
    ],
    url_patterns: ['wp-admin', 'wp-login'],
    version_patterns: [
      'WordPress ([\\d.]+)', '"version":"([\\d.]+)","name":"WordPress"'
    ],
    html_weight: 0.50, header_weight: 0.35, script_weight: 0.40, min_confidence: 0.40
  },

  {
    name: 'Drupal',
    category: 'CMS',
    html_patterns: [
      'Drupal\\.settings',  // Drupal JS settings object
      'drupal\\.js',        // Drupal core JS file
      'drupal-',            // Drupal CSS class prefix
      'data-drupal-',       // Drupal data attribute prefix
      '/sites/default/files', // Drupal default file storage path
      'drupal/core',        // Drupal core path
      'Drupal\\.behaviors', // Drupal behaviours API
      'drupalSettings',     // Drupal 8+ JS settings object
      'data-drupal-link'    // Drupal active link attribute
    ],
    header_patterns: [
      'x-drupal-cache', 'x-generator: drupal', 'x-drupal-dynamic-cache'
    ],
    script_patterns: [
      '/core/misc/drupal', 'drupal\\.min\\.js',
      '/sites/all/modules', '/core/assets/vendor'
    ],
    url_patterns: ['/node/', '/sites/default'],
    version_patterns: ['Drupal ([\\d.]+)', '"Drupal":"([\\d.]+)"'],
    html_weight: 0.45, header_weight: 0.40, script_weight: 0.35, min_confidence: 0.38
  },

  {
    name: 'Joomla',
    category: 'CMS',
    // REMOVED: bare 'joomla' — any page mentioning Joomla matches.
    html_patterns: [
      '/media/jui/',           // Joomla UI library path
      '/components/com_',      // Joomla component URL structure
      '/modules/mod_',         // Joomla module URL structure
      '/media/system/',        // Joomla system media path
      'joomla-script-options', // Joomla script options JSON container
      'data-joomla-'           // Joomla data attribute prefix
    ],
    header_patterns: ['x-content-powered-by: joomla'],
    script_patterns: [
      '/media/jui/js/', '/media/system/js/',
      'joomla\\.javascript\\.js'
    ],
    url_patterns: ['/component/', '/administrator/'],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.30, script_weight: 0.35, min_confidence: 0.38
  },

  {
    name: 'Ghost',
    category: 'CMS',
    html_patterns: [
      'ghost/core',        // Ghost core path
      'ghost-theme',       // Ghost theme class
      'ghost-url',         // Ghost URL script
      'data-ghost-',       // Ghost data attribute prefix
      '__ghost',           // Ghost global
      'ghost-portal'       // Ghost portal overlay
    ],
    header_patterns: ['x-powered-by: ghost'],
    script_patterns: ['ghost/core/shared', 'unpkg\\.com/ghost-storage'],
    url_patterns: ['/ghost/'],
    version_patterns: ['"version":"([\\d.]+)","name":"Ghost"'],
    html_weight: 0.45, header_weight: 0.30, script_weight: 0.30, min_confidence: 0.38
  },

  {
    name: 'Contentful',
    category: 'CMS',
    // REMOVED: bare 'contentful' — any page mentioning Contentful matches.
    html_patterns: [
      'ctfl-',               // Contentful CSS class prefix
      'data-contentful',     // Contentful data attribute
      '__contentfulPreview', // Contentful live preview global
      'contentful-preview'   // Contentful preview class
    ],
    header_patterns: ['x-powered-by: contentful'],
    script_patterns: [
      'cdn\\.contentful\\.com', 'contentful\\.com/app',
      '@contentful/rich-text'
    ],
    url_patterns: ['\\.contentful\\.com'],
    version_patterns: [],
    html_weight: 0.40, header_weight: 0.30, script_weight: 0.40, min_confidence: 0.38
  },

  {
    name: 'Sanity',
    category: 'CMS',
    // REMOVED: 'sanity.io' from html_patterns — any page linking to sanity.io matches.
    html_patterns: [
      'sanity-studio',  // Sanity Studio container class
      '__sanity'        // Sanity global
    ],
    header_patterns: ['x-powered-by: sanity'],
    script_patterns: ['cdn\\.sanity\\.io', '@sanity/client'],
    url_patterns: ['\\.sanity\\.io', '\\.sanity\\.studio'],
    version_patterns: [],
    html_weight: 0.40, header_weight: 0.25, script_weight: 0.40, min_confidence: 0.38
  },

  {
    name: 'Webflow',
    category: 'CMS',
    // data-wf- attributes are injected by Webflow into every managed element.
    // REMOVED: bare 'webflow' — any page mentioning Webflow matches.
    // REMOVED: 'wf-' — two-character prefix used in many custom CSS frameworks.
    html_patterns: [
      'data-wf-',         // Webflow element identifier attribute
      'w-webflow-badge',  // Webflow badge added to free plans
      'wf-form-',         // Webflow form class prefix
      'data-w-id',        // Webflow unique element ID attribute
      'webflow-badge'     // Webflow badge container class
    ],
    header_patterns: ['x-powered-by: webflow'],
    script_patterns: [
      'assets\\.website-files\\.com', 'webflow\\.js',
      'd3e54v103j8qbb\\.cloudfront\\.net'
    ],
    url_patterns: ['\\.webflow\\.io'],
    version_patterns: [],
    html_weight: 0.50, header_weight: 0.35, script_weight: 0.40, min_confidence: 0.40
  },

  {
    name: 'Squarespace',
    category: 'CMS',
    // REMOVED: bare 'squarespace' — any page mentioning Squarespace matches.
    html_patterns: [
      'data-squarespace-',          // Squarespace data attribute prefix
      'Static\\.SQUARESPACE_CONTEXT', // Squarespace context global
      'squarespace-cdn',            // Squarespace CDN class
      'sqs-block',                  // Squarespace block class prefix
      'sqs-layout'                  // Squarespace layout class prefix
    ],
    header_patterns: ['x-powered-by: squarespace', 'x-squarespace-version'],
    script_patterns: ['static\\.squarespace\\.com'],
    url_patterns: ['\\.squarespace\\.com'],
    version_patterns: [],
    html_weight: 0.50, header_weight: 0.35, script_weight: 0.30, min_confidence: 0.40
  },

  {
    name: 'Wix',
    category: 'CMS',
    html_patterns: [
      'wix-code',        // Wix Velo/Code component
      '_wix_',           // Wix internal class prefix
      'wixstatic\\.com', // Wix static CDN domain
      'parastorage\\.com', // Wix storage CDN domain
      'X-Wix-Meta-Site-Id' // Wix meta tag injected into pages
    ],
    header_patterns: ['x-wix-request-id', 'x-seen-by'],
    script_patterns: ['static\\.parastorage\\.com', 'wix\\.com/apps'],
    url_patterns: ['\\.wixsite\\.com', '\\.wix\\.com'],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.40, script_weight: 0.30, min_confidence: 0.38
  },

  // ─── E-COMMERCE ────────────────────────────────────────────────────────────

  {
    name: 'Shopify',
    category: 'E-Commerce',
    html_patterns: [
      'Shopify\\.theme',       // Shopify theme global object
      'cdn\\.shopify\\.com',   // Shopify CDN domain
      'myshopify\\.com',       // Shopify subdomain
      'shopify-section',       // Section data attribute
      'shopify_analytics',     // Analytics script variable
      'Shopify\\.shop',        // Shop identifier global
      'ShopifyAnalytics',      // Analytics global object
      'Shopify\\.currency'     // Currency global object
    ],
    header_patterns: ['x-shopify-stage', 'x-shopid', 'x-shardid'],
    script_patterns: [
      'cdn\\.shopify\\.com/s/files', 'shopify\\.com/s/trekkie'
    ],
    url_patterns: ['\\.myshopify\\.com'],
    version_patterns: [],
    html_weight: 0.50, header_weight: 0.45, script_weight: 0.40, min_confidence: 0.42
  },

  {
    name: 'WooCommerce',
    category: 'E-Commerce',
    // REMOVED: 'wc-' — matches any CSS class containing wc- (extremely common
    // in custom code e.g. class="wc-container", class="wc-header").
    html_patterns: [
      'woocommerce',            // WooCommerce body class
      'data-product_id',        // WooCommerce product ID attribute
      'wc_add_to_cart',         // Add to cart event
      'is-woocommerce',         // WooCommerce page body class
      'woocommerce-cart',       // Cart page class
      'woocommerce-checkout',   // Checkout page class
      'woocommerce-page',       // WooCommerce page class
      'wc_cart_fragments_params' // Cart fragments script variable
    ],
    header_patterns: [],
    script_patterns: [
      'woocommerce/assets', 'wc-add-to-cart',
      'woocommerce\\.min\\.js', 'wc-cart-fragments'
    ],
    url_patterns: ['/shop/', '/cart/', '/checkout/', '/product/'],
    version_patterns: ['WooCommerce ([\\d.]+)'],
    html_weight: 0.50, header_weight: 0.15, script_weight: 0.40, min_confidence: 0.42
  },

  {
    name: 'Magento',
    category: 'E-Commerce',
    // REMOVED: 'mage/' — this substring appears inside 'image/' on every
    // website that uses images. e.g. data:image/svg matches 'mage/'.
    // REMOVED: bare 'magento' — any page mentioning Magento matches.
    // REMOVED: 'varien/' — too generic and rarely present in modern Magento 2.
    html_patterns: [
      'Mage\\.Cookie',          // Magento JS cookie utility global
      'Mage\\.Cookies',         // Alternative Magento cookie global
      'var Mage =',             // Magento global object declaration
      'data-mage-',             // Magento data attribute prefix
      'Magento_',               // Magento module name prefix in scripts
      'skin/frontend/',         // Magento 1 theme skin path
      'mage/cookies',           // Magento RequireJS module path
      'mage/storage',           // Magento RequireJS storage module
      '_magentoInitialData'     // Magento 2 initial data global
    ],
    header_patterns: ['x-magento-cache-debug', 'x-magento-tags'],
    script_patterns: [
      'mage/bootstrap', 'requirejs/require\\.js',
      'pub/static/frontend', 'Magento_Theme'
    ],
    url_patterns: ['/catalog/product/', '/checkout/cart/'],
    version_patterns: ['Magento\\/(\\d+\\.\\d+)'],
    html_weight: 0.50, header_weight: 0.40, script_weight: 0.35, min_confidence: 0.42
  },

  {
    name: 'BigCommerce',
    category: 'E-Commerce',
    // REMOVED: bare 'bigcommerce' — any page mentioning BigCommerce matches.
    html_patterns: [
      'BCData',                  // BigCommerce data global object
      'bigcommerce-checkout',    // BigCommerce checkout class
      'bc-sf-filter',            // BigCommerce search filter class
      'BCApp',                   // BigCommerce app global
      'data-cart-'               // BigCommerce cart data attribute
    ],
    header_patterns: ['x-bc-storefront', 'x-bigcommerce-'],
    script_patterns: [
      'cdn11\\.bigcommerce\\.com', 'bigcommerce\\.com/stencil'
    ],
    url_patterns: ['\\.mybigcommerce\\.com'],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.40, script_weight: 0.35, min_confidence: 0.40
  },

  {
    name: 'PrestaShop',
    category: 'E-Commerce',
    // REMOVED: bare 'prestashop' — any page mentioning PrestaShop matches.
    // REMOVED: 'add-to-cart' — this class is used by every e-commerce platform
    // and custom implementation — not specific to PrestaShop.
    html_patterns: [
      'PrestaShop',          // Capital P — initialisation call in scripts
      'id_product',          // PrestaShop product ID form field
      'prestashop-preloader', // PrestaShop page loader class
      'blockcart',           // PrestaShop cart block class
      'ps-touchspin'         // PrestaShop quantity selector class
    ],
    header_patterns: [],
    script_patterns: [
      'themes/classic/', '/modules/ps_', 'themes/hummingbird/'
    ],
    url_patterns: ['/index.php?controller=', '/module/'],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.15, script_weight: 0.30, min_confidence: 0.38
  },

  // ─── CDN AND HOSTING ───────────────────────────────────────────────────────

  {
    name: 'Cloudflare',
    category: 'CDN',
    // Cloudflare is detected almost exclusively via its HTTP response headers.
    // The few HTML patterns here are runtime tokens Cloudflare injects.
    // REMOVED: bare 'cloudflare' — any page mentioning Cloudflare matches.
    html_patterns: [
      '__cf_bm',            // Cloudflare Bot Management cookie
      'cf-challenge',       // Cloudflare challenge page element
      'cloudflare-static',  // Cloudflare static resource class
      'cf_clearance',       // Cloudflare clearance cookie
      'cloudflare-turnstile' // Cloudflare Turnstile CAPTCHA widget
    ],
    header_patterns: [
      'cf-ray', 'cf-cache-status', 'server: cloudflare',
      'cf-request-id', 'cf-apo-via', 'cf-edge-cache'
    ],
    script_patterns: [
      'cloudflare\\.com/cdn-cgi', 'static\\.cloudflareinsights\\.com',
      'cdn-cgi/scripts', 'challenges\\.cloudflare\\.com'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.35, header_weight: 0.55, script_weight: 0.30, min_confidence: 0.35
  },

  {
    name: 'AWS CloudFront',
    category: 'CDN',
    html_patterns: [],
    header_patterns: [
      'x-amz-cf-id', 'x-amz-cf-pop',
      'via:.*cloudfront', 'x-cache:.*cloudfront'
    ],
    script_patterns: ['cloudfront\\.net'],
    url_patterns: ['\\.cloudfront\\.net'],
    version_patterns: [],
    html_weight: 0.10, header_weight: 0.60, script_weight: 0.25, min_confidence: 0.35
  },

  {
    name: 'Fastly',
    category: 'CDN',
    html_patterns: [],
    header_patterns: [
      'x-fastly-request-id', 'x-served-by:.*cache-',
      'fastly-restarts', 'x-cache:.*HIT',
      'x-timer:.*S', 'via:.*varnish'
    ],
    script_patterns: [],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.10, header_weight: 0.65, script_weight: 0.10, min_confidence: 0.35
  },

  {
    name: 'Akamai',
    category: 'CDN',
    html_patterns: [],
    header_patterns: [
      'x-check-cacheable', 'x-akamai-transformed',
      'akamai-origin-hop', 'x-akamai-request-id'
    ],
    script_patterns: ['akamaized\\.net', 'akamaihd\\.net'],
    url_patterns: ['\\.akamaized\\.net', '\\.akamaihd\\.net'],
    version_patterns: [],
    html_weight: 0.10, header_weight: 0.65, script_weight: 0.20, min_confidence: 0.35
  },

  {
    name: 'BunnyCDN',
    category: 'CDN',
    html_patterns: [],
    header_patterns: ['cdn-pullzone', 'cdn-uid', 'cdn-requestid'],
    script_patterns: [],
    url_patterns: ['\\.b-cdn\\.net'],
    version_patterns: [],
    html_weight: 0.10, header_weight: 0.60, script_weight: 0.10, min_confidence: 0.35
  },

  {
    name: 'Vercel',
    category: 'Hosting',
    html_patterns: [],
    header_patterns: [
      'x-vercel-id', 'x-vercel-cache',
      'server: vercel', 'x-vercel-deployment-url', 'x-vercel-ip-country'
    ],
    script_patterns: [],
    url_patterns: ['\\.vercel\\.app'],
    version_patterns: [],
    html_weight: 0.20, header_weight: 0.65, script_weight: 0.10, min_confidence: 0.33
  },

  {
    name: 'Netlify',
    category: 'Hosting',
    // REMOVED: bare 'netlify' — any page mentioning Netlify matches.
    html_patterns: [
      'data-netlify',     // Attribute on Netlify Forms-processed forms
      'netlify-identity'  // Netlify Identity widget container
    ],
    header_patterns: [
      'x-nf-request-id', 'server: netlify',
      'x-netlify-cache', 'netlify-cdn-cache-control', 'netlify-vary'
    ],
    script_patterns: ['netlify-identity-widget'],
    url_patterns: ['\\.netlify\\.app', '\\.netlify\\.com'],
    version_patterns: [],
    html_weight: 0.20, header_weight: 0.65, script_weight: 0.10, min_confidence: 0.33
  },

  {
    name: 'AWS',
    category: 'Hosting',
    html_patterns: [],
    header_patterns: [
      'x-amzn-requestid', 'x-amz-request-id',
      'server: awselb', 'x-amzn-trace-id'
    ],
    script_patterns: ['s3\\.amazonaws\\.com', '\\.s3\\.amazonaws\\.com'],
    url_patterns: ['\\.amazonaws\\.com'],
    version_patterns: [],
    html_weight: 0.10, header_weight: 0.60, script_weight: 0.25, min_confidence: 0.33
  },

  {
    name: 'Google Cloud',
    category: 'Hosting',
    html_patterns: [],
    header_patterns: [
      'x-goog-request-id', 'server: google frontend',
      'x-google-backends', 'via: 1\\.1 google'
    ],
    script_patterns: [],
    url_patterns: ['\\.appspot\\.com', '\\.run\\.app'],
    version_patterns: [],
    html_weight: 0.10, header_weight: 0.60, script_weight: 0.10, min_confidence: 0.33
  },

  {
    name: 'Azure',
    category: 'Hosting',
    html_patterns: [],
    header_patterns: [
      'x-ms-request-id', 'x-azure-ref',
      'x-ms-version', 'arr-disable-session-affinity'
    ],
    script_patterns: [],
    url_patterns: ['\\.azurewebsites\\.net', '\\.azure\\.com'],
    version_patterns: [],
    html_weight: 0.10, header_weight: 0.60, script_weight: 0.10, min_confidence: 0.33
  },

  {
    name: 'Heroku',
    category: 'Hosting',
    html_patterns: [],
    header_patterns: ['x-request-id', 'x-runtime', 'x-heroku-queue-wait-time'],
    script_patterns: [],
    url_patterns: ['\\.herokuapp\\.com'],
    version_patterns: [],
    html_weight: 0.10, header_weight: 0.45, script_weight: 0.10, min_confidence: 0.30
  },

  {
    name: 'Render',
    category: 'Hosting',
    html_patterns: [],
    header_patterns: ['x-render-origin-server', 'rndr-id'],
    script_patterns: [],
    url_patterns: ['\\.onrender\\.com'],
    version_patterns: [],
    html_weight: 0.10, header_weight: 0.55, script_weight: 0.10, min_confidence: 0.33
  },

  // ─── CSS FRAMEWORKS ────────────────────────────────────────────────────────

  {
    name: 'Tailwind CSS',
    category: 'CSS Framework',
    // Tailwind is detected via its CDN script, build config reference,
    // and Tailwind-specific variant syntax (hover:, sm:, md: etc).
    // These colon-prefixed class names are unique to Tailwind.
    // REMOVED: 'tw-' — used in many custom CSS frameworks as a prefix.
    // REMOVED: generic class patterns like flex, grid, text-, bg-, rounded,
    // shadow — these appear in Bootstrap, custom CSS, and every utility system.
    html_patterns: [
      'tailwindcss',        // Tailwind CDN or config reference
      'tailwind\\.config'   // Tailwind configuration reference
    ],
    header_patterns: [],
    script_patterns: ['tailwindcss', 'cdn\\.tailwindcss\\.com'],
    url_patterns: [],
    version_patterns: ['tailwindcss@([\\d.]+)', '"tailwindcss":"([\\d.]+)"'],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.35, min_confidence: 0.35
  },

  {
    name: 'Bootstrap',
    category: 'CSS Framework',
    // Bootstrap 5: data-bs-* data attributes are specific to Bootstrap 5
    // component initialisation. Bootstrap 4: data-toggle, data-dismiss.
    // These attributes are ONLY added by Bootstrap's JavaScript components.
    // REMOVED: bare 'bootstrap' — matches any page mentioning Bootstrap.
    // REMOVED: ALL class-based patterns (container, row, col-, btn, navbar,
    // modal, carousel, dropdown) — these CSS class names are used by virtually
    // every CSS framework and custom stylesheet on the internet.
    html_patterns: [
      'data-bs-toggle',     // Bootstrap 5 toggle attribute
      'data-bs-dismiss',    // Bootstrap 5 dismiss attribute
      'data-bs-target',     // Bootstrap 5 target attribute
      'data-bs-content',    // Bootstrap 5 popover content attribute
      'data-bs-spy',        // Bootstrap 5 scrollspy attribute
      'data-toggle="modal"',    // Bootstrap 4 modal trigger
      'data-toggle="dropdown"', // Bootstrap 4 dropdown trigger
      'data-dismiss="modal"'    // Bootstrap 4 modal dismiss
    ],
    header_patterns: [],
    script_patterns: [
      'bootstrap\\.min\\.js', 'bootstrap\\.bundle\\.min\\.js',
      'getbootstrap\\.com', 'cdn\\.jsdelivr\\.net/npm/bootstrap'
    ],
    url_patterns: [],
    version_patterns: [
      'bootstrap@([\\d.]+)', '"bootstrap":"([\\d.]+)"', 'Bootstrap v([\\d.]+)'
    ],
    html_weight: 0.40, header_weight: 0.10, script_weight: 0.40, min_confidence: 0.35
  },

  {
    name: 'Material UI',
    category: 'CSS Framework',
    html_patterns: [
      'MuiButton',      // Material UI Button component class prefix
      'MuiTypography',  // Material UI Typography component
      'MuiBox',         // Material UI Box component
      'MuiContainer',   // Material UI Container component
      'makeStyles',     // Material UI JSS hook
      'tss-react'       // TSS React Material UI styling
    ],
    header_patterns: [],
    script_patterns: [
      '@mui/material', 'material-ui\\.com',
      'cdn\\.jsdelivr\\.net/npm/@mui'
    ],
    url_patterns: [],
    version_patterns: ['"@mui/material":"([\\d.]+)"'],
    html_weight: 0.50, header_weight: 0.10, script_weight: 0.40, min_confidence: 0.40
  },

  {
    name: 'Chakra UI',
    category: 'CSS Framework',
    html_patterns: [
      'chakra-',              // Chakra UI class prefix
      'data-theme="chakra"',  // Chakra theme data attribute
      'chakra-ui',            // Chakra UI script reference
      'css-chakra'            // Chakra emotion CSS class prefix
    ],
    header_patterns: [],
    script_patterns: ['@chakra-ui/react', 'chakra-ui\\.com'],
    url_patterns: [],
    version_patterns: ['"@chakra-ui/react":"([\\d.]+)"'],
    html_weight: 0.50, header_weight: 0.10, script_weight: 0.40, min_confidence: 0.40
  },

  // ─── ANALYTICS ─────────────────────────────────────────────────────────────

  {
    name: 'Google Analytics',
    category: 'Analytics',
    // GoogleAnalyticsObject is the GA3 global variable name.
    // gtag( is the GA4 initialisation call in inline scripts.
    // UA-XXXXX-X is the Universal Analytics property ID format.
    // REMOVED: 'G-[A-Z0-9]+' — matches any G- prefixed string in page content
    // (e.g. G-DRIVE, G-SUITE, G-FORCE appearing in text).
    html_patterns: [
      'google-analytics\\.com/analytics\\.js', // GA3 script URL in HTML
      'GoogleAnalyticsObject',                  // GA3 global variable
      'gtag\\(',                                // GA4 function call
      'UA-[0-9]+-[0-9]+'                        // Universal Analytics ID format
    ],
    header_patterns: [],
    script_patterns: [
      'google-analytics\\.com/analytics\\.js',
      'googletagmanager\\.com/gtag/js',
      'google-analytics\\.com/ga\\.js'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.38
  },

  {
    name: 'Google Tag Manager',
    category: 'Tag Manager',
    html_patterns: [
      'GTM-[A-Z0-9]+',          // GTM container ID injected into page
      'googletagmanager\\.com',  // GTM domain in noscript fallback
      'dataLayer\\.push',        // GTM data layer API call
      'dataLayer = \\[\\]'       // GTM data layer initialisation
    ],
    header_patterns: [],
    script_patterns: [
      'googletagmanager\\.com/gtm\\.js',
      'googletagmanager\\.com/ns\\.html'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.38
  },

  {
    name: 'Mixpanel',
    category: 'Analytics',
    html_patterns: [
      'mixpanel\\.track',     // Mixpanel event tracking API
      'mixpanel\\.identify',  // Mixpanel user identification
      'mixpanel\\.init',      // Mixpanel initialisation
      '__mp_opt_in_out_'      // Mixpanel opt-in/out cookie prefix
    ],
    header_patterns: [],
    script_patterns: ['cdn\\.mxpnl\\.com', 'cdn4\\.mxpnl\\.com'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.38
  },

  {
    name: 'Hotjar',
    category: 'Analytics',
    // _hjSettings and hjid are the Hotjar configuration objects and site ID.
    // _hjTLDTest is a cookie Hotjar uses for top-level domain detection.
    // REMOVED: bare 'hotjar' — any page mentioning Hotjar matches.
    html_patterns: [
      'hjSetting',      // Hotjar settings object
      '_hjSettings',    // Hotjar settings global
      'hjid:',          // Hotjar site ID property
      '_hjTLDTest'      // Hotjar TLD test cookie name
    ],
    header_patterns: [],
    script_patterns: ['static\\.hotjar\\.com', 'script\\.hotjar\\.com'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.38
  },

  {
    name: 'Segment',
    category: 'Analytics',
    html_patterns: [
      'analytics\\.load\\(',     // Segment analytics.js load call
      'analytics\\.page\\(',     // Segment page call
      'analytics\\.track\\(',    // Segment track call
      'analytics\\.identify\\(', // Segment identify call
      'cdn\\.segment\\.com'      // Segment CDN domain
    ],
    header_patterns: [],
    script_patterns: ['cdn\\.segment\\.com/analytics\\.js', 'cdn\\.segment\\.io'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.38
  },

  {
    name: 'Plausible',
    category: 'Analytics',
    html_patterns: [],
    header_patterns: [],
    script_patterns: [
      'plausible\\.io/js/plausible',
      'plausible\\.io/js/script'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.20, header_weight: 0.10, script_weight: 0.70, min_confidence: 0.38
  },

  {
    name: 'Fathom Analytics',
    category: 'Analytics',
    html_patterns: [
      'fathom\\.trackGoal',    // Fathom goal tracking API
      'fathom\\.trackPageview' // Fathom page view tracking
    ],
    header_patterns: [],
    script_patterns: ['cdn\\.usefathom\\.com', 'usefathom\\.com/script\\.js'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.50, min_confidence: 0.38
  },

  {
    name: 'PostHog',
    category: 'Analytics',
    html_patterns: [
      'posthog\\.capture',   // PostHog event capture API
      'posthog\\.identify',  // PostHog identify call
      '__PosthogExtensions__' // PostHog extensions global
    ],
    header_patterns: [],
    script_patterns: ['app\\.posthog\\.com', 'us\\.posthog\\.com', 'eu\\.posthog\\.com'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.50, min_confidence: 0.38
  },

  // ─── PAYMENT PROVIDERS ──────────────────────────────────────────────────────

  {
    name: 'Stripe',
    category: 'Payment',
    html_patterns: [
      'stripe\\.createToken',      // Stripe.js token creation API
      'stripe\\.redirectToCheckout', // Stripe checkout redirect
      'StripeElement',             // Stripe-hosted input element class
      '__stripe_mid',              // Stripe measurement cookie
      '__stripe_sid'               // Stripe session cookie
    ],
    header_patterns: [],
    script_patterns: ['js\\.stripe\\.com/v3', 'js\\.stripe\\.com/v2'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.50, min_confidence: 0.42
  },

  {
    name: 'PayPal',
    category: 'Payment',
    html_patterns: [
      'paypal\\.Buttons',  // PayPal JS SDK Buttons API
      'paypal\\.com/sdk'   // PayPal SDK URL in HTML
    ],
    header_patterns: [],
    script_patterns: ['paypal\\.com/sdk/js', 'paypalobjects\\.com'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.50, min_confidence: 0.42
  },

  {
    name: 'Paddle',
    category: 'Payment',
    html_patterns: [
      'Paddle\\.Setup',    // Paddle setup call
      'Paddle\\.Checkout', // Paddle checkout open call
      'PaddleCallback'     // Paddle event callback
    ],
    header_patterns: [],
    script_patterns: ['checkout\\.paddle\\.com/checkout/custom\\.js'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.50, min_confidence: 0.42
  },

  {
    name: 'Braintree',
    category: 'Payment',
    html_patterns: [
      'data-braintree',    // Braintree data attribute
      'braintree-form',    // Braintree form class
      'client_token'       // Braintree client token field
    ],
    header_patterns: [],
    script_patterns: [
      'js\\.braintreegateway\\.com',
      'braintree-web\\.min\\.js'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.40, header_weight: 0.10, script_weight: 0.50, min_confidence: 0.40
  },

  {
    name: 'Square',
    category: 'Payment',
    html_patterns: [
      'sq-payment-form',  // Square payment form class
      'SqPaymentForm'     // Square payment form global
    ],
    header_patterns: [],
    script_patterns: ['squareup\\.com/v2/paymentform', 'web\\.squarecdn\\.com'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.50, min_confidence: 0.42
  },

  {
    name: 'Paystack',
    category: 'Payment',
    // REMOVED: bare 'paystack' — any page mentioning Paystack matches.
    html_patterns: [
      'PaystackPop',        // Paystack Popup API object
      'paystack-button'     // Paystack payment button class
    ],
    header_patterns: [],
    script_patterns: ['js\\.paystack\\.co', 'checkout\\.paystack\\.com'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.50, min_confidence: 0.40
  },

  {
    name: 'Flutterwave',
    category: 'Payment',
    // REMOVED: bare 'flutterwave' — any page mentioning Flutterwave matches.
    html_patterns: [
      'FlutterwaveCheckout', // Flutterwave inline checkout function
      'rave-payment-button'  // Flutterwave payment button class
    ],
    header_patterns: [],
    script_patterns: ['checkout\\.flutterwave\\.com', 'ravepay\\.co'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.50, min_confidence: 0.40
  },

  // ─── CUSTOMER SUPPORT ──────────────────────────────────────────────────────

  {
    name: 'Intercom',
    category: 'Customer Support',
    html_patterns: [
      'intercomSettings',      // Intercom config object injected to window
      'Intercom\\(',           // Intercom API call function
      'intercom-container',    // Injected container div ID
      'intercom-launcher',     // Launcher button class
      'widget\\.intercom\\.io' // Intercom widget domain
    ],
    header_patterns: [],
    script_patterns: ['widget\\.intercom\\.io/widget', 'js\\.intercomcdn\\.com'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.38
  },

  {
    name: 'Zendesk',
    category: 'Customer Support',
    // REMOVED: bare 'zendesk' — any page mentioning Zendesk matches.
    // REMOVED: 'zd-' — two-character prefix too generic and common.
    html_patterns: [
      'zE\\(',     // Zendesk Web Widget API call
      'zEmbed',    // Zendesk embed script container ID
      'zdSettings' // Zendesk configuration object
    ],
    header_patterns: [],
    script_patterns: [
      'static\\.zdassets\\.com', 'ekr\\.zdassets\\.com', 'v2\\.zopim\\.com'
    ],
    url_patterns: ['\\.zendesk\\.com'],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.38
  },

  {
    name: 'Crisp',
    category: 'Customer Support',
    // REMOVED: 'crisp.chat' from html_patterns — any page linking to crisp.chat matches.
    html_patterns: [
      'CRISP_WEBSITE_ID', // Crisp site ID constant
      '$crisp',           // Crisp global API object
      'crisp-client'      // Crisp client script ID
    ],
    header_patterns: [],
    script_patterns: ['client\\.crisp\\.chat', 'cdn\\.crisp\\.chat'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.50, min_confidence: 0.38
  },

  {
    name: 'Drift',
    category: 'Customer Support',
    html_patterns: [
      'drift\\.identify',  // Drift identify API call
      'drift\\.track',     // Drift track API call
      'drift\\.page',      // Drift page API call
      'DRIFT_APP_ID'       // Drift app ID constant
    ],
    header_patterns: [],
    script_patterns: ['js\\.driftt\\.com', 'embed\\.drift\\.com'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.50, min_confidence: 0.38
  },

  {
    name: 'Tawk.to',
    category: 'Customer Support',
    // REMOVED: 'tawk.to' from html_patterns — any page linking to tawk.to matches.
    html_patterns: [
      'Tawk_API',       // Tawk.to global API object
      'Tawk_LoadStart', // Tawk.to load start timestamp
      's1.tawk.to'      // Tawk.to CDN subdomain in HTML
    ],
    header_patterns: [],
    script_patterns: ['embed\\.tawk\\.to', 'tawk\\.to\\/s1\\/'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.50, min_confidence: 0.38
  },

  // ─── MARKETING ─────────────────────────────────────────────────────────────

  {
    name: 'HubSpot',
    category: 'Marketing',
    // REMOVED: bare 'hubspot' — any page mentioning HubSpot matches.
    html_patterns: [
      'hs-script-loader',     // HubSpot script element class
      'hbspt\\.forms\\.create', // HubSpot forms API
      '_hsq\\.push',           // HubSpot tracking queue
      'leadin',                // HubSpot legacy script identifier
      'hs-form'                // HubSpot embedded form class
    ],
    header_patterns: ['x-hs-cf-stack'],
    script_patterns: [
      'js\\.hs-scripts\\.com', 'js\\.hsforms\\.net', 'js\\.hubspot\\.com'
    ],
    url_patterns: ['\\.hubspot\\.com', '\\.hs-sites\\.com'],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.30, script_weight: 0.45, min_confidence: 0.38
  },

  {
    name: 'Mailchimp',
    category: 'Marketing',
    // REMOVED: bare 'mailchimp' — any page mentioning Mailchimp matches.
    html_patterns: [
      'mc-embedded-subscribe', // Mailchimp subscribe button class
      'list-manage\\.com',     // Mailchimp list management domain
      'mc_embed_signup',       // Mailchimp signup container ID
      'chimpstatic\\.com'      // Mailchimp static CDN domain
    ],
    header_patterns: [],
    script_patterns: ['chimpstatic\\.com', 'cdn-images\\.mailchimp\\.com'],
    url_patterns: ['\\.list-manage\\.com', '\\.mailchimp\\.com'],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.40, min_confidence: 0.38
  },

  {
    name: 'Facebook Pixel',
    category: 'Marketing',
    html_patterns: [
      'fbq\\(',              // Facebook Pixel event tracking call
      'facebook-jssdk',      // Facebook JS SDK script element ID
      'connect\\.facebook\\.net', // Facebook CDN domain
      '_fbq',                // Legacy Facebook Pixel object
      'fbevents\\.js'        // Facebook Pixel script filename
    ],
    header_patterns: [],
    script_patterns: [
      'connect\\.facebook\\.net/en_US/fbevents',
      'connect\\.facebook\\.net/signals'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.55, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.40
  },

  // ─── SECURITY ──────────────────────────────────────────────────────────────

  {
    name: 'reCAPTCHA',
    category: 'Security',
    // REMOVED: bare 'recaptcha' — any page mentioning reCAPTCHA matches.
    // REMOVED: 'data-sitekey' — used by hCaptcha, Turnstile, and others.
    html_patterns: [
      'g-recaptcha',  // Google reCAPTCHA widget container class
      'grecaptcha'    // Google reCAPTCHA global API object
    ],
    header_patterns: [],
    script_patterns: [
      'google\\.com/recaptcha/api\\.js',
      'www\\.google\\.com/recaptcha'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.38
  },

  {
    name: 'hCaptcha',
    category: 'Security',
    // REMOVED: bare 'hcaptcha' — any page mentioning hCaptcha matches.
    html_patterns: [
      'h-captcha',        // hCaptcha widget container class
      'data-hcaptcha',    // hCaptcha data attribute
      'HCaptcha'          // hCaptcha component class
    ],
    header_patterns: [],
    script_patterns: ['hcaptcha\\.com/1/api\\.js', 'js\\.hcaptcha\\.com'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.50, min_confidence: 0.38
  },

  // ─── MONITORING ────────────────────────────────────────────────────────────

  {
    name: 'Sentry',
    category: 'Monitoring',
    // REMOVED: 'sentry.io' from html_patterns — any page linking to sentry.io matches.
    html_patterns: [
      'Sentry\\.init',  // Sentry SDK initialisation call
      '__sentry',       // Sentry global namespace
      'sentry-trace'    // Distributed tracing meta tag
    ],
    header_patterns: ['sentry-trace', 'baggage:.*sentry'],
    script_patterns: [
      'browser\\.sentry-cdn\\.com',
      'js\\.sentry-cdn\\.com',
      '@sentry/browser'
    ],
    url_patterns: [],
    version_patterns: ['"@sentry/browser":"([\\d.]+)"'],
    html_weight: 0.45, header_weight: 0.30, script_weight: 0.45, min_confidence: 0.38
  },

  {
    name: 'Datadog',
    category: 'Monitoring',
    // REMOVED: 'datadoghq.com' from html_patterns — any page linking to Datadog matches.
    html_patterns: [
      'DD_RUM',          // Datadog Real User Monitoring global
      'datadog-rum',     // Datadog RUM script ID
      'DD_LOGS'          // Datadog Logs global
    ],
    header_patterns: [],
    script_patterns: [
      'browser-agent\\.datadoghq\\.com',
      'rum\\.datadoghq\\.com'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.50, min_confidence: 0.40
  },

  {
    name: 'New Relic',
    category: 'Monitoring',
    // REMOVED: bare 'newrelic' — any page mentioning New Relic matches.
    html_patterns: [
      'NREUM',         // New Relic agent global object
      'nr-data\\.net'  // New Relic data collection domain
    ],
    header_patterns: ['x-newrelic-id'],
    script_patterns: ['js-agent\\.newrelic\\.com', 'bam\\.nr-data\\.net'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.30, script_weight: 0.45, min_confidence: 0.38
  },

  // ─── SEARCH ────────────────────────────────────────────────────────────────

  {
    name: 'Algolia',
    category: 'Search',
    // ais- is the Algolia InstantSearch CSS class prefix.
    // All InstantSearch components exclusively use this prefix.
    // REMOVED: bare 'algolia' — any page mentioning Algolia matches.
    // REMOVED: 'InstantSearch' — appears in documentation and text.
    html_patterns: [
      'ais-',          // Algolia InstantSearch class prefix (exclusive)
      'algoliasearch'  // Algolia client library reference in scripts
    ],
    header_patterns: [],
    script_patterns: [
      'cdn\\.jsdelivr\\.net/npm/algoliasearch',
      'cdn\\.jsdelivr\\.net/npm/instantsearch',
      'algoliasearch\\.min\\.js'
    ],
    url_patterns: [],
    version_patterns: ['"algoliasearch":"([\\d.]+)"'],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.38
  },

  {
    name: 'Elasticsearch',
    category: 'Search',
    // Elasticsearch is a backend service rarely detectable from frontend HTML.
    // Remove both bare word and domain link patterns.
    html_patterns: [],
    header_patterns: ['x-elastic-product'],
    script_patterns: ['@elastic/elasticsearch'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.10, header_weight: 0.60, script_weight: 0.30, min_confidence: 0.38
  },

  // ─── DATABASE AND BACKEND ──────────────────────────────────────────────────

  {
    name: 'Firebase',
    category: 'Database',
    // REMOVED: bare 'firebase' — any page mentioning Firebase matches.
    html_patterns: [
      '__FIREBASE_DEFAULTS__', // Firebase SDK config global
      'firebaseapp\\.com'      // Firebase hosting domain
    ],
    header_patterns: [],
    script_patterns: [
      'firebase\\.googleapis\\.com',
      'firebasestorage\\.googleapis\\.com',
      'www\\.gstatic\\.com/firebasejs'
    ],
    url_patterns: ['\\.firebaseapp\\.com', '\\.web\\.app'],
    version_patterns: ['"firebase":"([\\d.]+)"'],
    html_weight: 0.40, header_weight: 0.10, script_weight: 0.50, min_confidence: 0.38
  },

  {
    name: 'Supabase',
    category: 'Database',
    // REMOVED: bare 'supabase' — any page mentioning Supabase matches.
    html_patterns: [
      'supabase\\.co'  // Supabase platform domain — domain-specific
    ],
    header_patterns: [],
    script_patterns: ['@supabase/supabase-js', 'supabase\\.co/storage'],
    url_patterns: ['\\.supabase\\.co'],
    version_patterns: ['"@supabase/supabase-js":"([\\d.]+)"'],
    html_weight: 0.35, header_weight: 0.10, script_weight: 0.50, min_confidence: 0.35
  },

  // ─── WEB SERVERS ───────────────────────────────────────────────────────────

  {
    name: 'Nginx',
    category: 'Web Server',
    html_patterns: [],
    header_patterns: ['server: nginx', 'server: openresty'],
    script_patterns: [],
    url_patterns: [],
    version_patterns: ['server: nginx\\/([\\d.]+)'],
    html_weight: 0.10, header_weight: 0.70, script_weight: 0.10, min_confidence: 0.35
  },

  {
    name: 'Apache',
    category: 'Web Server',
    html_patterns: [],
    header_patterns: ['server: apache', 'server: apache/'],
    script_patterns: [],
    url_patterns: [],
    version_patterns: ['server: apache\\/([\\d.]+)'],
    html_weight: 0.10, header_weight: 0.70, script_weight: 0.10, min_confidence: 0.35
  },

  {
    name: 'Caddy',
    category: 'Web Server',
    html_patterns: [],
    header_patterns: ['server: caddy'],
    script_patterns: [],
    url_patterns: [],
    version_patterns: ['server: caddy\\/([\\d.]+)'],
    html_weight: 0.10, header_weight: 0.70, script_weight: 0.10, min_confidence: 0.35
  },

  // ─── PROGRAMMING LANGUAGES ─────────────────────────────────────────────────

  {
    name: 'PHP',
    category: 'Programming Language',
    html_patterns: [],
    header_patterns: ['x-powered-by: php', 'set-cookie:.*phpsessid'],
    script_patterns: [],
    url_patterns: ['\\.php'],
    version_patterns: ['x-powered-by: php\\/([\\d.]+)'],
    html_weight: 0.10, header_weight: 0.60, script_weight: 0.10, min_confidence: 0.33
  },

  {
    name: 'Ruby on Rails',
    category: 'Programming Language',
    html_patterns: [
      'csrf-param',         // Rails CSRF parameter meta tag
      'authenticity_token', // Rails CSRF token form field
      'data-turbo-',        // Turbo Drive data attribute prefix
      'data-turbolinks-'    // Legacy Turbolinks attribute prefix
    ],
    header_patterns: ['x-powered-by: phusion passenger', 'set-cookie:.*_session'],
    script_patterns: ['@hotwired/turbo', 'turbolinks'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.35, script_weight: 0.30, min_confidence: 0.35
  },

  {
    name: 'Django',
    category: 'Programming Language',
    // REMOVED: bare 'django' — any page mentioning Django matches.
    html_patterns: [
      'csrfmiddlewaretoken',     // Django CSRF hidden form field name
      '__admin_media_prefix__'   // Django admin template variable
    ],
    header_patterns: ['set-cookie:.*csrftoken', 'set-cookie:.*sessionid'],
    script_patterns: [],
    url_patterns: ['/admin/', '/static/'],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.40, script_weight: 0.10, min_confidence: 0.35
  },

  {
    name: 'Laravel',
    category: 'Programming Language',
    // REMOVED: bare 'laravel' — any page mentioning Laravel matches.
    html_patterns: [
      'laravel_session'  // Laravel session cookie name in inline JS
    ],
    header_patterns: [
      'set-cookie:.*laravel_session',
      'set-cookie:.*xsrf-token'
    ],
    script_patterns: ['laravel\\.js'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.40, header_weight: 0.40, script_weight: 0.20, min_confidence: 0.35
  },

  {
    name: 'Express.js',
    category: 'Programming Language',
    html_patterns: [],
    header_patterns: ['x-powered-by: express'],
    script_patterns: [],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.10, header_weight: 0.70, script_weight: 0.10, min_confidence: 0.33
  },

  {
    name: 'FastAPI',
    category: 'Programming Language',
    html_patterns: [],
    header_patterns: ['server: uvicorn'],
    script_patterns: [],
    url_patterns: ['/docs', '/redoc', '/openapi.json'],
    version_patterns: [],
    html_weight: 0.10, header_weight: 0.55, script_weight: 0.10, min_confidence: 0.33
  },

  // ─── FONTS ─────────────────────────────────────────────────────────────────

  {
    name: 'Google Fonts',
    category: 'Font',
    html_patterns: [
      'fonts\\.googleapis\\.com', // Google Fonts CSS API domain
      'fonts\\.gstatic\\.com'     // Google Fonts CDN domain
    ],
    header_patterns: [],
    script_patterns: [],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.60, header_weight: 0.10, script_weight: 0.10, min_confidence: 0.30
  },

  {
    name: 'Adobe Fonts',
    category: 'Font',
    // REMOVED: bare 'typekit' — any page mentioning Typekit/Adobe Fonts matches.
    html_patterns: [
      'use\\.typekit\\.net',  // Adobe Fonts CDN domain
      'p\\.typekit\\.net'     // Adobe Fonts ping domain
    ],
    header_patterns: [],
    script_patterns: ['use\\.typekit\\.net', 'typekit\\.com/kits'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.55, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.35
  },

  // ─── MAPS ──────────────────────────────────────────────────────────────────

  {
    name: 'Google Maps',
    category: 'Map',
    // REMOVED: 'google-map' — class="my-google-map-wrapper" would match.
    html_patterns: [
      'maps\\.googleapis\\.com', // Google Maps API domain
      'gm-style',               // CSS class Google Maps injects into container
      'GoogleMap'               // React Google Maps component reference
    ],
    header_patterns: [],
    script_patterns: [
      'maps\\.googleapis\\.com/maps/api',
      'maps\\.google\\.com/maps'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.35
  },

  {
    name: 'Mapbox',
    category: 'Map',
    // REMOVED: 'mapbox.com' from html_patterns — any page linking to mapbox.com matches.
    html_patterns: [
      'mapboxgl',   // Mapbox GL JS global object
      'mapbox-gl',  // Mapbox GL container class
      'mapboxMap'   // Mapbox map instance reference
    ],
    header_patterns: [],
    script_patterns: [
      'api\\.mapbox\\.com/mapbox-gl-js',
      'mapbox-gl\\.js'
    ],
    url_patterns: [],
    version_patterns: ['"mapbox-gl":"([\\d.]+)"'],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.50, min_confidence: 0.38
  },

  // ─── VIDEO ─────────────────────────────────────────────────────────────────

  {
    name: 'YouTube',
    category: 'Video',
    html_patterns: [
      'youtube\\.com/embed', // YouTube iframe embed URL
      'youtu\\.be',          // YouTube short URL in iframes
      'ytInitialData',       // YouTube player data global
      'yt-player'            // YouTube player class
    ],
    header_patterns: [],
    script_patterns: [
      'youtube\\.com/iframe_api',
      'www\\.youtube\\.com/s/player'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.55, header_weight: 0.10, script_weight: 0.35, min_confidence: 0.30
  },

  {
    name: 'Vimeo',
    category: 'Video',
    html_patterns: [
      'vimeo-player',      // Vimeo player container class
      'player\\.vimeo\\.com', // Vimeo player embed domain
      'vimeo\\.com/video'  // Vimeo video URL in iframes
    ],
    header_patterns: [],
    script_patterns: ['player\\.vimeo\\.com/api/player\\.js'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50, header_weight: 0.10, script_weight: 0.40, min_confidence: 0.30
  },

  // ─── A/B TESTING ───────────────────────────────────────────────────────────

  {
    name: 'Optimizely',
    category: 'A/B Testing',
    // REMOVED: bare 'optimizely' — any page mentioning Optimizely matches.
    html_patterns: [
      'optly',                // Optimizely short global
      'optimizelyEndUserId',  // Optimizely cookie name in scripts
      'optimizely-data'       // Optimizely data attribute
    ],
    header_patterns: [],
    script_patterns: [
      'cdn\\.optimizely\\.com',
      'optimizely\\.com/js/'
    ],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.40, header_weight: 0.10, script_weight: 0.50, min_confidence: 0.38
  },

  {
    name: 'VWO',
    category: 'A/B Testing',
    html_patterns: [
      'visualWebsiteOptimizer', // VWO global object
      '_vwo_code',              // VWO code snippet global
      'vwo_'                    // VWO cookie prefix
    ],
    header_patterns: [],
    script_patterns: ['dev\\.visualwebsiteoptimizer\\.com', 'cdn\\.vwo\\.com'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.45, header_weight: 0.10, script_weight: 0.50, min_confidence: 0.38
  },

  // ─── MISCELLANEOUS ─────────────────────────────────────────────────────────

  {
    name: 'Cloudflare Turnstile',
    category: 'Security',
    html_patterns: [
      'cf-turnstile',             // Turnstile widget element class
      'turnstile\\.cloudflare\\.com', // Turnstile API domain
      'data-sitekey'              // Turnstile site key attribute
    ],
    header_patterns: [],
    script_patterns: ['challenges\\.cloudflare\\.com/turnstile'],
    url_patterns: [],
    version_patterns: [],
    html_weight: 0.50, header_weight: 0.10, script_weight: 0.45, min_confidence: 0.40
  },

  {
    name: 'AWS CloudFront',
    category: 'CDN',
    html_patterns: [],
    header_patterns: [
      'x-amz-cf-id', 'x-amz-cf-pop',
      'via:.*cloudfront', 'x-cache:.*cloudfront'
    ],
    script_patterns: ['cloudfront\\.net'],
    url_patterns: ['\\.cloudfront\\.net'],
    version_patterns: [],
    html_weight: 0.10, header_weight: 0.60, script_weight: 0.25, min_confidence: 0.35
  }

];

module.exports = { FALLBACK_PATTERNS };
