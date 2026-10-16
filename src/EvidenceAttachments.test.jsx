import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AuthContext from './auth/AuthContext'
import IncidentDetails from './pages/IncidentDetails'
import apiClient from './api/client'

vi.mock('./api/client', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
const actor = { role: 'IT_HANDLER', email: 'handler@pareidolia.in', displayName: 'IT Handler' }
const incident = { id: 12, incidentNumber: 'INC-12', title: 'Evidence test', status: 'ASSIGNED', reportedBy: 'reporter@pareidolia.in' }
const png = () => new File(['png'], 'error.png', { type: 'image/png' })
const jpeg = () => new File(['jpeg'], 'desk.jpg', { type: 'image/jpeg' })
beforeEach(() => {
  vi.resetAllMocks()
  apiClient.get.mockImplementation(async (url) => ({ data: url.endsWith('/12') ? incident : [] }))
  apiClient.post.mockResolvedValue({ data: incident })
})
afterEach(cleanup)

function renderDetails(role = 'IT_HANDLER') {
  return render(<AuthContext.Provider value={{ user: { ...actor, role } }}><MemoryRouter initialEntries={['/incidents/12']}><Routes><Route path="/incidents/:id" element={<IncidentDetails />} /></Routes></MemoryRouter></AuthContext.Provider>)
}
async function openEvidence(role = 'IT_HANDLER') {
  renderDetails(role)
  await screen.findByText('No screenshots attached.')
  fireEvent.click(screen.getByText('More Actions'))
  fireEvent.click(screen.getByRole('button', { name: 'Update Evidence Reference' }))
  return screen.getByRole('dialog', { name: 'Update Evidence Reference' })
}
function fill(modal) {
  fireEvent.change(within(modal).getByLabelText(/^Evidence Reference/), { target: { value: '  Support ticket 42  ' } })
  fireEvent.change(within(modal).getByLabelText(/^Remarks/), { target: { value: '  Supporting screenshots  ' } })
}
function select(modal, files) {
  fireEvent.change(within(modal).getByLabelText('Screenshots / Supporting Images'), { target: { files } })
}
function submit(modal) { fireEvent.click(within(modal).getByRole('button', { name: 'Update Evidence', exact: true })) }
async function closed() { await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull()) }

