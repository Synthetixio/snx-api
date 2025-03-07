const express = require('express');
const router = express.Router();
const { log, pgQuery, getCache, setCache } = require('../../../utils');
const cacheKeyPrefix = 'mainnet-issued-debt';

/**
 * @openapi
 * /v3/mainnet/issued-debt:
 *   get:
 *     tags:
 *     - v3
 *     summary: Fetch sum of usd value of issued debt each collateral.
 *     description: Checks the cache first, and if not found, fetches issued debt data from Postgres for the given account ID.
 *     parameters:
 *       - in: query
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *         description: The account ID to fetch the issued debt for.
 *     responses:
 *       200:
 *         description: Successfully fetched issued debt.
 *         content:
 *          application/json:
 *            schema:
 *              type: array
 *              items:
 *                type: object
 *                properties:
 *                 collateral_type:
 *                   type: string
 *                   example: '0x..'
 *                 issuance:
 *                   type: number
 *                   example: 1
 *       400:
 *         description: Invalid accountId provided.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message.
 *       500:
 *         description: An internal server error occurred.
 */
router.get('/', async (req, res, next) => {
  try {
    log.debug('Checking cache..');
    let { accountId } = req.query;
    accountId = accountId ? accountId.replace(/\n|\r/g, '') : accountId;

    if (!/^\d+$/.test(accountId)) {
      return res
        .status(400)
        .json({ error: 'accountId must be a positive integer' });
    }

    const cacheKey = `${cacheKeyPrefix}-${accountId}`;
    const cachedResponse = await getCache(cacheKey);

    if (cachedResponse) {
      log.debug('Cache found');
      res.json(cachedResponse);
    } else {
      log.debug('Cache not found, executing..');
      const responseData = await fetchDataFromPostgres(accountId);
      res.json(responseData);
    }
  } catch (error) {
    log.error(`[MainnetIssuedDebt] Error: ${error.message}`);
    next(error);
  }
});
module.exports = router;
async function fetchDataFromPostgres(accountId) {
  log.debug('[MainnetIssuedDebt] Fetching data from postgres..');

  const query = `
  SELECT
      collateral_type,
      SUM(CAST(amount AS DECIMAL)) AS issuance
  FROM prod_eth_mainnet.fct_pool_issuance_eth_mainnet
  WHERE account_id = $1
      AND pool_id = 1
  GROUP BY collateral_type
  `;

  const queryResult = await pgQuery(query, [accountId]);
  if (!queryResult) {
    return { error: 'Query error.' };
  }
  const responseData = queryResult.rows;

  log.debug('[MainnetIssuedDebt] Setting cache..');
  const cacheKey = `${cacheKeyPrefix}-${accountId}`;
  await setCache(cacheKey, responseData, 300);
  return responseData;
}
