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
 * /RewardEscrowV2/escrowed-balance:
 *  get:
 *     tags:
 *     - escrowed-balance
 *     description: Returns escrowed SNX balance from RewardEscrowV2 contract.
 *     responses:
 *       200:
 *        description: Successful response.
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                rewardEscrowV2EscrowedBalance:
 *                  type: string
 *                  example: "58794904.970146869484807159"
 *                OVMRewardEscrowV2EscrowedBalance:
 *                  type: string
 *                  example: "34299749.053100401709993579"
 *                contracts:
 *                  type: object
 *                  properties:
 *                    ethereum:
 *                      type: object
 *                      properties:
 *                        rewardEscrowV2EscrowedBalance:
 *                          type: string
 *                          example: "0xAc86855865CbF31c8f9FBB68C749AD5Bd72802e3"
 *                    optimism:
 *                      type: object
 *                      properties:
 *                        OVMRewardEscrowV2EscrowedBalance:
 *                          type: string
 *                          example: "0x6330D5F08f51057F36F46d6751eCDc0c65Ef7E9e"
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
    await rewardEscrowV2EscrowedBalanceHandler(req, res, next),
);

module.exports = {
  router,
  rewardEscrowV2EscrowedBalanceHandler,
  getRewardEscrowV2EscrowedBalance,
  getOVMRewardEscrowV2EscrowedBalance,
};

async function rewardEscrowV2EscrowedBalanceHandler(req, res, next) {
  try {
    const cacheKey = 'rewardEscrowV2-escrowedBalance';
    log.debug('Checking cache..');
    const cachedResponse = await getCache(cacheKey);
    if (cachedResponse) {
      log.debug('Cache found');
      res.json(cachedResponse);
    } else {
      log.debug('Cache not found, executing..');
      const {
        rewardEscrowV2EscrowedBalanceContractAddress,
        rewardEscrowV2EscrowedBalance,
      } = await getRewardEscrowV2EscrowedBalance();

      const {
        OVMRewardEscrowV2EscrowedBalanceContractAddress,
        OVMRewardEscrowV2EscrowedBalance,
      } = await getOVMRewardEscrowV2EscrowedBalance();

      const responseData = {
        rewardEscrowV2EscrowedBalance,
        OVMRewardEscrowV2EscrowedBalance,
        contracts: {
          ethereum: {
            rewardEscrowV2EscrowedBalance:
              rewardEscrowV2EscrowedBalanceContractAddress,
          },
          optimism: {
            OVMRewardEscrowV2EscrowedBalance:
              OVMRewardEscrowV2EscrowedBalanceContractAddress,
          },
        },
      };
      log.debug('Setting cache..');
      await setCache(cacheKey, responseData, 60);

      res.json(responseData);
    }
  } catch (error) {
    log.error(`[rewardEscrowV2EscrowedBalanceHandler] Error: ${error.message}`);
    next(error);
  }
}

async function getRewardEscrowV2EscrowedBalance(options = {}) {
  try {
    log.debug('Fetching RewardEscrowV2 escrowed balance..');
    const rewardEscrowV2EscrowedBalanceContractAddress = snxContractInterface(
      options.provider,
    ).RewardEscrowV2.address;
    const rewardEscrowV2EscrowedBalance = formatEtherBn(
      await snxContractInterface(
        options.provider,
      ).RewardEscrowV2.totalEscrowedBalance(),
    );
    log.info(
      `RewardEscrowV2 escrowed balance is ${rewardEscrowV2EscrowedBalance}`,
    );
    return {
      rewardEscrowV2EscrowedBalanceContractAddress,
      rewardEscrowV2EscrowedBalance,
    };
  } catch (e) {
    log.warn(`[getRewardEscrowV2EscrowedBalance] Error: ${e.message}`);
    if (e.code === 'NETWORK_ERROR' && !options.retried) {
      log.warn(
        '[getRewardEscrowV2EscrowedBalance] Changing provider and retrying..',
      );
      return await getRewardEscrowV2EscrowedBalance({
        provider: getBackupProvider('ethereum'),
        retried: true,
      });
    }
    throw new Error(
      `[getRewardEscrowV2EscrowedBalance] Failed to respond: ${e.message}`,
    );
  }
}

async function getOVMRewardEscrowV2EscrowedBalance(options = {}) {
  try {
    log.debug('[ovm] Fetching RewardEscrowV2 escrowed balance..');
    const OVMRewardEscrowV2EscrowedBalanceContractAddress =
      snxOVMContractInterface(options.provider).RewardEscrowV2.address;
    const OVMRewardEscrowV2EscrowedBalance = formatEtherBn(
      await snxOVMContractInterface(
        options.provider,
      ).RewardEscrowV2.totalEscrowedBalance(),
    );
    log.info(
      `[ovm] RewardEscrowV2 escrowed balance is ${OVMRewardEscrowV2EscrowedBalance}`,
    );
    return {
      OVMRewardEscrowV2EscrowedBalanceContractAddress,
      OVMRewardEscrowV2EscrowedBalance,
    };
  } catch (e) {
    log.warn(`[getOVMRewardEscrowV2EscrowedBalance] Error: ${e.message}`);
    if (e.code === 'NETWORK_ERROR' && !options.retried) {
      log.warn(
        '[getOVMRewardEscrowV2EscrowedBalance] Changing provider and retrying..',
      );
      return await getOVMRewardEscrowV2EscrowedBalance({
        provider: getBackupProvider('optimism'),
        retried: true,
      });
    }
    throw new Error(
      `[getOVMRewardEscrowV2EscrowedBalance] Failed to respond: ${e.message}`,
    );
  }
}
