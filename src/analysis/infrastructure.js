'use strict';

// ─── INFRASTRUCTURE DETECTION — FIX SUMMARY ─────────────────────────────────
//
// FIX 1 — AWS CloudFront: added 'server: cloudfront'. CloudFront sets this
//         header on many responses (especially errors/OPTIONS) in addition
//         to or instead of x-amz-cf-id.
//
// FIX 2 — KeyCDN: removed bare 'x-cache'. This generic header name is set by
//         Varnish, Fastly, Squid, and custom nginx proxy_cache configs — it
//         was causing any site with ANY caching layer to be misclassified as
//         KeyCDN. Kept only the two genuinely KeyCDN-specific signatures.
//
// FIX 3 — Added 'AWS S3' hosting entry via 'server: amazons3'. This is one of
//         the most common real-world "Undetected" cases for static sites and
//         direct S3 bucket access — a high-confidence, well-documented header.
//
// FIX 4 — Documented (not removed) four VPS hosting entries (DigitalOcean,
//         Railway, Linode, Hetzner) whose branded Server: headers are not set
//         by default by those providers and will essentially never match.
//
// FIX 5 — New detectGenericProxy() fallback: when no branded CDN matches,
//         checks for generic intermediary headers (age, via, x-served-by,
//         x-cache) and returns "Unidentified CDN/Proxy" rather than null.
//         Honest about "something is caching this" without claiming a brand.
//
// FIX 6 — Provider fallback chain extended: hosting || cdn || serverInfo ||
//         'Unknown'. Sites with no recognised brand (e.g. Stripe's custom
//         nginx-fronted setup) now show Provider: "nginx" instead of bare
//         "Unknown", since serverInfo was already being extracted and
//         previously discarded at this step.
//
// REMAINING LIMITATION — sites like Stripe that run fully custom edge
// infrastructure with no branded headers and no generic proxy headers will
// still show cdn/hosting/waf as null. The only way to close this gap further
// is IP/ASN-based provider lookup (e.g. via ipinfo.io), which is a separate,
// larger change requiring a new API key and an additional network call —
// not included in this pass.

const { resolveDomain } = require('../utils/dns');
const logger = require('../utils/logger');

const CDN_SIGNATURES = {
  'Cloudflare': [
    'cf-ray',
    'cf-cache-status',
    'server: cloudflare',
    'cf-request-id',
    'cf-apo-via',
    'cf-edge-cache'
  ],
  'AWS CloudFront': [
    'x-amz-cf-id',
    'x-amz-cf-pop',
    'via: cloudfront',
    'x-cache: hit.from cloudfront',
    'x-cache: miss from cloudfront',
    'server: cloudfront'
  ],
  'Fastly': [
    'x-fastly-request-id',
    'fastly-restarts',
    'x-served-by',
    'via: 1.1 varnish'
  ],
  'Akamai': [
    'x-akamai-request-id',
    'akamai-cache-status',
    'x-check-cacheable',
    'x-akamai-ssl-client-sid'
  ],
  'BunnyCDN': [
    'cdn-pullzone',
    'cdn-uid',
    'cdn-requestid'
  ],
  'Sucuri': [
    'x-sucuri-id',
    'x-sucuri-cache'
  ],
  'KeyCDN': [
    'x-edge-location',
    'server: keycdn-engine'
  ],
  'Imperva': [
    'x-iinfo',
    'x-cdn: imperva'
  ]
};

const HOSTING_SIGNATURES = {
  'Vercel': [
    'x-vercel-id',
    'x-vercel-cache',
    'server: vercel',
    'x-vercel-deployment-url'
  ],
  'Netlify': [
    'x-nf-request-id',
    'server: netlify',
    'x-netlify-cache',
    'netlify-cdn-cache-control'
  ],
  'Heroku': [
    'server: heroku',
    'x-dyno'
  ],
  'Render': [
    'server: render',
    'x-render-origin-server',
    'rndr-id'
  ],
  'AWS': [
    'x-amzn-requestid',
    'x-amz-request-id',
    'server: awselb',
    'x-amzn-trace-id'
  ],
  'AWS S3': [
    'server: amazons3'
  ],
  'Google Cloud': [
    'server: gws',
    'x-goog-request-id',
    'via: 1.1 google',
    'x-gfe-request-id'
  ],
  'Azure': [
    'x-ms-request-id',
    'x-azure-ref',
    'server: microsoft-iis',
    'x-msedge-ref'
  ],
  // NOTE: the four entries below (DigitalOcean, Railway, Linode, Hetzner) rely on
  // branded Server: headers that these providers do NOT set by default — the
  // Server header on a VPS reflects whatever web server software (nginx/apache)
  // the customer installed, not the VPS provider's brand. These signatures will
  // essentially never match in practice. Kept for the rare case a customer has
  // manually set server_tokens to this value, but should not be relied upon —
  // genuine detection for bare VPS providers requires IP/ASN lookup, not headers.
  'DigitalOcean': [
    'server: droplet',
    'x-do-app-origin',
    'x-do-orig-status'
  ],
  'Fly.io': [
    'fly-request-id',
    'server: fly.io',
    'via: 2 fly.io'
  ],
  'Railway': [
    'server: railway'
  ],
  'Oracle Cloud': [
    'x-oracle-dms-rid',
    'x-oracle-dms-ecid'
  ],
  'Linode': [
    'server: linode'
  ],
  'Hetzner': [
    'server: hetzner'
  ],
  'Cloudflare Pages': [
    'cf-ray',
    'server: cloudflare',
    'cf-cache-status: dynamic'
  ],
  'GitHub Pages': [
    'server: github.com',
    'x-github-request-id'
  ],
  'GitLab Pages': [
    'server: gitlab pages'
  ]
};

