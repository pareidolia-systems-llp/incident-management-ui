import { afterEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import HandlerEligibilityManagement from './components/HandlerEligibilityManagement'
import apiClient from './api/client'

vi.mock('./api/client', () => ({ default: { get: vi.fn(), put: vi.fn() } }))
afterEach(() => { cleanup(); vi.resetAllMocks() })

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
