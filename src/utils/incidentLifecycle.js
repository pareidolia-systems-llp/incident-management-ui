export const lifecycleStages = [
  ['OPEN', 'Reported'],
  ['ASSIGNED', 'Assigned'],
  ['IN_PROGRESS', 'In Progress'],
  ['RESOLVED', 'Resolved'],
  ['VALIDATED', 'Reporter Validation'],
  ['CLOSED', 'Closed'],
]

// Presentation only: the existing action/authorization logic decides whether
// this empty state is displayed. This helper grants no actions.
export function reporterWaitingMessage(incident) {
  const validation = 'You will be able to validate the resolution once the incident is resolved.'
  switch (incident.status) {
    case 'OPEN': return ['No action required from you right now.', 'Your incident has been reported and is awaiting assignment to IT.', validation]
    case 'ASSIGNED': return ['No action required from you right now.', 'Your incident has been assigned to the IT team for investigation.', validation]
    case 'IN_PROGRESS': return ['No action required from you right now.', incident.issueStillPersists ? 'The IT team is investigating this incident again after your feedback.' : 'The IT team is investigating this incident.', validation]
    case 'RESOLVED': return ['The IT team has recorded a resolution.', 'The original reporter can validate the fix or report that the issue still persists.']
    case 'VALIDATED': return ['The resolution has been validated.', 'The original reporter can now confirm closure.']
    case 'CLOSED': return ['This incident is closed.', 'No further action is required from you.']
    default: return ['No action required from you right now.', 'Check the activity below for the latest updates.']
  }
}
