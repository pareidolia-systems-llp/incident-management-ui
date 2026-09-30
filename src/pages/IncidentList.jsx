import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getIncidents } from '../api/incidents'
import useAuth from '../auth/useAuth'
import ApiState from '../components/ApiState'
import { SeverityBadge, StatusBadge } from '../components/IncidentBadges'
import PageTitle from '../components/PageTitle'
import { formatDate, getErrorMessage, labelize, readField } from '../utils/incident'

function IncidentList() {
  const { user } = useAuth()
  const [incidents, setIncidents] = useState([])
  const [state, setState] = useState('loading')
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ search: '', status: '', severity: '', issueType: '' })

  const loadIncidents = useCallback(async () => {
    setState('loading')
    try { setIncidents(await getIncidents()); setState('ready') } catch (requestError) { setError(getErrorMessage(requestError)); setState('error') }
  }, [])

  useEffect(() => { void Promise.resolve().then(loadIncidents) }, [loadIncidents])

  const choices = useMemo(() => ({
    statuses: uniqueValues(incidents, 'status'),
    severities: uniqueValues(incidents, 'severity'),
    issueTypes: uniqueValues(incidents, 'issueType', 'issue_type'),
  }), [incidents])

  const filteredIncidents = useMemo(() => incidents.filter((incident) => {
    const searchable = [readField(incident, 'incidentNumber', 'number'), readField(incident, 'title'), readField(incident, 'issueType', 'issue_type'), readField(incident, 'assignedOwner', 'assignedTo', 'owner')].join(' ').toLowerCase()
    return (!filters.search || searchable.includes(filters.search.toLowerCase()))
      && (!filters.status || readField(incident, 'status') === filters.status)
      && (!filters.severity || readField(incident, 'severity') === filters.severity)
      && (!filters.issueType || readField(incident, 'issueType', 'issue_type') === filters.issueType)
  }), [filters, incidents])

  const updateFilter = (event) => setFilters((current) => ({ ...current, [event.target.name]: event.target.value }))

  return (
    <>
      <PageTitle title="Incidents" description="Search and review reported incidents." actions={['REPORTER', 'ADMIN'].includes(user.role) ? <Link className="btn btn-primary" to="/incidents/new">Create Incident</Link> : null} />
      {state === 'loading' && <ApiState type="loading" />}
      {state === 'error' && <ApiState type="error" message={error} onRetry={loadIncidents} />}
      {state === 'ready' && <>
        <div className="card section-card filter-panel mb-3"><div className="card-body"><div className="row g-3 align-items-end">
          <div className="col-12 col-lg-4"><label className="form-label small fw-semibold">Search</label><input name="search" value={filters.search} onChange={updateFilter} className="form-control" placeholder="Number, title, or owner" /></div>
          <FilterSelect label="Status" name="status" value={filters.status} options={choices.statuses} onChange={updateFilter} />
          <FilterSelect label="Severity" name="severity" value={filters.severity} options={choices.severities} onChange={updateFilter} />
          <FilterSelect label="Issue type" name="issueType" value={filters.issueType} options={choices.issueTypes} onChange={updateFilter} />
        </div></div></div>
        <div className="card section-card incident-table-card overflow-hidden"><div className="card-body p-0">
          {filteredIncidents.length === 0 ? <ApiState type="empty" /> : <div className="table-responsive"><table className="table table-hover mb-0"><thead><tr><th>Incident Number</th><th>Title</th><th>Issue Type</th><th>Severity</th><th>Priority</th><th>Assigned Owner</th><th>Status</th><th>Reported At</th><th className="text-end"> </th></tr></thead><tbody>
            {filteredIncidents.map((incident) => <tr key={incident.id}><td className="fw-semibold">{readField(incident, 'incidentNumber', 'number') || '—'}</td><td>{readField(incident, 'title') || '—'}</td><td>{labelize(readField(incident, 'issueType', 'issue_type'))}</td><td><SeverityBadge severity={readField(incident, 'severity')} /></td><td>{labelize(readField(incident, 'priority'))}</td><td>{readField(incident, 'assignedOwner', 'assignedTo', 'owner') || 'Unassigned'}</td><td><StatusBadge status={readField(incident, 'status')} /></td><td className="text-nowrap">{formatDate(readField(incident, 'reportedAt', 'createdAt'))}</td><td className="text-end"><Link className="btn btn-sm btn-outline-primary" to={`/incidents/${incident.id}`}>View</Link></td></tr>)}
          </tbody></table></div>}
        </div></div>
      </>}
    </>
  )
}

function uniqueValues(items, ...keys) { return [...new Set(items.map((item) => readField(item, ...keys)).filter(Boolean))].sort() }

function FilterSelect({ label, name, value, options, onChange }) {
  return <div className="col-12 col-sm-4 col-lg-2"><label className="form-label small fw-semibold">{label}</label><select name={name} value={value} onChange={onChange} className="form-select"><option value="">All</option>{options.map((option) => <option key={option} value={option}>{labelize(option)}</option>)}</select></div>
}

export default IncidentList
