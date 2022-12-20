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
} = require('../utils');

/**
 * @openapi
 * /total-supply:
 *  get:
 *     tags:
 *     - supply
 *     description: Returns SNX total supply on L1 and L2.
 *     responses:
 *       200:
 *        description: Successful response.
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                totalSupply:
 *                  type: string
 *                  example: "309509422.088773603337882496"
 *                OVMTotalSupply:
 *                  type: string
 *                  example: "89132014.499559654122877079"
 *                contracts:
 *                  type: object
 *                  properties:
 *                    ethereum:
 *                      type: object
 *                      properties:
 *                        totalSupply:
 *                          type: string
 *                          example: "0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F"
 *                    optimism:
 *                      type: object
 *                      properties:
 *                        OVMTotalSupply:
 *                          type: string
 *                          example: "0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4"
 *       429:
 *        description: Too many requests, you're being rate-limited.
 *       5XX:
 *        description: Service unavailable.
 *       default:
 *        description: Unexpected error.
 */
router.get(
  '/',
  async (req, res, next) => await totalSupplyHandler(req, res, next),
);

module.exports = {
  router,
  totalSupplyHandler,
  getTotalSupply,
  getOVMTotalSupply,
};

async function totalSupplyHandler(req, res, next) {
  try {
    const cacheKey = 'total-supply';
    log.debug('Checking cache..');
    const cachedResponse = await getCache(cacheKey);
    if (cachedResponse) {
      log.debug('Cache found');
      res.json(cachedResponse);
    } else {
      log.debug('Cache not found, executing..');
      const { totalSupplyContractAddress, totalSupply } =
        await getTotalSupply();

      const { OVMTotalSupplyContractAddress, OVMTotalSupply } =
        await getOVMTotalSupply();

      const responseData = {
        totalSupply,
        OVMTotalSupply,
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
      await setCache(cacheKey, responseData, 60);

      res.json(responseData);
    }
  } catch (error) {
    log.error(`[totalSupplyHandler] Error: ${error.message}`);
    next(error);
  }
}

async function getTotalSupply(options = {}) {
  try {
    log.debug('Fetching total supply..');
    const totalSupplyContractAddress = snxContractInterface(options.provider)
      .Synthetix.address;
    const totalSupply = formatEtherBn(
      await snxContractInterface(options.provider).Synthetix.totalSupply(),
    );
    log.info(`Total supply is ${totalSupply}`);
    return { totalSupplyContractAddress, totalSupply };
  } catch (e) {
    log.warn(`[getTotalSupply] Error: ${e.message}`);
    if (e.code === 'NETWORK_ERROR' && !options.retried) {
      log.warn('[getTotalSupply] Changing provider and retrying..');
      return await getTotalSupply({
        provider: getBackupProvider('ethereum'),
        retried: true,
      });
    }
    throw new Error(`[getTotalSupply] Failed to respond: ${e.message}`);
  }
}

async function getOVMTotalSupply(options = {}) {
  try {
    log.debug('[ovm] Fetching total supply..');
    const OVMTotalSupplyContractAddress = snxOVMContractInterface(
      options.provider,
    ).Synthetix.address;
    const OVMTotalSupply = formatEtherBn(
      await snxOVMContractInterface(options.provider).Synthetix.totalSupply(),
    );
    log.info(`[ovm] Total supply is ${OVMTotalSupply}`);
    return { OVMTotalSupplyContractAddress, OVMTotalSupply };
  } catch (e) {
    log.warn(`[getOVMTotalSupply] Error: ${e.message}`);
    if (e.code === 'NETWORK_ERROR' && !options.retried) {
      log.warn('[getOVMTotalSupply] Changing provider and retrying..');
      return await getOVMTotalSupply({
        provider: getBackupProvider('optimism'),
        retried: true,
      });
    }
    throw new Error(`[getOVMTotalSupply] Failed to respond: ${e.message}`);
  }
}
