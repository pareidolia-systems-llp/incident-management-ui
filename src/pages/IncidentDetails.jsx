import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getIncident, getIncidentHistory } from '../api/incidents'
import ApiState from '../components/ApiState'
import { SeverityBadge, StatusBadge } from '../components/IncidentBadges'
import PageTitle from '../components/PageTitle'
import { formatDate, getErrorMessage, labelize } from '../utils/incident'

const sections = [
  {
    title: 'Incident Information',
    fields: [
      ['Incident Number', 'incidentNumber'], ['Title', 'title'], ['Description', 'description'], ['Reported At', 'reportedAt', 'date'],
      ['Reported By', 'reportedBy'], ['Reporter Department', 'reporterDepartment'], ['Affected System', 'affectedSystem'], ['Impacted User / Department', 'impactedUserOrDepartment'],
    ],
  },
  {
    title: 'Classification & Priority',
    fields: [['Issue Type', 'issueType', 'label'], ['Category', 'category', 'label'], ['Severity', 'severity', 'severity'], ['Priority', 'priority', 'label'], ['Status', 'status', 'status']],
  },
  { title: 'Assignment', fields: [['Assigned Owner', 'assignedOwner']] },
  { title: 'Investigation', fields: [['Investigation Details', 'investigationDetails'], ['Root Cause', 'rootCause'], ['Actions Taken', 'actionsTaken']] },
  {
    title: 'Containment & Corrective Action',
    fields: [['Containment Action', 'containmentAction'], ['Corrective Action', 'correctiveAction'], ['Evidence Reference', 'evidenceReference'], ['Escalation Required', 'escalationRequired', 'boolean'], ['Escalation Details', 'escalationDetails']],
  },
  { title: 'Resolution', fields: [['Resolution Details', 'resolutionDetails'], ['Resolved At', 'resolvedAt', 'date']] },
  {
    title: 'Validation & Closure',
    fields: [['Validation Details', 'validationDetails'], ['Validated By', 'validatedBy'], ['Validated At', 'validatedAt', 'date'], ['Closure Confirmed By', 'closureConfirmedBy'], ['Closed At', 'closedAt', 'date']],
  },
  {
    title: 'Review',
    fields: [['Review Details', 'reviewDetails'], ['Reviewed By', 'reviewedBy'], ['Reviewed At', 'reviewedAt', 'date'], ['Lessons Learned', 'lessonsLearned'], ['Preventive Action', 'preventiveAction']],
  },
  { title: 'System Information', fields: [['Created At', 'createdAt', 'date'], ['Updated At', 'updatedAt', 'date']] },
]

function IncidentDetails() {
  const { id } = useParams()
  const [incident, setIncident] = useState(null)
  const [history, setHistory] = useState([])
  const [state, setState] = useState('loading')
  const [error, setError] = useState('')
  const [historyState, setHistoryState] = useState('loading')
  const [historyError, setHistoryError] = useState('')

  const loadIncident = useCallback(async () => {
    setState('loading')
    setHistoryState('loading')
    const [incidentResult, historyResult] = await Promise.allSettled([getIncident(id), getIncidentHistory(id)])

    if (incidentResult.status === 'fulfilled') {
      setIncident(incidentResult.value)
      setState('ready')
    } else {
      setError(getErrorMessage(incidentResult.reason))
      setState('error')
    }

    if (historyResult.status === 'fulfilled') {
      setHistory(historyResult.value)
      setHistoryState('ready')
    } else {
      setHistoryError(getErrorMessage(historyResult.reason, 'We could not load the audit history. Please try again.'))
      setHistoryState('error')
    }
  }, [id])

  useEffect(() => { void Promise.resolve().then(loadIncident) }, [loadIncident])

  if (state === 'loading') return <><PageTitle title="Incident Details" /><ApiState type="loading" /></>
  if (state === 'error') return <><PageTitle title="Incident Details" /><ApiState type="error" message={error} onRetry={loadIncident} /></>

  return (
    <>
      <PageTitle title={incident.incidentNumber || 'Incident Details'} description={incident.title} actions={<Link className="btn btn-outline-secondary" to="/incidents">Back to Incidents</Link>} />
      <div className="d-flex flex-wrap gap-2 mb-4"><StatusBadge status={incident.status} /><SeverityBadge severity={incident.severity} /></div>
      <div className="row g-3 mb-4">{sections.map((section) => <DetailSection key={section.title} section={section} incident={incident} />)}</div>
      <AuditTrail history={history} state={historyState} error={historyError} onRetry={loadIncident} />
    </>
  )
}

