const express = require('express');
const router = express.Router();

const { log } = require('../utils');

/**
 * @openapi
 * /status:
 *  get:
 *     tags:
 *     - health-check
 *     description: Returns API status.
 *     responses:
 *       200:
 *        description: Successful response.
 *        content:
 *          text/plain:
 *            schema:
 *              type: string
 *              example: OK
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
    log.info('[status] Checking API status..');
    res.send('OK');
  } catch (error) {
    log.error(`[status] Error: ${error.message}`);
    next(error);
  }
});

module.exports = router;
