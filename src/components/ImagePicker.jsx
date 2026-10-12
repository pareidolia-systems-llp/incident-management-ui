import { useId, useState } from 'react'

export default function ImagePicker({ files, onChange, disabled }) {
  const id = useId()
  const [error, setError] = useState('')
  function select(event) {
    const selected = [...files, ...Array.from(event.target.files || [])]
    event.target.value = ''
    if (selected.length > 5) { setError('Select up to 5 images per upload.'); return }
    if (selected.some((file) => !['image/png', 'image/jpeg'].includes(file.type))) {
      setError('Only PNG and JPEG screenshots are allowed.'); return
    }
    if (selected.some((file) => file.size === 0 || file.size > 5 * 1024 * 1024)) {
      setError('Each screenshot must contain an image and be no larger than 5 MB.'); return
    }
    setError('')
    onChange(selected)
  }
  return <div>
    <label className="form-label fw-semibold" htmlFor={id}>Screenshots / Supporting Images</label>
    <input id={id} type="file" className="form-control" accept="image/png,image/jpeg" multiple onChange={select} disabled={disabled} aria-describedby={`${id}-help`} />
    <p id={`${id}-help`} className="form-text">Optional. Up to 5 PNG or JPEG images per upload, 5 MB each; maximum 20 million pixels per image.</p>
    {error && <div className="alert alert-warning" role="alert">{error}</div>}
    {files.length > 0 && <ul className="list-group mb-3">{files.map((file, index) => <li className="list-group-item d-flex flex-wrap align-items-center gap-2" key={`${file.name}-${index}`}>
      <span className="text-break flex-grow-1">{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
      <button type="button" className="btn btn-sm btn-outline-secondary" disabled={disabled} aria-label={`Remove ${file.name}`} onClick={() => { onChange(files.filter((_, item) => item !== index)); setError('') }}>Remove</button>
    </li>)}</ul>}
  </div>
}
