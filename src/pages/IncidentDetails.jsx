import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getIncident } from '../api/incidents'
import ApiState from '../components/ApiState'
import { SeverityBadge, StatusBadge } from '../components/IncidentBadges'
import PageTitle from '../components/PageTitle'
import { formatDate, getErrorMessage, labelize, readField } from '../utils/incident'

const sections = [
  {
    title: 'Incident Information',
    fields: [
      ['Incident Number', ['incidentNumber', 'number']],
      ['Title', ['title']],
      ['Description', ['description']],
      ['Reported At', ['reportedAt', 'createdAt'], 'date'],
      ['Reported By', ['reportedBy', 'reporter', 'reportedByName']],
      ['Affected Service', ['affectedService', 'service']],
    ],
  },
  {
    title: 'Classification & Priority',
    fields: [
      ['Issue Type', ['issueType', 'issue_type'], 'label'],
      ['Severity', ['severity'], 'severity'],
      ['Priority', ['priority'], 'label'],
      ['Impact', ['impact'], 'label'],
      ['Urgency', ['urgency'], 'label'],
    ],
  },
  {
    title: 'Assignment',
    fields: [
      ['Assigned Owner', ['assignedOwner', 'assignedTo', 'owner']],
      ['Assignment Group', ['assignmentGroup', 'assignedGroup']],
      ['Assigned At', ['assignedAt'], 'date'],
      ['Status', ['status'], 'status'],
    ],
  },
  {
    title: 'Investigation',
    fields: [
      ['Investigation Notes', ['investigationNotes', 'investigation']],
      ['Root Cause', ['rootCause']],
      ['Business Impact', ['businessImpact']],
      ['Evidence', ['evidence']],
    ],
  },
  {
    title: 'Containment & Corrective Action',
    fields: [
      ['Containment Action', ['containmentAction', 'containmentActions']],
      ['Corrective Action', ['correctiveAction', 'correctiveActions']],
      ['Action Owner', ['actionOwner', 'correctiveActionOwner']],
      ['Target Completion', ['targetCompletionDate', 'targetDate'], 'date'],
    ],
  },
  {
    title: 'Resolution',
    fields: [
      ['Resolution Summary', ['resolutionSummary', 'resolution']],
      ['Resolved By', ['resolvedBy']],
      ['Resolved At', ['resolvedAt'], 'date'],
      ['Resolution Code', ['resolutionCode'], 'label'],
    ],
  },
  {
    title: 'Validation & Closure',
    fields: [
      ['Validation Notes', ['validationNotes', 'validation']],
      ['Validated By', ['validatedBy']],
      ['Validated At', ['validatedAt'], 'date'],
      ['Closed By', ['closedBy']],
      ['Closed At', ['closedAt'], 'date'],
    ],
  },
  {
    title: 'Review',
    fields: [
      ['Review Notes', ['reviewNotes', 'postIncidentReview']],
      ['Reviewed By', ['reviewedBy']],
      ['Reviewed At', ['reviewedAt'], 'date'],
      ['Lessons Learned', ['lessonsLearned']],
    ],
  },
]

function IncidentDetails() {
  const { id } = useParams()
  const [incident, setIncident] = useState(null)
  const [state, setState] = useState('loading')
  const [error, setError] = useState('')

  const loadIncident = useCallback(async () => {
    setState('loading')
    try { setIncident(await getIncident(id)); setState('ready') } catch (requestError) { setError(getErrorMessage(requestError)); setState('error') }
  }, [id])

  useEffect(() => { void Promise.resolve().then(loadIncident) }, [loadIncident])

  if (state === 'loading') return <><PageTitle title="Incident Details" /><ApiState type="loading" /></>
  if (state === 'error') return <><PageTitle title="Incident Details" /><ApiState type="error" message={error} onRetry={loadIncident} /></>

  return (
    <>
      <PageTitle title={readField(incident, 'incidentNumber', 'number') || 'Incident Details'} description={readField(incident, 'title')} actions={<Link className="btn btn-outline-secondary" to="/incidents">Back to Incidents</Link>} />
      <div className="d-flex flex-wrap gap-2 mb-4"><StatusBadge status={readField(incident, 'status')} /><SeverityBadge severity={readField(incident, 'severity')} /></div>
      <div className="row g-3">{sections.map((section) => <DetailSection key={section.title} section={section} incident={incident} />)}</div>
    </>
  )
}

function DetailSection({ section, incident }) {
  return <section className="col-12 col-xl-6"><div className="card section-card h-100"><div className="card-body"><h2 className="h6 text-dark border-bottom pb-2 mb-3">{section.title}</h2><dl className="row mb-0">{section.fields.map(([label, keys, format]) => <DetailField key={label} label={label} value={readField(incident, ...keys)} format={format} />)}</dl></div></div></section>
}

function DetailField({ label, value, format }) {
  const displayValue = format === 'date' ? formatDate(value) : format === 'label' ? labelize(value) : value || '—'
  return <><dt className="col-sm-5 detail-label mb-1 mb-sm-3">{label}</dt><dd className="col-sm-7 detail-value mb-3">{format === 'status' ? <StatusBadge status={value} /> : format === 'severity' ? <SeverityBadge severity={value} /> : displayValue}</dd></>
}

export default IncidentDetails
