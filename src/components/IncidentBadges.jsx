import { labelize } from '../utils/incident'
const statusColors = { OPEN: 'primary', ASSIGNED: 'info', IN_PROGRESS: 'warning', RESOLVED: 'success', VALIDATED: 'success', CLOSED: 'secondary' }
const severityColors = { CRITICAL: 'danger', HIGH: 'warning', MEDIUM: 'info', LOW: 'secondary' }

export function StatusBadge({ status }) { return <span className={`badge badge-status text-bg-${statusColors[status] || 'secondary'}`}>{labelize(status)}</span> }
export function SeverityBadge({ severity }) { return <span className={`badge badge-severity text-bg-${severityColors[severity] || 'secondary'}`}>{labelize(severity)}</span> }
