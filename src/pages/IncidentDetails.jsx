import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { assignIncident, changeIncidentPriority, changeIncidentSeverity, closeIncident, escalateIncident, getIncident, getIncidentHistory, reclassifyIncident, resolveIncident, reviewIncident, updateEvidenceReference, updateInvestigation, validateIncident } from '../api/incidents'
import useAuth from '../auth/useAuth'
import ApiState from '../components/ApiState'
import { SeverityBadge, StatusBadge } from '../components/IncidentBadges'
import PageTitle from '../components/PageTitle'
import { formatDate, getErrorMessage, labelize } from '../utils/incident'

const sections = [
  { title: 'Incident Information', fields: [['Incident Number', 'incidentNumber'], ['Title', 'title'], ['Description', 'description'], ['Reported At', 'reportedAt', 'date'], ['Reported By', 'reportedBy'], ['Reporter Department', 'reporterDepartment'], ['Affected System', 'affectedSystem'], ['Impacted User / Department', 'impactedUserOrDepartment']] },
  { title: 'Classification & Priority', fields: [['Issue Type', 'issueType', 'label'], ['Category', 'category', 'label'], ['Severity', 'severity', 'severity'], ['Priority', 'priority', 'label'], ['Status', 'status', 'status']] },
  { title: 'Assignment', fields: [['Assigned Owner', 'assignedOwner']] },
  { title: 'Investigation', fields: [['Investigation Details', 'investigationDetails'], ['Root Cause', 'rootCause'], ['Actions Taken', 'actionsTaken']] },
  { title: 'Containment & Corrective Action', fields: [['Containment Action', 'containmentAction'], ['Corrective Action', 'correctiveAction'], ['Evidence Reference', 'evidenceReference'], ['Escalation Required', 'escalationRequired', 'boolean'], ['Escalation Details', 'escalationDetails']] },
  { title: 'Resolution', fields: [['Resolution Details', 'resolutionDetails'], ['Resolved At', 'resolvedAt', 'date']] },
  { title: 'Validation & Closure', fields: [['Validation Details', 'validationDetails'], ['Validated By', 'validatedBy'], ['Validated At', 'validatedAt', 'date'], ['Closure Confirmed By', 'closureConfirmedBy'], ['Closed At', 'closedAt', 'date']] },
  { title: 'Review', fields: [['Review Details', 'reviewDetails'], ['Reviewed By', 'reviewedBy'], ['Reviewed At', 'reviewedAt', 'date'], ['Lessons Learned', 'lessonsLearned'], ['Preventive Action', 'preventiveAction']] },
  { title: 'System Information', fields: [['Created At', 'createdAt', 'date'], ['Updated At', 'updatedAt', 'date']] },
]

const issueTypeOptions = ['IT_ISSUE', 'SERVICE_REQUEST', 'SUSPECTED_SECURITY_INCIDENT', 'INFORMATION_SECURITY_INCIDENT', 'MAJOR_CRITICAL_SECURITY_INCIDENT']
const levelOptions = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

