import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AuthContext from './auth/AuthContext'
import AppLayout from './components/AppLayout'
import IncidentList from './pages/IncidentList'
import CreateIncident from './pages/CreateIncident'
import IncidentDetails from './pages/IncidentDetails'
import ImagePicker from './components/ImagePicker'
import apiClient from './api/client'
import { saveDownload } from './utils/download'

vi.mock('./api/client', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('./utils/download', () => ({ saveDownload: vi.fn() }))
const user = { role: 'REPORTER', email: 'owner@pareidolia.in', displayName: 'Owner' }
const logout = vi.fn()
const incident = { id: 12, incidentNumber: 'INC-12', title: 'Test incident', status: 'ASSIGNED', reportedBy: user.email }
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
  apiClient.get.mockImplementation(async (url) => ({ data: url.endsWith('/attachments') || url.endsWith('/history') ? [] : url.endsWith('/12') ? incident : [] }))
  apiClient.post.mockResolvedValue({ data: incident })
})
afterEach(() => { cleanup(); vi.unstubAllEnvs() })
function withUser(component, role = 'REPORTER', route = '/') {
  return render(<AuthContext.Provider value={{ user: { ...user, role }, logout }}><MemoryRouter initialEntries={[route]}>{component}</MemoryRouter></AuthContext.Provider>)
}
function shell() {
  return <Routes><Route element={<AppLayout />}><Route path="/" element={<h1>Dashboard page</h1>} /><Route path="/incidents" element={<h1>Incidents page</h1>} /><Route path="/incidents/new" element={<h1>Create page</h1>} /></Route></Routes>
}
test('sidebar collapses, persists through remount, navigates and signs out', async () => {
  let view = withUser(shell())
  fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
  expect(localStorage.getItem('incidentSidebarCollapsed')).toBe('true')
  expect(view.container.querySelector('.sidebar-collapsed')).toBeTruthy()
  expect(view.container.querySelector('.nav-short-label')).toBeNull()
  expect(screen.queryByText('Tickets')).toBeNull()
  expect(screen.getByRole('button', { name: 'Expand sidebar' }).textContent).toBe('')
  for (const label of ['Dashboard', 'Incidents', 'Create Incident', 'How to Use']) {
    const link = screen.getByRole('link', { name: label })
    expect(link.getAttribute('title')).toBe(label)
    expect(link.querySelector('svg[aria-hidden="true"]')).toBeTruthy()
  }
  view.unmount()
  view = withUser(shell())
  expect(screen.getByRole('button', { name: 'Expand sidebar' }).getAttribute('aria-expanded')).toBe('false')
  fireEvent.click(screen.getByRole('link', { name: 'Incidents' }))
  expect(screen.getByRole('heading', { name: 'Incidents page' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Incidents' }).getAttribute('aria-current')).toBe('page')
  fireEvent.click(screen.getByRole('link', { name: 'Create Incident' }))
  expect(screen.getByRole('heading', { name: 'Create page' })).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Incidents' }).getAttribute('aria-current')).toBeNull()
  fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }))
  expect(screen.getByRole('heading', { name: 'Dashboard page' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }))
  await waitFor(() => expect(logout).toHaveBeenCalledOnce())
  view.unmount()
})
test('narrow viewport defaults to compact navigation but respects an explicit expanded preference', () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
  const view = withUser(shell())
  expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))
  view.unmount()
  withUser(shell())
  expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeTruthy()
})
test.each(['REPORTER', 'REVIEWER', 'IT_HANDLER', 'ADMIN'])('report visibility for %s', async (role) => {
  withUser(<IncidentList />, role)
  await screen.findByText('No incidents found.')
  expect(Boolean(screen.queryByRole('button', { name: 'Download Excel' }))).toBe(['IT_HANDLER', 'ADMIN'].includes(role))
})
test('report sends selected month and downloads the response', async () => {
  const blob = new Blob(['xlsx'])
  apiClient.get.mockImplementation(async (url) => ({ data: url.includes('/reports/') ? blob : [] }))
  withUser(<IncidentList />, 'IT_HANDLER')
  fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2026-10' } })
  fireEvent.click(screen.getByRole('button', { name: 'Download Excel' }))
  await waitFor(() => expect(saveDownload).toHaveBeenCalledWith(blob, 'incident-report-2026-10.xlsx'))
  expect(apiClient.get).toHaveBeenCalledWith('/api/reports/incidents/monthly', { params: { year: 2026, month: 10 }, responseType: 'blob' })
})
test('file picker rejects unsupported, oversized and excess files', () => {
  const change = vi.fn()
  render(<ImagePicker files={[]} onChange={change} />)
  const input = screen.getByLabelText('Screenshots / Supporting Images')
  fireEvent.change(input, { target: { files: [new File(['svg'], 'bad.svg', { type: 'image/svg+xml' })] } })
  expect(screen.getByRole('alert').textContent).toContain('Only PNG and JPEG')
  fireEvent.change(input, { target: { files: [new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' })] } })
  expect(screen.getByRole('alert').textContent).toContain('5 MB')
  fireEvent.change(input, { target: { files: Array.from({ length: 6 }, () => new File(['png'], 'a.png', { type: 'image/png' })) } })
  expect(screen.getByRole('alert').textContent).toContain('up to 5')
  expect(change).not.toHaveBeenCalled()
})
function Destination() {
  const { state } = useLocation()
  return <div>Created incident{state?.uploadWarning && <p role="alert">{state.uploadWarning}</p>}</div>
}
function createPage() {
  return <Routes><Route path="/incidents/new" element={<CreateIncident />} /><Route path="/incidents/12" element={<Destination />} /></Routes>
}
function fillCreate() {
  for (const [label, value] of [['Title', 'VPN'], ['Description', 'VPN disconnects'], ['Affected System', 'VPN client']]) {
    fireEvent.change(screen.getByLabelText(new RegExp('^' + label)), { target: { value } })
  }
  fireEvent.change(screen.getByLabelText(/^Issue Type/), { target: { value: 'IT_ISSUE' } })
  fireEvent.change(screen.getByLabelText(/^Category/), { target: { value: 'Network / Connectivity' } })
  fireEvent.change(screen.getByLabelText(/^Severity/), { target: { value: 'LOW' } })
  fireEvent.change(screen.getByLabelText(/^Priority/), { target: { value: 'LOW' } })
}
test('create without images preserves JSON and does not submit actor fields', async () => {
  withUser(createPage(), 'REPORTER', '/incidents/new')
  fillCreate()
  fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
  await screen.findByText('Created incident')
  expect(apiClient.post).toHaveBeenCalledOnce()
  const [url, payload] = apiClient.post.mock.calls[0]
  expect(url).toBe('/api/incidents')
  expect(payload.title).toBe('VPN')
  expect(payload.reportedBy).toBeUndefined()
  expect(payload).not.toHaveProperty('responsibleDepartmentId')
})
test('submits an independent responsible department ID and handles a rejected selection', async () => {
  apiClient.get.mockResolvedValue({ data: [{ id: 7, displayName: 'IT' }, { id: 9, displayName: 'HR' }] })
  apiClient.post.mockRejectedValueOnce({ response: { status: 400, data: { message: 'Select an active responsible department.' } } })
  withUser(createPage(), 'REPORTER', '/incidents/new')
  await screen.findByRole('option', { name: 'IT' })
  expect(apiClient.get).toHaveBeenCalledWith('/api/incidents/responsible-departments')
  fireEvent.change(screen.getByLabelText('Reporter Department'), { target: { value: 'R&D' } })
  const responsible = screen.getByLabelText('Responsible Department (optional)')
  fireEvent.change(responsible, { target: { value: '7' } })
  fillCreate()
  fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Select an active responsible department.')
  expect(apiClient.post).toHaveBeenCalledWith('/api/incidents', expect.objectContaining({
    reporterDepartment: 'R&D', responsibleDepartmentId: 7, issueType: 'IT_ISSUE',
  }))
  expect(screen.getByLabelText(/^Title/).value).toBe('VPN')
  fireEvent.change(responsible, { target: { value: '' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
  await screen.findByText('Created incident')
  expect(apiClient.post.mock.calls[1][1]).not.toHaveProperty('responsibleDepartmentId')
})
test('routine HR is opt-in and submits the HR type with confidentiality guidance', async () => {
  vi.stubEnv('VITE_ROUTINE_HR_ISSUES_ENABLED', 'true')
  withUser(createPage(), 'REPORTER', '/incidents/new')
  fillCreate()
  fireEvent.change(screen.getByLabelText(/^Issue Type/), { target: { value: 'HR_ISSUE' } })
  expect(screen.getByText('For routine HR requests only. Do not enter confidential complaints, medical details, salary details or other sensitive information. Contact the HR Head directly for confidential matters.')).toBeTruthy()
  fireEvent.change(screen.getByLabelText(/^Category/), { target: { value: 'Routine HR Request' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
  await screen.findByText('Created incident')
  expect(apiClient.post).toHaveBeenCalledWith('/api/incidents',
    expect.objectContaining({ issueType: 'HR_ISSUE', category: 'Routine HR Request' }))
})
test('older-backend builds omit the HR issue option', async () => {
  vi.stubEnv('VITE_ROUTINE_HR_ISSUES_ENABLED', 'false')
  withUser(createPage(), 'REPORTER', '/incidents/new')
  await screen.findByText('No responsible departments are available.')
  expect(screen.queryByRole('option', { name: 'HR Issue' })).toBeNull()
})
test('creation still works when the department lookup is unavailable', async () => {
  apiClient.get.mockRejectedValueOnce(new Error('Lookup unavailable'))
  withUser(createPage(), 'REPORTER', '/incidents/new')
  await screen.findByText(/Responsible departments are unavailable/)
  expect(screen.getByLabelText('Responsible Department (optional)').disabled).toBe(true)
  fillCreate()
  fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
  await screen.findByText('Created incident')
  expect(apiClient.post.mock.calls[0][1]).not.toHaveProperty('responsibleDepartmentId')
})
test.each([false, true])('creation remains successful when upload failure is %s', async (failure) => {
  apiClient.post.mockImplementation(async (url) => {
    if (url.endsWith('/attachments')) {
      if (failure) throw new Error('Upload failed')
      return { data: [] }
    }
    return { data: incident }
  })
  withUser(createPage(), 'REPORTER', '/incidents/new')
  fillCreate()
  const file = new File(['png'], 'screen.png', { type: 'image/png' })
  fireEvent.change(screen.getByLabelText('Screenshots / Supporting Images'), { target: { files: [file] } })
  fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
  await screen.findByText('Created incident')
  expect(apiClient.post).toHaveBeenCalledTimes(2)
  expect(apiClient.post.mock.calls[1][1]).toBeInstanceOf(FormData)
  expect([...apiClient.post.mock.calls[1][1].keys()]).toEqual(['files'])
  if (failure) expect(screen.getByRole('alert').textContent).toContain('Incident was created successfully')
  else expect(screen.queryByRole('alert')).toBeNull()
})
test('guarded incident creation defers screenshots until the reporter has case permission', async () => {
  vi.stubEnv('VITE_INCIDENT_ASSIGNMENT_ENABLED', 'true')
  apiClient.get.mockResolvedValue({ data: [{ id: 7, displayName: 'Operations (Annotation)' }] })
  try {
    withUser(createPage(), 'REPORTER', '/incidents/new')
    expect(screen.getByText(/add screenshots from Incident Details after creation/)).toBeTruthy()
    expect(screen.queryByLabelText('Screenshots / Supporting Images')).toBeNull()
    fillCreate()
    fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
    expect(await screen.findByText('Select an active responsible department.')).toBeTruthy()
    expect(apiClient.post).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByLabelText('Responsible Department').disabled).toBe(false))
    fireEvent.change(screen.getByLabelText('Responsible Department'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
    await screen.findByText('Created incident')
    expect(apiClient.post).toHaveBeenCalledWith('/api/incidents', expect.objectContaining({ responsibleDepartmentId: 7 }))
    expect(apiClient.post).toHaveBeenCalledTimes(1)
    expect(apiClient.post.mock.calls[0][0]).toBe('/api/incidents')
  } finally {
    vi.unstubAllEnvs()
  }
})
test('selected screenshot can be removed before creation', () => {
  withUser(createPage(), 'REPORTER', '/incidents/new')
  fireEvent.change(screen.getByLabelText('Screenshots / Supporting Images'), { target: { files: [new File(['jpeg'], 'screen.jpg', { type: 'image/jpeg' })] } })
  fireEvent.click(screen.getByRole('button', { name: 'Remove screen.jpg' }))
  expect(screen.queryByText(/screen.jpg/)).toBeNull()
})
test.each(['REPORTER', 'IT_HANDLER', 'REVIEWER', 'ADMIN'])('details attachment access for %s', async (role) => {
  const metadata = { id: 8, originalFilename: 'screen.png', fileSize: 100, uploadedBy: user.email, uploadedAt: '2026-10-12T10:00:00' }
  apiClient.get.mockImplementation(async (url) => ({ data: url.endsWith('/attachments') ? [metadata] : url.endsWith('/history') ? [] : url.endsWith('/attachments/8') ? new Blob(['png']) : incident }))
  withUser(<Routes><Route path="/incidents/:id" element={<IncidentDetails />} /></Routes>, role, '/incidents/12')
  expect(await screen.findByText('screen.png')).toBeTruthy()
  expect(Boolean(screen.queryByRole('button', { name: 'Upload screenshots' }))).toBe(role !== 'REVIEWER')
  fireEvent.click(screen.getByRole('button', { name: 'Download screen.png' }))
  await waitFor(() => expect(saveDownload).toHaveBeenCalled())
})
test('detail upload refreshes metadata and audit history', async () => {
  withUser(<Routes><Route path="/incidents/:id" element={<IncidentDetails />} /></Routes>, 'REPORTER', '/incidents/12')
  const attachments = await screen.findByRole('region', { name: 'Attachments' })
  const picker = attachments.querySelector('input[type=file]')
  fireEvent.change(picker, { target: { files: [new File(['png'], 'new.png', { type: 'image/png' })] } })
  fireEvent.click(screen.getByRole('button', { name: 'Upload screenshots' }))
  expect(await screen.findByText('Screenshots uploaded successfully.')).toBeTruthy()
  await waitFor(() => expect(apiClient.get.mock.calls.filter(([url]) => url.endsWith('/history'))).toHaveLength(2))
})

test('failed screenshot upload shows a safe access message without reporting success', async () => {
  apiClient.post.mockRejectedValueOnce({ response: { status: 404, data: { message: 'sensitive backend detail' } } })
  withUser(<Routes><Route path="/incidents/:id" element={<IncidentDetails />} /></Routes>, 'REPORTER', '/incidents/12')
  const attachments = await screen.findByRole('region', { name: 'Attachments' })
  fireEvent.change(attachments.querySelector('input[type=file]'), { target: { files: [new File(['png'], 'new.png', { type: 'image/png' })] } })
  fireEvent.click(screen.getByRole('button', { name: 'Upload screenshots' }))
  expect(await screen.findByText(/Screenshot upload is unavailable for this incident/)).toBeTruthy()
  expect(screen.queryByText('Screenshots uploaded successfully.')).toBeNull()
  expect(screen.queryByText('sensitive backend detail')).toBeNull()
})
test('IT Issue category dropdown includes infrastructure, database, endpoint and Other', () => {
  withUser(<CreateIncident />)
  fireEvent.change(screen.getByLabelText(/^Issue Type/), { target: { value: 'IT_ISSUE' } })
  const categories = [...screen.getByLabelText(/^Category/).options].map(option => option.value)
  expect(categories).toEqual(expect.arrayContaining(['Server / Infrastructure', 'Database', 'Security / Endpoint', 'Other']))
})

test('reporter severity and priority guidance explains the initial assessment and audited reassessment', () => {
  withUser(<CreateIncident />)
  expect(screen.getByText(/Initial assessment of how much impact/).textContent).toContain('IT may reassess this after investigation')
  expect(screen.getByText(/Initial assessment of how urgently/).textContent).toContain('every change is recorded in Activity')
  expect(screen.getByLabelText(/^Severity/)).toBeTruthy()
  expect(screen.getByLabelText(/^Priority/)).toBeTruthy()
})

test('creation immediately fetches and displays assigned server state without waiting for polling', async () => {
  withUser(<Routes><Route path="/incidents/new" element={<CreateIncident />} /><Route path="/incidents/:id" element={<IncidentDetails />} /></Routes>, 'REPORTER', '/incidents/new')
  fillCreate()
  fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
  expect(await screen.findByText('Assigned (current)')).toBeTruthy()
  expect(apiClient.get).toHaveBeenCalledWith('/api/incidents/12')
  expect(screen.queryByRole('button', { name: 'Save Progress' })).toBeNull()
})
