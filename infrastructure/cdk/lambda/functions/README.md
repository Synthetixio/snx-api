# Lambda Functions for SNX API

This directory contains all the Lambda functions for the SNX API. Each function is organized according to its route structure.

## Function Structure

Each Lambda function follows a consistent structure:

```
infrastructure/cdk/lambda/functions/{path}/
  ├── index.js     # Lambda handler and business logic
  └── package.json # Function metadata
```

## How to Create a New Lambda Function

### 1. Create the directory structure

Create a new directory structure that matches the API route path. For example, if you're creating a function for `/v3/arbitrum/new-endpoint`, create:

```
mkdir -p infrastructure/cdk/lambda/functions/v3/arbitrum/new-endpoint
```

### 2. Create the Lambda handler file (index.js)

Create an `index.js` file with the Lambda handler. Use one of the following templates:

#### For blockchain-related functions:

```javascript
const {
  log,
  formatEtherBn,
  snxContractInterface,
  getBackupProvider,
  getCache,
  setCache,
} = require('/opt/nodejs/utils');

const cacheKey = 'your-cache-key';

exports.handler = async (event) => {
  try {
    // Check cache first
    const cachedValue = await getCache(cacheKey);
    if (cachedValue) {
      log.info('Returning cached value');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: cachedValue,
      };
    }

    // Implement your blockchain query logic here
    // const provider = getBackupProvider('network-name');

    const result = {
      // Your response data
    };

    // Cache the result
    await setCache(cacheKey, JSON.stringify(result));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    };
  } catch (error) {
    log.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
```

#### For database-related functions:

```javascript
const { log, getCache, setCache, queryDatabase } = require('/opt/nodejs/utils');

const cacheKey = 'your-cache-key';

exports.handler = async (event) => {
  try {
    // Check cache first
    const cachedValue = await getCache(cacheKey);
    if (cachedValue) {
      log.info('Returning cached value');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: cachedValue,
      };
    }

    // Query database
    const query = `SELECT * FROM your_table WHERE condition = $1`;
    const params = ['parameter-value'];
    const queryResult = await queryDatabase(query, params);

    const result = {
      data: queryResult.rows,
    };

    // Cache the result
    await setCache(cacheKey, JSON.stringify(result));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    };
  } catch (error) {
    log.error('Error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
```

### 3. Update the CDK stack

Add your new Lambda function to the CDK stack in `infrastructure/cdk/lib/snx-api-stack.ts`:

```typescript
createLambdaFunction(
  'YourNewEndpointLambda',
  'path/to/your/endpoint',
  parentResource,
  'infrastructure/cdk/lambda/functions/path/to/your/endpoint',
);
```

### 4. Create the directory and deploy

Create the directory structure and deploy:

```bash
mkdir -p infrastructure/cdk/lambda/functions/path/to/your/endpoint
# Create your Lambda function files
npm run deploy
```

## Utils Layer

The common utilities layer (`/opt/nodejs/utils`) provides the following functions:

- `log`: Winston logger
- `getCache`: Get data from DynamoDB cache
- `setCache`: Set data in DynamoDB cache with TTL
- `pgQuery`: Execute PostgreSQL queries on Aurora
- `snxContractInterface`: Access Synthetix contract interfaces
- `formatEther`, `bigNumber`, `formatEtherBn`: Ethereum value formatting utilities
- `getBackupProvider`: Get backup Ethereum provider
- `getBalanceForContract`: Get token balance for a contract address
- `getBalanceForContract`: Get token balance for a contract address