const WAF_SIGNATURES = {
  'Cloudflare WAF': ['cf-ray', 'server: cloudflare'],
  'AWS WAF': ['x-amzn-requestid', 'x-amz-cf-id'],
  'Sucuri WAF': ['x-sucuri-id'],
  'Imperva WAF': ['x-iinfo'],
  'Akamai WAF': ['x-akamai-request-id'],
  'Barracuda WAF': ['barra_counter_session'],
  'F5 BIG-IP': ['bigipserver', 'x-cnection']
};

function detectFromHeaders(rawHeaders, signatureMap) {
  const headerString = Object.entries(rawHeaders)
    .map(([k, v]) => `${k.toLowerCase()}: ${v.toLowerCase()}`)
    .join('\n');

  for (const [name, signatures] of Object.entries(signatureMap)) {
    for (const sig of signatures) {
      if (headerString.includes(sig.toLowerCase())) {
        return name;
      }
    }
  }
  return null;
}

function detectAllFromHeaders(rawHeaders, signatureMap) {
  const headerString = Object.entries(rawHeaders)
    .map(([k, v]) => `${k.toLowerCase()}: ${v.toLowerCase()}`)
    .join('\n');

  const found = [];
  for (const [name, signatures] of Object.entries(signatureMap)) {
    for (const sig of signatures) {
      if (headerString.includes(sig.toLowerCase())) {
        found.push(name);
        break;
      }
    }
  }
  return found;
}

function extractServerInfo(rawHeaders) {
  const server = rawHeaders['server'] || rawHeaders['x-powered-by'] || null;
  return server;
}

// FIX 5 — Generic proxy/CDN fallback. These header names are commonly set by
// SOME caching/proxy layer (Varnish, Squid, generic reverse proxies, CDNs that
// don't match a known brand signature) regardless of vendor. Their presence
// indicates traffic passes through an intermediary cache even when the specific
// brand cannot be identified from the available signatures. Checked only as a
// fallback after brand-specific CDN_SIGNATURES have already failed to match —
// this never overrides a confident brand match.
const GENERIC_PROXY_HEADERS = ['age', 'via', 'x-served-by', 'x-cache'];

function detectGenericProxy(rawHeaders) {
  const lowerKeys = Object.keys(rawHeaders).map(k => k.toLowerCase());
  for (const h of GENERIC_PROXY_HEADERS) {
    if (lowerKeys.includes(h)) {
      return 'Unidentified CDN/Proxy';
    }
  }
  return null;
}

async function analyseInfrastructure(domain, rawHeaders) {
  try {
    logger.info(`Analysing infrastructure for: ${domain}`);

    const cleanDomain = domain
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .toLowerCase()
      .trim();

    const { resolved, ips } = await resolveDomain(cleanDomain);

    const cdn = detectFromHeaders(rawHeaders, CDN_SIGNATURES) || detectGenericProxy(rawHeaders);
    const hosting = detectFromHeaders(rawHeaders, HOSTING_SIGNATURES);
    const waf = detectAllFromHeaders(rawHeaders, WAF_SIGNATURES);
    const serverInfo = extractServerInfo(rawHeaders);

    // FIX 6 — Provider fallback chain extended to serverInfo. Previously sites
    // with no recognised CDN/hosting brand (e.g. Stripe's custom nginx-fronted
    // infrastructure) showed Provider: "Unknown" even though the Server header
    // ("nginx") was already being extracted and simply discarded. Falling back
    // to serverInfo gives the user SOME information rather than nothing, while
    // 'Unknown' remains as the final fallback only when literally nothing was
    // detected at all.
    const provider = hosting || cdn || serverInfo || 'Unknown';

    logger.info(`Infrastructure detected — CDN: ${cdn}, Hosting: ${hosting}, WAF: ${waf.join(', ') || 'None'}`);

    return {
      domain: cleanDomain,
      ips: ips || [],
      resolved,
      provider,
      cdn: cdn || null,
      hosting: hosting || null,
      waf: waf.length > 0 ? waf : null,
      serverInfo: serverInfo || null
    };

  } catch (err) {
    logger.error(`Infrastructure analysis failed: ${err.message}`);
    return {
      domain,
      ips: [],
      resolved: false,
      provider: 'Unknown',
      cdn: null,
      hosting: null,
      waf: null,
      serverInfo: null
    };
  }
}

module.exports = { analyseInfrastructure };
