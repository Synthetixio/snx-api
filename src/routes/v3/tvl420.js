const express = require('express');
const router = express.Router();
const { log, pgQuery, getCache, setCache } = require('../../utils');

const networks = ['ethereum', 'optimism'];
const spans = ['hourly', 'daily', 'weekly', 'monthly'];

function prefetch() {
  for (const network of networks) {
    for (const span of spans) {
      fetchDataFromPostgres(network, span);
    }
  }
}
setInterval(prefetch, 60_000);

/**
 * @openapi
 * /v3/tvl420:
 *   get:
 *     summary: Retrieve TVL data for a specific network and time span.
 *     description: Fetches Total Value Locked (TVL) data from the cache or PostgreSQL for the specified blockchain network and time span.
 *     parameters:
 *       - in: query
 *         name: network
 *         required: true
 *         schema:
 *           type: string
 *           enum:
 *             - ethereum
 *             - optimism
 *         description: Name of the blockchain network (e.g., ethereum or optimism).
 *       - in: query
 *         name: span
 *         required: true
 *         schema:
 *           type: string
 *           enum:
 *             - hourly
 *             - daily
 *             - weekly
 *             - monthly
 *         description: Time span for aggregations
 *     responses:
 *       200:
 *         description: Successfully retrieved TVL data.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   ts:
 *                     type: string
 *                     format: date-time
 *                     description: The timestamp of the TVL data.
 *                   value:
 *                     type: number
 *                     format: float
 *                     description: The TVL value.
 *       400:
 *         description: Invalid network or span specified in query parameters.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Invalid network or span.
 *       500:
 *         description: An unexpected error occurred when fetching data.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Internal server error.
 */
router.get('/', async (req, res, next) => {
  const { network, span } = req.query;
  if (
    !(
      ['ethereum', 'optimism'].includes(network) &&
      ['hourly', 'daily', 'weekly', 'monthly'].includes(span)
    )
  ) {
    return res.status(400).json({
      error: 'Invalid network or span.',
    });
  }
  const cacheKey = `tvl420-${network}-${span}`;

  try {
    log.debug(`[${cacheKey}] Checking cache..`);
    const cachedResponse = await getCache(cacheKey);
    if (cachedResponse) {
      log.debug(`[${cacheKey}] Cache found..`);
      res.json(cachedResponse);
    } else {
      log.debug(`[${cacheKey}] Cache not found, executing..`);
      const responseData = await fetchDataFromPostgres(network, span);
      res.json(responseData);
    }
  } catch (error) {
    log.error(`[${cacheKey}] Error: ${error.message}`);
    next(error);
  }
});
module.exports = router;

async function fetchDataFromPostgres(network, span) {
  const cacheKey = `tvl420-${network}-${span}`;
  log.debug(`[${cacheKey}] Fetching data from postgres..`);
  let query;
  switch (true) {
    case network === 'ethereum' && span === 'hourly': {
      query = `SELECT t.ts, t.hourly_cumulative_value as value
       FROM prod_eth_mainnet.fct_pol_stats_hourly_eth_mainnet t
       LIMIT $1`;
      break;
    }
    case network === 'ethereum' && span === 'daily': {
      query = `SELECT t.ts, t.daily_cumulative_value as value
       FROM prod_eth_mainnet.fct_pol_stats_daily_eth_mainnet t
       LIMIT $1`;
      break;
    }
    case network === 'ethereum' && span === 'weekly': {
      query = `SELECT t.ts, t.weekly_cumulative_amount as value
       FROM prod_eth_mainnet.fct_pol_stats_weekly_eth_mainnet t
       LIMIT $1`;
      break;
    }
    case network === 'ethereum' && span === 'monthly': {
      query = `SELECT t.ts, t.monthly_cumulative_value as value
       FROM prod_eth_mainnet.fct_pol_stats_monthly_eth_mainnet t
       LIMIT $1`;
      break;
    }
    case network === 'optimism' && span === 'hourly': {
      query = `SELECT t.ts, t.hourly_cumulative_value as value
       FROM prod_optimism_mainnet.fct_pol_stats_hourly_optimism_mainnet t
       LIMIT $1`;
      break;
    }
    case network === 'optimism' && span === 'daily': {
      query = `SELECT t.ts, t.daily_cumulative_value as value
       FROM prod_optimism_mainnet.fct_pol_stats_daily_optimism_mainnet t
       LIMIT $1`;
      break;
    }
    case network === 'optimism' && span === 'weekly': {
      query = `SELECT t.ts, t.weekly_cumulative_amount as value
       FROM prod_optimism_mainnet.fct_pol_stats_weekly_optimism_mainnet t
       LIMIT $1`;
      break;
    }
    case network === 'optimism' && span === 'monthly': {
      query = `SELECT t.ts, t.monthly_cumulative_value as value
       FROM prod_optimism_mainnet.fct_pol_stats_monthly_optimism_mainnet t
       LIMIT $1`;
      break;
    }
  }

  const limit = 50;
  const queryResult = await pgQuery(query, [limit]);
  const responseData = queryResult.rows;
  log.debug(`[${cacheKey}] Setting cache..`);
  await setCache(cacheKey, responseData, 600_000);
  return responseData;
}
