import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AuthContext from './auth/AuthContext'
import HrWorkspace from './pages/HrWorkspace'
import apiClient from './api/client'

vi.mock('./api/client', () => ({ default: { get: vi.fn() } }))
const incidents = [
  { id: 20, incidentNumber: 'SYN-HR', responsibleDepartmentName: 'People Operations', hrResponsibleDepartment: true, status: 'OPEN' },
  { id: 19, incidentNumber: 'SYN-IT', responsibleDepartmentName: 'IT', hrOversightView: true, status: 'IN_PROGRESS', assignedOwner: 'handler@example.test' },
  { id: 21, incidentNumber: 'SYN-NOT-GRANTED', responsibleDepartmentName: 'IT', hrOversightView: false, status: 'OPEN' },
  { id: 22, incidentNumber: 'SYN-RD', responsibleDepartmentName: 'R&D', hrOversightView: true, status: 'OPEN' },
]
beforeEach(() => {
  vi.resetAllMocks()
  apiClient.get.mockImplementation(async url => {
    if (url === '/api/auth/me') return { data: { canAccessHrWorkspace: true } }
    if (url === '/api/incidents') return { data: incidents }
    if (url === '/api/incidents/19') return { data: { ...incidents[1], investigationDetails: 'Investigating', resolutionDetails: 'Fixed' } }
    if (url === '/api/incidents/19/history') return { data: [{ id: 1, actionType: 'WORK_NOTE', changedBy: 'it@example.test', remarks: 'Reviewed' }, { id: 2, actionType: 'OWNER_ASSIGNED', changedBy: 'head@example.test', oldValue: 'Old handler', newValue: 'New handler' }, { id: 3, actionType: 'INVESTIGATION_UPDATED', changedBy: 'handler@example.test', newValue: 'Prior investigation' }] }
    if (url === '/api/incident-assignment/19/acknowledgement') return { data: { actorId: 4, acknowledgedAt: '2026-11-16T10:00:00' } }
    throw { response: { status: 404 } }
  })
})
afterEach(cleanup)
function show(user) {
  return render(<MemoryRouter><AuthContext.Provider value={{ user }}><HrWorkspace /></AuthContext.Provider></MemoryRouter>)
}

test('HR cases and case-granted oversight are separate and oversight is read-only', async () => {
  show({ role: 'ADMIN', canAccessHrWorkspace: true })
  expect(await screen.findByText('SYN-HR')).toBeTruthy()
  expect(screen.queryByText('SYN-IT')).toBeNull()
  fireEvent.click(screen.getByRole('tab', { name: 'Department Oversight' }))
  expect(screen.getByText('SYN-IT')).toBeTruthy()
  expect(screen.getByText('SYN-RD')).toBeTruthy()
  expect(screen.queryByText('SYN-NOT-GRANTED')).toBeNull()
  expect(screen.queryByText('SYN-HR')).toBeNull()
  fireEvent.change(screen.getByLabelText('Responsible Department'), { target: { value: 'IT' } })
  expect(screen.queryByText('SYN-RD')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Review oversight' }))
  const detail = await screen.findByRole('region', { name: 'Read-only oversight detail' })
  expect(within(detail).getByText('Investigating')).toBeTruthy()
  expect(within(detail).getByText('Fixed')).toBeTruthy()
  expect(within(detail).getByText(/Reviewed/)).toBeTruthy()
  expect(within(detail).getByText('Old handler → New handler')).toBeTruthy()
  expect(within(detail).getByText('Investigation: Prior investigation')).toBeTruthy()
  expect(within(detail).getByText(/by account 4/)).toBeTruthy()
  expect(within(detail).queryByRole('button', { name: /assign|resolve|close|priority/i })).toBeNull()
  expect(within(detail).queryByRole('link', { name: /open/i })).toBeNull()
})

test('role alone does not expose HR workspace or load incident data', () => {
  show({ role: 'ADMIN', canAccessHrWorkspace: false })
  expect(screen.getByRole('alert').textContent).toContain('unavailable')
  expect(apiClient.get).not.toHaveBeenCalled()
})

test('a revoked detail is not displayed even if an old list entry remains', async () => {
  apiClient.get.mockImplementation(async url => {
    if (url === '/api/auth/me') return { data: { canAccessHrWorkspace: true } }
    if (url === '/api/incidents') return { data: incidents }
    throw { response: { status: 404 } }
  })
  show({ canAccessHrWorkspace: true })
  await screen.findByText('SYN-HR')
  fireEvent.click(screen.getByRole('tab', { name: 'Department Oversight' }))
  fireEvent.change(screen.getByLabelText('Responsible Department'), { target: { value: 'IT' } })
  fireEvent.click(screen.getByRole('button', { name: 'Review oversight' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('access has changed'))
  expect(screen.queryByText('Investigating')).toBeNull()
})



test('a revoked HR designation blocks workspace loading despite stale session data', async () => {
  apiClient.get.mockImplementation(async url => {
    if (url === '/api/auth/me') return { data: { canAccessHrWorkspace: false } }
    throw new Error('Incident data must not be requested')
  })
  show({ canAccessHrWorkspace: true })
  expect((await screen.findByRole('alert')).textContent).toContain('unavailable')
  expect(apiClient.get.mock.calls.map(([url]) => url)).toEqual(['/api/auth/me'])
})
test('revoked oversight grant blocks detail requests even when other case access may remain', async () => {
  let listRequests = 0
  apiClient.get.mockImplementation(async url => {
    if (url === '/api/auth/me') return { data: { canAccessHrWorkspace: true } }
    if (url === '/api/incidents') {
      listRequests += 1
      return { data: listRequests === 1 ? incidents : incidents.map(item => ({ ...item, hrOversightView: false })) }
    }
    throw new Error('Details must not be requested after oversight revocation')
  })
  show({ canAccessHrWorkspace: true })
  await screen.findByText('SYN-HR')
  fireEvent.click(screen.getByRole('tab', { name: 'Department Oversight' }))
  fireEvent.change(screen.getByLabelText('Responsible Department'), { target: { value: 'IT' } })
  fireEvent.click(screen.getByRole('button', { name: 'Review oversight' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('access has changed'))
  expect(apiClient.get.mock.calls.map(([url]) => url)).not.toContain('/api/incidents/19')
})