const { log, pgQuery, getCache, setCache } = require('/opt/nodejs/utils');

const cacheKey = 'v3-tvl';

exports.handler = async (event, context) => {
  try {
    log.debug('Received request for v3/tvl');

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
    log.error(`[v3Tvl] Error: ${error.message}`);
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
  log.debug('[v3Tvl] Fetching data from postgres..');
  const queryResult = await pgQuery(
    `SELECT round(sum(collateral_value), 2) as tvl
      FROM (
              SELECT 'base' as chain,
                  collateral_type,
                  collateral_value,
                  ts,
                  ROW_NUMBER() OVER (
                      PARTITION BY collateral_type
                      ORDER BY ts DESC
                  ) AS rn
              FROM prod_base_mainnet.fct_core_apr_base_mainnet
              union ALL
              SELECT 'ethereum' as chain,
                  collateral_type,
                  collateral_value,
                  ts,
                  ROW_NUMBER() OVER (
                      PARTITION BY collateral_type
                      ORDER BY ts DESC
                  ) AS rn
              FROM prod_eth_mainnet.fct_core_apr_eth_mainnet
              union ALL
              SELECT 'arbitrum' as chain,
                  collateral_type,
                  collateral_value,
                  ts,
                  ROW_NUMBER() OVER (
                      PARTITION BY collateral_type
                      ORDER BY ts DESC
                  ) AS rn
              FROM prod_arbitrum_mainnet.fct_core_apr_arbitrum_mainnet
          ) sub
      WHERE rn = 1;`,
  );

  if (!queryResult) {
    return { error: 'Query error.' };
  }

  const tvl = queryResult.rows[0].tvl;
  const tvlUsd = parseFloat(tvl);

  const responseData = {
    timestamp: new Date().toISOString(),
    tvl: tvlUsd,
  };

  log.debug('[v3Tvl] Setting cache..');
  await setCache(cacheKey, responseData, 300);
  return responseData;
}
