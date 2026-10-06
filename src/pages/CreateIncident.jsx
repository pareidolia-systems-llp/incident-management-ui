import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createIncident } from '../api/incidents'
import useAuth from '../auth/useAuth'
import PageTitle from '../components/PageTitle'
import FieldGuidance from '../components/FieldGuidance'
import { guidanceDescription } from '../utils/incidentGuidance'
import { getErrorMessage, labelize } from '../utils/incident'

const initialValues = {
  reporterDepartment: '', deskNumber: '', title: '', description: '', issueType: '', category: '', affectedSystem: '', impactedUserOrDepartment: '', severity: '', priority: '',
}

const requiredFields = ['title', 'description', 'issueType', 'category', 'severity', 'priority', 'affectedSystem']
const issueTypes = ['IT_ISSUE', 'SERVICE_REQUEST', 'SUSPECTED_SECURITY_INCIDENT', 'INFORMATION_SECURITY_INCIDENT', 'MAJOR_CRITICAL_SECURITY_INCIDENT']
const reporterDepartments = ['Operations (Annotation)', 'Operations (Perioperative Flow Analysis)', 'HR', 'R&D']
const issueTypeGuide = {
  IT_ISSUE: { meaning: 'Something in an application, device, network, or IT service is not working as expected.', example: 'VPN disconnecting or a workstation unable to connect to Wi-Fi.' },
  SERVICE_REQUEST: { meaning: 'A request for access, setup, installation, or another routine IT service rather than a fault.', example: 'Requesting access to an internal application or requesting software installation.' },
  SUSPECTED_SECURITY_INCIDENT: { meaning: 'Something appears suspicious but has not yet been confirmed as an information-security incident.', example: 'Unexpected MFA prompts or a suspicious email received by an employee.' },
  INFORMATION_SECURITY_INCIDENT: { meaning: 'A confirmed security event affecting information, systems, accounts, or access.', example: 'Confirmed unauthorized access to a company account.' },
  MAJOR_CRITICAL_SECURITY_INCIDENT: { meaning: 'A serious security incident with significant or widespread impact that requires urgent attention.', example: 'Major data exposure or widespread service disruption caused by a cyberattack.' },
}
const levels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
const categoriesByIssueType = {
  IT_ISSUE: ['Network / Connectivity', 'Account / Access', 'Hardware', 'Software / Application', 'Email / Collaboration', 'Device / Peripheral', 'Other'],
  SERVICE_REQUEST: ['Account / Access Request', 'Software Installation', 'Hardware Request', 'Permission / Access Change', 'General IT Request', 'Other'],
  SUSPECTED_SECURITY_INCIDENT: ['Phishing / Suspicious Email', 'Suspicious Login / Account Activity', 'Malware / Suspicious File', 'Unauthorized Access', 'Data Leakage / Exposure', 'Lost / Stolen Device', 'Other'],
  INFORMATION_SECURITY_INCIDENT: ['Account Compromise', 'Malware', 'Unauthorized Access', 'Data Breach / Exposure', 'Policy Violation', 'Security Control Failure', 'Other'],
  MAJOR_CRITICAL_SECURITY_INCIDENT: ['Ransomware', 'Major Data Breach', 'Critical System Compromise', 'Privileged Account Compromise', 'Widespread Malware', 'Major Service / Security Outage', 'Other'],
}

function CreateIncident() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!['REPORTER', 'ADMIN'].includes(user.role)) {
    return <><PageTitle title="Access denied" description="You do not have permission to create incidents." /><div className="card section-card"><div className="card-body"><button className="btn btn-outline-secondary" onClick={() => navigate('/incidents')}>Back to Incidents</button></div></div></>
  }

  function handleChange(event) {
    const { name, value } = event.target
    if (name === 'issueType') {
      setValues((current) => ({ ...current, issueType: value, category: '' }))
      setErrors((current) => ({ ...current, issueType: undefined, category: undefined }))
    } else {
      setValues((current) => ({ ...current, [name]: value }))
      setErrors((current) => ({ ...current, [name]: undefined }))
    }
    setSubmitError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    const validationErrors = validate(values)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      setSubmitError('Please correct the highlighted fields before submitting.')
      return
    }

    setSubmitting(true)
    setSubmitError('')
    setErrors({})
    try {
      const createdIncident = await createIncident(values)
      if (!createdIncident?.id) throw new Error('Missing incident identifier')
      navigate(`/incidents/${createdIncident.id}`)
    } catch (requestError) {
      const fieldErrors = getBackendFieldErrors(requestError)
      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors)
      setSubmitError(getErrorMessage(requestError, 'The incident could not be created. Please review the form and try again.'))
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageTitle title="Create Incident" description="Register a new IT issue or incident." />
      <form noValidate onSubmit={handleSubmit}>
        {submitError && <div className="alert alert-danger" role="alert">{submitError}</div>}
        <FormSection title="Reporter Information"><div className="row g-3"><AuthenticatedReporter user={user} /><SelectField label="Reporter Department" name="reporterDepartment" options={reporterDepartments} formatOption={(option) => option} columnClass="col-12 col-lg-6" values={values} errors={errors} onChange={handleChange} /><TextField label="Desk Number" name="deskNumber" values={values} errors={errors} onChange={handleChange} /></div></FormSection>
        <FormSection title="Incident Details"><div className="row g-3"><TextField label="Title" name="title" required values={values} errors={errors} onChange={handleChange} /><TextField label="Description" name="description" required as="textarea" values={values} errors={errors} onChange={handleChange} /></div></FormSection>
        <FormSection title="Classification & Priority"><div className="row g-3"><SelectField label="Issue Type" name="issueType" options={issueTypes} required values={values} errors={errors} onChange={handleChange} /><CategoryField issueType={values.issueType} values={values} errors={errors} onChange={handleChange} /><SelectField label="Severity" name="severity" options={levels} required values={values} errors={errors} onChange={handleChange} /><SelectField label="Priority" name="priority" options={levels} required values={values} errors={errors} onChange={handleChange} /></div><IssueTypeGuide /></FormSection>
        <FormSection title="Affected System / Impact"><div className="row g-3"><TextField label="Affected System" name="affectedSystem" required values={values} errors={errors} onChange={handleChange} /><TextField label="Impacted User / Department" name="impactedUserOrDepartment" values={values} errors={errors} onChange={handleChange} /></div></FormSection>
        <div className="d-flex flex-wrap justify-content-end gap-2"><button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/incidents')} disabled={submitting}>Cancel</button><button type="submit" className="btn btn-primary" disabled={submitting}>{submitting && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}{submitting ? 'Creating Incident…' : 'Create Incident'}</button></div>
      </form>
    </>
  )
}

