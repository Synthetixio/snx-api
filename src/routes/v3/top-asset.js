const express = require('express');
const router = express.Router();
const { log, pgQuery, getCache, setCache } = require('../../utils');

const cacheKey = 'v3-top-asset';

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
 * /v3/top-asset:
 *  get:
 *     tags:
 *     - v3
 *     description: Returns the current top performing asset and it's APR and APY estimated from past 7 day performance.
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
 *                 chain:
 *                   type: string
 *                   example: 'base'
 *                 token_symbol:
 *                  type: string
 *                  example: 'USDC'
 *                 apr:
 *                  type: number
 *                  example: 0.123456789
 *                 apy:
 *                  type: number
 *                  example: 0.123456789
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
    log.error(`[v3TopAsset] Error: ${error.message}`);
    next(error);
  }
});

module.exports = router;

async function fetchDataFromPostgres() {
  log.debug('[v3TopAsset] Fetching data from postgres..');
  const queryResult = await pgQuery(
    `with base as (
        SELECT 'base' as chain,
            t.token_symbol,
            apr.apy_7d,
            apr.apr_7d,
            ROW_NUMBER() OVER (
                PARTITION BY collateral_type
                ORDER BY ts DESC
            ) AS rn
        FROM prod_base_mainnet.fct_core_apr_base_mainnet apr
            join prod_seeds.base_mainnet_tokens t on lower(apr.collateral_type) = lower(t.token_address)
    ),
    arb as (
        SELECT 'arbitrum' as chain,
            t.token_symbol,
            apr.apy_7d,
            apr.apr_7d,
            ROW_NUMBER() OVER (
                PARTITION BY collateral_type
                ORDER BY ts DESC
            ) AS rn
        FROM prod_arbitrum_mainnet.fct_core_apr_arbitrum_mainnet apr
            join prod_seeds.arbitrum_mainnet_tokens t on lower(apr.collateral_type) = lower(t.token_address)
    ),
    eth as (
        SELECT 'ethereum' as chain,
            t.token_symbol,
            apr.apy_7d,
            apr.apr_7d,
            ROW_NUMBER() OVER (
                PARTITION BY collateral_type
                ORDER BY ts DESC
            ) AS rn
        FROM prod_eth_mainnet.fct_core_apr_eth_mainnet apr
            join prod_seeds.eth_mainnet_tokens t on lower(apr.collateral_type) = lower(t.token_address)
    ),
    combined as (
        select *
        from base
        where rn = 1
        union all
        select *
        from arb
        where rn = 1
        union all
        select *
        from eth
        where rn = 1
    )
    select chain,
        token_symbol,
        round(apy_7d, 8) as apy,
        round(apr_7d, 8) as apr
    from combined
    order by apy_7d desc
    limit 1;`,
  );

  const chain = queryResult.rows?.[0]?.chain;
  const tokenSymbol = queryResult.rows?.[0]?.token_symbol;
  const apy = parseFloat(queryResult.rows?.[0]?.apy);
  const apr = parseFloat(queryResult.rows?.[0]?.apr);

  const responseData = {
    timestamp: new Date().toISOString(),
    chain,
    token_symbol: tokenSymbol,
    apr,
    apy,
  };
  log.debug('[v3TopAsset] Setting cache..');
  await setCache(cacheKey, responseData, 60);
  return responseData;
}
