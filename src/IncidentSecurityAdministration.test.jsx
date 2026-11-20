import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import IncidentSecurityAdministration from './pages/IncidentSecurityAdministration'
import * as api from './api/incidentSecurity'

vi.mock('./api/incidentSecurity', () => ({ getTriage: vi.fn(), getIncidentClassification: vi.fn(), setClassification: vi.fn(), getClassificationHistory: vi.fn(), getCaseGrants: vi.fn(), setCaseGrant: vi.fn(), getCaseGrantHistory: vi.fn(), searchCaseEmployees: vi.fn(), getSecurityCapabilities: vi.fn(), searchCapabilityEmployees: vi.fn(), setSecurityCapability: vi.fn(), getSecurityCapabilityHistory: vi.fn() }))
beforeEach(() => { vi.clearAllMocks(); api.getTriage.mockResolvedValue([{ incidentId: 3, incidentNumber: 'INC-3', classification: 'UNCLASSIFIED', version: 0 }]); api.setClassification.mockResolvedValue({ version: 1 }); api.getCaseGrants.mockResolvedValue([{ userId: 7, name: 'User', email: 'user@example.test', permission: 'VIEW', active: true, version: 2 }]); api.setCaseGrant.mockResolvedValue({ version: 3 }); api.getSecurityCapabilities.mockResolvedValue([]) })
afterEach(cleanup)

test('classification sends a reason and current version', async () => {
  render(<IncidentSecurityAdministration />)
  fireEvent.change(await screen.findByLabelText('Unclassified incident'), { target: { value: '3' } })
  fireEvent.change(screen.getByLabelText('Reason', { selector: '#triage-reason' }), { target: { value: ' Reviewed ' } })
  fireEvent.change(screen.getByLabelText('Classification'), { target: { value: 'STANDARD' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save classification' }))
  await waitFor(() => expect(api.setClassification).toHaveBeenCalledWith(3, { classification: 'STANDARD', expectedVersion: 0, reason: 'Reviewed' }))
})

test('case permission changes use the loaded grant version', async () => {
  render(<IncidentSecurityAdministration />)
  fireEvent.change(await screen.findByLabelText('Incident ID'), { target: { value: '3' } })
  fireEvent.click(screen.getByRole('button', { name: 'Load case' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Select' }))
  fireEvent.change(screen.getByLabelText('Reason', { selector: '#grant-reason' }), { target: { value: ' Revoked ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save permission' }))
  await waitFor(() => expect(api.setCaseGrant).toHaveBeenCalledWith('3', '7', 'VIEW', { active: false, expectedVersion: 2, reason: 'Revoked' }))
})

test('capability administration submits a separate versioned grant', async () => {
  api.getSecurityCapabilities.mockResolvedValue([{ userId: 8, name: 'Admin', email: 'admin@example.test', capability: 'CASE_ACCESS_ADMIN', active: true, version: 4 }])
  api.setSecurityCapability.mockResolvedValue({ version: 5 })
  render(<IncidentSecurityAdministration />)
  fireEvent.click(await screen.findByRole('button', { name: 'Select capability' }))
  fireEvent.change(screen.getByLabelText('Reason', { selector: '#capability-reason' }), { target: { value: ' Rotation ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save capability' }))
  await waitFor(() => expect(api.setSecurityCapability).toHaveBeenCalledWith(8, 'CASE_ACCESS_ADMIN', { active: false, expectedVersion: 4, reason: 'Rotation' }))
})

test('a late response for a previous incident cannot populate the new case', async () => {
  let resolveOld
  api.getCaseGrants.mockReturnValue(new Promise(resolve => { resolveOld = resolve }))
  render(<IncidentSecurityAdministration />)
  fireEvent.change(await screen.findByLabelText('Incident ID'), { target: { value: '3' } })
  fireEvent.click(screen.getByRole('button', { name: 'Load case' }))
  fireEvent.change(screen.getByLabelText('Incident ID'), { target: { value: '4' } })
  await act(async () => resolveOld([{ userId: 7, name: 'Old Case User', email: 'old@example.test', permission: 'VIEW', active: true, version: 1 }]))
  expect(screen.queryByText(/Old Case User/)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Save permission' })).toBeNull()
})

test('unavailable guarded endpoints hide the security forms', async () => {
  api.getTriage.mockRejectedValue({ response: { status: 404 } })
  api.getSecurityCapabilities.mockRejectedValue({ response: { status: 404 } })
  render(<IncidentSecurityAdministration />)
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.queryByLabelText('Incident ID')).toBeNull()
  expect(screen.queryByRole('button', { name: /save/i })).toBeNull()
})

test('a capability-only administrator cannot gain classifier controls and global changes require backend approval', async () => {
  api.getTriage.mockRejectedValue({ response: { status: 403 } })
  api.getSecurityCapabilities.mockResolvedValue([{ userId: 8, name: 'Viewer', email: 'viewer@example.test', capability: 'GLOBAL_INCIDENT_VIEW', active: true, version: 4 }])
  api.setSecurityCapability.mockRejectedValue({ response: { status: 403 } })
  render(<IncidentSecurityAdministration />)
  fireEvent.click(await screen.findByRole('button', { name: 'Select capability' }))
  expect(screen.queryByRole('button', { name: 'Save classification' })).toBeNull()
  fireEvent.change(screen.getByLabelText('Reason', { selector: '#capability-reason' }), { target: { value: ' Approved request 12 ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save capability' }))
  expect(await screen.findByText(/Required authorization or approval is unavailable/)).toBeTruthy()
  expect(api.setSecurityCapability).toHaveBeenCalledExactlyOnceWith(8, 'GLOBAL_INCIDENT_VIEW', { active: false, expectedVersion: 4, reason: 'Approved request 12' })
})

test('case grant conflict requires a fresh authorized case read', async () => {
  api.setCaseGrant.mockRejectedValue({ response: { status: 409 } })
  render(<IncidentSecurityAdministration />)
  fireEvent.change(await screen.findByLabelText('Incident ID'), { target: { value: '3' } })
  fireEvent.click(screen.getByRole('button', { name: 'Load case' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Select' }))
  fireEvent.change(screen.getByLabelText('Reason', { selector: '#grant-reason' }), { target: { value: 'Review' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save permission' }))
  expect(await screen.findByText(/Case permission changed/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Save permission' })).toBeNull()
  expect(api.setCaseGrant).toHaveBeenCalledOnce()
})
