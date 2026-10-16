import { useCallback, useEffect, useState } from 'react'
import useAuth from '../auth/useAuth'
import PageTitle from '../components/PageTitle'
import ApiState from '../components/ApiState'
import { getWorkLogs, createWorkLog } from '../api/workLogs'
import { formatDate, getErrorMessage } from '../utils/incident'
import { workCategories, initialWorkEntry, validateWorkEntry, workEntryPayload } from '../utils/workLog'

export default function MyWorkLog() {
  const { user } = useAuth()
  if (!['IT_HANDLER', 'ADMIN'].includes(user.role)) return <><PageTitle title="My Work Log" /><div className="alert alert-warning" role="alert">You do not have permission to view My Work Log.</div></>
  return <WorkLogPage key={user.email} />
}

function WorkLogPage() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState(initialWorkEntry)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const load = useCallback(async (current = () => true) => {
    setLoading(true)
    try { const data = await getWorkLogs(); if (current()) { setEntries(data); setError('') } }
    catch (failure) { if (current()) setError(getErrorMessage(failure, 'Work entries could not be loaded. Please retry.')) }
    finally { if (current()) setLoading(false) }
  }, [])
  useEffect(() => {
    let active = true
    void Promise.resolve().then(() => { if (active) return load(() => active) })
    return () => { active = false }
  }, [load])
  function showForm() { setValues(initialWorkEntry()); setErrors({}); setFormError(''); setNotice(''); setOpen(true) }
  function update(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined })); setFormError('')
  }
  async function save(event) {
    event.preventDefault()
    if (saving) return
    const validation = validateWorkEntry(values)
    if (Object.keys(validation).length) { setErrors(validation); setFormError('Please correct the highlighted fields.'); return }
    setSaving(true); setFormError('')
    try {
      await createWorkLog(workEntryPayload(values))
      setOpen(false); setNotice('Work entry saved successfully.')
      await load()
    } catch (failure) {
      setFormError(getErrorMessage(failure, 'The work entry could not be saved. Please check the fields and try again.'))
    } finally { setSaving(false) }
  }
  return <>
    <PageTitle title="My Work Log" description="Your IT work that is not related to an incident." actions={<button className="btn btn-primary" onClick={showForm} disabled={saving || loading}>Add Work Entry</button>} />
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    {error && <ApiState type="error" message={error} onRetry={() => load()} />}
    {loading ? <ApiState type="loading" /> : <section className="card section-card">
      {entries.length === 0 ? <div className="card-body text-secondary">No work entries recorded yet.</div> : <div className="table-responsive"><table className="table mb-0"><thead><tr><th>Date / Time</th><th>Category</th><th>Summary</th><th>Duration</th></tr></thead><tbody>
        {entries.map((entry) => <tr key={entry.id}><td>{formatDate(entry.workedAt)}</td><td>{workCategories[entry.category] || entry.category}</td><td className="text-break"><div style={{ whiteSpace: 'pre-wrap' }}>{entry.summary}</div>{entry.details && <details className="small mt-1"><summary>Details</summary><div style={{ whiteSpace: 'pre-wrap' }}>{entry.details}</div></details>}</td><td>{entry.durationMinutes == null ? '—' : `${entry.durationMinutes} min`}</td></tr>)}
      </tbody></table></div>}
    </section>}
    {open && <><div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby="work-entry-title"><div className="modal-dialog modal-lg modal-dialog-scrollable"><form className="modal-content" noValidate onSubmit={save}>
      <div className="modal-header"><h2 className="modal-title fs-5" id="work-entry-title">Add Work Entry</h2><button type="button" className="btn-close" aria-label="Close" disabled={saving} onClick={() => setOpen(false)} /></div>
      <div className="modal-body">{formError && <div className="alert alert-danger" role="alert">{formError}</div>}<div className="row g-3">
        {[
          ['workDate', 'Work Date', 'date', true], ['workTime', 'Work Time', 'time', true],
          ['category', 'Category', 'select', true], ['summary', 'Summary', 'text', true],
          ['details', 'Details', 'textarea', false], ['durationMinutes', 'Duration (minutes)', 'number', false],
        ].map(([name, label, type, required]) => {
          const Component = type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input'
          return <div key={name} className={['summary', 'details'].includes(name) ? 'col-12' : 'col-12 col-sm-6'}>
            <label className="form-label fw-semibold" htmlFor={`work-${name}`}>{label}{required && <span className="text-danger"> *</span>}</label>
            <Component id={`work-${name}`} name={name} type={['select', 'textarea'].includes(type) ? undefined : type} className={`form-control${errors[name] ? ' is-invalid' : ''}`} value={values[name]} onChange={update} disabled={saving} required={required}
              aria-invalid={Boolean(errors[name])} aria-describedby={errors[name] ? `work-${name}-error` : undefined}
              min={type === 'date' ? '1900-01-01' : type === 'number' ? 1 : undefined} max={type === 'date' ? '9998-12-31' : type === 'number' ? 2147483647 : undefined} step={type === 'number' ? 1 : undefined}
              maxLength={name === 'summary' ? 255 : name === 'details' ? 8000 : undefined} rows={type === 'textarea' ? 4 : undefined}>
              {type === 'select' ? Object.entries(workCategories).map(([value, text]) => <option key={value} value={value}>{text}</option>) : undefined}
            </Component>
            {errors[name] && <div className="invalid-feedback" id={`work-${name}-error`}>{errors[name]}</div>}
          </div>
        })}
      </div></div>
      <div className="modal-footer"><button type="button" className="btn btn-outline-secondary" disabled={saving} onClick={() => setOpen(false)}>Cancel</button><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Work Entry'}</button></div>
    </form></div></div><div className="modal-backdrop show" /></>}
  </>
}
