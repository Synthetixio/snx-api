const express = require('express');
const router = express.Router();
const { log, pgQuery, getCache, setCache } = require('../../../utils');

const cacheKey = 'snax-votes-mainnet';

setInterval(fetchDataFromPostgres, 300_000);

/**
@openapi
* /v3/snax/votes:
*  get:
*     tags:
*     - v3
*     description: Returns all the votes categorized by councils.
*     responses:
*       200:
*        description: Successful response.
*        content:
*          application/json:
*            schema:
*              type: object
*              properties:
*                spartan:
*                  type: array
*                  items:
*                    type: object
*                    properties:
*                      eventName:
*                        type: string
*                        example: "VoteRecorded"
*                      chainId:
*                        type: number
*                        example: 13001
*                      epochId:
*                        type: number
*                        example: 1
*                      voter:
*                        type: string
*                        example: "0xc3Cf311e04c1f8C74eCF6a795Ae760dc6312F345"
*                      blockTimestamp:
*                        type: number
*                        example: 1231231231
*                      id:
*                        type: string
*                        example: "093890428092342034-dsfb3-000000"
*                      transactionHash:
*                        type: string
*                        example: "0xbb9982fbae46a551f5e503a059251b51fdb2bc5b06c13ca15db8a61785b8d095"
*                      votingPower:
*                        type: string
*                        example: "10"
*                      blockNumber:
*                        type: number
*                        example: 580095
*                      candidates:
*                        type: array
*                        items:
*                          type: string
*                        example: ["0x98591879709e2e3106941C818CBD94eD29475d1f"]
*                      contract:
*                        type: string
*                        example: "0xbc85f11300a8ef619592fd678418ec4ef26fbdfd"
*                ambassador:
*                  type: array
*                  items:
*                    type: object
*                    properties:
*                      eventName:
*                        type: string
*                        example: "VoteRecorded"
*                      chainId:
*                        type: number
*                        example: 13001
*                      epochId:
*                        type: number
*                        example: 1
*                      voter:
*                        type: string
*                        example: "0xc3Cf311e04c1f8C74eCF6a795Ae760dc6312F345"
*                      blockTimestamp:
*                        type: number
*                        example: 1231231231
*                      id:
*                        type: string
*                        example: "093890428092342034-dsfb3-000000"
*                      transactionHash:
*                        type: string
*                        example: "0xbb9982fbae46a551f5e503a059251b51fdb2bc5b06c13ca15db8a61785b8d095"
*                      votingPower:
*                        type: string
*                        example: "10"
*                      blockNumber:
*                        type: number
*                        example: 580095
*                      candidates:
*                        type: array
*                        items:
*                          type: string
*                        example: ["0x98591879709e2e3106941C818CBD94eD29475d1f"]
*                      contract:
*                        type: string
*                        example: "0xbc85f11300a8ef619592fd678418ec4ef26fbdfd"
*                treasury:
*                  type: array
*                  items:
*                    type: object
*                    properties:
*                      eventName:
*                        type: string
*                        example: "VoteRecorded"
*                      chainId:
*                        type: number
*                        example: 13001
*                      epochId:
*                        type: number
*                        example: 1
*                      voter:
*                        type: string
*                        example: "0xc3Cf311e04c1f8C74eCF6a795Ae760dc6312F345"
*                      blockTimestamp:
*                        type: number
*                        example: 1231231231
*                      id:
*                        type: string
*                        example: "093890428092342034-dsfb3-000000"
*                      transactionHash:
*                        type: string
*                        example: "0xbb9982fbae46a551f5e503a059251b51fdb2bc5b06c13ca15db8a61785b8d095"
*                      votingPower:
*                        type: string
*                        example: "10"
*                      blockNumber:
*                        type: number
*                        example: 580095
*                      candidates:
*                        type: array
*                        items:
*                          type: string
*                        example: ["0x98591879709e2e3106941C818CBD94eD29475d1f"]
*                      contract:
*                        type: string
*                        example: "0xbc85f11300a8ef619592fd678418ec4ef26fbdfd"
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
  const queryResultVotesCastedSpartan = await pgQuery(
    `select *
    from prod_raw_snax_mainnet.spartan_vote_recorded_snax_mainnet;`,
  );

  const queryResultVotesWithdrawnSpartan = await pgQuery(
    `select *
    from prod_raw_snax_mainnet.spartan_vote_withdrawn_snax_mainnet;`,
  );

  const queryResultVotesCastedAmbassador = await pgQuery(
    `select *
    from prod_raw_snax_mainnet.ambassador_vote_recorded_snax_mainnet;`,
  );

  const queryResultVotesWithdrawnAmbassador = await pgQuery(
    `select *
    from prod_raw_snax_mainnet.ambassador_vote_withdrawn_snax_mainnet;`,
  );

  const queryResultVotesCastedTreasury = await pgQuery(
    `select *
    from prod_raw_snax_mainnet.treasury_vote_recorded_snax_mainnet;`,
  );

  const queryResultVotesWithdrawnTreasury = await pgQuery(
    `select *
    from prod_raw_snax_mainnet.treasury_vote_withdrawn_snax_mainnet;`,
  );

  const responseData = {
    spartan: queryResultVotesCastedSpartan.rows
      .map(parseAndRenameKeys)
      .concat(queryResultVotesWithdrawnSpartan.rows.map(parseAndRenameKeys)),
    ambassador: queryResultVotesCastedAmbassador.rows
      .map(parseAndRenameKeys)
      .concat(queryResultVotesWithdrawnAmbassador.rows.map(parseAndRenameKeys)),
    treasury: queryResultVotesCastedTreasury.rows
      .map(parseAndRenameKeys)
      .concat(queryResultVotesWithdrawnTreasury.rows.map(parseAndRenameKeys)),
  };

  log.debug('[v3SnaxVote] Setting cache..');
  await setCache(cacheKey, responseData, 300);
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
