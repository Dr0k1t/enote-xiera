// Dev server: sirve archivos estáticos + endpoint POST /api/log
// Uso: node server.js  →  http://localhost:3000
// Logs guardados en logs/session-YYYY-MM-DD.log (JSONL)
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT    = 3000;
const LOG_DIR = path.join(__dirname, 'logs');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.jpeg': 'image/jpeg',
  '.jpg':  'image/jpeg',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.md':   'text/plain; charset=utf-8',
};

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

http.createServer((req, res) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS); res.end(); return;
  }

  // POST /api/log — recibe evento JSON, lo escribe en el log diario
  if (req.method === 'POST' && req.url === '/api/log') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const date    = new Date().toISOString().slice(0, 10);
        const logFile = path.join(LOG_DIR, `session-${date}.log`);
        fs.appendFileSync(logFile, body + '\n', 'utf8');
        // Echo a consola para monitoreo en vivo
        const parsed = JSON.parse(body);
        console.log(`[LOG] ${parsed.ts} | ${parsed.type} |`, JSON.stringify(parsed));
      } catch (e) {
        console.error('[LOG] Error al parsear:', e.message);
      }
      res.writeHead(204, CORS); res.end();
    });
    return;
  }

  // GET /api/logs — lista los archivos de log disponibles
  if (req.method === 'GET' && req.url === '/api/logs') {
    try {
      const files = fs.readdirSync(LOG_DIR).filter(f => f.endsWith('.log'));
      res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(files));
    } catch {
      res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
      res.end('[]');
    }
    return;
  }

  // Archivos estáticos
  const urlPath  = req.url.split('?')[0]; // ignorar query strings
  const filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);
  const ext      = path.extname(filePath).toLowerCase();

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Si falla, intentar servir index.html (SPA fallback)
      if (err.code === 'ENOENT' && !ext) {
        fs.readFile(path.join(__dirname, 'index.html'), (e2, d2) => {
          if (e2) { res.writeHead(404); res.end('Not found'); return; }
          res.writeHead(200, { ...CORS, 'Content-Type': 'text/html; charset=utf-8' });
          res.end(d2);
        });
      } else {
        res.writeHead(404); res.end('Not found');
      }
      return;
    }
    res.writeHead(200, { ...CORS, 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });

}).listen(PORT, () => {
  console.log(`\n  Enote dev server corriendo en http://localhost:${PORT}`);
  console.log(`  Logs guardados en: ${LOG_DIR}\n`);
});
