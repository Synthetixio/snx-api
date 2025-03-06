const express = require('express');
const router = express.Router();
const { log, pgQuery, getCache, setCache } = require('../../../utils');
const cacheKeyPrefix = 'base-reward-claimed';

/**
 * @openapi
 * /v3/base/rewards-claimed:
 *   get:
 *     tags:
 *     - v3
 *     summary: Fetch sum of usd value of claimed rewards for a given account ID.
 *     description: Checks the cache first, and if not found, fetches claimed rewards data from Postgres for the given account ID.
 *     parameters:
 *       - in: query
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *         description: The account ID to fetch rewards for. Must be a positive integer.
 *     responses:
 *       200:
 *         description: Successfully fetched claimed rewards.
 *         content:
 *           application/json:
 *             schema:
 *               type: number
 *               description: Sum of all claimed rewards usd value
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
    log.error(`[BaseClaimedRewards] Error: ${error.message}`);
    next(error);
  }
});
module.exports = router;
async function fetchDataFromPostgres(accountId) {
  log.debug('[BaseClaimedRewards] Fetching data from postgres..');

  const query = `
  SELECT
      SUM(CAST(amount_usd AS DECIMAL)) AS total_amount_usd
  FROM prod_base_mainnet.fct_core_rewards_claimed_base_mainnet
  WHERE account_id = $1;
  `;

  const queryResult = await pgQuery(query, [accountId]);
  const totalAmountUsd = queryResult.rows[0].total_amount_usd;

  log.debug('[BaseClaimedRewards] Setting cache..');
  const cacheKey = `${cacheKeyPrefix}-${accountId}`;
  await setCache(cacheKey, totalAmountUsd, 300);
  return totalAmountUsd;
}
