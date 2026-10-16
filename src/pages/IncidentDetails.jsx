import { useCallback, useRef, useState } from 'react'
import usePolling from '../hooks/usePolling'
import { historyChange, historyActionLabel, historyActorLabel, historyRemarks, isFieldTransition, activityFilters, filterActivity } from '../utils/incidentHistory'
import IncidentAttachments from '../components/IncidentAttachments'
import IncidentStatusTracker from '../components/IncidentStatusTracker'
import { reporterWaitingMessage } from '../utils/incidentLifecycle'
import ImagePicker from '../components/ImagePicker'
import { uploadAttachments } from '../api/attachments'
import { Link, useLocation, useParams } from 'react-router-dom'
import { addWorkNote, assignIncident, changeIncidentPriority, changeIncidentSeverity, closeIncident, escalateIncident, getIncident, getIncidentHistory, reclassifyIncident, resolveIncident, reviewIncident, submitResolutionFeedback, updateEvidenceReference, updateInvestigation, validateIncident } from '../api/incidents'
import useAuth from '../auth/useAuth'
import ApiState from '../components/ApiState'
import { SeverityBadge, StatusBadge } from '../components/IncidentBadges'
import PageTitle from '../components/PageTitle'
import FieldGuidance from '../components/FieldGuidance'
import { actionGuidance, guidanceDescription, workActionDescriptions } from '../utils/incidentGuidance'
import { formatDate, getErrorMessage, labelize } from '../utils/incident'
import { getLifecycleActions } from '../utils/incidentActions'
import { resolutionFeedbackFields, validateAction, createPayload } from '../utils/incidentActionForm'

const sections = [
  { title: 'Incident Information', fields: [['Incident Number', 'incidentNumber'], ['Title', 'title'], ['Description', 'description'], ['Reported At', 'reportedAt', 'date'], ['Reported By', 'reportedBy'], ['Reporter Department', 'reporterDepartment'], ['Desk Number', 'deskNumber'], ['Affected System', 'affectedSystem'], ['Impacted User / Department', 'impactedUserOrDepartment']] },
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
  workNote: { label: 'Log Work on This Incident', submitLabel: 'Log Work on This Incident', submit: addWorkNote, fields: [{ ...field('remarks', 'Work Note / Observation', true, 'textarea'), maxLength: 8000 }] },
  assign: { label: 'Assign Incident', submitLabel: 'Assign Incident', submit: assignIncident, fields: [field('assignedOwner', 'Assigned Owner', true), field('remarks', 'Remarks', false, 'textarea')] },
  investigation: { label: 'Record Investigation', submitLabel: 'Save Investigation Findings', submit: updateInvestigation, prefill: ['investigationDetails', 'rootCause', 'actionsTaken', 'containmentAction', 'correctiveAction'], fields: [field('investigationDetails', 'Investigation Details', false, 'textarea'), field('rootCause', 'Root Cause', false, 'textarea'), field('actionsTaken', 'Actions Taken', false, 'textarea'), field('containmentAction', 'Containment Action', false, 'textarea'), field('correctiveAction', 'Corrective Action', false, 'textarea'), field('remarks', 'Remarks', false, 'textarea')] },
  resolve: { label: 'Resolve Incident', submitLabel: 'Resolve Incident', submit: resolveIncident, fields: [field('resolutionDetails', 'Resolution Details / Summary', true, 'textarea'), field('remarks', 'Resolution Notes', false, 'textarea')] },
  validate: { label: 'Validate Incident', submitLabel: 'Validate Incident', submit: validateIncident, fields: [field('validationDetails', 'Validation Details', true, 'textarea'), field('remarks', 'Remarks', false, 'textarea')] },
  resolutionFeedback: { label: 'Issue Still Persists', submitLabel: 'Issue Still Persists', submit: submitResolutionFeedback, fields: resolutionFeedbackFields },
  close: { label: 'Close Incident', submitLabel: 'Close Incident', submit: closeIncident, fields: [field('remarks', 'Remarks', false, 'textarea')] },
  review: { label: 'Review Incident', submitLabel: 'Save Review', submit: reviewIncident, fields: [field('reviewDetails', 'Review Details', true, 'textarea'), field('lessonsLearned', 'Lessons Learned', false, 'textarea'), field('preventiveAction', 'Preventive Action', false, 'textarea'), field('remarks', 'Remarks', false, 'textarea')] },
  reclassify: { label: 'Reclassify Incident', submitLabel: 'Update Classification', submit: reclassifyIncident, prefill: ['issueType'], fields: [field('issueType', 'Issue Type', true, 'select', issueTypeOptions), field('remarks', 'Remarks', false, 'textarea')] },
  severity: { label: 'Reassess Severity', submitLabel: 'Update Severity', submit: changeIncidentSeverity, prefill: ['severity'], fields: [field('severity', 'New severity', true, 'select', levelOptions), { ...field('remarks', 'Reason for reassessment', true, 'textarea'), maxLength: 65535 }] },
  priority: { label: 'Reassess Priority', submitLabel: 'Update Priority', submit: changeIncidentPriority, prefill: ['priority'], fields: [field('priority', 'New priority', true, 'select', levelOptions), { ...field('remarks', 'Reason for reassessment', true, 'textarea'), maxLength: 65535 }] },
  escalate: { label: 'Escalate Incident', submitLabel: 'Escalate Incident', submit: escalateIncident, fields: [field('escalationDetails', 'Escalation Details', true, 'textarea'), field('remarks', 'Remarks', false, 'textarea')] },
  evidence: { label: 'Update Evidence Reference', submitLabel: 'Update Evidence', submit: updateEvidenceReference, fields: [field('evidenceReference', 'Evidence Reference', true, 'textarea'), field('remarks', 'Remarks', false, 'textarea')] },
}

