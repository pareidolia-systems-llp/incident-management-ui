import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// This config can only start a development server; it cannot produce a build.
export default defineConfig(({ command }) => {
  if (command !== 'serve') throw new Error('The synthetic preview cannot be built or deployed.')
  return {
    plugins: [react(), { name: 'deny-preview-backend', configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (/^\/(api|oauth2|login)(\/|\?|$)/.test(req.url || '')) { res.statusCode = 404; res.end('Synthetic preview: backend access disabled'); return }
        next()
      })
    }}],
    define: { 'import.meta.env.VITE_PHASE2_ENABLED': JSON.stringify('true') },
    server: { host: '127.0.0.1', port: 5174, strictPort: true, allowedHosts: ['127.0.0.1'],
      headers: { 'Content-Security-Policy': "default-src 'self'; connect-src 'self' ws://127.0.0.1:5174; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; base-uri 'none'; form-action 'none'" } },
  }
})
