import { useCallback, useState } from 'react'
import usePolling from '../hooks/usePolling'
import { getIncidents } from '../api/incidents'
import ApiState from '../components/ApiState'
import PageTitle from '../components/PageTitle'
import OversightNotifications from '../components/OversightNotifications'
import { getErrorMessage, readField } from '../utils/incident'

const statDefinitions = [
  { label: 'Issues Still Persisting', value: (items) => items.filter((item) => item.issueStillPersists === true).length, tone: 'danger' },
  { label: 'Total Incidents', value: (items) => items.length, tone: 'primary' },
  { label: 'Open', value: (items) => countStatus(items, 'OPEN'), tone: 'primary' },
  { label: 'Assigned', value: (items) => countStatus(items, 'ASSIGNED'), tone: 'info' },
  { label: 'In Progress', value: (items) => countStatus(items, 'IN_PROGRESS'), tone: 'warning' },
  { label: 'Resolved', value: (items) => countStatus(items, 'RESOLVED'), tone: 'success' },
  { label: 'Validated', value: (items) => countStatus(items, 'VALIDATED'), tone: 'success' },
  { label: 'Closed', value: (items) => countStatus(items, 'CLOSED'), tone: 'secondary' },
  { label: 'Critical', value: (items) => items.filter((item) => readField(item, 'severity') === 'CRITICAL').length, tone: 'danger' },
  { label: 'Security Incidents', value: (items) => items.filter((item) => securityTypes.has(readField(item, 'issueType', 'issue_type'))).length, tone: 'danger' },
]

const securityTypes = new Set(['SUSPECTED_SECURITY_INCIDENT', 'INFORMATION_SECURITY_INCIDENT', 'MAJOR_CRITICAL_SECURITY_INCIDENT'])

function countStatus(items, status) {
  return items.filter((item) => readField(item, 'status') === status).length
}

function Dashboard() {
  const [incidents, setIncidents] = useState([])
  const [state, setState] = useState('loading')
  const [error, setError] = useState('')

  const fetchIncidents = useCallback(async (silent, current) => {
    if (!silent) setState('loading')
    try {
      const data = await getIncidents()
      if (current()) { setIncidents(data); setState('ready') }
    } catch (requestError) {
      if (current() && !silent) { setError(getErrorMessage(requestError)); setState('error') }
    }
  }, [])
  const refresh = usePolling(fetchIncidents)
  const loadIncidents = () => refresh()


  return (
    <>
      <PageTitle title="Dashboard" description="Current incident workload and operational status." />
      {import.meta.env.VITE_INCIDENT_OVERSIGHT_ENABLED === 'true' && <OversightNotifications />}
      {state === 'loading' && <ApiState type="loading" />}
      {state === 'error' && <ApiState type="error" message={error} onRetry={loadIncidents} />}
      {state === 'ready' && (
        <div className="row g-3">
          {statDefinitions.map((stat) => (
            <div className="col-12 col-sm-6 col-lg-4 col-xxl-3" key={stat.label}>
              <div className={`card stat-card stat-card-${stat.tone} h-100`}><div className="card-body d-flex flex-column justify-content-between"><span className="stat-label">{stat.label}</span><div className={`stat-value text-${stat.tone}`}>{stat.value(incidents)}</div></div></div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export default Dashboard
