'use strict';

function timestamp() {
  return new Date().toISOString();
}

const logger = {
  info: (message) => {
    console.log(`[${timestamp()}] [INFO] ${message}`);
  },
  warn: (message) => {
    console.warn(`[${timestamp()}] [WARN] ${message}`);
  },
  error: (message) => {
    console.error(`[${timestamp()}] [ERROR] ${message}`);
  }
};

module.exports = logger;
