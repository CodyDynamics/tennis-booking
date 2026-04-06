/**
 * PM2 process file for the Nest API (production).
 * Run from repo root after `pnpm run build`:
 *   pm2 startOrReload ecosystem.config.js
 *
 * Use fork + 1 instance (not cluster): shared DB pools, JWT, and Socket.IO
 * expect a single Node process unless you add a cluster adapter.
 */
module.exports = {
  apps: [
    {
      name: "tennis-api",
      script: "dist/apps/api/src/main.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
