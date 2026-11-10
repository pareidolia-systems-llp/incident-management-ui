import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import apiClient from './api/client'
import { clearCsrfToken, getCsrfToken } from './api/csrf'

vi.mock('./api/client', () => ({
  backendBaseUrl: 'http://backend.test',
  default: { get: vi.fn(), post: vi.fn() },
}))
vi.mock('./pages/Dashboard', () => ({ default: () => <h1>Dashboard content</h1> }))
vi.mock('./pages/IncidentList', () => ({ default: () => <h1>Protected incidents</h1> }))

const user = { email: 'reporter@example.test', role: 'REPORTER', displayName: 'Reporter' }
let currentUser

beforeEach(() => {
  vi.clearAllMocks()
  clearCsrfToken()
  currentUser = null
  window.history.replaceState({}, '', '/login')
  apiClient.get.mockImplementation(async (url) => {
    if (url === '/api/auth/csrf') return { data: { headerName: 'X-XSRF-TOKEN', token: 'csrf-token' } }
    if (url === '/api/auth/me' && currentUser) return { data: currentUser }
    throw { response: { status: 401 } }
  })
  apiClient.post.mockImplementation(async () => { currentUser = null; return { status: 204 } })
})

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

test('login and a refreshed login stay visible without starting OAuth', async () => {
  const first = render(<App />)
  expect(await screen.findByRole('button', { name: 'Sign in with Google' })).toBeTruthy()
  expect(window.location.pathname).toBe('/login')
  first.unmount()
  render(<App />)
  expect(await screen.findByRole('button', { name: 'Sign in with Google' })).toBeTruthy()
  expect(window.location.pathname).toBe('/login')
  expect(apiClient.get.mock.calls.every(([url]) => ['/api/auth/me', '/api/auth/csrf'].includes(url))).toBe(true)
  expect(apiClient.post).not.toHaveBeenCalled()
})

test('only an explicit click starts the existing Google authorization flow', async () => {
  render(<App />)
  const button = await screen.findByRole('button', { name: 'Sign in with Google' })
  const originalWindow = window
  const assign = vi.fn()
  // Intercept just this click's full-page navigation; do not contact Google.
  vi.stubGlobal('window', { location: { assign } })
  try { fireEvent.click(button) } finally { vi.stubGlobal('window', originalWindow) }
  expect(assign).toHaveBeenCalledExactlyOnceWith('http://backend.test/oauth2/authorization/google')
})

test('protected routes show the login experience when unauthenticated', async () => {
  window.history.replaceState({}, '', '/incidents')
  render(<App />)
  expect(await screen.findByRole('button', { name: 'Sign in with Google' })).toBeTruthy()
  expect(window.location.pathname).toBe('/login')
  expect(screen.queryByText('Protected incidents')).toBeNull()
})

test('authenticated users retain access and authenticated login returns to application', async () => {
  currentUser = user
  render(<App />)
  expect(await screen.findByText('Dashboard content')).toBeTruthy()
  expect(window.location.pathname).toBe('/')
  fireEvent.click(screen.getByRole('link', { name: 'Incidents' }))
  expect(await screen.findByText('Protected incidents')).toBeTruthy()
})

test('confirmed logout clears auth and CSRF, replaces route with login and stays there', async () => {
  currentUser = user
  window.history.replaceState({}, '', '/incidents')
  render(<App />)
  const signOut = await screen.findByRole('button', { name: 'Sign Out' })
  expect(getCsrfToken()).toEqual({ headerName: 'X-XSRF-TOKEN', token: 'csrf-token' })
  fireEvent.click(signOut)
  expect(await screen.findByRole('button', { name: 'Sign in with Google' })).toBeTruthy()
  expect(apiClient.post).toHaveBeenCalledExactlyOnceWith('/api/auth/logout')
  expect(getCsrfToken()).toBeNull()
  expect(window.location.pathname).toBe('/login')
  expect(screen.queryByText('Protected incidents')).toBeNull()
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Sign Out' })).toBeNull())
})

test('failed server logout does not claim the session has ended', async () => {
  currentUser = user
  window.history.replaceState({}, '', '/incidents')
  apiClient.post.mockRejectedValue(new Error('Network unavailable'))
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Sign Out' }))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(window.location.pathname).toBe('/incidents')
  expect(screen.queryByRole('button', { name: 'Sign in with Google' })).toBeNull()
  expect(getCsrfToken()).not.toBeNull()
})

test.each(['/employees', '/department-administration'])('blocks a direct admin URL for an ADMIN without the server capability: %s', async path => {
  vi.stubEnv('VITE_EMPLOYEE_MANAGEMENT_ENABLED', 'true')
  vi.stubEnv('VITE_DEPARTMENT_ADMIN_ENABLED', 'true')
  currentUser = { ...user, role: 'ADMIN', canManageEmployees: false }
  window.history.replaceState({}, '', path)
  render(<App />)
  expect((await screen.findByRole('alert')).textContent).toContain(path === '/employees' ? 'Access denied.' : 'Ask the HR access administrator')
  expect(screen.queryByRole('link', { name: 'Employee Management' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'Department administration' })).toBeNull()
  expect(apiClient.get.mock.calls.some(([url]) => url.startsWith('/api/admin/'))).toBe(false)
})

test('department sections honor independent server permission checks', async () => {
  vi.stubEnv('VITE_DEPARTMENT_ADMIN_ENABLED', 'true')
  currentUser = { ...user, canManageEmployees: true }
  const authGet = apiClient.get.getMockImplementation()
  apiClient.get.mockImplementation(async url => {
    if (url === '/api/admin/handler-eligibility') return { data: [] }
    if (url.startsWith('/api/admin/department-head-designations')) throw { response: { status: 403 } }
    return authGet(url)
  })
  window.history.replaceState({}, '', '/department-administration')
  render(<App />)
  expect(await screen.findByText(/Department-head designation information is unavailable to your account/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Review change' })).toBeNull()
  expect(await screen.findByRole('button', { name: 'Save eligibility' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Department administration' })).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Incident triage' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'Incident security' })).toBeNull()
})

test.each(['/assignment-triage', '/incident-security'])('ADMIN and frontend flags cannot expose guarded controls when the backend is off (%s)', async path => {
  currentUser = { ...user, role: 'ADMIN' }
  vi.stubEnv('VITE_INCIDENT_ASSIGNMENT_ENABLED', 'true')
  vi.stubEnv('VITE_INCIDENT_SECURITY_ADMIN_ENABLED', 'true')
  const authentication = apiClient.get.getMockImplementation()
  apiClient.get.mockImplementation(url => url.startsWith('/api/auth/')
    ? authentication(url)
    : Promise.reject({ response: { status: 404 } }))
  window.history.replaceState({}, '', path)
  render(<App />)
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.queryByRole('link', { name: 'Incident triage' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'Incident security' })).toBeNull()
  expect(screen.queryByRole('button', { name: /save|load (case|triage)/i })).toBeNull()
  expect(apiClient.post).not.toHaveBeenCalled()
})
