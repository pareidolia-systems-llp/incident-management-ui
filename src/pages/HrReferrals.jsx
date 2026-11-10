import { useEffect, useRef, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { decideHrReferral, getHrReferral, getPendingHrReferrals, submitHrReferral } from '../api/hrReferrals'
import HandlerPicker from '../components/HandlerPicker'
import IncidentDepartmentTransfer from '../components/IncidentDepartmentTransfer'
import PageTitle from '../components/PageTitle'

export function ReferralIntake() {
  const navigation = useOutletContext()
  const field = useRef(null)
  const submitting = useRef(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  async function submit(event) {
    event.preventDefault()
    if (submitting.current || !field.current.value.trim()) return
    const reference = field.current.value.trim()
    field.current.value = ''
    submitting.current = true
    setBusy(true)
    setNotice(null)
    try {
      await submitHrReferral(reference)
      setNotice({ accepted: true, text: 'Submission accepted for processing. An authorized HR reviewer may need to act.' })
    } catch (failure) {
      const status = failure.response?.status
      setNotice({ text: status === 403 ? 'You do not have referral submission permission. Ask your portal administrator to check your coordinator access.'
        : status === 429 ? 'You have reached the submission limit. Try again later.'
          : 'We could not confirm submission. Check your connection and try again later.' })
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  if (!navigation) return <p role="status">Checking referral availability…</p>
  if (!navigation.referralIntake) return <p role="alert">This page is unavailable for your account.</p>
  return <>
    <PageTitle title="Submit a reassignment referral" />
    <p>Use the exact incident reference shared through your approved channel. Enter the reference only.</p>
    <form className="card section-card p-3" onSubmit={submit} autoComplete="off">
      <label className="form-label" htmlFor="referral-reference">Incident reference</label>
      <input id="referral-reference" ref={field} className="form-control mb-3" autoComplete="off" spellCheck={false} maxLength={40} required disabled={busy} />
      <div><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit referral'}</button></div>
    </form>
    {notice && <p className="mt-3" role={notice.accepted ? 'status' : 'alert'}>{notice.text}</p>}
  </>
}

function unavailable(failure) {
  const status = failure.response?.status
  if (status === 403) return 'You do not have access to this referral workflow. Ask the HR access administrator to check your permissions.'
  if (status === 404) return 'This referral is unavailable. It may have expired or your access may have changed.'
  if (status === 409) return 'The decision could not be saved. The referral may have changed, or case access or handoff approval may need review. Open the current referral before trying again.'
  return 'We could not confirm the request. Refresh the list before trying again.'
}

const outcomes = { REJECTED: 'Rejected', REASSIGNED: 'Reassigned', TRANSFERRED: 'Transferred' }

export default function HrReferrals() {
  const [pending, setPending] = useState(null)
  const [selection, setSelection] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [revision, setRevision] = useState(0)
  const request = useRef(0)

  useEffect(() => {
    let active = true
    getPendingHrReferrals().then(ids => { if (active) setPending(ids) })
      .catch(failure => { if (active) { setPending([]); setFeedback({ error: unavailable(failure) }) } })
    return () => { active = false; request.current += 1 }
  }, [revision])

  function refresh(message = null) {
    request.current += 1
    setSelection(null)
    setPending(null)
    setFeedback(message)
    setRevision(value => value + 1)
  }

  async function open(id) {
    const current = ++request.current
    setFeedback(null)
    setSelection({ id })
    try {
      const review = await getHrReferral(id)
      if (current === request.current) setSelection({ id, review })
    } catch (failure) {
      if (current === request.current) refresh({ error: unavailable(failure) })
    }
  }

  async function decide(id, payload) {
    const current = request.current
    try {
      await decideHrReferral(id, payload)
      if (current === request.current) refresh({ text: 'Referral decision recorded.' })
    } catch (failure) {
      if (current === request.current) refresh({ error: unavailable(failure) })
      throw failure
    }
  }

  return <>
    <PageTitle title="HR pending referrals" />
    {feedback && <p role={feedback.error ? 'alert' : 'status'}>{feedback.error || feedback.text}</p>}
    <button type="button" className="btn btn-outline-secondary mb-3" onClick={() => refresh()}>Refresh pending referrals</button>
    {!pending && <p role="status">Checking for pending referrals…</p>}
    {pending?.length === 0 && !feedback?.error && <p>No pending referrals are available.</p>}
    {pending?.length > 0 && <ul className="list-unstyled" aria-label="Pending referrals">
      {pending.map(id => <li key={id}><button type="button" className="btn btn-link text-break text-start" onClick={() => open(id)}>Review {id}</button></li>)}
    </ul>}
    {selection && !selection.review && <p role="status">Checking referral access…</p>}
    {selection?.review && <ReferralReview key={selection.id} review={selection.review} decide={payload => decide(selection.id, payload)} />}
  </>
}

function ReferralReview({ review, decide }) {
  const [action, setAction] = useState('')
  const [handler, setHandler] = useState(null)
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)

  async function submit(event) {
    event.preventDefault()
    if (submitting.current || !confirmed || !reason.trim() || (action === 'REASSIGNED' && !handler)) return
    submitting.current = true
    setBusy(true)
    try {
      await decide({
        outcome: action,
        reason: reason.trim(),
        ...(action === 'REASSIGNED' && { reassignment: {
          handlerUserId: handler.id,
          expectedVersion: review.assignmentVersion,
          expectedClassificationVersion: review.classificationVersion,
        } }),
      })
    } catch { /* The pending view shows a safe message and reloads the list. */ }
    finally { submitting.current = false; setBusy(false) }
  }

  return <section className="card section-card p-3" aria-labelledby="referral-review-title">
    <h2 className="h5" id="referral-review-title">Referral review</h2>
    <p><Link to={'/incidents/' + review.incidentId}>Open the incident for review</Link></p>
    {review.outcome ? <p>Decision recorded: {outcomes[review.outcome]}.</p> : <>
      <p>Before reassigning, have the former handler’s case access reviewed and reconciled. A transfer also needs separate handoff approval.</p>
      <label className="form-label">Decision
        <select className="form-select" value={action} disabled={busy} onChange={event => {
          setAction(event.target.value); setHandler(null); setReason(''); setConfirmed(false)
        }}>
          <option value="">Choose a decision</option>
          <option value="REJECTED">Reject referral</option>
          <option value="REASSIGNED">Approve and reassign</option>
          <option value="TRANSFERRED">Approve and transfer</option>
        </select>
      </label>
      {(action === 'REJECTED' || action === 'REASSIGNED') && <form onSubmit={submit} aria-label="Record referral decision">
        {action === 'REASSIGNED' && <HandlerPicker incidentId={review.incidentId} disabled={busy} value={handler} onChange={value => { setHandler(value); setConfirmed(false) }} />}
        <label className="form-label">Decision reason<textarea className="form-control" required maxLength={500} disabled={busy} value={reason} onChange={event => {
          setReason(event.target.value); setConfirmed(false)
        }} /></label>
        <label className="d-block mb-3"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /> Confirm this decision</label>
        <button className="btn btn-primary" disabled={busy || !confirmed || !reason.trim() || (action === 'REASSIGNED' && !handler)}>
          {busy ? 'Saving…' : action === 'REJECTED' ? 'Reject referral' : 'Confirm reassignment'}
        </button>
      </form>}
      {action === 'TRANSFERRED' && <IncidentDepartmentTransfer incidentId={review.incidentId} expectedState={review}
        executeTransfer={(_, transfer) => decide({ outcome: 'TRANSFERRED', reason: transfer.reason, transfer })} />}
    </>}
  </section>
}
