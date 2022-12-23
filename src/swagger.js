const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const packageJson = require('../package.json');

let servers = [{ url: 'https://api.synthetix.io', description: 'Production' }];

if (process.env.NODE_ENV !== 'production') {
  servers.push({ url: 'http://127.0.0.1:3001', description: 'Local' });
}

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Synthetix API',
      description: 'Synthetix API documentation',
      version: packageJson.version,
    },
    servers,
  },
  apis: ['./src/routes/*.js', './src/routes/**/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

function swaggerDocs(app) {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.get('/docs.json', (req, res) => {
    res.set({ 'Content-Type': 'application/json' });
    res.send(swaggerSpec);
  });
}

module.exports = swaggerDocs;
