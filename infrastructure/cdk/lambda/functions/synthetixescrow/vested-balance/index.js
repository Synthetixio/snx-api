const {
  log,
  formatEtherBn,
  snxContractInterface,
  getBackupProvider,
  getCache,
  setCache,
} = require('/opt/nodejs/utils');

const cacheKey = 'synthetixescrow-vested-balance';

exports.handler = async (event, context) => {
  try {
    log.debug('Received request for synthetixescrow/vested-balance');

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

    // If not in cache, fetch from blockchain
    log.debug('Cache not found, executing blockchain query..');
    const { vestedBalanceContractAddress, vestedBalance } =
      await getVestedBalance();

    const responseData = {
      vestedBalance,
      contracts: {
        vestedBalance: vestedBalanceContractAddress,
      },
    };

    log.debug('Setting cache..');
    await setCache(cacheKey, responseData, 300);

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
    log.error(`[SynthetixEscrow/vestedBalanceHandler] Error: ${error.message}`);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};

async function getVestedBalance(options = {}) {
  try {
    log.debug('Fetching vested balance..');
    const vestedBalanceContractAddress = snxContractInterface(
      'mainnet',
      options.provider,
    ).SynthetixEscrow.address;

    const vestedBalance = formatEtherBn(
      await snxContractInterface(
        'mainnet',
        options.provider,
      ).SynthetixEscrow.totalVestedBalance(),
    );

    log.info(`Vested balance is ${vestedBalance}`);
    return { vestedBalanceContractAddress, vestedBalance };
  } catch (e) {
    log.warn(`[getVestedBalance] Error: ${e.message}`);
    if (e.code === 'NETWORK_ERROR' && !options.retried) {
      log.warn('[getVestedBalance] Changing provider and retrying..');
      return await getVestedBalance({
        provider: getBackupProvider('mainnet'),
        retried: true,
      });
    }
    throw new Error(`[getVestedBalance] Failed to respond: ${e.message}`);
  }
}
