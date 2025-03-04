const express = require('express');
const router = express.Router();
const { log, pgQuery, getCache, setCache } = require('../../../utils');
const cacheKeyPrefix = 'base-rewards-claimed';

/**
 * @openapi
 * /:
 *   get:
 *     summary: Fetch claimed rewards for a given account ID.
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
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   ts:
 *                     type: string
 *                     format: date-time
 *                     description: Timestamp of the reward claim.
 *                   pool_id:
 *                     type: string
 *                     description: ID of the pool.
 *                   collateral_type:
 *                     type: string
 *                     description: The collateral type.
 *                   account_id:
 *                     type: string
 *                     description: The account ID.
 *                   reward_type:
 *                     type: string
 *                     description: The type of reward.
 *                   distributor:
 *                     type: string
 *                     description: Distributor information.
 *                   token_symbol:
 *                     type: string
 *                     description: Symbol of the token.
 *                   amount:
 *                     type: number
 *                     description: Amount of the reward.
 *                   price:
 *                     type: number
 *                     description: Price of the reward token.
 *                   amount_usd:
 *                     type: number
 *                     description: Reward amount in USD.
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

  const query = `select
        ts,
        pool_id,
        collateral_type,
        account_id,
        reward_type,
        distributor,
        token_symbol,
        amount,
        price,
        amount_usd
    from prod_base_mainnet.fct_core_rewards_claimed_base_mainnet
    where account_id = $1
    limit 20;`;

  const queryResult = await pgQuery(query, [accountId]);
  const responseData = queryResult.rows;
  log.debug('[BaseClaimedRewards] Setting cache..');
  const cacheKey = `${cacheKeyPrefix}-${accountId}`;
  await setCache(cacheKey, responseData, 60);
  return responseData;
}
