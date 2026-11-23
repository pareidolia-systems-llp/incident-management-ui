import { useEffect, useState } from 'react'
import HandlerPicker from './HandlerPicker'
import IncidentDepartmentTransfer from './IncidentDepartmentTransfer'
import { getAssignment, getAssignmentHistory, saveAssignment, acknowledgeAndAssign } from '../api/assignment'

export default function IncidentAssignment({ incidentId, responsibleDepartmentName, onAssigned, onTransferred = onAssigned }) {
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
      {state.canAssign === true && Number.isSafeInteger(state.version) && state.version >= 0 && Number.isSafeInteger(state.classificationVersion) && state.classificationVersion >= 0 ? <AssignmentEditor key={`${incidentId}-${state.version}-${state.classificationVersion}-${revision}`} state={state} initialIt={responsibleDepartmentName === 'IT' && state.version === 0 && !state.handler} onSaved={async () => { setNotice(''); setState(null); setRevision(value => value + 1); await onAssigned?.() }} onStale={message => { setNotice(message); setState(null); setRevision(value => value + 1) }} /> : <p>Assignment is unavailable for this incident. Check its classification, applicable department or service-team rules, and your case permissions.</p>}
      <ul aria-label="Assignment history">{history.map(entry => <li key={entry.version}>{entry.changedAt}: account {entry.actorId} changed handler {entry.previousHandlerId ?? 'none'} → {entry.newHandlerId} — {entry.reason}</li>)}</ul></>}
  </div></section>
  <IncidentDepartmentTransfer incidentId={incidentId} onRefresh={() => {
    setState(null)
    setRevision(value => value + 1)
    onTransferred?.()
  }} />
  </>
}

function AssignmentEditor({ state, initialIt, onSaved, onStale }) {
  const [handler, setHandler] = useState(null)
  const [mode, setMode] = useState('another')
  const self = initialIt && Number.isSafeInteger(state.selfCandidate?.id) && state.selfCandidate.id > 0 ? state.selfCandidate : null
  const initialAssignment = state.version === 0 && !state.handler
  const selectedHandler = mode === 'self' ? self : handler
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault()
    if (state.canAssign !== true || !Number.isSafeInteger(selectedHandler?.id) || selectedHandler.id <= 0 || selectedHandler.id === state.handler?.id || !reason.trim() || !confirmed || busy) return
    setBusy(true); setError('')
    try {
      const payload = { handlerUserId: selectedHandler.id, expectedVersion: state.version, expectedClassificationVersion: state.classificationVersion, reason: reason.trim() }
      if (initialAssignment) await acknowledgeAndAssign(state.incidentId, payload)
      else await saveAssignment(state.incidentId, payload)
      await onSaved?.()
    } catch (failure) {
      setConfirmed(false); setHandler(null)
      const message = failure.response?.status === 409 ? 'The incident changed. Reload and confirm the new assignment.' : 'Assignment was not saved. Check current access, eligibility and scope, then reload.'
      setError(message)
      if (failure.response?.status === 409 || [403, 404].includes(failure.response?.status)) onStale?.(message)
    } finally { setBusy(false) }
  }
  return <form onSubmit={submit} aria-label={state.handler ? 'Reassign incident' : 'Assign incident'}>
    <h3 className="h6">{state.handler ? 'Reassign Incident' : initialAssignment ? 'Acknowledge and assign eligible handler' : 'Assign eligible handler'}</h3>
    {self && <fieldset className="mb-3"><legend className="fs-6">Choose assignment</legend>
      <label className="d-block"><input type="radio" name="assignmentMode" value="self" checked={mode === 'self'} disabled={busy} onChange={() => { setMode('self'); setHandler(null); setConfirmed(false) }} /> Assign to Myself</label>
      <label className="d-block"><input type="radio" name="assignmentMode" value="another" checked={mode === 'another'} disabled={busy} onChange={() => { setMode('another'); setHandler(null); setConfirmed(false) }} /> Assign to Another Employee</label>
      {mode === 'self' && <p>Authenticated IT Head: {self.name} — {self.email}</p>}
    </fieldset>}
    {(!self || mode === 'another') && <HandlerPicker candidates={initialIt || state.caseSpecificCandidates === true} incidentId={state.incidentId} value={handler} disabled={busy} onChange={employee => { setHandler(employee); setConfirmed(false) }} />}
    <label className="form-label">Assignment reason<textarea className="form-control" maxLength={500} required disabled={busy} value={reason} onChange={event => { setReason(event.target.value); setConfirmed(false) }} /></label>
    <label className="d-block my-2"><input type="checkbox" checked={confirmed} disabled={busy || !selectedHandler} onChange={event => setConfirmed(event.target.checked)} /> Confirm assignment to {selectedHandler?.email || 'the selected handler'}</label>
    {error && <p role="alert">{error}</p>}
    <button className="btn btn-primary" disabled={busy || !selectedHandler || selectedHandler.id === state.handler?.id || !reason.trim() || !confirmed}>{busy ? 'Saving…' : state.handler ? 'Reassign Incident' : initialAssignment ? 'Acknowledge and assign' : 'Confirm assignment'}</button>
  </form>
}
