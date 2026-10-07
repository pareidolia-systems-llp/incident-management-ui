const actionsByStatus = { OPEN: ['assign'], ASSIGNED: ['investigation', 'resolve'], IN_PROGRESS: ['investigation', 'resolve'], RESOLVED: ['validate'], VALIDATED: ['close'], CLOSED: ['review'] }

export function getLifecycleActions(incident, user) {
  const canPerformOperationalActions = ['IT_HANDLER', 'ADMIN'].includes(user.role)
  const canPerformReviewActions = ['REVIEWER', 'ADMIN'].includes(user.role)
  const reviewCompleted = incident.reviewedAt != null && String(incident.reviewedAt).trim() !== ''
  const actorEmail = typeof user.email === 'string' ? user.email.trim().toLowerCase() : ''
  const reporterEmail = typeof incident.reportedBy === 'string' ? incident.reportedBy.trim().toLowerCase() : ''
  const isOriginalReporter = actorEmail !== '' && reporterEmail !== '' && actorEmail === reporterEmail

  return (actionsByStatus[incident.status] || []).filter((actionKey) => {
    if (actionKey === 'close') return isOriginalReporter
    if (actionKey === 'validate') return canPerformReviewActions
    if (actionKey === 'review') return canPerformReviewActions && !reviewCompleted
    return canPerformOperationalActions
  })
}
