import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import useAuth from '../auth/useAuth'
import PageTitle from '../components/PageTitle'
import { fieldGuidance } from '../utils/incidentGuidance'
import { issueTypes, issueTypeGuide, reporterDepartments, categoriesByIssueType, levels } from '../utils/incidentOptions'
import { helpSections, roleGuides, lifecycleStages, fieldGroups, scenarios, faqs } from '../utils/portalHelp'
import { labelize } from '../utils/incident'

const topicLabels = { 'sign-in': 'Sign In / Sign Out', assignment: 'Assignment', notifications: 'Notifications', availability: 'Development Features', purpose: 'Portal Purpose', 'incident-types': 'Incident Types', 'field-guide': 'Field Guide', screenshots: 'Screenshots & Evidence', 'after-submission': 'After Submission', 'audit-trail': 'Audit Trail', 'monthly-reports': 'Monthly Reports', scenarios: 'Common Scenarios', faq: 'FAQ' }

const sharedFields = { severity: 'severity', priority: 'priority', title: 'title', description: 'description', 'reporter-department': 'reporterDepartment', 'desk-number': 'deskNumber', 'issue-type': 'issueType', category: 'category', 'investigation-details': 'investigationDetails', 'root-cause': 'rootCause', 'actions-taken': 'actionsTaken', 'containment-action': 'containmentAction', 'corrective-action': 'correctiveAction', remarks: 'remarks', resolution: 'resolutionDetails', 'review-details': 'reviewDetails', 'lessons-learned': 'lessonsLearned', 'preventive-action': 'preventiveAction' }

function Section({ id, children }) {
  return <details id={id} className="help-section" tabIndex={-1} aria-labelledby={id + '-title'}>
    <summary><h2 id={id + '-title'}>{helpSections.find(([key]) => key === id)[1]}</h2></summary><div className="help-section-content">{children}</div>
  </details>
}

