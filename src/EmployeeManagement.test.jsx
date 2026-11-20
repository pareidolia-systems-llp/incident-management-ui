import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AuthContext from './auth/AuthContext'
import EmployeeManagement from './pages/EmployeeManagement'
import AppLayout from './components/AppLayout'
import apiClient from './api/client'
vi.mock('./api/client', () => ({ default: { post: vi.fn(), get: vi.fn(), put: vi.fn() } }))
beforeEach(() => { vi.clearAllMocks(); apiClient.get.mockResolvedValue({ data: { content: [], totalPages: 0, totalElements: 0 } }); apiClient.put.mockResolvedValue({ data: {} }); apiClient.post.mockImplementation(async (url, payload) => ({ data: url.endsWith('/preview') ? {
    current: { id: 25, version: 0, employeeId: '2', employeeName: 'Original', officialEmail: 'original@example.test' },
    proposed: payload, duplicateName: false,
  } : { id: 12 } })) })
afterEach(() => { cleanup(); vi.unstubAllEnvs() })
function view(allowed = true, component = <EmployeeManagement />) {
  return render(<AuthContext.Provider value={{ user: { role: 'REPORTER', canManageEmployees: allowed }, logout: vi.fn() }}><MemoryRouter>{component}</MemoryRouter></AuthContext.Provider>)
}
function fill() {
  fireEvent.change(screen.getByLabelText('Employee ID'), { target: { value: '2' } })
  fireEvent.change(screen.getByLabelText('Employee Name'), { target: { value: 'Employee Two' } })
  fireEvent.change(screen.getByLabelText('Official Email'), { target: { value: 'two@example.test' } })
}
test('department-head designation controls are disabled by default', async () => {
  view()
  await screen.findByRole('heading', { name: 'Employee Management' })
  expect(screen.queryByRole('heading', { name: 'Department-head designations' })).toBeNull()
})
test('submits only profile fields and resets after success', async () => {
  view(); fill(); fireEvent.click(screen.getByRole('button', { name: 'Add Employee' }))
  await screen.findByText('Employee added successfully.')
  expect(apiClient.post).toHaveBeenCalledWith('/api/admin/employees', { employeeId: '2', employeeName: 'Employee Two', officialEmail: 'two@example.test' })
  expect(screen.getByLabelText('Employee ID').value).toBe('')
  expect(screen.queryByLabelText(/role/i)).toBeNull()
})
test('blocks empty and whitespace fields and uses native email validation', () => {
  const result = view()
  fireEvent.submit(result.container.querySelector('form'))
  expect(screen.getByRole('alert').textContent).toContain('required')
  fill(); fireEvent.change(screen.getByLabelText('Employee Name'), { target: { value: '   ' } })
  fireEvent.submit(result.container.querySelector('form'))
  expect(apiClient.post).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Official Email'), { target: { value: 'invalid' } })
  expect(screen.getByLabelText('Official Email').checkValidity()).toBe(false)
})
test.each(['Employee ID already exists.', 'Official email already exists.', 'You do not have permission to perform this action.'])('shows server error and preserves draft: %s', async message => {
  apiClient.post.mockRejectedValue({ response: { status: message.includes('permission') ? 403 : 409, data: { message } } })
  view(); fill(); fireEvent.click(screen.getByRole('button', { name: 'Add Employee' }))
  expect((await screen.findByRole('alert')).textContent).toBe(message)
  expect(screen.getByLabelText('Employee ID').value).toBe('2')
})
test('loading disables form and prevents overlapping submissions', async () => {
  let finish
  apiClient.post.mockReturnValue(new Promise(resolve => { finish = resolve }))
  const result = view(); fill()
  fireEvent.submit(result.container.querySelector('form')); fireEvent.submit(result.container.querySelector('form'))
  expect(screen.getByRole('button', { name: /Adding employee/ })).toBeTruthy()
  expect(result.container.querySelector('fieldset').disabled).toBe(true)
  expect(apiClient.post).toHaveBeenCalledTimes(1)
  finish({ data: {} }); await waitFor(() => expect(screen.getByRole('status')).toBeTruthy())
})
test('unauthorized page has no form and navigation requires capability', () => {
  vi.stubEnv('VITE_EMPLOYEE_MANAGEMENT_ENABLED', 'true')
  let result = view(false)
  expect(screen.getByRole('alert').textContent).toBe('Access denied.')
  expect(screen.queryByLabelText('Employee ID')).toBeNull()
  result.unmount(); result = view(false, <AppLayout />)
  expect(screen.queryByRole('link', { name: 'Employee Management' })).toBeNull()
  result.unmount(); view(true, <AppLayout />)
  expect(screen.getByRole('link', { name: 'Employee Management' }).getAttribute('href')).toBe('/employees')
})

