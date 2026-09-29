import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve } from 'node:path'

const distDirectory = resolve('dist')
const port = Number.parseInt(process.env.PORT, 10) || 3000

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

function isInsideDist(filePath) {
  const pathFromDist = relative(distDirectory, filePath)
  return pathFromDist === '' || (!pathFromDist.startsWith('..') && !isAbsolute(pathFromDist))
}

async function serveFile(response, filePath, method) {
  const file = await readFile(filePath)
  response.writeHead(200, {
    'Content-Length': file.length,
    'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream',
  })
  response.end(method === 'HEAD' ? undefined : file)
}

const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' })
    response.end('Method not allowed')
    return
  }

  let pathname
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  } catch {
    response.writeHead(400)
    response.end('Invalid request path')
    return
  }

  const requestedFile = resolve(distDirectory, `.${pathname}`)
  try {
    if (isInsideDist(requestedFile) && (await stat(requestedFile)).isFile()) {
      await serveFile(response, requestedFile, request.method)
      return
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      response.writeHead(500)
      response.end('Unable to serve application assets')
      return
    }
  }

  if (extname(pathname)) {
    response.writeHead(404)
    response.end('Asset not found')
    return
  }

  try {
    await serveFile(response, resolve(distDirectory, 'index.html'), request.method)
  } catch {
    response.writeHead(500)
    response.end('Application build is not available')
  }
})

server.listen(port, () => {
  console.log(`Incident Management UI is listening on port ${port}`)
})
