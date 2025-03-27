const { log, pgQuery, getCache, setCache } = require('/opt/nodejs/utils');

const cacheKey = 'v3-base-sc-pool-apy';

exports.handler = async (event, context) => {
  try {
    log.debug('Received request for v3/base/sc-pool-apy');

    // Try to get from cache first
    log.debug('Checking cache..');
    const cachedResponse = await getCache(cacheKey);
    if (cachedResponse) {
      log.debug('Cache found');
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control':
            'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
        body: JSON.stringify(cachedResponse),
      };
    }

    // If not in cache, fetch from database
    log.debug('Cache not found, executing query..');
    const responseData = await fetchDataFromPostgres();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control':
          'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
      body: JSON.stringify(responseData),
    };
  } catch (error) {
    log.error(`[v3/base/sc-pool-apy] Error: ${error.message}`);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};

async function fetchDataFromPostgres() {
  log.debug('[v3/base/sc-pool-apy] Fetching data from postgres..');
  const queryResult = await pgQuery(
    `SELECT 
        pool_id,
        collateral_type,
        (coalesce(snx_rewards_rate,0) + coalesce(op_rewards_rate,0) + coalesce(base_rewards_rate,0)) as rewards_apr,
        ROUND((coalesce(snx_rewards_rate,0) + coalesce(op_rewards_rate,0) + coalesce(base_rewards_rate,0) + coalesce(trading_apr,0)), 2) as apr,
        coalesce(tvl, 0) as tvl,
        ROUND(coalesce(ratio, 0) * 100, 2) as collateralisation_ratio,
        ROUND(coalesce(target_collateral, 0), 2) as target_collateral,
        coalesce(target_collateralization_ratio, 0) as target_collateralization_ratio
      FROM (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY pool_id ORDER BY ts DESC) AS rn
        FROM 
          prod_base_mainnet.fct_core_apr_base_mainnet
      ) sub
      WHERE rn = 1
      ORDER BY apr DESC;`,
  );

  if (!queryResult) {
    return { error: 'Query error.' };
  }

  const pools = queryResult.rows.map((row) => ({
    pool_id: row.pool_id,
    collateral_type: row.collateral_type,
    rewards_apr: parseFloat(row.rewards_apr),
    apr: parseFloat(row.apr),
    tvl: parseFloat(row.tvl),
    collateralisation_ratio: parseFloat(row.collateralisation_ratio),
    target_collateral: parseFloat(row.target_collateral),
    target_collateralization_ratio: parseFloat(
      row.target_collateralization_ratio,
    ),
  }));

  const responseData = {
    timestamp: new Date().toISOString(),
    pools: pools,
  };

  log.debug('[v3/base/sc-pool-apy] Setting cache..');
  await setCache(cacheKey, responseData, 300);
  return responseData;
}
