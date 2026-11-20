import { expect, test } from 'vitest'
import apiClient from './api/client'
import { clearCsrfToken, setCsrfToken } from './api/csrf'
import { saveAssignment, transferIncident } from './api/assignment'
import { setCaseGrant, setClassification, setSecurityCapability } from './api/incidentSecurity'

test('guarded writes use authenticated CSRF requests and the B4 endpoint contracts', async () => {
  const originalAdapter = apiClient.defaults.adapter
  const requests = []
  apiClient.defaults.adapter = async config => {
    requests.push([config.method, config.url, config.withCredentials, config.headers.get('X-XSRF-TOKEN'), JSON.parse(config.data)])
    return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
  }
  setCsrfToken({ headerName: 'X-XSRF-TOKEN', token: 'synthetic-csrf' })
  const assignment = { handlerUserId: 8, expectedVersion: 1, expectedClassificationVersion: 2, reason: 'Coverage' }
  const transfer = { expectedSourceDepartmentId: 71, destinationDepartmentId: 73, destinationHandlerUserId: 8,
    expectedVersion: 1, expectedClassificationVersion: 2, reason: 'Coverage', handoffApprovalReference: 'REVIEW-42' }
  const classification = { classification: 'RESTRICTED', expectedVersion: 2, reason: 'Approved triage' }
  const grant = { active: true, expectedVersion: 0, reason: 'Approval reference' }
  try {
    await saveAssignment(12, assignment)
    await transferIncident(12, transfer)
    await setClassification(12, classification)
    await setCaseGrant(12, 8, 'HANDLE', grant)
    await setSecurityCapability(8, 'GLOBAL_INCIDENT_VIEW', grant)
    expect(requests).toEqual([
      ['post', '/api/incident-assignment/12', true, 'synthetic-csrf', assignment],
      ['post', '/api/incident-assignment/12/transfer', true, 'synthetic-csrf', transfer],
      ['put', '/api/admin/incident-security/12/classification', true, 'synthetic-csrf', classification],
      ['put', '/api/admin/incident-security/12/grants/8/HANDLE', true, 'synthetic-csrf', grant],
      ['put', '/api/admin/incident-security/capabilities/8/GLOBAL_INCIDENT_VIEW', true, 'synthetic-csrf', grant],
    ])
  } finally {
    apiClient.defaults.adapter = originalAdapter
    clearCsrfToken()
  }
})
