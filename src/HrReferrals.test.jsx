import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import apiClient from './api/client'

vi.mock('./api/client', () => ({
  backendBaseUrl: 'http://backend.test',
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}))
vi.mock('./pages/Dashboard', () => ({ default: () => <h1>Dashboard</h1> }))

const base = '/api/incident-assignment/hr-referrals'
const assignment = '/api/incident-assignment'
const id = '123e4567-e89b-12d3-a456-426614174000'
const reference = 'INC-20261110-090000-ABCD1234'
const review = { referralId: id, incidentId: 12, assignmentVersion: 2, classificationVersion: 3, outcome: null }
const handler = { id: 8, name: 'Eligible Employee', email: 'eligible@example.test' }
const state = { incidentId: 12, sourceDepartmentId: 71, assignmentVersion: 2, classificationVersion: 3 }
let role, pending, response

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('VITE_INCIDENT_ASSIGNMENT_ENABLED', 'true')
  vi.stubEnv('VITE_HR_REFERRALS_ENABLED', 'true')
  role = 'ADMIN'
  pending = [id]
  response = review
  window.history.replaceState({}, '', '/')
  apiClient.get.mockImplementation(async url => {
    if (url === '/api/auth/me') return { data: { role, email: 'operator@example.test', displayName: 'Operator' } }
    if (url === '/api/auth/csrf') return { data: { headerName: 'X-XSRF-TOKEN', token: 'test-token' } }
    if (url === assignment + '/triage' && role !== 'REPORTER') return { data: [] }
    if (url === base && pending) return { data: pending }
    if (url === base + '/' + id && response) return { data: response }
    if (url === base + '/' + id) throw { response: { status: 404, data: { message: 'private message' } } }
    if (url === assignment + '/handlers') return { data: [handler] }
    if (url === assignment + '/12/transfer/options') return { data: { state, destinations: [{ departmentId: 73, displayName: 'Operations' }] } }
    if (url === assignment + '/12/transfer/handlers') return { data: { state, destinationDepartmentId: 73, handlers: [handler] } }
    if (url === assignment + '/12/transfer/handoffs') return { data: [{ ...state, destinationDepartmentId: 73, handlerId: 8, status: 'APPROVED', canUse: true, reference: 'HANDOFF-1' }] }
    throw { response: { status: 403, data: { message: 'private message' } } }
  })
  apiClient.put.mockResolvedValue({ status: 204 })
})
afterEach(() => { cleanup(); vi.unstubAllEnvs() })

async function openReview() {
  window.history.replaceState({}, '', '/hr-referrals')
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Review ' + id }))
  await screen.findByRole('heading', { name: 'Referral review' })
}

