import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AuthContext from './auth/AuthContext'
import IncidentDetails from './pages/IncidentDetails'
import apiClient from './api/client'

vi.mock('./api/client', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
let incident, history
beforeEach(() => {
  vi.resetAllMocks()
  incident = { id: 12, incidentNumber: 'INC-12', title: 'VPN', status: 'IN_PROGRESS', reportedBy: 'reporter@example.test', rootCause: 'Existing cause', issueStillPersists: true }
  history = []
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  apiClient.get.mockImplementation(async (url) => ({ data: url.endsWith('/history') ? history : url.endsWith('/attachments') ? [] : incident }))
  apiClient.post.mockImplementation(async (url, payload) => {
    const actionType = url.endsWith('/work-notes') ? 'WORK_NOTE' : url.endsWith('/investigation') ? 'INVESTIGATION_UPDATED' : 'INCIDENT_RESOLVED'
    history = [{ id: 1, actionType, newValue: payload.investigationDetails || payload.resolutionDetails, remarks: payload.remarks, changedBy: 'handler@example.test', changedAt: '2026-10-15T11:00:00' }]
    if (actionType === 'INVESTIGATION_UPDATED') incident = { ...incident, ...payload }
    if (actionType === 'INCIDENT_RESOLVED') incident = { ...incident, status: 'RESOLVED', issueStillPersists: false }
    return { data: incident }
  })
})
afterEach(() => { cleanup(); vi.useRealTimers() })
function Location() { return <output aria-label="Current route">{useLocation().pathname}</output> }
function mount(role = 'IT_HANDLER') {
  return render(<AuthContext.Provider value={{ user: { role, email: role === 'REPORTER' ? incident.reportedBy : 'handler@example.test' } }}><MemoryRouter initialEntries={['/incidents/12']}><Location /><Routes><Route path="/incidents/:id" element={<IncidentDetails />} /></Routes></MemoryRouter></AuthContext.Provider>)
}
const cases = [
  ['Record Investigation', /^Investigation Details/, 'Save Progress', 'Investigation Updated', '/investigation'],
  ['Log Work on This Incident', /^Work Note/, 'Log Work on This Incident', 'Work note added', '/work-notes'],
  ['Resolve Incident', /^Resolution Details/, 'Confirm Resolution', 'Incident Resolved', '/resolve'],
]

test.each(['ADMIN', 'IT_HANDLER'])('%s has a single workspace immediately above activity', async (role) => {
  mount(role)
  const work = await screen.findByRole('region', { name: 'Work on Incident' })
  expect(within(work).queryByRole('button', { name: 'Record Investigation' })).toBeNull()
  expect(within(work).getByLabelText(/^Investigation Details/)).toBeTruthy()
  expect(within(work).getByLabelText(/^Actions Taken/)).toBeTruthy()
  for (const name of ['Save Progress', 'Resolve Incident', 'Log Work on This Incident']) expect(within(work).getByRole('button', { name, exact: true })).toBeTruthy()
  expect(work.previousElementSibling.getAttribute('aria-labelledby')).toBe('incident-progress-title')
  expect(work.nextElementSibling.id).toBe('incident-activity')
  expect(screen.getAllByRole('region', { name: 'Activity & Work Log' })).toHaveLength(1)
  expect(within(work).getByRole('link', { name: 'Activity & Work Log' }).getAttribute('href')).toBe('#incident-activity')
  expect(screen.getByText('Issue reported as still unresolved')).toBeTruthy()
  expect(within(work).getByText('Record diagnostic findings and observations. Save progress as you work.')).toBeTruthy()
  expect(within(work).getByText('Record work/actions performed without changing ticket status.')).toBeTruthy()
  expect(within(work).queryByRole('region', { name: 'Resolution' })).toBeNull()
})

test.each(['REPORTER', 'REVIEWER'])('%s does not receive operational workspace controls', async (role) => {
  mount(role)
  await screen.findByRole('heading', { name: 'INC-12' })
  expect(screen.queryByRole('region', { name: 'Work on Incident' })).toBeNull()
  for (const [name] of cases) expect(screen.queryByRole('button', { name, exact: true })).toBeNull()
  expect(screen.getByRole('region', { name: 'Incident progress' })).toBeTruthy()
  expect(screen.getByRole('region', { name: 'Activity & Work Log' })).toBeTruthy()
  if (role === 'REPORTER') expect(screen.getByText('No action required from you right now.')).toBeTruthy()
})

test.each(cases)('%s opens from workspace, saves on the same route and immediately refreshes activity', async (name, field, submit, eventLabel, endpoint) => {
  mount()
  const work = await screen.findByRole('region', { name: 'Work on Incident' })
  if (name !== 'Record Investigation') fireEvent.click(within(work).getByRole('button', { name, exact: true }))
  const modal = name === 'Log Work on This Incident' ? screen.getByRole('dialog', { name }) : work
  if (name === 'Resolve Incident') await within(work).findByRole('button', { name: 'Confirm Resolution' })
  fireEvent.change(within(modal).getByLabelText(field), { target: { value: 'Verified VPN connectivity' } })
  if (endpoint === '/investigation') {
    expect(within(modal).getByLabelText('Screenshots / Supporting Images')).toBeTruthy()
    fireEvent.click(within(modal).getByText('Additional investigation details'))
    expect(within(modal).getByLabelText(/^Root Cause/).value).toBe('Existing cause')
  }
  fireEvent.click(within(modal).getByRole('button', { name: submit, exact: true }))
  expect(await screen.findByText(eventLabel)).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByLabelText('Current route').textContent).toBe('/incidents/12')
  expect(apiClient.post.mock.calls[0][0]).toBe(`/api/incidents/12${endpoint}`)
  expect(apiClient.get.mock.calls.filter(([url]) => url.endsWith('/history')).length).toBeGreaterThanOrEqual(2)
  expect(apiClient.get.mock.calls.filter(([url]) => url.endsWith('/12')).length).toBeGreaterThanOrEqual(2)
  if (endpoint === '/resolve') {
    expect(screen.queryByText('Issue reported as still unresolved')).toBeNull()
    expect(screen.getByText(/Resolved \(current\)/)).toBeTruthy()
  }
  if (endpoint === '/investigation') expect(apiClient.post.mock.calls[0][1].rootCause).toBe('Existing cause')
})

