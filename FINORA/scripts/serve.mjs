import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { extname, resolve, sep } from 'node:path'
const build = fileURLToPath(new URL('../dist/', import.meta.url))
const root = resolve(build)
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.gz': 'application/gzip',
  '.webmanifest': 'application/manifest+json',
}
try {
  await stat(resolve(root, 'index.html'))
} catch {
  console.error('Build belum tersedia. Jalankan npm ci lalu npm run build.')
  process.exit(1)
}
const csp =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; manifest-src 'self'"
const port = Number(process.env.FINORA_DEMO_PORT || 4175)
createServer(async (req, res) => {
  res.setHeader('Content-Security-Policy', csp)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end()
    return
  }
  try {
    const url = new URL(req.url, 'http://localhost')
    if (url.pathname.startsWith('/api/')) {
      if (url.pathname === '/api/session')
        res
          .writeHead(200, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          })
          .end('{"google":false}')
      else
        res
          .writeHead(503, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          })
          .end('{"error":"Backend Google belum dikonfigurasi."}')
      return
    }
    const name = decodeURIComponent(url.pathname)
    const file = resolve(root, '.' + (name === '/' ? '/index.html' : name))
    if (!file.startsWith(root + sep) || !types[extname(file)]) {
      res.writeHead(404).end()
      return
    }
    const f = await stat(file)
    if (!f.isFile()) {
      res.writeHead(404).end()
      return
    }
    res.writeHead(200, {
      'Content-Type': types[extname(file)],
      'Content-Length': f.size,
      'Cache-Control': name.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    })
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    createReadStream(file)
      .on('error', () => res.destroy())
      .pipe(res)
  } catch {
    res.writeHead(404).end()
  }
}).listen(port, '127.0.0.1', () =>
  console.log(`FINORA demo berjalan di http://localhost:${port}`),
)
