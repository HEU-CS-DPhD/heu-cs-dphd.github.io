import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3030;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// Track active SSE clients for instant live reload
const sseClients = new Set();

// 1. Create lightweight zero-dependency HTTP server
const server = http.createServer((req, res) => {
  const urlParts = req.url.split('?');
  const pathname = decodeURI(urlParts[0]);

  // Live Reload SSE endpoint
  if (pathname === '/live-reload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write('data: connected\n\n');
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  let reqPath = pathname === '/' || pathname === '' ? '/index.html' : pathname;
  const filePath = path.join(__dirname, reqPath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

// 2. Watch directory for changes and broadcast live reload event
let debounceTimer = null;
try {
  fs.watch(__dirname, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    // Only react to presentation content files
    if (!/\.(html|css|js|svg)$/i.test(filename)) return;
    // Ignore server itself
    if (filename === 'open.js') return;

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (sseClients.size > 0) {
        console.log(`\x1b[35m[LiveReload]\x1b[0m 检测到 \x1b[33m${filename}\x1b[0m 变更，正在自动刷新前端...`);
        for (const client of sseClients) {
          try {
            client.write('data: reload\n\n');
          } catch (err) {
            sseClients.delete(client);
          }
        }
      }
    }, 80);
  });
} catch (err) {
  console.warn('Directory watching failed:', err.message);
}

server.listen(PORT, '0.0.0.0', () => {
  const url = `http://localhost:${PORT}/`;
  console.log(`\x1b[36m[HERE Slides]\x1b[0m Server running at \x1b[32m${url}\x1b[0m`);
  console.log(`\x1b[32m⚡ 热重载已启用\x1b[0m: 修改 slides/*.html 等文件保存后，前端将自动无感刷新！`);
  console.log(`\x1b[90m(Auto-open browser disabled. Please visit the URL in your browser)\x1b[0m`);
});
