import { useEffect, useRef, useState } from 'react'
import PageTitle from '../components/PageTitle'
import { getTriage, getIncidentClassification, setClassification, getClassificationHistory, getCaseGrants, setCaseGrant, getCaseGrantHistory, searchCaseEmployees, getSecurityCapabilities, searchCapabilityEmployees, setSecurityCapability, getSecurityCapabilityHistory } from '../api/incidentSecurity'

export default function IncidentSecurityAdministration() {
  const [access, setAccess] = useState(null)
  useEffect(() => {
    let cancelled = false
    Promise.allSettled([getTriage(), getSecurityCapabilities()]).then(results => {
      if (!cancelled) setAccess(results)
    })
    return () => { cancelled = true }
  }, [])

  const reachable = access?.some(result => authorizedList(result) || result.reason?.response?.status === 403)
  return <>
    <PageTitle title="Incident security administration" />
    {!access && <p role="status">Checking security administration access…</p>}
    {access && !reachable && <p role="alert">Incident security administration is unavailable.</p>}
    {authorizedList(access?.[0]) && <ClassificationPanel initial={access[0].value} />}
    {reachable && <CaseGrantPanel />}
    {authorizedList(access?.[1]) && <CapabilityPanel initial={access[1].value} />}
  </>
}

function authorizedList(result) {
  return result?.status === 'fulfilled' && Array.isArray(result.value)
}

function saveError(failure, subject) {
  if (failure.response?.status === 409) return `${subject} changed. Reload current data and review before trying again.`
  if ([401, 403, 404].includes(failure.response?.status)) return `${subject} was not saved. Required authorization or approval is unavailable.`
  return `${subject} was not saved. Review the current data before trying again.`
}

