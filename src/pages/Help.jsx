import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import useAuth from '../auth/useAuth'
import PageTitle from '../components/PageTitle'
import { fieldGuidance } from '../utils/incidentGuidance'
import { issueTypes, issueTypeGuide, reporterDepartments, categoriesByIssueType, levels } from '../utils/incidentOptions'
import { helpSections, roleGuides, lifecycleStages, fieldGroups, scenarios, faqs } from '../utils/portalHelp'
import { labelize } from '../utils/incident'
import { employeeAssignmentEnabled } from '../api/assignment'
import { DepartmentAdministrationGuide, EmployeeAdministrationGuide } from '../components/AdministrationGuides'

const topicLabels = { 'sign-in': 'Sign In / Sign Out', assignment: 'Assignment', notifications: 'Notifications', availability: 'Feature Availability', purpose: 'Portal Purpose', 'incident-types': 'Incident Types', 'field-guide': 'Field Guide', screenshots: 'Screenshots & Evidence', 'after-submission': 'After Submission', 'audit-trail': 'Audit Trail', 'monthly-reports': 'Monthly Reports', scenarios: 'Common Scenarios', faq: 'FAQ' }

const sharedFields = { severity: 'severity', priority: 'priority', title: 'title', description: 'description', 'reporter-department': 'reporterDepartment', 'desk-number': 'deskNumber', 'issue-type': 'issueType', category: 'category', 'investigation-details': 'investigationDetails', 'root-cause': 'rootCause', 'actions-taken': 'actionsTaken', 'containment-action': 'containmentAction', 'corrective-action': 'correctiveAction', remarks: 'remarks', resolution: 'resolutionDetails', 'review-details': 'reviewDetails', 'lessons-learned': 'lessonsLearned', 'preventive-action': 'preventiveAction' }

function Section({ id, children }) {
  return <details id={id} className="help-section" tabIndex={-1} aria-labelledby={id + '-title'}>
    <summary><h2 id={id + '-title'}>{helpSections.find(([key]) => key === id)[1]}</h2></summary><div className="help-section-content">{children}</div>
  </details>
}

