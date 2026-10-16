import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AuthContext from './auth/AuthContext'
import IncidentDetails from './pages/IncidentDetails'
import apiClient from './api/client'

vi.mock('./api/client', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
let incident, history, attachments
const image = () => new File(['png'], 'still-failing.png', { type: 'image/png' })
beforeEach(() => {
  vi.resetAllMocks()
  incident = { id: 12, incidentNumber: 'INC-12', title: 'VPN', status: 'RESOLVED', reportedBy: 'reporter@example.test' }
  history = []; attachments = []
  apiClient.get.mockImplementation(async url => ({ data: url.endsWith('/history') ? history : url.endsWith('/attachments') ? attachments : incident }))
})
afterEach(cleanup)
async function open() {
  render(<AuthContext.Provider value={{ user: { role: 'REPORTER', email: incident.reportedBy } }}><MemoryRouter initialEntries={['/incidents/12']}><Routes><Route path="/incidents/:id" element={<IncidentDetails />} /></Routes></MemoryRouter></AuthContext.Provider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Issue Still Persists' }))
  const modal = screen.getByRole('dialog')
  fireEvent.change(within(modal).getByLabelText(/^What is still not working/), { target: { value: 'Still disconnected' } })
  return modal
}
function saveFeedback() {
  incident = { ...incident, status: 'IN_PROGRESS', issueStillPersists: true }
  history = [{ id: 1, actionType: 'RESOLUTION_NOT_ACCEPTED', oldValue: 'RESOLVED', newValue: 'IN_PROGRESS', changedBy: incident.reportedBy, remarks: 'Reporter feedback: Still disconnected' }, { id: 2, actionType: 'STATUS_CHANGED', oldValue: 'RESOLVED', newValue: 'IN_PROGRESS', remarks: 'Reporter feedback: Still disconnected' }]
  return { data: incident }
}
test.each(['none', 'success', 'failure'])('feedback saves independently with screenshot result: %s', async result => {
  let finishFeedback
  apiClient.post.mockImplementation(url => {
    if (url.endsWith('/resolution-feedback')) return new Promise(resolve => { finishFeedback = () => resolve(saveFeedback()) })
    if (result === 'failure') return Promise.reject(new Error('Upload failed'))
    attachments = [{ id: 987654, originalFilename: 'still-failing.png', fileSize: 3 }]
    history.push({ id: 3, actionType: 'ATTACHMENT_ADDED', newValue: '987654', remarks: 'Screenshot added: still-failing.png', changedBy: incident.reportedBy })
    return Promise.resolve({ data: attachments })
  })
  const modal = await open()
  if (result !== 'none') fireEvent.change(within(modal).getByLabelText('Supporting Screenshots'), { target: { files: [image()] } })
  fireEvent.click(within(modal).getByRole('button', { name: 'Issue Still Persists' }))
  expect(apiClient.post).toHaveBeenCalledExactlyOnceWith('/api/incidents/12/resolution-feedback', { feedback: 'Still disconnected', evidenceReference: '' })
  expect(within(modal).getByLabelText('Supporting Screenshots').disabled).toBe(true)
  finishFeedback()
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(await screen.findByText('In Progress (current)')).toBeTruthy()
  expect(screen.getAllByText('Still disconnected')).toHaveLength(1)
  expect(apiClient.post).toHaveBeenCalledTimes(result === 'none' ? 1 : 2)
  expect(screen.queryByRole('button', { name: 'Record Investigation' })).toBeNull()
  if (result !== 'none') {
    const [url, body] = apiClient.post.mock.calls[1]
    expect(url).toBe('/api/incidents/12/attachments')
    expect(body.getAll('files').map(file => file.name)).toEqual(['still-failing.png'])
  }
  if (result === 'success') {
    expect(await screen.findByRole('button', { name: 'Download still-failing.png' })).toBeTruthy()
    expect(screen.getByText('Attachment Added')).toBeTruthy()
    expect(screen.getByText('Screenshot added: still-failing.png')).toBeTruthy()
    expect(screen.queryByText('987654')).toBeNull()
  }
  if (result === 'failure') {
    expect(screen.getByRole('alert').textContent).toContain('Your feedback was saved and the incident is In Progress')
    expect(screen.getByRole('alert').textContent).toContain('retry them using the Attachments section')
    expect(await screen.findByRole('button', { name: 'Upload screenshots' })).toBeTruthy()
  }
})
test('feedback failure keeps selected files and does not upload', async () => {
  apiClient.post.mockRejectedValue(new Error('Feedback failed'))
  const modal = await open()
  fireEvent.change(within(modal).getByLabelText('Supporting Screenshots'), { target: { files: [image()] } })
  fireEvent.click(within(modal).getByRole('button', { name: 'Issue Still Persists' }))
  expect(await within(modal).findByRole('alert')).toBeTruthy()
  expect(apiClient.post).toHaveBeenCalledTimes(1)
  expect(within(modal).getByRole('button', { name: 'Remove still-failing.png' })).toBeTruthy()
})