test('evidence without screenshots keeps required fields, actor display and existing payload', async () => {
  const modal = await openEvidence()
  expect(within(modal).getByText('Action will be recorded as handler@pareidolia.in.')).toBeTruthy()
  fill(modal); submit(modal); await closed()
  expect(apiClient.post).toHaveBeenCalledExactlyOnceWith('/api/incidents/12/evidence', { evidenceReference: 'Support ticket 42', remarks: 'Supporting screenshots' })
})
test.each([1, 2])('evidence with %i valid images uploads only after evidence succeeds and refreshes all data', async (count) => {
  const files = count === 1 ? [png()] : [png(), jpeg()]
  let completeEvidence
  let saved = false
  apiClient.post.mockImplementation((url) => {
    if (url.endsWith('/evidence')) return new Promise((resolve) => { completeEvidence = () => resolve({ data: incident }) })
    saved = true
    return Promise.resolve({ data: [] })
  })
  apiClient.get.mockImplementation(async (url) => ({ data:
    url.endsWith('/12') ? { ...incident, evidenceReference: saved ? 'Support ticket 42' : '' }
      : url.endsWith('/attachments') ? (saved ? files.map((file, index) => ({ id: index + 1, originalFilename: file.name, fileSize: file.size, uploadedBy: actor.email, uploadedAt: '2026-10-12T10:00:00' })) : [])
        : saved ? [{ id: 1, actionType: 'EVIDENCE_UPDATED', changedBy: actor.email, remarks: 'Evidence saved', changedAt: '2026-10-12T10:00:00' }] : [] }))
  const modal = await openEvidence()
  fill(modal); select(modal, files); submit(modal)
  expect(apiClient.post).toHaveBeenCalledTimes(1)
  expect(within(modal).getByLabelText('Screenshots / Supporting Images').disabled).toBe(true)
  completeEvidence()
  await closed()
  expect(apiClient.post).toHaveBeenCalledTimes(2)
  const [url, body] = apiClient.post.mock.calls[1]
  expect(url).toBe('/api/incidents/12/attachments')
  expect(body).toBeInstanceOf(FormData)
  expect([...body.keys()]).toEqual(files.map(() => 'files'))
  expect(body.getAll('files').map((file) => file.name)).toEqual(files.map((file) => file.name))
  expect(await screen.findByRole('button', { name: 'Download error.png' })).toBeTruthy()
  expect(await screen.findByText('Support ticket 42')).toBeTruthy()
  expect(await screen.findByText('Evidence Updated')).toBeTruthy()
  for (const endpoint of ['/12', '/history', '/attachments']) {
    expect(apiClient.get.mock.calls.filter(([url]) => url.endsWith(endpoint)).length).toBeGreaterThanOrEqual(2)
  }
})
test('image can be removed before evidence submission', async () => {
  const modal = await openEvidence()
  fill(modal); select(modal, [png()])
  fireEvent.click(within(modal).getByRole('button', { name: 'Remove error.png' }))
  submit(modal); await closed()
  expect(apiClient.post).toHaveBeenCalledTimes(1)
})
test.each(['unsupported', 'oversized', 'too many'])('evidence picker rejects %s selection', async (kind) => {
  const modal = await openEvidence()
  fill(modal)
  const oversized = png()
  Object.defineProperty(oversized, 'size', { value: 5 * 1024 * 1024 + 1 })
  const files = kind === 'unsupported' ? [new File(['svg'], 'bad.svg', { type: 'image/svg+xml' })] : kind === 'oversized' ? [oversized] : Array.from({ length: 6 }, png)
  select(modal, files)
  expect(within(modal).getByRole('alert').textContent).toContain(kind === 'unsupported' ? 'Only PNG and JPEG' : kind === 'oversized' ? '5 MB' : 'up to 5')
  submit(modal); await closed()
  expect(apiClient.post).toHaveBeenCalledTimes(1)
})
test('screenshots cannot bypass required evidence reference validation', async () => {
  const modal = await openEvidence()
  select(modal, [png()])
  fireEvent.change(within(modal).getByLabelText(/^Evidence Reference/), { target: { value: '   ' } })
  submit(modal)
  expect(within(modal).getByText('This field is required.')).toBeTruthy()
  expect(apiClient.post).not.toHaveBeenCalled()
})
test('evidence request failure preserves the modal and prevents uploading files', async () => {
  apiClient.post.mockRejectedValue({ response: { status: 403, data: { message: 'Access denied.' } } })
  const modal = await openEvidence()
  fill(modal); select(modal, [png()]); submit(modal)
  expect(await within(modal).findByRole('alert')).toBeTruthy()
  expect(screen.getByRole('dialog')).toBeTruthy()
  expect(apiClient.post).toHaveBeenCalledTimes(1)
  expect(apiClient.post.mock.calls[0][0]).toBe('/api/incidents/12/evidence')
  expect(within(modal).getByRole('button', { name: 'Remove error.png' })).toBeTruthy()
})
test('failed image upload shows partial success and existing attachments section remains usable', async () => {
  apiClient.post.mockImplementation(async (url) => {
    if (url.endsWith('/attachments')) throw { response: { status: 400, data: { message: 'Invalid image contents.' } } }
    return { data: incident }
  })
  const modal = await openEvidence()
  fill(modal); select(modal, [png()]); submit(modal); await closed()
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Evidence was updated successfully, but one or more screenshots could not be uploaded.'))
  await screen.findByText('No screenshots attached.')
  expect(apiClient.post).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('button', { name: 'Upload screenshots' })).toBeTruthy()
  apiClient.post.mockResolvedValue({ data: [] })
  fireEvent.change(within(screen.getByRole('region', { name: 'Attachments' })).getByLabelText('Screenshots / Supporting Images'), { target: { files: [jpeg()] } })
  fireEvent.click(screen.getByRole('button', { name: 'Upload screenshots' }))
  await screen.findByText('Screenshots uploaded successfully.')
  expect(apiClient.post.mock.calls.filter(([url]) => url.endsWith('/evidence'))).toHaveLength(1)
  expect(apiClient.post.mock.calls.filter(([url]) => url.endsWith('/attachments'))).toHaveLength(2)
})
test('cancel clears images and other action modals do not get the picker', async () => {
  const modal = await openEvidence()
  select(modal, [png()])
  fireEvent.click(within(modal).getByRole('button', { name: 'Cancel' }))
  fireEvent.click(screen.getByText('More Actions'))
  fireEvent.click(screen.getByRole('button', { name: 'Update Evidence Reference' }))
  expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'Remove error.png' })).toBeNull()
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
  fireEvent.click(screen.getByRole('button', { name: 'Resolve Incident', exact: true }))
  expect(within(await screen.findByRole('region', { name: 'Resolution' })).queryByLabelText('Screenshots / Supporting Images')).toBeNull()
  expect(screen.queryByRole('dialog')).toBeNull()
})
test.each(['REPORTER', 'REVIEWER'])('%s does not gain access to the evidence action', async (role) => {
  renderDetails(role)
  await screen.findByText('No screenshots attached.')
  expect(screen.queryByRole('button', { name: 'Update Evidence Reference' })).toBeNull()
})
test('admin retains the existing evidence action with optional images', async () => {
  const modal = await openEvidence('ADMIN')
  expect(within(modal).getByLabelText('Screenshots / Supporting Images')).toBeTruthy()
})


test('partial-success warning remains visible when the subsequent incident refresh fails', async () => {
  let evidenceSaved = false
  apiClient.post.mockImplementation(async (url) => {
    if (url.endsWith('/attachments')) throw new Error('Upload unavailable')
    evidenceSaved = true
    return { data: incident }
  })
  apiClient.get.mockImplementation(async (url) => {
    if (url.endsWith('/12') && evidenceSaved) throw new Error('Refresh unavailable')
    return { data: url.endsWith('/12') ? incident : [] }
  })
  const modal = await openEvidence()
  fill(modal); select(modal, [png()]); submit(modal); await closed()
  expect(await screen.findByText(/Evidence was updated successfully, but one or more screenshots/)).toBeTruthy()
  expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy()
  expect(apiClient.post).toHaveBeenCalledTimes(2)
})
