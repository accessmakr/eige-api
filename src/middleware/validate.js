'use strict';

const VALID_MODES = ['scan', 'compare', 'cluster', 'telemetry', 'graph'];

function validate(req, res, next) {
  const { mode, url, domains } = req.body;

  if (!mode) {
    return res.status(400).json({ error: 'mode is required' });
  }

  if (!VALID_MODES.includes(mode)) {
    return res.status(400).json({ error: `Invalid mode. Must be one of: ${VALID_MODES.join(', ')}` });
  }

  if ((mode === 'scan' || mode === 'cluster') && !url) {
    return res.status(400).json({ error: 'url is required for scan and cluster modes' });
  }

  if (mode === 'compare') {
    if (!domains || !Array.isArray(domains) || domains.length !== 2) {
      return res.status(400).json({ error: 'compare mode requires a domains array with exactly 2 domains' });
    }
  }

  next();
}

module.exports = validate;