function DetailSection({ section, incident }) {
  return <section className="col-12 col-xl-6"><div className="card section-card h-100"><div className="card-body"><h2 className="h6 text-dark border-bottom pb-2 mb-3">{section.title}</h2><dl className="row mb-0">{section.fields.map(([label, field, format]) => <DetailField key={field} label={label} value={incident[field]} format={format} />)}</dl></div></div></section>
}

function DetailField({ label, value, format }) {
  const displayValue = format === 'date' ? formatDate(value) : format === 'label' ? labelize(value) : format === 'boolean' ? formatBoolean(value) : value || 'Not recorded'
  return <><dt className="col-sm-5 detail-label mb-1 mb-sm-3">{label}</dt><dd className="col-sm-7 detail-value mb-3">{format === 'status' ? <StatusBadge status={value} /> : format === 'severity' ? <SeverityBadge severity={value} /> : displayValue}</dd></>
}

function AuditTrail({ history, state, error, onRetry }) {
  const chronologicalHistory = useMemo(() => [...history].sort((first, second) => toTimestamp(first.changedAt) - toTimestamp(second.changedAt)), [history])
  return <section className="card section-card"><div className="card-body"><h2 className="h5 text-dark mb-1">Audit Trail</h2><p className="text-secondary small mb-4">Chronological record of incident changes.</p>
    {state === 'loading' && <ApiState type="loading" />}
    {state === 'error' && <ApiState type="error" message={error} onRetry={onRetry} />}
    {state === 'ready' && (chronologicalHistory.length === 0 ? <div className="text-secondary py-3">No audit history has been recorded.</div> : <ol className="audit-timeline list-unstyled mb-0">{chronologicalHistory.map((entry) => <AuditEntry key={entry.id} entry={entry} />)}</ol>)}
  </div></section>
}

function AuditEntry({ entry }) {
  const hasValueChange = hasValue(entry.oldValue) || hasValue(entry.newValue)
  return <li className="audit-timeline-item"><div className="d-sm-flex justify-content-between gap-3"><div className="fw-semibold text-dark">{actionLabel(entry.actionType)}</div><time className="text-secondary small text-nowrap">{formatDate(entry.changedAt)}</time></div><div className="text-secondary small mt-1">Changed by {entry.changedBy || 'Not recorded'}</div>{hasValueChange && <div className="audit-value-change mt-2"><span>{displayHistoryValue(entry.oldValue)}</span><span className="mx-2 text-secondary">→</span><span>{displayHistoryValue(entry.newValue)}</span></div>}{entry.remarks && <div className="mt-2 small"><span className="fw-semibold">Remarks:</span> {entry.remarks}</div>}</li>
}

function formatBoolean(value) { return value === true ? 'Yes' : value === false ? 'No' : 'Not recorded' }
function hasValue(value) { return value !== null && value !== undefined && value !== '' }
function displayHistoryValue(value) { return hasValue(value) ? labelize(value) : 'Not recorded' }
function actionLabel(value) { return value ? String(value).toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') : 'Activity recorded' }
function toTimestamp(value) { const timestamp = new Date(value).getTime(); return Number.isNaN(timestamp) ? 0 : timestamp }

export default IncidentDetails
