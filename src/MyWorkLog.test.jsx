import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import AuthContext from './auth/AuthContext'
import AppLayout from './components/AppLayout'
import MyWorkLog from './pages/MyWorkLog'
import apiClient from './api/client'

vi.mock('./api/client', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
beforeEach(() => { vi.resetAllMocks(); apiClient.get.mockResolvedValue({ data: [] }); localStorage.clear() })
afterEach(cleanup)
function Location() { return <output data-testid="route">{useLocation().pathname}</output> }
function setup(role = 'IT_HANDLER') {
  return render(<AuthContext.Provider value={{ user: { role, email: 'operator@example.test', displayName: 'Operator' }, logout: vi.fn() }}>
    <MemoryRouter initialEntries={['/work-logs']}><Routes><Route element={<AppLayout />}><Route path="/work-logs" element={<><MyWorkLog /><Location /></>} /></Route></Routes></MemoryRouter>
  </AuthContext.Provider>)
}
async function open() {
  await screen.findByText('No work entries recorded yet.')
  fireEvent.click(screen.getByRole('button', { name: 'Add Work Entry' }))
  return screen.getByRole('dialog')
}
function change(label, value) { fireEvent.change(screen.getByLabelText(label), { target: { value } }) }
function fill() {
  change(/Work Date/, '2026-10-15'); change(/Work Time/, '15:40')
  change(/Category/, 'MAINTENANCE'); change(/Summary/, ' Updated firewall rules ')
  change('Details', ' Checked connectivity '); change('Duration (minutes)', '30')
}
test.each(['IT_HANDLER', 'ADMIN'])('%s sees navigation, empty state and add action', async (role) => {
  setup(role)
  expect(screen.getByRole('link', { name: 'My Work Log' }).getAttribute('href')).toBe('/work-logs')
  expect(await screen.findByText('No work entries recorded yet.')).toBeTruthy()
  expect(apiClient.get).toHaveBeenCalledWith('/api/work-logs')
  expect(screen.getByRole('button', { name: 'Add Work Entry' })).toBeTruthy()
})
test.each(['REPORTER', 'REVIEWER'])('%s has neither navigation nor direct-route access', (role) => {
  setup(role)
  expect(screen.queryByRole('link', { name: 'My Work Log' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Add Work Entry' })).toBeNull()
  expect(screen.getByRole('alert').textContent).toContain('do not have permission')
  expect(apiClient.get).not.toHaveBeenCalled()
})
test('validates fields before sending and preserves entered work', async () => {
  setup(); await open()
  change(/Summary/, '   '); change('Duration (minutes)', '0')
  change(/Work Date/, ''); change(/Work Time/, '')
  fireEvent.click(screen.getByRole('button', { name: 'Save Work Entry' }))
  expect(screen.getByText('Summary is required.')).toBeTruthy()
  expect(screen.getByText('Enter a positive whole number of minutes.')).toBeTruthy()
  expect(screen.getByText('Select a valid work time.')).toBeTruthy()
  expect(apiClient.post).not.toHaveBeenCalled()
  expect(screen.getByRole('dialog')).toBeTruthy()
})
test('saves only editable fields, stays on the page and refreshes the list', async () => {
  setup(); await open(); fill()
  apiClient.post.mockResolvedValue({ data: { id: 1 } })
  apiClient.get.mockResolvedValue({ data: [{ id: 1, workedAt: '2026-10-15T15:40:00', category: 'MAINTENANCE', summary: 'Updated firewall rules', details: 'Checked connectivity', durationMinutes: 30 }] })
  fireEvent.click(screen.getByRole('button', { name: 'Save Work Entry' }))
  await screen.findByText('Work entry saved successfully.')
  expect(await screen.findByText('Updated firewall rules')).toBeTruthy()
  expect(screen.getByText('Maintenance')).toBeTruthy()
  expect(screen.getByText('30 min')).toBeTruthy()
  expect(screen.getByText('Checked connectivity')).toBeTruthy()
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(screen.getByTestId('route').textContent).toBe('/work-logs')
  expect(apiClient.get).toHaveBeenCalledTimes(2)
  expect(apiClient.post).toHaveBeenCalledExactlyOnceWith('/api/work-logs', { workedAt: '2026-10-15T15:40:00', category: 'MAINTENANCE', summary: 'Updated firewall rules', details: 'Checked connectivity', durationMinutes: 30 })
})
test('renders backend order and optional duration without re-sorting', async () => {
  apiClient.get.mockResolvedValue({ data: [{ id: 3, workedAt: '2026-10-15T15:40:00', category: 'USER_SUPPORT', summary: 'First', durationMinutes: null }, { id: 2, workedAt: '2026-10-15T15:40:00', category: 'SECURITY', summary: 'Second', durationMinutes: 20 }] })
  setup(); await screen.findByText('First')
  const rows = screen.getAllByRole('row')
  expect(rows[1].textContent).toContain('First'); expect(rows[2].textContent).toContain('Second')
  expect(within(rows[1]).getByText('User Support')).toBeTruthy()
  expect(within(rows[1]).getByText('—')).toBeTruthy()
})
test('save failure retains input and permits retry', async () => {
  setup(); await open(); fill(); apiClient.post.mockRejectedValue(new Error('offline'))
  fireEvent.click(screen.getByRole('button', { name: 'Save Work Entry' }))
  await screen.findByRole('alert')
  expect(screen.getByLabelText(/Summary/).value).toBe(' Updated firewall rules ')
  expect(screen.getByRole('dialog')).toBeTruthy()
  expect(apiClient.get).toHaveBeenCalledTimes(1)
})
test('refresh failure after save does not resubmit or reopen the form', async () => {
  setup(); await open(); fill(); apiClient.post.mockResolvedValue({ data: {} }); apiClient.get.mockRejectedValue(new Error('offline'))
  fireEvent.click(screen.getByRole('button', { name: 'Save Work Entry' }))
  await screen.findByText('Work entry saved successfully.')
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2))
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(apiClient.post).toHaveBeenCalledTimes(1)
})
test('cancel discards the draft without saving', async () => {
  setup(); await open(); fill(); fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(apiClient.post).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Add Work Entry' }))
  expect(screen.getByLabelText(/Summary/).value).toBe('')
})
