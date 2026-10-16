import { useState } from 'react'
import { downloadMonthlyReport, downloadRangeReport } from '../api/reports'
import { validateReportRange, validateReportMonth } from '../utils/reportRange'
import { saveDownload } from '../utils/download'

export default function MonthlyReport() {
  const [period, setPeriod] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [mode, setMode] = useState('month')
  const [range, setRange] = useState({ fromDate: '', fromTime: '', toDate: '', toTime: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  function updateRange(event) {
    setRange((current) => ({ ...current, [event.target.name]: event.target.value }))
    setError('')
  }
  async function download(event) {
    event.preventDefault()
    if (busy) return
    const validation = mode === 'range' ? validateReportRange(range)
      : validateReportMonth(period)
    if (validation) { setError(validation); return }
    setBusy(true)
    setError('')
    try {
      const blob = mode === 'month' ? await downloadMonthlyReport(period) : await downloadRangeReport(range)
      saveDownload(blob, mode === 'month' ? `incident-report-${period}.xlsx` : `incident-report-${range.fromDate}-to-${range.toDate}.xlsx`)
    } catch (failure) {
      const status = failure.response?.status
      setError(status === 403 ? 'You do not have permission to download reports.' : status === 401 ? 'Your session has expired. Please sign in again.' : status === 400 ? (mode === 'month' ? 'Select a valid month and year from 1900 to 9998.' : 'Select valid dates and optional times. From date/time must be on or before To date/time.') : 'The report could not be downloaded. Please try again.')
    } finally { setBusy(false) }
  }
  return <section className="card section-card mb-3"><div className="card-body">
    <h2 className="h6">{mode === 'month' ? 'Monthly Incident Report' : 'Incident Report'}</h2>
    <form className="d-flex flex-wrap align-items-end gap-2" noValidate onSubmit={download}>
      <div><label className="form-label" htmlFor="report-mode">Report period</label><select id="report-mode" className="form-select" value={mode} disabled={busy} onChange={(event) => { setMode(event.target.value); setError('') }}><option value="month">Month</option><option value="range">Date / time range</option></select></div>
      {mode === 'month' ? <div><label className="form-label" htmlFor="report-month">Month</label><input id="report-month" className="form-control" type="month" min="1900-01" max="9998-12" required value={period} onChange={(event) => { setPeriod(event.target.value); setError('') }} disabled={busy} /></div>
        : <>{[['fromDate', 'From Date', 'date'], ['fromTime', 'From Time (optional)', 'time'], ['toDate', 'To Date', 'date'], ['toTime', 'To Time (optional)', 'time']].map(([name, label, type]) => <div key={name}><label className="form-label" htmlFor={`report-${name}`}>{label}</label><input id={`report-${name}`} name={name} className="form-control" type={type} min={type === 'date' ? '1900-01-01' : undefined} max={type === 'date' ? '9998-12-31' : undefined} required={type === 'date'} value={range[name]} onChange={updateRange} disabled={busy} aria-describedby="report-range-help" /></div>)}</>}
      <button className="btn btn-outline-primary" disabled={busy || (mode === 'month' && !period)}>{busy ? 'Downloading…' : 'Download Excel'}</button>
    </form>
    {mode === 'range' && <p className="small text-secondary mt-2 mb-0" id="report-range-help">Filters when incidents were reported; includes their full history. Blank times include the full selected days. Times use the same local time as stored incident timestamps; an explicit To Time is inclusive at that exact time.</p>}
    {error && <div className="alert alert-danger mt-3 mb-0" role="alert">{error}</div>}
  </div></section>
}
