const express = require('express');
const router = express.Router();
const { log, postgresClient, getCache, setCache } = require('../../../utils');
const cacheKey = 'base-lt-leaderboard';
fetchDataFromPostgres();
const cacheTime =
  ((process.env.CACHE_TIME =
    typeof process.env.CACHE_TIME === 'string'
      ? parseInt(process.env.CACHE_TIME)
      : process.env.CACHE_TIME) -
    30) *
  1000;
setInterval(fetchDataFromPostgres, cacheTime < 30000 ? 30000 : cacheTime);
/**
 * @openapi
 * /v3/Base/lt-leaderboard:
 *  get:
 *     tags:
 *     - v3
 *     description: Returns leverage token leaderboard on base.
 *     responses:
 *       200:
 *        description: Successful response.
 *        content:
 *          application/json:
 *            schema:
 *              type: array
 *              items:
 *                type: object
 *               properties:
 *                 epoch_start:
 *                   type: string
 *                   format: date-time
 *                   example: '2024-05-23T14:00:00.000Z'
 *                 account:
 *                   type: string
 *                   example: "0xAa4a1d3c0d96B0D8C7AE4F71939D0Fa36bd97Aa7"
 *                 total_fees_paid:
 *                  type: string
 *                  example: "954.605497900439850"
 *                 fees_paid_pct:
 *                  type: string
 *                  example: "0.210334039122012452233641885"
 *                 rank:
 *                  type: string
 *                  example: "1"
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
    log.debug('Checking cache..');
    const cachedResponse = await getCache(cacheKey);
    if (cachedResponse) {
      log.debug('Cache found');
      res.json(cachedResponse);
    } else {
      log.debug('Cache not found, executing..');
      const responseData = await fetchDataFromPostgres();
      res.json(responseData);
    }
  } catch (error) {
    log.error(`[ltBaseLeaderboard] Error: ${error.message}`);
    next(error);
  }
});
module.exports = router;
async function fetchDataFromPostgres() {
  log.debug('[ltBaseLeaderboard] Fetching data from postgres..');
  const queryResult = await postgresClient.query(
    `select
      epoch_start,
      account,
      total_fees_paid,
      fees_paid_pct,
      rank
    from prod_base_mainnet.lt_leaderboard
    WHERE epoch_start = date '2025-01-14'
    ;`,
  );
  const responseData = queryResult.rows;
  log.debug('[ltBaseLeaderboard] Setting cache..');
  await setCache(cacheKey, responseData, 60);
  return responseData;
}
