// Adapted from src/routes/v3/mainnet/sc-pool-apy-all.js
const { log, postgresPool } = require('/opt/nodejs/utils');
const AWS = require('aws-sdk');

// Initialize DynamoDB client (replaces Redis cache)
const dynamoDb = new AWS.DynamoDB.DocumentClient();
const CACHE_TABLE = process.env.CACHE_TABLE || 'SnxApiCache';
const cacheKey = 'eth-sc-pool-apy-all';
const CACHE_TTL = 300; // 5 minutes in seconds

// Helper function to get item from DynamoDB cache
async function getCache(key) {
  try {
    const params = {
      TableName: CACHE_TABLE,
      Key: {
        cacheKey: key,
      },
    };

    const result = await dynamoDb.get(params).promise();
    if (result.Item && result.Item.expiry > Math.floor(Date.now() / 1000)) {
      return JSON.parse(result.Item.data);
    }
    return null;
  } catch (error) {
    log.error(`Error getting cache: ${error}`);
    return null;
  }
}

// Helper function to set item in DynamoDB cache
async function setCache(key, data, ttlSeconds) {
  try {
    const params = {
      TableName: CACHE_TABLE,
      Item: {
        cacheKey: key,
        data: JSON.stringify(data),
        expiry: Math.floor(Date.now() / 1000) + ttlSeconds,
      },
    };

    await dynamoDb.put(params).promise();
    return true;
  } catch (error) {
    log.error(`Error setting cache: ${error}`);
    return false;
  }
}

// Helper function to query PostgreSQL
async function pgQuery(query, params) {
  try {
    return await postgresPool.query(query, params);
  } catch (error) {
    log.error(`PostgreSQL query error: ${error}`);
    return null;
  }
}

exports.handleRequest = async (event, context) => {
  try {
    log.info('Handling request for sc-pool-apy-all');

    // Check cache first
    log.debug('Checking cache..');
    const cachedResponse = await getCache(cacheKey);
    if (cachedResponse) {
      log.debug('Cache found');
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
        },
        body: JSON.stringify(cachedResponse),
      };
    }

    // Cache not found, fetch data from database
    log.debug('Cache not found, fetching data..');
    const responseData = await fetchDataFromPostgres();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
      body: JSON.stringify(responseData),
    };
  } catch (error) {
    log.error(`Error in sc-pool-apy-all handler: ${error}`);
    return {
      statusCode: error.statusCode || 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: error.message || 'Internal Server Error' }),
    };
  }
};

async function fetchDataFromPostgres() {
  log.debug('[v3MainnetSCPoolAPYAll] Fetching data from postgres..');
  const queryResult = await pgQuery(
    `WITH latest_records AS (
      SELECT DISTINCT ON (collateral_type)
        ts,
        pool_id,
        collateral_type,
        collateral_value,
        debt,
        hourly_issuance,
        hourly_pnl,
        cumulative_pnl,
        cumulative_issuance,
        rewards_usd,
        hourly_pnl_pct,
        hourly_rewards_pct,
        apr_24h,
        apy_24h,
        apr_7d,
        apy_7d,
        apr_28d,
        apy_28d,
        apr_24h_pnl,
        apy_24h_pnl,
        apr_7d_pnl,
        apy_7d_pnl,
        apr_28d_pnl,
        apy_28d_pnl,
        apr_24h_rewards,
        apy_24h_rewards,
        apr_7d_rewards,
        apy_7d_rewards,
        apr_28d_rewards,
        apy_28d_rewards,
        apr_24h_incentive_rewards,
        apy_24h_incentive_rewards,
        apr_7d_incentive_rewards,
        apy_7d_incentive_rewards,
        apr_28d_incentive_rewards,
        apy_28d_incentive_rewards,
        apy_24h_performance,
        apr_24h_performance,
        apr_7d_performance,
        apy_7d_performance,
        apr_28d_performance,
        apy_28d_performance
      FROM prod_eth_mainnet.fct_core_apr_eth_mainnet
      WHERE pool_id = 1
      ORDER BY collateral_type, ts DESC
    )
    SELECT * FROM latest_records
    ORDER BY ts DESC;`,
  );

  if (!queryResult) {
    return { error: 'Query error.' };
  }

  const responseData = queryResult.rows.map((item) => ({
    timestamp: item.ts,
    poolId: item.pool_id,
    collateralType: item.collateral_type,
    collateralValue: parseFloat(item.collateral_value),
    debtAmount: parseFloat(item.debt),
    hourlyIssuance: parseFloat(item.hourly_issuance),
    hourlyPnl: parseFloat(item.hourly_pnl),
    cumulativePnl: parseFloat(item.cumulative_pnl),
    cumulativeIssuance: parseFloat(item.cumulative_issuance),
    rewardsUSD: parseFloat(item.rewards_usd),
    hourlyPnlPct: parseFloat(item.hourly_pnl_pct),
    hourlyRewardsPct: parseFloat(item.hourly_rewards_pct),
    apr24h: parseFloat(item.apr_24h),
    apy24h: parseFloat(item.apy_24h),
    apr7d: parseFloat(item.apr_7d),
    apy7d: parseFloat(item.apy_7d),
    apr28d: parseFloat(item.apr_28d),
    apy28d: parseFloat(item.apy_28d),
    apr24hPnl: parseFloat(item.apr_24h_pnl),
    apy24hPnl: parseFloat(item.apy_24h_pnl),
    apr7dPnl: parseFloat(item.apr_7d_pnl),
    apy7dPnl: parseFloat(item.apy_7d_pnl),
    apr28dPnl: parseFloat(item.apr_28d_pnl),
    apy28dPnl: parseFloat(item.apy_28d_pnl),
    apr24hRewards: parseFloat(item.apr_24h_rewards),
    apy24hRewards: parseFloat(item.apy_24h_rewards),
    apr7dRewards: parseFloat(item.apr_7d_rewards),
    apy7dRewards: parseFloat(item.apy_7d_rewards),
    apr28dRewards: parseFloat(item.apr_28d_rewards),
    apy28dRewards: parseFloat(item.apy_28d_rewards),
    apr24hIncentiveRewards: parseFloat(item.apr_24h_incentive_rewards),
    apy24hIncentiveRewards: parseFloat(item.apy_24h_incentive_rewards),
    apr7dIncentiveRewards: parseFloat(item.apr_7d_incentive_rewards),
    apy7dIncentiveRewards: parseFloat(item.apy_7d_incentive_rewards),
    apr28dIncentiveRewards: parseFloat(item.apr_28d_incentive_rewards),
    apy28dIncentiveRewards: parseFloat(item.apy_28d_incentive_rewards),
    apy24hPerformance: parseFloat(item.apy_24h_performance),
    apr24hPerformance: parseFloat(item.apr_24h_performance),
    apr7dPerformance: parseFloat(item.apr_7d_performance),
    apy7dPerformance: parseFloat(item.apy_7d_performance),
    apr28dPerformance: parseFloat(item.apr_28d_performance),
    apy28dPerformance: parseFloat(item.apy_28d_performance),
    aprPnl: parseFloat(item.apr_7d_pnl),
    aprRewards: parseFloat(item.apr_7d_rewards),
    aprCombined: parseFloat(item.apr_7d),
  }));

  log.debug('[v3MainnetSCPoolAPYAll] Setting cache..');
  await setCache(cacheKey, responseData, CACHE_TTL);
  return responseData;
}