export default function Help() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { hash, key } = useLocation()
  useEffect(() => {
    if (!hash) return
    let id
    try { id = decodeURIComponent(hash.slice(1)) } catch { return }
    const target = document.getElementById(id)
    if (!target) return
    for (let parent = target; parent; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS') parent.open = true
    }
    const focusTarget = target.tagName === 'DETAILS' ? target.querySelector('summary') : target
    focusTarget.focus({ preventScroll: true })
    target.scrollIntoView?.({ block: 'start' })
  }, [hash, key])
  const canCreate = ['REPORTER', 'ADMIN'].includes(user.role)
  const canReport = ['IT_HANDLER', 'ADMIN'].includes(user.role)
  return <article className="portal-help" id="help-top" tabIndex={-1}>
    <header className="help-header">
      <span className="help-eyebrow">Portal guide</span>
      <PageTitle title="How to Use This Portal" description="Practical guidance for reporting, handling, reviewing and tracking incidents." />
      <p className="mb-3 text-secondary">Take the Quick Tour, then open a topic for detailed guidance.</p>
      <nav className="help-role-links" aria-label="Guidance by role"><span>Guidance for</span>{roleGuides.map(({ id, label }) => <Link key={id} to={'/help#' + id}>{label}</Link>)}</nav>
    </header>
    <section className="help-goals" aria-labelledby="help-goals-title">
      <h2 id="help-goals-title">What do you want to do?</h2>
      <div className="help-task-grid">{[
        ['quick-start', 'Report an Issue', 'Create → Track → Validate → Close'],
        ['work-logs', 'Work on an Incident', 'Investigate → Log Work → Resolve'],
        ['my-work-log', 'Record Other IT Work', 'Use My Work Log for work with no incident ticket'],
        ['monthly-reports', 'Generate Reports', 'Filter incidents by month or date/time range'],
      ].map(([id, title, text]) => <Link className="help-task-card" key={id} to={'/help#' + id} aria-current={hash === '#' + id ? 'location' : undefined}><strong>{title}<span aria-hidden="true"> →</span></strong><span>{text}</span></Link>)}</div>
    </section>
    <aside className="help-callout" aria-label="Guide availability"><p className="mb-0">This guide describes the current production workflow. Employee Management, employee-based assignment and case-specific access controls are development features awaiting authorization and release. Use the production instructions below.</p></aside>
    <QuickTour />
    <section className="help-comparison" aria-labelledby="action-comparison-title">
      <h2 id="action-comparison-title">Which action should I use?</h2>
      <div className="help-task-grid">{[
        ['Investigation / Save Progress', 'What did you discover?', 'VPN certificate is expired.'],
        ['Log Work on This Incident', 'What did you do?', 'Renewed certificate and restarted the VPN service.'],
        ['Resolve Incident', 'Is the issue now fixed?', 'Connectivity restored and ready for reporter validation.'],
        ['My Work Log', 'Work performed without an incident.', 'Checked backup jobs and server health.'],
      ].map(([title, question, example]) => <div className="help-card" key={title}><h3>{title}</h3><p className="fw-semibold">{question}</p><p className="mb-0"><strong>Example:</strong> {example}</p></div>)}</div>
    </section>
    <h2 className="mt-4" id="detailed-guide-title">Detailed Guide</h2>
    <div className="help-navigation">
      <nav className="help-desktop-topics" aria-labelledby="help-topics-title">
        <h3 id="help-topics-title">Choose a topic</h3>
        <div className="help-contents">{helpSections.map(([id, title], index) => <Link key={id} to={'/help#' + id} aria-current={hash === '#' + id ? 'location' : undefined}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{topicLabels[id] || title}</Link>)}</div>
      </nav>
      <div className="help-mobile-topics"><label htmlFor="help-jump">Jump to section</label><select id="help-jump" className="form-select" value={helpSections.some(([id]) => hash === '#' + id) ? hash.slice(1) : ''} onChange={event => { if (event.target.value) navigate('/help#' + event.target.value) }}><option value="">Choose a topic</option>{helpSections.map(([id, title]) => <option key={id} value={id}>{topicLabels[id] || title}</option>)}</select></div>
    </div>
    <Section id="sign-in">
      <ol><li>Open the portal and select Sign in with Google.</li><li>Choose your approved company Google account. Your name and portal role appear after sign-in.</li><li>Use Sign Out in the header when finished, especially on a shared computer.</li></ol>
      <p>If the wrong account is shown, sign out and choose the correct company account. Never share a password, verification code or session cookie with support.</p>
    </Section>
    <Section id="quick-start">
      <ol className="help-quick-steps">
        <li>Sign in with your company Google account.</li><li>Open Create Incident (Reporter or Admin).</li>
        <li>Choose the incident type that matches what you know.</li>
        <li>Complete Title, Description, Issue Type, Category, Affected System, Severity, and Priority.</li>
        <li>Add optional screenshots after checking for sensitive information.</li><li>Submit once and wait for confirmation.</li>
        <li>Keep the generated incident number for reference.</li><li>Open the incident to track status, actions, and history.</li>
        <li>Add supporting images later through Attachments if needed.</li>
      </ol>
      <Link className="btn btn-primary" to={canCreate ? '/incidents/new' : '/incidents'}>{canCreate ? 'Create Incident' : 'View Incidents'}</Link>
    </Section>
    <Section id="assignment">
      <p>New incidents are automatically assigned to the configured IT owner and start as Assigned. The reporter does not choose an employee while creating an incident in the current production workflow.</p>
      <p>For an existing Open incident, IT Handler or Admin may use Assign Incident when that action is offered. Enter the approved owner in Assigned Owner and add useful remarks. Check the saved owner and Activity entry after submitting. If an ownership change is needed and the action is unavailable, contact IT.</p>
      <p>Employee search, proposed handlers, authorized triage and version-checked reassignment are development workflows awaiting release.</p>
    </Section>
    <Section id="notifications">
      <p>Track progress in Incident Details and Activity &amp; Work Log. Status messages and warnings on the page confirm saves, failures and screenshot-upload results. The current workflow has no separate in-app notification inbox.</p>
      <p>New incidents generate generic email notifications to the configured IT, HR and relevant department recipients. Emails identify the incident number and ask recipients to sign in; sensitive incident details are excluded. An email does not grant portal access.</p>
      <p>Portal-link email improvements are awaiting release. Until then, open the portal through your usual trusted address and find the incident number. Do not expect email for every status change, comment or reassignment.</p>
      <p>If an email is delayed, use the saved incident number to check the portal before creating another report. Ask IT to check delivery if needed.</p>
    </Section>
    <Section id="availability">
      <p>Employee IDs and employee records, employee-based handler selection, trusted Standard or Restricted classification, and case-specific permissions are being verified in development. They are not part of these production instructions.</p>
      <p>HR colleagues follow the permissions of their assigned portal role. An HR job title or department-head designation alone does not grant incident administration or employee-maintenance access. Routine employee changes should use the approved HR/IT process until the portal workflow is released.</p>
      <p>In the development design, a reporter can suggest a handler. That suggestion gives no incident access. Authorized staff must classify the case and check permissions and handler eligibility before confirming assignment. Availability will be announced after authorization and testing.</p>
    </Section>
    <Section id="purpose"><p>This portal records internal IT faults, service requests, suspected or confirmed information-security incidents, and major security incidents. It keeps the reported impact, investigation, evidence, resolution, and review together so authorized colleagues can follow the work.</p></Section>
    <Section id="lifecycle">
      <ol className="help-lifecycle">{lifecycleStages.map(([title, text]) => <li key={title}><h3>{title}</h3><p>{text}</p></li>)}</ol>
      <p><strong>If the fix does not work:</strong> the original reporter can select Issue Still Persists on a Resolved incident. Feedback returns it to In Progress for further investigation. Validation and post-closure review are separate actions.</p>
    </Section>
    <Section id="roles"><div className="help-grid">{roleGuides.map(({ role, label, id, text, links }) => <section className="help-card help-role-target" tabIndex={-1} id={id} key={role}>
      <h3>{label}</h3><p>{text}</p>
      <div className="help-role-actions">{links.map(([anchor, name]) => <Link className="btn btn-sm btn-outline-secondary" key={anchor} to={'/help#' + anchor}>{name}</Link>)}</div>
    </section>)}</div><aside className="help-info" aria-label="About role permissions"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v1" /></svg><p>Available actions depend on your role, identity, and the current incident status. Help links do not grant additional permissions; the application continues to enforce access rules.</p></aside></Section>
    <Section id="incident-types"><p>Issue Type describes the kind of problem or request. It is separate from the trusted confidentiality classification being developed. Choosing a department, category or issue type does not establish permission to view an incident.</p><p>Issue Type describes the kind of incident or request. Category describes the technical area. For example, an IT Issue involving a Windows service belongs to Server / Infrastructure; MySQL connectivity belongs to Database; antivirus belongs to Security / Endpoint. Keep Other for cases without a closer match.</p><div className="help-grid">{issueTypes.map(type => <section className="help-card help-type-card" key={type}>
      <h3>{labelize(type)}</h3><p>{issueTypeGuide[type].meaning}</p><p><strong>Example:</strong> {issueTypeGuide[type].example}</p>
      <details><summary>Categories for {labelize(type)}</summary><ul>{categoriesByIssueType[type].map(category => <li key={category}>{category}</li>)}</ul></details>
    </section>)}</div></Section>
    <Section id="field-guide">
      <div className="help-callout"><div className="help-impact-comparison"><p><strong>Affected System = WHAT is affected.</strong> For example, VPN or HR Portal.</p><p><strong>Impacted User / Department = WHO is affected.</strong> For example, Operations Team or HR Department.</p></div><p>Reporter Department identifies your own department; it can differ from the affected team.</p></div>
      <p>Open a field below for meaning, when to use it, an example, and mistakes to avoid. Required fields are identified; optional information should still be useful and accurate.</p>
      {fieldGroups.map(group => <div className="help-field-group" key={group.title}><h3>{group.title}</h3>{group.fields.map(([id, label, meaning, when, good, avoid]) => <details id={id} className="help-field" key={id}>
        <summary>{label}</summary><div><p>{fieldGuidance[sharedFields[id]]?.text || meaning}</p><p><strong>When:</strong> {when}</p><p><strong>Good example:</strong> {good}</p><p><strong>Avoid:</strong> {avoid}</p>
        {id === 'reporter-department' && <p><strong>Available departments:</strong> {reporterDepartments.join('; ')}.</p>}
        {['severity', 'priority'].includes(id) && <p><strong>Available levels:</strong> {levels.map(labelize).join(', ')}.</p>}
      </div></details>)}</div>)}
      <h3>Automatically recorded information</h3><p>Incident Number identifies the ticket. Reported By comes from your signed-in identity; Reported At records when it was reported. Status follows the workflow. Created At and Updated At record creation and updates. Validation, closure, and review actors/times are recorded when those actions succeed. These are records to read, not identities to enter on someone else's behalf.</p>
      <p><strong>Three different actions:</strong> Containment limits immediate impact; Corrective Action fixes this incident; Preventive Action reduces future recurrence.</p>
    </Section>
    <Section id="screenshots">
      <aside className="help-warning" aria-label="Sensitive information warning"><strong>Check every image before uploading.</strong> Never upload passwords, tokens, credentials, API keys, secrets, session cookies, or unnecessary confidential information. Redact sensitive content, including unrelated personal information.</aside>
      <div className="help-grid">
        <section className="help-card"><h3>During Create Incident</h3><p>Use the optional Screenshots / Supporting Images picker. You can remove selected files before submitting. The incident is created first, then images are uploaded. If image upload fails, the incident remains saved; retry through its Attachments section.</p></section>
        <section className="help-card"><h3>During Update Evidence Reference</h3><p>IT Handler or Admin can use this action when offered on a non-closed incident. Evidence Reference is still required; Remarks and screenshots are optional. The evidence update saves first, then selected images upload. An evidence-update failure prevents image upload. If only upload fails, the saved update remains and a partial-success warning explains the next step.</p></section>
        <section className="help-card"><h3>Incident Details: Attachments</h3><p>Reporter, IT Handler, and Admin can upload images on incidents they can access, including after closure. Reviewer can view/download but cannot upload. Use this section to add later evidence or retry an unsuccessful upload.</p></section>
      </div>
      <p><strong>File rules:</strong> PNG or JPEG only, maximum 5 MB per file and 5 files per upload. Images must also meet the server's content validation, including its 20-million-pixel limit. You may upload another batch later. A file extension alone does not make a file valid.</p>
      <p>Evidence Reference is text describing a screenshot, log, ticket, or approved internal record. The actual screenshot belongs in Attachments. Successful image uploads create their own Attachment Added audit entries; the evidence update remains a separate event.</p>
    </Section>
    <Section id="issue-still-persists"><p>On a Resolved incident, the original reporter can choose Issue Still Persists. Describe what is still not working, optionally reference evidence, and select Supporting Screenshots.</p><p>Feedback saves first and returns the incident to In Progress. Screenshots then upload separately. If an upload fails, your feedback and status remain saved; retry screenshots through Attachments. Activity shows the feedback and each successful attachment as separate events.</p></Section>
    <Section id="work-logs"><p>IT Handler and Admin use Investigation / Save Progress in the inline workspace for diagnostic findings and observations, Log Work on This Incident for actions performed without changing status, and Resolve Incident for the final fix. Less-frequent administrative updates are in More Actions.</p><h3>More Actions — IT Handler and Admin only</h3><dl className="help-more-actions">
      <dt>Reclassify Incident</dt><dd>Use when investigation shows the original Issue Type was incorrect.</dd>
      <dt>Reassess Severity</dt><dd>Use when the actual impact becomes clearer. A reason is required and recorded in Activity.</dd>
      <dt>Reassess Priority</dt><dd>Use when urgency changes after investigation. A reason is required and recorded in Activity.</dd>
      <dt>Escalate Incident</dt><dd>Use when additional expertise, authority or management attention is required.</dd>
      <dt>Update Evidence Reference</dt><dd>Add a reference to supporting logs, records or other approved evidence.</dd>
    </dl><p>These actions are not available to reporters.</p><p>Activity &amp; Work Log is one chronological timeline. Filter by All, Updates, Work Notes, or Lifecycle to find the relevant entries.</p></Section>
    <Section id="my-work-log"><p>IT Handler and Admin can record standalone work in My Work Log. Entries are private to their owner; Reporter has no access.</p><p>Add Work Entry starts with the current local date/time. Adjust it for earlier work, choose a category, and enter a summary, optional details and duration. Entries persist separately from incident work notes; editing and deleting are not available.</p></Section>
    <Section id="after-submission"><ol><li>The server generates a ticket number and records the signed-in reporter.</li><li>A default IT owner is assigned automatically; the initial status is Assigned.</li><li>Your incident appears in your accessible incident list. Reporter sees their own incidents; other supported roles can view incidents according to their access.</li><li>IT Handler or Admin investigate, record evidence and actions, and resolve the issue.</li><li>The original reporter tests the fix, validates it, and then closes the incident—or reports that it still persists.</li><li>Reviewer or Admin may record a post-closure review.</li></ol><p>Open Incident Details to check progress and history; do not assume every update sends a notification.</p></Section>
    <Section id="audit-trail"><p>The incident history records meaningful actions, who performed them, when they occurred, and relevant changes or remarks. Examples include creation, automatic assignment, investigation, evidence updates, resolution, validation, closure, review, and Attachment Added for each successfully stored image.</p><p>Human actors come from the authenticated session. System identifies automatic actions such as initial assignment. Image content is stored separately from history; a safe filename may identify an attachment in its audit entry.</p></Section>
    <Section id="monthly-reports"><p><strong>Available to IT Handler and Admin.</strong> Open Incidents, choose the month in Monthly Incident Report, and select Download Excel.</p>
      {canReport && <Link className="btn btn-outline-primary mb-3" to="/incidents">Open monthly reports in Incidents</Link>}
      <p>Alternatively, select Date / time range and enter From Date and To Date. From Time and To Time are optional. Without times, the full selected days are included; with times, the exact boundaries apply. Filtering uses the original Reported At date/time.</p><p>The selected month uses the original Reported At date/time. The workbook includes Incidents and Lifecycle History sheets, with current incident details and their history, including events recorded after the selected month. Very long text may be continued in a supporting sheet.</p><p><strong>This is not a month-end snapshot.</strong> Screenshot binary data is not included. A month without incidents produces an empty report with its structure.</p>
    </Section>
    <Section id="scenarios"><div className="help-grid">{scenarios.map(scenario => <section className="help-card" key={scenario.title}><h3>{scenario.title}</h3><p><strong>Type:</strong> {scenario.type}</p><p><strong>WHAT:</strong> {scenario.system}<br /><strong>WHO:</strong> {scenario.people}</p><p><strong>Title:</strong> {scenario.summary}</p><p>{scenario.description}</p><p>{scenario.image}</p></section>)}</div></Section>
    <section id="faq" className="help-faq" tabIndex={-1} aria-labelledby="faq-title"><h2 id="faq-title">Frequently Asked Questions</h2>{faqs.slice(0, 7).map(([question, answer]) => <details className="help-field" key={question}><summary>{question}</summary><div><p>{answer}</p></div></details>)}<details className="help-field"><summary>More questions</summary><div>{faqs.slice(7).map(([question, answer]) => <details className="help-field" key={question}><summary>{question}</summary><div><p>{answer}</p></div></details>)}</div></details></section>
    <Link className="help-back" to="/help#help-top">↑ Back to top</Link>
  </article>
}

