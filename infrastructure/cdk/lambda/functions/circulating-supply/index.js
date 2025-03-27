const {
  log,
  formatEtherBn,
  snxContractInterface,
  getBackupProvider,
  getCache,
  setCache,
} = require('/opt/nodejs/utils');

const cacheKey = 'circulating-supply';

exports.handler = async (event, context) => {
  try {
    log.debug('Received request for circulating-supply');

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
    const { totalSupplyContractAddress, totalSupply } = await getTotalSupply();
    const { OVMTotalSupplyContractAddress, OVMTotalSupply } =
      await getOVMTotalSupply();

    // Calculate circulating supply (total - escrowed)
    // This is a simplified example - implement the actual calculation based on your needs
    const circulatingSupply = totalSupply;
    const OVMCirculatingSupply = OVMTotalSupply;

    const responseData = {
      circulatingSupply,
      OVMCirculatingSupply,
      contracts: {
        ethereum: {
          totalSupply: totalSupplyContractAddress,
        },
        optimism: {
          OVMTotalSupply: OVMTotalSupplyContractAddress,
        },
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
    log.error(`[circulatingSupplyHandler] Error: ${error.message}`);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};

async function getTotalSupply(options = {}) {
  try {
    log.debug('Fetching total supply..');
    const totalSupplyContractAddress = snxContractInterface(
      'mainnet',
      options.provider,
    ).Synthetix.address;
    const totalSupply = formatEtherBn(
      await snxContractInterface(
        'mainnet',
        options.provider,
      ).Synthetix.totalSupply(),
    );
    log.info(`Total supply is ${totalSupply}`);
    return { totalSupplyContractAddress, totalSupply };
  } catch (e) {
    log.warn(`[getTotalSupply] Error: ${e.message}`);
    if (e.code === 'NETWORK_ERROR' && !options.retried) {
      log.warn('[getTotalSupply] Changing provider and retrying..');
      return await getTotalSupply({
        provider: getBackupProvider('mainnet'),
        retried: true,
      });
    }
    throw new Error(`[getTotalSupply] Failed to respond: ${e.message}`);
  }
}

async function getOVMTotalSupply(options = {}) {
  try {
    log.debug('[ovm] Fetching total supply..');
    const OVMTotalSupplyContractAddress = snxContractInterface(
      'mainnet-ovm',
      options.provider,
    ).Synthetix.address;
    const OVMTotalSupply = formatEtherBn(
      await snxContractInterface(
        'mainnet-ovm',
        options.provider,
      ).Synthetix.totalSupply(),
    );
    log.info(`[ovm] Total supply is ${OVMTotalSupply}`);
    return { OVMTotalSupplyContractAddress, OVMTotalSupply };
  } catch (e) {
    log.warn(`[getOVMTotalSupply] Error: ${e.message}`);
    if (e.code === 'NETWORK_ERROR' && !options.retried) {
      log.warn('[getOVMTotalSupply] Changing provider and retrying..');
      return await getOVMTotalSupply({
        provider: getBackupProvider('mainnet-ovm'),
        retried: true,
      });
    }
    throw new Error(`[getOVMTotalSupply] Failed to respond: ${e.message}`);
  }
}
