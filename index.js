const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const basicAuth = require('express-basic-auth');

const swaggerDocs = require('./swagger.js');
const { redisClient, log } = require('./utils');

redisClient.on('error', (err) => log.error(`[Redis] Client error: ${err}`));
redisClient.on('ready', () => {
  log.debug('[Redis] Client is connected and ready to use');
  const app = express();
  log.debug('[Express] Setting up middlewares..');
  app.use(morgan('combined'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cors());
  app.use(
    helmet.contentSecurityPolicy({
      directives: {
        // eslint-disable-next-line quotes
        'default-src': ["'self'", 'api.synthetix.io'],
      },
    }),
  );
  app.use(cookieParser());
  app.set('json spaces', 4);
  app.set('etag', false);
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    log.debug('[Express] Setting no-cache headers..');
    res.set({
      'Surrogate-Control': 'no-store',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
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

  log.debug('[Express] Starting server..');
  const port = process.env.API_PORT || 3000;
  const host = process.env.API_HOST || '127.0.0.1';
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
  })();
  log.debug('[Express] Quitting..');
  process.exit(0);
});
