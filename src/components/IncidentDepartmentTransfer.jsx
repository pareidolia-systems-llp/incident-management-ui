import { useEffect, useRef, useState } from 'react'
import { employeeAssignmentEnabled, getTransferOptions, searchTransferHandlers, transferIncident, getTransferHandoffs, requestTransferHandoff, decideTransferHandoff, getTransferHandoffHistory } from '../api/assignment'

const validId = id => Number.isSafeInteger(id) && id > 0
const validVersion = version => Number.isSafeInteger(version) && version >= 0
const approvalPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/

function sameState(expected, actual) {
  return actual?.incidentId === expected.incidentId
    && actual.sourceDepartmentId === expected.sourceDepartmentId
    && actual.assignmentVersion === expected.assignmentVersion
    && actual.classificationVersion === expected.classificationVersion
}

export default function IncidentDepartmentTransfer({ incidentId, onRefresh, expectedState, executeTransfer = transferIncident }) {
  if (!employeeAssignmentEnabled()) return null
  return <TransferDiscovery key={incidentId} incidentId={incidentId} onRefresh={onRefresh}
    expectedState={expectedState} executeTransfer={executeTransfer} />
}

function TransferDiscovery({ incidentId, onRefresh, expectedState, executeTransfer }) {
  const [options, setOptions] = useState(null)
  const [revision, setRevision] = useState(0)
  const [feedback, setFeedback] = useState(null)
  const [handoffs, setHandoffs] = useState(null)
  const [handoffRevision, setHandoffRevision] = useState(0)
  useEffect(() => {
    let current = true
    getTransferHandoffs(incidentId).then(data => { if (current) setHandoffs(data) })
      .catch(() => { if (current) setHandoffs(null) })
    return () => { current = false }
  }, [incidentId, handoffRevision])
  function reloadHandoffs() {
    setHandoffs(null)
    setHandoffRevision(value => value + 1)
  }

  useEffect(() => {
    let cancelled = false
    getTransferOptions(incidentId).then(data => {
      if (cancelled) return
      const state = data?.state
      if (!validId(state?.incidentId) || state.incidentId !== Number(incidentId)
          || !validId(state.sourceDepartmentId) || !validVersion(state.assignmentVersion)
          || !validVersion(state.classificationVersion) || !Array.isArray(data.destinations)) return
      if (expectedState && (state.assignmentVersion !== expectedState.assignmentVersion
          || state.classificationVersion !== expectedState.classificationVersion)) {
        setFeedback({ message: 'The incident changed. Refresh pending referrals and open it again.', stale: true })
        return
      }
      const destinations = data.destinations.filter(department => validId(department?.departmentId)
        && department.departmentId !== state.sourceDepartmentId
        && typeof department.displayName === 'string' && department.displayName.trim())
      if (destinations.length) setOptions({ state, destinations })
      else if (expectedState) setFeedback({ message: 'No authorized transfer route is available for this referral.' })
    }).catch(() => {
      // A disabled or denied endpoint must not reveal transfer controls.
      if (!cancelled) {
        setOptions(null)
        if (expectedState) setFeedback({ message: 'Transfer options are unavailable for this referral. Refresh and check your access.' })
      }
    })
    return () => { cancelled = true }
  }, [incidentId, revision, expectedState])

  function reload(message, { refresh = false, success = false } = {}) {
    setFeedback({ message, success })
    setOptions(null)
    setRevision(value => value + 1)
    if (refresh) { reloadHandoffs(); onRefresh?.() }
  }

  if (!options && !feedback && !handoffs?.length) return null
  return <section className="card section-card mb-3" aria-label="Transfer Department">
    <div className="card-body">
      {feedback && <p role={feedback.success ? 'status' : 'alert'}>{feedback.message}</p>}
      {options && <>
        <h2 className="h5">Transfer Department</h2>
        <TransferForm options={options} reload={reload} handoffs={handoffs} onHandoffChanged={reloadHandoffs} executeTransfer={executeTransfer} />
      </>}
      {!feedback?.stale && handoffs?.length > 0 && <HandoffReview key={handoffRevision} incidentId={incidentId} handoffs={handoffs} refresh={reloadHandoffs} />}
    </div>
  </section>
}

