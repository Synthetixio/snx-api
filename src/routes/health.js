const express = require('express');
const router = express.Router();

const { log } = require('../utils');
const { getTotalSupply, getOVMTotalSupply } = require('./total-supply');
const {
  getSynthetixEscrowVestedBalance,
  getOVMSynthetixEscrowVestedBalance,
} = require('./SynthetixEscrow/vested-balance');
const {
  getRewardEscrowV2EscrowedBalance,
  getOVMRewardEscrowV2EscrowedBalance,
} = require('./RewardEscrowV2/escrowed-balance');
const {
  getRewardEscrowEscrowedBalance,
} = require('./RewardEscrow/escrowed-balance');

/**
 * @openapi
 * /health:
 *  get:
 *     tags:
 *     - health-check
 *     description: Returns API health status. Protected with basic auth. Only for internal use.
 *     responses:
 *       200:
 *        description: Successful response.
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                status:
 *                  type: string
 *                  example: OK
 *       401:
 *        description: Unauthorized.
 *       444:
 *        description: You have been banned by WAF.
 *       429:
 *        description: Too many requests, you're being rate-limited.
 *       5XX:
 *        description: Service unavailable.
 *       default:
 *        description: Unexpected error.
 */
router.get('/', async (req, res, next) => {
  try {
    log.info('[health] Checking API health..');
    log.info('[health] Checking getTotalSupply..');
    await getTotalSupply();
    log.info('[health] Checking getOVMTotalSupply..');
    await getOVMTotalSupply();
    log.info('[health] Checking getSynthetixEscrowVestedBalance..');
    await getSynthetixEscrowVestedBalance();
    log.info('[health] Checking getOVMSynthetixEscrowVestedBalance..');
    await getOVMSynthetixEscrowVestedBalance();
    log.info('[health] Checking getRewardEscrowV2EscrowedBalance..');
    await getRewardEscrowV2EscrowedBalance();
    log.info('[health] Checking getOVMRewardEscrowV2EscrowedBalance..');
    await getOVMRewardEscrowV2EscrowedBalance();
    log.info('[health] Checking getRewardEscrowEscrowedBalance..');
    await getRewardEscrowEscrowedBalance();
    log.info('[health] HEALTHY!');
    res.json({ status: 'OK' });
  } catch (error) {
    log.error(`[Health] Error: ${error.message}`);
    next(error);
  }
});

module.exports = router;
