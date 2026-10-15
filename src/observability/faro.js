import { version } from '../../package.json'

const app = { name: 'incident-management-ui', version, environment: 'dev' }
const routes = new Set(['/', '/login', '/incidents', '/incidents/new', '/incidents/:id', '/help'])
const errorTypes = new Set(['Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError', 'URIError', 'EvalError', 'UnhandledRejection'])
const sourceFiles = new Set(Object.keys(import.meta.glob(['/src/**/*.{js,jsx}', '!/src/**/*.test.{js,jsx}'])))
let initialization

function routeContext(value) {
  try {
    const { pathname } = new URL(value, window.location.origin)
    if (routes.has(pathname)) return pathname
    if (/^\/incidents\/[^/]+$/.test(pathname)) return '/incidents/:id'
  } catch { /* Unknown URLs have no useful, safe route context. */ }
  return 'unknown'
}

function sourceFile(value) {
  try {
    const url = new URL(value, window.location.origin)
    if (url.origin === window.location.origin && sourceFiles.has(url.pathname)) return url.pathname
  } catch { /* Do not export arbitrary stack filenames. */ }
  return '[redacted]'
}

// Rebuild a small allowed payload instead of trying to recognize every possible secret.
// Never mutate the application's errors, console arguments, or SDK metadata.
export function beforeSend(item) {
  const input = item.payload
  const timestamp = input.timestamp
  let payload
  if (item.type === 'exception') {
    payload = {
      timestamp,
      type: errorTypes.has(input.type) ? input.type : input.type?.startsWith('React ErrorBoundary ') ? 'React ErrorBoundary' : 'Error',
      value: 'Frontend error (message withheld)',
      stacktrace: { frames: (input.stacktrace?.frames || []).map((frame) => ({
        filename: sourceFile(frame.filename),
        function: '[redacted]',
        ...(Number.isInteger(frame.lineno) ? { lineno: frame.lineno } : {}),
        ...(Number.isInteger(frame.colno) ? { colno: frame.colno } : {}),
      })) },
    }
  } else if (item.type === 'log' && input.level === 'error') {
    payload = { timestamp, level: 'error', message: 'console.error (arguments withheld)' }
  } else if (item.type === 'measurement' && input.type === 'web-vitals') {
    const values = Object.fromEntries(['cls', 'fcp', 'inp', 'lcp', 'ttfb', 'delta']
      .filter((key) => Number.isFinite(input.values?.[key]))
      .map((key) => [key, input.values[key]]))
    if (!Object.keys(values).length) return null
    payload = { timestamp, type: 'web-vitals', values }
  } else if (item.type === 'event' && input.name === 'route_change') {
    payload = { timestamp, name: 'route_change', attributes: {
      fromRoute: routeContext(input.attributes?.fromRoute),
      toRoute: routeContext(input.attributes?.toRoute),
    } }
  } else {
    return null
  }
  return { type: item.type, payload, meta: { app, page: { url: routeContext(window.location.href) } } }
}

export function initializeObservability(env) {
  const config = env ?? {
    VITE_FARO_ENABLED: import.meta.env.VITE_FARO_ENABLED,
    VITE_FARO_ENVIRONMENT: import.meta.env.VITE_FARO_ENVIRONMENT,
    VITE_FARO_COLLECTOR_URL: import.meta.env.VITE_FARO_COLLECTOR_URL,
  }
  if (config.VITE_FARO_ENABLED !== 'true') return Promise.resolve(null)
  initialization ??= initialize(config).catch(() => null)
  return initialization
}

async function initialize(env) {
  const url = new URL(env.VITE_FARO_COLLECTOR_URL)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null
  const [sdk, router] = await Promise.all([import('@grafana/faro-react'), import('react-router-dom')])
  // Keep the historical dev fallback; explicit metadata never depends on Vite mode.
  app.environment = env.VITE_FARO_ENVIRONMENT || 'dev'
  const instance = sdk.initializeFaro({
    app,
    transports: [new sdk.FetchTransport({
      url: url.href,
      requestOptions: { credentials: 'omit', referrerPolicy: 'no-referrer' },
    })],
    instrumentations: [
      new sdk.ErrorsInstrumentation(),
      new sdk.ConsoleInstrumentation(),
      new sdk.WebVitalsInstrumentation(),
      new sdk.ReactIntegration({ router: sdk.createReactRouterV7Options(router) }),
    ],
    consoleInstrumentation: {
      disabledLevels: ['debug', 'trace', 'log', 'info', 'warn'],
      consoleErrorAsLog: true,
      errorSerializer: () => 'console.error (arguments withheld)',
    },
    metas: [],
    sessionTracking: { enabled: false },
    webVitalsInstrumentation: { trackAttributionSources: false },
    preventGlobalExposure: true,
    beforeSend,
  })
  if (!instance) return null
  return { Routes: sdk.FaroRoutes, ErrorBoundary: sdk.FaroErrorBoundary }
}
