import { useEffect, useRef, useState } from 'react'
import { employeeAssignmentEnabled, getTransferOptions, searchTransferHandlers, transferIncident } from '../api/assignment'

const validId = id => Number.isSafeInteger(id) && id > 0
const validVersion = version => Number.isSafeInteger(version) && version >= 0
const approvalPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/

function sameState(expected, actual) {
  return actual?.incidentId === expected.incidentId
    && actual.sourceDepartmentId === expected.sourceDepartmentId
    && actual.assignmentVersion === expected.assignmentVersion
    && actual.classificationVersion === expected.classificationVersion
}

export default function IncidentDepartmentTransfer({ incidentId, onRefresh }) {
  if (!employeeAssignmentEnabled()) return null
  return <TransferDiscovery key={incidentId} incidentId={incidentId} onRefresh={onRefresh} />
}

function TransferDiscovery({ incidentId, onRefresh }) {
  const [options, setOptions] = useState(null)
  const [revision, setRevision] = useState(0)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    let cancelled = false
    getTransferOptions(incidentId).then(data => {
      if (cancelled) return
      const state = data?.state
      if (!validId(state?.incidentId) || state.incidentId !== Number(incidentId)
          || !validId(state.sourceDepartmentId) || !validVersion(state.assignmentVersion)
          || !validVersion(state.classificationVersion) || !Array.isArray(data.destinations)) return
      const destinations = data.destinations.filter(department => validId(department?.departmentId)
        && department.departmentId !== state.sourceDepartmentId
        && typeof department.displayName === 'string' && department.displayName.trim())
      if (destinations.length) setOptions({ state, destinations })
    }).catch(() => {
      // A disabled or denied endpoint must not reveal transfer controls.
      if (!cancelled) setOptions(null)
    })
    return () => { cancelled = true }
  }, [incidentId, revision])

  function reload(message, { refresh = false, success = false } = {}) {
    setFeedback({ message, success })
    setOptions(null)
    setRevision(value => value + 1)
    if (refresh) onRefresh?.()
  }

  if (!options && !feedback) return null
  return <section className="card section-card mb-3" aria-label="Transfer Department">
    <div className="card-body">
      {feedback && <p role={feedback.success ? 'status' : 'alert'}>{feedback.message}</p>}
      {options && <>
        <h2 className="h5">Transfer Department</h2>
        <TransferForm options={options} reload={reload} />
      </>}
    </div>
  </section>
}

function TransferForm({ options, reload }) {
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
  const canReview = Boolean(destination && handler && reason.trim() && reason.length <= 500 && approvalPattern.test(reference.trim()))

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
      await transferIncident(state.incidentId, {
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
      <input className="form-control" maxLength={100} required value={reference} onChange={event => setReference(event.target.value)} />
    </label>
    <p className="small text-secondary">Enter the reference supplied by the independent access review. The reference is recorded with the transfer.</p>
    <button className="btn btn-primary" disabled={!canReview}>Review transfer</button>
  </form>
}
