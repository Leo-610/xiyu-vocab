/** PM2 生产进程配置：pm2 start ecosystem.config.cjs --env production */
module.exports = {
  apps: [{
    name: 'xiyu-api',
    script: 'backend/src/index.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'development',
    },
    env_production: {
      NODE_ENV: 'production',
      ALLOW_DEMO_LOGIN: 'false',
    },
  }],
}
