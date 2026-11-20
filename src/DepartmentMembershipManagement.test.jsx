import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import apiClient from './api/client'
import DepartmentMembershipManagement from './components/DepartmentMembershipManagement'

vi.mock('./api/client', () => ({ default: { get: vi.fn(), put: vi.fn() } }))

const path = '/api/admin/department-memberships'
beforeEach(() => {
  vi.resetAllMocks()
  apiClient.get.mockImplementation(async url => {
    if (url === path + '/departments') return { data: [{ id: 7, name: 'Operations' }] }
    if (url === path + '/7') return { data: [{ userId: 3, name: 'Member', email: 'member@example.test', active: true, version: 4 }] }
    if (url === path + '/7/3/history') return { data: [{ version: 4, newActive: true, reason: 'Approved', actorUserId: 2 }] }
    if (url === path + '/employees') return { data: [{ id: 8, name: 'Employee', email: 'employee@example.test' }] }
    throw new Error('Unexpected request')
  })
  apiClient.put.mockResolvedValue({})
})
afterEach(cleanup)

function show() {
  render(<MemoryRouter><DepartmentMembershipManagement /></MemoryRouter>)
}

test('membership controls require server authorization', async () => {
  apiClient.get.mockRejectedValue({ response: { status: 403 } })
  show()
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith(path + '/departments', undefined))
  expect(screen.queryByLabelText('Membership department')).toBeNull()
})

test('revokes the selected member with a current version and mandatory reason', async () => {
  show()
  fireEvent.change(await screen.findByLabelText('Membership department'), { target: { value: '7' } })
  fireEvent.click(await screen.findByRole('button', { name: /Member ·/ }))
  await screen.findByLabelText('Membership audit history')
  expect(screen.getByRole('button', { name: 'Review revocation' }).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Membership change reason'), { target: { value: 'Department change' } })
  fireEvent.click(screen.getByRole('button', { name: 'Review revocation' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm membership change' }))
  await screen.findByText('Department membership saved.')
  expect(apiClient.put).toHaveBeenCalledWith(path + '/7/3', { active: false, expectedVersion: 4, reason: 'Department change' })
})

test('a stale grant reloads instead of resubmitting', async () => {
  apiClient.put.mockRejectedValue({ response: { status: 409 } })
  show()
  fireEvent.change(await screen.findByLabelText('Membership department'), { target: { value: '7' } })
  fireEvent.change(await screen.findByLabelText('Official employee email'), { target: { value: 'employee' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  fireEvent.click(await screen.findByRole('button', { name: /Employee ·/ }))
  fireEvent.change(screen.getByLabelText('Membership change reason'), { target: { value: 'New role' } })
  fireEvent.click(screen.getByRole('button', { name: 'Review grant' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm membership change' }))
  await screen.findByRole('alert')
  expect(screen.getByRole('alert').textContent).toContain('Membership changed')
  expect(apiClient.put).toHaveBeenCalledExactlyOnceWith(path + '/7/8', { active: true, expectedVersion: 0, reason: 'New role' })
  expect(screen.queryByRole('button', { name: 'Confirm membership change' })).toBeNull()
})
