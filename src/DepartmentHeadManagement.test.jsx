import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import DepartmentHeadManagement from './components/DepartmentHeadManagement'
import apiClient from './api/client'
vi.mock('./api/client', () => ({ default: { get: vi.fn(), put: vi.fn() } }))
const department = { id: 1, name: 'Example Department', active: true }
const person = { id: 8, name: 'Example Person', email: 'person@example.test' }
const existing = { departmentId: 1, departmentName: 'Example Department', userId: 8,
  name: person.name, email: person.email, active: true, version: 0 }
let designations
beforeEach(() => {
  vi.clearAllMocks();designations=[]
  apiClient.get.mockImplementation(async url => {
    if (url.endsWith('/departments')) return { data: [department] }
    if (url.endsWith('/active-email-search')) return { data: [person] }
    if (url.endsWith('/history')) return { data: [{ actorUserId: 4, oldActive: null, newActive: true, version: 0, reason: 'Approved', changedAt: '2026-11-06T10:00' }] }
    return { data: designations }
  })
  apiClient.put.mockResolvedValue({ data: { version: 0 } })
})
afterEach(cleanup)
async function selectPerson() {
  fireEvent.change(screen.getByLabelText('Official employee email'), { target: { value: 'person@' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  fireEvent.click(await screen.findByRole('button', { name: /Example Person/ }))
}
test('reviews and saves an active account designation with a reason and no implicit permissions', async () => {
  render(<DepartmentHeadManagement />)
  await screen.findByRole('option', { name: 'Example Department' });await selectPerson()
  fireEvent.change(screen.getByLabelText('Department'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: ' Approved by HR ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Review change' }))
  expect(screen.getByLabelText('Confirm designation change').textContent).toContain('Approved by HR')
  expect(apiClient.put).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm change' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/api/admin/department-head-designations/1/8',
    { active: true, expectedVersion: null, reason: 'Approved by HR' }))
  expect((await screen.findByRole('status')).textContent).toContain('Department-head designation saved.')
})
test('removal sends the server version and history comes from the backend', async () => {
  designations=[existing];render(<DepartmentHeadManagement />)
  fireEvent.click(await screen.findByRole('button', { name: 'View history' }))
  expect((await screen.findByLabelText('Designation audit history')).textContent).toContain('Approved')
  fireEvent.click(screen.getByRole('button', { name: 'Select for removal' }))
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Role changed' } })
  fireEvent.click(screen.getByRole('button', { name: 'Review change' }));fireEvent.click(screen.getByRole('button', { name: 'Confirm change' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/api/admin/department-head-designations/1/8',
    { active: false, expectedVersion: 0, reason: 'Role changed' }))
})
test('rejects denied directory reads without showing stale names', async () => {
  apiClient.get.mockRejectedValue({ response: { status: 403, data: { message: 'private' } } })
  render(<DepartmentHeadManagement />)
  expect((await screen.findByRole('alert')).textContent).toContain('Ask the HR access administrator')
  expect(screen.queryByText(/private/)).toBeNull();expect(apiClient.put).not.toHaveBeenCalled()
})

test.each([500, undefined])('shows technical guidance for server and network failures (%s)', async status => {
  apiClient.get.mockRejectedValue(status ? { response: { status } } : new Error('offline'))
  render(<DepartmentHeadManagement />)
  expect((await screen.findByRole('alert')).textContent).toContain('contact portal support')
  expect(screen.queryByText(/HR access administrator/)).toBeNull()
})
test('version conflicts clear the selected account and require review again', async () => {
  designations=[existing];apiClient.put.mockRejectedValue({ response: { status: 409 } });render(<DepartmentHeadManagement />)
  fireEvent.click(await screen.findByRole('button', { name: 'Select for removal' }))
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Change' } })
  fireEvent.click(screen.getByRole('button', { name: 'Review change' }));fireEvent.click(screen.getByRole('button', { name: 'Confirm change' }))
  expect((await screen.findByRole('alert')).textContent).toContain('changed')
  expect(screen.queryByLabelText('Confirm designation change')).toBeNull()
})

test('revoked audit access removes previously displayed employee information', async () => {
  designations=[existing]
  apiClient.get.mockImplementation(async url => {
    if (url.endsWith('/departments')) return { data: [department] }
    if (url.endsWith('/history')) throw { response: { status: 403 } }
    return { data: designations }
  })
  render(<DepartmentHeadManagement />)
  fireEvent.click(await screen.findByRole('button', { name: 'View history' }))
  expect((await screen.findByRole('alert')).textContent).toContain('unavailable')
  expect(screen.queryByText(/Example Person/)).toBeNull()
  expect(screen.queryByLabelText('Official employee email')).toBeNull()
})

test('prevents overlapping confirmation requests', async () => {
  let finish
  apiClient.put.mockReturnValue(new Promise(resolve => { finish = resolve }))
  render(<DepartmentHeadManagement />)
  await screen.findByRole('option', { name: 'Example Department' });await selectPerson()
  fireEvent.change(screen.getByLabelText('Department'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Approved' } })
  fireEvent.click(screen.getByRole('button', { name: 'Review change' }))
  const button=screen.getByRole('button', { name: 'Confirm change' })
  fireEvent.click(button);fireEvent.click(button)
  expect(apiClient.put).toHaveBeenCalledTimes(1)
  await act(async () => finish({ data: { version: 0 } }))
})
