import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class SnxApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create VPC for Aurora
    const vpc = new ec2.Vpc(this, 'SnxApiVpc', {
      maxAzs: 2,
      natGateways: 1,
    });

    // Create Aurora PostgreSQL cluster
    const dbCluster = new rds.DatabaseCluster(this, 'SnxApiDatabase', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_3,
      }),
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),
      instanceProps: {
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        instanceType: ec2.InstanceType.of(
          ec2.InstanceClass.BURSTABLE3,
          ec2.InstanceSize.MEDIUM,
        ),
      },
      defaultDatabaseName: 'snxapi',
    });

    // Create DynamoDB tables for caching (replacing Redis)
    const cacheTable = new dynamodb.Table(this, 'SnxApiCache', {
      partitionKey: { name: 'key', type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: 'ttl',
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Create Lambda Layer for common utilities
    const utilsLayer = new lambda.LayerVersion(this, 'SnxApiUtilsLayer', {
      code: lambda.Code.fromAsset('lambda/layers/utils', {
        exclude: [
          '.aws-sam',
          '.git',
          '*.test.js',
          '*.spec.js',
          'test',
          'tests',
          'node_modules',
        ],
        ignoreMode: cdk.IgnoreMode.GLOB,
      }),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Common utilities for SNX API functions',
    });

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'SnxApi', {
      restApiName: 'SNX API',
      description: 'Serverless SNX API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // Create Lambda execution role with permissions
    const lambdaRole = new iam.Role(this, 'SnxApiLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    // Grant DynamoDB permissions
    cacheTable.grantReadWriteData(lambdaRole);

    // Create environment variables for all Lambda functions
    const lambdaEnv = {
      DYNAMODB_CACHE_TABLE: cacheTable.tableName,
      PG_HOST: dbCluster.clusterEndpoint.hostname,
      PG_PORT: dbCluster.clusterEndpoint.port.toString(),
      PG_NAME: 'snxapi',
      PG_USER: 'postgres',
      DATABASE_SECRET_NAME: dbCluster.secret?.secretName || '',
      DATABASE_CLUSTER_ARN: dbCluster.clusterIdentifier,
      // Secret values will be injected from AWS Secrets Manager at runtime
      NODE_OPTIONS: '--enable-source-maps',
      CACHE_TIME: '300',
    };

    // Common Lambda configuration
    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      memorySize: 256,
      timeout: cdk.Duration.seconds(30),
      environment: lambdaEnv,
      role: lambdaRole,
      layers: [utilsLayer],
    };

    // Helper function to create a Lambda and API Gateway integration
    const createLambdaFunction = (
      id: string,
      path: string,
      parentResource: apigateway.IResource = api.root,
      folderPath: string = '',
      httpMethods: string[] = ['GET'],
    ) => {
      const pathSegments = path.split('/').filter((segment) => segment);
      let currentResource: apigateway.IResource = parentResource;

      // Create or navigate to nested resources
      for (const segment of pathSegments) {
        try {
          const existingResource = currentResource.getResource(segment);
          currentResource =
            existingResource || currentResource.addResource(segment);
        } catch (error) {
          currentResource = currentResource.addResource(segment);
        }
      }

      // Create Lambda function
      const functionPath =
        folderPath || `lambda/functions/${pathSegments.join('/')}`;
      const lambdaFunction = new lambda.Function(this, id, {
        ...commonLambdaProps,
        code: lambda.Code.fromAsset(functionPath, {
          exclude: [
            '.aws-sam/**',
            '.git/**',
            'node_modules/**',
            '**/*.test.js',
            '**/*.spec.js',
            'test/**',
            'tests/**',
            '.DS_Store',
          ],
          ignoreMode: cdk.IgnoreMode.GLOB,
        }),
        handler: 'index.handler',
      });

      // Add API Gateway integration
      httpMethods.forEach((method) => {
        currentResource.addMethod(
          method,
          new apigateway.LambdaIntegration(lambdaFunction),
        );
      });

      return lambdaFunction;
    };

    // Root route - redirect to /docs/
    const docsIntegration = new apigateway.MockIntegration({
      integrationResponses: [
        {
          statusCode: '302',
          responseParameters: {
            'method.response.header.Location': "'./docs/'",
          },
        },
      ],
      passthroughBehavior: apigateway.PassthroughBehavior.NEVER,
      requestTemplates: {
        'application/json': '{"statusCode": 302}',
      },
    });

    api.root.addMethod('GET', docsIntegration, {
      methodResponses: [
        {
          statusCode: '302',
          responseParameters: {
            'method.response.header.Location': true,
          },
        },
      ],
    });

    // Add docs resource for serving Swagger documentation
    const docsResource = api.root.addResource('docs');
    const docsLambda = new lambda.Function(this, 'DocsLambda', {
      ...commonLambdaProps,
      code: lambda.Code.fromAsset('lambda/functions/docs', {
        exclude: [
          '.aws-sam/**',
          '.git/**',
          'node_modules/**',
          '**/*.test.js',
          '**/*.spec.js',
          'test/**',
          'tests/**',
          '.DS_Store',
        ],
        ignoreMode: cdk.IgnoreMode.GLOB,
      }),
      handler: 'index.handler',
    });
    docsResource.addMethod('GET', new apigateway.LambdaIntegration(docsLambda));

    // Status route
    createLambdaFunction(
      'StatusLambda',
      'status',
      api.root,
      'lambda/functions/status',
    );

    // Health route
    createLambdaFunction(
      'HealthLambda',
      'health',
      api.root,
      'lambda/functions/health',
    );

    // Blockchain-only function routes
    createLambdaFunction(
      'TotalSupplyLambda',
      'total-supply',
      api.root,
      'lambda/functions/total-supply',
    );

    // Circulating Supply route
    createLambdaFunction(
      'CirculatingSupplyLambda',
      'circulating-supply',
      api.root,
      'lambda/functions/circulating-supply',
    );

    createLambdaFunction(
      'VestedBalanceLambda',
      'synthetixescrow/vested-balance',
      api.root,
      'lambda/functions/synthetixescrow/vested-balance',
    );

    createLambdaFunction(
      'SynthetixBridgeEscrowBalanceLambda',
      'synthetixbridgeescrow/balance',
      api.root,
      'lambda/functions/synthetixbridgeescrow/balance',
    );

    createLambdaFunction(
      'RewardEscrowV2EscrowedBalanceLambda',
      'rewardescrowv2/escrowed-balance',
      api.root,
      'lambda/functions/rewardescrowv2/escrowed-balance',
    );

    createLambdaFunction(
      'RewardEscrowEscrowedBalanceLambda',
      'rewardescrow/escrowed-balance',
      api.root,
      'lambda/functions/rewardescrow/escrowed-balance',
    );

    createLambdaFunction(
      'LiquidatorRewardsBalanceLambda',
      'liquidatorrewards/balance',
      api.root,
      'lambda/functions/liquidatorrewards/balance',
    );

    // Database-related routes

    // Stats routes
    const statsResource = api.root.addResource('stats');
    createLambdaFunction(
      'PerpsVolumeLambda',
      'perps-volume',
      statsResource,
      'lambda/functions/stats/perps-volume',
    );

    // V3 routes - create base v3 resource
    const v3Resource = api.root.addResource('v3');

    // TVL
    createLambdaFunction(
      'TvlLambda',
      'tvl',
      v3Resource,
      'lambda/functions/v3/tvl',
    );

    // TVL420
    createLambdaFunction(
      'Tvl420Lambda',
      'tvl420',
      v3Resource,
      'lambda/functions/v3/tvl420',
    );

    // Top asset
    createLambdaFunction(
      'TopAssetLambda',
      'top-asset',
      v3Resource,
      'lambda/functions/v3/top-asset',
    );

    // SNAX routes
    const snaxResource = v3Resource.addResource('snax');
    createLambdaFunction(
      'SnaxVotesLambda',
      'votes',
      snaxResource,
      'lambda/functions/v3/snax/votes',
    );

    const snaxTestnetResource = v3Resource.addResource('snax-testnet');
    createLambdaFunction(
      'SnaxTestnetVotesLambda',
      'votes',
      snaxTestnetResource,
      'lambda/functions/v3/snax-testnet/votes',
    );

    // Optimism routes
    const optimismResource = v3Resource.addResource('optimism');
    createLambdaFunction(
      'OptimismLtTradesLambda',
      'lt-trades',
      optimismResource,
      'lambda/functions/v3/optimism/lt-trades',
    );

    createLambdaFunction(
      'OptimismLtLeaderboardLambda',
      'lt-leaderboard',
      optimismResource,
      'lambda/functions/v3/optimism/lt-leaderboard',
    );

    // Mainnet routes
    const mainnetResource = v3Resource.addResource('mainnet');
    createLambdaFunction(
      'MainnetScPoolApyAllLambda',
      'sc-pool-apy-all',
      mainnetResource,
      'lambda/functions/v3/mainnet/sc-pool-apy-all',
    );

    // Additional Mainnet routes
    createLambdaFunction(
      'MainnetRewardsClaimedLambda',
      'rewards-claimed',
      mainnetResource,
      'lambda/functions/v3/mainnet/rewards-claimed',
    );

    createLambdaFunction(
      'MainnetIssuedDebtLambda',
      'issued-debt',
      mainnetResource,
      'lambda/functions/v3/mainnet/issued-debt',
    );

    // Base routes
    const baseResource = v3Resource.addResource('base');

    createLambdaFunction(
      'BaseSnxBuybackLambda',
      'snx-buyback',
      baseResource,
      'lambda/functions/v3/base/snx-buyback',
    );

    createLambdaFunction(
      'BaseScPoolApyLambda',
      'sc-pool-apy',
      baseResource,
      'lambda/functions/v3/base/sc-pool-apy',
    );

    createLambdaFunction(
      'BaseScPoolApyHistoryLambda',
      'sc-pool-apy-history',
      baseResource,
      'lambda/functions/v3/base/sc-pool-apy-history',
    );

    createLambdaFunction(
      'BaseScPoolApyAllLambda',
      'sc-pool-apy-all',
      baseResource,
      'lambda/functions/v3/base/sc-pool-apy-all',
    );

    createLambdaFunction(
      'BaseLtTradesLambda',
      'lt-trades',
      baseResource,
      'lambda/functions/v3/base/lt-trades',
    );

    createLambdaFunction(
      'BaseLtLeaderboardLambda',
      'lt-leaderboard',
      baseResource,
      'lambda/functions/v3/base/lt-leaderboard',
    );

    // Additional Base routes
    createLambdaFunction(
      'BaseRewardsClaimedLambda',
      'rewards-claimed',
      baseResource,
      'lambda/functions/v3/base/rewards-claimed',
    );

    createLambdaFunction(
      'BaseIssuedDebtLambda',
      'issued-debt',
      baseResource,
      'lambda/functions/v3/base/issued-debt',
    );

    // Arbitrum routes
    const arbitrumResource = v3Resource.addResource('arbitrum');

    createLambdaFunction(
      'ArbitrumScPoolApyLambda',
      'sc-pool-apy',
      arbitrumResource,
      'lambda/functions/v3/arbitrum/sc-pool-apy',
    );

    createLambdaFunction(
      'ArbitrumScPoolApyHistoryLambda',
      'sc-pool-apy-history',
      arbitrumResource,
      'lambda/functions/v3/arbitrum/sc-pool-apy-history',
    );

    createLambdaFunction(
      'ArbitrumScPoolApyAllLambda',
      'sc-pool-apy-all',
      arbitrumResource,
      'lambda/functions/v3/arbitrum/sc-pool-apy-all',
    );

    // Output the API Gateway URL
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'SNX API Gateway URL',
    });
  }
}
