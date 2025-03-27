#!/bin/bash
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting SNX API Serverless Deployment${NC}"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${YELLOW}AWS CLI is not installed. Please install it first.${NC}"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js is not installed. Please install it first.${NC}"
    exit 1
fi

# Get AWS account ID and region
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
AWS_REGION=$(aws configure get region || echo "us-east-1")

echo -e "${BLUE}Using AWS Account: ${AWS_ACCOUNT_ID} in Region: ${AWS_REGION}${NC}"

# Store the project root directory
PROJECT_ROOT=$(pwd)

# Install dependencies for Lambda layer
echo -e "${BLUE}Installing dependencies for utils layer...${NC}"
mkdir -p lambda/layers/utils/nodejs
cd lambda/layers/utils/nodejs
npm install
cd "${PROJECT_ROOT}"  # Return to project root directory

# Create Lambda functions required directories if they don't exist
echo -e "${BLUE}Creating Lambda function directories...${NC}"

# Create common directories structure
mkdir -p lambda/functions/docs
mkdir -p lambda/functions/status
mkdir -p lambda/functions/health
mkdir -p lambda/functions/total-supply
mkdir -p lambda/functions/circulating-supply
mkdir -p lambda/functions/synthetixescrow/vested-balance
mkdir -p lambda/functions/synthetixbridgeescrow/balance
mkdir -p lambda/functions/rewardescrowv2/escrowed-balance
mkdir -p lambda/functions/rewardescrow/escrowed-balance
mkdir -p lambda/functions/liquidatorrewards/balance
mkdir -p lambda/functions/stats/perps-volume

# Create v3 directories
mkdir -p lambda/functions/v3/tvl
mkdir -p lambda/functions/v3/top-asset
mkdir -p lambda/functions/v3/snax/votes
mkdir -p lambda/functions/v3/snax-testnet/votes

# Create v3/base directories
mkdir -p lambda/functions/v3/base/snx-buyback
mkdir -p lambda/functions/v3/base/sc-pool-apy
mkdir -p lambda/functions/v3/base/sc-pool-apy-history
mkdir -p lambda/functions/v3/base/sc-pool-apy-all
mkdir -p lambda/functions/v3/base/lt-trades
mkdir -p lambda/functions/v3/base/lt-leaderboard
mkdir -p lambda/functions/v3/base/rewards-claimed
mkdir -p lambda/functions/v3/base/issued-debt

# Create v3/optimism directories
mkdir -p lambda/functions/v3/optimism/lt-trades
mkdir -p lambda/functions/v3/optimism/lt-leaderboard

# Create v3/mainnet directories
mkdir -p lambda/functions/v3/mainnet/sc-pool-apy-all
mkdir -p lambda/functions/v3/mainnet/rewards-claimed
mkdir -p lambda/functions/v3/mainnet/issued-debt

# Create v3/arbitrum directories
mkdir -p lambda/functions/v3/arbitrum/sc-pool-apy
mkdir -p lambda/functions/v3/arbitrum/sc-pool-apy-history
mkdir -p lambda/functions/v3/arbitrum/sc-pool-apy-all

# Copy source code from src to Lambda functions directories
echo -e "${BLUE}Copying source code to Lambda functions...${NC}"

# Create basic Lambda function structure for each function
for func_dir in lambda/functions/*/ lambda/functions/*/*/ lambda/functions/*/*/*/; do
    # Create index.js with a basic handler if it doesn't exist
    if [ ! -f "${func_dir}/index.js" ]; then
        echo "exports.handler = async (event) => {
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Function working' })
    };
};" > "${func_dir}/index.js"
    fi
    
    # Create package.json if it doesn't exist
    if [ ! -f "${func_dir}/package.json" ]; then
        echo '{
  "name": "'$(basename "$func_dir")'-lambda",
  "version": "1.0.0",
  "description": "Synthetix API Lambda function",
  "main": "index.js",
  "dependencies": {}
}' > "${func_dir}/package.json"
    fi
done

# Try to copy route handlers from the src directory where possible
if [ -d "src/routes" ]; then
    echo -e "${BLUE}Migrating route handlers to Lambda functions...${NC}"
    bash "${PROJECT_ROOT}/infrastructure/cdk/migrate-routes.sh"
else
    echo -e "${RED}Warning: src/routes directory not found. Cannot migrate route handlers.${NC}"
    # Create placeholder Lambda functions
    bash "migrate-routes.sh"
fi

# CD to CDK directory 
cd "${PROJECT_ROOT}/infrastructure/cdk"
echo -e "${BLUE}Installing CDK dependencies...${NC}"
npm install

# Build the CDK project
echo -e "${BLUE}Building CDK project...${NC}"
npm run build

# Bootstrap the CDK environment
echo -e "${BLUE}Bootstrapping CDK environment...${NC}"
npx cdk bootstrap aws://${AWS_ACCOUNT_ID}/${AWS_REGION}

# Deploy the CDK stack
echo -e "${BLUE}Deploying CDK stack...${NC}"
npx cdk deploy --require-approval never

echo -e "${GREEN}Deployment completed successfully!${NC}" 