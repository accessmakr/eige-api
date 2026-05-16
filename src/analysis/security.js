'use strict';

const logger = require('../utils/logger');

const SECURITY_HEADERS = {
  csp: {
    header: 'content-security-policy',
    label: 'Content Security Policy',
    weight: 0.25,
    description: 'Prevents cross-site scripting and injection attacks'
  },
  hsts: {
    header: 'strict-transport-security',
    label: 'HSTS',
    weight: 0.20,
    description: 'Forces HTTPS connections only'
  },
  xFrameOptions: {
    header: 'x-frame-options',
    label: 'X-Frame-Options',
    weight: 0.15,
    description: 'Prevents clickjacking attacks'
  },
  xContentType: {
    header: 'x-content-type-options',
    label: 'X-Content-Type-Options',
    weight: 0.10,
    description: 'Prevents MIME type sniffing'
  },
  referrerPolicy: {
    header: 'referrer-policy',
    label: 'Referrer Policy',
    weight: 0.10,
    description: 'Controls referrer information sent with requests'
  },
  permissionsPolicy: {
    header: 'permissions-policy',
    label: 'Permissions Policy',
    weight: 0.10,
    description: 'Controls browser features and APIs'
  },
  xssProtection: {
    header: 'x-xss-protection',
    label: 'XSS Protection',
    weight: 0.10,
    description: 'Legacy XSS filter for older browsers'
  }
};

const WEAK_CSP_PATTERNS = [
  'unsafe-inline',
  'unsafe-eval',
  "* ",
  'data:',
  'http:'
];

const WEAK_HSTS_PATTERNS = [
  'max-age=0',
  'max-age=1',
  'max-age=60',
  'max-age=300'
];

function evaluateCSP(value) {
  if (!value) return { status: 'missing', detail: 'Content Security Policy header is absent' };

  const lowerValue = value.toLowerCase();
  const weaknesses = WEAK_CSP_PATTERNS.filter(p => lowerValue.includes(p));

  if (weaknesses.length > 0) {
    return {
      status: 'warn',
      detail: `CSP present but weakened by: ${weaknesses.join(', ')}`
    };
  }

  return {
    status: 'present',
    detail: 'Strong Content Security Policy detected'
  };
}

function evaluateHSTS(value) {
  if (!value) return { status: 'missing', detail: 'HSTS header is absent — site may allow HTTP connections' };

  const lowerValue = value.toLowerCase();
  const isWeak = WEAK_HSTS_PATTERNS.some(p => lowerValue.includes(p));

  if (isWeak) {
    return {
      status: 'warn',
      detail: 'HSTS present but max-age is too short to be effective'
    };
  }

  const hasSubdomains = lowerValue.includes('includesubdomains');
  const hasPreload = lowerValue.includes('preload');

  if (hasSubdomains && hasPreload) {
    return {
      status: 'present',
      detail: 'Strong HSTS with subdomains and preload enabled'
    };
  }

  return {
    status: 'present',
    detail: 'HSTS detected — consider adding includeSubDomains and preload'
  };
}

function evaluateXFrameOptions(value) {
  if (!value) return { status: 'missing', detail: 'X-Frame-Options absent — site may be vulnerable to clickjacking' };

  const upper = value.toUpperCase();
  if (upper === 'DENY') return { status: 'present', detail: 'Strongest setting — framing completely denied' };
  if (upper === 'SAMEORIGIN') return { status: 'present', detail: 'Framing allowed only from same origin' };
  if (upper.startsWith('ALLOW-FROM')) return { status: 'warn', detail: 'ALLOW-FROM is deprecated in modern browsers' };

  return { status: 'warn', detail: `Unrecognised X-Frame-Options value: ${value}` };
}

function evaluateXContentType(value) {
  if (!value) return { status: 'missing', detail: 'X-Content-Type-Options absent — MIME sniffing possible' };
  if (value.toLowerCase() === 'nosniff') return { status: 'present', detail: 'MIME type sniffing prevented' };
  return { status: 'warn', detail: `Unexpected value: ${value}` };
}

function evaluateReferrerPolicy(value) {
  if (!value) return { status: 'missing', detail: 'Referrer-Policy absent — full URL may leak to third parties' };

  const strongPolicies = [
    'no-referrer',
    'no-referrer-when-downgrade',
    'strict-origin',
    'strict-origin-when-cross-origin'
  ];

  const weakPolicies = [
    'unsafe-url',
    'origin-when-cross-origin'
  ];

  const lower = value.toLowerCase();

  if (strongPolicies.some(p => lower.includes(p))) {
    return { status: 'present', detail: `Strong referrer policy: ${value}` };
  }

  if (weakPolicies.some(p => lower.includes(p))) {
    return { status: 'warn', detail: `Weak referrer policy: ${value}` };
  }

  return { status: 'present', detail: `Referrer policy set: ${value}` };
}

function evaluatePermissionsPolicy(value) {
  if (!value) return { status: 'missing', detail: 'Permissions-Policy absent — browser features unrestricted' };
  return { status: 'present', detail: 'Browser feature permissions policy detected' };
}

