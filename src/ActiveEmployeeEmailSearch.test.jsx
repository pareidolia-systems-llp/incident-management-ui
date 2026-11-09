import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import ActiveEmployeeEmailSearch from './components/ActiveEmployeeEmailSearch'
import apiClient from './api/client'
vi.mock('./api/client', () => ({ default: { get: vi.fn() } }))
const employee = { id: 7, name: 'Example Person', email: 'person@example.test' }
beforeEach(() => { vi.clearAllMocks() })
afterEach(cleanup)
test('searches only after a bounded query and returns the internal account id on selection', async () => {
  apiClient.get.mockResolvedValue({ data: [employee] })
  const onSelect = vi.fn()
  render(<ActiveEmployeeEmailSearch onSelect={onSelect} />)
  expect(screen.getByRole('button', { name: 'Search' }).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Official employee email'), { target: { value: ' person@ ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  fireEvent.click(await screen.findByRole('button', { name: /Example Person/ }))
  expect(apiClient.get).toHaveBeenCalledWith('/api/admin/employees/active-email-search', { params: { search: 'person@' } })
  expect(onSelect).toHaveBeenLastCalledWith(employee)
})
test('renders a safe error and no stale employee data on denied access', async () => {
  apiClient.get.mockRejectedValue(new Error('private server detail'))
  render(<ActiveEmployeeEmailSearch onSelect={vi.fn()} />)
  fireEvent.change(screen.getByLabelText('Official employee email'), { target: { value: 'person' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  expect((await screen.findByRole('alert')).textContent).not.toContain('private server detail')
  expect(screen.queryByRole('list')).toBeNull()
})
test('a late result cannot repopulate results after the query changes', async () => {
  let resolve
  apiClient.get.mockReturnValue(new Promise(done => { resolve = done }))
  render(<ActiveEmployeeEmailSearch onSelect={vi.fn()} />)
  const input = screen.getByLabelText('Official employee email')
  fireEvent.change(input, { target: { value: 'person' } }); fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  fireEvent.change(input, { target: { value: 'other' } })
  await act(async () => resolve({ data: [employee] }))
  expect(screen.queryByText(/Example Person/)).toBeNull()
})
