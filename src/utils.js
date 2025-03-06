const winston = require('winston');
const BigNumber = require('bignumber.js');
const { ethers } = require('ethers');
const { synthetix } = require('@synthetixio/contracts-interface');
const { formatEther } = synthetix({ network: 'mainnet' }).utils;

const redis = require('redis');
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
  },
  password: process.env.REDIS_PASSWORD,
});
redisClient.connect();

const postgres = require('pg').Pool;
const postgresPool = new postgres({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_NAME,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.splat(),
      winston.format.colorize(),
      winston.format.timestamp(),
      winston.format.printf(({ level, message, timestamp }) => {
        if (process.env.NODE_APP_INSTANCE) {
          return `${timestamp} [cluster: ${process.env.NODE_APP_INSTANCE}] ${level}: ${message}`;
        } else {
          return `${timestamp} ${level}: ${message}`;
        }
      }),
    ),
  }),
];

const log = winston.createLogger({
  level: process.env.DEBUG ? 'debug' : 'error',
  transports,
});

const mainProvider = new ethers.providers.StaticJsonRpcProvider({
  url: process.env.MAIN_PROVIDER_URL,
  user: process.env.MAIN_PROVIDER_USER,
  password: process.env.MAIN_PROVIDER_PASSWORD,
});

const mainOVMProvider = new ethers.providers.StaticJsonRpcProvider({
  url: process.env.MAIN_OVM_PROVIDER_URL,
  user: process.env.MAIN_OVM_PROVIDER_USER,
  password: process.env.MAIN_OVM_PROVIDER_PASSWORD,
  network: 'optimism',
});

module.exports = {
  snxContractInterface: (network, backupProvider) => {
    const provider = backupProvider
      ? backupProvider
      : network === 'mainnet'
      ? mainProvider
      : mainOVMProvider;

    const snxjs = synthetix({
      network,
      provider,
    });
    return snxjs.contracts;
  },
  formatEther: (value) => formatEther(value),
  bigNumber: (value) => new BigNumber(value),
  formatEtherBn: (value) =>
    module.exports.bigNumber(module.exports.formatEther(value)),
  getBackupProvider: (network) => {
    if (network === 'mainnet-ovm') {
      return new ethers.providers.StaticJsonRpcProvider({
        url: process.env.BACKUP_OVM_PROVIDER_URL,
        user: process.env.BACKUP_OVM_PROVIDER_USER,
        password: process.env.BACKUP_OVM_PROVIDER_PASSWORD,
        network: 'optimism',
      });
    } else if (network === 'mainnet') {
      return new ethers.providers.StaticJsonRpcProvider({
        url: process.env.BACKUP_PROVIDER_URL,
        user: process.env.BACKUP_PROVIDER_USER,
        password: process.env.BACKUP_PROVIDER_PASSWORD,
      });
    }
  },
  log,
  redisClient,

  postgresPool,

  pgQuery: async (query, params) => {
    const postgresClient = await postgresPool.connect();
    log.debug(`Executing query: ${query}, params: ${params}`);
    const result = await postgresClient.query(query, params).catch((e) => {
      console.error(e);
      return undefined;
    });
    postgresClient.release();
    return result;
  },

  getCache: async (key) => {
    try {
      const cacheValue = JSON.parse(await redisClient.get(key));
      return cacheValue;
    } catch (error) {
      throw new Error(
        `[cache] There was an issue with fetching the cache for ${key}: ${error.message}`,
      );
    }
  },
  setCache: async (key, value, ttl) => {
    try {
      process.env.CACHE_TIME =
        typeof process.env.CACHE_TIME === 'string'
          ? parseInt(process.env.CACHE_TIME)
          : process.env.CACHE_TIME;

      const cacheSet = await redisClient.set(key, JSON.stringify(value), {
        EX: process.env.CACHE_TIME || ttl,
        NX: false,
      });
      return cacheSet;
    } catch (error) {
      throw new Error(
        `[cache] There was an issue with setting the cache for ${key}: ${error.message}`,
      );
    }
  },
  getBalanceForContract: async (
    tokenAddress,
    contractAddress,
    options = {},
  ) => {
    const balanceOfABI = [
      {
        constant: true,
        inputs: [
          {
            name: '_owner',
            type: 'address',
          },
        ],
        name: 'balanceOf',
        outputs: [
          {
            name: 'balance',
            type: 'uint256',
          },
        ],
        payable: false,
        type: 'function',
      },
    ];
    const provider = options.backupProvider
      ? options.backupProvider
      : options.network === 'mainnet'
      ? mainProvider
      : mainOVMProvider;
    const contract = new ethers.Contract(tokenAddress, balanceOfABI, provider);
    log.debug(
      `Fetching balance of: ${tokenAddress} for contract: ${contractAddress}`,
    );
    const balance = module.exports.formatEtherBn(
      await contract.balanceOf(contractAddress),
    );
    log.info(
      `Balance of: ${tokenAddress} for: ${contractAddress} is: ${balance}`,
    );
    return balance;
  },
};
