// info: this is just a placeholder for swagger docs
// this path is being intercepted and proxied somewhere else:
// https://github.com/kaleb-keny/staking_ratio_grants_council/blob/main/endpoint/index.js

/**
 * @openapi
 * /staking-ratio:
 *  get:
 *     tags:
 *     - staking
 *     description: Returns SNX staking ratio between L1 and L2.
 *     responses:
 *       200:
 *        description: Successful response.
 *        content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                systemStakingPercent:
 *                  type: number
 *                  example: "0.7136614182989093"
 *                timestamp:
 *                  type: number
 *                  example: "1671822729"
 *                stakedSnx:
 *                  type: object
 *                  properties:
 *                    ethereum:
 *                      type: number
 *                      example: "143369770.98409882"
 *                    optimism:
 *                      type: number
 *                      example: "77990791.09047478"
 *       401:
 *        description: Unauthorized.
 *       429:
 *        description: Too many requests, you're being rate-limited.
 *       5XX:
 *        description: Service unavailable.
 *       default:
 *        description: Unexpected error.
 */
