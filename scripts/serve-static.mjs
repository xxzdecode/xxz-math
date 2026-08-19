import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port = Number(process.env.MATH_STATIC_PORT || 4173);
const mime = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8']
]);

if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('MATH_STATIC_PORT is invalid');

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', 'http://local.invalid');
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^\/+/, '');
    const filePath = path.resolve(root, relative);
    if (!filePath.startsWith(`${root}${path.sep}`)) throw Object.assign(new Error('Forbidden'), { status: 403 });
    const info = await stat(filePath);
    if (!info.isFile()) throw Object.assign(new Error('Not found'), { status: 404 });
    response.writeHead(200, {
      'Content-Type': mime.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(Number(error?.status) || 404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(Number(error?.status) === 403 ? 'Forbidden' : 'Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Math site listening on http://127.0.0.1:${port}/`);
});
