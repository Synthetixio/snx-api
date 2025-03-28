exports.handler = async (event, context) => {
  try {
    // Import handler logic
    const handler = require('./handler');
    return await handler.handleRequest(event, context);
  } catch (error) {
    console.error('Error in lambda handler:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
