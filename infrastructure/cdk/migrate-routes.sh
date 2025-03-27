#!/bin/bash

# Create utils layer
mkdir -p lambda/layers/utils/nodejs/utils

# Create a minimal utils module since src/utils is missing
cat > lambda/layers/utils/nodejs/utils/index.js << 'EOF'
// Minimal utils layer
const winston = require('winston');

const log = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Mock Redis client that can be used by Lambda functions
const redisClient = {
  get: async (key) => null,
  set: async (key, value, options) => 'OK',
  quit: async () => true
};

// Mock Postgres pool that can be used by Lambda functions
const postgresPool = {
  query: async (text, params) => ({ rows: [] }),
  end: async () => {}
};

module.exports = {
  log,
  redisClient,
  postgresPool
};
EOF

# Create package.json for utils layer
cat > lambda/layers/utils/nodejs/package.json << 'EOF'
{
  "name": "utils-layer",
  "version": "1.0.0",
  "description": "Utilities for SNX API Lambda functions",
  "main": "index.js",
  "dependencies": {
    "winston": "^3.3.3"
  }
}
EOF

# Function to create Lambda handler from route file
create_lambda_handler() {
  local src_file=$1
  local dest_dir=$2
  local handler_name=$(basename "$dest_dir")
  
  mkdir -p "$dest_dir"
  
  # Create index.js
  cat > "$dest_dir/index.js" << EOF
exports.handler = async (event, context) => {
  try {
    // Import handler logic
    const handler = require('./handler');
    return await handler.handleRequest(event, context);
  } catch (error) {
    console.error('Error in lambda handler:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' })
    };
  }
};
EOF

  # Create handler.js with route logic
  cat > "$dest_dir/handler.js" << EOF
// Adapted from ${src_file}
const { log } = require('/opt/nodejs/utils');