const actionDefinitions = {
  assign: { label: 'Assign Incident', submitLabel: 'Assign Incident', submit: assignIncident, fields: [field('assignedOwner', 'Assigned Owner', true), field('remarks', 'Remarks', false, 'textarea')] },
  investigation: { label: 'Update Investigation', submitLabel: 'Save Investigation', submit: updateInvestigation, prefill: ['investigationDetails', 'rootCause', 'actionsTaken', 'containmentAction', 'correctiveAction'], fields: [field('investigationDetails', 'Investigation Details', false, 'textarea'), field('rootCause', 'Root Cause', false, 'textarea'), field('actionsTaken', 'Actions Taken', false, 'textarea'), field('containmentAction', 'Containment Action', false, 'textarea'), field('correctiveAction', 'Corrective Action', false, 'textarea'), field('remarks', 'Remarks', false, 'textarea')] },
  resolve: { label: 'Resolve Incident', submitLabel: 'Resolve Incident', submit: resolveIncident, fields: [field('resolutionDetails', 'Resolution Details', true, 'textarea'), field('remarks', 'Remarks', false, 'textarea')] },
  validate: { label: 'Validate Incident', submitLabel: 'Validate Incident', submit: validateIncident, fields: [field('validationDetails', 'Validation Details', true, 'textarea'), field('remarks', 'Remarks', false, 'textarea')] },
  close: { label: 'Close Incident', submitLabel: 'Close Incident', submit: closeIncident, fields: [field('remarks', 'Remarks', false, 'textarea')] },
  review: { label: 'Review Incident', submitLabel: 'Save Review', submit: reviewIncident, fields: [field('reviewDetails', 'Review Details', true, 'textarea'), field('lessonsLearned', 'Lessons Learned', false, 'textarea'), field('preventiveAction', 'Preventive Action', false, 'textarea'), field('remarks', 'Remarks', false, 'textarea')] },
  reclassify: { label: 'Reclassify Incident', submitLabel: 'Update Classification', submit: reclassifyIncident, prefill: ['issueType'], fields: [field('issueType', 'Issue Type', true, 'select', issueTypeOptions), field('remarks', 'Remarks', false, 'textarea')] },
  severity: { label: 'Change Severity', submitLabel: 'Update Severity', submit: changeIncidentSeverity, prefill: ['severity'], fields: [field('severity', 'Severity', true, 'select', levelOptions), field('remarks', 'Remarks', false, 'textarea')] },
  priority: { label: 'Change Priority', submitLabel: 'Update Priority', submit: changeIncidentPriority, prefill: ['priority'], fields: [field('priority', 'Priority', true, 'select', levelOptions), field('remarks', 'Remarks', false, 'textarea')] },
  escalate: { label: 'Escalate Incident', submitLabel: 'Escalate Incident', submit: escalateIncident, fields: [field('escalationDetails', 'Escalation Details', true, 'textarea'), field('remarks', 'Remarks', false, 'textarea')] },
  evidence: { label: 'Update Evidence Reference', submitLabel: 'Update Evidence', submit: updateEvidenceReference, fields: [field('evidenceReference', 'Evidence Reference', true, 'textarea'), field('remarks', 'Remarks', false, 'textarea')] },
}

const actionsByStatus = { OPEN: ['assign'], ASSIGNED: ['investigation', 'resolve'], IN_PROGRESS: ['investigation', 'resolve'], RESOLVED: ['validate'], VALIDATED: ['close'], CLOSED: ['review'] }
const operationalActionKeys = ['reclassify', 'severity', 'priority', 'escalate', 'evidence']

function field(name, label, required = false, type = 'text', options = []) { return { name, label, required, type, options } }