const tourSteps = [
  ['Create an Incident', 'Describe what happened and the affected system.', 'Choose the closest Issue Type and Category, then set Severity and Priority based on impact and urgency.'],
  ['Understand Issue Type, Category, Severity and Priority', 'Issue Type is the kind of incident or request; Category is the technical area.', 'Severity describes impact. Priority describes urgency. Reporter selections are the initial assessment; IT may reassess with an audited reason.'],
  ['How IT Works on an Incident', 'Type findings and actions directly in Work on Incident, then select Save Progress. Log Work on This Incident records actions without changing status.', 'Resolve Incident saves unsaved investigation first and opens the resolution fields in the same workspace. More Actions contains administrative updates.'],
  ['Resolution and Reporter Validation', 'The original reporter tests the fix when the incident is Resolved.', 'Validate the resolution if it works, then close the incident.'],
  ['What Happens When "Issue Still Persists"', 'The original reporter describes what still fails and can add supporting screenshots.', 'Feedback returns the incident to In Progress. If screenshots fail to upload, retry through Attachments.'],
  ['My Work Log', 'IT Handler and Admin can record their own standalone work, separate from an incident.', 'Work time defaults to now and can be adjusted for earlier work. Each person sees only their own entries.'],
  ['Reports and Date/Time Filters', 'IT Handler and Admin can download reports from Incidents by month or date/time range.', 'Times are optional. The range filters the incident report time and includes the matching incidents’ history.'],
]

