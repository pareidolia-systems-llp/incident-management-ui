import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AuthContext from './auth/AuthContext'
import IncidentDetails from './pages/IncidentDetails'
import IncidentAttachments from './components/IncidentAttachments'
import apiClient from './api/client'

vi.mock('./phase2Feature', () => ({ phase2Enabled: true, phase2ErrorMessage: error => error?.response?.status === 409 ? 'The incident changed. Refresh it before trying again.' : 'This incident is unavailable.' }))
vi.mock('./api/client', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
afterEach(() => { cleanup(); vi.resetAllMocks() })
const baseMetadata = {
  id: 12, incidentVersion: 5, classification: 'STANDARD', routingState: 'READY', status: 'ASSIGNED',
  responsibleDepartments: [{ id: 7, name: 'Synthetic IT' }], assignedHandler: { id: 9, name: 'Synthetic Handler' },
  actions: { canClassify: false, canAssign: false, canInvestigate: false, canResolve: false, canValidate: false, canRejectResolution: false, canClose: false },
}
let activeMetadata
const incident = { id: 12, incidentNumber: 'INC-12', title: 'Synthetic', status: 'ASSIGNED', reportedBy: 'reporter@example.test', incidentVersion: 5 }
function mockReads() {
  activeMetadata = { ...baseMetadata, actions: { ...baseMetadata.actions }, responsibleDepartments: [...baseMetadata.responsibleDepartments] }
  apiClient.get.mockImplementation(async url => ({ data: url.endsWith('/metadata') ? activeMetadata : url.endsWith('/history') || url.endsWith('/attachments') ? [] : incident }))
}
function mount(role) {
  render(<AuthContext.Provider value={{ user: { role, email: 'reporter@example.test' } }}><MemoryRouter initialEntries={['/incidents/12']}><Routes><Route path="/incidents/:id" element={<IncidentDetails />} /></Routes></MemoryRouter></AuthContext.Provider>)
}
test.each(['REPORTER', 'ADMIN', 'IT_HANDLER'])('Phase 2 keeps actions disabled without server permissions for %s', async role => {
  mockReads()
  mount(role)
  expect(await screen.findByText('Synthetic IT')).toBeTruthy()
  expect(apiClient.get).toHaveBeenCalledWith('/api/v2/incidents/12/metadata')
  expect(screen.getByText('STANDARD')).toBeTruthy()
  expect(screen.getByText('READY')).toBeTruthy()
  expect(screen.getByText('Synthetic Handler')).toBeTruthy()
  expect(screen.getByText('5')).toBeTruthy()
  for (const name of ['Validate Incident', 'Issue Still Persists', 'Close Incident', 'Resolve Incident', 'Assign Incident']) expect(screen.queryByRole('button', { name })).toBeNull()
})
test('unauthorized detail does not display confidential response data', async () => {
  apiClient.get.mockRejectedValue({ response: { status: 404, data: { message: 'secret complaint' } } })
  mount('ADMIN')
  expect(await screen.findByText('This incident is unavailable.')).toBeTruthy()
  expect(screen.queryByText('secret complaint')).toBeNull()
})

test('metadata denial hides otherwise successful incident details', async () => {
  apiClient.get.mockImplementation(async url => {
    if (url.endsWith('/metadata')) throw { response: { status: 404, data: { message: 'private HR complaint' } } }
    return { data: url.endsWith('/history') ? [] : { ...incident, title: 'private HR complaint' } }
  })
  mount('ADMIN')
  expect(await screen.findByText('This incident is unavailable.')).toBeTruthy()
  expect(screen.queryByText('private HR complaint')).toBeNull()
})

test('authorized reporter action uses server flag and expected version, then refreshes metadata', async () => {
  mockReads()
  activeMetadata.actions.canValidate = true
  apiClient.post.mockResolvedValue({ data: {} })
  mount('REPORTER')
  fireEvent.click(await screen.findByRole('button', { name: 'Validate Incident' }))
  fireEvent.change(screen.getByLabelText(/^Validation Details/), { target: { value: 'Confirmed fixed' } })
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Validate Incident', exact: true }))
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/incidents/12/validate', { validationDetails: 'Confirmed fixed', remarks: '', expectedVersion: 5 }))
  await waitFor(() => expect(apiClient.get.mock.calls.filter(([url]) => url.endsWith('/metadata')).length).toBeGreaterThan(1))
})

test('handler actions follow server metadata and include expectedVersion', async () => {
  mockReads()
  activeMetadata.actions.canInvestigate = true
  apiClient.post.mockResolvedValue({ data: {} })
  mount('ADMIN')
  expect(await screen.findByRole('region', { name: 'Work on Incident' })).toBeTruthy()
  fireEvent.change(screen.getByLabelText(/^Investigation Details/), { target: { value: 'Checked logs' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save Progress' }))
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/incidents/12/investigation', expect.objectContaining({ expectedVersion: 5, investigationDetails: 'Checked logs' })))
})

test.each([
  ['resolution', 'canResolve', 'Resolve Incident', '/api/incidents/12/resolve', 'resolutionDetails', 'Fixed', { resolutionDetails: 'Fixed', remarks: '', expectedVersion: 5 }],
  ['validation', 'canValidate', 'Validate Incident', '/api/incidents/12/validate', 'validationDetails', 'Confirmed', { validationDetails: 'Confirmed', remarks: '', expectedVersion: 5 }],
  ['feedback', 'canRejectResolution', 'Issue Still Persists', '/api/incidents/12/resolution-feedback', 'feedback', 'Still broken', { feedback: 'Still broken', evidenceReference: '', expectedVersion: 5 }],
  ['closure', 'canClose', 'Close Incident', '/api/incidents/12/close', null, null, { remarks: '', expectedVersion: 5 }],
])('%s sends the server incident version', async (_name, permission, launchLabel, endpoint, field, value, expectedPayload) => {
  mockReads()
  activeMetadata.actions[permission] = true
  apiClient.post.mockResolvedValue({ data: {} })
  mount('REPORTER')
  fireEvent.click(await screen.findByRole('button', { name: launchLabel }))
  if (field) fireEvent.change(screen.getByLabelText(new RegExp(`^${field === 'feedback' ? 'What is still not working' : field === 'resolutionDetails' ? 'Resolution Details' : 'Validation Details'}`)), { target: { value } })
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: launchLabel, exact: true }))
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith(endpoint, expectedPayload))
})

