const express = require('express');
const router = express.Router();
const { log, postgresClient, getCache, setCache } = require('../../../utils');

const cacheKey = 'snax-votes';

fetchDataFromPostgres();
const cacheTime =
  ((process.env.CACHE_TIME =
    typeof process.env.CACHE_TIME === 'string'
      ? parseInt(process.env.CACHE_TIME)
      : process.env.CACHE_TIME) -
    30) *
  1000;
setInterval(fetchDataFromPostgres, cacheTime < 30000 ? 30000 : cacheTime);

/**
 * @openapi
 * /v3/snax-testnet/votes:
 *  get:
 *     tags:
 *     - v3
 *     description: Returns SNX buyback details on Base.
 *     responses:
 *       200:
 *        description: Successful response.
 *        content:
 *          application/json:
 *            schema:
 *              type: array
 *              items:
 *                type: object
 *                properties:
 *                  eventName:
 *                    type: string
 *                    example: "VoteRecorded"
 *                  chainId:
 *                    type: number
 *                    example: "13001"
 *                  epochId:
 *                    type: number
 *                    example: "1"
 *                  voter:
 *                    type: string
 *                    example: "0xc3Cf311e04c1f8C74eCF6a795Ae760dc6312F345"
 *                  blockTimestamp:
 *                    type: number
 *                    example: "1231231231"
 *                  id:
 *                    type: string
 *                    example: "093890428092342034-dsfb3-000000"
 *                  transactionHash:
 *                    type: string
 *                    example: "0xbb9982fbae46a551f5e503a059251b51fdb2bc5b06c13ca15db8a61785b8d095"
 *                  votingPower:
 *                    type: string
 *                    example: "10"
 *                  blockNumber:
 *                    type: number
 *                    example: "580095"
 *                  candidates:
 *                    type: array
 *                    items:
 *                      type: string
 *                    example: ["0x98591879709e2e3106941C818CBD94eD29475d1f"]
 *                  contract:
 *                    type: string
 *                    example: "0xbc85f11300a8ef619592fd678418ec4ef26fbdfd"
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

router.get('/', async (req, res, next) => {
  try {
    log.debug('Checking cache..');
    const cachedResponse = await getCache(cacheKey);
    if (cachedResponse) {
      log.debug('Cache found');
      res.json(cachedResponse);
    } else {
      log.debug('Cache not found, executing..');
      const responseData = await fetchDataFromPostgres();
      res.json(responseData);
    }
  } catch (error) {
    log.error(`[v3SnaxVote] Error: ${error.message}`);
    next(error);
  }
});

module.exports = router;

async function fetchDataFromPostgres() {
  log.debug('[v3SnaxVote] Fetching data from postgres..');
  const queryResultVotesCasted = await postgresClient.query(
    `select *
    from prod_raw_snax_testnet.gov_vote_recorded_snax_testnet;`,
  );

  const queryResultVotesWithdrawn = await postgresClient.query(
    `select *
    from prod_raw_snax_testnet.gov_vote_withdrawn_snax_testnet;`,
  );

  const votesCasted = queryResultVotesCasted.rows.map(parseAndRenameKeys);
  const votesWithdrawn = queryResultVotesWithdrawn.rows.map(parseAndRenameKeys);

  const allVotes = votesCasted
    .concat(votesWithdrawn)
    .sort((a, b) => a.blockNumber - b.blockNumber)
    .reduce((cur, next) => {
      if (cur[next.epochId]) {
        if (next.eventName === 'VoteWithdrawn') {
          const previousVoteIndex = cur[next.epochId].findIndex((vote) => {
            return vote.contract === next.contract && vote.voter === next.voter;
          });
          if (previousVoteIndex !== -1) {
            cur[next.epochId].splice(previousVoteIndex, 1);
          } else {
            console.error(
              'Could not find previous vote',
              cur[next.epochId],
              next,
            );
          }
        } else {
          const previousVoteIndex = cur[next.epochId].findIndex(
            (vote) =>
              vote.contract === next.contract && vote.voter === next.voter,
          );
          if (previousVoteIndex !== -1) {
            cur[next.epochId].splice(previousVoteIndex, 1);
          }
          cur[next.epochId].push(next);
        }
      } else {
        cur[next.epochId] = [next];
      }
      return cur;
    }, {});

  const responseData = allVotes;
  log.debug('[v3SnaxVote] Setting cache..');
  await setCache(cacheKey, responseData, 60);
  return responseData;
}

function toCamelCase(str) {
  return str.replace(/([-_][a-z])/gi, (group) =>
    group.toUpperCase().replace('-', '').replace('_', ''),
  );
}

function parseAndRenameKeys(obj) {
  const newObj = {};
  for (const key in obj) {
    const camelCaseKey = toCamelCase(key);
    if (key === 'block_timestamp') {
      newObj[camelCaseKey] = Date.parse(obj[key]);
    } else if (key === 'epoch_id' || key === 'chain_id') {
      newObj[camelCaseKey] = Number(obj[key]);
    } else {
      newObj[camelCaseKey] = obj[key];
    }
  }
  return newObj;
}
