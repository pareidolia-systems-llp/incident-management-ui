import { useEffect, useState } from 'react'
import HandlerPicker from './HandlerPicker'
import IncidentDepartmentTransfer from './IncidentDepartmentTransfer'
import { getAssignment, getAssignmentHistory, saveAssignment } from '../api/assignment'

export default function IncidentAssignment({ incidentId, onAssigned, onTransferred = onAssigned }) {
  const [state, setState] = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let cancelled = false
    Promise.all([getAssignment(incidentId), getAssignmentHistory(incidentId)]).then(([data, entries]) => { if (!cancelled) { setState(data?.incidentId && Array.isArray(entries) ? data : null); setHistory(Array.isArray(entries) ? entries : []); setError('') } }).catch(() => { if (!cancelled) { setState(null); setHistory([]); setError('Assignment is unavailable. Check your access or reload.') } })
    return () => { cancelled = true }
  }, [incidentId, revision])
  return <><section className="card section-card mb-3" aria-label="Employee assignment"><div className="card-body">
    <h2 className="h5">Employee assignment</h2>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="alert">{notice}</p>}
    <button type="button" className="btn btn-link" onClick={() => { setState(null); setRevision(value => value + 1) }}>Refresh assignment</button>
    {state && <><p>Classification: {state.classification}</p><p>Current handler: {state.handler ? `${state.handler.name} — ${state.handler.email}` : 'Not assigned'}</p><p>Proposed handler: {state.proposal ? `${state.proposal.name} — ${state.proposal.email}` : 'None'}</p>
      {state.canAssign === true && Number.isSafeInteger(state.version) && state.version >= 0 && Number.isSafeInteger(state.classificationVersion) && state.classificationVersion >= 0 ? <AssignmentEditor key={`${incidentId}-${state.version}-${state.classificationVersion}-${revision}`} state={state} onSaved={async () => { setNotice(''); setState(null); setRevision(value => value + 1); await onAssigned?.() }} onStale={message => { setNotice(message); setState(null); setRevision(value => value + 1) }} /> : <p>Assignment is unavailable for this incident. Check its trusted classification, active responsible department, and your assignment and case permissions.</p>}
      <ul aria-label="Assignment history">{history.map(entry => <li key={entry.version}>{entry.changedAt}: account {entry.actorId} changed handler {entry.previousHandlerId ?? 'none'} → {entry.newHandlerId} — {entry.reason}</li>)}</ul></>}
  </div></section>
  <IncidentDepartmentTransfer incidentId={incidentId} onRefresh={() => {
    setState(null)
    setRevision(value => value + 1)
    onTransferred?.()
  }} />
  </>
}

function AssignmentEditor({ state, onSaved, onStale }) {
  const [handler, setHandler] = useState(null)
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    if (state.canAssign !== true || !Number.isSafeInteger(handler?.id) || handler.id <= 0 || handler.id === state.handler?.id || !reason.trim() || !confirmed || busy) return
    setBusy(true); setError('')
    try {
      await saveAssignment(state.incidentId, { handlerUserId: handler.id, expectedVersion: state.version, expectedClassificationVersion: state.classificationVersion, reason: reason.trim() })
      await onSaved?.()
    } catch (failure) {
      setConfirmed(false); setHandler(null)
      const message = failure.response?.status === 409 ? 'The incident changed. Reload and confirm the new assignment.' : 'Assignment was not saved. Check current access, eligibility and scope, then reload.'
      setError(message)
      if (failure.response?.status === 409 || [403, 404].includes(failure.response?.status)) onStale?.(message)
    } finally { setBusy(false) }
  }
  return <form onSubmit={submit} aria-label={state.handler ? 'Reassign incident' : 'Assign incident'}>
    <h3 className="h6">{state.handler ? 'Reassign Incident' : 'Assign eligible handler'}</h3>
    <HandlerPicker incidentId={state.incidentId} value={handler} disabled={busy} onChange={employee => { setHandler(employee); setConfirmed(false) }} />
    <label className="form-label">Assignment reason<textarea className="form-control" maxLength={500} required disabled={busy} value={reason} onChange={event => { setReason(event.target.value); setConfirmed(false) }} /></label>
    <label className="d-block my-2"><input type="checkbox" checked={confirmed} disabled={busy || !handler} onChange={event => setConfirmed(event.target.checked)} /> Confirm assignment to {handler?.email || 'the selected handler'}</label>
    {error && <p role="alert">{error}</p>}
    <button className="btn btn-primary" disabled={busy || !handler || handler.id === state.handler?.id || !reason.trim() || !confirmed}>{busy ? 'Saving…' : state.handler ? 'Reassign Incident' : 'Confirm assignment'}</button>
  </form>
}
