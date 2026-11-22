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
const user = { role: 'REPORTER', email: 'owner@example.test', displayName: 'Owner' }
const logout = vi.fn()
const incident = { id: 12, incidentNumber: 'INC-12', title: 'Test incident', status: 'ASSIGNED', reportedBy: user.email }
beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  sessionStorage.clear()
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
  apiClient.get.mockImplementation(async (url) => ({ data: url.endsWith('/responsible-departments') ? [{ id: 7, displayName: 'IT' }]
    : url.endsWith('/reporting-departments') ? [{ id: 5, displayName: 'R&D' }]
    : url.endsWith('/attachments') || url.endsWith('/history') ? [] : url.endsWith('/12') ? incident : [] }))
  apiClient.post.mockResolvedValue({ data: incident })
})
afterEach(() => { cleanup(); vi.unstubAllEnvs() })
function withUser(component, role = 'REPORTER', route = '/') {
  return render(<AuthContext.Provider value={{ user: { ...user, role }, logout }}><MemoryRouter initialEntries={[route]}>{component}</MemoryRouter></AuthContext.Provider>)
}
function shell() {
  return <Routes><Route element={<AppLayout />}><Route path="/" element={<h1>Dashboard page</h1>} /><Route path="/incidents" element={<h1>Incidents page</h1>} /><Route path="/incidents/new" element={<h1>Create page</h1>} /></Route></Routes>
}
test.each(['REPORTER', 'REVIEWER', 'IT_HANDLER', 'ADMIN'])('active %s can open incident creation', async (role) => {
  withUser(shell(), role)
  expect(screen.getByRole('link', { name: 'Create Incident' })).toBeTruthy()
})
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
async function fillCreate(selectDepartment = true) {
  await waitFor(() => expect(screen.getByLabelText('Responsible Department').disabled).toBe(false))
  fireEvent.change(screen.getByLabelText('Reporter Department'), { target: { value: '5' } })
  if (selectDepartment) fireEvent.change(screen.getByLabelText('Responsible Department'), { target: { value: '7' } })
  for (const [label, value] of [['Title', 'VPN'], ['Description', 'VPN disconnects'], ['Affected System', 'VPN client']]) {
    fireEvent.change(screen.getByLabelText(new RegExp('^' + label)), { target: { value } })
  }
  fireEvent.change(screen.getByLabelText(/^Issue Type/), { target: { value: 'IT_ISSUE' } })
  fireEvent.change(screen.getByLabelText(/^Category/), { target: { value: 'Network / Connectivity' } })
  fireEvent.change(screen.getByLabelText(/^Severity/), { target: { value: 'LOW' } })
  fireEvent.change(screen.getByLabelText(/^Priority/), { target: { value: 'LOW' } })
}
test('creation retries retain a key while a new form uses a new key', async () => {
  apiClient.post.mockRejectedValueOnce(new Error('Synthetic network failure'))
  const view = withUser(createPage(), 'REPORTER', '/incidents/new')
  await fillCreate()
  fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
  await screen.findByRole('alert')
  const firstKey = apiClient.post.mock.calls[0][2].headers['Idempotency-Key']
  expect(firstKey).toMatch(/^[0-9a-f-]{36}$/)
  fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
  await screen.findByText('Created incident')
  expect(apiClient.post.mock.calls[1][2].headers['Idempotency-Key']).toBe(firstKey)
  view.unmount()
  withUser(createPage(), 'REPORTER', '/incidents/new')
  await fillCreate()
  fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
  await screen.findByText('Created incident')
  expect(apiClient.post.mock.calls[2][2].headers['Idempotency-Key']).not.toBe(firstKey)
})
test('creation retry retains its key after the form is reopened in the same tab', async () => {
  apiClient.post.mockRejectedValueOnce(new Error('Synthetic network failure'))
  const view = withUser(createPage(), 'REPORTER', '/incidents/new')
  await fillCreate()
  fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
  await screen.findByRole('alert')
  const key = apiClient.post.mock.calls[0][2].headers['Idempotency-Key']
  view.unmount()
  withUser(createPage(), 'REPORTER', '/incidents/new')
  await fillCreate()
  fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
  await screen.findByText('Created incident')
  expect(apiClient.post.mock.calls[1][2].headers['Idempotency-Key']).toBe(key)
})
test('create without images preserves JSON and does not submit actor fields', async () => {
  withUser(createPage(), 'REPORTER', '/incidents/new')
  await fillCreate()
  fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
  await screen.findByText('Created incident')
  expect(apiClient.post).toHaveBeenCalledOnce()
  const [url, payload] = apiClient.post.mock.calls[0]
  expect(url).toBe('/api/incidents')
  expect(payload.title).toBe('VPN')
  expect(payload.reportedBy).toBeUndefined()
  expect(payload.responsibleDepartmentId).toBe(7)
  expect(payload).not.toHaveProperty('reporterDepartment')
})
test('submits an independent responsible department ID and handles a rejected selection', async () => {
  apiClient.get.mockImplementation(async url => ({ data: url.endsWith('/reporting-departments') ? [{ id: 5, displayName: 'R&D' }] : [{ id: 7, displayName: 'IT' }, { id: 9, displayName: 'HR' }] }))
  apiClient.post.mockRejectedValueOnce({ response: { status: 400, data: { message: 'Select an active responsible department.' } } })
  withUser(createPage(), 'REPORTER', '/incidents/new')
  await screen.findByRole('option', { name: 'IT' })
  expect(apiClient.get).toHaveBeenCalledWith('/api/incidents/responsible-departments')
  expect(screen.getByLabelText('Reporter Department').tagName).toBe('SELECT')
  expect(screen.getByRole('option', { name: 'R&D' })).toBeTruthy()
  const responsible = screen.getByLabelText('Responsible Department')
  fireEvent.change(responsible, { target: { value: '7' } })
  await fillCreate()
  fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Select an active responsible department.')
  expect(apiClient.post).toHaveBeenCalledWith('/api/incidents', expect.objectContaining({
    responsibleDepartmentId: 7, issueType: 'IT_ISSUE',
  }), expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
  expect(screen.getByLabelText(/^Title/).value).toBe('VPN')
  fireEvent.change(responsible, { target: { value: '' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
  expect(await screen.findByText('Select an active responsible department.')).toBeTruthy()
  expect(apiClient.post).toHaveBeenCalledTimes(1)
})
test('incident creation requires a responsible department and never submits a claimed reporter department', async () => {
  apiClient.get.mockImplementation(async url => ({ data: url.endsWith('/reporting-departments') ? [{ id: 5, displayName: 'R&D' }] : [{ id: 7, displayName: 'IT' }] }))
  withUser(createPage(), 'REPORTER', '/incidents/new')
  await screen.findByRole('option', { name: 'IT' })
  expect(screen.getByLabelText('Reporter Department').tagName).toBe('SELECT')
  expect(screen.getByRole('option', { name: 'R&D' })).toBeTruthy()
  await fillCreate(false)
  fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
  expect(await screen.findByText('Select an active responsible department.')).toBeTruthy()
  expect(apiClient.post).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Responsible Department'), { target: { value: '7' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
  await screen.findByText('Created incident')
  expect(apiClient.post.mock.calls[0][1]).toMatchObject({ responsibleDepartmentId: 7 })
  expect(apiClient.post.mock.calls[0][1]).not.toHaveProperty('reporterDepartment')
})
test('both department lists use all five active options and submit independent IDs', async () => {
  const departments = [
    { id: 7, displayName: 'IT' }, { id: 10, displayName: 'HR' },
    { id: 8, displayName: 'Operations (Annotation)' },
    { id: 9, displayName: 'Operations (Perioperative Flow Analysis)' },
    { id: 5, displayName: 'R&D' },
  ]
  apiClient.get.mockImplementation(async url => {
    if (url === '/api/incidents/reporting-departments' || url === '/api/incidents/responsible-departments') return { data: departments }
    throw new Error('Unexpected department request')
  })
  withUser(createPage(), 'REPORTER', '/incidents/new')
  await fillCreate()
  const reporter = screen.getByLabelText('Reporter Department')
  const responsible = screen.getByLabelText('Responsible Department')
  expect(Array.from(reporter.options).slice(1).map(option => option.textContent)).toEqual(departments.map(item => item.displayName))
  expect(Array.from(responsible.options).slice(1).map(option => option.textContent)).toEqual(departments.map(item => item.displayName))
  expect(reporter.value).toBe('5')
  expect(responsible.value).toBe('7')
  expect(screen.getByText('Owner')).toBeTruthy()
  expect(screen.getByText('owner@example.test')).toBeTruthy()
  expect(document.querySelector('input[name="reportedBy"]')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
  await screen.findByText('Created incident')
  expect(apiClient.post).toHaveBeenCalledWith('/api/incidents', expect.objectContaining({
    reporterDepartmentId: 5, responsibleDepartmentId: 7,
  }), expect.objectContaining({ headers: expect.objectContaining({ 'Idempotency-Key': expect.any(String) }) }))
  expect(apiClient.post.mock.calls[0][1]).not.toHaveProperty('reportedBy')
})
test('reporter chooses an available operational department', async () => {
  apiClient.get.mockImplementation(async url => ({ data: url.endsWith('/reporting-departments')
    ? [{ id: 5, displayName: 'R&D' }, { id: 8, displayName: 'Operations (Annotation)' }]
    : [{ id: 7, displayName: 'IT' }] }))
  withUser(createPage(), 'REPORTER', '/incidents/new')
  await fillCreate()
  fireEvent.change(screen.getByLabelText('Reporter Department'), { target: { value: '8' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
  await screen.findByText('Created incident')
  expect(apiClient.post.mock.calls[0][1]).toMatchObject({ reporterDepartmentId: 8, responsibleDepartmentId: 7 })
})
test.each([[8, 'Operations (Annotation)'], [9, 'Operations (Perioperative Flow Analysis)']])(
  'reporter can choose operational context %s independently of IT', async (id, label) => {
    apiClient.get.mockImplementation(async url => ({ data: url.endsWith('/reporting-departments')
      ? [{ id: 5, displayName: 'R&D' }, { id: 8, displayName: 'Operations (Annotation)' }, { id: 9, displayName: 'Operations (Perioperative Flow Analysis)' }]
      : [{ id: 7, displayName: 'IT' }] }))
    withUser(createPage(), 'REPORTER', '/incidents/new')
    await fillCreate()
    expect(screen.getByText(/This does not establish department membership/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Reporter Department'), { target: { value: String(id) } })
    expect(screen.getByLabelText('Reporter Department').selectedOptions[0].textContent).toBe(label)
    fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
    await screen.findByText('Created incident')
    expect(apiClient.post.mock.calls[0][1]).toMatchObject({ reporterDepartmentId: id, responsibleDepartmentId: 7 })
  },
)
test('HR issue has no category and displays a confidentiality warning before submission', async () => {
  withUser(createPage(), 'REPORTER', '/incidents/new')
  await fillCreate()
  fireEvent.change(screen.getByLabelText(/^Issue Type/), { target: { value: 'HR_ISSUE' } })
  expect(screen.getByText('Do not use this form to report sensitive or confidential HR matters.')).toBeTruthy()
  expect(screen.getByLabelText(/^Category/).disabled).toBe(true)
  expect(screen.getByLabelText(/^Category/).selectedOptions[0].textContent).toBe('Not applicable')
  fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
  await screen.findByText('Created incident')
  expect(apiClient.post).toHaveBeenCalledWith('/api/incidents',
    expect.objectContaining({ issueType: 'HR_ISSUE', responsibleDepartmentId: 7 }), expect.any(Object))
  expect(apiClient.post.mock.calls[0][1]).not.toHaveProperty('category')
})
test('HR issue is available without enabling the legacy HR frontend flag', async () => {
  vi.stubEnv('VITE_ROUTINE_HR_ISSUES_ENABLED', 'false')
  withUser(createPage(), 'REPORTER', '/incidents/new')
  await screen.findByRole('option', { name: 'IT' })
  expect(screen.getByRole('option', { name: 'HR Issue' })).toBeTruthy()
  fireEvent.change(screen.getByLabelText(/^Issue Type/), { target: { value: 'HR_ISSUE' } })
  fireEvent.change(screen.getByLabelText(/^Issue Type/), { target: { value: 'IT_ISSUE' } })
  expect(screen.getByLabelText(/^Category/).disabled).toBe(false)
  expect(screen.queryByText('Do not use this form to report sensitive or confidential HR matters.')).toBeNull()
})
test('HR issue still requires a separately selected responsible department', async () => {
  withUser(createPage(), 'REPORTER', '/incidents/new')
  await fillCreate(false)
  fireEvent.change(screen.getByLabelText(/^Issue Type/), { target: { value: 'HR_ISSUE' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
  expect(await screen.findByText('Select an active responsible department.')).toBeTruthy()
  expect(screen.getByLabelText(/^Category/).disabled).toBe(true)
  expect(apiClient.post).not.toHaveBeenCalled()
})
test('creation is blocked when department lookup fails or incident access is disabled', async () => {
  apiClient.get.mockRejectedValue({ response: { status: 403 } })
  withUser(createPage(), 'REPORTER', '/incidents/new')
  await screen.findByText(/Incident creation or department information is unavailable/)
  expect(screen.getByLabelText('Responsible Department').disabled).toBe(true)
  expect(screen.getByRole('button', { name: 'Create Incident' }).disabled).toBe(true)
  expect(apiClient.post).not.toHaveBeenCalled()
})
test('an empty reporting department list blocks creation with a clear message', async () => {
  apiClient.get.mockImplementation(async url => ({ data: url.endsWith('/reporting-departments') ? [] : [{ id: 7, displayName: 'IT' }] }))
  withUser(createPage(), 'REPORTER', '/incidents/new')
  await screen.findByText(/No reporter departments are currently available/)
  expect(screen.getByRole('button', { name: 'Create Incident' }).disabled).toBe(true)
  expect(apiClient.post).not.toHaveBeenCalled()
})
test('creation is blocked when the reporting department lookup is unavailable', async () => {
  apiClient.get.mockImplementation(async url => {
    if (url.endsWith('/reporting-departments')) throw { response: { status: 400 } }
    return { data: [{ id: 7, displayName: 'IT' }] }
  })
  withUser(createPage(), 'REPORTER', '/incidents/new')
  await screen.findByText(/Incident creation or department information is unavailable/)
  expect(screen.getByLabelText('Reporter Department').disabled).toBe(true)
  expect(screen.getByRole('button', { name: 'Create Incident' }).disabled).toBe(true)
  expect(apiClient.post).not.toHaveBeenCalled()
})
test('responsible department selection does not change issue type or categories', async () => {
  apiClient.get.mockImplementation(async url => ({ data: url.endsWith('/reporting-departments') ? [{ id: 5, displayName: 'R&D' }] : [{ id: 7, displayName: 'IT' }, { id: 8, displayName: 'Operations (Annotation)' }] }))
  withUser(createPage(), 'REPORTER', '/incidents/new')
  await fillCreate()
  const before = [...screen.getByLabelText(/^Category/).options].map(option => option.value)
  fireEvent.change(screen.getByLabelText('Responsible Department'), { target: { value: '8' } })
  expect(screen.getByLabelText(/^Issue Type/).value).toBe('IT_ISSUE')
  expect([...screen.getByLabelText(/^Category/).options].map(option => option.value)).toEqual(before)
  expect(screen.getByLabelText('Reporter Department').value).toBe('5')
})
test('creation is blocked when the responsible department list is empty', async () => {
  apiClient.get.mockImplementation(async url => ({ data: url.endsWith('/reporting-departments') ? [{ id: 5, displayName: 'R&D' }] : [] }))
  withUser(createPage(), 'REPORTER', '/incidents/new')
  await screen.findByText('No responsible departments are available.')
  expect(screen.getByRole('button', { name: 'Create Incident' }).disabled).toBe(true)
  expect(apiClient.post).not.toHaveBeenCalled()
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
  await fillCreate()
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
test.each([false, true])('guarded incident creation preserves incident on upload failure %s', async (failure) => {
  vi.stubEnv('VITE_INCIDENT_ASSIGNMENT_ENABLED', 'true')
  apiClient.get.mockImplementation(async url => ({ data: url.endsWith('/reporting-departments') ? [{ id: 5, displayName: 'R&D' }] : [{ id: 7, displayName: 'Operations (Annotation)' }] }))
  apiClient.post.mockImplementation(async (url) => {
    if (url.endsWith('/attachments') && failure) throw new Error('Upload failed')
    return { data: incident }
  })
  try {
    withUser(createPage(), 'REPORTER', '/incidents/new')
    fireEvent.change(screen.getByLabelText('Screenshots / Supporting Images'), { target: { files: [new File(['png'], 'guarded.png', { type: 'image/png' })] } })
    expect(screen.getByText(/guarded.png/)).toBeTruthy()
    await fillCreate(false)
    fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
    expect(await screen.findByText('Select an active responsible department.')).toBeTruthy()
    expect(apiClient.post).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByLabelText('Responsible Department').disabled).toBe(false))
    fireEvent.change(screen.getByLabelText('Responsible Department'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
    await screen.findByText('Created incident')
    expect(apiClient.post).toHaveBeenCalledWith('/api/incidents', expect.objectContaining({ responsibleDepartmentId: 7 }), expect.any(Object))
    expect(apiClient.post).toHaveBeenCalledTimes(2)
    expect(apiClient.post.mock.calls[0][0]).toBe('/api/incidents')
    expect(apiClient.post.mock.calls[1][0]).toBe('/api/incidents/12/attachments')
    expect(apiClient.post.mock.calls[1][1].getAll('files')[0].name).toBe('guarded.png')
    if (failure) expect(screen.getByRole('alert').textContent).toContain('Incident was created successfully')
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
  await waitFor(() => expect(apiClient.get.mock.calls.filter(([url]) => url === '/api/incidents/12/history')).toHaveLength(2))
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
  await fillCreate()
  fireEvent.click(screen.getByRole('button', { name: 'Create Incident' }))
  expect(await screen.findByText('Assigned (current)')).toBeTruthy()
  expect(apiClient.get).toHaveBeenCalledWith('/api/incidents/12')
  expect(screen.queryByRole('button', { name: 'Save Progress' })).toBeNull()
})
