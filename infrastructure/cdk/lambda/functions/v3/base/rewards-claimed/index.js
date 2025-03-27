const { log, pgQuery, getCache, setCache } = require('/opt/nodejs/utils');

const cacheKey = 'v3-base-rewards-claimed';

exports.handler = async (event, context) => {
  try {
    log.debug('Received request for v3/base/rewards-claimed');

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
    log.error(`[v3/base/rewards-claimed] Error: ${error.message}`);
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
  log.debug('[v3/base/rewards-claimed] Fetching data from postgres..');
  const queryResult = await pgQuery(
    `SELECT 
      account_id,
      SUM(amount) as amount, 
      currency
    FROM 
      prod_base_mainnet.rewards_claimed
    GROUP BY 
      account_id, currency
    ORDER BY 
      amount DESC;`,
  );

  if (!queryResult) {
    return { error: 'Query error.' };
  }

  const rewards = queryResult.rows.map((row) => ({
    account_id: row.account_id,
    amount: parseFloat(row.amount),
    currency: row.currency,
  }));

  const responseData = {
    timestamp: new Date().toISOString(),
    rewards: rewards,
  };

  log.debug('[v3/base/rewards-claimed] Setting cache..');
  await setCache(cacheKey, responseData, 300);
  return responseData;
}
