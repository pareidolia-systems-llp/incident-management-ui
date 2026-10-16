import test from 'node:test'
import assert from 'node:assert/strict'
import { historyChange, historyActionLabel, historyActorLabel, historyRemarks } from './incidentHistory.js'
test('history wording handles initial values, changes, clearing and creation without invented history', () => {
  assert.equal(historyChange({ actionType: 'PRIORITY_CHANGED', oldValue: '  ', newValue: 'HIGH' }), 'Priority set to HIGH')
  assert.equal(historyChange({ actionType: 'STATUS_CHANGED', newValue: 'ASSIGNED' }), 'Status set to ASSIGNED')
  assert.equal(historyChange({ actionType: 'OWNER_ASSIGNED', newValue: 'it@example.test' }), 'Owner set to it@example.test')
  assert.equal(historyChange({ actionType: 'PRIORITY_CHANGED', oldValue: 'LOW', newValue: 'HIGH' }), 'LOW → HIGH')
  assert.equal(historyChange({ actionType: 'OWNER_ASSIGNED', oldValue: 'old', newValue: '' }), 'Value cleared')
  assert.equal(historyChange({ actionType: 'INCIDENT_CREATED', newValue: 'INC-1' }), 'Incident INC-1 created.')
  assert.equal(historyChange({}), '')
})

test('actors are action-specific with a generic-change fallback', () => {
  const expected = { INCIDENT_CREATED: 'Created by', OWNER_ASSIGNED: 'Assigned by', ATTACHMENT_ADDED: 'Uploaded by', INVESTIGATION_UPDATED: 'Updated by', INCIDENT_RESOLVED: 'Resolved by', RESOLUTION_NOT_ACCEPTED: 'Reported by', INCIDENT_VALIDATED: 'Validated by', INCIDENT_CLOSED: 'Closed by', INCIDENT_REVIEWED: 'Reviewed by', WORK_NOTE: 'Added by', STATUS_CHANGED: 'Changed by', PRIORITY_CHANGED: 'Changed by', SEVERITY_CHANGED: 'Changed by', ISSUE_TYPE_CHANGED: 'Changed by' }
  for (const [action, label] of Object.entries(expected)) assert.equal(historyActorLabel(action), label)
  assert.equal(historyActorLabel('UNKNOWN'), 'Changed by')
})
test('semantic actions use summaries and retain useful text without exposing identifiers', () => {
  assert.equal(historyChange({ actionType: 'ATTACHMENT_ADDED', oldValue: '2', newValue: '3' }), '')
  assert.equal(historyChange({ actionType: 'INCIDENT_CLOSED', newValue: 'CLOSED' }), 'Incident closed.')
  for (const [actionType, label] of Object.entries({ INCIDENT_RESOLVED: 'Resolution', INCIDENT_VALIDATED: 'Validation', INCIDENT_REVIEWED: 'Review', INVESTIGATION_UPDATED: 'Investigation', EVIDENCE_UPDATED: 'Evidence reference' })) {
    assert.equal(historyChange({ actionType, newValue: 'Useful details' }), `${label}: Useful details`)
  }
  assert.equal(historyChange({ actionType: 'INCIDENT_RESOLVED', oldValue: 'Original fix', newValue: 'New fix' }), 'Previous resolution: Original fix\nResolution: New fix')
  assert.equal(historyChange({ actionType: 'UNKNOWN', newValue: '1234' }), '')
})
test('reporter feedback formatting suppresses only the rejection status transition remarks', () => {
  const remarks = 'Reporter feedback: Still broken\nEvidence reference: ticket 42'
  assert.equal(historyActionLabel('RESOLUTION_NOT_ACCEPTED'), 'Issue Still Persists')
  assert.deepEqual(historyRemarks({ actionType: 'RESOLUTION_NOT_ACCEPTED', remarks }), { label: 'Feedback:', text: 'Still broken\nEvidence reference: ticket 42' })
  assert.equal(historyRemarks({ actionType: 'STATUS_CHANGED', oldValue: 'RESOLVED', newValue: 'IN_PROGRESS', remarks }), null)
  assert.deepEqual(historyRemarks({ actionType: 'STATUS_CHANGED', oldValue: 'ASSIGNED', newValue: 'IN_PROGRESS', remarks: 'Started investigation' }), { label: '', text: 'Started investigation' })
  assert.deepEqual(historyRemarks({ actionType: 'WORK_NOTE', remarks: 'Checked logs' }), { label: '', text: 'Checked logs' })
})