function CapabilityPanel({ initial }) {
  const [items, setItems] = useState(initial); const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState(''); const [matches, setMatches] = useState([]); const [target, setTarget] = useState(null)
  const [capability, setCapability] = useState('INCIDENT_CLASSIFIER'); const [active, setActive] = useState(true)
  const [reason, setReason] = useState(''); const [history, setHistory] = useState(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const searchSequence = useRef(0)
  useEffect(() => {
    if (!revision) return
    let cancelled = false
    getSecurityCapabilities().then(data => { if (!cancelled) setItems(Array.isArray(data) ? data : null) })
      .catch(() => { if (!cancelled) setItems(null) })
    return () => { cancelled = true }
  }, [revision])
  const current = items?.find(item => item.userId === target?.id && item.capability === capability)
  async function search(event) { event.preventDefault(); if (query.trim().length < 2) return; const sequence = ++searchSequence.current; setError(''); setTarget(null); setMatches([]); try { const data = await searchCapabilityEmployees(query.trim()); if (sequence === searchSequence.current) setMatches(Array.isArray(data) ? data : []) } catch { if (sequence === searchSequence.current) setError('Employee search is unavailable.') } }
  async function submit(event) {
    event.preventDefault(); if (!items || !target || !reason.trim() || busy || (!active && !current)) return; setBusy(true); setError('')
    try { await setSecurityCapability(target.id, capability, { active, expectedVersion: current?.version ?? 0, reason: reason.trim() }); setTarget(null); setItems(null); setReason(''); setHistory(null); setRevision(value => value + 1) }
    catch (failure) { setTarget(null); setItems(null); setHistory(null); setError(saveError(failure, 'Capability')); setRevision(value => value + 1) }
    finally { setBusy(false) }
  }
  async function loadHistory(item) {
    if (busy) return
    setBusy(true); setHistory(null)
    try { setHistory(await getSecurityCapabilityHistory(item.userId, item.capability)) }
    catch { setError('Capability history is unavailable.') }
    finally { setBusy(false) }
  }
  return <section className="card mb-3"><div className="card-body"><h2 className="h5">Security capabilities</h2>
    {error && <p role="alert">{error}</p>}{items && <fieldset disabled={busy}><p>Each capability is granted independently.</p><p>Global Incident Administrator (GLOBAL_INCIDENT_VIEW) is audited read access. Changes require the separate ISMS/HR approver authorization. It grants no assignment, mutation, or email disclosure permissions.</p><ul>{items.map(item => <li key={`${item.userId}-${item.capability}`}>{item.name} — {item.email}: {item.capability} ({item.active ? 'Active' : 'Revoked'}) <button type="button" className="btn btn-link" onClick={() => { setTarget({ id: item.userId, name: item.name, email: item.email }); setCapability(item.capability); setActive(!item.active) }}>Select capability</button><button type="button" className="btn btn-link" onClick={() => loadHistory(item)}>Capability history</button></li>)}</ul>
      {history && <ul aria-label="Capability history">{history.map(item => <li key={item.version}>{item.changedAt}: account {item.actorId} — {item.newActive ? 'Granted' : 'Revoked'} — {item.reason}</li>)}</ul>}
      <form onSubmit={search}><label htmlFor="capability-search">Find active employee for capability</label><input id="capability-search" className="form-control" maxLength={255} value={query} onChange={event => { searchSequence.current += 1; setQuery(event.target.value); setMatches([]); setTarget(null) }} /><button className="btn btn-outline-primary mt-2" disabled={query.trim().length < 2}>Find employee</button></form>
      {matches.length > 0 && <ul>{matches.map(item => <li key={item.id}><button type="button" className="btn btn-link" onClick={() => { setTarget(item); setMatches([]) }}>{item.name} — {item.email}</button></li>)}</ul>}
      {target && <p>Selected: {target.name} — {target.email}</p>}
      <form onSubmit={submit}><label htmlFor="security-capability">Capability</label><select id="security-capability" className="form-select" value={capability} onChange={event => setCapability(event.target.value)}>{['INCIDENT_CLASSIFIER','RESTRICTED_DOWNGRADE','ASSIGNMENT_ADMIN','CASE_ACCESS_ADMIN','GLOBAL_INCIDENT_VIEW'].map(item => <option key={item}>{item}</option>)}</select>
        <label htmlFor="capability-action">Action</label><select id="capability-action" className="form-select" value={active ? 'grant' : 'revoke'} onChange={event => setActive(event.target.value === 'grant')}><option value="grant">Grant</option><option value="revoke">Revoke</option></select>
        <label htmlFor="capability-reason">Reason</label><textarea id="capability-reason" className="form-control" maxLength={500} value={reason} onChange={event => setReason(event.target.value)} /><button className="btn btn-primary mt-2" disabled={busy || !target || !reason.trim() || (!active && !current)}>Save capability</button></form></fieldset>}
  </div></section>
}

function ClassificationPanel({ initial }) {
  const [triage, setTriage] = useState(initial); const [selected, setSelected] = useState('')
  const [lookupId, setLookupId] = useState(''); const [lookup, setLookup] = useState(null)
  const [classification, setValue] = useState(''); const [reason, setReason] = useState('')
  const [history, setHistory] = useState(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!revision) return
    let cancelled = false
    getTriage().then(data => { if (!cancelled) setTriage(Array.isArray(data) ? data : null) })
      .catch(() => { if (!cancelled) setError('Classification queue is unavailable.') })
    return () => { cancelled = true }
  }, [revision])
  const incident = lookup || triage?.find(item => String(item.incidentId) === selected)
  async function loadIncident(event) {
    event.preventDefault(); if (!/^[1-9]\d*$/.test(lookupId)) return
    if (busy) return
    setBusy(true); setError(''); setLookup(null); setSelected(''); setHistory(null); setReason('')
    try { setLookup(await getIncidentClassification(lookupId)) }
    catch { setError('Incident classification is unavailable.') }
    finally { setBusy(false) }
  }
  async function submit(event) {
    event.preventDefault(); if (!incident || !classification || classification === incident.classification || !reason.trim() || busy) return
    setBusy(true); setError('')
    try { await setClassification(incident.incidentId, { classification, expectedVersion: incident.version, reason: reason.trim() }); setSelected(''); setLookup(null); setTriage(null); setHistory(null); setReason(''); setRevision(value => value + 1) }
    catch (failure) { setLookup(null); setSelected(''); setTriage(null); setHistory(null); setReason(''); setError(saveError(failure, 'Classification')); setRevision(value => value + 1) }
    finally { setBusy(false) }
  }
  async function loadHistory() {
    if (!incident || busy) return
    setBusy(true); setHistory(null)
    try { setHistory(await getClassificationHistory(incident.incidentId)) }
    catch { setError('Classification history is unavailable.') }
    finally { setBusy(false) }
  }
  return <section className="card mb-3"><div className="card-body"><h2 className="h5">Unclassified triage</h2>
    {error && <p role="alert">{error}</p>}
    {triage && <fieldset disabled={busy}><form onSubmit={loadIncident}><label htmlFor="classification-id">Or find incident by ID</label><input id="classification-id" className="form-control" inputMode="numeric" value={lookupId} onChange={event => setLookupId(event.target.value)} /><button className="btn btn-outline-primary mt-2">Find incident</button></form>
      {incident && <p>Selected: {incident.incidentNumber} — {incident.classification} (version {incident.version})</p>}
      {incident?.classification === 'RESTRICTED' && <p>Changing to STANDARD requires a separate downgrade capability.</p>}
      <form onSubmit={submit}><label htmlFor="triage-incident">Unclassified incident</label><select id="triage-incident" className="form-select" value={selected} onChange={event => { setSelected(event.target.value); setLookup(null); setHistory(null); setReason('') }}><option value="">Choose an incident</option>{triage.map(item => <option key={item.incidentId} value={item.incidentId}>{item.incidentNumber}</option>)}</select>
      <label htmlFor="triage-classification">Classification</label><select id="triage-classification" className="form-select" value={classification} onChange={event => setValue(event.target.value)}><option value="">Choose classification</option><option>STANDARD</option><option>RESTRICTED</option></select>
      <label htmlFor="triage-reason">Reason</label><textarea id="triage-reason" className="form-control" maxLength={500} value={reason} onChange={event => setReason(event.target.value)} />
      <button className="btn btn-primary mt-2" disabled={!incident || !classification || classification === incident.classification || !reason.trim() || busy}>Save classification</button> <button type="button" className="btn btn-link" disabled={!incident} onClick={loadHistory}>View history</button></form>
      {history && <ul aria-label="Classification history">{history.map(entry => <li key={entry.version}>{entry.changedAt}: account {entry.actorId} — {entry.previous} → {entry.next} — {entry.reason}</li>)}</ul>}</fieldset>}
  </div></section>
}

