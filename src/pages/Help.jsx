import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import useAuth from '../auth/useAuth'
import PageTitle from '../components/PageTitle'
import { fieldGuidance } from '../utils/incidentGuidance'
import { issueTypes, issueTypeGuide, reporterDepartments, categoriesByIssueType, levels } from '../utils/incidentOptions'
import { helpSections, roleGuides, lifecycleStages, fieldGroups, scenarios, faqs } from '../utils/portalHelp'
import { labelize } from '../utils/incident'

const topicLabels = { purpose: 'Portal Purpose', 'incident-types': 'Incident Types', 'field-guide': 'Field Guide', screenshots: 'Screenshots & Evidence', 'after-submission': 'After Submission', 'audit-trail': 'Audit Trail', 'monthly-reports': 'Monthly Reports', scenarios: 'Common Scenarios', faq: 'FAQ' }

const sharedFields = { title: 'title', description: 'description', 'reporter-department': 'reporterDepartment', 'desk-number': 'deskNumber', 'issue-type': 'issueType', category: 'category', 'investigation-details': 'investigationDetails', 'root-cause': 'rootCause', 'actions-taken': 'actionsTaken', 'containment-action': 'containmentAction', 'corrective-action': 'correctiveAction', remarks: 'remarks', resolution: 'resolutionDetails', 'review-details': 'reviewDetails', 'lessons-learned': 'lessonsLearned', 'preventive-action': 'preventiveAction' }

function Section({ id, children }) {
  return <section id={id} className="help-section" tabIndex={-1} aria-labelledby={id + '-title'}>
    <h2 id={id + '-title'}>{helpSections.find(([key]) => key === id)[1]}</h2>{children}

  </section>
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
    if (target.tagName === 'DETAILS') target.open = true
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
      <p className="mb-3 text-secondary">Choose a topic below or follow the Quick Start guide.</p>
      <nav className="help-role-links" aria-label="Guidance by role"><span>Guidance for</span>{roleGuides.map(({ id, label }) => <Link key={id} to={'/help#' + id}>{label}</Link>)}</nav>
    </header>
    <div className="help-navigation">
      <nav className="help-desktop-topics" aria-labelledby="help-topics-title">
        <h2 id="help-topics-title">On this page</h2>
        <div className="help-contents">{helpSections.map(([id, title], index) => <Link key={id} to={'/help#' + id} aria-current={hash === '#' + id ? 'location' : undefined}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{topicLabels[id] || title}</Link>)}</div>
      </nav>
      <div className="help-mobile-topics"><label htmlFor="help-jump">Jump to section</label><select id="help-jump" className="form-select" value={helpSections.some(([id]) => hash === '#' + id) ? hash.slice(1) : ''} onChange={event => { if (event.target.value) navigate('/help#' + event.target.value) }}><option value="">Choose a topic</option>{helpSections.map(([id, title]) => <option key={id} value={id}>{topicLabels[id] || title}</option>)}</select></div>
    </div>
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
    <Section id="purpose"><p>This portal records internal IT faults, service requests, suspected or confirmed information-security incidents, and major security incidents. It keeps the reported impact, investigation, evidence, resolution, and review together so authorized colleagues can follow the work.</p></Section>
    <Section id="lifecycle">
      <ol className="help-lifecycle">{lifecycleStages.map(([title, text]) => <li key={title}><h3>{title}</h3><p>{text}</p></li>)}</ol>
      <p><strong>If the fix does not work:</strong> the original reporter can select Issue Still Persists on a Resolved incident. Feedback returns it to In Progress for further investigation. Validation and post-closure review are separate actions.</p>
    </Section>
    <Section id="roles"><div className="help-grid">{roleGuides.map(({ role, label, id, text, links }) => <section className="help-card help-role-target" tabIndex={-1} id={id} key={role}>
      <h3>{label}</h3><p>{text}</p>
      <div className="help-role-actions">{links.map(([anchor, name]) => <Link className="btn btn-sm btn-outline-secondary" key={anchor} to={'/help#' + anchor}>{name}</Link>)}</div>
    </section>)}</div><aside className="help-info" aria-label="About role permissions"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7v1" /></svg><p>Available actions depend on your role, identity, and the current incident status. Help links do not grant additional permissions; the application continues to enforce access rules.</p></aside></Section>
    <Section id="incident-types"><div className="help-grid">{issueTypes.map(type => <section className="help-card help-type-card" key={type}>
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
    <Section id="after-submission"><ol><li>The server generates a ticket number and records the signed-in reporter.</li><li>A default IT owner is assigned automatically; the initial status is Assigned.</li><li>Your incident appears in your accessible incident list. Reporter sees their own incidents; other supported roles can view incidents according to their access.</li><li>IT Handler or Admin investigate, record evidence and actions, and resolve the issue.</li><li>The original reporter tests the fix, validates it, and then closes the incident—or reports that it still persists.</li><li>Reviewer or Admin may record a post-closure review.</li></ol><p>Open Incident Details to check progress and history; do not assume every update sends a notification.</p></Section>
    <Section id="audit-trail"><p>The incident history records meaningful actions, who performed them, when they occurred, and relevant changes or remarks. Examples include creation, automatic assignment, investigation, evidence updates, resolution, validation, closure, review, and Attachment Added for each successfully stored image.</p><p>Human actors come from the authenticated session. System identifies automatic actions such as initial assignment. Image content is stored separately from history; a safe filename may identify an attachment in its audit entry.</p></Section>
    <Section id="monthly-reports"><p><strong>Available to IT Handler and Admin.</strong> Open Incidents, choose the month in Monthly Incident Report, and select Download Excel.</p>
      {canReport && <Link className="btn btn-outline-primary mb-3" to="/incidents">Open monthly reports in Incidents</Link>}
      <p>The selected month uses the original Reported At date/time. The workbook includes Incidents and Lifecycle History sheets, with current incident details and their history, including events recorded after the selected month. Very long text may be continued in a supporting sheet.</p><p><strong>This is not a month-end snapshot.</strong> Screenshot binary data is not included. A month without incidents produces an empty report with its structure.</p>
    </Section>
    <Section id="scenarios"><div className="help-grid">{scenarios.map(scenario => <section className="help-card" key={scenario.title}><h3>{scenario.title}</h3><p><strong>Type:</strong> {scenario.type}</p><p><strong>WHAT:</strong> {scenario.system}<br /><strong>WHO:</strong> {scenario.people}</p><p><strong>Title:</strong> {scenario.summary}</p><p>{scenario.description}</p><p>{scenario.image}</p></section>)}</div></Section>
    <Section id="faq">{faqs.map(([question, answer]) => <details className="help-field" key={question}><summary>{question}</summary><div><p>{answer}</p></div></details>)}</Section>
    <Link className="help-back" to="/help#help-top">↑ Back to top</Link>
  </article>
}
