module.exports = {
  apps: [
    {
      name: 'transitops-api',
      script: './backend/server.js',
      instances: 'max', // Utilize all CPU cores for load balancing
      exec_mode: 'cluster',
      autorestart: true,
      watch: false, // Disable watch in production
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'development'
      },
      env_staging: {
        NODE_ENV: 'staging'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      log_date_format: 'YYYY-MM-DD HH:mm Z',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true
    }
  ]
};
