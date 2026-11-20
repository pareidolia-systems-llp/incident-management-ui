import { useCallback, useEffect, useRef, useState } from 'react'
import { getAttachments, uploadAttachments, downloadAttachment } from '../api/attachments'
import { saveDownload } from '../utils/download'
import { formatDate, getErrorMessage } from '../utils/incident'
import ImagePicker from './ImagePicker'

export default function IncidentAttachments({ incidentId, canUpload, onUploaded, phase2Mode = false, expectedVersion, onAccessFailure }) {
  const [items, setItems] = useState([])
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const accessFailure = useRef(onAccessFailure)
  useEffect(() => { accessFailure.current = onAccessFailure }, [onAccessFailure])
  const load = useCallback(async () => {
    setLoading(true)
    try { setItems(await getAttachments(incidentId)); setError('') }
    catch (failure) {
      if (phase2Mode) { setItems([]); setFiles([]); if ([401, 403, 404].includes(failure.response?.status)) accessFailure.current?.() }
      setError(phase2Mode ? attachmentAccessMessage(failure) : getErrorMessage(failure, 'Attachments could not be loaded. Please retry.'))
    }
    finally { setLoading(false) }
  }, [incidentId, phase2Mode])
  useEffect(() => { void Promise.resolve().then(load) }, [load])
  async function upload(event) {
    event.preventDefault()
    if (busy || !files.length || !canUpload || (phase2Mode && (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0))) return
    setBusy(true); setError(''); setNotice('')
    try {
      await uploadAttachments(incidentId, files, phase2Mode ? expectedVersion : undefined)
      setFiles([])
      setNotice('Screenshots uploaded successfully.')
      await load()
      await onUploaded()
    } catch (failure) {
      const status = failure.response?.status
      if (phase2Mode && [401, 403, 404].includes(status)) { setItems([]); setFiles([]); await onAccessFailure?.() }
      if (phase2Mode && status === 409) { setFiles([]); await onUploaded() }
      setError(phase2Mode && status === 409 ? 'The incident changed. The latest version has been loaded; please select your files and try again.' : phase2Mode ? attachmentAccessMessage(failure) : getErrorMessage(failure, 'Screenshots could not be uploaded. Please retry.'))
    }
    finally { setBusy(false) }
  }
  async function download(item) {
    setBusy(true); setError('')
    try { saveDownload(await downloadAttachment(incidentId, item.id), item.originalFilename) }
    catch (failure) {
      const status = failure.response?.status
      if (phase2Mode && [401, 403, 404].includes(status)) { setItems([]); setFiles([]); accessFailure.current?.() }
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

function attachmentAccessMessage(failure) {
  const status = failure.response?.status
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 403) return 'You do not have access to these attachments.'
  if (status === 404) return 'These attachments are unavailable.'
  return 'Attachments could not be loaded. Please retry.'
}