function QuickTour() {
  const [step, setStep] = useState(0)
  const [title, ...lines] = tourSteps[step]
  return <section className="quick-tour" aria-labelledby="quick-tour-title">
    <h2 id="quick-tour-title">Quick Tour</h2>
    <div className="help-journeys">
      <details><summary>Reporter journey</summary><ol><li>Create Incident</li><li>Track Progress</li><li>Test the Resolution</li><li>Validate OR choose Issue Still Persists</li><li>Close the Incident</li></ol></details>
      <details><summary>IT journey</summary><ol><li>Review the incident type</li><li>Investigation / Save Progress</li><li>Log Work on This Incident</li><li>Use More Actions when necessary</li><li>Resolve Incident</li><li>Wait for reporter validation</li></ol></details>
      <details><summary>Independent IT work</summary><p>My Work Log = work performed by IT that is not associated with an incident.</p></details>
    </div>
    <nav className="tour-step-nav" aria-label="Quick Tour steps">{tourSteps.map(([name], index) => <button key={name} className={step === index ? 'current' : ''} aria-current={step === index ? 'step' : undefined} aria-label={`Step ${index + 1}: ${name}`} onClick={() => setStep(index)}>{index + 1}</button>)}</nav>
    <div className="quick-tour-slide" aria-live="polite" aria-atomic="true">
      <p className="small text-secondary">{step + 1} of {tourSteps.length}</p>
      <h3>{title}</h3>{lines.map(line => <p key={line}>{line}</p>)}
    </div>
    <div className="d-flex flex-wrap justify-content-between gap-2 mt-3">
      <button className="btn btn-outline-secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>Previous</button>
      <button className="btn btn-primary" disabled={step === tourSteps.length - 1} onClick={() => setStep(step + 1)}>Next →</button>
    </div>
  </section>
}
