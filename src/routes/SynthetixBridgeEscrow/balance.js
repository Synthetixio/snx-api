const express = require('express');
const router = express.Router();

const {
  log,
  snxContractInterface,
  getBackupProvider,
  getCache,
  setCache,
  getBalanceForContract,
} = require('../../utils');

/**
 * @openapi
 * /SynthetixBridgeEscrow/balance:
 *  get:
 *     tags:
 *     - escrowed-balance
 *     description: Returns escrowed SNX balance from SynthetixBridgeEscrow contract.
 *     responses:
 *       200:
 *        description: Successful response.
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                synthetixBridgeEscrowBalance:
 *                  type: string
 *                  example: "90615339.513130952531588288"
 *                contracts:
 *                  type: object
 *                  properties:
 *                    ethereum:
 *                      type: object
 *                      properties:
 *                        synthetixBridgeEscrowBalance:
 *                          type: string
 *                          example: "0x5Fd79D46EBA7F351fe49BFF9E87cdeA6c821eF9f"
 *       403:
 *        description: You have been banned by WAF.
 *       429:
 *        description: Too many requests, you're being rate-limited.
 *       5XX:
 *        description: Service unavailable.
 *       default:
 *        description: Unexpected error.
 */
router.get(
  '/',
  async (req, res, next) =>
    await synthetixBridgeEscrowBalanceHandler(req, res, next),
);

module.exports = {
  router,
  synthetixBridgeEscrowBalanceHandler,
  getSynthetixBridgeEscrowBalance,
};

async function synthetixBridgeEscrowBalanceHandler(req, res, next) {
  try {
    const cacheKey = 'synthetixBridgeEscrow-balance';
    log.debug('Checking cache..');
    const cachedResponse = await getCache(cacheKey);
    if (cachedResponse) {
      log.debug('Cache found');
      res.json(cachedResponse);
    } else {
      log.debug('Cache not found, executing..');

      const { balance, contractAddress } =
        await getSynthetixBridgeEscrowBalance('mainnet');

      const responseData = {
        synthetixBridgeEscrowBalance: balance,
        contracts: {
          ethereum: {
            synthetixBridgeEscrowBalance: contractAddress,
          },
        },
      };
      log.debug('Setting cache..');
      await setCache(cacheKey, responseData, 60);

      res.json(responseData);
    }
  } catch (error) {
    log.error(`[synthetixBridgeEscrowBalanceHandler] Error: ${error.message}`);
    next(error);
  }
}

async function getSynthetixBridgeEscrowBalance(network, options = {}) {
  try {
    log.debug(`Fetching SynthetixBridgeEscrow balance for ${network}..`);
    const contractAddress = snxContractInterface(network, options.provider)
      .SynthetixBridgeEscrow.address;
    const SNXTokenAddress = snxContractInterface(network, options.provider)
      .ProxyERC20.address;
    const balance = await getBalanceForContract(
      SNXTokenAddress,
      contractAddress,
      {
        network,
        retried: options.retried,
        backupProvider: options.provider,
      },
    );
    log.info(`SynthetixBridgeEscrow contract balance is ${balance}`);
    return {
      contractAddress,
      SNXTokenAddress,
      balance,
    };
  } catch (e) {
    log.warn(`[getSynthetixBridgeEscrowBalance] Error: ${e.message}`);
    if (e.code === 'NETWORK_ERROR' && !options.retried) {
      log.warn(
        '[getSynthetixBridgeEscrowBalance] Changing provider and retrying..',
      );
      return await getSynthetixBridgeEscrowBalance(network, {
        provider: getBackupProvider(network),
        retried: true,
      });
    }
    throw new Error(
      `[getSynthetixBridgeEscrowBalance] Failed to respond: ${e.message}`,
    );
  }
}