test('409 shows a generic conflict and refreshes the current metadata', async () => {
  mockReads()
  activeMetadata.actions.canResolve = true
  apiClient.post.mockRejectedValue({ response: { status: 409, data: { message: 'confidential raw exception detail' } } })
  mount('IT_HANDLER')
  fireEvent.click(await screen.findByRole('button', { name: 'Resolve Incident' }))
  fireEvent.change(screen.getByLabelText(/^Resolution Details/), { target: { value: 'Restored' } })
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Resolve Incident', exact: true }))
  expect(await screen.findByText('The incident changed. Refresh it before trying again.')).toBeTruthy()
  expect(screen.queryByText('confidential raw exception detail')).toBeNull()
  await waitFor(() => expect(apiClient.get.mock.calls.filter(([url]) => url.endsWith('/metadata')).length).toBeGreaterThan(1))
})

test.each(['REPORTER', 'IT_HANDLER'])('Phase 2 %s uploads with current version and refreshes all reads', async role => {
  mockReads(); activeMetadata.actions.canUploadAttachment = true
  apiClient.post.mockImplementation(async () => { activeMetadata.incidentVersion = 6; return { data: [] } })
  mount(role)
  const input = await screen.findByLabelText('Screenshots / Supporting Images')
  fireEvent.change(input, { target: { files: [new File(['png'], 'proof.png', { type: 'image/png' })] } })
  fireEvent.click(screen.getByRole('button', { name: 'Upload screenshots' }))
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1))
  const [url, form] = apiClient.post.mock.calls[0]
  expect(url).toBe('/api/incidents/12/attachments'); expect(form.get('expectedVersion')).toBe('5')
  await waitFor(() => expect(screen.getByText('6')).toBeTruthy())
  for (const path of ['/api/incidents/12', '/api/incidents/12/history', '/api/v2/incidents/12/metadata', '/api/incidents/12/attachments'])
    expect(apiClient.get.mock.calls.filter(([url]) => url === path).length).toBeGreaterThan(1)
})

test.each([false, undefined])('missing or denied upload permission %s hides upload control', async allowed => {
  mockReads(); activeMetadata.actions.canUploadAttachment = allowed; mount('REPORTER')
  expect(await screen.findByText('Synthetic IT')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Upload screenshots' })).toBeNull()
})

test('upload conflict refreshes metadata without retrying or exposing the response', async () => {
  mockReads(); activeMetadata.actions.canUploadAttachment = true
  apiClient.post.mockImplementation(async () => { activeMetadata.incidentVersion = 6; throw { response: { status: 409, data: { message: 'private data' } } } })
  mount('REPORTER')
  fireEvent.change(await screen.findByLabelText('Screenshots / Supporting Images'), { target: { files: [new File(['png'], 'proof.png', { type: 'image/png' })] } })
  fireEvent.click(screen.getByRole('button', { name: 'Upload screenshots' }))
  expect(await screen.findByText(/incident changed/i)).toBeTruthy()
  expect(screen.queryByText('private data')).toBeNull(); expect(apiClient.post).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(screen.getByText('6')).toBeTruthy())
  expect(screen.getByRole('button', { name: 'Upload screenshots' }).disabled).toBe(true)
})