export default function Help() {
  const { user } = useAuth()
  const referralNavigation = useOutletContext()
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
  const guardedAssignment = employeeAssignmentEnabled()
  const hrIntake = import.meta.env.VITE_ROUTINE_HR_ISSUES_ENABLED === 'true'
  const employeeAdmin = user.canManageEmployees === true && import.meta.env.VITE_EMPLOYEE_MANAGEMENT_ENABLED === 'true'
  const departmentAdmin = user.canManageEmployees === true && import.meta.env.VITE_DEPARTMENT_ADMIN_ENABLED === 'true'
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
    <aside className="help-callout" aria-label="Guide availability"><p className="mb-0">Use the actions shown in your account. Features can be disabled for this portal, and some actions require separate permission for the incident or department.</p></aside>
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
        <li>Choose the issue type that best describes the problem. Use HR Issue for routine HR requests only if that choice is offered. For confidential material, follow your organization’s approved reporting instructions.</li>
        {guardedAssignment && <li>Select the organizational department responsible for the issue. Reporter Department is your own department. IT is available for incidents owned by IT.</li>}
        <li>Choose priority by urgency. For example, a blocked time-critical service needs faster attention than a request that can wait.</li>
        <li>Complete Title, Description, Issue Type, Category, Affected System, Severity, and Priority.</li>
        <li>Add optional screenshots after checking for sensitive information.</li><li>Submit once and wait for confirmation.</li>
        <li>Keep the generated incident number for reference.</li><li>Open the incident to track status, actions, and history.</li>
        <li>Add supporting images later through Attachments if needed.</li>
      </ol>
      <Link className="btn btn-primary" to={canCreate ? '/incidents/new' : '/incidents'}>{canCreate ? 'Create Incident' : 'View Incidents'}</Link>
    </Section>
    <Section id="assignment">
      {!guardedAssignment && <p>Ordinary reports without a Responsible Department may be automatically assigned to the configured IT owner. A report that needs restricted handling can stay Open without an owner.</p>}
      <p>Use Assign Incident only when the incident screen offers it and you are authorized to set the owner. Check the saved owner and Activity after submitting.</p>
      {guardedAssignment
        ? <p>Choose a handler from the portal’s eligible list and give a reason. Ordinary IT issues and service requests can go to authorized IT handlers even if they belong to a different department. Restricted cases follow separate access rules. If the incident changed, reload before trying again.</p>
        : <p>Employee-based assignment, reassignment and department transfer are unavailable in this portal configuration.</p>}
      {guardedAssignment && referralNavigation?.assignment && <p>Transfer Department is available only when the server returns an authorized route. It moves the incident to another department with an eligible handler and a verified handoff approval. If former-handler access still needs review, the transfer is blocked. Existing access is not silently removed.</p>}
      <p>Confidential cases can be absent from your list even if you are an IT handler or administrator. Ask your approved support contact about access without sharing confidential details.</p>
    </Section>
    <Section id="notifications">
      <p>Check Incident Details and Activity &amp; Work Log for changes and save confirmations.</p>
      {referralNavigation?.referralReview
        ? <p>Authorized HR reviewers can check <Link to="/hr-referrals">HR pending referrals</Link> for work awaiting a decision.</p>
        : <p>There is no separate in-app notification inbox for your account.</p>}
      <p>If email is enabled, approved recipients may receive a notice. The message may contain a portal link. Email does not grant incident access. Confidential details require separate authorization, and some incidents send no email at all.</p>
      <p>Do not expect email after every update. Check the portal before submitting the same incident again.</p>
    </Section>
    <Section id="availability">
      <h3>HR and confidential incidents</h3>
      <p>IT administrators do not automatically receive access to confidential HR cases. Authorized HR staff see cases within their approved access. A job title, department membership, department-head designation, or email notice does not grant incident access.</p>
      {hrIntake ? <p>Use HR Issue for a routine request if it appears in Create Incident.</p> : <p>HR Issue is unavailable in this portal configuration.</p>}
      {(employeeAdmin || departmentAdmin) && <><h3>Authorized administration</h3>
        {employeeAdmin && <><h4><Link to="/employees">Employee Management</Link></h4><EmployeeAdministrationGuide /></>}
        {departmentAdmin && <><h4><Link to="/department-administration">Department Administration</Link></h4><DepartmentAdministrationGuide /></>}
      </>}
      {referralNavigation?.referralIntake && <p>Designated IT coordinators can <Link to="/reassignment-referral">submit a reassignment referral</Link> using only the exact reference shared through the approved channel. An acceptance message only confirms the portal accepted the submission for processing.</p>}
      {referralNavigation?.referralReview && <p>Authorized HR coordinators can open a pending referral, check the case, and record a decision. Review the former handler’s case access before reassigning and obtain separate handoff approval before transferring.</p>}
      {guardedAssignment && referralNavigation?.assignment ? <p>If Request handoff approval is offered, select the destination and handler and give a reason. An independent reviewer uses the handoff panel to approve or reject a pending request, or revoke an approval. A revoked approval cannot be used for a future transfer. Only the approved records offered by the portal can be selected for transfer.</p>
        : <p>Transfer handoff requests and decisions are unavailable in this portal configuration.</p>}
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
        <section className="help-card"><h3>Incident Details: Attachments</h3><p>Use Upload only when it is offered and you have permission to add files. Permission to view or download an attachment does not grant permission to upload. Use this section to add later evidence or retry an unsuccessful upload.</p></section>
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
    <Section id="after-submission"><ol><li>The server generates a ticket number and records the signed-in reporter.</li><li>Check the initial status. Assigned means an owner has been set. Open means the incident is still waiting for assignment or review.</li><li>Your incident appears in your accessible incident list. Reporter sees their own incidents; other supported roles can view incidents according to their access.</li><li>IT Handler or Admin investigate, record evidence and actions, and resolve the issue.</li><li>The original reporter tests the fix, validates it, and then closes the incident—or reports that it still persists.</li><li>Reviewer or Admin may record a post-closure review.</li></ol><p>Open Incident Details to check progress and history; do not assume every update sends a notification.</p></Section>
    <Section id="audit-trail"><p>The incident history records meaningful actions, who performed them, when they occurred, and relevant changes or remarks. Examples include creation, automatic assignment, investigation, evidence updates, resolution, validation, closure, review, and Attachment Added for each successfully stored image.</p><p>Human actors come from the authenticated session. System identifies automatic actions such as initial assignment. Image content is stored separately from history; a safe filename may identify an attachment in its audit entry.</p></Section>
    <Section id="monthly-reports"><p><strong>Available to IT Handler and Admin.</strong> Open Incidents, choose the month in Monthly Incident Report, and select Download Excel.</p>
      {canReport && <Link className="btn btn-outline-primary mb-3" to="/incidents">Open monthly reports in Incidents</Link>}
      <p>Alternatively, select Date / time range and enter From Date and To Date. From Time and To Time are optional. Without times, the full selected days are included; with times, the exact boundaries apply. Filtering uses the original Reported At date/time.</p><p>The selected month uses the original Reported At date/time. The workbook includes Incidents and Lifecycle History sheets for incidents you are permitted to export. It contains current details and history, including events recorded after the selected month. Very long text may be continued in a supporting sheet.</p><p><strong>This is not a month-end snapshot.</strong> Screenshot binary data is not included. A month without incidents produces an empty report with its structure.</p>
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
