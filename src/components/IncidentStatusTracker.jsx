import { lifecycleStages } from '../utils/incidentLifecycle'

export default function IncidentStatusTracker({ incident }) {
  return <section className="card section-card mb-3" aria-labelledby="incident-progress-title">
    <div className="card-body py-3">
      <h2 className="h6 mb-2" id="incident-progress-title">Incident progress</h2>
      <ol className="d-flex flex-wrap gap-2 list-unstyled mb-0" aria-label="Incident lifecycle stages">
        {lifecycleStages.map(([status, label], index) => {
          const current = incident.status === status
          return <li key={status} aria-current={current ? 'step' : undefined}
            className={`small border rounded px-2 py-1 ${current ? 'text-bg-primary border-primary fw-semibold' : 'text-secondary'}`}>
            <span aria-hidden="true">{index + 1}. </span>{label}{current && ' (current)'}
          </li>
        })}
      </ol>
      {incident.status === 'IN_PROGRESS' && incident.issueStillPersists && <p className="small mb-0 mt-2">
        Previously resolved → Issue Still Persists → In Progress (current). The incident has returned to investigation.
      </p>}
    </div>
  </section>
}
