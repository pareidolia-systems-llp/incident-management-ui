import { useEffect, useRef, useState } from 'react'
import { listEmployees } from '../api/employees'

export default function EmployeeSearch({ value, onChange, onSearch }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [response, setResponse] = useState({ term: '', items: [], status: 'idle' })
  const generation = useRef(0)
  const input = useRef(null)
  const term = value.trim()
  const visible = open && term.length >= 2
  const items = response.term === term ? response.items : []
  const status = response.term === term ? response.status : 'loading'

  useEffect(() => {
    if (!visible) return
    const current = ++generation.current
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setResponse({ term, items: [], status: 'loading' })
      try {
        const data = await listEmployees({ search: term, page: 0, size: 6 }, { signal: controller.signal })
        if (current === generation.current && !controller.signal.aborted)
          setResponse({ term, items: data.content.slice(0, 6), status: 'ready' })
      } catch {
        if (current === generation.current && !controller.signal.aborted)
          setResponse({ term, items: [], status: 'error' })
      }
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [term, visible, value])

  function dismiss() { generation.current++; setOpen(false); setActive(-1) }
  function search(text) { dismiss(); onSearch(text) }
  function select(employee) {
    onChange(employee.officialEmail)
    search(employee.officialEmail)
  }
  function keyDown(event) {
    if (event.key === 'Escape') { event.preventDefault(); dismiss(); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      if (items.length) setActive(index => event.key === 'ArrowDown'
        ? (index + 1) % items.length : (index <= 0 ? items.length - 1 : index - 1))
    }
    if (event.key === 'Enter' && visible && active >= 0 && items[active]) {
      event.preventDefault(); select(items[active])
    }
  }

  return <form className="mb-3" onSubmit={event => { event.preventDefault(); search(value.trim()) }}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) dismiss() }}>
    <div className="d-flex flex-wrap gap-2">
      <label htmlFor="employeeSearch" className="visually-hidden">Search employees</label>
      <input ref={input} id="employeeSearch" className="form-control flex-grow-1 w-auto" maxLength={255}
        role="combobox" aria-autocomplete="list" aria-expanded={visible} aria-controls="employeeSuggestions"
        aria-activedescendant={visible && active >= 0 && items[active] ? 'employeeSuggestion-' + active : undefined}
        aria-describedby="employeeSearchHelp" autoComplete="off" value={value} placeholder="Search ID, name or email"
        onFocus={() => setOpen(true)} onKeyDown={keyDown}
        onChange={event => { generation.current++; setActive(-1); setOpen(true); setResponse({ term: event.target.value.trim(), items: [], status: 'loading' }); onChange(event.target.value) }} />
      <button className="btn btn-outline-primary" type="submit">Search</button>
      <button className="btn btn-outline-secondary" type="button" onClick={() => {
        onChange(''); search(''); input.current?.focus()
      }}>Clear search</button>
    </div>
    <small id="employeeSearchHelp" className="text-muted">Type at least 2 characters for suggestions, or use Search.</small>
    {visible && <div className="border rounded mt-2 p-2">
      {status === 'loading' && <p className="mb-0" role="status">Loading suggestions...</p>}
      {status === 'error' && <p className="mb-0" role="alert">Unable to load suggestions. Try typing again or use Search.</p>}
      {status === 'ready' && items.length === 0 && <p className="mb-0" role="status">No matching suggestions. Try another ID, name or email.</p>}
      <ul className="list-group" id="employeeSuggestions" role="listbox" aria-label="Employee suggestions">
        {items.map((employee, index) => <li key={employee.id} id={'employeeSuggestion-' + index}
          role="option" aria-selected={active === index} className={'list-group-item list-group-item-action text-break' + (active === index ? ' active' : '')}
          onMouseDown={event => event.preventDefault()} onClick={() => select(employee)}>
          <strong>{employee.employeeName}</strong> · {employee.employeeId || 'Not assigned'}<br />
          <small>{employee.officialEmail}</small>
        </li>)}
      </ul>
    </div>}
  </form>
}
