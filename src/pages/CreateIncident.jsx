import { issueTypes, reporterDepartments, issueTypeGuide, levels, categoriesByIssueType, routineHrGuidance } from '../utils/incidentOptions'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ImagePicker from '../components/ImagePicker'
import { uploadAttachments } from '../api/attachments'
import { employeeAssignmentEnabled } from '../api/assignment'
import { createIncident, getResponsibleDepartments } from '../api/incidents'
import useAuth from '../auth/useAuth'
import PageTitle from '../components/PageTitle'
import FieldGuidance from '../components/FieldGuidance'
import IncidentLifecycleGuide from '../components/IncidentLifecycleGuide'
import { guidanceDescription } from '../utils/incidentGuidance'
import { getErrorMessage, labelize } from '../utils/incident'

const initialValues = {
  reporterDepartment: '', responsibleDepartmentId: '', deskNumber: '', title: '', description: '', issueType: '', category: '', affectedSystem: '', impactedUserOrDepartment: '', severity: '', priority: '',
}

const requiredFields = ['title', 'description', 'issueType', 'category', 'severity', 'priority', 'affectedSystem']
function CreateIncident() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [files, setFiles] = useState([])
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [departments, setDepartments] = useState(null)
  const [departmentLookupFailed, setDepartmentLookupFailed] = useState(false)
  const routineHrEnabled = import.meta.env.VITE_ROUTINE_HR_ISSUES_ENABLED === 'true'
  const createIssueTypes = routineHrEnabled ? [...issueTypes, 'HR_ISSUE'] : issueTypes
  const canCreate = ['REPORTER', 'ADMIN'].includes(user.role)
  const guardedIntake = employeeAssignmentEnabled()

  useEffect(() => {
    if (!canCreate) return
    let current = true
    getResponsibleDepartments().then((options) => {
      if (current) setDepartments(options)
    }).catch(() => {
      if (current) setDepartmentLookupFailed(true)
    })
    return () => { current = false }
  }, [canCreate])

  if (!canCreate) {
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
    const responsibleDepartment = departments?.find(({ id }) => String(id) === values.responsibleDepartmentId)
    if (routineHrEnabled && /^(hr|human resources)$/i.test(responsibleDepartment?.displayName.trim() ?? '')
      && ['IT_ISSUE', 'SERVICE_REQUEST'].includes(values.issueType)) {
      validationErrors.issueType = 'Select HR Issue for a routine request directed to HR.'
    }
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      setSubmitError('Please correct the highlighted fields before submitting.')
      return
    }

    setSubmitting(true)
    setSubmitError('')
    setErrors({})
    try {
      const { responsibleDepartmentId, ...payload } = values
      if (responsibleDepartmentId) payload.responsibleDepartmentId = Number(responsibleDepartmentId)
      const createdIncident = await createIncident(payload)
      if (!createdIncident?.id) throw new Error('Missing incident identifier')
      let uploadWarning = ''
      if (!guardedIntake && files.length) {
        try { await uploadAttachments(createdIncident.id, files) }
        catch { uploadWarning = 'Incident was created successfully, but the screenshots could not be uploaded. Please add them using the Attachments section below.' }
      }
      navigate(`/incidents/${createdIncident.id}`, { state: { uploadWarning } })
    } catch (requestError) {
      const fieldErrors = getBackendFieldErrors(requestError)
      if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors)
      const departmentRejected = requestError.response?.status === 400
        && requestError.response.data?.message === 'Select an active responsible department.'
      setSubmitError(departmentRejected ? requestError.response.data.message
        : getErrorMessage(requestError, 'The incident could not be created. Please review the form and try again.'))
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageTitle title="Create Incident" description="Register a new IT issue or incident." />
      <IncidentLifecycleGuide />
      <form noValidate onSubmit={handleSubmit}>
        {submitError && <div className="alert alert-danger" role="alert">{submitError}</div>}
        <FormSection title="Reporter Information"><div className="row g-3"><AuthenticatedReporter user={user} /><SelectField label="Reporter Department" name="reporterDepartment" options={reporterDepartments} formatOption={(option) => option} columnClass="col-12 col-lg-6" values={values} errors={errors} onChange={handleChange} /><TextField label="Desk Number" name="deskNumber" values={values} errors={errors} onChange={handleChange} /></div></FormSection>
        <FormSection title="Responsible Department">
          <label className="form-label fw-semibold" htmlFor="responsibleDepartmentId">Responsible Department (optional)</label>
          <select id="responsibleDepartmentId" name="responsibleDepartmentId" className="form-select"
            value={values.responsibleDepartmentId} onChange={handleChange}
            disabled={!departments?.length || submitting} aria-describedby="responsible-department-help">
            <option value="">No department selected</option>
            {departments?.map(({ id, displayName }) => <option key={id} value={id}>{displayName}</option>)}
          </select>
          <div id="responsible-department-help" className="form-text" role="status">
            {departmentLookupFailed ? 'Responsible departments are unavailable. You can still submit the incident.'
              : !departments ? 'Loading responsible departmentsâ€¦'
              : !departments.length ? 'No responsible departments are available.'
              : 'Select the department responsible for this issue. Your reporter department stays the same.'}
          </div>
        </FormSection>
        <FormSection title="Classification & Priority"><div className="row g-3"><SelectField label="Issue Type" name="issueType" options={createIssueTypes} required values={values} errors={errors} onChange={handleChange} /><CategoryField issueType={values.issueType} values={values} errors={errors} onChange={handleChange} /><SelectField label="Severity" name="severity" options={levels} required values={values} errors={errors} onChange={handleChange} /><SelectField label="Priority" name="priority" options={levels} required values={values} errors={errors} onChange={handleChange} /></div><IssueTypeGuide types={createIssueTypes} /></FormSection>
        {values.issueType === 'HR_ISSUE' && <p className="alert alert-warning">{routineHrGuidance}</p>}
        <FormSection title="Incident Details"><div className="row g-3"><TextField label="Title" name="title" required values={values} errors={errors} onChange={handleChange} /><TextField label="Description" name="description" required as="textarea" values={values} errors={errors} onChange={handleChange} /></div></FormSection>
        <FormSection title="Affected System / Impact"><div className="row g-3"><TextField label="Affected System" name="affectedSystem" required values={values} errors={errors} onChange={handleChange} /><TextField label="Impacted User / Department" name="impactedUserOrDepartment" values={values} errors={errors} onChange={handleChange} /></div></FormSection>
        <FormSection title="Attachments">{guardedIntake
          ? <p className="mb-0">Create the incident first. Add screenshots from Incident Details after your case permissions are approved.</p>
          : <ImagePicker files={files} onChange={setFiles} disabled={submitting} />}</FormSection>
        <div className="d-flex flex-wrap justify-content-end gap-2"><button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/incidents')} disabled={submitting}>Cancel</button><button type="submit" className="btn btn-primary" disabled={submitting}>{submitting && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}{submitting ? 'Creating Incidentâ€¦' : 'Create Incident'}</button></div>
      </form>
    </>
  )
}

function IssueTypeGuide({ types }) {
  return <aside className="card bg-light border mt-3" aria-labelledby="issue-type-guide-title">
    <div className="card-body p-3">
      <h3 className="h6 mb-3" id="issue-type-guide-title">Choosing an Issue Type</h3>
      <dl className="small text-secondary mb-0">
        {types.map((type, index) => <div className={`row g-1${index ? ' border-top pt-2 mt-2' : ''}`} key={type}>
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
  if (value === 'HR_ISSUE') return 'HR Issue'
  if (value === 'MAJOR_CRITICAL_SECURITY_INCIDENT') return 'Major / Critical Security Incident'
  return labelize(value).toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export default CreateIncident
