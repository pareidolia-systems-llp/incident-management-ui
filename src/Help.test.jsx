import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import apiClient from './api/client'
import { clearCsrfToken } from './api/csrf'
import { helpFieldLinks, helpSections } from './utils/portalHelp'
import { fieldGuidance } from './utils/incidentGuidance'
vi.mock('./api/client', () => ({ backendBaseUrl: 'http://backend.test', default: { get: vi.fn(), post: vi.fn() } }))
let role
beforeEach(() => {
  role = 'REPORTER'
  vi.clearAllMocks()
  clearCsrfToken()
  localStorage.clear()
  window.history.replaceState({}, '', '/help')
  apiClient.get.mockImplementation(async url => {
    if (url === '/api/auth/csrf') return { data: { headerName: 'X-XSRF-TOKEN', token: 'test' } }
    if (url === '/api/auth/me' && role) return { data: { role, email: 'owner@example.test', displayName: 'Owner' } }
    throw { response: { status: 401 } }
  })
})
afterEach(cleanup)
test.each(['REPORTER', 'IT_HANDLER', 'REVIEWER', 'ADMIN'])('help is available to authenticated %s with relevant shortcuts', async value => {
  role = value
  render(<App />)
  await screen.findByRole('heading', { name: 'How to Use This Portal' })
  expect(screen.getByRole('link', { name: 'How to Use' }).getAttribute('aria-current')).toBe('page')
  expect(Boolean(screen.queryByRole('link', { name: 'Open monthly reports in Incidents' }))).toBe(['IT_HANDLER', 'ADMIN'].includes(role))
  for (const [id] of helpSections) expect(document.getElementById(id)).toBeTruthy()
  expect(apiClient.post).not.toHaveBeenCalled()
  expect(apiClient.get.mock.calls.every(([url]) => ['/api/auth/me', '/api/auth/csrf'].includes(url))).toBe(true)
})
test('help requires authentication', async () => {
  role = null
  render(<App />)
  await screen.findByRole('button', { name: 'Sign in with Google' })
  expect(window.location.pathname).toBe('/login')
  expect(screen.queryByRole('heading', { name: 'How to Use This Portal' })).toBeNull()
})
test('deep links open and focus every contextual field destination', async () => {
  const view = render(<App />)
  await screen.findByRole('heading', { name: 'How to Use This Portal' })
  view.unmount()
  for (const id of Object.values(helpFieldLinks)) {
    window.history.replaceState({}, '', '/help#' + id)
    const current = render(<App />)
    await screen.findByRole('heading', { name: 'How to Use This Portal' })
    await waitFor(() => expect(document.getElementById(id).open).toBe(true))
    expect(document.activeElement).toBe(document.getElementById(id).querySelector('summary'))
    current.unmount()
  }
})
test('form Learn more reaches the detailed field guide and preserves inline guidance', async () => {
  window.history.replaceState({}, '', '/incidents/new')
  render(<App />)
  const link = await screen.findByRole('link', { name: 'Learn more about Affected System' })
  expect(screen.getByText(fieldGuidance.affectedSystem.text)).toBeTruthy()
  fireEvent.click(link)
  await screen.findByRole('heading', { name: 'How to Use This Portal' })
  expect(document.getElementById('affected-system').open).toBe(true)
  expect(window.location.hash).toBe('#affected-system')
})
test('help preserves shared definitions, required people examples, security and reporter lifecycle guidance', async () => {
  render(<App />)
  await screen.findByRole('heading', { name: 'How to Use This Portal' })
  expect(screen.getByText(fieldGuidance.rootCause.text)).toBeTruthy()
  const people = document.getElementById('impacted-users').textContent
  for (const example of ['Operations Team', 'SPO Operations Team', 'R&D Department', 'IT Team', 'HR Department', 'Finance Team', 'Development Team', 'All Office Users', 'Debolina - Development']) expect(people).toContain(example)
  expect(document.getElementById('lifecycle').textContent).toContain('Only the original reporter can validate')
  expect(document.getElementById('lifecycle').textContent).toContain('status remains Closed')
  expect(screen.getByLabelText('Sensitive information warning').textContent).toContain('session cookies')
  expect(document.getElementById('monthly-reports').textContent).toContain('not a month-end snapshot')
})
test('compact help navigation retains its icon, title and saved preference', async () => {
  localStorage.setItem('incidentSidebarCollapsed', 'true')
  render(<App />)
  const link = await screen.findByRole('link', { name: 'How to Use' })
  expect(link.getAttribute('title')).toBe('How to Use')
  expect(link.querySelector('svg[aria-hidden="true"]')).toBeTruthy()
  expect(document.querySelector('.sidebar-collapsed')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))
  expect(localStorage.getItem('incidentSidebarCollapsed')).toBe('false')
})

test('topic jump navigates and focuses the chosen section without repeated return links', async () => {
  render(<App />)
  await screen.findByRole('heading', { name: 'How to Use This Portal' })
  fireEvent.change(screen.getByLabelText('Jump to section'), { target: { value: 'screenshots' } })
  expect(window.location.hash).toBe('#screenshots')
  expect(document.activeElement).toBe(document.getElementById('screenshots'))
  expect(screen.queryByText('Back to contents')).toBeNull()
  expect(screen.getAllByRole('link', { name: '↑ Back to top' })).toHaveLength(1)
  fireEvent.click(screen.getByRole('link', { name: '↑ Back to top' }))
  expect(document.activeElement).toBe(document.getElementById('help-top'))
})
test('role shortcuts navigate to documentation without changing permissions', async () => {
  render(<App />)
  await screen.findByRole('heading', { name: 'How to Use This Portal' })
  fireEvent.click(screen.getByRole('link', { name: 'IT Handler', exact: true }))
  expect(window.location.hash).toBe('#role-it-handler')
  expect(document.activeElement).toBe(document.getElementById('role-it-handler'))
  expect(screen.queryByRole('link', { name: 'Open monthly reports in Incidents' })).toBeNull()
  expect(apiClient.post).not.toHaveBeenCalled()
})

test.each(['REPORTER', 'IT_HANDLER', 'REVIEWER', 'ADMIN'])('role headings stay neutral and documentation labels readable for %s', async value => {
  role = value
  render(<App />)
  await screen.findByRole('heading', { name: 'How to Use This Portal' })
  const cards = document.querySelectorAll('#roles .help-role-target')
  expect([...cards].map(card => card.querySelector('h3').textContent)).toEqual(['Reporter', 'IT Handler', 'Reviewer', 'Admin'])
  const help = document.querySelector('.portal-help')
  expect(help.textContent).not.toContain('(your role)')
  expect(help.textContent).not.toMatch(/\b(?:IT_HANDLER|REPORTER|REVIEWER|ADMIN|RESOLVED|IN_PROGRESS|CLOSED|ASSIGNED|OPEN|VALIDATED)\b/)
  expect(document.querySelector('#role-admin p').textContent).toContain('Create and view incidents')
  expect(screen.getByLabelText('About role permissions').textContent).toContain('Help links do not grant additional permissions')
  expect(document.querySelector('#role-it-handler .help-role-actions a').getAttribute('href')).toBe('/help#investigation-details')
})
