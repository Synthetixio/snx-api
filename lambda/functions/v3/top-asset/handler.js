// Adapted from src/routes/v3/top-asset.js
const { log } = require('/opt/nodejs/utils');

exports.handleRequest = async (event, context) => {
  try {
    // Extract path parameters and query parameters from API Gateway event
    const pathParameters = event.pathParameters || {};
    const queryParameters = event.queryStringParameters || {};

    log.info('Handling request for top-asset');

    // TODO: This is a placeholder. The actual implementation would need to
    // migrate the specific logic from src/routes/v3/top-asset.js

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Success',
        path: 'top-asset',
        params: pathParameters,
        query: queryParameters,
      }),
    };
  } catch (error) {
    log.error(`Error in top-asset handler: ${error}`);
    return {
      statusCode: error.statusCode || 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: error.message || 'Internal Server Error' }),
    };
  }
};