function TransferForm({ options, reload, handoffs, onHandoffChanged, executeTransfer }) {
  const { state, destinations } = options
  const [destinationId, setDestinationId] = useState('')
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState([])
  const [handlerId, setHandlerId] = useState('')
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')
  const [reason, setReason] = useState('')
  const [reference, setReference] = useState('')
  const [review, setReview] = useState(false)
  const [saving, setSaving] = useState(false)
  const sequence = useRef(0)
  const pending = useRef(false)
  useEffect(() => () => { sequence.current += 1 }, [])

  const destination = destinations.find(item => String(item.departmentId) === destinationId)
  const handler = matches.find(item => String(item.id) === handlerId)
  const matching = (handoffs ?? []).filter(item => item.sourceDepartmentId === state.sourceDepartmentId
    && item.destinationDepartmentId === destination?.departmentId && item.handlerId === handler?.id
    && item.assignmentVersion === state.assignmentVersion && item.classificationVersion === state.classificationVersion)
  const approved = matching.filter(item => item.canUse === true && item.status === 'APPROVED' && approvalPattern.test(item.reference))
  const hasSelection = Boolean(destination && handler && reason.trim() && reason.length <= 500)
  const canReview = hasSelection && approved.some(item => item.reference === reference)
  const [requestNotice, setRequestNotice] = useState('')
  async function requestApproval() {
    if (!hasSelection || !handoffs || pending.current) return
    pending.current = true
    setSaving(true); setRequestNotice('')
    try {
      await requestTransferHandoff(state.incidentId, {
        expectedSourceDepartmentId: state.sourceDepartmentId,
        destinationDepartmentId: destination.departmentId,
        destinationHandlerUserId: handler.id,
        expectedVersion: state.assignmentVersion,
        expectedClassificationVersion: state.classificationVersion,
        reason: reason.trim(),
      })
      onHandoffChanged()
      setRequestNotice('Handoff approval requested.')
    } catch { setRequestNotice('Unable to request handoff. Check the current incident and try again.') }
    finally { pending.current = false; setSaving(false) }
  }

  function clearSearch() {
    sequence.current += 1
    setMatches([])
    setHandlerId('')
    setSearching(false)
    setSearched(false)
    setError('')
  }

  async function search() {
    if (!destination || searching || query.trim().length < 2 || query.length > 255) return
    clearSearch()
    const request = sequence.current
    setSearching(true)
    try {
      const data = await searchTransferHandlers(state.incidentId, destination.departmentId, query.trim())
      if (request !== sequence.current) return
      if (!sameState(state, data?.state) || data.destinationDepartmentId !== destination.departmentId) {
        reload('The incident changed. Choose a destination and handler again.', { refresh: true })
        return
      }
      if (Array.isArray(data.handlers)) {
        setMatches(data.handlers.filter(item => validId(item?.id)
          && typeof item.name === 'string' && item.name.trim()
          && typeof item.email === 'string' && item.email.trim()).slice(0, 10))
      }
      setSearched(true)
    } catch (failure) {
      if (request !== sequence.current) return
      if ([401, 403, 404, 409].includes(failure.response?.status)) {
        reload('Handler selection is no longer available. Review the current transfer options.', { refresh: true })
      } else {
        setError('Handler search is unavailable. Please try again.')
      }
    } finally {
      if (request === sequence.current) setSearching(false)
    }
  }

  async function submit() {
    if (!review || !canReview || pending.current) return
    pending.current = true
    const request = sequence.current
    setSaving(true)
    try {
      await executeTransfer(state.incidentId, {
        expectedSourceDepartmentId: state.sourceDepartmentId,
        destinationDepartmentId: destination.departmentId,
        destinationHandlerUserId: handler.id,
        expectedVersion: state.assignmentVersion,
        expectedClassificationVersion: state.classificationVersion,
        reason: reason.trim(),
        handoffApprovalReference: reference.trim(),
      })
    } catch (failure) {
      if (request !== sequence.current) return
      const message = failure.response?.status === 409
        ? 'Transfer was blocked because the incident changed or access handoff requires independent review. Review the current options before trying again.'
        : 'Transfer could not be confirmed. Review the current incident and options before trying again.'
      reload(message, { refresh: true })
      return
    }
    if (request === sequence.current) reload('Department transfer completed.', { refresh: true, success: true })
  }

  if (review && canReview) return <section aria-label="Review department transfer">
    <h3 className="h6">Review department transfer</h3>
    <dl>
      <dt>Source department</dt><dd>Department #{state.sourceDepartmentId}</dd>
      <dt>Destination department</dt><dd>{destination.displayName} (#{destination.departmentId})</dd>
      <dt>Selected handler</dt><dd>{handler.name} — {handler.email}</dd>
      <dt>Transfer reason</dt><dd className="text-break">{reason.trim()}</dd>
      <dt>Handoff approval reference</dt><dd className="text-break">{reference.trim()}</dd>
    </dl>
    <button type="button" className="btn btn-primary me-2" disabled={saving} onClick={submit}>{saving ? 'Transferring…' : 'Confirm transfer'}</button>
    <button type="button" className="btn btn-outline-secondary" disabled={saving} onClick={() => setReview(false)}>Back to transfer</button>
  </section>

  return <form aria-label="Department transfer" onSubmit={event => { event.preventDefault(); if (canReview) setReview(true) }}>
    <label className="form-label">Destination department
      <select className="form-select" value={destinationId} onChange={event => {
        setDestinationId(event.target.value); setQuery(''); clearSearch()
      }} required>
        <option value="">Choose an authorized department</option>
        {destinations.map(item => <option key={item.departmentId} value={item.departmentId}>{item.displayName}</option>)}
      </select>
    </label>
    {destination && <div className="mb-3">
      <label className="form-label">Search destination handlers
        <input className="form-control" maxLength={255} value={query} onChange={event => { setQuery(event.target.value); clearSearch() }} />
      </label>
      <button type="button" className="btn btn-outline-primary ms-2" disabled={searching || query.trim().length < 2} onClick={search}>
        {searching ? 'Searching…' : 'Search destination'}
      </button>
      {error && <p role="alert">{error}</p>}
      {searched && matches.length === 0 && <p role="status">No eligible destination handlers found.</p>}
      {matches.length > 0 && <label className="form-label d-block">Destination handler
        <select className="form-select" value={handlerId} required onChange={event => {
          const id = event.target.value
          setHandlerId(matches.some(item => String(item.id) === id) ? id : '')
        }}>
          <option value="">Choose an eligible handler</option>
          {matches.map(item => <option key={item.id} value={item.id}>{item.name} — {item.email}</option>)}
        </select>
      </label>}
    </div>}
    <label className="form-label d-block">Transfer reason
      <textarea className="form-control" maxLength={500} required value={reason} onChange={event => setReason(event.target.value)} />
    </label>
    <label className="form-label d-block">Handoff approval reference
      <select className="form-select" value={reference} onChange={event => setReference(event.target.value)}>
        <option value="">Choose an approved handoff</option>
        {approved.map(item => <option key={item.reference} value={item.reference}>{item.reference}</option>)}
      </select>
    </label>
    <p className="small text-secondary">Only approved handoffs for this route, handler and current incident version can be used.</p>
    {handoffs && !matching.some(item => item.status === 'PENDING' || item.status === 'APPROVED') &&
      <button type="button" className="btn btn-outline-primary me-2" disabled={!hasSelection || saving} onClick={requestApproval}>Request handoff approval</button>}
    {requestNotice && <p role="status">{requestNotice}</p>}
    <button className="btn btn-primary" disabled={!canReview}>Review transfer</button>
  </form>
}

function HandoffReview({ incidentId, handoffs, refresh }) {
  const [reference, setReference] = useState('')
  const [reason, setReason] = useState('')
  const [history, setHistory] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const selected = handoffs.find(item => item.reference === reference)
  useEffect(() => {
    if (!reference) return
    let current = true
    getTransferHandoffHistory(incidentId, reference).then(data => { if (current) setHistory(data) })
      .catch(() => { if (current) setError('Handoff history is unavailable.') })
    return () => { current = false }
  }, [incidentId, reference])
  async function decide(action) {
    if (!selected || !reason.trim() || pending.current) return
    pending.current = true
    setBusy(true); setError('')
    try {
      await decideTransferHandoff(incidentId, selected.reference, { action, expectedVersion: selected.version, reason: reason.trim() })
      refresh()
    } catch (failure) {
      if (failure.response?.status === 409) refresh()
      else setError('The handoff decision could not be saved.')
    } finally { pending.current = false; setBusy(false) }
  }
  return <section className="mt-3" aria-label="Transfer handoffs">
    <h3 className="h6">Transfer handoffs</h3>
    <label className="form-label">Handoff record
      <select className="form-select" disabled={busy} value={reference} onChange={event => {
        setReference(event.target.value); setHistory(null); setReason(''); setError('')
      }}>
        <option value="">Choose a handoff record</option>
        {handoffs.map(item => <option key={item.reference} value={item.reference}>{item.status} · Department {item.sourceDepartmentId} to {item.destinationDepartmentId} · {item.reference}</option>)}
      </select>
    </label>
    {error && <p role="alert">{error}</p>}
    {selected && <><p>Coordinator #{selected.coordinatorId} · Destination handler #{selected.handlerId}</p>
      <p>Request reason: {selected.requestReason}</p>
      {history && <ul aria-label="Handoff audit history">{history.map(entry => <li key={entry.version}>{entry.changedAt} · Account {entry.actorId} · {entry.status} · {entry.reason}</li>)}</ul>}
      {(selected.canReview || selected.canRevoke) && <><label className="form-label d-block">Handoff decision reason
        <textarea className="form-control" maxLength={500} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} />
      </label>
      {selected.canReview && <><button type="button" className="btn btn-primary me-2" disabled={busy || !reason.trim()} onClick={() => decide('APPROVED')}>Approve handoff</button>
        <button type="button" className="btn btn-outline-danger me-2" disabled={busy || !reason.trim()} onClick={() => decide('REJECTED')}>Reject handoff</button></>}
      {selected.canRevoke && <button type="button" className="btn btn-outline-danger" disabled={busy || !reason.trim()} onClick={() => decide('REVOKED')}>Revoke handoff</button>}
      </>}
    </>}
  </section>
}
