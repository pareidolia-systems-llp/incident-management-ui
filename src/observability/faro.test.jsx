import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { version } from '../../package.json'
import * as sdk from '@grafana/faro-react'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../api/client', () => ({
  backendBaseUrl: 'http://backend.test',
  default: { get: vi.fn(async (url) => {
    if (url === '/api/auth/csrf') return { data: { headerName: 'X-XSRF-TOKEN', token: 'test-token' } }
    throw { response: { status: 401 } }
  }) },
}))

vi.mock('@grafana/faro-react', async (importOriginal) => ({
  ...await importOriginal(),
  initializeFaro: vi.fn(() => ({})),
  FetchTransport: vi.fn(function (options) { this.options = options }),
}))

const enabled = { DEV: true, VITE_FARO_ENABLED: 'true', VITE_FARO_ENVIRONMENT: 'dev', VITE_FARO_COLLECTOR_URL: 'http://127.0.0.1:12347/collect' }
const production = { DEV: false, PROD: true, VITE_FARO_ENABLED: 'true', VITE_FARO_ENVIRONMENT: 'prod', VITE_FARO_COLLECTOR_URL: 'https://incident.pareidolia.in/faro/collect' }
let initializeObservability
let beforeSend

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  sdk.initializeFaro.mockReturnValue({})
  ;({ initializeObservability, beforeSend } = await import('./faro'))
  window.history.replaceState({}, '', '/incidents/secret-id?token=secret#private')
})
afterEach(() => { cleanup(); vi.unstubAllEnvs() })

test.each([undefined, '', 'false', 'TRUE', '1', ' true ', true, false])('does not initialize without explicit true: %s', async (flag) => {
  expect(await initializeObservability({ ...enabled, VITE_FARO_ENABLED: flag })).toBeNull()
  expect(sdk.initializeFaro).not.toHaveBeenCalled()
})

test('production initializes with explicit prod metadata and the production collector', async () => {
  vi.stubEnv('DEV', false)
  vi.stubEnv('PROD', true)
  expect(await initializeObservability(production)).not.toBeNull()
  const config = sdk.initializeFaro.mock.calls[0][0]
  expect(config.app).toEqual({ name: 'incident-management-ui', version, environment: 'prod' })
  expect(sdk.FetchTransport).toHaveBeenCalledWith({ url: production.VITE_FARO_COLLECTOR_URL,
    requestOptions: { credentials: 'omit', referrerPolicy: 'no-referrer' } })
  const filtered = config.beforeSend({ type: 'log', meta: { user: { email: 'secret' }, session: { id: 'secret' } },
    payload: { level: 'error', message: 'secret', context: { body: 'secret' } } })
  expect(filtered.meta).toEqual({ app: config.app, page: { url: '/incidents/:id' } })
  expect(filtered.payload.message).toBe('console.error (arguments withheld)')
  expect(JSON.stringify(filtered)).not.toContain('secret')
})

test.each(['dev', 'prod'])('startup reads the Vite environment: %s', async (environment) => {
  vi.stubEnv('PROD', environment === 'prod')
  vi.stubEnv('DEV', environment === 'dev')
  vi.stubEnv('VITE_FARO_ENABLED', 'true')
  vi.stubEnv('VITE_FARO_ENVIRONMENT', environment)
  vi.stubEnv('VITE_FARO_COLLECTOR_URL', enabled.VITE_FARO_COLLECTOR_URL)
  expect(await initializeObservability()).not.toBeNull()
  expect(sdk.initializeFaro).toHaveBeenCalledOnce()
  expect(sdk.initializeFaro.mock.calls[0][0].app.environment).toBe(environment)
})

test.each([undefined, '', 'dev', 'prod'])('environment metadata is independent of production mode: %s', async (environment) => {
  vi.stubEnv('PROD', true)
  vi.stubEnv('DEV', false)
  await initializeObservability({ ...production, VITE_FARO_ENVIRONMENT: environment })
  expect(sdk.initializeFaro.mock.calls[0][0].app.environment).toBe(environment || 'dev')
})

test('initializes once with package metadata, v7 integration, and safe transport', async () => {
  const [first, second] = await Promise.all([initializeObservability(enabled), initializeObservability(enabled)])
  expect(first).toBe(second)
  expect(first.Routes).toBe(sdk.FaroRoutes)
  expect(first.ErrorBoundary).toBe(sdk.FaroErrorBoundary)
  expect(sdk.initializeFaro).toHaveBeenCalledTimes(1)
  const config = sdk.initializeFaro.mock.calls[0][0]
  expect(config.app).toEqual({ name: 'incident-management-ui', version, environment: 'dev' })
  expect(config.beforeSend).toBe(beforeSend)
  expect(config.sessionTracking.enabled).toBe(false)
  expect(config.metas).toEqual([])
  expect(config.instrumentations.map((entry) => entry.name)).toEqual([
    '@grafana/faro-web-sdk:instrumentation-errors', '@grafana/faro-web-sdk:instrumentation-console',
    '@grafana/faro-web-sdk:instrumentation-web-vitals', '@grafana/faro-react',
  ])
  expect(sdk.FetchTransport).toHaveBeenCalledWith({ url: enabled.VITE_FARO_COLLECTOR_URL,
    requestOptions: { credentials: 'omit', referrerPolicy: 'no-referrer' } })
})

