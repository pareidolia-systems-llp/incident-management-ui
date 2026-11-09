import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import apiClient from './api/client'
import IncidentAssignment from './components/IncidentAssignment'
import IncidentDepartmentTransfer from './components/IncidentDepartmentTransfer'

vi.mock('./api/client', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))

const base = '/api/incident-assignment/12'
const state = { incidentId: 12, sourceDepartmentId: 71, assignmentVersion: 2, classificationVersion: 3 }
const departments = [{ departmentId: 73, displayName: 'Operations' }, { departmentId: 74, displayName: 'Facilities' }]
const handler = { id: 8, name: 'Eligible Employee', email: 'eligible@example.test' }
const options = { state, destinations: departments }
const results = { state, destinationDepartmentId: 73, handlers: [handler] }

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('VITE_INCIDENT_ASSIGNMENT_ENABLED', 'true')
  apiClient.get.mockImplementation(async url => {
    if (url === base + '/transfer/options') return { data: options }
    if (url === base + '/transfer/handlers') return { data: results }
    if (url === base + '/transfer/handoffs') return { data: [{ ...state, destinationDepartmentId: 73, handlerId: 8, status: 'APPROVED', canUse: true, reference: 'REVIEW-42' }] }
    if (url === base + '/history') return { data: [] }
    if (url === base) return { data: { incidentId: 12, canAssign: false, classification: 'STANDARD' } }
    throw new Error('Unexpected URL')
  })
  apiClient.post.mockResolvedValue({ data: { incidentId: 12 } })
})
afterEach(() => { cleanup(); vi.unstubAllEnvs() })

async function destination(id = '73') {
  const select = await screen.findByLabelText('Destination department')
  fireEvent.change(select, { target: { value: id } })
}

function search(query = 'Eligible') {
  fireEvent.change(screen.getByLabelText('Search destination handlers'), { target: { value: query } })
  fireEvent.click(screen.getByRole('button', { name: 'Search destination' }))
}

async function review() {
  await destination()
  search()
  fireEvent.change(await screen.findByLabelText('Destination handler'), { target: { value: '8' } })
  fireEvent.change(screen.getByLabelText('Transfer reason'), { target: { value: ' Coverage handoff ' } })
  expect(screen.getByRole('button', { name: 'Review transfer' }).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Handoff approval reference'), { target: { value: 'REVIEW-42' } })
  fireEvent.click(screen.getByRole('button', { name: 'Review transfer' }))
}

test('confirms a server-selected transfer and refreshes assignment, history and the parent incident', async () => {
  const refresh = vi.fn()
  render(<IncidentAssignment incidentId={12} onAssigned={refresh} />)
  const select = await screen.findByLabelText('Destination department')
  expect(within(select).getAllByRole('option').map(item => item.value)).toEqual(['', '73', '74'])
  await review()
  expect(apiClient.get).toHaveBeenCalledWith(base + '/transfer/handlers', { params: { destinationDepartmentId: 73, search: 'Eligible' } })
  const summary = screen.getByRole('region', { name: 'Review department transfer' })
  expect(within(summary).getByText('Department #71')).toBeTruthy()
  expect(within(summary).getByText('Operations (#73)')).toBeTruthy()
  expect(within(summary).getByText('Eligible Employee — eligible@example.test')).toBeTruthy()
  expect(within(summary).getByText('Coverage handoff')).toBeTruthy()
  expect(apiClient.post).not.toHaveBeenCalled()
  fireEvent.click(within(summary).getByRole('button', { name: 'Confirm transfer' }))
  expect(await screen.findByText('Department transfer completed.')).toBeTruthy()
  expect(apiClient.post).toHaveBeenCalledExactlyOnceWith(base + '/transfer', {
    expectedSourceDepartmentId: 71,
    destinationDepartmentId: 73,
    destinationHandlerUserId: 8,
    expectedVersion: 2,
    expectedClassificationVersion: 3,
    reason: 'Coverage handoff',
    handoffApprovalReference: 'REVIEW-42',
  })
  expect(refresh).toHaveBeenCalledOnce()
  expect(apiClient.get.mock.calls.filter(([url]) => url === base)).toHaveLength(2)
  expect(apiClient.get.mock.calls.filter(([url]) => url === base + '/history')).toHaveLength(2)
})

test.each([403, 404])('does not expose controls when transfer discovery returns %s', async status => {
  apiClient.get.mockRejectedValue({ response: { status } })
  render(<IncidentDepartmentTransfer incidentId={12} />)
  await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith(base + '/transfer/options'))
  expect(screen.queryByRole('heading', { name: 'Transfer Department' })).toBeNull()
  expect(screen.queryByLabelText('Destination department')).toBeNull()
  expect(apiClient.post).not.toHaveBeenCalled()
})

test('the F2 flag off prevents transfer discovery requests', () => {
  vi.stubEnv('VITE_INCIDENT_ASSIGNMENT_ENABLED', 'false')
  render(<IncidentDepartmentTransfer incidentId={12} />)
  expect(screen.queryByLabelText('Destination department')).toBeNull()
  expect(apiClient.get).not.toHaveBeenCalled()
})

test.each(['sourceDepartmentId', 'assignmentVersion', 'classificationVersion'])('stale %s clears selections and reloads before review', async field => {
  apiClient.get.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: options })
    .mockResolvedValueOnce({ data: { ...results, state: { ...state, [field]: state[field] + 1 } } })
  const refresh = vi.fn()
  render(<IncidentDepartmentTransfer incidentId={12} onRefresh={refresh} />)
  await destination()
  search()
  expect((await screen.findByRole('alert')).textContent).toContain('incident changed')
  expect((await screen.findByLabelText('Destination department')).value).toBe('')
  expect(screen.queryByLabelText('Destination handler')).toBeNull()
  expect(refresh).toHaveBeenCalledOnce()
  expect(apiClient.post).not.toHaveBeenCalled()
})

