import { createServer } from "http"
import { readFileSync, existsSync } from "fs"
import { join, extname } from "path"
import { fileURLToPath } from "url"

const __dirname = fileURLToPath(new URL(".", import.meta.url))
const PORT = process.env.PORT || 4173
const DIST = join(__dirname, "dist")

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript",
  ".mjs":  "text/javascript",
  ".css":  "text/css",
  ".json": "application/json",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff2":"font/woff2",
}

createServer((req, res) => {
  // strip query string
  const url = req.url.split("?")[0]
  let filePath = join(DIST, url === "/" ? "index.html" : url)

  // SPA fallback — unknown paths → index.html
  if (!existsSync(filePath)) filePath = join(DIST, "index.html")

  try {
    const content = readFileSync(filePath)
    const mime = MIME[extname(filePath)] || "application/octet-stream"
    res.writeHead(200, { "Content-Type": mime })
    res.end(content)
  } catch {
    res.writeHead(404)
    res.end("Not found")
  }
}).listen(PORT, "0.0.0.0", () => {
  console.log(`Serving dist/ on http://0.0.0.0:${PORT}`)
})
