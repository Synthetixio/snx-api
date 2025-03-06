const express = require('express');
const router = express.Router();
const { log, pgQuery, getCache, setCache } = require('../../../utils');

const cacheKey = 'arbitrum-sc-pool-apy-all';

setInterval(fetchDataFromPostgres, 300_000);

/**
 * @openapi
 * /v3/arbitrum/sc-pool-apy-all:
 *  get:
 *     tags:
 *     - v3
 *     description: Returns current APY for Spartan Council Pool on Arbitrum.
 *     responses:
 *       200:
 *         description: Successful response.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                     example: '2024-05-23T14:00:00.000Z'
 *                   poolId:
 *                     type: integer
 *                     example: 1
 *                   collateralType:
 *                     type: string
 *                     example: '0xc74ea762cf06c9151ce074e6a569a5945b6302e7'
 *                   collateralValue:
 *                     type: number
 *                     example: 23075347.609146226
 *                   debtAmount:
 *                     type: number
 *                     example: -38219.337186378914
 *                   hourlyIssuance:
 *                     type: number
 *                     example: 500
 *                   hourlyPnl:
 *                     type: number
 *                     example: 12954.05122107834
 *                   cumulativePnl:
 *                     type: number
 *                     example: 43985.56313904079
 *                   cumulativeIssuance:
 *                     type: number
 *                     example: 5766.225952661871
 *                   rewardsUSD:
 *                     type: number
 *                     example: 325.5208333342384
 *                   hourlyPnlPct:
 *                     type: number
 *                     example: 0.0005613805451816391
 *                   hourlyRewardsPct:
 *                     type: number
 *                     example: 0.00001410686585736259
 *                   apr24h:
 *                     type: number
 *                     example: 0.45592422360763046
 *                   apy24h:
 *                     type: number
 *                     example: 0.57761207594964
 *                   apr7d:
 *                     type: number
 *                     example: 0.3960274742990924
 *                   apy7d:
 *                     type: number
 *                     example: 0.4858968400315962
 *                   apr28d:
 *                     type: number
 *                     example: 0.4384330174128003
 *                   apy28d:
 *                     type: number
 *                     example: 0.550259050183527
 *                   apr24hPnl:
 *                     type: number
 *                     example: 0.33291916703302443
 *                   apy24hPnl:
 *                     type: number
 *                     example: 0.39502570410440424
 *                   apr7dPnl:
 *                     type: number
 *                     example: 0.19503277851939582
 *                   apy7dPnl:
 *                     type: number
 *                     example: 0.21534818462340294
 *                   apr28dPnl:
 *                     type: number
 *                     example: 0.13876757264702413
 *                   apy28dPnl:
 *                     type: number
 *                     example: 0.14885578045932418
 *                   apr24hRewards:
 *                     type: number
 *                     example: 0.12300505657460604
 *                   apy24hRewards:
 *                     type: number
 *                     example: 0.13088916273804313
 *                   apr7dRewards:
 *                     type: number
 *                     example: 0.20099469577969659
 *                   apy7dRewards:
 *                     type: number
 *                     example: 0.22261546761516451
 *                   apr28dRewards:
 *                     type: number
 *                     example: 0.29966544476577617
 *                   apy28dRewards:
 *                     type: number
 *                     example: 0.34940036452177975
 *                   aprPnl:
 *                     type: number
 *                     example: 0.19503277851939582
 *                   aprRewards:
 *                     type: number
 *                     example: 0.20099469577969659
 *                   aprCombined:
 *                     type: number
 *                     example: 0.3960274742990924
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
    log.error(`[v3ArbitrumSCPoolAPYAll] Error: ${error.message}`);
    next(error);
  }
});

module.exports = router;

async function fetchDataFromPostgres() {
  log.debug('[v3ArbitrumSCPoolAPYAll] Fetching data from postgres..');
  const queryResult = await pgQuery(
    `WITH latest_records AS (
      SELECT DISTINCT ON (collateral_type) 
        ts, 
        pool_id, 
        collateral_type, 
        collateral_value, 
        debt, 
        hourly_issuance, 
        hourly_pnl, 
        cumulative_pnl, 
        cumulative_issuance, 
        rewards_usd, 
        hourly_pnl_pct, 
        hourly_rewards_pct, 
        apr_24h, 
        apy_24h, 
        apr_7d, 
        apy_7d, 
        apr_28d, 
        apy_28d, 
        apr_24h_pnl, 
        apy_24h_pnl, 
        apr_7d_pnl, 
        apy_7d_pnl, 
        apr_28d_pnl, 
        apy_28d_pnl, 
        apr_24h_rewards, 
        apy_24h_rewards, 
        apr_7d_rewards, 
        apy_7d_rewards, 
        apr_28d_rewards, 
        apy_28d_rewards,
        apr_24h_incentive_rewards,
        apy_24h_incentive_rewards,
        apr_7d_incentive_rewards,
        apy_7d_incentive_rewards,
        apr_28d_incentive_rewards,
        apy_28d_incentive_rewards,
        apy_24h_performance,
        apr_24h_performance,
        apr_7d_performance,
        apy_7d_performance,
        apr_28d_performance,
        apy_28d_performance
      FROM prod_arbitrum_mainnet.fct_core_apr_arbitrum_mainnet
      WHERE pool_id = 1 
      ORDER BY collateral_type, ts DESC
    )
    SELECT * FROM latest_records
    ORDER BY ts DESC;`,
  );

  const responseData = queryResult.rows.map((item) => ({
    timestamp: item.ts,
    poolId: item.pool_id,
    collateralType: item.collateral_type,
    collateralValue: parseFloat(item.collateral_value),
    debtAmount: parseFloat(item.debt),
    hourlyIssuance: parseFloat(item.hourly_issuance),
    hourlyPnl: parseFloat(item.hourly_pnl),
    cumulativePnl: parseFloat(item.cumulative_pnl),
    cumulativeIssuance: parseFloat(item.cumulative_issuance),
    rewardsUSD: parseFloat(item.rewards_usd),
    hourlyPnlPct: parseFloat(item.hourly_pnl_pct),
    hourlyRewardsPct: parseFloat(item.hourly_rewards_pct),
    apr24h: parseFloat(item.apr_24h),
    apy24h: parseFloat(item.apy_24h),
    apr7d: parseFloat(item.apr_7d),
    apy7d: parseFloat(item.apy_7d),
    apr28d: parseFloat(item.apr_28d),
    apy28d: parseFloat(item.apy_28d),
    apr24hPnl: parseFloat(item.apr_24h_pnl),
    apy24hPnl: parseFloat(item.apy_24h_pnl),
    apr7dPnl: parseFloat(item.apr_7d_pnl),
    apy7dPnl: parseFloat(item.apy_7d_pnl),
    apr28dPnl: parseFloat(item.apr_28d_pnl),
    apy28dPnl: parseFloat(item.apy_28d_pnl),
    apr24hRewards: parseFloat(item.apr_24h_rewards),
    apy24hRewards: parseFloat(item.apy_24h_rewards),
    apr7dRewards: parseFloat(item.apr_7d_rewards),
    apy7dRewards: parseFloat(item.apy_7d_rewards),
    apr28dRewards: parseFloat(item.apr_28d_rewards),
    apy28dRewards: parseFloat(item.apy_28d_rewards),
    apr24hIncentiveRewards: parseFloat(item.apr_24h_incentive_rewards),
    apy24hIncentiveRewards: parseFloat(item.apy_24h_incentive_rewards),
    apr7dIncentiveRewards: parseFloat(item.apr_7d_incentive_rewards),
    apy7dIncentiveRewards: parseFloat(item.apy_7d_incentive_rewards),
    apr28dIncentiveRewards: parseFloat(item.apr_28d_incentive_rewards),
    apy28dIncentiveRewards: parseFloat(item.apy_28d_incentive_rewards),
    apy24hPerformance: parseFloat(item.apy_24h_performance),
    apr24hPerformance: parseFloat(item.apr_24h_performance),
    apr7dPerformance: parseFloat(item.apr_7d_performance),
    apy7dPerformance: parseFloat(item.apy_7d_performance),
    apr28dPerformance: parseFloat(item.apr_28d_performance),
    apy28dPerformance: parseFloat(item.apy_28d_performance),
    aprPnl: parseFloat(item.apr_7d_pnl),
    aprRewards: parseFloat(item.apr_7d_rewards),
    aprCombined: parseFloat(item.apr_7d),
  }));

  log.debug('[v3ArbitrumSCPoolAPYAll] Setting cache..');
  await setCache(cacheKey, responseData, 300);
  return responseData;
}
