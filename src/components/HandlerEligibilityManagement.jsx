import { useEffect, useState } from 'react'
import ActiveEmployeeEmailSearch from './ActiveEmployeeEmailSearch'
import { getHandlerEligibilityHistory, listHandlerEligibility, updateHandlerEligibility } from '../api/employees'
import { departmentAdministrationError } from '../utils/departmentAdministration'

export default function HandlerEligibilityManagement() {
  const [grants, setGrants] = useState(null)
  const [selected, setSelected] = useState(null)
  const [reason, setReason] = useState('')
  const [active, setActive] = useState(true)
  const [history, setHistory] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let cancelled = false
    listHandlerEligibility().then(items => { if (!cancelled) { setGrants(items); setError('') } })
      .catch(failure => { if (!cancelled) { setGrants(null); setError(departmentAdministrationError(failure, 'Handler eligibility information')) } })
    return () => { cancelled = true }
  }, [revision])
  const grant = grants?.find(item => item.userId === selected?.id)
  async function submit(event) {
    event.preventDefault()
    if (busy || !selected || !reason.trim()) return
    setBusy(true); setError('')
    try {
      await updateHandlerEligibility(selected.id, { active, expectedVersion: grant?.version ?? null, reason: reason.trim() })
      setSelected(null); setReason(''); setHistory(null); setRevision(value => value + 1)
    } catch (failure) {
      setSelected(null); setHistory(null); setGrants(null)
      setError(departmentAdministrationError(failure, 'Saving handler eligibility'))
      if (failure.response?.status === 409) setRevision(value => value + 1)
    }
    finally { setBusy(false) }
  }
  async function showHistory(userId) {
    try { setHistory(await getHandlerEligibilityHistory(userId)) }
    catch (failure) {
      setHistory(null)
      if ([401, 403, 404].includes(failure.response?.status)) { setGrants(null); setSelected(null) }
      setError(departmentAdministrationError(failure, 'Eligibility history'))
    }
  }
  return <section className="card mb-3" aria-labelledby="eligibility-title"><div className="card-body">
    <h2 className="h5" id="eligibility-title">Handler eligibility</h2>
    <p>Eligibility alone does not grant access to incidents.</p>
    {error && <p role="alert">{error}</p>}
    {grants && <>
      <ul>{grants.map(item => <li key={item.userId}>{item.name} — {item.email} ({item.active ? 'Eligible' : 'Not eligible'})
        <button type="button" className="btn btn-link" onClick={() => { setSelected({ id: item.userId, name: item.name, email: item.email }); setActive(!item.active) }}>Select</button>
        <button type="button" className="btn btn-link" onClick={() => showHistory(item.userId)}>View history</button></li>)}</ul>
      {history && <ul aria-label="Eligibility history">{history.map(item => <li key={item.version}>{item.changedAt}: account {item.actorUserId} — {item.newActive ? 'Granted' : 'Revoked'} — {item.reason}</li>)}</ul>}
      <ActiveEmployeeEmailSearch onSelect={setSelected} />
      {selected && <p>Selected: {selected.name} — {selected.email}</p>}
      <form onSubmit={submit}>
        <label htmlFor="eligibility-action">Action</label><select id="eligibility-action" className="form-select" value={active ? 'grant' : 'revoke'} onChange={event => setActive(event.target.value === 'grant')}><option value="grant">Grant eligibility</option><option value="revoke">Revoke eligibility</option></select>
        <label htmlFor="eligibility-reason">Reason</label><textarea id="eligibility-reason" className="form-control" value={reason} maxLength={500} onChange={event => setReason(event.target.value)} />
        <button type="submit" className="btn btn-primary mt-2" disabled={busy || !selected || !reason.trim()}>Save eligibility</button>
      </form>
    </>}
  </div></section>
}
