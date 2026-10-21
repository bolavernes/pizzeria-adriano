// Lokaler Testserver: statische Dateien + die Netlify-Functions mit Dateispeicher
// Start: npm run dev  →  http://localhost:8888  (Admin-Passwort lokal: ADMIN_PASSWORD oder "adriano-lokal")
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.dirname(new URL(import.meta.url).pathname);
process.env.LOCAL_STORE_DIR ||= path.join(root, '.local-store');
process.env.ADMIN_PASSWORD ||= 'adriano-lokal';
process.env.SESSION_SECRET ||= crypto.randomBytes(32).toString('hex');
const menuFn = (await import('./netlify/functions/menu.mjs')).default;
const adminFn = (await import('./netlify/functions/admin.mjs')).default;
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain', '.xml': 'application/xml', '.woff2': 'font/woff2' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + req.headers.host);
  try {
    if (url.pathname === '/api/menu' || url.pathname.startsWith('/api/admin/')) {
      const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await new Promise((r) => { let d = ''; req.on('data', (c) => d += c); req.on('end', () => r(d)); });
      const request = new Request(url, { method: req.method, headers: req.headers, body });
      const out = await (url.pathname === '/api/menu' ? menuFn : adminFn)(request, {});
      res.writeHead(out.status, Object.fromEntries(out.headers)); res.end(await out.text()); return;
    }
    let p = path.join(root, decodeURIComponent(url.pathname));
    if (!p.startsWith(root)) throw new Error('nope');
    if ((await fs.stat(p).catch(() => null))?.isDirectory()) p = path.join(p, 'index.html');
    const data = await fs.readFile(p);
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }); res.end(await fs.readFile(path.join(root, '404.html')).catch(() => 'Nicht gefunden'));
  }
}).listen(process.env.PORT || 8888, () => console.log('Adriano läuft auf http://localhost:' + (process.env.PORT || 8888)));
