const express = require('express');
const router = express.Router();
const { log, pgQuery, getCache, setCache } = require('../../utils');

const cacheKey = 'perps-volume';

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
 * /stats/perps-volume:
 *  get:
 *     tags:
 *     - stats
 *     description: Returns total volume figures across all perps deployments.
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
 *                 volume_7d:
 *                   type: number
 *                   example: 123456789.123456789
 *                 volume_24h:
 *                  type: number
 *                  example: 12345678.123456789
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
    log.error(`[statsPerpsVolume] Error: ${error.message}`);
    next(error);
  }
});

module.exports = router;

async function fetchDataFromPostgres() {
  log.debug('[statsPerpsVolume] Fetching data from postgres..');
  const queryResult = await pgQuery(
    `WITH volume AS (
        SELECT ts,
            'volume_24h' AS label,
            volume
        FROM prod_base_mainnet.fct_perp_stats_hourly_base_mainnet
        WHERE ts >= NOW() - INTERVAL '24 HOURS'
        UNION ALL
        SELECT ts,
            'volume_24h' AS label,
            volume
        FROM prod_arbitrum_mainnet.fct_perp_stats_hourly_arbitrum_mainnet
        WHERE ts >= NOW() - INTERVAL '24 HOURS'
        UNION ALL
        select ts,
            'volume_24h' AS label,
            volume
        from prod_optimism_mainnet.fct_v2_stats_hourly_optimism_mainnet
        where ts >= NOW() - INTERVAL '24 HOURS'
        UNION ALL
        SELECT ts,
            'volume_7d' AS label,
            volume
        FROM prod_base_mainnet.fct_perp_stats_hourly_base_mainnet
        WHERE ts >= NOW() - INTERVAL '7 DAYS'
        UNION ALL
        SELECT ts,
            'volume_7d' AS label,
            volume
        FROM prod_arbitrum_mainnet.fct_perp_stats_hourly_arbitrum_mainnet
        WHERE ts >= NOW() - INTERVAL '7 DAYS'
        UNION ALL
        select ts,
            'volume_7d' AS label,
            volume
        from prod_optimism_mainnet.fct_v2_stats_hourly_optimism_mainnet
        where ts >= NOW() - INTERVAL '7 DAYS'
    )
    SELECT label,
        round(SUM(volume), 2) AS volume
    FROM volume
    GROUP BY label;`,
  );

  const volume24h = queryResult.rows.find(
    (row) => row.label === 'volume_24h',
  ).volume;
  const volume7d = queryResult.rows.find(
    (row) => row.label === 'volume_7d',
  ).volume;

  const volume24hUsd = parseFloat(volume24h);
  const volume7dUsd = parseFloat(volume7d);

  const responseData = {
    timestamp: new Date().toISOString(),
    volume_24h: volume24hUsd,
    volume_7d: volume7dUsd,
  };
  log.debug('[statsPerpsVolume] Setting cache..');
  await setCache(cacheKey, responseData, 60);
  return responseData;
}
