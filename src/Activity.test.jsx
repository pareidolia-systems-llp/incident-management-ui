import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AuthContext from './auth/AuthContext'
import IncidentDetails from './pages/IncidentDetails'
import IncidentList from './pages/IncidentList'
import Dashboard from './pages/Dashboard'
import usePolling from './hooks/usePolling'
import apiClient from './api/client'

vi.mock('./api/client', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
const user = { role: 'IT_HANDLER', email: 'handler@example.test' }
let incident, history
beforeEach(() => {
  vi.resetAllMocks()
  incident = { id: 12, incidentNumber: 'INC-12', title: 'VPN', status: 'IN_PROGRESS', reportedBy: 'reporter@example.test' }
  history = []
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  apiClient.get.mockImplementation(async (url) => ({ data: url.endsWith('/history') ? history : url.endsWith('/attachments') ? [] : url.endsWith('/12') ? incident : [incident] }))
  apiClient.post.mockResolvedValue({ data: incident })
})
afterEach(() => { cleanup(); vi.useRealTimers() })
function mount(page, role = 'IT_HANDLER') {
  return render(<AuthContext.Provider value={{ user: { ...user, role } }}><MemoryRouter initialEntries={['/incidents/12']}><Routes><Route path="/incidents/:id" element={page} /></Routes></MemoryRouter></AuthContext.Provider>)
}
async function tick() { await act(async () => { await vi.advanceTimersByTimeAsync(30000) }) }
async function flush() { await act(async () => { await Promise.resolve() }) }

test.each([false, true])('list attention badge matches backend flag %s', async (active) => {
  incident.issueStillPersists = active
  mount(<IncidentList />)
  await screen.findByText('INC-12')
  expect(Boolean(screen.queryByText('ISSUE STILL PERSISTS'))).toBe(active)
  expect(within(screen.getByRole('table')).getByText('IN PROGRESS')).toBeTruthy()
})
test('dashboard counts flagged incidents, and polling updates count without loading flicker', async () => {
  mount(<Dashboard />)
  await screen.findByText('Issues Still Persisting')
  const card = screen.getByText('Issues Still Persisting').closest('.card')
  expect(within(card).getByText('0')).toBeTruthy()
  vi.useFakeTimers()
  // Re-mount under fake timers so the interval is controlled.
  cleanup(); mount(<Dashboard />); await flush()
  incident = { ...incident, issueStillPersists: true }
  await tick()
  expect(within(screen.getByText('Issues Still Persisting').closest('.card')).getByText('1')).toBeTruthy()
})
test('list polls attention while preserving filter text and timers stop on unmount', async () => {
  vi.useFakeTimers()
  const view = mount(<IncidentList />); await flush()
  const search = screen.getByPlaceholderText('Number, title, or owner')
  fireEvent.change(search, { target: { value: 'VPN' } })
  incident = { ...incident, issueStillPersists: true }
  await tick()
  expect(screen.getByText('ISSUE STILL PERSISTS')).toBeTruthy()
  expect(search.value).toBe('VPN')
  view.unmount()
  const calls = apiClient.get.mock.calls.length
  await tick()
  expect(apiClient.get).toHaveBeenCalledTimes(calls)
  expect(vi.getTimerCount()).toBe(0)
})
test('details polling retains feedback history after warning clears and pauses for typed work notes', async () => {
  vi.useFakeTimers()
  mount(<IncidentDetails />); await flush()
  history = [{ id: 1, actionType: 'RESOLUTION_NOT_ACCEPTED', changedBy: 'reporter@example.test', changedAt: '2026-10-15T10:00:00', remarks: 'Still disconnected' }]
  incident = { ...incident, issueStillPersists: true, issueStillPersistsReportedBy: 'reporter@example.test', issueStillPersistsAt: '2026-10-15T10:00:00' }
  await tick()
  expect(screen.getByText('Issue reported as still unresolved')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Log Work on This Incident' }))
  const modal = screen.getByRole('dialog')
  const input = within(modal).getByLabelText(/^Work Note/)
  fireEvent.change(input, { target: { value: 'Rechecking gateway' } })
  const calls = apiClient.get.mock.calls.length
  incident = { ...incident, status: 'RESOLVED', issueStillPersists: false }
  await tick()
  expect(apiClient.get).toHaveBeenCalledTimes(calls)
  expect(input.value).toBe('Rechecking gateway')
  expect(screen.getByRole('dialog')).toBe(modal)
  fireEvent.click(within(modal).getByRole('button', { name: 'Cancel' }))
  await tick()
  expect(screen.queryByText('Issue reported as still unresolved')).toBeNull()
  expect(screen.getByText('Issue Still Persists')).toBeTruthy()
  expect(screen.getByText('Still disconnected')).toBeTruthy()
})
test('work note submits plain text and renders activity, actor, timestamp and initial-value wording', async () => {
  apiClient.post.mockImplementation(async () => {
    history = [{ id: 1, actionType: 'WORK_NOTE', remarks: 'Checked logs', changedBy: user.email, changedAt: '2026-10-15T10:00:00' }, { id: 2, actionType: 'PRIORITY_CHANGED', newValue: 'HIGH', changedBy: user.email, changedAt: '2026-10-15T10:01:00' }]
    return { data: incident }
  })
  mount(<IncidentDetails />)
  fireEvent.click(await screen.findByRole('button', { name: 'Log Work on This Incident' }))
  const modal = screen.getByRole('dialog')
  fireEvent.change(within(modal).getByLabelText(/^Work Note/), { target: { value: '  Checked logs  ' } })
  fireEvent.click(within(modal).getByRole('button', { name: 'Log Work on This Incident' }))
  expect(await screen.findByText('Work note added')).toBeTruthy()
  expect(screen.getByText('Checked logs')).toBeTruthy()
  expect(screen.getByText('Priority set to HIGH')).toBeTruthy()
  expect(screen.getByText(`Added by ${user.email}`)).toBeTruthy()
  expect(screen.getByText(`Changed by ${user.email}`)).toBeTruthy()
  expect(document.querySelectorAll('.audit-timeline time')).toHaveLength(2)
  expect(apiClient.post).toHaveBeenCalledWith('/api/incidents/12/work-notes', { remarks: 'Checked logs' })
})
test.each(['REPORTER', 'REVIEWER'])('%s cannot add operational notes', async (role) => {
  mount(<IncidentDetails />, role)
  await screen.findByText('No screenshots attached.')
  expect(screen.queryByRole('button', { name: 'Log Work on This Incident' })).toBeNull()
})
test.each(['none', 'success', 'failure'])('investigation screenshots: %s', async (mode) => {
  let saved = false
  apiClient.post.mockImplementation(async (url) => {
    if (url.endsWith('/attachments')) {
      expect(saved).toBe(true)
      if (mode === 'failure') throw new Error('Upload failed')
      return { data: [] }
    }
    saved = true
    incident = { ...incident, investigationDetails: 'Checked authentication logs' }
    return { data: incident }
  })
  mount(<IncidentDetails />)
  fireEvent.click(await screen.findByRole('button', { name: 'Record Investigation' }))
  const modal = screen.getByRole('dialog')
  fireEvent.change(within(modal).getByLabelText(/^Investigation Details/), { target: { value: 'Checked authentication logs' } })
  const picker = within(modal).getByLabelText('Screenshots / Supporting Images')
  if (mode !== 'none') fireEvent.change(picker, { target: { files: [new File(['image'], 'vpn.png', { type: 'image/png' })] } })
  fireEvent.click(within(modal).getByRole('button', { name: 'Save Investigation Findings' }))
  expect(await screen.findByText('Checked authentication logs')).toBeTruthy()
  expect(apiClient.post).toHaveBeenCalledTimes(mode === 'none' ? 1 : 2)
  if (mode === 'failure') {
    expect(screen.getByRole('alert').textContent).toContain('Investigation was updated successfully, but one or more screenshots could not be uploaded.')
    expect(await screen.findByRole('button', { name: 'Upload screenshots' })).toBeTruthy()
  }
})
test('polling serializes slow reads, pauses hidden tabs, tolerates failures and cleans up', async () => {
  vi.useFakeTimers()
  let finish
  const load = vi.fn().mockImplementationOnce(() => new Promise((resolve) => { finish = resolve })).mockRejectedValue(new Error('Offline'))
  function Probe() { usePolling(load); return <div>Usable</div> }
  const view = render(<Probe />); await flush()
  await tick(); await tick()
  expect(load).toHaveBeenCalledTimes(1)
  await act(async () => finish())
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
  await tick(); expect(load).toHaveBeenCalledTimes(1)
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  await tick(); await tick(); expect(load).toHaveBeenCalledTimes(3)
  expect(screen.getByText('Usable')).toBeTruthy()
  view.unmount(); expect(vi.getTimerCount()).toBe(0)
})


test('a failed background list refresh keeps the existing table and filter usable', async () => {
  vi.useFakeTimers()
  mount(<IncidentList />); await flush()
  apiClient.get.mockRejectedValue(new Error('Temporary outage'))
  await tick()
  expect(screen.getByText('INC-12')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
  fireEvent.change(screen.getByPlaceholderText('Number, title, or owner'), { target: { value: 'VPN' } })
  expect(screen.getByText('INC-12')).toBeTruthy()
})

test('a polling response arriving after a modal opens cannot replace the form or its data', async () => {
  vi.useFakeTimers()
  mount(<IncidentDetails />); await flush()
  let finish
  apiClient.get.mockImplementation((url) => url.endsWith('/12')
    ? new Promise((resolve) => { finish = resolve }) : Promise.resolve({ data: [] }))
  await tick()
  fireEvent.click(screen.getByRole('button', { name: 'Record Investigation' }))
  const modal = screen.getByRole('dialog')
  const field = within(modal).getByLabelText(/^Investigation Details/)
  fireEvent.change(field, { target: { value: 'Unsaved analysis' } })
  await act(async () => finish({ data: { ...incident, issueStillPersists: true } }))
  expect(field.value).toBe('Unsaved analysis')
  expect(screen.getByRole('dialog')).toBe(modal)
  expect(screen.queryByText('Issue reported as still unresolved')).toBeNull()
})

test('failed investigation preserves input and screenshots and never starts attachment upload', async () => {
  apiClient.post.mockRejectedValue({ response: { status: 409, data: { message: 'Incident state changed.' } } })
  mount(<IncidentDetails />)
  fireEvent.click(await screen.findByRole('button', { name: 'Record Investigation' }))
  const modal = screen.getByRole('dialog')
  const field = within(modal).getByLabelText(/^Investigation Details/)
  fireEvent.change(field, { target: { value: 'Unsaved investigation' } })
  fireEvent.change(within(modal).getByLabelText('Screenshots / Supporting Images'), { target: { files: [new File(['image'], 'vpn.png', { type: 'image/png' })] } })
  fireEvent.click(within(modal).getByRole('button', { name: 'Save Investigation Findings' }))
  expect(await within(modal).findByRole('alert')).toBeTruthy()
  expect(field.value).toBe('Unsaved investigation')
  expect(within(modal).getByRole('button', { name: 'Remove vpn.png' })).toBeTruthy()
  expect(apiClient.post).toHaveBeenCalledTimes(1)
  expect(apiClient.post.mock.calls[0][0]).toBe('/api/incidents/12/investigation')
})

test('activity hides attachment IDs, labels actors and presents reporter feedback only once', async () => {
  const common = { changedBy: 'reporter@example.test', changedAt: '2026-10-15T10:00:00' }
  const feedback = 'Reporter feedback: VPN still disconnects.\nEvidence reference: Support ticket 42'
  history = [
    { ...common, id: 1, actionType: 'INCIDENT_CREATED', newValue: 'INC-12' },
    { ...common, id: 2, actionType: 'ATTACHMENT_ADDED', newValue: '398765', remarks: 'Screenshot added: vpn.png' },
    { ...common, id: 3, actionType: 'RESOLUTION_NOT_ACCEPTED', oldValue: 'RESOLVED', newValue: 'IN_PROGRESS', remarks: feedback },
    { ...common, id: 4, actionType: 'STATUS_CHANGED', oldValue: 'RESOLVED', newValue: 'IN_PROGRESS', remarks: feedback },
  ]
  mount(<IncidentDetails />)
  await screen.findByText('Issue Still Persists')
  const timeline = document.querySelector('.audit-timeline')
  expect(timeline.textContent).not.toContain('398765')
  expect(within(timeline).getByText('Screenshot added: vpn.png')).toBeTruthy()
  expect(within(timeline).getByText('Created by reporter@example.test')).toBeTruthy()
  expect(within(timeline).getByText('Uploaded by reporter@example.test')).toBeTruthy()
  expect(within(timeline).getByText('Reported by reporter@example.test')).toBeTruthy()
  expect(within(timeline).getByText('The reporter indicated that the previous resolution did not solve the problem.')).toBeTruthy()
  expect(within(timeline).getByText('Feedback:')).toBeTruthy()
  expect(within(timeline).getAllByText(/VPN still disconnects/)).toHaveLength(1)
  expect(timeline.textContent).toContain('Evidence reference: Support ticket 42')
  const statusEntry = within(timeline).getByText('Status Changed').closest('li')
  expect(within(statusEntry).getByText('RESOLVED → IN PROGRESS')).toBeTruthy()
  expect(statusEntry.textContent).not.toContain('VPN still disconnects')
  expect(history[3].remarks).toBe(feedback)
})

test('status and attention badges are distinct siblings in a wrapping layout', async () => {
  incident.issueStillPersists = true
  mount(<IncidentList />)
  await screen.findByText('INC-12')
  const table = within(screen.getByRole('table'))
  const status = table.getByText('IN PROGRESS')
  const attention = table.getByText('ISSUE STILL PERSISTS')
  expect(status).not.toBe(attention)
  expect(status.parentElement).toBe(attention.parentElement)
  expect(status.parentElement.classList.contains('d-flex')).toBe(true)
  expect(status.parentElement.classList.contains('flex-wrap')).toBe(true)
  expect(status.parentElement.classList.contains('gap-1')).toBe(true)
  expect(status.classList.contains('badge-status')).toBe(true)
  expect(attention.classList.contains('badge-attention')).toBe(true)
  expect(attention.classList.contains('ms-2')).toBe(false)
})

test('collapsed activity shows latest five matching entries and full history remains accessible', async () => {
  history = Array.from({ length: 14 }, (_, i) => ({ id: i + 1, actionType: i % 2 ? 'WORK_NOTE' : 'SEVERITY_CHANGED', remarks: 'Entry ' + (i + 1), changedBy: user.email, changedAt: '2026-10-16T10:00:00' }))
  mount(<IncidentDetails />)
  const activity = await screen.findByRole('region', { name: 'Activity & Work Log' })
  const entries = () => [...activity.querySelectorAll('.audit-remarks')].map(n => n.textContent.replace('Reason:', ''))
  expect(entries()).toEqual(['Entry 10', 'Entry 11', 'Entry 12', 'Entry 13', 'Entry 14'])
  fireEvent.click(within(activity).getByRole('button', { name: 'View full activity' }))
  expect(entries()).toHaveLength(14)
  expect(entries()[0]).toBe('Entry 1')
  fireEvent.click(within(activity).getByRole('button', { name: 'Show recent activity' }))
  expect(entries()).toHaveLength(5)
  fireEvent.click(within(activity).getByRole('button', { name: 'Work Notes', exact: true }))
  expect(entries()).toEqual(['Entry 6', 'Entry 8', 'Entry 10', 'Entry 12', 'Entry 14'])
  fireEvent.click(within(activity).getByRole('button', { name: 'View full activity' }))
  expect(entries()).toHaveLength(7)
  fireEvent.click(within(activity).getByRole('button', { name: 'Updates', exact: true }))
  expect(entries()).toEqual(['Entry 5', 'Entry 7', 'Entry 9', 'Entry 11', 'Entry 13'])
  fireEvent.click(within(activity).getByRole('button', { name: 'Lifecycle', exact: true }))
  expect(within(activity).getByText('No activity matches this filter.')).toBeTruthy()
  expect(within(activity).queryByRole('button', { name: 'View full activity' })).toBeNull()
  expect(history).toHaveLength(14)
})

test.each(['severity', 'priority'])('reassessing %s requires a reason and displays it with the change', async field => {
  incident[field] = 'LOW'
  apiClient.post.mockImplementation(async (url, payload) => {
    incident[field] = payload[field]
    history = [{ id: 1, actionType: field.toUpperCase() + '_CHANGED', oldValue: 'LOW', newValue: 'HIGH', remarks: payload.remarks, changedBy: user.email, changedAt: '2026-10-16T10:00:00' }]
    return { data: incident }
  })
  mount(<IncidentDetails />)
  fireEvent.click(await screen.findByText('More Actions'))
  fireEvent.click(screen.getByRole('button', { name: field === 'severity' ? 'Reassess Severity' : 'Reassess Priority' }))
  const modal = screen.getByRole('dialog')
  expect(within(modal).getByText('Current ' + field + ':')).toBeTruthy()
  fireEvent.change(within(modal).getByLabelText('New ' + field, { exact: false }), { target: { value: 'HIGH' } })
  fireEvent.change(within(modal).getByLabelText(/^Reason for reassessment/), { target: { value: '   ' } })
  fireEvent.click(within(modal).getByRole('button', { name: field === 'severity' ? 'Update Severity' : 'Update Priority' }))
  expect(within(modal).getByText('This field is required.')).toBeTruthy()
  expect(apiClient.post).not.toHaveBeenCalled()
  fireEvent.change(within(modal).getByLabelText(/^Reason for reassessment/), { target: { value: '  Multiple users affected  ' } })
  fireEvent.click(within(modal).getByRole('button', { name: field === 'severity' ? 'Update Severity' : 'Update Priority' }))
  expect(await screen.findByText('Reason:')).toBeTruthy()
  expect(screen.getByText('Multiple users affected')).toBeTruthy()
  expect(screen.getByText('LOW → HIGH')).toBeTruthy()
  expect(apiClient.post).toHaveBeenCalledWith('/api/incidents/12/' + field, { [field]: 'HIGH', remarks: 'Multiple users affected' })
})
