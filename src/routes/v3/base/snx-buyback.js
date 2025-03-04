const express = require('express');
const router = express.Router();
const { log, pgQuery, getCache, setCache } = require('../../../utils');

const cacheKey = 'snx-buyback';

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
 * /v3/Base/snx-buyback:
 *  get:
 *     tags:
 *     - v3
 *     description: Returns SNX buyback details on Base.
 *     responses:
 *       200:
 *        description: Successful response.
 *        content:
 *          application/json:
 *            schema:
 *              type: array
 *              items:
 *                type: object
 *                properties:
 *                  ts:
 *                    type: number
 *                    example: "1714003200000"
 *                  snxAmount:
 *                    type: number
 *                    example: "202.23566293647977"
 *                  usdAmount:
 *                    type: number
 *                    example: "588.0897936329317"
 *                  cumulativeSnxAmount:
 *                    type: number
 *                    example: "24451.665275214178"
 *                  cumulativeUsdAmount:
 *                    type: number
 *                    example: "95386.36662445917"
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
    log.error(`[v3BaseSNXBuyback] Error: ${error.message}`);
    next(error);
  }
});

module.exports = router;

async function fetchDataFromPostgres() {
  log.debug('[v3BaseSNXBuyback] Fetching data from postgres..');
  const queryResult = await pgQuery(
    `select
      ts,
      snx_amount,
      usd_amount,
      cumulative_snx_amount,
      cumulative_usd_amount
    from prod_base_mainnet.fct_buyback_daily_base_mainnet;`,
  );

  const data = queryResult.rows.map(parseAndRenameKeys);

  const responseData = data;
  log.debug('[v3BaseSNXBuyback] Setting cache..');
  await setCache(cacheKey, responseData, 60);
  return responseData;
}

function toCamelCase(str) {
  return str.replace(/([-_][a-z])/gi, (group) =>
    group.toUpperCase().replace('-', '').replace('_', ''),
  );
}

function parseAndRenameKeys(obj) {
  const newObj = {};
  for (const key in obj) {
    const camelCaseKey = toCamelCase(key);
    if (key === 'ts') {
      newObj[camelCaseKey] = Date.parse(obj[key]);
    } else if (!isNaN(obj[key])) {
      newObj[camelCaseKey] = parseFloat(obj[key]);
    } else {
      newObj[camelCaseKey] = obj[key];
    }
  }
  return newObj;
}
