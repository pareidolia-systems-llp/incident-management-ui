import { useEffect, useRef, useState } from 'react'
import ActiveEmployeeEmailSearch from './ActiveEmployeeEmailSearch'
import { getHeadDepartments, getHeadDesignations, getHeadDesignationHistory, updateHeadDesignation } from '../api/employees'
import { departmentAdministrationError } from '../utils/departmentAdministration'

export default function DepartmentHeadManagement() {
  const [authorized, setAuthorized] = useState(false)
  const [departments, setDepartments] = useState([])
  const [designations, setDesignations] = useState([])
  const [selected, setSelected] = useState(null)
  const [department, setDepartment] = useState('')
  const [reason, setReason] = useState('')
  const [active, setActive] = useState(true)
  const [review, setReview] = useState(null)
  const [history, setHistory] = useState(null)
  const [busy, setBusy] = useState(false)
  const mutationInFlight = useRef(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let cancelled = false
    Promise.all([getHeadDepartments(), getHeadDesignations()]).then(([departmentData, designationData]) => {
      if (!cancelled) { setDepartments(departmentData); setDesignations(designationData); setAuthorized(true) }
    }).catch(failure => {
      if (!cancelled) { setDepartments([]); setDesignations([]); setSelected(null); setReview(null); setHistory(null); setAuthorized(false); setError(departmentAdministrationError(failure, 'Department-head designation information')) }
    })
    return () => { cancelled = true }
  }, [revision])
  const current = selected && designations.find(item => item.departmentId === Number(department) && item.userId === selected.id)
  function prepare(event) {
    event.preventDefault();setError('');setNotice('')
    const chosen = departments.find(item => item.id === Number(department))
    if (!selected || !chosen || !reason.trim() || (active && !chosen.active) || (!active && !current?.active) || current?.active === active) {
      setError('Choose an active employee, department, valid action and reason.');return
    }
    setReview({ department: chosen, employee: selected, active, expectedVersion: current?.version ?? null, reason: reason.trim() })
  }
  async function confirm() {
    if (!review || mutationInFlight.current) return
    mutationInFlight.current = true
    setBusy(true);setError('');setNotice('')
    try {
      await updateHeadDesignation(review.department.id, review.employee.id,
        { active: review.active, expectedVersion: review.expectedVersion, reason: review.reason })
      setReview(null);setSelected(null);setReason('');setRevision(value => value + 1);setNotice('Department-head designation saved.')
    } catch (failure) {
      const status = failure.response?.status
      if ([401, 403, 404, 409].includes(status)) { setDesignations([]);setDepartments([]);setSelected(null);setReview(null);setHistory(null);setAuthorized(false) }
      if (status === 409) setRevision(value => value + 1)
      setError(status === 409 ? 'The designation changed. Review the latest information and try again.' : departmentAdministrationError(failure, 'Saving department-head designations'))
    } finally { mutationInFlight.current = false; setBusy(false) }
  }
  async function loadHistory(item) {
    setHistory(null);setError('')
    try {setHistory(await getHeadDesignationHistory(item.departmentId,item.userId))}
    catch (failure) {setDesignations([]);setDepartments([]);setSelected(null);setHistory(null);setAuthorized(false);setError(departmentAdministrationError(failure, 'Designation history'))}
  }
  return <section className="card mb-3" aria-labelledby="headsHeading"><div className="card-body">
    <h2 id="headsHeading" className="h5">Department-head designations</h2>
    <p>Designations record responsibilities only. They do not grant incident access or assign a handler. To replace a head, remove the current designation and designate the replacement. Each change is recorded separately.</p>
    {error && <p className="text-danger" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {authorized && <>
    <h3 className="h6">Current department heads</h3>
    <ul>{designations.map(item => <li key={`${item.departmentId}-${item.userId}`}>
      {item.departmentName}: {item.name} - {item.email} ({item.active ? 'Active' : 'Removed'})
      {item.active && <button type="button" className="btn btn-link" disabled={busy || !!review}
        onClick={() => { setDepartment(String(item.departmentId));setSelected({ id: item.userId, name: item.name, email: item.email });setActive(false);setReason('') }}>Modify designation</button>}
      <button type="button" className="btn btn-link" onClick={() => loadHistory(item)}>View history</button>
    </li>)}</ul>
    {history && <section aria-label="Designation audit history"><h3 className="h6">Designation history</h3>
      <ul>{history.map((entry,index) => <li key={`${entry.version}-${index}`}>{entry.changedAt} - account {entry.actorUserId} - {entry.newActive ? 'Designated' : 'Removed'} - {entry.reason}</li>)}</ul>
    </section>}
    <fieldset disabled={busy || !!review}><ActiveEmployeeEmailSearch onSelect={value => { setSelected(value);setReview(null) }} /></fieldset>
    {selected && <p className="mt-2">Selected: {selected.name} - {selected.email}</p>}
    <form onSubmit={prepare}>
      <label className="form-label" htmlFor="headDepartment">Department</label>
      <select id="headDepartment" className="form-select" value={department} disabled={busy || !!review} onChange={event => setDepartment(event.target.value)}>
        <option value="">Choose a department</option>{departments.map(item => <option key={item.id} value={item.id} disabled={!item.active && active}>{item.name}{item.active ? '' : ' (inactive)'}</option>)}
      </select>
      <label className="form-label mt-2" htmlFor="headAction">Action</label>
      <select id="headAction" className="form-select" value={active ? 'add' : 'remove'} disabled={busy || !!review} onChange={event => setActive(event.target.value === 'add')}>
        <option value="add">Designate as department head</option><option value="remove">Remove designation</option>
      </select>
      <label className="form-label mt-2" htmlFor="headReason">Reason</label>
      <textarea id="headReason" className="form-control" maxLength={500} value={reason} disabled={busy || !!review} onChange={event => setReason(event.target.value)} />
      <button className="btn btn-primary mt-2" type="submit" disabled={busy || !!review}>Review change</button>
    </form>
    {review && <section className="border rounded p-3 mt-3" aria-label="Confirm designation change">
      <p>{review.active ? 'Designate' : 'Remove'} {review.employee.name} - {review.employee.email} {review.active ? 'for' : 'from'} {review.department.name}.</p>
      <p>Reason: {review.reason}</p><button type="button" className="btn btn-primary" disabled={busy} onClick={confirm}>Confirm change</button>
      <button type="button" className="btn btn-secondary ms-2" disabled={busy} onClick={() => setReview(null)}>Cancel</button>
    </section>}
    </>}
  </div></section>
}