const operationalActionKeys = ['reclassify', 'severity', 'priority', 'escalate', 'evidence']

function field(name, label, required = false, type = 'text', options = []) { return { name, label, required, type, options } }

function IncidentDetails() {
  const { id } = useParams()
  return <IncidentDetailsPage key={id} />
}

function IncidentDetailsPage() {
  const { id } = useParams()
  const location = useLocation()
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
  const [actionFiles, setActionFiles] = useState([])
  const [attachmentVersion, setAttachmentVersion] = useState(0)
  const [evidenceUploadWarning, setEvidenceUploadWarning] = useState('')
  const [investigationDraft, setInvestigationDraft] = useState(null)
  const [investigationFiles, setInvestigationFiles] = useState([])
  const [resolutionOpen, setResolutionOpen] = useState(false)
  const [resolutionValues, setResolutionValues] = useState({})
  const [workspaceSaving, setWorkspaceSaving] = useState(false)
  const workspacePending = useRef(false)
  const [workspaceError, setWorkspaceError] = useState('')
  const [workspaceErrors, setWorkspaceErrors] = useState({})
  const [workspaceNotice, setWorkspaceNotice] = useState('')
  const investigationValues = investigationDraft || initialActionValues(actionDefinitions.investigation, incident || {})
  const investigationDirty = investigationFiles.length > 0 || (investigationDraft !== null && actionDefinitions.investigation.fields.some(({ name }) => investigationDraft[name] !== initialActionValues(actionDefinitions.investigation, incident || {})[name]))

  const fetchIncident = useCallback(async (silent, current) => {
    if (!silent) { setState('loading'); setHistoryState('loading'); setAccessDenied(false) }
    const [incidentResult, historyResult] = await Promise.allSettled([getIncident(id), getIncidentHistory(id)])
    if (!current()) return
    if (incidentResult.status === 'fulfilled') { setIncident(incidentResult.value); setState('ready') }
    else if (!silent) { setAccessDenied(incidentResult.reason.response?.status === 403); setError(getErrorMessage(incidentResult.reason)); setState('error') }
    if (historyResult.status === 'fulfilled') { setHistory(historyResult.value); setHistoryState('ready') }
    else if (!silent) { setHistoryError(getErrorMessage(historyResult.reason, 'We could not load the activity history. Please try again.')); setHistoryState('error') }
  }, [id])
  const refresh = usePolling(fetchIncident, !activeAction && !savingAction && !investigationDirty && !resolutionOpen && !workspaceSaving)
  const loadIncident = () => refresh()

  function openAction(actionKey) {
    if (workspacePending.current || savingAction) return
    const action = actionDefinitions[actionKey]
    setActionValues(initialActionValues(action, incident))
    setActionFiles([])
    setActionErrors({})
    setActionError('')
    setActiveAction(actionKey)
  }

  function closeAction() {
    if (!savingAction) { setActiveAction(null); setActionValues({}); setActionFiles([]); setActionErrors({}); setActionError('') }
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
      await uploadActionScreenshots(activeAction, actionFiles)
      setActiveAction(null)
      setActionValues({})
      setActionFiles([])
      await loadIncident()
    } catch (requestError) {
      setActionErrors(getActionFieldErrors(requestError, action))
      setActionError(getActionErrorMessage(requestError))
    } finally {
      setSavingAction(false)
    }
  }


  async function uploadActionScreenshots(actionKey, files) {
    if (!['evidence', 'investigation', 'resolutionFeedback'].includes(actionKey)) return
    setEvidenceUploadWarning('')
    if (files.length) {
      try { await uploadAttachments(id, files) }
      catch {
        setEvidenceUploadWarning(actionKey === 'resolutionFeedback' ? 'Your feedback was saved and the incident is In Progress, but one or more screenshots could not be uploaded. Please retry them using the Attachments section.' : `${actionKey === 'investigation' ? 'Investigation' : 'Evidence'} was updated successfully, but one or more screenshots could not be uploaded. Please upload them later using the Attachments section.`)
      }
    }
    setAttachmentVersion(current => current + 1)
  }

  function editInvestigation(event) {
    const { name, value } = event.target
    setInvestigationDraft(current => ({ ...(current || initialActionValues(actionDefinitions.investigation, incident)), [name]: value }))
    setWorkspaceError(''); setWorkspaceErrors({}); setWorkspaceNotice('')
  }

  async function saveInvestigationDraft() {
    if (!investigationDirty) return
    const saved = await updateInvestigation(id, createPayload(actionDefinitions.investigation, investigationValues))
    setIncident(saved)
    setInvestigationDraft(null) // Keep persisted findings visible; clear one-use remarks and the dirty state.
    await uploadActionScreenshots('investigation', investigationFiles)
    setInvestigationFiles([])
    setWorkspaceNotice('Investigation progress saved.')
  }

  async function runWorkspace(mode) {
    if (workspacePending.current || savingAction) return
    const action = mode === 'confirm' ? actionDefinitions.resolve : actionDefinitions.investigation
    const errors = validateAction(action, mode === 'confirm' ? resolutionValues : investigationValues)
    if (Object.keys(errors).length) { setWorkspaceErrors(errors); setWorkspaceError('Please correct the highlighted fields before saving.'); return }
    workspacePending.current = true
    setWorkspaceSaving(true); setWorkspaceError(''); setWorkspaceErrors({}); setWorkspaceNotice('')
    let stage = actionDefinitions.investigation
    try {
      await saveInvestigationDraft()
      if (mode === 'resolve') setResolutionOpen(true)
      if (mode === 'confirm') {
        stage = actionDefinitions.resolve
        const saved = await resolveIncident(id, createPayload(actionDefinitions.resolve, resolutionValues))
        setIncident(saved); setResolutionOpen(false); setResolutionValues({})
        setWorkspaceNotice('Incident resolved and ready for reporter validation.')
      }
      await refresh(true, false)
    } catch (failure) {
      setWorkspaceErrors(getActionFieldErrors(failure, stage))
      setWorkspaceError(getActionErrorMessage(failure))
    } finally {
      workspacePending.current = false
      setWorkspaceSaving(false)
    }
  }

  if (state === 'loading') return <><PageTitle title="Incident Details" /><ApiState type="loading" /></>
  if (state === 'error') return <><PageTitle title={accessDenied ? 'Access denied' : 'Incident Details'} />{evidenceUploadWarning && <div className="alert alert-warning" role="alert">{evidenceUploadWarning}</div>}<ApiState type="error" message={error} onRetry={loadIncident} /></>

  const reviewCompleted = incident.status === 'CLOSED' && hasRecordedValue(incident.reviewedAt)
  const canPerformOperationalActions = ['IT_HANDLER', 'ADMIN'].includes(user.role)
  const canPerformReviewActions = ['REVIEWER', 'ADMIN'].includes(user.role)
  const availableActions = [...getLifecycleActions(incident, user), ...(canPerformOperationalActions && incident.status !== 'CLOSED' ? ['workNote'] : [])]
  const availableOperationalActions = incident.status === 'CLOSED' || !canPerformOperationalActions ? [] : operationalActionKeys
  return (
    <>
      <PageTitle title={incident.incidentNumber || 'Incident Details'} description={incident.title} actions={<Link className="btn btn-outline-secondary" to="/incidents">Back to Incidents</Link>} />
      <div className="d-flex flex-wrap gap-2 mb-3"><StatusBadge status={incident.status} /><SeverityBadge severity={incident.severity} /></div>
      {incident.issueStillPersists && <div className="alert alert-warning" role="status">
        <h2 className="h6">Issue reported as still unresolved</h2>
        <p>The reporter confirmed that the previous resolution did not fix the issue. The incident has returned to IT for further investigation.</p>
        <div>Reported by: {incident.issueStillPersistsReportedBy}</div>
        <div>Reported at: {formatDate(incident.issueStillPersistsAt)}</div>
      </div>}
      {location.state?.uploadWarning && <div className="alert alert-warning" role="alert">{location.state.uploadWarning}</div>}
      {evidenceUploadWarning && <div className="alert alert-warning" role="alert">{evidenceUploadWarning}</div>}
      <IncidentStatusTracker incident={incident} />
      <ActionsPanel operational={canPerformOperationalActions} waitingMessage={user.role === 'REPORTER' ? reporterWaitingMessage(incident) : null} actionKeys={availableActions} operationalActionKeys={availableOperationalActions} reviewCompleted={reviewCompleted && canPerformReviewActions} onOpen={openAction} disabled={workspaceSaving || savingAction} inlineWorkspace={availableActions.includes('investigation') ? <InlineWorkspace values={investigationValues} files={investigationFiles} onFilesChange={setInvestigationFiles} onChange={editInvestigation} saving={workspaceSaving || savingAction} dirty={investigationDirty} error={workspaceError} errors={workspaceErrors} notice={workspaceNotice} resolutionOpen={resolutionOpen} resolutionValues={resolutionValues} onResolutionChange={event => { setResolutionValues(current => ({ ...current, [event.target.name]: event.target.value })); setWorkspaceError(''); setWorkspaceErrors({}) }} onCancelResolution={() => setResolutionOpen(false)} onSave={() => runWorkspace('save')} onResolve={() => runWorkspace('resolve')} onConfirm={() => runWorkspace('confirm')} /> : null} />
      <AuditTrail history={history} state={historyState} error={historyError} onRetry={loadIncident} />
      <div className="row g-3 mb-4">{sections.map((section) => <DetailSection key={section.title} section={section} incident={incident} />)}</div>
      <IncidentAttachments key={`${id}-${attachmentVersion}`} incidentId={id} canUpload={['REPORTER', 'IT_HANDLER', 'ADMIN'].includes(user.role)} onUploaded={() => refresh(true, false)} />
      {activeAction && <ActionModal currentAssessment={incident[activeAction]} actionKey={activeAction} action={actionDefinitions[activeAction]} user={user} values={actionValues} errors={actionErrors} error={actionError} saving={savingAction} files={actionFiles} onFilesChange={setActionFiles} onChange={updateActionValue} onClose={closeAction} onSubmit={submitAction} />}
    </>
  )
}

