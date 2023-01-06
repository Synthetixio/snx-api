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
 * /LiquidatorRewards/balance:
 *  get:
 *     tags:
 *     - locked-balance
 *     description: Returns locked SNX balance from LiquidatorRewards contract.
 *     responses:
 *       200:
 *        description: Successful response.
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                liquidatorRewardsBalance:
 *                  type: string
 *                  example: "2035169.82647455828232327"
 *                OVMLiquidatorRewardsBalance:
 *                  type: string
 *                  example: "322559.742435986940227453"
 *                contracts:
 *                  type: object
 *                  properties:
 *                    ethereum:
 *                      type: object
 *                      properties:
 *                        liquidatorRewardsBalance:
 *                          type: string
 *                          example: "0xf79603a71144e415730C1A6f57F366E4Ea962C00"
 *                    optimism:
 *                      type: object
 *                      properties:
 *                        OVMLiquidatorRewardsBalance:
 *                          type: string
 *                          example: "0xF4EebDD0704021eF2a6Bbe993fdf93030Cd784b4"
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
    await liquidatorRewardsBalanceHandler(req, res, next),
);

module.exports = {
  router,
  liquidatorRewardsBalanceHandler,
  getLiquidatorRewardsBalance,
};

async function liquidatorRewardsBalanceHandler(req, res, next) {
  try {
    const cacheKey = 'liquidatorRewards-balance';
    log.debug('Checking cache..');
    const cachedResponse = await getCache(cacheKey);
    if (cachedResponse) {
      log.debug('Cache found');
      res.json(cachedResponse);
    } else {
      log.debug('Cache not found, executing..');

      const mainnetData = await getLiquidatorRewardsBalance('mainnet');
      const ovmData = await getLiquidatorRewardsBalance('mainnet-ovm');

      const responseData = {
        liquidatorRewardsBalance: mainnetData.balance,
        OVMLiquidatorRewardsBalance: ovmData.balance,
        contracts: {
          ethereum: {
            liquidatorRewardsBalance: mainnetData.contractAddress,
          },
          optimism: {
            OVMLiquidatorRewardsBalance: ovmData.contractAddress,
          },
        },
      };
      log.debug('Setting cache..');
      await setCache(cacheKey, responseData, 60);

      res.json(responseData);
    }
  } catch (error) {
    log.error(`[liquidatorRewardsBalanceHandler] Error: ${error.message}`);
    next(error);
  }
}

async function getLiquidatorRewardsBalance(network, options = {}) {
  try {
    log.debug(`Fetching LiquidatorRewards balance for ${network}..`);
    const contractAddress = snxContractInterface(network, options.provider)
      .LiquidatorRewards.address;
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
    log.info(`LiquidatorRewards contract balance is ${balance}`);
    return {
      contractAddress,
      SNXTokenAddress,
      balance,
    };
  } catch (e) {
    log.warn(`[getLiquidatorRewardsBalance] Error: ${e.message}`);
    if (e.code === 'NETWORK_ERROR' && !options.retried) {
      log.warn(
        '[getLiquidatorRewardsBalance] Changing provider and retrying..',
      );
      return await getLiquidatorRewardsBalance(network, {
        provider: getBackupProvider(network),
        retried: true,
      });
    }
    throw new Error(
      `[getLiquidatorRewardsBalance] Failed to respond: ${e.message}`,
    );
  }
}