function IncidentDetails() {
  const { id } = useParams()
  const { user } = useAuth()
  const [incident, setIncident] = useState(null)
  const [history, setHistory] = useState([])
  const [state, setState] = useState('loading')
  const [error, setError] = useState('')
  const [historyState, setHistoryState] = useState('loading')
  const [historyError, setHistoryError] = useState('')
  const [accessDenied, setAccessDenied] = useState(false)
  const [activeAction, setActiveAction] = useState(null)
  const [actionValues, setActionValues] = useState({})
  const [actionErrors, setActionErrors] = useState({})
  const [actionError, setActionError] = useState('')
  const [savingAction, setSavingAction] = useState(false)

  const loadIncident = useCallback(async () => {
    setState('loading')
    setHistoryState('loading')
    setAccessDenied(false)
    const [incidentResult, historyResult] = await Promise.allSettled([getIncident(id), getIncidentHistory(id)])
    if (incidentResult.status === 'fulfilled') { setIncident(incidentResult.value); setState('ready') } else { setAccessDenied(incidentResult.reason.response?.status === 403); setError(getErrorMessage(incidentResult.reason)); setState('error') }
    if (historyResult.status === 'fulfilled') { setHistory(historyResult.value); setHistoryState('ready') } else { setHistoryError(getErrorMessage(historyResult.reason, 'We could not load the audit history. Please try again.')); setHistoryState('error') }
  }, [id])

  useEffect(() => { void Promise.resolve().then(loadIncident) }, [loadIncident])

  function openAction(actionKey) {
    const action = actionDefinitions[actionKey]
    setActionValues(initialActionValues(action, incident))
    setActionErrors({})
    setActionError('')
    setActiveAction(actionKey)
  }

  function closeAction() {
    if (!savingAction) { setActiveAction(null); setActionValues({}); setActionErrors({}); setActionError('') }
  }

  function updateActionValue(event) {
    const { name, value } = event.target
    setActionValues((current) => ({ ...current, [name]: value }))
    setActionErrors((current) => ({ ...current, [name]: undefined }))
    setActionError('')
  }

  async function submitAction(event) {
    event.preventDefault()
    if (savingAction || !activeAction) return
    const action = actionDefinitions[activeAction]
    const validationErrors = validateAction(action, actionValues)
    if (Object.keys(validationErrors).length > 0) { setActionErrors(validationErrors); setActionError('Please correct the highlighted fields before saving.'); return }
    setSavingAction(true)
    setActionError('')
    setActionErrors({})
    try {
      await action.submit(id, createPayload(action, actionValues))
      setActiveAction(null)
      setActionValues({})
      await loadIncident()
    } catch (requestError) {
      setActionErrors(getActionFieldErrors(requestError, action))
      setActionError(getActionErrorMessage(requestError))
    } finally {
      setSavingAction(false)
    }
  }

  if (state === 'loading') return <><PageTitle title="Incident Details" /><ApiState type="loading" /></>
  if (state === 'error') return <><PageTitle title={accessDenied ? 'Access denied' : 'Incident Details'} /><ApiState type="error" message={error} onRetry={loadIncident} /></>

  const reviewCompleted = incident.status === 'CLOSED' && hasRecordedValue(incident.reviewedAt)
  const canPerformOperationalActions = ['IT_HANDLER', 'ADMIN'].includes(user.role)
  const canPerformReviewActions = ['REVIEWER', 'ADMIN'].includes(user.role)
  const availableActions = (actionsByStatus[incident.status] || []).filter((actionKey) => (actionKey === 'review' ? canPerformReviewActions && !reviewCompleted : ['validate', 'close'].includes(actionKey) ? canPerformReviewActions : canPerformOperationalActions))
  const availableOperationalActions = incident.status === 'CLOSED' || !canPerformOperationalActions ? [] : operationalActionKeys
  return (
    <>
      <PageTitle title={incident.incidentNumber || 'Incident Details'} description={incident.title} actions={<Link className="btn btn-outline-secondary" to="/incidents">Back to Incidents</Link>} />
      <div className="d-flex flex-wrap gap-2 mb-3"><StatusBadge status={incident.status} /><SeverityBadge severity={incident.severity} /></div>
      <ActionsPanel actionKeys={availableActions} operationalActionKeys={availableOperationalActions} reviewCompleted={reviewCompleted && canPerformReviewActions} onOpen={openAction} />
      <div className="row g-3 mb-4">{sections.map((section) => <DetailSection key={section.title} section={section} incident={incident} />)}</div>
      <AuditTrail history={history} state={historyState} error={historyError} onRetry={loadIncident} />
      {activeAction && <ActionModal action={actionDefinitions[activeAction]} user={user} values={actionValues} errors={actionErrors} error={actionError} saving={savingAction} onChange={updateActionValue} onClose={closeAction} onSubmit={submitAction} />}
    </>
  )
}

