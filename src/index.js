'use strict';

require('dotenv').config();

const express = require('express');
const corsMiddleware = require('./middleware/cors');
const rateLimitMiddleware = require('./middleware/rateLimit');
const apiRouter = require('./routes/api');
const healthRouter = require('./routes/health');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(corsMiddleware);
app.use(express.json());
app.use(rateLimitMiddleware);

app.use('/health', healthRouter);
app.use('/api', apiRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error: ' + err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  logger.info(`EIGE v10 API running on port ${PORT}`);
});
