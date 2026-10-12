// pm2 部署配置（服务器上：pm2 start ecosystem.config.cjs && pm2 save）
module.exports = {
  apps: [
    {
      name: 'ironday-server',
      cwd: __dirname,
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