test('requires a returned valid handler ID and shows at most ten matches', async () => {
  apiClient.get.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: options }).mockResolvedValueOnce({ data: {
    ...results, handlers: [{ ...handler, id: '8' }, ...Array.from({ length: 12 }, (_, index) => ({ ...handler, id: index + 20 }))],
  } })
  render(<IncidentDepartmentTransfer incidentId={12} />)
  await destination()
  search('E')
  expect(apiClient.get.mock.calls.filter(([url]) => url === base + '/transfer/handlers')).toHaveLength(0)
  search()
  const select = await screen.findByLabelText('Destination handler')
  expect(within(select).getAllByRole('option').map(item => item.value)).toEqual(['', ...Array.from({ length: 10 }, (_, index) => String(index + 20))])
  const forged = document.createElement('option')
  forged.value = '999'
  select.appendChild(forged)
  fireEvent.change(select, { target: { value: '999' } })
  fireEvent.change(screen.getByLabelText('Transfer reason'), { target: { value: 'Coverage' } })
  fireEvent.change(screen.getByLabelText('Handoff approval reference'), { target: { value: 'REVIEW-42' } })
  expect(screen.getByRole('button', { name: 'Review transfer' }).disabled).toBe(true)
  expect(apiClient.post).not.toHaveBeenCalled()
})

test('a late result from the previous destination cannot populate the new selection', async () => {
  let respond
  apiClient.get.mockResolvedValueOnce({ data: [] }).mockResolvedValueOnce({ data: options })
    .mockReturnValueOnce(new Promise(resolve => { respond = resolve }))
  render(<IncidentDepartmentTransfer incidentId={12} />)
  await destination()
  search()
  await destination('74')
  await act(async () => respond({ data: results }))
  expect(screen.getByLabelText('Destination department').value).toBe('74')
  expect(screen.queryByLabelText('Destination handler')).toBeNull()
  expect(screen.queryByRole('alert')).toBeNull()
})

test('409 clears the review and reloads without exposing grant details or resubmitting', async () => {
  apiClient.post.mockRejectedValue({ response: { status: 409, data: { message: 'Sensitive case grant detail' } } })
  const refresh = vi.fn()
  render(<IncidentDepartmentTransfer incidentId={12} onRefresh={refresh} />)
  await review()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm transfer' }))
  expect((await screen.findByRole('alert')).textContent).toContain('access handoff requires independent review')
  expect(screen.queryByText('Sensitive case grant detail')).toBeNull()
  expect((await screen.findByLabelText('Destination department')).value).toBe('')
  expect(screen.queryByRole('button', { name: 'Confirm transfer' })).toBeNull()
  expect(refresh).toHaveBeenCalledOnce()
  expect(apiClient.get.mock.calls.filter(([url]) => url === base + '/transfer/options')).toHaveLength(2)
  expect(apiClient.post).toHaveBeenCalledOnce()
})

test('coordinator requests a handoff with the selected route, handler and versions', async () => {
  apiClient.get.mockResolvedValueOnce({ data: [] })
  render(<IncidentDepartmentTransfer incidentId={12} />)
  await destination()
  search()
  fireEvent.change(await screen.findByLabelText('Destination handler'), { target: { value: '8' } })
  fireEvent.change(screen.getByLabelText('Transfer reason'), { target: { value: 'Coverage' } })
  fireEvent.click(screen.getByRole('button', { name: 'Request handoff approval' }))
  expect(await screen.findByText('Handoff approval requested.')).toBeTruthy()
  expect(apiClient.post).toHaveBeenCalledWith(base + '/transfer/handoffs', {
    expectedSourceDepartmentId: 71, destinationDepartmentId: 73, destinationHandlerUserId: 8,
    expectedVersion: 2, expectedClassificationVersion: 3, reason: 'Coverage',
  })
})

test.each([['Approve', 'APPROVED', true], ['Reject', 'REJECTED', true], ['Revoke', 'REVOKED', false]])(
  'authorized reviewer can %s an independently listed handoff', async (label, action, canReview) => {
    const record = { ...state, destinationDepartmentId: 73, handlerId: 8, coordinatorId: 9, version: 1,
      status: canReview ? 'PENDING' : 'APPROVED', reference: 'REVIEW-42', canReview, canRevoke: !canReview }
    apiClient.get.mockImplementation(async url => {
      if (url.endsWith('/handoffs')) return { data: [record] }
      if (url.endsWith('/history')) return { data: [{ version: 0, status: 'PENDING', reason: 'Original request' }] }
      throw { response: { status: 403 } }
    })
    apiClient.put.mockResolvedValue({})
    render(<IncidentDepartmentTransfer incidentId={12} />)
    fireEvent.change(await screen.findByLabelText('Handoff record'), { target: { value: 'REVIEW-42' } })
    await screen.findByLabelText('Handoff audit history')
    fireEvent.change(screen.getByLabelText('Handoff decision reason'), { target: { value: 'Independent review' } })
    fireEvent.click(screen.getByRole('button', { name: label + ' handoff' }))
    expect(apiClient.put).toHaveBeenCalledWith(base + '/transfer/handoffs/REVIEW-42',
      { action, expectedVersion: 1, reason: 'Independent review' })
  })
