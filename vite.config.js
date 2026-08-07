import { defineConfig } from 'vite';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

// dev-only helper: POST /__shot with a dataURL body -> writes shots/<name>.png
const shotPlugin = {
  name: 'shot-saver',
  configureServer(server) {
    server.middlewares.use('/__shot', (req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => {
        try {
          const { name, data } = JSON.parse(body);
          const b64 = data.replace(/^data:image\/png;base64,/, '');
          const dir = path.resolve('shots');
          mkdirSync(dir, { recursive: true });
          writeFileSync(path.join(dir, `${name.replace(/[^a-z0-9_-]/gi, '')}.png`), Buffer.from(b64, 'base64'));
          res.end('ok');
        } catch (e) { res.statusCode = 500; res.end(String(e)); }
      });
    });
  },
};

export default defineConfig({
  // Deployed under the showcase path on aaronorelup.com; '/' for local dev.
  base: process.env.GAME_BASE || '/',
  plugins: [shotPlugin],
  server: { port: Number(process.env.PORT) || 5173, strictPort: false },
});