exports.handleRequest = async (event, context) => {
  try {
    // Extract path parameters and query parameters from API Gateway event
    const pathParameters = event.pathParameters || {};
    const queryParameters = event.queryStringParameters || {};
    
    log.info(\`Handling request for ${handler_name}\`);
    
    // TODO: This is a placeholder. The actual implementation would need to
    // migrate the specific logic from ${src_file}
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        message: 'Success', 
        path: '${handler_name}',
        params: pathParameters,
        query: queryParameters
      })
    };
  } catch (error) {
    log.error(\`Error in ${handler_name} handler: \${error}\`);
    return {
      statusCode: error.statusCode || 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ error: error.message || 'Internal Server Error' })
    };
  }
};
EOF

  # Create package.json
  cat > "$dest_dir/package.json" << EOF
{
  "name": "${handler_name}-lambda",
  "version": "1.0.0",
  "description": "Lambda function for ${handler_name}",
  "main": "index.js",
  "dependencies": {}
}
EOF
}

# Create a docs Lambda function
mkdir -p lambda/functions/docs
cat > lambda/functions/docs/index.js << 'EOF'
exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html'
    },
    body: `
      <!DOCTYPE html>
      <html>
        <head>
          <title>SNX API Documentation</title>
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui.css">
        </head>
        <body>
          <div id="swagger-ui"></div>
          <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui-bundle.js"></script>
          <script>
            window.onload = function() {
              SwaggerUIBundle({
                url: "https://raw.githubusercontent.com/Synthetixio/snx-api/main/swagger.json",
                dom_id: '#swagger-ui',
                presets: [
                  SwaggerUIBundle.presets.apis,
                  SwaggerUIBundle.SwaggerUIStandalonePreset
                ],
                layout: "BaseLayout"
              });
            }
          </script>
        </body>
      </html>
    `
  };
};
EOF

cat > lambda/functions/docs/package.json << 'EOF'
{
  "name": "docs-lambda",
  "version": "1.0.0",
  "description": "Lambda function for API documentation",
  "main": "index.js",
  "dependencies": {}
}
EOF

# Status route
create_lambda_handler "src/routes/status.js" "lambda/functions/status"

# Health route
create_lambda_handler "src/routes/health.js" "lambda/functions/health"

# Total Supply route
create_lambda_handler "src/routes/total-supply.js" "lambda/functions/total-supply"

# Circulating Supply route
create_lambda_handler "src/routes/circulating-supply.js" "lambda/functions/circulating-supply"

# SynthetixEscrow routes
create_lambda_handler "src/routes/SynthetixEscrow/vested-balance.js" "lambda/functions/synthetixescrow/vested-balance"

# RewardEscrowV2 routes
create_lambda_handler "src/routes/RewardEscrowV2/escrowed-balance.js" "lambda/functions/rewardescrowv2/escrowed-balance"

# RewardEscrow routes
create_lambda_handler "src/routes/RewardEscrow/escrowed-balance.js" "lambda/functions/rewardescrow/escrowed-balance"

# LiquidatorRewards routes
create_lambda_handler "src/routes/LiquidatorRewards/balance.js" "lambda/functions/liquidatorrewards/balance"

# SynthetixBridgeEscrow routes
create_lambda_handler "src/routes/SynthetixBridgeEscrow/balance.js" "lambda/functions/synthetixbridgeescrow/balance"

# V3 Base routes
create_lambda_handler "src/routes/v3/base/sc-pool-apy.js" "lambda/functions/v3/base/sc-pool-apy"
create_lambda_handler "src/routes/v3/base/sc-pool-apy-history.js" "lambda/functions/v3/base/sc-pool-apy-history"
create_lambda_handler "src/routes/v3/base/sc-pool-apy-all.js" "lambda/functions/v3/base/sc-pool-apy-all"
create_lambda_handler "src/routes/v3/base/lt-trades.js" "lambda/functions/v3/base/lt-trades"

# Special case for lt-leaderboard as it uses sc-pool-apy-all.js
create_lambda_handler "src/routes/v3/base/sc-pool-apy-all.js" "lambda/functions/v3/base/lt-leaderboard"

create_lambda_handler "src/routes/v3/base/rewards-claimed.js" "lambda/functions/v3/base/rewards-claimed"
create_lambda_handler "src/routes/v3/base/issued-debt.js" "lambda/functions/v3/base/issued-debt"

# V3 Arbitrum routes
create_lambda_handler "src/routes/v3/arbitrum/sc-pool-apy.js" "lambda/functions/v3/arbitrum/sc-pool-apy"
create_lambda_handler "src/routes/v3/arbitrum/sc-pool-apy-history.js" "lambda/functions/v3/arbitrum/sc-pool-apy-history"
create_lambda_handler "src/routes/v3/arbitrum/sc-pool-apy-all.js" "lambda/functions/v3/arbitrum/sc-pool-apy-all"

# V3 Mainnet routes
create_lambda_handler "src/routes/v3/mainnet/sc-pool-apy-all.js" "lambda/functions/v3/mainnet/sc-pool-apy-all"
create_lambda_handler "src/routes/v3/mainnet/rewards-claimed.js" "lambda/functions/v3/mainnet/rewards-claimed"
create_lambda_handler "src/routes/v3/mainnet/issued-debt.js" "lambda/functions/v3/mainnet/issued-debt"

# V3 Optimism routes
create_lambda_handler "src/routes/v3/optimism/lt-leaderboard.js" "lambda/functions/v3/optimism/lt-leaderboard"
create_lambda_handler "src/routes/v3/optimism/lt-trades.js" "lambda/functions/v3/optimism/lt-trades"

# V3 TVL & Top Asset routes
create_lambda_handler "src/routes/v3/tvl.js" "lambda/functions/v3/tvl"
create_lambda_handler "src/routes/v3/top-asset.js" "lambda/functions/v3/top-asset"
create_lambda_handler "src/routes/v3/tvl420.js" "lambda/functions/v3/tvl420"

# Stats routes
create_lambda_handler "src/routes/stats/perps-volume.js" "lambda/functions/stats/perps-volume"

# Empty handler for snx-buyback (returns empty array)
mkdir -p "lambda/functions/v3/base/snx-buyback"
cat > "lambda/functions/v3/base/snx-buyback/index.js" << 'EOF'
exports.handler = async (event, context) => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify([])
  };
};
EOF

cat > "lambda/functions/v3/base/snx-buyback/package.json" << 'EOF'
{
  "name": "snx-buyback-lambda",
  "version": "1.0.0",
  "description": "Lambda function for SNX buyback",
  "main": "index.js",
  "dependencies": {}
}
EOF

# V3 SNAX routes
mkdir -p "lambda/functions/v3/snax/votes"
mkdir -p "lambda/functions/v3/snax-testnet/votes"

create_lambda_handler "src/routes/v3/snax/votes.js" "lambda/functions/v3/snax/votes"
create_lambda_handler "src/routes/v3/snax-testnet/votes.js" "lambda/functions/v3/snax-testnet/votes"

echo "Migration complete!" 