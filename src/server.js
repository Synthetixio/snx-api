const express = require('express');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const basicAuth = require('express-basic-auth');
const favicon = require('serve-favicon');
const path = require('path');

const swaggerDocs = require('./swagger.js');
const { redisClient, postgresClient, log } = require('./utils');

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

  app.get('/', (req, res) => {
    res.redirect('/docs/');
  });

  const statusRouter = require('./routes/status');
  app.use('/status', statusRouter);

  const healthRouter = require('./routes/health');
  app.use(
    '/health',
    basicAuth({
      users: { monitor: process.env.HEALTH_ENDPOINT_PASSWORD },
      challenge: true,
    }),
    healthRouter,
  );

  const totalSupplyRouter = require('./routes/total-supply').router;
  app.use('/total-supply', totalSupplyRouter);

  const circulatingSupplyRouter = require('./routes/circulating-supply').router;
  app.use('/circulating-supply', circulatingSupplyRouter);

  const synthetixEscrowVestedBalanceRouter =
    require('./routes/SynthetixEscrow/vested-balance').router;
  app.use(
    '/synthetixescrow/vested-balance',
    synthetixEscrowVestedBalanceRouter,
  );

  const rewardEscrowV2EscrowedBalanceRouter =
    require('./routes/RewardEscrowV2/escrowed-balance').router;
  app.use(
    '/rewardescrowv2/escrowed-balance',
    rewardEscrowV2EscrowedBalanceRouter,
  );

  const rewardEscrowEscrowedBalanceRouter =
    require('./routes/RewardEscrow/escrowed-balance').router;
  app.use('/rewardescrow/escrowed-balance', rewardEscrowEscrowedBalanceRouter);

  const liquidatorRewardsBalanceRouter =
    require('./routes/LiquidatorRewards/balance').router;
  app.use('/liquidatorrewards/balance', liquidatorRewardsBalanceRouter);

  const synthetixBridgeEscrowBalanceRouter =
    require('./routes/SynthetixBridgeEscrow/balance').router;
  app.use('/synthetixbridgeescrow/balance', synthetixBridgeEscrowBalanceRouter);

  postgresClient.on('error', (err) =>
    log.error(`[Postgres] Client error: ${err}`),
  );
  redisClient.on('ready', () => {
    log.debug('[Postgres] Client is connected and ready to use');
    log.debug('[Express] Setting up routes related to postgres..');
    const v3BaseApyRouter = require('./routes/v3-base-apy');
    app.use('/v3-base-apy', v3BaseApyRouter);
  });

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
    await postgresClient.end();
  })();
  log.debug('[Express] Quitting..');
  process.exit(0);
});
