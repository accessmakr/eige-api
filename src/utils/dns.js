'use strict';

const dns = require('dns').promises;
const logger = require('./logger');

async function resolveDomain(domain) {
  try {
    const cleanDomain = domain
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .toLowerCase()
      .trim();

    const ips = await dns.resolve4(cleanDomain);
    logger.info(`DNS resolved ${cleanDomain} → ${ips.join(', ')}`);

    return {
      resolved: true,
      ips: ips || []
    };

  } catch (err) {
    logger.warn(`DNS resolution failed for ${domain}: ${err.message}`);
    return {
      resolved: false,
      ips: []
    };
  }
}

module.exports = { resolveDomain };
