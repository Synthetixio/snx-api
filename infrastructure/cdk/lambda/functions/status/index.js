const { log } = require('/opt/nodejs/utils');

exports.handler = async (event, context) => {
  try {
    log.debug('Received request for status endpoint');

    // Get the current status of the application
    const responseData = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'production',
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control':
          'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
      body: JSON.stringify(responseData),
    };
  } catch (error) {
    log.error(`[status] Error: ${error.message}`);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
