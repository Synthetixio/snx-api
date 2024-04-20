const express = require('express');
const router = express.Router();

const { log, postgresClient, getCache, setCache } = require('../../../utils');

/**
 * @openapi
 * /v3/Base/sc-pool-apy:
 *  get:
 *     tags:
 *     - v3
 *     description: Returns current APY for Spartan Council Pool on Base.
 *     responses:
 *       200:
 *        description: Successful response.
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                aprPnl:
 *                  type: number
 *                  example: 0.13656878060168257
 *                aprRewards:
 *                  type: number
 *                  example: 0.33047981877022653
 *                aprCombined:
 *                  type: number
 *                  example: 0.46704859937190907
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
    const cacheKey = 'sc-pool-apy';
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
    log.error(`[v3BaseSCPoolAPY] Error: ${error.message}`);
    next(error);
  }
});

module.exports = router;
