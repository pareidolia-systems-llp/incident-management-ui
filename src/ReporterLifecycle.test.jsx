import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AuthContext from './auth/AuthContext'
import IncidentDetails from './pages/IncidentDetails'
import apiClient from './api/client'

vi.mock('./api/client', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
let incident
beforeEach(() => {
  vi.resetAllMocks()
  incident = { id: 12, incidentNumber: 'INC-12', title: 'VPN', status: 'IN_PROGRESS', reportedBy: 'reporter@example.test' }
  apiClient.get.mockImplementation(async (url) => ({ data: url.endsWith('/12') ? incident : [] }))
})
afterEach(cleanup)
async function mount(role = 'REPORTER') {
  const user = { role, email: role === 'REPORTER' ? incident.reportedBy : 'admin@example.test' }
  render(<AuthContext.Provider value={{ user }}><MemoryRouter initialEntries={['/incidents/12']}><Routes><Route path="/incidents/:id" element={<IncidentDetails />} /></Routes></MemoryRouter></AuthContext.Provider>)
  await screen.findByRole('heading', { name: 'INC-12' })
}

test('reporter sees contextual investigation waiting text and no operational actions', async () => {
  await mount()
  expect(screen.getByText('No action required from you right now.')).toBeTruthy()
  expect(screen.getByText('The IT team is investigating this incident.')).toBeTruthy()
  expect(screen.getByText('You will be able to validate the resolution once the incident is resolved.')).toBeTruthy()
  expect(screen.queryByText('No lifecycle actions are available.')).toBeNull()
  for (const name of ['Assign Incident', 'Record Investigation', 'Resolve Incident', 'Log Work on This Incident', 'Reassess Severity', 'Reassess Priority', 'Update Evidence Reference', 'Validate Incident', 'Issue Still Persists', 'Close Incident']) {
    expect(screen.queryByRole('button', { name, exact: true })).toBeNull()
  }
  expect(screen.queryByText('More Actions')).toBeNull()
})

test.each([
  ['OPEN', 'Reported'], ['ASSIGNED', 'Assigned'], ['IN_PROGRESS', 'In Progress'],
  ['RESOLVED', 'Resolved'], ['VALIDATED', 'Reporter Validation'], ['CLOSED', 'Closed'],
])('read-only tracker highlights the current %s stage', async (status, label) => {
  incident.status = status
  await mount()
  const tracker = screen.getByRole('region', { name: 'Incident progress' })
  expect(within(tracker).getAllByRole('listitem')).toHaveLength(6)
  const current = tracker.querySelectorAll('[aria-current="step"]')
  expect(current).toHaveLength(1)
  expect(current[0].textContent).toContain(`${label} (current)`)
  expect(within(tracker).queryByRole('button')).toBeNull()
  expect(within(tracker).queryByRole('link')).toBeNull()
})

test('rejected resolution clearly returns to investigation without enabling reporter actions', async () => {
  incident.issueStillPersists = true
  await mount()
  const tracker = screen.getByRole('region', { name: 'Incident progress' })
  expect(within(tracker).getByText(/Previously resolved → Issue Still Persists → In Progress/)).toBeTruthy()
  expect(screen.getByText('The IT team is investigating this incident again after your feedback.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Record Investigation' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Issue Still Persists' })).toBeNull()
})

test('resolved original reporter retains validation and rejection actions', async () => {
  incident.status = 'RESOLVED'
  await mount()
  expect(screen.getByRole('button', { name: 'Validate Incident' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Issue Still Persists' })).toBeTruthy()
  expect(screen.queryByText('No action required from you right now.')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Resolve Incident' })).toBeNull()
})

test('validated original reporter retains closure action', async () => {
  incident.status = 'VALIDATED'
  await mount()
  expect(screen.getByRole('button', { name: 'Close Incident' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Validate Incident' })).toBeNull()
})

test.each([
  ['OPEN', 'Your incident has been reported and is awaiting assignment to IT.'],
  ['ASSIGNED', 'Your incident has been assigned to the IT team for investigation.'],
  ['CLOSED', 'This incident is closed.'],
])('reporter waiting text reflects %s', async (status, message) => {
  incident.status = status
  await mount()
  expect(screen.getByText(message)).toBeTruthy()
  expect(screen.queryByText('No lifecycle actions are available.')).toBeNull()
  if (status === 'CLOSED') expect(screen.queryByText(/You will be able to validate/)).toBeNull()
})

test('admin retains investigation, resolution, work-note and operational actions', async () => {
  await mount('ADMIN')
  expect(screen.queryByRole('button', { name: 'Record Investigation' })).toBeNull()
  expect(screen.getByLabelText(/^Investigation Details/)).toBeTruthy()
  for (const name of ['Save Progress', 'Resolve Incident', 'Log Work on This Incident', 'Reclassify Incident', 'Reassess Severity', 'Reassess Priority', 'Escalate Incident', 'Update Evidence Reference']) {
    expect(screen.getByRole('button', { name, exact: true, hidden: true })).toBeTruthy()
  }
  expect(screen.queryByRole('button', { name: 'Validate Incident' })).toBeNull()
  expect(screen.queryByText('No action required from you right now.')).toBeNull()
})

test.each([true, false])('reporter priority action follows backend permission %s', async (permitted) => {
  incident.canChangePriority = permitted
  await mount()
  if (permitted) screen.getByText('More Actions').closest('details').open = true
  expect(Boolean(screen.queryByRole('button', { name: 'Reassess Priority' }))).toBe(permitted)
})
