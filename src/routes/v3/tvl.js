const express = require('express');
const router = express.Router();
const { log, pgQuery, getCache, setCache } = require('../../utils');

const cacheKey = 'v3-tvl';

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
 * /v3/tvl:
 *  get:
 *     tags:
 *     - v3
 *     description: Returns total value locked across all Synthetix V3 deployments.
 *     responses:
 *       200:
 *         description: Successful response.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: '2024-05-23T14:00:00.000Z'
 *                 tvl:
 *                   type: number
 *                   example: 123456789.123456789
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
    log.error(`[v3Tvl] Error: ${error.message}`);
    next(error);
  }
});

module.exports = router;

async function fetchDataFromPostgres() {
  log.debug('[v3Tvl] Fetching data from postgres..');
  const queryResult = await pgQuery(
    `SELECT round(sum(collateral_value), 2) as tvl
      FROM (
              SELECT 'base' as chain,
                  collateral_type,
                  collateral_value,
                  ts,
                  ROW_NUMBER() OVER (
                      PARTITION BY collateral_type
                      ORDER BY ts DESC
                  ) AS rn
              FROM prod_base_mainnet.fct_core_apr_base_mainnet
              union ALL
              SELECT 'ethereum' as chain,
                  collateral_type,
                  collateral_value,
                  ts,
                  ROW_NUMBER() OVER (
                      PARTITION BY collateral_type
                      ORDER BY ts DESC
                  ) AS rn
              FROM prod_eth_mainnet.fct_core_apr_eth_mainnet
              union ALL
              SELECT 'arbitrum' as chain,
                  collateral_type,
                  collateral_value,
                  ts,
                  ROW_NUMBER() OVER (
                      PARTITION BY collateral_type
                      ORDER BY ts DESC
                  ) AS rn
              FROM prod_arbitrum_mainnet.fct_core_apr_arbitrum_mainnet
          ) sub
      WHERE rn = 1;`,
  );

  const tvl = queryResult.rows[0].tvl;
  const tvlUsd = parseFloat(tvl);

  const responseData = {
    timestamp: new Date().toISOString(),
    tvl: tvlUsd,
  };
  log.debug('[v3Tvl] Setting cache..');
  await setCache(cacheKey, responseData, 60);
  return responseData;
}
