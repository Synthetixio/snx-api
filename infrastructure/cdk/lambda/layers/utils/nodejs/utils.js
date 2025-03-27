const winston = require('winston');
const BigNumber = require('bignumber.js');
const { ethers } = require('ethers');
const { synthetix } = require('@synthetixio/contracts-interface');
const { formatEther } = synthetix({ network: 'mainnet' }).utils;
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
} = require('@aws-sdk/lib-dynamodb');
const {
  RDSDataClient,
  ExecuteStatementCommand,
} = require('@aws-sdk/client-rds-data');
const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require('@aws-sdk/client-secrets-manager');

// Initialize DynamoDB client (replacing Redis)
const dynamoClient = new DynamoDBClient();
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Initialize Secrets Manager client
const secretsClient = new SecretsManagerClient();

// Initialize RDS Data client (for Aurora Serverless v2)
const rdsClient = new RDSDataClient();

// Configure Winston for Lambda
const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.splat(),
      winston.format.colorize(),
      winston.format.timestamp(),
      winston.format.printf(({ level, message, timestamp }) => {
        return `${timestamp} ${level}: ${message}`;
      }),
    ),
  }),
];

const log = winston.createLogger({
  level: process.env.DEBUG ? 'debug' : 'error',
  transports,
});

// Ethereum providers
let mainProvider;
let mainOVMProvider;

const initProviders = () => {
  if (!mainProvider) {
    mainProvider = new ethers.providers.StaticJsonRpcProvider({
      url: process.env.MAIN_PROVIDER_URL,
      user: process.env.MAIN_PROVIDER_USER,
      password: process.env.MAIN_PROVIDER_PASSWORD,
    });
  }

  if (!mainOVMProvider) {
    mainOVMProvider = new ethers.providers.StaticJsonRpcProvider({
      url: process.env.MAIN_OVM_PROVIDER_URL,
      user: process.env.MAIN_OVM_PROVIDER_USER,
      password: process.env.MAIN_OVM_PROVIDER_PASSWORD,
      network: 'optimism',
    });
  }
};

// Function to get database credentials from Secrets Manager
const getDatabaseCredentials = async () => {
  try {
    const secretName = process.env.DATABASE_SECRET_NAME;
    const response = await secretsClient.send(
      new GetSecretValueCommand({
        SecretId: secretName,
      }),
    );
    return JSON.parse(response.SecretString);
  } catch (error) {
    log.error(`Error fetching database credentials: ${error.message}`);
    throw error;
  }
};

// DynamoDB cache functions (replacing Redis)
const getCache = async (key) => {
  try {
    const command = new GetCommand({
      TableName: process.env.DYNAMODB_CACHE_TABLE,
      Key: { key },
    });

    const response = await docClient.send(command);
    if (!response.Item) {
      return null;
    }

    // Check if TTL has expired
    if (
      response.Item.ttl &&
      response.Item.ttl < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return response.Item.value;
  } catch (error) {
    log.error(`[cache] Error fetching cache for ${key}: ${error.message}`);
    return null;
  }
};

const setCache = async (key, value, ttl) => {
  try {
    const expiryTime =
      Math.floor(Date.now() / 1000) + (parseInt(process.env.CACHE_TIME) || ttl);

    const command = new PutCommand({
      TableName: process.env.DYNAMODB_CACHE_TABLE,
      Item: {
        key,
        value,
        ttl: expiryTime,
      },
    });

    await docClient.send(command);
    return true;
  } catch (error) {
    log.error(`[cache] Error setting cache for ${key}: ${error.message}`);
    return false;
  }
};

// PostgreSQL query function (for Aurora)
const pgQuery = async (query, params = []) => {
  try {
    // Get database credentials from Secrets Manager
    const credentials = await getDatabaseCredentials();

    const sqlParams = params.map((param, i) => ({
      name: `param${i + 1}`,
      value: { stringValue: param.toString() },
    }));

    const parameterizedQuery = query.replace(
      /\$(\d+)/g,
      (_, num) => `:param${num}`,
    );

    const command = new ExecuteStatementCommand({
      secretArn: process.env.DATABASE_SECRET_NAME,
      database: process.env.PG_NAME,
      resourceArn: process.env.DATABASE_CLUSTER_ARN,
      sql: parameterizedQuery,
      parameters: sqlParams,
    });

    const result = await rdsClient.send(command);

    // Format the result to match the format from the original pg client
    return {
      rows: result.records.map((record) => {
        const row = {};
        record.forEach((value, index) => {
          const columnName = result.columnMetadata[index].name;
          // Get the correct value from the field (stringValue, longValue, etc.)
          const fieldValue = Object.values(value)[0];
          row[columnName] = fieldValue;
        });
        return row;
      }),
      rowCount: result.records.length,
    };
  } catch (error) {
    log.error(`[postgres] Error executing query: ${error.message}`);
    return undefined;
  }
};

// Blockchain interaction functions
const snxContractInterface = (network, backupProvider) => {
  initProviders();

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
};

const getBackupProvider = (network) => {
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
};

const getBalanceForContract = async (
  tokenAddress,
  contractAddress,
  options = {},
) => {
  initProviders();

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

  const balance = formatEtherBn(await contract.balanceOf(contractAddress));
  log.info(
    `Balance of: ${tokenAddress} for: ${contractAddress} is: ${balance}`,
  );
  return balance;
};

// Helper functions
const bigNumber = (value) => new BigNumber(value);
const formatEtherBn = (value) => bigNumber(formatEther(value));

module.exports = {
  snxContractInterface,
  formatEther,
  bigNumber,
  formatEtherBn,
  getBackupProvider,
  log,
  getCache,
  setCache,
  pgQuery,
  getBalanceForContract,
};
