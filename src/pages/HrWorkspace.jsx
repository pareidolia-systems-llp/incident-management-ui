import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import useAuth from '../auth/useAuth'
import { getIncident, getIncidentHistory, getIncidents } from '../api/incidents'
import { getCurrentUser } from '../api/auth'
import { getAcknowledgement, getAssignment } from '../api/assignment'
import IncidentStatusTracker from '../components/IncidentStatusTracker'
import PageTitle from '../components/PageTitle'
import { formatDate, labelize } from '../utils/incident'
import { historyActionLabel, historyActorLabel, historyChange, historyRemarks } from '../utils/incidentHistory'

const isHrDepartment = incident => incident.hrResponsibleDepartment === true

/** This component only organizes incidents already authorized by the backend. */
export default function HrWorkspace() {
  const { user } = useAuth()
  const [tab, setTab] = useState('cases')
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('loading')
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState(null)
  const [history, setHistory] = useState([])
  const [acknowledgement, setAcknowledgement] = useState(null)
  const [detailError, setDetailError] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)
  const [assignments, setAssignments] = useState({})

  useEffect(() => {
    if (user?.canAccessHrWorkspace !== true) return
    let live = true
    getCurrentUser().then(current => {
      if (!live) return null
      if (current?.canAccessHrWorkspace !== true) { setItems([]); setStatus('denied'); return null }
      return getIncidents()
    }).then(data => {
      if (live && data) { setItems(data); setStatus('ready') }
    }).catch(() => { if (live) setStatus('error') })
    return () => { live = false }
  }, [user])

  useEffect(() => {
    if (selected == null) return
    let live = true
    getCurrentUser().then(current => {
      if (!live) return null
      if (current?.canAccessHrWorkspace !== true) {
        setItems([]); setAssignments({}); setDetail(null); setHistory([]); setAcknowledgement(null); setStatus('denied')
        return null
      }
      // Recheck the case-specific oversight marker: a reporter can retain separate
      // access to the incident after their oversight grant has been revoked.
      return getIncidents().then(currentItems => {
        if (!live) return null
        if (!currentItems.some(item => item.id === selected && item.hrOversightView === true && !isHrDepartment(item))) {
          setDetail(null); setHistory([]); setAcknowledgement(null); setDetailLoading(false)
          setDetailError('Incident details are unavailable or access has changed.')
          return null
        }
        return Promise.allSettled([getIncident(selected), getIncidentHistory(selected), getAcknowledgement(selected)])
      })
    }).then(results => {
      if (!live || !results) return
      setDetailLoading(false)
      if (results[0].status !== 'fulfilled') {
        setDetail(null); setHistory([]); setAcknowledgement(null); setDetailError('Incident details are unavailable or access has changed.')
        return
      }
      setDetail(results[0].value)
      setHistory(results[1].status === 'fulfilled' ? results[1].value : [])
      setAcknowledgement(results[2].status === 'fulfilled' ? results[2].value : null)
      setDetailError(results[1].status === 'rejected' ? 'Activity history is unavailable.' : '')
    }).catch(() => {
      if (live) { setDetail(null); setHistory([]); setAcknowledgement(null); setDetailLoading(false); setDetailError('HR workspace access could not be verified.') }
    })
    return () => { live = false }
  }, [selected])
  const oversight = useMemo(() => items.filter(item =>
    !isHrDepartment(item) && item.hrOversightView === true), [items])
  const departments = useMemo(() =>
    [...new Set(oversight.map(item => item.responsibleDepartmentName).filter(Boolean))].sort(), [oversight])
  const visible = tab === 'cases'
    ? items.filter(item => isHrDepartment(item))
    : oversight.filter(item => !filter || item.responsibleDepartmentName === filter)

  useEffect(() => {
    if (status !== 'ready') return
    let live = true
    const authorized = items.filter(item => isHrDepartment(item) || item.hrOversightView === true)
    let next = 0
    setAssignments({})
    async function worker() {
      while (live && next < authorized.length) {
        const item = authorized[next++]
        try {
          const state = await getAssignment(item.id)
          if (live) setAssignments(previous => ({ ...previous, [item.id]: state }))
        } catch {
          if (live) setAssignments(previous => ({ ...previous, [item.id]: null }))
        }
      }
    }
    void Promise.all(Array.from({ length: Math.min(4, authorized.length) }, worker))
    return () => { live = false }
  }, [items, status])

  function handlerLabel(id) {
    const assignment = assignments[id]
    if (assignment === undefined) return 'Loading…'
    if (assignment === null || !Object.hasOwn(assignment, 'handler')) return 'Unavailable'
    if (assignment.handler === null) return 'Unassigned'
    return assignment.handler.name || assignment.handler.email || 'Unavailable'
  }

  if (user?.canAccessHrWorkspace !== true || status === 'denied') return <p role="alert">HR workspace is unavailable for this account.</p>

  function chooseTab(value) {
    setTab(value); setSelected(null); setDetail(null); setDetailError(''); setFilter('')
  }
  function review(id) {
    setDetail(null); setHistory([]); setAcknowledgement(null); setDetailError(''); setDetailLoading(true); setSelected(id)
  }

  return <>
    <PageTitle title="HR Workspace" description="Review authorized HR cases and department oversight." />
    <div role="tablist" aria-label="HR workspace" className="d-flex gap-2 mb-3">
      <button type="button" role="tab" aria-selected={tab === 'cases'} className="btn btn-outline-primary" onClick={() => chooseTab('cases')}>HR Cases</button>
      <button type="button" role="tab" aria-selected={tab === 'oversight'} className="btn btn-outline-primary" onClick={() => chooseTab('oversight')}>Department Oversight</button>
    </div>
    {status === 'loading' && <p role="status">Loading authorized incidents…</p>}
    {status === 'error' && <p role="alert">Authorized incidents are unavailable. Please reload.</p>}
    {status === 'ready' && <section role="tabpanel" aria-label={tab === 'cases' ? 'HR Cases' : 'Department Oversight'}>
      {tab === 'oversight' && <div className="mb-3">
        <label htmlFor="hr-responsible-filter" className="form-label">Responsible Department</label>
        <select id="hr-responsible-filter" className="form-select" value={filter} onChange={event => { setFilter(event.target.value); setSelected(null); setDetail(null) }}>
          <option value="">All authorized departments</option>
          {departments.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>}
      {visible.length === 0 ? <p>No authorized incidents are available in this view.</p> :
        <div className="table-responsive"><table className="table"><thead><tr>
          <th>Incident</th><th>Responsible Department</th><th>Status</th><th>Assigned handler</th><th>Action</th>
        </tr></thead><tbody>{visible.map(item => <tr key={item.id}>
          <td>{item.incidentNumber}</td><td>{item.responsibleDepartmentName || 'Unavailable'}</td><td>{labelize(item.status)}</td>
          <td>{handlerLabel(item.id)}</td><td>
            {tab === 'cases' ? <Link to={`/incidents/${item.id}`}>Open HR case</Link>
              : <button type="button" className="btn btn-link" onClick={() => review(item.id)}>Review oversight</button>}
          </td></tr>)}</tbody></table></div>}
      {tab === 'oversight' && selected != null && <section className="card section-card mt-3" aria-label="Read-only oversight detail">
        <div className="card-body">
          <h2 className="h5">Read-only incident review</h2>
          {detailLoading && <p role="status">Loading incident activity…</p>}
          {detailError && <p role="alert">{detailError}</p>}
          {detail && <>
            <p><strong>Incident:</strong> {detail.incidentNumber}</p>
            <p><strong>Responsible Department:</strong> {detail.responsibleDepartmentName}</p>
            <p><strong>Assigned handler:</strong> {handlerLabel(detail.id)}</p>
            <p><strong>Acknowledgement:</strong> {acknowledgement?.acknowledgedAt
              ? `Recorded ${formatDate(acknowledgement.acknowledgedAt)} by account ${acknowledgement.actorId}`
              : 'Not recorded or unavailable'}</p>
            <IncidentStatusTracker incident={detail} />
            <p><strong>Investigation:</strong> {detail.investigationDetails || 'Not recorded'}</p>
            <p><strong>Resolution:</strong> {detail.resolutionDetails || 'Not recorded'}</p>
            <p><strong>Reporter validation:</strong> {detail.validatedBy || 'Not recorded'}</p>
            <p><strong>Reporter closure:</strong> {detail.closureConfirmedBy || 'Not recorded'}</p>
            <h3 className="h6">Activity history</h3>
            {history.length ? <ul>{history.map((entry, index) => {
              const change = historyChange(entry)
              const remarks = historyRemarks(entry)
              return <li key={entry.id ?? index}>
                {formatDate(entry.changedAt)} — {historyActionLabel(entry.actionType)} — {historyActorLabel(entry.actionType)} {entry.changedBy || 'Unknown'}
                {change && <div style={{ whiteSpace: 'pre-wrap' }}>{change}</div>}
                {remarks && <div>{remarks.label} {remarks.text}</div>}
              </li>
            })}</ul> : <p>No activity history available.</p>}
          </>}
        </div>
      </section>}
    </section>}
  </>
}
