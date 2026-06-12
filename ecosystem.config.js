// pm2 process config — start with: pm2 start ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "gold-bot",
      script: "index.js",
      autorestart: true,
      max_restarts: 10,
      // Restart if it ever leaks past ~150MB (it normally uses far less).
      max_memory_restart: "150M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
