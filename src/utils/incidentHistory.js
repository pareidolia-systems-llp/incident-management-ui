const present = (value) => value != null && String(value).trim() !== ''
const fields = { OWNER_ASSIGNED: 'Owner', STATUS_CHANGED: 'Status', ISSUE_TYPE_CHANGED: 'Issue type', SEVERITY_CHANGED: 'Severity', PRIORITY_CHANGED: 'Priority' }
const detailLabels = { INCIDENT_RESOLVED: 'Resolution', INCIDENT_VALIDATED: 'Validation', INCIDENT_REVIEWED: 'Review', INVESTIGATION_UPDATED: 'Investigation', EVIDENCE_UPDATED: 'Evidence reference', ESCALATED: 'Escalation' }
const actors = {
  INCIDENT_CREATED: 'Created by', OWNER_ASSIGNED: 'Assigned by', ATTACHMENT_ADDED: 'Uploaded by',
  INVESTIGATION_UPDATED: 'Updated by', EVIDENCE_UPDATED: 'Updated by', INCIDENT_RESOLVED: 'Resolved by',
  RESOLUTION_NOT_ACCEPTED: 'Reported by', INCIDENT_VALIDATED: 'Validated by', INCIDENT_CLOSED: 'Closed by',
  INCIDENT_REVIEWED: 'Reviewed by', WORK_NOTE: 'Added by', ESCALATED: 'Escalated by',
}
export function historyActorLabel(actionType) { return actors[actionType] || 'Changed by' }
export function isFieldTransition(actionType) { return Object.hasOwn(fields, actionType) }

export function historyChange(entry) {
  const oldValue = present(entry.oldValue), newValue = present(entry.newValue)
  if (isFieldTransition(entry.actionType)) {
    const display = (value) => ['STATUS_CHANGED', 'ISSUE_TYPE_CHANGED'].includes(entry.actionType) ? String(value).replaceAll('_', ' ') : String(value)
    if (oldValue && newValue) return `${display(entry.oldValue)} → ${display(entry.newValue)}`
    if (newValue) return `${fields[entry.actionType]} set to ${display(entry.newValue)}`
    if (oldValue) return 'Value cleared'
    return ''
  }
  // Attachment newValue is a database ID. Its human-readable filename is in remarks.
  if (entry.actionType === 'ATTACHMENT_ADDED' || entry.actionType === 'WORK_NOTE') return ''
  if (entry.actionType === 'RESOLUTION_NOT_ACCEPTED') return 'The reporter indicated that the previous resolution did not solve the problem.'
  if (entry.actionType === 'INCIDENT_CREATED') return newValue ? `Incident ${entry.newValue} created.` : 'Incident created.'
  if (entry.actionType === 'INCIDENT_CLOSED') return 'Incident closed.'
  const label = detailLabels[entry.actionType]
  if (!label) return '' // Unknown semantic events must not leak internal values.
  const details = []
  if (oldValue && entry.oldValue !== entry.newValue) details.push(`Previous ${label.toLowerCase()}: ${entry.oldValue}`)
  if (newValue) details.push(`${label}: ${entry.newValue}`)
  else if (oldValue) details.push(`${label} cleared.`)
  return details.join('\n')
}

export function historyRemarks(entry) {
  // The existing rejection flow copies feedback to its status event. Preserve
  // that event and its transition, but present feedback only on the rejection.
  if (entry.actionType === 'STATUS_CHANGED' && entry.oldValue === 'RESOLVED' && entry.newValue === 'IN_PROGRESS') return null
  if (!present(entry.remarks)) return null
  if (entry.actionType === 'RESOLUTION_NOT_ACCEPTED') {
    return { label: 'Feedback:', text: String(entry.remarks).replace(/^Reporter feedback:\s*/i, '') }
  }
  return { label: ['SEVERITY_CHANGED', 'PRIORITY_CHANGED'].includes(entry.actionType) ? 'Reason:' : '', text: entry.remarks }
}

export function historyActionLabel(value) {
  if (value === 'WORK_NOTE') return 'Work note added'
  if (value === 'RESOLUTION_NOT_ACCEPTED') return 'Issue Still Persists'
  return value ? String(value).toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') : 'Activity recorded'
}

export const activityFilters = ['All', 'Updates', 'Work Notes', 'Lifecycle']
const updateActions = new Set(['OWNER_ASSIGNED', 'INVESTIGATION_UPDATED', 'EVIDENCE_UPDATED', 'ATTACHMENT_ADDED', 'ISSUE_TYPE_CHANGED', 'SEVERITY_CHANGED', 'PRIORITY_CHANGED', 'ESCALATED'])
const lifecycleActions = new Set(['INCIDENT_CREATED', 'INCIDENT_RESOLVED', 'RESOLUTION_NOT_ACCEPTED', 'INCIDENT_VALIDATED', 'INCIDENT_CLOSED', 'INCIDENT_REVIEWED', 'STATUS_CHANGED'])
export function filterActivity(history, filter) {
  if (filter === 'Updates') return history.filter((entry) => updateActions.has(entry.actionType))
  if (filter === 'Work Notes') return history.filter((entry) => entry.actionType === 'WORK_NOTE')
  if (filter === 'Lifecycle') return history.filter((entry) => lifecycleActions.has(entry.actionType))
  return history
}
