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
    log.error(`[Postgres] Client error: ${err.stack}`),
  );
  log.debug('[Express] Setting up routes related to postgres..');

  const v3BaseSCPoolAPYRouter = require('./routes/v3/base/sc-pool-apy.js');
  app.use('/v3/base/sc-pool-apy', v3BaseSCPoolAPYRouter);

  const v3BaseSCPoolAPYHistoryRouter = require('./routes/v3/base/sc-pool-apy-history.js');
  app.use('/v3/base/sc-pool-apy-history', v3BaseSCPoolAPYHistoryRouter);

  const v3BaseSNXBuybackRouter = require('./routes/v3/base/snx-buyback.js');
  app.use('/v3/base/snx-buyback', v3BaseSNXBuybackRouter);

  const v3BaseLTLeaderboardRouter = require('./routes/v3/base/lt-leaderboard.js');
  app.use('/v3/base/lt-leaderboard', v3BaseLTLeaderboardRouter);

  const v3ArbitrumSCPoolAPYRouter = require('./routes/v3/arbitrum/sc-pool-apy.js');
  app.use('/v3/arbitrum/sc-pool-apy', v3ArbitrumSCPoolAPYRouter);

  const v3ArbitrumSCPoolAPYHistoryRouter = require('./routes/v3/arbitrum/sc-pool-apy-history.js');
  app.use('/v3/arbitrum/sc-pool-apy-history', v3ArbitrumSCPoolAPYHistoryRouter);

  const v3ArbitrumSCPoolAPYAllRouter = require('./routes/v3/arbitrum/sc-pool-apy-all.js');
  app.use('/v3/arbitrum/sc-pool-apy-all', v3ArbitrumSCPoolAPYAllRouter);

  const v3BaseSCPoolAPYAllRouter = require('./routes/v3/base/sc-pool-apy-all.js');
  app.use('/v3/base/sc-pool-apy-all', v3BaseSCPoolAPYAllRouter);

  const v3MainnetScPoolAPYAllRouter = require('./routes/v3/mainnet/sc-pool-apy-all.js');
  app.use('/v3/mainnet/sc-pool-apy-all', v3MainnetScPoolAPYAllRouter);

  const v3OptimismLTLeaderboardRouter = require('./routes/v3/optimism/lt-leaderboard.js');
  app.use('/v3/optimism/lt-leaderboard', v3OptimismLTLeaderboardRouter);

  //  const v3SnaxTestnetVotesRouter = require('./routes/v3/snax-testnet/votes.js');
  //  app.use('/v3/snax-testnet/votes', v3SnaxTestnetVotesRouter);

  const v3SnaxVotesRouter = require('./routes/v3/snax/votes.js');
  app.use('/v3/snax/votes', v3SnaxVotesRouter);

  const v3TvlRouter = require('./routes/v3/tvl.js');
  app.use('/v3/tvl', v3TvlRouter);

  const v3TopAsset = require('./routes/v3/top-asset.js');
  app.use('/v3/top-asset', v3TopAsset);

  // stats
  const statsPerpsVolumeRouter = require('./routes/stats/perps-volume.js');
  app.use('/stats/perps-volume', statsPerpsVolumeRouter);

  // app.use(function errorHandler(err, req, res, next) {
  //   console.error(err);
  //   if (res.headersSent) {
  //     return next(err);
  //   }
  //   res.status(500);
  //   res.json({ error: err.message });
  // });

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
