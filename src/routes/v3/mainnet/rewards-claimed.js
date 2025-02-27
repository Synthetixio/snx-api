const express = require('express');
const router = express.Router();
const { log, postgresClient, getCache, setCache } = require('../../../utils');
const cacheKeyPrefix = 'mainnet-rewards-claimed';

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
    log.error(`[MainnetClaimedRewards] Error: ${error.message}`);
    next(error);
  }
});
module.exports = router;
async function fetchDataFromPostgres(accountId) {
  log.debug('[MainnetClaimedRewards] Fetching data from postgres..');

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
    from prod_eth_mainnet.fct_core_rewards_claimed_eth_mainnet
    where account_id = $1
    limit 500;`;

  const queryResult = await postgresClient.query(query, [accountId]);
  const responseData = queryResult.rows;
  log.debug('[MainnetClaimedRewards] Setting cache..');
  const cacheKey = `${cacheKeyPrefix}-${accountId}`;
  await setCache(cacheKey, responseData, 60);
  return responseData;
}
