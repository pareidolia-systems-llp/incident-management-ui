import { useState } from 'react'
import { downloadMonthlyReport } from '../api/reports'
import { saveDownload } from '../utils/download'

export default function MonthlyReport() {
  const [period, setPeriod] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function download(event) {
    event.preventDefault()
    if (busy || !period) return
    setBusy(true)
    setError('')
    try { saveDownload(await downloadMonthlyReport(period), `incident-report-${period}.xlsx`) }
    catch (failure) {
      const status = failure.response?.status
      setError(status === 403 ? 'You do not have permission to download reports.' : status === 401 ? 'Your session has expired. Please sign in again.' : status === 400 ? 'Select a valid month and year from 1900 to 9998.' : 'The report could not be downloaded. Please try again.')
    } finally { setBusy(false) }
  }
  return <section className="card section-card mb-3"><div className="card-body">
    <h2 className="h6">Monthly Incident Report</h2>
    <form className="d-flex flex-wrap align-items-end gap-2" onSubmit={download}>
      <div><label className="form-label" htmlFor="report-month">Month</label><input id="report-month" className="form-control" type="month" min="1900-01" max="9998-12" required value={period} onChange={(event) => setPeriod(event.target.value)} disabled={busy} /></div>
      <button className="btn btn-outline-primary" disabled={busy || !period}>{busy ? 'Downloading…' : 'Download Excel'}</button>
    </form>
    {error && <div className="alert alert-danger mt-3 mb-0" role="alert">{error}</div>}
  </div></section>
}
