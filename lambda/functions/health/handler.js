// Adapted from src/routes/health.js
const { log } = require('/opt/nodejs/utils');

exports.handleRequest = async (event, context) => {
  try {
    // Extract path parameters and query parameters from API Gateway event
    const pathParameters = event.pathParameters || {};
    const queryParameters = event.queryStringParameters || {};

    log.info('Handling request for health');

    // TODO: This is a placeholder. The actual implementation would need to
    // migrate the specific logic from src/routes/health.js

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Success',
        path: 'health',
        params: pathParameters,
        query: queryParameters,
      }),
    };
  } catch (error) {
    log.error(`Error in health handler: ${error}`);
    return {
      statusCode: error.statusCode || 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: error.message || 'Internal Server Error' }),
    };
  }
};
