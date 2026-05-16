'use strict';

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: Date.now(),
    version: 'v10'
  });
});

module.exports = router;
