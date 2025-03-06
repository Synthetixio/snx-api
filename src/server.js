const express = require('express');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const basicAuth = require('express-basic-auth');
const favicon = require('serve-favicon');
const path = require('path');

const swaggerDocs = require('./swagger');
const { redisClient, postgresPool, log } = require('./utils');

redisClient.on('error', (err) => log.error(`[Redis] Client error: ${err}`));
redisClient.on('ready', () => {
  log.debug('[Redis] Client is connected and ready to use');
  const app = express();
  log.debug('[Express] Setting up middlewares..');
  if (process.env.DEBUG) {
    app.use(morgan('combined'));
  }
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.set('json spaces', 4);
  app.use(favicon(path.join('public', 'favicon.ico')));

  app.use((req, res, next) => {
    if (!req.path.startsWith('/docs/')) {
      log.debug('[Express] Setting no-cache headers..');
      res.set({
        'Surrogate-Control': 'no-store',
        'Cache-Control':
          'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      });
    } else {
      log.debug('[Express] Setting caching headers..');
      let maxAge = 86400;
      if (req.path.includes('swagger-ui-init.js')) {
        maxAge = 0;
      }
      res.set({
        'Cache-Control': `public, max-age=${maxAge}`,
        Pragma: 'public',
      });
    }
    next();
  });

  log.debug('[Express] Setting up routes..');

  app.get('/', (req, res) => res.redirect('/docs/'));
  app.use('/status', require('./routes/status'));
  app.use(
    '/health',
    basicAuth({
      users: { monitor: process.env.HEALTH_ENDPOINT_PASSWORD },
      challenge: true,
    }),
    require('./routes/health'),
  );
  app.use('/total-supply', require('./routes/total-supply').router);
  app.use('/circulating-supply', require('./routes/circulating-supply').router);
  app.use(
    '/synthetixescrow/vested-balance',
    require('./routes/SynthetixEscrow/vested-balance').router,
  );
  app.use(
    '/rewardescrowv2/escrowed-balance',
    require('./routes/RewardEscrowV2/escrowed-balance').router,
  );

  app.use(
    '/rewardescrow/escrowed-balance',
    require('./routes/RewardEscrow/escrowed-balance').router,
  );
  app.use(
    '/liquidatorrewards/balance',
    require('./routes/LiquidatorRewards/balance').router,
  );
  app.use(
    '/synthetixbridgeescrow/balance',
    require('./routes/SynthetixBridgeEscrow/balance').router,
  );

  postgresPool.on('error', (err) =>
    log.error(`[Postgres] Client error: ${err.stack}`),
  );
  log.debug('[Express] Setting up routes related to postgres..');

  app.use('/v3/base/sc-pool-apy', require('./routes/v3/base/sc-pool-apy'));
  app.use(
    '/v3/base/sc-pool-apy-history',
    require('./routes/v3/base/sc-pool-apy-history'),
  );
  app.use('/v3/base/snx-buyback', (_, res) => res.json([]));
  app.use(
    '/v3/base/lt-leaderboard',
    require('./routes/v3/base/sc-pool-apy-all.js'),
  );
  app.use('/v3/base/lt-trades', require('./routes/v3/base/lt-trades'));

  app.use(
    '/v3/base/rewards-claimed',
    require('./routes/v3/base/rewards-claimed'),
  );
  app.use(
    '/v3/arbitrum/sc-pool-apy',
    require('./routes/v3/arbitrum/sc-pool-apy'),
  );
  app.use(
    '/v3/arbitrum/sc-pool-apy-history',
    require('./routes/v3/arbitrum/sc-pool-apy-history'),
  );
  app.use(
    '/v3/arbitrum/sc-pool-apy-all',
    require('./routes/v3/arbitrum/sc-pool-apy-all'),
  );
  app.use(
    '/v3/base/sc-pool-apy-all',
    require('./routes/v3/base/sc-pool-apy-all'),
  );
  app.use(
    '/v3/mainnet/sc-pool-apy-all',
    require('./routes/v3/mainnet/sc-pool-apy-all'),
  );
  app.use(
    '/v3/mainnet/rewards-claimed',
    require('./routes/v3/mainnet/rewards-claimed'),
  );
  app.use(
    '/v3/optimism/lt-leaderboard',
    require('./routes/v3/optimism/lt-leaderboard'),
  );
  app.use('/v3/optimism/lt-trades', require('./routes/v3/optimism/lt-trades'));
  app.use('/v3/tvl', require('./routes/v3/tvl'));
  app.use('/v3/top-asset', require('./routes/v3/top-asset'));
  app.use('/stats/perps-volume', require('./routes/stats/perps-volume'));
  app.use('/v3/tvl420', require('./routes/v3/tvl420'));

  log.debug('[Express] Starting server..');
  const port =
    typeof process.env.API_PORT === 'string'
      ? parseInt(process.env.API_PORT)
      : process.env.API_PORT || 3000;
  const host = process.env.API_HOST || 'localhost';
  app.listen(port, host, () => {
    log.debug('[Express] Setting up swagger docs..');
    swaggerDocs(app);
    log.info(`[Express] API is listening on host ${host} port ${port}`);
  });
});

process.on('unhandledRejection', (err) => {
  log.error(`[Express] Unhandled Rejection at: ${err.stack}`);
  process.exit(1);
});

// pm2 handle graceful shutdown
process.on('SIGINT', () => {
  log.info('[Express] Handling graceful shutdown..');
  (async () => {
    log.debug('[Redis] Closing connection..');
    await redisClient.quit();
    log.debug('[Postgres] Closing connection..');
    await postgresPool.end();
  })();
  log.debug('[Express] Quitting..');
  process.exit(0);
});