function ActionsPanel({ operational, waitingMessage, actionKeys: availableActionKeys, operationalActionKeys: activeOperationalActions, reviewCompleted, onOpen, inlineWorkspace, disabled }) {
  const primaryOrder = ['workNote']
  const actionKeys = availableActionKeys.filter(key => !['investigation', 'resolve'].includes(key))
  const orderedActions = operational ? [...primaryOrder.filter((key) => actionKeys.includes(key)), ...actionKeys.filter((key) => !primaryOrder.includes(key))] : actionKeys
  return <section className={`card section-card action-panel mb-3${operational ? ' work-on-incident' : ''}`} aria-labelledby="incident-actions-title">
    <div className="card-body">
      <h2 className="h5 text-dark mb-2" id="incident-actions-title">{operational ? 'Work on Incident' : 'Actions'}</h2>
      {!operational && <p className="text-secondary small mb-0">Available actions for the current incident status.</p>}
      {inlineWorkspace}
      <div className="incident-action-grid mt-3">
        {orderedActions.map((key) => key === 'assign' ? <div key={key} className="assignment-guidance">
          <button className="btn btn-primary btn-sm" aria-describedby="assign-action-help" disabled={disabled} onClick={() => onOpen(key)}>{actionDefinitions[key].label}</button>
          <p id="assign-action-help" className="small text-secondary mt-1 mb-0">{actionGuidance[key]}</p>
        </div> : operational && workActionDescriptions[key] ? <div className="work-action" key={key}>
          <button className="btn btn-primary btn-sm" aria-describedby={`work-${key}-help`} disabled={disabled} onClick={() => onOpen(key)}>{actionDefinitions[key].label}</button>
          <p className="small text-secondary mt-1 mb-0" id={`work-${key}-help`}>{workActionDescriptions[key]}</p>
        </div> : <button key={key} className="btn btn-primary btn-sm" disabled={disabled} onClick={() => onOpen(key)}>{actionDefinitions[key].label}</button>)}
        {reviewCompleted && <span className="text-secondary small">Review completed</span>}
        {activeOperationalActions.length > 0 && <details className="more-actions align-self-start" onKeyDown={(event) => { if (event.key === 'Escape') { event.currentTarget.open = false; event.currentTarget.querySelector('summary').focus() } }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false }}>
          <summary className="btn btn-outline-secondary btn-sm">More Actions</summary>
          <div className="more-actions-menu border rounded bg-white shadow-sm p-2 mt-2">
            {activeOperationalActions.map((key) => <button key={key} className="btn btn-sm btn-light text-start w-100 py-2" disabled={disabled} aria-labelledby={`action-${key}-label`} aria-describedby={`action-${key}-help`} onClick={(event) => { event.currentTarget.closest('details').open = false; onOpen(key) }}>
              <span id={`action-${key}-label`} className="d-block fw-semibold">{actionDefinitions[key].label}</span>
              <span id={`action-${key}-help`} className="d-block small text-secondary fw-normal">{actionGuidance[key]}</span>
            </button>)}
          </div>
        </details>}
        {!actionKeys.length && !reviewCompleted && !activeOperationalActions.length && <div className="text-secondary small">{waitingMessage ? waitingMessage.map((line) => <p className="mb-1" key={line}>{line}</p>) : 'No lifecycle actions are available.'}</div>}
      </div>
      {operational && <p className="small text-secondary mt-3 mb-0">Updates, work notes and lifecycle actions are recorded in the <a href="#incident-activity">Activity &amp; Work Log</a> below.</p>}
    </div>
  </section>
}