test('IT intake uses exact-reference POST, clears the input, and acknowledges 202 without disclosing response content', async () => {
  role = 'IT_HANDLER'
  pending = null
  apiClient.post.mockResolvedValue({ status: 202, data: { description: 'private message' } })
  render(<App />)
  fireEvent.click(await screen.findByRole('link', { name: 'Submit reassignment referral' }))
  expect(screen.queryByRole('link', { name: 'HR pending referrals' })).toBeNull()
  const input = await screen.findByLabelText('Incident reference')
  fireEvent.change(input, { target: { value: reference } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit referral' }))
  expect(await screen.findByText('Submission accepted for processing. An authorized HR reviewer may need to act.')).toBeTruthy()
  expect(apiClient.post).toHaveBeenCalledExactlyOnceWith(base, { incidentReference: reference })
  expect(input.value).toBe('')
  expect(screen.queryByText('private message')).toBeNull()
  expect(apiClient.get.mock.calls.some(([url]) => url.includes(reference) || url.startsWith(base + '/'))).toBe(false)
})

test('an intake 403 shows permission guidance without exposing backend text', async () => {
  pending = null
  apiClient.post.mockRejectedValue({ response: { status: 403, data: { message: reference } } })
  window.history.replaceState({}, '', '/reassignment-referral')
  render(<App />)
  fireEvent.change(await screen.findByLabelText('Incident reference'), { target: { value: reference } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit referral' }))
  expect((await screen.findByRole('alert')).textContent).toContain('do not have referral submission permission')
  expect(screen.queryByText(reference)).toBeNull()
})

test('a denied pending endpoint hides HR navigation and exposes no controls on a direct visit', async () => {
  role = 'REPORTER'
  pending = null
  window.history.replaceState({}, '', '/hr-referrals')
  render(<App />)
  expect((await screen.findByRole('alert')).textContent).toContain('do not have access')
  expect(screen.queryByRole('link', { name: 'HR pending referrals' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'Submit reassignment referral' })).toBeNull()
  expect(screen.queryByLabelText('Decision')).toBeNull()
})

test('the referral flag off keeps routes, links and backend requests disabled', async () => {
  vi.stubEnv('VITE_HR_REFERRALS_ENABLED', 'false')
  render(<App />)
  await screen.findByRole('link', { name: 'Incident triage' })
  expect(screen.queryByRole('link', { name: 'HR pending referrals' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'Submit reassignment referral' })).toBeNull()
  expect(apiClient.get.mock.calls.some(([url]) => url.startsWith(base))).toBe(false)
})

test('authorized reviewers can navigate to the queue and reject using the backend decision contract', async () => {
  render(<App />)
  fireEvent.click(await screen.findByRole('link', { name: 'HR pending referrals' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Review ' + id }))
  expect((await screen.findByRole('link', { name: 'Open the incident for review' })).getAttribute('href')).toBe('/incidents/12')
  fireEvent.change(screen.getByLabelText('Decision'), { target: { value: 'REJECTED' } })
  fireEvent.change(screen.getByLabelText('Decision reason'), { target: { value: ' Keep current assignment ' } })
  fireEvent.click(screen.getByLabelText('Confirm this decision'))
  pending = []
  fireEvent.click(screen.getByRole('button', { name: 'Reject referral' }))
  expect(await screen.findByText('Referral decision recorded.')).toBeTruthy()
  expect(apiClient.put).toHaveBeenCalledExactlyOnceWith(base + '/' + id + '/decision', { outcome: 'REJECTED', reason: 'Keep current assignment' })
})

test('a stale reassignment uses server versions and clears the review after conflict', async () => {
  apiClient.put.mockRejectedValue({ response: { status: 409, data: { message: 'private message' } } })
  await openReview()
  fireEvent.change(screen.getByLabelText('Decision'), { target: { value: 'REASSIGNED' } })
  fireEvent.change(screen.getByLabelText(/Search eligible handlers/), { target: { value: 'Eligible' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search handlers' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Eligible Employee — eligible@example.test' }))
  fireEvent.change(screen.getByLabelText('Decision reason'), { target: { value: 'Coverage' } })
  fireEvent.click(screen.getByLabelText('Confirm this decision'))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm reassignment' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Open the current referral')
  expect(apiClient.put).toHaveBeenCalledExactlyOnceWith(base + '/' + id + '/decision', {
    outcome: 'REASSIGNED', reason: 'Coverage',
    reassignment: { handlerUserId: 8, expectedVersion: 2, expectedClassificationVersion: 3 },
  })
  expect(screen.queryByLabelText('Decision')).toBeNull()
  expect(screen.queryByText('private message')).toBeNull()
})

test('referral transfer uses the server-approved handoff and the referral decision endpoint', async () => {
  await openReview()
  fireEvent.change(screen.getByLabelText('Decision'), { target: { value: 'TRANSFERRED' } })
  fireEvent.change(await screen.findByLabelText('Destination department'), { target: { value: '73' } })
  fireEvent.change(screen.getByLabelText('Search destination handlers'), { target: { value: 'Eligible' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search destination' }))
  fireEvent.change(await screen.findByLabelText('Destination handler'), { target: { value: '8' } })
  fireEvent.change(screen.getByLabelText('Transfer reason'), { target: { value: 'Coverage' } })
  expect(screen.getByRole('button', { name: 'Review transfer' }).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Handoff approval reference'), { target: { value: 'HANDOFF-1' } })
  fireEvent.click(screen.getByRole('button', { name: 'Review transfer' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm transfer' }))
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledExactlyOnceWith(base + '/' + id + '/decision', {
    outcome: 'TRANSFERRED', reason: 'Coverage', transfer: {
      expectedSourceDepartmentId: 71, destinationDepartmentId: 73, destinationHandlerUserId: 8,
      expectedVersion: 2, expectedClassificationVersion: 3, reason: 'Coverage', handoffApprovalReference: 'HANDOFF-1',
    },
  }))
  expect(await screen.findByText('Referral decision recorded.')).toBeTruthy()
  expect(apiClient.post).not.toHaveBeenCalled()
})

test('an already decided referral displays the outcome without decision controls', async () => {
  response = { ...review, outcome: 'REASSIGNED', reporter: 'private message' }
  await openReview()
  expect(screen.getByText('Decision recorded: Reassigned.')).toBeTruthy()
  expect(screen.queryByLabelText('Decision')).toBeNull()
  expect(screen.queryByText('private message')).toBeNull()
})

test('a version mismatch in transfer discovery prevents transfer actions', async () => {
  response = { ...review, assignmentVersion: 1 }
  await openReview()
  fireEvent.change(screen.getByLabelText('Decision'), { target: { value: 'TRANSFERRED' } })
  expect((await screen.findByRole('alert')).textContent).toContain('The incident changed.')
  expect(screen.queryByLabelText('Destination department')).toBeNull()
  expect(apiClient.put).not.toHaveBeenCalled()
})

test('expired or inaccessible referrals clear the review and keep the error generic', async () => {
  response = null
  window.history.replaceState({}, '', '/hr-referrals')
  render(<App />)
  fireEvent.click(await screen.findByRole('button', { name: 'Review ' + id }))
  expect((await screen.findByRole('alert')).textContent).toContain('This referral is unavailable.')
  expect(screen.queryByLabelText('Decision')).toBeNull()
  expect(screen.queryByText('private message')).toBeNull()
})
