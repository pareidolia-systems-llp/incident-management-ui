import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AuthContext from './auth/AuthContext'
import IncidentDetails from './pages/IncidentDetails'
import apiClient from './api/client'
vi.mock('./api/client', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
let incident, history, attachments
beforeEach(() => {
  vi.resetAllMocks()
  incident = { id: 12, incidentNumber: 'INC-12', title: 'VPN', status: 'ASSIGNED', reportedBy: 'reporter@example.test', investigationDetails: 'Existing findings', actionsTaken: 'Existing actions', rootCause: 'Existing cause' }
  history = []; attachments = []
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
  apiClient.get.mockImplementation(async url => ({ data: url.endsWith('/history') ? history : url.endsWith('/attachments') ? attachments : incident }))
  apiClient.post.mockImplementation(save)
})
afterEach(() => { cleanup(); vi.useRealTimers() })
async function save(url, payload) {
  if (url.endsWith('/attachments')) {
    attachments = [{ id: 1, originalFilename: 'vpn.png', fileSize: 3 }]
    history.push({ id: history.length + 1, actionType: 'ATTACHMENT_ADDED', remarks: 'Screenshot added: vpn.png' })
    return { data: attachments }
  }
  if (url.endsWith('/investigation')) {
    incident = { ...incident, ...payload, status: 'IN_PROGRESS' }
    history.push({ id: history.length + 1, actionType: 'INVESTIGATION_UPDATED', newValue: payload.investigationDetails })
  }
  if (url.endsWith('/resolve')) {
    incident = { ...incident, resolutionDetails: payload.resolutionDetails, status: 'RESOLVED' }
    history.push({ id: history.length + 1, actionType: 'INCIDENT_RESOLVED', newValue: payload.resolutionDetails })
  }
  return { data: incident }
}
function Location() { return <output aria-label="Current route">{useLocation().pathname}</output> }
async function mount(role = 'ADMIN') {
  render(<AuthContext.Provider value={{ user: { role, email: role === 'REPORTER' ? incident.reportedBy : 'it@example.test' } }}><MemoryRouter initialEntries={['/incidents/12']}><Location /><Routes><Route path="/incidents/:id" element={<IncidentDetails />} /></Routes></MemoryRouter></AuthContext.Provider>)
  await screen.findByRole('heading', { name: 'INC-12' })
}
const work = () => screen.getByRole('region', { name: 'Work on Incident' })
function edit() {
  fireEvent.change(within(work()).getByLabelText(/^Investigation Details/), { target: { value: 'Certificate expired' } })
  fireEvent.change(within(work()).getByLabelText(/^Actions Taken/), { target: { value: 'Renewed certificate' } })
}
function selectImage() { fireEvent.change(within(work()).getByLabelText('Screenshots / Supporting Images'), { target: { files: [new File(['png'], 'vpn.png', { type: 'image/png' })] } }) }
async function openResolution() {
  fireEvent.click(within(work()).getByRole('button', { name: 'Resolve Incident', exact: true }))
  return screen.findByRole('region', { name: 'Resolution', exact: true })
}
function confirm() {
  fireEvent.change(within(work()).getByLabelText(/^Resolution Details/), { target: { value: 'Connectivity restored' } })
  fireEvent.click(within(work()).getByRole('button', { name: 'Confirm Resolution' }))
}
test.each(['ADMIN', 'IT_HANDLER'])('%s can immediately edit findings/actions in working states', async role => {
  await mount(role)
  expect(within(work()).getByLabelText(/^Investigation Details/).value).toBe('Existing findings')
  expect(within(work()).getByLabelText(/^Actions Taken/).value).toBe('Existing actions')
  expect(screen.queryByRole('button', { name: 'Record Investigation' })).toBeNull()
  expect(screen.queryByRole('dialog')).toBeNull()
  edit()
  expect(within(work()).getByRole('button', { name: 'Save Progress' }).disabled).toBe(false)
})
test.each(['OPEN', 'RESOLVED', 'VALIDATED', 'CLOSED'])('%s does not expose editable investigation', async status => {
  incident.status = status
  await mount()
  expect(screen.queryByLabelText(/^Investigation Details/)).toBeNull()
  expect(screen.queryByLabelText(/^Actions Taken/)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Save Progress' })).toBeNull()
})
test('reporter cannot see operational fields', async () => {
  await mount('REPORTER')
  expect(screen.queryByLabelText(/^Investigation Details/)).toBeNull()
  expect(screen.queryByLabelText(/^Actions Taken/)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Resolve Incident' })).toBeNull()
  expect(screen.queryByText('More Actions')).toBeNull()
})
test('Resolve selection saves unsaved investigation and images first, then confirms once on the same route', async () => {
  let finish
  apiClient.post.mockImplementation((url, payload) => url.endsWith('/investigation') ? new Promise(resolve => { finish = async () => resolve(await save(url, payload)) }) : save(url, payload))
  await mount(); edit(); selectImage()
  fireEvent.click(within(work()).getByRole('button', { name: 'Resolve Incident' }))
  expect(apiClient.post).toHaveBeenCalledTimes(1)
  expect(apiClient.post.mock.calls[0][0]).toBe('/api/incidents/12/investigation')
  expect(screen.queryByRole('button', { name: 'Confirm Resolution' })).toBeNull()
  await act(async () => finish())
  await screen.findByRole('button', { name: 'Confirm Resolution' })
  expect(apiClient.post.mock.calls.map(([url]) => url)).toEqual(['/api/incidents/12/investigation', '/api/incidents/12/attachments'])
  expect(within(work()).getByLabelText(/^Investigation Details/).value).toBe('Certificate expired')
  expect(within(work()).queryByRole('button', { name: 'Remove vpn.png' })).toBeNull()
  expect(await screen.findByText('Investigation Updated')).toBeTruthy()
  expect(screen.getByText('Attachment Added')).toBeTruthy()
  confirm()
  await screen.findByText('Incident Resolved')
  expect(apiClient.post.mock.calls.map(([url]) => url)).toEqual(['/api/incidents/12/investigation', '/api/incidents/12/attachments', '/api/incidents/12/resolve'])
  expect(screen.getByLabelText('Current route').textContent).toBe('/incidents/12')
  expect(screen.queryByLabelText(/^Investigation Details/)).toBeNull()
})
test('failed auto-save retains fields/images and blocks resolution', async () => {
  apiClient.post.mockRejectedValue(new Error('Save failed'))
  await mount(); edit(); selectImage()
  fireEvent.click(within(work()).getByRole('button', { name: 'Resolve Incident' }))
  await within(work()).findByRole('alert')
  expect(apiClient.post).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: 'Confirm Resolution' })).toBeNull()
  expect(within(work()).getByLabelText(/^Investigation Details/).value).toBe('Certificate expired')
  expect(within(work()).getByLabelText(/^Actions Taken/).value).toBe('Renewed certificate')
  expect(within(work()).getByRole('button', { name: 'Remove vpn.png' })).toBeTruthy()
})
test('image failure retains the saved investigation and warns while inline resolution can continue', async () => {
  apiClient.post.mockImplementation((url, payload) => url.endsWith('/attachments') ? Promise.reject(new Error('Upload failed')) : save(url, payload))
  await mount(); edit(); selectImage(); await openResolution()
  expect(screen.getByRole('alert').textContent).toContain('Investigation was updated successfully')
  expect(screen.getByRole('alert').textContent).toContain('Attachments section')
  confirm(); await screen.findByText('Incident Resolved')
  expect(apiClient.post.mock.calls.filter(([url]) => url.endsWith('/investigation'))).toHaveLength(1)
  expect(apiClient.post.mock.calls.filter(([url]) => url.endsWith('/attachments'))).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'Upload screenshots' })).toBeTruthy()
})
test('new edits after opening resolution save before confirmation; resolution retry does not repeat investigation', async () => {
  await mount(); await openResolution(); edit()
  let fail = true
  apiClient.post.mockImplementation((url, payload) => url.endsWith('/resolve') && fail ? Promise.reject(new Error('Resolution failed')) : save(url, payload))
  confirm(); await within(work()).findByRole('alert')
  expect(within(work()).getByLabelText(/^Resolution Details/).value).toBe('Connectivity restored')
  expect(apiClient.post.mock.calls.map(([url]) => url)).toEqual(['/api/incidents/12/investigation', '/api/incidents/12/resolve'])
  fail = false
  fireEvent.click(within(work()).getByRole('button', { name: 'Confirm Resolution' }))
  await screen.findByText('Incident Resolved')
  expect(apiClient.post.mock.calls.filter(([url]) => url.endsWith('/investigation'))).toHaveLength(1)
})
test('Save Progress then Resolve does not create an extra investigation event', async () => {
  await mount(); edit()
  fireEvent.click(within(work()).getByRole('button', { name: 'Save Progress' }))
  await screen.findByText('Investigation progress saved.')
  await waitFor(() => expect(within(work()).getByRole('button', { name: 'Resolve Incident' }).disabled).toBe(false))
  await openResolution(); confirm(); await screen.findByText('Incident Resolved')
  expect(apiClient.post.mock.calls.filter(([url]) => url.endsWith('/investigation'))).toHaveLength(1)
})
test('focus and polling cannot remove local investigation, images, or inline resolution', async () => {
  await mount(); await openResolution()
  await waitFor(() => expect(within(work()).getByRole('button', { name: 'Save Progress' }).textContent).toBe('Save Progress'))
  edit(); selectImage()
  fireEvent.change(within(work()).getByLabelText(/^Resolution Details/), { target: { value: 'Draft resolution' } })
  const calls = apiClient.get.mock.calls.length
  vi.useFakeTimers()
  fireEvent.focus(window)
  fireEvent(document, new Event('visibilitychange'))
  await act(async () => { await vi.advanceTimersByTimeAsync(30000) })
  expect(apiClient.get).toHaveBeenCalledTimes(calls)
  expect(within(work()).getByLabelText(/^Investigation Details/).value).toBe('Certificate expired')
  expect(within(work()).getByLabelText(/^Resolution Details/).value).toBe('Draft resolution')
  expect(within(work()).getByRole('button', { name: 'Remove vpn.png' })).toBeTruthy()
})
