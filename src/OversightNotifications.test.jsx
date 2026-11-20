import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, test, vi } from 'vitest'
import apiClient from './api/client'
import OversightNotifications from './components/OversightNotifications'

vi.mock('./api/client', () => ({ default: { get: vi.fn() } }))

test('lists generic oversight notices and opens only a server-authorized incident', async () => {
  const id = '58c74dc7-dfb3-4a8f-9735-9933108b8c67'
  const endpoint = '/api/incident-oversight-notifications'
  const open = `${endpoint}/${id}/incident`
  apiClient.get.mockImplementation((url) => {
    if (url === endpoint) return Promise.resolve({ data: [id] })
    return Promise.reject(new Error('Not found'))
  })
  render(<MemoryRouter><Routes>
    <Route path="/" element={<OversightNotifications />} />
    <Route path="/incidents/:id" element={<p>Incident details</p>} />
  </Routes></MemoryRouter>)

  const button = await screen.findByRole('button', { name: 'Open incident' })
  expect(screen.getByText('New incident reported.')).toBeTruthy()
  expect(screen.queryByText(id)).toBeNull()
  fireEvent.click(button)
  expect((await screen.findByRole('alert')).textContent).toContain('unavailable')
  expect(screen.queryByText('Incident details')).toBeNull()
  await waitFor(() => expect(button.disabled).toBe(false))

  apiClient.get.mockImplementation((url) => Promise.resolve({ data: url === open ? { incidentId: 30 } : [id] }))
  fireEvent.click(button)
  expect(await screen.findByText('Incident details')).toBeTruthy()
  expect(apiClient.get).toHaveBeenCalledWith(open)
})
