const express = require('express');
const router = express.Router();

const { log, postgresClient, getCache, setCache } = require('../utils');

/**
 * @openapi
 * /v3-base-apy:
 *  get:
 *     tags:
 *     - v3
 *     description: Returns current APY for Base (Spartan Council Pool).
 *     responses:
 *       200:
 *        description: Successful response.
 *        content:
 *          text/plain:
 *            schema:
 *              type: string
 *              example: OK
 *       401:
 *        description: Unauthorized.
 *       403:
 *        description: You have been banned by WAF.
 *       429:
 *        description: Too many requests, you're being rate-limited.
 *       5XX:
 *        description: Service unavailable.
 *       default:
 *        description: Unexpected error.
 */
router.get('/', async (req, res, next) => {
  try {
    const cacheKey = 'v3-base-apy';
    log.debug('Checking cache..');
    const cachedResponse = await getCache(cacheKey);
    if (cachedResponse) {
      log.debug('Cache found');
      res.json(cachedResponse);
    } else {
      log.debug('Cache not found, executing..');
      const queryResult = await postgresClient.query(
        'select ts, pool_id, collateral_type, apr_7d, apr_7d_pnl, apr_7d_rewards from base_mainnet.fct_core_apr WHERE pool_id = 1 order by ts desc limit 1;',
      );

      const { apr_7d, apr_7d_pnl, apr_7d_rewards } = queryResult.rows[0];
      const aprPnl = parseFloat(apr_7d_pnl);
      const aprRewards = parseFloat(apr_7d_rewards);
      const aprCombined = parseFloat(apr_7d);

      const responseData = {
        aprPnl,
        aprRewards,
        aprCombined,
      };
      log.debug('Setting cache..');
      await setCache(cacheKey, responseData, 60);
      res.json(responseData);
    }
  } catch (error) {
    log.error(`[v3-base-apy] Error: ${error.message}`);
    next(error);
  }
});

module.exports = router;