test('deactivation requires a reason and sends the current employee version', async () => {
  apiClient.get.mockResolvedValue({ data: { content: [{ id: 25, version: 4, employeeId: 'E25', employeeName: 'Original', officialEmail: 'original@example.test', active: true }], totalPages: 1, totalElements: 1 } })
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Deactivate Original' }))
  expect(screen.getByRole('button', { name: 'Confirm status change' }).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: ' Departure ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirm status change' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/api/admin/employees/25/status', { active: false, expectedVersion: 4, reason: 'Departure' }))
})

test('lists employees, edits profile only and preserves read-only email', async () => {
  apiClient.get.mockResolvedValue({ data: { content: [{ id: 25, version: 0, employeeId: 'old', employeeName: 'Original', officialEmail: 'original@example.test', active: false, googleLoginRecorded: true, lastLoginAt: '2026-01-02T00:15:30' }], totalPages: 2, totalElements: 21 } })
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Original' }))
  expect(screen.getByLabelText('Official Email').readOnly).toBe(true)
  expect(screen.getByText('Disabled')).toBeTruthy()
  expect(screen.getByText('2026-01-02 00:15:30')).toBeTruthy()
  expect(screen.getByText('Last Google login (Asia/Kolkata)')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Employee ID'), { target: { value: '002' } })
  fireEvent.change(screen.getByLabelText('Employee Name'), { target: { value: ' Corrected ' } })
  fireEvent.change(screen.getByLabelText('Change reason'), { target: { value: 'HR correction' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm correction' }))
  await screen.findByText('Employee updated successfully.')
  expect(apiClient.put).toHaveBeenCalledWith('/api/admin/employees/25', { employeeId: '002', employeeName: 'Corrected', reason: 'HR correction', expectedVersion: 0 })
})
test('search resets pagination and next page requests bounded results', async () => {
  apiClient.get.mockResolvedValue({ data: { content: [], totalPages: 3, totalElements: 41 } })
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Next' }))
  await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/admin/employees', { params: { search: '', page: 1, size: 20 } }))
  fireEvent.change(screen.getByLabelText('Search employees'), { target: { value: ' Alice ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }))
  await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/admin/employees', { params: { search: 'Alice', page: 0, size: 20 } }))
})
test('update conflict retains draft and cancel clears edit', async () => {
  apiClient.get.mockResolvedValue({ data: { content: [{ id: 25, version: 0, employeeId: '2', employeeName: 'Original', officialEmail: 'original@example.test', active: true }], totalPages: 1, totalElements: 1 } })
  apiClient.put.mockRejectedValue({ response: { status: 409, data: { message: 'Employee ID already exists.' } } })
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Original' }))
  fireEvent.change(screen.getByLabelText('Employee Name'), { target: { value: 'Correction' } })
  fireEvent.change(screen.getByLabelText('Change reason'), { target: { value: 'HR correction' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm correction' }))
  await screen.findByText('Employee ID already exists.')
  expect(screen.getByLabelText('Employee ID').value).toBe('2')
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.getByLabelText('Employee ID').value).toBe('')
  expect(screen.getByLabelText('Official Email').readOnly).toBe(false)
})
test('unauthorized page never fetches employee data', () => {
  view(false)
  expect(apiClient.get).not.toHaveBeenCalled()
})
test('list failure can be retried', async () => {
  apiClient.get.mockRejectedValueOnce(new Error('network'))
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Retry' }))
  await screen.findByText(/No employees found/)
})

test('update feedback is page-level, refreshes list and restores unsaved Add draft', async () => {
  const employee = { id: 25, version: 0, employeeId: '2', employeeName: 'Original', officialEmail: 'original@example.test', active: true }
  apiClient.get.mockResolvedValue({ data: { content: [employee], totalPages: 1, totalElements: 1 } })
  view(); fill()
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Original' }))
  fireEvent.change(screen.getByLabelText('Employee Name'), { target: { value: 'Corrected' } })
  expect(screen.getByRole('button', { name: 'Edit Original' }).disabled).toBe(true)
  apiClient.get.mockResolvedValue({ data: { content: [{ ...employee, employeeName: 'Corrected' }], totalPages: 1, totalElements: 1 } })
  fireEvent.change(screen.getByLabelText('Change reason'), { target: { value: 'HR correction' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm correction' }))
  const feedback = await screen.findByText('Employee updated successfully.')
  expect(feedback.closest('.card')).toBeNull()
  await screen.findByRole('button', { name: 'Edit Corrected' })
  expect(apiClient.get).toHaveBeenCalledTimes(2)
  expect(screen.getByLabelText('Employee Name').value).toBe('Employee Two')
  expect(screen.getByLabelText('Official Email').value).toBe('two@example.test')
})
test('cancel preserves the Add draft and search does not discard an edit', async () => {
  apiClient.get.mockResolvedValue({ data: { content: [{ id: 25, version: 0, employeeId: '2', employeeName: 'Original', officialEmail: 'original@example.test', active: true }], totalPages: 1, totalElements: 1 } })
  view(); fill()
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Original' }))
  fireEvent.change(screen.getByLabelText('Employee Name'), { target: { value: 'Unsaved correction' } })
  fireEvent.change(screen.getByLabelText('Search employees'), { target: { value: 'someone' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }))
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2))
  expect(screen.getByLabelText('Employee Name').value).toBe('Unsaved correction')
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.getByLabelText('Employee Name').value).toBe('Employee Two')
})
test('clear search resets list pagination and suggestion selection does not edit', async () => {
  const employee = { id: 25, version: 0, employeeId: '2', employeeName: 'Original', officialEmail: 'original@example.test', active: true }
  apiClient.get.mockResolvedValue({ data: { content: [employee], totalPages: 3, totalElements: 41 } })
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Next' }))
  await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/admin/employees', { params: { search: '', page: 1, size: 20 } }))
  fireEvent.change(screen.getByLabelText('Search employees'), { target: { value: 'Orig' } })
  fireEvent.click(await screen.findByRole('option'))
  await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/admin/employees', { params: { search: employee.officialEmail, page: 0, size: 20 } }))
  expect(screen.queryByRole('button', { name: 'Save Changes' })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
  await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/api/admin/employees', { params: { search: '', page: 0, size: 20 } }))
  expect(screen.getByLabelText('Search employees').value).toBe('')
})

test('overlapping edit submissions save only once and preserve draft while pending', async () => {
  let finish
  apiClient.put.mockReturnValue(new Promise(resolve => { finish = resolve }))
  apiClient.get.mockResolvedValue({ data: { content: [{ id: 25, version: 0, employeeId: '2', employeeName: 'Original', officialEmail: 'original@example.test', active: true }], totalPages: 1, totalElements: 1 } })
  const result = view()
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Original' }))
  fireEvent.change(screen.getByLabelText('Employee Name'), { target: { value: 'Correction' } })
  fireEvent.change(screen.getByLabelText('Change reason'), { target: { value: 'HR correction' } })
  fireEvent.submit(result.container.querySelector('form'))
  const confirm = await screen.findByRole('button', { name: 'Confirm correction' })
  fireEvent.click(confirm); fireEvent.click(confirm)
  expect(apiClient.put).toHaveBeenCalledTimes(1)
  expect(screen.getByLabelText('Employee Name').value).toBe('Correction')
  expect(result.container.querySelector('fieldset').disabled).toBe(true)
  finish({ data: {} })
  await screen.findByText('Employee updated successfully.')
})


test('requires a reason, reviews selected account, warns on duplicate name and cancels without saving', async () => {
  const target = { id: 46, version: 3, employeeId: '46', employeeName: 'Original Person', officialEmail: 'fixture@example.test', active: true }
  apiClient.get.mockResolvedValue({ data: { content: [target], totalPages: 1, totalElements: 1 } })
  apiClient.post.mockImplementation(async (url, payload) => ({ data: { current: target, proposed: payload, duplicateName: true } }))
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Original Person' }))
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
  await screen.findByText('No changes to save.')
  expect(apiClient.post).not.toHaveBeenCalled()
  expect(apiClient.put).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Employee Name'), { target: { value: 'Shared Name' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
  expect(screen.getByRole('alert').textContent).toContain('reason is required')
  expect(apiClient.post).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Change reason'), { target: { value: 'Name spelling correction' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
  const review = await screen.findByRole('region', { name: 'Confirm employee correction' })
  expect(review.textContent).toContain('46')
  expect(review.textContent).toContain('fixture@example.test')
  expect(review.textContent).toContain('Original Person')
  expect(review.textContent).toContain('Shared Name')
  expect(review.textContent).toContain('Another employee record has the same normalized name')
  expect(apiClient.post).toHaveBeenCalledWith('/api/admin/employees/46/preview', {
    employeeId: '46', employeeName: 'Shared Name', reason: 'Name spelling correction', expectedVersion: 3,
  })
  expect(apiClient.put).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Back to edit' }))
  expect(screen.getByLabelText('Employee Name').value).toBe('Shared Name')
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(apiClient.put).not.toHaveBeenCalled()
})
test('stale confirmation error retains correction and does not overwrite another account', async () => {
  const target = { id: 46, version: 3, employeeId: '46', employeeName: 'Original Person', officialEmail: 'fixture@example.test', active: true }
  const other = { id: 47, version: 0, employeeId: '47', employeeName: 'Other Person', officialEmail: 'other@example.test', active: true }
  apiClient.get.mockResolvedValue({ data: { content: [target, other], totalPages: 1, totalElements: 2 } })
  apiClient.post.mockImplementation(async (url, payload) => ({ data: { current: target, proposed: payload, duplicateName: false } }))
  apiClient.put.mockRejectedValue({ response: { status: 409, data: { message: 'Employee record changed. Cancel and reopen Edit to review the latest record.' } } })
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Original Person' }))
  fireEvent.change(screen.getByLabelText('Employee Name'), { target: { value: 'Corrected Person' } })
  fireEvent.change(screen.getByLabelText('Change reason'), { target: { value: 'HR correction' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm correction' }))
  await screen.findByText(/Employee record changed/)
  expect(screen.getByLabelText('Employee Name').value).toBe('Corrected Person')
  expect(apiClient.put).toHaveBeenCalledTimes(1)
  expect(apiClient.put.mock.calls[0][0]).toBe('/api/admin/employees/46')
  expect(await screen.findByText('Other Person')).toBeTruthy()
})

test('shows never signed in for an employee without a login', async () => {
  apiClient.get.mockResolvedValue({ data: { content: [{ id: 26, employeeName: 'No Login', officialEmail: 'none@example.test', active: true, lastLoginAt: null }], totalPages: 1, totalElements: 1 } })
  view()
  expect(await screen.findByText('Never signed in')).toBeTruthy()
})

test('keeps the exact HR-issued Employee ID on create', async () => {
  view(); fill()
  fireEvent.change(screen.getByLabelText('Employee ID'), { target: { value: ' 00Ab ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Add Employee' }))
  await screen.findByText('Employee added successfully.')
  expect(apiClient.post).toHaveBeenCalledWith('/api/admin/employees',
    expect.objectContaining({ employeeId: ' 00Ab ' }))
})

test('edits a legacy account name without inventing an Employee ID', async () => {
  const target = { id: 25, version: 2, employeeId: null, employeeName: 'Original',
    officialEmail: 'original@example.test', active: true }
  apiClient.get.mockResolvedValue({ data: { content: [target], totalPages: 1, totalElements: 1 } })
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'Edit Original' }))
  fireEvent.change(screen.getByLabelText('Employee Name'), { target: { value: 'Corrected' } })
  fireEvent.change(screen.getByLabelText('Change reason'), { target: { value: 'Correct the name' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
  await screen.findByRole('button', { name: 'Confirm correction' })
  expect(apiClient.post).toHaveBeenCalledWith('/api/admin/employees/25/preview',
    { employeeId: null, employeeName: 'Corrected', reason: 'Correct the name', expectedVersion: 2 })
})

test('a denied directory response removes administration controls despite a stale capability', async () => {
  apiClient.get.mockRejectedValue({ response: { status: 403 } })
  view()
  await screen.findByRole('alert')
  expect(screen.queryByRole('button', { name: 'Add Employee' })).toBeNull()
  expect(apiClient.post).not.toHaveBeenCalled()
})

test('renders supported before and after audit values', async () => {
  const employee = { id: 25, version: 2, employeeId: 'B', employeeName: 'Corrected',
    officialEmail: 'original@example.test', active: true }
  apiClient.get.mockImplementation(async (url) => ({ data: url.endsWith('/history')
    ? [{ version: 2, actorId: 7, changedAt: '2026-11-07', action: 'UPDATE', reason: 'Correction',
      oldEmployeeId: 'A', newEmployeeId: 'B', oldName: 'Original', newName: 'Corrected', oldActive: true, newActive: true }]
    : { content: [employee], totalPages: 1, totalElements: 1 } }))
  view()
  fireEvent.click(await screen.findByRole('button', { name: 'History for Corrected' }))
  const audit = await screen.findByRole('region', { name: 'Employee audit history' })
  expect(audit.textContent).toContain('Employee ID: A → B')
  expect(audit.textContent).toContain('Name: Original → Corrected')
})
