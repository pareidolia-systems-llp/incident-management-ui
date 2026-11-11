import { useEffect, useState } from 'react'
import apiClient from '../api/client'
import { departmentAdministrationError } from '../utils/departmentAdministration'

const endpoint = '/api/admin/department-mail-recipients'
const empty = { id: null, departmentId: '', email: '', active: true, reason: '' }

export default function DepartmentMailRecipients() {
  const [directory, setDirectory] = useState(null)
  const [draft, setDraft] = useState(empty)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [history, setHistory] = useState(null)

  useEffect(() => {
    let current = true
    apiClient.get(endpoint).then(({ data }) => {
      if (current) setDirectory(data)
    }).catch(failure => {
      if (current) {
        setDirectory(null)
        setError(departmentAdministrationError(failure, 'Department email recipients'))
      }
    })
    return () => { current = false }
  }, [revision])

  async function save(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const email = draft.email.trim()
      const reason = draft.reason.trim()
      if (draft.id) {
        await apiClient.put(endpoint + '/' + draft.id, { email, active: draft.active, expectedVersion: draft.version, reason })
      } else {
        await apiClient.post(endpoint, { departmentId: Number(draft.departmentId), email, reason })
      }
      setDraft(empty)
      setHistory(null)
      setNotice('Recipient configuration saved.')
      setRevision(value => value + 1)
    } catch (failure) {
      const status = failure.response?.status
      if (status === 409) {
        setDraft(empty)
        setRevision(value => value + 1)
        setError('The recipient changed or the address is already configured. Review the latest settings.')
      } else {
        if ([401, 403, 404].includes(status)) {
          setDirectory(null)
          setDraft(empty)
          setHistory(null)
        }
        setError(departmentAdministrationError(failure, 'Saving the recipient'))
      }
    } finally {
      setBusy(false)
    }
  }

  async function viewHistory(recipient) {
    setError('')
    setHistory(null)
    try {
      const { data } = await apiClient.get(endpoint + '/' + recipient.id + '/history')
      setHistory({ recipient, entries: data })
    } catch (failure) {
      if ([401, 403, 404].includes(failure.response?.status)) {
        setDirectory(null)
        setDraft(empty)
      }
      setError(departmentAdministrationError(failure, 'Recipient history'))
    }
  }

  function change(event) {
    const { name, value, checked } = event.target
    setDraft(current => ({ ...current, [name]: name === 'active' ? checked : value }))
  }

  return <section className="card mb-3" aria-labelledby="department-mail-heading">
    <div className="card-body">
      <h2 className="h5" id="department-mail-heading">Department email recipients</h2>
      <p>Case permissions are checked before delivery. Manage department heads and handlers separately.</p>
      {error && <p className="text-danger" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {directory && <>
        <ul>
          {directory.recipients.map(recipient => <li key={recipient.id}>
            {recipient.departmentName}: {recipient.email} ({recipient.active ? 'Active' : 'Inactive'})
            <button type="button" className="btn btn-link" disabled={busy}
              onClick={() => setDraft({ ...recipient, reason: '' })}>Edit recipient</button>
            <button type="button" className="btn btn-link" onClick={() => viewHistory(recipient)}>View recipient history</button>
          </li>)}
        </ul>
        {history && <section aria-label="Recipient audit history">
          <h3 className="h6">History for {history.recipient.email}</h3>
          <ul>{history.entries.map(entry => <li key={entry.version}>
            {entry.changedAt} · Account {entry.actorUserId} · {entry.oldEmail && entry.oldEmail + ' → '}{entry.newEmail}
            {' · '}{entry.newActive ? 'Active' : 'Inactive'} · {entry.reason}
          </li>)}</ul>
        </section>}
        <form onSubmit={save}>
          <fieldset disabled={busy}>
            {draft.id ? <p>Department: {draft.departmentName}</p> : <>
              <label htmlFor="mail-recipient-department">Department</label>
              <select className="form-select" id="mail-recipient-department" name="departmentId" value={draft.departmentId} onChange={change} required>
                <option value="">Choose a department</option>
                {directory.departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
            </>}
            <label className="mt-2" htmlFor="mail-recipient-email">Recipient email</label>
            <input className="form-control" id="mail-recipient-email" type="email" name="email" value={draft.email} maxLength={254} onChange={change} required />
            {draft.id && <label className="d-block mt-2">
              <input className="form-check-input me-2" type="checkbox" name="active" checked={draft.active} onChange={change} />
              Active recipient
            </label>}
            <label className="mt-2" htmlFor="mail-recipient-reason">Change reason</label>
            <textarea className="form-control" id="mail-recipient-reason" name="reason" value={draft.reason} maxLength={500} onChange={change} required />
            <button className="btn btn-primary mt-2" type="submit" disabled={!draft.reason.trim()}>
              {draft.id ? 'Save recipient' : 'Add recipient'}
            </button>
            {draft.id && <button className="btn btn-secondary mt-2 ms-2" type="button" onClick={() => setDraft(empty)}>Cancel edit</button>}
          </fieldset>
        </form>
      </>}
    </div>
  </section>
}