function ActionsPanel({ actionKeys, operationalActionKeys: activeOperationalActions, reviewCompleted, onOpen }) {
  return <section className="card section-card action-panel mb-4"><div className="card-body d-sm-flex align-items-center justify-content-between gap-3"><div><h2 className="h6 text-dark mb-1">Actions</h2><p className="text-secondary small mb-0">Available actions for the current incident status.</p></div><div className="d-flex flex-wrap align-items-center gap-2 mt-3 mt-sm-0">{actionKeys.map((key) => <button key={key} className="btn btn-primary btn-sm" onClick={() => onOpen(key)}>{actionDefinitions[key].label}</button>)}{reviewCompleted && <span className="text-secondary small">Review completed</span>}{activeOperationalActions.length > 0 && <details className="more-actions"><summary className="btn btn-outline-secondary btn-sm">More Actions</summary><div className="more-actions-menu border rounded bg-white shadow-sm p-2 mt-2">{activeOperationalActions.map((key) => <button key={key} className="btn btn-sm btn-light text-start w-100" onClick={() => onOpen(key)}>{actionDefinitions[key].label}</button>)}</div></details>}{!actionKeys.length && !reviewCompleted && !activeOperationalActions.length && <span className="text-secondary small">No lifecycle actions are available.</span>}</div></div></section>
}

function ActionModal({ action, user, values, errors, error, saving, onChange, onClose, onSubmit }) {
  return <><div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="action-modal-title"><div className="modal-dialog modal-lg modal-dialog-scrollable"><form className="modal-content" noValidate onSubmit={onSubmit}><div className="modal-header"><h2 className="modal-title fs-5" id="action-modal-title">{action.label}</h2><button type="button" className="btn-close" aria-label="Close" onClick={onClose} disabled={saving} /></div><div className="modal-body">{error && <div className="alert alert-danger" role="alert">{error}</div>}<p className="small text-secondary">Action will be recorded as {user.email}.</p><div className="row g-3">{action.fields.map((item) => <ActionField key={item.name} field={item} value={values[item.name] || ''} error={errors[item.name]} onChange={onChange} />)}</div></div><div className="modal-footer"><button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}{saving ? 'Saving…' : action.submitLabel}</button></div></form></div></div><div className="modal-backdrop show" /></>
}

function ActionField({ field: item, value, error, onChange }) {
  if (item.type === 'select') return <div className="col-12 col-md-6"><label className="form-label fw-semibold" htmlFor={`action-${item.name}`}>{item.label}{item.required && <span className="text-danger"> *</span>}</label><select id={`action-${item.name}`} name={item.name} value={value} onChange={onChange} className={`form-select${error ? ' is-invalid' : ''}`} aria-describedby={error ? `action-${item.name}-error` : undefined}>{item.options.map((option) => <option key={option} value={option}>{formatOptionLabel(option)}</option>)}</select>{error && <div id={`action-${item.name}-error`} className="invalid-feedback">{error}</div>}</div>
  const Component = item.type === 'textarea' ? 'textarea' : 'input'
  return <div className={item.type === 'textarea' ? 'col-12' : 'col-12 col-md-6'}><label className="form-label fw-semibold" htmlFor={`action-${item.name}`}>{item.label}{item.required && <span className="text-danger"> *</span>}</label><Component id={`action-${item.name}`} name={item.name} value={value} onChange={onChange} className={`form-control${error ? ' is-invalid' : ''}`} rows={item.type === 'textarea' ? 4 : undefined} aria-describedby={error ? `action-${item.name}-error` : undefined} />{error && <div id={`action-${item.name}-error`} className="invalid-feedback">{error}</div>}</div>
}

function DetailSection({ section, incident }) { return <section className="col-12 col-xl-6"><div className="card section-card h-100"><div className="card-body"><h2 className="h6 text-dark border-bottom pb-2 mb-3">{section.title}</h2><dl className="row mb-0">{section.fields.map(([label, fieldName, format]) => <DetailField key={fieldName} label={label} value={incident[fieldName]} format={format} />)}</dl></div></div></section> }
function DetailField({ label, value, format }) { const displayValue = format === 'date' ? formatDate(value) : format === 'label' ? labelize(value) : format === 'boolean' ? formatBoolean(value) : value || 'Not recorded'; return <><dt className="col-sm-5 detail-label mb-1 mb-sm-3">{label}</dt><dd className="col-sm-7 detail-value mb-3">{format === 'status' ? <StatusBadge status={value} /> : format === 'severity' ? <SeverityBadge severity={value} /> : displayValue}</dd></> }

