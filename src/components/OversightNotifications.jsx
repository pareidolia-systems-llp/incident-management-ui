import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import apiClient from '../api/client'
import usePolling from '../hooks/usePolling'

const endpoint = '/api/incident-oversight-notifications'

export default function OversightNotifications() {
  const navigate = useNavigate()
  const [notices, setNotices] = useState([])
  const [unavailable, setUnavailable] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (_silent, current) => {
    try {
      const { data } = await apiClient.get(endpoint)
      if (current()) setNotices(data)
    } catch {
      if (current()) setNotices([])
    }
  }, [])
  usePolling(load)

  async function open(id) {
    setBusy(true)
    setUnavailable(false)
    try {
      const { data } = await apiClient.get(`${endpoint}/${encodeURIComponent(id)}/incident`)
      navigate(`/incidents/${data.incidentId}`)
    } catch {
      setUnavailable(true)
    } finally {
      setBusy(false)
    }
  }

  if (!notices.length) return null
  return <section className="card mb-3" aria-labelledby="oversight-heading">
    <div className="card-body">
      <h2 className="h5" id="oversight-heading">Oversight notifications</h2>
      {unavailable && <p role="alert">This incident is unavailable to your account.</p>}
      <ul className="mb-0">
        {notices.map((id) => <li key={id}>New incident reported.{' '}
          <button type="button" className="btn btn-link" onClick={() => open(id)} disabled={busy}>Open incident</button>
        </li>)}
      </ul>
    </div>
  </section>
}