function IssueTypeGuide() {
  return <aside className="card bg-light border mt-3" aria-labelledby="issue-type-guide-title">
    <div className="card-body p-3">
      <h3 className="h6 mb-3" id="issue-type-guide-title">Choosing an Issue Type</h3>
      <dl className="small text-secondary mb-0">
        {issueTypes.map((type, index) => <div className={`row g-1${index ? ' border-top pt-2 mt-2' : ''}`} key={type}>
          <dt className="col-12 col-md-3">{type === 'IT_ISSUE' ? 'IT Issue' : formatEnumLabel(type)}</dt>
          <dd className="col-12 col-md-9 mb-0">
            <div>{issueTypeGuide[type].meaning}</div>
            <div className="mt-1"><span className="fw-semibold">Example:</span> {issueTypeGuide[type].example}</div>
          </dd>
        </div>)}
      </dl>
    </div>
  </aside>
}

function FormSection({ title, children }) {
  return <section className="card section-card mb-3"><div className="card-body"><h2 className="h6 text-dark border-bottom pb-2 mb-3">{title}</h2>{children}</div></section>
}

function AuthenticatedReporter({ user }) {
  return <div className="col-12 col-lg-6"><div className="form-label fw-semibold">Reported By</div><div className="form-control bg-light"><div className="text-dark">{user.displayName}</div><small className="text-secondary">{user.email}</small></div></div>
}

function TextField({ label, name, required, as, values, errors, onChange }) {
  const Component = as || 'input'
  const fieldClass = `form-control${errors[name] ? ' is-invalid' : ''}`
  return <div className={as ? 'col-12' : 'col-12 col-lg-6'}><label className="form-label fw-semibold" htmlFor={name}>{label}{required && <span className="text-danger"> *</span>}</label><Component id={name} name={name} value={values[name]} onChange={onChange} className={fieldClass} rows={as ? 5 : undefined} aria-describedby={guidanceDescription(name, name, errors[name])} />{errors[name] && <div id={`${name}-error`} className="invalid-feedback">{errors[name]}</div>}<FieldGuidance name={name} id={name} label={label} /></div>
}

function SelectField({ label, name, options, required, values, errors, onChange, formatOption = formatEnumLabel, columnClass = 'col-12 col-sm-6 col-lg-3' }) {
  return <div className={columnClass}><label className="form-label fw-semibold" htmlFor={name}>{label}{required && <span className="text-danger"> *</span>}</label><select id={name} name={name} value={values[name]} onChange={onChange} className={`form-select${errors[name] ? ' is-invalid' : ''}`} aria-describedby={guidanceDescription(name, name, errors[name])}><option value="">Select {label}</option>{options.map((option) => <option key={option} value={option}>{formatOption(option)}</option>)}</select>{errors[name] && <div id={`${name}-error`} className="invalid-feedback">{errors[name]}</div>}<FieldGuidance name={name} id={name} label={label} /></div>
}

function CategoryField({ issueType, values, errors, onChange }) {
  const categories = categoriesByIssueType[issueType] || []
  return <div className="col-12 col-sm-6 col-lg-3"><label className="form-label fw-semibold" htmlFor="category">Category <span className="text-danger">*</span></label><select id="category" name="category" value={values.category} onChange={onChange} disabled={!issueType} className={`form-select${errors.category ? ' is-invalid' : ''}`} aria-describedby={guidanceDescription('category', 'category', errors.category)}><option value="">{issueType ? 'Select Category' : 'Select Issue Type first'}</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select>{errors.category && <div id="category-error" className="invalid-feedback">{errors.category}</div>}<FieldGuidance name="category" id="category" label="Category" /></div>
}

function validate(values) {
  return requiredFields.reduce((errors, field) => {
    if (!values[field].trim()) errors[field] = 'This field is required.'
    return errors
  }, {})
}

function getBackendFieldErrors(error) {
  const payload = error.response?.data
  const candidates = [payload?.fieldErrors, payload?.errors, payload]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const fieldErrors = candidate.reduce((errors, item) => {
        const message = item?.message || item?.defaultMessage
        if (item?.field && typeof message === 'string') errors[item.field] = message
        return errors
      }, {})
      if (Object.keys(fieldErrors).length > 0) return fieldErrors
    }
    if (candidate && typeof candidate === 'object') {
      const fieldErrors = Object.entries(candidate).reduce((errors, [field, message]) => {
        if (field in initialValues && typeof message === 'string') errors[field] = message
        return errors
      }, {})
      if (Object.keys(fieldErrors).length > 0) return fieldErrors
    }
  }
  return {}
}

function formatEnumLabel(value) {
  if (value === 'MAJOR_CRITICAL_SECURITY_INCIDENT') return 'Major / Critical Security Incident'
  return labelize(value).toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default CreateIncident
