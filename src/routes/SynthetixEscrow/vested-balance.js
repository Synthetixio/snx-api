const express = require('express');
const router = express.Router();

const {
  log,
  formatEtherBn,
  snxContractInterface,
  snxOVMContractInterface,
  getBackupProvider,
  getCache,
  setCache,
} = require('../../utils');

/**
 * @openapi
 * /SynthetixEscrow/vested-balance:
 *  get:
 *     tags:
 *     - vested-balance
 *     description: Returns vested SNX balance from SynthetixEscrow contract.
 *     responses:
 *       200:
 *        description: Successful response.
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                synthetixEscrowVestedBalance:
 *                  type: string
 *                  example: "723907.949250420000000002"
 *                OVMSynthetixEscrowVestedBalance:
 *                  type: string
 *                  example: "0"
 *                contracts:
 *                  type: object
 *                  properties:
 *                    ethereum:
 *                      type: object
 *                      properties:
 *                        synthetixEscrowVestedBalance:
 *                          type: string
 *                          example: "0x971e78e0C92392A4E39099835cF7E6aB535b2227"
 *                    optimism:
 *                      type: object
 *                      properties:
 *                        OVMSynthetixEscrowVestedBalance:
 *                          type: string
 *                          example: "0x06C6D063896ac733673c4474E44d9268f2402A55"
 *       444:
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
    await synthetixEscrowVestedBalanceHandler(req, res, next),
);

module.exports = {
  router,
  synthetixEscrowVestedBalanceHandler,
  getSynthetixEscrowVestedBalance,
  getOVMSynthetixEscrowVestedBalance,
};

async function synthetixEscrowVestedBalanceHandler(req, res, next) {
  try {
    const cacheKey = 'synthetixEscrow-vestedBalance';
    log.debug('Checking cache..');
    const cachedResponse = await getCache(cacheKey);
    if (cachedResponse) {
      log.debug('Cache found');
      res.json(cachedResponse);
    } else {
      log.debug('Cache not found, executing..');
      const {
        synthetixEscrowVestedBalanceContractAddress,
        synthetixEscrowVestedBalance,
      } = await getSynthetixEscrowVestedBalance();

      const {
        OVMSynthetixEscrowVestedBalanceContractAddress,
        OVMSynthetixEscrowVestedBalance,
      } = await getOVMSynthetixEscrowVestedBalance();

      const responseData = {
        synthetixEscrowVestedBalance,
        OVMSynthetixEscrowVestedBalance,
        contracts: {
          ethereum: {
            synthetixEscrowVestedBalance:
              synthetixEscrowVestedBalanceContractAddress,
          },
          optimism: {
            OVMSynthetixEscrowVestedBalance:
              OVMSynthetixEscrowVestedBalanceContractAddress,
          },
        },
      };
      log.debug('Setting cache..');
      await setCache(cacheKey, responseData, 60);

      res.json(responseData);
    }
  } catch (error) {
    log.error(`[synthetixEscrowVestedBalanceHandler] Error: ${error.message}`);
    next(error);
  }
}

async function getSynthetixEscrowVestedBalance(options = {}) {
  try {
    log.debug('Fetching SynthetixEscrow vested balance..');
    const synthetixEscrowVestedBalanceContractAddress = snxContractInterface(
      options.provider,
    ).SynthetixEscrow.address;
    const synthetixEscrowVestedBalance = formatEtherBn(
      await snxContractInterface(
        options.provider,
      ).SynthetixEscrow.totalVestedBalance(),
    );
    log.info(
      `SynthetixEscrow vested balance is ${synthetixEscrowVestedBalance}`,
    );
    return {
      synthetixEscrowVestedBalanceContractAddress,
      synthetixEscrowVestedBalance,
    };
  } catch (e) {
    log.warn(`[getSynthetixEscrowVestedBalance] Error: ${e.message}`);
    if (e.code === 'NETWORK_ERROR' && !options.retried) {
      log.warn(
        '[getSynthetixEscrowVestedBalance] Changing provider and retrying..',
      );
      return await getSynthetixEscrowVestedBalance({
        provider: getBackupProvider('ethereum'),
        retried: true,
      });
    }
    throw new Error(
      `[getSynthetixEscrowVestedBalance] Failed to respond: ${e.message}`,
    );
  }
}

async function getOVMSynthetixEscrowVestedBalance(options = {}) {
  try {
    log.debug('[ovm] Fetching SynthetixEscrow vested balance..');
    const OVMSynthetixEscrowVestedBalanceContractAddress =
      snxOVMContractInterface(options.provider).SynthetixEscrow.address;
    const OVMSynthetixEscrowVestedBalance = formatEtherBn(
      await snxOVMContractInterface(
        options.provider,
      ).SynthetixEscrow.totalVestedBalance(),
    );
    log.info(
      `[ovm] SynthetixEscrow vested balance is ${OVMSynthetixEscrowVestedBalance}`,
    );
    return {
      OVMSynthetixEscrowVestedBalanceContractAddress,
      OVMSynthetixEscrowVestedBalance,
    };
  } catch (e) {
    log.warn(`[getOVMSynthetixEscrowVestedBalance] Error: ${e.message}`);
    if (e.code === 'NETWORK_ERROR' && !options.retried) {
      log.warn(
        '[getOVMSynthetixEscrowVestedBalance] Changing provider and retrying..',
      );
      return await getOVMSynthetixEscrowVestedBalance({
        provider: getBackupProvider('optimism'),
        retried: true,
      });
    }
    throw new Error(
      `[getOVMSynthetixEscrowVestedBalance] Failed to respond: ${e.message}`,
    );
  }
}
