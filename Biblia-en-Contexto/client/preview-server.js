import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const port = process.env.PORT ?? 5174;
const distDir = join(process.cwd(), 'dist');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

createServer(async (req, res) => {
  const requestPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const safePath = normalize(requestPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(distDir, safePath);

  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': mimeTypes[extname(filePath)] ?? 'application/octet-stream'
    });
    res.end(data);
  } catch {
    const index = await readFile(join(distDir, 'index.html'));
    res.writeHead(200, { 'Content-Type': mimeTypes['.html'] });
    res.end(index);
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Vista previa disponible en http://127.0.0.1:${port}`);
});
