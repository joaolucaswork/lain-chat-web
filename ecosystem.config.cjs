// pm2 ecosystem — mantém lain-memory (:3341) + BFF (:3335) no ar.
// Assume os dois repos como vizinhos: ~/Documents/lain-memory e ~/Documents/lain-chat-web.
// Uso: pm2 start ecosystem.config.cjs && pm2 save
// Segredos vêm dos .env de cada repo (nunca commitar).

const path = require('path');
const home = require('os').homedir();
const root = __dirname;
const memoryDir = process.env.LAIN_MEMORY_DIR || path.join(home, 'Documents', 'lain-memory');

module.exports = {
  apps: [
    {
      name: 'lain-memory',
      cwd: memoryDir,
      script: 'bun',
      args: 'run src/server.ts',
      interpreter: 'none',
      env: { PORT: '3341' },
      restart_delay: 3000,
      max_restarts: 20,
      min_uptime: 10000,
    },
    {
      name: 'lain-chat-bff',
      cwd: root,
      script: 'bun',
      args: 'run server/server.ts',
      interpreter: 'none',
      restart_delay: 3000,
      max_restarts: 20,
      min_uptime: 10000,
    },
  ],
};
