// Minimal utils layer
const winston = require('winston');

const log = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});

// Mock Redis client that can be used by Lambda functions
const redisClient = {
  get: async (key) => null,
  set: async (key, value, options) => 'OK',
  quit: async () => true,
};

// Mock Postgres pool that can be used by Lambda functions
const postgresPool = {
  query: async (text, params) => ({ rows: [] }),
  end: async () => {},
};

module.exports = {
  log,
  redisClient,
  postgresPool,
};
