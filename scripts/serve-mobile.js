const http = require("http")
const fs = require("fs")
const path = require("path")
const os = require("os")

const HOST = "0.0.0.0"
const PORT = Number(process.env.PORT || 5500)
const ROOT_DIR = path.resolve(__dirname, "..")

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`)
  const normalizedPath = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname)
  const targetPath = path.normalize(path.join(ROOT_DIR, normalizedPath))

  if (!targetPath.startsWith(ROOT_DIR)) {
    sendError(response, 403, "Forbidden")
    return
  }

  fs.stat(targetPath, (statError, stats) => {
    if (statError) {
      sendError(response, 404, "Not Found")
      return
    }

    const filePath = stats.isDirectory() ? path.join(targetPath, "index.html") : targetPath
    fs.readFile(filePath, (readError, fileBuffer) => {
      if (readError) {
        sendError(response, 404, "Not Found")
        return
      }

      const extension = path.extname(filePath).toLowerCase()
      response.writeHead(200, {
        "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
        "Cache-Control": "no-store",
      })
      response.end(fileBuffer)
    })
  })
})

server.listen(PORT, HOST, () => {
  const addresses = getLocalAddresses()

  console.log("")
  console.log("Small Game mobile server is running.")
  console.log(`Local:   http://localhost:${PORT}`)

  if (addresses.length === 0) {
    console.log("Network: No LAN IPv4 address detected.")
  } else {
    for (const address of addresses) {
      console.log(`Network: http://${address}:${PORT}`)
    }
  }

  console.log("")
  console.log("Open one of the Network addresses above on your phone.")
  console.log("Press Ctrl+C to stop the server.")
  console.log("")
})

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the other server or run with PORT=<port> npm run serve:mobile`)
    process.exit(1)
  }

  console.error(error)
  process.exit(1)
})

function getLocalAddresses() {
  const networkInterfaces = os.networkInterfaces()
  const addresses = []

  for (const entries of Object.values(networkInterfaces)) {
    if (!entries) continue

    for (const entry of entries) {
      if (entry.family === "IPv4" && !entry.internal) {
        addresses.push(entry.address)
      }
    }
  }

  return [...new Set(addresses)]
}

function sendError(response, statusCode, message) {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" })
  response.end(message)
}