const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT) || 4173;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.sql': 'text/plain; charset=utf-8' };

http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end('Bad request'); return; }
  if (pathname === '/') pathname = '/index.html';
  const target = path.resolve(root, `.${pathname}`);
  if (!target.startsWith(root + path.sep)) { res.writeHead(403).end('Forbidden'); return; }
  fs.readFile(target, (error, content) => {
    if (error) { res.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
    res.end(content);
  });
}).on('error', error => {
  if (error.code === 'EADDRINUSE') console.error(`Port ${port} is already in use. Set PORT to another local port and retry.`);
  else console.error(error.message);
  process.exitCode = 1;
}).listen(port, '127.0.0.1', () => console.log(`Bharti Clinic is running at http://localhost:${port}`));