test('SDK failure is contained and not retried during startup', async () => {
  sdk.initializeFaro.mockImplementationOnce(() => { throw new Error('SDK failed') })
  expect(await initializeObservability(enabled)).toBeNull()
  expect(await initializeObservability(enabled)).toBeNull()
  expect(sdk.initializeFaro).toHaveBeenCalledTimes(1)
})

test.each([enabled, production])('the real portal still renders its login when SDK initialization throws ($VITE_FARO_ENVIRONMENT)', async (env) => {
  sdk.initializeFaro.mockImplementationOnce(() => { throw new Error('SDK failed') })
  const { startApplication } = await import('./startApplication')
  await startApplication({ render }, env)
  expect(await screen.findByRole('button', { name: 'Sign in with Google' })).toBeTruthy()
})

test.each(['', 'not a URL', 'http://user:password@localhost/collect', 'http://localhost/collect?token=secret', 'ftp://localhost/collect'])('invalid or credential-bearing collector is ignored: %s', async (url) => {
  expect(await initializeObservability({ ...enabled, VITE_FARO_COLLECTOR_URL: url })).toBeNull()
  expect(sdk.initializeFaro).not.toHaveBeenCalled()
})

test('exception filtering removes sensitive text, objects, metadata, and stack URLs without mutation', () => {
  const item = { type: 'exception', meta: { user: { email: 'secret' }, session: { id: 'secret' }, page: { url: 'secret' } },
    payload: { timestamp: '2026-10-14T00:00:00Z', type: 'TypeError', value: 'secret', context: { authorization: 'secret' },
      originalError: { password: 'secret' }, stacktrace: { frames: [
        { filename: window.location.origin + '/src/App.jsx?token=secret', function: 'secret', lineno: 12, colno: 3 },
        { filename: 'https://private.example/secret', function: 'secret' },
      ] } } }
  const original = JSON.stringify(item)
  const filtered = beforeSend(item)
  expect(JSON.stringify(filtered)).not.toContain('secret')
  expect(filtered.meta.page.url).toBe('/incidents/:id')
  expect(filtered.payload.stacktrace.frames[0]).toEqual({ filename: '/src/App.jsx', function: '[redacted]', lineno: 12, colno: 3 })
  expect(JSON.stringify(item)).toBe(original)
})

test('console errors retain severity but no arguments or context; other logs are dropped', () => {
  const result = beforeSend({ type: 'log', payload: { level: 'error', message: 'secret', context: { body: 'secret' } } })
  expect(result.payload).toMatchObject({ level: 'error', message: 'console.error (arguments withheld)' })
  expect(JSON.stringify(result)).not.toContain('secret')
  expect(beforeSend({ type: 'log', payload: { level: 'info', message: 'secret' } })).toBeNull()
})

test('navigation uses templates and drops URLs, queries, fragments and unknown paths', () => {
  const result = beforeSend({ type: 'event', payload: { name: 'route_change', attributes: {
    fromRoute: '/private/secret', toRoute: '/incidents/secret?token=secret', toUrl: 'secret',
  } } })
  expect(result.payload.attributes).toEqual({ fromRoute: 'unknown', toRoute: '/incidents/:id' })
  expect(JSON.stringify(result)).not.toContain('secret')
})

test('Web Vitals retain only numeric standard values; attribution and other events are dropped', () => {
  const result = beforeSend({ type: 'measurement', payload: { type: 'web-vitals', values: { lcp: 123, delta: 10, secret: 42, cls: 'secret' }, context: { element: 'secret', resource_url: 'secret' } } })
  expect(result.payload.values).toEqual({ lcp: 123, delta: 10 })
  expect(JSON.stringify(result)).not.toContain('secret')
  expect(beforeSend({ type: 'event', payload: { name: 'click', attributes: { text: 'secret' } } })).toBeNull()
  expect(beforeSend({ type: 'trace', payload: {} })).toBeNull()
})

 test('work log route telemetry omits work content', () => {
  window.history.replaceState({}, '', '/work-logs?summary=private-summary')
  const result = beforeSend({ type: 'log', payload: { level: 'error', message: 'private-summary', context: { summary: 'private-summary', details: 'private-details' } } })
  expect(result.meta.page.url).toBe('/work-logs')
  expect(JSON.stringify(result)).not.toContain('private-summary')
  expect(JSON.stringify(result)).not.toContain('private-details')
})
