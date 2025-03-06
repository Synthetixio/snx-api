const express = require('express');
const router = express.Router();

const { log, getCache, setCache } = require('../utils');

const { getTotalSupply, getOVMTotalSupply } = require('./total-supply');
const {
  getSynthetixEscrowVestedBalance,
  getOVMSynthetixEscrowVestedBalance,
} = require('./SynthetixEscrow/vested-balance');
const {
  getRewardEscrowEscrowedBalance,
} = require('./RewardEscrow/escrowed-balance');
const {
  getRewardEscrowV2EscrowedBalance,
  getOVMRewardEscrowV2EscrowedBalance,
} = require('./RewardEscrowV2/escrowed-balance');
const { getLiquidatorRewardsBalance } = require('./LiquidatorRewards/balance');
const {
  getSynthetixBridgeEscrowBalance,
} = require('./SynthetixBridgeEscrow/balance');

/**
 * @openapi
 * /circulating-supply:
 *  get:
 *     tags:
 *     - supply
 *     description: Returns combined SNX circulating supply from L1 and L2.
 *     responses:
 *       200:
 *        description: Successful response.
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                circulatingSupply:
 *                  type: string
 *                  example: "141926691.344308997791851826"
 *                totalSupply:
 *                  type: string
 *                  example: "309509422.088773603337882496"
 *                synthetixEscrowVestedBalance:
 *                  type: string
 *                  example: "723907.949250420000000002"
 *                rewardEscrowEscrowedBalance:
 *                  type: string
 *                  example: "73763701.242877032135481494"
 *                rewardEscrowV2EscrowedBalance:
 *                  type: string
 *                  example: "58795426.272404595327975783"
 *                liquidatorRewardsBalance:
 *                  type: string
 *                  example: "2035169.82647455828232327"
 *                synthetixBridgeEscrowBalance:
 *                  type: string
 *                  example: "90615339.513130952531588288"
 *                OVMTotalSupply:
 *                  type: string
 *                  example: "89132014.499559654122877079"
 *                OVMSynthetixEscrowVestedBalance:
 *                  type: string
 *                  example: "0"
 *                OVMRewardEscrowV2EscrowedBalance:
 *                  type: string
 *                  example: "34299695.279932558082573391"
 *                OVMLiquidatorRewardsBalance:
 *                  type: string
 *                  example: "322414.5006437149942302"
 *                contracts:
 *                  type: object
 *                  properties:
 *                    ethereum:
 *                      type: object
 *                      properties:
 *                        totalSupply:
 *                          type: string
 *                          example: "0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F"
 *                        synthetixEscrowVestedBalance:
 *                          type: string
 *                          example: "0x971e78e0C92392A4E39099835cF7E6aB535b2227"
 *                        rewardEscrowEscrowedBalance:
 *                          type: string
 *                          example: "0xb671F2210B1F6621A2607EA63E6B2DC3e2464d1F"
 *                        rewardEscrowV2EscrowedBalance:
 *                          type: string
 *                          example: "0xAc86855865CbF31c8f9FBB68C749AD5Bd72802e3"
 *                        liquidatorRewardsBalance:
 *                          type: string
 *                          example: "0xf79603a71144e415730C1A6f57F366E4Ea962C00"
 *                        synthetixBridgeEscrowBalance:
 *                          type: string
 *                          example: "0x5Fd79D46EBA7F351fe49BFF9E87cdeA6c821eF9f"
 *                    optimism:
 *                      type: object
 *                      properties:
 *                        OVMTotalSupply:
 *                          type: string
 *                          example: "0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4"
 *                        OVMSynthetixEscrowVestedBalance:
 *                          type: string
 *                          example: "0x06C6D063896ac733673c4474E44d9268f2402A55"
 *                        OVMRewardEscrowV2EscrowedBalance:
 *                          type: string
 *                          example: "0x6330D5F08f51057F36F46d6751eCDc0c65Ef7E9e"
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
  async (req, res, next) => await circulatingSupplyHandler(req, res, next),
);

module.exports = {
  router,
  circulatingSupplyHandler,
};

async function circulatingSupplyHandler(req, res, next) {
  try {
    const cacheKey = 'circulating-supply';
    log.debug('Checking cache..');
    const cachedResponse = await getCache(cacheKey);
    if (cachedResponse) {
      log.debug('Cache found');
      res.json(cachedResponse);
    } else {
      log.debug('Cache not found, executing..');

      // mainnet
      const { totalSupplyContractAddress, totalSupply } =
        await getTotalSupply();

      const {
        synthetixEscrowVestedBalanceContractAddress,
        synthetixEscrowVestedBalance,
      } = await getSynthetixEscrowVestedBalance();

      const {
        rewardEscrowEscrowedBalanceContractAddress,
        rewardEscrowEscrowedBalance,
      } = await getRewardEscrowEscrowedBalance();

      const {
        rewardEscrowV2EscrowedBalanceContractAddress,
        rewardEscrowV2EscrowedBalance,
      } = await getRewardEscrowV2EscrowedBalance();

      const liquidatorRewardsBalanceData = await getLiquidatorRewardsBalance(
        'mainnet',
      );

      const synthetixBridgeEscrowBalanceData =
        await getSynthetixBridgeEscrowBalance('mainnet');

      // optimism
      const { OVMTotalSupplyContractAddress, OVMTotalSupply } =
        await getOVMTotalSupply();

      const {
        OVMSynthetixEscrowVestedBalanceContractAddress,
        OVMSynthetixEscrowVestedBalance,
      } = await getOVMSynthetixEscrowVestedBalance();

      const {
        OVMRewardEscrowV2EscrowedBalanceContractAddress,
        OVMRewardEscrowV2EscrowedBalance,
      } = await getOVMRewardEscrowV2EscrowedBalance();

      const OVMLiquidatorRewardsBalanceData = await getLiquidatorRewardsBalance(
        'mainnet-ovm',
      );

      log.debug('Calculating circulating supply..');
      const circulatingSupply = totalSupply
        .plus(OVMTotalSupply)
        .minus(synthetixEscrowVestedBalance)
        .minus(rewardEscrowEscrowedBalance)
        .minus(rewardEscrowV2EscrowedBalance)
        .minus(liquidatorRewardsBalanceData.balance)
        .minus(synthetixBridgeEscrowBalanceData.balance)
        .minus(OVMSynthetixEscrowVestedBalance)
        .minus(OVMRewardEscrowV2EscrowedBalance)
        .minus(OVMLiquidatorRewardsBalanceData.balance);
      log.info(`Circulating supply is ${circulatingSupply}`);

      const responseData = {
        circulatingSupply,
        totalSupply,
        synthetixEscrowVestedBalance,
        rewardEscrowEscrowedBalance,
        rewardEscrowV2EscrowedBalance,
        liquidatorRewardsBalance: liquidatorRewardsBalanceData.balance,
        synthetixBridgeEscrowBalance: synthetixBridgeEscrowBalanceData.balance,
        OVMTotalSupply,
        OVMSynthetixEscrowVestedBalance,
        OVMRewardEscrowV2EscrowedBalance,
        OVMLiquidatorRewardsBalance: OVMLiquidatorRewardsBalanceData.balance,
        contracts: {
          ethereum: {
            totalSupply: totalSupplyContractAddress,
            synthetixEscrowVestedBalance:
              synthetixEscrowVestedBalanceContractAddress,
            rewardEscrowEscrowedBalance:
              rewardEscrowEscrowedBalanceContractAddress,
            rewardEscrowV2EscrowedBalance:
              rewardEscrowV2EscrowedBalanceContractAddress,
            liquidatorRewardsBalance:
              liquidatorRewardsBalanceData.contractAddress,
            synthetixBridgeEscrowBalance:
              synthetixBridgeEscrowBalanceData.contractAddress,
          },
          optimism: {
            OVMTotalSupply: OVMTotalSupplyContractAddress,
            OVMSynthetixEscrowVestedBalance:
              OVMSynthetixEscrowVestedBalanceContractAddress,
            OVMRewardEscrowV2EscrowedBalance:
              OVMRewardEscrowV2EscrowedBalanceContractAddress,
            OVMLiquidatorRewardsBalance:
              OVMLiquidatorRewardsBalanceData.contractAddress,
          },
        },
      };
      log.debug('Setting cache..');
      await setCache(cacheKey, responseData, 300);

      res.json(responseData);
    }
  } catch (error) {
    log.error(`[circulatingSupplyHandler] Error: ${error.message}`);
    next(error);
  }
}
