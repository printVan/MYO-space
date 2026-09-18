// 本地预览静态服务器（开发辅助，非交付产物）
const http = require('http')
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, 'dist')
const port = Number(process.env.PORT || 8080)

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json'
}

http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0])
  let filePath = path.normalize(path.join(root, urlPath === '/' ? 'index.html' : urlPath))
  if (!filePath.startsWith(root)) {
    res.writeHead(403); res.end('Forbidden'); return
  }
  fs.stat(filePath, (err, st) => {
    if (!err && st.isDirectory()) filePath = path.join(filePath, 'index.html')
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        // SPA 回退到 index.html
        fs.readFile(path.join(root, 'index.html'), (e2, html) => {
          if (e2) { res.writeHead(404); res.end('Not Found'); return }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(html)
        })
        return
      }
      res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' })
      res.end(data)
    })
  })
}).listen(port, () => console.log(`[static] http://localhost:${port}`))