function CaseGrantPanel() {
  const [incident, setIncident] = useState(''); const [loadedId, setLoadedId] = useState(null); const [grants, setGrants] = useState(null)
  const [target, setTarget] = useState(''); const [permission, setPermission] = useState('VIEW'); const [active, setActive] = useState(true)
  const [targetLabel, setTargetLabel] = useState(''); const [query, setQuery] = useState(''); const [matches, setMatches] = useState([])
  const [reason, setReason] = useState(''); const [history, setHistory] = useState(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false)
  const searchSequence = useRef(0)
  const loadSequence = useRef(0)
  const current = grants?.find(item => String(item.userId) === target && item.permission === permission)
  async function load(event) { event?.preventDefault(); if (!/^[1-9]\d*$/.test(incident)) return; const sequence = ++loadSequence.current; searchSequence.current += 1; setError(''); setLoadedId(null); setGrants(null); setHistory(null); setTarget(''); setTargetLabel(''); setMatches([]); setReason(''); try { const data = await getCaseGrants(incident); if (sequence === loadSequence.current) { setGrants(Array.isArray(data) ? data : null); setLoadedId(Array.isArray(data) ? incident : null) } } catch { if (sequence === loadSequence.current) { setLoadedId(null); setError('Case permissions are unavailable.') } } }
  async function submit(event) {
    event.preventDefault(); if (busy || !loadedId || !grants || (!active && !current) || !/^[1-9]\d*$/.test(target) || !reason.trim()) return
    setBusy(true); setError('')
    try { await setCaseGrant(loadedId, target, permission, { active, expectedVersion: current?.version ?? 0, reason: reason.trim() }); setReason(''); setTarget(''); setTargetLabel(''); await load() }
    catch (failure) { setGrants(null); setLoadedId(null); setHistory(null); setReason(''); setError(saveError(failure, 'Case permission')) }
    finally { setBusy(false) }
  }
  async function showHistory(item) {
    if (!loadedId || busy) return
    setBusy(true); setHistory(null)
    try { setHistory(await getCaseGrantHistory(loadedId, item.userId, item.permission)) }
    catch { setError('Permission history is unavailable.') }
    finally { setBusy(false) }
  }
  async function searchEmployees(event) {
    event.preventDefault(); if (query.trim().length < 2) return
    const sequence = ++searchSequence.current; setMatches([]); setTarget(''); setTargetLabel(''); setError('')
    try { const data = await searchCaseEmployees(query.trim()); if (sequence === searchSequence.current) setMatches(Array.isArray(data) ? data : []) }
    catch { if (sequence === searchSequence.current) setError('Employee search is unavailable.') }
  }
  return <section className="card mb-3"><div className="card-body"><h2 className="h5">Case permissions</h2><p>Permissions are individual and do not create other permissions.</p>
    {error && <p role="alert">{error}</p>}<fieldset disabled={busy}><form onSubmit={load}><label htmlFor="case-id">Incident ID</label><input id="case-id" className="form-control" value={incident} onChange={event => { searchSequence.current += 1; loadSequence.current += 1; setIncident(event.target.value); setLoadedId(null); setGrants(null); setTarget(''); setTargetLabel(''); setMatches([]); setHistory(null); setReason('') }} inputMode="numeric" /><button className="btn btn-outline-primary mt-2">Load case</button></form>
    {grants && <><ul>{grants.map(item => <li key={`${item.userId}-${item.permission}`}>{item.name} — {item.email}: {item.permission} ({item.active ? 'Active' : 'Revoked'}) <button type="button" className="btn btn-link" onClick={() => { setTarget(String(item.userId)); setTargetLabel(`${item.name} — ${item.email}`); setPermission(item.permission); setActive(!item.active) }}>Select</button><button type="button" className="btn btn-link" onClick={() => showHistory(item)}>History</button></li>)}</ul>
      {history && <ul aria-label="Permission history">{history.map(entry => <li key={entry.version}>{entry.changedAt}: account {entry.actorId} — {entry.newActive ? 'Granted' : 'Revoked'} — {entry.reason}</li>)}</ul>}
      <form onSubmit={searchEmployees}><label htmlFor="case-employee-search">Find active employee by name or email</label><input id="case-employee-search" className="form-control" maxLength={255} value={query} onChange={event => { searchSequence.current += 1; setQuery(event.target.value); setMatches([]); setTarget(''); setTargetLabel('') }} /><button className="btn btn-outline-primary mt-2" disabled={query.trim().length < 2}>Search employees</button></form>
      {matches.length > 0 && <ul aria-label="Matching employees">{matches.map(item => <li key={item.id}><button type="button" className="btn btn-link" onClick={() => { setTarget(String(item.id)); setTargetLabel(`${item.name} — ${item.email}`); setMatches([]) }}>{item.name} — {item.email}</button></li>)}</ul>}
      {targetLabel && <p>Selected: {targetLabel}</p>}
      <form onSubmit={submit}>
        <label htmlFor="grant-permission">Permission</label><select id="grant-permission" className="form-select" value={permission} onChange={event => setPermission(event.target.value)}>{['VIEW','HANDLE','MODIFY','REPORT','ASSIGN'].map(item => <option key={item}>{item}</option>)}</select>
        <label htmlFor="grant-action">Action</label><select id="grant-action" className="form-select" value={active ? 'grant' : 'revoke'} onChange={event => setActive(event.target.value === 'grant')}><option value="grant">Grant</option><option value="revoke">Revoke</option></select>
        <label htmlFor="grant-reason">Reason</label><textarea id="grant-reason" className="form-control" maxLength={500} value={reason} onChange={event => setReason(event.target.value)} />
        <button className="btn btn-primary mt-2" disabled={busy || !target || !reason.trim() || (!active && !current)}>Save permission</button></form></>}</fieldset>
  </div></section>
}
