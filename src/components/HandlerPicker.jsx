import { useEffect, useId, useRef, useState } from 'react'
import { searchHandlers } from '../api/assignment'

export default function HandlerPicker({ value, onChange, incidentId, disabled = false }) {
  const id = useId()
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [searched, setSearched] = useState(false)
  const sequence = useRef(0)
  useEffect(() => () => { sequence.current += 1 }, [])
  async function search() {
    if (query.trim().length < 2 || disabled || busy) return
    const current = ++sequence.current
    setBusy(true); setError(''); setMatches([]); setSearched(false)
    try { const rows = await searchHandlers(query.trim(), incidentId); if (current === sequence.current) { setMatches(Array.isArray(rows) ? rows : []); setSearched(true) } }
    catch { if (current === sequence.current) setError('Handler search is unavailable. Check access and try again.') }
    finally { if (current === sequence.current) setBusy(false) }
  }
  return <div className="mb-3">
    <label htmlFor={id} className="form-label">Search eligible handlers by official email or name</label>
    <div className="d-flex gap-2"><input id={id} className="form-control" maxLength={255} value={query} disabled={disabled} onChange={event => { sequence.current += 1; setQuery(event.target.value); setMatches([]); setError(''); setBusy(false); setSearched(false); onChange(null) }} /><button type="button" className="btn btn-outline-primary" disabled={disabled || busy || query.trim().length < 2} onClick={search}>{busy ? 'Searching…' : 'Search handlers'}</button></div>
    {error && <p role="alert">{error}</p>}
    {searched && matches.length === 0 && !value && <p role="status">No eligible handlers match this search. The portal checks handler eligibility, department membership or IT service-team status, case access, and assignment scope.</p>}
    {matches.length > 0 && <ul aria-label="Eligible handlers">{matches.map(employee => <li key={employee.id}><button type="button" className="btn btn-link" disabled={disabled} onClick={() => { sequence.current += 1; onChange(employee); setMatches([]); setBusy(false) }}>{employee.name} — {employee.email}</button></li>)}</ul>}
    {value && <p className="mt-2">Selected: {value.name} — {value.email} <button type="button" className="btn btn-link" disabled={disabled} onClick={() => onChange(null)}>Clear handler</button></p>}
  </div>
}
