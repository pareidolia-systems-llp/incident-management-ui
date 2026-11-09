import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import ActiveEmployeeEmailSearch from './ActiveEmployeeEmailSearch'
import { getMembershipDepartments, getDepartmentMemberships, getMembershipHistory, searchMembershipEmployees, updateMembership } from '../api/employees'

export default function DepartmentMembershipManagement() {
  const [departments, setDepartments] = useState(null)
  const [department, setDepartment] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let current = true
    getMembershipDepartments().then(data => { if (current) setDepartments(data) }).catch(() => {})
    return () => { current = false }
  }, [])
  if (!departments) return null
  return <section className="card mb-3" aria-labelledby="membership-heading"><div className="card-body">
    <h2 className="h5" id="membership-heading">Department memberships</h2>
    <p>Membership does not grant incident access, handler eligibility, or department-head status. <Link to="/help#availability">Help with department administration</Link></p>
    <label htmlFor="membership-department">Membership department</label>
    <select id="membership-department" className="form-select mb-3" value={department} disabled={busy} onChange={event => setDepartment(event.target.value)}>
      <option value="">Choose a department</option>
      {departments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
    {department && <MembershipEditor key={department} department={department} busy={busy} setBusy={setBusy} />}
  </div></section>
}

function MembershipEditor({ department, busy, setBusy }) {
  const [members, setMembers] = useState(null)
  const [target, setTarget] = useState(null)
  const [reason, setReason] = useState('')
  const [review, setReview] = useState(null)
  const [history, setHistory] = useState(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const sending = useRef(false)
  useEffect(() => {
    let current = true
    getDepartmentMemberships(department).then(data => { if (current) setMembers(data) }).catch(() => {
      if (current) setError('Membership records are unavailable.')
    })
    return () => { current = false }
  }, [department, revision])
  const current = members?.find(member => member.userId === target?.id)
  function select(employee) {
    setTarget(employee); setReason(''); setHistory(null); setReview(null); setNotice(''); setError('')
  }
  useEffect(() => {
    if (!target || !current) return
    let live = true
    getMembershipHistory(department, target.id).then(data => { if (live) setHistory(data) })
      .catch(() => { if (live) setError('Membership history is unavailable.') })
    return () => { live = false }
  }, [department, target, current])
  async function save() {
    if (sending.current || !review) return
    sending.current = true
    setBusy(true); setError(''); setNotice('')
    try {
      await updateMembership(department, review.userId, review.change)
      select(null)
      setNotice('Department membership saved.')
      setMembers(null); setRevision(value => value + 1)
    } catch (failure) {
      const status = failure.response?.status
      if ([401, 403, 404, 409].includes(status)) {
        select(null); setMembers(null); setRevision(value => value + 1)
      }
      setError(status === 409 ? 'Membership changed. Review the latest information before retrying.' : 'Unable to save membership.')
    } finally { sending.current = false; setBusy(false) }
  }
  return <>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {members && <fieldset disabled={busy || !!review}>
      <ul aria-label="Current membership records">{members.map(member => <li key={member.userId}>
        <button type="button" className="btn btn-link" onClick={() => select({ id: member.userId, name: member.name })}>
          {member.name} · {member.email} ({member.active ? 'Active' : 'Revoked'})
        </button>
      </li>)}</ul>
      <ActiveEmployeeEmailSearch lookup={searchMembershipEmployees} onSelect={select} />
      {target && <form className="mt-3" onSubmit={event => {
        event.preventDefault()
        if (reason.trim()) setReview({ userId: target.id, change: { active: !current?.active, expectedVersion: current?.version ?? 0, reason: reason.trim() } })
      }}>
        <p>Selected: {target.name}</p>
        <label htmlFor="membership-reason">Membership change reason</label>
        <textarea id="membership-reason" className="form-control" value={reason} maxLength={500} onChange={event => setReason(event.target.value)} />
        <button type="submit" className="btn btn-primary mt-2" disabled={!reason.trim()}>
          {current?.active ? 'Review revocation' : 'Review grant'}
        </button>
      </form>}
    </fieldset>}
    {history && <section aria-label="Membership audit history"><h3 className="h6">Membership history</h3>
      <ul>{history.map(entry => <li key={entry.version}>{entry.changedAt} · Account {entry.actorUserId} · {entry.newActive ? 'Granted' : 'Revoked'} · {entry.reason}</li>)}</ul>
    </section>}
    {review && <section className="border rounded p-3 mt-3" aria-label="Confirm membership change">
      <p>{review.change.active ? 'Grant membership to' : 'Revoke membership for'} {target.name}.</p>
      <p>Reason: {review.change.reason}</p>
      <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>Confirm membership change</button>
      <button type="button" className="btn btn-secondary ms-2" disabled={busy} onClick={() => setReview(null)}>Cancel</button>
    </section>}
  </>
}