function ActionModal({ currentAssessment, actionKey, action, user, values, errors, error, saving, files, onFilesChange, onChange, onClose, onSubmit }) {
  const investigation = actionKey === 'investigation'
  const mainFields = investigation ? action.fields.filter((item) => ['investigationDetails', 'actionsTaken'].includes(item.name)) : action.fields
  const additionalFields = investigation ? action.fields.filter((item) => !['investigationDetails', 'actionsTaken'].includes(item.name)) : []
  const renderField = (item) => <ActionField key={item.name} actionKey={actionKey} field={item} value={values[item.name] || ''} error={errors[item.name]} onChange={onChange} />
  return <>
    <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="action-modal-title">
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <form className="modal-content" noValidate onSubmit={onSubmit}>
          <div className="modal-header"><h2 className="modal-title fs-5" id="action-modal-title">{action.label}</h2><button type="button" className="btn-close" aria-label="Close" onClick={onClose} disabled={saving} /></div>
          <div className="modal-body">
            <p className="small text-secondary">{actionGuidance[actionKey]}</p>
            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            <p className="small text-secondary">Action will be recorded as {user.email}.</p>
            <div className="row g-3">{['severity', 'priority'].includes(actionKey) && <p className="mb-0">Current {actionKey}: <strong>{currentAssessment || 'Not recorded'}</strong></p>}{mainFields.map(renderField)}</div>
            {['evidence', 'investigation', 'resolutionFeedback'].includes(actionKey) && <div className="mt-3"><ImagePicker label={actionKey === 'resolutionFeedback' ? 'Supporting Screenshots' : undefined} files={files} onChange={onFilesChange} disabled={saving} /></div>}
            {investigation && <details className="mt-3" open={additionalFields.some((item) => Boolean(errors[item.name])) || undefined}>
              <summary className="small fw-semibold">Additional investigation details</summary>
              <div className="row g-3 mt-1">{additionalFields.map(renderField)}</div>
            </details>}
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={saving}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}{saving ? 'Saving…' : action.submitLabel}</button></div>
        </form>
      </div>
    </div>
    <div className="modal-backdrop show" />
  </>
}

