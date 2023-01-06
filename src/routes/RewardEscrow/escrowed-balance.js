const express = require('express');
const router = express.Router();

const {
  log,
  formatEtherBn,
  snxContractInterface,
  getBackupProvider,
  getCache,
  setCache,
} = require('../../utils');

/**
 * @openapi
 * /RewardEscrow/escrowed-balance:
 *  get:
 *     tags:
 *     - escrowed-balance
 *     description: Returns escrowed SNX balance from RewardEscrow contract.
 *     responses:
 *       200:
 *        description: Successful response.
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                rewardEscrowEscrowedBalance:
 *                  type: string
 *                  example: "73763701.242877032135481494"
 *                contracts:
 *                  type: object
 *                  properties:
 *                    ethereum:
 *                      type: object
 *                      properties:
 *                        rewardEscrowEscrowedBalance:
 *                          type: string
 *                          example: "0xb671F2210B1F6621A2607EA63E6B2DC3e2464d1F"
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
    await rewardEscrowEscrowedBalanceHandler(req, res, next),
);

module.exports = {
  router,
  rewardEscrowEscrowedBalanceHandler,
  getRewardEscrowEscrowedBalance,
};

async function rewardEscrowEscrowedBalanceHandler(req, res, next) {
  try {
    const cacheKey = 'rewardEscrow-escrowedBalance';
    log.debug('Checking cache..');
    const cachedResponse = await getCache(cacheKey);
    if (cachedResponse) {
      log.debug('Cache found');
      res.json(cachedResponse);
    } else {
      log.debug('Cache not found, executing..');
      const {
        rewardEscrowEscrowedBalanceContractAddress,
        rewardEscrowEscrowedBalance,
      } = await getRewardEscrowEscrowedBalance();

      const responseData = {
        rewardEscrowEscrowedBalance,
        contracts: {
          ethereum: {
            rewardEscrowEscrowedBalance:
              rewardEscrowEscrowedBalanceContractAddress,
          },
        },
      };
      log.debug('Setting cache..');
      await setCache(cacheKey, responseData, 60);

      res.json(responseData);
    }
  } catch (error) {
    log.error(`[rewardEscrowEscrowedBalanceHandler] Error: ${error.message}`);
    next(error);
  }
}

async function getRewardEscrowEscrowedBalance(options = {}) {
  try {
    log.debug('Fetching RewardEscrow escrowed balance..');
    const rewardEscrowEscrowedBalanceContractAddress = snxContractInterface(
      'mainnet',
      options.provider,
    ).RewardEscrow.address;
    const rewardEscrowEscrowedBalance = formatEtherBn(
      await snxContractInterface(
        'mainnet',
        options.provider,
      ).RewardEscrow.totalEscrowedBalance(),
    );
    log.info(`RewardEscrow escrowed balance is ${rewardEscrowEscrowedBalance}`);
    return {
      rewardEscrowEscrowedBalanceContractAddress,
      rewardEscrowEscrowedBalance,
    };
  } catch (e) {
    log.warn(`[getRewardEscrowEscrowedBalance] Error: ${e.message}`);
    if (e.code === 'NETWORK_ERROR' && !options.retried) {
      log.warn(
        '[getRewardEscrowEscrowedBalance] Changing provider and retrying..',
      );
      return await getRewardEscrowEscrowedBalance({
        provider: getBackupProvider('ethereum'),
        retried: true,
      });
    }
    throw new Error(
      `[getRewardEscrowEscrowedBalance] Failed to respond: ${e.message}`,
    );
  }
}
