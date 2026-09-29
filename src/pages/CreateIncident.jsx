import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createIncident } from '../api/incidents'
import PageTitle from '../components/PageTitle'
import { getErrorMessage, labelize } from '../utils/incident'

const initialValues = {
  reportedBy: '', reporterDepartment: '', title: '', description: '', issueType: '', category: '', affectedSystem: '', impactedUserOrDepartment: '', severity: '', priority: '',
}

const requiredFields = ['reportedBy', 'title', 'description', 'issueType', 'severity', 'priority']
const issueTypes = ['IT_ISSUE', 'SERVICE_REQUEST', 'SUSPECTED_SECURITY_INCIDENT', 'INFORMATION_SECURITY_INCIDENT', 'MAJOR_CRITICAL_SECURITY_INCIDENT']
const levels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

function CreateIncident() {
  const navigate = useNavigate()
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleChange(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
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
        <FormSection title="Reporter Information"><div className="row g-3"><TextField label="Reported By" name="reportedBy" required values={values} errors={errors} onChange={handleChange} /><TextField label="Reporter Department" name="reporterDepartment" values={values} errors={errors} onChange={handleChange} /></div></FormSection>
        <FormSection title="Incident Details"><div className="row g-3"><TextField label="Title" name="title" required values={values} errors={errors} onChange={handleChange} /><TextField label="Description" name="description" required as="textarea" values={values} errors={errors} onChange={handleChange} /></div></FormSection>
        <FormSection title="Classification & Priority"><div className="row g-3"><SelectField label="Issue Type" name="issueType" options={issueTypes} required values={values} errors={errors} onChange={handleChange} /><TextField label="Category" name="category" values={values} errors={errors} onChange={handleChange} /><SelectField label="Severity" name="severity" options={levels} required values={values} errors={errors} onChange={handleChange} /><SelectField label="Priority" name="priority" options={levels} required values={values} errors={errors} onChange={handleChange} /></div></FormSection>
        <FormSection title="Affected System / Impact"><div className="row g-3"><TextField label="Affected System" name="affectedSystem" values={values} errors={errors} onChange={handleChange} /><TextField label="Impacted User / Department" name="impactedUserOrDepartment" values={values} errors={errors} onChange={handleChange} /></div></FormSection>
        <div className="d-flex flex-wrap justify-content-end gap-2"><button type="button" className="btn btn-outline-secondary" onClick={() => navigate('/incidents')} disabled={submitting}>Cancel</button><button type="submit" className="btn btn-primary" disabled={submitting}>{submitting && <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />}{submitting ? 'Creating Incident…' : 'Create Incident'}</button></div>
      </form>
    </>
  )
}

function FormSection({ title, children }) {
  return <section className="card section-card mb-3"><div className="card-body"><h2 className="h6 text-dark border-bottom pb-2 mb-3">{title}</h2>{children}</div></section>
}

function TextField({ label, name, required, as, values, errors, onChange }) {
  const Component = as || 'input'
  const fieldClass = `form-control${errors[name] ? ' is-invalid' : ''}`
  return <div className={as ? 'col-12' : 'col-12 col-lg-6'}><label className="form-label fw-semibold" htmlFor={name}>{label}{required && <span className="text-danger"> *</span>}</label><Component id={name} name={name} value={values[name]} onChange={onChange} className={fieldClass} rows={as ? 5 : undefined} aria-describedby={errors[name] ? `${name}-error` : undefined} />{errors[name] && <div id={`${name}-error`} className="invalid-feedback">{errors[name]}</div>}</div>
}

function SelectField({ label, name, options, required, values, errors, onChange }) {
  return <div className="col-12 col-sm-6 col-lg-3"><label className="form-label fw-semibold" htmlFor={name}>{label}{required && <span className="text-danger"> *</span>}</label><select id={name} name={name} value={values[name]} onChange={onChange} className={`form-select${errors[name] ? ' is-invalid' : ''}`} aria-describedby={errors[name] ? `${name}-error` : undefined}><option value="">Select {label}</option>{options.map((option) => <option key={option} value={option}>{formatEnumLabel(option)}</option>)}</select>{errors[name] && <div id={`${name}-error`} className="invalid-feedback">{errors[name]}</div>}</div>
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
