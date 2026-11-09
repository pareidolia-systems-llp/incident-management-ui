import { useEffect, useState } from 'react'
import PageTitle from '../components/PageTitle'
import IncidentAssignment from '../components/IncidentAssignment'
import { getAssignmentTriage, getTriageDetail } from '../api/assignment'

export default function AssignmentTriage() {
  const [queue, setQueue] = useState(null)
  const [selected, setSelected] = useState('')
  const [lookup, setLookup] = useState('')
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getAssignmentTriage().then(data => {
      if (!cancelled && Array.isArray(data)) setQueue(data)
      else if (!cancelled) setError('Assignment triage is unavailable.')
    }).catch(() => {
      if (!cancelled) {
        setQueue(null)
        setError('Assignment triage is unavailable or your account does not have access.')
      }
    })
    return () => { cancelled = true }
  }, [revision])

  return <>
    <PageTitle title="Incident triage and assignment" />
    {error && <p role="alert">{error}</p>}
    {queue === null && !error && <p role="status">Checking assignment access…</p>}
    {queue && <>
      {queue.length === 0 && <p>No incidents in your authorized queue.</p>}
      <label htmlFor="assignment-triage">Recent authorized incidents</label>
      <select id="assignment-triage" className="form-select mb-3" value={selected} onChange={event => setSelected(event.target.value)}>
        <option value="">Select incident</option>
        {queue.map(item => <option key={item.incidentId} value={item.incidentId}>{item.incidentNumber} — {item.classification}</option>)}
      </select>
      <form onSubmit={event => { event.preventDefault(); if (/^[1-9]\d*$/.test(lookup)) setSelected(lookup) }}>
        <label htmlFor="triage-lookup">Or find incident by ID</label>
        <input id="triage-lookup" className="form-control" value={lookup} onChange={event => setLookup(event.target.value)} inputMode="numeric" />
        <button className="btn btn-outline-primary my-2" disabled={!/^[1-9]\d*$/.test(lookup)}>Load triage incident</button>
      </form>
      {selected && <TriageCase key={selected} id={selected} onChanged={() => setRevision(value => value + 1)} />}
    </>}
  </>
}

function TriageCase({ id, onChanged }) {
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let cancelled = false
    getTriageDetail(id).then(data => {
      if (!cancelled && data?.incident && data?.assignment) setDetail(data)
      else if (!cancelled) setError('This incident is unavailable for triage.')
    }).catch(() => {
      if (!cancelled) setError('This incident is unavailable for triage.')
    })
    return () => { cancelled = true }
  }, [id])

  if (error) return <p role="alert">{error}</p>
  if (!detail) return <p role="status">Loading incident…</p>
  return <section className="mt-3">
    <h2 className="h5">{detail.incident.incidentNumber}: {detail.incident.title}</h2>
    <p className="text-break">{detail.incident.description}</p>
    {detail.assignment.classification === 'UNCLASSIFIED'
      ? <p>Unclassified. An authorized classifier must set a trusted classification in Incident security before assignment.</p>
      : <IncidentAssignment incidentId={id} onAssigned={onChanged} />}
  </section>
}