function ActionField({ field: item, value, error, onChange, actionKey, idPrefix = 'action' }) {
  if (item.type === 'select') return <div className="col-12 col-md-6"><label className="form-label fw-semibold" htmlFor={`${idPrefix}-${item.name}`}>{item.label}{item.required && <span className="text-danger"> *</span>}</label><select id={`${idPrefix}-${item.name}`} name={item.name} value={value} onChange={onChange} className={`form-select${error ? ' is-invalid' : ''}`} aria-describedby={guidanceDescription(item.name, `${idPrefix}-${item.name}`, error)}>{item.options.map((option) => <option key={option} value={option}>{formatOptionLabel(option)}</option>)}</select>{error && <div id={`${idPrefix}-${item.name}-error`} className="invalid-feedback">{error}</div>}<FieldGuidance actionKey={actionKey} name={item.name} id={`${idPrefix}-${item.name}`} label={item.label} /></div>
  const Component = item.type === 'textarea' ? 'textarea' : 'input'
  return <div className={item.type === 'textarea' ? 'col-12' : 'col-12 col-md-6'}><label className="form-label fw-semibold" htmlFor={`${idPrefix}-${item.name}`}>{item.label}{item.required && <span className="text-danger"> *</span>}</label><Component id={`${idPrefix}-${item.name}`} name={item.name} value={value} onChange={onChange} className={`form-control${error ? ' is-invalid' : ''}`} rows={item.type === 'textarea' ? 4 : undefined} aria-describedby={guidanceDescription(item.name, `${idPrefix}-${item.name}`, error)} />{error && <div id={`${idPrefix}-${item.name}-error`} className="invalid-feedback">{error}</div>}<FieldGuidance actionKey={actionKey} name={item.name} id={`${idPrefix}-${item.name}`} label={item.label} /></div>
}