test.each([401, 403, 404])('denied attachment list %s clears incident and protected filename', async status => {
  mockReads(); activeMetadata.actions.canUploadAttachment = true
  apiClient.get.mockImplementation(async url => {
    if (url.endsWith('/attachments')) throw { response: { status, data: { message: 'private filename' } } }
    return { data: url.endsWith('/metadata') ? activeMetadata : url.endsWith('/history') ? [] : incident }
  })
  mount('REPORTER')
  expect(await screen.findByText('This incident is unavailable.')).toBeTruthy()
  expect(screen.queryByText('Synthetic')).toBeNull(); expect(screen.queryByText('private filename')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Upload screenshots' })).toBeNull()
})

test('denied download removes previously visible protected data', async () => {
  mockReads(); activeMetadata.actions.canUploadAttachment = true
  apiClient.get.mockImplementation(async url => {
    if (url.endsWith('/attachments/99')) throw { response: { status: 403, data: { message: 'private error' } } }
    return { data: url.endsWith('/metadata') ? activeMetadata : url.endsWith('/history') ? [] : url.endsWith('/attachments') ? [{ id: 99, originalFilename: 'private.png', fileSize: 4, uploadedBy: 'private', uploadedAt: null }] : incident }
  })
  mount('REPORTER')
  fireEvent.click(await screen.findByRole('button', { name: 'Download private.png' }))
  expect(await screen.findByText('This incident is unavailable.')).toBeTruthy()
  expect(screen.queryByText('private.png')).toBeNull(); expect(screen.queryByText('Synthetic')).toBeNull()
})

test('revoked upload access is enforced by server and clears protected details', async () => {
  mockReads(); activeMetadata.actions.canUploadAttachment = true
  apiClient.post.mockRejectedValue({ response: { status: 403, data: { message: 'private error' } } })
  mount('REPORTER')
  fireEvent.change(await screen.findByLabelText('Screenshots / Supporting Images'), { target: { files: [new File(['png'], 'proof.png', { type: 'image/png' })] } })
  fireEvent.click(screen.getByRole('button', { name: 'Upload screenshots' }))
  expect(await screen.findByText('This incident is unavailable.')).toBeTruthy()
  expect(screen.queryByText('proof.png')).toBeNull(); expect(screen.queryByText('private error')).toBeNull()
})

test('metadata revocation removes previously rendered incident and attachments', async () => {
  mockReads(); let revoked = false
  apiClient.get.mockImplementation(async url => {
    if (url.endsWith('/metadata') && revoked) throw { response: { status: 403 } }
    return { data: url.endsWith('/metadata') ? activeMetadata : url.endsWith('/history') ? [] : url.endsWith('/attachments') ? [{ id: 99, originalFilename: 'private.png', fileSize: 4, uploadedBy: 'private', uploadedAt: null }] : incident }
  })
  mount('REPORTER'); expect(await screen.findByText('private.png')).toBeTruthy()
  revoked = true; fireEvent.focus(window)
  expect(await screen.findByText('This incident is unavailable.')).toBeTruthy()
  expect(screen.queryByText('private.png')).toBeNull(); expect(screen.queryByText('Synthetic')).toBeNull()
})

test('legacy attachment upload keeps the original multipart contract', async () => {
  apiClient.get.mockResolvedValue({ data: [] }); apiClient.post.mockResolvedValue({ data: [] })
  render(<IncidentAttachments incidentId={12} canUpload onUploaded={vi.fn()} />)
  fireEvent.change(await screen.findByLabelText('Screenshots / Supporting Images'), { target: { files: [new File(['jpeg'], 'legacy.jpg', { type: 'image/jpeg' })] } })
  fireEvent.click(screen.getByRole('button', { name: 'Upload screenshots' }))
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledTimes(1))
  const [url, form] = apiClient.post.mock.calls[0]
  expect(url).toBe('/api/incidents/12/attachments'); expect(form.has('expectedVersion')).toBe(false)
})

async function openWorkNote() {
  fireEvent.click(await screen.findByRole('button', { name: 'Log Work on This Incident' }))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText(/^Work Note \/ Observation/), { target: { value: '  Checked logs  ' } })
  return dialog
}

test('authorized Phase 2 handler sends current version and refreshes incident, history and metadata', async () => {
  mockReads(); activeMetadata.actions.canAddWorkNote = true
  apiClient.post.mockImplementation(async () => { activeMetadata.incidentVersion = 6; return { status: 201, data: {} } })
  mount('IT_HANDLER')
  const dialog = await openWorkNote()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Log Work on This Incident' }))
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/incidents/12/work-notes', { remarks: 'Checked logs', expectedVersion: 5 }))
  await waitFor(() => expect(screen.getByText('6')).toBeTruthy())
  for (const path of ['/api/incidents/12', '/api/incidents/12/history', '/api/v2/incidents/12/metadata'])
    expect(apiClient.get.mock.calls.filter(([url]) => url === path).length).toBeGreaterThan(1)
})