function evaluateXSSProtection(value) {
  if (!value) return { status: 'missing', detail: 'X-XSS-Protection absent (legacy header, low priority)' };
  if (value.startsWith('1; mode=block')) return { status: 'present', detail: 'XSS filter enabled with block mode' };
  if (value === '1') return { status: 'warn', detail: 'XSS filter enabled but block mode not set' };
  if (value === '0') return { status: 'warn', detail: 'XSS filter explicitly disabled' };
  return { status: 'present', detail: `XSS Protection set: ${value}` };
}

function detectWAF(rawHeaders) {
  const headerString = Object.entries(rawHeaders)
    .map(([k, v]) => `${k.toLowerCase()}: ${v.toLowerCase()}`)
    .join('\n');

  if (headerString.includes('cf-ray') || headerString.includes('server: cloudflare')) return 'Cloudflare WAF';
  if (headerString.includes('x-sucuri-id')) return 'Sucuri WAF';
  if (headerString.includes('x-iinfo')) return 'Imperva WAF';
  if (headerString.includes('x-akamai-request-id')) return 'Akamai WAF';
  if (headerString.includes('x-amzn-requestid') && headerString.includes('x-amz-cf-id')) return 'AWS WAF';
  if (headerString.includes('barra_counter_session')) return 'Barracuda WAF';
  if (headerString.includes('bigipserver')) return 'F5 BIG-IP WAF';

  return null;
}

function detectBotProtection(rawHeaders, html) {
  const headerString = Object.entries(rawHeaders)
    .map(([k, v]) => `${k.toLowerCase()}: ${v.toLowerCase()}`)
    .join('\n');

  if (headerString.includes('cf-ray')) return 'Cloudflare Bot Management';
  if (html && html.includes('grecaptcha')) return 'Google reCAPTCHA';
  if (html && html.includes('h-captcha')) return 'hCaptcha';
  if (html && html.includes('Turnstile')) return 'Cloudflare Turnstile';
  if (html && html.includes('arkose')) return 'Arkose Labs';

  return null;
}

function calculateRiskScore(headerResults) {
  let totalWeight = 0;
  let missingWeight = 0;
  let warnWeight = 0;

  for (const [key, config] of Object.entries(SECURITY_HEADERS)) {
    const result = headerResults[key];
    totalWeight += config.weight;

    if (!result || result.status === 'missing') {
      missingWeight += config.weight;
    } else if (result.status === 'warn') {
      warnWeight += config.weight * 0.5;
    }
  }

  const rawRisk = (missingWeight + warnWeight) / totalWeight;
  return parseFloat(Math.min(rawRisk, 1.0).toFixed(2));
}

function generateSecurityGrade(riskScore) {
  if (riskScore <= 0.10) return 'A+';
  if (riskScore <= 0.20) return 'A';
  if (riskScore <= 0.35) return 'B';
  if (riskScore <= 0.50) return 'C';
  if (riskScore <= 0.65) return 'D';
  return 'F';
}

function analyseSecurity(rawHeaders, html) {
  try {
    logger.info('Analysing security headers');

    const headers = {};
    for (const [k, v] of Object.entries(rawHeaders)) {
      headers[k.toLowerCase()] = v;
    }

    const cspValue = headers['content-security-policy'] || null;
    const hstsValue = headers['strict-transport-security'] || null;
    const xFrameValue = headers['x-frame-options'] || null;
    const xContentValue = headers['x-content-type-options'] || null;
    const referrerValue = headers['referrer-policy'] || null;
    const permissionsValue = headers['permissions-policy'] || null;
    const xssValue = headers['x-xss-protection'] || null;

    const headerResults = {
      csp: evaluateCSP(cspValue),
      hsts: evaluateHSTS(hstsValue),
      xFrameOptions: evaluateXFrameOptions(xFrameValue),
      xContentType: evaluateXContentType(xContentValue),
      referrerPolicy: evaluateReferrerPolicy(referrerValue),
      permissionsPolicy: evaluatePermissionsPolicy(permissionsValue),
      xssProtection: evaluateXSSProtection(xssValue)
    };

    const riskScore = calculateRiskScore(headerResults);
    const grade = generateSecurityGrade(riskScore);
    const waf = detectWAF(rawHeaders);
    const botProtection = detectBotProtection(rawHeaders, html);

    logger.info(`Security analysis complete — Risk: ${riskScore}, Grade: ${grade}, WAF: ${waf || 'None'}`);

    return {
      headers: headerResults,
      riskScore,
      grade,
      wafDetected: waf,
      botProtection,
      rawValues: {
        csp: cspValue,
        hsts: hstsValue,
        xFrameOptions: xFrameValue,
        xContentType: xContentValue,
        referrerPolicy: referrerValue,
        permissionsPolicy: permissionsValue,
        xssProtection: xssValue
      }
    };

  } catch (err) {
    logger.error(`Security analysis failed: ${err.message}`);
    return {
      headers: {},
      riskScore: 1.0,
      grade: 'F',
      wafDetected: null,
      botProtection: null,
      rawValues: {}
    };
  }
}

module.exports = { analyseSecurity };
