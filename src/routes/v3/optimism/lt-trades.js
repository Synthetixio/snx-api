const express = require('express');
const router = express.Router();
const { log, postgresClient, getCache, setCache } = require('../../../utils');
const cacheKey = 'optimism-lt-trades';
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
 * /v3/Optimism/lt-trades:
 *  get:
 *     tags:
 *     - v3
 *     description: Returns leverage token trades on optimism.
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
 *                 id:
 *                   type: string
 *                   example: '0131506856-000048-c2285'
 *                 block_number:
 *                   type: number
 *                   example: 131506856
 *                 ts:
 *                  type: string
 *                  format: date-time
 *                  example: "2025-02-03 19:54:49+00"
 *                 transaction_hash:
 *                  type: string
 *                  example: "0x..."
 *                 contract:
 *                  type: string
 *                  example: "0x..."
 *                 event_name:
 *                  type: string
 *                  example: "Redeemed"
 *                 account:
 *                  type: string
 *                  example: "0x"
 *                 token:
 *                  type: string
 *                  example: "btc_long7"
 *                 leverage:
 *                  type: number
 *                  example: 1
 *                 market:
 *                  type: string
 *                  example: "BTC"
 *                 leveraged_token_amount:
 *                  type: string
 *                  example: "1"
 *                 base_asset_amount:
 *                  type: string
 *                  example: "1"
 *                 nominal_volume:
 *                  type: string
 *                  example: "1"
 *                 notional_volume:
 *                  type: string
 *                  example: "1"
 *                 token_price:
 *                  type: string
 *                  example: "1"
 *                 total_supply:
 *                  type: string
 *                  example: "1"
 *                 vault_tvl:
 *                  type: string
 *                  example: "1"
 *                 vault_oi:
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
    log.error(`[ltOptimismTrade] Error: ${error.message}`);
    next(error);
  }
});
module.exports = router;
async function fetchDataFromPostgres() {
  log.debug('[ltOptimismTrade] Fetching data from postgres..');
  const queryResult = await postgresClient.query(
    `select *
    from prod_optimism_mainnet.lt_trades_optimism_mainnet
    order by block_number desc
    limit 100;`,
  );
  const responseData = queryResult.rows;
  log.debug('[ltOptimismTrade] Setting cache..');
  await setCache(cacheKey, responseData, 60);
  return responseData;
}