test.each([false, undefined, 'true'])('work-note permission %s never enables action even for ADMIN with investigation access', async permission => {
  mockReads(); activeMetadata.actions.canAddWorkNote = permission; activeMetadata.actions.canInvestigate = true
  mount('ADMIN'); expect(await screen.findByText('Synthetic IT')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Log Work on This Incident' })).toBeNull()
})

test('work-note version conflict refreshes without retrying or leaking backend text', async () => {
  mockReads(); activeMetadata.actions.canAddWorkNote = true
  apiClient.post.mockImplementation(async () => { activeMetadata.incidentVersion = 6; throw { response: { status: 409, data: { message: 'confidential error' } } } })
  mount('IT_HANDLER'); const dialog = await openWorkNote()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Log Work on This Incident' }))
  expect(await screen.findByText('The incident changed. Refresh it before trying again.')).toBeTruthy()
  expect(screen.queryByText('confidential error')).toBeNull(); expect(apiClient.post).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(screen.getByText('6')).toBeTruthy())
})

test.each([401, 403, 404])('work-note HTTP %s clears previously shown incident and history', async status => {
  mockReads(); activeMetadata.actions.canAddWorkNote = true
  apiClient.get.mockImplementation(async url => ({ data: url.endsWith('/metadata') ? activeMetadata : url.endsWith('/history') ? [{ id: 23, actionType: 'WORK_NOTE', remarks: 'old secret note' }] : url.endsWith('/attachments') ? [] : incident }))
  apiClient.post.mockRejectedValue({ response: { status, data: { message: 'raw secret' } } })
  mount('IT_HANDLER'); const dialog = await openWorkNote()
  fireEvent.click(within(dialog).getByRole('button', { name: 'Log Work on This Incident' }))
  expect(await screen.findByText('This incident is unavailable.')).toBeTruthy()
  for (const secret of ['Synthetic', 'old secret note', 'Checked logs', 'raw secret']) expect(screen.queryByText(secret)).toBeNull()
  expect(screen.queryByRole('dialog')).toBeNull()
})

test('pending work-note request cannot be submitted twice', async () => {
  mockReads(); activeMetadata.actions.canAddWorkNote = true
  let finish; apiClient.post.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  mount('IT_HANDLER'); const dialog = await openWorkNote()
  const form = within(dialog).getByRole('button', { name: 'Log Work on This Incident' }).closest('form')
  fireEvent.submit(form); fireEvent.submit(form)
  expect(apiClient.post).toHaveBeenCalledTimes(1)
  finish({ status: 201, data: {} }); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('routing summary explains READY and keeps the technical version available', async () => {
  mockReads(); mount('IT_HANDLER')
  expect(await screen.findByText('Assigned and ready for handling')).toBeTruthy()
  expect(screen.getByText('Synthetic Handler')).toBeTruthy()
  const detail = screen.getByText('Technical details').closest('details')
  expect(detail.open).toBe(false); fireEvent.click(screen.getByText('Technical details'))
  expect(detail.open).toBe(true); expect(detail.textContent).toContain('READY'); expect(detail.textContent).toContain('Incident version: 5')
})

test.each([['VALIDATED', true], ['CLOSED', false]])('work-note visibility at %s respects server permission and lifecycle', async (status, allowed) => {
  mockReads(); activeMetadata.actions.canAddWorkNote = true; activeMetadata.status = status
  apiClient.get.mockImplementation(async url => ({ data: url.endsWith('/metadata') ? activeMetadata : url.endsWith('/history') || url.endsWith('/attachments') ? [] : { ...incident, status } }))
  mount('IT_HANDLER'); await screen.findByText('Synthetic IT')
  expect(Boolean(screen.queryByRole('button', { name: 'Log Work on This Incident' }))).toBe(allowed)
})

test('work-note dialog supports keyboard focus, validation and Escape', async () => {
  mockReads(); activeMetadata.actions.canAddWorkNote = true; mount('IT_HANDLER')
  const opener = await screen.findByRole('button', { name: 'Log Work on This Incident' }); opener.focus(); fireEvent.click(opener)
  const dialog = screen.getByRole('dialog')
  expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close' }))
  fireEvent.click(within(dialog).getByRole('button', { name: 'Log Work on This Incident' }))
  expect(within(dialog).getByLabelText(/^Work Note \/ Observation/).getAttribute('aria-invalid')).toBe('true')
  fireEvent.keyDown(dialog, { key: 'Escape' })
  expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(opener)
})
