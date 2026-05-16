'use strict';

const express = require('express');
const router = express.Router();
const validate = require('../middleware/validate');
const scanHandler = require('../handlers/scan');
const compareHandler = require('../handlers/compare');
const clusterHandler = require('../handlers/cluster');
const telemetryHandler = require('../handlers/telemetry');
const graphHandler = require('../handlers/graph');
const logger = require('../utils/logger');

router.post('/', validate, async (req, res) => {
  const { mode } = req.body;

  logger.info(`Request received — mode: ${mode}`);

  try {
    switch (mode) {
      case 'scan':
        return await scanHandler(req, res);
      case 'compare':
        return await compareHandler(req, res);
      case 'cluster':
        return await clusterHandler(req, res);
      case 'telemetry':
        return await telemetryHandler(req, res);
      case 'graph':
        return await graphHandler(req, res);
      default:
        return res.status(400).json({ error: `Unknown mode: ${mode}` });
    }
  } catch (err) {
    logger.error(`Handler error in mode ${mode}: ${err.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