test('More Actions still opens existing operational forms in the workspace', async () => {
  mount()
  const work = await screen.findByRole('region', { name: 'Work on Incident' })
  fireEvent.click(within(work).getByText('More Actions'))
  expect(work.querySelector('.more-actions').open).toBe(true)
  fireEvent.click(within(work).getByRole('button', { name: 'Reassess Priority' }))
  expect(screen.getByRole('dialog', { name: 'Reassess Priority' })).toBeTruthy()
  expect(screen.getByLabelText('Current route').textContent).toBe('/incidents/12')
})

test.each(cases)('%s preserves typed values and selected images across the polling interval', async (name, field) => {
  vi.useFakeTimers()
  mount()
  await act(async () => { await Promise.resolve() })
  const work = screen.getByRole('region', { name: 'Work on Incident' })
  if (name !== 'Record Investigation') fireEvent.click(within(work).getByRole('button', { name, exact: true }))
  await act(async () => { await Promise.resolve() })
  const modal = name === 'Log Work on This Incident' ? screen.getByRole('dialog') : work
  const input = within(modal).getByLabelText(field)
  fireEvent.change(input, { target: { value: 'Still typing' } })
  if (name === 'Record Investigation') fireEvent.change(within(modal).getByLabelText('Screenshots / Supporting Images'), { target: { files: [new File(['image'], 'vpn.png', { type: 'image/png' })] } })
  const calls = apiClient.get.mock.calls.length
  await act(async () => { await vi.advanceTimersByTimeAsync(60000) })
  expect(apiClient.get).toHaveBeenCalledTimes(calls)
  expect(name === 'Log Work on This Incident' ? screen.getByRole('dialog') : screen.getByRole('region', { name: 'Work on Incident' })).toBe(modal)
  expect(input.value).toBe('Still typing')
  if (name === 'Record Investigation') expect(within(modal).getByRole('button', { name: 'Remove vpn.png' })).toBeTruthy()
})

test('Activity filters retain backend order without fetching or modifying the source history', async () => {
  history = ['INCIDENT_CREATED', 'WORK_NOTE', 'INVESTIGATION_UPDATED', 'ATTACHMENT_ADDED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'INCIDENT_RESOLVED'].map((actionType, index) => ({ id: index + 1, actionType, changedBy: 'handler@example.test', changedAt: '2026-10-15T11:00:00', remarks: `Entry ${index + 1}` }))
  mount()
  const activity = await screen.findByRole('region', { name: 'Activity & Work Log' })
  const calls = apiClient.get.mock.calls.length
  const original = JSON.stringify(history)
  for (const [filter, ids] of [['Work Notes', [2]], ['Updates', [3, 4, 6]], ['Lifecycle', [1, 5, 7]], ['All', [1, 2, 3, 4, 5, 6, 7]]]) {
    fireEvent.click(within(activity).getByRole('button', { name: filter, exact: true }))
    expect(within(activity).getByRole('button', { name: filter }).getAttribute('aria-pressed')).toBe('true')
    if (filter === 'All') fireEvent.click(within(activity).getByRole('button', { name: 'View full activity' }))
    expect(within(activity).getAllByRole('listitem').map((item) => item.textContent.match(/Entry (\d+)/)[1])).toEqual(ids.map(String))
  }
  expect(apiClient.get).toHaveBeenCalledTimes(calls)
  expect(JSON.stringify(history)).toBe(original)
})

test('empty filter offers a clear message without hiding the other categories', async () => {
  history = [{ id: 1, actionType: 'INCIDENT_CREATED', changedBy: 'handler@example.test' }]
  mount()
  const activity = await screen.findByRole('region', { name: 'Activity & Work Log' })
  fireEvent.click(within(activity).getByRole('button', { name: 'Work Notes' }))
  expect(within(activity).getByText('No activity matches this filter.')).toBeTruthy()
  fireEvent.click(within(activity).getByRole('button', { name: 'All' }))
  expect(within(activity).getByText('Incident Created')).toBeTruthy()
})

test('More Actions closes on selection and Escape while preserving access to all actions', async () => {
  mount()
  const work = await screen.findByRole('region', { name: 'Work on Incident' })
  const menu = work.querySelector('details.more-actions')
  fireEvent.click(within(work).getByText('More Actions'))
  expect(menu.open).toBe(true)
  fireEvent.click(within(menu).getByRole('button', { name: 'Reassess Priority' }))
  expect(menu.open).toBe(false)
  expect(screen.getByRole('dialog', { name: 'Reassess Priority' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  fireEvent.click(within(work).getByText('More Actions'))
  fireEvent.keyDown(menu, { key: 'Escape' })
  expect(menu.open).toBe(false)
  expect(document.activeElement).toBe(menu.querySelector('summary'))
})
