'use strict';

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
    'x-cache: miss from cloudfront'
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
    'x-cache',
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

async function analyseInfrastructure(domain, rawHeaders) {
  try {
    logger.info(`Analysing infrastructure for: ${domain}`);

    const cleanDomain = domain
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .toLowerCase()
      .trim();

    const { resolved, ips } = await resolveDomain(cleanDomain);

    const cdn = detectFromHeaders(rawHeaders, CDN_SIGNATURES);
    const hosting = detectFromHeaders(rawHeaders, HOSTING_SIGNATURES);
    const waf = detectAllFromHeaders(rawHeaders, WAF_SIGNATURES);
    const serverInfo = extractServerInfo(rawHeaders);

    const provider = hosting || cdn || 'Unknown';

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
