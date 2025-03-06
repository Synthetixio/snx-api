const express = require('express');
const router = express.Router();
const { log, pgQuery, getCache, setCache } = require('../../utils');

const networks = ['cross'];
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
 *             - cross
 *             - ethereum
 *             - optimism
 *         description: Name of the blockchain network (e.g., cross, ethereum, or optimism).
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
module.exports = router;

async function fetchDataFromPostgres(network, span) {
  const cacheKey = `tvl420-${network}-${span}`;
  log.debug(`[${cacheKey}] Fetching data from postgres..`);
  let query;
  switch (true) {
    case network === 'cross' && span === 'hourly': {
      query = `SELECT t.ts, t.hourly_cumulative_value as value
       FROM prod_cross_chains.fct_pol_stats_hourly_cross_chains t
       WHERE t.ts >= NOW() - INTERVAL '7 days'
       LIMIT 200`;
      break;
    }
    case network === 'cross' && span === 'daily': {
      query = `SELECT t.ts, t.daily_cumulative_value as value
       FROM prod_cross_chains.fct_pol_stats_daily_cross_chains t
       WHERE t.ts >= NOW() - INTERVAL '2 months'
       LIMIT 100`;
      break;
    }
    case network === 'cross' && span === 'weekly': {
      query = `SELECT t.ts, t.weekly_cumulative_amount as value
       FROM prod_cross_chains.fct_pol_stats_weekly_cross_chains t
       WHERE t.ts >= NOW() - INTERVAL '1 year'
       LIMIT 100`;
      break;
    }
    case network === 'cross' && span === 'monthly': {
      query = `SELECT t.ts, t.monthly_cumulative_value as value
       FROM prod_cross_chains.fct_pol_stats_monthly_cross_chains t
       WHERE t.ts >= NOW() - INTERVAL '5 years'
       LIMIT 100`;
      break;
    }
    case network === 'ethereum' && span === 'hourly': {
      query = `SELECT t.ts, t.hourly_cumulative_value as value
       FROM prod_eth_mainnet.fct_pol_stats_hourly_eth_mainnet t
       WHERE t.ts >= NOW() - INTERVAL '7 days'
       LIMIT 200`;
      break;
    }
    case network === 'ethereum' && span === 'daily': {
      query = `SELECT t.ts, t.daily_cumulative_value as value
       FROM prod_eth_mainnet.fct_pol_stats_daily_eth_mainnet t
       WHERE t.ts >= NOW() - INTERVAL '2 months'
       LIMIT 100`;
      break;
    }
    case network === 'ethereum' && span === 'weekly': {
      query = `SELECT t.ts, t.weekly_cumulative_amount as value
       FROM prod_eth_mainnet.fct_pol_stats_weekly_eth_mainnet t
       WHERE t.ts >= NOW() - INTERVAL '1 year'
       LIMIT 100`;
      break;
    }
    case network === 'ethereum' && span === 'monthly': {
      query = `SELECT t.ts, t.monthly_cumulative_value as value
       FROM prod_eth_mainnet.fct_pol_stats_monthly_eth_mainnet t
       WHERE t.ts >= NOW() - INTERVAL '5 years'
       LIMIT 100`;
      break;
    }
    case network === 'optimism' && span === 'hourly': {
      query = `SELECT t.ts, t.hourly_cumulative_value as value
       FROM prod_optimism_mainnet.fct_pol_stats_hourly_optimism_mainnet t
       WHERE t.ts >= NOW() - INTERVAL '7 days'
       LIMIT 200`;
      break;
    }
    case network === 'optimism' && span === 'daily': {
      query = `SELECT t.ts, t.daily_cumulative_value as value
       FROM prod_optimism_mainnet.fct_pol_stats_daily_optimism_mainnet t
       WHERE t.ts >= NOW() - INTERVAL '2 months'
       LIMIT 100`;
      break;
    }
    case network === 'optimism' && span === 'weekly': {
      query = `SELECT t.ts, t.weekly_cumulative_amount as value
       FROM prod_optimism_mainnet.fct_pol_stats_weekly_optimism_mainnet t
       WHERE t.ts >= NOW() - INTERVAL '1 year'
       LIMIT 100`;
      break;
    }
    case network === 'optimism' && span === 'monthly': {
      query = `SELECT t.ts, t.monthly_cumulative_value as value
       FROM prod_optimism_mainnet.fct_pol_stats_monthly_optimism_mainnet t
       WHERE t.ts >= NOW() - INTERVAL '5 years'
       LIMIT 100`;
      break;
    }
  }

  const queryResult = await pgQuery(query, []);
  const responseData = queryResult.rows;
  log.debug(`[${cacheKey}] Setting cache..`);
  await setCache(cacheKey, responseData, 600_000);
  return responseData;
}
