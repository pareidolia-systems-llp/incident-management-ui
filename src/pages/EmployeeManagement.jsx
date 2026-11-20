import { useEffect, useRef, useState } from 'react'
import EmployeeSearch from '../components/EmployeeSearch'
import useAuth from '../auth/useAuth'
import { createEmployee, listEmployees, updateEmployee, previewEmployee } from '../api/employees'
import { getErrorMessage } from '../utils/incident'

function employeeError(error, fallback) {
  if ([400, 409].includes(error.response?.status) && typeof error.response.data?.message === 'string') return error.response.data.message
  if (error.response?.status === 404) return 'Employee record no longer exists.'
  return getErrorMessage(error, fallback)
}

const emptyForm = { employeeId: '', employeeName: '', officialEmail: '' }
export default function EmployeeManagement() {
  const { user } = useAuth()
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [original, setOriginal] = useState(null)
  const [reason, setReason] = useState('')
  const [confirmation, setConfirmation] = useState(null)
  const confirmationTitle = useRef(null)
  useEffect(() => { if (confirmation) confirmationTitle.current?.focus() }, [confirmation])
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)
  const addDraft = useRef(emptyForm)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState(null)
  const [listError, setListError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!user?.canManageEmployees) return
    let cancelled = false
    listEmployees({ search: query, page, size: 20 }).then(data => {
      if (!cancelled) { setResult(data); setListError(''); setLoading(false) }
    }).catch(requestError => {
      if (!cancelled) { setResult(null); setListError(getErrorMessage(requestError, 'Unable to load employees.')); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [user?.canManageEmployees, query, page, revision])
  if (!user?.canManageEmployees) return <div className="alert alert-danger" role="alert">Access denied.</div>
  function refresh() { setLoading(true); setRevision(value => value + 1) }
  function edit(employee) {
    if (editing !== null || busy.current) return
    addDraft.current = form
    setEditing(employee.id)
    setOriginal(employee); setReason(''); setConfirmation(null)
    setForm({ employeeId: employee.employeeId || '', employeeName: employee.employeeName, officialEmail: employee.officialEmail })
    setError(''); setSuccess('')
  }
  async function submit(event) {
    event.preventDefault()
    if (busy.current || confirmation) return
    setError(''); setSuccess('')
    const payload = { employeeId: form.employeeId.trim(), employeeName: form.employeeName.trim() }
    if (editing === null) payload.officialEmail = form.officialEmail.trim()
    if (Object.values(payload).some(value => !value)) { setError('All fields are required.'); return }
    if (editing !== null) {
      if (payload.employeeId === (original.employeeId || '') && payload.employeeName === original.employeeName) {
        setSuccess('No changes to save.'); return
      }
      if (!reason.trim()) { setError('A change reason is required.'); return }
      payload.reason = reason.trim()
      payload.expectedVersion = original.version
      busy.current = true; setSaving(true)
      try {
        setConfirmation(await previewEmployee(editing, payload))
      } catch (requestError) {
        setError(employeeError(requestError, 'Unable to review changes. Please try again.'))
        if (requestError.response?.status === 409) refresh()
      } finally { busy.current = false; setSaving(false) }
      return
    }
    busy.current = true; setSaving(true)
    try {
      await createEmployee(payload)
      setSuccess(editing === null ? 'Employee added successfully.' : 'Employee updated successfully.')
      setForm(editing === null ? emptyForm : addDraft.current); setEditing(null); refresh()
    } catch (requestError) {
      const response = requestError.response
      setError([400, 409].includes(response?.status) && typeof response.data?.message === 'string'
        ? response.data.message : employeeError(requestError, 'Unable to save employee. Please try again.'))
    } finally { busy.current = false; setSaving(false) }
  }
  async function confirmChanges() {
    if (busy.current || !confirmation) return
    busy.current = true; setSaving(true); setError('')
    try {
      await updateEmployee(editing, confirmation.proposed)
      setSuccess('Employee updated successfully.')
      setForm(addDraft.current); setEditing(null); setOriginal(null); setReason(''); setConfirmation(null); refresh()
    } catch (requestError) {
      setError(employeeError(requestError, 'Unable to save employee. Please try again.'))
      if (requestError.response?.status === 409) refresh()
      setConfirmation(null)
    } finally { busy.current = false; setSaving(false) }
  }
  return <section>
    <h1 className="h3 mb-4">Employee Management</h1>
    {success && <div className="alert alert-success" role="status" aria-live="polite">{success}</div>}
    <div className="card border-0 shadow-sm"><div className="card-body p-4">
      <h2 className="h5 mb-3">{editing === null ? 'Add Employee' : 'Edit Employee'}</h2>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <form onSubmit={submit}>
        <fieldset disabled={saving || confirmation !== null}>
          {[['employeeId', 'Employee ID', 'text', 64], ['employeeName', 'Employee Name', 'text', 255], ['officialEmail', 'Official Email', 'email', 255]].map(([key, label, type, maxLength]) =>
            <div className="mb-3" key={key}>
              <label className="form-label" htmlFor={key}>{label}</label>
              <input className="form-control" id={key} type={type} maxLength={maxLength} required
                readOnly={editing !== null && key === 'officialEmail'} value={form[key]}
                onChange={event => setForm({ ...form, [key]: event.target.value })} />
            </div>)}
          {editing !== null && <div className="mb-3">
            <p>Internal account reference: <strong>{editing}</strong></p>
            <label className="form-label" htmlFor="changeReason">Change reason</label>
            <textarea className="form-control" id="changeReason" maxLength={500} value={reason}
              onChange={event => setReason(event.target.value)} placeholder="For example: HR master record correction" />
          </div>}
          {editing !== null && <p>Official email is read-only. Changes require a separate identity verification and audited account-linking review.</p>}
          <button className="btn btn-primary" type="submit">{saving ? (editing === null ? 'Adding employee...' : 'Saving employee...') : (editing === null ? 'Add Employee' : 'Save Changes')}</button>
          {editing !== null && <button className="btn btn-secondary ms-2" type="button" onClick={() => { setEditing(null); setOriginal(null); setReason(''); setConfirmation(null); setForm(addDraft.current); setError(''); setSuccess('') }}>Cancel</button>}
        </fieldset>
      </form>
      {confirmation && <section className="border rounded p-3 mt-3" aria-labelledby="confirmEmployeeTitle">
        <h3 ref={confirmationTitle} tabIndex={-1} className="h5" id="confirmEmployeeTitle">Confirm employee correction</h3>
        <p>Internal account reference: <strong>{confirmation.current.id}</strong><br />
          Official email: <strong>{confirmation.current.officialEmail}</strong></p>
        <div className="table-responsive"><table className="table">
          <thead><tr><th>Field</th><th>Previous value</th><th>New value</th></tr></thead>
          <tbody>
            <tr><th>Employee ID</th><td>{confirmation.current.employeeId || 'Not assigned'}</td><td>{confirmation.proposed.employeeId}</td></tr>
            <tr><th>Name</th><td>{confirmation.current.employeeName}</td><td>{confirmation.proposed.employeeName}</td></tr>
          </tbody>
        </table></div>
        <p>Reason: {confirmation.proposed.reason}</p>
        {confirmation.duplicateName && <p className="alert alert-warning" role="status">Another employee record has the same normalized name. Duplicate names can be legitimate; verify this correction against the HR record before confirming.</p>}
        <p>Confirm that these changes belong to this account. Official email, role and active status will not change.</p>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={confirmChanges}>{saving ? 'Saving correction...' : 'Confirm correction'}</button>
        <button type="button" className="btn btn-outline-secondary ms-2" disabled={saving} onClick={() => setConfirmation(null)}>Back to edit</button>
      </section>}
    </div></div>
    <div className="card border-0 shadow-sm mt-4"><div className="card-body p-4">
      <h2 className="h5">Employees</h2>
      <EmployeeSearch value={search} onChange={setSearch} onSearch={text => {
        setLoading(true); setQuery(text); setPage(0); setRevision(value => value + 1)
      }} />
      {listError && <div className="alert alert-danger" role="alert">{listError} <button type="button" onClick={refresh}>Retry</button></div>}
      {loading ? <p>Loading employees...</p> : result && <>
        <div className="table-responsive"><table className="table">
          <thead><tr><th>Employee ID</th><th>Name</th><th>Official email</th><th>Last Google login (Asia/Kolkata)</th><th>Active status</th><th>Action</th></tr></thead>
          <tbody>{result.content.map(employee => <tr key={employee.id}>
            <td>{employee.employeeId || 'Not assigned'}</td><td>{employee.employeeName}</td>
            <td>{employee.officialEmail}</td>
            <td>{employee.lastLoginAt ? employee.lastLoginAt.replace('T', ' ').replace(/\.\d+$/, '') : 'Never signed in'}</td>
            <td>{employee.active ? 'Active' : 'Disabled'}</td>
            <td><button className="btn btn-sm btn-outline-primary" disabled={saving || editing !== null} onClick={() => edit(employee)} aria-label={`Edit ${employee.employeeName}`}>Edit</button></td>
          </tr>)}</tbody>
        </table></div>
        {result.content.length === 0 && <p>No employees found. {query ? 'Try another ID, name or email, or clear the search.' : 'Add an employee to get started.'}</p>}
        <div className="d-flex align-items-center gap-3">
          <button type="button" disabled={page === 0} onClick={() => { setLoading(true); setPage(page - 1) }}>Previous</button>
          <span>Page {page + 1} of {Math.max(1, result.totalPages)} · {result.totalElements} employees</span>
          <button type="button" disabled={page + 1 >= result.totalPages} onClick={() => { setLoading(true); setPage(page + 1) }}>Next</button>
        </div>
      </>}
    </div></div>
  </section>
}