function DetailSection({ section, incident }) { return <section className="col-12 col-xl-6"><div className="card section-card h-100"><div className="card-body"><h2 className="h6 text-dark border-bottom pb-2 mb-3">{section.title}</h2><dl className="row mb-0">{section.fields.map(([label, fieldName, format]) => <DetailField key={fieldName} fieldName={fieldName} label={label} value={incident[fieldName]} format={format} />)}</dl></div></div></section> }
function DetailField({ fieldName, label, value, format }) { const displayValue = format === 'date' ? formatDate(value) : format === 'label' ? labelize(value) : format === 'boolean' ? formatBoolean(value) : value || 'Not recorded'; return <><dt className="col-sm-5 detail-label mb-1 mb-sm-3">{label}</dt><dd className="col-sm-7 detail-value mb-3">{format === 'status' ? <StatusBadge status={value} /> : format === 'severity' ? <SeverityBadge severity={value} /> : displayValue}{fieldName === 'escalationRequired' && <FieldGuidance name={fieldName} id={`detail-${fieldName}`} label={label} />}</dd></> }

function AuditTrail({ history, state, error, onRetry }) {
  const [filter, setFilter] = useState('All')
  const [expanded, setExpanded] = useState(false)
  const chronologicalHistory = filterActivity(history, filter)
  const visibleHistory = expanded ? chronologicalHistory : chronologicalHistory.slice(-5)
  return <section className="card section-card mb-4" id="incident-activity" aria-labelledby="incident-activity-title">
    <div className="card-body">
      <h2 className="h5 text-dark mb-1" id="incident-activity-title">Activity &amp; Work Log</h2>
      <p className="text-secondary small mb-3">Chronological record of incident changes and work notes.</p>
      <div className="d-flex flex-wrap gap-2 mb-3" role="group" aria-label="Filter activity">
        {activityFilters.map((item) => <button key={item} type="button" className={`btn btn-sm ${filter === item ? 'btn-primary' : 'btn-outline-secondary'}`} aria-pressed={filter === item} onClick={() => { setFilter(item); setExpanded(false) }}>{item}</button>)}
      </div>
      {state === 'loading' && <ApiState type="loading" />}
      {state === 'error' && <ApiState type="error" message={error} onRetry={onRetry} />}
      {state === 'ready' && (chronologicalHistory.length === 0
        ? <div className="text-secondary py-3">{history.length === 0 ? 'No audit history has been recorded.' : 'No activity matches this filter.'}</div>
        : <ol id="activity-entries" className="audit-timeline list-unstyled mb-0">{visibleHistory.map((entry) => <AuditEntry key={entry.id} entry={entry} />)}</ol>)}
      {state === 'ready' && chronologicalHistory.length > 5 && <div className="d-flex flex-wrap align-items-center gap-3 mt-3"><button className="btn btn-outline-secondary btn-sm" aria-expanded={expanded} aria-controls="activity-entries" onClick={() => setExpanded(!expanded)}>{expanded ? 'Show recent activity' : 'View full activity'}</button><span className="small text-secondary">Showing {visibleHistory.length} of {chronologicalHistory.length} matching entries</span></div>}
    </div>
  </section>
}