function AuditTrail({ history, state, error, onRetry }) {
  const chronologicalHistory = useMemo(() => [...history].sort((first, second) => toTimestamp(first.changedAt) - toTimestamp(second.changedAt)), [history])
  return <section className="card section-card"><div className="card-body"><h2 className="h5 text-dark mb-1">Audit Trail</h2><p className="text-secondary small mb-4">Chronological record of incident changes.</p>{state === 'loading' && <ApiState type="loading" />}{state === 'error' && <ApiState type="error" message={error} onRetry={onRetry} />}{state === 'ready' && (chronologicalHistory.length === 0 ? <div className="text-secondary py-3">No audit history has been recorded.</div> : <ol className="audit-timeline list-unstyled mb-0">{chronologicalHistory.map((entry) => <AuditEntry key={entry.id} entry={entry} />)}</ol>)}</div></section>
}

function AuditEntry({ entry }) { const hasValueChange = hasValue(entry.oldValue) || hasValue(entry.newValue); return <li className="audit-timeline-item"><div className="d-sm-flex justify-content-between gap-3"><div className="fw-semibold text-dark">{actionLabel(entry.actionType)}</div><time className="text-secondary small text-nowrap">{formatDate(entry.changedAt)}</time></div><div className="text-secondary small mt-1">Changed by {entry.changedBy || 'Not recorded'}</div>{hasValueChange && <div className="audit-value-change mt-2"><span>{displayHistoryValue(entry.oldValue)}</span><span className="mx-2 text-secondary">→</span><span>{displayHistoryValue(entry.newValue)}</span></div>}{entry.remarks && <div className="mt-2 small"><span className="fw-semibold">Remarks:</span> {entry.remarks}</div>}</li> }

function initialActionValues(action, incident) { return action.fields.reduce((values, item) => ({ ...values, [item.name]: action.prefill?.includes(item.name) ? incident[item.name] || '' : '' }), {}) }
function createPayload(action, values) { return action.fields.reduce((payload, item) => ({ ...payload, [item.name]: values[item.name]?.trim() || '' }), {}) }
function validateAction(action, values) { return action.fields.reduce((errors, item) => { if (item.required && !values[item.name]?.trim()) errors[item.name] = 'This field is required.'; return errors }, {}) }
function getActionFieldErrors(error, action) { const allowedFields = new Set(action.fields.map((item) => item.name)); const payload = error.response?.data; const candidates = [payload?.fieldErrors, payload?.errors, payload]; for (const candidate of candidates) { if (Array.isArray(candidate)) { const errors = candidate.reduce((result, item) => { const message = item?.message || item?.defaultMessage; if (allowedFields.has(item?.field) && typeof message === 'string') result[item.field] = message; return result }, {}); if (Object.keys(errors).length) return errors } if (candidate && typeof candidate === 'object') { const errors = Object.entries(candidate).reduce((result, [name, message]) => { if (allowedFields.has(name) && typeof message === 'string') result[name] = message; return result }, {}); if (Object.keys(errors).length) return errors } } return {} }
function getActionErrorMessage(error) { if (error.response?.status === 409) { const payload = error.response.data; const message = typeof payload === 'string' ? payload : payload?.message || payload?.error; if (typeof message === 'string' && !message.includes('\n')) return message; return 'This action is no longer available because the incident lifecycle state has changed.' } return getErrorMessage(error, 'The action could not be saved. Please review the form and try again.') }
function formatBoolean(value) { return value === true ? 'Yes' : value === false ? 'No' : 'Not recorded' }
function hasValue(value) { return value !== null && value !== undefined && value !== '' }
function hasRecordedValue(value) { return value !== null && value !== undefined && String(value).trim() !== '' }
function formatOptionLabel(value) { if (value === 'MAJOR_CRITICAL_SECURITY_INCIDENT') return 'Major / Critical Security Incident'; return labelize(value).toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function displayHistoryValue(value) { return hasValue(value) ? labelize(value) : 'Not recorded' }
function actionLabel(value) { return value ? String(value).toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') : 'Activity recorded' }
function toTimestamp(value) { const timestamp = new Date(value).getTime(); return Number.isNaN(timestamp) ? 0 : timestamp }

export default IncidentDetails
