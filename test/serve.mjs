#!/usr/bin/env node
// A local server for the signed-in pages (redesign/APP.md § testing): serves this folder and stands in for the API
// on the same origin, so a page's CSP (`connect-src 'self'`) admits it.
//
//   node test/serve.mjs [--port 4320] --api http://127.0.0.1:8787     proxy every API call to a local platform
//   node test/serve.mjs [--port 4320] --fake test/fake-<area>.mjs     answer from a module: `export default (req) => …`
//
// A fake's default export gets `{ method, path, query, headers, body }` (body parsed as JSON when it is JSON) and
// returns `{ status?, body }`, or undefined for "not mine" (404 `not_found`). Each served page's
// `<meta name="vibegov-api">` is rewritten to this server's origin. `serve({ port, api, fake })` is exported for tests
// and returns `{ origin, close }`.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webm': 'video/webm', '.mp4': 'video/mp4', '.pdf': 'application/pdf', '.jsonl': 'application/x-ndjson' };

export async function serve({ port = 0, api = null, fake = null } = {}) {
  const answer = typeof fake === 'string' ? (await import(pathToFileURL(resolve(fake)).href)).default : fake;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const origin = `http://${req.headers.host}`;
    let file = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    if (file.endsWith('/')) file += 'index.html';
    // A file of the site, with or without `.html` (the hosting serves both).
    for (const candidate of [file, `${file}.html`]) {
      try {
        let bytes = await readFile(join(ROOT, candidate));
        if (candidate.endsWith('.html')) bytes = Buffer.from(String(bytes).replace(/(<meta name="vibegov-api" content=")[^"]*(">)/, `$1${origin}$2`));
        res.writeHead(200, { 'content-type': TYPES[extname(candidate)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
        return res.end(bytes);
      } catch { /* not a file: the API's */ }
    }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks);
    if (api) {
      const upstream = await fetch(api.replace(/\/+$/, '') + url.pathname + url.search, { method: req.method, headers: Object.fromEntries(Object.entries(req.headers).filter(([k]) => !['host', 'connection', 'content-length'].includes(k))), body: ['GET', 'HEAD'].includes(req.method) ? undefined : raw }).catch(e => new Response(JSON.stringify({ error: 'unreachable', message: e.message }), { status: 502 }));
      res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'application/json' });
      return res.end(Buffer.from(await upstream.arrayBuffer()));
    }
    let body = raw;
    if ((req.headers['content-type'] ?? '').includes('json')) { try { body = JSON.parse(String(raw) || 'null'); } catch { body = null; } }
    else if ((req.headers['content-type'] ?? '').includes('x-www-form-urlencoded')) body = Object.fromEntries(new URLSearchParams(String(raw)));
    const out = (await answer?.({ method: req.method, path: url.pathname, query: Object.fromEntries(url.searchParams), headers: req.headers, body })) ?? { status: 404, body: { error: 'not_found' } };
    res.writeHead(out.status ?? 200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(out.body ?? null));
  });
  await new Promise(done => server.listen(port, '127.0.0.1', done));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(done => server.close(done)) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = name => { const i = process.argv.indexOf(`--${name}`); return i === -1 ? null : process.argv[i + 1]; };
  const s = await serve({ port: Number(arg('port') ?? 4320), api: arg('api'), fake: arg('fake') });
  console.log(`${s.origin}  (${arg('api') ? `API: ${arg('api')}` : arg('fake') ? `fake: ${arg('fake')}` : 'no API: every call is 404'})`);
}
