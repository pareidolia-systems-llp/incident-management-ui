import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useState } from 'react'
import EmployeeSearch from './components/EmployeeSearch'
import apiClient from './api/client'

vi.mock('./api/client', () => ({ default: { get: vi.fn() } }))
const alice = { id: 1, employeeId: '002', employeeName: 'Alice Smith', officialEmail: 'alice@example.test' }
const bob = { id: 2, employeeId: '036', employeeName: 'Bob Jones', officialEmail: 'bob@example.test' }
function Harness({ onSearch }) {
  const [value, setValue] = useState('')
  return <EmployeeSearch value={value} onChange={setValue} onSearch={onSearch} />
}
function type(value) { fireEvent.change(screen.getByRole('combobox'), { target: { value } }) }
async function tick(ms = 300) { await act(async () => { await vi.advanceTimersByTimeAsync(ms) }) }
beforeEach(() => {
  vi.useFakeTimers()
  apiClient.get.mockReset()
  apiClient.get.mockResolvedValue({ data: { content: [alice, bob] } })
})
afterEach(() => { cleanup(); vi.useRealTimers() })

test.each(['Ali', '00', 'alice@'])('partial query %s uses bounded server search after debounce', async query => {
  render(<Harness onSearch={vi.fn()} />)
  type(query.slice(0, 1)); await tick()
  expect(apiClient.get).not.toHaveBeenCalled()
  type(query); await tick(299)
  expect(apiClient.get).not.toHaveBeenCalled()
  await tick(1)
  expect(apiClient.get).toHaveBeenCalledWith('/api/admin/employees', {
    params: { search: query, page: 0, size: 6 }, signal: expect.any(AbortSignal),
  })
  expect(screen.getAllByRole('option')).toHaveLength(2)
})
test('rapid typing debounces and stale success cannot replace newer suggestions', async () => {
  let finishOld
  apiClient.get.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve }))
    .mockResolvedValueOnce({ data: { content: [bob] } })
  render(<Harness onSearch={vi.fn()} />)
  type('Al'); await tick()
  const oldSignal = apiClient.get.mock.calls[0][1].signal
  type('Bo'); await tick(100); type('Bob'); await tick()
  expect(oldSignal.aborted).toBe(true)
  expect(apiClient.get).toHaveBeenCalledTimes(2)
  await act(async () => finishOld({ data: { content: [alice] } }))
  expect(screen.getByRole('option').textContent).toContain('Bob')
  expect(screen.queryByText('Alice Smith')).toBeNull()
})
test('stale errors and responses after clearing do not appear', async () => {
  let fail
  apiClient.get.mockImplementationOnce(() => new Promise((resolve, reject) => { fail = reject }))
  const search = vi.fn()
  render(<Harness onSearch={search} />)
  type('Al'); await tick()
  fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
  await act(async () => fail(new Error('private server detail')))
  expect(search).toHaveBeenLastCalledWith('')
  expect(screen.getByRole('combobox').value).toBe('')
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.queryByRole('listbox')).toBeNull()
})
test('arrow navigation selects with Enter, Escape dismisses without searching', async () => {
  const search = vi.fn()
  render(<Harness onSearch={search} />)
  type('Al'); await tick()
  const input = screen.getByRole('combobox')
  fireEvent.keyDown(input, { key: 'ArrowDown' })
  expect(input.getAttribute('aria-activedescendant')).toBe('employeeSuggestion-0')
  fireEvent.keyDown(input, { key: 'ArrowDown' })
  fireEvent.keyDown(input, { key: 'ArrowUp' })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(search).toHaveBeenCalledWith(alice.officialEmail)
  expect(screen.queryByRole('listbox')).toBeNull()
  type('Bob'); await tick()
  fireEvent.keyDown(input, { key: 'Escape' })
  expect(input.getAttribute('aria-expanded')).toBe('false')
  expect(search).toHaveBeenCalledTimes(1)
})
test('loading, no results, bounded suggestions and safe request error states', async () => {
  apiClient.get.mockResolvedValueOnce({ data: { content: [] } })
    .mockRejectedValueOnce(new Error('sensitive detail'))
    .mockResolvedValueOnce({ data: { content: Array.from({ length: 9 }, (_, id) => ({ ...alice, id })) } })
  render(<Harness onSearch={vi.fn()} />)
  type('zz')
  expect(screen.getByRole('status').textContent).toContain('Loading')
  await tick()
  expect(screen.getByRole('status').textContent).toContain('No matching suggestions')
  type('bad'); await tick()
  expect(screen.getByRole('alert').textContent).toContain('Unable to load suggestions')
  expect(screen.getByRole('alert').textContent).not.toContain('sensitive')
  type('Ali'); await tick()
  expect(screen.getAllByRole('option')).toHaveLength(6)
})
test('pointer selection filters by official email and Search remains available', async () => {
  const search = vi.fn()
  render(<Harness onSearch={search} />)
  type('Al'); await tick()
  fireEvent.click(screen.getAllByRole('option')[0])
  expect(search).toHaveBeenLastCalledWith(alice.officialEmail)
  type('x')
  fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }))
  expect(search).toHaveBeenLastCalledWith('x')
})

test('Escape during a request prevents late suggestions from reopening', async () => {
  let finish
  apiClient.get.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  render(<Harness onSearch={vi.fn()} />)
  type('Ali'); await tick()
  fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' })
  expect(apiClient.get.mock.calls[0][1].signal.aborted).toBe(true)
  await act(async () => finish({ data: { content: [alice] } }))
  expect(screen.queryByRole('listbox')).toBeNull()
  expect(screen.getByRole('combobox').value).toBe('Ali')
})
