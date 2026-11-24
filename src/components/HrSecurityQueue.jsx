import { useEffect, useRef, useState } from 'react'
import { getCurrentUser } from '../api/auth'
import {
  getHrSecurityQueue,
  classifyHrIncident,
  authorizeHrHead
} from '../api/hrSecurity'

export default function HrSecurityQueue({ onChanged }) {
  const [items, setItems] = useState([])
  const [status, setStatus] = useState('loading')
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const [busy, setBusy] = useState(false)

  const mounted = useRef(false)
  const submitting = useRef(false)

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    let live = true

    setItems([])
    setStatus('loading')

    async function load() {
      try {
        const current = await getCurrentUser()

        if (!live) return

        if (current?.canAccessHrWorkspace !== true) {
          setStatus('denied')
          return
        }

        const queue = await getHrSecurityQueue()

        if (live) {
          setItems(queue)
          setStatus('ready')
        }
      } catch (error) {
        if (!live) return

        setItems([])
        setStatus(
          [401, 403, 404].includes(error?.response?.status)
            ? 'denied'
            : 'error'
        )
      }
    }

    void load()

    return () => { live = false }
  }, [revision])

  async function submit(item, reason) {
    const cleanReason = reason.trim()

    if (submitting.current
        || !cleanReason
        || cleanReason.length > 400) return

    submitting.current = true
    setBusy(true)
    setNotice('')

    let attempted = false

    try {
      const current = await getCurrentUser()

      if (!mounted.current) return

      if (current?.canAccessHrWorkspace !== true) {
        setItems([])
        setStatus('denied')
        return
      }

      attempted = true

      if (item.canClassify) {
        await classifyHrIncident(item, cleanReason)
      } else if (item.canAuthorizeHead) {
        await authorizeHrHead(item, cleanReason)
      } else {
        throw new Error('Action unavailable')
      }

      if (mounted.current) {
        setNotice('Security action recorded successfully.')
      }
    } catch (error) {
      if (mounted.current) {
        const code = error?.response?.status

        setNotice(
          [401, 403, 404].includes(code)
            ? 'Access denied or no longer available. Refreshing permissions.'
            : code === 409
              ? 'Incident security state changed. Review the refreshed queue.'
              : 'The outcome could not be confirmed. Review the refreshed queue before retrying.'
        )
      }
    } finally {
      submitting.current = false

      if (mounted.current) {
        setItems([])
        setStatus('loading')
        setBusy(false)
        setRevision(value => value + 1)
      }

      if (attempted) onChanged?.()
    }
  }

  return <section aria-label="Pending HR security actions">
    <div className="d-flex justify-content-between align-items-center mb-3">
      <h2 className="h5 mb-0">Pending Security Actions</h2>

      <button
        type="button"
        className="btn btn-sm btn-outline-secondary"
        disabled={busy || status === 'loading'}
        onClick={() => {
          setNotice('')
          setRevision(value => value + 1)
        }}>
        Refresh
      </button>
    </div>

    <p className="text-muted">
      Classify sensitive HR incidents and authorize case-specific access.
      These actions require a reason and are recorded in the security audit.
    </p>

    {notice && <p role="status">{notice}</p>}

    {status === 'loading' &&
      <p role="status">Loading authorized security actions...</p>}

    {status === 'denied' &&
      <p role="alert">HR security actions are unavailable for this account.</p>}

    {status === 'error' &&
      <p role="alert">Security queue unavailable. Please refresh.</p>}

    {status === 'ready' && items.length === 0 &&
      <p>No pending HR security actions.</p>}

    {status === 'ready' && items.map(item =>
      <SecurityAction
        key={[
          revision, item.incidentId, item.classificationVersion,
          item.scopeVersion, item.viewVersion, item.assignVersion
        ].join('-')}
        item={item}
        busy={busy}
        onSubmit={submit}
      />
    )}
  </section>
}

function SecurityAction({ item, busy, onSubmit }) {
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const action = item.canClassify
    ? 'Classify as Restricted'
    : 'Authorize My Case Access'

  const reasonId = `hr-security-reason-${item.incidentId}`

  return <form
    className="card section-card mb-3"
    onSubmit={event => {
      event.preventDefault()

      if (confirmed && reason.trim() && !busy) {
        void onSubmit(item, reason)
      }
    }}>

    <div className="card-body">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h3 className="h6">{item.incidentNumber}</h3>
        <span className="badge text-bg-secondary">
          {item.classification}
        </span>
      </div>

      <p>
        {item.canClassify
          ? 'Mark this HR incident as restricted.'
          : 'Authorize your case-specific VIEW and ASSIGN permissions.'}
      </p>

      <label className="form-label" htmlFor={reasonId}>
        Reason
      </label>

      <textarea
        id={reasonId}
        className="form-control mb-3"
        value={reason}
        maxLength={400}
        required
        disabled={busy}
        onChange={event => {
          setReason(event.target.value)
          setConfirmed(false)
        }}
      />

      <label className="form-check mb-3">
        <input
          type="checkbox"
          className="form-check-input"
          checked={confirmed}
          disabled={busy}
          onChange={event => setConfirmed(event.target.checked)}
        />
        <span className="form-check-label">
          I confirm this security action for {item.incidentNumber}.
        </span>
      </label>

      <button
        type="submit"
        className="btn btn-primary"
        disabled={busy || !reason.trim() || !confirmed}>
        {busy ? 'Processing...' : action}
      </button>
    </div>
  </form>
}
