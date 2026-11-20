import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import apiClient from './api/client'
import DepartmentMailRecipients from './components/DepartmentMailRecipients'

vi.mock('./api/client', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))
afterEach(() => { cleanup(); vi.resetAllMocks() })

const path = '/api/admin/department-mail-recipients'
const recipient = { id: 'example', departmentId: 7, departmentName: 'IT', email: 'team@example.test', active: true, version: 2 }

test('sends a versioned deactivation with a required reason', async () => {
  apiClient.get.mockResolvedValue({ data: { departments: [{ id: 7, name: 'IT' }], recipients: [recipient] } })
  apiClient.put.mockResolvedValue({ status: 204 })
  render(<DepartmentMailRecipients />)
  fireEvent.click(await screen.findByRole('button', { name: 'Edit recipient' }))
  fireEvent.click(screen.getByLabelText('Active recipient'))
  expect(screen.getByRole('button', { name: 'Save recipient' }).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Change reason'), { target: { value: 'Mailbox retired' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save recipient' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith(path + '/example', {
    email: 'team@example.test', active: false, expectedVersion: 2, reason: 'Mailbox retired',
  }))
  expect(await screen.findByText('Recipient configuration saved.')).toBeTruthy()
})

test('withholds configuration controls after an authorization denial', async () => {
  apiClient.get.mockRejectedValue({ response: { status: 403 } })
  render(<DepartmentMailRecipients />)
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Add recipient' })).toBeNull()
})
