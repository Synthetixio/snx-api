// info: this is just a placeholder for swagger docs
// this path is being intercepted and proxied somewhere else:
// https://github.com/kaleb-keny/synthetix_debt_pool_composition/blob/main/endpoint/index.js

/**
 * @openapi
 * /debt-pool-comp:
 *  get:
 *     parameters:
 *     - in: query
 *       name: key
 *       required: false
 *       schema:
 *         type: string
 *         enum: [sAAVE, sADA, sAPE, sAUD, sAVAX, sBNB, sBTC, sCHF, sDOGE, sDOT, sDYDX, sDebtRatio, sETH, sETHBTC, sEUR, sGBP, sINR, sJPY, sKRW, sLINK, sMATIC, sOP, sSOL, sUNI, sUSD, sXAG, sXAU, sXMR]
 *       description: (optional) The asset name for which return data for.
 *     - in: query
 *       name: net
 *       required: false
 *       schema:
 *         type: string
 *         enum: [mainnet, optimism]
 *       description: (optional) The asset name for which return data for.
 *     tags:
 *     - staking
 *     description: Returns outstanding composition of Synthetix debt pool. If `key` query parameter is not provided it returns an array of objects (all assets). If `key` query parameter is provided it returns an object (with requested asset). If `net` query parameter is not provided it returns combined data for both networks. If `net` query parameter is provided it returns data for requested network.
 *     responses:
 *       200:
 *        description: Successful response.
 *        content:
 *          application/json:
 *            schema:
 *              oneOf:
 *                - type: array
 *                  items:
 *                    type: object
 *                    properties:
 *                      currencyKey:
 *                        type: string
 *                        example: "sETH"
 *                      supply:
 *                        type: number
 *                        example: "25753.424162863263"
 *                      cap:
 *                        type: number
 *                        example: "31454739.51287476"
 *                      loans_ccy:
 *                        type: number
 *                        example: "2954.629312098541"
 *                      shorts_ccy:
 *                        type: number
 *                        example: "614.1142234519882"
 *                      wrappers_ccy:
 *                        type: number
 *                        example: "12328.443894605662"
 *                      futures_skew_ccy:
 *                        type: number
 *                        example: "-47.47796708610887"
 *                      futures_debt_usd:
 *                        type: number
 *                        example: "942036.5619142533"
 *                      perps_skew_ccy:
 *                        type: number
 *                        example: "351.6988574973502"
 *                      perps_debt_usd:
 *                        type: number
 *                        example: "26715.23431427603"
 *                      eth_wrapper_ccy_legacy:
 *                        type: number
 *                        example: "0"
 *                      debt_in_usd:
 *                        type: number
 *                        example: "13007251.112776328"
 *                      position_in_usd:
 *                        type: number
 *                        example: "12410007.783500198"
 *                      position_in_ccy:
 *                        type: number
 *                        example: "10160.457623118315"
 *                      price:
 *                        type: number
 *                        example: "1221.18"
 *                      debt_in_percent:
 *                        type: number
 *                        example: "10.37"
 *                      user_debt_hedge_in_usd:
 *                        type: number
 *                        example: "14.27"
 *                      position_type:
 *                        type: string
 *                        example: "long"
 *                      user_debt_hedge_with_correlation_in_usd:
 *                        type: number
 *                        example: "23.518795444167843"
 *                      timestamp:
 *                        type: number
 *                        example: "1671833711"
 *                - type: object
 *                  properties:
 *                    currencyKey:
 *                      type: string
 *                      example: "sETH"
 *                    supply:
 *                      type: number
 *                      example: "25753.424162863263"
 *                    cap:
 *                      type: number
 *                      example: "31454739.51287476"
 *                    loans_ccy:
 *                      type: number
 *                      example: "2954.629312098541"
 *                    shorts_ccy:
 *                      type: number
 *                      example: "614.1142234519882"
 *                    wrappers_ccy:
 *                      type: number
 *                      example: "12328.443894605662"
 *                    futures_skew_ccy:
 *                      type: number
 *                      example: "-47.47796708610887"
 *                    futures_debt_usd:
 *                      type: number
 *                      example: "942036.5619142533"
 *                    perps_skew_ccy:
 *                      type: number
 *                      example: "351.6988574973502"
 *                    perps_debt_usd:
 *                      type: number
 *                      example: "26715.23431427603"
 *                    eth_wrapper_ccy_legacy:
 *                      type: number
 *                      example: "0"
 *                    debt_in_usd:
 *                      type: number
 *                      example: "13007251.112776328"
 *                    position_in_usd:
 *                      type: number
 *                      example: "12410007.783500198"
 *                    position_in_ccy:
 *                      type: number
 *                      example: "10160.457623118315"
 *                    price:
 *                      type: number
 *                      example: "1221.18"
 *                    debt_in_percent:
 *                      type: number
 *                      example: "10.37"
 *                    user_debt_hedge_in_usd:
 *                      type: number
 *                      example: "14.27"
 *                    position_type:
 *                      type: string
 *                      example: "long"
 *                    user_debt_hedge_with_correlation_in_usd:
 *                      type: number
 *                      example: "23.518795444167843"
 *                    timestamp:
 *                      type: number
 *                      example: "1671833711"
 *       401:
 *        description: Unauthorized.
 *       403:
 *        description: You have been banned by WAF.
 *       429:
 *        description: Too many requests, you're being rate-limited.
 *       5XX:
 *        description: Service unavailable.
 *       default:
 *        description: Unexpected error.
 */
