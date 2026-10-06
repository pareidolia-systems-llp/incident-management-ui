// Explanations only; workflow rules and validation remain in the existing pages.
export const fieldGuidance = {
  reporterDepartment: { text: 'When reporting, select the department you belong to.', example: 'Operations (Annotation)' },
  title: { text: 'When reporting, give a short summary of the issue and its impact.', example: 'VPN connection drops on office workstation' },
  description: { text: 'When reporting, describe what happened, when it started, and how it affects your work. Do not include passwords, tokens, or secrets.', example: 'Since 9 am, the VPN disconnects every few minutes, interrupting access to the finance application.' },
  issueType: { text: 'When reporting or reclassifying, choose the type of issue or request that best matches what is known.', example: 'Choose IT Issue for a VPN connection failure; choose Service Request for a software installation request.' },
  category: { text: 'After choosing an issue type, select the closest matching area of the issue.', example: 'For an IT issue involving VPN disconnections, choose Network / Connectivity.' },
  severity: { text: 'Choose the level of impact on people, systems, or information when reporting; reassess as the impact becomes clearer.', example: 'Consider whether a connection failure affects one workstation or prevents a whole department from working.' },
  priority: { text: 'Choose how urgently the incident needs attention when reporting; reassess if urgency changes.', example: 'Consider whether the affected work can wait or an imminent deadline needs attention sooner.' },
  affectedSystem: { text: 'When reporting, name the affected application, service, or device.', example: 'Office VPN on workstation FIN-023' },
  impactedUserOrDepartment: { text: 'When reporting, identify the people or departments affected.', example: 'Finance team at the Pune office' },
  investigationDetails: { text: 'During investigation, record what was checked and what was discovered.', example: 'Reviewed VPN logs and reproduced the connection failure on the affected workstation.' },
  rootCause: { text: 'Once identified during investigation, state the underlying reason for the incident, rather than just the symptom.', example: 'The network adapter was intermittently failing and dropping connectivity.' },
  actionsTaken: { text: 'During investigation, record troubleshooting or operational steps already performed.', example: 'Restarted the adapter, checked driver status, and tested connectivity from another network.' },
  containmentAction: { text: 'Record the immediate step taken to limit impact while a permanent fix is being prepared.', example: 'Moved the affected workstation to a backup network connection.' },
  correctiveAction: { text: 'Once the cause is identified, describe the action taken to correct it.', example: 'Replaced the faulty network adapter and updated the device driver.' },
  evidenceReference: { text: 'When supporting evidence is available, reference a ticket, screenshot, log entry, or approved internal record. Do not include passwords, tokens, credentials, or secrets.', example: 'Internal ticket IT-204: VPN log entry from 9:15 am.' },
  escalationRequired: { text: 'Indicates whether another responsible person or team is needed because of impact, severity, expertise, or authority requirements.' },
  escalationDetails: { text: 'When escalating, explain why additional help or authority is needed and which person or team is needed.', example: 'Network team assistance is needed because connectivity failures now affect the entire floor.' },
  resolutionDetails: { text: 'When resolving, explain how the incident was resolved and the final fix applied.', example: 'Replaced the faulty network adapter and verified normal connectivity with the user.' },
  validationDetails: { text: 'After resolution, record verification that the fix is effective and note the evidence used to confirm it.', example: "Connectivity was retested from the user's workstation and the affected application opened successfully." },
  remarks: { text: 'When saving this action, add any useful context or reason not already captured in the other fields.', example: 'The user was available for testing after 2 pm.' },
  reviewDetails: { text: 'During the post-closure review, summarize how the incident was handled and what could be improved.', example: 'The backup connection reduced disruption, but a spare adapter would have shortened recovery.' },
  lessonsLearned: { text: 'During review, record what the organization learned and what should improve.', example: 'Keep spare network adapters available so similar failures can be addressed sooner.' },
  preventiveAction: { text: 'During review, record an action intended to reduce the chance of recurrence.', example: 'Add network-adapter health checks to quarterly workstation maintenance.' },
}

export const actionGuidance = {
  assign: 'Assign responsibility for handling this incident while it is open.',
  investigation: 'Update findings and work performed as the investigation progresses.',
  resolve: 'Record the final fix when the incident has been resolved; validation follows this step.',
  validate: 'Independently verify the resolution before the incident proceeds to closure.',
  close: 'Formally complete the incident workflow once the required resolution and verification steps have been completed.',
  review: 'After closure, record the review, lessons learned, and actions to prevent recurrence.',
  reclassify: 'Update the issue type when new information changes how the incident should be classified.',
  severity: 'Update the impact level as the extent of the incident becomes clearer.',
  priority: 'Update the urgency when the need for attention changes.',
  escalate: 'Request additional expertise or authority when the incident needs another responsible person or team.',
  evidence: 'Add a reference to supporting evidence when it becomes available.',
}

export function guidanceDescription(name, id, hasError) {
  return [fieldGuidance[name] && `${id}-help`, hasError && `${id}-error`].filter(Boolean).join(' ') || undefined
}