function AuditEntry({ entry }) {
  const change = historyChange(entry)
  const remarks = historyRemarks(entry)
  return <li className="audit-timeline-item">
    <div className="audit-entry-heading">
      <div className="fw-semibold text-dark">{historyActionLabel(entry.actionType)}</div>
      <time className="text-secondary small audit-time">{formatDate(entry.changedAt)}</time>
    </div>
    <div className="audit-actor text-secondary small mt-1">{historyActorLabel(entry.actionType)} {entry.changedBy || 'Actor unavailable'}</div>
    {change && <div className={isFieldTransition(entry.actionType) ? 'audit-value-change mt-2' : 'audit-summary small mt-2'} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{change}</div>}
    {remarks && <div className="audit-remarks mt-2 small" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
      {remarks.label && <div className="fw-semibold">{remarks.label}</div>}
      <div>{remarks.text}</div>
    </div>}
  </li>
}



function initialActionValues(action, incident) { return action.fields.reduce((values, item) => ({ ...values, [item.name]: action.prefill?.includes(item.name) ? incident[item.name] || '' : '' }), {}) }


function getActionFieldErrors(error, action) { const allowedFields = new Set(action.fields.map((item) => item.name)); const payload = error.response?.data; const candidates = [payload?.fieldErrors, payload?.errors, payload]; for (const candidate of candidates) { if (Array.isArray(candidate)) { const errors = candidate.reduce((result, item) => { const message = item?.message || item?.defaultMessage; if (allowedFields.has(item?.field) && typeof message === 'string') result[item.field] = message; return result }, {}); if (Object.keys(errors).length) return errors } if (candidate && typeof candidate === 'object') { const errors = Object.entries(candidate).reduce((result, [name, message]) => { if (allowedFields.has(name) && typeof message === 'string') result[name] = message; return result }, {}); if (Object.keys(errors).length) return errors } } return {} }
function getActionErrorMessage(error) { if (error.response?.status === 409) { const payload = error.response.data; const message = typeof payload === 'string' ? payload : payload?.message || payload?.error; if (typeof message === 'string' && !message.includes('\n')) return message; return 'This action is no longer available because the incident lifecycle state has changed.' } return getErrorMessage(error, 'The action could not be saved. Please review the form and try again.') }
function formatBoolean(value) { return value === true ? 'Yes' : value === false ? 'No' : 'Not recorded' }
function hasRecordedValue(value) { return value !== null && value !== undefined && String(value).trim() !== '' }
function formatOptionLabel(value) { if (value === 'MAJOR_CRITICAL_SECURITY_INCIDENT') return 'Major / Critical Security Incident'; return labelize(value).toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) }

