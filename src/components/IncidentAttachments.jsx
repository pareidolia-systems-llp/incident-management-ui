import { useCallback, useEffect, useState } from 'react'
import { getAttachments, uploadAttachments, downloadAttachment } from '../api/attachments'
import { saveDownload } from '../utils/download'
import { formatDate, getErrorMessage } from '../utils/incident'
import ImagePicker from './ImagePicker'

export default function IncidentAttachments({ incidentId, canUpload, onUploaded }) {
  const [items, setItems] = useState([])
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const load = useCallback(async () => {
    setLoading(true)
    try { setItems(await getAttachments(incidentId)); setError('') }
    catch (failure) { setError(getErrorMessage(failure, 'Attachments could not be loaded. Please retry.')) }
    finally { setLoading(false) }
  }, [incidentId])
  useEffect(() => { void Promise.resolve().then(load) }, [load])
  async function upload(event) {
    event.preventDefault()
    if (busy || !files.length) return
    setBusy(true); setError(''); setNotice('')
    try {
      await uploadAttachments(incidentId, files)
      setFiles([])
      setNotice('Screenshots uploaded successfully.')
      await load()
      await onUploaded()
    } catch (failure) {
      const status = failure.response?.status
      if (status === 401) setError('Your session has expired. Please sign in again.')
      else if (status === 403 || status === 404) setError('Screenshot upload is unavailable for this incident. Check your access or contact support.')
      else if (status === 400 || status === 413) setError('Check that each screenshot is a valid PNG or JPEG no larger than 5 MB, then retry.')
      else setError(getErrorMessage(failure, 'Screenshots could not be uploaded. Please retry.'))
    }
    finally { setBusy(false) }
  }
  async function download(item) {
    setBusy(true); setError('')
    try { saveDownload(await downloadAttachment(incidentId, item.id), item.originalFilename) }
    catch (failure) {
      const status = failure.response?.status
      setError(status === 403 ? 'You do not have access to this attachment.' : status === 401 ? 'Your session has expired. Please sign in again.' : 'The attachment could not be downloaded. Please retry.')
    } finally { setBusy(false) }
  }
  return <section className="card section-card mb-4" aria-label="Attachments"><div className="card-body">
    <h2 className="h6">Attachments</h2>
    {notice && <div className="alert alert-success" role="status">{notice}</div>}
    {error && <div className="alert alert-danger" role="alert">{error} <button className="btn btn-sm btn-outline-secondary" onClick={load} disabled={busy || loading}>Reload attachments</button></div>}
    {loading ? <p role="status">Loading attachments…</p> : items.length === 0 ? <p className="text-secondary">No screenshots attached.</p> : <ul className="list-group mb-3">
      {items.map((item) => <li className="list-group-item d-flex flex-wrap gap-2 align-items-center" key={item.id}>
        <div className="flex-grow-1 text-break"><div className="fw-semibold">{item.originalFilename}</div><div className="small text-secondary">{(item.fileSize / 1024).toFixed(1)} KB · {item.uploadedBy} · {formatDate(item.uploadedAt)}</div></div>
        <button className="btn btn-sm btn-outline-primary" disabled={busy} onClick={() => download(item)} aria-label={`Download ${item.originalFilename}`}>Download</button>
      </li>)}
    </ul>}
    {canUpload && <form onSubmit={upload}><ImagePicker files={files} onChange={setFiles} disabled={busy} /><button className="btn btn-primary" disabled={busy || !files.length}>{busy ? 'Please wait…' : 'Upload screenshots'}</button></form>}
  </div></section>
}
