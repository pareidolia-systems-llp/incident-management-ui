import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { FaroErrorBoundary, ReactIntegration, initializeFaro } from '@grafana/faro-react'
import { initializeObservability } from './faro'
import { startApplication } from './startApplication'

vi.mock('./faro', () => ({ initializeObservability: vi.fn() }))
vi.mock('../App', () => ({ default: function TestApplication() { throw new Error('private incident text') } }))

afterEach(() => { cleanup(); vi.restoreAllMocks() })

test('official error boundary reports component errors and shows a safe reload fallback', async () => {
  const instance = initializeFaro({
    app: { name: 'test' }, transports: [], metas: [],
    instrumentations: [new ReactIntegration()], preventGlobalExposure: true,
  })
  const pushError = vi.spyOn(instance.api, 'pushError')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  initializeObservability.mockResolvedValue({ ErrorBoundary: FaroErrorBoundary })
  await startApplication({ render })
  expect(screen.getByRole('alert').textContent).toContain('Something went wrong')
  expect(screen.queryByText('private incident text')).toBeNull()
  expect(pushError).toHaveBeenCalled()
  const originalWindow = window
  const reload = vi.fn()
  vi.stubGlobal('window', { location: { reload } })
  try { fireEvent.click(screen.getByRole('button', { name: 'Reload portal' })) }
  finally { vi.stubGlobal('window', originalWindow) }
  expect(reload).toHaveBeenCalledOnce()
})