export default IncidentDetails

function InlineWorkspace({ values, files, onFilesChange, onChange, saving, dirty, error, errors, notice, resolutionOpen, resolutionValues, onResolutionChange, onCancelResolution, onSave, onResolve, onConfirm }) {
  const mainFields = actionDefinitions.investigation.fields.filter(item => ['investigationDetails', 'actionsTaken'].includes(item.name))
  const additionalFields = actionDefinitions.investigation.fields.filter(item => !['investigationDetails', 'actionsTaken'].includes(item.name))
  const renderField = item => <ActionField key={item.name} idPrefix="investigation" actionKey="investigation" field={item} value={values[item.name] || ''} error={errors[item.name]} onChange={onChange} />
  return <form className="inline-investigation" noValidate onSubmit={event => { event.preventDefault(); if (resolutionOpen) onConfirm(); else onSave() }}>
    <fieldset disabled={saving}>
      <legend className="visually-hidden">Investigation workspace</legend>
      <p className="small text-secondary">Record diagnostic findings and observations. Save progress as you work.</p>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}
      <div className="row g-3">{mainFields.map(renderField)}</div>
      <div className="mt-3"><ImagePicker files={files} onChange={onFilesChange} disabled={saving} /></div>
      <details className="mt-3" open={additionalFields.some(item => Boolean(errors[item.name])) || undefined}>
        <summary className="small fw-semibold">Additional investigation details</summary>
        <div className="row g-3 mt-1">{additionalFields.map(renderField)}</div>
      </details>
      <div className="d-flex flex-wrap gap-2 mt-3">
        <button type="button" className="btn btn-primary" onClick={onSave} disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save Progress'}</button>
        {!resolutionOpen && <button type="button" className="btn btn-outline-primary" onClick={onResolve}>Resolve Incident</button>}
      </div>
      {resolutionOpen && <section className="inline-resolution mt-3" aria-labelledby="inline-resolution-title">
        <h3 className="h6" id="inline-resolution-title">Resolution</h3>
        <p className="small text-secondary">Mark the issue as fixed and move it to reporter validation. Any further investigation edits will be saved before resolution.</p>
        <div className="row g-3">{actionDefinitions.resolve.fields.map(item => <ActionField key={item.name} idPrefix="resolution" actionKey="resolve" field={item} value={resolutionValues[item.name] || ''} error={errors[item.name]} onChange={onResolutionChange} />)}</div>
        <div className="d-flex flex-wrap gap-2 mt-3"><button type="button" className="btn btn-outline-secondary" onClick={onCancelResolution}>Cancel Resolution</button><button type="submit" className="btn btn-primary">Confirm Resolution</button></div>
      </section>}
    </fieldset>
  </form>
}
