import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import apiClient from './api/client'
import IncidentAssignment from './components/IncidentAssignment'
import AssignmentTriage from './pages/AssignmentTriage'

vi.mock('./api/client', () => ({ default: { get: vi.fn(), post: vi.fn() } }))

const employee = { id: 8, name: 'Eligible Employee', email: 'eligible@example.test' }
const state = { incidentId: 12, classification: 'STANDARD', classificationVersion: 3, version: 2, handler: null, proposal: employee, canAssign: true }

beforeEach(() => {
  vi.resetAllMocks()
  apiClient.get.mockImplementation(async url => ({
    data: url.endsWith('/handlers') ? [employee] : url.endsWith('/history') ? [] : state,
  }))
  apiClient.post.mockResolvedValue({ data: state })
})
afterEach(cleanup)

test.each([null, { id: 9, name: 'Current Handler', email: 'current@example.test' }])('uses incident-scoped eligibility and both versions for assignment and reassignment', async handler => {
  apiClient.get.mockResolvedValueOnce({ data: { ...state, handler } })
  render(<IncidentAssignment incidentId={12} />)
  const search = await screen.findByLabelText(/Search eligible handlers/)
  expect(screen.queryByText(/^Selected:/)).toBeNull()
  fireEvent.change(search, { target: { value: 'Eligible' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search handlers' }))
  fireEvent.click(await screen.findByRole('button', { name: /Eligible Employee/ }))
  expect(apiClient.get).toHaveBeenCalledWith('/api/incident-assignment/handlers', { params: { search: 'Eligible', incidentId: 12 } })
  fireEvent.change(screen.getByLabelText('Assignment reason'), { target: { value: ' Coverage ' } })
  const save = screen.getByRole('button', { name: handler ? 'Reassign Incident' : 'Confirm assignment' })
  expect(save.disabled).toBe(true)
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(save)
  await waitFor(() => expect(apiClient.post).toHaveBeenCalledExactlyOnceWith('/api/incident-assignment/12', {
    handlerUserId: 8, expectedVersion: 2, expectedClassificationVersion: 3, reason: 'Coverage',
  }))
})

test('canAssign false leaves assignment history readable without granting mutation', async () => {
  apiClient.get.mockResolvedValueOnce({ data: { ...state, canAssign: false } })
  render(<IncidentAssignment incidentId={12} />)
  expect(await screen.findByText(/Assignment is unavailable for this incident/)).toBeTruthy()
  expect(screen.getByText('Current handler: Not assigned')).toBeTruthy()
  expect(screen.queryByLabelText(/Search eligible handlers/)).toBeNull()
  expect(apiClient.post).not.toHaveBeenCalled()
})

test('assignment conflict discards the selection and refreshes without resubmitting', async () => {
  apiClient.post.mockRejectedValue({ response: { status: 409 } })
  render(<IncidentAssignment incidentId={12} />)
  fireEvent.change(await screen.findByLabelText(/Search eligible handlers/), { target: { value: 'Eligible' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search handlers' }))
  fireEvent.click(await screen.findByRole('button', { name: /Eligible Employee/ }))
  fireEvent.change(screen.getByLabelText('Assignment reason'), { target: { value: 'Coverage' } })
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm assignment' }))
  expect(await screen.findByText(/incident changed/i)).toBeTruthy()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm assignment' }).disabled).toBe(true))
  expect(apiClient.get.mock.calls.filter(([url]) => url === '/api/incident-assignment/12')).toHaveLength(2)
  expect(apiClient.post).toHaveBeenCalledOnce()
})

test('triage reads trusted detail and sends unclassified cases to authorized security administration', async () => {
  apiClient.get.mockResolvedValueOnce({ data: [{ incidentId: 12, incidentNumber: 'INC-12', classification: 'UNCLASSIFIED' }] })
  apiClient.get.mockResolvedValueOnce({ data: { incident: { incidentNumber: 'INC-12', title: 'Synthetic case' }, assignment: { ...state, classification: 'UNCLASSIFIED', canAssign: false } } })
  render(<AssignmentTriage />)
  fireEvent.change(await screen.findByLabelText('Recent authorized incidents'), { target: { value: '12' } })
  expect(await screen.findByText(/authorized classifier must set a trusted classification/)).toBeTruthy()
  expect(apiClient.get).toHaveBeenCalledWith('/api/incident-assignment/triage/12')
  expect(screen.queryByRole('button', { name: /save.*classification/i })).toBeNull()
})
