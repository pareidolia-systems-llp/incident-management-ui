const stages = [
  ['Create Incident', 'Report what happened, who is affected, and which system or service is involved.'],
  ['Assignment', 'The incident is assigned to the responsible IT handler.'],
  ['Investigation', 'The handler investigates the issue and records findings, root cause, and actions taken.'],
  ['Resolution', 'The handler applies and records the final fix.'],
  ['Validation', 'The reviewer verifies that the resolution is effective.'],
  ['Closure', 'The original reporter confirms the issue is resolved and closes the incident.'],
]

export default function IncidentLifecycleGuide() {
  return <aside className="card section-card bg-light mb-3" aria-labelledby="incident-lifecycle-title">
    <div className="card-body">
      <h2 className="h6 mb-3" id="incident-lifecycle-title">Incident Lifecycle</h2>
      <ol className="row row-cols-1 row-cols-md-3 row-cols-xl-6 g-3 list-unstyled mb-3">
        {stages.map(([title, description], index) => <li className="col" key={title}>
          <div className="small fw-semibold mb-1"><span className="badge bg-secondary me-2" aria-hidden="true">{index + 1}</span>{title}</div>
          <p className="small text-secondary mb-0">{description}</p>
        </li>)}
      </ol>
      <p className="small text-secondary border-top pt-2 mb-0">After closure, a review may capture lessons learned and preventive actions.</p>
    </div>
  </aside>
}
