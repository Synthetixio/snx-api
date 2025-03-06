const express = require('express');
const router = express.Router();
const { log, pgQuery, getCache, setCache } = require('../../../utils');

const cacheKey = 'sc-pool-apy-history';

setInterval(fetchDataFromPostgres, 300_000);

/**
 * @openapi
 * /v3/base/sc-pool-apy-history:
 *  get:
 *     tags:
 *     - v3
 *     description: Returns historical APY for Spartan Council Pool on Base.
 *     responses:
 *       200:
 *         description: Successful response.
 *         content:
 *           application/json:
 *            schema:
 *              type: array
 *              items:
 *               type: object
 *               properties:
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: '2024-05-23T14:00:00.000Z'
 *                 poolId:
 *                   type: integer
 *                   example: 1
 *                 collateralType:
 *                   type: string
 *                   example: '0xc74ea762cf06c9151ce074e6a569a5945b6302e7'
 *                 collateralValue:
 *                   type: number
 *                   example: 23075347.609146226
 *                 debtAmount:
 *                   type: number
 *                   example: -38219.337186378914
 *                 hourlyIssuance:
 *                   type: number
 *                   example: 500
 *                 hourlyPnl:
 *                   type: number
 *                   example: 12954.05122107834
 *                 cumulativePnl:
 *                   type: number
 *                   example: 43985.56313904079
 *                 cumulativeIssuance:
 *                   type: number
 *                   example: 5766.225952661871
 *                 rewardsUSD:
 *                   type: number
 *                   example: 325.5208333342384
 *                 hourlyPnlPct:
 *                   type: number
 *                   example: 0.0005613805451816391
 *                 hourlyRewardsPct:
 *                   type: number
 *                   example: 0.00001410686585736259
 *                 apr24h:
 *                   type: number
 *                   example: 0.45592422360763046
 *                 apy24h:
 *                   type: number
 *                   example: 0.57761207594964
 *                 apr7d:
 *                   type: number
 *                   example: 0.3960274742990924
 *                 apy7d:
 *                   type: number
 *                   example: 0.4858968400315962
 *                 apr28d:
 *                   type: number
 *                   example: 0.4384330174128003
 *                 apy28d:
 *                   type: number
 *                   example: 0.550259050183527
 *                 apr24hPnl:
 *                   type: number
 *                   example: 0.33291916703302443
 *                 apy24hPnl:
 *                   type: number
 *                   example: 0.39502570410440424
 *                 apr7dPnl:
 *                   type: number
 *                   example: 0.19503277851939582
 *                 apy7dPnl:
 *                   type: number
 *                   example: 0.21534818462340294
 *                 apr28dPnl:
 *                   type: number
 *                   example: 0.13876757264702413
 *                 apy28dPnl:
 *                   type: number
 *                   example: 0.14885578045932418
 *                 apr24hRewards:
 *                   type: number
 *                   example: 0.12300505657460604
 *                 apy24hRewards:
 *                   type: number
 *                   example: 0.13088916273804313
 *                 apr7dRewards:
 *                   type: number
 *                   example: 0.20099469577969659
 *                 apy7dRewards:
 *                   type: number
 *                   example: 0.22261546761516451
 *                 apr28dRewards:
 *                   type: number
 *                   example: 0.29966544476577617
 *                 apy28dRewards:
 *                   type: number
 *                   example: 0.34940036452177975
 *                 aprPnl:
 *                   type: number
 *                   example: 0.19503277851939582
 *                 aprRewards:
 *                   type: number
 *                   example: 0.20099469577969659
 *                 aprCombined:
 *                   type: number
 *                   example: 0.3960274742990924
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
    log.error(`[v3BaseSCPoolAPYHistory] Error: ${error.message}`);
    next(error);
  }
});

module.exports = router;

async function fetchDataFromPostgres() {
  log.debug('[v3BaseSCPoolAPYHistory] Fetching data from postgres..');
  const queryResult = await pgQuery(
    `WITH latest_records AS (
      SELECT
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
        apy_28d_rewards
      FROM prod_base_mainnet.fct_core_apr_base_mainnet
      WHERE pool_id = 1 
      ORDER BY ts DESC
    )
    SELECT * FROM latest_records
    ORDER BY ts DESC
    LIMIT 100000;`,
  );
  if (!queryResult) {
    return { error: 'Query error.' };
  }

  const dailyResults = queryResult.rows
    .filter((_, index) => index % 24 === 0)
    .map(
      ({
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
      }) => {
        const timestamp = ts;
        const poolId = pool_id;
        const collateralType = collateral_type;
        const collateralValue = parseFloat(collateral_value);
        const debtAmount = parseFloat(debt);
        const hourlyIssuance = parseFloat(hourly_issuance);
        const hourlyPnl = parseFloat(hourly_pnl);
        const cumulativePnl = parseFloat(cumulative_pnl);
        const cumulativeIssuance = parseFloat(cumulative_issuance);
        const rewardsUSD = parseFloat(rewards_usd);
        const hourlyPnlPct = parseFloat(hourly_pnl_pct);
        const hourlyRewardsPct = parseFloat(hourly_rewards_pct);
        const apr24h = parseFloat(apr_24h);
        const apy24h = parseFloat(apy_24h);
        const apr7d = parseFloat(apr_7d);
        const apy7d = parseFloat(apy_7d);
        const apr28d = parseFloat(apr_28d);
        const apy28d = parseFloat(apy_28d);
        const apr24hPnl = parseFloat(apr_24h_pnl);
        const apy24hPnl = parseFloat(apy_24h_pnl);
        const apr7dPnl = parseFloat(apr_7d_pnl);
        const apy7dPnl = parseFloat(apy_7d_pnl);
        const apr28dPnl = parseFloat(apr_28d_pnl);
        const apy28dPnl = parseFloat(apy_28d_pnl);
        const apr24hRewards = parseFloat(apr_24h_rewards);
        const apy24hRewards = parseFloat(apy_24h_rewards);
        const apr7dRewards = parseFloat(apr_7d_rewards);
        const apy7dRewards = parseFloat(apy_7d_rewards);
        const apr28dRewards = parseFloat(apr_28d_rewards);
        const apy28dRewards = parseFloat(apy_28d_rewards);

        // old code - left for backward compatiblity
        const aprPnl = parseFloat(apr_7d_pnl);
        const aprRewards = parseFloat(apr_7d_rewards);
        const aprCombined = parseFloat(apr_7d);

        return {
          timestamp,
          poolId,
          collateralType,
          collateralValue,
          debtAmount,
          hourlyIssuance,
          hourlyPnl,
          cumulativePnl,
          cumulativeIssuance,
          rewardsUSD,
          hourlyPnlPct,
          hourlyRewardsPct,
          apr24h,
          apy24h,
          apr7d,
          apy7d,
          apr28d,
          apy28d,
          apr24hPnl,
          apy24hPnl,
          apr7dPnl,
          apy7dPnl,
          apr28dPnl,
          apy28dPnl,
          apr24hRewards,
          apy24hRewards,
          apr7dRewards,
          apy7dRewards,
          apr28dRewards,
          apy28dRewards,
          // old code - left for backward compatiblity
          aprPnl,
          aprRewards,
          aprCombined,
        };
      },
    );

  log.debug('[v3BaseSCPoolAPYHistory] Setting cache..');
  await setCache(cacheKey, dailyResults, 300);
  return dailyResults;
}
