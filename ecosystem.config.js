module.exports = [
  {
    script: 'index.js',
    name: 'snx-api',
    exec_mode: 'cluster',
    instances: 'max',
    kill_timeout: 3000,
    wait_ready: true,
    listen_timeout: 5000,
    env: { NODE_ENV: 'production', production: true },
  },
];
