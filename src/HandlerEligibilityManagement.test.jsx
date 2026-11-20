import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import HandlerEligibilityManagement from './components/HandlerEligibilityManagement'
import apiClient from './api/client'

vi.mock('./api/client', () => ({ default: { get: vi.fn(), put: vi.fn() } }))
afterEach(() => { cleanup(); vi.resetAllMocks() })

test('handler eligibility selects a result from the dedicated active-email array', async () => {
  apiClient.get.mockResolvedValueOnce({ status: 200, data: [] })
    .mockResolvedValueOnce({ status: 200, data: [{ id: 7, name: 'Example Person', email: 'person@example.test' }] })
  render(<HandlerEligibilityManagement />)
  fireEvent.change(await screen.findByLabelText('Official employee email'), { target: { value: ' example ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Example Person · person@example.test' }))
  expect(apiClient.get).toHaveBeenLastCalledWith('/api/admin/employees/active-email-search', { params: { search: 'example' } })
  expect(screen.getByText('Selected: Example Person — person@example.test')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})

test('a paginated 200 response is not treated as an active-email result', async () => {
  apiClient.get.mockResolvedValueOnce({ status: 200, data: [] })
    .mockResolvedValueOnce({ status: 200, data: { content: [{ id: 7, employeeName: 'Private record' }], totalElements: 1 } })
  render(<HandlerEligibilityManagement />)
  fireEvent.change(await screen.findByLabelText('Official employee email'), { target: { value: 'example' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  expect((await screen.findByRole('alert')).textContent).toBe('Unable to search employees. Please try again.')
  expect(screen.queryByText(/Private record/)).toBeNull()
})

test('existing eligibility can be revoked with its version and a reason', async () => {
  apiClient.get.mockResolvedValue({ data: [{ userId: 42, name: 'Example', email: 'user@example.test', active: true, version: 3 }] })
  apiClient.put.mockResolvedValue({ data: { version: 4 } })
  render(<HandlerEligibilityManagement />)
  const row = (await screen.findByText(/Example — user@example.test/)).closest('li')
  fireEvent.click(within(row).getByRole('button', { name: 'Select' }))
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: ' Rotation ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save eligibility' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledWith('/api/admin/handler-eligibility/42', { active: false, expectedVersion: 3, reason: 'Rotation' }))
})
