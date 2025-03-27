# SNX API Serverless Migration

This project contains the code for migrating the SNX API from a monolithic Express application to a serverless architecture using AWS Lambda, API Gateway, Aurora PostgreSQL, and DynamoDB.

## Architecture

- **AWS Lambda**: Individual functions for each route group
- **API Gateway**: Routes HTTP requests to Lambda functions
- **Aurora PostgreSQL**: Replaces the existing PostgreSQL database
- **DynamoDB**: Replaces Redis for caching
- **AWS CDK**: Infrastructure as code

## Directory Structure

```
├── infrastructure/
│   ├── cdk/                  # CDK code for infrastructure
│   │   ├── bin/              # CDK app entry point
│   │   ├── lib/              # CDK stack definition
│   │   └── package.json      # CDK dependencies
│   └── deploy.sh             # Deployment script
└── lambda/
    ├── functions/            # Lambda function code
    │   ├── health/           # Health endpoint
    │   ├── total-supply/     # Total supply endpoint
    │   └── v3/               # V3 endpoints
    │       ├── tvl/          # TVL endpoint
    │       ├── base/         # Base chain endpoints
    │       └── ...
    └── layers/
        └── utils/            # Common utilities layer
            └── nodejs/       # Node.js code for the layer
```

## Migration Steps

1. **Set up AWS infrastructure**:

   - Create VPC, subnets, and security groups
   - Set up Aurora PostgreSQL cluster
   - Create DynamoDB table for caching
   - Configure API Gateway

2. **Create Lambda functions**:

   - Migrate route handlers to Lambda functions
   - Use Lambda layers for common utilities
   - Adapt database and caching logic

3. **Deploy**:

   - Run the deployment script: `./infrastructure/deploy.sh`

4. **Data Migration**:
   - Migrate data from existing PostgreSQL to Aurora
   - Cache will be rebuilt automatically

## Key Changes

- **Redis → DynamoDB**: Replaced Redis caching with DynamoDB
- **Express → API Gateway**: Routing is now handled by API Gateway
- **PostgreSQL → Aurora**: Using Aurora PostgreSQL for better scalability
- **Monolith → Microservices**: Each route group is now an independent Lambda function

## Deployment

```bash
# Make the deployment script executable
chmod +x infrastructure/deploy.sh

# Run the deployment
./infrastructure/deploy.sh
```

## Manual Testing

After deployment, you can test the API endpoints:

```bash
# Test the TVL endpoint
curl https://<api-gateway-id>.execute-api.<region>.amazonaws.com/prod/v3/tvl
```

## Monitoring and Logging

- CloudWatch Logs for Lambda function logs
- CloudWatch Metrics for monitoring
- X-Ray for tracing

## Future Improvements

- Implement CI/CD pipeline
- Add automated tests
- Improve error handling and monitoring
- Consider AppSync for GraphQL API
