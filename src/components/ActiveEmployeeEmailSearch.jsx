import { useId, useRef, useState } from 'react'
import { searchActiveEmployeeEmails } from '../api/employees'

export default function ActiveEmployeeEmailSearch({ onSelect }) {
  const inputId = useId()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [busy, setBusy] = useState(false)
  const sequence = useRef(0)
  async function search(event) {
    event.preventDefault()
    if (busy || query.trim().length < 2) return
    const current = ++sequence.current
    setBusy(true); setResults([]); setError(''); setSearched(false); onSelect(null)
    try {
      const matches = await searchActiveEmployeeEmails(query.trim())
      if (sequence.current === current) { setResults(matches); setSearched(true) }
    } catch {
      if (sequence.current === current) setError('Unable to search employees. Please try again.')
    } finally {
      if (sequence.current === current) setBusy(false)
    }
  }
  function update(value) {
    sequence.current += 1
    setQuery(value); setResults([]); setError(''); setSearched(false); setBusy(false); onSelect(null)
  }
  return <div>
    <form onSubmit={search} role="search" aria-label="Find active employee by email">
      <label className="form-label" htmlFor={inputId}>Official employee email</label>
      <div className="d-flex gap-2"><input className="form-control" id={inputId} type="text" maxLength={255}
        value={query} onChange={event => update(event.target.value)} autoComplete="off" />
        <button className="btn btn-outline-primary" disabled={busy || query.trim().length < 2} type="submit">Search</button></div>
    </form>
    {error && <p className="text-danger" role="alert">{error}</p>}
    {busy && <p role="status">Searching employees...</p>}
    {searched && results.length === 0 && <p role="status">No matching active employees.</p>}
    {results.length > 0 && <ul className="list-group mt-2" aria-label="Active matching employees">{results.map(employee =>
      <li className="list-group-item" key={employee.id}><button className="btn btn-link text-start" type="button"
        onClick={() => { onSelect(employee); setResults([]); setSearched(false) }}>{employee.name} · {employee.email}</button></li>)}</ul>}
  </div>
}
